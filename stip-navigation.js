(() => {
  "use strict";
  if (!window.__STIPActivityRuntimeRequested) {
    window.__STIPActivityRuntimeRequested = true;
    const activityScript = document.createElement("script");
    activityScript.src = "/activity-runtime.js?v=20260924-history2";
    activityScript.async = true;
    document.head.appendChild(activityScript);
  }

  if (!window.__STIPWorkspaceRequested) {
    window.__STIPWorkspaceRequested = true;
    const workspaceScript = document.createElement("script");
    workspaceScript.src = "/stip-workspace.js?v=20260924-workspace2";
    workspaceScript.async = true;
    document.head.appendChild(workspaceScript);
  }

  const STORE = "stip_navigation_context_v2";
  const MAX_AGE = 12 * 60 * 60 * 1000;
  const PREFETCH_LIMIT = 4;
  const prefetches = new Map();
  let continuityPromise = null;
  let hooks = null;
  let restored = false;

  function ensureContinuity() {
    if (window.STIPContinuity) return Promise.resolve(window.STIPContinuity);
    if (continuityPromise) return continuityPromise;
    continuityPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-stip-continuity]');
      if (existing) {
        if (window.STIPContinuity) return resolve(window.STIPContinuity);
        existing.addEventListener(
          "load",
          () => resolve(window.STIPContinuity || null),
          { once: true },
        );
        existing.addEventListener("error", () => resolve(null), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "/stip-session-continuity.js?v=20260926-continuity2";
      script.async = true;
      script.dataset.stipContinuity = "1";
      script.onload = () => resolve(window.STIPContinuity || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return continuityPromise;
  }

  function documentTarget(raw) {
    try {
      const url = new URL(String(raw || ""), location.href);
      if (url.origin !== location.origin) return null;
      if (!/^https?:$/.test(url.protocol)) return null;
      if (
        url.pathname === location.pathname &&
        url.search === location.search
      )
        return null;
      const file = url.pathname.split("/").pop() || "";
      if (file && /\.[a-z0-9]+$/i.test(file) && !/\.html?$/i.test(file))
        return null;
      url.hash = "";
      return url;
    } catch {
      return null;
    }
  }

  function prefetch(raw) {
    const url = documentTarget(raw);
    if (!url) return Promise.resolve(false);
    const key = url.pathname + url.search;
    if (prefetches.has(key)) return prefetches.get(key);
    const request = fetch(key, {
      method: "GET",
      credentials: "same-origin",
      cache: "default",
    })
      .then((response) => response.ok)
      .catch(() => false);
    prefetches.set(key, request);
    return request;
  }

  function prefetchVisible(limit = PREFETCH_LIMIT) {
    const seen = new Set();
    const targets = [];
    for (const link of document.querySelectorAll("a[href]")) {
      if (targets.length >= limit) break;
      if (link.target === "_blank" || link.hasAttribute("download")) continue;
      const url = documentTarget(link.href);
      if (!url) continue;
      const key = url.pathname + url.search;
      if (seen.has(key)) continue;
      const rect = link.getBoundingClientRect?.();
      if (rect && rect.width === 0 && rect.height === 0) continue;
      seen.add(key);
      targets.push(url.href);
    }
    targets.forEach((url) => prefetch(url));
  }

  function routeKey() {
    return location.pathname.replace(/\/+$/, "") || "/";
  }

  function familyFallback() {
    const path = location.pathname.toLowerCase();
    if (path.includes("cadre-")) return "cadre.html";
    if (path.includes("responsable-")) return "responsable.html";
    if (path.includes("agent-date-detail")) return "agent-dates.html";
    if (path.includes("agent-directory")) return "index.html#/apps";
    return "index.html";
  }

  function loadAll() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORE) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function read(key = routeKey()) {
    const saved = loadAll()[key];
    if (!saved || Date.now() - Number(saved.savedAt || 0) > MAX_AGE)
      return null;
    return saved;
  }

  function fields() {
    const values = {};
    document.querySelectorAll("[data-stip-nav-field]").forEach((field) => {
      const key = field.id || field.name || field.dataset.stipNavField;
      if (!key || field.type === "password") return;
      values[key] =
        field.type === "checkbox" || field.type === "radio"
          ? Boolean(field.checked)
          : field.value;
    });
    return values;
  }

  function genericState() {
    const panel = document.querySelector(
      '[aria-hidden="false"].open[id], [aria-hidden="false"][data-stip-panel][id]',
    );
    return {
      url: `${location.pathname}${location.search}${location.hash}`,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      fields: fields(),
      panel: panel?.id || "",
    };
  }

  function save(extra = {}) {
    const all = loadAll();
    let custom = {};
    try {
      custom = hooks?.capture?.() || {};
    } catch (error) {
      console.warn("STIP navigation capture", error);
    }
    all[routeKey()] = {
      ...(read() || {}),
      ...genericState(),
      ...custom,
      ...extra,
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(STORE, JSON.stringify(all));
    } catch {}
    return all[routeKey()];
  }

  function remember(extra = {}) {
    return save(extra);
  }

  function applyFields(saved) {
    Object.entries(saved?.fields || {}).forEach(([key, value]) => {
      const field =
        document.getElementById(key) ||
        document.querySelector(`[name="${CSS.escape(key)}"]`);
      if (!field || field.type === "password") return;
      if (field.type === "checkbox" || field.type === "radio")
        field.checked = Boolean(value);
      else field.value = value ?? "";
    });
  }

  function restoreScroll(behavior = "auto") {
    const saved = read();
    if (!saved) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        window.scrollTo({
          left: Number(saved.scrollX || 0),
          top: Number(saved.scrollY || 0),
          behavior,
        }),
      ),
    );
  }

  function restore() {
    if (restored) return read();
    const saved = read();
    if (!saved) return null;
    restored = true;
    applyFields(saved);
    try {
      hooks?.restore?.(saved);
    } catch (error) {
      console.warn("STIP navigation restore", error);
    }
    document.dispatchEvent(
      new CustomEvent("stip:navigation-restore", { detail: saved }),
    );
    restoreScroll();
    return saved;
  }

  function register(options = {}) {
    hooks = options;
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", restore, { once: true });
    else restore();
    return read();
  }

  function previousSameSite() {
    try {
      const url = new URL(document.referrer);
      return url.origin === location.origin && url.href !== location.href;
    } catch {
      return false;
    }
  }

  function canBack() {
    return history.length > 1 && previousSameSite();
  }

  function explicitReturnTarget() {
    let raw = "";
    try {
      raw = new URLSearchParams(location.search).get("return") || "";
    } catch {}
    if (!raw) return "";
    try {
      const target = new URL(raw, location.href);
      if (target.origin !== location.origin) return "";
      const current = new URL(location.href);
      if (
        target.pathname === current.pathname &&
        target.search === current.search &&
        target.hash === current.hash
      )
        return "";
      return target.pathname + target.search + target.hash;
    } catch {
      return "";
    }
  }

  function back(fallback = familyFallback()) {
    save();
    const explicit = explicitReturnTarget();
    if (explicit) {
      prefetch(explicit);
      location.replace(explicit);
      return false;
    }
    if (canBack()) {
      history.back();
      return true;
    }
    prefetch(fallback);
    location.assign(fallback);
    return false;
  }

  function go(url, context = {}) {
    save(context);
    prefetch(url);
    location.assign(url);
  }

  history.replaceState(
    { ...(history.state || {}), stip: true, stipRoute: routeKey() },
    "",
  );

  document.addEventListener(
    "click",
    (event) => {
      const backButton = event.target.closest?.(
        "[data-stip-back],#backBtn,#placesBack,#pageBack,#daBack,#ddBack,#taBack,#roExit",
      );
      if (backButton) {
        if (
          backButton.id === "placesBack" &&
          document.querySelector("#placesSearch")?.value
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        back(backButton.dataset?.backFallback || familyFallback());
        return;
      }
      const link = event.target.closest?.("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      try {
        const target = new URL(link.href, location.href);
        if (target.origin === location.origin) save();
      } catch {}
    },
    true,
  );

  const warmLink = (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download"))
      return;
    prefetch(link.href);
  };
  document.addEventListener("pointerover", warmLink, {
    passive: true,
    capture: true,
  });
  document.addEventListener("pointerdown", warmLink, {
    passive: true,
    capture: true,
  });
  document.addEventListener("focusin", warmLink, true);

  addEventListener("pagehide", () => save());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
  });
  addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    restoreScroll();
    document.dispatchEvent(
      new CustomEvent("stip:navigation-bfcache", {
        detail: { persisted: true, saved: read() },
      }),
    );
  });

  window.STIPNav = {
    back,
    canBack,
    go,
    navigate: go,
    prefetch,
    read,
    register,
    remember,
    restore,
    restoreScroll,
    save,
    session: ensureContinuity,
  };

  ensureContinuity().catch(() => null);
  const warmIdle = () => prefetchVisible();
  if ("requestIdleCallback" in window)
    requestIdleCallback(warmIdle, { timeout: 1800 });
  else setTimeout(warmIdle, 900);

  document.dispatchEvent(new CustomEvent("stip:navigation-ready"));
  const ensureQuickAccess = () => {
    const embedded =
      new URLSearchParams(location.search).has("embed") ||
      window.self !== window.top;
    if (embedded) return;
    if (document.querySelector('script[src*="quick-access-universal.js"]'))
      return;
    const script = document.createElement("script");
    script.src = "quick-access-universal.js?v=20260926-navigation2";
    script.dataset.stipQuickUniversal = "1";
    document.head.appendChild(script);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", ensureQuickAccess, {
      once: true,
    });
  else ensureQuickAccess();
})();
