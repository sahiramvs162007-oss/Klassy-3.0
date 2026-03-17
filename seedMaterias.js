/**
 * seedMaterias.js
 * Ejecutar desde la raíz del proyecto:
 *   node seedMaterias.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Materia  = require('./models/Materia'); // ajusta la ruta si es diferente

const materias = [
  { nombre: 'Matemáticas',          descripcion: 'Aritmética, álgebra, geometría y estadística.' },
  { nombre: 'Español',              descripcion: 'Lectura, escritura, gramática y literatura.' },
  { nombre: 'Ciencias Naturales',   descripcion: 'Biología, química y física básica.' },
  { nombre: 'Ciencias Sociales',    descripcion: 'Historia, geografía y educación cívica.' },
  { nombre: 'Inglés',               descripcion: 'Lengua extranjera: gramática, conversación y escritura.' },
  { nombre: 'Educación Física',     descripcion: 'Actividad física, deporte y salud.' },
  { nombre: 'Ética y Valores',      descripcion: 'Formación en valores, ciudadanía y convivencia.' },
  { nombre: 'Artística',            descripcion: 'Expresión plástica, música y artes escénicas.' },
  { nombre: 'Tecnología e Informática', descripcion: 'Uso de herramientas digitales y pensamiento computacional.' },
  { nombre: 'Religión',             descripcion: 'Educación religiosa y ética cristiana.' },
  { nombre: 'Física',               descripcion: 'Mecánica, termodinámica, electromagnetismo y óptica.' },
  { nombre: 'Química',              descripcion: 'Estructura de la materia, reacciones y laboratorio.' },
  { nombre: 'Biología',             descripcion: 'Célula, genética, ecología y fisiología humana.' },
  { nombre: 'Filosofía',            descripcion: 'Lógica, ética, epistemología e historia del pensamiento.' },
  { nombre: 'Economía y Política',  descripcion: 'Sistemas económicos, instituciones y participación ciudadana.' },
];

const ejecutar = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    let creadas = 0;
    let omitidas = 0;

    for (const datos of materias) {
      const existe = await Materia.findOne({ nombre: datos.nombre });
      if (existe) {
        console.log(`⚠️  Ya existe: ${datos.nombre}`);
        omitidas++;
      } else {
        await Materia.create(datos);
        console.log(`➕ Creada: ${datos.nombre}`);
        creadas++;
      }
    }

    console.log(`\n📊 Resultado: ${creadas} creadas, ${omitidas} omitidas.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

ejecutar();
