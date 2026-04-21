/**
 * main.js — Utilidades generales de KLASSY
 */

/**
 * Muestra u oculta el sidebar en dispositivos móviles.
 * También maneja el overlay de fondo.
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const abierto = sidebar.classList.toggle('sidebar--abierto');
  if (overlay) overlay.classList.toggle('sidebar-overlay--visible', abierto);
}

/**
 * Cierra las alertas flash al hacer clic en ellas.
 */
document.addEventListener('DOMContentLoaded', () => {
  const alertas = document.querySelectorAll('.alerta');
  alertas.forEach((alerta) => {
    alerta.addEventListener('click', () => {
      alerta.style.opacity = '0';
      alerta.style.transition = 'opacity 0.2s ease';
      setTimeout(() => alerta.remove(), 200);
    });
  });
});

/**
 * Picker de grado multinivel — compartido por actividades y notas.
 * Usado en bloques de materia del docente para seleccionar nivel → salón.
 */
function mostrarSalones(mId, nivel) {
  const paso1   = document.getElementById('paso1-'   + mId);
  const salones = document.getElementById('salones-' + mId + '-' + nivel);
  if (paso1)   paso1.style.display = 'none';
  if (salones) {
    salones.style.display   = 'block';
    salones.style.animation = 'none';
    salones.offsetHeight;
    salones.style.animation = 'pickerSlideIn 0.2s ease';
  }
}

function volverNiveles(mId, nivel) {
  const salones = document.getElementById('salones-' + mId + '-' + nivel);
  const paso1   = document.getElementById('paso1-'   + mId);
  if (salones) salones.style.display = 'none';
  if (paso1) {
    paso1.style.display   = '';
    paso1.style.animation = 'none';
    paso1.offsetHeight;
    paso1.style.animation = 'pickerSlideIn 0.18s ease';
  }
}
