/**
 * public/js/grados.js
 * Drawer de creación/edición de grados + panel de detalle lateral.
 */

// ══════════════════════════════════════════════
// PANEL DE DETALLE DEL GRADO
// ══════════════════════════════════════════════

let gradoDetalleActual = null;

async function abrirDetalleGrado(id, nombre, nivel, año) {
  // Marcar fila activa
  document.querySelectorAll('.tabla__fila-card').forEach(f => f.classList.remove('fila--activa'));
  const fila = document.querySelector(`.tabla__fila-card[onclick*="${id}"]`);
  if (fila) fila.classList.add('fila--activa');

  // Actualizar cabecera del panel
  document.getElementById('detalleTitulo').textContent    = nombre;
  document.getElementById('detalleSubtitulo').textContent = `Nivel ${nivel} · Año ${año}`;

  // Mostrar panel con loading
  document.getElementById('detalleCuerpo').innerHTML = `
    <div class="detalle-cargando">
      <i data-lucide="loader-2" class="spin"></i>
      <span>Cargando detalle...</span>
    </div>`;
  document.getElementById('detallePanel').classList.add('detalle-panel--abierto');
  document.getElementById('detalleOverlay').classList.add('detalle-overlay--visible');
  lucide.createIcons();

  try {
    const res  = await fetch(`/grados/${id}/detalle`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');

    gradoDetalleActual = id;
    renderizarDetalleGrado(data);

  } catch (e) {
    document.getElementById('detalleCuerpo').innerHTML =
      `<p style="color:#DC2626;padding:20px;text-align:center">Error al cargar el detalle del grado.</p>`;
  }
}

function cerrarDetalleGrado() {
  document.getElementById('detallePanel').classList.remove('detalle-panel--abierto');
  document.getElementById('detalleOverlay').classList.remove('detalle-overlay--visible');
  document.querySelectorAll('.tabla__fila-card').forEach(f => f.classList.remove('fila--activa'));
  gradoDetalleActual = null;
}

function renderizarDetalleGrado(data) {
  const { grado, materias, estudiantes, asignaciones, director, totales } = data;

  // Calcular barra de cupo
  const cupoMax  = grado.cupo > 0 ? grado.cupo : null;
  const pct      = cupoMax ? Math.min((totales.matriculados / cupoMax) * 100, 100) : 0;
  const claseFill = pct >= 100 ? 'cupo-bar__fill--lleno' : pct >= 90 ? 'cupo-bar__fill--warn' : 'cupo-bar__fill--ok';

  const cupoHTML = cupoMax
    ? `<div class="cupo-bar-wrap">
        <div class="cupo-bar-label">
          <span>Ocupación del cupo</span>
          <span>${totales.matriculados}/${cupoMax} (${Math.round(pct)}%)</span>
        </div>
        <div class="cupo-bar">
          <div class="cupo-bar__fill ${claseFill}" style="width:${pct}%"></div>
        </div>
       </div>`
    : `<p style="font-size:13px;color:#6b7280">Cupo: sin límite · ${totales.matriculados} estudiantes matriculados</p>`;

  // Director
  const directorHTML = director
    ? crearPersonaHTML(director.nombre, director.apellido, director.correo, 'Director institucional', 'morado')
    : `<p style="font-size:13px;color:#6b7280">Sin director registrado</p>`;

  // Docentes por materia
  const docentesHTML = asignaciones.length > 0
    ? asignaciones.map(a =>
        crearPersonaHTML(
          a.docente?.nombre || '—',
          a.docente?.apellido || '',
          a.materia?.nombre || 'Materia no encontrada',
          a.docente?.correo || '',
          'azul'
        )
      ).join('')
    : `<p style="font-size:13px;color:#6b7280">Sin docentes asignados aún.</p>`;

  // Materias
  const materiasHTML = materias.length > 0
    ? `<div class="detalle-materias">${materias.map(m => `<span class="detalle-chip">${m.nombre}</span>`).join('')}</div>`
    : `<p style="font-size:13px;color:#6b7280">Sin materias asignadas.</p>`;

  // Estudiantes
  const estudiantesHTML = estudiantes.length > 0
    ? `<div class="detalle-lista-scroll">
        ${estudiantes.map(e => crearPersonaHTML(e.nombre, e.apellido, e.correo, 'Estudiante activo', 'verde')).join('')}
       </div>`
    : `<p style="font-size:13px;color:#6b7280">No hay estudiantes matriculados activos.</p>`;

  document.getElementById('detalleCuerpo').innerHTML = `

    <!-- Stats -->
    <div class="detalle-stats">
      <div class="detalle-stat">
        <span class="detalle-stat__valor">${totales.matriculados}</span>
        <span class="detalle-stat__label">Estudiantes</span>
      </div>
      <div class="detalle-stat">
        <span class="detalle-stat__valor">${totales.materias}</span>
        <span class="detalle-stat__label">Materias</span>
      </div>
      <div class="detalle-stat">
        <span class="detalle-stat__valor">${totales.docentes}</span>
        <span class="detalle-stat__label">Docentes</span>
      </div>
    </div>

    <!-- Barra de cupo -->
    ${cupoHTML}

    <!-- Director -->
    <div class="detalle-seccion">
      <div class="detalle-seccion__titulo">
        <i data-lucide="shield-check"></i> Líder del grado
      </div>
      ${directorHTML}
    </div>

    <!-- Materias -->
    <div class="detalle-seccion">
      <div class="detalle-seccion__titulo">
        <i data-lucide="book-open"></i> Materias (${materias.length})
      </div>
      ${materiasHTML}
    </div>

    <!-- Docentes -->
    <div class="detalle-seccion">
      <div class="detalle-seccion__titulo">
        <i data-lucide="user-check"></i> Docentes asignados (${asignaciones.length})
      </div>
      ${docentesHTML}
    </div>

    <!-- Estudiantes -->
    <div class="detalle-seccion">
      <div class="detalle-seccion__titulo">
        <i data-lucide="users"></i> Estudiantes matriculados (${estudiantes.length})
      </div>
      ${estudiantesHTML}
    </div>
  `;

  lucide.createIcons();
}

function crearPersonaHTML(nombre, apellido, sub1, sub2, color) {
  const iniciales = `${(nombre || '?')[0]}${(apellido || '')[0] || ''}`.toUpperCase();
  return `
    <div class="detalle-persona">
      <div class="detalle-persona__avatar detalle-persona__avatar--${color}">${iniciales}</div>
      <div class="detalle-persona__info">
        <div class="detalle-persona__nombre">${nombre} ${apellido}</div>
        <div class="detalle-persona__sub">${sub2 || sub1}</div>
      </div>
    </div>
  `;
}

// Cerrar panel con tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && gradoDetalleActual) cerrarDetalleGrado();
});

