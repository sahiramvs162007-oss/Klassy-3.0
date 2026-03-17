/**
 * config/multer.js
 * Configuración de multer para manejar archivos de actividades y entregas.
 * Tipos permitidos: jpg, jpeg, png, pdf, docx, pptx, xlsx, mp3, mp4
 */

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ─── Tipos MIME permitidos ────────────────────────────────────────────────────
const TIPOS_PERMITIDOS = {
  'image/jpeg':                                                    'jpg',
  'image/png':                                                     'png',
  'application/pdf':                                               'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword':                                            'doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint':                                 'ppt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel':                                      'xls',
  'audio/mpeg':                                                    'mp3',
  'audio/mp3':                                                     'mp3',
  'video/mp4':                                                     'mp4',
};

// ─── Función genérica para crear storage ─────────────────────────────────────
const crearStorage = (subcarpeta) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, `../public/uploads/${subcarpeta}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext       = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const random    = Math.round(Math.random() * 1e6);
    cb(null, `${subcarpeta}_${timestamp}_${random}${ext}`);
  },
});

// ─── Filtro de tipos de archivo ───────────────────────────────────────────────
const filtroArchivos = (req, file, cb) => {
  if (TIPOS_PERMITIDOS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

// ─── Exportar instancias de multer por contexto ───────────────────────────────

// Para archivos adjuntos que publica el docente en la actividad (máx 5 archivos, 50MB c/u)
const subirArchivosActividad = multer({
  storage:  crearStorage('actividades'),
  fileFilter: filtroArchivos,
  limits: { fileSize: 50 * 1024 * 1024 },
}).array('archivos', 5);

// Para entregas de estudiantes (máx 5 archivos, 50MB c/u)
const subirArchivosEntrega = multer({
  storage:  crearStorage('entregas'),
  fileFilter: filtroArchivos,
  limits: { fileSize: 50 * 1024 * 1024 },
}).array('archivos', 5);

// ─── Middleware con manejo de errores de multer ───────────────────────────────
const manejarSubidaActividad = (req, res, next) => {
  subirArchivosActividad(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      req.flash('error', `Error al subir archivo: ${err.message}`);
      return res.redirect('back');
    } else if (err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    next();
  });
};

const manejarSubidaEntrega = (req, res, next) => {
  subirArchivosEntrega(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      req.flash('error', `Error al subir archivo: ${err.message}`);
      return res.redirect('back');
    } else if (err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    next();
  });
};

// ─── Helper: construir objeto archivo desde req.file ─────────────────────────
const mapearArchivo = (file) => ({
  nombreOriginal: file.originalname,
  nombreArchivo:  file.filename,
  ruta:           `/uploads/${file.destination.split('/uploads/')[1]}/${file.filename}`,
  tipoMime:       file.mimetype,
  tamanio:        file.size,
});

module.exports = {
  manejarSubidaActividad,
  manejarSubidaEntrega,
  mapearArchivo,
  TIPOS_PERMITIDOS,
};
