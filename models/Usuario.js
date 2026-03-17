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
      select:   false, // no se devuelve en consultas por defecto
    },
    rol: {
      type:     String,
      enum:     ['admin', 'director', 'docente', 'estudiante'],
      required: [true, 'El rol es obligatorio'],
    },

    // ── Solo para estudiantes ─────────────────────────────────────────────
    ultimoNivelCursado: {
      type:    Number,
      min:     0,   // 0 = nunca ha cursado ningún grado
      max:     11,
      default: null,
    },

    // ── Solo para docentes ────────────────────────────────────────────────
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
    timestamps: true, // createdAt y updatedAt automáticos
  }
);

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
