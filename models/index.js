/**
 * models/index.js
 */

const Usuario            = require('./Usuario');
const Materia            = require('./Materia');
const Grado              = require('./Grado');
const Periodo            = require('./Periodo');
const Matricula          = require('./Matricula');
const AsignacionDocente  = require('./AsignacionDocente');
const Actividad          = require('./Actividad');
const EntregaActividad   = require('./EntregaActividad');
const Nota               = require('./Nota');
const ResultadoPeriodo   = require('./ResultadoPeriodo');
const ResultadoAnual     = require('./ResultadoAnual');
const Boletin            = require('./Boletin');
const Noticia            = require('./Noticia');
const Configuracion      = require('./Configuracion');
const Notificacion       = require('./Notificacion');

module.exports = {
  Usuario,
  Materia,
  Grado,
  Periodo,
  Matricula,
  AsignacionDocente,
  Actividad,
  EntregaActividad,
  Nota,
  ResultadoPeriodo,
  ResultadoAnual,
  Boletin,
  Noticia,
  Configuracion,
  Notificacion,
};
