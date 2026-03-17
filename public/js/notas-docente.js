/**
 * public/js/notas-docente.js
 * Drawer de selección de periodo + edición inline de notas.
 */

// ─── Abrir selector de periodo antes de ver la tabla ─────────────────────────
function abrirSelectorPeriodo(materiaId, gradoId, nombreMateria, nombreGrado) {
  const items = PERIODOS_DISPONIBLES.map(p => `
    <a href="/notas/docente?materiaId=${materiaId}&gradoId=${gradoId}&periodoId=${p._id}"
      class="selector-periodo-item ${!p.activo ? 'selector-periodo-item--cerrado' : ''}">
      <div class="selector-periodo-item__num">${p.numero}</div>
      <div class="selector-periodo-item__info">
        <span class="selector-periodo-item__nombre">${p.nombre}</span>
        <span class="selector-periodo-item__estado badge ${p.activo ? 'badge--activo' : 'badge--inactivo'}">
          ${p.activo ? 'Activo' : 'Cerrado'}
        </span>
      </div>
      <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--gris-300);"></i>
    </a>
  `).join('');

  document.getElementById('drawerTitulo').textContent = `${nombreMateria} — ${nombreGrado}`;
  document.getElementById('drawerCuerpo').innerHTML = `
    <div class="formulario-grupo">
      <p class="texto-secundario" style="margin-bottom:4px;">Selecciona el periodo para ver las notas:</p>
      <div class="selector-periodo-lista">${items || '<p class="texto-vacio">Sin periodos registrados.</p>'}</div>
    </div>`;

  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';

  lucide.createIcons();
}

// ─── Edición inline de nota (docente) ────────────────────────────────────────
function editarNota(notaId, valorActual, btnEl) {
  const spanNota = document.getElementById(`nota_${notaId}`);
  if (!spanNota) return;

  // Si ya hay un input activo, no hacer nada
  if (spanNota.querySelector('input')) return;

  const valorOriginal = valorActual;

  // Reemplazar el span por un input
  const input = document.createElement('input');
  input.type  = 'number';
  input.step  = '0.1';
  input.min   = '1.0';
  input.max   = '5.0';
  input.value = valorActual;
  input.className = 'nota-input-inline';
  input.setAttribute('data-id', notaId);

  spanNota.replaceWith(input);
  input.focus();
  input.select();

  // Ocultar el botón de editar mientras se edita
  btnEl.style.display = 'none';

  // Confirmar con Enter, cancelar con Escape
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await guardarNota(notaId, input.value, input, btnEl, 'docente');
    } else if (e.key === 'Escape') {
      restaurarNota(notaId, valorOriginal, input, btnEl);
    }
  });

  // Confirmar al perder foco
  input.addEventListener('blur', async () => {
    await guardarNota(notaId, input.value, input, btnEl, 'docente');
  });
}

// ─── Guardar nota via PUT ─────────────────────────────────────────────────────
async function guardarNota(notaId, valor, inputEl, btnEl, modo = 'docente') {
  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum < 1.0 || valorNum > 5.0) {
    mostrarErrorInline(inputEl, 'Debe ser entre 1.0 y 5.0');
    return;
  }

  const url = modo === 'docente'
    ? `/notas/docente/${notaId}`
    : `/notas/admin/${notaId}`;

  try {
    const res  = await fetch(url, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ valor: valorNum }),
    });
    const datos = await res.json();

    if (datos.ok) {
      // Restaurar el span con el nuevo valor
      const nuevoSpan = document.createElement('span');
      nuevoSpan.id        = `nota_${notaId}`;
      nuevoSpan.className = `nota-valor nota-valor--${valorNum >= 3 ? 'ok' : 'mal'}`;
      nuevoSpan.textContent = valorNum.toFixed(1);
      inputEl.replaceWith(nuevoSpan);

      if (btnEl) btnEl.style.display = '';

      // Actualizar onclick del botón con el nuevo valor
      if (btnEl) {
        const fn = modo === 'docente' ? 'editarNota' : 'editarNotaAdmin';
        btnEl.setAttribute('onclick', `${fn}('${notaId}', ${valorNum}, this)`);
      }

      // Feedback visual breve
      nuevoSpan.style.outline = '2px solid var(--verde-600)';
      nuevoSpan.style.transition = 'outline 0.5s ease';
      setTimeout(() => { nuevoSpan.style.outline = ''; }, 1500);

    } else {
      mostrarErrorInline(inputEl, datos.error || 'Error al guardar');
    }
  } catch (err) {
    mostrarErrorInline(inputEl, 'Error de conexión');
  }
}

function restaurarNota(notaId, valorOriginal, inputEl, btnEl) {
  const span = document.createElement('span');
  span.id        = `nota_${notaId}`;
  span.className = `nota-valor nota-valor--${valorOriginal >= 3 ? 'ok' : 'mal'}`;
  span.textContent = parseFloat(valorOriginal).toFixed(1);
  inputEl.replaceWith(span);
  if (btnEl) btnEl.style.display = '';
}

function mostrarErrorInline(inputEl, mensaje) {
  inputEl.style.borderColor = 'var(--rojo-600)';
  inputEl.title = mensaje;
  inputEl.focus();
}
