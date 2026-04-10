/**
 * ia/AnalisisAcademico.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA 4 — Orquestador del Módulo de Inteligencia Académica
 *
 * Une las 3 capas anteriores en un flujo de trabajo completo:
 *   1. Carga el modelo brain.js desde memoria (Singleton).
 *   2. Consulta MongoDB por todas las materias del estudiante en el año activo.
 *   3. Por cada materia: Preprocesador → IA → Interpretador FODA.
 *   4. Consolida y retorna el reporte completo listo para el frontend.
 *
 * Uso desde el controlador:
 *   const { generarReporteEstudiante } = require('../ia/AnalisisAcademico.service');
 *   const reporte = await generarReporteEstudiante(estudianteId);
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');

const { obtenerRedEnMemoria }    = require('./iaEntrenamiento.service');
const { preprocesar }            = require('./iaPreprocesador');
const { interpretarFODA }        = require('./iaInterpretador');
const { obtenerConfigColegio }   = require('./iaConfig');

const {
  Usuario,
  Matricula,
  Grado,
  Materia,
  Nota,
  Actividad,
  EntregaActividad,
  Periodo,
  ResultadoPeriodo,
} = require('../models');

// ── Año activo — el que tiene al menos 1 periodo activo ──────────────────────
// Se cachea en memoria para no recalcular en cada request.
let _añoActivoCache = null;

async function obtenerAñoActivo() {
  if (_añoActivoCache) return _añoActivoCache;

  const periodoActivo = await Periodo.findOne({ activo: true })
    .sort({ año: -1 })
    .select('año numero')
    .lean();

  if (!periodoActivo) {
    // Si no hay periodo activo, usar el año más reciente con datos
    const ultimoPeriodo = await Periodo.findOne()
      .sort({ año: -1, numero: -1 })
      .select('año')
      .lean();
    _añoActivoCache = ultimoPeriodo?.año || new Date().getFullYear();
  } else {
    _añoActivoCache = periodoActivo.año;
  }

  return _añoActivoCache;
}

// ── Consulta de datos de una materia para un estudiante ───────────────────────

/**
 * Recopila todos los datos crudos de un estudiante en una materia específica
 * para el año activo.
 *
 * @param {ObjectId} estudianteId
 * @param {ObjectId} materiaId
 * @param {ObjectId} gradoId
 * @param {number}   año
 * @returns {Promise<{
 *   notasPorPeriodo:    Array<{ numeroPeriodo: number, notas: number[] }>,
 *   tareasEntregadas:   number,
 *   totalTareas:        number,
 *   promedioReal:       number,
 *   periodosConDatos:   number,
 *   totalPeriodosAño:   number,
 * }>}
 */
async function recopilarDatosMateria(estudianteId, materiaId, gradoId, año) {
  // Periodos del año — para saber cuántos hay en total y sus IDs
  const periodosDelAño = await Periodo.find({ año })
    .sort({ numero: 1 })
    .select('_id numero')
    .lean();

  const periodoIds    = periodosDelAño.map(p => p._id);
  const totalPeriodos = periodosDelAño.length; // normalmente 4

  // Notas del estudiante en esta materia y año
  const notas = await Nota.find({
    estudianteId,
    materiaId,
    gradoId,
    año,
  }).select('valor periodoId').lean();

  // Agrupar notas por número de periodo
  const periodoNumMap = {};
  for (const p of periodosDelAño) periodoNumMap[p._id.toString()] = p.numero;

  const notasPorPeriodoMap = {};
  for (const n of notas) {
    const numPeriodo = periodoNumMap[n.periodoId.toString()] ?? 0;
    if (!notasPorPeriodoMap[numPeriodo]) notasPorPeriodoMap[numPeriodo] = [];
    notasPorPeriodoMap[numPeriodo].push(n.valor);
  }

  const notasPorPeriodo = Object.entries(notasPorPeriodoMap).map(
    ([num, vals]) => ({ numeroPeriodo: parseInt(num), notas: vals })
  );

  // Promedio real (escala 1-5)
  const todasLasNotas = notas.map(n => n.valor);
  const promedioReal  = todasLasNotas.length > 0
    ? Math.round((todasLasNotas.reduce((a, b) => a + b, 0) / todasLasNotas.length) * 100) / 100
    : 0;

  // Actividades asignadas al grado-materia en el año (solo cerradas)
  const actividadesCerradas = await Actividad.find({
    gradoId,
    materiaId,
    periodoId: { $in: periodoIds },
    estado: 'cerrada',
  }).select('_id').lean();

  const totalTareas = actividadesCerradas.length;

  // Entregas del estudiante para esas actividades
  const tareasEntregadas = totalTareas > 0
    ? await EntregaActividad.countDocuments({
        estudianteId,
        actividadId: { $in: actividadesCerradas.map(a => a._id) },
      })
    : 0;

  return {
    notasPorPeriodo,
    tareasEntregadas,
    totalTareas,
    promedioReal,
    periodosConDatos: notasPorPeriodo.length,
    totalPeriodosAño: totalPeriodos,
  };
}

