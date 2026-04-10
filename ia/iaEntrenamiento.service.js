/**
 * ia/iaEntrenamiento.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA 2 — Servicio de Entrenamiento (Pseudo-ML con brain.js)
 *
 * Responsabilidades:
 *   1. Cargar datos históricos desde MongoDB (años cerrados: 2024, 2025).
 *   2. Pasar cada registro por iaPreprocesador para obtener las 4 métricas.
 *   3. Entrenar una red neuronal brain.js con capas ocultas [6, 6].
 *   4. Guardar el modelo entrenado en modelo_ia.json (raíz del proyecto).
 *   5. Mantener el modelo en memoria (Singleton) para predicciones en vivo
 *      sin necesidad de reiniciar Express.
 *
 * Uso desde el controlador de admin:
 *   const { ejecutarReentrenamiento } = require('../ia/iaEntrenamiento.service');
 *   const resultado = await ejecutarReentrenamiento();
 *
 * PREREQUISITO:
 *   npm install brain.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ✅ Versión CPU pura, sin gpu.js
const brain = require('brain.js/dist/browser');
const fs     = require('fs');
const path   = require('path');

const { preprocesar }         = require('./iaPreprocesador');
const { obtenerConfigColegio }= require('./iaConfig');

const {
  Nota,
  EntregaActividad,
  Actividad,
  ResultadoAnual,
  Periodo,
} = require('../models');

// ── Rutas ─────────────────────────────────────────────────────────────────────
const MODELO_PATH = path.resolve(__dirname, '../modelo_ia.json');

// ── Singleton del modelo en memoria ──────────────────────────────────────────
// Esta variable persiste entre requests — no se recrea en cada predicción.
let _redEnMemoria = null;

/**
 * Devuelve la red neuronal cargada en memoria.
 * Si no existe, intenta cargarla desde modelo_ia.json.
 * Si el archivo tampoco existe, retorna null (el admin debe entrenar primero).
 *
 * @returns {brain.NeuralNetwork|null}
 */
function obtenerRedEnMemoria() {
  if (_redEnMemoria) return _redEnMemoria;

  if (!fs.existsSync(MODELO_PATH)) return null;

  try {
    const json = JSON.parse(fs.readFileSync(MODELO_PATH, 'utf8'));
    const red  = new brain.NeuralNetwork({ hiddenLayers: [6, 6] });
    red.fromJSON(json);
    _redEnMemoria = red;
    console.log('[IA] Modelo cargado desde modelo_ia.json en memoria.');
    return _redEnMemoria;
  } catch (err) {
    console.error('[IA] Error cargando modelo_ia.json:', err.message);
    return null;
  }
}

// ── PASO 1: Carga de datos históricos desde MongoDB ───────────────────────────

/**
 * Consulta MongoDB y construye el dataset de entrenamiento.
 * Solo usa años con ResultadoAnual (años ya cerrados: 2024, 2025).
 *
 * Por cada par (estudianteId, materiaId, año) con ResultadoAnual:
 *   - Agrupa las notas por periodo
 *   - Cuenta tareas entregadas vs totales
 *   - Invoca preprocesar() para obtener las 4 métricas
 *   - Usa ResultadoAnual.aprobado como etiqueta de salida
 *
 * @returns {Promise<Array<{ input: Object, output: Object }>>}
 */
async function cargarDatosHistoricos() {
  console.log('[IA] Cargando datos históricos de MongoDB...');

  const config = await obtenerConfigColegio();

  // Todos los ResultadoAnual existentes (etiquetas de entrenamiento)
  const resultados = await ResultadoAnual.find({})
    .select('estudianteId materiaId gradoId año aprobado')
    .lean();

  console.log(`[IA] ResultadoAnual encontrados: ${resultados.length}`);

  if (resultados.length === 0) {
    throw new Error(
      'No hay ResultadoAnual en la BD. Ejecuta los seeders de 2024 y 2025 primero.'
    );
  }

  // Precarga de periodos para mapear periodoId → numeroPeriodo
  const periodos = await Periodo.find({}).select('_id numero año').lean();
  const periodoMap = {}; // periodoId → { numero, año }
  for (const p of periodos) periodoMap[p._id.toString()] = p;

  const dataset   = [];
  let   omitidos  = 0;

  for (const ra of resultados) {
    const { estudianteId, materiaId, gradoId, año, aprobado } = ra;

    try {
      // ── Notas del estudiante en esta materia y año ─────────────────────────
      const notas = await Nota.find({
        estudianteId,
        materiaId,
        gradoId,
        año,
      }).select('valor periodoId').lean();

      if (notas.length === 0) {
        omitidos++;
        continue;
      }

      // Agrupar notas por número de periodo
      const notasPorPeriodo = {};
      for (const n of notas) {
        const pid  = n.periodoId.toString();
        const pNum = periodoMap[pid]?.numero ?? 0;
        if (!notasPorPeriodo[pNum]) notasPorPeriodo[pNum] = [];
        notasPorPeriodo[pNum].push(n.valor);
      }

      const notasPorPeriodoArr = Object.entries(notasPorPeriodo).map(
        ([num, vals]) => ({ numeroPeriodo: parseInt(num), notas: vals })
      );

      // ── Tareas: total asignadas vs entregadas por el estudiante ───────────
      // Total de actividades del grado-materia-año
      const actividadesIds = await Actividad.distinct('_id', {
        gradoId,
        materiaId,
        periodoId: {
          $in: periodos
            .filter(p => p.año === año)
            .map(p => p._id),
        },
      });

      const totalTareas = actividadesIds.length;

      const tareasEntregadas = await EntregaActividad.countDocuments({
        estudianteId,
        actividadId: { $in: actividadesIds },
      });

      // ── Preprocesar ────────────────────────────────────────────────────────
      const { input } = preprocesar(
        { notasPorPeriodo: notasPorPeriodoArr, tareasEntregadas, totalTareas },
        config
      );

      // ── Etiqueta de salida ─────────────────────────────────────────────────
      // brain.js necesita valores entre 0 y 1 en la salida
      // Usamos 0.05 y 0.95 en vez de 0 y 1 para evitar saturación de la red
      dataset.push({
        input,
        output: { exito: aprobado ? 0.95 : 0.05 },
      });

    } catch (err) {
      console.warn(`[IA] Error procesando ResultadoAnual (${estudianteId}-${materiaId}-${año}): ${err.message}`);
      omitidos++;
    }
  }

  console.log(`[IA] Dataset construido: ${dataset.length} registros | Omitidos: ${omitidos}`);
  return dataset;
}

