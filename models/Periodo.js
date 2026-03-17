const mongoose = require('mongoose');

const periodoSchema = new mongoose.Schema(
  {
    nombre: {
      type:     String,
      required: [true, 'El nombre del periodo es obligatorio'],
      trim:     true,
      // Ej: "Primer Periodo", "Segundo Periodo"
    },
    numero: {
      type:     Number,
      required: [true, 'El número de periodo es obligatorio'],
      min:      1,
      max:      4,
    },
    año: {
      type:     Number,
      required: [true, 'El año es obligatorio'],
    },
    fechaInicio: {
      type:     Date,
      required: [true, 'La fecha de inicio es obligatoria'],
    },
    fechaFin: {
      type:     Date,
      required: [true, 'La fecha de fin es obligatoria'],
    },
    // activo = false significa que el periodo fue cerrado por el admin.
    // El cierre dispara cerrarPeriodo() que genera Boletin y ResultadoPeriodo.
    activo: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// No puede haber dos periodos con el mismo número en el mismo año
periodoSchema.index({ numero: 1, año: 1 }, { unique: true });

module.exports = mongoose.model('Periodo', periodoSchema);
