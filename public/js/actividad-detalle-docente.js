/**
 * public/js/actividad-detalle-docente.js
 * Drawer para ver entregas de un estudiante y calificarlas.
 */

// Filtrar entre entregaron / no entregaron
function filtrarEntregas(tipo, btnEl) {
  document.querySelectorAll('.entregas-tab').forEach(b => b.classList.remove('entregas-tab--activo'));
  btnEl.classList.add('entregas-tab--activo');

  document.getElementById('listaEntregaron').style.display = tipo === 'entregaron' ? 'block' : 'none';
  document.getElementById('listaFaltantes').style.display  = tipo === 'faltantes'  ? 'block' : 'none';
}

// Abrir drawer con las entregas del estudiante
function abrirEntregas(estudianteId, nombreEstudiante) {
  const datos = RESUMEN_ENTREGAS.find(r => r.estudianteId === estudianteId);
  if (!datos) return;

  const entregas = datos.entregas;

  let html = `<div class="entregas-detalle-drawer">`;

  if (entregas.length === 0) {
    html += `<p class="texto-vacio">Sin entregas.</p>`;
  } else {
    entregas.forEach((e, idx) => {
      const esCalificada = e.estado === 'calificada';
      const fechaStr     = new Date(e.fechaEntrega).toLocaleString('es-CO', {
        day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
      });

      html += `
        <div class="entrega-drawer-item ${esCalificada ? 'entrega-drawer-item--calificada' : ''}">
          <div class="entrega-drawer-item__header">
            <span class="entrega-drawer-item__num">Entrega #${entregas.length - idx}</span>
            <span class="texto-secundario texto-sm">${fechaStr}</span>
            ${esCalificada
              ? `<span class="nota-chip nota-chip--${e.nota >= 3 ? 'ok' : 'mal'}">${parseFloat(e.nota).toFixed(1)}</span>`
              : '<span class="badge badge--pendiente">Sin calificar</span>'
            }
          </div>

          ${e.contenidoTexto ? `<p class="entrega-drawer-item__texto">${e.contenidoTexto}</p>` : ''}

          ${e.archivos?.length > 0 ? `
            <div class="archivos-lista archivos-lista--sm" style="margin:8px 0;">
              ${e.archivos.map(a => `
                <a href="${a.ruta}" target="_blank" class="archivo-chip">
                  <i data-lucide="file"></i> ${a.nombreOriginal}
                </a>
              `).join('')}
            </div>
          ` : ''}

          <!-- Formulario de calificación -->
          <div class="calificar-form" id="calificar_${e._id}">
            ${esCalificada && e.comentarioDocente ? `
              <div class="entrega-propia__feedback" style="margin-bottom:8px;">
                <i data-lucide="message-circle" style="width:13px;height:13px;"></i>
                <span><strong>Tu comentario:</strong> ${e.comentarioDocente}</span>
              </div>
            ` : ''}
            <div class="calificar-form__inputs">
              <div class="campo" style="flex:1;">
                <label class="campo__etiqueta">Nota (1.0 – 5.0)</label>
                <input type="number" step="0.1" min="1.0" max="5.0" id="nota_${e._id}"
                  class="campo__entrada" value="${e.nota || ''}" placeholder="Ej: 4.5" />
              </div>
              <div class="campo" style="flex:2;">
                <label class="campo__etiqueta">Comentario al estudiante</label>
                <input type="text" id="coment_${e._id}"
                  class="campo__entrada" value="${e.comentarioDocente || ''}"
                  placeholder="Retroalimentación opcional..." />
              </div>
            </div>
            <button type="button" class="btn btn--primario btn--sm" onclick="enviarCalificacion('${e._id}')">
              <i data-lucide="check"></i> ${esCalificada ? 'Actualizar nota' : 'Calificar'}
            </button>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;

  document.getElementById('drawerTitulo').textContent = nombreEstudiante;
  document.getElementById('drawerCuerpo').innerHTML   = html;

  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';

  lucide.createIcons();
}

// Enviar calificación vía fetch
async function enviarCalificacion(entregaId) {
  const notaInput   = document.getElementById(`nota_${entregaId}`);
  const comentInput = document.getElementById(`coment_${entregaId}`);
  const nota        = parseFloat(notaInput?.value);

  if (isNaN(nota) || nota < 1.0 || nota > 5.0) {
    alert('La nota debe estar entre 1.0 y 5.0');
    return;
  }

  try {
    const res = await fetch(`/actividades/docente/entregas/${entregaId}/calificar`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nota:              nota,
        comentarioDocente: comentInput?.value || '',
      }),
    });

    const datos = await res.json();
    if (datos.ok) {
      // Actualizar UI localmente
      const item = notaInput.closest('.entrega-drawer-item');
      item.classList.add('entrega-drawer-item--calificada');

      // Actualizar en RESUMEN_ENTREGAS para que el drawer sea consistente
      for (const r of RESUMEN_ENTREGAS) {
        const e = r.entregas.find(e => e._id === entregaId);
        if (e) { e.nota = nota; e.estado = 'calificada'; }
      }

      // Mostrar confirmación visual
      const btn = item.querySelector('.btn--primario');
      if (btn) {
        btn.textContent = '✓ Guardado';
        btn.disabled    = true;
        setTimeout(() => { btn.textContent = 'Actualizar nota'; btn.disabled = false; }, 2000);
      }

      // Actualizar el chip de nota
      const chipAnterior = item.querySelector('.nota-chip, .badge--pendiente');
      if (chipAnterior) {
        chipAnterior.outerHTML = `<span class="nota-chip nota-chip--${nota >= 3 ? 'ok' : 'mal'}">${nota.toFixed(1)}</span>`;
      }

      lucide.createIcons();

    } else {
      alert(datos.error || 'Error al calificar');
    }
  } catch (err) {
    console.error(err);
    alert('Error de conexión al calificar');
  }
}
