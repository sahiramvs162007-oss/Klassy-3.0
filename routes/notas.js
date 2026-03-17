const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');
const ctrl      = require('../controllers/notaControlador');

// Redirección por rol
router.get('/', autorizar('docente','estudiante','admin','director'), ctrl.redirigirPorRol);

// ─── DOCENTE ──────────────────────────────────────────────────────────────────
router.get('/docente',        autorizar('docente'),                ctrl.panelDocente);
router.put('/docente/:id',    autorizar('docente'),                ctrl.editarNotaDocente);

// ─── ESTUDIANTE ───────────────────────────────────────────────────────────────
router.get('/estudiante',     autorizar('estudiante'),             ctrl.panelEstudiante);

// ─── ADMIN / DIRECTOR ─────────────────────────────────────────────────────────
router.get('/admin',          autorizar('admin','director'),       ctrl.panelAdmin);
router.put('/admin/:id',      autorizar('admin','director'),       ctrl.editarNotaAdmin);

module.exports = router;
