const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/notificacionControlador');

// Todos los roles autenticados pueden usar notificaciones
const autenticado = autorizar('admin', 'director', 'docente', 'estudiante');

router.get('/',                  autenticado, ctrl.listarNotificaciones);
router.get('/conteo',            autenticado, ctrl.contarNoLeidas);
router.put('/leer-todas',        autenticado, ctrl.marcarTodasLeidas);
router.put('/:id/leer',          autenticado, ctrl.marcarLeida);
router.delete('/:id',            autenticado, ctrl.eliminarNotificacion);

module.exports = router;
