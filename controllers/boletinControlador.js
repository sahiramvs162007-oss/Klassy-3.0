/**
 * controllers/boletinControlador.js
 * Sprint 11 — Boletines y Reportes Académicos
 *
 * Acceso por rol:
 *   Admin/Director: todo + eliminar + cerrar periodo/año + reportes + PDF de cualquier estudiante
 *   Docente: ver boletines de sus grados/materias asignadas + sus propios boletines históricos
 *   Estudiante: solo sus propios boletines
 */

const {
  Boletin, Periodo, Grado, Matricula, Nota, ResultadoAnual,
  ResultadoPeriodo, AsignacionDocente, Materia, Usuario,
} = require('../models');
const { cerrarPeriodo, cerrarAño } = require('../services/boletinServicio');
const PDFDocument = require('pdfkit');

const AÑO_ACTUAL = new Date().getFullYear();

// ─── Redirección por rol ──────────────────────────────────────────────────────
const redirigirPorRol = (req, res) => {
  const { rol } = req.session.usuario;
  if (rol === 'estudiante') return res.redirect('/boletines/estudiante');
  if (rol === 'docente')    return res.redirect('/boletines/docente');
  return res.redirect('/boletines/admin');
};

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ESTUDIANTE — solo sus propios boletines
// ─────────────────────────────────────────────────────────────────────────────

