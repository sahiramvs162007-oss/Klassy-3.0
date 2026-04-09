/**
 * public/js/dashboard.js
 * Drawer de noticia (data attributes, no JSON inline)
 * y drawer de configuración institucional para admin.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Abrir noticia en drawer al hacer clic ────────────────────────────────
  document.querySelectorAll('.noticia-clickable').forEach(el => {
    el.addEventListener('click', () => {
      const titulo   = el.dataset.titulo   || '';
      const fecha    = el.dataset.fecha    || '';
      const autor    = el.dataset.autor    || '';
      const imagen   = el.dataset.imagen   || '';
      const etiqueta = el.dataset.etiqueta || '';

      // El contenido completo vive en un span oculto dentro del elemento
      const spanContenido = el.querySelector('.noticia-contenido-oculto');
      const contenido = spanContenido ? spanContenido.textContent : '';

      const fechaFormateada = fecha
        ? new Date(fecha).toLocaleDateString('es-CO', {
            day: '2-digit', month: 'long', year: 'numeric',
          })
        : '';

      // Construir el HTML del drawer de forma segura
      const imgHtml = imagen
        ? `<div class="drawer-noticia__img-wrap">
             <img src="${imagen}" alt="" class="drawer-noticia__img" />
           </div>`
        : '';

      const autorHtml = autor
        ? `<span class="drawer-noticia__autor">
             <i data-lucide="user"></i> ${autor}
           </span>`
        : '';

      // ─── Badge de etiqueta ────────────────────────────────────────────────
      const claseEtiqueta = etiqueta
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const etiquetaHtml = etiqueta
        ? `<span class="noticia-etiqueta noticia-etiqueta--${claseEtiqueta} noticia-etiqueta--drawer">
             ${etiqueta}
           </span>`
        : '';

      // Escapar el contenido para mostrarlo como texto — evita XSS
      const div = document.createElement('div');
      div.textContent = contenido;
      const contenidoEscapado = div.innerHTML;

      const html = `
        <div class="drawer-noticia">
          ${imgHtml}
          <div class="drawer-noticia__meta">
            <time class="noticia-card__fecha">${fechaFormateada}</time>
            ${autorHtml}
          </div>
          ${etiquetaHtml}
          <h2 class="drawer-noticia__titulo">${titulo}</h2>
          <div class="drawer-noticia__contenido">${contenidoEscapado.replace(/\n/g, '<br/>')}</div>
        </div>`;

      document.getElementById('drawerTitulo').textContent = titulo;
      document.getElementById('drawerCuerpo').innerHTML   = html;
      document.getElementById('drawer').classList.add('drawer--abierto');
      document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
    });
  });

});

// ─── Drawer de configuración institucional (admin) ────────────────────────────
function abrirDrawerConfig() {
  const configOverlay = document.getElementById('configOverlay');
  const drawerConfig  = document.getElementById('drawerConfig');
  if (!drawerConfig) return;

  configOverlay.style.display = 'block';
  // Pequeño delay para que la transición CSS funcione
  requestAnimationFrame(() => {
    drawerConfig.classList.add('drawer--abierto');
    configOverlay.classList.add('drawer-overlay--visible');
    document.body.style.overflow = 'hidden';
  });
}

function cerrarConfig() {
  const configOverlay = document.getElementById('configOverlay');
  const drawerConfig  = document.getElementById('drawerConfig');
  if (!drawerConfig) return;

  drawerConfig.classList.remove('drawer--abierto');
  configOverlay.classList.remove('drawer-overlay--visible');
  document.body.style.overflow = '';
  setTimeout(() => { configOverlay.style.display = 'none'; }, 260);
}

/**
 * KLASSY — Mosaico de noticias con patrones alternados
 *
 * Patrón A (grupos 1°, 3°, 5°...):
 *   [TALL ][norm][norm]
 *   [TALL ][wide      ]
 *
 * Patrón B (grupos 2°, 4°, 6°...):
 *   [wide      ][TALL ]
 *   [norm][norm][TALL ]
 *
 * Noticias sueltas al final (que no completan un grupo de 4):
 *   - 1 sola  → banner ancho completo (3 cols)
 *   - 2 solas → dos normales (1 col c/u)
 *   - 3 solas → tres normales (1 col c/u)
 */

