/**
 * routes/analisisAcademico.routes.js
 * Rutas API JSON del módulo de IA.
 * app.use('/api/analisis', require('./routes/analisisAcademico.routes'));
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const { generarReporteEstudiante } = require('../ia/AnalisisAcademico.service');

// ── Middleware ────────────────────────────────────────────────────────────────
function autenticado(req, res, next) {
  if (!req.session?.usuario) return res.status(401).json({ error: 'No autenticado.' });
  next();
}

// ── GET /api/analisis/mi-reporte ──────────────────────────────────────────────
router.get('/mi-reporte', autenticado, async (req, res) => {
  const { rol, _id } = req.session.usuario;
  if (rol !== 'estudiante') {
    return res.status(403).json({ error: 'Solo los estudiantes pueden acceder a su reporte.' });
  }
  const reporte = await generarReporteEstudiante(_id);
  return res.status(reporte.exito ? 200 : (reporte.requiereEntrenamiento ? 503 : 500)).json(reporte);
});

// ── GET /api/analisis/estudiante/:id ─────────────────────────────────────────
router.get('/estudiante/:id', autenticado, async (req, res) => {
  const { rol } = req.session.usuario;
  if (!['admin', 'director', 'docente'].includes(rol)) {
    return res.status(403).json({ error: 'No tienes permiso.' });
  }
  const reporte = await generarReporteEstudiante(req.params.id);
  return res.status(reporte.exito ? 200 : (reporte.requiereEntrenamiento ? 503 : 500)).json(reporte);
});

// ── GET /api/analisis/buscar-estudiantes?q=texto ─────────────────────────────
// Usado por el buscador del panel admin — devuelve JSON directamente.
// NO depende de un endpoint externo: hace la consulta aquí.
router.get('/buscar-estudiantes', autenticado, async (req, res) => {
  const { rol } = req.session.usuario;
  if (!['admin', 'director', 'docente'].includes(rol)) {
    return res.status(403).json({ error: 'No tienes permiso.' });
  }

  const q = (req.query.q || '').trim();
  if (q.length < 3) return res.json({ usuarios: [] });

  try {
    const { Usuario, Matricula } = require('../models');
    const AÑO = new Date().getFullYear();

    // Buscar por nombre o apellido (regex case-insensitive)
    const regex    = new RegExp(q, 'i');
    const usuarios = await Usuario.find({
      rol:    'estudiante',
      activo: true,
      $or:    [{ nombre: regex }, { apellido: regex }],
    })
      .select('nombre apellido correo _id')
      .limit(15)
      .lean();

    // Enriquecer con grado activo del año actual
    const resultado = await Promise.all(usuarios.map(async (u) => {
      const mat = await Matricula.findOne({
        estudianteId: u._id,
        año: AÑO,
        estado: 'activa',
      }).populate('gradoId', 'nombre nivel').lean();
      return {
        _id:     u._id,
        nombre:  u.nombre,
        apellido:u.apellido,
        correo:  u.correo,
        grado:   mat?.gradoId?.nombre || 'Sin matrícula activa',
      };
    }));

    return res.json({ usuarios: resultado });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
