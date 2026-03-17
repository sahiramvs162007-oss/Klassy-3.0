/**
 * main.js — Utilidades generales de KLASSY
 */

/**
 * Muestra u oculta el sidebar en dispositivos móviles.
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('sidebar--abierto');
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
