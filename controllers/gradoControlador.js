/**
 * controllers/gradoControlador.js
 * CRUD de grados con asignación de materias. Solo admin.
 */

const { Grado, Materia, Matricula } = require('../models');
const { registrarCambio } = require('../middlewares/registrarHistorial');

// ─── LISTAR  GET /grados ──────────────────────────────────────────────────────
const listarGrados = async (req, res) => {
  try {
    const { buscar = '', filtroNivel = '', filtroAnio = '' } = req.query;
    const filtro = {};

    if (buscar.trim()) {
      filtro.nombre = new RegExp(buscar.trim(), 'i');
    }
    if (filtroNivel) filtro.nivel = parseInt(filtroNivel, 10);
    if (filtroAnio)  filtro.año   = parseInt(filtroAnio, 10);

    const [grados, todasMaterias] = await Promise.all([
      Grado.find(filtro)
        .populate('materias', 'nombre')
        .sort({ año: -1, nivel: 1, nombre: 1 }),
      Materia.find({ activo: true }).sort({ nombre: 1 }),
    ]);

    // Contar matriculados activos por grado (para mostrar X/cupo en la tabla)
    const matriculadosPorGrado = {};
    for (const grado of grados) {
      const count = await Matricula.countDocuments({
        gradoId: grado._id,
        año: grado.año,
        estado: 'activa',
      });
      matriculadosPorGrado[grado._id.toString()] = count;
    }

    // Años distintos presentes en la BD para el filtro
    const añosDisponibles = await Grado.distinct('año');
    añosDisponibles.sort((a, b) => b - a);

    res.render('paginas/grados', {
      titulo:         'Gestión de Grados',
      paginaActual:   'grados',
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

// ─── OBTENER UNO  GET /grados/:id/datos ──────────────────────────────────────
const obtenerGrado = async (req, res) => {
  try {
    const grado = await Grado.findById(req.params.id).populate('materias', 'nombre activo');
    if (!grado) return res.status(404).json({ error: 'Grado no encontrado' });

    const matriculados = await Matricula.countDocuments({
      gradoId: grado._id,
      año: grado.año,
      estado: 'activa',
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

    const snapAntes = {
      nombre: grado.nombre,
      nivel:  grado.nivel,
      año:    grado.año,
      activo: grado.activo,
      cupo:   grado.cupo,
    };

    grado.nombre   = nombre.trim();
    grado.nivel    = parseInt(nivel, 10);
    grado.año      = parseInt(año, 10);
    grado.cupo     = cupo ? parseInt(cupo, 10) : 0;
    grado.materias = materiasIds;
    grado.activo   = activo === 'true';

    await grado.save();

    const cambios = {};
    if (snapAntes.nombre !== grado.nombre) cambios.nombre = { antes: snapAntes.nombre, despues: grado.nombre };
    if (snapAntes.nivel  !== grado.nivel)  cambios.nivel  = { antes: snapAntes.nivel,  despues: grado.nivel };
    if (snapAntes.año    !== grado.año)    cambios.año    = { antes: snapAntes.año,    despues: grado.año };
    if (snapAntes.activo !== grado.activo) cambios.activo = { antes: snapAntes.activo, despues: grado.activo };
    if (snapAntes.cupo   !== grado.cupo)   cambios.cupo   = { antes: snapAntes.cupo,   despues: grado.cupo };

    await registrarCambio(req, {
      accion:    'EDITAR_GRADO',
      entidad:   'Grado',
      entidadId: grado._id,
      cambios,
    });

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
  obtenerGrado,
  crearGrado,
  editarGrado,
  eliminarGrado,
};
