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
      label: "Pour demain",
      open: () => setTimeout(() => window.STIPTomorrowUI?.open?.(), 0),
    },
    team: {
      label: "Esprit d’équipe",
      open: () => (location.href = "esprit-equipe.html"),
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
      open: () => (location.href = "responsable.html"),
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
      label: "Accès",
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
    tomorrow: ["Pour demain", "Préparer et consulter la journée à venir.", "Organisation"],
    team: ["Esprit d’équipe", "Planning d’équipe et outils collectifs.", "Équipe"],
    compare: ["Comparer les plannings", "Comparer rapidement plusieurs plannings.", "Organisation"],
    change: ["Changement", "Gérer les demandes de changement.", "Organisation"],
    calendar: ["Synchroniser mon calendrier", "Retrouver vos horaires dans votre calendrier.", "Organisation"],
    dates: ["Date des agents", "Consulter les dates utiles de l’équipe.", "Équipe"],
    contacts: ["Contacts", "Annuaire et numéros utiles.", "Communication"],
    places: ["Visiter les lieux", "Repères et informations pour se déplacer.", "Terrain"],
    responsable: ["Responsable", "Outils réservés aux responsables autorisés.", "Encadrement"],
    assistant: ["Assistant STIP", "Assistant pour les outils et données STIP.", "Outils"],
    activity: ["Activité", "Suivi d’activité pour les profils autorisés.", "Encadrement"],
    access: ["Accès", "Gérer les accès selon vos autorisations.", "Sécurité"],
    newagent: ["Nouvel agent", "Ressources pour l’arrivée dans l’équipe.", "Découvrir"],
    upload: ["Importer", "Déposer les fichiers autorisés.", "Outils"],
    admin: ["Admin", "Administration réservée aux profils autorisés.", "Administration"],
  };
  let publicPreview = false,
    lastTouch = { key: "", at: 0 };
  function allowed(k) {
    if (!META[k]) return false;
    if (window.STIPAccess?.app) return !!window.STIPAccess.app(k);
    const p = window.STIPSession?.permissions || {},
      map = {
        personal: "planning_personal",
        tomorrow: "tomorrow",
        team: "planning_team",
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
  function formatCode(v) {
    const d = String(v || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    return d.length > 3 ? `${d.slice(0, 3)} • ${d.slice(3)}` : d;
  }
  function prepareCode() {
    const i = $("#accessCode");
    if (!i) return;
    const saved = String(localStorage.getItem(CODE_STORE) || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    i.removeAttribute("pattern");
    i.maxLength = 9;
    i.classList.add("stip-code-visible");
    if (saved && !String(i.value || "").replace(/\D/g, "")) {
      i.value = formatCode(saved);
      i.type = "text";
      if ($("#toggleAccessCode"))
        $("#toggleAccessCode").textContent = "Masquer";
    }
    i.addEventListener(
      "input",
      () => {
        const d = String(i.value || "")
          .replace(/\D/g, "")
          .slice(0, 6);
        i.value = formatCode(d);
      },
      { passive: true },
    );
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
  function nav() {
    let n = $("#stipQuickSwitch");
    if (n) return n;
    n = document.createElement("nav");
    n.id = "stipQuickSwitch";
    n.className = "stip-quick-switch";
    n.setAttribute("aria-label", "Navigation STIP");
    n.innerHTML = `<button type="button" data-qs="favorites" aria-label="Applications favorites"><span class="qs-icon">${I.fav}</span></button>`;
    n.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-qs]");
      if (b?.dataset.qs === "favorites") toggleFavorites();
    });
    return n;
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
  function appStoreIcon(k) {
    const initials = (META[k]?.label || k).split(/\\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
    return `<span class="stip-store-icon stip-store-icon-${k}">${initials}</span>`;
  }
  function storeCard(k, added) {
    const meta = APP_STORE_COPY[k] || [META[k].label, "Application STIP", "STIP"];
    return `<article class="stip-store-card"><button type="button" class="stip-store-main" data-store-open="${k}">${appStoreIcon(k)}<span><small>${meta[2]}</small><strong>${meta[0]}</strong><em>${meta[1]}</em></span></button><button type="button" class="stip-store-add ${added ? "is-added" : ""}" data-store-toggle="${k}">${added ? "Ajoutée" : "Ajouter"}</button></article>`;
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
    const chosen=readFav().filter(allowed);
    host.innerHTML = chosen.length
      ? `<section class="stip-my-apps"><header><div><small>MES APPLICATIONS</small><h2>Applications</h2></div><button type="button" class="stip-store-browse" data-store-browse>+ Ajouter</button></header><div class="stip-my-app-grid">${chosen.map(k=>`<button type="button" class="stip-my-app" data-my-app="${k}">${appStoreIcon(k)}<strong>${META[k].label}</strong></button>`).join("")}</div></section>`
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
    document.body.classList.toggle(
      "stip-quick-in-app",
      connected && !publicPreview,
    );
    document.body.classList.toggle(
      "stip-public-preview",
      connected && publicPreview,
    );
    document.body.classList.toggle("stip-quick-connected", connected);
  }
  function mount() {
    document.getElementById("stipQuickUniversal")?.remove();
    const existing = $("#stipQuickSwitch");
    if (!window.STIPSession) {
      existing?.remove();
      closeFavorites();
      syncMode();
      return;
    }
    const n = nav();
    if (n.parentElement !== document.body) document.body.appendChild(n);
    syncMode();
    refreshState();
  }
  function refreshState() {
    const n = $("#stipQuickSwitch");
    if (!n) return;
    const session = !!window.STIPSession;
    n.querySelector('[data-qs="favorites"]').classList.toggle(
      "is-current",
      !!document.getElementById("stipFavoritesPanel"),
    );
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
  function showProfile() {
    if (!requireSession()) return;
    closeFavorites();
    publicPreview = false;
    $("#loginView")?.classList.add("hidden");
    $("#appView")?.classList.remove("hidden");
    window.STIPRouter?.set?.("home");
    mount();
    setTimeout(() => document.querySelector('[data-home-mode="notifications"]')?.click(), 0);
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
        else if (q === "profile" || q === "notifications") showProfile();
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
