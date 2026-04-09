function cambiarTab(tab) {
    // Tabs
    document.querySelectorAll('.act-tab').forEach(t => {
      t.classList.remove('act-tab--activo');
      t.setAttribute('aria-selected', 'false');
    });
    const tabEl = document.getElementById('tab-' + tab);
    if (tabEl) { tabEl.classList.add('act-tab--activo'); tabEl.setAttribute('aria-selected', 'true'); }

    // Paneles
    document.querySelectorAll('.act-panel').forEach(p => p.classList.remove('act-panel--visible'));
    const panel = document.getElementById('panel-' + tab);
    if (panel) panel.classList.add('act-panel--visible');
  }
  lucide.createIcons();