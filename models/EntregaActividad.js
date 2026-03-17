const mongoose = require('mongoose');

// ─── Sub-esquema de archivo adjunto (igual que en Actividad) ──────────────────
const archivoSchema = new mongoose.Schema(
  {
    nombreOriginal: { type: String, required: true },
    nombreArchivo:  { type: String, required: true },
    ruta:           { type: String, required: true },
    tipoMime:       { type: String, required: true },
    tamanio:        { type: Number },
  },
  { _id: false }
);

// ─── Esquema principal de EntregaActividad ────────────────────────────────────
const entregaActividadSchema = new mongoose.Schema(
  {
    actividadId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Actividad',
      required: [true, 'La actividad es obligatoria'],
    },
    estudianteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El estudiante es obligatorio'],
    },
    // Contenido en texto libre (textarea)
    contenidoTexto: {
      type:    String,
      trim:    true,
      default: '',
    },
    // Archivos adjuntos del estudiante
    archivos: [archivoSchema],

    fechaEntrega: {
      type:    Date,
      default: Date.now,
    },
    // Estado del ciclo de vida de la entrega
    estado: {
      type:    String,
      enum:    ['entregada', 'calificada'],
      default: 'entregada',
    },
    // Calificación asignada por el docente (1.0 – 5.0)
    nota: {
      type:    Number,
      min:     1.0,
      max:     5.0,
      default: null,
    },
    // Comentario del docente al calificar
    comentarioDocente: {
      type:    String,
      trim:    true,
      default: '',
    },
    // Referencia a la Nota generada al calificar esta entrega
    notaId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Nota',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para consultas por actividad y por estudiante
entregaActividadSchema.index({ actividadId: 1, estudianteId: 1 });
entregaActividadSchema.index({ estudianteId: 1 });

module.exports = mongoose.model('EntregaActividad', entregaActividadSchema);
