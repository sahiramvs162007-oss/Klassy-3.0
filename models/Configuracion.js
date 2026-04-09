const mongoose = require('mongoose');

/**
 * Configuracion
 * Almacena los datos institucionales del colegio.
 * Es un documento único (singleton): solo existirá un registro.
 * Se crea con valores vacíos al iniciar el sistema si no existe.
 */
const configuracionSchema = new mongoose.Schema(
  {
    nombreColegio: {
      type:    String,
      trim:    true,
      default: 'Mi Colegio',
    },
    vision: {
      type:    String,
      trim:    true,
      default: '',
    },
    mision: {
      type:    String,
      trim:    true,
      default: '',
    },
    // Ruta de la foto del colegio
    fotoInstitucion: {
      type:    String,
      default: null,
    },
    // Correo del director para recuperación de contraseñas
    correoDirector: {
      type:    String,
      trim:    true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Configuracion', configuracionSchema);
