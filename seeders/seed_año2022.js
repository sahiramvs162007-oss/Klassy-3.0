/**
 * seeders/seed_año2022.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera para el año 2022:
 *   - 4 Actividades por materia por periodo (por grado)
 *   - 1 EntregaActividad por estudiante por actividad
 *   - 1 Nota por entrega
 *   - ResultadoPeriodo al cerrar cada periodo
 *   - ResultadoAnual al cerrar el año
 *   - Boletin por estudiante por periodo
 *
 * Perfiles de nota (columna 'perfil' del Excel → guardada en memoria,
 * NO en la BD — se infiere del índice del estudiante):
 *   reprobador (15%) → notas 1.0–2.4
 *   promedio   (55%) → notas 2.5–4.4
 *   bueno      (30%) → notas 3.5–5.0
 *
 * REQUISITOS PREVIOS:
 *   seed_catalogo.js + seed_matriculas_2022.js ejecutados.
 *
 * Uso:
 *   node seeders/seed_año2022.js
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
const AÑO       = 2022;
const ACTIVIDADES_POR_MATERIA_PERIODO = 4;
const APROBACION_MIN = 3.0;

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`);

// ── Generador de notas según perfil ──────────────────────────────────────────
// 440 estudiantes en orden createdAt:
//   índices 0–65   → reprobador (15%)
//   índices 66–307 → promedio   (55%)
//   índices 308–439→ bueno      (30%)
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
      // 70% de las notas por debajo de 3, 30% entre 2.5-3.5 (para variación)
      valor = r < 0.70
        ? 1.0 + Math.random() * 1.4          // 1.0–2.4
        : 2.5 + Math.random() * 1.0;         // 2.5–3.5
      break;
    case 'promedio':
      // Campana centrada en 3.5
      valor = r < 0.15
        ? 2.0 + Math.random() * 0.9          // 2.0–2.9 (algunos malos)
        : r < 0.80
          ? 3.0 + Math.random() * 1.4        // 3.0–4.4
          : 4.4 + Math.random() * 0.6;       // 4.4–5.0 (algunos buenos)
      break;
    case 'bueno':
    default:
      valor = r < 0.10
        ? 3.0 + Math.random() * 0.5          // 3.0–3.5 (pocos bajos)
        : 3.5 + Math.random() * 1.5;         // 3.5–5.0
      break;
  }
  return Math.min(5.0, Math.max(1.0, Math.round(valor * 10) / 10));
}

function fechaDentroDelPeriodo(inicio, fin) {
  const start = inicio.getTime();
  const end   = fin.getTime();
  return new Date(start + Math.random() * (end - start));
}

function fechaLimiteActividad(inicio, fin, actIdx) {
  // Distribuye las 4 actividades a lo largo del periodo
  const duracion = fin.getTime() - inicio.getTime();
  const slot     = duracion / ACTIVIDADES_POR_MATERIA_PERIODO;
  const base     = inicio.getTime() + slot * actIdx + slot * 0.7;
  return new Date(Math.min(base, fin.getTime() - 86400000)); // al menos 1 día antes del fin
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          KLASSY — seed_año2022.js                   ║');
  console.log('║  Actividades · Entregas · Notas · Cierres 2022      ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await mongoose.connect(MONGO_URI);
  console.log(`\nConectado. Procesando año ${AÑO}...\n`);

  // ── Cargar datos base ───────────────────────────────────────────────────────
  sep('CARGANDO DATOS BASE');

  const periodos = await Periodo.find({ año: AÑO }).sort({ numero: 1 }).lean();
  log(`Periodos: ${periodos.length}`);

  const materias = await Materia.find({ activo: true }).lean();
  log(`Materias: ${materias.length}`);

  // Estudiantes ordenados por createdAt (mismo orden que el Excel)
  const estudiantes = await Usuario.find({ rol: 'estudiante', activo: true })
    .sort({ createdAt: 1 })
    .select('_id nombre apellido')
    .lean();
  log(`Estudiantes: ${estudiantes.length}`);

  // Matrículas 2022 → qué grado tiene cada estudiante este año
  const matriculas = await Matricula.find({ año: AÑO, estado: 'activa' }).lean();
  // Map: estudianteId → { gradoId, nivelAcademico }
  const matriculaMap = {};
  for (const m of matriculas) {
    matriculaMap[m.estudianteId.toString()] = {
      gradoId:        m.gradoId,
      nivelAcademico: m.nivelAcademico,
    };
  }
  log(`Matrículas cargadas: ${matriculas.length}`);

  // Asignaciones docente 2022 → quién dicta cada materia en cada grado
  const asignaciones = await AsignacionDocente.find({ año: AÑO, estado: 'activo' }).lean();
  // Map: `${gradoId}-${materiaId}` → docenteId
  const asigMap = {};
  for (const a of asignaciones) {
    const key = `${a.gradoId}-${a.materiaId}`;
    asigMap[key] = a.docenteId;
  }
  log(`Asignaciones: ${asignaciones.length}`);

  // Grados 2022
  const grados = await Grado.find({ año: AÑO }).lean();
  log(`Grados: ${grados.length}`);

  // Índice global de cada estudiante (para determinar perfil)
  const estIndice = {};
  estudiantes.forEach((e, i) => { estIndice[e._id.toString()] = i; });

  // ── Procesamiento por periodo ───────────────────────────────────────────────
  const contadores = { actividades: 0, entregas: 0, notas: 0, resultadosPeriodo: 0 };

  // Acumular notas por estudiante-materia para calcular ResultadoPeriodo
  // notasAcum[periodoId][estudianteId][materiaId] = [valores]
  const notasAcum = {};

  for (const periodo of periodos) {
    sep(`PERIODO ${periodo.numero}: ${periodo.nombre}`);
    notasAcum[periodo._id.toString()] = {};

    const pInicio = new Date(periodo.fechaInicio);
    const pFin    = new Date(periodo.fechaFin);

    // Por cada grado → por cada materia → crear actividades
    for (const grado of grados) {
      for (const materiaId of grado.materias) {
        const key       = `${grado._id}-${materiaId}`;
        const docenteId = asigMap[key];

        if (!docenteId) continue; // sin docente asignado

        const materia = materias.find(m => m._id.toString() === materiaId.toString());
        if (!materia) continue;

        // Estudiantes de este grado
        const estDeGrado = estudiantes.filter(e => {
          const m = matriculaMap[e._id.toString()];
          return m && m.gradoId.toString() === grado._id.toString();
        });

        if (estDeGrado.length === 0) continue;

        // Crear ACTIVIDADES_POR_MATERIA_PERIODO actividades
        for (let actIdx = 0; actIdx < ACTIVIDADES_POR_MATERIA_PERIODO; actIdx++) {
          const fechaLimite = fechaLimiteActividad(pInicio, pFin, actIdx);

          const actividad = await Actividad.findOneAndUpdate(
            {
              docenteId,
              gradoId:   grado._id,
              materiaId: materia._id,
              periodoId: periodo._id,
              titulo:    `Actividad ${actIdx + 1} - ${materia.nombre} P${periodo.numero}`,
            },
            {
              $set: {
                descripcion: `Actividad ${actIdx + 1} del ${periodo.nombre} de ${materia.nombre}.`,
                fechaLimite,
                estado:      'cerrada', // ya pasó la fecha límite
                archivos:    [],
                comentarios: [],
              },
            },
            { upsert: true, new: true }
          );
          contadores.actividades++;

          // Crear 1 entrega + 1 nota por estudiante
          for (const estudiante of estDeGrado) {
            const idx    = estIndice[estudiante._id.toString()] ?? 0;
            const perfil = perfilDeIndice(idx);
            const valor  = notaAleatoria(perfil);

            const fechaEntrega = fechaDentroDelPeriodo(pInicio, fechaLimite);

            // EntregaActividad
            const entrega = await EntregaActividad.findOneAndUpdate(
              { actividadId: actividad._id, estudianteId: estudiante._id },
              {
                $set: {
                  contenidoTexto:    `Entrega del estudiante para ${materia.nombre}.`,
                  archivos:          [],
                  fechaEntrega,
                  estado:            'calificada',
                  nota:              valor,
                  comentarioDocente: '',
                },
              },
              { upsert: true, new: true }
            );
            contadores.entregas++;

            // Nota
            const nota = await Nota.findOneAndUpdate(
              { entregaActividadId: entrega._id },
              {
                $set: {
                  estudianteId:       estudiante._id,
                  docenteId,
                  materiaId:          materia._id,
                  gradoId:            grado._id,
                  periodoId:          periodo._id,
                  actividadId:        actividad._id,
                  entregaActividadId: entrega._id,
                  año:                AÑO,
                  valor,
                  modificable:        false,
                },
              },
              { upsert: true, new: true }
            );
            contadores.notas++;

            // Actualizar notaId en la entrega
            await EntregaActividad.updateOne(
              { _id: entrega._id },
              { $set: { notaId: nota._id } }
            );

            // Acumular para ResultadoPeriodo
            const pid = periodo._id.toString();
            const eid = estudiante._id.toString();
            const mid = materia._id.toString();
            if (!notasAcum[pid][eid])      notasAcum[pid][eid] = {};
            if (!notasAcum[pid][eid][mid]) notasAcum[pid][eid][mid] = [];
            notasAcum[pid][eid][mid].push(valor);
          }
        }
      }
    }

    log(`Periodo ${periodo.numero} — actividades: ${contadores.actividades}, notas acumuladas`);
  }

  // ── Cerrar periodos → ResultadoPeriodo + Boletin ───────────────────────────
  sep('CIERRE DE PERIODOS → ResultadoPeriodo + Boletin');

  const gradoMap = {};
  for (const g of grados) gradoMap[g._id.toString()] = g;

  const materiaMap = {};
  for (const m of materias) materiaMap[m._id.toString()] = m;

  const docenteNombreMap = {};
  for (const a of asignaciones) {
    const key = `${a.gradoId}-${a.materiaId}`;
    if (!docenteNombreMap[key]) {
      const doc = await Usuario.findById(a.docenteId).select('nombre apellido').lean();
      if (doc) docenteNombreMap[key] = `${doc.nombre} ${doc.apellido}`;
    }
  }

  // ResultadoPeriodo por estudiante-materia-periodo
  for (const periodo of periodos) {
    const pid = periodo._id.toString();
    const pData = notasAcum[pid] || {};

    for (const estudiante of estudiantes) {
      const eid     = estudiante._id.toString();
      const matric  = matriculaMap[eid];
      if (!matric) continue;

      const grado = gradoMap[matric.gradoId.toString()];
      if (!grado) continue;

      const materiasDelGrado = grado.materias || [];
      const materiasBoletín  = [];
      let   sumaGeneral      = 0;
      let   contGeneral      = 0;

      for (const materiaId of materiasDelGrado) {
        const mid    = materiaId.toString();
        const notas  = (pData[eid] && pData[eid][mid]) ? pData[eid][mid] : [];
        if (notas.length === 0) continue;

        const promedio = Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100;
        const aprobado = promedio >= APROBACION_MIN;

        await ResultadoPeriodo.findOneAndUpdate(
          { estudianteId: estudiante._id, materiaId, periodoId: periodo._id },
          {
            $set: {
              gradoId:  matric.gradoId,
              año:      AÑO,
              promedio,
              aprobado,
            },
          },
          { upsert: true, new: true }
        );
        contadores.resultadosPeriodo++;

        sumaGeneral += promedio;
        contGeneral++;

        const matObj   = materiaMap[mid];
        const docKey   = `${matric.gradoId}-${mid}`;
        materiasBoletín.push({
          materiaId,
          nombreMateria:  matObj ? matObj.nombre : mid,
          notas:          [],
          promedio,
          aprobado,
          nombreDocente:  docenteNombreMap[docKey] || '',
        });
      }

      if (contGeneral === 0) continue;

      const promedioGeneral = Math.round((sumaGeneral / contGeneral) * 100) / 100;
      const aprobadoGeneral = promedioGeneral >= APROBACION_MIN;

      // Boletin (inmutable — solo crear si no existe)
      const boletinExiste = await Boletin.findOne({
        estudianteId: estudiante._id, periodoId: periodo._id,
      });
      if (!boletinExiste) {
        await Boletin.create({
          estudianteId:       estudiante._id,
          gradoId:            matric.gradoId,
          periodoId:          periodo._id,
          año:                AÑO,
          nombreEstudiante:   estudiante.nombre,
          apellidoEstudiante: estudiante.apellido,
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
    }

    // Marcar periodo como cerrado
    await Periodo.updateOne({ _id: periodo._id }, { $set: { activo: false } });
    log(`Periodo ${periodo.numero} cerrado — ResultadoPeriodo y Boletines generados`);
  }

  // ── ResultadoAnual ─────────────────────────────────────────────────────────
  sep('CIERRE DE AÑO → ResultadoAnual');

  // Un estudiante reprueba una materia en el año si la reprobó en TODOS los periodos
  for (const estudiante of estudiantes) {
    const eid    = estudiante._id.toString();
    const matric = matriculaMap[eid];
    if (!matric) continue;

    const grado = gradoMap[matric.gradoId.toString()];
    if (!grado) continue;

    for (const materiaId of grado.materias) {
      const resultadosPeriodo = await ResultadoPeriodo.find({
        estudianteId: estudiante._id,
        materiaId,
        año: AÑO,
      }).lean();

      if (resultadosPeriodo.length === 0) continue;

      const promedioAnual = Math.round(
        (resultadosPeriodo.reduce((s, r) => s + r.promedio, 0) / resultadosPeriodo.length) * 100
      ) / 100;

      // Reprueba el año en esa materia solo si reprobó TODOS los periodos
      const aprobado = resultadosPeriodo.some(r => r.aprobado);

      await ResultadoAnual.findOneAndUpdate(
        { estudianteId: estudiante._id, materiaId, año: AÑO },
        {
          $set: {
            gradoId:      matric.gradoId,
            aprobado,
            promedioAnual,
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  // Contar reprobados anuales
  const reprobadosAnuales = await ResultadoAnual.countDocuments({ año: AÑO, aprobado: false });
  log(`ResultadoAnual generados. Reprobaciones de materia: ${reprobadosAnuales}`);

  // ── Resumen final ──────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Actividades     : ${String(contadores.actividades).padEnd(31)}║`);
  console.log(`║  Entregas        : ${String(contadores.entregas).padEnd(31)}║`);
  console.log(`║  Notas           : ${String(contadores.notas).padEnd(31)}║`);
  console.log(`║  ResultadoPeriodo: ${String(contadores.resultadosPeriodo).padEnd(31)}║`);
  console.log(`║  Reprobac. anuales materia: ${String(reprobadosAnuales).padEnd(23)}║`);
  console.log('║  Siguiente paso:                                     ║');
  console.log('║    node seeders/seed_matriculas_2023.js              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en seed_año2022.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
