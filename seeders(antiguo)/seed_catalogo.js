/**
 * seed_catalogo.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Inserta el catálogo base de KLASSY para los años 2022, 2023 y 2024.
 * Colecciones afectadas: Materia, Periodo, Grado, AsignacionDocente
 *
 * REQUISITO: los 22 docentes deben estar importados en MongoDB desde el Excel.
 * IDEMPOTENTE: usa upsert, se puede correr más de una vez sin duplicar datos.
 *
 * Uso:
 *   node seeders/seed_catalogo.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const {
  Materia,
  Periodo,
  Grado,
  AsignacionDocente,
  Usuario,
} = require('../models');

// ── Configuración ─────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const AÑOS      = [2022, 2023, 2024];

// ── Catálogo de materias ──────────────────────────────────────────────────────
const MATERIAS_DEF = [
  { nombre: 'Matemáticas',       descripcion: 'Aritmética, álgebra, geometría y pensamiento lógico-matemático.' },
  { nombre: 'Español',           descripcion: 'Lectura, escritura, gramática y comunicación en lengua castellana.' },
  { nombre: 'Ciencias Naturales',descripcion: 'Biología, química y física adaptadas al nivel escolar.' },
  { nombre: 'Ciencias Sociales', descripcion: 'Historia, geografía, democracia y convivencia ciudadana.' },
  { nombre: 'Inglés',            descripcion: 'Comprensión y producción oral y escrita en inglés.' },
  { nombre: 'Educación Física',  descripcion: 'Desarrollo motor, deportes, salud y vida activa.' },
  { nombre: 'Arte',              descripcion: 'Expresión plástica, dibujo, pintura y apreciación artística.' },
  { nombre: 'Música',            descripcion: 'Teoría musical, apreciación y práctica instrumental básica.' },
  { nombre: 'Tecnología',        descripcion: 'Informática, pensamiento computacional y herramientas digitales.' },
  { nombre: 'Ética',             descripcion: 'Valores, filosofía moral y formación del carácter.' },
  { nombre: 'Religión',          descripcion: 'Educación religiosa y ética de las creencias.' },
];

// ── Periodos por año (fechas reales) ──────────────────────────────────────────
const PERIODOS_DEF = {
  2022: [
    { numero: 1, nombre: 'Primer Periodo',   fechaInicio: '2022-01-31', fechaFin: '2022-03-25' },
    { numero: 2, nombre: 'Segundo Periodo',  fechaInicio: '2022-04-04', fechaFin: '2022-06-10' },
    { numero: 3, nombre: 'Tercer Periodo',   fechaInicio: '2022-06-27', fechaFin: '2022-09-09' },
    { numero: 4, nombre: 'Cuarto Periodo',   fechaInicio: '2022-09-19', fechaFin: '2022-11-25' },
  ],
  2023: [
    { numero: 1, nombre: 'Primer Periodo',   fechaInicio: '2023-01-30', fechaFin: '2023-03-24' },
    { numero: 2, nombre: 'Segundo Periodo',  fechaInicio: '2023-04-03', fechaFin: '2023-06-09' },
    { numero: 3, nombre: 'Tercer Periodo',   fechaInicio: '2023-06-26', fechaFin: '2023-09-08' },
    { numero: 4, nombre: 'Cuarto Periodo',   fechaInicio: '2023-09-18', fechaFin: '2023-11-24' },
  ],
  2024: [
    { numero: 1, nombre: 'Primer Periodo',   fechaInicio: '2024-01-29', fechaFin: '2024-03-22' },
    { numero: 2, nombre: 'Segundo Periodo',  fechaInicio: '2024-04-02', fechaFin: '2024-06-07' },
    { numero: 3, nombre: 'Tercer Periodo',   fechaInicio: '2024-06-24', fechaFin: '2024-09-06' },
    { numero: 4, nombre: 'Cuarto Periodo',   fechaInicio: '2024-09-16', fechaFin: '2024-11-22' },
  ],
};

// ── Niveles y grupos ──────────────────────────────────────────────────────────
const NIVELES = [1,2,3,4,5,6,7,8,9,10,11];
const GRUPOS  = ['A','B'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const sep  = (title) => console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`);

// ── Paso 1: Materias ──────────────────────────────────────────────────────────
async function seedMaterias() {
  sep('MATERIAS');
  const materiaIds = {};

  for (const def of MATERIAS_DEF) {
    const doc = await Materia.findOneAndUpdate(
      { nombre: def.nombre },
      { $set: { descripcion: def.descripcion, activo: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    materiaIds[def.nombre] = doc._id;
    log(`Materia: ${def.nombre}`);
  }

  log(`Total materias: ${Object.keys(materiaIds).length}`);
  return materiaIds;
}

// ── Paso 2: Periodos ──────────────────────────────────────────────────────────
async function seedPeriodos() {
  sep('PERIODOS');
  // periodoIds[año][numero] = ObjectId
  const periodoIds = {};

  for (const año of AÑOS) {
    periodoIds[año] = {};
    for (const p of PERIODOS_DEF[año]) {
      const doc = await Periodo.findOneAndUpdate(
        { numero: p.numero, año },
        {
          $set: {
            nombre:      p.nombre,
            fechaInicio: new Date(p.fechaInicio),
            fechaFin:    new Date(p.fechaFin),
            // Todos los periodos históricos (2022-2023) quedan cerrados.
            // 2024 período 4 queda activo para poder simular el cierre.
            activo: año === 2024 && p.numero === 4,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      periodoIds[año][p.numero] = doc._id;
      log(`Periodo ${año} #${p.numero}: ${p.nombre} (${p.fechaInicio} → ${p.fechaFin})`);
    }
  }

  return periodoIds;
}

// ── Paso 3: Grados ────────────────────────────────────────────────────────────
async function seedGrados(materiaIds) {
  sep('GRADOS');
  // gradoIds[año][nivel][grupo] = ObjectId
  const gradoIds = {};
  const todasMaterias = Object.values(materiaIds);

  for (const año of AÑOS) {
    gradoIds[año] = {};
    for (const nivel of NIVELES) {
      gradoIds[año][nivel] = {};
      for (const grupo of GRUPOS) {
        const nombre = `${nivel}°${grupo}`;
        const doc = await Grado.findOneAndUpdate(
          { nombre, año },
          {
            $set: {
              nivel,
              cupo:     20,
              materias: todasMaterias,
              activo:   true,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        gradoIds[año][nivel][grupo] = doc._id;
      }
    }
    log(`Grados ${año}: ${NIVELES.length * GRUPOS.length} grados creados (1°A–11°B)`);
  }

  return gradoIds;
}

// ── Paso 4: Docentes — leer del Excel/BD ─────────────────────────────────────
/**
 * Los docentes se leen desde la BD en el MISMO orden en que fueron importados
 * del Excel: primero los 2 docentes de Matemáticas, luego los 2 de Español, etc.
 * El Excel los generó en ese orden, así que simplemente los traemos ordenados
 * por createdAt y los emparejamos 1:1 con MATERIAS_DEF.
 */
