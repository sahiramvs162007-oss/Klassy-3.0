/**
 * seeders/seed_matriculas_2023.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea las matrículas del año 2023 (segundo año del dataset).
 * Tipo: matriculaRenovada para todos los estudiantes.
 *
 * Lógica de progresión:
 *   - Lee ResultadoAnual del año 2022 por estudiante.
 *   - Si el estudiante aprobó TODAS las materias → sube 1 nivel.
 *   - Si reprobó al menos 1 materia → se queda en el mismo nivel.
 *   - Se asigna al grado del nuevo nivel en 2023 (mismo grupo A/B que en 2022).
 *   - Si el nivel llegaría a 12 (ya terminó el colegio) → estado: graduado, sin grado nuevo.
 *
 * REQUISITOS PREVIOS:
 *   seed_catalogo.js + seed_matriculas_2022.js + seed_año2022.js ejecutados.
 *
 * Uso:
 *   node seeders/seed_matriculas_2023.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const { Usuario, Grado, Matricula, ResultadoAnual } = require('../models');

const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const AÑO        = 2023;
const AÑO_PREVIO = 2022;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`);

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║       KLASSY — seed_matriculas_2023.js              ║');
  console.log('║   Matrículas año 2023 · tipo: matriculaRenovada     ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await mongoose.connect(MONGO_URI);
  console.log(`\nConectado. Procesando matrículas ${AÑO}...\n`);

  // ── 1. Matrículas del año previo → nivel y grupo de cada estudiante ─────────
  sep('MATRÍCULAS 2022');
  const matriculas2022 = await Matricula.find({ año: AÑO_PREVIO })
    .populate('gradoId', 'nombre nivel')
    .lean();

  // Mat. previo map: estudianteId → { nivel, gradoId, grupo }
  const prevMap = {};
  for (const m of matriculas2022) {
    if (!m.gradoId) continue;
    const match = m.gradoId.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    prevMap[m.estudianteId.toString()] = {
      nivel:  parseInt(match[1]),
      grupo:  match[2],
      gradoId: m.gradoId._id,
    };
  }
  log(`Matrículas ${AÑO_PREVIO} cargadas: ${Object.keys(prevMap).length}`);

  // ── 2. ResultadoAnual 2022 → quién reprobó ──────────────────────────────────
  sep('RESULTADO ANUAL 2022');
  const resultados2022 = await ResultadoAnual.find({ año: AÑO_PREVIO }).lean();

  // reprobadosMap: estudianteId → true si reprobó al menos 1 materia
  const reprobadosMap = {};
  for (const r of resultados2022) {
    const eid = r.estudianteId.toString();
    if (!r.aprobado) reprobadosMap[eid] = true;
  }

  const totalReprobados = Object.keys(reprobadosMap).length;
  log(`Estudiantes que reprobaron al menos 1 materia en ${AÑO_PREVIO}: ${totalReprobados}`);

  // ── 3. Grados 2023 indexados por nivel y grupo ──────────────────────────────
  sep('GRADOS 2023');
  const grados2023 = await Grado.find({ año: AÑO }).lean();
  const gradoMap   = {};
  for (const g of grados2023) {
    const match = g.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    const nivel = parseInt(match[1]);
    const grupo = match[2];
    if (!gradoMap[nivel]) gradoMap[nivel] = {};
    gradoMap[nivel][grupo] = g._id;
  }
  log(`Grados ${AÑO} cargados: ${grados2023.length}`);

  // ── 4. Estudiantes ──────────────────────────────────────────────────────────
  sep('CREANDO MATRÍCULAS 2023');
  const estudiantes = await Usuario.find({ rol: 'estudiante', activo: true })
    .select('_id nombre apellido ultimoNivelCursado')
    .lean();

  let creadas       = 0;
  let subieronNivel = 0;
  let repitieronNivel = 0;
  let omitidas      = 0;

  for (const estudiante of estudiantes) {
    const eid  = estudiante._id.toString();
    const prev = prevMap[eid];

    if (!prev) {
      warn(`Sin matrícula 2022 para ${estudiante.nombre} — omitiendo`);
      omitidas++;
      continue;
    }

    const reprobó      = reprobadosMap[eid] === true;
    const nivelNuevo   = reprobó ? prev.nivel : prev.nivel + 1;
    const grupo        = prev.grupo;

    // Si supera nivel 11 ya se graduó
    if (nivelNuevo > 11) {
      log(`${estudiante.nombre} completó nivel 11 en 2022 → sin matrícula 2023 (graduado)`);
      continue;
    }

    const gradoId = gradoMap[nivelNuevo]?.[grupo];
    if (!gradoId) {
      warn(`Grado ${nivelNuevo}°${grupo} no encontrado en 2023 — omitiendo ${estudiante.nombre}`);
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
            fechaMatricula: new Date(`${AÑO}-01-30`),
          },
        },
        { upsert: true, new: true }
      );
      creadas++;
      if (reprobó) repitieronNivel++;
      else         subieronNivel++;
    } catch (err) {
      warn(`Error matriculando ${estudiante.nombre}: ${err.message}`);
      omitidas++;
    }
  }

  // ── Resumen ─────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Matrículas creadas  : ${String(creadas).padEnd(29)}║`);
  console.log(`║  Subieron de nivel   : ${String(subieronNivel).padEnd(29)}║`);
  console.log(`║  Repitieron nivel    : ${String(repitieronNivel).padEnd(29)}║`);
  console.log(`║  Omitidas/errores    : ${String(omitidas).padEnd(29)}║`);
  console.log('║  Siguiente paso:                                     ║');
  console.log('║    node seeders/seed_año2023.js                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_matriculas_2023.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
