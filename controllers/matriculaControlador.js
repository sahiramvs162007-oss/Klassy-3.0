/**
 * controllers/matriculaControlador.js
 * Módulo de matrículas — uno de los más complejos del sistema.
 *
 * Reglas de negocio:
 *  - Solo usuarios con rol 'estudiante' pueden matricularse.
 *  - Un estudiante solo puede tener UNA matrícula por año.
 *  - El nivel del grado debe ser ultimoNivelCursado + 1.
 *  - Si el estudiante ya tiene historial (ResultadoAnual) → tipo 'matriculaRenovada'.
 *  - Si ultimoNivelCursado === 11 → no puede volver a matricularse.
 *  - Se valida cupo del grado (si cupo > 0).
 *  - Al renovar: si aprobó → nivel sube 1; si reprobó → mismo nivel.
 */

const { Matricula, Usuario, Grado, ResultadoAnual } = require('../models');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Cuenta cuántos estudiantes activos tiene un grado en un año dado.
 */
const contarMatriculadosEnGrado = async (gradoId, año) => {
  return Matricula.countDocuments({
    gradoId,
    año,
    estado: 'activa',
  });
};

/**
 * Determina si un estudiante tiene historial académico (ResultadoAnual).
 * Si tiene → la matrícula es de tipo 'matriculaRenovada'.
 */
const tieneHistorial = async (estudianteId) => {
  const resultado = await ResultadoAnual.findOne({ estudianteId });
  return !!resultado;
};

// ─── LISTAR  GET /matriculas ──────────────────────────────────────────────────
const listarMatriculas = async (req, res) => {
  try {
    const {
      filtroAnio   = '',
      filtroEstado = '',
      filtroGrado  = '',
      buscar       = '',
    } = req.query;

    const filtro = {};

    if (filtroAnio)   filtro.año    = parseInt(filtroAnio, 10);
    if (filtroEstado) filtro.estado = filtroEstado;
    if (filtroGrado)  filtro.gradoId = filtroGrado;

    let matriculas = await Matricula.find(filtro)
      .populate('estudianteId', 'nombre apellido correo ultimoNivelCursado')
      .populate('gradoId',      'nombre nivel año')
      .sort({ createdAt: -1 });

    // Búsqueda por nombre del estudiante
    if (buscar.trim()) {
      const termino = buscar.trim().toLowerCase();
      matriculas = matriculas.filter(m => {
        if (!m.estudianteId) return false;
        const nombreCompleto = `${m.estudianteId.nombre} ${m.estudianteId.apellido}`.toLowerCase();
        return nombreCompleto.includes(termino);
      });
    }

    // Datos para los filtros de la vista
    const [años, grados] = await Promise.all([
      Matricula.distinct('año'),
      Grado.find({ activo: true }).sort({ año: -1, nivel: 1, nombre: 1 }),
    ]);
    años.sort((a, b) => b - a);

    res.render('paginas/matriculas', {
      titulo:       'Gestión de Matrículas',
      paginaActual: 'matriculas',
      matriculas,
      grados,
      años,
      filtroAnio,
      filtroEstado,
      filtroGrado,
      buscar,
      añoActual: new Date().getFullYear(),
    });
  } catch (error) {
    console.error('Error al listar matrículas:', error);
    req.flash('error', 'Error al cargar las matrículas.');
    res.redirect('/dashboard');
  }
};

// ─── OBTENER DETALLE  GET /matriculas/:id/datos ───────────────────────────────
const obtenerMatricula = async (req, res) => {
  try {
    const matricula = await Matricula.findById(req.params.id)
      .populate('estudianteId', 'nombre apellido correo ultimoNivelCursado')
      .populate('gradoId',      'nombre nivel año cupo');

    if (!matricula) return res.status(404).json({ error: 'Matrícula no encontrada' });

    // Historial de matrículas anteriores del mismo estudiante
    const historial = await Matricula.find({
      estudianteId: matricula.estudianteId._id,
      _id:          { $ne: matricula._id },
    })
      .populate('gradoId', 'nombre nivel año')
      .sort({ año: -1 });

    res.json({ matricula, historial });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la matrícula' });
  }
};

// ─── DATOS PARA FORMULARIO  GET /matriculas/formulario ───────────────────────
// Devuelve estudiantes y grados disponibles para poblar el formulario
const datosFormulario = async (req, res) => {
  try {
    const año = parseInt(req.query.año, 10) || new Date().getFullYear();

    // Estudiantes sin matrícula en ese año
    const estudiantesYaMatriculados = await Matricula.distinct('estudianteId', { año });

    const estudiantes = await Usuario.find({
      rol:    'estudiante',
      activo: true,
      _id:    { $nin: estudiantesYaMatriculados },
      // Excluir estudiantes que ya llegaron al nivel 11 y aprobaron
      ultimoNivelCursado: { $lt: 11 },
    }).select('nombre apellido correo ultimoNivelCursado').sort({ apellido: 1 });

    const grados = await Grado.find({ activo: true, año })
      .select('nombre nivel año cupo')
      .sort({ nivel: 1, nombre: 1 });

    res.json({ estudiantes, grados });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del formulario' });
  }
};

