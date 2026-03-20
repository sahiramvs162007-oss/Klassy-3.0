const express    = require('express');
const router     = express.Router();
const autorizar  = require('../middlewares/autorizar');
const ctrl       = require('../controllers/usuarioControlador');
const { manejarSubidaExcelUsuarios } = require('../config/multer');

// Solo admin y director pueden gestionar usuarios
const soloAdminDirector = autorizar('admin', 'director');

// Listar
router.get('/',           soloAdminDirector, ctrl.listarUsuarios);

// Obtener datos de un usuario (para drawer de edición)
router.get('/:id/datos',  soloAdminDirector, ctrl.obtenerUsuario);

// Crear
router.post('/',          soloAdminDirector, ctrl.crearUsuario);

// Importar desde Excel
router.post('/importar',   soloAdminDirector, manejarSubidaExcelUsuarios, ctrl.importarUsuariosExcel);

// Descargar plantilla Excel
router.get('/plantilla-excel', soloAdminDirector, (req, res) => {
  const XLSX = require('xlsx');
  const datos = [
    {
      nombre: 'María',
      apellido: 'García',
      correo: 'maria.garcia@colegio.edu.co',
      rol: 'estudiante',
      documentoIdentidad: '1234567890',
      profesion: '',
      ultimoNivelCursado: 0,
    },
    {
      nombre: 'Carlos',
      apellido: 'López',
      correo: 'carlos.lopez@colegio.edu.co',
      rol: 'docente',
      documentoIdentidad: '9876543210',
      profesion: 'Licenciado en Matemáticas',
      ultimoNivelCursado: '',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_usuarios.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Editar
router.put('/:id',        soloAdminDirector, ctrl.editarUsuario);

// Eliminar
router.delete('/:id',     soloAdminDirector, ctrl.eliminarUsuario);

module.exports = router;
