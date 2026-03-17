const verificarSesion = (req, res, next) => {
  // Rutas que no necesitan sesión
  if (req.originalUrl.startsWith('/auth') ||
      req.originalUrl.startsWith('/public') ||
      req.originalUrl.startsWith('/css') ||
      req.originalUrl.startsWith('/js') ||
      req.originalUrl.startsWith('/uploads') ||
      req.originalUrl.startsWith('/favicon')) {
    return next();
  }

  if (!req.session || !req.session.usuario) {
    return res.redirect('/auth/login');
  }

  // Expiración por inactividad (6 horas)
  const ahora = Date.now();
  const ultima = req.session.ultimaAccion || ahora;
  if (ahora - ultima > 6 * 60 * 60 * 1000) {
    req.session.destroy(() => {});
    return res.redirect('/auth/login');
  }

  req.session.ultimaAccion = ahora;
  res.locals.usuarioActual = req.session.usuario;
  next();
};

module.exports = verificarSesion;
