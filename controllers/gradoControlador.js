/**
 * controllers/gradoControlador.js
 * CRUD de grados + endpoint de detalle completo para el panel lateral.
 */

const { Grado, Materia, Matricula, AsignacionDocente, Usuario } = require('../models');

// ─── LISTAR  GET /grados ──────────────────────────────────────────────────────
const listarGrados = async (req, res) => {
  try {
    const { buscar = '', filtroNivel = '', filtroAnio = '' } = req.query;
    const filtro = {};

    if (buscar.trim())  filtro.nombre = new RegExp(buscar.trim(), 'i');
    if (filtroNivel)    filtro.nivel  = parseInt(filtroNivel, 10);
    if (filtroAnio)     filtro.año    = parseInt(filtroAnio, 10);

    const [grados, todasMaterias] = await Promise.all([
      Grado.find(filtro)
        .populate('materias', 'nombre')
        .sort({ año: -1, nivel: 1, nombre: 1 }),
      Materia.find({ activo: true }).sort({ nombre: 1 }),
    ]);

    const matriculadosPorGrado = {};
    for (const grado of grados) {
      const count = await Matricula.countDocuments({
        gradoId: grado._id,
        año:     grado.año,
        estado:  'activa',
      });
      matriculadosPorGrado[grado._id.toString()] = count;
    }

    const añosDisponibles = await Grado.distinct('año');
    añosDisponibles.sort((a, b) => b - a);

    res.render('paginas/grados', {
      titulo:              'Gestión de Grados',
      paginaActual:        'grados',
      grados,
      todasMaterias,
      añosDisponibles,
      buscar,
      filtroNivel,
      filtroAnio,
      matriculadosPorGrado,
    });
  } catch (error) {
    console.error('Error al listar grados:', error);
    req.flash('error', 'Error al cargar los grados.');
    res.redirect('/dashboard');
  }
};

// ─── DETALLE COMPLETO  GET /grados/:id/detalle ────────────────────────────────
// Devuelve todo lo necesario para el panel lateral de detalle del grado.
const obtenerDetalleGrado = async (req, res) => {
  try {
    const grado = await Grado.findById(req.params.id)
      .populate('materias', 'nombre color portada activo');

    if (!grado) return res.status(404).json({ ok: false, error: 'Grado no encontrado' });

    // Estudiantes matriculados activos
    const matriculas = await Matricula.find({
      gradoId: grado._id,
      año:     grado.año,
      estado:  'activa',
    }).populate('estudianteId', 'nombre apellido correo');

    // Asignaciones docente → materia activas para este grado y año
    const asignaciones = await AsignacionDocente.find({
      gradoId: grado._id,
      año:     grado.año,
      estado:  'activo',
    })
      .populate('docenteId',  'nombre apellido correo')
      .populate('materiaId',  'nombre color');

    // Lider del grado: el director (primer usuario con rol director activo)
    // En KLASSY no hay un campo "lider" en Grado, se usa el director institucional
    const director = await Usuario.findOne({ rol: 'director', activo: true })
      .select('nombre apellido correo');

    res.json({
      ok: true,
      grado: {
        _id:    grado._id,
        nombre: grado.nombre,
        nivel:  grado.nivel,
        año:    grado.año,
        cupo:   grado.cupo,
        activo: grado.activo,
      },
      materias:     grado.materias,
      estudiantes:  matriculas.map(m => m.estudianteId),
      asignaciones: asignaciones.map(a => ({
        docente: a.docenteId,
        materia: a.materiaId,
      })),
      director,
      totales: {
        matriculados: matriculas.length,
        materias:     grado.materias.length,
        docentes:     asignaciones.length,
      },
    });
  } catch (error) {
    console.error('Error en detalle de grado:', error);
    res.status(500).json({ ok: false, error: 'Error al obtener el detalle del grado' });
  }
};

