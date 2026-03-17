const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/matriculaControlador');

const soloAdminDirector = autorizar('admin', 'director');

// Datos para poblar el formulario (estudiantes y grados disponibles)
router.get('/formulario',  soloAdminDirector, ctrl.datosFormulario);

// Detalle + historial de una matrícula (para el drawer)
router.get('/:id/datos',   soloAdminDirector, ctrl.obtenerMatricula);

router.get('/',            soloAdminDirector, ctrl.listarMatriculas);
router.post('/',           soloAdminDirector, ctrl.crearMatricula);
router.put('/:id',         soloAdminDirector, ctrl.editarMatricula);
router.delete('/:id',      soloAdminDirector, ctrl.eliminarMatricula);

module.exports = router;
