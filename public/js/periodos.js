/**
 * public/js/periodos.js
 * Drawer de creación y edición de periodos académicos.
 */

function abrirDrawerCrearPeriodo() {
  const contenedor = clonarFormPeriodo();

  contenedor.querySelector('#metodoPeriodo').value             = '';
  contenedor.querySelector('#formPeriodo').action              = '/periodos';
  contenedor.querySelector('#textoGuardarPeriodo').textContent = 'Crear periodo';
  contenedor.querySelector('#campoAnioPeriodo').value          = new Date().getFullYear();

  document.getElementById('drawerTitulo').textContent = 'Nuevo periodo';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(contenedor);

  abrirPanelDrawer();
  lucide.createIcons();
}

async function abrirDrawerEditarPeriodo(id) {
  document.getElementById('drawerTitulo').textContent = 'Cargando...';
  abrirPanelDrawer();

  try {
    const res     = await fetch(`/periodos/${id}/datos`);
    if (!res.ok) throw new Error('Error al obtener periodo');
    const periodo = await res.json();

    const contenedor = clonarFormPeriodo();

    contenedor.querySelector('#formPeriodo').action              = `/periodos/${id}?_method=PUT`;
    contenedor.querySelector('#metodoPeriodo').value             = 'PUT';
    contenedor.querySelector('#campoNombrePeriodo').value        = periodo.nombre || '';
    contenedor.querySelector('#campoNumeroPeriodo').value        = periodo.numero || '';
    contenedor.querySelector('#campoAnioPeriodo').value          = periodo.año || '';
    contenedor.querySelector('#textoGuardarPeriodo').textContent = 'Guardar cambios';

    if (periodo.fechaInicio) {
      contenedor.querySelector('#campoFechaInicio').value = formatearFecha(periodo.fechaInicio);
    }
    if (periodo.fechaFin) {
      contenedor.querySelector('#campoFechaFin').value = formatearFecha(periodo.fechaFin);
    }

    document.getElementById('drawerTitulo').textContent = `Editar: ${periodo.nombre}`;
    document.getElementById('drawerCuerpo').innerHTML   = '';
    document.getElementById('drawerCuerpo').appendChild(contenedor);

    lucide.createIcons();

  } catch (e) {
    console.error(e);
    document.getElementById('drawerCuerpo').innerHTML =
      '<p class="texto-error">Error al cargar el periodo.</p>';
  }
}

function clonarFormPeriodo() {
  const template   = document.getElementById('templateFormPeriodo');
  const contenedor = document.createElement('div');
  contenedor.appendChild(template.content.cloneNode(true));
  return contenedor;
}

function abrirPanelDrawer() {
  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';
}

function formatearFecha(fechaISO) {
  const d   = new Date(fechaISO);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function confirmarCierre(nombre) {
  return confirm(
    `¿Cerrar el periodo "${nombre}"?\n\n` +
    `⚠️ Esta acción es IRREVERSIBLE.\n` +
    `Al cerrar el periodo se generarán los boletines académicos de todos los estudiantes.`
  );
}

function confirmarEliminar(nombre) {
  return confirm(`¿Eliminar el periodo "${nombre}"?\nSolo es posible si no tiene datos asociados.`);
}