// ── Función principal exportada ───────────────────────────────────────────────

/**
 * Genera el reporte completo de análisis académico para un estudiante.
 *
 * @param {string|ObjectId} estudianteId
 * @returns {Promise<{
 *   exito:          boolean,
 *   error?:         string,
 *   requiereEntrenamiento?: boolean,
 *   estudiante: {
 *     id:       string,
 *     nombre:   string,
 *     apellido: string,
 *     grado:    string,
 *     nivel:    number,
 *   },
 *   año:            number,
 *   resumenGlobal: {
 *     promedioGeneral:   number,
 *     porcentajeExito:   number,
 *     materiasEnRiesgo:  number,
 *     totalMaterias:     number,
 *     nivelGlobal:       string,
 *   },
 *   materias: Array<{
 *     materia:         string,
 *     prediccion:      number,
 *     porcentajeExito: number,
 *     nivel:           string,
 *     foda:            Object,
 *     notaProyectada:  Object,
 *     metricas:        Object,
 *   }>,
 *   generadoEn: string,
 * }>}
 */
async function generarReporteEstudiante(estudianteId) {
  // ── 1. Verificar modelo en memoria ─────────────────────────────────────────
  const red = obtenerRedEnMemoria();

  if (!red) {
    return {
      exito:  false,
      requiereEntrenamiento: true,
      error:  'El modelo de IA no está disponible. Un administrador debe ejecutar el entrenamiento desde el panel de control antes de usar esta función.',
    };
  }

  try {
    // ── 2. Datos del estudiante ───────────────────────────────────────────────
    const eId = typeof estudianteId === 'string'
      ? new mongoose.Types.ObjectId(estudianteId)
      : estudianteId;

    const estudiante = await Usuario.findById(eId)
      .select('nombre apellido rol')
      .lean();

    if (!estudiante || estudiante.rol !== 'estudiante') {
      return { exito: false, error: 'Estudiante no encontrado.' };
    }

    // ── 3. Matrícula activa del estudiante ────────────────────────────────────
    const año = await obtenerAñoActivo();

    const matricula = await Matricula.findOne({
      estudianteId: eId,
      año,
      estado: 'activa',
    }).populate('gradoId', 'nombre nivel materias').lean();

    if (!matricula) {
      return {
        exito: false,
        error: `El estudiante no tiene matrícula activa para el año ${año}.`,
      };
    }

    const grado   = matricula.gradoId;
    const gradoId = grado._id;

    // ── 4. Materias del grado ─────────────────────────────────────────────────
    const materias = await Materia.find({
      _id:    { $in: grado.materias },
      activo: true,
    }).select('_id nombre').lean();

    if (materias.length === 0) {
      return { exito: false, error: 'El grado del estudiante no tiene materias asignadas.' };
    }

    // ── 5. Configuración del colegio ──────────────────────────────────────────
    const config = await obtenerConfigColegio();

    // ── 6. Procesar cada materia ──────────────────────────────────────────────
    const reportesMaterias = [];
    let   sumaExito        = 0;
    let   materiasEnRiesgo = 0;
    let   sumaPromedio     = 0;

    for (const materia of materias) {
      try {
        // 6a. Recopilar datos crudos
        const datos = await recopilarDatosMateria(eId, materia._id, gradoId, año);

        // Si no hay ninguna nota aún, generar un reporte neutral
        if (datos.notasPorPeriodo.length === 0) {
          reportesMaterias.push({
            materia:         materia.nombre,
            prediccion:      0.5,
            porcentajeExito: 50,
            nivel:           'Sin datos suficientes',
            foda: {
              fortalezas:    [],
              oportunidades: ['Aún no hay notas registradas en esta materia para el período actual.'],
              debilidades:   [],
              amenazas:      [],
            },
            notaProyectada: {
              notaNecesaria: null,
              situacion:     'sin_datos',
              mensaje:       'No hay información suficiente para realizar una proyección en este momento.',
            },
            metricas: { nota: 0, tendencia: 0.5, compromiso: 0, estabilidad: 1 },
          });
          continue;
        }

        // 6b. Preprocesar → 4 métricas normalizadas
        const { input, _debug } = preprocesar(
          {
            notasPorPeriodo:  datos.notasPorPeriodo,
            tareasEntregadas: datos.tareasEntregadas,
            totalTareas:      datos.totalTareas,
          },
          config
        );

        // 6c. Predicción con brain.js
        const outputIA   = red.run(input);
        const prediccion = outputIA.exito ?? 0.5;

        // 6d. Interpretación FODA
        const foda = interpretarFODA(
          input,
          prediccion,
          config,
          materia.nombre,
          {
            promedioReal:          datos.promedioReal,
            periodosTranscurridos: datos.periodosConDatos,
            totalPeriodos:         datos.totalPeriodosAño,
          }
        );

        reportesMaterias.push(foda);

        // Acumuladores para resumen global
        sumaExito    += prediccion;
        sumaPromedio += datos.promedioReal;
        if (prediccion < 0.50) materiasEnRiesgo++;

      } catch (errMateria) {
        console.error(
          `[IA] Error procesando materia ${materia.nombre} para estudiante ${estudianteId}:`,
          errMateria.message
        );
        // No romper el reporte por una materia fallida
        reportesMaterias.push({
          materia:         materia.nombre,
          prediccion:      null,
          porcentajeExito: null,
          nivel:           'Error al procesar',
          foda:            { fortalezas: [], oportunidades: [], debilidades: [], amenazas: [] },
          notaProyectada:  { notaNecesaria: null, situacion: 'sin_datos', mensaje: 'Error al procesar esta materia.' },
          metricas:        {},
        });
      }
    }

    // ── 7. Resumen global ─────────────────────────────────────────────────────
    const totalMaterias   = reportesMaterias.filter(r => r.prediccion !== null).length;
    const promedioExito   = totalMaterias > 0 ? sumaExito / totalMaterias : 0;
    const promedioGeneral = totalMaterias > 0
      ? Math.round((sumaPromedio / totalMaterias) * 100) / 100
      : 0;

    let nivelGlobal;
    const pctExitoGlobal = Math.round(promedioExito * 100);
    if      (pctExitoGlobal >= 75) nivelGlobal = 'Desempeño general satisfactorio';
    else if (pctExitoGlobal >= 55) nivelGlobal = 'En proceso de consolidación';
    else if (pctExitoGlobal >= 35) nivelGlobal = 'Requiere atención académica';
    else                           nivelGlobal = 'Situación académica crítica';

    // Ordenar materias: primero las de mayor riesgo (menor predicción)
    reportesMaterias.sort((a, b) => {
      if (a.prediccion === null) return 1;
      if (b.prediccion === null) return -1;
      return a.prediccion - b.prediccion;
    });

    return {
      exito: true,
      estudiante: {
        id:      eId.toString(),
        nombre:  estudiante.nombre,
        apellido:estudiante.apellido,
        grado:   grado.nombre,
        nivel:   grado.nivel,
      },
      año,
      resumenGlobal: {
        promedioGeneral,
        porcentajeExito:  pctExitoGlobal,
        materiasEnRiesgo,
        totalMaterias:    materias.length,
        nivelGlobal,
      },
      materias: reportesMaterias,
      generadoEn: new Date().toISOString(),
    };

  } catch (err) {
    console.error('[IA] Error en generarReporteEstudiante:', err.message);
    return {
      exito: false,
      error: `Error interno al generar el reporte: ${err.message}`,
    };
  }
}

module.exports = { generarReporteEstudiante };
