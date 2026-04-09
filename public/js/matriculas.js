/**
 * public/js/matriculas.js
 * Drawers de matrículas: crear, editar estado y ver detalle con historial.
 *
 * Lógica clave en el cliente:
 *  - Al cambiar año → recarga estudiantes y grados disponibles.
 *  - Al elegir estudiante → filtra grados por nivel correcto (ultimoNivelCursado + 1).
 *  - Muestra cupo disponible en el grado seleccionado.
 */

// Cache de datos del formulario
let _datosFormulario = { estudiantes: [], grados: [] };

// ─── ABRIR DRAWER CREAR ───────────────────────────────────────────────────────
async function abrirDrawerCrearMatricula() {
  document.getElementById('drawerTitulo').textContent = 'Nueva matrícula';
  abrirPanelDrawer();

  const template = document.getElementById('templateCrearMatricula');
  const form     = template.content.cloneNode(true).querySelector('form');

  // Año por defecto
  form.querySelector('#campoAnioMatricula').value = ANO_ACTUAL;

  document.getElementById('drawerCuerpo').innerHTML = '';
  document.getElementById('drawerCuerpo').appendChild(form);

  lucide.createIcons();

  // Inicializar picker de estudiantes
  initEstPickerMat();

  // Cargar datos del formulario
  await cargarDatosFormulario(ANO_ACTUAL);

  // Actualizar grados cuando cambia el año
  document.getElementById('campoAnioMatricula').addEventListener('change', async (e) => {
    const año = parseInt(e.target.value, 10);
    if (año >= 2000 && año <= 2100) {
      await cargarDatosFormulario(año);
    }
  });
}

// Carga estudiantes y grados disponibles desde el servidor
async function cargarDatosFormulario(año) {
  const inputId  = document.getElementById('campoEstudianteMatricula');
  if (!inputId) return;

  // Resetear picker al cambiar año
  _resetEstPickerMat();

  const lista = document.getElementById('estListaMat');
  if (lista) lista.innerHTML = '<li class="est-picker__vacio">Cargando…</li>';

  try {
    const res = await fetch(`/matriculas/formulario?año=${año}`);
    if (!res.ok) throw new Error('Error al obtener datos');
    _datosFormulario = await res.json();

    // Renderizar lista inicial del picker
    _renderEstListaMat('');

  } catch (e) {
    console.error(e);
    const lista = document.getElementById('estListaMat');
    if (lista) lista.innerHTML = '<li class="est-picker__vacio">Error al cargar estudiantes</li>';
  }
}

// ── Picker dinámico de estudiantes en el drawer Crear ──────────────────────
let _estPickerMatInited = false;

function _resetEstPickerMat() {
  _estPickerMatInited = false;
  const inputId    = document.getElementById('campoEstudianteMatricula');
  const label      = document.getElementById('estPickerMatLabel');
  const avatarMini = document.getElementById('estPickerMatAvatarMini');
  const panel      = document.getElementById('estPickerMatPanel');
  const trigger    = document.getElementById('estPickerMatTrigger');
  if (inputId)    inputId.value        = '';
  if (label)      { label.textContent = 'Seleccionar estudiante…'; label.style.color = 'var(--gris-400)'; }
  if (avatarMini) avatarMini.style.display = 'none';
  if (panel)      panel.classList.remove('est-picker__panel--abierto');
  if (trigger)    trigger.classList.remove('est-picker__trigger--abierto');
  // Limpiar ayuda y grados
  const ayudaEstudiante = document.getElementById('ayudaEstudiante');
  if (ayudaEstudiante) ayudaEstudiante.textContent = '';
  actualizarGradosDisponibles(null);
}

