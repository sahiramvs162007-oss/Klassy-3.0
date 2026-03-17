/**
 * public/js/notificaciones.js
 * Sistema de notificaciones en la topbar.
 *
 * - Consulta el conteo de no leídas al cargar la página.
 * - Polling cada 60 segundos para actualizar el badge.
 * - Al abrir el panel carga la lista completa.
 * - Permite marcar individual o todas como leídas.
 * - Permite eliminar notificaciones.
 */

// ─── Iconos por tipo ──────────────────────────────────────────────────────────
const ICONOS_TIPO = {
  recuperacion_contrasena: 'key-round',
  nueva_actividad:         'clipboard-list',
  cierre_anio:             'calendar-check',
  administrativa:          'bell',
};

const COLORES_TIPO = {
  recuperacion_contrasena: 'notif-item__icono--naranja',
  nueva_actividad:         'notif-item__icono--azul',
  cierre_anio:             'notif-item__icono--morado',
  administrativa:          'notif-item__icono--gris',
};

let panelAbierto = false;

// ─── Inicializar al cargar la página ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  actualizarConteo();
  // Polling cada 60 segundos
  setInterval(actualizarConteo, 60_000);

  // Cerrar panel al hacer clic fuera
  document.addEventListener('click', (e) => {
    const campana = document.getElementById('notifCampana');
    if (campana && !campana.contains(e.target)) {
      cerrarPanelNotif();
    }
  });
});

// ─── Actualizar el badge de conteo ───────────────────────────────────────────
async function actualizarConteo() {
  try {
    const res   = await fetch('/notificaciones/conteo');
    const datos = await res.json();
    if (!datos.ok) return;

    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    if (datos.conteo > 0) {
      badge.textContent = datos.conteo > 99 ? '99+' : datos.conteo;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch {
    // Silencioso — no interrumpir la UI
  }
}

// ─── Abrir / cerrar panel ─────────────────────────────────────────────────────
function togglePanelNotif() {
  if (panelAbierto) {
    cerrarPanelNotif();
  } else {
    abrirPanelNotif();
  }
}

async function abrirPanelNotif() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;

  panel.style.display = 'flex';
  panelAbierto = true;

  await cargarNotificaciones();
}

function cerrarPanelNotif() {
  const panel = document.getElementById('notifPanel');
  if (panel) panel.style.display = 'none';
  panelAbierto = false;
}

// ─── Cargar lista de notificaciones ──────────────────────────────────────────
async function cargarNotificaciones() {
  const lista = document.getElementById('notifLista');
  if (!lista) return;

  lista.innerHTML = `
    <div class="notif-panel__cargando">
      <i data-lucide="loader-2" class="notif-spin"></i>
    </div>`;
  lucide.createIcons();

  try {
    const res   = await fetch('/notificaciones');
    const datos = await res.json();
    if (!datos.ok) throw new Error('Error en respuesta');

    const notifs = datos.notificaciones;

    if (notifs.length === 0) {
      lista.innerHTML = `
        <div class="notif-panel__vacia">
          <i data-lucide="bell-off"></i>
          <p>Sin notificaciones</p>
        </div>`;
      document.getElementById('notifConteoTexto').textContent = '';
      lucide.createIcons();
      return;
    }

    // Contar no leídas para el footer
    const noLeidas = notifs.filter(n => n.estado === 'no_leida').length;
    const conteoEl = document.getElementById('notifConteoTexto');
    if (conteoEl) {
      conteoEl.textContent = noLeidas > 0
        ? `${noLeidas} sin leer`
        : 'Todo al día';
    }

    lista.innerHTML = notifs.map(n => construirItemHTML(n)).join('');
    lucide.createIcons();

  } catch {
    lista.innerHTML = `<p class="notif-panel__error">Error al cargar notificaciones.</p>`;
  }
}

// ─── Construir HTML de un item ────────────────────────────────────────────────
function construirItemHTML(n) {
  const icono  = ICONOS_TIPO[n.tipo] || 'bell';
  const color  = COLORES_TIPO[n.tipo] || 'notif-item__icono--gris';
  const esNueva = n.estado === 'no_leida';
  const fecha  = formatearFechaRelativa(new Date(n.createdAt));

  const enlaceAttr = n.enlace
    ? `href="${n.enlace}" onclick="marcarLeida('${n._id}')"`
    : `href="#" onclick="marcarLeida('${n._id}'); return false;"`;

  return `
    <a ${enlaceAttr} class="notif-item ${esNueva ? 'notif-item--nueva' : ''}">
      <div class="notif-item__icono ${color}">
        <i data-lucide="${icono}"></i>
      </div>
      <div class="notif-item__contenido">
        <p class="notif-item__titulo">${n.titulo}</p>
        <p class="notif-item__mensaje">${n.mensaje}</p>
        <span class="notif-item__fecha">${fecha}</span>
      </div>
      <button class="notif-item__eliminar"
        onclick="eliminarNotif(event, '${n._id}')"
        title="Eliminar">
        <i data-lucide="x"></i>
      </button>
    </a>
  `;
}

// ─── Marcar una como leída ────────────────────────────────────────────────────
async function marcarLeida(id) {
  try {
    await fetch(`/notificaciones/${id}/leer`, { method: 'PUT' });
    await actualizarConteo();
    await cargarNotificaciones();
  } catch {}
}

// ─── Marcar todas como leídas ────────────────────────────────────────────────
async function marcarTodasLeidas() {
  try {
    await fetch('/notificaciones/leer-todas', { method: 'PUT' });
    await actualizarConteo();
    await cargarNotificaciones();
  } catch {}
}

// ─── Eliminar una notificación ────────────────────────────────────────────────
async function eliminarNotif(event, id) {
  event.preventDefault();
  event.stopPropagation();
  try {
    await fetch(`/notificaciones/${id}`, { method: 'DELETE' });
    await actualizarConteo();
    await cargarNotificaciones();
  } catch {}
}

// ─── Fecha relativa ───────────────────────────────────────────────────────────
function formatearFechaRelativa(fecha) {
  const ahora   = new Date();
  const diffSeg = Math.floor((ahora - fecha) / 1000);

  if (diffSeg < 60)    return 'Hace un momento';
  if (diffSeg < 3600)  return `Hace ${Math.floor(diffSeg / 60)} min`;
  if (diffSeg < 86400) return `Hace ${Math.floor(diffSeg / 3600)} h`;
  if (diffSeg < 604800)return `Hace ${Math.floor(diffSeg / 86400)} días`;

  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}
