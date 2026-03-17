const express    = require('express');
const router     = express.Router();
const autorizar  = require('../middlewares/autorizar');
const ctrl       = require('../controllers/usuarioControlador');

// Solo admin y director pueden gestionar usuarios
const soloAdminDirector = autorizar('admin', 'director');

// Listar
router.get('/',           soloAdminDirector, ctrl.listarUsuarios);

// Obtener datos de un usuario (para drawer de edición)
router.get('/:id/datos',  soloAdminDirector, ctrl.obtenerUsuario);

// Crear
router.post('/',          soloAdminDirector, ctrl.crearUsuario);

// Editar
router.put('/:id',        soloAdminDirector, ctrl.editarUsuario);

// Eliminar
router.delete('/:id',     soloAdminDirector, ctrl.eliminarUsuario);

module.exports = router;
