const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/gradoControlador');

const soloAdmin = autorizar('admin');

router.get('/',          soloAdmin, ctrl.listarGrados);
router.get('/:id/datos', soloAdmin, ctrl.obtenerGrado);
router.post('/',         soloAdmin, ctrl.crearGrado);
router.put('/:id',       soloAdmin, ctrl.editarGrado);
router.delete('/:id',    soloAdmin, ctrl.eliminarGrado);

module.exports = router;
