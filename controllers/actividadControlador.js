/**
 * controllers/actividadControlador.js
 * Sprint 9 — Gestión de Actividades
 *
 * Rutas del docente:
 *   GET  /actividades/docente              → panel de selección materia/grado
 *   GET  /actividades/docente/:id          → detalle de actividad + entregas
 *   POST /actividades/docente              → crear actividad
 *   PUT  /actividades/docente/:id          → editar actividad
 *   DELETE /actividades/docente/:id        → eliminar actividad
 *   POST /actividades/docente/:id/comentarios     → comentar actividad
 *   PUT  /actividades/docente/entregas/:entregaId/calificar → calificar entrega
 *
 * Rutas del estudiante:
 *   GET  /actividades/estudiante           → ver todas las actividades
 *   GET  /actividades/estudiante/:id       → detalle + formulario de entrega
 *   POST /actividades/estudiante/:id/entregas     → subir entrega
 *   POST /actividades/estudiante/:id/comentarios  → comentar actividad
 */

const {
  Actividad, EntregaActividad, Nota,
  AsignacionDocente, Matricula, Periodo,
  Grado, Materia, Usuario,
} = require('../models');

const { crearNotificacion, crearNotificacionMasiva } = require('../services/notificacionServicio');
const { mapearArchivo } = require('../config/multer');

const AÑO_ACTUAL = new Date().getFullYear();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Obtiene el periodo activo del año actual */
const obtenerPeriodoActivo = async () => {
  return Periodo.findOne({ activo: true, año: AÑO_ACTUAL });
};

/** Mapea los archivos subidos con multer a objetos para guardar en DB */
const mapearArchivos = (files = []) => files.map(mapearArchivo);

// ─────────────────────────────────────────────────────────────────────────────
// VISTAS DOCENTE
// ─────────────────────────────────────────────────────────────────────────────

