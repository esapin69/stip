(() => {
  "use strict";
  if (!window.__STIPWorkspaceRequested) {
    window.__STIPWorkspaceRequested = true;
    const workspaceScript = document.createElement("script");
    workspaceScript.src = "/stip-workspace.js?v=20260925-workspace3";
    workspaceScript.async = true;
    document.head.appendChild(workspaceScript);
  }
  if (!window.__STIPActivityRuntimeRequested) {
    window.__STIPActivityRuntimeRequested = true;
    const activityScript = document.createElement("script");
    activityScript.src = "/activity-runtime.js?v=20260924-history2";
    activityScript.async = true;
    document.head.appendChild(activityScript);
  }
  if (window.__STIPQuickAccessOwner === "main" || document.getElementById("stipQuickSwitch")) return;
  if (
    /(?:^|\/)index\.html$/.test(location.pathname) ||
    location.pathname === "/" ||
    location.pathname === ""
  )
    return;
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access",
    STORE = "stip_session_v1",
    USAGE = "stip_app_usage_v1",
    FAV = "stip_app_favorites_v1";
  const I = {
    fav: '<img src="images/icone_app/quick-rocket.svg?v=20260919-restore1" alt="" aria-hidden="true">',
  };
  let continuityPromise = null;
  let navigationPromise = null;
  function ensureNavigation() {
    if (window.STIPNav) return Promise.resolve(window.STIPNav);
    if (navigationPromise) return navigationPromise;
    navigationPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-stip-navigation]');
      if (existing) {
        if (window.STIPNav) return resolve(window.STIPNav);
        existing.addEventListener(
          "load",
          () => resolve(window.STIPNav || null),
          { once: true },
        );
        existing.addEventListener("error", () => resolve(null), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "/stip-navigation.js?v=20260926-navigation2";
      script.async = true;
      script.dataset.stipNavigation = "1";
      script.onload = () => resolve(window.STIPNav || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    }).finally(() => {
      navigationPromise = null;
    });
    return navigationPromise;
  }

  function ensureContinuity() {
    if (window.STIPContinuity) return Promise.resolve(window.STIPContinuity);
    if (continuityPromise) return continuityPromise;
    continuityPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-stip-continuity]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.STIPContinuity || null), { once: true });
        existing.addEventListener("error", () => resolve(null), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "/stip-session-continuity.js?v=20260926-continuity1";
      script.async = true;
      script.dataset.stipContinuity = "1";
      script.onload = () => resolve(window.STIPContinuity || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    }).finally(() => {
      continuityPromise = null;
    });
    return continuityPromise;
  }

  const APPS = {
    places: { label: "Visiter les lieux", home: "places-app.html" },
    responsable: { label: "Responsable", home: "index.html#/responsable" },
    assistant: { label: "Assistant STIP", home: "esprit-equipe.html?tab=assistant" },
    activity: { label: "Activité", home: "esprit-equipe.html?tab=activity" },
    access: { label: "Accès & sécurité", home: "access-manage.html" },
    personal: { label: "Planning perso", home: "index.html?quick=personal" },
    tomorrow: { label: "Pour demain", home: "index.html?quick=tomorrow" },
    team: { label: "Esprit d’équipe", home: "esprit-equipe.html" },
    compare: {
      label: "Comparer les plannings",
      home: "planning-compare-app.html",
    },
    change: { label: "Changement", home: "index.html?quick=change" },
    calendar: { label: "Synchroniser mon calendrier", home: "index.html?quick=calendar" },
    contacts: { label: "Contacts", home: "index.html?quick=contacts" },
    newagent: {
      label: "Nouvel agent",
      home: "https://esapin69.github.io/Ghe-interne/",
    },
    upload: {
      label: "Importer",
      home: "https://admin-ghe.esapin.com/depot.html",
    },
    admin: { label: "Admin", home: "https://admin-ghe.esapin.com/" },
  };
  const PERM = {
    places: "places",
    responsable: "responsable",
    assistant: "assistant_enabled",
    activity: "activity",
    access: "access_manage",
    personal: "planning_personal",
    tomorrow: "tomorrow",
    team: "planning_team",
    compare: "planning_team",
    change: "change_app",
    calendar: "calendar_subscribe",
    contacts: "contacts",
    newagent: "nouveaux_arrivants",
    upload: "file_upload",
    admin: "admin",
  };
  function currentKey() {
    const p = location.pathname.split("/").pop() || "";
    if (p === "esprit-equipe.html") return "team";
    if (p === "places.html" || p === "places-app.html") return "places";
    if (p === "planning-compare-app.html") return "compare";
    if (/^responsable(?:-|\.)/.test(p)) return "responsable";
    if (p === "assistant.html") return "assistant";
    if (p === "cadre-activite.html") return "activity";
    if (p === "access-manage.html") return "access";
    return "";
  }
  function readUsage() {
    try {
      return JSON.parse(localStorage.getItem(USAGE) || "{}") || {};
    } catch {
      return {};
    }
  }
  function writeUsage(v) {
    try {
      localStorage.setItem(USAGE, JSON.stringify(v));
    } catch {}
  }
  function readFav() {
    try {
      const x = JSON.parse(localStorage.getItem(FAV) || "[]");
      return Array.isArray(x) ? x.filter((k) => APPS[k]) : [];
    } catch {
      return [];
    }
  }
  function writeFav(v) {
    try {
      localStorage.setItem(
        FAV,
        JSON.stringify([...new Set(v)].filter((k) => APPS[k])),
      );
    } catch {}
  }
  function allowed(k, perms, roleKey = "") {
    if (k === "access" && String(roleKey).toLowerCase() === "chef_equipe")
      return false;
    if (k === "team")
      return !!(
        APPS[k] &&
        (perms?.planning_team || perms?.activity || perms?.assistant_enabled)
      );
    return !!(APPS[k] && perms?.[PERM[k]]);
  }
  function touch(k) {
    if (!APPS[k]) return;
    const now = Date.now(),
      u = readUsage(),
      apps = u.apps || {},
      prev = Number(u.at || now),
      days = Math.max(0, (now - prev) / 86400000),
      decay = Math.pow(0.985, days);
    Object.keys(apps).forEach(
      (x) => (apps[x] = Math.max(0, Number(apps[x] || 0) * decay)),
    );
    apps[k] = Number(apps[k] || 0) + 1;
    writeUsage({ at: now, last: k, apps });
  }
  function go(url) {
    const target = new URL(url, location.href).href;
    if (target.startsWith(location.origin)) {
      if (window.STIPNav?.go) {
        window.STIPNav.go(target);
        return;
      }
      ensureNavigation().then((nav) => {
        if (nav?.go) nav.go(target);
        else location.assign(target);
      });
      return;
    }
    location.assign(target);
  }

  function warmApps(perms, roleKey = "") {
    const keys = [
      ...readFav().filter((k) => allowed(k, perms, roleKey)),
      ...suggestions(perms, roleKey),
    ];
    const urls = [...new Set(keys.map((k) => appHome(k, perms)))].slice(0, 4);
    const run = async () => {
      const nav = await ensureNavigation();
      urls.forEach((url) => nav?.prefetch?.(url));
    };
    if ("requestIdleCallback" in window)
      requestIdleCallback(run, { timeout: 2200 });
    else setTimeout(run, 900);
  }
  function appHome(k, perms) {
    if (k === "places") {
      const raw = String(perms?.__levels?.places || "visitor").toLowerCase(),
        mode = [
          "pro",
          "admin",
          "internal",
          "internal_stip",
          "restricted",
        ].includes(raw)
          ? "pro"
          : "visitor";
      return `places-app.html?mode=${mode}`;
    }
    return APPS[k]?.home || "index.html";
  }
  function suggestions(perms, roleKey = "") {
    const pinned = new Set(readFav().filter((k) => allowed(k, perms, roleKey))),
      scores = readUsage().apps || {};
    return Object.keys(APPS)
      .filter((k) => allowed(k, perms, roleKey) && !pinned.has(k))
      .sort(
        (a, b) =>
          Number(scores[b] || 0) - Number(scores[a] || 0) ||
          APPS[a].label.localeCompare(APPS[b].label, "fr"),
      )
      .slice(0, 3);
  }
  async function me() {
    const token = localStorage.getItem(STORE) || "";
    if (!token) return null;
    try {
      const continuity = await ensureContinuity();
      if (continuity) {
        const fresh = continuity.readFresh?.();
        if (fresh) return fresh;
        return await continuity.validate();
      }
      const r = await fetch(API, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-STIP-Session": token,
        },
        body: JSON.stringify({ action: "me" }),
      });
      if (!r.ok) return null;
      return await r.json().catch(() => null);
    } catch {
      return window.STIPContinuity?.read?.() || null;
    }
  }
  function ensureCss() {
    if (
      [...document.styleSheets].some((s) =>
        String(s.href || "").includes("quick-access.css"),
      )
    )
      return;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "quick-access.css?v=20260919-art1";
    document.head.appendChild(css);
  }
  function closeFav() {
    document.getElementById("stipFavoritesPanel")?.remove();
    document.body.classList.remove("stip-favorites-open");
    document
      .querySelector('[data-u="favorites"]')
      ?.classList.remove("is-current");
  }
  function favRow(k, pinned) {
    return `<div class="stip-fav-row"><button type="button" class="stip-fav-open" data-fav-open="${k}"><span>${APPS[k].label}</span><b>›</b></button><button type="button" class="stip-fav-pin ${pinned ? "is-pinned" : ""}" data-fav-pin="${k}" aria-label="${pinned ? "Retirer des favoris" : "Ajouter aux favoris"}">${pinned ? "★" : "☆"}</button></div>`;
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
  function toggleFav(perms, roleKey = "") {
    if (document.getElementById("stipFavoritesPanel")) return closeFav();
    const pinned = readFav().filter((k) => allowed(k, perms, roleKey)),
      all = Object.keys(APPS).filter((k) => allowed(k, perms, roleKey)),
      p = document.createElement("section");
    p.id = "stipFavoritesPanel";
    p.className = "stip-favorites-panel";
    p.innerHTML = `<button type="button" class="stip-fav-backdrop" aria-label="Fermer"></button><div class="stip-fav-sheet"><header><div><small>RACCOURCIS</small><h2>Mes favoris</h2></div><button type="button" class="stip-fav-close" aria-label="Fermer">×</button></header>${pinned.length ? `<section><h3>Mes applications</h3><div>${pinned.map((k) => favRow(k, true)).join("")}</div></section><details><summary>Ajouter une application</summary><div class="stip-fav-all">${all.map((k) => favRow(k, pinned.includes(k))).join("")}</div></details>` : `<section class="stip-fav-first"><p class="stip-fav-empty">Ajoutez les applications que vous voulez retrouver ici.</p><details open><summary>Choisir mes applications</summary><div class="stip-fav-all">${all.map((k) => favRow(k, false)).join("")}</div></details></section>`}</div>`;
    document.body.appendChild(p);
    document.body.classList.add("stip-favorites-open");
    document.querySelector('[data-u="favorites"]')?.classList.add("is-current");
    p.querySelector(".stip-fav-backdrop").onclick = closeFav;
    p.querySelector(".stip-fav-close").onclick = closeFav;
    p.addEventListener("click", (e) => {
      const o = e.target.closest("[data-fav-open]"),
        pin = e.target.closest("[data-fav-pin]");
      if (o) {
        const k = o.dataset.favOpen;
        if (!allowed(k, perms, roleKey)) return;
        closeFav();
        touch(k);
        go(appHome(k, perms));
        return;
      }
      if (pin) {
        const k = pin.dataset.favPin,
          a = readFav();
        const adding = !a.includes(k);
        writeFav(adding ? [...a, k] : a.filter((x) => x !== k));
        closeFav();
        toggleFav(perms, roleKey);
        favoriteFeedback(adding ? "Ajouté aux favoris" : "Retiré des favoris");
      }
    });
  }
  function mount(perms, roleKey = "") {
    if (window.__STIPQuickAccessOwner === "main") return;
    window.__STIPQuickAccessOwner = "universal";
    document.getElementById("stipQuickSwitch")?.remove();
    document.getElementById("stipQuickUniversal")?.remove();
    document.body.classList.remove("stip-quick-connected", "stip-quick-in-app");
    const k = currentKey();
    if (k && allowed(k, perms, roleKey)) touch(k);
  }
  me().then((j) => {
    const perms = j?.permissions || j?.profile?.permissions || {};
    const roleKey = j?.role_key || j?.profile?.role_key || "";
    if (j) {
      mount(perms, roleKey);
      warmApps(perms, roleKey);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFav();
  });
})();
