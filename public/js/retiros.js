// ── Abrir / cerrar drawer (clases correctas) ──────────
    function abrirDrawerRetirar() {
      const template = document.getElementById('templateRetirar');
      const clon = template.content.cloneNode(true);
      document.getElementById('drawerTitulo').textContent = 'Retirar estudiante';
      document.getElementById('drawerCuerpo').innerHTML = '';
      document.getElementById('drawerCuerpo').appendChild(clon);
      document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
      document.getElementById('drawer').classList.add('drawer--abierto');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
      initEstPicker();
    }

    function cerrarDrawer() {
      document.getElementById('drawerOverlay').classList.remove('drawer-overlay--visible');
      document.getElementById('drawer').classList.remove('drawer--abierto');
      document.body.style.overflow = '';
    }

    // ── Picker de estudiantes ─────────────────────────────
    function initEstPicker() {
      const trigger  = document.getElementById('estPickerTrigger');
      const panel    = document.getElementById('estPickerPanel');
      const buscador = document.getElementById('estBuscador');
      const lista    = document.getElementById('estLista');
      const inputId  = document.getElementById('inputEstudianteId');
      const label    = document.getElementById('estPickerLabel');
      const avatarMini = document.getElementById('estPickerAvatarMini');
      if (!trigger) return;

      // Renderizar lista inicial
      function renderLista(filtro) {
        const q = (filtro || '').toLowerCase();
        lista.innerHTML = '';
        const filtrados = ESTUDIANTES_DATA.filter(e =>
          (e.nombre + ' ' + e.apellido).toLowerCase().includes(q) ||
          e.doc.toLowerCase().includes(q)
        );
        if (filtrados.length === 0) {
          lista.innerHTML = '<li class="est-picker__vacio">Sin resultados</li>';
          return;
        }
        filtrados.forEach(e => {
          const initiales = (e.nombre.charAt(0) + e.apellido.charAt(0)).toUpperCase();
          const li = document.createElement('li');
          li.className = 'est-picker__opcion';
          li.dataset.id = e.id;
          li.dataset.nombre = e.apellido + ', ' + e.nombre;
          li.innerHTML = `
            <span class="est-picker__avatar">${initiales}</span>
            <span class="est-picker__info">
              <span class="est-picker__nombre">${e.apellido}, ${e.nombre}</span>
              <span class="est-picker__meta">${e.doc ? 'Doc: ' + e.doc + ' · ' : ''}Nivel ${e.nivel}</span>
            </span>`;
          lista.appendChild(li);
        });
      }

      renderLista('');

      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        const open = panel.classList.toggle('est-picker__panel--abierto');
        trigger.classList.toggle('est-picker__trigger--abierto', open);
        if (open) setTimeout(() => buscador.focus(), 50);
      });

      document.addEventListener('click', function closePanel() {
        panel.classList.remove('est-picker__panel--abierto');
        trigger.classList.remove('est-picker__trigger--abierto');
      });
      panel.addEventListener('click', e => e.stopPropagation());

      buscador.addEventListener('input', () => renderLista(buscador.value));

      lista.addEventListener('click', function(e) {
        const opt = e.target.closest('.est-picker__opcion');
        if (!opt) return;
        inputId.value = opt.dataset.id;
        label.textContent = opt.dataset.nombre;
        label.style.color = 'var(--gris-900)';
        const initiales = opt.querySelector('.est-picker__avatar').textContent;
        avatarMini.textContent = initiales;
        avatarMini.style.display = 'flex';
        lista.querySelectorAll('.est-picker__opcion').forEach(li => li.classList.remove('est-picker__opcion--activa'));
        opt.classList.add('est-picker__opcion--activa');
        panel.classList.remove('est-picker__panel--abierto');
        trigger.classList.remove('est-picker__trigger--abierto');
        buscador.value = '';
        renderLista('');
      });
    }