/** Panel principal del docente: bloques de materias y grados */
const panelDocente = async (req, res) => {
  try {
    const docenteId = req.session.usuario._id;

    // Obtener todas las asignaciones activas del docente en el año actual
    const asignaciones = await AsignacionDocente.find({
      docenteId,
      año:    AÑO_ACTUAL,
      estado: 'activo',
    })
      .populate('materiaId', 'nombre descripcion')
      .populate('gradoId',   'nombre nivel año');

    // Agrupar por materia para los bloques del panel
    const materiaMap = {};
    for (const asig of asignaciones) {
      const mId = asig.materiaId._id.toString();
      if (!materiaMap[mId]) {
        materiaMap[mId] = {
          materia:  asig.materiaId,
          grados:   [],
        };
      }
      materiaMap[mId].grados.push({
        asignacionId: asig._id,
        grado:        asig.gradoId,
      });
    }
    const bloques = Object.values(materiaMap);

    // Periodo activo
    const periodoActivo = await obtenerPeriodoActivo();

    // Si hay filtro activo (materiaId + gradoId en query), cargar actividades
    const { materiaId, gradoId } = req.query;
    let actividades = [];
    let gradoSeleccionado  = null;
    let materiaSeleccionada = null;

    if (materiaId && gradoId) {
      actividades = await Actividad.find({
        docenteId,
        materiaId,
        gradoId,
      })
        .populate('periodoId', 'nombre numero')
        .sort({ createdAt: -1 });

      // Para cada actividad calcular % de entregas
      const gradoDoc = await Grado.findById(gradoId).populate('materias');
      const estudiantesGrado = await Matricula.find({
        gradoId,
        año:    AÑO_ACTUAL,
        estado: 'activa',
      }).select('estudianteId');

      const totalEstudiantes = estudiantesGrado.length;

      for (const act of actividades) {
        const entregasUnicas = await EntregaActividad.distinct('estudianteId', {
          actividadId: act._id,
        });
        act._porcentaje   = totalEstudiantes > 0
          ? Math.round((entregasUnicas.length / totalEstudiantes) * 100)
          : 0;
        act._totalEst     = totalEstudiantes;
        act._totalEntregas = entregasUnicas.length;
      }

      gradoSeleccionado   = await Grado.findById(gradoId);
      materiaSeleccionada = await Materia.findById(materiaId);
    }

    res.render('paginas/actividades-docente', {
      titulo:              'Actividades',
      paginaActual:        'actividades',
      bloques,
      actividades,
      periodoActivo,
      gradoSeleccionado,
      materiaSeleccionada,
      materiaIdActiva:     materiaId || null,
      gradoIdActivo:       gradoId   || null,
      mensajeExito:        req.flash('exito'),
      mensajeError:        req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelDocente:', error);
    req.flash('error', 'Error al cargar el panel de actividades.');
    res.redirect('/dashboard');
  }
};

/** Detalle de una actividad (docente): lista de entregas + calificar */
const detalleActividadDocente = async (req, res) => {
  try {
    const { id } = req.params;
    const docenteId = req.session.usuario._id;

    const actividad = await Actividad.findOne({ _id: id, docenteId })
      .populate('materiaId', 'nombre')
      .populate('gradoId',   'nombre nivel')
      .populate('periodoId', 'nombre numero')
      .populate('comentarios.usuarioId', 'nombre apellido rol');

    if (!actividad) {
      req.flash('error', 'Actividad no encontrada.');
      return res.redirect('/actividades/docente');
    }

    // Estudiantes matriculados en el grado
    const matriculas = await Matricula.find({
      gradoId: actividad.gradoId._id,
      año:     AÑO_ACTUAL,
      estado:  'activa',
    }).populate('estudianteId', 'nombre apellido');

    const totalEstudiantes = matriculas.length;

    // Entregas agrupadas por estudiante
    const entregas = await EntregaActividad.find({ actividadId: id })
      .populate('estudianteId', 'nombre apellido')
      .sort({ fechaEntrega: -1 });

    // Mapa estudianteId → entregas
    const entregasPorEstudiante = {};
    for (const e of entregas) {
      const eId = e.estudianteId?._id?.toString();
      if (!eId) continue;
      if (!entregasPorEstudiante[eId]) entregasPorEstudiante[eId] = [];
      entregasPorEstudiante[eId].push(e);
    }

    // Construir lista con entregaron / no entregaron
    const resumenEstudiantes = matriculas.map(m => {
      const eId = m.estudianteId?._id?.toString();
      return {
        estudiante: m.estudianteId,
        entregas:   entregasPorEstudiante[eId] || [],
        entrego:    !!(entregasPorEstudiante[eId]?.length > 0),
      };
    });

    const entregaron    = resumenEstudiantes.filter(e => e.entrego).length;
    const porcentaje    = totalEstudiantes > 0
      ? Math.round((entregaron / totalEstudiantes) * 100)
      : 0;

    res.render('paginas/actividad-detalle-docente', {
      titulo:            `Actividad: ${actividad.titulo}`,
      paginaActual:      'actividades',
      actividad,
      resumenEstudiantes,
      totalEstudiantes,
      entregaron,
      porcentaje,
      mensajeExito:      req.flash('exito'),
      mensajeError:      req.flash('error'),
    });
  } catch (error) {
    console.error('Error en detalleActividadDocente:', error);
    req.flash('error', 'Error al cargar el detalle.');
    res.redirect('/actividades/docente');
  }
};

/** Crear actividad */
const crearActividad = async (req, res) => {
  try {
    const docenteId = req.session.usuario._id;
    const { titulo, descripcion, gradoId, materiaId, fechaLimite } = req.body;

    // Verificar asignación activa
    const asignacion = await AsignacionDocente.findOne({
      docenteId,
      gradoId,
      materiaId,
      año:    AÑO_ACTUAL,
      estado: 'activo',
    });
    if (!asignacion) {
      req.flash('error', 'No tienes asignación activa para ese grado y materia.');
      return res.redirect(`/actividades/docente?materiaId=${materiaId}&gradoId=${gradoId}`);
    }

    // Periodo activo obligatorio
    const periodo = await obtenerPeriodoActivo();
    if (!periodo) {
      req.flash('error', 'No hay un periodo académico activo. Contacta al administrador.');
      return res.redirect(`/actividades/docente?materiaId=${materiaId}&gradoId=${gradoId}`);
    }

    const archivos = mapearArchivos(req.files || []);

    const actividad = await Actividad.create({
      titulo:      titulo.trim(),
      descripcion: descripcion ? descripcion.trim() : '',
      docenteId,
      gradoId,
      materiaId,
      periodoId:   periodo._id,
      fechaLimite: new Date(fechaLimite),
      archivos,
      estado:      'abierta',
    });

    // Notificar a todos los estudiantes del grado
    const matriculas = await Matricula.find({
      gradoId,
      año:    AÑO_ACTUAL,
      estado: 'activa',
    }).select('estudianteId');

    const idsEstudiantes = matriculas.map(m => m.estudianteId);
    const materia = await Materia.findById(materiaId).select('nombre');
    const grado   = await Grado.findById(gradoId).select('nombre');

    if (idsEstudiantes.length > 0) {
      await crearNotificacionMasiva(idsEstudiantes, {
        tipo:     'nueva_actividad',
        titulo:   'Nueva actividad publicada',
        mensaje:  `${materia?.nombre || 'Tu docente'} publicó: "${titulo.trim()}" — Entrega antes de ${new Date(fechaLimite).toLocaleString('es-CO')}`,
        enlace:   `/actividades/estudiante/${actividad._id}`,
        origenId: docenteId,
      });
    }

    req.flash('exito', `Actividad "${actividad.titulo}" creada. Se notificó a ${idsEstudiantes.length} estudiante(s).`);
    res.redirect(`/actividades/docente?materiaId=${materiaId}&gradoId=${gradoId}`);
  } catch (error) {
    console.error('Error al crear actividad:', error);
    req.flash('error', 'Error al crear la actividad.');
    res.redirect('/actividades/docente');
  }
};

/** Editar actividad (solo antes de la fecha límite) */
const editarActividad = async (req, res) => {
  try {
    const { id } = req.params;
    const docenteId = req.session.usuario._id;
    const { titulo, descripcion, fechaLimite } = req.body;

    const actividad = await Actividad.findOne({ _id: id, docenteId });
    if (!actividad) {
      req.flash('error', 'Actividad no encontrada.');
      return res.redirect('/actividades/docente');
    }

    if (new Date() > actividad.fechaLimite) {
      req.flash('error', 'No se puede editar una actividad después de la fecha límite.');
      return res.redirect(`/actividades/docente/${id}`);
    }

    actividad.titulo      = titulo.trim();
    actividad.descripcion = descripcion ? descripcion.trim() : '';
    actividad.fechaLimite = new Date(fechaLimite);

    // Agregar nuevos archivos si se subieron
    if (req.files?.length > 0) {
      actividad.archivos.push(...mapearArchivos(req.files));
    }

    await actividad.save();

    req.flash('exito', 'Actividad actualizada correctamente.');
    res.redirect(`/actividades/docente/${id}`);
  } catch (error) {
    console.error('Error al editar actividad:', error);
    req.flash('error', 'Error al editar la actividad.');
    res.redirect('/actividades/docente');
  }
};

/** Eliminar actividad */
const eliminarActividad = async (req, res) => {
  try {
    const { id } = req.params;
    const docenteId = req.session.usuario._id;
    const { gradoId, materiaId } = req.query;

    const actividad = await Actividad.findOne({ _id: id, docenteId });
    if (!actividad) {
      req.flash('error', 'Actividad no encontrada.');
      return res.redirect('/actividades/docente');
    }

    await EntregaActividad.deleteMany({ actividadId: id });
    await Actividad.findByIdAndDelete(id);

    req.flash('exito', 'Actividad eliminada.');
    res.redirect(`/actividades/docente?materiaId=${materiaId || ''}&gradoId=${gradoId || ''}`);
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    req.flash('error', 'Error al eliminar la actividad.');
    res.redirect('/actividades/docente');
  }
};

/** Comentar una actividad (docente) */
const comentarActividadDocente = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    const usuarioId = req.session.usuario._id;

    await Actividad.findByIdAndUpdate(id, {
      $push: {
        comentarios: { usuarioId, texto: texto.trim(), fecha: new Date() },
      },
    });

    res.redirect(`/actividades/docente/${id}`);
  } catch (error) {
    console.error('Error al comentar:', error);
    res.redirect('back');
  }
};

