/**
 * seeders/seed_año2025.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera para el año 2025 (4 periodos completos):
 *   • 4 Actividades por materia × periodo × grado
 *   • 1 EntregaActividad por estudiante por actividad
 *   • 1 Nota por entrega
 *   • ResultadoPeriodo al cerrar cada periodo
 *   • Boletin por estudiante por periodo
 *   • ResultadoAnual al cerrar el año
 *
 * VARIACIÓN ANUAL — diferencia clave vs seed_año2024.js:
 *   Cada estudiante recibe un "factorAño" aleatorio al inicio del seed.
 *   Este factor desplaza su rango de notas ligeramente arriba o abajo,
 *   simulando que un año académico puede ser mejor o peor que el anterior
 *   sin que el estudiante cambie de perfil.
 *
 *   Ejemplos:
 *     - Estudiante "promedio" con factorAño +0.4 → notas más altas este año
 *     - Estudiante "bueno"    con factorAño -0.5 → año difícil, notas más bajas
 *     - Estudiante "reprobador" con factorAño +0.6 → mejoró notablemente
 *
 *   Además, las actividades de periodos distintos tienen ligera variación
 *   dentro del mismo año (un estudiante puede ir mejor en P1 que en P3).
 *
 * REQUISITOS PREVIOS:
 *   seed_matriculas_2025.js ejecutado.
 *   generar_mapa.js ejecutado (mapa_usuarios.json existe).
 *
 * Uso:
 *   node seeders/seed_año2025.js
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
  ResultadoPeriodo,
  ResultadoAnual,
  Boletin,
} = require('../models');

const MONGO_URI          = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const MAPA_PATH          = path.resolve(__dirname, 'mapa_usuarios.json');
const AÑO                = 2025;
const ACTS_X_MAT_PERIODO = 4;
const APROBACION         = 3.0;

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

/**
 * Genera el "factor de año" para cada estudiante.
 * Es un desplazamiento en notas, diferente cada año.
 * Rangos por perfil (para mantener coherencia con el perfil base):
 *   reprobador: -0.2 a +0.8  (puede mejorar bastante en un año)
 *   promedio:   -0.5 a +0.5  (fluctúa en ambas direcciones)
 *   bueno:      -0.6 a +0.2  (puede tener un año difícil)
 */
function generarFactorAño(perfil) {
  const r = Math.random();
  switch (perfil) {
    case 'reprobador': return -0.2 + r * 1.0;   // -0.2 a +0.8
    case 'promedio':   return -0.5 + r * 1.0;   // -0.5 a +0.5
    case 'bueno':      return -0.6 + r * 0.8;   // -0.6 a +0.2
    default:           return -0.3 + r * 0.6;
  }
}

/**
 * Factor adicional por periodo — simula que un estudiante va mejor o peor
 * en distintos periodos del año (exámenes, carga académica, etc.)
 * Es un ajuste pequeño: -0.3 a +0.3
 */
function factorPeriodo() {
  return -0.3 + Math.random() * 0.6;
}

/**
 * Genera una nota combinando perfil + nivel + factorAño + factorPeriodo.
 */
