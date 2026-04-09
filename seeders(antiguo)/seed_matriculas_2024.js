/**
 * seeders/seed_matriculas_2024.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea las matrículas del año 2024 (tercer año del dataset).
 * Tipo: matriculaRenovada. Lee ResultadoAnual 2023 para determinar progresión.
 *
 * REQUISITOS PREVIOS:
 *   seed_año2023.js ejecutado.
 *
 * Uso:
 *   node seeders/seed_matriculas_2024.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const { Usuario, Grado, Matricula, ResultadoAnual } = require('../models');

const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const AÑO        = 2024;
const AÑO_PREVIO = 2023;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`);

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║       KLASSY — seed_matriculas_2024.js              ║');
  console.log('║   Matrículas año 2024 · tipo: matriculaRenovada     ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await mongoose.connect(MONGO_URI);
  console.log(`\nConectado. Procesando matrículas ${AÑO}...\n`);

  sep('MATRÍCULAS 2023');
  const matriculas2023 = await Matricula.find({ año: AÑO_PREVIO })
    .populate('gradoId', 'nombre nivel')
    .lean();

  const prevMap = {};
  for (const m of matriculas2023) {
    if (!m.gradoId) continue;
    const match = m.gradoId.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    prevMap[m.estudianteId.toString()] = {
      nivel: parseInt(match[1]),
      grupo: match[2],
    };
  }
  log(`Matrículas ${AÑO_PREVIO} cargadas: ${Object.keys(prevMap).length}`);

  sep('RESULTADO ANUAL 2023');
  const resultados2023 = await ResultadoAnual.find({ año: AÑO_PREVIO }).lean();
  const reprobadosMap  = {};
  for (const r of resultados2023) {
    if (!r.aprobado) reprobadosMap[r.estudianteId.toString()] = true;
  }
  log(`Reprobados en ${AÑO_PREVIO}: ${Object.keys(reprobadosMap).length}`);

  sep('GRADOS 2024');
  const grados2024 = await Grado.find({ año: AÑO }).lean();
  const gradoMap   = {};
  for (const g of grados2024) {
    const match = g.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    const nivel = parseInt(match[1]);
    const grupo = match[2];
    if (!gradoMap[nivel]) gradoMap[nivel] = {};
    gradoMap[nivel][grupo] = g._id;
  }
  log(`Grados ${AÑO}: ${grados2024.length}`);

  sep('CREANDO MATRÍCULAS 2024');
  const estudiantes = await Usuario.find({ rol: 'estudiante', activo: true })
    .select('_id nombre apellido').lean();

  let creadas = 0, subieron = 0, repitieron = 0, omitidas = 0;

  for (const estudiante of estudiantes) {
    const eid  = estudiante._id.toString();
    const prev = prevMap[eid];

    if (!prev) {
      // Puede haber estudiantes que en 2023 ya superaron nivel 11
      omitidas++;
      continue;
    }

    const reprobó    = reprobadosMap[eid] === true;
    const nivelNuevo = reprobó ? prev.nivel : prev.nivel + 1;

    if (nivelNuevo > 11) {
      log(`${estudiante.nombre} completó nivel 11 en 2023 → sin matrícula 2024`);
      continue;
    }

    const gradoId = gradoMap[nivelNuevo]?.[prev.grupo];
    if (!gradoId) {
      warn(`Grado ${nivelNuevo}°${prev.grupo} no encontrado → omitiendo ${estudiante.nombre}`);
      omitidas++;
      continue;
    }

    try {
      await Matricula.findOneAndUpdate(
        { estudianteId: estudiante._id, año: AÑO },
        {
          $setOnInsert: {
            estudianteId:   estudiante._id,
            gradoId,
            año:            AÑO,
            nivelAcademico: nivelNuevo,
            estado:         'activa',
            tipo:           'matriculaRenovada',
            observaciones:  reprobó
              ? `Repitió nivel ${prev.nivel} por reprobación en año ${AÑO_PREVIO}.`
              : '',
            fechaMatricula: new Date(`${AÑO}-01-29`),
          },
        },
        { upsert: true, new: true }
      );
      creadas++;
      if (reprobó) repitieron++; else subieron++;
    } catch (err) {
      warn(`Error matriculando ${estudiante.nombre}: ${err.message}`);
      omitidas++;
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Matrículas creadas  : ${String(creadas).padEnd(29)}║`);
  console.log(`║  Subieron de nivel   : ${String(subieron).padEnd(29)}║`);
  console.log(`║  Repitieron nivel    : ${String(repitieron).padEnd(29)}║`);
  console.log(`║  Omitidas            : ${String(omitidas).padEnd(29)}║`);
  console.log('║  Siguiente paso:                                     ║');
  console.log('║    node seeders/seed_año2024.js                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_matriculas_2024.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
