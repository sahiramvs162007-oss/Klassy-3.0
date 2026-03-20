/**
 * public/js/noticias.js
 * Drawer de gestión de noticias (crear / editar).
 */

function abrirDrawerCrear() {
  const form = clonar();
  form.action = '/noticias';
  form.querySelector('#metodoNoticia').value = '';
  form.querySelector('#txtGuardar').textContent = 'Crear noticia';
  // Fecha de hoy por defecto
  form.querySelector('#campoFecha').value = new Date().toISOString().slice(0, 10);

  document.getElementById('drawerTitulo').textContent = 'Nueva noticia';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(form);
  abrir();
  lucide.createIcons();
}

async function abrirDrawerEditar(id) {
  document.getElementById('drawerTitulo').textContent = 'Cargando...';
  abrir();

  try {
    const res  = await fetch(`/noticias/${id}/datos`);
    if (!res.ok) throw new Error('No se pudo obtener la noticia');
    const n    = await res.json();
    const form = clonar();

    form.action = `/noticias/${id}?_method=PUT`;
    form.querySelector('#metodoNoticia').value   = 'PUT';
    form.querySelector('#campoTitulo').value     = n.titulo    || '';
    form.querySelector('#campoContenido').value  = n.contenido || '';
    form.querySelector('#campoActivo').value     = n.activo ? 'true' : 'false';
    form.querySelector('#txtGuardar').textContent = 'Guardar cambios';

    if (n.fechaPublicacion) {
      form.querySelector('#campoFecha').value =
        new Date(n.fechaPublicacion).toISOString().slice(0, 10);
    }

    // Mostrar imagen actual si tiene
    if (n.imagen) {
      form.querySelector('#imgActual').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;font-size:0.75rem;color:var(--gris-500);">
          <img src="${n.imagen}"
            style="width:54px;height:40px;object-fit:cover;border-radius:5px;border:1px solid var(--gris-200);" />
          <span>Imagen actual — sube otra para reemplazarla</span>
        </div>`;
    }

    document.getElementById('drawerTitulo').textContent = `Editar: ${n.titulo}`;
    document.getElementById('drawerCuerpo').innerHTML   = '';
    document.getElementById('drawerCuerpo').appendChild(form);
    lucide.createIcons();

  } catch (e) {
    console.error(e);
    document.getElementById('drawerCuerpo').innerHTML =
      '<p class="texto-error" style="padding:16px;">Error al cargar la noticia. Intenta de nuevo.</p>';
  }
}

function previsualizarImg(input) {
  const preview = document.getElementById('previewImg');
  if (!preview || !input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    preview.innerHTML = `
      <img src="${e.target.result}"
        style="max-width:100%;max-height:160px;object-fit:cover;
               border-radius:8px;border:1px solid var(--gris-200);display:block;" />`;
  };
  reader.readAsDataURL(input.files[0]);
}

function clonar() {
  return document.getElementById('tplFormNoticia').content.cloneNode(true).querySelector('form');
}

function abrir() {
  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';
}
