(() => {
  'use strict';

  const LAYOUT_KEY = 'stip_test_home_layout_v2';
  const WALLPAPER_KEY = 'stip_test_wallpaper_v1';
  const IDEAS_KEY = 'stip_test_ideas_v1';
  const HOLD_DELAY = 480;
  const MAX_DOCK = 4;

  const home = document.getElementById('homeScreen');
  const grid = document.getElementById('appGrid');
  const dock = document.getElementById('dock');
  const appView = document.getElementById('appView');
  const panelTitle = document.getElementById('panelTitle');
  const panelIcon = document.getElementById('panelIcon');
  const panelBody = document.getElementById('panelBody');
  const contextSheet = document.getElementById('contextSheet');
  const wallpaperSheet = document.getElementById('wallpaperSheet');
  const searchSheet = document.getElementById('searchSheet');
  const sheetBackdrop = document.getElementById('sheetBackdrop');
  const toast = document.getElementById('toast');

  const iconPaths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
    personal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="9" cy="15" r="2"/><path d="M13 17c.7-1.8 1.9-2.7 3.5-2.7"/>',
    team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6M14 15c3.8-.3 6 1.4 6.5 5"/>',
    contacts: '<path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M8 2v4M16 2v4"/><circle cx="12" cy="11" r="2.4"/><path d="M7.8 17c.8-2 2.2-3 4.2-3s3.4 1 4.2 3"/>',
    document: '<path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>',
    sparkle: '<path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="M18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
    tools: '<path d="m14.6 6.4 3-3a4 4 0 0 1-5 5L6 15l3 3-2 2-5-5 2-2 3 3 6.6-6.6a4 4 0 0 1 1-3Z"/><path d="m14 14 6 6"/>',
    print: '<path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/><path d="M17 12h.01"/>',
    swap: '<path d="M4 7h13l-3-3M20 17H7l3 3"/><path d="m17 4 3 3-3 3M7 14l-3 3 3 3"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z"/><path d="M12 2V.5M4.9 4.9 3.8 3.8M19.1 4.9l1.1-1.1"/>'
  };

  const apps = [
    { key: 'planning', label: 'Planning', title: 'Planning collectif', theme: 'blue', icon: 'calendar', description: 'Voir le rythme de toute l’équipe, sans ouvrir plusieurs outils.' },
    { key: 'personal', label: 'Mon planning', title: 'Mon planning', theme: 'cyan', icon: 'personal', description: 'Retrouver tes journées, horaires et prochains changements.' },
    { key: 'team', label: 'Équipe du jour', title: 'Équipe du jour', theme: 'purple', icon: 'team', description: 'Savoir immédiatement qui est présent et sur quel poste.' },
    { key: 'contacts', label: 'Contacts', title: 'Contacts', theme: 'mint', icon: 'contacts', description: 'Trouver une personne ou un service en quelques secondes.' },
    { key: 'procedures', label: 'Procédures', title: 'Procédures', theme: 'navy', icon: 'document', description: 'Accéder aux consignes utiles, classées par situation.' },
    { key: 'landmarks', label: 'Repères', title: 'Repères terrain', theme: 'coral', icon: 'pin', description: 'Visualiser les sites, secteurs et points importants.' },
    { key: 'newcomers', label: 'Nouveaux', title: 'Nouveaux arrivants', theme: 'lime', icon: 'sparkle', description: 'Suivre un parcours d’intégration simple et rassurant.' },
    { key: 'tools', label: 'Outils', title: 'Outils équipe', theme: 'navy', icon: 'tools', description: 'Regrouper les raccourcis vraiment utilisés au quotidien.' },
    { key: 'print', label: 'Imprimer', title: 'Imprimer mon planning', theme: 'sun', icon: 'print', description: 'Préparer une version propre à imprimer ou conserver.' },
    { key: 'swap', label: 'Échanger', title: 'Demande de changement', theme: 'rose', icon: 'swap', description: 'Préparer un échange de journée sans perdre d’information.' },
    { key: 'ideas', label: 'Idées', title: 'Boîte à idées', theme: 'purple', icon: 'bulb', description: 'Tester un espace très simple pour proposer une amélioration.' }
  ];

  const defaultDock = ['personal', 'team', 'contacts', 'swap'];
  const defaultGrid = apps.map(app => app.key).filter(key => !defaultDock.includes(key));
  const appByKey = new Map(apps.map(app => [app.key, app]));
  let activeKey = '';
  let contextKey = '';
  let pointerState = null;
  let holdTimer = 0;
  let dragState = null;
  let toastTimer = 0;

  function iconMarkup(app) {
    return `<span class="app-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPaths[app.icon]}</svg></span>`;
  }

  function createAppButton(key) {
    const app = appByKey.get(key);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-button';
    button.dataset.app = key;
    button.dataset.theme = app.theme;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', `${app.title}. Maintenir pour les options.`);
    button.innerHTML = `${iconMarkup(app)}<span class="app-label">${app.label}</span>`;
    return button;
  }

  function readLayout() {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
      if (!saved || !Array.isArray(saved.grid) || !Array.isArray(saved.dock)) return null;
      const known = new Set(apps.map(app => app.key));
      const dockKeys = saved.dock.filter((key, index, list) => known.has(key) && list.indexOf(key) === index).slice(0, MAX_DOCK);
      const gridKeys = saved.grid.filter((key, index, list) => known.has(key) && !dockKeys.includes(key) && list.indexOf(key) === index);
      for (const key of known) if (!dockKeys.includes(key) && !gridKeys.includes(key)) gridKeys.push(key);
      return { grid: gridKeys, dock: dockKeys };
    } catch {
      return null;
    }
  }

  function currentLayout() {
    return {
      grid: [...grid.querySelectorAll('.app-button')].map(button => button.dataset.app),
      dock: [...dock.querySelectorAll('.app-button')].map(button => button.dataset.app)
    };
  }

  function saveLayout() {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(currentLayout()));
  }

  function renderHome(layout = readLayout() || { grid: defaultGrid, dock: defaultDock }) {
    grid.replaceChildren(...layout.grid.map(createAppButton));
    dock.replaceChildren(...layout.dock.map(createAppButton));
  }

  function resetHome() {
    localStorage.removeItem(LAYOUT_KEY);
    renderHome({ grid: defaultGrid, dock: defaultDock });
    showToast('Disposition d’origine restaurée');
  }

  function updateClock() {
    const now = new Date();
    document.getElementById('statusTime').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('todayDay').textContent = now.toLocaleDateString('fr-FR', { day: '2-digit' });
    document.getElementById('todayMonth').textContent = now.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2100);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function enterEditMode() {
    home.classList.add('editing');
    navigator.vibrate?.(12);
  }

  function leaveEditMode() {
    if (dragState) finishDrag(true);
    home.classList.remove('editing');
    closeSheets();
  }

  function openSheet(sheet) {
    closeSheets(false);
    sheetBackdrop.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => sheet.classList.add('open'));
  }

  function closeSheets(hideBackdrop = true) {
    for (const sheet of [contextSheet, wallpaperSheet, searchSheet]) {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    }
    if (hideBackdrop) window.setTimeout(() => {
      if (![contextSheet, wallpaperSheet, searchSheet].some(sheet => sheet.classList.contains('open'))) sheetBackdrop.hidden = true;
    }, 310);
  }

  function openContext(key) {
    const app = appByKey.get(key);
    if (!app) return;
    contextKey = key;
    document.getElementById('contextIcon').innerHTML = iconMarkup(app);
    document.getElementById('contextIcon').dataset.theme = app.theme;
    const contextApp = document.querySelector('.context-app');
    contextApp.dataset.theme = app.theme;
    document.getElementById('contextTitle').textContent = app.title;
    document.getElementById('dockActionLabel').textContent = dock.querySelector(`[data-app="${key}"]`) ? 'Retirer du Dock' : 'Ajouter au Dock';
    openSheet(contextSheet);
  }

  function toggleDock(key) {
    const button = document.querySelector(`.app-button[data-app="${key}"]`);
    if (!button) return;
    if (button.parentElement === dock) {
      grid.appendChild(button);
      showToast('Application retirée du Dock');
    } else {
      if (dock.querySelectorAll('.app-button').length >= MAX_DOCK) {
        const displaced = dock.querySelector('.app-button:last-of-type');
        if (displaced) grid.appendChild(displaced);
      }
      dock.appendChild(button);
      showToast('Application ajoutée au Dock');
    }
    saveLayout();
  }

  function panelTemplate(key) {
    if (key === 'planning') return `
      <section class="panel-hero"><small>VUE COLLECTIVE · SEMAINE 34</small><h3>L’équipe est alignée.</h3><p>Présences, relèves et informations utiles réunies dans une seule lecture.</p></section>
      <div class="stat-grid"><div class="stat-card"><strong>18</strong><span>agents</span></div><div class="stat-card"><strong>3</strong><span>équipes</span></div><div class="stat-card"><strong>2</strong><span>alertes</span></div></div>
      <section class="panel-section"><div class="section-title"><h3>Prochaines relèves</h3><span>Aujourd’hui</span></div><div class="timeline">
        <div class="timeline-row"><span class="timeline-time">06:30<small>matin</small></span><span class="timeline-main"><strong>Prise de poste J4</strong><small>Hall principal · 6 agents</small></span><span class="shift-badge">J4</span></div>
        <div class="timeline-row"><span class="timeline-time">13:15<small>midi</small></span><span class="timeline-main"><strong>Brief secteur Est</strong><small>Salle opérationnelle</small></span><span class="shift-badge sun">INFO</span></div>
        <div class="timeline-row"><span class="timeline-time">18:30<small>soir</small></span><span class="timeline-main"><strong>Relève S2</strong><small>Équipe complète</small></span><span class="shift-badge blue">S2</span></div>
      </div></section>`;

    if (key === 'personal') return `
      <section class="panel-hero"><small>MON PROCHAIN SERVICE</small><h3>J4 · 06:30 — 18:30</h3><p>Mercredi 19 août · secteur principal. Aucun changement en attente.</p></section>
      <div class="stat-grid"><div class="stat-card"><strong>12h</strong><span>prochain service</span></div><div class="stat-card"><strong>4</strong><span>jours ce mois</span></div><div class="stat-card"><strong>0</strong><span>demande</span></div></div>
      <section class="panel-section"><div class="section-title"><h3>À venir</h3><span>Août</span></div><div class="timeline">
        <div class="timeline-row"><span class="timeline-time">19<small>mer.</small></span><span class="timeline-main"><strong>Journée J4</strong><small>06:30 — 18:30</small></span><span class="shift-badge">J4</span></div>
        <div class="timeline-row"><span class="timeline-time">22<small>sam.</small></span><span class="timeline-main"><strong>Soirée S2</strong><small>18:30 — 06:30</small></span><span class="shift-badge blue">S2</span></div>
        <div class="timeline-row"><span class="timeline-time">25<small>mar.</small></span><span class="timeline-main"><strong>Repos</strong><small>Journée libre</small></span><span class="shift-badge sun">RH</span></div>
      </div><button class="secondary-action" data-demo-action="agenda">Ajouter à mon agenda</button></section>`;

    if (key === 'team') return `
      <section class="panel-hero"><small>ÉQUIPE J4 · EN DIRECT</small><h3>6 agents présents</h3><p>La relève est complète. Une formation est prévue à 13:15.</p><div class="avatar-row"><span class="avatar">ED</span><span class="avatar">LM</span><span class="avatar">NK</span><span class="avatar">SB</span><span class="avatar more">+2</span></div></section>
      <section class="panel-section"><div class="section-title"><h3>Répartition</h3><span>Mise à jour 09:42</span></div><div class="card-list">
        <div class="list-card"><span class="contact-avatar">ED</span><span><strong>Eddy D.</strong><small>Poste principal · référent</small></span><span class="shift-badge">J4</span></div>
        <div class="list-card"><span class="contact-avatar">LM</span><span><strong>Lina M.</strong><small>Secteur Est</small></span><span class="shift-badge">J4</span></div>
        <div class="list-card"><span class="contact-avatar">NK</span><span><strong>Nassim K.</strong><small>Accueil · renfort</small></span><span class="shift-badge sun">R</span></div>
      </div></section>`;

    if (key === 'contacts') return `
      <label class="contact-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input id="contactDemoSearch" type="search" autocomplete="off" placeholder="Nom, rôle ou service…"></label>
      <section class="progress-card" id="contactDemoList">
        <div class="contact-row" data-contact="lina cheffe equipe"><span class="contact-avatar">LM</span><span><strong>Lina Martin</strong><small>Cheffe d’équipe</small></span><button data-demo-action="contact">Appeler</button></div>
        <div class="contact-row" data-contact="nassim agent secteur est"><span class="contact-avatar">NK</span><span><strong>Nassim K.</strong><small>Agent · secteur Est</small></span><button data-demo-action="contact">Message</button></div>
        <div class="contact-row" data-contact="poste securite urgence"><span class="contact-avatar">PS</span><span><strong>Poste sécurité</strong><small>Service · 24 h / 24</small></span><button data-demo-action="contact">Appeler</button></div>
        <div class="contact-row" data-contact="administration planning"><span class="contact-avatar">AP</span><span><strong>Administration</strong><small>Planning et absences</small></span><button data-demo-action="contact">Mail</button></div>
      </section>`;

    if (key === 'procedures') return `
      <section class="panel-hero"><small>BASE OPÉRATIONNELLE</small><h3>La bonne fiche, au bon moment.</h3><p>Les procédures peuvent devenir courtes, recherchables et adaptées au terrain.</p></section>
      <section class="panel-section"><div class="progress-card"><div class="progress-top"><span>Fiches lues récemment</span><span>72 %</span></div><div class="progress-bar"><i></i></div></div></section>
      <section class="panel-section"><div class="section-title"><h3>Les plus utiles</h3><span>12 fiches</span></div><div class="progress-card">
        <button class="procedure-row" data-demo-action="procedure"><span>01</span><span><strong>Prise de poste</strong><small>Checklist · 3 min</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
        <button class="procedure-row" data-demo-action="procedure"><span>02</span><span><strong>Incident et remontée</strong><small>Réflexes · contacts</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
        <button class="procedure-row" data-demo-action="procedure"><span>03</span><span><strong>Fin de service</strong><small>Transmission · contrôle</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
      </div></section>`;

    if (key === 'landmarks') return `
      <section class="mini-map" aria-label="Carte fictive"><span class="map-pin one"><i></i></span><span class="map-pin two"><i></i></span><span class="map-pin three"><i></i></span></section>
      <section class="panel-section"><div class="section-title"><h3>Points utiles</h3><span>À proximité</span></div><div class="card-list">
        <button class="location-chip" data-demo-action="location"><span>Poste principal</span><small>2 min</small></button>
        <button class="location-chip" data-demo-action="location"><span>Salle opérationnelle</span><small>5 min</small></button>
        <button class="location-chip" data-demo-action="location"><span>Point de relève Est</span><small>8 min</small></button>
      </div></section>`;

    if (key === 'newcomers') return `
      <section class="onboarding"><div class="progress-ring"><strong>72 %</strong></div><div><h3>Parcours d’intégration</h3><p>Un fil conducteur simple : repères, personnes, gestes essentiels et suivi.</p></div></section>
      <section class="panel-section"><div class="section-title"><h3>Prochaines étapes</h3><span>3 restantes</span></div><div class="progress-card">
        <div class="procedure-row"><span>✓</span><span><strong>Découvrir l’équipe</strong><small>Terminé hier</small></span><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></div>
        <button class="procedure-row" data-demo-action="onboarding"><span>02</span><span><strong>Faire le tour du secteur</strong><small>Prévu aujourd’hui · 14:00</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
        <button class="procedure-row" data-demo-action="onboarding"><span>03</span><span><strong>Valider les essentiels</strong><small>Avec le référent</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
      </div></section>`;

    if (key === 'tools') return `
      <section class="panel-hero"><small>RACCOURCIS DU QUOTIDIEN</small><h3>Moins chercher. Plus agir.</h3><p>Les outils fréquents pourraient tenir dans une seule poche.</p></section>
      <section class="panel-section"><div class="tool-grid">
        <button class="tool-card" data-demo-action="tool"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg><span><strong>Main courante</strong><small>Ouvrir</small></span></button>
        <button class="tool-card" data-demo-action="tool"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg><span><strong>Compteur horaire</strong><small>Calculer</small></span></button>
        <button class="tool-card" data-demo-action="tool"><svg viewBox="0 0 24 24"><path d="M4 19V8l8-5 8 5v11M8 19v-6h8v6"/></svg><span><strong>Sites utiles</strong><small>4 liens</small></span></button>
        <button class="tool-card" data-demo-action="tool"><svg viewBox="0 0 24 24"><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/></svg><span><strong>Formulaires</strong><small>Accéder</small></span></button>
      </div></section>`;

    if (key === 'print') return `
      <section class="print-sheet"><header><div><h3>Planning personnel</h3><small>Eddy · Août 2026</small></div><small>STIP</small></header>
        <div class="print-row"><span>Mer. 19</span><strong>06:30 — 18:30</strong><span>J4</span></div><div class="print-row"><span>Sam. 22</span><strong>18:30 — 06:30</strong><span>S2</span></div><div class="print-row"><span>Mar. 25</span><strong>Repos</strong><span>RH</span></div><div class="print-row"><span>Jeu. 27</span><strong>06:30 — 18:30</strong><span>J4</span></div>
      </section><button class="primary-action" data-demo-action="print">Préparer le PDF</button><button class="secondary-action" data-demo-action="print">Choisir une période</button>`;

    if (key === 'swap') return `
      <section class="simulation-note"><strong>Simulation uniquement.</strong> Aucun changement ne sera enregistré ou envoyé depuis cette page de test.</section>
      <form class="demo-form" id="swapDemoForm"><label>Journée concernée<select required><option>Mercredi 19 août · J4</option><option>Samedi 22 août · S2</option></select></label><label>Je souhaite<select required><option>Échanger cette journée</option><option>Demander un changement</option><option>Signaler une disponibilité</option></select></label><label>Avec qui ?<select><option>À proposer à l’équipe</option><option>Lina Martin</option><option>Nassim K.</option></select></label><label>Message facultatif<textarea placeholder="Ajouter une précision…"></textarea></label><button class="primary-action" type="submit">Simuler l’envoi</button></form>`;

    return `
      <section class="panel-hero"><small>LABORATOIRE D’IDÉES</small><h3>Et si STIP évoluait avec l’équipe ?</h3><p>Écris une idée. Elle reste uniquement sur cet appareil pendant la démonstration.</p></section>
      <form class="demo-form panel-section" id="ideaDemoForm"><label>Mon idée<input id="ideaInput" maxlength="80" required placeholder="Ex. Un rappel avant ma relève"></label><button class="primary-action" type="submit">Ajouter à la maquette</button></form>
      <div class="idea-list" id="ideaList"></div>`;
  }

  function openApp(key) {
    const app = appByKey.get(key);
    if (!app) return;
    activeKey = key;
    closeSheets();
    panelTitle.textContent = app.title;
    panelIcon.innerHTML = iconMarkup(app);
    panelIcon.dataset.theme = app.theme;
    panelBody.innerHTML = panelTemplate(key);
    wirePanelInteractions(key);
    home.classList.add('panel-open');
    appView.classList.add('open');
    appView.setAttribute('aria-hidden', 'false');
    panelBody.scrollTop = 0;
    navigator.vibrate?.(8);
  }

  function closeApp() {
    if (!appView.classList.contains('open')) return;
    appView.classList.remove('open');
    appView.setAttribute('aria-hidden', 'true');
    home.classList.remove('panel-open');
    window.setTimeout(() => { if (!appView.classList.contains('open')) panelBody.replaceChildren(); }, 470);
  }

  function storedIdeas() {
    try {
      const values = JSON.parse(localStorage.getItem(IDEAS_KEY) || '[]');
      return Array.isArray(values) ? values.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  function renderIdeas() {
    const list = document.getElementById('ideaList');
    if (!list) return;
    const values = storedIdeas();
    list.innerHTML = values.length ? values.map((idea, index) => `<div class="idea-card"><span>${index + 1}</span><div><strong>${escapeHtml(idea)}</strong><small>Conservée sur cet appareil · démo</small></div></div>`).join('') : '<div class="simulation-note">Aucune idée ajoutée pour le moment.</div>';
  }

  function wirePanelInteractions(key) {
    panelBody.querySelectorAll('[data-demo-action]').forEach(button => button.addEventListener('click', () => showToast('Action simulée · rien n’est envoyé')));

    const contactSearch = document.getElementById('contactDemoSearch');
    contactSearch?.addEventListener('input', () => {
      const query = contactSearch.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      document.querySelectorAll('[data-contact]').forEach(row => {
        row.hidden = query && !row.dataset.contact.includes(query);
      });
    });

    document.getElementById('swapDemoForm')?.addEventListener('submit', event => {
      event.preventDefault();
      showToast('Demande simulée · aucun envoi réel');
    });

    if (key === 'ideas') {
      renderIdeas();
      document.getElementById('ideaDemoForm')?.addEventListener('submit', event => {
        event.preventDefault();
        const input = document.getElementById('ideaInput');
        const idea = input.value.trim();
        if (!idea) return;
        const values = [idea, ...storedIdeas().filter(value => value !== idea)].slice(0, 5);
        localStorage.setItem(IDEAS_KEY, JSON.stringify(values));
        input.value = '';
        renderIdeas();
        showToast('Idée ajoutée localement à la maquette');
      });
    }
  }

  function openWallpaperPicker() {
    const selected = document.body.dataset.wallpaper;
    document.querySelectorAll('[data-wallpaper-option]').forEach(button => button.classList.toggle('active', button.dataset.wallpaperOption === selected));
    openSheet(wallpaperSheet);
  }

  function applyWallpaper(value) {
    if (!['aurora', 'sunset', 'forest', 'midnight'].includes(value)) return;
    document.body.dataset.wallpaper = value;
    localStorage.setItem(WALLPAPER_KEY, value);
    document.querySelectorAll('[data-wallpaper-option]').forEach(button => button.classList.toggle('active', button.dataset.wallpaperOption === value));
    showToast('Fond d’écran appliqué');
  }

  function renderSearchResults(query = '') {
    const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const matches = apps.filter(app => `${app.label} ${app.title} ${app.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized));
    document.getElementById('searchResults').innerHTML = matches.map(app => `<button class="search-result" type="button" data-search-app="${app.key}" data-theme="${app.theme}">${iconMarkup(app)}<span><strong>${app.title}</strong><small>${app.description}</small></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>`).join('') || '<div class="simulation-note">Aucune application ne correspond.</div>';
  }

  function openSearch() {
    const input = document.getElementById('appSearchInput');
    input.value = '';
    renderSearchResults();
    openSheet(searchSheet);
    window.setTimeout(() => input.focus(), 330);
  }

  function clearHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = 0;
  }

  function beginDrag(button, event) {
    if (dragState || !button) return;
    closeSheets();
    enterEditMode();
    const rect = button.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'drop-placeholder';
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    button.before(placeholder);
    dragState = {
      button,
      placeholder,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    button.classList.add('dragging');
    button.setAttribute('aria-grabbed', 'true');
    Object.assign(button.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    moveDrag(event);
  }

  function movePlaceholder(event) {
    if (!dragState) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetButton = target?.closest?.('.app-button:not(.dragging)');
    const container = targetButton?.parentElement || target?.closest?.('.app-grid,.dock');
    if (!container) return;

    if (container === dock && dragState.placeholder.parentElement !== dock && dock.querySelectorAll('.app-button').length >= MAX_DOCK) {
      const displaced = dock.querySelector('.app-button:last-of-type');
      if (displaced) grid.appendChild(displaced);
    }

    if (targetButton) {
      const rect = targetButton.getBoundingClientRect();
      const sameRow = Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height * .33;
      const before = sameRow ? event.clientX < rect.left + rect.width / 2 : event.clientY < rect.top + rect.height / 2;
      container.insertBefore(dragState.placeholder, before ? targetButton : targetButton.nextSibling);
    } else {
      container.appendChild(dragState.placeholder);
    }
  }

  function moveDrag(event) {
    if (!dragState) return;
    dragState.button.style.left = `${event.clientX - dragState.offsetX}px`;
    dragState.button.style.top = `${event.clientY - dragState.offsetY}px`;
    movePlaceholder(event);
  }

  function finishDrag(shouldSave) {
    if (!dragState) return;
    const { button, placeholder } = dragState;
    placeholder.replaceWith(button);
    button.classList.remove('dragging');
    button.removeAttribute('aria-grabbed');
    button.removeAttribute('style');
    dragState = null;
    pointerState = null;
    if (shouldSave) saveLayout();
  }

  home.addEventListener('click', event => {
    const button = event.target.closest('.app-button');
    if (!button) return;
    if (home.classList.contains('editing')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    openApp(button.dataset.app);
  }, true);

  home.addEventListener('contextmenu', event => {
    const button = event.target.closest('.app-button');
    if (!button) return;
    event.preventDefault();
    enterEditMode();
    openContext(button.dataset.app);
  });

  home.addEventListener('pointerdown', event => {
    const button = event.target.closest('.app-button');
    if (!button || event.button !== 0) return;
    clearHold();
    pointerState = { button, id: event.pointerId, x: event.clientX, y: event.clientY, held: false };
    try { button.setPointerCapture(event.pointerId); } catch {}
    if (home.classList.contains('editing')) {
      beginDrag(button, event);
      event.preventDefault();
      return;
    }
    holdTimer = window.setTimeout(() => {
      if (!pointerState || pointerState.id !== event.pointerId) return;
      pointerState.held = true;
      enterEditMode();
      openContext(button.dataset.app);
    }, HOLD_DELAY);
  });

  home.addEventListener('pointermove', event => {
    if (!pointerState || pointerState.id !== event.pointerId) return;
    if (dragState) {
      moveDrag(event);
      event.preventDefault();
      return;
    }
    if (pointerState.held && Math.hypot(event.clientX - pointerState.x, event.clientY - pointerState.y) > 4) {
      beginDrag(pointerState.button, event);
      event.preventDefault();
      return;
    }
    if (Math.hypot(event.clientX - pointerState.x, event.clientY - pointerState.y) > 9) clearHold();
  });

  function pointerEnd(event) {
    if (!pointerState || pointerState.id !== event.pointerId) return;
    clearHold();
    if (dragState) finishDrag(true);
    pointerState = null;
  }

  home.addEventListener('pointerup', pointerEnd);
  home.addEventListener('pointercancel', pointerEnd);

  document.getElementById('editButton').addEventListener('click', enterEditMode);
  document.getElementById('doneButton').addEventListener('click', leaveEditMode);
  document.getElementById('resetButton').addEventListener('click', resetHome);
  document.getElementById('wallpaperButton').addEventListener('click', openWallpaperPicker);
  document.getElementById('searchButton').addEventListener('click', openSearch);
  document.getElementById('appClose').addEventListener('click', closeApp);
  document.getElementById('appMore').addEventListener('click', () => activeKey && openContext(activeKey));
  document.querySelector('[data-open-app="team"]').addEventListener('click', () => openApp('team'));

  document.getElementById('homeIndicator').addEventListener('click', () => {
    if (appView.classList.contains('open')) closeApp();
    else if (home.classList.contains('editing')) leaveEditMode();
    else closeSheets();
  });

  sheetBackdrop.addEventListener('click', closeSheets);
  document.querySelectorAll('[data-close-sheet]').forEach(button => button.addEventListener('click', closeSheets));
  document.querySelectorAll('[data-wallpaper-option]').forEach(button => button.addEventListener('click', () => applyWallpaper(button.dataset.wallpaperOption)));
  document.getElementById('appSearchInput').addEventListener('input', event => renderSearchResults(event.target.value));
  document.getElementById('searchResults').addEventListener('click', event => {
    const result = event.target.closest('[data-search-app]');
    if (result) openApp(result.dataset.searchApp);
  });

  contextSheet.addEventListener('click', event => {
    const action = event.target.closest('[data-context]')?.dataset.context;
    if (!action) return;
    if (action === 'open') openApp(contextKey);
    if (action === 'dock') { toggleDock(contextKey); closeSheets(); }
    if (action === 'info') showToast(appByKey.get(contextKey)?.description || 'Application STIP');
    if (action === 'cancel') closeSheets();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ([contextSheet, wallpaperSheet, searchSheet].some(sheet => sheet.classList.contains('open'))) closeSheets();
    else if (appView.classList.contains('open')) closeApp();
    else if (home.classList.contains('editing')) leaveEditMode();
  });

  document.body.dataset.wallpaper = localStorage.getItem(WALLPAPER_KEY) || 'aurora';
  renderHome();
  updateClock();
  renderSearchResults();
  window.setInterval(updateClock, 30000);
})();
