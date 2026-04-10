// routes/analisis.routes.js
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

// GET /analitica/panel → panel admin/director de IA
router.get('/panel', autorizar('admin', 'director'), (req, res) => {
  res.render('paginas/ia-panel', {
    titulo:       'Panel de Inteligencia Académica',
    paginaActual: 'analitica',
  });
});

// GET /analitica/estudiante/:id → admin/director/docente consulta reporte de un estudiante
router.get('/estudiante/:id', autorizar('admin', 'director', 'docente'), (req, res) => {
  res.render('paginas/analitica-estudiante', {
    titulo:              'Análisis Académico',
    paginaActual:        'analitica',
    estudianteIdExterno: req.params.id,
  });
});

module.exports = router;