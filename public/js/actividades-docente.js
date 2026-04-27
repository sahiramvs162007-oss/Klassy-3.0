/* ── Segmented control Vigentes / Finalizadas ─────────────────────── */
let _segActivo = 'vigentes';

function activarSegDoc(tab) {
  if (_segActivo === tab) return;          // sin-op si ya está activo
  _segActivo = tab;

  const panelV    = document.getElementById('panel-doc-vigentes');
  const panelF    = document.getElementById('panel-doc-finalizadas');
  const btnV      = document.getElementById('act-seg-vigentes');
  const btnF      = document.getElementById('act-seg-finalizadas');
  const pill      = document.getElementById('actSegPill');

  // — Cambiar paneles —
  if (tab === 'finalizadas') {
    if (panelV) panelV.style.display = 'none';
    if (panelF) { panelF.style.display = ''; panelF.classList.add('act-panel-anim'); }
  } else {
    if (panelF) panelF.style.display = 'none';
    if (panelV) { panelV.style.display = ''; panelV.classList.add('act-panel-anim'); }
  }

  // — Mover la píldora —
  const btnActivo = tab === 'vigentes' ? btnV : btnF;
  const btnInac   = tab === 'vigentes' ? btnF : btnV;
  if (btnActivo && pill) {
    pill.style.width     = btnActivo.offsetWidth  + 'px';
    pill.style.height    = btnActivo.offsetHeight + 'px';
    pill.style.transform = tab === 'finalizadas'
      ? 'translateX(' + btnActivo.offsetLeft + 'px)'
      : 'translateX(4px)';
  }

  // — Clases activo/inactivo —
  if (btnActivo)  btnActivo.classList.add('act-seg__btn--activo');
  if (btnInac)    btnInac.classList.remove('act-seg__btn--activo');
}

// Posicionar la píldora en el estado inicial (vigentes) al cargar
document.addEventListener('DOMContentLoaded', function () {
  const btn  = document.getElementById('act-seg-vigentes');
  const pill = document.getElementById('actSegPill');
  if (btn && pill) {
    pill.style.width     = btn.offsetWidth  + 'px';
    pill.style.height    = btn.offsetHeight + 'px';
    pill.style.transform = 'translateX(4px)';
  }
  lucide.createIcons();
});

/**
 * public/js/actividades-docente.js
 * Drawer de crear/editar actividad y preview de archivos.
 */

function abrirDrawerCrear() {
  const template = document.getElementById('templateCrearActividad');
  const form     = template.content.cloneNode(true).querySelector('form');

  // Fecha mínima: ahora
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  const ahoraStr = ahora.toISOString().slice(0, 16);

  // [NUEVO Claude] También soporta fechaInicio si existe el campo
  const campoInicio = form.querySelector('[name="fechaInicio"]');
  if (campoInicio) campoInicio.min = ahoraStr;
  form.querySelector('[name="fechaLimite"]').min = ahoraStr;

  document.getElementById('drawerTitulo').textContent = 'Nueva actividad';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(form);

  abrirPanelDrawer();
  lucide.createIcons();
}

// [NUEVO Claude] Firma extendida: fechaInicio, multiEntrega, tardiaOk
function abrirDrawerEditar(id, titulo, desc, fechaInicio, fechaLimite, multiEntrega, tardiaOk) {
  const template = document.getElementById('templateEditarActividad');
  const form     = template.content.cloneNode(true).querySelector('form');

  form.action = `/actividades/docente/${id}?_method=PUT`;
  form.querySelector('#editTitulo').value = titulo;
  form.querySelector('#editDesc').value   = desc || '';

  // [NUEVO Claude] Campos extendidos del editor
  const campoInicio = form.querySelector('#editFechaInicio');
  if (campoInicio) campoInicio.value = fechaInicio || '';

  const campoLimite = form.querySelector('#editFechaLimite') || form.querySelector('#editFecha');
  if (campoLimite) campoLimite.value = fechaLimite;

  const campoMulti  = form.querySelector('#editMultiEntrega');
  const campoTardia = form.querySelector('#editTardiaOk');
  if (campoMulti  && multiEntrega) campoMulti.checked  = true;
  if (campoTardia && tardiaOk)     campoTardia.checked = true;

  document.getElementById('drawerTitulo').textContent = 'Editar actividad';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(form);

  abrirPanelDrawer();
  lucide.createIcons();
}

function mostrarArchivosSeleccionados(input, contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  contenedor.innerHTML = '';

  for (const file of input.files) {
    const chip = document.createElement('div');
    chip.className = 'archivo-preview-chip';
    chip.innerHTML = `<i data-lucide="file" style="width:13px;height:13px;"></i> ${file.name}
      <span style="color:var(--gris-400);margin-left:4px;font-size:0.7rem">(${(file.size/1024/1024).toFixed(1)}MB)</span>`;
    contenedor.appendChild(chip);
  }
  lucide.createIcons();
}

function abrirPanelDrawer() {
  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';
}

function cambiarTab(tab) {
  // Tabs
  document.querySelectorAll('.act-tab').forEach(t => {
    t.classList.remove('act-tab--activo');
    t.setAttribute('aria-selected', 'false');
  });
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) { tabEl.classList.add('act-tab--activo'); tabEl.setAttribute('aria-selected', 'true'); }

  // Paneles
  document.querySelectorAll('.act-panel').forEach(p => p.classList.remove('act-panel--visible'));
  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('act-panel--visible');

  lucide.createIcons();
}

// ── Picker de grado multinivel: mostrarSalones / volverNiveles → main.js

// ─── [NUEVO Claude] Gestión de excepciones (detalle docente) ────────────────

async function agregarExcepcion(actividadId) {
  const estudianteId = document.getElementById('selectEstudianteExcepcion').value;
  const fechaLimite  = document.getElementById('inputFechaExcepcion').value;

  if (!estudianteId || !fechaLimite) {
    alert('Selecciona el estudiante y la fecha límite personalizada.');
    return;
  }

  try {
    const res = await fetch(`/actividades/docente/${actividadId}/excepciones`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ estudianteId, fechaLimitePersonalizada: fechaLimite }),
    });
    const datos = await res.json();
    if (datos.ok) {
      location.reload();
    } else {
      alert(datos.error || 'Error al agregar excepción.');
    }
  } catch (err) {
    alert('Error de conexión.');
  }
}

async function quitarExcepcion(actividadId, estudianteId) {
  if (!confirm('¿Quitar el acceso especial de este estudiante?')) return;
  try {
    const res = await fetch(`/actividades/docente/${actividadId}/excepciones/${estudianteId}`, {
      method: 'DELETE',
    });
    const datos = await res.json();
    if (datos.ok) location.reload();
    else alert(datos.error || 'Error al quitar excepción.');
  } catch (err) {
    alert('Error de conexión.');
  }
}