const panelEstudiante = async (req, res) => {
  try {
    const usuarioId   = req.session.usuario._id;
    const { boletinId } = req.query;

    // Todos los boletines del estudiante, cualquier año
    const boletines = await Boletin.find({ estudianteId: usuarioId })
      .sort({ año: -1, numeroPeriodo: -1 });

    // Si se solicita uno específico
    let boletinActual = null;
    if (boletinId) {
      boletinActual = await Boletin.findOne({ _id: boletinId, estudianteId: usuarioId });
    } else if (boletines.length > 0) {
      boletinActual = boletines[0];
    }

    res.render('paginas/boletines-estudiante', {
      titulo:       'Mis Boletines',
      paginaActual: 'boletines',
      boletines,
      boletinActual,
      mensajeExito: req.flash('exito'),
      mensajeError: req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelEstudiante boletines:', error);
    req.flash('error', 'Error al cargar los boletines.');
    res.redirect('/dashboard');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PANEL DOCENTE — sus grados + sus propios boletines históricos
// ─────────────────────────────────────────────────────────────────────────────

const panelDocente = async (req, res) => {
  try {
    const docenteId = req.session.usuario._id;
    const { gradoId, periodoId, boletinId } = req.query;

    // Asignaciones del docente en el año actual
    const asignaciones = await AsignacionDocente.find({
      docenteId,
      año:    AÑO_ACTUAL,
      estado: 'activo',
    })
      .populate('gradoId',   'nombre nivel')
      .populate('materiaId', 'nombre');

    // IDs de grados donde tiene asignación
    const gradosIds    = [...new Set(asignaciones.map(a => a.gradoId?._id?.toString()))];
    const materiasIds  = [...new Set(asignaciones.map(a => a.materiaId?._id?.toString()))];

    // Periodos del año
    const periodos = await Periodo.find({ año: AÑO_ACTUAL }).sort({ numero: 1 });

    // Boletines del grado y periodo seleccionados
    let boletines = [];
    if (gradoId && periodoId) {
      boletines = await Boletin.find({ gradoId, periodoId })
        .sort({ apellidoEstudiante: 1 });
    }

    // Boletín específico para ver
    let boletinActual = null;
    if (boletinId) {
      boletinActual = await Boletin.findOne({ _id: boletinId });
      // Solo mostrar materias del docente
      if (boletinActual) {
        boletinActual = boletinActual.toObject();
        boletinActual.materias = boletinActual.materias.filter(m =>
          materiasIds.includes(m.materiaId?.toString())
        );
      }
    }

    // Boletines históricos propios del docente (si fue estudiante alguna vez)
    const propios = await Boletin.find({ estudianteId: docenteId }).sort({ año: -1, numeroPeriodo: -1 });

    res.render('paginas/boletines-docente', {
      titulo:       'Boletines',
      paginaActual: 'boletines',
      asignaciones,
      periodos,
      boletines,
      boletinActual,
      propios,
      gradoIdActivo:  gradoId   || null,
      periodoIdActivo: periodoId || null,
      mensajeExito:   req.flash('exito'),
      mensajeError:   req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelDocente boletines:', error);
    req.flash('error', 'Error al cargar boletines.');
    res.redirect('/dashboard');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN/DIRECTOR — acceso total + reportes + cierre
// ─────────────────────────────────────────────────────────────────────────────

const panelAdmin = async (req, res) => {
  try {
    const { año = AÑO_ACTUAL, gradoId, periodoId, estudianteId, vista = 'boletines' } = req.query;
    const añoNum = parseInt(año, 10);

    const [grados, periodos] = await Promise.all([
      Grado.find({ año: añoNum, activo: true }).sort({ nivel: 1 }),
      Periodo.find({ año: añoNum }).sort({ numero: 1 }),
    ]);

    // Años disponibles
    const añosDisponibles = await Boletin.distinct('año');
    if (!añosDisponibles.includes(añoNum)) añosDisponibles.push(añoNum);
    añosDisponibles.sort((a, b) => b - a);

    let boletines        = [];
    let reporte          = null;
    let periodosCerrados = periodos.filter(p => !p.activo);
    let periodosAbiertos = periodos.filter(p => p.activo);

    if (vista === 'boletines' && gradoId && periodoId) {
      const filtro = { gradoId, periodoId };
      if (estudianteId) filtro.estudianteId = estudianteId;
      boletines = await Boletin.find(filtro).sort({ apellidoEstudiante: 1 });
    }

    if (vista === 'reporte-grado' && gradoId && periodoId) {
      reporte = await generarReporteGrado({ gradoId, periodoId, añoNum });
    }

    if (vista === 'reporte-materia' && gradoId && periodoId && req.query.materiaId) {
      reporte = await generarReporteMateria({ gradoId, periodoId, materiaId: req.query.materiaId });
    }

    if (vista === 'reporte-general') {
      reporte = await generarReporteGeneral({ añoNum, periodoId });
    }

    // Estudiantes del grado (para búsqueda)
    let estudiantesGrado = [];
    if (gradoId) {
      const mats = await Matricula.find({ gradoId, año: añoNum, estado: 'activa' })
        .populate('estudianteId', 'nombre apellido');
      estudiantesGrado = mats.map(m => m.estudianteId).filter(Boolean);
    }

    // Materias del grado seleccionado
    const gradoDoc = gradoId ? await Grado.findById(gradoId).populate('materias', 'nombre') : null;
    const materiasGrado = gradoDoc?.materias || [];

    res.render('paginas/boletines-admin', {
      titulo:          'Boletines y Reportes',
      paginaActual:    'boletines',
      grados,
      periodos,
      periodosCerrados,
      periodosAbiertos,
      añosDisponibles,
      añoSeleccionado: añoNum,
      gradoIdActivo:   gradoId    || null,
      periodoIdActivo: periodoId  || null,
      estudianteIdActivo: estudianteId || null,
      materiaIdActiva: req.query.materiaId || null,
      vista,
      boletines,
      reporte,
      estudiantesGrado,
      materiasGrado,
      mensajeExito:    req.flash('exito'),
      mensajeError:    req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelAdmin boletines:', error);
    req.flash('error', 'Error al cargar boletines.');
    res.redirect('/dashboard');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERADORES DE REPORTES
// ─────────────────────────────────────────────────────────────────────────────

const generarReporteGrado = async ({ gradoId, periodoId, añoNum }) => {
  const boletines = await Boletin.find({ gradoId, periodoId }).sort({ apellidoEstudiante: 1 });
  if (!boletines.length) return null;

  const grado   = boletines[0];
  let aprobados = 0, reprobados = 0;
  let sumaPromedios = 0;

  const filas = boletines.map(b => {
    sumaPromedios += b.promedioGeneral;
    if (b.aprobadoGeneral) aprobados++; else reprobados++;
    return {
      nombre:         `${b.nombreEstudiante} ${b.apellidoEstudiante}`,
      materias:       b.materias,
      promedioGeneral:b.promedioGeneral,
      aprobado:       b.aprobadoGeneral,
    };
  });

  return {
    tipo:           'grado',
    nombreGrado:    grado.nombreGrado,
    numeroPeriodo:  grado.numeroPeriodo,
    nombrePeriodo:  grado.nombrePeriodo,
    año:            grado.año,
    filas,
    aprobados,
    reprobados,
    total:          boletines.length,
    promedioGrupo:  boletines.length > 0 ? (sumaPromedios / boletines.length).toFixed(2) : 0,
  };
};

const generarReporteMateria = async ({ gradoId, periodoId, materiaId }) => {
  const boletines = await Boletin.find({ gradoId, periodoId }).sort({ apellidoEstudiante: 1 });
  if (!boletines.length) return null;

  let aprobados = 0, reprobados = 0, sumaPromedios = 0, count = 0;
  const nombreMateria = boletines[0].materias.find(m => m.materiaId?.toString() === materiaId)?.nombreMateria || 'Materia';

  const filas = boletines.map(b => {
    const mat = b.materias.find(m => m.materiaId?.toString() === materiaId);
    if (mat) {
      sumaPromedios += mat.promedio;
      count++;
      if (mat.aprobado) aprobados++; else reprobados++;
    }
    return {
      nombre:   `${b.nombreEstudiante} ${b.apellidoEstudiante}`,
      promedio: mat?.promedio ?? null,
      aprobado: mat?.aprobado ?? null,
      notas:    mat?.notas || [],
    };
  });

  return {
    tipo:           'materia',
    nombreMateria,
    nombreGrado:    boletines[0].nombreGrado,
    numeroPeriodo:  boletines[0].numeroPeriodo,
    nombrePeriodo:  boletines[0].nombrePeriodo,
    filas,
    aprobados,
    reprobados,
    total:          filas.length,
    promedioGrupo:  count > 0 ? (sumaPromedios / count).toFixed(2) : 0,
  };
};

const generarReporteGeneral = async ({ añoNum, periodoId }) => {
  const filtro = { año: añoNum };
  if (periodoId) filtro.periodoId = periodoId;

  const boletines = await Boletin.find(filtro);

  // Agrupar por grado
  const gradoMap = {};
  for (const b of boletines) {
    const gId = b.gradoId?.toString();
    if (!gradoMap[gId]) {
      gradoMap[gId] = { nombre: b.nombreGrado, nivel: b.nivelGrado, boletines: [] };
    }
    gradoMap[gId].boletines.push(b);
  }

  const grados = Object.values(gradoMap).map(g => {
    const total = g.boletines.length;
    const aprobados  = g.boletines.filter(b => b.aprobadoGeneral).length;
    const promedio   = total > 0
      ? (g.boletines.reduce((s, b) => s + b.promedioGeneral, 0) / total).toFixed(2)
      : 0;
    return {
      nombre:    g.nombre,
      nivel:     g.nivel,
      total,
      aprobados,
      reprobados: total - aprobados,
      pctAprobacion: total > 0 ? Math.round(aprobados / total * 100) : 0,
      promedio,
    };
  }).sort((a, b) => a.nivel - b.nivel);

  const totalGlobal     = boletines.length;
  const aprobadosGlobal = boletines.filter(b => b.aprobadoGeneral).length;
  const promedioGlobal  = totalGlobal > 0
    ? (boletines.reduce((s, b) => s + b.promedioGeneral, 0) / totalGlobal).toFixed(2)
    : 0;

  return {
    tipo:              'general',
    año:               añoNum,
    grados,
    totalGlobal,
    aprobadosGlobal,
    reprobadosGlobal:  totalGlobal - aprobadosGlobal,
    pctAprobacionGlobal: totalGlobal > 0 ? Math.round(aprobadosGlobal / totalGlobal * 100) : 0,
    promedioGlobal,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCIONES — Cerrar periodo / año
// ─────────────────────────────────────────────────────────────────────────────

const ejecutarCerrarPeriodo = async (req, res) => {
  try {
    const { id: periodoId } = req.params;
    const resultado = await cerrarPeriodo(periodoId);

    req.flash('exito',
      `Periodo "${resultado.periodo}" cerrado. ` +
      `${resultado.boletinesCreados} boletines generados. ` +
      `${resultado.errores.length > 0 ? resultado.errores.length + ' errores.' : ''}`
    );
    res.redirect('/boletines/admin');
  } catch (error) {
    console.error('Error al cerrar periodo:', error);
    req.flash('error', `Error al cerrar el periodo: ${error.message}`);
    res.redirect('/boletines/admin');
  }
};

const ejecutarCerrarAño = async (req, res) => {
  try {
    const { año } = req.body;
    const resultado = await cerrarAño(parseInt(año, 10));

    req.flash('exito',
      `Año ${resultado.año} cerrado. ${resultado.resultadosAnuales} resultados generados. ` +
      `Los niveles de los estudiantes aprobados han sido actualizados.`
    );
    res.redirect('/boletines/admin');
  } catch (error) {
    console.error('Error al cerrar año:', error);
    req.flash('error', `Error al cerrar el año: ${error.message}`);
    res.redirect('/boletines/admin');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR — solo admin/director
// ─────────────────────────────────────────────────────────────────────────────

const eliminarBoletin = async (req, res) => {
  try {
    const { id } = req.params;
    await Boletin.findByIdAndDelete(id);
    req.flash('exito', 'Boletín eliminado correctamente.');
    res.redirect('/boletines/admin');
  } catch (error) {
    req.flash('error', 'Error al eliminar el boletín.');
    res.redirect('/boletines/admin');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DESCARGAR PDF
// ─────────────────────────────────────────────────────────────────────────────

const descargarPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = req.session.usuario;

    // Buscar el boletín
    let boletin;
    if (usuario.rol === 'estudiante') {
      boletin = await Boletin.findOne({ _id: id, estudianteId: usuario._id });
    } else {
      boletin = await Boletin.findById(id);
    }

    if (!boletin) {
      req.flash('error', 'Boletín no encontrado.');
      return res.redirect('back');
    }

    // Generar PDF con pdfkit
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="boletin_${boletin.nombreEstudiante}_${boletin.nombrePeriodo}_${boletin.año}.pdf"`
    );
    doc.pipe(res);

    generarContenidoPDF(doc, boletin);
    doc.end();

  } catch (error) {
    console.error('Error al generar PDF:', error);
    req.flash('error', 'Error al generar el PDF.');
    res.redirect('back');
  }
};

const descargarPDFReporte = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { gradoId, periodoId, materiaId, año = AÑO_ACTUAL } = req.query;
    const añoNum = parseInt(año, 10);

    let reporte = null;
    if (tipo === 'grado' && gradoId && periodoId) {
      reporte = await generarReporteGrado({ gradoId, periodoId, añoNum });
    } else if (tipo === 'materia' && gradoId && periodoId && materiaId) {
      reporte = await generarReporteMateria({ gradoId, periodoId, materiaId });
    } else if (tipo === 'general') {
      reporte = await generarReporteGeneral({ añoNum, periodoId });
    }

    if (!reporte) {
      req.flash('error', 'No hay datos para generar el reporte.');
      return res.redirect('back');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${tipo}_${añoNum}.pdf"`);
    doc.pipe(res);

    generarReportePDF(doc, reporte);
    doc.end();

  } catch (error) {
    console.error('Error al generar PDF reporte:', error);
    req.flash('error', 'Error al generar el reporte PDF.');
    res.redirect('back');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PDF
// ─────────────────────────────────────────────────────────────────────────────

const AZUL  = '#1a4aad';
const NEGRO = '#111827';
const GRIS  = '#6b7280';
const VERDE = '#16a34a';
const ROJO  = '#dc2626';

function generarContenidoPDF(doc, b) {
  const ancho = doc.page.width - 80;

  // Encabezado
  doc.rect(40, 40, ancho, 60).fill(AZUL);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18)
    .text('KLASSY', 56, 52);
  doc.font('Helvetica').fontSize(10)
    .text('Boletín Académico', 56, 74);
  doc.font('Helvetica-Bold').fontSize(12)
    .text(`${b.nombreEstudiante} ${b.apellidoEstudiante}`, 300, 52, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(9)
    .text(`${b.nombreGrado} — ${b.nombrePeriodo} ${b.año}`, 300, 72, { width: 200, align: 'right' });

  doc.moveDown(3.5);

  // Datos del estudiante
  doc.fillColor(NEGRO).font('Helvetica-Bold').fontSize(10).text('Estudiante:', 40, doc.y);
  doc.font('Helvetica').text(`${b.nombreEstudiante} ${b.apellidoEstudiante}`, 120, doc.y - 12);

  doc.font('Helvetica-Bold').text('Grado:', 40, doc.y + 4);
  doc.font('Helvetica').text(`${b.nombreGrado} (Nivel ${b.nivelGrado})`, 120, doc.y - 12);

  doc.font('Helvetica-Bold').text('Periodo:', 40, doc.y + 4);
  doc.font('Helvetica').text(`${b.nombrePeriodo} — ${b.año}`, 120, doc.y - 12);

  doc.font('Helvetica-Bold').text('Generado:', 40, doc.y + 4);
  doc.font('Helvetica').text(new Date(b.generadoEn).toLocaleDateString('es-CO'), 120, doc.y - 12);

  doc.moveDown(1.5);

  // Tabla de materias
  const thY  = doc.y;
  const cols = [40, 180, 310, 370, 450];
  const thH  = 20;

  // Cabecera
  doc.rect(40, thY, ancho, thH).fill('#1e40af');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
  doc.text('Materia', cols[0] + 4, thY + 6);
  doc.text('Docente', cols[1] + 4, thY + 6);
  doc.text('Actividades', cols[2] + 4, thY + 6);
  doc.text('Promedio', cols[3] + 4, thY + 6);
  doc.text('Estado', cols[4] + 4, thY + 6);

  let rowY = thY + thH;
  doc.fillColor(NEGRO).font('Helvetica').fontSize(8);

  b.materias.forEach((m, i) => {
    const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
    doc.rect(40, rowY, ancho, 18).fill(bg);

    doc.fillColor(NEGRO);
    doc.text(m.nombreMateria.substring(0, 22), cols[0] + 4, rowY + 5, { width: 130 });
    doc.text((m.nombreDocente || '—').substring(0, 18), cols[1] + 4, rowY + 5, { width: 120 });
    doc.text(String(m.notas?.length || 0), cols[2] + 4, rowY + 5, { width: 50 });

    const colorProm = m.promedio >= 3 ? VERDE : ROJO;
    doc.fillColor(colorProm).font('Helvetica-Bold')
      .text(m.promedio.toFixed(2), cols[3] + 4, rowY + 5, { width: 60 });

    doc.fillColor(m.aprobado ? VERDE : ROJO)
      .text(m.aprobado ? 'Aprobada' : 'Reprobada', cols[4] + 4, rowY + 5);

    doc.fillColor(NEGRO).font('Helvetica');
    rowY += 18;
  });

  // Línea de resumen
  doc.rect(40, rowY, ancho, 22).fill(AZUL);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
  doc.text('PROMEDIO GENERAL:', 44, rowY + 7);
  doc.text(b.promedioGeneral.toFixed(2), cols[3] + 4, rowY + 7);
  doc.text(b.aprobadoGeneral ? 'APROBADO' : 'REPROBADO', cols[4] + 4, rowY + 7);

  // Pie
  doc.fillColor(GRIS).font('Helvetica').fontSize(7)
    .text(
      `Generado por el sistema KLASSY — ${new Date().toLocaleDateString('es-CO')}`,
      40, doc.page.height - 40, { width: ancho, align: 'center' }
    );
}

function generarReportePDF(doc, reporte) {
  const ancho = doc.page.width - 80;

  // Encabezado
  doc.rect(40, 40, ancho, 50).fill(AZUL);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(16).text('KLASSY', 56, 48);
  doc.font('Helvetica').fontSize(10).text('Reporte Académico', 56, 66);

  let titulo = '';
  if (reporte.tipo === 'grado')    titulo = `${reporte.nombreGrado} — ${reporte.nombrePeriodo} ${reporte.año || ''}`;
  if (reporte.tipo === 'materia')  titulo = `${reporte.nombreMateria} / ${reporte.nombreGrado} — ${reporte.nombrePeriodo}`;
  if (reporte.tipo === 'general')  titulo = `Reporte General — Año ${reporte.año}`;

  doc.font('Helvetica-Bold').fontSize(11)
    .text(titulo, 300, 50, { width: 220, align: 'right' });

  doc.moveDown(3);

  // Estadísticas resumen
  doc.fillColor(NEGRO).font('Helvetica-Bold').fontSize(10).text('Resumen estadístico', 40, doc.y);
  doc.moveDown(0.3);

  const stats = reporte.tipo === 'general'
    ? [
        ['Total estudiantes', reporte.totalGlobal],
        ['Aprobados', reporte.aprobadosGlobal],
        ['Reprobados', reporte.reprobadosGlobal],
        ['% Aprobación', reporte.pctAprobacionGlobal + '%'],
        ['Promedio global', reporte.promedioGlobal],
      ]
    : [
        ['Total estudiantes', reporte.total],
        ['Aprobados', reporte.aprobados],
        ['Reprobados', reporte.reprobados],
        ['% Aprobación', Math.round(reporte.aprobados / (reporte.total || 1) * 100) + '%'],
        ['Promedio grupo', reporte.promedioGrupo],
      ];

  let sx = 40;
  stats.forEach(([label, val]) => {
    doc.rect(sx, doc.y, 90, 36).fill('#eff6ff');
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(13).text(String(val), sx + 6, doc.y - 30);
    doc.fillColor(GRIS).font('Helvetica').fontSize(7).text(label, sx + 6, doc.y - 14);
    sx += 96;
  });

  doc.moveDown(2.5);

  // Tabla de datos
  if (reporte.tipo === 'general') {
    // Tabla de grados
    const thY = doc.y;
    doc.rect(40, thY, ancho, 18).fill('#1e40af');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    doc.text('Grado', 44, thY + 5);
    doc.text('Total', 200, thY + 5);
    doc.text('Aprobados', 260, thY + 5);
    doc.text('Reprobados', 330, thY + 5);
    doc.text('% Aprob.', 410, thY + 5);
    doc.text('Promedio', 470, thY + 5);

    let ry = thY + 18;
    reporte.grados.forEach((g, i) => {
      const bg = i % 2 === 0 ? '#f9fafb' : '#fff';
      doc.rect(40, ry, ancho, 16).fill(bg);
      doc.fillColor(NEGRO).font('Helvetica').fontSize(8);
      doc.text(g.nombre, 44, ry + 4);
      doc.text(String(g.total), 200, ry + 4);
      doc.fillColor(VERDE).text(String(g.aprobados), 260, ry + 4);
      doc.fillColor(ROJO).text(String(g.reprobados), 330, ry + 4);
      doc.fillColor(NEGRO).text(g.pctAprobacion + '%', 410, ry + 4);
      doc.fillColor(parseFloat(g.promedio) >= 3 ? VERDE : ROJO).font('Helvetica-Bold')
        .text(String(g.promedio), 470, ry + 4);
      ry += 16;
    });
  } else {
    // Tabla de estudiantes
    const thY = doc.y;
    doc.rect(40, thY, ancho, 18).fill('#1e40af');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    doc.text('Estudiante', 44, thY + 5);
    doc.text('Promedio', 320, thY + 5);
    doc.text('Estado', 400, thY + 5);

    let ry = thY + 18;
    reporte.filas.forEach((f, i) => {
      const bg = i % 2 === 0 ? '#f9fafb' : '#fff';
      doc.rect(40, ry, ancho, 16).fill(bg);
      doc.fillColor(NEGRO).font('Helvetica').fontSize(8);
      doc.text(f.nombre, 44, ry + 4, { width: 260 });

      const prom = f.promedio ?? f.promedioGeneral;
      if (prom !== null && prom !== undefined) {
        doc.fillColor(prom >= 3 ? VERDE : ROJO).font('Helvetica-Bold')
          .text(parseFloat(prom).toFixed(2), 320, ry + 4);
        const aprobado = f.aprobado ?? f.aprobadoGeneral;
        doc.fillColor(aprobado ? VERDE : ROJO).font('Helvetica')
          .text(aprobado ? 'Aprobado' : 'Reprobado', 400, ry + 4);
      }
      ry += 16;
    });
  }

  // Pie
  doc.fillColor(GRIS).font('Helvetica').fontSize(7)
    .text(`KLASSY — ${new Date().toLocaleDateString('es-CO')}`,
      40, doc.page.height - 40, { width: ancho, align: 'center' });
}

module.exports = {
  redirigirPorRol,
  panelEstudiante,
  panelDocente,
  panelAdmin,
  ejecutarCerrarPeriodo,
  ejecutarCerrarAño,
  eliminarBoletin,
  descargarPDF,
  descargarPDFReporte,
};
