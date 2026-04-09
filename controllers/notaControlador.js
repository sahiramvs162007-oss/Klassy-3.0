/**
 * controllers/notaControlador.js
 * Sprint 10 — Gestión de Notas
 *
 * IMPORTANTE: La creación de notas ocurre en actividadControlador.js
 * (calificarEntrega). Aquí solo se consulta y edita.
 *
 * Rutas del docente:
 *   GET  /notas/docente                       → panel selección materia/grado
 *   GET  /notas/docente/tabla                 → tabla de notas (JSON para la vista)
 *   PUT  /notas/docente/:id                   → editar nota (antes del cierre)
 *
 * Rutas del estudiante:
 *   GET  /notas/estudiante                    → ver sus notas agrupadas por materia
 *
 * Rutas admin/director:
 *   GET  /notas/admin                         → panel con filtros completos
 *   PUT  /notas/admin/:id                     → editar cualquier nota
 */

const {
  Nota, Actividad, EntregaActividad,
  AsignacionDocente, Matricula, Grado, Materia, Periodo, Usuario,
} = require('../models');

// ─── Historial ────────────────────────────────────────────────────────────────
const { registrarCambio } = require('../middlewares/registrarHistorial');

const AÑO_ACTUAL = new Date().getFullYear();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Calcula el promedio de un array de valores numéricos */
const calcularPromedio = (valores) => {
  if (!valores.length) return null;
  const suma = valores.reduce((acc, v) => acc + v, 0);
  return Math.round((suma / valores.length) * 100) / 100;
};

/**
 * Construye la tabla de notas: filas = estudiantes, columnas = actividades.
 * Retorna { actividades, filas, promedioGrupo }
 */
const construirTablaNotas = async ({ gradoId, materiaId, periodoId }) => {
  // Actividades del grado+materia+periodo
  const actividades = await Actividad.find({ gradoId, materiaId, periodoId })
    .select('titulo fechaLimite')
    .sort({ createdAt: 1 });

  // Estudiantes matriculados en el grado
  const matriculas = await Matricula.find({
    gradoId,
    año:    AÑO_ACTUAL,
    estado: 'activa',
  }).populate('estudianteId', 'nombre apellido');

  // Todas las notas del grado+materia+periodo
  const todasNotas = await Nota.find({ gradoId, materiaId, periodoId })
    .select('estudianteId actividadId valor modificable');

  // Mapa rápido: `${estudianteId}-${actividadId}` → nota
  const mapaNotas = {};
  for (const n of todasNotas) {
    const clave = `${n.estudianteId}-${n.actividadId}`;
    mapaNotas[clave] = n;
  }

  // Construir filas
  const filas = matriculas.map(m => {
    const est   = m.estudianteId;
    const celdas = actividades.map(act => {
      const clave = `${est._id}-${act._id}`;
      return mapaNotas[clave] || null;
    });
    const valores = celdas.filter(c => c !== null).map(c => c.valor);
    return {
      estudiante:  est,
      celdas,
      promedio:    calcularPromedio(valores),
    };
  });

  // Promedio del grupo por actividad
  const promediosPorActividad = actividades.map((act, i) => {
    const valores = filas
      .map(f => f.celdas[i]?.valor)
      .filter(v => v !== undefined && v !== null);
    return calcularPromedio(valores);
  });

  return { actividades, filas, promediosPorActividad };
};

// ─────────────────────────────────────────────────────────────────────────────
// PANEL DOCENTE
// ─────────────────────────────────────────────────────────────────────────────