function _renderEstListaMat(filtro) {
  const lista = document.getElementById('estListaMat');
  if (!lista) return;
  const q = (filtro || '').toLowerCase();
  lista.innerHTML = '';
  const filtrados = (_datosFormulario.estudiantes || []).filter(e =>
    (`${e.nombre} ${e.apellido}`).toLowerCase().includes(q) ||
    (e.correo || '').toLowerCase().includes(q)
  );
  if (filtrados.length === 0) {
    lista.innerHTML = '<li class="est-picker__vacio">Sin resultados</li>';
    return;
  }
  filtrados.forEach(e => {
    const iniciales = (e.nombre.charAt(0) + e.apellido.charAt(0)).toUpperCase();
    const li = document.createElement('li');
    li.className = 'est-picker__opcion';
    li.dataset.id     = e._id;
    li.dataset.nombre = `${e.apellido}, ${e.nombre}`;
    li.dataset.nivel  = e.ultimoNivelCursado || 0;
    li.innerHTML = `
      <span class="est-picker__avatar">${iniciales}</span>
      <span class="est-picker__info">
        <span class="est-picker__nombre">${e.apellido}, ${e.nombre}</span>
        <span class="est-picker__meta">Nivel actual: ${e.ultimoNivelCursado || 0}</span>
      </span>`;
    lista.appendChild(li);
  });
}

function initEstPickerMat() {
  const trigger    = document.getElementById('estPickerMatTrigger');
  const panel      = document.getElementById('estPickerMatPanel');
  const buscador   = document.getElementById('estBuscadorMat');
  const lista      = document.getElementById('estListaMat');
  const inputId    = document.getElementById('campoEstudianteMatricula');
  const label      = document.getElementById('estPickerMatLabel');
  const avatarMini = document.getElementById('estPickerMatAvatarMini');
  if (!trigger || _estPickerMatInited) return;
  _estPickerMatInited = true;

  trigger.addEventListener('click', function(e) {
    e.stopPropagation();
    const open = panel.classList.toggle('est-picker__panel--abierto');
    trigger.classList.toggle('est-picker__trigger--abierto', open);
    if (open) setTimeout(() => buscador.focus(), 50);
  });

  document.addEventListener('click', function closePanelMat(e) {
    if (!panel.contains(e.target) && e.target !== trigger) {
      panel.classList.remove('est-picker__panel--abierto');
      trigger.classList.remove('est-picker__trigger--abierto');
    }
  });

  panel.addEventListener('click', e => e.stopPropagation());

  buscador.addEventListener('input', () => _renderEstListaMat(buscador.value));

  lista.addEventListener('click', function(e) {
    const opt = e.target.closest('.est-picker__opcion');
    if (!opt) return;

    // Actualizar input hidden y UI del picker
    inputId.value       = opt.dataset.id;
    label.textContent   = opt.dataset.nombre;
    label.style.color   = 'var(--gris-900)';
    const iniciales     = opt.querySelector('.est-picker__avatar').textContent;
    avatarMini.textContent    = iniciales;
    avatarMini.style.display  = 'flex';

    lista.querySelectorAll('.est-picker__opcion').forEach(li => li.classList.remove('est-picker__opcion--activa'));
    opt.classList.add('est-picker__opcion--activa');
    panel.classList.remove('est-picker__panel--abierto');
    trigger.classList.remove('est-picker__trigger--abierto');
    buscador.value = '';
    _renderEstListaMat('');

    // Disparar actualización de grados con el nivel del estudiante elegido
    actualizarGradosDisponibles(parseInt(opt.dataset.nivel, 10) || 0);
  });
}

// Filtra grados por nivel correcto según el estudiante seleccionado
// Recibe nivelActual como número (desde el picker) o null para limpiar
function actualizarGradosDisponibles(nivelActual) {
  const ayudaEstudiante = document.getElementById('ayudaEstudiante');
  const ayudaGrado      = document.getElementById('ayudaGrado');

  // El picker de grado usa su propio picker visual (grado-picker.js),
  // pero el input hidden sigue siendo campoGradoMatricula.
  // Refresca el picker de grado filtrando por nivel requerido.
  if (nivelActual === null || nivelActual === undefined) {
    if (ayudaEstudiante) ayudaEstudiante.textContent = '';
    if (_pickerGradoMatricula) _pickerGradoMatricula.refresh(
      parseInt(document.getElementById('campoAnioMatricula')?.value, 10) || ANO_ACTUAL
    );
    return;
  }

  const nivelReq = nivelActual + 1;

  if (ayudaEstudiante) {
    ayudaEstudiante.textContent = `Nivel actual: ${nivelActual} → debe matricularse en nivel ${nivelReq}`;
    ayudaEstudiante.style.color = 'var(--azul-700)';
  }

  if (ayudaGrado) {
    ayudaGrado.textContent = `Solo se muestran grados de nivel ${nivelReq}.`;
    ayudaGrado.style.color = 'var(--gris-500)';
  }

  if (_pickerGradoMatricula) {
    _pickerGradoMatricula.refresh(
      parseInt(document.getElementById('campoAnioMatricula')?.value, 10) || ANO_ACTUAL,
      nivelReq
    );
  }
}

