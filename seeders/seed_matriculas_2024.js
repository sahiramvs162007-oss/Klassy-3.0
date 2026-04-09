/**
 * seeders/seed_matriculas_2024.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea las matrículas del año 2024.
 *
 * Lógica:
 *   - Solo procesa estudiantes de cohorte 2024 (los 440 base).
 *   - Tipo: nuevaMatricula para todos.
 *   - El nivel y grupo vienen de mapa_usuarios.json (generado por generar_mapa.js).
 *   - Asigna al grado del año 2024 que corresponde a su nivelInicial + grupo.
 *
 * REQUISITOS PREVIOS:
 *   1. Excel importado en MongoDB.
 *   2. seed_catalogo.js ejecutado (grados 2024 en BD).
 *   3. node seeders/generar_mapa.js ejecutado (mapa_usuarios.json existe).
 *
 * Uso:
 *   node seeders/seed_matriculas_2024.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');
const { Grado, Matricula } = require('../models');

const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const MAPA_PATH  = path.resolve(__dirname, 'mapa_usuarios.json');
const AÑO        = 2024;
const COHORTE    = 2024;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠  ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(2, 52 - t.length))}`);

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        KLASSY — seed_matriculas_2024.js               ║');
  console.log('║   Matrículas 2024 · cohorte 2024 · nuevaMatricula     ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // ── 1. Leer mapa_usuarios.json ─────────────────────────────────────────────
  if (!fs.existsSync(MAPA_PATH)) {
    console.error(`\n❌ No se encontró mapa_usuarios.json en: ${MAPA_PATH}`);
    console.error('   Ejecuta primero: node seeders/generar_mapa.js\n');
    process.exit(1);
  }
  const mapaCompleto = JSON.parse(fs.readFileSync(MAPA_PATH, 'utf8'));

  // Filtrar solo cohorte 2024
  const estudiantes = mapaCompleto.filter(e => e.cohorte === COHORTE);
  log(`Estudiantes cohorte ${COHORTE}: ${estudiantes.length}`);

  if (estudiantes.length === 0) {
    warn('No hay estudiantes de cohorte 2024 en el mapa. Verifica generar_mapa.js.');
    process.exit(1);
  }

  // ── 2. Conectar ────────────────────────────────────────────────────────────
  await mongoose.connect(MONGO_URI);
  log('Conexión establecida');

  // ── 3. Cargar grados 2024 → map[nivel][grupo] = gradoId ───────────────────
  sep('GRADOS 2024');
  const grados = await Grado.find({ año: AÑO }).select('_id nombre nivel').lean();

  if (grados.length === 0) {
    console.error('❌ No hay grados para 2024. Ejecuta seed_catalogo.js primero.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const gradoMap = {}; // gradoMap[nivel][grupo] = ObjectId
  for (const g of grados) {
    const match = g.nombre.match(/^(\d+)°([AB])$/);
    if (!match) continue;
    const nivel = parseInt(match[1]);
    const grupo = match[2];
    if (!gradoMap[nivel]) gradoMap[nivel] = {};
    gradoMap[nivel][grupo] = g._id;
  }
  log(`${grados.length} grados cargados`);

  // ── 4. Crear matrículas ────────────────────────────────────────────────────
  sep('CREANDO MATRÍCULAS 2024');

  let creadas   = 0;
  let omitidas  = 0;
  const errores = [];

  for (const est of estudiantes) {
    const { estudianteId, nivelInicial, grupo, nombre, apellido } = est;

    // Validar nivel
    if (!nivelInicial || nivelInicial < 1 || nivelInicial > 11) {
      warn(`Nivel inválido (${nivelInicial}) para ${nombre} ${apellido} — omitiendo`);
      omitidas++;
      continue;
    }

    // Validar grupo
    const grupoNorm = (grupo || 'A').toUpperCase();
    if (!['A', 'B'].includes(grupoNorm)) {
      warn(`Grupo inválido (${grupo}) para ${nombre} ${apellido} — omitiendo`);
      omitidas++;
      continue;
    }

    const gradoId = gradoMap[nivelInicial]?.[grupoNorm];
    if (!gradoId) {
      warn(`Grado ${nivelInicial}°${grupoNorm} no encontrado para ${nombre} ${apellido}`);
      omitidas++;
      continue;
    }

    try {
      await Matricula.findOneAndUpdate(
        { estudianteId, año: AÑO },
        {
          $setOnInsert: {
            estudianteId,
            gradoId,
            año:            AÑO,
            nivelAcademico: nivelInicial,
            estado:         'activa',
            tipo:           'nuevaMatricula',
            observaciones:  '',
            fechaMatricula: new Date(`${AÑO}-01-29`),
          },
        },
        { upsert: true, new: true }
      );
      creadas++;
    } catch (err) {
      warn(`Error matriculando ${nombre} ${apellido}: ${err.message}`);
      errores.push({ nombre, apellido, error: err.message });
      omitidas++;
    }
  }

  // ── 5. Verificación por nivel ──────────────────────────────────────────────
  sep('VERIFICACIÓN POR NIVEL');
  for (let nivel = 1; nivel <= 11; nivel++) {
    const count = await Matricula.countDocuments({
      año: AÑO,
      gradoId: {
        $in: Object.values(gradoMap[nivel] || {})
      },
    });
    log(`Nivel ${nivel}°: ${count} matrículas (esperado: 40)`);
  }

  // ── 6. Resumen ─────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║  Matrículas creadas : ${String(creadas).padEnd(32)}║`);
  console.log(`║  Omitidas/errores   : ${String(omitidas).padEnd(32)}║`);
  console.log('║                                                        ║');
  console.log('║  Siguiente paso:                                       ║');
  console.log('║    node seeders/seed_año2024.js                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (errores.length > 0) {
    console.log('Errores detallados:');
    errores.forEach(e => console.log(`  - ${e.nombre} ${e.apellido}: ${e.error}`));
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_matriculas_2024.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