// ─── OBTENER UNO  GET /grados/:id/datos ──────────────────────────────────────
const obtenerGrado = async (req, res) => {
  try {
    const grado = await Grado.findById(req.params.id).populate('materias', 'nombre activo');
    if (!grado) return res.status(404).json({ error: 'Grado no encontrado' });

    const matriculados = await Matricula.countDocuments({
      gradoId: grado._id,
      año:     grado.año,
      estado:  'activa',
    });

    res.json({ ...grado.toObject(), matriculados });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el grado' });
  }
};

// ─── CREAR  POST /grados ──────────────────────────────────────────────────────
const crearGrado = async (req, res) => {
  try {
    const { nombre, nivel, año, materias, cupo } = req.body;

    const materiasIds = materias
      ? Array.isArray(materias) ? materias : [materias]
      : [];

    const existe = await Grado.findOne({
      nombre: new RegExp(`^${nombre.trim()}$`, 'i'),
      año:    parseInt(año, 10),
    });
    if (existe) {
      req.flash('error', `Ya existe el grado "${nombre.trim()}" para el año ${año}.`);
      return res.redirect('/grados');
    }

    await Grado.create({
      nombre:   nombre.trim(),
      nivel:    parseInt(nivel, 10),
      año:      parseInt(año, 10),
      cupo:     cupo ? parseInt(cupo, 10) : 0,
      materias: materiasIds,
    });

    req.flash('exito', `Grado "${nombre.trim()}" creado correctamente.`);
    res.redirect('/grados');
  } catch (error) {
    console.error('Error al crear grado:', error);
    req.flash('error', 'Error al crear el grado. Verifica los datos.');
    res.redirect('/grados');
  }
};

// ─── EDITAR  PUT /grados/:id ──────────────────────────────────────────────────
const editarGrado = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, nivel, año, materias, activo, cupo } = req.body;

    const grado = await Grado.findById(id);
    if (!grado) {
      req.flash('error', 'Grado no encontrado.');
      return res.redirect('/grados');
    }

    const duplicado = await Grado.findOne({
      _id:    { $ne: id },
      nombre: new RegExp(`^${nombre.trim()}$`, 'i'),
      año:    parseInt(año, 10),
    });
    if (duplicado) {
      req.flash('error', `Ya existe otro grado "${nombre.trim()}" para el año ${año}.`);
      return res.redirect('/grados');
    }

    const materiasIds = materias
      ? Array.isArray(materias) ? materias : [materias]
      : [];

    grado.nombre   = nombre.trim();
    grado.nivel    = parseInt(nivel, 10);
    grado.año      = parseInt(año, 10);
    grado.cupo     = cupo ? parseInt(cupo, 10) : 0;
    grado.materias = materiasIds;
    grado.activo   = activo === 'true';

    await grado.save();

    req.flash('exito', `Grado "${grado.nombre}" actualizado correctamente.`);
    res.redirect('/grados');
  } catch (error) {
    console.error('Error al editar grado:', error);
    req.flash('error', 'Error al actualizar el grado.');
    res.redirect('/grados');
  }
};

// ─── ELIMINAR  DELETE /grados/:id ────────────────────────────────────────────
const eliminarGrado = async (req, res) => {
  try {
    const { id } = req.params;

    const grado = await Grado.findById(id);
    if (!grado) {
      req.flash('error', 'Grado no encontrado.');
      return res.redirect('/grados');
    }

    const nombre = grado.nombre;
    await Grado.findByIdAndDelete(id);

    req.flash('exito', `Grado "${nombre}" eliminado correctamente.`);
    res.redirect('/grados');
  } catch (error) {
    console.error('Error al eliminar grado:', error);
    req.flash('error', 'Error al eliminar el grado.');
    res.redirect('/grados');
  }
};

module.exports = {
  listarGrados,
  obtenerDetalleGrado,
  obtenerGrado,
  crearGrado,
  editarGrado,
  eliminarGrado,
};
