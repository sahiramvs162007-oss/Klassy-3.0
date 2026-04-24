/**
 * routes/analisis.routes.js
 */

'use strict';

const express   = require('express');
const router    = express.Router();
const autorizar = require('../middlewares/autorizar');

// GET /analitica → vista del estudiante con su reporte de IA
router.get('/', autorizar('estudiante'), (req, res) => {
  res.render('paginas/analitica-estudiante', {
    titulo:       'Mi Análisis Académico',
    paginaActual: 'analitica',
  });
});

// GET /analitica/panel → panel para admin, director y docente
// El EJS controla qué secciones ve cada rol via ROL_USUARIO
router.get('/panel', autorizar('admin', 'director', 'docente'), (req, res) => {
  res.render('paginas/ia-panel', {
    titulo:       'Panel de Inteligencia Académica',
    paginaActual: 'analitica',
    rolUsuario:   req.session.usuario.rol,  // lo usa el EJS para ocultar botón entrenar
  });
});

// GET /analitica/estudiante/:id → admin, director y docente consultan un estudiante
router.get('/estudiante/:id', autorizar('admin', 'director', 'docente'), (req, res) => {
  res.render('paginas/analitica-estudiante', {
    titulo:              'Análisis Académico',
    paginaActual:        'analitica',
    estudianteIdExterno: req.params.id,
  });
});

module.exports = router;
