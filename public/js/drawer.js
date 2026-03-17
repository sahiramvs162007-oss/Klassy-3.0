/**
 * drawer.js — Lógica del panel lateral deslizante de KLASSY
 * El drawer se abre desde la derecha y ocupa el 50% del ancho.
 */

/**
 * Abre el drawer con un título y contenido HTML.
 * @param {string} titulo  - Título que se muestra en la cabecera del drawer
 * @param {string} htmlCuerpo - Contenido HTML para el cuerpo del drawer
 */
function abrirDrawer(titulo, htmlCuerpo) {
  const drawer        = document.getElementById('drawer');
  const overlay       = document.getElementById('drawerOverlay');
  const drawerTitulo  = document.getElementById('drawerTitulo');
  const drawerCuerpo  = document.getElementById('drawerCuerpo');

  drawerTitulo.textContent = titulo;
  drawerCuerpo.innerHTML   = htmlCuerpo;

  drawer.classList.add('drawer--abierto');
  overlay.classList.add('drawer-overlay--visible');

  // Evitar scroll del fondo
  document.body.style.overflow = 'hidden';

  // Re-iniciar iconos Lucide dentro del drawer
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Cierra el drawer lateral.
 */
function cerrarDrawer() {
  const drawer  = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');

  drawer.classList.remove('drawer--abierto');
  overlay.classList.remove('drawer-overlay--visible');

  document.body.style.overflow = '';
}

/**
 * Cierra el drawer al presionar Escape.
 */
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') {
    cerrarDrawer();
  }
});
