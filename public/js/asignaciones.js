/**
 * public/js/asignaciones.js
 * Lógica del cliente para asignaciones de docentes.
 *
 * Flujo del formulario:
 *  1. Se elige el año → se filtran grados de ese año.
 *  2. Se elige el grado → se cargan sus materias vía API.
 *  3. Se elige la materia → queda lista para guardar.
 */

// ─── ABRIR DRAWER CREAR ───────────────────────────────────────────────────────
function abrirDrawerCrear() {
  const template = document.getElementById('templateCrearAsignacion');
  const form     = template.content.cloneNode(true).querySelector('form');

  // Año por defecto
  form.querySelector('#campoAnioAsig').value = ANO_ACTUAL;

  document.getElementById('drawerTitulo').textContent = 'Nueva asignación';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(form);

  abrirPanelDrawer();
  lucide.createIcons();

  // ── Picker de docente ──────────────────────────────────────────────────
  const contenedorDocente = document.getElementById('contenedorPickerDocente');
  const inputDocente      = document.getElementById('campoDocenteAsig');
  const ayudaEsp          = document.getElementById('ayudaEspecialidad');
  if (contenedorDocente && inputDocente) {
    _renderPickerDocente(contenedorDocente, inputDocente, ayudaEsp);
  }

  // ── Picker de grado ────────────────────────────────────────────────────
  setTimeout(() => {
    const contenedorGrado = document.getElementById('pickerGradoAsig');
    const inputGrado      = document.getElementById('campoGradoAsig');
    if (!contenedorGrado || !inputGrado) return;

    const anioInput = document.getElementById('campoAnioAsig');
    const getAnio   = () => parseInt(anioInput?.value, 10) || ANO_ACTUAL;

    const pickerGrado = createGradoPicker({
      contenedor:  contenedorGrado,
      inputHidden: inputGrado,
      gradosData:  GRADOS_DISPONIBLES,
      getAnio,
      prefijo:     'pkAsig',
      onSelect:    () => cargarMateriasDeGrado(),
    });
    pickerGrado.init(getAnio());

    if (anioInput) {
      anioInput.addEventListener('change', () => {
        pickerGrado.refresh(parseInt(anioInput.value, 10) || ANO_ACTUAL);
        const selMat = document.getElementById('campoMateriaAsig');
        if (selMat) selMat.innerHTML = '<option value="">Selecciona un grado primero</option>';
        lucide.createIcons();
      });
    }

    lucide.createIcons();
  }, 50);
}


// Renderiza el buscador de docente dentro del drawer
function _renderPickerDocente(contenedor, inputHidden, ayudaEl) {
  contenedor.innerHTML = `
    <div class="picker-docente">
      <div class="picker-docente__buscar">
        <i data-lucide="search" class="picker-docente__icono"></i>
        <input
          type="text"
          id="drawerBuscarDocente"
          class="filtro-docente__entrada"
          placeholder="Buscar docente..."
          autocomplete="off"
        />
      </div>
      <div class="picker-docente__lista" id="drawerListaDocentes"></div>
    </div>
  `;

  lucide.createIcons();

  const lista    = document.getElementById('drawerListaDocentes');
  const buscador = document.getElementById('drawerBuscarDocente');

  function renderLista(filtro) {
    lista.innerHTML = '';
    const term = (filtro || '').trim().toLowerCase();
    const docentesFiltrados = DOCENTES_DISPONIBLES.filter(d =>
      !term || (`${d.nombre} ${d.apellido}`).toLowerCase().includes(term)
    );

    if (docentesFiltrados.length === 0) {
      lista.innerHTML = '<p class="filtro-docente__vacio">Sin resultados</p>';
      return;
    }

    docentesFiltrados.forEach(d => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filtro-docente__chip filtro-docente__chip--drawer';
      btn.dataset.id = d._id;
      btn.innerHTML = `
        <span class="filtro-docente__avatar filtro-docente__avatar--verde">
          ${d.nombre.charAt(0).toUpperCase()}${d.apellido.charAt(0).toUpperCase()}
        </span>
        <div class="filtro-docente__info">
          <span class="filtro-docente__nombre">${d.nombre} ${d.apellido}</span>
          ${d.profesion ? `<span class="filtro-docente__profesion">${d.profesion}</span>` : ''}
        </div>
        <i data-lucide="check" class="filtro-docente__check" id="check_${d._id}" style="display:none"></i>
      `;
      btn.addEventListener('click', () => {
        // Desmarcar todos
        lista.querySelectorAll('.filtro-docente__chip').forEach(c => {
          c.classList.remove('filtro-docente__chip--activo');
          const chk = c.querySelector('.filtro-docente__check');
          if (chk) chk.style.display = 'none';
        });
        // Marcar este
        btn.classList.add('filtro-docente__chip--activo');
        const chk = btn.querySelector('.filtro-docente__check');
        if (chk) chk.style.display = '';
        // Guardar valor
        inputHidden.value = d._id;
        if (ayudaEl) {
          ayudaEl.textContent = d.profesion ? `Especialidad: ${d.profesion}` : '';
        }
        lucide.createIcons();
      });
      lista.appendChild(btn);
    });
    lucide.createIcons();
  }

  renderLista('');
  buscador.addEventListener('input', e => renderLista(e.target.value));
}

