const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/materiaControlador');

const soloAdmin = autorizar('admin');

router.get('/',          soloAdmin, ctrl.listarMaterias);
router.get('/:id/datos', soloAdmin, ctrl.obtenerMateria);
router.post('/',         soloAdmin, ctrl.crearMateria);
router.put('/:id',       soloAdmin, ctrl.editarMateria);
router.delete('/:id',    soloAdmin, ctrl.eliminarMateria);

module.exports = router;
