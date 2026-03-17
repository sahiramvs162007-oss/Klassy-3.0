/**
 * seedGrados.js
 * Ejecutar desde la raíz del proyecto:
 *   node seedGrados.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Grado    = require('./models/Grado'); // ajusta si la ruta es diferente

// ─── IDs reales de tu base de datos ──────────────────────────────────────────
const M = {
  catedra:    '69b78f74de9d07da32f39530', // Cátedra De Paz
  mates:      '69b790014b315960b78f764c', // Matemáticas
  español:    '69b790014b315960b78f764f', // Español
  naturales:  '69b790014b315960b78f7652', // Ciencias Naturales
  sociales:   '69b790014b315960b78f7655', // Ciencias Sociales
  ingles:     '69b790014b315960b78f7658', // Inglés
  edFisica:   '69b790014b315960b78f765b', // Educación Física
  etica:      '69b790014b315960b78f765e', // Ética y Valores
  artistica:  '69b790014b315960b78f7661', // Artística
  tecnologia: '69b790014b315960b78f7664', // Tecnología e Informática
  religion:   '69b790014b315960b78f7667', // Religión
  fisica:     '69b790014b315960b78f766a', // Física
  quimica:    '69b790014b315960b78f766d', // Química
  biologia:   '69b790014b315960b78f7670', // Biología
  filosofia:  '69b790014b315960b78f7673', // Filosofía
  economia:   '69b790014b315960b78f7676', // Economía y Política
};

// ─── Materias por etapa ───────────────────────────────────────────────────────

// Primaria (1–5): materias básicas
const primaria = [
  M.mates, M.español, M.naturales, M.sociales, M.ingles,
  M.edFisica, M.etica, M.artistica, M.tecnologia, M.religion, M.catedra
];

// Secundaria (6–9): primaria + algunas separaciones
const secundaria = [
  M.mates, M.español, M.naturales, M.sociales, M.ingles,
  M.edFisica, M.etica, M.artistica, M.tecnologia, M.religion,
  M.catedra, M.biologia, M.quimica
];

// Media (10–11): todas las avanzadas
const media = [
  M.mates, M.español, M.sociales, M.ingles,
  M.edFisica, M.etica, M.tecnologia, M.religion,
  M.catedra, M.fisica, M.quimica, M.biologia, M.filosofia, M.economia
];

const AÑO = 2026;

// ─── Definición de grados ─────────────────────────────────────────────────────
const grados = [
  // Primaria
  { nombre: 'Primero A',   nivel: 1,  año: AÑO, materias: primaria },
  { nombre: 'Primero B',   nivel: 1,  año: AÑO, materias: primaria },
  { nombre: 'Segundo A',   nivel: 2,  año: AÑO, materias: primaria },
  { nombre: 'Segundo B',   nivel: 2,  año: AÑO, materias: primaria },
  { nombre: 'Tercero A',   nivel: 3,  año: AÑO, materias: primaria },
  { nombre: 'Cuarto A',    nivel: 4,  año: AÑO, materias: primaria },
  { nombre: 'Quinto A',    nivel: 5,  año: AÑO, materias: primaria },
  // Secundaria
  { nombre: 'Sexto A',     nivel: 6,  año: AÑO, materias: secundaria },
  { nombre: 'Séptimo A',   nivel: 7,  año: AÑO, materias: secundaria },
  { nombre: 'Octavo A',    nivel: 8,  año: AÑO, materias: secundaria },
  { nombre: 'Noveno A',    nivel: 9,  año: AÑO, materias: secundaria },
  // Media
  { nombre: 'Décimo A',    nivel: 10, año: AÑO, materias: media },
  { nombre: 'Undécimo A',  nivel: 11, año: AÑO, materias: media },
];

// ─── Ejecutar ─────────────────────────────────────────────────────────────────
const ejecutar = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB\n');

    let creados  = 0;
    let omitidos = 0;

    for (const datos of grados) {
      const existe = await Grado.findOne({ nombre: datos.nombre, año: datos.año });
      if (existe) {
        console.log(`⚠️  Ya existe: ${datos.nombre} (${datos.año})`);
        omitidos++;
        continue;
      }

      await Grado.create(datos);
      console.log(`➕ Creado: ${datos.nombre} — Nivel ${datos.nivel} — ${datos.materias.length} materias`);
      creados++;
    }

    console.log(`\n📊 Resultado: ${creados} creados, ${omitidos} omitidos.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

ejecutar();
