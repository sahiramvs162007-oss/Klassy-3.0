/**
 * controllers/noticiaControlador.js
 * CRUD de noticias. Acceso: admin, director, docente.
 */

const { Noticia, Usuario, Grado, Materia, Matricula } = require('../models');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ─── Storage de imágenes de noticias ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/noticias');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `noticia_${Date.now()}${ext}`);
  },
});

const subirImagenNoticia = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const tipos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    tipos.includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo imágenes JPG, PNG o WebP'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single('imagen');

// Middleware con manejo de errores
const manejarImagenNoticia = (req, res, next) => {
  subirImagenNoticia(req, res, (err) => {
    if (err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    next();
  });
};

// ─── LISTAR  GET /noticias ────────────────────────────────────────────────────
const listarNoticias = async (req, res) => {
  try {
    const { filtroEstado = '' } = req.query;
    const filtro = {};
    if (filtroEstado === 'activas')   filtro.activo = true;
    if (filtroEstado === 'inactivas') filtro.activo = false;

    const noticias = await Noticia.find(filtro)
      .populate('autorId', 'nombre apellido')
      .sort({ fechaPublicacion: -1 });

    res.render('paginas/noticias', {
      titulo:       'Gestión de Noticias',
      paginaActual: 'noticias',
      noticias,
      filtroEstado,
      mensajeExito: req.flash('exito'),
      mensajeError: req.flash('error'),
    });
  } catch (error) {
    console.error('Error al listar noticias:', error);
    req.flash('error', 'Error al cargar las noticias.');
    res.redirect('/dashboard');
  }
};

// ─── OBTENER UNA  GET /noticias/:id/datos ─────────────────────────────────────
const obtenerNoticia = async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id).populate('autorId', 'nombre apellido');
    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json(noticia);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener noticia' });
  }
};

// ─── CREAR  POST /noticias ────────────────────────────────────────────────────
const crearNoticia = async (req, res) => {
  try {
    const { titulo, contenido, fechaPublicacion, activo } = req.body;
    const autorId = req.session.usuario._id;

    const nuevaNoticia = await Noticia.create({
      titulo:           titulo.trim(),
      contenido:        contenido.trim(),
      autorId,
      fechaPublicacion: fechaPublicacion ? new Date(fechaPublicacion) : new Date(),
      activo:           activo !== 'false',
      imagen:           req.file ? `/uploads/noticias/${req.file.filename}` : null,
    });

    req.flash('exito', `Noticia "${nuevaNoticia.titulo}" creada correctamente.`);
    res.redirect('/noticias');
  } catch (error) {
    console.error('Error al crear noticia:', error);
    req.flash('error', 'Error al crear la noticia.');
    res.redirect('/noticias');
  }
};

// ─── EDITAR  PUT /noticias/:id ────────────────────────────────────────────────
const editarNoticia = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, contenido, fechaPublicacion, activo } = req.body;

    const noticia = await Noticia.findById(id);
    if (!noticia) {
      req.flash('error', 'Noticia no encontrada.');
      return res.redirect('/noticias');
    }

    noticia.titulo           = titulo.trim();
    noticia.contenido        = contenido.trim();
    noticia.fechaPublicacion = fechaPublicacion ? new Date(fechaPublicacion) : noticia.fechaPublicacion;
    noticia.activo           = activo !== 'false';

    // Si se sube nueva imagen, reemplazar
    if (req.file) {
      // Borrar imagen anterior si existe
      if (noticia.imagen) {
        const rutaAnterior = path.join(__dirname, '../public', noticia.imagen);
        if (fs.existsSync(rutaAnterior)) fs.unlinkSync(rutaAnterior);
      }
      noticia.imagen = `/uploads/noticias/${req.file.filename}`;
    }

    await noticia.save();

    req.flash('exito', `Noticia "${noticia.titulo}" actualizada.`);
    res.redirect('/noticias');
  } catch (error) {
    console.error('Error al editar noticia:', error);
    req.flash('error', 'Error al actualizar la noticia.');
    res.redirect('/noticias');
  }
};

// ─── ELIMINAR  DELETE /noticias/:id ──────────────────────────────────────────
const eliminarNoticia = async (req, res) => {
  try {
    const { id } = req.params;
    const noticia = await Noticia.findById(id);
    if (!noticia) {
      req.flash('error', 'Noticia no encontrada.');
      return res.redirect('/noticias');
    }

    // Borrar imagen si existe
    if (noticia.imagen) {
      const rutaImagen = path.join(__dirname, '../public', noticia.imagen);
      if (fs.existsSync(rutaImagen)) fs.unlinkSync(rutaImagen);
    }

    const titulo = noticia.titulo;
    await Noticia.findByIdAndDelete(id);

    req.flash('exito', `Noticia "${titulo}" eliminada.`);
    res.redirect('/noticias');
  } catch (error) {
    console.error('Error al eliminar noticia:', error);
    req.flash('error', 'Error al eliminar la noticia.');
    res.redirect('/noticias');
  }
};

module.exports = {
  listarNoticias,
  obtenerNoticia,
  crearNoticia,
  editarNoticia,
  eliminarNoticia,
  manejarImagenNoticia,
};
