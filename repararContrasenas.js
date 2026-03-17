/**
 * repararContrasenas.js
 * Repara las contraseñas que quedaron doble-hasheadas por el seedUsuarios.js
 * Ejecutar: node repararContrasenas.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/klassy')
  .then(() => console.log('✅ MongoDB conectado\n'))
  .catch(err => { console.error('❌ Error:', err); process.exit(1); });

const usuarioSchema = new mongoose.Schema({
  nombre:    String,
  apellido:  String,
  correo:    String,
  contrasena:String,
  rol:       String,
  activo:    Boolean,
}, { timestamps: true });

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

// Contraseñas originales del seed por correo
const contrasenasPorRol = {
  admin:      'admin123',
  director:   'director123',
  docente:    'docente123',
  estudiante: 'estudiante123',
};

async function reparar() {
  try {
    const usuarios = await Usuario.find({});
    console.log(`📋 ${usuarios.length} usuario(s) encontrados\n`);

    let reparados = 0;
    let omitidos  = 0;

    for (const u of usuarios) {
      const contrasenaPlana = contrasenasPorRol[u.rol];
      if (!contrasenaPlana) { omitidos++; continue; }

      // Verificar si la contraseña actual funciona
      const funciona = await bcrypt.compare(contrasenaPlana, u.contrasena);

      if (funciona) {
        console.log(`✅ OK      [${u.rol.padEnd(10)}] ${u.correo}`);
        omitidos++;
      } else {
        // Reparar: hashear una sola vez y guardar directamente (sin disparar pre save)
        const nuevoHash = await bcrypt.hash(contrasenaPlana, 10);
        await Usuario.updateOne({ _id: u._id }, { contrasena: nuevoHash });
        console.log(`🔧 Reparado [${u.rol.padEnd(10)}] ${u.correo}`);
        reparados++;
      }
    }

    console.log(`\n📊 Resultado: ${reparados} reparados, ${omitidos} ya estaban bien.`);
    console.log('\n🔑 Credenciales:');
    console.log('   Admin:       admin@klassy.edu.co      / admin123');
    console.log('   Director:    director@klassy.edu.co   / director123');
    console.log('   Docentes:    [correo]                 / docente123');
    console.log('   Estudiantes: [correo]                 / estudiante123');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada.');
  }
}

reparar();
