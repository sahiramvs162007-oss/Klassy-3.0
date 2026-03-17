const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/boletinControlador');

// Redirección por rol
router.get('/', autorizar('admin','director','docente','estudiante'), ctrl.redirigirPorRol);

// ─── ESTUDIANTE ───────────────────────────────────────────────────────────────
router.get('/estudiante', autorizar('estudiante'), ctrl.panelEstudiante);
router.get('/estudiante/:id/pdf', autorizar('estudiante'), ctrl.descargarPDF);

// ─── DOCENTE ──────────────────────────────────────────────────────────────────
router.get('/docente', autorizar('docente'), ctrl.panelDocente);
router.get('/docente/:id/pdf', autorizar('docente'), ctrl.descargarPDF);

// ─── ADMIN / DIRECTOR ─────────────────────────────────────────────────────────
const adminDir = autorizar('admin','director');

router.get('/admin',           adminDir, ctrl.panelAdmin);
router.get('/admin/:id/pdf',   adminDir, ctrl.descargarPDF);
router.delete('/admin/:id',    adminDir, ctrl.eliminarBoletin);

// Reportes PDF
router.get('/reporte/:tipo/pdf', adminDir, ctrl.descargarPDFReporte);

// Acciones de cierre
router.put('/cerrar-periodo/:id', autorizar('admin'), ctrl.ejecutarCerrarPeriodo);
router.post('/cerrar-anio',       autorizar('admin'), ctrl.ejecutarCerrarAño);

module.exports = router;
