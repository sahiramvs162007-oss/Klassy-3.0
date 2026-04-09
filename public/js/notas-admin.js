/**
 * public/js/notas-admin.js
 * Edición inline de notas para admin y director.
 * Sin restricción de periodo cerrado.
 */

function editarNotaAdmin(notaId, valorActual, btnEl) {
  const spanNota = document.getElementById(`nota_${notaId}`);
  if (!spanNota) return;

  const valorOriginal = valorActual;

  const input = document.createElement('input');
  input.type  = 'number';
  input.step  = '0.1';
  input.min   = '1.0';
  input.max   = '5.0';
  input.value = valorActual;
  input.className = 'nota-input-inline';

  spanNota.replaceWith(input);
  input.focus();
  input.select();

  if (btnEl) btnEl.style.display = 'none';

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await guardarNotaAdmin(notaId, input.value, input, btnEl);
    } else if (e.key === 'Escape') {
      const span = document.createElement('span');
      span.id = `nota_${notaId}`;
      span.className = `nota-valor nota-valor--${valorOriginal >= 3 ? 'ok' : 'mal'}`;
      span.textContent = parseFloat(valorOriginal).toFixed(1);
      input.replaceWith(span);
      if (btnEl) btnEl.style.display = '';
    }
  });

  input.addEventListener('blur', async () => {
    await guardarNotaAdmin(notaId, input.value, input, btnEl);
  });
}

async function guardarNotaAdmin(notaId, valor, inputEl, btnEl) {
  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum < 1.0 || valorNum > 5.0) {
    inputEl.style.borderColor = 'var(--rojo-600)';
    inputEl.title = 'Debe ser entre 1.0 y 5.0';
    inputEl.focus();
    return;
  }

  try {
    const res  = await fetch(`/notas/admin/${notaId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ valor: valorNum }),
    });
    const datos = await res.json();

    if (datos.ok) {
      const nuevoSpan = document.createElement('span');
      nuevoSpan.id        = `nota_${notaId}`;
      nuevoSpan.className = `nota-valor nota-valor--${valorNum >= 3 ? 'ok' : 'mal'}`;
      nuevoSpan.textContent = valorNum.toFixed(1);
      inputEl.replaceWith(nuevoSpan);

      if (btnEl) {
        btnEl.style.display = '';
        btnEl.setAttribute('onclick', `editarNotaAdmin('${notaId}', ${valorNum}, this)`);
      }

      nuevoSpan.style.outline = '2px solid var(--verde-600)';
      setTimeout(() => { nuevoSpan.style.outline = ''; }, 1500);
    } else {
      inputEl.style.borderColor = 'var(--rojo-600)';
      inputEl.title = datos.error || 'Error';
    }
  } catch {
    inputEl.style.borderColor = 'var(--rojo-600)';
    inputEl.title = 'Error de conexión';
  }
}

// ─── Paginación ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  iniciarPaginacion('tbodyNotasAdmin', { filasPorPagina: 10 });
});