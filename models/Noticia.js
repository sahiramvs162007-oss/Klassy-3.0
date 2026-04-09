const mongoose = require('mongoose');

const noticiaSchema = new mongoose.Schema(
  {
    titulo: {
      type:     String,
      required: [true, 'El título es obligatorio'],
      trim:     true,
    },
    contenido: {
      type:     String,
      required: [true, 'El contenido es obligatorio'],
      trim:     true,
    },
    imagen: {
      type:    String,
      default: null,
    },
    autorId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Usuario',
      required: [true, 'El autor es obligatorio'],
    },
    fechaPublicacion: {
      type:    Date,
      default: Date.now,
    },
    activo: {
      type:    Boolean,
      default: true,
    },
    etiqueta: {
      type: String,
      default: 'Anuncios',
      enum: [
        'Anuncios', 'Eventos', 'Académico', 'Institucional',
        'Urgente', 'Clases', 'Proyectos', 'Deportes',
        'Cultura', 'Arte y Música', 'Bienestar', 'Logros'
      ],
    },
  },
  { timestamps: true }
);

noticiaSchema.index({ fechaPublicacion: -1 });

module.exports = mongoose.model('Noticia', noticiaSchema);
