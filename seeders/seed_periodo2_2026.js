/**
 * seeders/seed_periodo2_2026.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Elimina los periodos 2, 3 y 4 de 2026 (fueron creados por error).
 * 2. Crea el Periodo 2 de 2026 como nuevo y activo (hasta junio).
 * 3. Genera actividades con rango VARIABLE de 1–4 por materia (realista).
 * 4. Crea EntregaActividad y Nota por cada estudiante matriculado.
 *
 * NOTAS IMPORTANTES:
 *   - El Periodo 1 de 2026 ya está cerrado (activo: false) — NO se toca.
 *   - El Periodo 2 queda activo: true → notas modificable: true.
 *   - No se genera ResultadoPeriodo ni Boletin (el periodo está abierto).
 *
 * REQUISITOS:
 *   seed_matriculas_2026.js ejecutado.
 *   mapa_usuarios.json existe (node seeders/generar_mapa.js).
 *
 * Uso:
 *   node seeders/seed_periodo2_2026.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

const {
  Periodo,
  Grado,
  Materia,
  Matricula,
  AsignacionDocente,
  Actividad,
  EntregaActividad,
  Nota,
  Usuario,
} = require('../models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const MAPA_PATH = path.resolve(__dirname, 'mapa_usuarios.json');
const AÑO       = 2026;
const NUM_P     = 2;

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
const MULT_PERFIL = { reprobador: 4.0, promedio: 1.0, bueno: 0.2 };

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

function generarFactorAño(perfil) {
  const r = Math.random();
  switch (perfil) {
    case 'reprobador': return -0.2 + r * 1.0;
    case 'promedio':   return -0.5 + r * 1.0;
    case 'bueno':      return -0.6 + r * 0.8;
    default:           return -0.3 + r * 0.6;
  }
}

function fechaEnRango(inicio, fin) {
  const i = inicio.getTime();
  const f = fin.getTime();
  return new Date(i + Math.random() * (f - i));
}

function fechaLimiteAct(inicio, fin, idx, total) {
  const slot  = (fin.getTime() - inicio.getTime()) / total;
  const punto = inicio.getTime() + slot * idx + slot * 0.75;
  return new Date(Math.min(punto, fin.getTime() - 86_400_000));
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       KLASSY — seed_periodo2_2026.js                  ║');
  console.log('║  Limpia P2/P3/P4 de 2026 · Crea P2 abierto · Notas   ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  if (!fs.existsSync(MAPA_PATH)) {
    console.error(`\n❌ No se encontró mapa_usuarios.json en: ${MAPA_PATH}`);
    console.error('   Ejecuta primero: node seeders/generar_mapa.js\n');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  log('Conexión establecida');

  // ── PASO 1: Verificar P1 2026 ──────────────────────────────────────────────
  sep('VERIFICANDO PERIODO 1 DE 2026');
  const p1 = await Periodo.findOne({ año: AÑO, numero: 1 }).lean();
  if (!p1) {
    console.error('❌ No existe el Periodo 1 de 2026. Verifica los seeders anteriores.');
    await mongoose.disconnect();
    process.exit(1);
  }
  log(`P1 2026 encontrado: ${p1.nombre} — activo: ${p1.activo}`);
  if (p1.activo) {
    warn('El Periodo 1 de 2026 sigue activo. ¿Ya lo cerraste? Continuando de todas formas...');
  }

  // ── PASO 2: Eliminar periodos 2, 3 y 4 de 2026 ────────────────────────────
  sep('ELIMINANDO PERIODOS INCORRECTOS (P2, P3, P4 de 2026)');

  const periodosAEliminar = await Periodo.find({
    año:    AÑO,
    numero: { $in: [2, 3, 4] },
  }).lean();

  if (periodosAEliminar.length === 0) {
    log('No se encontraron periodos 2, 3 o 4 de 2026 — ya fueron eliminados o no existen.');
  } else {
    const idsEliminar = periodosAEliminar.map(p => p._id);

    // Eliminar actividades huérfanas que apuntaban a esos periodos
    const actsEliminadas = await Actividad.deleteMany({
      periodoId: { $in: idsEliminar },
    });
    log(`Actividades huérfanas eliminadas: ${actsEliminadas.deletedCount}`);

    // Eliminar notas huérfanas
    const notasEliminadas = await Nota.deleteMany({
      periodoId: { $in: idsEliminar },
    });
    log(`Notas huérfanas eliminadas: ${notasEliminadas.deletedCount}`);

    // Eliminar los periodos
    const result = await Periodo.deleteMany({ _id: { $in: idsEliminar } });
    log(`Periodos eliminados: ${result.deletedCount} (P2, P3, P4 de 2026)`);
  }

  // ── PASO 3: Crear Periodo 2 de 2026 (abierto hasta junio) ─────────────────
  sep('CREANDO PERIODO 2 DE 2026');

  const p2Nuevo = await Periodo.findOneAndUpdate(
    { año: AÑO, numero: NUM_P },
    {
      $set: {
        nombre:      'Segundo Periodo',
        fechaInicio: new Date('2026-03-30'),
        fechaFin:    new Date('2026-06-05'),
        activo:      true,   // año en curso — NO se cierra
      },
    },
    { upsert: true, new: true }
  );
  log(`Periodo 2 creado: ${p2Nuevo.nombre} (${p2Nuevo.fechaInicio.toISOString().slice(0,10)} → ${p2Nuevo.fechaFin.toISOString().slice(0,10)}) activo: ${p2Nuevo.activo}`);

  // ── PASO 4: Cargar datos base ──────────────────────────────────────────────
  sep('CARGANDO DATOS BASE');

  const mapaArr = JSON.parse(fs.readFileSync(MAPA_PATH, 'utf8'));
  const mapaMap = {};
  for (const e of mapaArr) mapaMap[e.estudianteId] = e;
  log(`Mapa: ${mapaArr.length} estudiantes`);

  const materias    = await Materia.find({ activo: true }).lean();
  const grados      = await Grado.find({ año: AÑO }).lean();
  const asigs       = await AsignacionDocente.find({ año: AÑO, estado: 'activo' }).lean();
  const matriculas  = await Matricula.find({ año: AÑO, estado: 'activa' }).lean();

  log(`Grados: ${grados.length} | Matrículas: ${matriculas.length} | Materias: ${materias.length}`);

  if (matriculas.length === 0) {
    console.error('❌ Sin matrículas para 2026. Ejecuta seed_matriculas_2026.js primero.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Índices en memoria
  const asigIdx = {};
  for (const a of asigs) asigIdx[`${a.gradoId}-${a.materiaId}`] = a.docenteId;

  const matriculaIdx = {};
  for (const m of matriculas) {
    matriculaIdx[m.estudianteId.toString()] = {
      gradoId:        m.gradoId,
      nivelAcademico: m.nivelAcademico,
    };
  }

  const estPorGrado = {};
  for (const [eid, m] of Object.entries(matriculaIdx)) {
    const gid = m.gradoId.toString();
    if (!estPorGrado[gid]) estPorGrado[gid] = [];
    estPorGrado[gid].push(eid);
  }

  // Factor de año P2 para cada estudiante (diferente al de P1)
  const factoresAño = {};
  for (const eid of Object.keys(matriculaIdx)) {
    const info   = mapaMap[eid];
    const perfil = info?.perfil || 'promedio';
    factoresAño[eid] = generarFactorAño(perfil);
  }

  // Factor del periodo P2 (leve variación global)
  const fPeriodo = -0.3 + Math.random() * 0.6;
  log(`Factor periodo P2: ${fPeriodo.toFixed(3)}`);

  const pInicio = new Date(p2Nuevo.fechaInicio);
  const pFin    = new Date(p2Nuevo.fechaFin);

  // ── PASO 5: Generar actividades, entregas y notas ─────────────────────────
  sep('GENERANDO ACTIVIDADES · ENTREGAS · NOTAS (P2 2026)');

  const cont = { actividades: 0, entregas: 0, notas: 0, gradosSinEst: 0 };

  for (const grado of grados) {
    const gid    = grado._id.toString();
    const nivel  = grado.nivel;
    const estIds = estPorGrado[gid] || [];

    if (estIds.length === 0) {
      cont.gradosSinEst++;
      continue;
    }

    for (const materia of materias) {
      const mid       = materia._id.toString();
      const docenteId = asigIdx[`${gid}-${mid}`];
      if (!docenteId) continue;

      // ── RANGO VARIABLE de actividades: 1 a 4 por materia ──────────────────
      const cantActividades = Math.floor(Math.random() * 4) + 1; // 1, 2, 3 o 4

      const actOps = [];
      for (let ai = 0; ai < cantActividades; ai++) {
        const titulo      = `Act. ${ai + 1} — ${materia.nombre} P2`;
        const fechaLimite = fechaLimiteAct(pInicio, pFin, ai, cantActividades);
        // Si la fecha límite ya pasó → cerrada, si no → abierta
        const estadoAct   = fechaLimite < new Date() ? 'cerrada' : 'abierta';

        actOps.push({
          updateOne: {
            filter: {
              docenteId,
              gradoId:   grado._id,
              materiaId: materia._id,
              periodoId: p2Nuevo._id,
              titulo,
            },
            update: {
              $setOnInsert: {
                docenteId,
                gradoId:     grado._id,
                materiaId:   materia._id,
                periodoId:   p2Nuevo._id,
                titulo,
                descripcion: `Actividad ${ai + 1} del Segundo Periodo 2026 — ${materia.nombre}.`,
                fechaLimite,
                estado:      estadoAct,
                archivos:    [],
                comentarios: [],
              },
            },
            upsert: true,
          },
        });
      }

      await Actividad.bulkWrite(actOps, { ordered: false });
      cont.actividades += cantActividades;

      // Recuperar las actividades creadas
      const actividadesCreadas = await Actividad.find({
        docenteId,
        gradoId:   grado._id,
        materiaId: materia._id,
        periodoId: p2Nuevo._id,
      }).select('_id fechaLimite estado').lean();

      // ── Entregas ───────────────────────────────────────────────────────────
      const entregasDocs = [];

      for (const actividadDoc of actividadesCreadas) {
        const esCerrada = actividadDoc.estado === 'cerrada';

        for (const eid of estIds) {
          // Actividades cerradas: todos entregan
          // Actividades abiertas: ~65% ha entregado (año en curso)
          if (!esCerrada && Math.random() > 0.65) continue;

          const info    = mapaMap[eid];
          const perfil  = info?.perfil || 'promedio';
          const factAño = factoresAño[eid] ?? 0;
          const valor   = generarNota(perfil, nivel, factAño, fPeriodo);
          const fechaE  = esCerrada
            ? fechaEnRango(pInicio, actividadDoc.fechaLimite)
            : fechaEnRango(pInicio, new Date());

          entregasDocs.push({
            actividadId:       actividadDoc._id,
            estudianteId:      new mongoose.Types.ObjectId(eid),
            contenidoTexto:    `Entrega P2 2026 — ${materia.nombre}.`,
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
        periodoId:          p2Nuevo._id,
        actividadId:        eg.actividadId,
        entregaActividadId: eg._id,
        año:                AÑO,
        valor:              eg.nota,
        modificable:        true,  // periodo activo → editable
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
        periodoId:   p2Nuevo._id,
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
    }
  }

  log(`Grados sin estudiantes matriculados: ${cont.gradosSinEst}`);

  // ── PASO 6: Distribución por nivel ────────────────────────────────────────
  sep('DISTRIBUCIÓN DE NOTAS P2 2026 POR NIVEL');
  for (let nivel = 1; nivel <= 11; nivel++) {
    const gradosNivel = grados.filter(g => g.nivel === nivel).map(g => g._id);
    const notasNivel  = await Nota.find({
      año:      AÑO,
      periodoId: p2Nuevo._id,
      gradoId:  { $in: gradosNivel },
    }).select('valor').lean();

    if (notasNivel.length === 0) continue;
    const suma    = notasNivel.reduce((a, n) => a + n.valor, 0);
    const prom    = (suma / notasNivel.length).toFixed(2);
    const bajas   = notasNivel.filter(n => n.valor < 3.0).length;
    const pctBaja = ((bajas / notasNivel.length) * 100).toFixed(1);
    log(`Nivel ${String(nivel).padStart(2)}°: ${notasNivel.length} notas | promedio ${prom} | <3.0: ${pctBaja}%`);
  }

  // ── Resumen final ──────────────────────────────────────────────────────────
  const totalActsP2 = await Actividad.countDocuments({ periodoId: p2Nuevo._id });
  const totalNotasP2= await Nota.countDocuments({ periodoId: p2Nuevo._id, año: AÑO });

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  seed_periodo2_2026.js completado ✓                   ║');
  console.log('║                                                        ║');
  console.log(`║  Periodos eliminados  : P2, P3, P4 de 2026            ║`);
  console.log(`║  Periodo 2 creado     : 30 mar → 05 jun 2026 (abierto)║`);
  console.log(`║  Actividades P2       : ${String(totalActsP2).padEnd(30)}║`);
  console.log(`║  Entregas P2          : ${String(cont.entregas).padEnd(30)}║`);
  console.log(`║  Notas P2             : ${String(totalNotasP2).padEnd(30)}║`);
  console.log('║  ResultadoPeriodo     : 0 (periodo abierto)           ║');
  console.log('║  Boletines            : 0 (periodo abierto)           ║');
  console.log('║                                                        ║');
  console.log('║  Estado del sistema 2026:                             ║');
  console.log('║    P1 → cerrado ✓                                     ║');
  console.log('║    P2 → activo, notas parciales ✓                     ║');
  console.log('║    P3, P4 → eliminados ✓                              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_periodo2_2026.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
