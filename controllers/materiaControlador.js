/**
 * controllers/materiaControlador.js
 * CRUD de materias. Solo admin puede gestionar materias.
 */

const { Materia, Grado } = require('../models');

// ─── LISTAR  GET /materias ────────────────────────────────────────────────────
const listarMaterias = async (req, res) => {
  try {
    const { buscar = '' } = req.query;
    const filtro = {};

    if (buscar.trim()) {
      filtro.nombre = new RegExp(buscar.trim(), 'i');
    }

    const materias = await Materia.find(filtro).sort({ nombre: 1 });

    res.render('paginas/materias', {
      titulo:       'Gestión de Materias',
      paginaActual: 'materias',
      materias,
      buscar,
    });
  } catch (error) {
    console.error('Error al listar materias:', error);
    req.flash('error', 'Error al cargar las materias.');
    res.redirect('/dashboard');
  }
};

// ─── OBTENER UNA  GET /materias/:id/datos ────────────────────────────────────
const obtenerMateria = async (req, res) => {
  try {
    const materia = await Materia.findById(req.params.id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json(materia);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la materia' });
  }
};

// ─── CREAR  POST /materias ────────────────────────────────────────────────────
const crearMateria = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;

    const existe = await Materia.findOne({
      nombre: new RegExp(`^${nombre.trim()}$`, 'i'),
    });
    if (existe) {
      req.flash('error', `Ya existe una materia llamada "${nombre.trim()}".`);
      return res.redirect('/materias');
    }

    await Materia.create({
      nombre:      nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : '',
    });

    req.flash('exito', `Materia "${nombre.trim()}" creada correctamente.`);
    res.redirect('/materias');
  } catch (error) {
    console.error('Error al crear materia:', error);
    req.flash('error', 'Error al crear la materia.');
    res.redirect('/materias');
  }
};

// ─── EDITAR  PUT /materias/:id ────────────────────────────────────────────────
const editarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const materia = await Materia.findById(id);
    if (!materia) {
      req.flash('error', 'Materia no encontrada.');
      return res.redirect('/materias');
    }

    // Verificar nombre duplicado (excluyendo la misma materia)
    const duplicada = await Materia.findOne({
      _id:    { $ne: id },
      nombre: new RegExp(`^${nombre.trim()}$`, 'i'),
    });
    if (duplicada) {
      req.flash('error', `Ya existe otra materia llamada "${nombre.trim()}".`);
      return res.redirect('/materias');
    }

    materia.nombre      = nombre.trim();
    materia.descripcion = descripcion ? descripcion.trim() : '';
    materia.activo      = activo === 'true';

    await materia.save();

    req.flash('exito', `Materia "${materia.nombre}" actualizada correctamente.`);
    res.redirect('/materias');
  } catch (error) {
    console.error('Error al editar materia:', error);
    req.flash('error', 'Error al actualizar la materia.');
    res.redirect('/materias');
  }
};

// ─── ELIMINAR  DELETE /materias/:id ──────────────────────────────────────────
const eliminarMateria = async (req, res) => {
  try {
    const { id } = req.params;

    const materia = await Materia.findById(id);
    if (!materia) {
      req.flash('error', 'Materia no encontrada.');
      return res.redirect('/materias');
    }

    // Quitar la materia de todos los grados que la tengan asignada
    await Grado.updateMany(
      { materias: id },
      { $pull: { materias: id } }
    );

    const nombre = materia.nombre;
    await Materia.findByIdAndDelete(id);

    req.flash('exito', `Materia "${nombre}" eliminada correctamente.`);
    res.redirect('/materias');
  } catch (error) {
    console.error('Error al eliminar materia:', error);
    req.flash('error', 'Error al eliminar la materia.');
    res.redirect('/materias');
  }
};

module.exports = {
  listarMaterias,
  obtenerMateria,
  crearMateria,
  editarMateria,
  eliminarMateria,
};
