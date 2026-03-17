/**
 * controllers/dashboardControlador.js
 * Dashboard principal con vistas diferenciadas por rol.
 *
 * Admin:      resumen del sistema + accesos rápidos a módulos
 * Resto:      visión/misión + foto + noticias + accesos rápidos
 */

const { Noticia, Usuario, Grado, Materia, Matricula, Configuracion } = require('../models');

const AÑO_ACTUAL = new Date().getFullYear();

// ─── Obtener o crear configuración institucional ──────────────────────────────
const obtenerConfiguracion = async () => {
  let config = await Configuracion.findOne();
  if (!config) {
    config = await Configuracion.create({
      nombreColegio:  'Mi Colegio KLASSY',
      vision:         '',
      mision:         '',
      correoDirector: '',
    });
  }
  return config;
};

// ─── DASHBOARD PRINCIPAL ──────────────────────────────────────────────────────
const mostrarDashboard = async (req, res) => {
  try {
    const { rol } = req.session.usuario;

    // Noticias activas para todos los roles
    const noticias = await Noticia.find({ activo: true })
      .populate('autorId', 'nombre apellido')
      .sort({ fechaPublicacion: -1 })
      .limit(9);

    // Configuración institucional
    const config = await obtenerConfiguracion();

    if (rol === 'admin') {
      // ─── Dashboard del administrador ───────────────────────────────────
      const [totalEstudiantes, totalDocentes, totalGrados, totalMaterias] = await Promise.all([
        Usuario.countDocuments({ rol: 'estudiante', activo: true }),
        Usuario.countDocuments({ rol: 'docente',    activo: true }),
        Grado.countDocuments({ activo: true, año: AÑO_ACTUAL }),
        Materia.countDocuments({ activo: true }),
      ]);

      // Matrículas activas del año
      const totalMatriculas = await Matricula.countDocuments({ año: AÑO_ACTUAL, estado: 'activa' });

      return res.render('paginas/dashboard', {
        titulo:           'Dashboard',
        paginaActual:     'dashboard',
        rol:              'admin',
        config,
        noticias,
        stats: {
          totalEstudiantes,
          totalDocentes,
          totalGrados,
          totalMaterias,
          totalMatriculas,
        },
        mensajeExito: req.flash('exito'),
        mensajeError: req.flash('error'),
      });
    }

    // ─── Dashboard de director, docente y estudiante ───────────────────────
    return res.render('paginas/dashboard', {
      titulo:       'Dashboard',
      paginaActual: 'dashboard',
      rol,
      config,
      noticias,
      stats:        null,
      mensajeExito: req.flash('exito'),
      mensajeError: req.flash('error'),
    });

  } catch (error) {
    console.error('Error en dashboard:', error);
    req.flash('error', 'Error al cargar el dashboard.');
    res.render('paginas/dashboard', {
      titulo: 'Dashboard', paginaActual: 'dashboard', rol: 'admin',
      config: {}, noticias: [], stats: null,
      mensajeExito: [], mensajeError: [],
    });
  }
};

// ─── GUARDAR CONFIGURACIÓN  PUT /dashboard/configuracion ─────────────────────
const guardarConfiguracion = async (req, res) => {
  try {
    const { nombreColegio, vision, mision, correoDirector } = req.body;

    let config = await Configuracion.findOne();
    if (!config) config = new Configuracion();

    config.nombreColegio  = nombreColegio?.trim() || config.nombreColegio;
    config.vision         = vision?.trim()         || '';
    config.mision         = mision?.trim()         || '';
    config.correoDirector = correoDirector?.trim()  || '';

    await config.save();

    req.flash('exito', 'Configuración institucional guardada correctamente.');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    req.flash('error', 'Error al guardar la configuración.');
    res.redirect('/dashboard');
  }
};

module.exports = { mostrarDashboard, guardarConfiguracion };
