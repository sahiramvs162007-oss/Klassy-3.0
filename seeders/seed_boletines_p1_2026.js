/**
 * seeders/seed_boletines_p1_2026.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera los Boletines y ResultadoPeriodo del Periodo 1 de 2026
 * que no se crearon al cerrar el periodo manualmente.
 *
 * Calcula los promedios directo desde la colección Nota (fuente de verdad).
 * No duplica: usa upsert para ResultadoPeriodo e insertMany con ignore para Boletin.
 *
 * Uso:
 *   node seeders/seed_boletines_p1_2026.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

const {
  Usuario,
  Materia,
  Grado,
  Periodo,
  Matricula,
  AsignacionDocente,
  Nota,
  ResultadoPeriodo,
  Boletin,
} = require('../models');

const MONGO_URI     = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const MAPA_PATH     = path.resolve(__dirname, 'mapa_usuarios.json');
const AÑO           = 2026;
const NUM_PERIODO   = 1;
const APROBACION    = 3.0;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠  ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(2, 52 - t.length))}`);

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║      KLASSY — seed_boletines_p1_2026.js               ║');
  console.log('║   Genera Boletines y ResultadoPeriodo del P1 2026     ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  await mongoose.connect(MONGO_URI);
  log('Conexión establecida');

  // ── 1. Verificar que P1 2026 existe y está cerrado ─────────────────────────
  sep('VERIFICANDO PERIODO 1 DE 2026');
  const periodo = await Periodo.findOne({ año: AÑO, numero: NUM_PERIODO }).lean();

  if (!periodo) {
    console.error('❌ No existe el Periodo 1 de 2026 en la BD.');
    await mongoose.disconnect(); process.exit(1);
  }

  log(`Periodo encontrado: ${periodo.nombre}`);
  log(`Fecha: ${periodo.fechaInicio} → ${periodo.fechaFin}`);
  log(`Activo: ${periodo.activo} ${periodo.activo ? '⚠ (sigue activo — se generarán boletines igual)' : '✓ cerrado'}`);

  // ── 2. Cargar datos base ───────────────────────────────────────────────────
  sep('CARGANDO DATOS BASE');

  // Mapa de usuarios (para nombre/apellido en boletín)
  let mapaMap = {};
  if (fs.existsSync(MAPA_PATH)) {
    const mapaArr = JSON.parse(fs.readFileSync(MAPA_PATH, 'utf8'));
    for (const e of mapaArr) mapaMap[e.estudianteId] = e;
    log(`Mapa cargado: ${mapaArr.length} estudiantes`);
  } else {
    warn('mapa_usuarios.json no encontrado — se usarán los datos de MongoDB directamente');
  }

  const materias   = await Materia.find({ activo: true }).lean();
  const grados     = await Grado.find({ año: AÑO }).lean();
  const asigs      = await AsignacionDocente.find({ año: AÑO, estado: 'activo' }).lean();
  const matriculas = await Matricula.find({ año: AÑO, estado: 'activa' }).lean();

  log(`Matrículas activas 2026: ${matriculas.length}`);
  log(`Grados: ${grados.length} | Materias: ${materias.length}`);

  if (matriculas.length === 0) {
    console.error('❌ Sin matrículas para 2026.');
    await mongoose.disconnect(); process.exit(1);
  }

  // Índices en memoria
  const gradoIdx = {};
  for (const g of grados) gradoIdx[g._id.toString()] = g;

  const materiaIdx = {};
  for (const m of materias) materiaIdx[m._id.toString()] = m;

  const asigIdx = {};
  for (const a of asigs) asigIdx[`${a.gradoId}-${a.materiaId}`] = a.docenteId;

  // Nombres de docentes
  const docIds = [...new Set(Object.values(asigIdx).map(String))];
  const docs   = await Usuario.find({ _id: { $in: docIds } })
    .select('_id nombre apellido').lean();
  const docenteNombreMap = {};
  for (const d of docs) docenteNombreMap[d._id.toString()] = `${d.nombre} ${d.apellido}`;

  // Datos de estudiantes desde MongoDB (nombre real para el boletín)
  const estudiantesIds = matriculas.map(m => m.estudianteId);
  const estudiantesDB  = await Usuario.find({ _id: { $in: estudiantesIds } })
    .select('_id nombre apellido').lean();
  const estudianteDbMap = {};
  for (const e of estudiantesDB) estudianteDbMap[e._id.toString()] = e;

  // ── 3. Verificar notas existentes para P1 2026 ────────────────────────────
  sep('VERIFICANDO NOTAS P1 2026');
  const totalNotasP1 = await Nota.countDocuments({ año: AÑO, periodoId: periodo._id });
  log(`Notas encontradas en P1 2026: ${totalNotasP1}`);
  if (totalNotasP1 === 0) {
    warn('No hay notas en P1 2026. Los boletines quedarán vacíos.');
  }

  // ── 4. Generar ResultadoPeriodo y Boletines ────────────────────────────────
  sep('GENERANDO ResultadoPeriodo + Boletines');

  const rpOps      = [];
  const boletines  = [];
  let   procesados = 0;
  let   omitidos   = 0;

  for (const matricula of matriculas) {
    const eid    = matricula.estudianteId.toString();
    const grado  = gradoIdx[matricula.gradoId.toString()];

    if (!grado) {
      warn(`Grado no encontrado para matrícula de ${eid}`);
      omitidos++;
      continue;
    }

    // Datos del estudiante — preferir MongoDB (más fiable que el mapa)
    const estDB   = estudianteDbMap[eid];
    const nombre  = estDB?.nombre   || mapaMap[eid]?.nombre   || 'Sin nombre';
    const apellido= estDB?.apellido || mapaMap[eid]?.apellido || '';

    const materiasBoletín = [];
    let   sumaGeneral = 0;
    let   cntGeneral  = 0;

    for (const materiaId of (grado.materias || [])) {
      const mid    = materiaId.toString();
      const matObj = materiaIdx[mid];
      if (!matObj) continue;

      // Notas del estudiante en esta materia en P1 2026
      const notasDoc = await Nota.find({
        estudianteId: matricula.estudianteId,
        materiaId,
        periodoId:    periodo._id,
        año:          AÑO,
      }).select('valor').lean();

      if (notasDoc.length === 0) continue;

      const valores  = notasDoc.map(n => n.valor);
      const promedio = Math.round(
        (valores.reduce((a, b) => a + b, 0) / valores.length) * 100
      ) / 100;
      const aprobado = promedio >= APROBACION;

      // ResultadoPeriodo
      rpOps.push({
        updateOne: {
          filter: {
            estudianteId: matricula.estudianteId,
            materiaId,
            periodoId:    periodo._id,
          },
          update: {
            $set: {
              gradoId:  matricula.gradoId,
              año:      AÑO,
              promedio,
              aprobado,
            },
          },
          upsert: true,
        },
      });

      sumaGeneral += promedio;
      cntGeneral++;

      const docKey = `${matricula.gradoId}-${mid}`;
      const docId  = asigIdx[docKey];

      materiasBoletín.push({
        materiaId,
        nombreMateria:  matObj.nombre,
        notas:          [],
        promedio,
        aprobado,
        nombreDocente:  docId ? (docenteNombreMap[docId.toString()] || '') : '',
      });
    }

    if (cntGeneral === 0) {
      omitidos++;
      continue;
    }

    const promedioGeneral = Math.round((sumaGeneral / cntGeneral) * 100) / 100;
    const aprobadoGeneral = promedioGeneral >= APROBACION;

    boletines.push({
      estudianteId:       matricula.estudianteId,
      gradoId:            matricula.gradoId,
      periodoId:          periodo._id,
      año:                AÑO,
      nombreEstudiante:   nombre,
      apellidoEstudiante: apellido,
      nombreGrado:        grado.nombre,
      nivelGrado:         grado.nivel,
      nombrePeriodo:      periodo.nombre,
      numeroPeriodo:      periodo.numero,
      materias:           materiasBoletín,
      promedioGeneral,
      aprobadoGeneral,
      generadoEn:         new Date(periodo.fechaFin),
    });

    procesados++;
  }

  // ── 5. Insertar en BD ──────────────────────────────────────────────────────
  sep('INSERTANDO EN BASE DE DATOS');

  // ResultadoPeriodo (upsert — seguro de re-correr)
  if (rpOps.length > 0) {
    await ResultadoPeriodo.bulkWrite(rpOps, { ordered: false });
    log(`ResultadoPeriodo: ${rpOps.length} registros insertados/actualizados`);
  }

  // Boletines (solo inserta los que no existen)
  let boletinesInsertados = 0;
  if (boletines.length > 0) {
    try {
      const res = await Boletin.insertMany(boletines, {
        ordered:   false,
        rawResult: true,
      });
      boletinesInsertados = res.insertedCount ?? boletines.length;
    } catch (e) {
      // Duplicados esperados si se re-corre — los ignora
      boletinesInsertados = e.result?.nInserted ?? 0;
      if (e.code !== 11000 && !e.message?.includes('duplicate')) {
        warn(`Error inesperado al insertar boletines: ${e.message}`);
      }
    }
    log(`Boletines insertados: ${boletinesInsertados} de ${boletines.length} intentados`);
  }

  // ── 6. Verificación rápida ─────────────────────────────────────────────────
  sep('VERIFICACIÓN');
  const totalRp  = await ResultadoPeriodo.countDocuments({ año: AÑO, periodoId: periodo._id });
  const totalBol = await Boletin.countDocuments({ año: AÑO, periodoId: periodo._id });
  const reprobados = await ResultadoPeriodo.countDocuments({
    año: AÑO, periodoId: periodo._id, aprobado: false,
  });

  log(`ResultadoPeriodo en BD: ${totalRp}`);
  log(`Boletines en BD:        ${totalBol}`);
  log(`Estudiantes reprobaron al menos 1 materia: ${reprobados}`);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  seed_boletines_p1_2026.js completado ✓               ║');
  console.log('║                                                        ║');
  console.log(`║  Estudiantes procesados : ${String(procesados).padEnd(29)}║`);
  console.log(`║  Omitidos (sin notas)   : ${String(omitidos).padEnd(29)}║`);
  console.log(`║  ResultadoPeriodo       : ${String(totalRp).padEnd(29)}║`);
  console.log(`║  Boletines generados    : ${String(totalBol).padEnd(29)}║`);
  console.log('║                                                        ║');
  console.log('║  Los boletines del P1 2026 ya están disponibles       ║');
  console.log('║  en el módulo de boletines del sistema. ✓             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_boletines_p1_2026.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
