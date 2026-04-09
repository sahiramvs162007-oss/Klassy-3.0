/**
 * public/js/grado-picker.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente reutilizable: picker visual de grado en dos pasos.
 *
 *  Uso 1 — Filtro de página (matrícula / asignación):
 *    initFiltroGradoPicker({ gradosData, filtroGradoActivo, formId, inputHiddenId, anioSelectId })
 *
 *  Uso 2 — Picker dentro de un drawer/formulario:
 *    const picker = createGradoPicker({ gradosData, contenedorId, inputHiddenId, anioFn, onSelect })
 *    picker.refresh(nuevoAnio)   → re-renderiza chips según año
 *    picker.reset()              → limpia selección
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const _CAT_COLOR = { primaria: 'primaria', secundaria: 'secundaria', media: 'media' };
const _CAT_NIVELES = { primaria: [1,2,3,4,5], secundaria: [6,7,8,9], media: [10,11] };
const _CAT_LABELS  = { primaria: 'Primaria', secundaria: 'Secundaria', media: 'Educación media' };
const _DOT_CLASS   = { primaria: 'filtro-nivel__dot--primaria', secundaria: 'filtro-nivel__dot--secundaria', media: 'filtro-nivel__dot--media' };

function _catDeNivel(nivel) {
  if (nivel <= 5)  return 'primaria';
  if (nivel <= 9)  return 'secundaria';
  return 'media';
}

function _gradosPorNivelYAnio(gradosData, nivel, anio) {
  return gradosData.filter(g => g.nivel === nivel && (!anio || g.año === anio));
}

/* ══════════════════════════════════════════════════════════════════════════════
   1. FILTRO DE PÁGINA
   ══════════════════════════════════════════════════════════════════════════════ */
/**
 * initFiltroGradoPicker
 * Reemplaza el acordeón de grado en la barra de filtros de la página.
 *
 * @param {Object} opts
 *   gradosData        – array de { id, nombre, nivel, año }
 *   filtroGradoActivo – string id del grado seleccionado (puede ser '')
 *   formId            – id del <form> de filtros
 *   inputHiddenId     – id del <input type="hidden" name="filtroGrado">
 *   anioSelectName    – name del <select> de año dentro del mismo form
 *   triggerBtnId      – id del botón que abre/cierra el panel
 *   panelId           – id del panel contenedor
 */
function initFiltroGradoPicker(opts) {
  const { gradosData, filtroGradoActivo, formId, inputHiddenId, anioSelectName, triggerBtnId, panelId } = opts;

  const form       = document.getElementById(formId);
  const inputHidden = document.getElementById(inputHiddenId);
  const trigger    = document.getElementById(triggerBtnId);
  const panel      = document.getElementById(panelId);
  if (!form || !inputHidden || !trigger || !panel) return;

  /* Obtener año actual del select */
  function getAnioSeleccionado() {
    const sel = form.querySelector(`[name="${anioSelectName}"]`);
    return sel ? parseInt(sel.value, 10) || null : null;
  }

  /* Cuando cambia el año, redibujar chips de nivel activos */
  const anioSel = form.querySelector(`[name="${anioSelectName}"]`);
  if (anioSel) {
    anioSel.addEventListener('change', () => {
      // Volver a vista de niveles si estaba en sub-panel
      _filtroVolverNiveles(panel);
      // Actualizar chips de nivel (habilitar/deshabilitar según año)
      _filtroRedibujarNiveles(panel, gradosData, getAnioSeleccionado());
    });
  }

  /* Toggle del panel */
  trigger.addEventListener('click', () => {
    const abierto = panel.classList.contains('filtro-nivel__panel--abierto');
    panel.classList.toggle('filtro-nivel__panel--abierto', !abierto);
    const chevron = trigger.querySelector('.filtro-nivel__chevron');
    if (chevron) chevron.style.transform = abierto ? '' : 'rotate(180deg)';
    trigger.classList.toggle('filtro-nivel_edu--activo', !abierto);
  });

  /* Construir panel inicial */
  _filtroConstruirPanel(panel, gradosData, getAnioSeleccionado(), filtroGradoActivo, inputHidden, form, trigger);
}

