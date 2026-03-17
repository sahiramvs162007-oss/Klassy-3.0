const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/periodoControlador');

const soloAdmin = autorizar('admin');

router.get('/',             soloAdmin, ctrl.listarPeriodos);
router.get('/:id/datos',    soloAdmin, ctrl.obtenerPeriodo);
router.post('/',            soloAdmin, ctrl.crearPeriodo);
router.put('/:id',          soloAdmin, ctrl.editarPeriodo);
router.put('/:id/cerrar',   soloAdmin, ctrl.cerrarPeriodo);
router.delete('/:id',       soloAdmin, ctrl.eliminarPeriodo);

module.exports = router;
