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
  form.querySelector('[name="fechaLimite"]').min = ahora.toISOString().slice(0, 16);

  document.getElementById('drawerTitulo').textContent = 'Nueva actividad';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(form);

  abrirPanelDrawer();
  lucide.createIcons();
}

function abrirDrawerEditar(id, titulo, desc, fechaLimite) {
  const template = document.getElementById('templateEditarActividad');
  const form     = template.content.cloneNode(true).querySelector('form');

  form.action = `/actividades/docente/${id}`;
  form.querySelector('#editTitulo').value = titulo;
  form.querySelector('#editDesc').value   = desc;
  form.querySelector('#editFecha').value  = fechaLimite;

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
  }
  lucide.createIcons();

