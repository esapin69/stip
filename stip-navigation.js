(() => {
  "use strict";
  if (!window.__STIPActivityRuntimeRequested) {
    window.__STIPActivityRuntimeRequested = true;
    const activityScript = document.createElement("script");
    activityScript.src = "/activity-runtime.js?v=20260924-history1";
    activityScript.async = true;
    document.head.appendChild(activityScript);
  }

  const STORE = "stip_navigation_context_v2";
  const MAX_AGE = 12 * 60 * 60 * 1000;
  let hooks = null;
  let restored = false;

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

  function back(fallback = familyFallback()) {
    save();
    if (canBack()) {
      history.back();
      return true;
    }
    location.assign(fallback);
    return false;
  }

  function go(url, context = {}) {
    save(context);
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

  addEventListener("pagehide", () => save());
  addEventListener("pageshow", (event) => {
    if (event.persisted) restoreScroll();
  });

  window.STIPNav = {
    back,
    canBack,
    go,
    read,
    register,
    remember,
    restore,
    restoreScroll,
    save,
  };

  document.dispatchEvent(new CustomEvent("stip:navigation-ready"));
  const ensureQuickAccess = () => {
    if (document.querySelector('script[src*="quick-access-universal.js"]'))
      return;
    const script = document.createElement("script");
    script.src = "quick-access-universal.js?v=20260920-tomorrowapp1";
    script.dataset.stipQuickUniversal = "1";
    document.head.appendChild(script);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", ensureQuickAccess, {
      once: true,
    });
  else ensureQuickAccess();
})();
