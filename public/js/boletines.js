/**
 * public/js/boletines.js
 * Inicializa paginación para las tablas de la sección Boletines y Reportes.
 */

document.addEventListener('DOMContentLoaded', function () {
  // Tabla principal de boletines
  if (document.getElementById('tbodyBoletines')) {
    iniciarPaginacion('tbodyBoletines', { filasPorPagina: 10 });
  }

  // Tabla del reporte por grado
  if (document.getElementById('tbodyReporteGrado')) {
    iniciarPaginacion('tbodyReporteGrado', { filasPorPagina: 15 });
  }

  // Tabla del reporte por materia
  if (document.getElementById('tbodyReporteMateria')) {
    iniciarPaginacion('tbodyReporteMateria', { filasPorPagina: 15 });
  }

  // Tabla del reporte general
  if (document.getElementById('tbodyReporteGeneral')) {
    iniciarPaginacion('tbodyReporteGeneral', { filasPorPagina: 15 });
  }
});