function _filtroConstruirPanel(panel, gradosData, anio, filtroActivo, inputHidden, form, trigger) {
  panel.innerHTML = '';

  Object.keys(_CAT_NIVELES).forEach((cat, idx) => {
    if (idx > 0) {
      const hr = document.createElement('hr');
      hr.className = 'filtro-nivel__divisor';
      panel.appendChild(hr);
    }

    /* Categoría */
    const catDiv = document.createElement('div');
    catDiv.className = 'filtro-nivel__categoria';
    catDiv.id = `filtroCat_${cat}`;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'filtro-nivel__cat-label';
    labelDiv.innerHTML = `<span class="filtro-nivel__dot ${_DOT_CLASS[cat]}"></span>${_CAT_LABELS[cat]}`;

    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'filtro-nivel__chips';
    chipsDiv.id = `filtroChipsNivel_${cat}`;

    _CAT_NIVELES[cat].forEach(n => {
      const hayGrados = gradosData.some(g => g.nivel === n && (!anio || g.año === anio));
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `nivel-chip nivel-chip--${cat}${!hayGrados ? ' nivel-chip--disabled' : ''}`;
      chip.dataset.nivel = n;
      chip.textContent = `${n}°`;

      // Marcar si el filtro activo pertenece a este nivel
      if (filtroActivo) {
        const gActivo = gradosData.find(g => g.id === filtroActivo);
        if (gActivo && gActivo.nivel === n) {
          chip.classList.add(`nivel-chip--activo`, `nivel-chip--activo-${cat}`);
        }
      }

      if (hayGrados) {
        chip.addEventListener('click', () => _filtroSeleccionarNivel(panel, gradosData, n, cat, anio || _getAnioDeGrados(gradosData), inputHidden, form, trigger));
      }
      chipsDiv.appendChild(chip);
    });

    catDiv.appendChild(labelDiv);
    catDiv.appendChild(chipsDiv);
    panel.appendChild(catDiv);

    /* Sub-panel de salones para esta cat */
    const salonPanel = document.createElement('div');
    salonPanel.className = 'filtro-salon__panel';
    salonPanel.id = `filtroSalon_${cat}`;
    salonPanel.style.display = 'none';

    const salonHeader = document.createElement('div');
    salonHeader.className = 'filtro-salon__header';
    salonHeader.innerHTML = `
      <button type="button" class="filtro-salon__volver" id="filtroVolver_${cat}">
        <i data-lucide="arrow-left"></i> ${_CAT_LABELS[cat]}
      </button>
      <span class="filtro-salon__titulo" id="filtroTituloSalon_${cat}"></span>
    `;

    const salonChips = document.createElement('div');
    salonChips.className = 'filtro-nivel__chips';
    salonChips.id = `filtroChipsSalon_${cat}`;

    salonPanel.appendChild(salonHeader);
    salonPanel.appendChild(salonChips);
    panel.appendChild(salonPanel);

    // Insertar el sub-panel DESPUÉS del catDiv (antes del siguiente hr)
    salonHeader.querySelector(`#filtroVolver_${cat}`).addEventListener('click', () => {
      _filtroVolverNiveles(panel);
    });
  });

  lucide.createIcons();
}

function _filtroSeleccionarNivel(panel, gradosData, nivel, cat, anio, inputHidden, form, trigger) {
  // Ocultar categorías y divisores
  panel.querySelectorAll('.filtro-nivel__categoria').forEach(el => el.style.display = 'none');
  panel.querySelectorAll('.filtro-nivel__divisor').forEach(el => el.style.display = 'none');
  // Ocultar otros sub-paneles
  panel.querySelectorAll('.filtro-salon__panel').forEach(el => el.style.display = 'none');

  // Mostrar sub-panel correcto
  const salonPanel = document.getElementById(`filtroSalon_${cat}`);
  salonPanel.style.display = 'block';
  document.getElementById(`filtroTituloSalon_${cat}`).textContent = `${nivel}° grado`;

  // Generar chips de salones filtrados por año
  const chipsContainer = document.getElementById(`filtroChipsSalon_${cat}`);
  chipsContainer.innerHTML = '';

  const gradosDelNivel = _gradosPorNivelYAnio(gradosData, nivel, anio);

  if (gradosDelNivel.length === 0) {
    chipsContainer.innerHTML = '<span class="grado-picker__vacio">Sin salones para el año seleccionado</span>';
  } else {
    gradosDelNivel.forEach(g => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const estaActivo = inputHidden.value === g.id;
      btn.className = `nivel-chip nivel-chip--${cat}${estaActivo ? ` nivel-chip--activo nivel-chip--activo-${cat}` : ''}`;
      btn.textContent = g.nombre;
      btn.addEventListener('click', () => {
        inputHidden.value = g.id;
        // Actualizar badge del trigger
        _filtroActualizarBadge(trigger, g.nombre);
        form.submit();
      });
      chipsContainer.appendChild(btn);
    });
  }

  lucide.createIcons();
}

