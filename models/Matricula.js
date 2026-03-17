const mongoose = require('mongoose');

const matriculaSchema = new mongoose.Schema(
  {
    estudianteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El estudiante es obligatorio'],
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
    // Nivel académico que cursa con esta matrícula (1–11)
    nivelAcademico: {
      type:     Number,
      required: [true, 'El nivel académico es obligatorio'],
      min:      1,
      max:      11,
    },
    estado: {
      type:    String,
      enum:    ['activa', 'suspendida', 'inactiva'],
      default: 'activa',
    },
    tipo: {
      type:     String,
      enum:     ['nuevaMatricula', 'matriculaRenovada'],
      required: [true, 'El tipo de matrícula es obligatorio'],
    },
    observaciones: {
      type:    String,
      trim:    true,
      default: '',
    },
    fechaMatricula: {
      type:    Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Un estudiante solo puede tener una matrícula activa por año
matriculaSchema.index({ estudianteId: 1, año: 1 }, { unique: true });

module.exports = mongoose.model('Matricula', matriculaSchema);
