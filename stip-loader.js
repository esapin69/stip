(() => {
  "use strict";
  const loaded = new Map(),
    loadedStyles = new Map(),
    V = "20261016-shared-agent-actions1";
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
  const documentAssetWarm = new Map();
  // Single catalogue for page warming, navigation shortcuts and permission gating.
  // Reading HTML/JS/CSS never executes a business action. The APIs remain authoritative.
  const PAGE_CATALOG = [
    { app: "account", page: "mon-compte.html", allowed: () => true },
    { app: "agents", page: "agent-directory.html", allowed: (p) => p.agent_directory === true, data: "directory" },
    { app: "dates", page: "agent-dates.html", allowed: (p) => p.agent_dates === true, data: "dates" },
    { app: "team", page: "esprit-equipe.html", allowed: (p) =>
      p.planning_team === true || p.activity === true || p.assistant_enabled === true },
    { app: "leisure", page: "sorties-loisirs.html", allowed: (p) => p.leisure === true || p.sorties_loisirs === true },
    { app: "meeting_notes", page: "meeting-notes.html", allowed: (p) => p.meeting_notes === true },
    { app: "compare", page: "planning-compare-app.html", allowed: (p) =>
      p.planning_personal === true && p.planning_team === true },
    { app: "places", page: "places-app.html", allowed: (p) => p.places === true },
    { app: "responsable", page: "responsable.html", allowed: (p) => p.responsable === true || p.admin === true },
    { app: "upload", page: "depot.html", allowed: (p) => p.file_upload === true },
    { app: "access", page: "access-manage.html", allowed: (p) => p.admin === true || p.access_manage === true },
  ];
  const PAGE_BY_APP = new Map(PAGE_CATALOG.map((page) => [page.app, page]));
  const DOCUMENT_APP_TARGET = {
    ...Object.fromEntries(PAGE_CATALOG.map(({ app, page }) => [app, page])),
    assistant: "esprit-equipe.html?tab=assistant",
    activity: "esprit-equipe.html?tab=activity",
    admin: "access-manage.html",
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

  // General rule: stage a small set of navigable page shells and their own
  // presentation assets, never API responses or scripts executed in the background.
  function warmDocumentResources(raw) {
    const url = documentUrl(raw);
    if (!url || url.search || !/\.html?$/i.test(url.pathname)) return Promise.resolve(false);
    const key = url.pathname;
    if (documentAssetWarm.has(key)) return documentAssetWarm.get(key);
    const job = (async () => {
      if (!(await warmDocument(url.href))) return false;
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
    })().catch(() => false).then((ok) => {
      if (!ok) documentAssetWarm.delete(key);
      return ok;
    });
    documentAssetWarm.set(key, job);
    return job;
  }

  function canPrefetchInBackground() {
    const connection = navigator.connection || {};
    return !document.hidden && !window.STIPPreview?.active && !connection.saveData &&
      !/(?:^|-)2g$/.test(connection.effectiveType || "");
  }
  const PREFETCH_MAX_PAGES = 6;
  // A bounded initial batch protects slower telephones; further pages warm on
  // the next relevant pointer/focus interaction or when they become visible.
  function authorizedPage(app, session = window.STIPSession) {
    const normalized = app === "assistant" || app === "activity" ? "team"
      : app === "admin" ? "access" : app;
    const candidate = PAGE_BY_APP.get(normalized);
    if (app === "admin" && session?.permissions?.admin !== true) return false;
    return !!(candidate && session?.agent && candidate.allowed(session.permissions || {}));
  }
  let warmGeneration = 0;
  let warmedIdentity = "";
  let lastIntent = "";
  function rememberIntent(app) {
    if (PAGE_BY_APP.has(app)) lastIntent = app;
  }
  function warmAgentPages(session = window.STIPSession) {
    const token = localStorage.getItem("stip_session_v1") || "";
    if (!token || !session?.agent || window.STIPPreview?.active) return;
    if (!canPrefetchInBackground()) return;
    const pages = PAGE_CATALOG
      .filter((candidate) => candidate.allowed(session.permissions || {}))
      .sort((a, b) => Number(b.app === lastIntent) - Number(a.app === lastIntent))
      .slice(0, PREFETCH_MAX_PAGES);
    const identity = [token, session.agent.id || session.agent.source_key || "",
      session.role_key || "", pages.map((page) => page.app).join("|")].join("::");
    if (identity === warmedIdentity) return;
    warmedIdentity = identity;
    const generation = ++warmGeneration;
    const run = async () => {
      for (const page of pages) {
        if (generation !== warmGeneration || document.hidden ||
            localStorage.getItem("stip_session_v1") !== token ||
            window.STIPPreview?.active) return;
        await Promise.allSettled([
          warmDocumentResources(page.page),
          page.data
            ? (window.STIPReadCache?.agentWarm?.warm(page.data, session) || Promise.resolve(false))
            : Promise.resolve(false),
        ]);
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
    documentAssetWarm.clear();
    lastIntent = "";
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !warmedIdentity) warmAgentPages();
  });
  if (window.STIPSession) warmAgentPages();
  window.addEventListener("stip:home-rendered", () => {
    if (!window.STIPSession || !canPrefetchInBackground()) return;
    if ("requestIdleCallback" in window)
      requestIdleCallback(() => warmVisibleDocuments(3), { timeout: 2200 });
    else setTimeout(() => warmVisibleDocuments(3), 750);
  });

  function navigateDocument(raw) {
    const url = new URL(String(raw || ""), location.href);
    if (url.origin === location.origin) warmDocument(url.href);
    location.assign(url.href);
  }
  function warmVisibleDocuments(limit = 4) {
    if (!window.STIPSession || !localStorage.getItem("stip_session_v1") ||
        !canPrefetchInBackground()) return;
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
      if (!target || !authorizedPage(key)) continue;
      void warmDocumentResources(new URL(target, location.href).pathname);
      count += 1;
      if (count >= limit) return;
    }
    // Other internal links use the same mechanism, without an individual page patch.
    for (const anchor of document.querySelectorAll("a[href]")) {
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) continue;
      const target = documentUrl(anchor.href);
      if (!target || !/\.html?$/i.test(target.pathname)) continue;
      void warmDocumentResources(target.pathname);
      if (++count >= limit) return;
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
          "event-feedback.js?v=20261014-home-order2",
          "home-duty-chief.js?v=20261016-shared-agent-actions1",
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
      await seq(["agent-agenda-view.js?v=20260928-icon-registry1", "section-hubs.js?v=20261014-ghe-export-live-v3"]);
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
    warmDocumentResources,
    authorizedPage,
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
  // Anticipate a user's next click on any authorized application or same-site link.
  function warmInteraction(event) {
    if (!localStorage.getItem("stip_session_v1") || !window.STIPSession ||
        window.STIPPreview?.active || document.hidden) return;
    if (!canPrefetchInBackground()) return;
    const button = event.target.closest?.("[data-app]");
    if (button && authorizedPage(button.dataset.app)) {
      rememberIntent(button.dataset.app);
      const page = DOCUMENT_APP_TARGET[button.dataset.app];
      if (page) void warmDocumentResources(new URL(page, location.href).pathname);
      return;
    }
    const anchor = event.target.closest?.("a[href]");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const target = documentUrl(anchor.href);
    if (target && /\.html?$/i.test(target.pathname))
      void warmDocumentResources(target.pathname);
  }
  document.addEventListener("pointerover", warmInteraction, { passive: true, capture: true });
  document.addEventListener("focusin", warmInteraction, true);
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest?.('[data-home-mode="tableau"]'))
        communication().catch(() => {});
      const b = e.target.closest?.("[data-app]");
      if (!b) return;
      const k = b.dataset.app;
      const documentTarget = DOCUMENT_APP_TARGET[k];
      if (documentTarget && authorizedPage(k)) {
        rememberIntent(k);
        void warmDocumentResources(new URL(documentTarget, location.href).pathname);
      }
      if (k === "communication") communication().catch(() => {});
      if (k === "contacts") {
        window.STIPReadCache?.requestContacts?.();
        seq(["agent-agenda-view.js?v=20260928-icon-registry1", "section-hubs.js?v=20261014-ghe-export-live-v3"]).catch(() => {});
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


