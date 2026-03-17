const mongoose = require('mongoose');

/**
 * ResultadoAnual
 * Se crea al ejecutar cerrarAño(año).
 * Si un estudiante reprobó una materia en TODOS los periodos del año,
 * aprobado = false → la siguiente matrícula no sube de nivel.
 */
const resultadoAnualSchema = new mongoose.Schema(
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
    año: {
      type:     Number,
      required: true,
    },
    // false si reprobó la materia en todos los periodos del año
    aprobado: {
      type:     Boolean,
      required: true,
    },
    // Promedio final del año en esta materia
    promedioAnual: {
      type:  Number,
      min:   1.0,
      max:   5.0,
    },
  },
  {
    timestamps: true,
  }
);

// Un par estudiante-materia solo puede tener un resultado anual por año
resultadoAnualSchema.index(
  { estudianteId: 1, materiaId: 1, año: 1 },
  { unique: true }
);

module.exports = mongoose.model('ResultadoAnual', resultadoAnualSchema);
