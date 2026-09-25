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
  const META = {
    personal: {
      label: "Planning perso",
      open: () => window.STIPHubs?.planning?.("personal"),
    },
    tomorrow: {
      label: "Actions",
      open: () => setTimeout(() => window.STIPTomorrowUI?.open?.(), 0),
    },
    team: {
      label: "Esprit d’équipe",
      open: () => window.STIPRouter?.set?.("team"),
    },
    agents: {
      label: "Équipe",
      open: () => (location.href = "agent-directory.html"),
    },
    compare: {
      label: "Comparer les plannings",
      open: () => (location.href = "planning-compare-app.html"),
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
      open: () => (location.href = "agent-dates.html"),
    },
    contacts: { label: "Contacts", open: () => window.STIPHubs?.contacts?.() },
    places: {
      label: "Visiter les lieux",
      open: () => (location.href = "places-app.html"),
    },
    responsable: {
      label: "Responsable",
      open: () => (location.href = "responsable.html?tab=dates&entry=shortcut"),
    },
    resp_tracking: {
      label: "Suivi",
      open: () => (location.href = "responsable.html?tab=suivi"),
    },
    resp_evaluation: {
      label: "Évaluation",
      open: () => (location.href = "responsable.html?tab=equipe&mode=evaluation"),
    },
    resp_official: {
      label: "Extraire un fichier officiel",
      open: () => (location.href = "responsable.html?tab=equipe&tool=official"),
    },
    resp_requests: {
      label: "Demandes",
      open: () => (location.href = "responsable.html?tab=suivi&tool=requests"),
    },
    resp_directory: {
      label: "Équipe du jour",
      open: () => (location.href = "responsable.html?tab=equipe"),
    },
    resp_agenda: {
      label: "Agenda agents",
      open: () => (location.href = "responsable.html?tab=agenda"),
    },
    assistant: {
      label: "Assistant STIP",
      open: () => (location.href = "esprit-equipe.html?tab=assistant"),
    },
    activity: {
      label: "Activité",
      open: () => (location.href = "esprit-equipe.html?tab=activity"),
    },
    access: {
      label: "Accès & sécurité",
      open: () => (location.href = "access-manage.html"),
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
    personal: ["Planning perso", "Votre planning personnel et vos horaires.", "Organisation"],
    tomorrow: ["Actions", "Préparer et consulter les jours à venir.", "Organisation"],
    team: ["Esprit d’équipe", "Planning d’équipe et outils collectifs.", "Équipe"],
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
    const p = window.STIPPreview?.active
      ? { ...(window.STIPSession?.permissions || {}) }
      : {
          ...(window.STIPSession?.permissions || {}),
          ...(window.STIPBootCache?.permissions || {}),
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
        team: "planning_team",
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
    return `<div class="stip-fav-row"><button type="button" class="stip-fav-open" data-fav-open="${k}"><span>${META[k].label}</span><b>›</b></button><button type="button" class="stip-fav-pin ${pinned ? "is-pinned" : ""}" data-fav-pin="${k}" aria-label="${pinned ? "Retirer des favoris" : "Ajouter aux favoris"}">${pinned ? "★" : "☆"}</button></div>`;
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
    personal:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M7.5 14h3M13.5 14h3M7.5 18h3"/></svg>',
    tomorrow:
      '<img src="images/icone_app/quick-rocket.svg?v=20260920-appicons2" alt="" aria-hidden="true">',
    team:
      '<img src="images/icone_app/esprit-equipe.webp?v=20260921-team1" alt="" aria-hidden="true">',
    agents:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7"/><circle cx="17.5" cy="14.5" r="3"/><path d="m20 17 2 2"/></svg>',
    compare:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="2"/><rect x="13.5" y="5" width="7" height="14" rx="2"/><path d="M7 9h0M17 9h0M7 13h0M17 13h0"/></svg>',
    change:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h3M13 14h3M8 18h3"/></svg>',
    dates:
      '<img src="images/icone_app/date-des-agents.svg?v=20260920-appicons1" alt="" aria-hidden="true">',
    contacts:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.5.6 4 2.7 4 5"/></svg>',
    places:
      '<img src="images/icone_app/visiter-les-lieux.webp?v=20260920-appicons1" alt="" aria-hidden="true">',
    responsable:
      '<img src="images/icone_app/responsable.webp?v=20260922-responsable2" alt="" aria-hidden="true">',
    resp_tracking:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-5 4 10 2-5h4"/><path d="M5 4h14v16H5z"/></svg>',
    resp_evaluation:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 9l2 2 5-5M8 15h8"/></svg>',
    resp_official:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM15 3v5h5M9 13h6M9 17h6M9 9h2"/></svg>',
    resp_requests:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H8l-4 4z"/><path d="M8 9h8M8 13h5"/></svg>',
    resp_directory:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    resp_agenda:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h3M13 14h3M8 18h3"/></svg>',
    assistant:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>',
    activity:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
    access:
      '<img src="images/icone_app/access-lock.webp?v=20260920-accesslock1" alt="" aria-hidden="true">',
    newagent:
      '<img src="images/icone_app/nouvel-arrivant-pro.webp?v=20260920-appicons1" alt="" aria-hidden="true">',
    upload:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>',
    admin:
      '<img src="images/icone_app/admin.webp?v=20260920-appicons1" alt="" aria-hidden="true">',
  };
  function appStoreIcon(k) {
    const art = APP_ICON[k];
    if (art) return `<span class="stip-store-icon stip-store-icon-${k}">${art}</span>`;
    const fallback = (META[k]?.label || k).trim().charAt(0).toUpperCase();
    return `<span class="stip-store-icon stip-store-icon-${k}">${fallback}</span>`;
  }
  function storeCard(k, added) {
    const meta = APP_STORE_COPY[k] || [META[k].label, "Application STIP", "STIP"];
    return `<article class="stip-store-card ${added ? "is-selected" : ""}"><button type="button" class="stip-store-main" data-store-open="${k}">${appStoreIcon(k)}<span><small>${meta[2]}</small><strong>${meta[0]}</strong><em>${meta[1]}</em></span></button><button type="button" class="stip-store-add ${added ? "is-added" : ""}" data-store-toggle="${k}" aria-label="${added ? "Retirer " : "Ajouter "}${meta[0]}"><span aria-hidden="true">${added ? "−" : "+"}</span><strong>${added ? "Retirer" : "Ajouter"}</strong></button></article>`;
  }
  function renderStore(host) {
    const chosen = readFav().filter(allowed), all = Object.keys(META).filter(allowed);
    host.innerHTML = `<section class="stip-app-store"><header><button type="button" class="stip-store-back" data-store-back>‹</button><div><small>STIP</small><h2>Applications</h2><p>Choisissez les outils à afficher sur votre écran.</p></div></header><div class="stip-store-feature"><small>À DÉCOUVRIR</small><strong>Construisez votre STIP</strong><p>Ajoutez uniquement les applications utiles à votre quotidien.</p></div><div class="stip-store-list">${all.map(k => storeCard(k, chosen.includes(k))).join("") || '<p class="stip-app-empty">Aucune application disponible avec vos accès.</p>'}</div></section>`;
    host.querySelector("[data-store-back]")?.addEventListener("click", () => renderApps(host));
    host.addEventListener("click", storeClick, { once: true });
  }
  function storeClick(e) {
    const host=e.currentTarget, open=e.target.closest("[data-store-open]"), toggle=e.target.closest("[data-store-toggle]");
    if (open) { openKey(open.dataset.storeOpen); return; }
    if (toggle) {
      const k=toggle.dataset.storeToggle, a=readFav(), adding=!a.includes(k);
      writeFav(adding ? [...a,k] : a.filter(x=>x!==k));
      renderStore(host);
      return;
    }
    host.addEventListener("click", storeClick, { once: true });
  }
  function renderApps(host) {
    if (!host) return;
    ensureResponsibleApps();
    const chosen=readFav().filter(allowed);
    host.innerHTML = chosen.length
      ? `<section class="stip-my-apps"><header><div><small>MES APPLICATIONS</small><h2>Applications</h2></div><button type="button" class="stip-store-browse stip-store-browse-add" data-store-browse aria-label="Ajouter une application"><span class="stip-store-browse-plus" aria-hidden="true"></span><strong>Ajouter</strong></button></header><div class="stip-my-app-grid">${chosen.map(k=>`<button type="button" class="stip-my-app" data-my-app="${k}">${appStoreIcon(k)}<strong>${META[k].label}</strong></button>`).join("")}</div></section>`
      : `<section class="stip-app-empty-state"><div class="stip-empty-orb">＋</div><h2>Vos applications</h2><p>Votre écran est vide. Choisissez les applications STIP que vous souhaitez retrouver ici.</p><button type="button" class="stip-store-browse" data-store-browse>Parcourir les applications</button></section>`;
    host.querySelector("[data-store-browse]")?.addEventListener("click",()=>renderStore(host));
    host.querySelectorAll("[data-my-app]").forEach(b=>b.addEventListener("click",()=>openKey(b.dataset.myApp)));
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
        else if (q === "tableau" || q === "teamchat") window.STIPRouter?.set?.("fauteuils", { replace: true });
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