// ── PASO 2: Entrenamiento ─────────────────────────────────────────────────────

/**
 * Entrena la red neuronal con los datos recibidos.
 *
 * @param {Array<{ input: Object, output: Object }>} datosHistoricos
 * @returns {Promise<{ error: number, iterations: number, registros: number }>}
 */
async function ejecutarEntrenamiento(datosHistoricos) {
  if (!datosHistoricos || datosHistoricos.length === 0) {
    throw new Error('No hay datos de entrenamiento disponibles.');
  }

  console.log(`[IA] Iniciando entrenamiento con ${datosHistoricos.length} registros...`);

  // ── Configuración de la red ────────────────────────────────────────────────
  const red = new brain.NeuralNetwork({
    hiddenLayers:       [6, 6],
    activation:         'sigmoid',
    learningRate:       0.01,
    momentum:           0.1,
  });

  // ── Entrenamiento ──────────────────────────────────────────────────────────
  const inicio    = Date.now();
  const resultado = red.train(datosHistoricos, {
    iterations:    20000,
    errorThresh:   0.005,   // detiene antes si el error es suficientemente bajo
    logPeriod:     2000,
    log: (stats) => {
      console.log(
        `[IA] iter=${stats.iterations} | error=${stats.error.toFixed(6)}`
      );
    },
  });

  const duracionMs = Date.now() - inicio;

  console.log('─'.repeat(54));
  console.log(`[IA] Entrenamiento completado en ${(duracionMs / 1000).toFixed(1)}s`);
  console.log(`[IA] Iteraciones : ${resultado.iterations}`);
  console.log(`[IA] Error final : ${resultado.error.toFixed(6)}`);
  console.log('─'.repeat(54));

  // ── Persistencia: guardar modelo_ia.json ──────────────────────────────────
  const modeloJSON = {
    ...red.toJSON(),
    _meta: {
      entrenadoEn:  new Date().toISOString(),
      iteraciones:  resultado.iterations,
      errorFinal:   resultado.error,
      registros:    datosHistoricos.length,
      version:      '1.0.0',
    },
  };

  fs.writeFileSync(MODELO_PATH, JSON.stringify(modeloJSON, null, 2), 'utf8');
  console.log(`[IA] Modelo guardado en: ${MODELO_PATH}`);

  // ── Refrescar singleton en memoria SIN reiniciar Express ──────────────────
  const redFresca = new brain.NeuralNetwork({ hiddenLayers: [6, 6] });
  redFresca.fromJSON(modeloJSON);
  _redEnMemoria = redFresca;
  console.log('[IA] Modelo refrescado en memoria.');

  return {
    error:      resultado.error,
    iterations: resultado.iterations,
    registros:  datosHistoricos.length,
    duracionMs,
  };
}

// ── PASO 3: Pipeline completo (lo que llama el controlador de admin) ──────────

/**
 * Punto de entrada principal.
 * Carga los datos históricos y ejecuta el entrenamiento en un solo paso.
 * Es la función que dispara el botón del panel de administrador.
 *
 * @returns {Promise<{
 *   exito:      boolean,
 *   mensaje:    string,
 *   error?:     number,
 *   iterations?: number,
 *   registros?:  number,
 *   duracionMs?: number,
 * }>}
 */
async function ejecutarReentrenamiento() {
  try {
    const datos     = await cargarDatosHistoricos();
    const resultado = await ejecutarEntrenamiento(datos);

    return {
      exito:      true,
      mensaje:    `Modelo entrenado con ${resultado.registros} registros. Error: ${resultado.error.toFixed(6)}.`,
      ...resultado,
    };
  } catch (err) {
    console.error('[IA] Error en reentrenamiento:', err.message);
    return {
      exito:   false,
      mensaje: err.message,
    };
  }
}

module.exports = {
  ejecutarReentrenamiento,   // llamado por el controlador de admin
  cargarDatosHistoricos,     // útil para inspección/debug
  obtenerRedEnMemoria,       // usada por el Orquestador para predicciones
};
