/**
 * controllers/asignacionControlador.js
 * CRUD de asignaciones docente ↔ materia ↔ grado por año.
 *
 * Reglas de negocio:
 *  - Solo usuarios con rol 'docente' pueden ser asignados.
 *  - Un docente no puede tener la misma materia+grado en el mismo año (índice único).
 *  - Las materias disponibles solo son las que pertenecen al grado seleccionado.
 *  - Admin y Director pueden gestionar asignaciones.
 */

const { AsignacionDocente, Usuario, Grado, Materia } = require('../models');
const { registrarCambio } = require('../middlewares/registrarHistorial');

// ─── LISTAR  GET /asignaciones ────────────────────────────────────────────────
const listarAsignaciones = async (req, res) => {
  try {
    const {
      filtroDocente = '',
      filtroGrado   = '',
      filtroAnio    = '',
      filtroEstado  = '',
    } = req.query;

    const filtro = {};
    if (filtroDocente) filtro.docenteId = filtroDocente;
    if (filtroGrado)   filtro.gradoId   = filtroGrado;
    if (filtroEstado)  filtro.estado    = filtroEstado;
    if (filtroAnio)    filtro.año       = parseInt(filtroAnio, 10);

    const [asignaciones, docentes, grados, años] = await Promise.all([
      AsignacionDocente.find(filtro)
        .populate('docenteId',  'nombre apellido profesion')
        .populate('gradoId',    'nombre nivel año')
        .populate('materiaId',  'nombre')
        .sort({ año: -1, createdAt: -1 }),
      Usuario.find({ rol: 'docente', activo: true }).select('nombre apellido profesion').sort({ apellido: 1 }),
      Grado.find({ activo: true }).select('nombre nivel año').sort({ año: -1, nivel: 1 }),
      AsignacionDocente.distinct('año'),
    ]);

    años.sort((a, b) => b - a);

    res.render('paginas/asignaciones', {
      titulo:        'Asignación de Docentes',
      paginaActual:  'asignaciones',
      asignaciones,
      docentes,
      grados,
      años,
      filtroDocente,
      filtroGrado,
      filtroAnio,
      filtroEstado,
      añoActual: new Date().getFullYear(),
    });
  } catch (error) {
    console.error('Error al listar asignaciones:', error);
    req.flash('error', 'Error al cargar las asignaciones.');
    res.redirect('/dashboard');
  }
};

// ─── OBTENER DETALLE  GET /asignaciones/:id/datos ────────────────────────────
const obtenerAsignacion = async (req, res) => {
  try {
    const asignacion = await AsignacionDocente.findById(req.params.id)
      .populate('docenteId',  'nombre apellido correo profesion')
      .populate('gradoId',    'nombre nivel año materias')
      .populate('materiaId',  'nombre descripcion');

    if (!asignacion) return res.status(404).json({ error: 'Asignación no encontrada' });
    res.json(asignacion);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la asignación' });
  }
};

// ─── MATERIAS DE UN GRADO  GET /asignaciones/grado/:gradoId/materias ─────────
// Devuelve las materias que pertenecen al grado para filtrar el formulario
const materiasDeGrado = async (req, res) => {
  try {
    const grado = await Grado.findById(req.params.gradoId)
      .populate('materias', 'nombre activo');
    if (!grado) return res.status(404).json({ error: 'Grado no encontrado' });

    const materias = (grado.materias || []).filter(m => m.activo);
    res.json(materias);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las materias del grado' });
  }
};

