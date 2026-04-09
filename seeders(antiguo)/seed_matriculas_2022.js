/**
 * seeders/seed_matriculas_2022.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea las matrículas del año 2022 (primer año del dataset).
 * Tipo: nuevaMatricula para todos los estudiantes.
 * El nivel académico se toma del campo nivelInicial del Excel,
 * que ya fue importado como ultimoNivelCursado en Usuario.
 *
 * REQUISITOS PREVIOS:
 *   1. Excel importado (usuarios en BD)
 *   2. seed_catalogo.js ejecutado (grados en BD)
 *
 * Uso:
 *   node seeders/seed_matriculas_2022.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const { Usuario, Grado, Matricula } = require('../models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const AÑO       = 2022;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(50 - t.length)}`);

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║       KLASSY — seed_matriculas_2022.js              ║');
  console.log('║   Matrículas año 2022 · tipo: nuevaMatricula        ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await mongoose.connect(MONGO_URI);
  console.log(`\nConectado a MongoDB. Año: ${AÑO}\n`);

  // ── 1. Cargar todos los estudiantes ────────────────────────────────────────
  sep('ESTUDIANTES');
  const estudiantes = await Usuario.find({ rol: 'estudiante', activo: true })
    .sort({ createdAt: 1 })
    .select('_id nombre apellido ultimoNivelCursado')
    .lean();

  log(`Estudiantes encontrados: ${estudiantes.length}`);

  if (estudiantes.length === 0) {
    warn('No hay estudiantes en la BD. Importa el Excel primero.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── 2. Cargar grados del año 2022 indexados por nivel y grupo ──────────────
  sep('GRADOS 2022');
  const grados = await Grado.find({ año: AÑO })
    .select('_id nombre nivel')
    .lean();

  if (grados.length === 0) {
    warn('No hay grados para 2022. Ejecuta seed_catalogo.js primero.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // gradoMap[nivel][grupo] = gradoId
  // Los estudiantes se distribuyen: puestos 0-9 → grupo A, 10-19 → grupo B
  // dentro de cada nivel. Pero como vienen ordenados por createdAt y el Excel
  // los generó nivel por nivel (1A×20, 1B×20, 2A×20 ...), los identificamos
  // por índice dentro del nivel.
  const gradoMap = {};
  for (const g of grados) {
    // nombre formato "1°A", "11°B"
    const match = g.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    const nivel = parseInt(match[1]);
    const grupo = match[2];
    if (!gradoMap[nivel]) gradoMap[nivel] = {};
    gradoMap[nivel][grupo] = g._id;
  }
  log(`Grados cargados: ${grados.length}`);

  // ── 3. Asignar grado a cada estudiante ────────────────────────────────────
  // El Excel generó los estudiantes en este orden exacto:
  //   nivel 1 grupo A → 20 estudiantes
  //   nivel 1 grupo B → 20 estudiantes
  //   nivel 2 grupo A → 20 estudiantes
  //   ...
  //   nivel 11 grupo B → 20 estudiantes
  // Total: 11 niveles × 2 grupos × 20 = 440
  sep('CREANDO MATRÍCULAS');

  const GRUPOS  = ['A', 'B'];
  const niveles = [1,2,3,4,5,6,7,8,9,10,11];
  let estIdx    = 0;
  let creadas   = 0;
  let omitidas  = 0;

  for (const nivel of niveles) {
    for (const grupo of GRUPOS) {
      const gradoId = gradoMap[nivel]?.[grupo];

      if (!gradoId) {
        warn(`Grado ${nivel}°${grupo} no encontrado en BD — omitiendo 20 matrículas`);
        estIdx += 20;
        omitidas += 20;
        continue;
      }

      for (let puesto = 0; puesto < 20; puesto++) {
        const estudiante = estudiantes[estIdx];
        estIdx++;

        if (!estudiante) {
          warn(`Sin estudiante en índice ${estIdx - 1}`);
          continue;
        }

        // nivelInicial viene del Excel como ultimoNivelCursado
        // En 2022 es el nivel que VA A CURSAR (nuevo ingreso)
        const nivelAcademico = nivel; // coincide con el grado asignado

        try {
          await Matricula.findOneAndUpdate(
            { estudianteId: estudiante._id, año: AÑO },
            {
              $setOnInsert: {
                estudianteId:   estudiante._id,
                gradoId,
                año:            AÑO,
                nivelAcademico,
                estado:         'activa',
                tipo:           'nuevaMatricula',
                observaciones:  '',
                fechaMatricula: new Date(`${AÑO}-01-28`),
              },
            },
            { upsert: true, new: true }
          );
          creadas++;
        } catch (err) {
          warn(`Error matriculando ${estudiante.nombre}: ${err.message}`);
          omitidas++;
        }
      }
    }
    log(`Nivel ${nivel} (A+B): 40 matrículas procesadas`);
  }

  // ── 4. Resumen ─────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Matrículas creadas : ${String(creadas).padEnd(29)}║`);
  console.log(`║  Omitidas/errores   : ${String(omitidas).padEnd(29)}║`);
  console.log('║  Siguiente paso:                                     ║');
  console.log('║    node seeders/seed_año2022.js                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_matriculas_2022.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
