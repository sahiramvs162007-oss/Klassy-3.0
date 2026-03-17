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

  // Llenar docentes
  const selectDocente = form.querySelector('#campoDocenteAsig');
  DOCENTES_DISPONIBLES.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d._id;
    opt.textContent = `${d.nombre} ${d.apellido}`;
    opt.dataset.profesion = d.profesion || '';
    selectDocente.appendChild(opt);
  });

  // Mostrar especialidad al elegir docente
  selectDocente.addEventListener('change', () => {
    const opt  = selectDocente.options[selectDocente.selectedIndex];
    const ayuda = form.querySelector('#ayudaEspecialidad');
    ayuda.textContent = opt.dataset.profesion
      ? `Especialidad: ${opt.dataset.profesion}`
      : '';
  });

  // Llenar grados filtrados por año actual
  const selectGrado = form.querySelector('#campoGradoAsig');
  llenarSelectGrados(selectGrado, ANO_ACTUAL);

  // Re-filtrar grados al cambiar año
  form.querySelector('#campoAnioAsig').addEventListener('change', (e) => {
    const año = parseInt(e.target.value, 10);
    llenarSelectGrados(selectGrado, año);
    form.querySelector('#campoMateriaAsig').innerHTML =
      '<option value="">Selecciona un grado primero</option>';
  });

  document.getElementById('drawerTitulo').textContent = 'Nueva asignación';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(form);

  abrirPanelDrawer();
  lucide.createIcons();
}

// Llena el select de grados filtrando por año
function llenarSelectGrados(selectEl, año) {
  selectEl.innerHTML = '<option value="">Seleccionar grado</option>';
  const gradosFiltrados = GRADOS_DISPONIBLES.filter(g => g.año === año);

  if (gradosFiltrados.length === 0) {
    selectEl.innerHTML = `<option value="" disabled>Sin grados para el año ${año}</option>`;
    return;
  }

  gradosFiltrados.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g._id;
    opt.textContent = `${g.nombre} (Nivel ${g.nivel})`;
    selectEl.appendChild(opt);
  });
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