/** Calificar una entrega y generar/actualizar la Nota */
const calificarEntrega = async (req, res) => {
  try {
    const { entregaId } = req.params;
    const { nota: valorNota, comentarioDocente } = req.body;
    const docenteId = req.session.usuario._id;

    const entrega = await EntregaActividad.findById(entregaId)
      .populate('actividadId');

    if (!entrega) {
      return res.status(404).json({ ok: false, error: 'Entrega no encontrada' });
    }

    const actividad = entrega.actividadId;
    const valorNum  = parseFloat(valorNota);

    if (isNaN(valorNum) || valorNum < 1.0 || valorNum > 5.0) {
      return res.status(400).json({ ok: false, error: 'La nota debe estar entre 1.0 y 5.0' });
    }

    // Actualizar la entrega
    entrega.nota               = valorNum;
    entrega.comentarioDocente  = comentarioDocente ? comentarioDocente.trim() : '';
    entrega.estado             = 'calificada';
    await entrega.save();

    // Crear o actualizar la Nota en el módulo de notas
    const datosNota = {
      estudianteId:       entrega.estudianteId,
      docenteId,
      materiaId:          actividad.materiaId,
      gradoId:            actividad.gradoId,
      periodoId:          actividad.periodoId,
      actividadId:        actividad._id,
      entregaActividadId: entrega._id,
      año:                AÑO_ACTUAL,
      valor:              valorNum,
      modificable:        true,
    };

    let notaDoc;
    if (entrega.notaId) {
      // Actualizar nota existente
      notaDoc = await Nota.findByIdAndUpdate(entrega.notaId, { valor: valorNum }, { new: true });
    } else {
      // Crear nueva nota
      notaDoc = await Nota.create(datosNota);
      entrega.notaId = notaDoc._id;
      await entrega.save();
    }

    // Notificar al estudiante
    await crearNotificacion({
      usuarioId: entrega.estudianteId,
      tipo:      'nueva_actividad',
      titulo:    'Actividad calificada',
      mensaje:   `Tu entrega de "${actividad.titulo}" fue calificada con ${valorNum.toFixed(1)}.`,
      enlace:    `/actividades/estudiante/${actividad._id}`,
      origenId:  docenteId,
    });

    res.json({ ok: true, nota: valorNum, notaId: notaDoc._id });
  } catch (error) {
    console.error('Error al calificar:', error);
    res.status(500).json({ ok: false, error: 'Error al calificar la entrega' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTAS ESTUDIANTE
// ─────────────────────────────────────────────────────────────────────────────

/** Panel del estudiante: todas las actividades de su grado activo */
const panelEstudiante = async (req, res) => {
  try {
    const estudianteId = req.session.usuario._id;

    // Matrícula activa del estudiante
    const matricula = await Matricula.findOne({
      estudianteId,
      año:    AÑO_ACTUAL,
      estado: 'activa',
    }).populate('gradoId', 'nombre nivel materias');

    if (!matricula) {
      return res.render('paginas/actividades-estudiante', {
        titulo:       'Mis Actividades',
        paginaActual: 'actividades',
        actividades:  [],
        materias:     [],
        periodos:     [],
        matricula:    null,
        filtroMateria:  '',
        filtroPeriodo:  '',
        mensajeExito:   req.flash('exito'),
        mensajeError:   req.flash('error'),
      });
    }

    const { filtroMateria = '', filtroPeriodo = '' } = req.query;

    const filtro = {
      gradoId: matricula.gradoId._id,
    };
    if (filtroMateria) filtro.materiaId = filtroMateria;
    if (filtroPeriodo) filtro.periodoId = filtroPeriodo;

    const actividades = await Actividad.find(filtro)
      .populate('materiaId', 'nombre')
      .populate('periodoId', 'nombre numero')
      .populate('docenteId', 'nombre apellido')
      .sort({ createdAt: -1 });

    // Para cada actividad, verificar si el estudiante tiene entrega
    for (const act of actividades) {
      const entregas = await EntregaActividad.find({
        actividadId:  act._id,
        estudianteId,
      }).sort({ fechaEntrega: -1 });

      act._misEntregas      = entregas;
      act._tieneEntrega     = entregas.length > 0;
      act._estaCalificada   = entregas.some(e => e.estado === 'calificada');
      act._mejorNota        = entregas.reduce((max, e) => e.nota > max ? e.nota : max, 0);
      act._vencida          = new Date() > act.fechaLimite;
    }

    // Materias y periodos para los filtros
    const materias = await Materia.find({
      _id: { $in: matricula.gradoId.materias },
    }).select('nombre');

    const periodos = await Periodo.find({ año: AÑO_ACTUAL }).select('nombre numero activo');

    res.render('paginas/actividades-estudiante', {
      titulo:         'Mis Actividades',
      paginaActual:   'actividades',
      actividades,
      materias,
      periodos,
      matricula,
      filtroMateria,
      filtroPeriodo,
      mensajeExito:   req.flash('exito'),
      mensajeError:   req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelEstudiante:', error);
    req.flash('error', 'Error al cargar las actividades.');
    res.redirect('/dashboard');
  }
};

/** Detalle de actividad para el estudiante */
const detalleActividadEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.session.usuario._id;

    const actividad = await Actividad.findById(id)
      .populate('materiaId', 'nombre descripcion')
      .populate('gradoId',   'nombre nivel')
      .populate('periodoId', 'nombre numero')
      .populate('docenteId', 'nombre apellido')
      .populate('comentarios.usuarioId', 'nombre apellido rol');

    if (!actividad) {
      req.flash('error', 'Actividad no encontrada.');
      return res.redirect('/actividades/estudiante');
    }

    // Verificar que el estudiante pertenece al grado
    const matricula = await Matricula.findOne({
      estudianteId,
      gradoId: actividad.gradoId._id,
      año:     AÑO_ACTUAL,
      estado:  'activa',
    });
    if (!matricula) {
      req.flash('error', 'No tienes acceso a esta actividad.');
      return res.redirect('/actividades/estudiante');
    }

    // Entregas del estudiante para esta actividad
    const misEntregas = await EntregaActividad.find({
      actividadId:  id,
      estudianteId,
    }).sort({ fechaEntrega: -1 });

    const vencida    = new Date() > actividad.fechaLimite;
    const calificada = misEntregas.some(e => e.estado === 'calificada');

    res.render('paginas/actividad-detalle-estudiante', {
      titulo:       `${actividad.titulo}`,
      paginaActual: 'actividades',
      actividad,
      misEntregas,
      vencida,
      calificada,
      mensajeExito: req.flash('exito'),
      mensajeError: req.flash('error'),
    });
  } catch (error) {
    console.error('Error en detalleActividadEstudiante:', error);
    req.flash('error', 'Error al cargar la actividad.');
    res.redirect('/actividades/estudiante');
  }
};

/** Subir entrega (estudiante) */
const subirEntrega = async (req, res) => {
  try {
    const { id: actividadId } = req.params;
    const estudianteId        = req.session.usuario._id;
    const { contenidoTexto }  = req.body;

    const actividad = await Actividad.findById(actividadId);
    if (!actividad) {
      req.flash('error', 'Actividad no encontrada.');
      return res.redirect('/actividades/estudiante');
    }

    // Verificar fecha límite
    if (new Date() > actividad.fechaLimite) {
      req.flash('error', 'La fecha límite de esta actividad ya pasó. No puedes subir más entregas.');
      return res.redirect(`/actividades/estudiante/${actividadId}`);
    }

    const archivos = mapearArchivos(req.files || []);

    if (!contenidoTexto?.trim() && archivos.length === 0) {
      req.flash('error', 'Debes escribir un texto o adjuntar al menos un archivo.');
      return res.redirect(`/actividades/estudiante/${actividadId}`);
    }

    await EntregaActividad.create({
      actividadId,
      estudianteId,
      contenidoTexto: contenidoTexto ? contenidoTexto.trim() : '',
      archivos,
      fechaEntrega:   new Date(),
      estado:         'entregada',
    });

    req.flash('exito', 'Entrega enviada correctamente.');
    res.redirect(`/actividades/estudiante/${actividadId}`);
  } catch (error) {
    console.error('Error al subir entrega:', error);
    req.flash('error', 'Error al subir la entrega.');
    res.redirect('back');
  }
};

/** Comentar una actividad (estudiante) */
const comentarActividadEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    const usuarioId = req.session.usuario._id;

    await Actividad.findByIdAndUpdate(id, {
      $push: {
        comentarios: { usuarioId, texto: texto.trim(), fecha: new Date() },
      },
    });

    res.redirect(`/actividades/estudiante/${id}`);
  } catch (error) {
    console.error('Error al comentar:', error);
    res.redirect('back');
  }
};

/** Redirigir según rol */
const redirigirPorRol = (req, res) => {
  const { rol } = req.session.usuario;
  if (rol === 'docente')    return res.redirect('/actividades/docente');
  if (rol === 'estudiante') return res.redirect('/actividades/estudiante');
  // Admin/director → vista docente completa o dashboard
  res.redirect('/dashboard');
};

module.exports = {
  panelDocente,
  detalleActividadDocente,
  crearActividad,
  editarActividad,
  eliminarActividad,
  comentarActividadDocente,
  calificarEntrega,
  panelEstudiante,
  detalleActividadEstudiante,
  subirEntrega,
  comentarActividadEstudiante,
  redirigirPorRol,
};
