/**
 * controllers/noticiaControlador.js
 * Gestión de noticias: admin, director y docente.
 */

const { Noticia } = require('../models');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ─── Storage multer ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/noticias');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `noticia_${Date.now()}_${Math.round(Math.random() * 1e4)}${ext}`);
  },
});

const subirImagen = multer({
  storage,
  fileFilter: (req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Solo imágenes JPG, PNG, WebP o GIF'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('imagen');

const manejarImagen = (req, res, next) => {
  subirImagen(req, res, (err) => {
    if (err) { req.flash('error', err.message); return res.redirect('back'); }
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

// ─── OBTENER  GET /noticias/:id/datos ─────────────────────────────────────────
const obtenerNoticia = async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id);
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

    await Noticia.create({
      titulo:           titulo.trim(),
      contenido:        contenido.trim(),
      autorId,
      fechaPublicacion: fechaPublicacion ? new Date(fechaPublicacion) : new Date(),
      activo:           activo !== 'false',
      imagen:           req.file ? `/uploads/noticias/${req.file.filename}` : null,
    });

    req.flash('exito', `Noticia "${titulo.trim()}" creada correctamente.`);
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
    const { titulo, contenido, fechaPublicacion, activo } = req.body;
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) {
      req.flash('error', 'Noticia no encontrada.');
      return res.redirect('/noticias');
    }

    noticia.titulo           = titulo.trim();
    noticia.contenido        = contenido.trim();
    noticia.fechaPublicacion = fechaPublicacion ? new Date(fechaPublicacion) : noticia.fechaPublicacion;
    noticia.activo           = activo !== 'false';

    if (req.file) {
      // Borrar imagen anterior
      if (noticia.imagen) {
        const ruta = path.join(__dirname, '../public', noticia.imagen);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
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
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) {
      req.flash('error', 'Noticia no encontrada.');
      return res.redirect('/noticias');
    }
    if (noticia.imagen) {
      const ruta = path.join(__dirname, '../public', noticia.imagen);
      if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
    }
    const titulo = noticia.titulo;
    await Noticia.findByIdAndDelete(req.params.id);
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
  manejarImagen,
};
