const mongoose = require('mongoose');

const notaSchema = new mongoose.Schema(
  {
    estudianteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El estudiante es obligatorio'],
    },
    // Docente que registró / calificó
    docenteId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El docente registrador es obligatorio'],
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
    periodoId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Periodo',
      required: [true, 'El periodo es obligatorio'],
    },
    // Actividad origen de esta nota
    actividadId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Actividad',
      required: [true, 'La actividad es obligatoria'],
    },
    // Entrega específica que generó esta nota
    entregaActividadId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'EntregaActividad',
      required: [true, 'La entrega de actividad es obligatoria'],
    },
    año: {
      type:     Number,
      required: [true, 'El año es obligatorio'],
    },
    // Valor de la nota: 1.0 a 5.0
    valor: {
      type:     Number,
      required: [true, 'El valor de la nota es obligatorio'],
      min:      [1.0, 'La nota mínima es 1.0'],
      max:      [5.0, 'La nota máxima es 5.0'],
    },
    // Se vuelve false al cerrar el periodo (ya no se puede modificar)
    modificable: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para consultas frecuentes
notaSchema.index({ estudianteId: 1, periodoId: 1, materiaId: 1 });
notaSchema.index({ gradoId: 1, materiaId: 1, periodoId: 1 });
notaSchema.index({ actividadId: 1, estudianteId: 1 });

// Una EntregaActividad solo genera una Nota
notaSchema.index({ entregaActividadId: 1 }, { unique: true });

module.exports = mongoose.model('Nota', notaSchema);