async function cargarDocentes() {
  sep('CARGA DE DOCENTES');
  const docentes = await Usuario.find({ rol: 'docente', activo: true })
    .sort({ createdAt: 1 })
    .select('_id nombre apellido profesion')
    .lean();

  if (docentes.length < 22) {
    warn(`Solo se encontraron ${docentes.length} docentes. Se esperaban 22.`);
    warn('Importa el Excel primero y vuelve a correr este script.');
  } else {
    log(`Docentes cargados: ${docentes.length}`);
  }

  // Mapeo: materiaIndex → [docenteId_1, docenteId_2]
  // Docente 0,1 → Matemáticas | 2,3 → Español | etc.
  const docentesPorMateria = {};
  for (let i = 0; i < MATERIAS_DEF.length; i++) {
    const nombre = MATERIAS_DEF[i].nombre;
    docentesPorMateria[nombre] = [
      docentes[i * 2]     ? docentes[i * 2]._id     : null,
      docentes[i * 2 + 1] ? docentes[i * 2 + 1]._id : null,
    ].filter(Boolean);
  }

  return docentesPorMateria;
}

// ── Paso 5: AsignacionDocente ─────────────────────────────────────────────────
/**
 * Distribución: cada materia tiene 2 docentes.
 * Por año hay 22 grados (11 niveles × 2 grupos).
 * Docente 1 de la materia → cubre los grupos A de todos los niveles (11 grados)
 * Docente 2 de la materia → cubre los grupos B de todos los niveles (11 grados)
 * Total por año: 11 materias × 2 docentes × 11 niveles = 242 asignaciones
 * Total 3 años: 726 asignaciones
 */
async function seedAsignaciones(materiaIds, gradoIds, docentesPorMateria) {
  sep('ASIGNACIONES DOCENTE');
  let total = 0;
  let omitidos = 0;

  for (const año of AÑOS) {
    let porAño = 0;
    for (const [nombreMateria, materiaId] of Object.entries(materiaIds)) {
      const docentes = docentesPorMateria[nombreMateria] || [];

      if (docentes.length === 0) {
        warn(`Sin docentes para ${nombreMateria} — omitiendo asignaciones`);
        omitidos++;
        continue;
      }

      for (const nivel of NIVELES) {
        for (let gi = 0; gi < GRUPOS.length; gi++) {
          const grupo     = GRUPOS[gi];
          // Docente 0 → grupo A, Docente 1 → grupo B (fallback al 0 si solo hay 1)
          const docenteId = docentes[gi] ?? docentes[0];
          const gradoId   = gradoIds[año][nivel][grupo];

          await AsignacionDocente.findOneAndUpdate(
            { docenteId, materiaId, gradoId, año },
            { $set: { estado: 'activo' } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          porAño++;
        }
      }
    }
    total += porAño;
    log(`AsignacionDocente ${año}: ${porAño} asignaciones`);
  }

  if (omitidos > 0) warn(`${omitidos} materias sin docente — revisa la importación del Excel`);
  log(`Total asignaciones: ${total}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║         KLASSY — seed_catalogo.js                   ║');
  console.log('║  Materias · Periodos · Grados · AsignacionDocente   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nConectando a: ${MONGO_URI}`);

  await mongoose.connect(MONGO_URI);
  console.log('Conexión establecida.\n');

  const materiaIds        = await seedMaterias();
  const periodoIds        = await seedPeriodos();       // eslint-disable-line no-unused-vars
  const gradoIds          = await seedGrados(materiaIds);
  const docentesPorMateria= await cargarDocentes();
  await seedAsignaciones(materiaIds, gradoIds, docentesPorMateria);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  seed_catalogo.js completado sin errores             ║');
  console.log('║  Siguiente paso: node seeders/seed_matriculas.js     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_catalogo.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
