const mongoose = require('mongoose');

const notificacionSchema = new mongoose.Schema(
  {
    usuarioId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El usuario destinatario es obligatorio'],
    },
    tipo: {
      type:     String,
      enum:     [
        'recuperacion_contrasena',
        'nueva_actividad',
        'cierre_anio',
        'administrativa',
      ],
      required: [true, 'El tipo de notificación es obligatorio'],
    },
    titulo: {
      type:     String,
      required: [true, 'El título es obligatorio'],
      trim:     true,
    },
    mensaje: {
      type:     String,
      required: [true, 'El mensaje es obligatorio'],
      trim:     true,
    },
    // Enlace opcional al que lleva la notificación al hacer clic
    enlace: {
      type:    String,
      default: null,
    },
    estado: {
      type:    String,
      enum:    ['no_leida', 'leida'],
      default: 'no_leida',
    },
    // Quién originó la notificación (opcional — puede ser el sistema)
    origenId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Usuario',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para consultas frecuentes
notificacionSchema.index({ usuarioId: 1, estado: 1, createdAt: -1 });
notificacionSchema.index({ usuarioId: 1, createdAt: -1 });

module.exports = mongoose.model('Notificacion', notificacionSchema);