function _filtroVolverNiveles(panel) {
  panel.querySelectorAll('.filtro-nivel__categoria').forEach(el => el.style.display = '');
  panel.querySelectorAll('.filtro-nivel__divisor').forEach(el => el.style.display = '');
  panel.querySelectorAll('.filtro-salon__panel').forEach(el => el.style.display = 'none');
}

function _filtroRedibujarNiveles(panel, gradosData, anio) {
  Object.keys(_CAT_NIVELES).forEach(cat => {
    const chipsContainer = document.getElementById(`filtroChipsNivel_${cat}`);
    if (!chipsContainer) return;
    chipsContainer.querySelectorAll('.nivel-chip').forEach(chip => {
      const n = parseInt(chip.dataset.nivel, 10);
      const hay = gradosData.some(g => g.nivel === n && (!anio || g.año === anio));
      chip.classList.toggle('nivel-chip--disabled', !hay);
      if (!hay) {
        chip.onclick = null;
      }
    });
  });
}

function _filtroActualizarBadge(trigger, nombre) {
  let badge = trigger.querySelector('.filtro-nivel__badge-trigger');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'filtro-nivel__badge-trigger';
    // Insertar antes del chevron
    const chevron = trigger.querySelector('.filtro-nivel__chevron');
    trigger.insertBefore(badge, chevron);
  }
  badge.textContent = nombre;
}

function _getAnioDeGrados(gradosData) {
  // Año más reciente disponible como fallback
  return gradosData.reduce((max, g) => Math.max(max, g.año || 0), 0) || null;
}


/* ══════════════════════════════════════════════════════════════════════════════
   2. PICKER DENTRO DE DRAWER/FORMULARIO
   ══════════════════════════════════════════════════════════════════════════════ */
/**
 * createGradoPicker
 * Crea un picker visual embebido dentro de un contenedor DOM.
 *
 * @param {Object} opts
 *   contenedor  – elemento DOM donde se inyecta el picker
 *   inputHidden – elemento <input type="hidden"> que recibe el _id del grado
 *   gradosData  – array de { _id, nombre, nivel, año }
 *   getAnio     – función que retorna el año actual seleccionado (number|null)
 *   onSelect    – callback(gradoObj) llamado tras selección (opcional)
 *   prefijo     – string único para ids internos (evitar colisiones entre instancias)
 *
 * @returns { refresh(anio), reset(), getValue() }
 */
