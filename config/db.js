const mongoose = require('mongoose');

const conectarBaseDeDatos = async () => {
  try {
    const conexion = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB conectado: ${conexion.connection.host}`);
  } catch (error) {
    console.error(`❌ Error al conectar MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = conectarBaseDeDatos;
