/**
 * controllers/notificacionControlador.js
 * Endpoints para que el frontend consulte y gestione notificaciones.
 */

const { Notificacion } = require('../models');

// ─── LISTAR  GET /notificaciones ──────────────────────────────────────────────
// Devuelve las últimas 30 notificaciones del usuario en sesión
const listarNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.session.usuario._id;
    const { soloNoLeidas = 'false' } = req.query;

    const filtro = { usuarioId };
    if (soloNoLeidas === 'true') filtro.estado = 'no_leida';

    const notificaciones = await Notificacion.find(filtro)
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({ ok: true, notificaciones });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al obtener notificaciones' });
  }
};

// ─── CONTAR NO LEÍDAS  GET /notificaciones/conteo ────────────────────────────
const contarNoLeidas = async (req, res) => {
  try {
    const usuarioId = req.session.usuario._id;
    const conteo = await Notificacion.countDocuments({ usuarioId, estado: 'no_leida' });
    res.json({ ok: true, conteo });
  } catch (error) {
    res.status(500).json({ ok: false, conteo: 0 });
  }
};

// ─── MARCAR COMO LEÍDA  PUT /notificaciones/:id/leer ────────────────────────
const marcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario._id;

    // Solo el dueño puede marcarla
    const notif = await Notificacion.findOneAndUpdate(
      { _id: id, usuarioId },
      { estado: 'leida' },
      { new: true }
    );

    if (!notif) return res.status(404).json({ ok: false, error: 'Notificación no encontrada' });
    res.json({ ok: true, notificacion: notif });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al marcar notificación' });
  }
};

// ─── MARCAR TODAS COMO LEÍDAS  PUT /notificaciones/leer-todas ───────────────
const marcarTodasLeidas = async (req, res) => {
  try {
    const usuarioId = req.session.usuario._id;
    await Notificacion.updateMany({ usuarioId, estado: 'no_leida' }, { estado: 'leida' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al marcar notificaciones' });
  }
};

// ─── ELIMINAR  DELETE /notificaciones/:id ────────────────────────────────────
const eliminarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario._id;

    await Notificacion.findOneAndDelete({ _id: id, usuarioId });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al eliminar notificación' });
  }
};

module.exports = {
  listarNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  eliminarNotificacion,
};
