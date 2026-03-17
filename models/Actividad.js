const mongoose = require('mongoose');

// ─── Sub-esquema de archivo adjunto ───────────────────────────────────────────
const archivoSchema = new mongoose.Schema(
  {
    nombreOriginal: { type: String, required: true },
    nombreArchivo:  { type: String, required: true }, // nombre guardado en disco
    ruta:           { type: String, required: true },
    tipoMime:       { type: String, required: true },
    tamanio:        { type: Number },                 // en bytes
  },
  { _id: false }
);

// ─── Sub-esquema de comentario público ────────────────────────────────────────
const comentarioSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Usuario',
      required: true,
    },
    texto:    { type: String, required: true, trim: true },
    fecha:    { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Esquema principal de Actividad ───────────────────────────────────────────
const actividadSchema = new mongoose.Schema(
  {
    titulo: {
      type:     String,
      required: [true, 'El título de la actividad es obligatorio'],
      trim:     true,
    },
    descripcion: {
      type:    String,
      trim:    true,
      default: '',
    },
    docenteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El docente es obligatorio'],
    },
    gradoId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Grado',
      required: [true, 'El grado es obligatorio'],
    },
    materiaId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Materia',
      required: [true, 'La materia es obligatoria'],
    },
    periodoId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Periodo',
      required: [true, 'El periodo es obligatorio'],
    },
    // Fecha y hora límite para recibir entregas
    fechaLimite: {
      type:     Date,
      required: [true, 'La fecha límite es obligatoria'],
    },
    // Archivos adjuntos del docente a la actividad
    archivos: [archivoSchema],

    // Estado: abierta = recibe entregas, cerrada = fecha límite pasó
    estado: {
      type:    String,
      enum:    ['abierta', 'cerrada'],
      default: 'abierta',
    },
    // Sección de comentarios públicos
    comentarios: [comentarioSchema],
  },
  {
    timestamps: true,
  }
);

// Índice para consultas frecuentes por docente/grado/materia/periodo
actividadSchema.index({ docenteId: 1, gradoId: 1, materiaId: 1, periodoId: 1 });
actividadSchema.index({ gradoId: 1, materiaId: 1 });

module.exports = mongoose.model('Actividad', actividadSchema);
