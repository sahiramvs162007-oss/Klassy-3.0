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

// ── Opciones de entrega: toggle visual ───────────────────────────────
function toggleOpcion(card, inputId) {
  const input = card.querySelector('input[type="checkbox"]') || document.getElementById(inputId);
  if (!input) return;
  input.checked = !input.checked;
  card.classList.toggle('activo', input.checked);
}

// ── Grados picker: toggle fila ───────────────────────────────────────
function toggleGradoCheck(row) {
  const input = row.querySelector('input[type="checkbox"]');
  if (!input) return;
  input.checked = !input.checked;
  row.classList.toggle('marcado', input.checked);
}

// ── Filtro de grados en el picker del drawer ──────────────────────────
function filtrarGradosPicker(input, listaId) {
  const q = input.value.toLowerCase().trim();
  const lista = document.getElementById(listaId);
  if (!lista) return;
  let visible = 0;
  lista.querySelectorAll('.grado-check').forEach(item => {
    const nombre = (item.querySelector('.grado-check__nombre')?.textContent || '').toLowerCase();
    const nivel  = (item.querySelector('.grado-check__nivel')?.textContent  || '').toLowerCase();
    const match  = nombre.includes(q) || nivel.includes(q);
    item.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const vacio = lista.querySelector('.grados-picker__vacio');
  if (vacio) vacio.style.display = visible === 0 ? 'block' : 'none';
}
