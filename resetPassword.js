/**
 * scripts/resetPassword.js
 * Resetea la contraseña de cualquier usuario existente en la BD.
 *
 * Uso: node scripts/resetPassword.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const URI = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';

mongoose.connect(URI).then(() => console.log('MongoDB conectado')).catch(e => { console.error(e); process.exit(1); });

const esquema = new mongoose.Schema({
  nombre: String, apellido: String, correo: String,
  contrasena: String, rol: String, activo: Boolean,
}, { timestamps: true });

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', esquema);

async function main() {
  // ─── CAMBIA ESTOS VALORES ──────────────────────────
  const CORREO_OBJETIVO = 'admin@klassy.edu.co'; // el correo que tienes en tu BD
  const NUEVA_CONTRASENA = 'admin123';            // la nueva contraseña
  // ───────────────────────────────────────────────────

  const usuario = await Usuario.findOne({ correo: CORREO_OBJETIVO });

  if (!usuario) {
    console.log('ERROR: No se encontró el usuario con correo:', CORREO_OBJETIVO);
    console.log('\nUsuarios disponibles en la BD:');
    const todos = await Usuario.find({}).select('correo rol activo');
    todos.forEach(u => console.log('  -', u.correo, '|', u.rol, '| activo:', u.activo));
    await mongoose.connection.close();
    return;
  }

  const hash = await bcrypt.hash(NUEVA_CONTRASENA, 10);
  await Usuario.updateOne({ correo: CORREO_OBJETIVO }, { contrasena: hash, activo: true });

  console.log('Contrasena actualizada para:', CORREO_OBJETIVO);
  console.log('Nueva contrasena: ' + NUEVA_CONTRASENA);
  console.log('Verificando...');

  const actualizado = await Usuario.findOne({ correo: CORREO_OBJETIVO }).select('+contrasena');
  const ok = await bcrypt.compare(NUEVA_CONTRASENA, actualizado.contrasena);
  console.log('Verificacion bcrypt:', ok ? 'CORRECTA' : 'FALLO');

  await mongoose.connection.close();
}

main().catch(e => { console.error(e); process.exit(1); });
