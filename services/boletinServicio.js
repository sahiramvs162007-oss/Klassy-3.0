/**
 * services/boletinServicio.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica del cierre de periodo y cierre de año.
 * Estas son las funciones más importantes del sistema.
 *
 * cerrarPeriodo(periodoId)
 *   1. Obtiene grados con matrículas activas en el periodo.
 *   2. Para cada par estudiante-materia calcula el promedio desde Nota.
 *   3. Crea ResultadoPeriodo por cada par.
 *   4. Crea Boletin completo denormalizado por cada estudiante.
 *   5. Marca todas las Nota del periodo como modificable=false.
 *
 * cerrarAño(año)
 *   1. Lee todos los ResultadoPeriodo del año.
 *   2. Por cada estudiante-materia: si reprobó en TODOS los periodos → aprobado=false.
 *   3. Crea ResultadoAnual por cada par estudiante-materia.
 *   4. Actualiza ultimoNivelCursado de estudiantes que aprobaron.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const {
  Periodo, Grado, Matricula, Nota, Actividad, AsignacionDocente,
  ResultadoPeriodo, ResultadoAnual, Boletin, Usuario,
} = require('../models');
const { crearNotificacionMasiva } = require('./notificacionServicio');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const redondear2 = (n) => Math.round(n * 100) / 100;

const calcularPromedio = (valores) => {
  if (!valores.length) return 0;
  return redondear2(valores.reduce((a, b) => a + b, 0) / valores.length);
};

// ─────────────────────────────────────────────────────────────────────────────
// CERRAR PERIODO
// ─────────────────────────────────────────────────────────────────────────────

const cerrarPeriodo = async (periodoId) => {
  const periodo = await Periodo.findById(periodoId);
  if (!periodo) throw new Error('Periodo no encontrado');
  if (!periodo.activo) throw new Error('El periodo ya está cerrado');

  const año = periodo.año;

  // 1. Obtener todas las matrículas activas del año
  const matriculas = await Matricula.find({ año, estado: 'activa' })
    .populate('estudianteId', 'nombre apellido correo')
    .populate('gradoId',      'nombre nivel materias');

  if (matriculas.length === 0) {
    throw new Error('No hay estudiantes matriculados en este año');
  }

  // 2. Obtener asignaciones para saber qué docente da cada materia en cada grado
  const asignaciones = await AsignacionDocente.find({ año, estado: 'activo' })
    .populate('docenteId', 'nombre apellido')
    .populate('materiaId', 'nombre');

  // Mapa: `${gradoId}-${materiaId}` → docente
  const mapaDocenteGradoMateria = {};
  for (const asig of asignaciones) {
    const clave = `${asig.gradoId}-${asig.materiaId._id}`;
    mapaDocenteGradoMateria[clave] = asig.docenteId;
  }

  const resultadosCreados = [];
  const boletinesCreados  = [];
  const errores           = [];

  for (const matricula of matriculas) {
    const estudiante = matricula.estudianteId;
    const grado      = matricula.gradoId;
    if (!estudiante || !grado) continue;

    const gradoId    = grado._id;
    const materias   = grado.materias || [];

    const materiasBoletinArr = [];
    let   sumPromedios = 0;
    let   countMaterias = 0;

    for (const materiaId of materias) {
      // Notas del estudiante en esta materia y periodo
      const notas = await Nota.find({
        estudianteId: estudiante._id,
        materiaId,
        periodoId,
        gradoId,
      }).populate('actividadId', 'titulo');

      const valores  = notas.map(n => n.valor);
      const promedio = calcularPromedio(valores);
      const aprobado = promedio >= 3.0;

      // Obtener nombre de la materia
      const materiaDoc = await require('../models').Materia.findById(materiaId).select('nombre');

      // Docente de la materia en el grado
      const claveDocente = `${gradoId}-${materiaId}`;
      const docente      = mapaDocenteGradoMateria[claveDocente];

      // 3. Crear o actualizar ResultadoPeriodo
      try {
        await ResultadoPeriodo.findOneAndUpdate(
          { estudianteId: estudiante._id, materiaId, periodoId },
          {
            estudianteId: estudiante._id,
            materiaId,
            gradoId,
            periodoId,
            año,
            promedio,
            aprobado,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        resultadosCreados.push(`${estudiante.nombre}-${materiaDoc?.nombre}`);
      } catch (e) {
        errores.push(`ResultadoPeriodo ${estudiante.nombre}-${materiaDoc?.nombre}: ${e.message}`);
      }

      // Datos para el boletín
      materiasBoletinArr.push({
        materiaId,
        nombreMateria: materiaDoc?.nombre || 'Materia',
        notas: notas.map(n => ({
          actividadId:     n.actividadId?._id,
          tituloActividad: n.actividadId?.titulo || 'Actividad',
          valor:           n.valor,
          fecha:           n.createdAt,
        })),
        promedio,
        aprobado,
        nombreDocente: docente
          ? `${docente.nombre} ${docente.apellido}`
          : 'Sin asignar',
      });

      if (valores.length > 0) {
        sumPromedios += promedio;
        countMaterias++;
      }
    }

    const promedioGeneral = countMaterias > 0
      ? redondear2(sumPromedios / countMaterias)
      : 0;

    const aprobadoGeneral = materiasBoletinArr.every(m => m.aprobado);

    // 4. Crear Boletín (inmutable — upsert por si se re-ejecuta)
    try {
      await Boletin.findOneAndUpdate(
        { estudianteId: estudiante._id, periodoId },
        {
          estudianteId:       estudiante._id,
          gradoId,
          periodoId,
          año,
          nombreEstudiante:   estudiante.nombre,
          apellidoEstudiante: estudiante.apellido,
          correoEstudiante:   estudiante.correo,
          nombreGrado:        grado.nombre,
          nivelGrado:         grado.nivel,
          nombrePeriodo:      periodo.nombre,
          numeroPeriodo:      periodo.numero,
          materias:           materiasBoletinArr,
          promedioGeneral,
          aprobadoGeneral,
          generadoEn:         new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      boletinesCreados.push(estudiante.nombre);
    } catch (e) {
      errores.push(`Boletín ${estudiante.nombre}: ${e.message}`);
    }
  }

  // 5. Marcar notas del periodo como no modificables
  await Nota.updateMany(
    { periodoId },
    { modificable: false }
  );

  // 6. Cerrar el periodo
  periodo.activo = false;
  await periodo.save();

  // 7. Notificar a los estudiantes
  const idsEstudiantes = matriculas.map(m => m.estudianteId._id).filter(Boolean);
  if (idsEstudiantes.length > 0) {
    await crearNotificacionMasiva(idsEstudiantes, {
      tipo:    'cierre_anio',
      titulo:  `Boletín del ${periodo.nombre} disponible`,
      mensaje: `Tu boletín académico del ${periodo.nombre} ${año} ya está disponible para consulta.`,
      enlace:  '/boletines/estudiante',
    });
  }

  return {
    periodo:          periodo.nombre,
    boletinesCreados: boletinesCreados.length,
    resultados:       resultadosCreados.length,
    errores,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CERRAR AÑO
// ─────────────────────────────────────────────────────────────────────────────

const cerrarAño = async (año) => {
  // Periodos del año
  const periodos = await Periodo.find({ año });
  if (periodos.length === 0) throw new Error('No hay periodos para ese año');

  const periodosIds = periodos.map(p => p._id.toString());
  const periodosActivos = periodos.filter(p => p.activo);
  if (periodosActivos.length > 0) {
    throw new Error(
      `Hay ${periodosActivos.length} periodo(s) aún abierto(s). Deben cerrarse antes.`
    );
  }

  // Todos los ResultadoPeriodo del año
  const resultados = await ResultadoPeriodo.find({ año })
    .populate('estudianteId', 'nombre apellido ultimoNivelCursado')
    .populate('materiaId',    'nombre');

  // Agrupar por estudiante → materia → array de resultados de periodos
  const mapa = {}; // estudianteId → materiaId → [resultados]
  for (const r of resultados) {
    const eId = r.estudianteId?._id?.toString();
    const mId = r.materiaId?._id?.toString();
    if (!eId || !mId) continue;
    if (!mapa[eId]) mapa[eId] = { estudiante: r.estudianteId, materias: {} };
    if (!mapa[eId].materias[mId]) mapa[eId].materias[mId] = { materia: r.materiaId, resultados: [] };
    mapa[eId].materias[mId].resultados.push(r);
  }

  const resultadosAnuales = [];
  const errores           = [];

  for (const eId of Object.keys(mapa)) {
    const { estudiante, materias } = mapa[eId];
    let estudianteAprueba = true;

    for (const mId of Object.keys(materias)) {
      const { materia, resultados: rPeriodos } = materias[mId];

      // Promedio de los promedios por periodo
      const promedioAnual = calcularPromedio(rPeriodos.map(r => r.promedio));

      // Reprueba la materia si reprobó en TODOS los periodos del año que tiene datos
      const repruebaTodos = rPeriodos.every(r => !r.aprobado);
      const aprobadoMateria = !repruebaTodos;

      if (!aprobadoMateria) estudianteAprueba = false;

      // Obtener gradoId del estudiante
      const matricula = await Matricula.findOne({
        estudianteId: estudiante._id,
        año,
      });

      try {
        await ResultadoAnual.findOneAndUpdate(
          { estudianteId: estudiante._id, materiaId: mId, año },
          {
            estudianteId:  estudiante._id,
            materiaId:     mId,
            gradoId:       matricula?.gradoId,
            año,
            aprobado:      aprobadoMateria,
            promedioAnual,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        resultadosAnuales.push(`${estudiante.nombre}-${materia.nombre}`);
      } catch (e) {
        errores.push(`ResultadoAnual ${estudiante.nombre}: ${e.message}`);
      }
    }

    // Actualizar ultimoNivelCursado si aprueba
    if (estudianteAprueba) {
      const usuarioDoc = await Usuario.findById(eId);
      if (usuarioDoc) {
        const nivelActual = usuarioDoc.ultimoNivelCursado || 0;
        if (nivelActual < 11) {
          await Usuario.findByIdAndUpdate(eId, {
            ultimoNivelCursado: nivelActual + 1,
          });
        }
      }
    }
  }

  return {
    año,
    resultadosAnuales: resultadosAnuales.length,
    errores,
  };
};

module.exports = { cerrarPeriodo, cerrarAño };
