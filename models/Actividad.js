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

// [NUEVO Claude] Sub-esquema de excepción individual por estudiante
const excepcionSchema = new mongoose.Schema(
  {
    estudianteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: true,
    },
    fechaLimitePersonalizada: {
      type:     Date,
      required: true,
    },
    concedidaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Usuario',
    },
    concedidaEn: {
      type:    Date,
      default: Date.now,
    },
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

    // [NUEVO Claude] Publicación diferida: null = publicar inmediatamente
    fechaInicio: {
      type:    Date,
      default: null,
    },

    // Fecha y hora límite para recibir entregas
    fechaLimite: {
      type:     Date,
      required: [true, 'La fecha límite es obligatoria'],
    },

    // [NUEVO Claude] Opciones de entrega
    // false → el estudiante solo puede entregar UNA vez
    permitirMultiplesEntregas: {
      type:    Boolean,
      default: true,
    },
    // true → el estudiante puede entregar aunque haya pasado fechaLimite
    permitirEntregaTardia: {
      type:    Boolean,
      default: false,
    },

    // [NUEVO Claude] Excepciones individuales por estudiante
    excepciones: {
      type:    [excepcionSchema],
      default: [],
    },

    // Archivos adjuntos del docente a la actividad
    archivos: [archivoSchema],

    // Estado: abierta = recibe entregas, cerrada = bloqueada manualmente
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

// Índices para consultas frecuentes
actividadSchema.index({ docenteId: 1, gradoId: 1, materiaId: 1, periodoId: 1 });
actividadSchema.index({ gradoId: 1, materiaId: 1 });
actividadSchema.index({ docenteId: 1 });

// [NUEVO Claude] Virtual: indica si la actividad es visible para los estudiantes
actividadSchema.virtual('publicada').get(function () {
  const ahora   = new Date();
  const inicioOk = !this.fechaInicio || this.fechaInicio <= ahora;
  return inicioOk && this.estado === 'abierta';
});

module.exports = mongoose.model('Actividad', actividadSchema);