/**
 * public/js/dashboard.js
 * Drawer de noticia (data attributes, no JSON inline)
 * y drawer de configuración institucional para admin.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Abrir noticia en drawer al hacer clic ────────────────────────────────
  document.querySelectorAll('.noticia-clickable').forEach(el => {
    el.addEventListener('click', () => {
      const titulo    = el.dataset.titulo  || '';
      const fecha     = el.dataset.fecha   || '';
      const autor     = el.dataset.autor   || '';
      const imagen    = el.dataset.imagen  || '';

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
