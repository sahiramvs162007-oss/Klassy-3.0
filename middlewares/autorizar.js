/**
 * middlewares/autorizar.js
 * Verifica que el usuario en sesión tenga alguno de los roles permitidos.
 * En Sprint 8 también verificará que la sesión exista.
 */

const autorizar = (...rolesPermitidos) => {
  return (req, res, next) => {
    const usuario = req.session.usuario;

    // Sin sesión → redirigir al login (Sprint 8 lo manejará)
    if (!usuario) {
      req.flash('error', 'Debes iniciar sesión para acceder.');
      return res.redirect('/auth/login');
    }

    // Verificar rol
    if (!rolesPermitidos.includes(usuario.rol)) {
      req.flash('error', 'No tienes permiso para acceder a esta sección.');
      return res.redirect('/dashboard');
    }

    next();
  };
};

module.exports = autorizar;
