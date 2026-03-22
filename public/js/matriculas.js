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
  const selectEstudiante = document.getElementById('campoEstudianteMatricula');
  const selectGrado      = document.getElementById('campoGradoMatricula');
  if (!selectEstudiante) return;

  selectEstudiante.innerHTML = '<option value="">Cargando...</option>';
  selectGrado.innerHTML      = '<option value="">Selecciona un estudiante primero</option>';

  try {
    const res = await fetch(`/matriculas/formulario?año=${año}`);
    if (!res.ok) throw new Error('Error al obtener datos');
    _datosFormulario = await res.json();

    // Llenar estudiantes
    selectEstudiante.innerHTML = '<option value="">Seleccionar estudiante</option>';
    if (_datosFormulario.estudiantes.length === 0) {
      selectEstudiante.innerHTML = '<option value="" disabled>Sin estudiantes disponibles para este año</option>';
    } else {
      _datosFormulario.estudiantes.forEach(est => {
        const opt = document.createElement('option');
        opt.value = est._id;
        opt.dataset.nivel = est.ultimoNivelCursado || 0;
        opt.textContent = `${est.nombre} ${est.apellido} (Nivel actual: ${est.ultimoNivelCursado || 0})`;
        selectEstudiante.appendChild(opt);
      });
    }

    // Actualizar grados al seleccionar estudiante
    selectEstudiante.onchange = actualizarGradosDisponibles;

  } catch (e) {
    console.error(e);
    selectEstudiante.innerHTML = '<option value="">Error al cargar estudiantes</option>';
  }
}

// Filtra grados por nivel correcto según el estudiante seleccionado
function actualizarGradosDisponibles() {
  const selectEstudiante = document.getElementById('campoEstudianteMatricula');
  const selectGrado      = document.getElementById('campoGradoMatricula');
  const ayudaEstudiante  = document.getElementById('ayudaEstudiante');
  const ayudaGrado       = document.getElementById('ayudaGrado');

  const optSeleccionada = selectEstudiante.options[selectEstudiante.selectedIndex];
  if (!optSeleccionada || !optSeleccionada.value) {
    selectGrado.innerHTML = '<option value="">Selecciona un estudiante primero</option>';
    return;
  }

  const nivelActual  = parseInt(optSeleccionada.dataset.nivel, 10) || 0;
  const nivelReq     = nivelActual + 1;

  ayudaEstudiante.textContent = `Nivel actual: ${nivelActual} → debe matricularse en nivel ${nivelReq}`;
  ayudaEstudiante.style.color = 'var(--azul-700)';

  // Filtrar grados por nivel requerido
  const gradosFiltrados = _datosFormulario.grados.filter(g => g.nivel === nivelReq);

  selectGrado.innerHTML = '';
  if (gradosFiltrados.length === 0) {
    selectGrado.innerHTML = `<option value="" disabled>No hay grados de nivel ${nivelReq} disponibles</option>`;
    ayudaGrado.textContent = `⚠ No existen grados de nivel ${nivelReq} para este año.`;
    ayudaGrado.style.color = 'var(--rojo-600)';
  } else {
    selectGrado.innerHTML = '<option value="">Seleccionar grado</option>';
    gradosFiltrados.forEach(g => {
      const opt  = document.createElement('option');
      opt.value  = g._id;
      const cupoInfo = g.cupo > 0 ? ` — Cupo: ${g.cupo}` : '';
      opt.textContent = `${g.nombre} (Nivel ${g.nivel}${cupoInfo})`;
      selectGrado.appendChild(opt);
    });
    ayudaGrado.textContent = `Solo grados de nivel ${nivelReq} disponibles.`;
    ayudaGrado.style.color = 'var(--gris-500)';
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
