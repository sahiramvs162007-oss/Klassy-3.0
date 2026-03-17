/**
 * authControlador.js — Versión simple y directa
 */
const bcrypt = require('bcrypt');

// Importar modelo directamente para evitar problemas con index.js
const Usuario          = require('../models/Usuario');
const AsignacionDocente = require('../models/AsignacionDocente');
const Matricula        = require('../models/Matricula');

const AÑO_ACTUAL = new Date().getFullYear();

// GET /auth/login
const mostrarLogin = (req, res) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/dashboard');
  }
  const error = req.query.error || '';
  const info  = req.query.info  || '';
  res.render('paginas/login', { titulo: 'Login', error, info });
};

// POST /auth/login
const procesarLogin = async (req, res) => {
  const correo     = (req.body.correo     || '').toLowerCase().trim();
  const contrasena = (req.body.contrasena || '');

  if (!correo || !contrasena) {
    return res.redirect('/auth/login?error=Completa+todos+los+campos');
  }

  try {
    // Buscar usuario CON contraseña (campo tiene select:false)
    const usuario = await Usuario.findOne({ correo }).select('+contrasena');

    console.log('[AUTH] Buscando:', correo);
    console.log('[AUTH] Encontrado:', usuario ? 'SÍ' : 'NO');

    if (!usuario) {
      return res.redirect('/auth/login?error=Correo+o+contrasena+incorrectos');
    }

    if (!usuario.activo) {
      return res.redirect('/auth/login?error=Cuenta+desactivada');
    }

    // Verificar que el hash existe
    if (!usuario.contrasena) {
      console.log('[AUTH] ERROR: El usuario no tiene contraseña guardada');
      return res.redirect('/auth/login?error=Error+de+configuracion+de+cuenta');
    }

    console.log('[AUTH] Hash en BD empieza con:', usuario.contrasena.substring(0, 7));

    const valida = await bcrypt.compare(contrasena, usuario.contrasena);
    console.log('[AUTH] Contraseña válida:', valida);

    if (!valida) {
      return res.redirect('/auth/login?error=Correo+o+contrasena+incorrectos');
    }

    // Validaciones por rol
    if (usuario.rol === 'docente') {
      const asig = await AsignacionDocente.findOne({
        docenteId: usuario._id,
        año:       AÑO_ACTUAL,
        estado:    'activo',
      });
      if (!asig) {
        return res.redirect('/auth/login?error=Sin+asignacion+activa+para+' + AÑO_ACTUAL);
      }
    }

    if (usuario.rol === 'estudiante') {
      const mat = await Matricula.findOne({
        estudianteId: usuario._id,
        año:          AÑO_ACTUAL,
        estado:       'activa',
      });
      if (!mat) {
        return res.redirect('/auth/login?error=Sin+matricula+activa+para+' + AÑO_ACTUAL);
      }
    }

    // Guardar sesión
    req.session.usuario = {
      _id:               usuario._id.toString(),
      nombre:            usuario.nombre,
      apellido:          usuario.apellido,
      correo:            usuario.correo,
      rol:               usuario.rol,
      ultimoNivelCursado:usuario.ultimoNivelCursado ?? null,
      profesion:         usuario.profesion          ?? null,
    };

    req.session.save((err) => {
      if (err) {
        console.error('[AUTH] Error al guardar sesión:', err);
        return res.redirect('/auth/login?error=Error+al+iniciar+sesion');
      }
      console.log('[AUTH] Sesión guardada. Rol:', usuario.rol);
      res.redirect('/dashboard');
    });

  } catch (err) {
    console.error('[AUTH] Error inesperado:', err);
    res.redirect('/auth/login?error=Error+del+servidor');
  }
};

// GET|POST /auth/cerrar-sesion
const cerrarSesion = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
};

// POST /auth/recuperar
const solicitarRecuperacion = async (req, res) => {
  res.redirect('/auth/login?info=Si+el+correo+existe+el+director+sera+notificado');
};

module.exports = { mostrarLogin, procesarLogin, cerrarSesion, solicitarRecuperacion };