function createGradoPicker({ contenedor, inputHidden, gradosData, getAnio, onSelect, prefijo = 'gp' }) {
  let _anioActual = null;
  let _gradoSeleccionado = null; // { _id, nombre, nivel, año }

  // Estructura principal
  contenedor.innerHTML = `
    <div class="grado-picker" id="${prefijo}_picker">
      <div class="grado-picker__display" id="${prefijo}_display">
        <i data-lucide="graduation-cap"></i>
        <span id="${prefijo}_label">Seleccionar grado</span>
        <i data-lucide="chevron-down" class="grado-picker__chevron" id="${prefijo}_chevron"></i>
      </div>
      <div class="grado-picker__panel" id="${prefijo}_panel">
        <!-- Se rellena dinámicamente -->
      </div>
    </div>
  `;

  const display  = document.getElementById(`${prefijo}_display`);
  const panel    = document.getElementById(`${prefijo}_panel`);
  const labelEl  = document.getElementById(`${prefijo}_label`);
  const chevronEl = document.getElementById(`${prefijo}_chevron`);

  display.addEventListener('click', () => {
    const abierto = panel.classList.contains('grado-picker__panel--abierto');
    panel.classList.toggle('grado-picker__panel--abierto', !abierto);
    chevronEl.classList.toggle('grado-picker__chevron--abierto', !abierto);
  });

  function _buildPanel(anio) {
    panel.innerHTML = '';
    _anioActual = anio;

    Object.keys(_CAT_NIVELES).forEach((cat, idx) => {
      if (idx > 0) {
        const hr = document.createElement('hr');
        hr.className = 'filtro-nivel__divisor';
        panel.appendChild(hr);
      }

      // Categoría con chips de nivel
      const catDiv = document.createElement('div');
      catDiv.className = 'filtro-nivel__categoria';
      catDiv.id = `${prefijo}_cat_${cat}`;

      const labelDiv = document.createElement('div');
      labelDiv.className = 'filtro-nivel__cat-label';
      labelDiv.innerHTML = `<span class="filtro-nivel__dot ${_DOT_CLASS[cat]}"></span>${_CAT_LABELS[cat]}`;

      const chipsDiv = document.createElement('div');
      chipsDiv.className = 'filtro-nivel__chips';

      _CAT_NIVELES[cat].forEach(n => {
        const hayGrados = gradosData.some(g => g.nivel === n && (!anio || g.año === anio));
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `nivel-chip nivel-chip--${cat}${!hayGrados ? ' nivel-chip--disabled' : ''}`;
        chip.textContent = `${n}°`;
        if (hayGrados) {
          chip.addEventListener('click', () => _mostrarSalones(cat, n, anio));
        }
        chipsDiv.appendChild(chip);
      });

      catDiv.appendChild(labelDiv);
      catDiv.appendChild(chipsDiv);
      panel.appendChild(catDiv);

      // Sub-panel de salones
      const salonPanel = document.createElement('div');
      salonPanel.className = 'grado-picker__salon-panel';
      salonPanel.id = `${prefijo}_salon_${cat}`;

      salonPanel.innerHTML = `
        <div class="grado-picker__salon-header">
          <button type="button" class="grado-picker__volver" id="${prefijo}_volver_${cat}">
            <i data-lucide="arrow-left"></i> ${_CAT_LABELS[cat]}
          </button>
          <span class="grado-picker__salon-titulo" id="${prefijo}_tituloSalon_${cat}"></span>
        </div>
        <div class="filtro-nivel__chips" id="${prefijo}_chipsSalon_${cat}"></div>
      `;
      panel.appendChild(salonPanel);

      salonPanel.querySelector(`#${prefijo}_volver_${cat}`).addEventListener('click', () => _volverNiveles());
    });

    lucide.createIcons();
  }

  function _mostrarSalones(cat, nivel, anio) {
    // Ocultar cats y divisores
    panel.querySelectorAll('.filtro-nivel__categoria').forEach(el => el.style.display = 'none');
    panel.querySelectorAll('.filtro-nivel__divisor').forEach(el => el.style.display = 'none');
    panel.querySelectorAll('.grado-picker__salon-panel').forEach(el => el.classList.remove('grado-picker__salon-panel--visible'));

    // Mostrar sub-panel
    const salonPanel = document.getElementById(`${prefijo}_salon_${cat}`);
    salonPanel.classList.add('grado-picker__salon-panel--visible');
    document.getElementById(`${prefijo}_tituloSalon_${cat}`).textContent = `${nivel}° grado`;

    const chipsContainer = document.getElementById(`${prefijo}_chipsSalon_${cat}`);
    chipsContainer.innerHTML = '';

    const gradosFiltrados = _gradosPorNivelYAnio(gradosData, nivel, anio);

    if (gradosFiltrados.length === 0) {
      chipsContainer.innerHTML = '<span class="grado-picker__vacio">Sin salones para este año</span>';
    } else {
      gradosFiltrados.forEach(g => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const estaActivo = inputHidden.value === (g._id || g.id);
        btn.className = `nivel-chip nivel-chip--${cat}${estaActivo ? ` nivel-chip--picker-activo-${cat}` : ''}`;
        btn.textContent = g.nombre;
        btn.addEventListener('click', () => {
          _seleccionarGrado(g, cat);
        });
        chipsContainer.appendChild(btn);
      });
    }

    lucide.createIcons();
  }

  function _seleccionarGrado(g, cat) {
    _gradoSeleccionado = g;
    inputHidden.value = g._id || g.id;
    // Actualizar display
    labelEl.textContent = g.nombre;
    display.classList.add('grado-picker__display--seleccionado');
    // Cerrar panel
    panel.classList.remove('grado-picker__panel--abierto');
    chevronEl.classList.remove('grado-picker__chevron--abierto');
    if (onSelect) onSelect(g);
  }

  function _volverNiveles() {
    panel.querySelectorAll('.filtro-nivel__categoria').forEach(el => el.style.display = '');
    panel.querySelectorAll('.filtro-nivel__divisor').forEach(el => el.style.display = '');
    panel.querySelectorAll('.grado-picker__salon-panel').forEach(el => el.classList.remove('grado-picker__salon-panel--visible'));
  }

  // API pública
  return {
    init(anio) {
      _buildPanel(anio);
    },
    refresh(anio) {
      _buildPanel(anio);
      // Si había un grado seleccionado y ya no está en el año nuevo, resetear
      if (_gradoSeleccionado && anio && _gradoSeleccionado.año !== anio) {
        this.reset();
      }
    },
    reset() {
      _gradoSeleccionado = null;
      inputHidden.value = '';
      labelEl.textContent = 'Seleccionar grado';
      display.classList.remove('grado-picker__display--seleccionado');
      _buildPanel(_anioActual);
    },
    getValue() {
      return _gradoSeleccionado;
    }
  };
}
