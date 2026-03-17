const express    = require('express');
const router     = express.Router();
const autorizar  = require('../middlewares/autorizar');
const ctrl       = require('../controllers/actividadControlador');
const { manejarSubidaActividad, manejarSubidaEntrega } = require('../config/multer');

// ─── Redirección por rol ──────────────────────────────────────────────────────
router.get('/', autorizar('docente', 'estudiante', 'admin', 'director'), ctrl.redirigirPorRol);

// ─── RUTAS DOCENTE ────────────────────────────────────────────────────────────
const soloDocente = autorizar('docente');

// Panel principal (selección de bloques)
router.get('/docente',          soloDocente, ctrl.panelDocente);

// Detalle de una actividad con entregas
router.get('/docente/:id',      soloDocente, ctrl.detalleActividadDocente);

// CRUD de actividades
router.post('/docente',         soloDocente, manejarSubidaActividad, ctrl.crearActividad);
router.put('/docente/:id',      soloDocente, manejarSubidaActividad, ctrl.editarActividad);
router.delete('/docente/:id',   soloDocente, ctrl.eliminarActividad);

// Comentar actividad (docente)
router.post('/docente/:id/comentarios',  soloDocente, ctrl.comentarActividadDocente);

// Calificar entrega → genera Nota
router.put('/docente/entregas/:entregaId/calificar', soloDocente, ctrl.calificarEntrega);

// ─── RUTAS ESTUDIANTE ─────────────────────────────────────────────────────────
const soloEstudiante = autorizar('estudiante');

// Panel del estudiante (todas sus actividades)
router.get('/estudiante',          soloEstudiante, ctrl.panelEstudiante);

// Detalle de actividad
router.get('/estudiante/:id',      soloEstudiante, ctrl.detalleActividadEstudiante);

// Subir entrega (con archivos)
router.post('/estudiante/:id/entregas',    soloEstudiante, manejarSubidaEntrega, ctrl.subirEntrega);

// Comentar actividad (estudiante)
router.post('/estudiante/:id/comentarios', soloEstudiante, ctrl.comentarActividadEstudiante);

module.exports = router;
