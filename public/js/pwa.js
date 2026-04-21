// ─── KLASSY PWA — Registro del Service Worker e instalación ──────────────────

(function () {
  'use strict';

  // ── 1. Registrar el Service Worker ─────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[PWA] Service Worker registrado:', reg.scope);

        // Detectar actualización disponible
        reg.addEventListener('updatefound', () => {
          const nuevoSW = reg.installing;
          nuevoSW.addEventListener('statechange', () => {
            if (nuevoSW.state === 'installed' && navigator.serviceWorker.controller) {
              mostrarBannerActualizacion(nuevoSW);
            }
          });
        });
      } catch (err) {
        console.warn('[PWA] Error al registrar Service Worker:', err);
      }
    });
  }

  // ── 2. Botón de instalación (A2HS) ─────────────────────────────────────────
  let promptEvento = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptEvento = e;
    mostrarBotonInstalar();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] KLASSY instalada correctamente');
    ocultarBotonInstalar();
    promptEvento = null;
  });

  function mostrarBotonInstalar() {
    // Crear botón flotante si no existe
    if (document.getElementById('btn-instalar-pwa')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-instalar-pwa';
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Instalar KLASSY
    `;
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1a4aad;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(26,74,173,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      animation: slideIn 0.4s ease;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 20px rgba(26,74,173,0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 16px rgba(26,74,173,0.4)';
    });

    btn.addEventListener('click', async () => {
      if (!promptEvento) return;
      promptEvento.prompt();
      const { outcome } = await promptEvento.userChoice;
      console.log('[PWA] Usuario eligió:', outcome);
      promptEvento = null;
      ocultarBotonInstalar();
    });

    // Animación de entrada
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(btn);
  }

  function ocultarBotonInstalar() {
    const btn = document.getElementById('btn-instalar-pwa');
    if (btn) btn.remove();
  }

  // ── 3. Banner de actualización disponible ───────────────────────────────────
  function mostrarBannerActualizacion(nuevoSW) {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 99999;
      background: #1a4aad;
      color: white;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 0.9rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    banner.innerHTML = `
      <span>🎉 Nueva versión de KLASSY disponible</span>
      <button style="
        background: white;
        color: #1a4aad;
        border: none;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.85rem;
        white-space: nowrap;
      ">Actualizar</button>
    `;
    banner.querySelector('button').addEventListener('click', () => {
      nuevoSW.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    });
    document.body.prepend(banner);
  }

  // ── 4. Estado de conexión ────────────────────────────────────────────────────
  function mostrarAlertaOffline() {
    if (document.getElementById('klassy-offline-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'klassy-offline-bar';
    bar.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 99998;
      background: #374151;
      color: white;
      padding: 10px 20px;
      text-align: center;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 0.875rem;
    `;
    bar.textContent = '📡 Sin conexión — algunas funciones no están disponibles';
    document.body.appendChild(bar);
  }

  function ocultarAlertaOffline() {
    const bar = document.getElementById('klassy-offline-bar');
    if (bar) bar.remove();
  }

  window.addEventListener('offline', mostrarAlertaOffline);
  window.addEventListener('online', ocultarAlertaOffline);
  if (!navigator.onLine) mostrarAlertaOffline();

})();