function generarNota(perfil, nivel, factorAño, factPeriodo) {
  const tasaBase = TASA_POR_NIVEL[nivel] ?? 0.10;
  const mult     = MULT_PERFIL[perfil]   ?? 1.0;

  // El factor año puede reducir o aumentar la probabilidad de nota baja
  // Un factorAño positivo → estudiante con mejor año → menor prob. de reprobar
  const ajusteTasa = Math.max(0.02, mult * tasaBase * (1 - factorAño * 0.5));
  const probBaja   = Math.min(ajusteTasa, 0.92);
  const r          = Math.random();

  let valor;
  if (r < probBaja) {
    // Nota baja 1.0 – 2.9
    valor = 1.0 + Math.random() * 1.9;
  } else {
    // Nota aprobatoria con desplazamiento por factores
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
  console.log('║           KLASSY — seed_año2025.js                    ║');
  console.log('║   Actividades · Entregas · Notas · Cierres 2025       ║');
  console.log('║   Con variación anual por estudiante                  ║');
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

  const periodos  = await Periodo.find({ año: AÑO }).sort({ numero: 1 }).lean();
  const materias  = await Materia.find({ activo: true }).lean();
  const grados    = await Grado.find({ año: AÑO }).lean();
  const asigs     = await AsignacionDocente.find({ año: AÑO, estado: 'activo' }).lean();
  const matriculas= await Matricula.find({ año: AÑO, estado: 'activa' }).lean();

  log(`Periodos: ${periodos.length} | Grados: ${grados.length} | Matrículas: ${matriculas.length}`);

  if (periodos.length === 0 || grados.length === 0 || matriculas.length === 0) {
    console.error('❌ Faltan datos base. Verifica seed_catalogo.js y seed_matriculas_2025.js');
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

  const materiaIdx = {};
  for (const m of materias) materiaIdx[m._id.toString()] = m;

  const estPorGrado = {};
  for (const [eid, m] of Object.entries(matriculaIdx)) {
    const gid = m.gradoId.toString();
    if (!estPorGrado[gid]) estPorGrado[gid] = [];
    estPorGrado[gid].push(eid);
  }

  // Nombres de docentes para boletines
  const docenteNombres = {};
  const docIds = [...new Set(Object.values(asigIdx).map(String))];
  const docs   = await Usuario.find({ _id: { $in: docIds } })
    .select('_id nombre apellido').lean();
  for (const d of docs) docenteNombres[d._id.toString()] = `${d.nombre} ${d.apellido}`;

  // ── Generar factorAño por estudiante ───────────────────────────────────────
  // Cada estudiante tiene un único factor para todo el año 2025
  sep('GENERANDO FACTORES DE AÑO');
  const factoresAño = {};
  for (const eid of Object.keys(matriculaIdx)) {
    const info   = mapaMap[eid];
    const perfil = info?.perfil || 'promedio';
    factoresAño[eid] = generarFactorAño(perfil);
  }
  const factoresPositivos = Object.values(factoresAño).filter(f => f > 0).length;
  const factoresNegativos = Object.values(factoresAño).filter(f => f < 0).length;
  log(`Factores generados: ${factoresPositivos} positivos (mejor año) | ${factoresNegativos} negativos (peor año)`);

  // ── Acumulador de notas ────────────────────────────────────────────────────
  const notasAcum = {};
  for (const p of periodos) notasAcum[p._id.toString()] = {};

  const cont = { actividades: 0, entregas: 0, notas: 0 };

  // ── Procesar periodo a periodo ─────────────────────────────────────────────
  for (const periodo of periodos) {
    sep(`PERIODO ${periodo.numero}: ${periodo.nombre} (${AÑO})`);
    const pInicio  = new Date(periodo.fechaInicio);
    const pFin     = new Date(periodo.fechaFin);
    const pid      = periodo._id.toString();
    const fPeriodo = factorPeriodo(); // factor del periodo para todos los estudiantes

    for (const grado of grados) {
      const gid    = grado._id.toString();
      const nivel  = grado.nivel;
      const estIds = estPorGrado[gid] || [];
      if (estIds.length === 0) continue;

      for (const materia of materias) {
        const mid       = materia._id.toString();
        const docenteId = asigIdx[`${gid}-${mid}`];
        if (!docenteId) continue;

        // ── Actividades ───────────────────────────────────────────────────
        const actOps = [];
        for (let ai = 0; ai < ACTS_X_MAT_PERIODO; ai++) {
          const titulo      = `Act. ${ai + 1} — ${materia.nombre} P${periodo.numero}`;
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
                  descripcion: `Actividad ${ai + 1} del ${periodo.nombre} — ${materia.nombre}.`,
                  fechaLimite,
                  estado:      'cerrada',
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
        }).select('_id fechaLimite').lean();

        // ── Entregas ──────────────────────────────────────────────────────
        const entregasDocs = [];

        for (const actividadDoc of actividadesCreadas) {
          for (const eid of estIds) {
            const info     = mapaMap[eid];
            const perfil   = info?.perfil  || 'promedio';
            const factAño  = factoresAño[eid] ?? 0;
            const valor    = generarNota(perfil, nivel, factAño, fPeriodo);
            const fechaE   = fechaEnRango(pInicio, actividadDoc.fechaLimite);

            entregasDocs.push({
              actividadId:       actividadDoc._id,
              estudianteId:      new mongoose.Types.ObjectId(eid),
              contenidoTexto:    `Entrega automática — ${materia.nombre} P${periodo.numero}.`,
              archivos:          [],
              fechaEntrega:      fechaE,
              estado:            'calificada',
              nota:              valor,
              comentarioDocente: '',
              notaId:            null,
              createdAt:         fechaE,
              updatedAt:         fechaE,
            });

            // Acumular para ResultadoPeriodo
            if (!notasAcum[pid][eid])      notasAcum[pid][eid] = {};
            if (!notasAcum[pid][eid][mid]) notasAcum[pid][eid][mid] = [];
            notasAcum[pid][eid][mid].push(valor);
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

        // ── Notas ─────────────────────────────────────────────────────────
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
          modificable:        false,
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

    log(`P${periodo.numero}: actividades=${cont.actividades} | entregas=${cont.entregas} | notas=${cont.notas}`);
  } // fin periodos

  // ── Cerrar periodos → ResultadoPeriodo + Boletines ─────────────────────────
  sep('CIERRE DE PERIODOS → ResultadoPeriodo + Boletines');

  for (const periodo of periodos) {
    const pid   = periodo._id.toString();
    const pData = notasAcum[pid] || {};

    const rpOps     = [];
    const boletines = [];

    for (const [eid, materiaNotas] of Object.entries(pData)) {
      const matric = matriculaIdx[eid];
      if (!matric) continue;
      const grado  = gradoIdx[matric.gradoId.toString()];
      if (!grado)  continue;

      const materiasBoletín = [];
      let sumaG = 0, cntG = 0;

      for (const [mid, valores] of Object.entries(materiaNotas)) {
        if (!valores.length) continue;
        const promedio = Math.round(
          (valores.reduce((a, b) => a + b, 0) / valores.length) * 100
        ) / 100;
        const aprobado = promedio >= APROBACION;

        rpOps.push({
          updateOne: {
            filter: {
              estudianteId: new mongoose.Types.ObjectId(eid),
              materiaId:    new mongoose.Types.ObjectId(mid),
              periodoId:    periodo._id,
            },
            update: {
              $set: { gradoId: matric.gradoId, año: AÑO, promedio, aprobado },
            },
            upsert: true,
          },
        });

        sumaG += promedio;
        cntG++;

        const matObj = materiaIdx[mid];
        const docKey = `${matric.gradoId}-${mid}`;
        const docId  = asigIdx[docKey];
        materiasBoletín.push({
          materiaId:     new mongoose.Types.ObjectId(mid),
          nombreMateria: matObj?.nombre || mid,
          notas:         [],
          promedio,
          aprobado,
          nombreDocente: docId ? (docenteNombres[docId.toString()] || '') : '',
        });
      }

      if (!cntG) continue;
      const promedioGeneral = Math.round((sumaG / cntG) * 100) / 100;
      const aprobadoGeneral = promedioGeneral >= APROBACION;

      boletines.push({
        estudianteId:       new mongoose.Types.ObjectId(eid),
        gradoId:            matric.gradoId,
        periodoId:          periodo._id,
        año:                AÑO,
        nombreEstudiante:   mapaMap[eid]?.nombre   || '',
        apellidoEstudiante: mapaMap[eid]?.apellido || '',
        nombreGrado:        grado.nombre,
        nivelGrado:         grado.nivel,
        nombrePeriodo:      periodo.nombre,
        numeroPeriodo:      periodo.numero,
        materias:           materiasBoletín,
        promedioGeneral,
        aprobadoGeneral,
        generadoEn:         new Date(periodo.fechaFin),
      });
    }

    if (rpOps.length > 0) await ResultadoPeriodo.bulkWrite(rpOps, { ordered: false });
    if (boletines.length > 0) {
      try { await Boletin.insertMany(boletines, { ordered: false }); } catch (_) {}
    }
    await Periodo.updateOne({ _id: periodo._id }, { $set: { activo: false } });
    log(`Periodo ${periodo.numero} cerrado — ${rpOps.length} ResultadoPeriodo | ${boletines.length} Boletines`);
  }

  // ── ResultadoAnual 2025 ────────────────────────────────────────────────────
  sep('CIERRE DE AÑO → ResultadoAnual');

  const rpAnual = await ResultadoPeriodo.find({ año: AÑO }).lean();
  const rpGrupo = {};
  for (const rp of rpAnual) {
    const key = `${rp.estudianteId}-${rp.materiaId}`;
    if (!rpGrupo[key]) rpGrupo[key] = {
      rps: [], gradoId: rp.gradoId,
      estudianteId: rp.estudianteId, materiaId: rp.materiaId,
    };
    rpGrupo[key].rps.push(rp);
  }

  const raOps = [];
  for (const { rps, gradoId, estudianteId, materiaId } of Object.values(rpGrupo)) {
    const promedioAnual = Math.round(
      (rps.reduce((s, r) => s + r.promedio, 0) / rps.length) * 100
    ) / 100;
    const aprobado = rps.some(r => r.aprobado);
    raOps.push({
      updateOne: {
        filter: { estudianteId, materiaId, año: AÑO },
        update: { $set: { gradoId, aprobado, promedioAnual } },
        upsert: true,
      },
    });
  }
  if (raOps.length > 0) await ResultadoAnual.bulkWrite(raOps, { ordered: false });

  const totalRa = await ResultadoAnual.countDocuments({ año: AÑO });
  const reprob  = await ResultadoAnual.countDocuments({ año: AÑO, aprobado: false });
  log(`ResultadoAnual: ${totalRa} | Reprobaciones de materia: ${reprob}`);

  // ── Estadísticas de reprobación por nivel ─────────────────────────────────
  sep('ESTADÍSTICAS DE REPROBACIÓN POR NIVEL 2025');
  for (let nivel = 1; nivel <= 11; nivel++) {
    const gradosNivel = grados.filter(g => g.nivel === nivel).map(g => g._id);
    const totalEst    = Object.values(matriculaIdx).filter(
      m => gradosNivel.some(g => g.toString() === m.gradoId.toString())
    ).length;
    const reprobIds = await ResultadoAnual.distinct('estudianteId', {
      año: AÑO, aprobado: false, gradoId: { $in: gradosNivel },
    });
    const pct = totalEst > 0 ? ((reprobIds.length / totalEst) * 100).toFixed(1) : '0.0';
    log(`Nivel ${String(nivel).padStart(2)}°: ${reprobIds.length}/${totalEst} reprobaron ≥1 materia (${pct}%)`);
  }

  // ── Comparativa con 2024 ───────────────────────────────────────────────────
  sep('COMPARATIVA 2024 vs 2025');
  const reprob2024 = await ResultadoAnual.countDocuments({ año: 2024, aprobado: false });
  const reprob2025 = await ResultadoAnual.countDocuments({ año: 2025, aprobado: false });
  log(`Reprobaciones materia 2024: ${reprob2024}`);
  log(`Reprobaciones materia 2025: ${reprob2025} ${reprob2025 !== reprob2024 ? '← variación detectada ✓' : ''}`);

  // ── Resumen final ──────────────────────────────────────────────────────────
  const totalActs = await Actividad.countDocuments({ periodoId: { $in: periodos.map(p => p._id) } });
  const totalNot  = await Nota.countDocuments({ año: AÑO });
  const totalRp   = await ResultadoPeriodo.countDocuments({ año: AÑO });
  const totalBol  = await Boletin.countDocuments({ año: AÑO });

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  seed_año2025.js completado ✓                         ║');
  console.log('║                                                        ║');
  console.log(`║  Actividades     : ${String(totalActs).padEnd(35)}║`);
  console.log(`║  Notas           : ${String(totalNot).padEnd(35)}║`);
  console.log(`║  ResultadoPeriodo: ${String(totalRp).padEnd(35)}║`);
  console.log(`║  Boletines       : ${String(totalBol).padEnd(35)}║`);
  console.log(`║  ResultadoAnual  : ${String(totalRa).padEnd(35)}║`);
  console.log('║                                                        ║');
  console.log('║  Siguiente paso:                                       ║');
  console.log('║    node seeders/seed_matriculas_2026.js                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_año2025.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
