const mongoose = require('mongoose');

const asignacionDocenteSchema = new mongoose.Schema(
  {
    docenteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El docente es obligatorio'],
    },
    materiaId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Materia',
      required: [true, 'La materia es obligatoria'],
    },
    gradoId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Grado',
      required: [true, 'El grado es obligatorio'],
    },
    año: {
      type:     Number,
      required: [true, 'El año es obligatorio'],
    },
    estado: {
      type:    String,
      enum:    ['activo', 'inactivo'],
      default: 'activo',
    },
  },
  {
    timestamps: true,
  }
);

// Un docente no puede tener la misma materia+grado dos veces en el mismo año
asignacionDocenteSchema.index(
  { docenteId: 1, materiaId: 1, gradoId: 1, año: 1 },
  { unique: true }
);

module.exports = mongoose.model('AsignacionDocente', asignacionDocenteSchema);
