/**
 * services/notificacionServicio.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo central de notificaciones.
 * Cualquier controlador del sistema puede importar crearNotificacion()
 * para enviar una notificación a un usuario sin repetir lógica.
 *
 * Uso desde otro controlador:
 *   const { crearNotificacion } = require('../services/notificacionServicio');
 *   await crearNotificacion({
 *     usuarioId: estudianteId,
 *     tipo:      'nueva_actividad',
 *     titulo:    'Nueva actividad publicada',
 *     mensaje:   'El docente publicó: Taller de Fracciones',
 *     enlace:    '/actividades/123',
 *   });
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Notificacion } = require('../models');

/**
 * Crea una notificación para un usuario.
 * @param {Object} datos
 * @param {string} datos.usuarioId   - ObjectId del destinatario
 * @param {string} datos.tipo        - Tipo de notificación
 * @param {string} datos.titulo      - Título corto
 * @param {string} datos.mensaje     - Cuerpo del mensaje
 * @param {string} [datos.enlace]    - URL opcional al hacer clic
 * @param {string} [datos.origenId]  - ObjectId del usuario que origina (opcional)
 * @returns {Promise<Notificacion>}
 */
const crearNotificacion = async ({ usuarioId, tipo, titulo, mensaje, enlace = null, origenId = null }) => {
  try {
    const notificacion = await Notificacion.create({
      usuarioId,
      tipo,
      titulo,
      mensaje,
      enlace,
      origenId,
      estado: 'no_leida',
    });
    return notificacion;
  } catch (error) {
    // No lanzamos el error para no interrumpir el flujo principal del sistema
    console.error('Error al crear notificación:', error.message);
    return null;
  }
};

/**
 * Crea la misma notificación para múltiples usuarios a la vez.
 * @param {string[]} usuariosIds  - Array de ObjectIds
 * @param {Object}   datos        - Mismo formato que crearNotificacion (sin usuarioId)
 */
const crearNotificacionMasiva = async (usuariosIds, { tipo, titulo, mensaje, enlace = null, origenId = null }) => {
  try {
    const docs = usuariosIds.map(uid => ({
      usuarioId: uid,
      tipo,
      titulo,
      mensaje,
      enlace,
      origenId,
      estado: 'no_leida',
    }));
    await Notificacion.insertMany(docs, { ordered: false });
  } catch (error) {
    console.error('Error al crear notificaciones masivas:', error.message);
  }
};

/**
 * Cuenta las notificaciones no leídas de un usuario.
 * Se usa en el middleware para poblar res.locals.
 */
const contarNoLeidas = async (usuarioId) => {
  try {
    return await Notificacion.countDocuments({ usuarioId, estado: 'no_leida' });
  } catch {
    return 0;
  }
};

module.exports = {
  crearNotificacion,
  crearNotificacionMasiva,
  contarNoLeidas,
};