// ─── CREAR  POST /asignaciones ────────────────────────────────────────────────
const crearAsignacion = async (req, res) => {
  try {
    const { docenteId, gradoId, materiaId, año } = req.body;
    const añoNum = parseInt(año, 10);

    // 1. Verificar que el docente tenga rol 'docente'
    const docente = await Usuario.findById(docenteId);
    if (!docente || docente.rol !== 'docente') {
      req.flash('error', 'Solo se pueden asignar usuarios con rol Docente.');
      return res.redirect('/asignaciones');
    }

    // 2. Verificar que la materia pertenezca al grado
    const grado = await Grado.findById(gradoId);
    if (!grado) {
      req.flash('error', 'Grado no encontrado.');
      return res.redirect('/asignaciones');
    }

    const materiaEnGrado = grado.materias.some(m => m.toString() === materiaId);
    if (!materiaEnGrado) {
      req.flash('error', 'La materia seleccionada no pertenece a ese grado.');
      return res.redirect('/asignaciones');
    }

    // 3. Verificar duplicado docente+materia+grado+año (la misma asignación)
    const existe = await AsignacionDocente.findOne({ docenteId, materiaId, gradoId, año: añoNum });
    if (existe) {
      req.flash('error', 'Este docente ya tiene esa materia y grado asignados para ese año.');
      return res.redirect('/asignaciones');
    }

    // 4. Verificar que esa materia+grado+año no la tenga YA otro docente activo
    const otraAsignacion = await AsignacionDocente.findOne({
      materiaId,
      gradoId,
      año:    añoNum,
      estado: 'activo',
    });
    if (otraAsignacion) {
      const otroDocente = await Usuario.findById(otraAsignacion.docenteId).select('nombre apellido');
      req.flash('error',
        `Esa materia y grado ya están asignados al docente ` +
        `${otroDocente ? otroDocente.nombre + ' ' + otroDocente.apellido : 'otro docente'} para ${añoNum}.`
      );
      return res.redirect('/asignaciones');
    }

    await AsignacionDocente.create({
      docenteId,
      materiaId,
      gradoId,
      año:    añoNum,
      estado: 'activo',
    });

    const materia = await Materia.findById(materiaId).select('nombre');
    req.flash('exito',
      `Asignación creada: ${docente.nombre} ${docente.apellido} → ` +
      `${materia ? materia.nombre : ''} / ${grado.nombre} (${añoNum}).`
    );
    res.redirect('/asignaciones');
  } catch (error) {
    console.error('Error al crear asignación:', error);
    req.flash('error', 'Error al crear la asignación.');
    res.redirect('/asignaciones');
  }
};

// ─── CAMBIAR ESTADO  PUT /asignaciones/:id ───────────────────────────────────
const editarAsignacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const asignacion = await AsignacionDocente.findById(id)
      .populate('docenteId', 'nombre apellido');

    if (!asignacion) {
      req.flash('error', 'Asignación no encontrada.');
      return res.redirect('/asignaciones');
    }

    const estadoAnterior = asignacion.estado;

    asignacion.estado = estado;
    await asignacion.save();

    const docenteNombre = `${asignacion.docenteId.nombre} ${asignacion.docenteId.apellido}`;

    await registrarCambio(req, {
      accion:    'EDITAR_ASIGNACION',
      entidad:   'AsignacionDocente',
      entidadId: asignacion._id,
      cambios: {
        estado: { antes: estadoAnterior, despues: estado },
      },
    });

    req.flash('exito',
      `Asignación de ${docenteNombre} ` +
      `actualizada a estado: ${estado}.`
    );
    res.redirect('/asignaciones');
  } catch (error) {
    console.error('Error al editar asignación:', error);
    req.flash('error', 'Error al actualizar la asignación.');
    res.redirect('/asignaciones');
  }
};

// ─── ELIMINAR  DELETE /asignaciones/:id ──────────────────────────────────────
const eliminarAsignacion = async (req, res) => {
  try {
    const { id } = req.params;

    const asignacion = await AsignacionDocente.findById(id)
      .populate('docenteId',  'nombre apellido')
      .populate('materiaId',  'nombre')
      .populate('gradoId',    'nombre');

    if (!asignacion) {
      req.flash('error', 'Asignación no encontrada.');
      return res.redirect('/asignaciones');
    }

    const desc = `${asignacion.docenteId?.nombre} ${asignacion.docenteId?.apellido} → ${asignacion.materiaId?.nombre} / ${asignacion.gradoId?.nombre}`;
    await AsignacionDocente.findByIdAndDelete(id);

    req.flash('exito', `Asignación eliminada: ${desc}.`);
    res.redirect('/asignaciones');
  } catch (error) {
    console.error('Error al eliminar asignación:', error);
    req.flash('error', 'Error al eliminar la asignación.');
    res.redirect('/asignaciones');
  }
};

module.exports = {
  listarAsignaciones,
  obtenerAsignacion,
  materiasDeGrado,
  crearAsignacion,
  editarAsignacion,
  eliminarAsignacion,
};
