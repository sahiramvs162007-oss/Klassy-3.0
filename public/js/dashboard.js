/**
 * public/js/dashboard.js
 * Drawer de noticia, drawer de configuración y expansión misión/visión.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Expandir tarjetas de Misión / Visión (docente / estudiante) ──────────
  document.querySelectorAll('.mv-expandible').forEach(card => {
    card.addEventListener('click', () => {
      const estaAbierta = card.classList.contains('mv-card--abierta');
      document.querySelectorAll('.mv-expandible').forEach(c => c.classList.remove('mv-card--abierta'));
      if (!estaAbierta) {
        card.classList.add('mv-card--abierta');
      }
    });
  });

  // ─── Abrir noticia en drawer al hacer clic ────────────────────────────────
  document.querySelectorAll('.noticia-clickable').forEach(el => {
    el.addEventListener('click', () => {
      const titulo   = el.dataset.titulo   || '';
      const fecha    = el.dataset.fecha    || '';
      const autor    = el.dataset.autor    || '';
      const imagen   = el.dataset.imagen   || '';
      const etiqueta = el.dataset.etiqueta || '';

      const spanContenido = el.querySelector('.noticia-contenido-oculto');
      const contenido = spanContenido ? spanContenido.textContent : '';

      const fechaFormateada = fecha
        ? new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';

      const imgHtml = imagen
        ? `<div class="drawer-noticia__img-wrap"><img src="${imagen}" alt="" class="drawer-noticia__img" /></div>`
        : '';

      const autorHtml = autor
        ? `<span class="drawer-noticia__autor"><i data-lucide="user"></i> ${autor}</span>`
        : '';

      const claseEtiqueta = etiqueta.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
      const etiquetaHtml  = etiqueta
        ? `<span class="noticia-etiqueta noticia-etiqueta--${claseEtiqueta} noticia-etiqueta--drawer">${etiqueta}</span>`
        : '';

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

// ─── Preview foto institución ─────────────────────────────────────────────────
function previsualizarFotoInst(input) {
  const preview = document.getElementById('previewFotoInst');
  if (!preview) return;
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

// ─── Mosaico de noticias — 3 columnas (patrones alternados) ──────────────────
(function () {
  var contenedor = document.querySelector('.mosaico-noticias-3col.mosaico-activo-3col');
  if (!contenedor) return;

  var cards = Array.from(contenedor.querySelectorAll('.noticia-card'));
  if (cards.length < 4) return;

  var clasesALimpiar = [
    'noticia-card--vertical','noticia-card--horizontal',
    'noticia-card--tall','noticia-card--normal',
    'noticia-card--wide','noticia-card--banner'
  ];
  cards.forEach(function(card) {
    clasesALimpiar.forEach(function(c) { card.classList.remove(c); });
    card.style.gridColumn = '';
    card.style.gridRow    = '';
  });

  var grupoSize   = 4;
  var totalGrupos = Math.floor(cards.length / grupoSize);
  var resto       = cards.length % grupoSize;

  function aplicarPatronA(grupo, fb) {
    grupo[0].classList.add('noticia-card--tall');   grupo[0].style.gridColumn='1/2'; grupo[0].style.gridRow=fb+'/'+(fb+2);
    grupo[1].classList.add('noticia-card--normal'); grupo[1].style.gridColumn='2/3'; grupo[1].style.gridRow=fb+'/'+(fb+1);
    grupo[2].classList.add('noticia-card--normal'); grupo[2].style.gridColumn='3/4'; grupo[2].style.gridRow=fb+'/'+(fb+1);
    grupo[3].classList.add('noticia-card--wide');   grupo[3].style.gridColumn='2/4'; grupo[3].style.gridRow=(fb+1)+'/'+(fb+2);
  }
  function aplicarPatronB(grupo, fb) {
    grupo[0].classList.add('noticia-card--wide');   grupo[0].style.gridColumn='1/3'; grupo[0].style.gridRow=fb+'/'+(fb+1);
    grupo[1].classList.add('noticia-card--tall');   grupo[1].style.gridColumn='3/4'; grupo[1].style.gridRow=fb+'/'+(fb+2);
    grupo[2].classList.add('noticia-card--normal'); grupo[2].style.gridColumn='1/2'; grupo[2].style.gridRow=(fb+1)+'/'+(fb+2);
    grupo[3].classList.add('noticia-card--normal'); grupo[3].style.gridColumn='2/3'; grupo[3].style.gridRow=(fb+1)+'/'+(fb+2);
  }

  var filaActual = 1;
  for (var g = 0; g < totalGrupos; g++) {
    var grupo = cards.slice(g * grupoSize, g * grupoSize + grupoSize);
    if (g % 2 === 0) aplicarPatronA(grupo, filaActual);
    else             aplicarPatronB(grupo, filaActual);
    filaActual += 2;
  }

  if (resto > 0) {
    var sueltas = cards.slice(totalGrupos * grupoSize);
    if (resto === 1) {
      sueltas[0].classList.add('noticia-card--banner');
      sueltas[0].style.gridColumn = '1/4';
      sueltas[0].style.gridRow    = filaActual+'/'+(filaActual+1);
    } else {
      sueltas.forEach(function(card, i) {
        card.classList.add('noticia-card--normal');
        card.style.gridColumn = (i+1)+'/'+(i+2);
        card.style.gridRow    = filaActual+'/'+(filaActual+1);
      });
    }
  }
})();