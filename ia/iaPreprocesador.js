/**
 * ia/iaPreprocesador.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA 1 — Preprocesador de Datos (Ingeniería de Características)
 *
 * Transforma datos crudos de MongoDB en exactamente 4 métricas normalizadas
 * entre 0 y 1 que la red neuronal (brain.js) puede procesar.
 *
 * FUNCIÓN PURA — no depende de ninguna base de datos.
 * Recibe todo por parámetros, no importa mongoose ni modelos.
 *
 * Métricas generadas:
 *   nota        → Promedio de todas las notas disponibles, normalizado 0-1.
 *   tendencia   → Mejora/caída entre el último y penúltimo periodo.
 *                 0.5 = estable | >0.5 = mejora | <0.5 = caída.
 *                 Si solo hay 1 periodo: 0.5 (neutral).
 *   compromiso  → Ratio de tareas entregadas / total de tareas asignadas.
 *   estabilidad → Constancia en las notas. 1 = muy constante, 0 = muy disperso.
 *
 * Uso:
 *   const { preprocesar } = require('./iaPreprocesador');
 *
 *   const resultado = preprocesar({
 *     notasPorPeriodo: [
 *       { numeroPeriodo: 1, notas: [3.5, 4.0, 3.8] },
 *       { numeroPeriodo: 2, notas: [4.2, 4.5, 4.0] },
 *     ],
 *     tareasEntregadas: 8,
 *     totalTareas:      10,
 *   }, {
 *     escalaMin:      1.0,
 *     escalaMax:      5.0,
 *     notaAprobacion: 3.0,
 *   });
 *
 *   // resultado → { input: { nota, tendencia, compromiso, estabilidad } }
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Helpers matemáticos ───────────────────────────────────────────────────────

/**
 * Clamp: asegura que un valor esté entre min y max.
 */
function clamp(valor, min = 0, max = 1) {
  return Math.max(min, Math.min(max, valor));
}

/**
 * Promedio simple de un array de números.
 * Retorna 0 si el array está vacío.
 */
function promedio(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Desviación estándar de un array de números.
 * Retorna 0 si hay menos de 2 elementos.
 */
function desviacionEstandar(arr) {
  if (!arr || arr.length < 2) return 0;
  const media = promedio(arr);
  const varianza = arr.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / arr.length;
  return Math.sqrt(varianza);
}

// ── Métricas ──────────────────────────────────────────────────────────────────

/**
 * MÉTRICA 1 — Nota promedio normalizada.
 * Toma todas las notas de todos los periodos disponibles.
 *
 * Fórmula: (promedio - escalaMin) / (escalaMax - escalaMin)
 *
 * @param {number[][]} notasPlanas - Todas las notas del estudiante en la materia.
 * @param {number}     escalaMin
 * @param {number}     escalaMax
 * @returns {number} valor entre 0 y 1
 */
function calcularNota(notasPlanas, escalaMin, escalaMax) {
  if (!notasPlanas || notasPlanas.length === 0) return 0;
  const rango = escalaMax - escalaMin;
  if (rango === 0) return 0.5;
  const prom  = promedio(notasPlanas);
  return clamp((prom - escalaMin) / rango);
}

/**
 * MÉTRICA 2 — Tendencia entre periodos.
 * Compara el promedio del último periodo vs el penúltimo.
 *
 * Resultado:
 *   0.5       → estable (sin cambio o sin periodo anterior)
 *   > 0.5     → mejora
 *   < 0.5     → caída
 *
 * La diferencia se mapea al rango [-rango, +rango] y se centra en 0.5:
 *   tendencia = 0.5 + (diff / rango) * 0.5
 *
 * @param {Array<{ numeroPeriodo: number, notas: number[] }>} notasPorPeriodo
 * @param {number} escalaMin
 * @param {number} escalaMax
 * @returns {number} valor entre 0 y 1
 */
function calcularTendencia(notasPorPeriodo, escalaMin, escalaMax) {
  if (!notasPorPeriodo || notasPorPeriodo.length < 2) {
    return 0.5; // neutral — sin periodo anterior
  }

  // Ordenar por número de periodo ascendente
  const ordenados = [...notasPorPeriodo].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo);
  const ultimo     = ordenados[ordenados.length - 1];
  const penultimo  = ordenados[ordenados.length - 2];

  const promedioActual  = promedio(ultimo.notas);
  const promedioAnterior= promedio(penultimo.notas);
  const diff            = promedioActual - promedioAnterior;
  const rango           = escalaMax - escalaMin;

  if (rango === 0) return 0.5;

  // Normaliza la diferencia al rango [-1, +1] y la centra en 0.5
  const tendencia = 0.5 + (diff / rango) * 0.5;
  return clamp(tendencia);
}

