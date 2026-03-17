const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/noticiaControlador');

// Admin, director y docente pueden gestionar noticias
const gestores = autorizar('admin', 'director', 'docente');

router.get('/',          gestores, ctrl.listarNoticias);
router.get('/:id/datos', gestores, ctrl.obtenerNoticia);
router.post('/',         gestores, ctrl.manejarImagenNoticia, ctrl.crearNoticia);
router.put('/:id',       gestores, ctrl.manejarImagenNoticia, ctrl.editarNoticia);
router.delete('/:id',    gestores, ctrl.eliminarNoticia);

module.exports = router;
