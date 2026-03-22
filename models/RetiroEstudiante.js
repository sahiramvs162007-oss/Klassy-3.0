const mongoose = require('mongoose');

/**
 * RetiroEstudiante
 * Registra cada vez que un estudiante es retirado del colegio.
 * El estudiante pasa a activo=false pero no se elimina,
 * para que pueda ser reactivado si regresa.
 */
const retiroEstudianteSchema = new mongoose.Schema(
  {
    estudianteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Usuario',
      required: true,
    },
    // Se guarda el nombre para tener historial aunque el usuario se elimine
    nombreEstudiante: {
      type:     String,
      required: true,
      trim:     true,
    },
    documento: {
      type:    String,
      trim:    true,
      default: '',
    },
    ultimoGrado: {
      type:    String,
      trim:    true,
      default: 'Sin grado registrado',
    },
    motivo: {
      type:    String,
      trim:    true,
      default: '',
    },
    fechaRetiro: {
      type:    Date,
      default: Date.now,
    },
    // Si el estudiante regresó
    reincorporado: {
      type:    Boolean,
      default: false,
    },
    fechaReincorporacion: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('RetiroEstudiante', retiroEstudianteSchema);
