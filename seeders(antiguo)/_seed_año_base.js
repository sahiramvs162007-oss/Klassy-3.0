/**
 * seeders/_seed_año_base.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica compartida para seed_año2022.js, seed_año2023.js, seed_año2024.js.
 * No correr directamente — usar los wrappers de cada año.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const {
  Usuario, Materia, Grado, Periodo, Matricula,
  AsignacionDocente, Actividad, EntregaActividad,
  Nota, ResultadoPeriodo, ResultadoAnual, Boletin,
} = require('../models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const AÑO       = parseInt(process.env.SEED_AÑO || '2022', 10);
const ACTS_POR_MATERIA_PERIODO = 4;
const APROBACION_MIN           = 3.0;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`);

// ── Perfiles ──────────────────────────────────────────────────────────────────
function perfilDeIndice(idx) {
  if (idx < 66)  return 'reprobador';
  if (idx < 308) return 'promedio';
  return 'bueno';
}

function notaAleatoria(perfil) {
  const r = Math.random();
  let valor;
  switch (perfil) {
    case 'reprobador':
      valor = r < 0.70 ? 1.0 + Math.random() * 1.4 : 2.5 + Math.random() * 1.0;
      break;
    case 'promedio':
      valor = r < 0.15
        ? 2.0 + Math.random() * 0.9
        : r < 0.80 ? 3.0 + Math.random() * 1.4 : 4.4 + Math.random() * 0.6;
      break;
    case 'bueno':
    default:
      valor = r < 0.10 ? 3.0 + Math.random() * 0.5 : 3.5 + Math.random() * 1.5;
      break;
  }
  return Math.min(5.0, Math.max(1.0, Math.round(valor * 10) / 10));
}

function fechaDentroDelPeriodo(inicio, fin) {
  return new Date(inicio.getTime() + Math.random() * (fin.getTime() - inicio.getTime()));
}

function fechaLimiteActividad(inicio, fin, actIdx) {
  const slot = (fin.getTime() - inicio.getTime()) / ACTS_POR_MATERIA_PERIODO;
  const base = inicio.getTime() + slot * actIdx + slot * 0.7;
  return new Date(Math.min(base, fin.getTime() - 86400000));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const nextAño = AÑO + 1;
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║          KLASSY — seed_año${AÑO}.js                  ║`);
  console.log(`║  Actividades · Entregas · Notas · Cierres ${AÑO}      ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);

  await mongoose.connect(MONGO_URI);
  console.log(`\nConectado. Procesando año ${AÑO}...\n`);

  sep('CARGANDO DATOS BASE');
  const periodos    = await Periodo.find({ año: AÑO }).sort({ numero: 1 }).lean();
  const materias    = await Materia.find({ activo: true }).lean();
  const grados      = await Grado.find({ año: AÑO }).lean();
  const asignaciones= await AsignacionDocente.find({ año: AÑO, estado: 'activo' }).lean();

  const estudiantes = await Usuario.find({ rol: 'estudiante', activo: true })
    .sort({ createdAt: 1 }).select('_id nombre apellido').lean();

  const matriculas  = await Matricula.find({ año: AÑO, estado: 'activa' }).lean();

  const matriculaMap = {};
  for (const m of matriculas) matriculaMap[m.estudianteId.toString()] = m;

  const asigMap = {};
  for (const a of asignaciones) asigMap[`${a.gradoId}-${a.materiaId}`] = a.docenteId;

  const gradoMap   = {};
  for (const g of grados)   gradoMap[g._id.toString()] = g;

  const materiaMap = {};
  for (const m of materias) materiaMap[m._id.toString()] = m;

  const estIndice  = {};
  estudiantes.forEach((e, i) => { estIndice[e._id.toString()] = i; });

  log(`Periodos: ${periodos.length} | Grados: ${grados.length} | Estudiantes en matrículas: ${matriculas.length}`);

  // ── Cache de nombres de docentes ────────────────────────────────────────────
  const docenteNombreMap = {};
  for (const a of asignaciones) {
    const key = `${a.gradoId}-${a.materiaId}`;
    if (!docenteNombreMap[key]) {
      const doc = await Usuario.findById(a.docenteId).select('nombre apellido').lean();
      if (doc) docenteNombreMap[key] = `${doc.nombre} ${doc.apellido}`;
    }
  }

  // ── Acumulador de notas por periodo ─────────────────────────────────────────
  // notasAcum[periodoId][estudianteId][materiaId] = [valores]
  const notasAcum = {};
  for (const p of periodos) notasAcum[p._id.toString()] = {};

  const cont = { actividades: 0, entregas: 0, notas: 0, resultadosPeriodo: 0 };

  // ── Generar actividades, entregas y notas ───────────────────────────────────
  for (const periodo of periodos) {
    sep(`PERIODO ${periodo.numero}: ${periodo.nombre}`);
    const pInicio = new Date(periodo.fechaInicio);
    const pFin    = new Date(periodo.fechaFin);
    const pid     = periodo._id.toString();

    for (const grado of grados) {
      for (const materiaId of grado.materias) {
        const key       = `${grado._id}-${materiaId}`;
        const docenteId = asigMap[key];
        if (!docenteId) continue;

        const materia = materiaMap[materiaId.toString()];
        if (!materia) continue;

        // Estudiantes matriculados en este grado este año
        const estDeGrado = estudiantes.filter(e => {
          const m = matriculaMap[e._id.toString()];
          return m && m.gradoId.toString() === grado._id.toString();
        });
        if (estDeGrado.length === 0) continue;

        for (let actIdx = 0; actIdx < ACTS_POR_MATERIA_PERIODO; actIdx++) {
          const fechaLimite = fechaLimiteActividad(pInicio, pFin, actIdx);

          const actividad = await Actividad.findOneAndUpdate(
            {
              docenteId, gradoId: grado._id,
              materiaId: materia._id, periodoId: periodo._id,
              titulo: `Actividad ${actIdx + 1} - ${materia.nombre} P${periodo.numero}`,
            },
            {
              $set: {
                descripcion: `Actividad ${actIdx + 1} del ${periodo.nombre} de ${materia.nombre}.`,
                fechaLimite, estado: 'cerrada', archivos: [], comentarios: [],
              },
            },
            { upsert: true, new: true }
          );
          cont.actividades++;

          for (const estudiante of estDeGrado) {
            const idx    = estIndice[estudiante._id.toString()] ?? 0;
            const perfil = perfilDeIndice(idx);
            const valor  = notaAleatoria(perfil);
            const fechaEntrega = fechaDentroDelPeriodo(pInicio, fechaLimite);

            const entrega = await EntregaActividad.findOneAndUpdate(
              { actividadId: actividad._id, estudianteId: estudiante._id },
              {
                $set: {
                  contenidoTexto: `Entrega de ${estudiante.nombre} para ${materia.nombre}.`,
                  archivos: [], fechaEntrega, estado: 'calificada',
                  nota: valor, comentarioDocente: '',
                },
              },
              { upsert: true, new: true }
            );
            cont.entregas++;

            const nota = await Nota.findOneAndUpdate(
              { entregaActividadId: entrega._id },
              {
                $set: {
                  estudianteId: estudiante._id, docenteId,
                  materiaId: materia._id, gradoId: grado._id,
                  periodoId: periodo._id, actividadId: actividad._id,
                  entregaActividadId: entrega._id,
                  año: AÑO, valor, modificable: false,
                },
              },
              { upsert: true, new: true }
            );
            cont.notas++;

            await EntregaActividad.updateOne({ _id: entrega._id }, { $set: { notaId: nota._id } });

            const eid = estudiante._id.toString();
            const mid = materia._id.toString();
            if (!notasAcum[pid][eid])      notasAcum[pid][eid] = {};
            if (!notasAcum[pid][eid][mid]) notasAcum[pid][eid][mid] = [];
            notasAcum[pid][eid][mid].push(valor);
          }
        }
      }
    }
    log(`Periodo ${periodo.numero} procesado`);
  }

  // ── Cerrar periodos → ResultadoPeriodo + Boletines ──────────────────────────
  sep('CIERRE DE PERIODOS');

  for (const periodo of periodos) {
    const pid   = periodo._id.toString();
    const pData = notasAcum[pid] || {};

    for (const estudiante of estudiantes) {
      const eid    = estudiante._id.toString();
      const matric = matriculaMap[eid];
      if (!matric) continue;

      const grado = gradoMap[matric.gradoId.toString()];
      if (!grado) continue;

      const materiasBoletín = [];
      let sumaGeneral = 0, contGeneral = 0;

      for (const materiaId of grado.materias) {
        const mid   = materiaId.toString();
        const notas = pData[eid]?.[mid] || [];
        if (notas.length === 0) continue;

        const promedio = Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100;
        const aprobado = promedio >= APROBACION_MIN;

        await ResultadoPeriodo.findOneAndUpdate(
          { estudianteId: estudiante._id, materiaId, periodoId: periodo._id },
          { $set: { gradoId: matric.gradoId, año: AÑO, promedio, aprobado } },
          { upsert: true, new: true }
        );
        cont.resultadosPeriodo++;

        sumaGeneral += promedio;
        contGeneral++;

        const matObj = materiaMap[mid];
        const docKey = `${matric.gradoId}-${mid}`;
        materiasBoletín.push({
          materiaId,
          nombreMateria: matObj?.nombre || mid,
          notas: [], promedio, aprobado,
          nombreDocente: docenteNombreMap[docKey] || '',
        });
      }

      if (contGeneral === 0) continue;

      const promedioGeneral = Math.round((sumaGeneral / contGeneral) * 100) / 100;
      const aprobadoGeneral = promedioGeneral >= APROBACION_MIN;

      const boletinExiste = await Boletin.findOne({
        estudianteId: estudiante._id, periodoId: periodo._id,
      });
      if (!boletinExiste) {
        await Boletin.create({
          estudianteId: estudiante._id, gradoId: matric.gradoId,
          periodoId: periodo._id, año: AÑO,
          nombreEstudiante: estudiante.nombre,
          apellidoEstudiante: estudiante.apellido,
          nombreGrado: grado.nombre, nivelGrado: grado.nivel,
          nombrePeriodo: periodo.nombre, numeroPeriodo: periodo.numero,
          materias: materiasBoletín, promedioGeneral, aprobadoGeneral,
          generadoEn: new Date(periodo.fechaFin),
        });
      }
    }

    await Periodo.updateOne({ _id: periodo._id }, { $set: { activo: false } });
    log(`Periodo ${periodo.numero} cerrado`);
  }

  // ── ResultadoAnual ─────────────────────────────────────────────────────────
  sep('CIERRE DE AÑO → ResultadoAnual');

  for (const estudiante of estudiantes) {
    const eid    = estudiante._id.toString();
    const matric = matriculaMap[eid];
    if (!matric) continue;

    const grado = gradoMap[matric.gradoId.toString()];
    if (!grado) continue;

    for (const materiaId of grado.materias) {
      const rps = await ResultadoPeriodo.find({
        estudianteId: estudiante._id, materiaId, año: AÑO,
      }).lean();
      if (rps.length === 0) continue;

      const promedioAnual = Math.round(
        (rps.reduce((s, r) => s + r.promedio, 0) / rps.length) * 100
      ) / 100;
      const aprobado = rps.some(r => r.aprobado);

      await ResultadoAnual.findOneAndUpdate(
        { estudianteId: estudiante._id, materiaId, año: AÑO },
        { $set: { gradoId: matric.gradoId, aprobado, promedioAnual } },
        { upsert: true, new: true }
      );
    }
  }

  const reprobados = await ResultadoAnual.countDocuments({ año: AÑO, aprobado: false });
  log(`ResultadoAnual generados. Reprobaciones de materia: ${reprobados}`);

  // ── Resumen ─────────────────────────────────────────────────────────────────
  const nextScript = AÑO < 2024
    ? `node seeders/seed_matriculas_${nextAño}.js`
    : 'Dataset completo ✓';

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  Año             : ${String(AÑO).padEnd(31)}║`);
  console.log(`║  Actividades     : ${String(cont.actividades).padEnd(31)}║`);
  console.log(`║  Entregas + Notas: ${String(cont.notas).padEnd(31)}║`);
  console.log(`║  ResultadoPeriodo: ${String(cont.resultadosPeriodo).padEnd(31)}║`);
  console.log(`║  Reprobac. anuales materia: ${String(reprobados).padEnd(23)}║`);
  console.log(`║  Siguiente:                                          ║`);
  console.log(`║    ${nextScript.padEnd(48)}║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n❌ Error en seed_año${AÑO}.js:`, err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
