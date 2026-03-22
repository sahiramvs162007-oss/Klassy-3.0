/**
 * controllers/retiroControlador.js
 * Módulo de retiro de estudiantes.
 *
 * Reglas:
 *  - Un estudiante retirado pasa de activo=true a activo=false (no se elimina).
 *  - Se registra la fecha de retiro, nombre y último grado cursado.
 *  - Puede reactivarse si el estudiante regresa al colegio.
 *  - Buscador por nombre, apellido o documento.
 */

const { Usuario, Matricula, RetiroEstudiante } = require('../models');

// ─── LISTAR  GET /retiros ─────────────────────────────────────────────────────
const listarRetiros = async (req, res) => {
  try {
    const { buscar = '' } = req.query;

    // Estudiantes activos (para poder retirar)
    const filtroActivos = { rol: 'estudiante', activo: true };
    if (buscar.trim()) {
      const regex = new RegExp(buscar.trim(), 'i');
      filtroActivos.$or = [
        { nombre:            regex },
        { apellido:          regex },
        { documentoIdentidad: regex },
      ];
    }
    const estudiantesActivos = await Usuario.find(filtroActivos)
      .select('nombre apellido documentoIdentidad ultimoNivelCursado correo')
      .sort({ apellido: 1 });

    // Historial de retiros
    let retiros = await RetiroEstudiante.find()
      .populate('estudianteId', 'nombre apellido documentoIdentidad activo')
      .sort({ fechaRetiro: -1 });

    if (buscar.trim()) {
      const termino = buscar.trim().toLowerCase();
      retiros = retiros.filter(r => {
        if (!r.estudianteId) return true;
        const nombre = `${r.estudianteId.nombre} ${r.estudianteId.apellido}`.toLowerCase();
        return nombre.includes(termino) ||
          (r.estudianteId.documentoIdentidad || '').toLowerCase().includes(termino) ||
          (r.nombreEstudiante || '').toLowerCase().includes(termino);
      });
    }

    res.render('paginas/retiros', {
      titulo:           'Retiro de Estudiantes',
      paginaActual:     'retiros',
      estudiantesActivos,
      retiros,
      buscar,
    });
  } catch (error) {
    console.error('Error al listar retiros:', error);
    req.flash('error', 'Error al cargar el módulo de retiros.');
    res.redirect('/dashboard');
  }
};

// ─── RETIRAR ESTUDIANTE  POST /retiros ────────────────────────────────────────
const retirarEstudiante = async (req, res) => {
  try {
    const { estudianteId, motivo } = req.body;

    const estudiante = await Usuario.findById(estudianteId);
    if (!estudiante || estudiante.rol !== 'estudiante') {
      req.flash('error', 'Estudiante no encontrado.');
      return res.redirect('/retiros');
    }

    if (!estudiante.activo) {
      req.flash('error', `${estudiante.nombre} ${estudiante.apellido} ya está inactivo.`);
      return res.redirect('/retiros');
    }

    // Buscar último grado cursado (matrícula más reciente)
    const ultimaMatricula = await Matricula.findOne({ estudianteId, estado: 'activa' })
      .populate('gradoId', 'nombre nivel año')
      .sort({ año: -1 });

    const ultimoGrado = ultimaMatricula
      ? `${ultimaMatricula.gradoId.nombre} (${ultimaMatricula.gradoId.año})`
      : 'Sin grado registrado';

    // Marcar como inactivo
    estudiante.activo = false;
    await estudiante.save();

    // Inactivar matrícula activa si existe
    if (ultimaMatricula) {
      ultimaMatricula.estado = 'inactiva';
      await ultimaMatricula.save();
    }

    // Registrar retiro
    await RetiroEstudiante.create({
      estudianteId:    estudiante._id,
      nombreEstudiante: `${estudiante.nombre} ${estudiante.apellido}`,
      documento:        estudiante.documentoIdentidad || '',
      ultimoGrado:      ultimoGrado,
      motivo:           motivo ? motivo.trim() : '',
      fechaRetiro:      new Date(),
    });

    req.flash('exito', `${estudiante.nombre} ${estudiante.apellido} fue retirado correctamente.`);
    res.redirect('/retiros');
  } catch (error) {
    console.error('Error al retirar estudiante:', error);
    req.flash('error', 'Error al procesar el retiro.');
    res.redirect('/retiros');
  }
};

// ─── REACTIVAR ESTUDIANTE  PUT /retiros/:id/reactivar ────────────────────────
const reactivarEstudiante = async (req, res) => {
  try {
    const { id } = req.params; // id del RetiroEstudiante

    const retiro = await RetiroEstudiante.findById(id);
    if (!retiro) {
      req.flash('error', 'Registro de retiro no encontrado.');
      return res.redirect('/retiros');
    }

    const estudiante = await Usuario.findById(retiro.estudianteId);
    if (!estudiante) {
      req.flash('error', 'Estudiante no encontrado en el sistema.');
      return res.redirect('/retiros');
    }

    estudiante.activo = true;
    await estudiante.save();

    // Marcar el retiro como reincorporado
    retiro.reincorporado = true;
    retiro.fechaReincorporacion = new Date();
    await retiro.save();

    req.flash('exito', `${estudiante.nombre} ${estudiante.apellido} fue reactivado. Debe ser matriculado manualmente.`);
    res.redirect('/retiros');
  } catch (error) {
    console.error('Error al reactivar estudiante:', error);
    req.flash('error', 'Error al reactivar el estudiante.');
    res.redirect('/retiros');
  }
};

module.exports = {
  listarRetiros,
  retirarEstudiante,
  reactivarEstudiante,
};
