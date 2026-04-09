/**
 * seeders/seed_año2026.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera para el año 2026 SOLO el Primer Periodo (año en curso).
 *
 * El P1 de 2026 es el único periodo activo (activo: true en BD).
 * NO se cierra el periodo ni se genera ResultadoPeriodo ni ResultadoAnual —
 * el año está en curso. Esto representa el estado actual del sistema:
 *   • Las notas existen pero el periodo no ha cerrado.
 *   • Los boletines aún no se han generado.
 *   • Es exactamente el escenario que el módulo de ML debe predecir.
 *
 * Variación anual:
 *   Igual que 2025 — cada estudiante tiene un factorAño propio para 2026,
 *   diferente al de 2025, generando trayectorias únicas por estudiante.
 *   Hay un factorPeriodo global para P1 2026.
 *
 * REQUISITOS PREVIOS:
 *   seed_matriculas_2026.js ejecutado.
 *   generar_mapa.js ejecutado (mapa_usuarios.json existe).
 *
 * Uso:
 *   node seeders/seed_año2026.js
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
  Actividad,
  EntregaActividad,
  Nota,
} = require('../models');

const MONGO_URI          = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const MAPA_PATH          = path.resolve(__dirname, 'mapa_usuarios.json');
const AÑO                = 2026;
const ACTS_X_MAT_PERIODO = 4;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠  ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(2, 52 - t.length))}`);

// ── Tasas de reprobación por nivel ────────────────────────────────────────────
const TASA_POR_NIVEL = {
  1: 0.04, 2: 0.04,
  3: 0.07, 4: 0.07, 5: 0.07,
  6: 0.15, 7: 0.15, 8: 0.15,
  9: 0.05, 10: 0.05, 11: 0.05,
};

const MULT_PERFIL = {
  reprobador: 4.0,
  promedio:   1.0,
  bueno:      0.2,
};

function generarFactorAño(perfil) {
  const r = Math.random();
  switch (perfil) {
    case 'reprobador': return -0.2 + r * 1.0;
    case 'promedio':   return -0.5 + r * 1.0;
    case 'bueno':      return -0.6 + r * 0.8;
    default:           return -0.3 + r * 0.6;
  }
}

function factorPeriodo() {
  return -0.3 + Math.random() * 0.6;
}

function generarNota(perfil, nivel, factorAño, factPeriodo) {
  const tasaBase = TASA_POR_NIVEL[nivel] ?? 0.10;
  const mult     = MULT_PERFIL[perfil]   ?? 1.0;
  const ajuste   = Math.max(0.02, mult * tasaBase * (1 - factorAño * 0.5));
  const probBaja = Math.min(ajuste, 0.92);
  const r        = Math.random();

  let valor;
  if (r < probBaja) {
    valor = 1.0 + Math.random() * 1.9;
  } else {
    let base;
    switch (perfil) {
      case 'reprobador': base = 3.0 + Math.random() * 1.0; break;
      case 'promedio':   base = 3.0 + Math.random() * 1.5; break;
      case 'bueno':      base = 3.5 + Math.random() * 1.5; break;
      default:           base = 3.0 + Math.random() * 2.0;
    }
    valor = base + factorAño * 0.4 + factPeriodo * 0.3;
  }
  return Math.round(Math.min(5.0, Math.max(1.0, valor)) * 10) / 10;
}

function fechaEnRango(inicio, fin) {
  return new Date(inicio.getTime() + Math.random() * (fin.getTime() - inicio.getTime()));
}

function fechaLimiteAct(inicio, fin, idx, total) {
  const slot  = (fin.getTime() - inicio.getTime()) / total;
  const punto = inicio.getTime() + slot * idx + slot * 0.75;
  return new Date(Math.min(punto, fin.getTime() - 86_400_000));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           KLASSY — seed_año2026.js                    ║');
  console.log('║   Solo P1 — año en curso (datos parciales para ML)    ║');
  console.log('║   Actividades · Entregas · Notas                      ║');
  console.log('║   SIN cierre de periodo (activo: true se mantiene)    ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  if (!fs.existsSync(MAPA_PATH)) {
    console.error(`\n❌ No se encontró mapa_usuarios.json en: ${MAPA_PATH}`);
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  log('Conexión establecida');

  // ── Cargar datos base ──────────────────────────────────────────────────────
  sep('CARGANDO DATOS BASE');

  const mapaArr = JSON.parse(fs.readFileSync(MAPA_PATH, 'utf8'));
  const mapaMap = {};
  for (const e of mapaArr) mapaMap[e.estudianteId] = e;
  log(`Mapa: ${mapaArr.length} estudiantes`);

  // Solo P1 de 2026 (el único activo)
  const periodo = await Periodo.findOne({ año: AÑO, numero: 1 }).lean();
  if (!periodo) {
    console.error('❌ No se encontró el Periodo 1 de 2026. Ejecuta seed_catalogo.js primero.');
    await mongoose.disconnect();
    process.exit(1);
  }
  log(`Periodo encontrado: ${periodo.nombre} (${periodo.fechaInicio} → ${periodo.fechaFin}) activo: ${periodo.activo}`);

  const materias  = await Materia.find({ activo: true }).lean();
  const grados    = await Grado.find({ año: AÑO }).lean();
  const asigs     = await AsignacionDocente.find({ año: AÑO, estado: 'activo' }).lean();
  const matriculas= await Matricula.find({ año: AÑO, estado: 'activa' }).lean();

  log(`Grados: ${grados.length} | Matrículas activas: ${matriculas.length} | Materias: ${materias.length}`);

  if (grados.length === 0 || matriculas.length === 0) {
    console.error('❌ Faltan datos base. Ejecuta seed_matriculas_2026.js primero.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Índices en memoria ─────────────────────────────────────────────────────
  const asigIdx = {};
  for (const a of asigs) asigIdx[`${a.gradoId}-${a.materiaId}`] = a.docenteId;

  const matriculaIdx = {};
  for (const m of matriculas) {
    matriculaIdx[m.estudianteId.toString()] = {
      gradoId:        m.gradoId,
      nivelAcademico: m.nivelAcademico,
    };
  }

  const gradoIdx = {};
  for (const g of grados) gradoIdx[g._id.toString()] = g;

  const estPorGrado = {};
  for (const [eid, m] of Object.entries(matriculaIdx)) {
    const gid = m.gradoId.toString();
    if (!estPorGrado[gid]) estPorGrado[gid] = [];
    estPorGrado[gid].push(eid);
  }

  // ── Factores de año para 2026 (distintos a los de 2025) ───────────────────
  sep('GENERANDO FACTORES DE AÑO 2026');
  const factoresAño = {};
  for (const eid of Object.keys(matriculaIdx)) {
    const info   = mapaMap[eid];
    const perfil = info?.perfil || 'promedio';
    factoresAño[eid] = generarFactorAño(perfil);
  }
  const fPos = Object.values(factoresAño).filter(f => f > 0).length;
  const fNeg = Object.values(factoresAño).filter(f => f < 0).length;
  log(`Factores P1 2026: ${fPos} positivos | ${fNeg} negativos`);

  const fPeriodo = factorPeriodo();
  log(`Factor periodo P1 2026: ${fPeriodo.toFixed(3)}`);

  // ── Procesar P1 ───────────────────────────────────────────────────────────
  sep(`PROCESANDO: ${periodo.nombre} ${AÑO}`);
  const pInicio = new Date(periodo.fechaInicio);
  const pFin    = new Date(periodo.fechaFin);

  const cont = { actividades: 0, entregas: 0, notas: 0 };

  for (const grado of grados) {
    const gid    = grado._id.toString();
    const nivel  = grado.nivel;
    const estIds = estPorGrado[gid] || [];
    if (estIds.length === 0) continue;

    for (const materia of materias) {
      const mid       = materia._id.toString();
      const docenteId = asigIdx[`${gid}-${mid}`];
      if (!docenteId) continue;

      // ── Actividades ────────────────────────────────────────────────────────
      const actOps = [];
      for (let ai = 0; ai < ACTS_X_MAT_PERIODO; ai++) {
        const titulo      = `Act. ${ai + 1} — ${materia.nombre} P1`;
        const fechaLimite = fechaLimiteAct(pInicio, pFin, ai, ACTS_X_MAT_PERIODO);
        actOps.push({
          updateOne: {
            filter: {
              docenteId,
              gradoId:   grado._id,
              materiaId: materia._id,
              periodoId: periodo._id,
              titulo,
            },
            update: {
              $setOnInsert: {
                docenteId,
                gradoId:     grado._id,
                materiaId:   materia._id,
                periodoId:   periodo._id,
                titulo,
                descripcion: `Actividad ${ai + 1} del Primer Periodo 2026 — ${materia.nombre}.`,
                fechaLimite,
                // P1 2026: algunas actividades siguen abiertas (fecha límite futura)
                estado: fechaLimite < new Date() ? 'cerrada' : 'abierta',
                archivos:    [],
                comentarios: [],
              },
            },
            upsert: true,
          },
        });
      }
      await Actividad.bulkWrite(actOps, { ordered: false });
      cont.actividades += ACTS_X_MAT_PERIODO;

      const actividadesCreadas = await Actividad.find({
        docenteId,
        gradoId:   grado._id,
        materiaId: materia._id,
        periodoId: periodo._id,
      }).select('_id fechaLimite estado').lean();

      // ── Entregas ───────────────────────────────────────────────────────────
      // Solo se generan entregas para actividades ya cerradas
      // Las abiertas simulan que los estudiantes aún pueden entregar
      const actsCerradas = actividadesCreadas.filter(a => a.estado === 'cerrada');
      const actsAbiertas = actividadesCreadas.filter(a => a.estado === 'abierta');

      if (actsAbiertas.length > 0) {
        // Solo algunos estudiantes han entregado en actividades abiertas (~60%)
      }

      const entregasDocs = [];

      for (const actividadDoc of actsCerradas) {
        for (const eid of estIds) {
          const info    = mapaMap[eid];
          const perfil  = info?.perfil || 'promedio';
          const factAño = factoresAño[eid] ?? 0;
          const valor   = generarNota(perfil, nivel, factAño, fPeriodo);
          const fechaE  = fechaEnRango(pInicio, actividadDoc.fechaLimite);

          entregasDocs.push({
            actividadId:       actividadDoc._id,
            estudianteId:      new mongoose.Types.ObjectId(eid),
            contenidoTexto:    `Entrega P1 2026 — ${materia.nombre}.`,
            archivos:          [],
            fechaEntrega:      fechaE,
            estado:            'calificada',
            nota:              valor,
            comentarioDocente: '',
            notaId:            null,
            createdAt:         fechaE,
            updatedAt:         fechaE,
          });
        }
      }

      // Actividades abiertas: ~60% de estudiantes han entregado (simulación realista)
      for (const actividadDoc of actsAbiertas) {
        const estudiantesConEntrega = estIds.filter(() => Math.random() < 0.60);
        for (const eid of estudiantesConEntrega) {
          const info    = mapaMap[eid];
          const perfil  = info?.perfil || 'promedio';
          const factAño = factoresAño[eid] ?? 0;
          const valor   = generarNota(perfil, nivel, factAño, fPeriodo);
          const fechaE  = fechaEnRango(pInicio, new Date()); // entre inicio y hoy

          entregasDocs.push({
            actividadId:       actividadDoc._id,
            estudianteId:      new mongoose.Types.ObjectId(eid),
            contenidoTexto:    `Entrega parcial P1 2026 — ${materia.nombre}.`,
            archivos:          [],
            fechaEntrega:      fechaE,
            estado:            'calificada',
            nota:              valor,
            comentarioDocente: '',
            notaId:            null,
            createdAt:         fechaE,
            updatedAt:         fechaE,
          });
        }
      }

      if (entregasDocs.length > 0) {
        try {
          const res = await EntregaActividad.insertMany(entregasDocs, {
            ordered: false, rawResult: true,
          });
          cont.entregas += res.insertedCount ?? entregasDocs.length;
        } catch (e) {
          cont.entregas += e.result?.nInserted ?? 0;
        }
      }

      // ── Notas ─────────────────────────────────────────────────────────────
      const entregasGuardadas = await EntregaActividad.find({
        actividadId:  { $in: actividadesCreadas.map(a => a._id) },
        estudianteId: { $in: estIds.map(id => new mongoose.Types.ObjectId(id)) },
      }).select('_id actividadId estudianteId nota').lean();

      const notasDocs = entregasGuardadas.map(eg => ({
        estudianteId:       eg.estudianteId,
        docenteId:          new mongoose.Types.ObjectId(docenteId.toString()),
        materiaId:          materia._id,
        gradoId:            grado._id,
        periodoId:          periodo._id,
        actividadId:        eg.actividadId,
        entregaActividadId: eg._id,
        año:                AÑO,
        valor:              eg.nota,
        modificable:        true,  // periodo aún activo → notas modificables
        createdAt:          new Date(),
        updatedAt:          new Date(),
      }));

      if (notasDocs.length > 0) {
        try {
          const res = await Nota.insertMany(notasDocs, {
            ordered: false, rawResult: true,
          });
          cont.notas += res.insertedCount ?? notasDocs.length;
        } catch (e) {
          cont.notas += e.result?.nInserted ?? 0;
        }
      }

      // Vincular notaId en entregas
      const notasCreadas = await Nota.find({
        actividadId: { $in: actividadesCreadas.map(a => a._id) },
        periodoId:   periodo._id,
      }).select('_id entregaActividadId').lean();

      if (notasCreadas.length > 0) {
        await EntregaActividad.bulkWrite(
          notasCreadas.map(n => ({
            updateOne: {
              filter: { _id: n.entregaActividadId },
              update: { $set: { notaId: n._id } },
            },
          })),
          { ordered: false }
        );
      }
    } // fin materias
  } // fin grados

  // ── Estado del P1 2026 (NO cerrar — año en curso) ─────────────────────────
  sep('ESTADO DEL SISTEMA — AÑO EN CURSO');
  log(`Periodo ${periodo.nombre} 2026 → ACTIVO (no se cierra)`);
  log('ResultadoPeriodo → NO generado (periodo no ha cerrado)');
  log('ResultadoAnual   → NO generado (año en curso)');
  log('Boletines        → NO generados (requieren cierre de periodo)');
  log('Notas            → modificable: true (docentes aún pueden editar)');

  // ── Estadísticas de notas P1 2026 por nivel ────────────────────────────────
  sep('DISTRIBUCIÓN DE NOTAS P1 2026 POR NIVEL');
  for (let nivel = 1; nivel <= 11; nivel++) {
    const gradosNivel = grados.filter(g => g.nivel === nivel).map(g => g._id);
    const notasNivel  = await Nota.find({
      año:     AÑO,
      gradoId: { $in: gradosNivel },
    }).select('valor').lean();

    if (notasNivel.length === 0) continue;
    const suma    = notasNivel.reduce((a, n) => a + n.valor, 0);
    const prom    = (suma / notasNivel.length).toFixed(2);
    const bajas   = notasNivel.filter(n => n.valor < 3.0).length;
    const pctBaja = ((bajas / notasNivel.length) * 100).toFixed(1);
    log(`Nivel ${String(nivel).padStart(2)}°: ${notasNivel.length} notas | promedio ${prom} | notas <3.0: ${pctBaja}%`);
  }

  // ── Resumen final ──────────────────────────────────────────────────────────
  const totalActs = await Actividad.countDocuments({ periodoId: periodo._id });
  const totalNot  = await Nota.countDocuments({ año: AÑO });
  const totalEntr = await EntregaActividad.countDocuments({
    actividadId: { $in: await Actividad.distinct('_id', { periodoId: periodo._id }) },
  });

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  seed_año2026.js completado ✓                         ║');
  console.log('║                                                        ║');
  console.log(`║  Actividades P1  : ${String(totalActs).padEnd(35)}║`);
  console.log(`║  Entregas P1     : ${String(totalEntr).padEnd(35)}║`);
  console.log(`║  Notas P1        : ${String(totalNot).padEnd(35)}║`);
  console.log('║  ResultadoPeriodo: 0 (año en curso)                   ║');
  console.log('║  Boletines       : 0 (año en curso)                   ║');
  console.log('║                                                        ║');
  console.log('║  ✓ Dataset completo listo para el módulo de ML        ║');
  console.log('║                                                        ║');
  console.log('║  Resumen del dataset:                                  ║');
  console.log('║    2024 → 4 periodos cerrados + ResultadoAnual        ║');
  console.log('║    2025 → 4 periodos cerrados + ResultadoAnual        ║');
  console.log('║    2026 → P1 activo, notas parciales (para predecir)  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_año2026.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
