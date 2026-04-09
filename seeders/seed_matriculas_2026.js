/**
 * seeders/seed_matriculas_2026.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea las matrículas del año 2026:
 *
 *   Cohorte 2024 → matriculaRenovada
 *     Lee ResultadoAnual 2025. Sube nivel si aprobó todo, repite si no.
 *     Si nivel sería 12 → graduado, sin matrícula 2026.
 *
 *   Cohorte 2025 → matriculaRenovada
 *     Igual que cohorte 2024 — ya llevan 1 año en el sistema.
 *     Leen su ResultadoAnual 2025 para subir o repetir.
 *
 *   Cohorte 2026 → nuevaMatricula
 *     Entran al sistema en grado 1° (nivelInicial = 1).
 *
 * REQUISITOS PREVIOS:
 *   seed_año2025.js ejecutado (ResultadoAnual 2025 en BD).
 *   generar_mapa.js ejecutado (mapa_usuarios.json existe).
 *
 * Uso:
 *   node seeders/seed_matriculas_2026.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');
const { Grado, Matricula, ResultadoAnual } = require('../models');

const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const MAPA_PATH  = path.resolve(__dirname, 'mapa_usuarios.json');
const AÑO        = 2026;
const AÑO_PREVIO = 2025;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠  ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(2, 52 - t.length))}`);

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        KLASSY — seed_matriculas_2026.js               ║');
  console.log('║  Matrículas 2026 · cohorte 2024/2025 (renovada)       ║');
  console.log('║               · cohorte 2026 (nueva grado 1°)         ║');
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

  // ── 2. Grados 2026 indexados ───────────────────────────────────────────────
  sep('GRADOS 2026');
  const grados2026 = await Grado.find({ año: AÑO }).select('_id nombre nivel').lean();
  if (grados2026.length === 0) {
    console.error('❌ No hay grados para 2026. Ejecuta seed_catalogo.js primero.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const gradoMap = {}; // gradoMap[nivel][grupo] = gradoId
  for (const g of grados2026) {
    const match = g.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    const nivel = parseInt(match[1]);
    const grupo = match[2];
    if (!gradoMap[nivel]) gradoMap[nivel] = {};
    gradoMap[nivel][grupo] = g._id;
  }
  log(`${grados2026.length} grados cargados`);

  // ── 3. Matrículas 2025 → nivel y grupo actual ──────────────────────────────
  sep('MATRÍCULAS 2025 → NIVEL ACTUAL');
  const mats2025 = await Matricula.find({ año: AÑO_PREVIO })
    .populate('gradoId', 'nombre nivel')
    .lean();

  const prevMap = {}; // estudianteId → { nivel, grupo }
  for (const m of mats2025) {
    if (!m.gradoId) continue;
    const match = m.gradoId.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    prevMap[m.estudianteId.toString()] = {
      nivel: parseInt(match[1]),
      grupo: match[2],
    };
  }
  log(`Matrículas ${AÑO_PREVIO} cargadas: ${Object.keys(prevMap).length}`);

  // ── 4. ResultadoAnual 2025 → quién reprobó ─────────────────────────────────
  sep('RESULTADO ANUAL 2025');
  const ra2025 = await ResultadoAnual.find({ año: AÑO_PREVIO }).lean();

  const reprobadoMap = {};
  for (const r of ra2025) {
    if (!r.aprobado) reprobadoMap[r.estudianteId.toString()] = true;
  }
  log(`Estudiantes que reprobaron ≥1 materia en ${AÑO_PREVIO}: ${Object.keys(reprobadoMap).length}`);

  // ── 5. Crear matrículas ────────────────────────────────────────────────────
  sep('CREANDO MATRÍCULAS 2026');

  const stats = {
    subieron:    0,
    repitieron:  0,
    graduados:   0,
    nuevos2026:  0,
    omitidas:    0,
  };

  const ops = [];

  // ── 5a. Cohortes 2024 y 2025 — renovadas ──────────────────────────────────
  const renovadas = mapaArr.filter(e => e.cohorte === 2024 || e.cohorte === 2025);
  log(`Procesando cohortes 2024+2025: ${renovadas.length} estudiantes`);

  for (const est of renovadas) {
    const eid  = est.estudianteId;
    const prev = prevMap[eid];

    if (!prev) {
      // Puede ser un graduado de 2025 (nivel 11 aprobado) — no es error
      if (est.cohorte === 2024) {
        // Solo avisar si es cohorte 2024 que debería tener matrícula 2025
        const tuvoPrev = await Matricula.exists({ estudianteId: eid, año: 2024 });
        if (tuvoPrev) stats.graduados++;
      }
      continue;
    }

    const reprobó    = reprobadoMap[eid] === true;
    const nivelNuevo = reprobó ? prev.nivel : prev.nivel + 1;
    const grupo      = prev.grupo;

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
            fechaMatricula: new Date(`${AÑO}-01-26`),
          },
        },
        upsert: true,
      },
    });

    if (reprobó) stats.repitieron++;
    else         stats.subieron++;
  }

  // ── 5b. Cohorte 2026 — nuevaMatricula en grado 1° ─────────────────────────
  const cohorte2026 = mapaArr.filter(e => e.cohorte === 2026);
  log(`Procesando cohorte 2026: ${cohorte2026.length} estudiantes nuevos`);

  for (const est of cohorte2026) {
    const eid     = est.estudianteId;
    const grupo   = (est.grupo || 'A').toUpperCase();
    const gradoId = gradoMap[1]?.[grupo];

    if (!gradoId) {
      warn(`Grado 1°${grupo} no encontrado para cohorte 2026 — omitiendo ${est.nombre}`);
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
            observaciones:  'Nuevo ingreso cohorte 2026.',
            fechaMatricula: new Date(`${AÑO}-01-26`),
          },
        },
        upsert: true,
      },
    });
    stats.nuevos2026++;
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
    const nota = nivel === 1
      ? ' ← nuevos 2026 + repitentes'
      : '';
    log(`Nivel ${String(nivel).padStart(2)}°: ${count} matrículas${nota}`);
  }

  // ── 7. Resumen ─────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  seed_matriculas_2026.js completado ✓                 ║');
  console.log('║                                                        ║');
  console.log(`║  Subieron nivel               : ${String(stats.subieron).padEnd(24)}║`);
  console.log(`║  Repitieron nivel             : ${String(stats.repitieron).padEnd(24)}║`);
  console.log(`║  Graduados (sin matrícula)    : ${String(stats.graduados).padEnd(24)}║`);
  console.log(`║  Cohorte 2026 nuevos grado 1° : ${String(stats.nuevos2026).padEnd(24)}║`);
  console.log(`║  Omitidos/errores             : ${String(stats.omitidas).padEnd(24)}║`);
  console.log(`║  Total matrículas activas 2026: ${String(totalMatriculas).padEnd(24)}║`);
  console.log('║                                                        ║');
  console.log('║  Siguiente paso:                                       ║');
  console.log('║    node seeders/seed_año2026.js                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_matriculas_2026.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
