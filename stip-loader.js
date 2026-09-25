(() => {
  "use strict";
  const loaded = new Map(),
    loadedStyles = new Map(),
    V = "20260925-home-perf1";
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
  const personalCore = [
    "agent-agenda-view.js?v=20260924-month-template2",
    "calendar-subscriptions.js",
    "calendar-responsable-gate.js",
    "planning-home.js?v=20260924-month-template2",
    "planning-month-hero.js",
    "planning-print-reference.js",
  ];
  const personalExtras = [
    "agent-week-view.js",
    "planning-agenda-extras.js",
    "change-permission-gate.js",
    "day-workflow.js",
    "day-workflow-leave.js",
    "day-workflow-home-bridge.js",
  ];
  const teamCore = [
    "agent-agenda-view.js?v=20260924-month-template2",
    "planning-home.js?v=20260924-month-template2",
    "planning-hub-enhance.js",
  ];
  const teamExtras = [
    "calendar-subscriptions.js",
    "calendar-responsable-gate.js",
  ];
  const changeCore = [
    "planning-home.js?v=20260924-month-template2",
    "change-workflow.js",
    "change-permission-gate.js",
    "staffing-guidance.js",
  ];
  let busyRoute = "",
    tableauPromise = null;
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
  async function ensureRoute(r) {
    r = String(r || "");
    if (!r) return;
    if (r.startsWith("contacts")) {
      window.STIPReadCache?.requestContacts?.();
      await seq(["agent-agenda-view.js?v=20260924-month-template2", "section-hubs.js"]);
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
    idle: later,
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
  }
  if ("requestIdleCallback" in window)
    requestIdleCallback(idle, { timeout: 2200 });
  else setTimeout(idle, 900);
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest?.('[data-home-mode="tableau"]'))
        tableau().catch(() => {});
      const b = e.target.closest?.("[data-app]");
      if (!b) return;
      const k = b.dataset.app;
      if (k === "responsable") {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.href = "/responsable.html";
        document.head.appendChild(l);
        return;
      }
      if (k === "contacts") {
        window.STIPReadCache?.requestContacts?.();
        seq(["agent-agenda-view.js?v=20260924-month-template2", "section-hubs.js"]).catch(() => {});
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
