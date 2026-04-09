require('dotenv').config();

const express        = require('express');
const session        = require('express-session');
const methodOverride = require('method-override');
const flash          = require('connect-flash');
const path           = require('path');

const conectarDB      = require('./config/db');
const verificarSesion = require('./middlewares/verificarSesion');

// Rutas
const rutasAuth           = require('./routes/auth');
const rutasIndex          = require('./routes/index');
const rutasUsuarios       = require('./routes/usuarios');
const rutasMaterias       = require('./routes/materias');
const rutasGrados         = require('./routes/grados');
const rutasPeriodos       = require('./routes/periodos');
const rutasMatriculas     = require('./routes/matriculas');
const rutasAsignaciones   = require('./routes/asignaciones');
const rutasNotificaciones = require('./routes/notificaciones');
const rutasActividades    = require('./routes/actividades');
const rutasNotas          = require('./routes/notas');
const rutasBoletines      = require('./routes/boletines');
const rutasNoticias       = require('./routes/noticias');
const rutasRetiros        = require('./routes/retiros');
const rutasHistorial      = require('./routes/historial');


conectarDB();

const app = express();

// ─── Motor de plantillas ───────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Middlewares de parseo ─────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Sesión ────────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESION_SECRETO || 'klassy_secreto_2025',
  resave:            true,
  saveUninitialized: false,
  cookie: {
    maxAge:   6 * 60 * 60 * 1000,
    httpOnly: true,
    secure:   false,
  },
}));

// ─── Flash (debe ir DESPUÉS de session) ───────────────────────────────────────
app.use(flash());

// ─── Variables locales globales ───────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.usuarioActual = req.session?.usuario || null;
  res.locals.mensajeExito  = req.flash('exito');
  res.locals.mensajeError  = req.flash('error');
  res.locals.mensajeInfo   = req.flash('info');
  next();
});

// ─── Protección de rutas (DESPUÉS de flash y locals) ─────────────────────────
app.use(verificarSesion);

// ─── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/auth',          rutasAuth);
app.use('/',              rutasIndex);
app.use('/usuarios',      rutasUsuarios);
app.use('/materias',      rutasMaterias);
app.use('/grados',        rutasGrados);
app.use('/periodos',      rutasPeriodos);
app.use('/matriculas',    rutasMatriculas);
app.use('/asignaciones',  rutasAsignaciones);
app.use('/notificaciones',rutasNotificaciones);
app.use('/actividades',   rutasActividades);
app.use('/notas',         rutasNotas);
app.use('/boletines',     rutasBoletines);
app.use('/noticias',      rutasNoticias);
app.use('/retiros',       rutasRetiros);
app.use('/historial',     rutasHistorial);

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', {
    titulo: 'Página no encontrada',
    mensaje: 'La ruta que buscas no existe.',
    codigo: 404,
  });
});

// ─── Error global ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).render('error', {
    titulo: 'Error del servidor',
    mensaje: err.message || 'Error interno.',
    codigo: 500,
  });
});

const PUERTO = process.env.PUERTO || 3000;
app.listen(PUERTO, () => {
  console.log(`KLASSY corriendo en http://localhost:${PUERTO}`);
});
