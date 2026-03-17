const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authControlador');

router.get('/login',          ctrl.mostrarLogin);
router.post('/login',         ctrl.procesarLogin);
router.get('/cerrar-sesion',  ctrl.cerrarSesion);
router.post('/cerrar-sesion', ctrl.cerrarSesion);
router.post('/recuperar',     ctrl.solicitarRecuperacion);

module.exports = router;
