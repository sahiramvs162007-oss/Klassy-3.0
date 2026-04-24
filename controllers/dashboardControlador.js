/**
 * controllers/dashboardControlador.js
 *
 * Admin:    stats + accesos rápidos + gestión de noticias + config institucional
 * Resto:    hero + visión/misión + accesos por rol + mosaico de noticias
 */

const { Noticia, Usuario, Grado, Materia, Configuracion } = require('../models');

const AÑO_ACTUAL = new Date().getFullYear();

// FIX 3: Caché en memoria para la configuración del colegio.
// Antes, cada visita al dashboard hacía un Configuracion.findOne() a MongoDB
// aunque los datos (nombre, visión, misión) casi nunca cambian.
// Ahora se guarda en memoria y solo se refresca cuando el admin la edita.
let _configCache = null;

const obtenerConfig = async () => {
  if (_configCache) return _configCache;                          // retorna desde memoria si ya existe
  let c = await Configuracion.findOne();
  if (!c) c = await Configuracion.create({ nombreColegio: 'Mi Colegio', vision: '', mision: '' });
  _configCache = c;
  return _configCache;
};

const invalidarConfigCache = () => {
  _configCache = null;   // se llama después de guardar cambios en la configuración
};

// ─── GET /dashboard ───────────────────────────────────────────────────────────
const mostrarDashboard = async (req, res) => {
  try {
    const { rol } = req.session.usuario;

    const noticias = await Noticia.find({ activo: true })
      .populate('autorId', 'nombre apellido')
      .sort({ fechaPublicacion: -1 })
      .limit(10);

    const config = await obtenerConfig();

    if (rol === 'admin') {
      const [totalEstudiantes, totalDocentes, totalGrados, totalMaterias] = await Promise.all([
        Usuario.countDocuments({ rol: 'estudiante', activo: true }),
        Usuario.countDocuments({ rol: 'docente',    activo: true }),
        Grado.countDocuments({ activo: true, año: AÑO_ACTUAL }),
        Materia.countDocuments({ activo: true }),
      ]);

      return res.render('paginas/dashboard', {
        titulo: 'Dashboard', paginaActual: 'dashboard', rol, config, noticias,
        stats: { totalEstudiantes, totalDocentes, totalGrados, totalMaterias },
        mensajeExito: req.flash('exito'),
        mensajeError: req.flash('error'),
      });
    }

    return res.render('paginas/dashboard', {
      titulo: 'Dashboard', paginaActual: 'dashboard', rol, config, noticias, stats: null,
      mensajeExito: req.flash('exito'),
      mensajeError: req.flash('error'),
    });

  } catch (error) {
    console.error('Error en dashboard:', error);
    res.render('paginas/dashboard', {
      titulo: 'Dashboard', paginaActual: 'dashboard',
      rol: req.session.usuario?.rol || 'admin',
      config: {}, noticias: [], stats: null,
      mensajeExito: [], mensajeError: [],
    });
  }
};

// ─── PUT /dashboard/configuracion ────────────────────────────────────────────
const guardarConfiguracion = async (req, res) => {
  try {
    const { nombreColegio, vision, mision, correoDirector } = req.body;
    let config = await Configuracion.findOne();
    if (!config) config = new Configuracion();
    if (nombreColegio) config.nombreColegio  = nombreColegio.trim();
    config.vision         = vision?.trim()        || '';
    config.mision         = mision?.trim()        || '';
    config.correoDirector = correoDirector?.trim() || '';

    if (req.files && req.files.fotoInstitucion) {
      config.fotoInstitucion = req.files.fotoInstitucion[0].filename;
    }

    await config.save();

    // Invalidar caché para que el próximo request cargue los datos nuevos
    invalidarConfigCache();

    req.flash('exito', 'Configuración guardada correctamente.');
    res.redirect('/dashboard');

  } catch (error) {
    console.error('Error al guardar configuración:', error);
    req.flash('error', 'Error al guardar la configuración.');
    res.redirect('/dashboard');
  }
};

module.exports = { mostrarDashboard, guardarConfiguracion };