const panelDocente = async (req, res) => {
  try {
    const docenteId = req.session.usuario._id;
    const { materiaId, gradoId, periodoId } = req.query;

    // Asignaciones activas del docente
    const asignaciones = await AsignacionDocente.find({
      docenteId,
      año:    AÑO_ACTUAL,
      estado: 'activo',
    })
      .populate('materiaId', 'nombre')
      .populate('gradoId',   'nombre nivel');

    // Agrupar por materia para los bloques
    const materiaMap = {};
    for (const asig of asignaciones) {
      const mId = asig.materiaId._id.toString();
      if (!materiaMap[mId]) {
        materiaMap[mId] = { materia: asig.materiaId, grados: [] };
      }
      materiaMap[mId].grados.push({ asignacionId: asig._id, grado: asig.gradoId });
    }
    const bloques = Object.values(materiaMap);

    // Periodos disponibles
    const periodos = await Periodo.find({ año: AÑO_ACTUAL }).sort({ numero: 1 });

    let tabla = null;
    let gradoSeleccionado   = null;
    let materiaSeleccionada = null;
    let periodoSeleccionado = null;

    if (materiaId && gradoId && periodoId) {
      tabla = await construirTablaNotas({ gradoId, materiaId, periodoId });
      gradoSeleccionado   = await Grado.findById(gradoId).select('nombre nivel');
      materiaSeleccionada = await Materia.findById(materiaId).select('nombre');
      periodoSeleccionado = await Periodo.findById(periodoId).select('nombre numero activo');
    }

    res.render('paginas/notas-docente', {
      titulo:             'Notas',
      paginaActual:       'notas',
      bloques,
      periodos,
      tabla,
      gradoSeleccionado,
      materiaSeleccionada,
      periodoSeleccionado,
      materiaIdActiva:    materiaId || null,
      gradoIdActivo:      gradoId   || null,
      periodoIdActivo:    periodoId || null,
      mensajeExito:       req.flash('exito'),
      mensajeError:       req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelDocente notas:', error);
    req.flash('error', 'Error al cargar el módulo de notas.');
    res.redirect('/dashboard');
  }
};

/** Editar nota (docente) — solo antes del cierre del periodo */
const editarNotaDocente = async (req, res) => {
  try {
    const { id } = req.params;
    const { valor } = req.body;
    const docenteId = req.session.usuario._id;

    const nota = await Nota.findById(id);
    if (!nota) return res.status(404).json({ ok: false, error: 'Nota no encontrada' });

    // Verificar que sea su nota
    if (nota.docenteId.toString() !== docenteId.toString()) {
      return res.status(403).json({ ok: false, error: 'No puedes modificar notas de otro docente' });
    }

    if (!nota.modificable) {
      return res.status(400).json({ ok: false, error: 'El periodo está cerrado. Esta nota ya no puede modificarse.' });
    }

    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum < 1.0 || valorNum > 5.0) {
      return res.status(400).json({ ok: false, error: 'La nota debe estar entre 1.0 y 5.0' });
    }

    // Guardar valor anterior para el historial
    const valorAnterior = nota.valor;

    nota.valor = valorNum;
    await nota.save();

    // Actualizar también la EntregaActividad
    await EntregaActividad.findByIdAndUpdate(nota.entregaActividadId, { nota: valorNum });

    // ── Registrar en el historial ─────────────────────────────────────────
    // Enriquecer con nombres legibles para la descripción
    const [actividad, materia, estudiante] = await Promise.all([
      Actividad.findById(nota.actividadId).select('titulo'),
      Materia.findById(nota.materiaId).select('nombre'),
      Usuario.findById(nota.estudianteId).select('nombre apellido'),
    ]);

    const nombreUsuario    = `${req.session.usuario.nombre} ${req.session.usuario.apellido}`.trim();
    const correoUsuario    = req.session.usuario.correo;
    const rolUsuario       = req.session.usuario.rol;
    const nombreEstudiante = estudiante ? `${estudiante.nombre} ${estudiante.apellido}` : 'Estudiante desconocido';
    const nombreMateria    = materia?.nombre    || 'Materia desconocida';
    const nombreActividad  = actividad?.titulo  || 'Actividad desconocida';

    await registrarCambio(req, {
      accion:    'EDITAR_NOTA',
      entidad:   'Nota',
      entidadId: nota._id,
      cambios: {
        valor: { antes: valorAnterior, despues: valorNum },
      },
    });

    res.json({ ok: true, valor: valorNum });
  } catch (error) {
    console.error('Error al editar nota docente:', error);
    res.status(500).json({ ok: false, error: 'Error al actualizar la nota' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ESTUDIANTE
// ─────────────────────────────────────────────────────────────────────────────

const panelEstudiante = async (req, res) => {
  try {
    const estudianteId = req.session.usuario._id;
    const { periodoId } = req.query;

    // Matrícula activa
    const matricula = await Matricula.findOne({
      estudianteId,
      año:    AÑO_ACTUAL,
      estado: 'activa',
    }).populate('gradoId', 'nombre nivel materias');

    // Periodos del año
    const periodos = await Periodo.find({ año: AÑO_ACTUAL }).sort({ numero: 1 });
    const periodoActivo = periodos.find(p => p.activo) || periodos[periodos.length - 1];
    const periodoFiltro = periodoId || periodoActivo?._id?.toString();

    let seccionesMaterias = [];

    if (matricula && periodoFiltro) {
      // Todas las notas del estudiante en este periodo
      const notas = await Nota.find({
        estudianteId,
        periodoId: periodoFiltro,
        gradoId:   matricula.gradoId._id,
      })
        .populate('materiaId',    'nombre')
        .populate('actividadId',  'titulo fechaLimite')
        .populate('docenteId',    'nombre apellido')
        .sort({ createdAt: 1 });

      // Obtener la entrega para ver el comentario del docente
      const entregasIds = notas.map(n => n.entregaActividadId).filter(Boolean);
      const entregas = await EntregaActividad.find({ _id: { $in: entregasIds } })
        .select('_id comentarioDocente');
      const mapaEntregas = {};
      for (const e of entregas) mapaEntregas[e._id.toString()] = e;

      // Agrupar notas por materia
      const materiaMap = {};
      for (const nota of notas) {
        const mId = nota.materiaId?._id?.toString();
        if (!mId) continue;
        if (!materiaMap[mId]) {
          materiaMap[mId] = {
            materia:   nota.materiaId,
            docente:   nota.docenteId,
            notas:     [],
          };
        }
        const entrega = nota.entregaActividadId
          ? mapaEntregas[nota.entregaActividadId.toString()]
          : null;
        materiaMap[mId].notas.push({
          ...nota.toObject(),
          comentarioDocente: entrega?.comentarioDocente || '',
        });
      }

      // Calcular promedios
      seccionesMaterias = Object.values(materiaMap).map(sec => {
        const valores  = sec.notas.map(n => n.valor);
        const promedio = calcularPromedio(valores);
        const aprobada = promedio !== null && promedio >= 3.0;
        return { ...sec, promedio, aprobada };
      });
    }

    res.render('paginas/notas-estudiante', {
      titulo:            'Mis Notas',
      paginaActual:      'notas',
      seccionesMaterias,
      periodos,
      periodoIdActivo:   periodoFiltro || null,
      matricula,
      mensajeExito:      req.flash('exito'),
      mensajeError:      req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelEstudiante notas:', error);
    req.flash('error', 'Error al cargar las notas.');
    res.redirect('/dashboard');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN / DIRECTOR — acceso total
// ─────────────────────────────────────────────────────────────────────────────

const panelAdmin = async (req, res) => {
  try {
    const { gradoId, materiaId, periodoId } = req.query;

    const [grados, materias, periodos] = await Promise.all([
      Grado.find({ activo: true, año: AÑO_ACTUAL }).sort({ nivel: 1, nombre: 1 }),
      Materia.find({ activo: true }).sort({ nombre: 1 }),
      Periodo.find({ año: AÑO_ACTUAL }).sort({ numero: 1 }),
    ]);

    let tabla = null;
    let gradoSeleccionado   = null;
    let materiaSeleccionada = null;
    let periodoSeleccionado = null;

    if (gradoId && materiaId && periodoId) {
      tabla = await construirTablaNotas({ gradoId, materiaId, periodoId });
      [gradoSeleccionado, materiaSeleccionada, periodoSeleccionado] = await Promise.all([
        Grado.findById(gradoId).select('nombre nivel'),
        Materia.findById(materiaId).select('nombre'),
        Periodo.findById(periodoId).select('nombre numero activo'),
      ]);
    }

    res.render('paginas/notas-admin', {
      titulo:             'Notas — Vista Completa',
      paginaActual:       'notas',
      grados,
      materias,
      periodos,
      tabla,
      gradoSeleccionado,
      materiaSeleccionada,
      periodoSeleccionado,
      gradoIdActivo:      gradoId   || null,
      materiaIdActiva:    materiaId || null,
      periodoIdActivo:    periodoId || null,
      mensajeExito:       req.flash('exito'),
      mensajeError:       req.flash('error'),
    });
  } catch (error) {
    console.error('Error en panelAdmin notas:', error);
    req.flash('error', 'Error al cargar notas.');
    res.redirect('/dashboard');
  }
};

/** Editar nota (admin/director) — sin restricción de periodo */
const editarNotaAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { valor } = req.body;

    const nota = await Nota.findById(id);
    if (!nota) return res.status(404).json({ ok: false, error: 'Nota no encontrada' });

    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum < 1.0 || valorNum > 5.0) {
      return res.status(400).json({ ok: false, error: 'La nota debe estar entre 1.0 y 5.0' });
    }

    // Guardar valor anterior para el historial
    const valorAnterior = nota.valor;

    nota.valor = valorNum;
    await nota.save();

    await EntregaActividad.findByIdAndUpdate(nota.entregaActividadId, { nota: valorNum });

    // ── Registrar en el historial ─────────────────────────────────────────
    const [actividad, materia, estudiante] = await Promise.all([
      Actividad.findById(nota.actividadId).select('titulo'),
      Materia.findById(nota.materiaId).select('nombre'),
      Usuario.findById(nota.estudianteId).select('nombre apellido'),
    ]);

    const nombreUsuario    = `${req.session.usuario.nombre} ${req.session.usuario.apellido}`.trim();
    const correoUsuario    = req.session.usuario.correo;
    const rolUsuario       = req.session.usuario.rol;
    const nombreEstudiante = estudiante ? `${estudiante.nombre} ${estudiante.apellido}` : 'Estudiante desconocido';
    const nombreMateria    = materia?.nombre   || 'Materia desconocida';
    const nombreActividad  = actividad?.titulo || 'Actividad desconocida';

    await registrarCambio(req, {
      accion:    'EDITAR_NOTA',
      entidad:   'Nota',
      entidadId: nota._id,
      cambios: {
        valor: { antes: valorAnterior, despues: valorNum },
      },
    });

    res.json({ ok: true, valor: valorNum });
  } catch (error) {
    console.error('Error al editar nota admin:', error);
    res.status(500).json({ ok: false, error: 'Error al actualizar la nota' });
  }
};

/** Redirigir según rol */
const redirigirPorRol = (req, res) => {
  const { rol } = req.session.usuario;
  if (rol === 'docente')    return res.redirect('/notas/docente');
  if (rol === 'estudiante') return res.redirect('/notas/estudiante');
  return res.redirect('/notas/admin');
};

module.exports = {
  panelDocente,
  editarNotaDocente,
  panelEstudiante,
  panelAdmin,
  editarNotaAdmin,
  redirigirPorRol,
};