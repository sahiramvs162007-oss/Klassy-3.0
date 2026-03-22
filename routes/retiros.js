const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/retiroControlador');

const soloAdminDirector = autorizar('admin', 'director');

router.get('/',                      soloAdminDirector, ctrl.listarRetiros);
router.post('/',                     soloAdminDirector, ctrl.retirarEstudiante);
router.put('/:id/reactivar',         soloAdminDirector, ctrl.reactivarEstudiante);

module.exports = router;
