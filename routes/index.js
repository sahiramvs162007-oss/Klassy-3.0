const express  = require('express');
const multer   = require('multer');
const router   = express.Router();
const autorizar = require('../middlewares/autorizar');
const { mostrarDashboard, guardarConfiguracion } = require('../controllers/dashboardControlador');

const autenticado = autorizar('admin', 'director', 'docente', 'estudiante');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// Redirección inicial
router.get('/', (req, res) => {
  if (!req.session.usuario) return res.redirect('/auth/login');
  res.redirect('/dashboard');
});

// Dashboard
router.get('/dashboard', autenticado, mostrarDashboard);

// ⚙️ Configuración con imagen
router.put(
  '/dashboard/configuracion',
  autorizar('admin'),
  upload.fields([
    { name: 'fotoInstitucion', maxCount: 1 },
    { name: 'logo', maxCount: 1 }
  ]),
  guardarConfiguracion
);

module.exports = router;