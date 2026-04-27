/**
 * controllers/materiaControlador.js
 * CRUD de materias con soporte de foto de portada.
 */

const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const { Materia, Grado } = require('../models');

// ─── Multer para portada de materia ──────────────────────────────────────────
const storagePortada = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'portadas');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `portada_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const filtroImagen = (req, file, cb) => {
  const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (permitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP, GIF)'), false);
  }
};

const subirPortada = multer({
  storage:    storagePortada,
  fileFilter: filtroImagen,
  limits:     { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('portada');

// Middleware con manejo de errores integrado
const manejarPortada = (req, res, next) => {
  subirPortada(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      req.flash('error', `Error al subir imagen: ${err.message}`);
      return res.redirect('/materias');
    } else if (err) {
      req.flash('error', err.message);
      return res.redirect('/materias');
    }
    next();
  });
};

// ─── LISTAR  GET /materias ────────────────────────────────────────────────────
const listarMaterias = async (req, res) => {
  try {
    const { buscar = '' } = req.query;
    const filtro = {};

    if (buscar.trim()) {
      filtro.nombre = new RegExp(buscar.trim(), 'i');
    }

    const materias = await Materia.find(filtro).sort({ nombre: 1 });

    res.render('paginas/materias', {
      titulo:       'Gestión de Materias',
      paginaActual: 'materias',
      materias,
      buscar,
    });
  } catch (error) {
    console.error('Error al listar materias:', error);
    req.flash('error', 'Error al cargar las materias.');
    res.redirect('/dashboard');
  }
};

// ─── OBTENER UNA  GET /materias/:id/datos ────────────────────────────────────
const obtenerMateria = async (req, res) => {
  try {
    const materia = await Materia.findById(req.params.id);
    if (!materia) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json(materia);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la materia' });
  }
};

// ─── CREAR  POST /materias ────────────────────────────────────────────────────
const crearMateria = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;

    const existe = await Materia.findOne({
      nombre: new RegExp(`^${nombre.trim()}$`, 'i'),
    });
    if (existe) {
      // Si subieron imagen pero hay error, borrarla para no dejar archivos huérfanos
      if (req.file) fs.unlink(req.file.path, () => {});
      req.flash('error', `Ya existe una materia llamada "${nombre.trim()}".`);
      return res.redirect('/materias');
    }

    // Si se subió imagen, usar esa ruta; si no, usar la imagen predeterminada
    const portada = req.file
      ? `/uploads/portadas/${req.file.filename}`
      : '/imagenes/portada-default.png';

    await Materia.create({
      nombre:      nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : '',
      portada,
    });

    req.flash('exito', `Materia "${nombre.trim()}" creada correctamente.`);
    res.redirect('/materias');
  } catch (error) {
    console.error('Error al crear materia:', error);
    if (req.file) fs.unlink(req.file.path, () => {});
    req.flash('error', 'Error al crear la materia.');
    res.redirect('/materias');
  }
};

// ─── EDITAR  PUT /materias/:id ────────────────────────────────────────────────
const editarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const materia = await Materia.findById(id);
    if (!materia) {
      if (req.file) fs.unlink(req.file.path, () => {});
      req.flash('error', 'Materia no encontrada.');
      return res.redirect('/materias');
    }

    const duplicada = await Materia.findOne({
      _id:    { $ne: id },
      nombre: new RegExp(`^${nombre.trim()}$`, 'i'),
    });
    if (duplicada) {
      if (req.file) fs.unlink(req.file.path, () => {});
      req.flash('error', `Ya existe otra materia llamada "${nombre.trim()}".`);
      return res.redirect('/materias');
    }

    // Si se subió una nueva imagen, actualizar portada y borrar la anterior
    if (req.file) {
      // Borrar imagen anterior solo si no es la predeterminada
      if (
        materia.portada &&
        !materia.portada.includes('portada-default') &&
        materia.portada.startsWith('/uploads/')
      ) {
        const rutaVieja = path.join(__dirname, '..', 'public', materia.portada);
        fs.unlink(rutaVieja, () => {});
      }
      materia.portada = `/uploads/portadas/${req.file.filename}`;
    }

    materia.nombre      = nombre.trim();
    materia.descripcion = descripcion ? descripcion.trim() : '';
    materia.activo      = activo === 'true';

    await materia.save();

    req.flash('exito', `Materia "${materia.nombre}" actualizada correctamente.`);
    res.redirect('/materias');
  } catch (error) {
    console.error('Error al editar materia:', error);
    if (req.file) fs.unlink(req.file.path, () => {});
    req.flash('error', 'Error al actualizar la materia.');
    res.redirect('/materias');
  }
};

// ─── ELIMINAR  DELETE /materias/:id ──────────────────────────────────────────
const eliminarMateria = async (req, res) => {
  try {
    const { id } = req.params;

    const materia = await Materia.findById(id);
    if (!materia) {
      req.flash('error', 'Materia no encontrada.');
      return res.redirect('/materias');
    }

    // Borrar imagen de portada si no es la predeterminada
    if (
      materia.portada &&
      !materia.portada.includes('portada-default') &&
      materia.portada.startsWith('/uploads/')
    ) {
      const rutaImg = path.join(__dirname, '..', 'public', materia.portada);
      fs.unlink(rutaImg, () => {});
    }

    // Quitar la materia de todos los grados que la tengan asignada
    await Grado.updateMany({ materias: id }, { $pull: { materias: id } });

    const nombre = materia.nombre;
    await Materia.findByIdAndDelete(id);

    req.flash('exito', `Materia "${nombre}" eliminada correctamente.`);
    res.redirect('/materias');
  } catch (error) {
    console.error('Error al eliminar materia:', error);
    req.flash('error', 'Error al eliminar la materia.');
    res.redirect('/materias');
  }
};

module.exports = {
  manejarPortada,
  listarMaterias,
  obtenerMateria,
  crearMateria,
  editarMateria,
  eliminarMateria,
};
