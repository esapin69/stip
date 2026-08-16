(() => {
  'use strict';

  const home = document.getElementById('homeView');
  const grid = document.getElementById('moduleGrid');
  const login = document.getElementById('loginView');
  const app = document.getElementById('appView');
  if (!home || !grid || !login || !app) return;

  const STORAGE = 'stip_phone_home_layout_v1';
  const HOLD_DELAY = 520;
  const MAX_DOCK_APPS = 4;
  let rebuilding = false;
  let holdTimer = 0;
  let pointer = null;
  let drag = null;

  const moduleMeta = {
    planning: { label: 'Planning', theme: 'cyan', icon: 'calendar' },
    contacts: { label: 'Contacts', theme: 'mint', icon: 'contacts' },
    procedures: { label: 'Procédures', theme: 'blue', icon: 'document' },
    reperes: { label: 'Repères', theme: 'coral', icon: 'pin' },
    newcomers: { label: 'Nouveaux', theme: 'lavender', icon: 'sparkle' },
    tools: { label: 'Outils', theme: 'navy', icon: 'tools' },
    official: { label: 'Planning officiel', theme: 'blue', icon: 'official' },
    personal: { label: 'Mon planning', theme: 'cyan', icon: 'personal' },
    print: { label: 'Imprimer', theme: 'sun', icon: 'print' },
    spirit: { label: 'Équipe du jour', theme: 'lavender', icon: 'team' },
    change: { label: 'Changement', theme: 'rose', icon: 'change' }
  };

  const defaultDock = ['personal', 'contacts', 'spirit', 'change'];
  const titleKeys = new Map([
    ['planning', 'planning'],
    ['equipe & contacts', 'contacts'],
    ['procedures', 'procedures'],
    ['procédures', 'procedures'],
    ['repères', 'reperes'],
    ['reperes', 'reperes'],
    ['nouveaux arrivants', 'newcomers'],
    ['outils équipe', 'tools'],
    ['outils equipe', 'tools']
  ]);

  const paths = {
    calendar: '<rect x="4" y="6" width="16" height="14" rx="3"/><path d="M8 3v5M16 3v5M4 10h16"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
    contacts: '<path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M8 2v4M16 2v4"/><circle cx="12" cy="11" r="2.4"/><path d="M7.8 17c.8-2 2.2-3 4.2-3s3.4 1 4.2 3"/>',
    document: '<path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>',
    sparkle: '<path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="M18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/>',
    tools: '<path d="m14.6 6.4 3-3a4 4 0 0 1-5 5L6 15l3 3-2 2-5-5 2-2 3 3 6.6-6.6a4 4 0 0 1 1-3Z"/><path d="m14 14 6 6"/>',
    official: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m8 14 2 2 5-5"/>',
    personal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="9" cy="15" r="2"/><path d="M13 17c.7-1.8 1.9-2.7 3.5-2.7"/>',
    print: '<path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/><path d="M17 12h.01"/>',
    team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6M14 15c3.8-.3 6 1.4 6.5 5"/>',
    change: '<path d="M4 7h13l-3-3M20 17H7l3 3"/><path d="m17 4 3 3-3 3M7 14l-3 3 3 3"/>'
  };

  function icon(name) {
    return `<span class="phone-app-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[name] || paths.tools}</svg></span>`;
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function ensureChrome() {
    if (!home.querySelector('.phone-status')) {
      const status = document.createElement('div');
      status.className = 'phone-status';
      status.innerHTML = '<span id="phoneStatusTime">--:--</span><span class="phone-status-right"><span>STIP</span><span class="phone-signal" aria-hidden="true"><i></i><i></i><i></i></span><span class="phone-battery" aria-hidden="true"></span></span>';
      home.prepend(status);
    }

    if (!home.querySelector('.phone-page-head')) {
      const head = document.createElement('div');
      head.className = 'phone-page-head';
      head.innerHTML = '<span>Mes applications</span><button class="phone-edit-button" type="button">Modifier</button><span class="phone-edit-actions"><button class="phone-reset-button" type="button">Réinitialiser</button><button class="phone-done-button" type="button">Terminé</button></span>';
      grid.before(head);
      head.querySelector('.phone-edit-button').addEventListener('click', enterEditMode);
      head.querySelector('.phone-done-button').addEventListener('click', leaveEditMode);
      head.querySelector('.phone-reset-button').addEventListener('click', resetLayout);
    }

    grid.classList.add('phone-app-grid');

    if (!document.getElementById('phoneDock')) {
      const dots = document.createElement('div');
      dots.className = 'phone-page-dots';
      dots.setAttribute('aria-hidden', 'true');
      dots.innerHTML = '<i></i><i></i>';

      const hint = document.createElement('p');
      hint.className = 'phone-edit-hint';
      hint.textContent = 'Maintiens puis fais glisser les applications. Aucune ne peut être supprimée.';

      const dock = document.createElement('div');
      dock.id = 'phoneDock';
      dock.className = 'phone-dock';
      dock.setAttribute('aria-label', 'Applications favorites');

      grid.after(dots, hint, dock);
    }

    if (!login.querySelector('.phone-lock-clock')) {
      const lockClock = document.createElement('div');
      lockClock.className = 'phone-lock-clock';
      lockClock.innerHTML = '<strong id="phoneLockTime">--:--</strong><span id="phoneLockDate"></span>';
      login.prepend(lockClock);
    }
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const statusTime = document.getElementById('phoneStatusTime');
    const lockTime = document.getElementById('phoneLockTime');
    const lockDate = document.getElementById('phoneLockDate');
    if (statusTime) statusTime.textContent = time;
    if (lockTime) lockTime.textContent = time;
    if (lockDate) lockDate.textContent = date.charAt(0).toUpperCase() + date.slice(1);
  }

  function refreshMode() {
    const loginVisible = !login.classList.contains('hidden');
    const appVisible = !app.classList.contains('hidden');
    const homeVisible = appVisible && !home.classList.contains('hidden');
    document.body.classList.toggle('phone-login-active', loginVisible);
    document.body.classList.toggle('phone-home-active', homeVisible);
    if (!homeVisible) leaveEditMode();
  }

  function decorateButton(button, key) {
    const meta = moduleMeta[key];
    if (!meta || button.dataset.phoneReady === '1') return button;
    button.dataset.phoneReady = '1';
    button.dataset.appKey = key;
    button.dataset.theme = meta.theme;
    button.classList.add('phone-app');
    button.setAttribute('aria-label', meta.label);
    button.insertAdjacentHTML('afterbegin', icon(meta.icon));
    const label = button.querySelector('strong');
    if (label) label.textContent = meta.label;
    return button;
  }

  function keyForModule(button) {
    const title = normalize(button.querySelector('strong')?.textContent);
    return titleKeys.get(title) || '';
  }

  function directPlanningButton(action) {
    const meta = moduleMeta[action];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'module-card phone-direct-app';
    button.innerHTML = `<strong>${meta.label}</strong>`;
    decorateButton(button, action);
    button.addEventListener('click', () => {
      if (home.classList.contains('phone-editing')) return;
      const planningButton = document.querySelector('.phone-app[data-app-key="planning"]');
      planningButton?.click();
      requestAnimationFrame(() => document.querySelector(`[data-planning="${action}"]`)?.click());
    });
    return button;
  }

  function savedLayout() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (value && Array.isArray(value.grid) && Array.isArray(value.dock)) return value;
    } catch {}
    return null;
  }

  function availableApps() {
    return [...grid.querySelectorAll('.phone-app'), ...document.querySelectorAll('#phoneDock .phone-app')];
  }

  function applyLayout(layout = savedLayout()) {
    const dock = document.getElementById('phoneDock');
    if (!dock) return;

    const apps = new Map(availableApps().map(button => [button.dataset.appKey, button]));
    const placed = new Set();
    const dockOrder = layout?.dock?.filter(key => apps.has(key)).slice(0, MAX_DOCK_APPS)
      || defaultDock.filter(key => apps.has(key)).slice(0, MAX_DOCK_APPS);
    const gridOrder = layout?.grid?.filter(key => apps.has(key)) || [];

    for (const key of gridOrder) {
      grid.appendChild(apps.get(key));
      placed.add(key);
    }
    for (const [key, button] of apps) {
      if (!placed.has(key) && !dockOrder.includes(key)) {
        grid.appendChild(button);
        placed.add(key);
      }
    }
    for (const key of dockOrder) {
      dock.appendChild(apps.get(key));
      placed.add(key);
    }
    for (const [key, button] of apps) {
      if (!placed.has(key)) grid.appendChild(button);
    }
  }

  function saveLayout() {
    const dock = document.getElementById('phoneDock');
    if (!dock) return;
    localStorage.setItem(STORAGE, JSON.stringify({
      grid: [...grid.querySelectorAll('.phone-app')].map(button => button.dataset.appKey),
      dock: [...dock.querySelectorAll('.phone-app')].map(button => button.dataset.appKey)
    }));
  }

  function resetLayout() {
    localStorage.removeItem(STORAGE);
    const dock = document.getElementById('phoneDock');
    const apps = availableApps();
    for (const button of apps) grid.appendChild(button);
    for (const key of defaultDock) {
      const button = apps.find(item => item.dataset.appKey === key);
      if (button && dock.children.length < MAX_DOCK_APPS) dock.appendChild(button);
    }
    saveLayout();
  }

  function rebuildApps() {
    if (rebuilding) return;
    const rawButtons = [...grid.querySelectorAll('.module-card:not([data-phone-ready="1"])')];
    if (!rawButtons.length) return;
    rebuilding = true;

    const dock = document.getElementById('phoneDock');
    dock?.replaceChildren();
    grid.querySelectorAll('.phone-direct-app').forEach(button => button.remove());

    for (const button of rawButtons) {
      const key = keyForModule(button);
      if (key) decorateButton(button, key);
    }

    if (grid.querySelector('[data-app-key="planning"]')) {
      for (const action of ['official', 'personal', 'print', 'spirit', 'change']) {
        grid.appendChild(directPlanningButton(action));
      }
    }

    applyLayout();
    rebuilding = false;
  }

  function enterEditMode() {
    home.classList.add('phone-editing');
  }

  function leaveEditMode() {
    if (drag) finishDrag(false);
    home.classList.remove('phone-editing');
  }

  function clearHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
  }

  function beginDrag(item, event) {
    if (drag || !item) return;
    enterEditMode();
    const rect = item.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'phone-app-placeholder';
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    item.before(placeholder);

    drag = {
      item,
      placeholder,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height
    };

    item.classList.add('phone-dragging');
    item.setAttribute('aria-grabbed', 'true');
    Object.assign(item.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    moveDrag(event);
  }

  function dockCountWithoutPlaceholder(dock) {
    return [...dock.children].filter(child => child !== drag?.placeholder).length;
  }

  function movePlaceholder(event) {
    if (!drag) return;
    const dock = document.getElementById('phoneDock');
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetApp = target?.closest?.('.phone-app:not(.phone-dragging)');
    const targetContainer = targetApp?.parentElement || target?.closest?.('.phone-app-grid,.phone-dock');
    if (!targetContainer) return;

    if (targetContainer === dock && drag.placeholder.parentElement !== dock && dockCountWithoutPlaceholder(dock) >= MAX_DOCK_APPS) {
      const displaced = [...dock.querySelectorAll('.phone-app')].at(-1);
      if (displaced) grid.appendChild(displaced);
    }

    if (targetApp) {
      const rect = targetApp.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2 ||
        (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height * .28 && event.clientX < rect.left + rect.width / 2);
      targetContainer.insertBefore(drag.placeholder, before ? targetApp : targetApp.nextSibling);
    } else {
      targetContainer.appendChild(drag.placeholder);
    }
  }

  function moveDrag(event) {
    if (!drag) return;
    drag.item.style.left = `${event.clientX - drag.offsetX}px`;
    drag.item.style.top = `${event.clientY - drag.offsetY}px`;
    movePlaceholder(event);
  }

  function finishDrag(save = true) {
    if (!drag) return;
    const { item, placeholder } = drag;
    placeholder.replaceWith(item);
    item.classList.remove('phone-dragging');
    item.removeAttribute('aria-grabbed');
    item.removeAttribute('style');
    drag = null;
    pointer = null;
    if (save) saveLayout();
  }

  home.addEventListener('click', event => {
    if (home.classList.contains('phone-editing') && event.target.closest('.phone-app')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  home.addEventListener('pointerdown', event => {
    const item = event.target.closest('.phone-app');
    if (!item || event.button !== 0) return;
    clearHold();
    pointer = { item, id: event.pointerId, x: event.clientX, y: event.clientY };
    try { item.setPointerCapture(event.pointerId); } catch {}
    if (home.classList.contains('phone-editing')) {
      beginDrag(item, event);
      event.preventDefault();
      return;
    }
    holdTimer = window.setTimeout(() => beginDrag(item, event), HOLD_DELAY);
  });

  home.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (drag) {
      moveDrag(event);
      event.preventDefault();
      return;
    }
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 9) {
      clearHold();
    }
  });

  function pointerEnd(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    clearHold();
    if (drag) finishDrag(true);
    pointer = null;
  }

  home.addEventListener('pointerup', pointerEnd);
  home.addEventListener('pointercancel', pointerEnd);

  function enableLocalPreview() {
    const preview = new URLSearchParams(location.search).get('phonePreview') === '1';
    if (!preview || !['localhost', '127.0.0.1', 'terminal.local'].includes(location.hostname)) return;

    login.classList.add('hidden');
    app.classList.remove('hidden');
    document.getElementById('welcomeText').textContent = 'Eddy';
    document.getElementById('heroName').textContent = 'Eddy';
    document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
    home.classList.remove('hidden');
    grid.innerHTML = '';

    const previewModules = [
      ['01', 'Planning', 'Officiel · perso · équipe · changements'],
      ['02', 'Équipe & contacts', 'Agents · services · numéros utiles'],
      ['03', 'Procédures', 'Consignes et fiches pratiques'],
      ['04', 'Repères', 'Sites · secteurs · informations terrain'],
      ['05', 'Nouveaux arrivants', 'Les essentiels pour démarrer'],
      ['06', 'Outils équipe', 'Accès rapides et services utiles']
    ];

    for (const [num, title, small] of previewModules) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `module-card${title === 'Planning' ? ' primary' : ''}`;
      button.innerHTML = `<span class="num">${num}</span><strong>${title}</strong><small>${small}</small>`;
      grid.appendChild(button);
    }
  }

  ensureChrome();
  enableLocalPreview();
  rebuildApps();
  refreshMode();
  updateClock();
  window.setInterval(updateClock, 30000);

  new MutationObserver(() => {
    rebuildApps();
    refreshMode();
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
})();
