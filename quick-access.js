(() => {
  "use strict";
  window.__STIPQuickAccessOwner = "main";
  document.getElementById("stipQuickUniversal")?.remove();
  const CODE_STORE = "stip_access_code_v1",
    USAGE_STORE = "stip_app_usage_v1",
    FAV_STORE = "stip_app_favorites_v1",
    PENDING_STORE = "stip_pending_app_v1",
    $ = (s) => document.querySelector(s);
  const I = {
    fav: '<img src="images/icone_app/quick-rocket.svg?v=20260919-restore1" alt="" aria-hidden="true">',
  };
  function openDocument(url) {
    if (window.STIPLoad?.navigateDocument) {
      window.STIPLoad.navigateDocument(url);
      return;
    }
    location.assign(new URL(url, location.href).href);
  }
  function openResponsable(search = "") {
    const query = String(search || "").replace(/^\?/, "");
    try {
      if (query) sessionStorage.setItem("stip_responsable_entry_search_v1", query);
      else sessionStorage.removeItem("stip_responsable_entry_search_v1");
      sessionStorage.setItem("stip_responsable_fresh_entry_v1", "1");
    } catch {}
    openDocument("responsable.html" + (query ? "?" + query : ""));
  }
  const META = {
    meteo: { label: "Météo", open: () => openDocument("meteo/?__stip_probe=20261014-meteo-fresh2") },
    nouveau: { label: "Le Nouveau", open: () => openDocument("le-nouveau.html?v=20261006-3") },
    personal: {
      label: "Planning perso",
      open: () => window.STIPHubs?.planning?.("personal"),
    },
    tomorrow: {
      label: "Actions",
      open: () => setTimeout(() => window.STIPTomorrowUI?.open?.(), 0),
    },
    meeting_notes: {
      label: "Notes de réunion",
      open: () => openDocument("meeting-notes.html"),
    },
    team: {
      label: "Esprit d’équipe",
      open: () => openDocument("esprit-equipe.html?entry=quick-access"),
    },
    leisure: { label: "Sorties & trajets", open: () => openDocument("sorties-loisirs.html") },
    communication: {
      label: "Communication",
      open: () => window.STIPRouter?.set?.("communication/chat"),
    },
    agents: {
      label: "Équipe",
      open: () => openDocument("agent-directory.html"),
    },
    compare: {
      label: "Comparer les plannings",
      open: () => openDocument("planning-compare-app.html"),
    },
    change: {
      label: "Changement",
      open: () => window.STIPHubs?.planning?.("change"),
    },
    calendar: {
      label: "Synchroniser mon calendrier",
      open: () => window.STIPHubs?.planning?.("calendar"),
    },
    dates: {
      label: "Date des agents",
      open: () => openDocument("agent-dates.html"),
    },
    contacts: { label: "Contacts", open: () => window.STIPHubs?.contacts?.() },
    places: {
      label: "Visiter les lieux",
      open: () => openDocument("places-app.html"),
    },
    responsable: {
      label: "Responsable",
      open: () => openResponsable("tab=dates&entry=shortcut"),
    },
    resp_tracking: {
      label: "Suivi",
      open: () => openResponsable("tab=suivi"),
    },
    resp_evaluation: {
      label: "Évaluation",
      open: () => openResponsable("tab=equipe&mode=evaluation"),
    },
    resp_official: {
      label: "Extraire un fichier officiel",
      open: () => openResponsable("tab=equipe&tool=official"),
    },
    resp_requests: {
      label: "Demandes",
      open: () => openResponsable("tab=suivi&tool=requests"),
    },
    resp_directory: {
      label: "Équipe du jour",
      open: () => openResponsable("tab=equipe"),
    },
    resp_agenda: {
      label: "Agenda agents",
      open: () => openResponsable("tab=agenda"),
    },
    assistant: {
      label: "Assistant STIP",
      open: () => openDocument("esprit-equipe.html?tab=assistant"),
    },
    activity: {
      label: "Activité",
      open: () => openDocument("esprit-equipe.html?tab=activity"),
    },
    access: {
      label: "Accès & sécurité",
      open: () => openDocument("access-manage.html"),
    },
    newagent: {
      label: "Nouvel agent",
      open: () => (location.href = "https://esapin69.github.io/Ghe-interne/"),
    },
    upload: {
      label: "Importer",
      open: () => (location.href = "https://admin-ghe.esapin.com/depot.html"),
    },
    admin: {
      label: "Admin",
      open: () => (location.href = "https://admin-ghe.esapin.com/"),
    },
  };
  const APP_STORE_COPY = {
    meteo: ["Météo", "Températures, risques de pluie et tendances jusqu’à 35 jours.", "Pratique"],
    personal: ["Planning perso", "Votre planning personnel et vos horaires.", "Organisation"],
    tomorrow: ["Actions", "Préparer et consulter les jours à venir.", "Organisation"],
    meeting_notes: ["Notes de réunion", "Saisir, retrouver et archiver vos notes de réunion personnelles.", "Organisation"],
    team: ["Esprit d’équipe", "Planning d’équipe et outils collectifs.", "Équipe"],
    nouveau: ["Le Nouveau", "Décide de la suite et raconte ta galère : fiction interactive de brancardier.", "Découvrir"],
    leisure: ["Sorties & trajets", "Activités, invitations et covoiturage entre collègues.", "Équipe"],
    communication: ["Communication", "Chat équipe, DM & groupes et Fauteuils.", "Communication"],
    agents: ["Équipe", "Voir les présents, les absents et joindre rapidement un collègue.", "Équipe"],
    compare: ["Comparer les plannings", "Comparer rapidement plusieurs plannings.", "Organisation"],
    change: ["Changement", "Gérer les demandes de changement.", "Organisation"],
    calendar: ["Synchroniser mon calendrier", "Retrouver vos horaires dans votre calendrier.", "Organisation"],
    dates: ["Date des agents", "Consulter les dates utiles de l’équipe.", "Équipe"],
    contacts: ["Contacts", "Annuaire et numéros utiles.", "Communication"],
    places: ["Visiter les lieux", "Repères et informations pour se déplacer.", "Terrain"],
    responsable: ["Responsable", "Dates utiles et espace Responsable.", "Encadrement"],
    resp_tracking: ["Suivi", "Couverture du jour, points à traiter et demandes en cours.", "Responsable"],
    resp_evaluation: ["Évaluation", "Ouvrir ou poursuivre l’évaluation d’un agent.", "Responsable"],
    resp_official: ["Extraire un fichier officiel", "Contrôler puis générer le document officiel.", "Responsable"],
    resp_requests: ["Demandes", "Envoyer une demande ou une information à un agent.", "Responsable"],
    resp_directory: ["Équipe du jour", "Rechercher un agent et ouvrir sa fiche.", "Responsable"],
    resp_agenda: ["Agenda agents", "Consulter et gérer les dates utiles de l’équipe.", "Responsable"],
    assistant: ["Assistant STIP", "Assistant pour les outils et données STIP.", "Outils"],
    activity: ["Activité", "Suivi d’activité pour les profils autorisés.", "Encadrement"],
    access: ["Accès & sécurité", "Profils, droits, historique et contrôle des accès.", "Sécurité"],
    newagent: ["Nouvel agent", "Ressources pour l’arrivée dans l’équipe.", "Découvrir"],
    upload: ["Importer", "Déposer les fichiers autorisés.", "Outils"],
    admin: ["Admin", "Administration réservée aux profils autorisés.", "Administration"],
  };
  let publicPreview = false,
    lastTouch = { key: "", at: 0 };
  function allowed(k) {
    if (!META[k]) return false;
    if (k === "meteo") return !!window.STIPSession || !!localStorage.getItem("stip_session_v1");
    if (k === "nouveau") return !!localStorage.getItem("stip_session_v1");
    const sessionRole = String(
      window.STIPSession?.role_key ||
        window.STIPSession?.profile?.role_key ||
        window.STIPBootCache?.role_key ||
        window.STIPBootCache?.profile?.role_key ||
        "",
    ).toLowerCase();
    if (k === "access" && sessionRole === "chef_equipe") return false;
    const p = window.STIPPreview?.active
      ? { ...(window.STIPSession?.permissions || {}) }
      : {
          ...(window.STIPBootCache?.permissions || {}),
          ...(window.STIPSession?.permissions || {}),
        };
    if (k.startsWith("resp_")) {
      if (!p.responsable) return false;
      if (k === "resp_evaluation" || k === "resp_official")
        return String(p.__levels?.responsable || "visitor").toLowerCase() === "pro";
      return true;
    }
    if (window.STIPAccess?.app) return !!window.STIPAccess.app(k);
    const map = {
        personal: "planning_personal",
        tomorrow: "tomorrow",
        meeting_notes: "meeting_notes",
        team: "planning_team",
        communication: "messages",
        leisure: "messages",
        agents: "agent_directory",
        compare: "planning_team",
        change: "change_app",
        calendar: "calendar_subscribe",
        dates: "agent_dates",
        contacts: "contacts",
        places: "places",
        responsable: "responsable",
        assistant: "assistant_enabled",
        activity: "activity",
        access: "access_manage",
        newagent: "nouveaux_arrivants",
        upload: "file_upload",
        admin: "admin",
      };
    return !!p[map[k]];
  }
  function readUsage() {
    try {
      return JSON.parse(localStorage.getItem(USAGE_STORE) || "{}") || {};
    } catch {
      return {};
    }
  }
  function writeUsage(v) {
    try {
      localStorage.setItem(USAGE_STORE, JSON.stringify(v));
    } catch {}
  }
  function readFav() {
    try {
      const x = JSON.parse(localStorage.getItem(FAV_STORE) || "[]");
      return Array.isArray(x) ? x.filter((k) => META[k]) : [];
    } catch {
      return [];
    }
  }
  function writeFav(v) {
    try {
      localStorage.setItem(
        FAV_STORE,
        JSON.stringify([...new Set(v)].filter((k) => META[k])),
      );
    } catch {}
  }
  const RESPONSABLE_APP_KEYS = [
    "resp_tracking",
    "resp_evaluation",
    "resp_official",
    "resp_requests",
    "resp_directory",
    "resp_agenda",
  ];
  function ensureWeatherApp() {
    if (!allowed("meteo")) return;
    const marker = "stip_weather_app_added_v1";
    try {
      if (localStorage.getItem(marker)) return;
      writeFav(["meteo", ...readFav()]);
      localStorage.setItem(marker, "1");
    } catch {}
  }
  function ensureResponsibleApps() {
    if (!allowed("responsable")) return;
    const marker = "stip_responsable_apps_migrated_v1";
    try {
      if (localStorage.getItem(marker)) return;
      const current = readFav(),
        additions = RESPONSABLE_APP_KEYS.filter(allowed);
      writeFav([...current, ...additions]);
      localStorage.setItem(marker, "1");
    } catch {}
  }
  function touch(key) {
    if (!allowed(key)) return;
    const now = Date.now();
    if (lastTouch.key === key && now - lastTouch.at < 1800) return;
    lastTouch = { key, at: now };
    const u = readUsage(),
      apps = u.apps || {},
      prev = Number(u.at || now),
      days = Math.max(0, (now - prev) / 86400000),
      decay = Math.pow(0.985, days);
    Object.keys(apps).forEach(
      (k) => (apps[k] = Math.max(0, Number(apps[k] || 0) * decay)),
    );
    apps[key] = Number(apps[key] || 0) + 1;
    writeUsage({ at: now, last: key, apps });
  }
  function suggestions() {
    const pinned = new Set(readFav().filter(allowed)),
      scores = readUsage().apps || {};
    return Object.keys(META)
      .filter((k) => allowed(k) && !pinned.has(k))
      .sort(
        (a, b) =>
          Number(scores[b] || 0) - Number(scores[a] || 0) ||
          META[a].label.localeCompare(META[b].label, "fr"),
      )
      .slice(0, 3);
  }
  function routeKey(route) {
    route = String(route || "");
    if (
      route === "fauteuils" ||
      route === "communication" ||
      route.startsWith("communication/")
    )
      return "communication";
    if (route.startsWith("planning/personal")) return "personal";
    if (route === "team") return "team";
    if (
      route.startsWith("planning/team") ||
      route.startsWith("planning/spirit")
    )
      return "team";
    if (route.startsWith("planning/change")) return "change";
    if (route.startsWith("planning/calendar")) return "calendar";
    if (route.startsWith("contacts")) return "contacts";
    return "";
  }
  function prepareCode() {
    const i = $("#accessCode");
    if (!i) return;
    const saved = String(localStorage.getItem(CODE_STORE) || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    i.setAttribute("pattern", "[0-9]{6}");
    i.maxLength = 6;
    i.classList.remove("stip-code-visible");
    if (saved && !String(i.value || "").replace(/\D/g, "")) {
      i.value = saved;
      i.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function saveCode() {
    const i = $("#accessCode"),
      d = String(i?.value || "")
        .replace(/\D/g, "")
        .slice(0, 6);
    if (d.length === 6)
      try {
        localStorage.setItem(CODE_STORE, d);
      } catch {}
  }
  function closeFavorites() {
    document.getElementById("stipFavoritesPanel")?.remove();
    document.body.classList.remove("stip-favorites-open");
  }
  function favRow(k, pinned) {
    return `<div class="stip-fav-row"><button type="button" class="stip-fav-open" data-fav-open="${k}"><span class="stip-fav-info">${appStoreIcon(k)}<span class="stip-fav-name">${META[k].label}</span></span><b>›</b></button><button type="button" class="stip-fav-pin ${pinned ? "is-pinned" : ""}" data-fav-pin="${k}" aria-label="${pinned ? "Retirer des favoris" : "Ajouter aux favoris"}">${pinned ? "★" : "☆"}</button></div>`;
  }
  function favoriteFeedback(text) {
    requestAnimationFrame(() => {
      const sheet = document.querySelector(".stip-fav-sheet");
      if (!sheet) return;
      const note = document.createElement("div");
      note.className = "stip-fav-feedback";
      note.setAttribute("role", "status");
      note.textContent = text;
      sheet.querySelector(".stip-fav-feedback")?.remove();
      sheet.querySelector("header")?.insertAdjacentElement("afterend", note);
      setTimeout(() => note.remove(), 1300);
    });
  }
  const APP_ICON = {
    meteo: '<img src="images/icone_app/illustration-meteo.svg?v=20261014-illustrated1" alt="" aria-hidden="true">',
    nouveau: '<img src="images/icone_app/illustration-nouveau.svg?v=20261014-illustrated1" alt="" aria-hidden="true">',
    places: '<img src="images/icone_app/illustration-lieux.svg?v=20261014-illustrated1" alt="" aria-hidden="true">',
    personal: '<img src="images/icone_app/ghe-personal-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    tomorrow: '<img src="images/icone_app/ghe-tomorrow-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    dialog: '<img src="images/icone_app/ghe-dialog-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    communication: '<img src="images/icone_app/ghe-communication-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    team: '<img src="images/icone_app/ghe-team-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    agents: '<img src="images/icone_app/ghe-agents-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    compare: '<img src="images/icone_app/ghe-compare-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    change: '<img src="images/icone_app/ghe-change-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    calendar: '<img src="images/icone_app/ghe-calendar-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    dates: '<img src="images/icone_app/ghe-dates-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    contacts: '<img src="images/icone_app/ghe-contacts-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    leisure: '<img src="images/icone_app/ghe-leisure-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    meeting_notes: '<img src="images/icone_app/ghe-meeting_notes-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    notes: '<img src="images/icone_app/ghe-notes-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    responsable: '<img src="images/icone_app/ghe-responsable-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    resp_tracking: '<img src="images/icone_app/ghe-resp_tracking-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    resp_evaluation: '<img src="images/icone_app/ghe-resp_evaluation-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    resp_official: '<img src="images/icone_app/ghe-resp_official-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    resp_requests: '<img src="images/icone_app/ghe-resp_requests-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    resp_directory: '<img src="images/icone_app/ghe-resp_directory-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    resp_agenda: '<img src="images/icone_app/ghe-resp_agenda-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    assistant: '<img src="images/icone_app/ghe-assistant-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    activity: '<img src="images/icone_app/ghe-activity-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    newagent: '<img src="images/icone_app/ghe-newagent-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    profile_photo: '<img src="images/icone_app/ghe-profile_photo-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    upload: '<img src="images/icone_app/ghe-upload-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    admin: '<img src="images/icone_app/ghe-admin-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
    access: '<img src="images/icone_app/ghe-access-v2.svg?v=20261014-illustrated2" alt="" aria-hidden="true">',
  };
  function appStoreIcon(k) {
    const art = APP_ICON[k];
    if (art) return `<span class="stip-store-icon stip-store-icon-${k} is-illustrated">${art}</span>`;
    const fallback = (META[k]?.label || k).trim().charAt(0).toUpperCase();
    return `<span class="stip-store-icon stip-store-icon-${k}">${fallback}</span>`;
  }
  function storeCard(k, added) {
    const meta = APP_STORE_COPY[k] || [META[k].label, "Application STIP", "STIP"];
    return `<article class="stip-store-card ${added ? "is-selected" : ""}"><button type="button" class="stip-store-main" data-store-open="${k}">${appStoreIcon(k)}<span><small>${meta[2]}</small><strong>${meta[0]}</strong><em>${meta[1]}</em></span></button><button type="button" class="stip-store-add ${added ? "is-added" : ""}" data-store-toggle="${k}" aria-label="${added ? "Retirer " : "Ajouter "}${meta[0]}"><span aria-hidden="true">${added ? "−" : "+"}</span><strong>${added ? "Retirer" : "Ajouter"}</strong></button></article>`;
  }
  // The app catalogue is the only source for both the library and its search.
  function matchesAppSearch(key, query) {
    const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
    const term = normalize(query);
    if (!term) return true;
    const related = key === "leisure"
      ? "proposer activité activite sortie sorties loisirs sport muscu rendez-vous collègues collegues invitation covoiturage trajet trajets voiture"
      : "";
    return normalize([META[key]?.label, ...(APP_STORE_COPY[key] || []), related].join(" ")).includes(term);
  }
  function appSearchMarkup() {
    return '<label class="stip-app-search"><span class="stip-app-search-glass" aria-hidden="true"></span>' +
      '<input type="search" data-app-search aria-label="Rechercher une application" placeholder="Rechercher une application…" autocomplete="off" enterkeyhint="search"></label>';
  }
  function renderStore(host) {
    const chosen = readFav().filter(allowed), all = Object.keys(META).filter(allowed);
    host.innerHTML = '<section class="stip-app-store"><header><button type="button" class="stip-store-back" data-store-back aria-label="Retour à mes applications">‹</button>' +
      '<div><small>STIP</small><h2>Applications</h2><p>Choisissez les outils à afficher sur votre écran.</p></div></header>' +
      appSearchMarkup() +
      '<div class="stip-store-list" data-store-list></div></section>';
    const input = host.querySelector("[data-app-search]");
    const list = host.querySelector("[data-store-list]");
    function paintStore() {
      const found = all.filter((key) => matchesAppSearch(key, input.value));
      list.innerHTML = found.length
        ? found.map((key) => storeCard(key, chosen.includes(key))).join("")
        : '<p class="stip-app-grid-empty">Aucune application trouvée.</p>';
    }
    paintStore();
    input.addEventListener("input", paintStore);
    host.querySelector("[data-store-back]")?.addEventListener("click", () => renderApps(host));
    list.addEventListener("click", (event) => {
      const open = event.target.closest("[data-store-open]");
      const toggle = event.target.closest("[data-store-toggle]");
      if (open) { openKey(open.dataset.storeOpen); return; }
      if (!toggle) return;
      const key = toggle.dataset.storeToggle, favorites = readFav(), adding = !favorites.includes(key);
      writeFav(adding ? [...favorites, key] : favorites.filter((x) => x !== key));
      const query = input.value;
      renderStore(host);
      const nextInput = host.querySelector("[data-app-search]");
      nextInput.value = query;
      nextInput.dispatchEvent(new Event("input"));
    });
  }
  function renderApps(host) {
    if (!host) return;
    ensureWeatherApp();
    ensureResponsibleApps();
    const chosen = readFav().filter(allowed);
    const all = Object.keys(META).filter(allowed);
    const createAction = allowed("leisure")
      ? '<button type="button" class="stip-app-propose" data-app-create-leisure>' +
          appStoreIcon("leisure") + '<span><strong>Proposer une sortie</strong><small>Inviter des collègues à une activité</small></span><b aria-hidden="true">›</b></button>'
      : "";
    host.innerHTML = '<section class="stip-my-apps"><header><div><small>MES APPLICATIONS</small><h2>Applications</h2></div>' +
      '<button type="button" class="stip-store-browse stip-store-browse-add" data-store-browse aria-label="Ajouter une application">' +
      '<span class="stip-store-browse-plus" aria-hidden="true"></span><strong>Ajouter</strong></button></header>' +
      appSearchMarkup() + createAction +
      '<div class="stip-my-app-grid" data-my-app-grid></div></section>';
    const input = host.querySelector("[data-app-search]");
    const grid = host.querySelector("[data-my-app-grid]");
    function paintApps() {
      const term = input.value.trim();
      const found = term ? all.filter((key) => matchesAppSearch(key, term)) : chosen;
      grid.innerHTML = found.length
        ? found.map((key) => '<button type="button" class="stip-my-app" data-my-app="' + key + '">' +
            appStoreIcon(key) + '<strong>' + META[key].label + '</strong>' +
            (term && !chosen.includes(key) ? '<small class="stip-app-result-note">Disponible</small>' : '') + '</button>').join("")
        : '<p class="stip-app-grid-empty">' +
            (term ? 'Aucune application trouvée.' : 'Aucune application ajoutée. Utilisez « Ajouter » pour choisir vos outils.') + '</p>';
    }
    paintApps();
    input.addEventListener("input", paintApps);
    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-my-app]");
      if (button) openKey(button.dataset.myApp);
    });
    host.querySelector("[data-store-browse]")?.addEventListener("click", () => renderStore(host));
    host.querySelector("[data-app-create-leisure]")?.addEventListener("click", () => {
      touch("leisure");
      openDocument("sorties-loisirs.html?tab=create");
    });
  }
  function toggleFavorites() {
    const existing=document.getElementById("stipFavoritesPanel");
    if(existing) return closeFavorites();
    const p=document.createElement("section");
    p.id="stipFavoritesPanel"; p.className="stip-favorites-panel";
    p.innerHTML='<button type="button" class="stip-fav-backdrop" aria-label="Fermer"></button><div class="stip-fav-sheet"><div id="stipAppsPanelHost"></div></div>';
    document.body.appendChild(p); document.body.classList.add("stip-favorites-open");
    p.querySelector(".stip-fav-backdrop").onclick=closeFavorites;
    renderApps(p.querySelector("#stipAppsPanelHost"));
  }
  window.STIPFavorites = {
    open: () => { if (!document.getElementById("stipFavoritesPanel")) toggleFavorites(); },
    close: closeFavorites,
    toggle: toggleFavorites,
    renderApps,
  };
  function syncMode() {
    const connected = !!window.STIPSession;
    document.body.classList.remove("stip-quick-in-app", "stip-quick-connected");
    document.body.classList.toggle(
      "stip-public-preview",
      connected && publicPreview,
    );
  }
  function mount() {
    document.getElementById("stipQuickUniversal")?.remove();
    document.getElementById("stipQuickSwitch")?.remove();
    if (!window.STIPSession) closeFavorites();
    syncMode();
  }
  function refreshState() {
    document.getElementById("stipQuickUniversal")?.remove();
    document.getElementById("stipQuickSwitch")?.remove();
  }
  function requireSession(key = "") {
    if (window.STIPSession) return true;
    if (key)
      try {
        sessionStorage.setItem(PENDING_STORE, key);
      } catch {}
    return false;
  }
  function showPublic() {
    if (!window.STIPSession) return;
    closeFavorites();
    publicPreview = true;
    $("#appView")?.classList.add("hidden");
    $("#loginView")?.classList.remove("hidden");
    mount();
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function showProfile(target = "home") {
    if (!requireSession()) return;
    closeFavorites();
    publicPreview = false;
    $("#loginView")?.classList.add("hidden");
    $("#appView")?.classList.remove("hidden");
    window.STIPRouter?.set?.(target);
    mount();
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function openKey(key) {
    if (!key || !allowed(key) || !requireSession(key)) return;
    closeFavorites();
    publicPreview = false;
    $("#loginView")?.classList.add("hidden");
    $("#appView")?.classList.remove("hidden");
    touch(key);
    mount();
    META[key].open();
  }
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest?.(".hc-app[data-app]");
      if (b && allowed(b.dataset.app)) touch(b.dataset.app);
    },
    true,
  );
  window.addEventListener("stip:route", (e) => {
    const k = routeKey(e.detail?.route);
    if (k) touch(k);
    if (window.STIPSession && !publicPreview) mount();
  });
  window.addEventListener("stip:login-success", () => saveCode());
  window.addEventListener("stip:session-ready", () => {
    const params = new URLSearchParams(location.search),
      q = params.get("quick") || "",
      conversation = params.get("conversation") || "";
    if (conversation)
      try {
        sessionStorage.setItem("stip_message_open_v1", conversation);
      } catch {}
    publicPreview = q === "public";
    mount();
    if (q) {
      history.replaceState(null, "", location.pathname + location.hash);
      setTimeout(() => {
        if (q === "public") showPublic();
        else if (q === "profile") showProfile("home");
        else if (q === "notifications") showProfile("notifications");
        else if (q === "tableau" || q === "teamchat") window.STIPRouter?.set?.("communication/fauteuils", { replace: true });
        else if (allowed(q)) openKey(q);
      }, 40);
      return;
    }
    let k = "";
    try {
      k = sessionStorage.getItem(PENDING_STORE) || "";
      sessionStorage.removeItem(PENDING_STORE);
    } catch {}
    if (k && allowed(k)) setTimeout(() => openKey(k), 60);
  });
  window.addEventListener("stip:session-ended", () => {
    publicPreview = false;
    mount();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFavorites();
  });
  prepareCode();
  mount();
})();

