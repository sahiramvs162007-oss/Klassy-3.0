/**
 * public/js/paginacion.js
 * Módulo reutilizable de paginación para todas las tablas de Klassy.
 *
 * Uso:
 *   iniciarPaginacion('id-del-tbody', { filasPorPagina: 10 })
 *
 * El sistema detecta automáticamente las filas del tbody y genera
 * los controles de paginación debajo de la tabla.
 */

(function (global) {
  'use strict';

  /**
   * Inicializa la paginación en una tabla dada.
   * @param {string} tbodyId  - ID del <tbody> a paginar.
   * @param {object} opciones - { filasPorPagina: number (default 10) }
   */
  function iniciarPaginacion(tbodyId, opciones) {
    const opts = Object.assign({ filasPorPagina: 10 }, opciones || {});
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    // Insertamos el contenedor de paginación justo después del .tabla-contenedor
    const tablaContenedor = tbody.closest('.tabla-contenedor');
    if (!tablaContenedor) return;

    // Evitar duplicar si ya existe
    const idPaginador = tbodyId + '-paginador';
    let paginador = document.getElementById(idPaginador);
    if (!paginador) {
      paginador = document.createElement('div');
      paginador.id = idPaginador;
      paginador.className = 'paginacion';
      tablaContenedor.after(paginador);
    }

    let paginaActual = 1;

    function obtenerFilas() {
      // Obtenemos solo filas visibles (no las ocultas por filtros del servidor o búsqueda)
      return Array.from(tbody.querySelectorAll('tr'));
    }

    function renderizar() {
      const filas = obtenerFilas();
      const total = filas.length;
      const totalPaginas = Math.max(1, Math.ceil(total / opts.filasPorPagina));

      // Ajustar página actual si cambió el total
      if (paginaActual > totalPaginas) paginaActual = totalPaginas;

      const inicio = (paginaActual - 1) * opts.filasPorPagina;
      const fin = inicio + opts.filasPorPagina;

      // Mostrar/ocultar filas
      filas.forEach(function (fila, idx) {
        fila.style.display = (idx >= inicio && idx < fin) ? '' : 'none';
      });

      // Renderizar controles
      if (total <= opts.filasPorPagina) {
        paginador.style.display = 'none';
        return;
      }
      paginador.style.display = '';

      const primerRegistro = total === 0 ? 0 : inicio + 1;
      const ultimoRegistro = Math.min(fin, total);

      paginador.innerHTML = '';

      // Info de registros
      const info = document.createElement('span');
      info.className = 'paginacion__info';
      info.textContent =
        primerRegistro + '–' + ultimoRegistro + ' de ' + total + ' registros';
      paginador.appendChild(info);

      // Controles
      const controles = document.createElement('div');
      controles.className = 'paginacion__controles';

      // Botón anterior
      const btnAnterior = crearBoton(
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
        'Anterior',
        paginaActual === 1
      );
      btnAnterior.addEventListener('click', function () {
        if (paginaActual > 1) { paginaActual--; renderizar(); }
      });
      controles.appendChild(btnAnterior);

      // Botones de páginas
      const paginas = calcularPaginas(paginaActual, totalPaginas);
      paginas.forEach(function (p) {
        if (p === '…') {
          const elipsis = document.createElement('span');
          elipsis.className = 'paginacion__elipsis';
          elipsis.textContent = '…';
          controles.appendChild(elipsis);
        } else {
          const btn = crearBoton(p, 'Página ' + p, false);
          if (p === paginaActual) btn.classList.add('paginacion__btn--activo');
          btn.addEventListener('click', (function (pagina) {
            return function () { paginaActual = pagina; renderizar(); };
          })(p));
          controles.appendChild(btn);
        }
      });

      // Botón siguiente
      const btnSiguiente = crearBoton(
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
        'Siguiente',
        paginaActual === totalPaginas
      );
      btnSiguiente.addEventListener('click', function () {
        if (paginaActual < totalPaginas) { paginaActual++; renderizar(); }
      });
      controles.appendChild(btnSiguiente);

      paginador.appendChild(controles);
    }

    function crearBoton(contenidoHTML, ariaLabel, deshabilitado) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'paginacion__btn';
      btn.innerHTML = contenidoHTML;
      btn.setAttribute('aria-label', ariaLabel);
      if (deshabilitado) {
        btn.disabled = true;
        btn.classList.add('paginacion__btn--deshabilitado');
      }
      return btn;
    }

    function calcularPaginas(actual, total) {
      if (total <= 7) {
        return Array.from({ length: total }, function (_, i) { return i + 1; });
      }
      const paginas = [];
      paginas.push(1);
      if (actual > 3) paginas.push('…');
      for (let i = Math.max(2, actual - 1); i <= Math.min(total - 1, actual + 1); i++) {
        paginas.push(i);
      }
      if (actual < total - 2) paginas.push('…');
      paginas.push(total);
      return paginas;
    }

    // Exponer método para re-renderizar (útil si el DOM cambia)
    tbody._paginacionRenderizar = renderizar;

    renderizar();
  }

  global.iniciarPaginacion = iniciarPaginacion;

})(window);