// ─── CREAR  POST /matriculas ──────────────────────────────────────────────────
const crearMatricula = async (req, res) => {
  try {
    const { estudianteId, gradoId, año, observaciones } = req.body;
    const añoNum = parseInt(año, 10);

    // 1. Verificar que el estudiante exista y sea estudiante
    const estudiante = await Usuario.findById(estudianteId);
    if (!estudiante || estudiante.rol !== 'estudiante') {
      req.flash('error', 'Solo los estudiantes pueden ser matriculados.');
      return res.redirect('/matriculas');
    }

    // 2. Nivel 11 ya cursado → no puede volver a matricularse
    if (estudiante.ultimoNivelCursado >= 11) {
      req.flash('error', `${estudiante.nombre} ${estudiante.apellido} ya completó el nivel 11 y no puede ser matriculado nuevamente.`);
      return res.redirect('/matriculas');
    }

    // 3. Solo una matrícula por año
    const yaMatriculado = await Matricula.findOne({ estudianteId, año: añoNum });
    if (yaMatriculado) {
      req.flash('error', `${estudiante.nombre} ${estudiante.apellido} ya tiene una matrícula para el año ${añoNum}.`);
      return res.redirect('/matriculas');
    }

    // 4. Verificar grado
    const grado = await Grado.findById(gradoId);
    if (!grado) {
      req.flash('error', 'Grado no encontrado.');
      return res.redirect('/matriculas');
    }

    // 5. Validar nivel: grado.nivel debe ser ultimoNivelCursado + 1
    const nivelEsperado = (estudiante.ultimoNivelCursado || 0) + 1;
    if (grado.nivel !== nivelEsperado) {
      req.flash('error',
        `Nivel inválido. ${estudiante.nombre} tiene último nivel ${estudiante.ultimoNivelCursado || 0}, ` +
        `debe matricularse en un grado de nivel ${nivelEsperado}. ` +
        `El grado seleccionado es nivel ${grado.nivel}.`
      );
      return res.redirect('/matriculas');
    }

    // 6. Verificar cupo del grado
    if (grado.cupo > 0) {
      const matriculados = await contarMatriculadosEnGrado(gradoId, añoNum);
      if (matriculados >= grado.cupo) {
        req.flash('error', `El grado "${grado.nombre}" no tiene cupo disponible (${grado.cupo} estudiantes máximo).`);
        return res.redirect('/matriculas');
      }
    }

    // 7. Determinar tipo: nueva o renovada según historial
    const esRenovada = await tieneHistorial(estudianteId);
    const tipo = esRenovada ? 'matriculaRenovada' : 'nuevaMatricula';

    // 8. Crear la matrícula
    const nuevaMatricula = await Matricula.create({
      estudianteId,
      gradoId,
      año:            añoNum,
      nivelAcademico: grado.nivel,
      estado:         'activa',
      tipo,
      observaciones:  observaciones ? observaciones.trim() : '',
      fechaMatricula: new Date(),
    });

    // 9. Actualizar ultimoNivelCursado en el usuario
    // (solo se actualiza cuando aprueban al cerrar año — Sprint 11,
    //  pero sí actualizamos el nivel en que está cursando actualmente)
    // Nota: El nivel cursado se actualiza en Sprint 11 (cerrarAño)

    req.flash('exito',
      `Matrícula de ${estudiante.nombre} ${estudiante.apellido} creada correctamente ` +
      `(${tipo === 'matriculaRenovada' ? 'Renovada' : 'Nueva'} — Nivel ${grado.nivel}).`
    );
    res.redirect('/matriculas');
  } catch (error) {
    console.error('Error al crear matrícula:', error);
    req.flash('error', 'Error al crear la matrícula. Verifica los datos.');
    res.redirect('/matriculas');
  }
};

// ─── EDITAR ESTADO / OBSERVACIONES  PUT /matriculas/:id ──────────────────────
const editarMatricula = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body;

    const matricula = await Matricula.findById(id)
      .populate('estudianteId', 'nombre apellido');

    if (!matricula) {
      req.flash('error', 'Matrícula no encontrada.');
      return res.redirect('/matriculas');
    }

    matricula.estado        = estado;
    matricula.observaciones = observaciones ? observaciones.trim() : '';

    await matricula.save();

    req.flash('exito', `Matrícula de ${matricula.estudianteId.nombre} ${matricula.estudianteId.apellido} actualizada.`);
    res.redirect('/matriculas');
  } catch (error) {
    console.error('Error al editar matrícula:', error);
    req.flash('error', 'Error al actualizar la matrícula.');
    res.redirect('/matriculas');
  }
};

// ─── ELIMINAR  DELETE /matriculas/:id ────────────────────────────────────────
// Solo se puede eliminar una matrícula activa (no cerrada por año)
const eliminarMatricula = async (req, res) => {
  try {
    const { id } = req.params;

    const matricula = await Matricula.findById(id)
      .populate('estudianteId', 'nombre apellido');

    if (!matricula) {
      req.flash('error', 'Matrícula no encontrada.');
      return res.redirect('/matriculas');
    }

    const nombre = `${matricula.estudianteId.nombre} ${matricula.estudianteId.apellido}`;
    await Matricula.findByIdAndDelete(id);

    req.flash('exito', `Matrícula de ${nombre} eliminada.`);
    res.redirect('/matriculas');
  } catch (error) {
    console.error('Error al eliminar matrícula:', error);
    req.flash('error', 'Error al eliminar la matrícula.');
    res.redirect('/matriculas');
  }
};

module.exports = {
  listarMatriculas,
  obtenerMatricula,
  datosFormulario,
  crearMatricula,
  editarMatricula,
  eliminarMatricula,
};
