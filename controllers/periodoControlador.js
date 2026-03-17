/**
 * controllers/periodoControlador.js
 * CRUD de periodos académicos. Solo admin.
 * Regla clave: cerrar un periodo (activo = false) es irreversible
 * y en Sprint 11 disparará cerrarPeriodo() para generar boletines.
 */

const { Periodo } = require('../models');

// ─── LISTAR  GET /periodos ────────────────────────────────────────────────────
const listarPeriodos = async (req, res) => {
  try {
    const { filtroAnio = '' } = req.query;
    const filtro = {};

    if (filtroAnio) filtro.año = parseInt(filtroAnio, 10);

    const [periodos, añosDisponibles] = await Promise.all([
      Periodo.find(filtro).sort({ año: -1, numero: 1 }),
      Periodo.distinct('año'),
    ]);

    añosDisponibles.sort((a, b) => b - a);

    // Agrupar periodos por año para mostrarlos en secciones
    const periodosPorAnio = {};
    periodos.forEach(p => {
      if (!periodosPorAnio[p.año]) periodosPorAnio[p.año] = [];
      periodosPorAnio[p.año].push(p);
    });

    res.render('paginas/periodos', {
      titulo:          'Periodos Académicos',
      paginaActual:    'periodos',
      periodos,
      periodosPorAnio,
      añosDisponibles,
      filtroAnio,
      añoActual:       new Date().getFullYear(),
    });
  } catch (error) {
    console.error('Error al listar periodos:', error);
    req.flash('error', 'Error al cargar los periodos.');
    res.redirect('/dashboard');
  }
};

// ─── OBTENER UNO  GET /periodos/:id/datos ─────────────────────────────────────
const obtenerPeriodo = async (req, res) => {
  try {
    const periodo = await Periodo.findById(req.params.id);
    if (!periodo) return res.status(404).json({ error: 'Periodo no encontrado' });
    res.json(periodo);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el periodo' });
  }
};

// ─── CREAR  POST /periodos ────────────────────────────────────────────────────
const crearPeriodo = async (req, res) => {
  try {
    const { nombre, numero, año, fechaInicio, fechaFin } = req.body;

    // Verificar que no exista el mismo número de periodo en ese año
    const existe = await Periodo.findOne({
      numero: parseInt(numero, 10),
      año:    parseInt(año, 10),
    });
    if (existe) {
      req.flash('error', `Ya existe el Periodo ${numero} para el año ${año}.`);
      return res.redirect('/periodos');
    }

    // Validar que fechaFin sea posterior a fechaInicio
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      req.flash('error', 'La fecha de fin debe ser posterior a la fecha de inicio.');
      return res.redirect('/periodos');
    }

    await Periodo.create({
      nombre:      nombre.trim(),
      numero:      parseInt(numero, 10),
      año:         parseInt(año, 10),
      fechaInicio: new Date(fechaInicio),
      fechaFin:    new Date(fechaFin),
      activo:      true,
    });

    req.flash('exito', `Periodo "${nombre.trim()}" creado correctamente.`);
    res.redirect('/periodos');
  } catch (error) {
    console.error('Error al crear periodo:', error);
    req.flash('error', 'Error al crear el periodo.');
    res.redirect('/periodos');
  }
};

// ─── EDITAR  PUT /periodos/:id ────────────────────────────────────────────────
const editarPeriodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, numero, año, fechaInicio, fechaFin } = req.body;

    const periodo = await Periodo.findById(id);
    if (!periodo) {
      req.flash('error', 'Periodo no encontrado.');
      return res.redirect('/periodos');
    }

    // Un periodo cerrado no se puede editar
    if (!periodo.activo) {
      req.flash('error', 'No se puede editar un periodo cerrado.');
      return res.redirect('/periodos');
    }

    // Verificar duplicado excluyendo el periodo actual
    const duplicado = await Periodo.findOne({
      _id:    { $ne: id },
      numero: parseInt(numero, 10),
      año:    parseInt(año, 10),
    });
    if (duplicado) {
      req.flash('error', `Ya existe el Periodo ${numero} para el año ${año}.`);
      return res.redirect('/periodos');
    }

    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      req.flash('error', 'La fecha de fin debe ser posterior a la fecha de inicio.');
      return res.redirect('/periodos');
    }

    periodo.nombre      = nombre.trim();
    periodo.numero      = parseInt(numero, 10);
    periodo.año         = parseInt(año, 10);
    periodo.fechaInicio = new Date(fechaInicio);
    periodo.fechaFin    = new Date(fechaFin);

    await periodo.save();

    req.flash('exito', `Periodo "${periodo.nombre}" actualizado correctamente.`);
    res.redirect('/periodos');
  } catch (error) {
    console.error('Error al editar periodo:', error);
    req.flash('error', 'Error al actualizar el periodo.');
    res.redirect('/periodos');
  }
};

// ─── CERRAR PERIODO  PUT /periodos/:id/cerrar ─────────────────────────────────
// Acción irreversible: activo = false.
// En Sprint 11 este endpoint llamará a cerrarPeriodo() para generar boletines.
const cerrarPeriodo = async (req, res) => {
  try {
    const { id } = req.params;

    const periodo = await Periodo.findById(id);
    if (!periodo) {
      req.flash('error', 'Periodo no encontrado.');
      return res.redirect('/periodos');
    }

    if (!periodo.activo) {
      req.flash('info', 'Este periodo ya estaba cerrado.');
      return res.redirect('/periodos');
    }

    periodo.activo = false;
    await periodo.save();

    // Sprint 11: Generar boletines automáticamente
    const { cerrarPeriodo: generarBoletines } = require('../services/boletinServicio');
    try {
      const resultado = await generarBoletines(id);
      req.flash('exito', `Periodo "${periodo.nombre}" cerrado. ${resultado.boletinesCreados} boletines generados.`);
    } catch (errBoletin) {
      console.error('Error al generar boletines:', errBoletin.message);
      req.flash('exito', `Periodo "${periodo.nombre}" cerrado. (Boletines: ${errBoletin.message})`);
    }
    return res.redirect('/periodos');


  } catch (error) {
    console.error('Error al cerrar periodo:', error);
    req.flash('error', 'Error al cerrar el periodo.');
    res.redirect('/periodos');
  }
};

// ─── ELIMINAR  DELETE /periodos/:id ──────────────────────────────────────────
// Solo se permite eliminar periodos que aún están activos (nunca cerrados).
const eliminarPeriodo = async (req, res) => {
  try {
    const { id } = req.params;

    const periodo = await Periodo.findById(id);
    if (!periodo) {
      req.flash('error', 'Periodo no encontrado.');
      return res.redirect('/periodos');
    }

    if (!periodo.activo) {
      req.flash('error', 'No se puede eliminar un periodo cerrado. Ya tiene datos asociados.');
      return res.redirect('/periodos');
    }

    const nombre = periodo.nombre;
    await Periodo.findByIdAndDelete(id);

    req.flash('exito', `Periodo "${nombre}" eliminado correctamente.`);
    res.redirect('/periodos');
  } catch (error) {
    console.error('Error al eliminar periodo:', error);
    req.flash('error', 'Error al eliminar el periodo.');
    res.redirect('/periodos');
  }
};

module.exports = {
  listarPeriodos,
  obtenerPeriodo,
  crearPeriodo,
  editarPeriodo,
  cerrarPeriodo,
  eliminarPeriodo,
};
