/**
 * config/multer.js
 * Configuración de multer para manejar archivos de actividades y entregas.
 */

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const upath   = require('upath'); // 🔥 NUEVO (reemplaza os)

// ─── Tipos MIME permitidos ────────────────────────────────────────────────────
const TIPOS_PERMITIDOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'video/mp4': 'mp4',
};

// ─── Función genérica para crear storage ─────────────────────────────────────
const crearStorage = (subcarpeta) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', subcarpeta);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

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

// ─── Subidas ────────────────────────────────────────────────────────────────
const subirArchivosActividad = multer({
  storage: crearStorage('actividades'),
  fileFilter: filtroArchivos,
  limits: { fileSize: 50 * 1024 * 1024 },
}).array('archivos', 5);

const subirArchivosEntrega = multer({
  storage: crearStorage('entregas'),
  fileFilter: filtroArchivos,
  limits: { fileSize: 50 * 1024 * 1024 },
}).array('archivos', 5);

// ─── Middleware con manejo de errores ────────────────────────────────────────
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

// ─── 🔥 FUNCIÓN CLAVE (ARREGLADA CON UPATH) ───────────────────────────────────
const mapearArchivo = (file) => {
  // Convertir ruta a formato universal (/)
  const ruta = upath.toUnix(file.path);

  // Buscar desde /uploads/
  const partes = ruta.split('/uploads/');

  const rutaPublica = partes[1]
    ? `/uploads/${partes[1]}`
    : `/uploads/${file.filename}`;

  return {
    nombreOriginal: file.originalname,
    nombreArchivo: file.filename,
    ruta: rutaPublica,
    tipoMime: file.mimetype,
    tamanio: file.size,
  };
};

// ─── Excel ──────────────────────────────────────────────────────────────────
const filtroSoloExcel = (req, file, cb) => {
  const mimesExcel = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  if (mimesExcel.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos Excel (.xlsx / .xls)'), false);
  }
};

const subirExcelUsuarios = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtroSoloExcel,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('archivoExcel');

const manejarSubidaExcelUsuarios = (req, res, next) => {
  subirExcelUsuarios(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      req.flash('error', `Error al subir archivo: ${err.message}`);
      return res.redirect('/usuarios');
    } else if (err) {
      req.flash('error', err.message);
      return res.redirect('/usuarios');
    }
    next();
  });
};

// ─── Exportaciones ───────────────────────────────────────────────────────────
module.exports = {
  manejarSubidaActividad,
  manejarSubidaEntrega,
  manejarSubidaExcelUsuarios,
  mapearArchivo,
  TIPOS_PERMITIDOS,
};