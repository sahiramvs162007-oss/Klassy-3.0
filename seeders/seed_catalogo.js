/**
 * seeders/seed_catalogo.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FASE 1 — Estructura base del sistema KLASSY.
 * Cubre los 3 años académicos: 2024, 2025, 2026.
 *
 * Inserta:
 *   • 11 Materias         (sin año, catálogo permanente)
 *   • 12 Periodos         (4 por año × 3 años)
 *   • 66 Grados           (22 por año × 3 años: 1°A–11°B)
 *   • 726 AsignacionDocente (11 materias × 2 docentes × 11 niveles × 3 años)
 *
 * REQUISITOS PREVIOS:
 *   El Excel debe estar importado en MongoDB (22 docentes presentes).
 *
 * IDEMPOTENTE: usa upsert — se puede correr más de una vez sin duplicar.
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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';

// ── Constantes ────────────────────────────────────────────────────────────────
const AÑOS   = [2024, 2025, 2026];
const NIVELES= [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const GRUPOS = ['A', 'B'];

// ── Catálogo de materias ──────────────────────────────────────────────────────
const MATERIAS_DEF = [
  { nombre: 'Matemáticas',        descripcion: 'Aritmética, álgebra, geometría y pensamiento lógico-matemático.' },
  { nombre: 'Lengua Castellana',  descripcion: 'Lectura, escritura, gramática y comunicación oral y escrita.' },
  { nombre: 'Ciencias Naturales', descripcion: 'Biología, química y física adaptadas al nivel escolar.' },
  { nombre: 'Ciencias Sociales',  descripcion: 'Historia, geografía, democracia y convivencia ciudadana.' },
  { nombre: 'Inglés',             descripcion: 'Comprensión y producción oral y escrita en idioma inglés.' },
  { nombre: 'Educación Física',   descripcion: 'Desarrollo motor, deportes, salud y hábitos de vida activa.' },
  { nombre: 'Arte',               descripcion: 'Expresión plástica, dibujo, pintura y apreciación artística.' },
  { nombre: 'Música',             descripcion: 'Teoría musical, apreciación y práctica instrumental básica.' },
  { nombre: 'Tecnología',         descripcion: 'Informática, pensamiento computacional y herramientas digitales.' },
  { nombre: 'Ética y Valores',    descripcion: 'Formación del carácter, valores y filosofía moral aplicada.' },
  { nombre: 'Religión',           descripcion: 'Educación religiosa y ética de las creencias.' },
];

// ── Periodos por año ──────────────────────────────────────────────────────────
// 2026 solo tiene P1 (año en curso) — los demás quedan con fechas futuras
// y activo:false para que el seeder no los procese.
const PERIODOS_DEF = {
  2024: [
    { numero: 1, nombre: 'Primer Periodo',  fechaInicio: '2024-01-29', fechaFin: '2024-03-22', activo: false },
    { numero: 2, nombre: 'Segundo Periodo', fechaInicio: '2024-04-01', fechaFin: '2024-06-07', activo: false },
    { numero: 3, nombre: 'Tercer Periodo',  fechaInicio: '2024-06-24', fechaFin: '2024-09-06', activo: false },
    { numero: 4, nombre: 'Cuarto Periodo',  fechaInicio: '2024-09-16', fechaFin: '2024-11-22', activo: false },
  ],
  2025: [
    { numero: 1, nombre: 'Primer Periodo',  fechaInicio: '2025-01-27', fechaFin: '2025-03-21', activo: false },
    { numero: 2, nombre: 'Segundo Periodo', fechaInicio: '2025-03-31', fechaFin: '2025-06-06', activo: false },
    { numero: 3, nombre: 'Tercer Periodo',  fechaInicio: '2025-06-23', fechaFin: '2025-09-05', activo: false },
    { numero: 4, nombre: 'Cuarto Periodo',  fechaInicio: '2025-09-15', fechaFin: '2025-11-21', activo: false },
  ],
  2026: [
    { numero: 1, nombre: 'Primer Periodo',  fechaInicio: '2026-01-26', fechaFin: '2026-03-20', activo: true  }, // único activo
    { numero: 2, nombre: 'Segundo Periodo', fechaInicio: '2026-03-30', fechaFin: '2026-06-05', activo: false },
    { numero: 3, nombre: 'Tercer Periodo',  fechaInicio: '2026-06-22', fechaFin: '2026-09-04', activo: false },
    { numero: 4, nombre: 'Cuarto Periodo',  fechaInicio: '2026-09-14', fechaFin: '2026-11-20', activo: false },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠  ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(2, 52 - t.length))}`);

// ── PASO 1: Materias ──────────────────────────────────────────────────────────
async function seedMaterias() {
  sep('MATERIAS');
  const ids = {}; // nombre → ObjectId

  for (const def of MATERIAS_DEF) {
    const doc = await Materia.findOneAndUpdate(
      { nombre: def.nombre },
      { $set: { descripcion: def.descripcion, activo: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ids[def.nombre] = doc._id;
    log(def.nombre);
  }

  log(`Total: ${Object.keys(ids).length} materias`);
  return ids; // { 'Matemáticas': ObjectId, ... }
}

// ── PASO 2: Periodos ──────────────────────────────────────────────────────────
async function seedPeriodos() {
  sep('PERIODOS');
  // ids[año][numero] = ObjectId
  const ids = {};

  for (const año of AÑOS) {
    ids[año] = {};
    for (const p of PERIODOS_DEF[año]) {
      const doc = await Periodo.findOneAndUpdate(
        { numero: p.numero, año },
        {
          $set: {
            nombre:      p.nombre,
            fechaInicio: new Date(p.fechaInicio),
            fechaFin:    new Date(p.fechaFin),
            activo:      p.activo,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      ids[año][p.numero] = doc._id;
      log(`${año} P${p.numero}: ${p.nombre} — ${p.fechaInicio} → ${p.fechaFin} [activo: ${p.activo}]`);
    }
  }

  return ids;
}

// ── PASO 3: Grados ────────────────────────────────────────────────────────────
async function seedGrados(materiaIds) {
  sep('GRADOS');
  // ids[año][nivel][grupo] = ObjectId
  const ids        = {};
  const todasMats  = Object.values(materiaIds);
  let   totalCreados = 0;

  for (const año of AÑOS) {
    ids[año] = {};
    for (const nivel of NIVELES) {
      ids[año][nivel] = {};
      for (const grupo of GRUPOS) {
        const nombre = `${nivel}°${grupo}`;
        const doc = await Grado.findOneAndUpdate(
          { nombre, año },
          {
            $set: {
              nivel,
              cupo:     20,
              materias: todasMats,
              activo:   true,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        ids[año][nivel][grupo] = doc._id;
        totalCreados++;
      }
    }
    log(`${año}: 22 grados (1°A–11°B)`);
  }

  log(`Total: ${totalCreados} grados`);
  return ids;
}

// ── PASO 4: Cargar docentes desde BD ─────────────────────────────────────────
/**
 * Lee los docentes ordenados por createdAt — mismo orden que el Excel
 * (primero los 2 de Matemáticas, luego los 2 de Lengua, etc.).
 * Devuelve: { 'Matemáticas': [id1, id2], 'Lengua Castellana': [id3, id4], ... }
 */