(function () {
  var contenedor = document.querySelector('.mosaico-noticias-3col.mosaico-activo-3col');
  if (!contenedor) return;

  var cards = Array.from(contenedor.querySelectorAll('.noticia-card'));
  if (cards.length < 4) return;

  // Limpiar clases y estilos previos que pudiera haber asignado el EJS
  var clasesALimpiar = [
    'noticia-card--vertical', 'noticia-card--horizontal',
    'noticia-card--tall', 'noticia-card--normal',
    'noticia-card--wide', 'noticia-card--banner'
  ];
  cards.forEach(function (card) {
    clasesALimpiar.forEach(function (c) { card.classList.remove(c); });
    card.style.gridColumn = '';
    card.style.gridRow = '';
  });

  var grupoSize = 4;
  var totalGrupos = Math.floor(cards.length / grupoSize);
  var resto = cards.length % grupoSize;

  /**
   * Patrón A
   *   col1        rows filaBase – filaBase+2  → TALL  (ocupa 2 filas)
   *   col2        row  filaBase               → normal
   *   col3        row  filaBase               → normal
   *   col2–col4   row  filaBase+1             → wide  (span 2 cols)
   */
  function aplicarPatronA(grupo, filaBase) {
    grupo[0].classList.add('noticia-card--tall');
    grupo[0].style.gridColumn = '1 / 2';
    grupo[0].style.gridRow    = filaBase + ' / ' + (filaBase + 2);

    grupo[1].classList.add('noticia-card--normal');
    grupo[1].style.gridColumn = '2 / 3';
    grupo[1].style.gridRow    = filaBase + ' / ' + (filaBase + 1);

    grupo[2].classList.add('noticia-card--normal');
    grupo[2].style.gridColumn = '3 / 4';
    grupo[2].style.gridRow    = filaBase + ' / ' + (filaBase + 1);

    grupo[3].classList.add('noticia-card--wide');
    grupo[3].style.gridColumn = '2 / 4';
    grupo[3].style.gridRow    = (filaBase + 1) + ' / ' + (filaBase + 2);
  }

  /**
   * Patrón B  (espejo de A: tall a la derecha)
   *   col1–col3   row  filaBase               → wide  (span 2 cols)
   *   col3        rows filaBase – filaBase+2  → TALL  (ocupa 2 filas)
   *   col1        row  filaBase+1             → normal
   *   col2        row  filaBase+1             → normal
   */
  function aplicarPatronB(grupo, filaBase) {
    grupo[0].classList.add('noticia-card--wide');
    grupo[0].style.gridColumn = '1 / 3';
    grupo[0].style.gridRow    = filaBase + ' / ' + (filaBase + 1);

    grupo[1].classList.add('noticia-card--tall');
    grupo[1].style.gridColumn = '3 / 4';
    grupo[1].style.gridRow    = filaBase + ' / ' + (filaBase + 2);

    grupo[2].classList.add('noticia-card--normal');
    grupo[2].style.gridColumn = '1 / 2';
    grupo[2].style.gridRow    = (filaBase + 1) + ' / ' + (filaBase + 2);

    grupo[3].classList.add('noticia-card--normal');
    grupo[3].style.gridColumn = '2 / 3';
    grupo[3].style.gridRow    = (filaBase + 1) + ' / ' + (filaBase + 2);
  }

  // Aplicar patrones alternados a cada grupo completo
  var filaActual = 1;
  for (var g = 0; g < totalGrupos; g++) {
    var grupo = cards.slice(g * grupoSize, g * grupoSize + grupoSize);
    if (g % 2 === 0) {
      aplicarPatronA(grupo, filaActual);
    } else {
      aplicarPatronB(grupo, filaActual);
    }
    filaActual += 2; // cada grupo ocupa exactamente 2 filas
  }

  // Manejar las noticias sueltas que no completan un grupo de 4
  if (resto > 0) {
    var sueltas = cards.slice(totalGrupos * grupoSize);

    if (resto === 1) {
      // Una sola noticia suelta → banner ancho completo
      sueltas[0].classList.add('noticia-card--banner');
      sueltas[0].style.gridColumn = '1 / 4';
      sueltas[0].style.gridRow    = filaActual + ' / ' + (filaActual + 1);
    } else {
      // 2 o 3 noticias sueltas → normales en fila, sin huecos
      sueltas.forEach(function (card, i) {
        card.classList.add('noticia-card--normal');
        card.style.gridColumn = (i + 1) + ' / ' + (i + 2);
        card.style.gridRow    = filaActual + ' / ' + (filaActual + 1);
      });
    }
  }
})();

lucide.createIcons();

    // ── Preview foto institución ───────────────────────────
    function previsualizarFotoInst(input) {
      const preview = document.getElementById('previewFotoInst');
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
          preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:100%;max-height:160px;border-radius:8px;object-fit:cover;border:1px solid var(--gris-200);" />`;
        };
        reader.readAsDataURL(input.files[0]);
      } else {
        preview.innerHTML = '';
      }
    }

    // ── Misión / Visión: expansión inline ──────────────────
    document.querySelectorAll('.mv-expandible').forEach(function(card) {
      card.addEventListener('click', function(e) {
        var isOpen = card.classList.contains('mv-card--abierta');

        // Cerrar todas primero
        document.querySelectorAll('.mv-expandible').forEach(function(c) {
          c.classList.remove('mv-card--abierta');
        });

        // Si estaba cerrado, abrir este
        if (!isOpen) {
          card.classList.add('mv-card--abierta');
        }
      });
    });