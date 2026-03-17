const mongoose = require('mongoose');

/**
 * Boletin
 * Documento INMUTABLE generado al cerrar un periodo (cerrarPeriodo).
 * Contiene TODOS los datos denormalizados (nombres incluidos, no solo IDs)
 * para que nunca dependa de otras colecciones al consultarlo.
 * Es la ÚNICA fuente de datos del módulo de boletines.
 */

// ─── Sub-esquema de nota individual dentro del boletín ────────────────────────
const notaBoletin = new mongoose.Schema(
  {
    actividadId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Actividad' },
    tituloActividad:{ type: String },
    valor:          { type: Number },
    fecha:          { type: Date },
  },
  { _id: false }
);

// ─── Sub-esquema de materia dentro del boletín ────────────────────────────────
const materiaBoletin = new mongoose.Schema(
  {
    materiaId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    nombreMateria: { type: String, required: true },
    notas:       [notaBoletin],
    promedio:    { type: Number, required: true },
    aprobado:    { type: Boolean, required: true },
    // Nombre del docente que dictó la materia (denormalizado)
    nombreDocente: { type: String },
  },
  { _id: false }
);

// ─── Esquema principal del Boletín ────────────────────────────────────────────
const boletinSchema = new mongoose.Schema(
  {
    // Referencias para búsquedas e índices
    estudianteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: true,
    },
    gradoId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Grado',
      required: true,
    },
    periodoId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Periodo',
      required: true,
    },
    año: {
      type:     Number,
      required: true,
    },

    // Datos denormalizados del estudiante
    nombreEstudiante:  { type: String, required: true },
    apellidoEstudiante:{ type: String, required: true },
    correoEstudiante:  { type: String },

    // Datos denormalizados del grado
    nombreGrado:  { type: String, required: true },
    nivelGrado:   { type: Number, required: true },

    // Datos denormalizados del periodo
    nombrePeriodo: { type: String, required: true },
    numeroPeriodo: { type: Number, required: true },

    // Materias con sus notas y promedios
    materias: [materiaBoletin],

    // Promedio general del periodo
    promedioGeneral: {
      type:     Number,
      required: true,
    },
    aprobadoGeneral: {
      type:     Boolean,
      required: true,
    },

    // Fecha exacta de generación del boletín
    generadoEn: {
      type:    Date,
      default: Date.now,
    },
  },
  {
    // timestamps desactivado intencionalmente: usamos generadoEn
    timestamps: false,
  }
);

// ─── Índices compuestos recomendados ──────────────────────────────────────────
boletinSchema.index({ gradoId: 1, periodoId: 1, año: 1 });
boletinSchema.index({ estudianteId: 1, año: 1 });
boletinSchema.index({ estudianteId: 1, periodoId: 1 });

// Un estudiante solo tiene un boletín por periodo
boletinSchema.index(
  { estudianteId: 1, periodoId: 1 },
  { unique: true }
);

module.exports = mongoose.model('Boletin', boletinSchema);