// ─── ABRIR DRAWER EDITAR ──────────────────────────────────────────────────────
async function abrirDrawerEditarMatricula(id, estadoActual, observacionesActuales) {
  const template = document.getElementById('templateEditarMatricula');
  const form     = template.content.cloneNode(true).querySelector('form');

  form.action = `/matriculas/${id}?_method=PUT`;
  form.querySelector('#campoEstadoEditar').value = estadoActual;
  form.querySelector('#campoObsEditar').value    = observacionesActuales || '';

  document.getElementById('drawerTitulo').textContent = 'Editar matrícula';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(form);

  abrirPanelDrawer();
  lucide.createIcons();

  // Cargar grados disponibles con cupo para reasignación
  if (typeof cargarGradosDisponibles === 'function') {
    await cargarGradosDisponibles(id, null);
  }
}

// ─── ABRIR DRAWER DETALLE + HISTORIAL ────────────────────────────────────────
async function abrirDrawerDetalle(id) {
  document.getElementById('drawerTitulo').textContent = 'Cargando...';
  abrirPanelDrawer();

  try {
    const res  = await fetch(`/matriculas/${id}/datos`);
    if (!res.ok) throw new Error('Error al obtener detalle');
    const { matricula, historial } = await res.json();

    const est   = matricula.estudianteId;
    const grado = matricula.gradoId;

    const clasesEstado = {
      activa:     'badge--activo',
      suspendida: 'badge--suspendido',
      inactiva:   'badge--inactivo',
      graduado:   'badge--morado',
    };

    const clasesTipo = {
      nuevaMatricula:    'badge--azul',
      matriculaRenovada: 'badge--verde',
    };

    // Construir historial HTML
    let historialHTML = '';
    if (historial.length === 0) {
      historialHTML = '<p class="texto-vacio" style="padding:12px 0">Sin matrículas anteriores.</p>';
    } else {
      historialHTML = historial.map(h => {
        const g = h.gradoId;
        return `
          <div class="historial-item">
            <div class="historial-item__año">${h.año}</div>
            <div class="historial-item__info">
              <span class="historial-item__grado">${g ? g.nombre : '—'}</span>
              <span class="historial-item__nivel">Nivel ${g ? g.nivel : '—'}</span>
            </div>
            <span class="badge ${clasesEstado[h.estado] || 'badge--inactivo'} historial-item__estado">
              ${h.estado.charAt(0).toUpperCase() + h.estado.slice(1)}
            </span>
          </div>
        `;
      }).join('');
    }

    const html = `
      <div class="detalle-matricula">

        <!-- Cabecera del estudiante -->
        <div class="detalle-matricula__estudiante">
          <div class="usuario-celda__avatar usuario-celda__avatar--estudiante" style="width:44px;height:44px;font-size:1rem;">
            ${est ? est.nombre.charAt(0).toUpperCase() + est.apellido.charAt(0).toUpperCase() : '??'}
          </div>
          <div>
            <h3 class="detalle-matricula__nombre">${est ? est.nombre + ' ' + est.apellido : 'Estudiante eliminado'}</h3>
            <span class="texto-secundario texto-sm">${est ? est.correo : ''}</span>
          </div>
        </div>

        <!-- Datos de la matrícula -->
        <div class="detalle-grid">
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
            <span class="detalle-campo__valor">${matricula.año}</span>
          </div>
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Tipo</span>
            <span class="detalle-campo__valor badge ${clasesTipo[matricula.tipo] || ''}">
              ${matricula.tipo === 'nuevaMatricula' ? 'Nueva' : 'Renovada'}
            </span>
          </div>
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Estado</span>
            <span class="detalle-campo__valor badge ${clasesEstado[matricula.estado] || 'badge--inactivo'}">
              ${matricula.estado.charAt(0).toUpperCase() + matricula.estado.slice(1)}
            </span>
          </div>
          <div class="detalle-campo">
            <span class="detalle-campo__etiqueta">Fecha matrícula</span>
            <span class="detalle-campo__valor">${new Date(matricula.fechaMatricula).toLocaleDateString('es-CO')}</span>
          </div>
        </div>

        <!-- Observaciones -->
        ${matricula.observaciones ? `
          <div class="detalle-obs">
            <span class="detalle-campo__etiqueta">Observaciones</span>
            <p class="detalle-obs__texto">${matricula.observaciones}</p>
          </div>
        ` : ''}

        <!-- Historial -->
        <div class="detalle-historial">
          <h4 class="detalle-historial__titulo">
            <i data-lucide="history" style="width:15px;height:15px;vertical-align:middle;"></i>
            Historial de matrículas
          </h4>
          ${historialHTML}
        </div>

      </div>
    `;

    document.getElementById('drawerTitulo').textContent = 'Detalle de matrícula';
    document.getElementById('drawerCuerpo').innerHTML   = html;
    lucide.createIcons();

  } catch (e) {
    console.error(e);
    document.getElementById('drawerCuerpo').innerHTML =
      '<p class="texto-error">Error al cargar el detalle.</p>';
  }
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
function abrirPanelDrawer() {
  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';
}

// ─── Paginación ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  iniciarPaginacion('tbodyMatriculas', { filasPorPagina: 10 });
});