// Carga las materias del grado seleccionado vía API
async function cargarMateriasDeGrado() {
  const selectGrado   = document.getElementById('campoGradoAsig');
  const selectMateria = document.getElementById('campoMateriaAsig');
  if (!selectGrado || !selectMateria) return;

  const gradoId = selectGrado.value;
  if (!gradoId) {
    selectMateria.innerHTML = '<option value="">Selecciona un grado primero</option>';
    return;
  }

  selectMateria.innerHTML = '<option value="">Cargando...</option>';

  try {
    const res = await fetch(`/asignaciones/grado/${gradoId}/materias`);
    if (!res.ok) throw new Error('Error al obtener materias');
    const materias = await res.json();

    selectMateria.innerHTML = '<option value="">Seleccionar materia</option>';
    if (materias.length === 0) {
      selectMateria.innerHTML = '<option value="" disabled>Este grado no tiene materias asignadas</option>';
      return;
    }

    materias.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m._id;
      opt.textContent = m.nombre;
      selectMateria.appendChild(opt);
    });

  } catch (e) {
    console.error(e);
    selectMateria.innerHTML = '<option value="">Error al cargar materias</option>';
  }
}

// ─── ABRIR DRAWER DETALLE ─────────────────────────────────────────────────────
async function abrirDrawerDetalle(id) {
  document.getElementById('drawerTitulo').textContent = 'Cargando...';
  abrirPanelDrawer();

  try {
    const res = await fetch(`/asignaciones/${id}/datos`);
    if (!res.ok) throw new Error('Error al obtener asignación');
    const a   = await res.json();

    const docente  = a.docenteId;
    const grado    = a.gradoId;
    const materia  = a.materiaId;

    const badgeEstado = a.estado === 'activo'
      ? '<span class="badge badge--activo">Activo</span>'
      : '<span class="badge badge--inactivo">Inactivo</span>';

    const html = `
      <div class="detalle-matricula">

        <!-- Cabecera del docente -->
        <div class="detalle-matricula__estudiante">
          <div class="usuario-celda__avatar usuario-celda__avatar--docente"
            style="width:44px;height:44px;font-size:1rem;">
            ${docente ? docente.nombre.charAt(0).toUpperCase() + docente.apellido.charAt(0).toUpperCase() : '??'}
          </div>
          <div>
            <h3 class="detalle-matricula__nombre">
              ${docente ? docente.nombre + ' ' + docente.apellido : '—'}
            </h3>
            ${docente?.correo ? `<span class="texto-secundario texto-sm">${docente.correo}</span>` : ''}
          </div>
        </div>

        <!-- Especialidad destacada -->
        ${docente?.profesion ? `
          <div class="detalle-especialidad">
            <i data-lucide="briefcase" style="width:14px;height:14px;flex-shrink:0;"></i>
            <span>${docente.profesion}</span>
          </div>
        ` : ''}

        <!-- Datos de la asignación -->
        <div class="detalle-grid">
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Materia</span>
            <span class="detalle-campo__valor">${materia ? materia.nombre : '—'}</span>
          </div>
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Grado</span>
            <span class="detalle-campo__valor">${grado ? grado.nombre : '—'}</span>
          </div>
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Nivel</span>
            <span class="detalle-campo__valor badge badge--azul">Nivel ${grado ? grado.nivel : '—'}</span>
          </div>
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Año</span>
            <span class="detalle-campo__valor">${a.año}</span>
          </div>
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Estado</span>
            <span class="detalle-campo__valor">${badgeEstado}</span>
          </div>
        </div>

        ${materia?.descripcion ? `
          <div class="detalle-obs">
            <span class="detalle-campo__etiqueta">Descripción de la materia</span>
            <p class="detalle-obs__texto">${materia.descripcion}</p>
          </div>
        ` : ''}

        <!-- Acciones rápidas desde el detalle -->
        <div class="drawer__pie" style="padding:0;margin-top:auto;">
          <form method="POST" action="/asignaciones/${a._id}?_method=PUT" style="display:inline">
            <input type="hidden" name="estado" value="${a.estado === 'activo' ? 'inactivo' : 'activo'}" />
            <button type="submit" class="btn btn--secundario btn--sm">
              <i data-lucide="${a.estado === 'activo' ? 'pause-circle' : 'play-circle'}"></i>
              ${a.estado === 'activo' ? 'Desactivar' : 'Activar'}
            </button>
          </form>
          <form method="POST" action="/asignaciones/${a._id}?_method=DELETE"
            onsubmit="return confirm('¿Eliminar esta asignación?')" style="display:inline">
            <button type="submit" class="btn btn--peligro btn--sm">
              <i data-lucide="trash-2"></i> Eliminar
            </button>
          </form>
        </div>

      </div>
    `;

    document.getElementById('drawerTitulo').textContent = 'Detalle de asignación';
    document.getElementById('drawerCuerpo').innerHTML   = html;
    lucide.createIcons();

  } catch (e) {
    console.error(e);
    document.getElementById('drawerCuerpo').innerHTML =
      '<p class="texto-error">Error al cargar el detalle.</p>';
  }
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function abrirPanelDrawer() {
  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';
}

// ─── Paginación ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  iniciarPaginacion('tbodyAsignaciones', { filasPorPagina: 10 });
});

