const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/noticiaControlador');

// Admin, director y docente gestionan noticias
const gestores = autorizar('admin', 'director', 'docente');

router.get('/',          gestores, ctrl.listarNoticias);
router.get('/:id/datos', gestores, ctrl.obtenerNoticia);
router.post('/',         gestores, ctrl.manejarImagen, ctrl.crearNoticia);
router.put('/:id',       gestores, ctrl.manejarImagen, ctrl.editarNoticia);
router.delete('/:id',    gestores, ctrl.eliminarNoticia);

module.exports = router;
