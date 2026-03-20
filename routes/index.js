const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const { mostrarDashboard, guardarConfiguracion } = require('../controllers/dashboardControlador');

const autenticado = autorizar('admin', 'director', 'docente', 'estudiante');

router.get('/', (req, res) => {
  if (!req.session.usuario) return res.redirect('/auth/login');
  res.redirect('/dashboard');
});

router.get('/dashboard',                   autenticado,         mostrarDashboard);
router.put('/dashboard/configuracion',     autorizar('admin'),  guardarConfiguracion);

module.exports = router;
