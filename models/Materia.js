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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Materia', materiaSchema);
