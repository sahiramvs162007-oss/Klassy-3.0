/**
 * public/js/materias.js
 * Drawer de creación y edición de materias.
 */

function abrirDrawerCrearMateria() {
  const contenedor = clonarFormMateria();

  contenedor.querySelector('#metodoMateria').value             = '';
  contenedor.querySelector('#formMateria').action              = '/materias';
  contenedor.querySelector('#textoGuardarMateria').textContent = 'Crear materia';
  contenedor.querySelector('#grupoActivoMateria').style.display = 'none';

  document.getElementById('drawerTitulo').textContent = 'Nueva materia';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(contenedor);

  abrirPanelDrawer();
  lucide.createIcons();
}

async function abrirDrawerEditarMateria(id) {
  document.getElementById('drawerTitulo').textContent = 'Cargando...';
  abrirPanelDrawer();

  try {
    const res     = await fetch(`/materias/${id}/datos`);
    if (!res.ok) throw new Error('Error al obtener materia');
    const materia = await res.json();

    const contenedor = clonarFormMateria();

    contenedor.querySelector('#formMateria').action               = `/materias/${id}?_method=PUT`;
    contenedor.querySelector('#metodoMateria').value              = 'PUT';
    contenedor.querySelector('#campoNombreMateria').value         = materia.nombre || '';
    contenedor.querySelector('#campoDescMateria').value           = materia.descripcion || '';
    contenedor.querySelector('#grupoActivoMateria').style.display = 'flex';
    contenedor.querySelector('#campoActivoMateria').value         = materia.activo ? 'true' : 'false';
    contenedor.querySelector('#textoGuardarMateria').textContent  = 'Guardar cambios';

    document.getElementById('drawerTitulo').textContent = `Editar: ${materia.nombre}`;
    document.getElementById('drawerCuerpo').innerHTML   = '';
    document.getElementById('drawerCuerpo').appendChild(contenedor);
    lucide.createIcons();

  } catch (e) {
    document.getElementById('drawerCuerpo').innerHTML =
      '<p class="texto-error">Error al cargar la materia.</p>';
  }
}

function clonarFormMateria() {
  const template   = document.getElementById('templateFormMateria');
  const contenedor = document.createElement('div');
  contenedor.appendChild(template.content.cloneNode(true));
  return contenedor;
}

function abrirPanelDrawer() {
  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';
}

function confirmarEliminar(nombre) {
  return confirm(`¿Eliminar "${nombre}"?\nSe eliminará también de todos los grados que la tengan asignada.`);
}
