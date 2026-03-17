const mongoose = require('mongoose');

/**
 * ResultadoPeriodo
 * Se crea al ejecutar cerrarPeriodo(periodoId).
 * Registra el promedio de un estudiante en una materia para un periodo.
 * Documento de solo lectura una vez generado.
 */
const resultadoPeriodoSchema = new mongoose.Schema(
  {
    estudianteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: true,
    },
    materiaId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Materia',
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
    // Promedio calculado desde Nota al momento del cierre
    promedio: {
      type:     Number,
      required: true,
      min:      1.0,
      max:      5.0,
    },
    // Aprobado si promedio >= 3.0
    aprobado: {
      type:     Boolean,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Un par estudiante-materia solo puede tener un resultado por periodo
resultadoPeriodoSchema.index(
  { estudianteId: 1, materiaId: 1, periodoId: 1 },
  { unique: true }
);
resultadoPeriodoSchema.index({ gradoId: 1, periodoId: 1, año: 1 });

module.exports = mongoose.model('ResultadoPeriodo', resultadoPeriodoSchema);
