const mongoose = require('mongoose');

const gradoSchema = new mongoose.Schema(
  {
    nombre: {
      type:     String,
      required: [true, 'El nombre del grado es obligatorio'],
      trim:     true,
    },
    nivel: {
      type:     Number,
      required: [true, 'El nivel es obligatorio'],
      min:      [1,  'El nivel mínimo es 1'],
      max:      [11, 'El nivel máximo es 11'],
    },
    año: {
      type:     Number,
      required: [true, 'El año es obligatorio'],
    },
    // Cupo máximo de estudiantes (0 = sin límite)
    cupo: {
      type:    Number,
      default: 0,
      min:     0,
    },
    // Materias asignadas a este grado
    materias: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Materia',
      },
    ],
    activo: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto: no puede haber dos grados con mismo nombre y año
gradoSchema.index({ nombre: 1, año: 1 }, { unique: true });

module.exports = mongoose.model('Grado', gradoSchema);
