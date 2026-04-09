/**
 * controllers/matriculaControlador.js
 * Módulo de matrículas.
 *
 * Reglas de negocio:
 *  - Solo usuarios con rol 'estudiante' pueden matricularse.
 *  - Un estudiante solo puede tener UNA matrícula por año.
 *  - El nivel del grado debe ser ultimoNivelCursado + 1.
 *  - Si el estudiante ya tiene historial (ResultadoAnual) → tipo 'matriculaRenovada'.
 *  - Si ultimoNivelCursado === 11 → no puede volver a matricularse.
 *  - Se valida cupo del grado (si cupo > 0).
 *  - Matrícula masiva: solo cuando el 4to periodo está activo.
 *    · Si el estudiante aprobó todas las materias → sube de nivel y de salón (mismo sufijo).
 *    · Si reprobó alguna → queda en el mismo nivel.
 *    · Se respeta cupo; el excedente se distribuye en otros grados del mismo nivel con cupo.
 */

const { Matricula, Usuario, Grado, ResultadoAnual, Periodo } = require('../models');
const { registrarCambio } = require('../middlewares/registrarHistorial');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const contarMatriculadosEnGrado = async (gradoId, año) => {
  return Matricula.countDocuments({ gradoId, año, estado: 'activa' });
};

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

    if (buscar.trim()) {
      const termino = buscar.trim().toLowerCase();
      matriculas = matriculas.filter(m => {
        if (!m.estudianteId) return false;
        const nombreCompleto = `${m.estudianteId.nombre} ${m.estudianteId.apellido}`.toLowerCase();
        return nombreCompleto.includes(termino);
      });
    }

    const [años, grados] = await Promise.all([
      Matricula.distinct('año'),
      Grado.find({ activo: true }).sort({ año: -1, nivel: 1, nombre: 1 }),
    ]);
    años.sort((a, b) => b - a);

    // Verificar si el 4to periodo está activo (para mostrar botón de matrícula masiva)
    const añoActual = new Date().getFullYear();
    const cuartoPeriodo = await Periodo.findOne({ numero: 4, año: añoActual });
    const puedeMasiva = !!cuartoPeriodo;

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
      añoActual,
      puedeMasiva,
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
const datosFormulario = async (req, res) => {
  try {
    const año = parseInt(req.query.año, 10) || new Date().getFullYear();

    const estudiantesYaMatriculados = await Matricula.distinct('estudianteId', { año });

    const estudiantes = await Usuario.find({
      rol:    'estudiante',
      activo: true,
      _id:    { $nin: estudiantesYaMatriculados },
      ultimoNivelCursado: { $lt: 11 },
    }).select('nombre apellido correo ultimoNivelCursado').sort({ apellido: 1 });

    // Solo grados con cupo disponible
    const grados = await Grado.find({ activo: true, año })
      .select('nombre nivel año cupo')
      .sort({ nivel: 1, nombre: 1 });

    const gradosConCupo = await Promise.all(
      grados.map(async (g) => {
        const matriculados = await contarMatriculadosEnGrado(g._id, año);
        const cupoDisponible = g.cupo > 0 ? g.cupo - matriculados : 999;
        return { ...g.toObject(), matriculados, cupoDisponible };
      })
    );

    res.json({
      estudiantes,
      grados: gradosConCupo.filter(g => g.cupoDisponible > 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del formulario' });
  }
};

// ─── CREAR  POST /matriculas ──────────────────────────────────────────────────
const crearMatricula = async (req, res) => {
  try {
    const { estudianteId, gradoId, año, observaciones } = req.body;
    const añoNum = parseInt(año, 10);

    const estudiante = await Usuario.findById(estudianteId);
    if (!estudiante || estudiante.rol !== 'estudiante') {
      req.flash('error', 'Solo los estudiantes pueden ser matriculados.');
      return res.redirect('/matriculas');
    }

    if (estudiante.ultimoNivelCursado >= 11) {
      req.flash('error', `${estudiante.nombre} ${estudiante.apellido} ya completó el nivel 11.`);
      return res.redirect('/matriculas');
    }

    const yaMatriculado = await Matricula.findOne({ estudianteId, año: añoNum });
    if (yaMatriculado) {
      req.flash('error', `${estudiante.nombre} ${estudiante.apellido} ya tiene matrícula para ${añoNum}.`);
      return res.redirect('/matriculas');
    }

    const grado = await Grado.findById(gradoId);
    if (!grado) {
      req.flash('error', 'Grado no encontrado.');
      return res.redirect('/matriculas');
    }

    const nivelEsperado = (estudiante.ultimoNivelCursado || 0) + 1;
    if (grado.nivel !== nivelEsperado) {
      req.flash('error',
        `Nivel inválido. ${estudiante.nombre} debe matricularse en nivel ${nivelEsperado}. ` +
        `El grado seleccionado es nivel ${grado.nivel}.`
      );
      return res.redirect('/matriculas');
    }

    if (grado.cupo > 0) {
      const matriculados = await contarMatriculadosEnGrado(gradoId, añoNum);
      if (matriculados >= grado.cupo) {
        req.flash('error', `El grado "${grado.nombre}" no tiene cupo disponible (${grado.cupo} máximo).`);
        return res.redirect('/matriculas');
      }
    }

    const esRenovada = await tieneHistorial(estudianteId);
    const tipo = esRenovada ? 'matriculaRenovada' : 'nuevaMatricula';

    await Matricula.create({
      estudianteId,
      gradoId,
      año:            añoNum,
      nivelAcademico: grado.nivel,
      estado:         'activa',
      tipo,
      observaciones:  observaciones ? observaciones.trim() : '',
      fechaMatricula: new Date(),
    });

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

// ─── EDITAR ESTADO / GRADO  PUT /matriculas/:id ───────────────────────────────
const editarMatricula = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones, gradoId } = req.body;

    const matricula = await Matricula.findById(id)
      .populate('estudianteId', 'nombre apellido ultimoNivelCursado');

    if (!matricula) {
      req.flash('error', 'Matrícula no encontrada.');
      return res.redirect('/matriculas');
    }

    const snapAntes = {
      estado:    matricula.estado,
      gradoId:   matricula.gradoId?.toString(),
    };
    let nuevoGradoNombre = null;

    if (gradoId && gradoId !== matricula.gradoId.toString()) {
      const nuevoGrado = await Grado.findById(gradoId);
      if (!nuevoGrado) {
        req.flash('error', 'Grado destino no encontrado.');
        return res.redirect('/matriculas');
      }
      if (nuevoGrado.cupo > 0) {
        const ocupados = await contarMatriculadosEnGrado(gradoId, matricula.año);
        if (ocupados >= nuevoGrado.cupo) {
          req.flash('error', `El grado "${nuevoGrado.nombre}" no tiene cupo disponible.`);
          return res.redirect('/matriculas');
        }
      }
      matricula.gradoId        = gradoId;
      matricula.nivelAcademico = nuevoGrado.nivel;
      nuevoGradoNombre = nuevoGrado.nombre;
    }

    if (estado) matricula.estado = estado;
    if (observaciones !== undefined) matricula.observaciones = observaciones.trim();

    await matricula.save();

    const estudianteNombre = `${matricula.estudianteId.nombre} ${matricula.estudianteId.apellido}`;
    const cambios = {};
    if (snapAntes.estado !== matricula.estado) cambios.estado = { antes: snapAntes.estado, despues: matricula.estado };
    if (nuevoGradoNombre) cambios.gradoId = { antes: snapAntes.gradoId, despues: matricula.gradoId.toString() };

    await registrarCambio(req, {
      accion:    'EDITAR_MATRICULA',
      entidad:   'Matricula',
      entidadId: matricula._id,
      cambios,
    });

    req.flash('exito', `Matrícula de ${estudianteNombre} actualizada.`);
    res.redirect('/matriculas');
  } catch (error) {
    console.error('Error al editar matrícula:', error);
    req.flash('error', 'Error al actualizar la matrícula.');
    res.redirect('/matriculas');
  }
};

// ─── DATOS PARA EDITAR MATRÍCULA  GET /matriculas/:id/grados-disponibles ─────
// Devuelve grados con cupo disponible del mismo nivel para reasignar
const gradosDisponiblesParaEditar = async (req, res) => {
  try {
    const matricula = await Matricula.findById(req.params.id).populate('gradoId');
    if (!matricula) return res.status(404).json({ error: 'Matrícula no encontrada' });

    const grados = await Grado.find({
      activo: true,
      año: matricula.año,
      nivel: matricula.nivelAcademico,
    }).select('nombre nivel año cupo');

    const gradosConCupo = await Promise.all(
      grados.map(async (g) => {
        const matriculados = await contarMatriculadosEnGrado(g._id, matricula.año);
        const cupoDisponible = g.cupo > 0 ? g.cupo - matriculados : 999;
        return { ...g.toObject(), matriculados, cupoDisponible };
      })
    );

    res.json({
      matricula,
      grados: gradosConCupo.filter(g => g.cupoDisponible > 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener grados disponibles' });
  }
};

// ─── ELIMINAR  DELETE /matriculas/:id ────────────────────────────────────────
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

// ─── MATRÍCULA MASIVA  POST /matriculas/masiva ────────────────────────────────
/**
 * Solo disponible cuando el 4to periodo está activo.
 * Lógica:
 *  1. Obtiene todos los estudiantes con matrícula activa en el año actual.
 *  2. Verifica ResultadoAnual: si aprobó todas las materias → sube nivel.
 *     Si reprobó alguna → mismo nivel (mismo grado si hay cupo).
 *  3. Intenta matricularlos en el siguiente año (añoActual + 1).
 *  4. Para los que suben: busca el grado del mismo "sufijo" (ej: 6b → 7b).
 *     Si no hay cupo, distribuye en otros grados del mismo nivel con cupo.
 *  5. Para los que repiten: intenta el mismo grado con cupo, luego distribuye.
 */
const matriculaMasiva = async (req, res) => {
  try {
    const añoActual = new Date().getFullYear();
    const añoNuevo  = añoActual + 1;

    // Verificar que el 4to periodo esté activo
    const cuartoPeriodo = await Periodo.findOne({ numero: 4, año: añoActual });
    if (!cuartoPeriodo) {
      req.flash('error', 'La matrícula masiva solo está disponible cuando el 4to periodo está activo.');
      return res.redirect('/matriculas');
    }

    // Obtener todas las matrículas activas del año actual
    const matriculasActuales = await Matricula.find({ año: añoActual, estado: 'activa' })
      .populate('estudianteId')
      .populate('gradoId');

    let matriculados = 0;
    let repetidores  = 0;
    let sinCupo      = 0;
    let yaExistian   = 0;
    const errores    = [];

    for (const mat of matriculasActuales) {
      const estudiante = mat.estudianteId;
      const gradoActual = mat.gradoId;

      if (!estudiante || !gradoActual) continue;

      // Verificar si ya tiene matrícula en el año nuevo
      const yaMatriculado = await Matricula.findOne({
        estudianteId: estudiante._id,
        año: añoNuevo,
      });
      if (yaMatriculado) {
        yaExistian++;
        continue;
      }

      // Verificar si aprobó todas las materias del año actual
      const resultados = await ResultadoAnual.find({
        estudianteId: estudiante._id,
        año: añoActual,
        gradoId: gradoActual._id,
      });

      const aprobóTodo = resultados.length > 0 && resultados.every(r => r.aprobado);
      const nivelNuevo = aprobóTodo
        ? gradoActual.nivel + 1
        : gradoActual.nivel;

      // Si ya completó nivel 11
      if (nivelNuevo > 11) continue;

      // Extraer sufijo del nombre del grado (ej: "6B" → "B", "7° A" → "A")
      const sufijo = gradoActual.nombre.replace(/[^a-zA-Z]/g, '').toUpperCase() || '';

      // Buscar grado destino: mismo nivel en el año nuevo, preferir mismo sufijo
      const gradosDestino = await Grado.find({ nivel: nivelNuevo, año: añoNuevo, activo: true })
        .sort({ nombre: 1 });

      if (!gradosDestino.length) {
        errores.push(`Sin grados de nivel ${nivelNuevo} para ${añoNuevo} — ${estudiante.nombre} ${estudiante.apellido}.`);
        sinCupo++;
        continue;
      }

      // Ordenar: primero el que tenga el mismo sufijo
      gradosDestino.sort((a, b) => {
        const sufA = a.nombre.replace(/[^a-zA-Z]/g, '').toUpperCase();
        const sufB = b.nombre.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (sufA === sufijo && sufB !== sufijo) return -1;
        if (sufB === sufijo && sufA !== sufijo) return 1;
        return 0;
      });

      // Encontrar primer grado con cupo disponible
      let gradoAsignado = null;
      for (const gd of gradosDestino) {
        const ocupados = await contarMatriculadosEnGrado(gd._id, añoNuevo);
        if (gd.cupo === 0 || ocupados < gd.cupo) {
          gradoAsignado = gd;
          break;
        }
      }

      if (!gradoAsignado) {
        errores.push(`Sin cupo disponible en nivel ${nivelNuevo} para ${estudiante.nombre} ${estudiante.apellido}.`);
        sinCupo++;
        continue;
      }

      // Crear matrícula
      await Matricula.create({
        estudianteId:   estudiante._id,
        gradoId:        gradoAsignado._id,
        año:            añoNuevo,
        nivelAcademico: gradoAsignado.nivel,
        estado:         'activa',
        tipo:           'matriculaRenovada',
        observaciones:  aprobóTodo
          ? `Promoción automática desde ${gradoActual.nombre} (${añoActual})`
          : `Repite nivel desde ${gradoActual.nombre} (${añoActual})`,
        fechaMatricula: new Date(),
      });

      if (aprobóTodo) {
        matriculados++;
        // Actualizar ultimoNivelCursado
        await Usuario.findByIdAndUpdate(estudiante._id, {
          ultimoNivelCursado: gradoActual.nivel,
        });
      } else {
        repetidores++;
      }
    }

    let mensaje = `Matrícula masiva completada para ${añoNuevo}: `;
    mensaje += `${matriculados} promovido(s), ${repetidores} repite(n) nivel.`;
    if (yaExistian) mensaje += ` ${yaExistian} ya estaban matriculados.`;
    if (sinCupo)    mensaje += ` ${sinCupo} sin cupo disponible.`;

    if (errores.length) {
      req.flash('error', errores.slice(0, 5).join(' | ') + (errores.length > 5 ? ` ... y ${errores.length - 5} más.` : ''));
    }
    req.flash('exito', mensaje);
    res.redirect('/matriculas');
  } catch (error) {
    console.error('Error en matrícula masiva:', error);
    req.flash('error', 'Error al ejecutar la matrícula masiva.');
    res.redirect('/matriculas');
  }
};

module.exports = {
  listarMatriculas,
  obtenerMatricula,
  datosFormulario,
  crearMatricula,
  editarMatricula,
  gradosDisponiblesParaEditar,
  eliminarMatricula,
  matriculaMasiva,
};
