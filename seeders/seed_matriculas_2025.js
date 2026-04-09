/**
 * seeders/seed_matriculas_2025.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea las matrículas del año 2025:
 *
 *   Cohorte 2024 → matriculaRenovada
 *     Lee ResultadoAnual 2024 por estudiante.
 *     Si reprobó al menos 1 materia → repite nivel (mismo grado, mismo grupo).
 *     Si aprobó todo              → sube 1 nivel (mismo grupo).
 *     Si nivel sería 12           → se graduó, sin matrícula 2025.
 *
 *   Cohorte 2025 → nuevaMatricula
 *     Entran al sistema en grado 1° (nivelInicial = 1).
 *     Grupo tomado de mapa_usuarios.json.
 *
 *   Cohorte 2026 → ignorada (aún no entran).
 *
 * REQUISITOS PREVIOS:
 *   seed_catalogo.js + seed_matriculas_2024.js + seed_año2024.js ejecutados.
 *   generar_mapa.js ejecutado (mapa_usuarios.json existe).
 *
 * Uso:
 *   node seeders/seed_matriculas_2025.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');
const { Grado, Matricula, ResultadoAnual } = require('../models');

const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const MAPA_PATH  = path.resolve(__dirname, 'mapa_usuarios.json');
const AÑO        = 2025;
const AÑO_PREVIO = 2024;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠  ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(2, 52 - t.length))}`);

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        KLASSY — seed_matriculas_2025.js               ║');
  console.log('║  Matrículas 2025 · cohorte 2024 (renovada)            ║');
  console.log('║                  · cohorte 2025 (nueva grado 1°)      ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // ── 1. Verificar mapa ──────────────────────────────────────────────────────
  if (!fs.existsSync(MAPA_PATH)) {
    console.error(`\n❌ No se encontró mapa_usuarios.json en: ${MAPA_PATH}`);
    console.error('   Ejecuta primero: node seeders/generar_mapa.js\n');
    process.exit(1);
  }
  const mapaArr = JSON.parse(fs.readFileSync(MAPA_PATH, 'utf8'));
  log(`Mapa cargado: ${mapaArr.length} estudiantes`);

  await mongoose.connect(MONGO_URI);
  log('Conexión establecida');

  // ── 2. Grados 2025 indexados ───────────────────────────────────────────────
  sep('GRADOS 2025');
  const grados2025 = await Grado.find({ año: AÑO }).select('_id nombre nivel').lean();
  if (grados2025.length === 0) {
    console.error('❌ No hay grados para 2025. Ejecuta seed_catalogo.js primero.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // gradoMap[nivel][grupo] = gradoId
  const gradoMap = {};
  for (const g of grados2025) {
    const match = g.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    const nivel = parseInt(match[1]);
    const grupo = match[2];
    if (!gradoMap[nivel]) gradoMap[nivel] = {};
    gradoMap[nivel][grupo] = g._id;
  }
  log(`${grados2025.length} grados cargados`);

  // ── 3. Matrículas 2024 → saber nivel y grupo actual de cohorte 2024 ────────
  sep('MATRÍCULAS 2024 → NIVEL ACTUAL');
  const mats2024 = await Matricula.find({ año: AÑO_PREVIO })
    .populate('gradoId', 'nombre nivel')
    .lean();

  // prevMap[estudianteId] = { nivel, grupo }
  const prevMap = {};
  for (const m of mats2024) {
    if (!m.gradoId) continue;
    const match = m.gradoId.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    prevMap[m.estudianteId.toString()] = {
      nivel: parseInt(match[1]),
      grupo: match[2],
    };
  }
  log(`Matrículas ${AÑO_PREVIO} cargadas: ${Object.keys(prevMap).length}`);

  // ── 4. ResultadoAnual 2024 → quién reprobó ─────────────────────────────────
  sep('RESULTADO ANUAL 2024');
  const ra2024 = await ResultadoAnual.find({ año: AÑO_PREVIO }).lean();

  // reprobadoMap[estudianteId] = true si reprobó ≥ 1 materia
  const reprobadoMap = {};
  for (const r of ra2024) {
    if (!r.aprobado) reprobadoMap[r.estudianteId.toString()] = true;
  }
  log(`Estudiantes que reprobaron ≥1 materia en ${AÑO_PREVIO}: ${Object.keys(reprobadoMap).length}`);

  // ── 5. Crear matrículas ────────────────────────────────────────────────────
  sep('CREANDO MATRÍCULAS 2025');

  const stats = {
    renovadasSubieron:  0,
    renovadasRepitieron: 0,
    graduados:          0,
    nuevas2025:         0,
    omitidas:           0,
  };

  const ops = [];

  // ── 5a. Cohorte 2024 — renovada ────────────────────────────────────────────
  const cohorte2024 = mapaArr.filter(e => e.cohorte === 2024);
  log(`Procesando cohorte 2024: ${cohorte2024.length} estudiantes`);

  for (const est of cohorte2024) {
    const eid  = est.estudianteId;
    const prev = prevMap[eid];

    if (!prev) {
      warn(`Sin matrícula 2024 para ${est.nombre} ${est.apellido} — omitiendo`);
      stats.omitidas++;
      continue;
    }

    const reprobó    = reprobadoMap[eid] === true;
    const nivelNuevo = reprobó ? prev.nivel : prev.nivel + 1;
    const grupo      = prev.grupo;

    // Graduado
    if (nivelNuevo > 11) {
      stats.graduados++;
      continue;
    }

    const gradoId = gradoMap[nivelNuevo]?.[grupo];
    if (!gradoId) {
      warn(`Grado ${nivelNuevo}°${grupo} no encontrado — omitiendo ${est.nombre}`);
      stats.omitidas++;
      continue;
    }

    ops.push({
      updateOne: {
        filter: { estudianteId: new mongoose.Types.ObjectId(eid), año: AÑO },
        update: {
          $setOnInsert: {
            estudianteId:   new mongoose.Types.ObjectId(eid),
            gradoId,
            año:            AÑO,
            nivelAcademico: nivelNuevo,
            estado:         'activa',
            tipo:           'matriculaRenovada',
            observaciones:  reprobó
              ? `Repitió nivel ${prev.nivel} — reprobó materia(s) en ${AÑO_PREVIO}.`
              : '',
            fechaMatricula: new Date(`${AÑO}-01-27`),
          },
        },
        upsert: true,
      },
    });

    if (reprobó) stats.renovadasRepitieron++;
    else         stats.renovadasSubieron++;
  }

  // ── 5b. Cohorte 2025 — nuevaMatricula en grado 1° ─────────────────────────
  const cohorte2025 = mapaArr.filter(e => e.cohorte === 2025);
  log(`Procesando cohorte 2025: ${cohorte2025.length} estudiantes nuevos`);

  for (const est of cohorte2025) {
    const eid     = est.estudianteId;
    const grupo   = (est.grupo || 'A').toUpperCase();
    const gradoId = gradoMap[1]?.[grupo];

    if (!gradoId) {
      warn(`Grado 1°${grupo} no encontrado para cohorte 2025 — omitiendo ${est.nombre}`);
      stats.omitidas++;
      continue;
    }

    ops.push({
      updateOne: {
        filter: { estudianteId: new mongoose.Types.ObjectId(eid), año: AÑO },
        update: {
          $setOnInsert: {
            estudianteId:   new mongoose.Types.ObjectId(eid),
            gradoId,
            año:            AÑO,
            nivelAcademico: 1,
            estado:         'activa',
            tipo:           'nuevaMatricula',
            observaciones:  'Nuevo ingreso cohorte 2025.',
            fechaMatricula: new Date(`${AÑO}-01-27`),
          },
        },
        upsert: true,
      },
    });
    stats.nuevas2025++;
  }

  // Ejecutar bulk
  if (ops.length > 0) {
    await Matricula.bulkWrite(ops, { ordered: false });
  }

  // ── 6. Verificación por nivel ──────────────────────────────────────────────
  sep('VERIFICACIÓN POR NIVEL');
  let totalMatriculas = 0;
  for (let nivel = 1; nivel <= 11; nivel++) {
    const gradosNivel = Object.values(gradoMap[nivel] || {});
    const count = await Matricula.countDocuments({
      año: AÑO,
      gradoId: { $in: gradosNivel },
      estado: 'activa',
    });
    totalMatriculas += count;
    const nota = nivel === 1 ? ' ← incluye cohorte 2025 + repitentes' : '';
    log(`Nivel ${String(nivel).padStart(2)}°: ${count} matrículas${nota}`);
  }

  // ── 7. Resumen ─────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  seed_matriculas_2025.js completado ✓                 ║');
  console.log('║                                                        ║');
  console.log(`║  Cohorte 2024 subieron nivel  : ${String(stats.renovadasSubieron).padEnd(24)}║`);
  console.log(`║  Cohorte 2024 repitieron nivel: ${String(stats.renovadasRepitieron).padEnd(24)}║`);
  console.log(`║  Cohorte 2024 graduados       : ${String(stats.graduados).padEnd(24)}║`);
  console.log(`║  Cohorte 2025 nuevos grado 1° : ${String(stats.nuevas2025).padEnd(24)}║`);
  console.log(`║  Omitidos/errores             : ${String(stats.omitidas).padEnd(24)}║`);
  console.log(`║  Total matrículas activas 2025: ${String(totalMatriculas).padEnd(24)}║`);
  console.log('║                                                        ║');
  console.log('║  Siguiente paso:                                       ║');
  console.log('║    node seeders/seed_año2025.js                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_matriculas_2025.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
