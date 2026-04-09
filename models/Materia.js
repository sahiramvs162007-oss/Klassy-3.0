const mongoose = require('mongoose');

const materiaSchema = new mongoose.Schema(
  {
    nombre: {
      type:     String,
      required: [true, 'El nombre de la materia es obligatorio'],
      trim:     true,
    },
    descripcion: {
      type:    String,
      trim:    true,
      default: '',
    },
    activo: {
      type:    Boolean,
      default: true,
    },
    // Color asignado automáticamente al crear la materia
    // Valores: 'azul' | 'verde' | 'morado' | 'naranja' | 'rojo'
    color: {
      type:    String,
      enum:    ['azul', 'verde', 'morado', 'naranja', 'rojo'],
      default: 'azul',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Materia', materiaSchema);