// ══════════════════════════════════════════════
// DRAWER DE CREACIÓN / EDICIÓN
// ══════════════════════════════════════════════

function abrirDrawerCrearGrado() {
  const contenedor = clonarFormGrado();

  contenedor.querySelector('#formGrado').action               = '/grados';
  contenedor.querySelector('#metodoGrado').value              = '';
  contenedor.querySelector('#textoGuardarGrado').textContent  = 'Crear grado';
  contenedor.querySelector('#grupoActivoGrado').style.display = 'none';
  contenedor.querySelector('#campoAnioGrado').value           = new Date().getFullYear();

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

  const acciones     = document.createElement('div');
  acciones.className = 'lista-checks__acciones';
  acciones.innerHTML = `
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

// Acordeón nivel educativo
function toggleFiltroNivel() {
  const panel   = document.getElementById('nivelPanel');
  const chevron = document.getElementById('nivelChevron');
  const trigger = document.getElementById('btnNivelTrigger');
  const abierto = panel.classList.toggle('filtro-nivel__panel--abierto');
  trigger.classList.toggle('filtro-nivel__trigger--activo', abierto);
  chevron.style.transform = abierto ? 'rotate(180deg)' : '';
}

lucide.createIcons();

document.addEventListener('DOMContentLoaded', function () {
  // Abrir acordeón si hay nivel filtrado
  if (typeof filtroNivel !== 'undefined' && filtroNivel) {
    document.getElementById('nivelPanel').classList.add('filtro-nivel__panel--abierto');
    document.getElementById('btnNivelTrigger').classList.add('filtro-nivel__trigger--activo');
    document.getElementById('nivelChevron').style.transform = 'rotate(180deg)';
  }

  // Filtro de estado
  const selectEstado = document.getElementById('filtroEstado');
  if (selectEstado) {
    selectEstado.addEventListener('change', function () {
      const valor = this.value;
      document.querySelectorAll('.tabla__fila-card').forEach(fila => {
        const estado = fila.getAttribute('data-estado');
        fila.style.display = (valor === '' || estado === valor) ? '' : 'none';
      });
    });
  }

  // Paginación
  iniciarPaginacion('tbodyGrados', { filasPorPagina: 10 });
});
