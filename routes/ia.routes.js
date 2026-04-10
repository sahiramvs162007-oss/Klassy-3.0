/**
 * routes/ia.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Rutas del módulo de IA — acceso restringido a admin y director.
 *
 * Registrar en app.js / index.js:
 *   const iaRoutes = require('./routes/ia.routes');
 *   app.use('/api/ia', iaRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const { ejecutarReentrenamiento } = require('../ia/iaEntrenamiento.service');

// ── Middleware de autenticación ───────────────────────────────────────────────
function soloAdmin(req, res, next) {
  if (!req.session?.usuario) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  const rol = req.session.usuario.rol;
  if (rol !== 'admin' && rol !== 'director') {
    return res.status(403).json({ error: 'Acceso denegado. Solo admin o director.' });
  }
  next();
}

// ── POST /api/ia/entrenar ─────────────────────────────────────────────────────
/**
 * Dispara el pipeline completo de reentrenamiento.
 * Responde con el resumen del entrenamiento.
 *
 * Body: no requiere nada.
 * Response:
 *   200 → { exito: true,  mensaje, error, iterations, registros, duracionMs }
 *   500 → { exito: false, mensaje: 'descripción del error' }
 */
router.post('/entrenar', soloAdmin, async (req, res) => {
  console.log(`[IA] Reentrenamiento solicitado por: ${req.session.usuario.correo}`);

  const resultado = await ejecutarReentrenamiento();

  const status = resultado.exito ? 200 : 500;
  return res.status(status).json(resultado);
});

// ── GET /api/ia/estado ────────────────────────────────────────────────────────
/**
 * Verifica si existe un modelo entrenado y muestra sus metadatos.
 * Útil para mostrar en el panel de admin cuándo fue el último entrenamiento.
 */
router.get('/estado', soloAdmin, (req, res) => {
  const fs   = require('fs');
  const path = require('path');
  const MODELO_PATH = path.resolve(__dirname, '../modelo_ia.json');

  if (!fs.existsSync(MODELO_PATH)) {
    return res.json({
      modeloExiste: false,
      mensaje: 'No hay modelo entrenado. Presiona el botón de entrenamiento.',
    });
  }

  try {
    const modelo = JSON.parse(fs.readFileSync(MODELO_PATH, 'utf8'));
    return res.json({
      modeloExiste: true,
      meta: modelo._meta || {},
    });
  } catch (_) {
    return res.json({
      modeloExiste: false,
      mensaje: 'El archivo modelo_ia.json está corrupto. Reentrenar.',
    });
  }
});

module.exports = router;
