const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type:     String,
      required: [true, 'El nombre es obligatorio'],
      trim:     true,
    },
    apellido: {
      type:     String,
      required: [true, 'El apellido es obligatorio'],
      trim:     true,
    },
    correo: {
      type:      String,
      required:  [true, 'El correo es obligatorio'],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    contrasena: {
      type:     String,
      required: [true, 'La contraseña es obligatoria'],
      select:   false,
    },
    rol: {
      type:     String,
      enum:     ['admin', 'director', 'docente', 'estudiante'],
      required: [true, 'El rol es obligatorio'],
    },
    documentoIdentidad: {
      type:    String,
      trim:    true,
      default: null,
    },
    ultimoNivelCursado: {
      type:    Number,
      min:     0,
      max:     11,
      default: null,
    },
    profesion: {
      type:    String,
      trim:    true,
      default: null,
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

// FIX 2: Índices en rol y activo.
// El dashboard del admin ejecuta countDocuments({ rol: 'X', activo: true })
// en cada carga. Sin estos índices MongoDB hacía full collection scan sobre
// todos los usuarios cada vez. Con los índices la consulta es O(log n).
usuarioSchema.index({ rol: 1 });
usuarioSchema.index({ activo: 1 });
usuarioSchema.index({ rol: 1, activo: 1 }); // índice compuesto para la consulta exacta del dashboard

// ─── Hash de contraseña antes de guardar ──────────────────────────────────────
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('contrasena')) return next();
  this.contrasena = await bcrypt.hash(this.contrasena, 10);
  next();
});

// ─── Método para comparar contraseña ─────────────────────────────────────────
usuarioSchema.methods.compararContrasena = async function (contrasenaIngresada) {
  return bcrypt.compare(contrasenaIngresada, this.contrasena);
};

// ─── Nombre completo virtual ──────────────────────────────────────────────────
usuarioSchema.virtual('nombreCompleto').get(function () {
  return `${this.nombre} ${this.apellido}`;
});

module.exports = mongoose.model('Usuario', usuarioSchema);
