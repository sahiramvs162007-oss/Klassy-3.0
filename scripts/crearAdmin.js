/**
 * scripts/crearAdmin.js
 * Crear o reparar el usuario administrador.
 * 
 * Uso: node scripts/crearAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const URI = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';

mongoose.connect(URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => { console.error(err); process.exit(1); });

const esquema = new mongoose.Schema({
  nombre:             String,
  apellido:           String,
  correo:             { type: String, unique: true },
  contrasena:         String,
  rol:                String,
  activo:             { type: Boolean, default: true },
  ultimoNivelCursado: { type: Number, default: 11 },
  profesion:          { type: String, default: null },
}, { timestamps: true });

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', esquema);

async function main() {
  const CORREO     = 'admin@gmail.com';  // cambia si quieres
  const CONTRASENA = '123456';         // cambia si quieres

  const hash = await bcrypt.hash(CONTRASENA, 10);

  const existe = await Usuario.findOne({ correo: CORREO });

  if (existe) {
    await Usuario.updateOne({ correo: CORREO }, {
      contrasena: hash,
      rol: 'admin',
      activo: true,
    });
    console.log('Admin ACTUALIZADO.');
  } else {
    await Usuario.create({
      nombre: 'Administrador',
      apellido: 'KLASSY',
      correo: CORREO,
      contrasena: hash,
      rol: 'admin',
      activo: true,
      ultimoNivelCursado: 11,
      profesion: 'Administrador del sistema',
    });
    console.log('Admin CREADO.');
  }

  console.log('\nCredenciales:');
  console.log('  Correo:     ' + CORREO);
  console.log('  Contrasena: ' + CONTRASENA);

  const todos = await Usuario.find({}).select('nombre apellido correo rol activo');
  console.log('\nUsuarios en la base de datos:');
  todos.forEach(u => {
    console.log('  [' + u.rol + '] ' + u.nombre + ' ' + u.apellido + ' - ' + u.correo + ' - activo: ' + u.activo);
  });

  await mongoose.connection.close();
}

main().catch(e => { console.error(e); process.exit(1); });