async function cargarDocentes() {
  sep('DOCENTES');
  const docentes = await Usuario.find({ rol: 'docente', activo: true })
    .sort({ createdAt: 1 })
    .select('_id nombre apellido')
    .lean();

  if (docentes.length < 22) {
    warn(`Solo ${docentes.length} docentes en BD. Se esperan 22.`);
    warn('Importa el Excel primero y vuelve a correr este script.');
    if (docentes.length === 0) {
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    log(`${docentes.length} docentes encontrados`);
  }

  // Emparejar: índices 0-1 → Matemáticas, 2-3 → Lengua, etc.
  const map = {};
  for (let i = 0; i < MATERIAS_DEF.length; i++) {
    const nombre = MATERIAS_DEF[i].nombre;
    map[nombre]  = [
      docentes[i * 2]?.     _id ?? null,
      docentes[i * 2 + 1]?. _id ?? null,
    ].filter(Boolean);

    const d1 = docentes[i * 2];
    const d2 = docentes[i * 2 + 1];
    log(`${nombre}: ${d1 ? d1.nombre + ' ' + d1.apellido : '—'} | ${d2 ? d2.nombre + ' ' + d2.apellido : '—'}`);
  }

  return map;
}

// ── PASO 5: AsignacionDocente ─────────────────────────────────────────────────
/**
 * Distribución por grupos:
 *   Docente[0] de la materia → todos los grupos A (niveles 1–11)
 *   Docente[1] de la materia → todos los grupos B (niveles 1–11)
 *
 * Por año: 11 materias × 2 docentes × 11 niveles = 242 asignaciones
 * Total 3 años: 726 asignaciones
 */
async function seedAsignaciones(materiaIds, gradoIds, docentesMap) {
  sep('ASIGNACIONES DOCENTE');
  let total    = 0;
  let errores  = 0;

  for (const año of AÑOS) {
    let porAño = 0;

    for (const [nombreMat, materiaId] of Object.entries(materiaIds)) {
      const docentes = docentesMap[nombreMat] || [];

      if (docentes.length === 0) {
        warn(`Sin docentes para "${nombreMat}" en ${año} — omitiendo`);
        errores++;
        continue;
      }

      for (const nivel of NIVELES) {
        for (let gi = 0; gi < GRUPOS.length; gi++) {
          const grupo     = GRUPOS[gi];
          // Fallback: si solo hay 1 docente cubre ambos grupos
          const docenteId = docentes[gi] ?? docentes[0];
          const gradoId   = gradoIds[año]?.[nivel]?.[grupo];

          if (!gradoId) {
            warn(`Grado ${nivel}°${grupo} ${año} no encontrado — omitiendo`);
            errores++;
            continue;
          }

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
    log(`${año}: ${porAño} asignaciones`);
  }

  if (errores > 0) warn(`${errores} asignaciones omitidas por errores`);
  log(`Total: ${total} asignaciones`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           KLASSY — seed_catalogo.js                   ║');
  console.log('║  Materias · Periodos · Grados · AsignacionDocente     ║');
  console.log('║  Años: 2024 · 2025 · 2026                             ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nConectando a: ${MONGO_URI}`);

  await mongoose.connect(MONGO_URI);
  console.log('Conexión establecida.\n');

  const materiaIds  = await seedMaterias();
  await seedPeriodos();
  const gradoIds    = await seedGrados(materiaIds);
  const docentesMap = await cargarDocentes();
  await seedAsignaciones(materiaIds, gradoIds, docentesMap);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  seed_catalogo.js completado ✓                        ║');
  console.log('║                                                        ║');
  console.log('║  Resumen insertado:                                    ║');
  console.log('║    • 11 Materias                                       ║');
  console.log('║    • 12 Periodos  (4 × 3 años)                        ║');
  console.log('║    • 66 Grados    (22 × 3 años)                       ║');
  console.log('║    • 726 AsignacionDocente                             ║');
  console.log('║                                                        ║');
  console.log('║  Siguiente paso:                                       ║');
  console.log('║    node seeders/seed_matriculas_2024.js                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_catalogo.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