document.addEventListener('DOMContentLoaded', function () {

  // ── Filtro de grado ──
  if (typeof initFiltroGradoPicker === 'function') {
    initFiltroGradoPicker({
      gradosData:        GRADOS_DISPONIBLES,
      filtroGradoActivo: FILTRO_GRADO_ACTIVO_ASIG,
      formId:            'formFiltrosAsig',
      inputHiddenId:     'inputFiltroGradoAsig',
      anioSelectName:    'filtroAnio',
      triggerBtnId:      'btnFiltroGradoAsig',
      panelId:           'panelFiltroGradoAsig',
    });
  }

  // ── Paginación ──
  if (typeof iniciarPaginacion === 'function') {
    iniciarPaginacion('tbodyAsignaciones', { filasPorPagina: 10 });
  }

  // ── Iconos ──
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

window.toggleFiltroDocente = function () {
  const panel   = document.getElementById('docentePanel');
  const chevron = document.getElementById('docenteChevron');
  const trigger = document.getElementById('btnFiltroDocenteAsig');

  const abierto = panel.classList.contains('filtro-nivel__panel--abierto');

  panel.classList.toggle('filtro-nivel__panel--abierto', !abierto);

  if (chevron) {
    chevron.style.transform = abierto ? '' : 'rotate(180deg)';
  }

  trigger.classList.toggle('filtro-nivel_edu--activo', !abierto);

  if (!abierto) {
    setTimeout(() => {
      document.getElementById('inputBuscarDocente')?.focus();
    }, 80);
  }
};

window.filtrarDocentes = function (q) {
  const term  = q.trim().toLowerCase();
  const chips = document.querySelectorAll('#listaDocentes .filtro-docente__chip');

  let visibles = 0;

  chips.forEach(chip => {
    const nombre = chip.dataset.nombre || '';
    const match  = nombre.includes(term);

    chip.style.display = match ? '' : 'none';

    if (match) visibles++;
  });

  const msg = document.getElementById('msgSinDocentes');
  if (msg) msg.style.display = visibles === 0 ? '' : 'none';
};

window.seleccionarDocente = function (id) {
  document.getElementById('inputFiltroDocenteAsig').value = id;
  document.getElementById('formFiltrosAsig').submit();
};