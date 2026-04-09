/**
 * middlewares/registrarHistorial.js
 *
 * Guarda cada cambio en historial.log con el formato:
 * [2026-04-08 6:00pm] EDITAR_USUARIO | usuario: Andrés García (andres@gmail.com) | campo: correo | antes: viejo@gmail.com | despues: nuevo@gmail.com
 *
 * Si un registro tiene varios campos modificados, se escribe una línea por cada campo.
 *
 * Uso en controladores (no cambia):
 *   await registrarCambio(req, {
 *     accion:    'EDITAR_USUARIO',
 *     entidad:   'Usuario',
 *     entidadId: usuario._id,
 *     cambios: {
 *       correo: { antes: 'a@a.com', despues: 'b@b.com' },
 *     },
 *   });
 */

const fs   = require('fs');
const path = require('path');

const RUTA_HISTORIAL = path.join(__dirname, '..', 'historial.log');

// ─── Formatear fecha legible ──────────────────────────────────────────────────
const formatearFecha = (fecha = new Date()) => {
  const año  = fecha.getFullYear();
  const mes  = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia  = String(fecha.getDate()).padStart(2, '0');
  let horas  = fecha.getHours();
  const mins = String(fecha.getMinutes()).padStart(2, '0');
  const ampm = horas >= 12 ? 'pm' : 'am';
  horas      = horas % 12 || 12;
  return `${año}-${mes}-${dia} ${horas}:${mins}${ampm}`;
};

// ─── Función principal ────────────────────────────────────────────────────────
const registrarCambio = async (req, { accion, entidad, entidadId, cambios }) => {
  try {
    const usuario  = req.session?.usuario || {};
    const fecha    = formatearFecha();
    const nombre   = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Desconocido';
    const correo   = usuario.correo || 'sin-correo';
    const campos   = Object.entries(cambios || {});

    // Si no hubo campos modificados, igual escribir una línea general
    if (campos.length === 0) {
      const linea = `[${fecha}] ${accion} | usuario: ${nombre} (${correo}) | entidad: ${entidad} | id: ${entidadId || 'N/A'} | sin cambios detectados\n`;
      fs.appendFileSync(RUTA_HISTORIAL, linea, 'utf8');
      return;
    }

    // Una línea por cada campo modificado
    for (const [campo, { antes, despues }] of campos) {
      const linea = `[${fecha}] ${accion} | usuario: ${nombre} (${correo}) | campo: ${campo} | antes: ${antes ?? 'null'} | despues: ${despues ?? 'null'}\n`;
      fs.appendFileSync(RUTA_HISTORIAL, linea, 'utf8');
    }

  } catch (err) {
    console.error('[Historial] Error al registrar cambio:', err.message);
  }
};

module.exports = { registrarCambio };