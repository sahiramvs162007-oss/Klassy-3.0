const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const { verHistorial, descargarHistorial } = require('../controllers/historialControlador');

// Solo admin puede ver y descargar el historial
router.get('/',          autorizar('admin'), verHistorial);
router.get('/descargar', autorizar('admin'), descargarHistorial);

module.exports = router;
