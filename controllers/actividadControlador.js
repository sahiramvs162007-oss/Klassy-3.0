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
 *   POST /actividades/docente/:id/excepciones     → agregar excepción [NUEVO]
 *   DELETE /actividades/docente/:id/excepciones/:estudianteId → quitar excepción [NUEVO]
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
const { registrarCambio } = require('../middlewares/registrarHistorial');

const AÑO_ACTUAL = new Date().getFullYear();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Obtiene el periodo activo del año actual */
const obtenerPeriodoActivo = async () => {
  return Periodo.findOne({ activo: true, año: AÑO_ACTUAL });
};

/** Mapea los archivos subidos con multer a objetos para guardar en DB */
const mapearArchivos = (files = []) => files.map(mapearArchivo);

/**
 * [NUEVO Claude] Determina si un estudiante puede entregar en este momento.
 * Considera: estado de la actividad, fechaLimite, excepciones individuales,
 * permitirEntregaTardia y permitirMultiplesEntregas.
 * @returns {{ puede: boolean, razon: string }}
 */
const puedeEntregarAhora = (actividad, estudianteId, entregas = []) => {
  const ahora   = new Date();
  const eIdStr  = estudianteId.toString();

  const excepcion  = actividad.excepciones?.find(
    e => e.estudianteId.toString() === eIdStr
  );
  const limiteReal = excepcion ? excepcion.fechaLimitePersonalizada : actividad.fechaLimite;

  // Actividad cerrada manualmente
  if (actividad.estado === 'cerrada') {
    if (excepcion && limiteReal > ahora) {
      return { puede: true, razon: 'excepcion' };
    }
    return { puede: false, razon: 'cerrada' };
  }

  // Verificar fecha límite
  if (ahora > limiteReal && !actividad.permitirEntregaTardia) {
    return { puede: false, razon: 'vencida' };
  }

  // Verificar múltiples entregas
  if (!actividad.permitirMultiplesEntregas && entregas.length > 0) {
    return { puede: false, razon: 'una_sola_entrega' };
  }

  return { puede: true, razon: 'ok' };
};

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
      .populate('materiaId', 'nombre descripcion color')
      .populate('gradoId',   'nombre nivel año');

    // Agrupar por materia para los bloques del panel
    const materiaMap = {};
    for (const asig of asignaciones) {
      const mId = asig.materiaId._id.toString();
      if (!materiaMap[mId]) {
        materiaMap[mId] = {
          materia:     asig.materiaId,
          grados:      [],
          color:       asig.materiaId.color || 'azul',
          fondoTipo:   asig.fondoTipo   || '',
          fondoValor:  asig.fondoValor  || '',
          colorTitulo: asig.colorTitulo || '',
        };
      }
      // Actualizar personalización si tiene valor (toma la primera que encuentre)
      if (!materiaMap[mId].fondoTipo && asig.fondoTipo) {
        materiaMap[mId].fondoTipo   = asig.fondoTipo;
        materiaMap[mId].fondoValor  = asig.fondoValor;
        materiaMap[mId].colorTitulo = asig.colorTitulo;
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
    let gradoSeleccionado   = null;
    let materiaSeleccionada = null;
    // [NUEVO Claude] Grados de la misma materia para publicación masiva
    let gradosMismaMateria  = [];

    if (materiaId && gradoId) {
      actividades = await Actividad.find({
        docenteId,
        materiaId,
        gradoId,
      })
        .populate('periodoId', 'nombre numero')
        .sort({ createdAt: -1 });

      // Para cada actividad calcular % de entregas
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
        act._porcentaje    = totalEstudiantes > 0
          ? Math.round((entregasUnicas.length / totalEstudiantes) * 100)
          : 0;
        act._totalEst      = totalEstudiantes;
        act._totalEntregas = entregasUnicas.length;
        // [NUEVO Claude] Marcar si está programada (fechaInicio futura)
        act._programada    = act.fechaInicio && act.fechaInicio > new Date();
      }

      gradoSeleccionado   = await Grado.findById(gradoId);
      materiaSeleccionada = await Materia.findById(materiaId);

      // [NUEVO Claude] Grados donde el docente imparte la misma materia (para publicación masiva)
      gradosMismaMateria = (materiaMap[materiaId.toString()]?.grados || [])
        .filter(g => g.grado._id.toString() !== gradoId.toString());
    }

    res.render('paginas/actividades-docente', {
      titulo:              'Actividades',
      paginaActual:        'actividades',
      bloques,
      actividades,
      periodoActivo,
      gradoSeleccionado,
      materiaSeleccionada,
      gradosMismaMateria,        // [NUEVO Claude]
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
      .populate('comentarios.usuarioId', 'nombre apellido rol')
      // [NUEVO Claude] Poblar sub-documentos de excepciones
      .populate('excepciones.estudianteId', 'nombre apellido')
      .populate('excepciones.concedidaPor', 'nombre apellido');

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

    // Construir lista con entregaron / no entregaron + excepción
    const resumenEstudiantes = matriculas.map(m => {
      const eId = m.estudianteId?._id?.toString();
      // [NUEVO Claude] Incluir excepción si existe para este estudiante
      const excepcion = actividad.excepciones?.find(
        ex => ex.estudianteId?._id?.toString() === eId
      );
      return {
        estudiante: m.estudianteId,
        entregas:   entregasPorEstudiante[eId] || [],
        entrego:    !!(entregasPorEstudiante[eId]?.length > 0),
        excepcion,
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
    const {
      titulo, descripcion,
      gradoId,
      gradosExtras,          // [NUEVO Claude] publicación masiva
      materiaId,
      fechaInicio,           // [NUEVO Claude]
      fechaLimite,
      permitirMultiplesEntregas, // [NUEVO Claude]
      permitirEntregaTardia,     // [NUEVO Claude]
    } = req.body;

    // [NUEVO Claude] Todos los grados a los que se publicará
    let todosLosGrados = [gradoId];
    if (gradosExtras) {
      const extras = Array.isArray(gradosExtras) ? gradosExtras : [gradosExtras];
      todosLosGrados = [...new Set([gradoId, ...extras])];
    }

    // Periodo activo obligatorio
    const periodo = await obtenerPeriodoActivo();
    if (!periodo) {
      req.flash('error', 'No hay un periodo académico activo. Contacta al administrador.');
      return res.redirect(`/actividades/docente?materiaId=${materiaId}&gradoId=${gradoId}`);
    }

    const archivos  = mapearArchivos(req.files || []);
    const finicio   = fechaInicio ? new Date(fechaInicio) : null;
    const flimite   = new Date(fechaLimite);
    const multiEntrega = permitirMultiplesEntregas === 'on';
    const tardiaOk     = permitirEntregaTardia     === 'on';

    const actividadesCreadas = [];

    for (const gId of todosLosGrados) {
      // Verificar asignación activa
      const asignacion = await AsignacionDocente.findOne({
        docenteId,
        gradoId:   gId,
        materiaId,
        año:       AÑO_ACTUAL,
        estado:    'activo',
      });
      if (!asignacion) continue;

      const actividad = await Actividad.create({
        titulo:                    titulo.trim(),
        descripcion:               descripcion ? descripcion.trim() : '',
        docenteId,
        gradoId:                   gId,
        materiaId,
        periodoId:                 periodo._id,
        fechaInicio:               finicio,
        fechaLimite:               flimite,
        permitirMultiplesEntregas: multiEntrega,
        permitirEntregaTardia:     tardiaOk,
        archivos,
        estado:                    'abierta',
      });
      actividadesCreadas.push({ gradoId: gId, actividadId: actividad._id });

      // Notificar solo si la actividad ya está publicada (sin fechaInicio o ya pasó)
      if (!finicio || finicio <= new Date()) {
        const matriculas     = await Matricula.find({ gradoId: gId, año: AÑO_ACTUAL, estado: 'activa' }).select('estudianteId');
        const idsEstudiantes = matriculas.map(m => m.estudianteId).filter(Boolean);
        const materia        = await Materia.findById(materiaId).select('nombre');
        const grado          = await Grado.findById(gId).select('nombre');

        if (idsEstudiantes.length > 0) {
          await crearNotificacionMasiva(idsEstudiantes, {
            tipo:     'nueva_actividad',
            titulo:   'Nueva actividad publicada',
            mensaje:  `${materia?.nombre || 'Tu docente'} publicó: "${titulo.trim()}" — Entrega antes de ${flimite.toLocaleString('es-CO')}`,
            enlace:   `/actividades/estudiante/${actividad._id}`,
            origenId: docenteId,
          });
        }
      }
    }

    const totalGrados = actividadesCreadas.length;
    req.flash('exito',
      totalGrados === 1
        ? `Actividad "${titulo.trim()}" creada.`
        : `Actividad "${titulo.trim()}" publicada en ${totalGrados} grados.`
    );
    res.redirect(`/actividades/docente?materiaId=${materiaId}&gradoId=${gradoId}`);
  } catch (error) {
    console.error('Error al crear actividad:', error);
    req.flash('error', 'Error al crear la actividad.');
    res.redirect('/actividades/docente');
  }
};

/** Editar actividad */
const editarActividad = async (req, res) => {
  try {
    const { id } = req.params;
    const docenteId = req.session.usuario._id;
    const {
      titulo, descripcion,
      fechaInicio, fechaLimite,           // [NUEVO Claude]
      permitirMultiplesEntregas,          // [NUEVO Claude]
      permitirEntregaTardia,              // [NUEVO Claude]
      cerrarAhora,                        // [NUEVO Claude]
    } = req.body;

    const actividad = await Actividad.findOne({ _id: id, docenteId });
    if (!actividad) {
      req.flash('error', 'Actividad no encontrada.');
      return res.redirect('/actividades/docente');
    }

    const snapAntes = {
      titulo:      actividad.titulo,
      fechaLimite: actividad.fechaLimite?.toISOString(),
    };

    actividad.titulo       = titulo.trim();
    actividad.descripcion  = descripcion ? descripcion.trim() : '';
    actividad.fechaLimite  = fechaLimite  ? new Date(fechaLimite)  : actividad.fechaLimite;

    // [NUEVO Claude] Campos extendidos
    actividad.fechaInicio              = fechaInicio ? new Date(fechaInicio) : null;
    actividad.permitirMultiplesEntregas = permitirMultiplesEntregas === 'on';
    actividad.permitirEntregaTardia    = permitirEntregaTardia === 'on';
    if (cerrarAhora === 'on') actividad.estado = 'cerrada';

    // Agregar nuevos archivos si se subieron
    if (req.files?.length > 0) {
      actividad.archivos.push(...mapearArchivos(req.files));
    }

    await actividad.save();

    // Registrar historial (tu lógica original)
    const cambios = {};
    if (snapAntes.titulo !== actividad.titulo)
      cambios.titulo = { antes: snapAntes.titulo, despues: actividad.titulo };
    if (snapAntes.fechaLimite !== actividad.fechaLimite.toISOString())
      cambios.fechaLimite = { antes: snapAntes.fechaLimite, despues: actividad.fechaLimite.toISOString() };
    if (req.files?.length > 0)
      cambios.archivos = { antes: null, despues: `${req.files.length} archivo(s) agregado(s)` };

    await registrarCambio(req, {
      accion:    'EDITAR_ACTIVIDAD',
      entidad:   'Actividad',
      entidadId: actividad._id,
      cambios,
    });

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
// [NUEVO Claude] GESTIÓN DE EXCEPCIONES
// ─────────────────────────────────────────────────────────────────────────────

/** POST /actividades/docente/:id/excepciones */
const agregarExcepcion = async (req, res) => {
  try {
    const { id }   = req.params;
    const { estudianteId, fechaLimitePersonalizada } = req.body;
    const docenteId = req.session.usuario._id;

    const actividad = await Actividad.findOne({ _id: id, docenteId });
    if (!actividad) return res.status(404).json({ ok: false, error: 'Actividad no encontrada' });

    // Eliminar excepción anterior del mismo estudiante si existe
    actividad.excepciones = actividad.excepciones.filter(
      e => e.estudianteId.toString() !== estudianteId
    );

    actividad.excepciones.push({
      estudianteId,
      fechaLimitePersonalizada: new Date(fechaLimitePersonalizada),
      concedidaPor: docenteId,
      concedidaEn:  new Date(),
    });

    await actividad.save();

    // Notificar al estudiante
    await crearNotificacion({
      usuarioId: estudianteId,
      tipo:      'administrativa',
      titulo:    'Plazo extendido',
      mensaje:   `Se te otorgó un plazo extendido para "${actividad.titulo}". Nueva fecha límite: ${new Date(fechaLimitePersonalizada).toLocaleString('es-CO')}.`,
      enlace:    `/actividades/estudiante/${actividad._id}`,
      origenId:  docenteId,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al agregar excepción:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/** DELETE /actividades/docente/:id/excepciones/:estudianteId */
const quitarExcepcion = async (req, res) => {
  try {
    const { id, estudianteId } = req.params;
    const docenteId            = req.session.usuario._id;

    const actividad = await Actividad.findOne({ _id: id, docenteId });
    if (!actividad) return res.status(404).json({ ok: false, error: 'Actividad no encontrada' });

    actividad.excepciones = actividad.excepciones.filter(
      e => e.estudianteId.toString() !== estudianteId
    );
    await actividad.save();

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al quitar excepción:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTAS ESTUDIANTE
// ─────────────────────────────────────────────────────────────────────────────

/** Panel del estudiante: selección de materia → actividades */
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
        titulo:            'Mis Actividades',
        paginaActual:      'actividades',
        actividades:       [],
        bloques:           [],
        periodos:          [],
        matricula:         null,
        materiaSeleccionada: null,
        filtroPeriodo:     '',
        mensajeExito:      req.flash('exito'),
        mensajeError:      req.flash('error'),
      });
    }

    const { materiaId = '', filtroPeriodo = '' } = req.query;

    // Materias del grado con personalización del docente
    const asignaciones = await AsignacionDocente.find({
      gradoId: matricula.gradoId._id,
      año:     AÑO_ACTUAL,
      estado:  'activo',
    })
      .populate('materiaId', 'nombre descripcion color')
      .populate('docenteId', 'nombre apellido');

    // Agrupar por materia
    const materiaMap = {};
    for (const asig of asignaciones) {
      if (!asig.materiaId) continue;
      const mId = asig.materiaId._id.toString();
      if (!materiaMap[mId]) {
        materiaMap[mId] = {
          materia:     asig.materiaId,
          docente:     asig.docenteId,
          color:       asig.materiaId.color || 'azul',
          fondoTipo:   asig.fondoTipo   || '',
          fondoValor:  asig.fondoValor  || '',
          colorTitulo: asig.colorTitulo || '',
        };
      }
      if (!materiaMap[mId].fondoTipo && asig.fondoTipo) {
        materiaMap[mId].fondoTipo   = asig.fondoTipo;
        materiaMap[mId].fondoValor  = asig.fondoValor;
        materiaMap[mId].colorTitulo = asig.colorTitulo;
      }
    }
    const bloques = Object.values(materiaMap);

    // Si hay materia seleccionada, cargar sus actividades
    let actividades = [];
    let materiaSeleccionada = null;

    if (materiaId) {
      materiaSeleccionada = await Materia.findById(materiaId).select('nombre descripcion');

      const filtro = {
        gradoId:   matricula.gradoId._id,
        materiaId,
        // [NUEVO Claude] Solo actividades visibles (sin fechaInicio o ya pasó)
        $or: [
          { fechaInicio: null },
          { fechaInicio: { $lte: new Date() } },
        ],
      };
      if (filtroPeriodo) filtro.periodoId = filtroPeriodo;

      actividades = await Actividad.find(filtro)
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

        act._misEntregas    = entregas;
        act._tieneEntrega   = entregas.length > 0;
        act._estaCalificada = entregas.some(e => e.estado === 'calificada');
        act._mejorNota      = entregas.reduce((max, e) => e.nota > max ? e.nota : max, 0);
        act._vencida        = new Date() > act.fechaLimite;

        // [NUEVO Claude] Calcular si puede entregar
        const { puede } = puedeEntregarAhora(act, estudianteId, entregas);
        act._puedeEntregar = puede;
      }
    }

    const periodos = await Periodo.find({ año: AÑO_ACTUAL }).select('nombre numero activo');

    res.render('paginas/actividades-estudiante', {
      titulo:              'Mis Actividades',
      paginaActual:        'actividades',
      actividades,
      bloques,
      periodos,
      matricula,
      materiaSeleccionada,
      materiaIdActiva:     materiaId || null,
      filtroPeriodo,
      mensajeExito:        req.flash('exito'),
      mensajeError:        req.flash('error'),
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

    // [NUEVO Claude] Calcular si puede entregar y la razón
    const { puede, razon } = puedeEntregarAhora(actividad, estudianteId, misEntregas);

    // [NUEVO Claude] Excepción del estudiante
    const excepcion = actividad.excepciones?.find(
      e => e.estudianteId.toString() === estudianteId.toString()
    );

    const vencida    = new Date() > actividad.fechaLimite;
    const calificada = misEntregas.some(e => e.estado === 'calificada');

    res.render('paginas/actividad-detalle-estudiante', {
      titulo:        `${actividad.titulo}`,
      paginaActual:  'actividades',
      actividad,
      misEntregas,
      vencida,
      calificada,
      puedeEntregar: puede,       // [NUEVO Claude]
      razonBloqueo:  razon,       // [NUEVO Claude]
      excepcion:     excepcion || null, // [NUEVO Claude]
      mensajeExito:  req.flash('exito'),
      mensajeError:  req.flash('error'),
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

    // [NUEVO Claude] Verificar usando la lógica completa (excepciones, opciones, etc.)
    const entregasExistentes = await EntregaActividad.find({ actividadId, estudianteId });
    const { puede, razon }   = puedeEntregarAhora(actividad, estudianteId, entregasExistentes);

    if (!puede) {
      const mensajes = {
        cerrada:          'Esta actividad está cerrada.',
        vencida:          'La fecha límite de esta actividad ya pasó. No puedes subir más entregas.',
        una_sola_entrega: 'Esta actividad solo permite una entrega.',
      };
      req.flash('error', mensajes[razon] || 'No puedes entregar en este momento.');
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
  // Admin/director → dashboard
  res.redirect('/dashboard');
};

/** Guarda la personalización (fondo + color título) de una materia para el docente */
const personalizarMateria = async (req, res) => {
  try {
    const docenteId = req.session.usuario._id;
    const { materiaId } = req.params;
    const { fondoTipo = '', fondoValor = '', colorTitulo = '' } = req.body;

    // Actualizar TODAS las asignaciones del docente para esa materia en el año actual
    await AsignacionDocente.updateMany(
      { docenteId, materiaId, año: AÑO_ACTUAL },
      { fondoTipo, fondoValor, colorTitulo }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Error en personalizarMateria:', error);
    res.status(500).json({ ok: false, error: 'Error al guardar personalización' });
  }
};

module.exports = {
  panelDocente,
  detalleActividadDocente,
  crearActividad,
  editarActividad,
  eliminarActividad,
  comentarActividadDocente,
  calificarEntrega,
  agregarExcepcion,       // [NUEVO Claude]
  quitarExcepcion,        // [NUEVO Claude]
  panelEstudiante,
  detalleActividadEstudiante,
  subirEntrega,
  comentarActividadEstudiante,
  redirigirPorRol,
  personalizarMateria,
};