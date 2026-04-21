/**
 * public/js/boletines.js
 * - Filtros de año/periodo para la vista del estudiante
 * - Inicializa paginación para las tablas de la sección Boletines y Reportes.
 */

/* ══════════════════════════════════════════════════════════════════════
   Selector de Año/Periodo — Vista estudiante (boletines-estudiante.ejs)
   ══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  const scriptDatos   = document.getElementById('boletines-data');
  const selectAño     = document.getElementById('selectAño');
  const selectPeriodo = document.getElementById('selectPeriodo');

  // Solo ejecutar en la vista del estudiante
  if (!scriptDatos || !selectAño || !selectPeriodo) return;

  const boletinesData  = JSON.parse(scriptDatos.textContent);
  const añoDefault     = parseInt(selectAño.dataset.añoDefault,     10);
  const periodoDefault = parseInt(selectPeriodo.dataset.periodoDefault, 10);
  const listaItems     = document.querySelectorAll('#listaBoletines .boletin-item-lista');

  const etiquetasPeriodo = {
    1: '1er Periodo',
    2: '2do Periodo',
    3: '3er Periodo',
    4: '4to Periodo',
  };

  // ── Poblar el select de periodos según el año elegido ──
  function poblarPeriodos(año, periodoSeleccionar) {
    const nums = boletinesData
      .filter(function (b) { return b.año === año; })
      .map(function (b) { return b.numeroPeriodo; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; })
      .sort(function (a, b) { return a - b; });

    selectPeriodo.innerHTML = '';
    nums.forEach(function (num) {
      var op = document.createElement('option');
      op.value = num;
      op.textContent = etiquetasPeriodo[num] || ('Periodo ' + num);
      selectPeriodo.appendChild(op);
    });

    // Preseleccionar: el periodo indicado si existe, si no el último disponible
    var target = nums.includes(periodoSeleccionar) ? periodoSeleccionar : nums[nums.length - 1];
    selectPeriodo.value = target;
  }

  // ── Mostrar solo los items que coinciden con año+periodo ──
  function filtrarLista() {
    var añoSel     = parseInt(selectAño.value,     10);
    var periodoSel = parseInt(selectPeriodo.value, 10);
    var hayActivo  = false;

    listaItems.forEach(function (item) {
      var visible = parseInt(item.dataset.año,     10) === añoSel
                 && parseInt(item.dataset.periodo, 10) === periodoSel;
      item.style.display = visible ? 'flex' : 'none';
      if (visible && item.classList.contains('boletin-item-lista--activo')) {
        hayActivo = true;
      }
    });

    // Si el boletín activo quedó fuera, navegar al primer item visible
    if (!hayActivo) {
      var primero = Array.prototype.find.call(listaItems, function (item) {
        return parseInt(item.dataset.año,     10) === añoSel
            && parseInt(item.dataset.periodo, 10) === periodoSel;
      });
      if (primero) primero.click();
    }
  }

  // ── Inicialización ──
  poblarPeriodos(añoDefault, periodoDefault);
  filtrarLista();

  // ── Eventos ──
  selectAño.addEventListener('change', function () {
    var año = parseInt(this.value, 10);
    // Al cambiar año preseleccionar el último periodo disponible de ese año
    var ultimoPeriodo = boletinesData
      .filter(function (b) { return b.año === año; })
      .reduce(function (max, b) { return Math.max(max, b.numeroPeriodo); }, 0);
    poblarPeriodos(año, ultimoPeriodo);
    filtrarLista();
  });

  selectPeriodo.addEventListener('change', filtrarLista);
});

document.addEventListener('DOMContentLoaded', function () {
  // Tabla principal de boletines
  if (document.getElementById('tbodyBoletines')) {
    iniciarPaginacion('tbodyBoletines', { filasPorPagina: 10 });
  }

  // Tabla del reporte por grado
  if (document.getElementById('tbodyReporteGrado')) {
    iniciarPaginacion('tbodyReporteGrado', { filasPorPagina: 15 });
  }

  // Tabla del reporte por materia
  if (document.getElementById('tbodyReporteMateria')) {
    iniciarPaginacion('tbodyReporteMateria', { filasPorPagina: 15 });
  }

  // Tabla del reporte general
  if (document.getElementById('tbodyReporteGeneral')) {
    iniciarPaginacion('tbodyReporteGeneral', { filasPorPagina: 15 });
  }
});

/* ══════════════════════════════════════════════════════════════════════
   Picker de materia — Reporte por materia (boletines admin)
   ══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  const trigger  = document.getElementById('materiaPickerTriggerBol');
  const panel    = document.getElementById('materiaPickerPanelBol');
  const buscador = document.getElementById('materiaBuscadorBol');
  const lista    = document.getElementById('materiaListaBol');
  const inputId  = document.getElementById('inputMateriaIdBol');
  const label    = document.getElementById('materiaPickerLabelBol');
  const form     = document.getElementById('formFiltros');

  // Si cualquiera de los elementos no existe (otra vista), salir
  if (!trigger || !panel || !lista || !inputId || !form) return;

  // ── Abrir / cerrar panel ─────────────────────────────────────────────
  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    const estaAbierto = panel.classList.toggle('materia-picker__panel--abierto');
    trigger.classList.toggle('materia-picker__trigger--abierto', estaAbierto);
    if (estaAbierto && buscador) {
      setTimeout(() => buscador.focus(), 40);
    }
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', function cerrarMateriaPicker(e) {
    if (!panel.contains(e.target) && e.target !== trigger) {
      panel.classList.remove('materia-picker__panel--abierto');
      trigger.classList.remove('materia-picker__trigger--abierto');
    }
  });

  // Evitar que clics dentro del panel lo cierren
  panel.addEventListener('click', function (e) { e.stopPropagation(); });

  // ── Filtrar opciones al escribir ─────────────────────────────────────
  if (buscador) {
    buscador.addEventListener('input', function () {
      const q = this.value.toLowerCase().trim();
      lista.querySelectorAll('.materia-picker__opcion').forEach(function (li) {
        const nombre = (li.dataset.nombre || li.textContent).toLowerCase();
        li.style.display = nombre.includes(q) ? '' : 'none';
      });
    });
  }

  // ── Seleccionar opción y hacer submit ────────────────────────────────
  lista.addEventListener('click', function (e) {
    const opcion = e.target.closest('.materia-picker__opcion');
    if (!opcion) return;

    const id     = opcion.dataset.id     || '';
    const nombre = opcion.dataset.nombre || opcion.textContent.trim();

    // Actualizar el input hidden con el materiaId
    inputId.value = id;

    // Actualizar el label del trigger
    if (label) {
      label.textContent = nombre || 'Seleccionar materia';
    }

    // Marcar opción activa visualmente
    lista.querySelectorAll('.materia-picker__opcion').forEach(function (li) {
      li.classList.remove('materia-picker__opcion--activa');
    });
    opcion.classList.add('materia-picker__opcion--activa');

    // Cerrar el panel
    panel.classList.remove('materia-picker__panel--abierto');
    trigger.classList.remove('materia-picker__trigger--abierto');
    if (buscador) buscador.value = '';
    lista.querySelectorAll('.materia-picker__opcion').forEach(function (li) {
      li.style.display = '';
    });

    // Enviar el formulario automáticamente
    form.submit();
  });
});