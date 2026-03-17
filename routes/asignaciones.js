const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/asignacionControlador');

const soloAdminDirector = autorizar('admin', 'director');

// Materias disponibles para un grado (para el formulario dinámico)
router.get('/grado/:gradoId/materias', soloAdminDirector, ctrl.materiasDeGrado);

// Detalle de una asignación (para el drawer)
router.get('/:id/datos',              soloAdminDirector, ctrl.obtenerAsignacion);

router.get('/',                       soloAdminDirector, ctrl.listarAsignaciones);
router.post('/',                      soloAdminDirector, ctrl.crearAsignacion);
router.put('/:id',                    soloAdminDirector, ctrl.editarAsignacion);
router.delete('/:id',                 soloAdminDirector, ctrl.eliminarAsignacion);

module.exports = router;
