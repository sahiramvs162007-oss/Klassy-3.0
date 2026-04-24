/**
 * ia/iaConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lector de configuración del colegio para el módulo de IA.
 * Lee el documento singleton de Configuracion en MongoDB y devuelve
 * los parámetros que el preprocesador necesita.
 *
 * Como Configuracion no tiene campos de escala de notas, este módulo
 * los provee como constantes fijas del colegio (1.0 – 5.0).
 * Si en el futuro se agregan al modelo, solo hay que leerlos aquí.
 *
 * Uso:
 *   const { obtenerConfigColegio } = require('./iaConfig');
 *   const config = await obtenerConfigColegio();
 *   // { escalaMin: 1, escalaMax: 5, notaAprobacion: 3, nombreColegio: '...' }
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Configuracion } = require('../models');

// ── Escala fija del colegio ───────────────────────────────────────────────────
// KLASSY opera con escala colombiana 1.0 – 5.0, aprobación ≥ 3.0
const ESCALA_MIN      = 1.0;
const ESCALA_MAX      = 5.0;
const NOTA_APROBACION = 3.0;

// ── Cache en memoria (singleton) ──────────────────────────────────────────────
let _cache = null;

/**
 * Retorna la configuración del colegio.
 * Hace una sola consulta a MongoDB y cachea el resultado en memoria.
 * Si MongoDB no responde o no hay documento, usa valores por defecto.
 *
 * @returns {Promise<{
 *   escalaMin:      number,
 *   escalaMax:      number,
 *   notaAprobacion: number,
 *   nombreColegio:  string,
 * }>}
 */
async function obtenerConfigColegio() {
  if (_cache) return _cache;

  try {
    const conf = await Configuracion.findOne().lean();

    _cache = {
      escalaMin:      ESCALA_MIN,
      escalaMax:      ESCALA_MAX,
      notaAprobacion: NOTA_APROBACION,
      nombreColegio:  conf?.nombreColegio || 'KLASSY',
    };
  } catch (_) {
    // Si falla la conexión, usamos defaults sin romper el módulo de IA
    _cache = {
      escalaMin:      ESCALA_MIN,
      escalaMax:      ESCALA_MAX,
      notaAprobacion: NOTA_APROBACION,
      nombreColegio:  'KLASSY',
    };
  }

  return _cache;
}

/**
 * Invalida el cache. Útil si el admin cambia la configuración
 * y quiere que el módulo de IA refleje los cambios sin reiniciar.
 */
function invalidarCache() {
  _cache = null;
}

module.exports = { obtenerConfigColegio, invalidarCache };