/**
 * MÉTRICA 3 — Ratio de compromiso.
 * Proporción de tareas que el estudiante entregó sobre el total asignado.
 *
 * Fórmula: tareasEntregadas / totalTareas
 *
 * @param {number} tareasEntregadas
 * @param {number} totalTareas
 * @returns {number} valor entre 0 y 1
 */
function calcularCompromiso(tareasEntregadas, totalTareas) {
  if (!totalTareas || totalTareas === 0) return 0.5; // sin tareas → neutral
  return clamp(tareasEntregadas / totalTareas);
}

/**
 * MÉTRICA 4 — Índice de estabilidad.
 * Mide qué tan constantes son las notas del estudiante en la materia.
 *
 * Fórmula: 1 - (desviacionEstandar / rango)
 *   → Si las notas son idénticas: desv = 0 → estabilidad = 1 (máxima constancia)
 *   → Si las notas oscilan entre min y max: desv ≈ rango/2 → estabilidad ≈ 0
 *
 * @param {number[]} notasPlanas - Todas las notas del estudiante en la materia.
 * @param {number}   escalaMin
 * @param {number}   escalaMax
 * @returns {number} valor entre 0 y 1
 */
function calcularEstabilidad(notasPlanas, escalaMin, escalaMax) {
  if (!notasPlanas || notasPlanas.length < 2) return 1; // una sola nota → estable por definición
  const rango = escalaMax - escalaMin;
  if (rango === 0) return 1;
  const desv  = desviacionEstandar(notasPlanas);
  return clamp(1 - desv / rango);
}

// ── Función principal exportada ───────────────────────────────────────────────

/**
 * Preprocesa los datos crudos de una materia y retorna las 4 métricas
 * normalizadas listas para brain.js.
 *
 * @param {Object} datosMateria
 * @param {Array<{ numeroPeriodo: number, notas: number[] }>} datosMateria.notasPorPeriodo
 *   Notas agrupadas por periodo. Puede tener 1 o más periodos.
 * @param {number} datosMateria.tareasEntregadas
 *   Cantidad de actividades que el estudiante entregó.
 * @param {number} datosMateria.totalTareas
 *   Cantidad total de actividades asignadas al estudiante en la materia.
 *
 * @param {Object} configColegio
 * @param {number} configColegio.escalaMin      - Nota mínima del colegio (ej: 1.0)
 * @param {number} configColegio.escalaMax      - Nota máxima del colegio (ej: 5.0)
 * @param {number} configColegio.notaAprobacion - Nota mínima para aprobar (ej: 3.0)
 *
 * @returns {{
 *   input: {
 *     nota:        number,  // 0–1
 *     tendencia:   number,  // 0–1 (0.5 = estable)
 *     compromiso:  number,  // 0–1
 *     estabilidad: number,  // 0–1
 *   },
 *   _debug: {
 *     promedioReal:    number,
 *     periodosCubiertos: number,
 *     totalNotas:      number,
 *   }
 * }}
 */
function preprocesar(datosMateria, configColegio) {
  const {
    notasPorPeriodo  = [],
    tareasEntregadas = 0,
    totalTareas      = 0,
  } = datosMateria;

  const {
    escalaMin      = 1.0,
    escalaMax      = 5.0,
  } = configColegio;

  // Aplanar todas las notas de todos los periodos en un solo array
  const notasPlanas = notasPorPeriodo.flatMap(p => p.notas || []);

  const nota        = calcularNota(notasPlanas, escalaMin, escalaMax);
  const tendencia   = calcularTendencia(notasPorPeriodo, escalaMin, escalaMax);
  const compromiso  = calcularCompromiso(tareasEntregadas, totalTareas);
  const estabilidad = calcularEstabilidad(notasPlanas, escalaMin, escalaMax);

  return {
    input: {
      nota:        Math.round(nota        * 10000) / 10000,
      tendencia:   Math.round(tendencia   * 10000) / 10000,
      compromiso:  Math.round(compromiso  * 10000) / 10000,
      estabilidad: Math.round(estabilidad * 10000) / 10000,
    },
    // _debug se usa en tests y logs, NO se pasa a brain.js
    _debug: {
      promedioReal:      Math.round(promedio(notasPlanas) * 100) / 100,
      periodosCubiertos: notasPorPeriodo.length,
      totalNotas:        notasPlanas.length,
    },
  };
}

module.exports = {
  preprocesar,
  // Exportar helpers por si el Interpretador los necesita directamente
  calcularNota,
  calcularTendencia,
  calcularCompromiso,
  calcularEstabilidad,
};
