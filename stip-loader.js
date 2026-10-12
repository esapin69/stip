(() => {
  "use strict";
  const loaded = new Map(),
    loadedStyles = new Map(),
    V = "20261012-ensemble-calendar-v5";
  function load(src) {
    const url = new URL(String(src || ""), document.baseURI);
    url.searchParams.set("v", V);
    const key = url.href;
    if (loaded.has(key)) return loaded.get(key);
    const p = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = key;
      s.async = false;
      s.onload = () => ok(key);
      s.onerror = () => {
        loaded.delete(key);
        ko(new Error(`Chargement impossible: ${url.pathname}`));
      };
      document.body.appendChild(s);
    });
    loaded.set(key, p);
    return p;
  }
  function style(href) {
    if (document.documentElement.dataset.stipVisual === "none")
      return Promise.resolve(null);
    const url = new URL(String(href || ""), document.baseURI);
    url.searchParams.set("v", V);
    const key = url.href;
    if (loadedStyles.has(key)) return loadedStyles.get(key);
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(
      (link) => {
        try {
          const current = new URL(link.href, document.baseURI);
          return current.pathname === url.pathname;
        } catch {
          return false;
        }
      },
    );
    if (existing) {
      loadedStyles.set(key, Promise.resolve(existing.href));
      return loadedStyles.get(key);
    }
    const p = new Promise((ok, ko) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = key;
      link.onload = () => ok(key);
      link.onerror = () => {
        loadedStyles.delete(key);
        ko(new Error(`Chargement impossible: ${url.pathname}`));
      };
      document.head.appendChild(link);
    });
    loadedStyles.set(key, p);
    return p;
  }
  async function seq(list) {
    for (const x of list) await load(x);
  }
  function later(list) {
    const run = () => seq(list).catch(console.error);
    if ("requestIdleCallback" in window)
      requestIdleCallback(run, { timeout: 2400 });
    else setTimeout(run, 900);
  }
  const documentWarm = new Map();
  const documentMarkup = new Map();
  const DOCUMENT_APP_TARGET = {
    agents: "agent-directory.html",
    compare: "planning-compare-app.html",
    dates: "agent-dates.html",
    leisure: "sorties-loisirs.html",
    places: "places-app.html",
    assistant: "esprit-equipe.html?tab=assistant",
    activity: "esprit-equipe.html?tab=activity",
    access: "access-manage.html",
  };
  function documentUrl(raw) {
    try {
      const url = new URL(String(raw || ""), location.href);
      if (url.origin !== location.origin) return null;
      if (url.pathname === location.pathname && url.search === location.search)
        return null;
      url.hash = "";
      return url;
    } catch {
      return null;
    }
  }
  function warmDocument(raw) {
    const url = documentUrl(raw);
    if (!url) return Promise.resolve(false);
    const key = url.pathname + url.search;
    if (documentWarm.has(key)) return documentWarm.get(key);
    const promise = fetch(key, {
      method: "GET",
      credentials: "same-origin",
      cache: "default",
    })
      .then((response) => {
        if (!response.ok) return false;
        // Only HTML presentation files are warmed: no business request or private API response.
        if (/\.html?$/i.test(url.pathname) && !url.search) {
          documentMarkup.set(key, response.clone().text().catch(() => ""));
        }
        return true;
      })
      .catch(() => false)
      .then((ok) => {
        if (!ok) {
          documentWarm.delete(key); // Offline and transient errors must be retryable.
          documentMarkup.delete(key);
        }
        return ok;
      });
    documentWarm.set(key, promise);
    return promise;
  }

  // Prefetch only the static shell and its own CSS/JS, without running the scripts.
  // The existing service worker stores these files for the following navigation.
  async function warmDocumentResources(raw) {
    const url = documentUrl(raw);
    if (!url || url.search || !/\.html?$/i.test(url.pathname)) return false;
    if (!(await warmDocument(url.href))) return false;
    const key = url.pathname;
    const markup = await documentMarkup.get(key);
    if (!markup || typeof DOMParser !== "function") return true;
    const stem = url.pathname.split("/").pop().replace(/\.html?$/i, "");
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    const urls = [...parsed.querySelectorAll('link[rel="stylesheet"][href], script[src]')]
      .map((element) => element.getAttribute("href") || element.getAttribute("src"))
      .map((rawUrl) => {
        try { return new URL(rawUrl, url.href); } catch { return null; }
      })
      .filter((resource) =>
        resource &&
        resource.origin === location.origin &&
        /\.(?:js|css)$/i.test(resource.pathname) &&
        resource.pathname.split("/").pop().startsWith(stem + ".")
      )
      .slice(0, 2);
    await Promise.allSettled(
      urls.map((resource) =>
        fetch(resource.href, { method: "GET", credentials: "same-origin", cache: "default" })
      ),
    );
    documentMarkup.delete(key);
    return true;
  }

  // Agent-specific permission gates mirror the canonical home application catalogue.
  // This does not download agent data; authorization remains enforced by existing APIs.
  const AGENT_PAGE_TARGETS = [
    ["mon-compte.html", () => true],
    ["agent-directory.html", (p) => p.agent_directory === true],
    ["agent-dates.html", (p) => p.agent_dates === true],
    ["esprit-equipe.html", (p) =>
      p.planning_team === true || p.activity === true || p.assistant_enabled === true],
    ["agent-date-detail.html", (p) => p.agent_dates === true],
  ];
  let warmGeneration = 0;
  let warmedIdentity = "";
  function warmAgentPages(session = window.STIPSession) {
    const token = localStorage.getItem("stip_session_v1") || "";
    if (!token || !session?.agent || window.STIPPreview?.active) return;
    const permissions = session.permissions || {};
    const pages = AGENT_PAGE_TARGETS
      .filter(([, allowed]) => allowed(permissions))
      .slice(0, 4)
      .map(([url]) => url);
    const identity = [token, session.agent.id || session.agent.source_key || "",
      session.role_key || "", pages.join("|")].join("::");
    if (identity === warmedIdentity) return;
    warmedIdentity = identity;
    const generation = ++warmGeneration;
    const run = async () => {
      const connection = navigator.connection || {};
      if (document.hidden || connection.saveData || /(?:^|-)2g$/.test(connection.effectiveType || "")) {
        warmedIdentity = "";
        return;
      }
      for (const page of pages) {
        if (generation !== warmGeneration ||
            localStorage.getItem("stip_session_v1") !== token ||
            window.STIPPreview?.active) return;
        await warmDocumentResources(page);
      }
    };
    if ("requestIdleCallback" in window)
      requestIdleCallback(() => { void run(); }, { timeout: 3500 });
    else setTimeout(() => { void run(); }, 1400);
  }
  window.addEventListener("stip:session-ready", (e) => warmAgentPages(e.detail));
  window.addEventListener("stip:session-refreshed", (e) => warmAgentPages(e.detail));
  window.addEventListener("stip:session-ended", () => {
    ++warmGeneration;
    warmedIdentity = "";
    documentMarkup.clear();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !warmedIdentity) warmAgentPages();
  });
  if (window.STIPSession) warmAgentPages();

  function navigateDocument(raw) {
    const url = new URL(String(raw || ""), location.href);
    if (url.origin === location.origin) warmDocument(url.href);
    location.assign(url.href);
  }
  function warmVisibleDocuments(limit = 4) {
    const keys = [
      ...new Set(
        [...document.querySelectorAll("[data-app]")]
          .map((node) => String(node.dataset.app || ""))
          .filter(Boolean),
      ),
    ];
    let count = 0;
    for (const key of keys) {
      const target = DOCUMENT_APP_TARGET[key];
      if (!target) continue;
      warmDocument(target);
      count += 1;
      if (count >= limit) break;
    }
  }
  const personalCore = [
    "planning-home.js?v=20260930-official-pdf1",
    "planning-month-hero.js",
    "planning-print-reference.js?v=20260930-official-pdf1",
  ];
  const personalExtras = [
    "agent-agenda-view.js?v=20260928-icon-registry1",
    "calendar-subscriptions.js",
    "calendar-responsable-gate.js",
    "agent-week-view.js",
    "planning-agenda-extras.js",
    "change-permission-gate.js",
    "day-workflow.js",
    "day-workflow-home-bridge.js",
  ];
  const teamCore = [
    "agent-agenda-view.js?v=20260928-icon-registry1",
    "planning-home.js?v=20260930-official-pdf1",
    "planning-hub-enhance.js?v=20260925-calendar-clean2",
  ];
  const teamExtras = [
    "calendar-subscriptions.js",
    "calendar-responsable-gate.js",
  ];
  const changeCore = [
    "planning-home.js?v=20260930-official-pdf1",
    "change-workflow.js?v=20260930-mail-approval",
    "change-permission-gate.js",
    "staffing-guidance.js",
  ];
  let busyRoute = "",
    tableauPromise = null,
    communicationPromise = null,
    homeExtrasPromise = null;
  function homeExtras() {
    if (homeExtrasPromise) return homeExtrasPromise;
    homeExtrasPromise = Promise.all([
      style("event-feedback.css"),
      style("admin-access-requests-home.css"),
    ])
      .then(() =>
        seq([
          "event-feedback.js",
          "home-duty-chief.js?v=20260928-home-current-chief1",
          "admin-access-requests-home.js",
        ]),
      )
      .catch((error) => {
        homeExtrasPromise = null;
        throw error;
      });
    return homeExtrasPromise;
  }
  function tableau() {
    if (window.STIPTableau?.mount) return Promise.resolve(window.STIPTableau);
    if (tableauPromise) return tableauPromise;
    tableauPromise = style("team-chat.css")
      .then(() => load("team-chat.js"))
      .then(() => {
        if (!window.STIPTableau?.mount)
          throw new Error("Runtime Fauteuils indisponible.");
        return window.STIPTableau;
      })
      .catch((error) => {
        tableauPromise = null;
        throw error;
      });
    return tableauPromise;
  }
  function communication() {
    if (window.STIPCommunicationApp?.mount) return Promise.resolve(window.STIPCommunicationApp);
    if (communicationPromise) return communicationPromise;
    // Le shell Communication ne doit jamais attendre une feuille de style ou le runtime lourd.
    // CSS + Chat/Fauteuils sont préchauffés en parallèle ; le JS du shell est la seule dépendance bloquante.
    void style("communication-app.css").catch(() => {});
    void style("communication-hub.css").catch(() => {});
    void tableau().catch(() => {});
    communicationPromise = load("communication-app.js")
      .then(() => {
        if (!window.STIPCommunicationApp?.mount)
          throw new Error("Runtime Communication indisponible.");
        return window.STIPCommunicationApp;
      })
      .catch((error) => {
        communicationPromise = null;
        throw error;
      });
    return communicationPromise;
  }
  async function ensureRoute(r) {
    r = String(r || "");
    if (!r) return;
    if (r.startsWith("contacts")) {
      window.STIPReadCache?.requestContacts?.();
      await seq(["agent-agenda-view.js?v=20260928-icon-registry1", "section-hubs.js"]);
      window.STIPHubs?.contactsRoute?.(r);
      return;
    }
    if (!r.startsWith("planning")) return;
    const kind =
      r.includes("/team") || r.includes("/spirit")
        ? "team"
        : r.includes("/change")
          ? "change"
          : "personal";
    const key = `${r}|${kind}`;
    if (busyRoute === key) return;
    busyRoute = key;
    try {
      if (kind === "team") {
        await seq(teamCore);
        later(teamExtras);
      } else if (kind === "change") {
        await seq(changeCore);
      } else {
        await seq(personalCore);
        later(personalExtras);
      }
      window.dispatchEvent(
        new CustomEvent("stip:lazy-ready", { detail: { route: r, kind } }),
      );
    } finally {
      busyRoute = "";
    }
  }
  window.STIPLoad = {
    script: load,
    style,
    route: ensureRoute,
    tableau,
    communication,
    homeExtras,
    idle: later,
    warmDocument,
    warmAgentPages,
    navigateDocument,
    documentTarget: (key) => DOCUMENT_APP_TARGET[key] || "",
  };
  window.STIPHubs = window.STIPHubs || {
    planning(kind = "personal") {
      const map = {
        personal: "personal",
        spirit: "team",
        team: "team",
        change: "change",
        calendar: "calendar",
      };
      window.STIPRouter?.set?.(`planning/${map[kind] || "personal"}`);
    },
    contacts(kind = "directory") {
      window.STIPReadCache?.requestContacts?.();
      window.STIPRouter?.set?.(`contacts/${kind}`);
    },
  };
  window.addEventListener("stip:route", (e) =>
    ensureRoute(e.detail?.route || "").catch(console.error),
  );
  function idle() {
    if (new URLSearchParams(location.search).has("view_agent"))
      load("readonly-view-as.js").catch(console.error);
    if (window.STIPSession && localStorage.getItem("stip_session_v1"))
      warmVisibleDocuments();
  }
  if ("requestIdleCallback" in window)
    requestIdleCallback(idle, { timeout: 2200 });
  else setTimeout(idle, 900);
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest?.('[data-home-mode="tableau"]'))
        communication().catch(() => {});
      const b = e.target.closest?.("[data-app]");
      if (!b) return;
      const k = b.dataset.app;
      const documentTarget = DOCUMENT_APP_TARGET[k];
      if (documentTarget) warmDocument(documentTarget);
      if (k === "communication") communication().catch(() => {});
      if (k === "contacts") {
        window.STIPReadCache?.requestContacts?.();
        seq(["agent-agenda-view.js?v=20260928-icon-registry1", "section-hubs.js"]).catch(() => {});
      }
      if (k === "personal") seq(personalCore).catch(() => {});
      if (k === "team") seq(teamCore).catch(() => {});
      if (k === "change") seq(changeCore).catch(() => {});
    },
    { passive: true, capture: true },
  );
  setTimeout(
    () => ensureRoute(window.STIPRouter?.get?.() || "").catch(console.error),
    0,
  );
})();


