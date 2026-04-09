/**
 * controllers/historialControlador.js
 * Solo accesible para admin.
 * GET /historial  → muestra el contenido del historial.log paginado
 */

const fs   = require('fs');
const path = require('path');

const RUTA_HISTORIAL = path.join(__dirname, '..', 'historial.log');

// ─────────────────────────────────────────────────────────────────────────────
// GET /historial
// ─────────────────────────────────────────────────────────────────────────────
const verHistorial = (req, res) => {
  try {
    let lineas = [];

    if (fs.existsSync(RUTA_HISTORIAL)) {
      const contenido = fs.readFileSync(RUTA_HISTORIAL, 'utf8');
      lineas = contenido
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .reverse(); // más recientes primero
    }

    // ── Filtros opcionales ────────────────────────────────────────────────
    const { accion, usuario, campo, pagina = 1, por_pagina = 50 } = req.query;

    if (accion)   lineas = lineas.filter(l => l.includes(accion.toUpperCase()));
    if (usuario)  lineas = lineas.filter(l => l.toLowerCase().includes(usuario.toLowerCase()));
    if (campo)    lineas = lineas.filter(l => l.includes(`campo: ${campo}`));

    // ── Paginación ────────────────────────────────────────────────────────
    const total      = lineas.length;
    const paginaNum  = Math.max(1, parseInt(pagina));
    const porPagina  = Math.min(200, parseInt(por_pagina));
    const inicio     = (paginaNum - 1) * porPagina;
    const paginadas  = lineas.slice(inicio, inicio + porPagina);

    res.render('paginas/historial', {
      titulo:       'Historial de Cambios',
      lineas:       paginadas,
      total,
      pagina:       paginaNum,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
      filtros:      { accion, usuario, campo },
      paginaActual: 'historial',
    });

  } catch (error) {
    console.error('Error al cargar historial:', error);
    req.flash('error', 'No se pudo cargar el historial.');
    res.redirect('/dashboard');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /historial/descargar
// ─────────────────────────────────────────────────────────────────────────────
const descargarHistorial = (req, res) => {
  try {
    if (!fs.existsSync(RUTA_HISTORIAL)) {
      req.flash('info', 'Aún no hay registros en el historial.');
      return res.redirect('/historial');
    }
    res.download(RUTA_HISTORIAL, `historial_klassy_${new Date().toISOString().slice(0,10)}.log`);
  } catch (error) {
    console.error('Error al descargar historial:', error);
    req.flash('error', 'No se pudo descargar el historial.');
    res.redirect('/historial');
  }
};

module.exports = { verHistorial, descargarHistorial };