// Cargar grados disponibles al abrir el drawer de edición
  async function cargarGradosDisponibles(matriculaId, gradoActualId) {
    const select = document.getElementById('campoGradoEditar');
    if (!select) return;
    try {
      const resp = await fetch(`/matriculas/${matriculaId}/grados-disponibles`);
      const data = await resp.json();
      select.innerHTML = '<option value="">-- Mantener grado actual --</option>';
      (data.grados || []).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g._id;
        opt.selected = g._id === gradoActualId;
        opt.textContent = `${g.nombre} (Nivel ${g.nivel} — Cupo: ${g.matriculados}/${g.cupo > 0 ? g.cupo : '∞'})`;
        select.appendChild(opt);
      });
      if (!data.grados || data.grados.length === 0) {
        select.innerHTML = '<option value="">Sin otros grados disponibles con cupo</option>';
      }
    } catch(e) {
      select.innerHTML = '<option value="">Error al cargar grados</option>';
    }
  }

// ── Inicializar filtro de grado en la página ─────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initFiltroGradoPicker({
      gradosData:        GRADOS_DATA_MAT,
      filtroGradoActivo: FILTRO_GRADO_ACTIVO_MAT,
      formId:            'formFiltrosMatriculas',
      inputHiddenId:     'inputFiltroGrado',
      anioSelectName:    'filtroAnio',
      triggerBtnId:      'btnFiltroGradoMatriculas',
      panelId:           'panelFiltroGradoMatriculas',
    });
  });

  // ── Picker de grado en drawer Crear ──────────────────────────────────────
  // Se inicializa cuando se abre el drawer y se sabe el año
  let _pickerGradoMatricula = null;

  // Sobreescribir la función original para integrar el picker
  const _origCargarDatosFormulario = cargarDatosFormulario;
  cargarDatosFormulario = async function (año) {
    await _origCargarDatosFormulario(año);
    // Inicializar o refrescar el picker
    const contenedor = document.getElementById('pickerGradoMatricula');
    const inputHidden = document.getElementById('campoGradoMatricula');
    if (!contenedor || !inputHidden) return;

    if (!_pickerGradoMatricula) {
      _pickerGradoMatricula = createGradoPicker({
        contenedor,
        inputHidden,
        gradosData: GRADOS_DATA_MAT,
        getAnio:    () => año,
        prefijo:    'pkMat',
      });
      _pickerGradoMatricula.init(año);
    } else {
      _pickerGradoMatricula.refresh(año);
    }
    // Crear iconos lucide recién generados
    lucide.createIcons();
  };

  // Resetear picker al cerrar drawer
  const _origCerrarDrawer = window.cerrarDrawer;
  if (_origCerrarDrawer) {
    window.cerrarDrawer = function () {
      _origCerrarDrawer();
      _pickerGradoMatricula = null;
    };
  }