/**
 * controllers/dashboardControlador.js
 *
 * Admin:    stats + accesos rápidos + gestión de noticias + config institucional
 * Resto:    hero + visión/misión + accesos por rol + mosaico de noticias
 */

const { Noticia, Usuario, Grado, Materia, Configuracion } = require('../models');

const AÑO_ACTUAL = new Date().getFullYear();

const obtenerConfig = async () => {
  let c = await Configuracion.findOne();
  if (!c) c = await Configuracion.create({ nombreColegio: 'Mi Colegio', vision: '', mision: '' });
  return c;
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
    config.vision         = vision?.trim()         || '';
    config.mision         = mision?.trim()         || '';
    config.correoDirector = correoDirector?.trim()  || '';
    
   
    if (req.files && req.files.fotoInstitucion) {
      config.fotoInstitucion = req.files.fotoInstitucion[0].filename;
    }

    await config.save();

    req.flash('exito', 'Configuración guardada correctamente.');
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    req.flash('error', 'Error al guardar la configuración.');
    res.redirect('/dashboard');
  }
};

module.exports = { mostrarDashboard, guardarConfiguracion };
