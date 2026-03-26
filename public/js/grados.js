/**
 * public/js/grados.js
 * Drawer de creación y edición de grados.
 */

function abrirDrawerCrearGrado() {
  const contenedor = clonarFormGrado();

  contenedor.querySelector('#formGrado').action              = '/grados';
  contenedor.querySelector('#metodoGrado').value             = '';
  contenedor.querySelector('#textoGuardarGrado').textContent = 'Crear grado';
  contenedor.querySelector('#grupoActivoGrado').style.display = 'none';
  contenedor.querySelector('#campoAnioGrado').value          = new Date().getFullYear();

  llenarSelectNiveles(contenedor.querySelector('#campoNivelGrado'), null);
  construirListaMaterias(contenedor.querySelector('#listaMaterias'), []);

  document.getElementById('drawerTitulo').textContent = 'Nuevo grado';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(contenedor);

  abrirPanelDrawer();
  lucide.createIcons();
}

async function abrirDrawerEditarGrado(id) {
  document.getElementById('drawerTitulo').textContent = 'Cargando...';
  abrirPanelDrawer();

  try {
    const res   = await fetch(`/grados/${id}/datos`);
    if (!res.ok) throw new Error('Error al obtener grado');
    const grado = await res.json();

    const contenedor = clonarFormGrado();

    contenedor.querySelector('#formGrado').action               = `/grados/${id}?_method=PUT`;
    contenedor.querySelector('#metodoGrado').value              = 'PUT';
    contenedor.querySelector('#campoNombreGrado').value         = grado.nombre || '';
    contenedor.querySelector('#campoAnioGrado').value           = grado.año || '';
    contenedor.querySelector('#grupoActivoGrado').style.display = 'flex';
    contenedor.querySelector('#campoActivoGrado').value         = grado.activo ? 'true' : 'false';
    contenedor.querySelector('#textoGuardarGrado').textContent  = 'Guardar cambios';
    if (contenedor.querySelector('#campoCupoGrado')) {
      contenedor.querySelector('#campoCupoGrado').value = grado.cupo || 0;
    }

    llenarSelectNiveles(contenedor.querySelector('#campoNivelGrado'), grado.nivel);

    const materiasAsignadas = (grado.materias || []).map(m =>
      typeof m === 'object' ? m._id.toString() : m.toString()
    );
    construirListaMaterias(contenedor.querySelector('#listaMaterias'), materiasAsignadas);

    document.getElementById('drawerTitulo').textContent = `Editar: ${grado.nombre}`;
    document.getElementById('drawerCuerpo').innerHTML   = '';
    document.getElementById('drawerCuerpo').appendChild(contenedor);

    lucide.createIcons();

  } catch (e) {
    console.error(e);
    document.getElementById('drawerCuerpo').innerHTML =
      '<p class="texto-error">Error al cargar el grado.</p>';
  }
}

function llenarSelectNiveles(selectEl, nivelActual) {
  selectEl.innerHTML = '<option value="">Seleccionar nivel</option>';
  for (let n = 1; n <= 11; n++) {
    const opt       = document.createElement('option');
    opt.value       = n;
    opt.textContent = `Nivel ${n}`;
    if (nivelActual && parseInt(nivelActual) === n) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function construirListaMaterias(contenedor, materiasSeleccionadas) {
  contenedor.innerHTML = '';

  if (!window.MATERIAS_DISPONIBLES || MATERIAS_DISPONIBLES.length === 0) {
    contenedor.innerHTML = '<p class="texto-vacio" style="padding:8px 0">No hay materias registradas. Crea materias primero.</p>';
    return;
  }

  const buscador       = document.createElement('input');
  buscador.type        = 'text';
  buscador.placeholder = 'Filtrar materias...';
  buscador.className   = 'campo__entrada lista-checks__buscar';
  buscador.addEventListener('input', () => filtrarListaMaterias(buscador.value));
  contenedor.appendChild(buscador);

  const acciones       = document.createElement('div');
  acciones.className   = 'lista-checks__acciones';
  acciones.innerHTML   = `
    <button type="button" class="btn btn--secundario btn--sm" onclick="seleccionarTodasMaterias(true)">Seleccionar todas</button>
    <button type="button" class="btn btn--secundario btn--sm" onclick="seleccionarTodasMaterias(false)">Quitar todas</button>
  `;
  contenedor.appendChild(acciones);

  const lista     = document.createElement('div');
  lista.className = 'lista-checks__items';
  lista.id        = 'checksMateriasLista';

  MATERIAS_DISPONIBLES.forEach(materia => {
    const marcada  = materiasSeleccionadas.includes(materia._id.toString());
    const item     = document.createElement('label');
    item.className = 'check-item';
    item.innerHTML = `
      <input type="checkbox" name="materias" value="${materia._id}" ${marcada ? 'checked' : ''} class="check-item__input" />
      <span class="check-item__caja"></span>
      <span class="check-item__etiqueta">${materia.nombre}</span>
    `;
    lista.appendChild(item);
  });

  contenedor.appendChild(lista);
}

function filtrarListaMaterias(texto) {
  const items   = document.querySelectorAll('#checksMateriasLista .check-item');
  const termino = texto.toLowerCase().trim();
  items.forEach(item => {
    const etiqueta = item.querySelector('.check-item__etiqueta').textContent.toLowerCase();
    item.style.display = etiqueta.includes(termino) ? '' : 'none';
  });
}

function seleccionarTodasMaterias(marcar) {
  document.querySelectorAll('#checksMateriasLista .check-item__input')
    .forEach(cb => { cb.checked = marcar; });
}

function clonarFormGrado() {
  const template   = document.getElementById('templateFormGrado');
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
  return confirm(`¿Eliminar el grado "${nombre}"?\nEsta acción no se puede deshacer.`);
}

lucide.createIcons();

    // Acordeón nivel educativo
    function toggleFiltroNivel() {
      const panel   = document.getElementById('nivelPanel');
      const chevron = document.getElementById('nivelChevron');
      const trigger = document.getElementById('btnNivelTrigger');
      const abierto = panel.classList.toggle('filtro-nivel__panel--abierto');
      trigger.classList.toggle('filtro-nivel__trigger--activo', abierto);
      chevron.style.transform = abierto ? 'rotate(180deg)' : '';
    }

    // Si ya hay un nivel filtrado, abrir el panel al cargar
    if (typeof filtroNivel !== "undefined" && filtroNivel) { 
      document.getElementById('nivelPanel').classList.add('filtro-nivel__panel--abierto');
      document.getElementById('btnNivelTrigger').classList.add('filtro-nivel__trigger--activo');
      document.getElementById('nivelChevron').style.transform = 'rotate(180deg)';
    } 

document.addEventListener("DOMContentLoaded", function () {

  const selectEstado = document.getElementById("filtroEstado");
  if (!selectEstado) return;

  selectEstado.addEventListener("change", function () {

    const valor = this.value;
    const filas = document.querySelectorAll(".tabla__fila-card");

    filas.forEach(fila => {
      const estado = fila.getAttribute("data-estado");

      if (valor === "" || estado === valor) {
        fila.style.display = "";
      } else {
        fila.style.display = "none";
      }
    });

  });

});