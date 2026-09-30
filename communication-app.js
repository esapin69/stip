(() => {
  "use strict";

  const state = {
    root: null,
    tab: "chat",
    focus: false,
    conversation: "",
    message: "",
    rendering: false,
    renderPending: false,
    renderVersion: 0,
    chromeCompact: false,
    scrollHandler: null,
  };

  const TAB_META = {
    chat: { label: "Chat équipe", icon: "💬", route: "communication/chat" },
    dm: { label: "DM & groupes", icon: "✉", route: "communication/dm" },
    wheelchair: { label: "Fauteuils", icon: "♿", route: "communication/fauteuils" },
  };

  function communicationFamily() {
    const permissions = {
      ...(window.STIPBootCache?.permissions || {}),
      ...(window.STIPSession?.permissions || {}),
    };
    return String(permissions.communication_family || "brancardage")
      .trim()
      .toLowerCase();
  }

  function canUseWheelchairs() {
    return communicationFamily() === "brancardage";
  }

  function normalizeTab(value) {
    const key = String(value || "").toLowerCase();
    if (key === "fauteuils" || key === "wheelchairs")
      return canUseWheelchairs() ? "wheelchair" : "chat";
    if (key === "messages" || key === "group" || key === "groups") return "dm";
    if (key === "wheelchair" && !canUseWheelchairs()) return "chat";
    return TAB_META[key] ? key : "chat";
  }

  function tabFromRoute(route = "") {
    const value = String(route || "").replace(/^#\/?/, "");
    if (value === "fauteuils" || value.endsWith("/fauteuils")) return "wheelchair";
    if (value.endsWith("/dm")) return "dm";
    return "chat";
  }

  function routeForTab(tab) {
    return TAB_META[normalizeTab(tab)].route;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function shellMarkup() {
    const dmUnread = Math.max(0, Number(window.STIPDMUnread || 0));
    const tabs = Object.entries(TAB_META)
      .filter(([key]) => key !== "wheelchair" || canUseWheelchairs())
      .map(([key, meta]) => {
      const active = key === state.tab;
      const badge = key === "dm" && dmUnread
        ? '<b class="ca-tab-badge">' + esc(dmUnread > 99 ? "99+" : dmUnread) + "</b>"
        : "";
      return '<button type="button" class="ca-tab' + (active ? " active" : "") +
        '" data-communication-tab="' + key + '" role="tab" aria-selected="' + active +
        '"><span aria-hidden="true">' + meta.icon + '</span><strong>' + esc(meta.label) +
        "</strong>" + badge + "</button>";
    }).join("");

    return '<section class="ca-app' +
      (state.tab === "wheelchair" ? " is-wheelchair-tab" : "") +
      (state.chromeCompact ? " is-chrome-compact" : "") +
      '" data-communication-app>' +
      '<header class="ca-head">' +
        '<button type="button" class="ca-back" data-communication-close aria-label="Retour à l’accueil"><span aria-hidden="true">‹</span><strong>Accueil</strong></button>' +
        '<div class="ca-title">' +
          '<span class="ca-title-default"><strong>Communication</strong><small>STIP</small></span>' +
          '<span class="ca-title-compact"><span aria-hidden="true">♿</span><strong>Fauteuils</strong></span>' +
        '</div>' +
        '<button type="button" class="ca-bell" data-communication-notifications aria-label="Ouvrir les notifications"><span aria-hidden="true">🔔</span></button>' +
      '</header>' +
      '<nav class="ca-tabs" role="tablist" aria-label="Communication STIP">' + tabs + '</nav>' +
      '<main class="ca-body" data-communication-body><section class="ca-loading">Chargement…</section></main>' +
    '</section>';
  }

  function syncChromeCompact() {
    if (!state.root?.isConnected) return;
    const app = state.root.querySelector("[data-communication-app]");
    if (!app) return;
    if (state.tab !== "wheelchair" || window.innerWidth >= 900) {
      state.chromeCompact = false;
      app.classList.remove("is-chrome-compact");
      return;
    }
    const y = Math.max(0, window.scrollY || 0);
    const next = state.chromeCompact ? y > 12 : y > 72;
    if (next === state.chromeCompact) return;
    state.chromeCompact = next;
    app.classList.toggle("is-chrome-compact", next);
  }

  function bindShellScroll() {
    if (state.scrollHandler) {
      syncChromeCompact();
      return;
    }
    state.scrollHandler = () => syncChromeCompact();
    window.addEventListener("scroll", state.scrollHandler, { passive: true });
    window.addEventListener("resize", state.scrollHandler, { passive: true });
    syncChromeCompact();
  }

  function unbindShellScroll() {
    if (!state.scrollHandler) return;
    window.removeEventListener("scroll", state.scrollHandler);
    window.removeEventListener("resize", state.scrollHandler);
    state.scrollHandler = null;
  }

  function bindShell() {
    if (!state.root) return;
    state.root.querySelector("[data-communication-close]")?.addEventListener("click", () => {
      if (window.STIPRouter?.back) window.STIPRouter.back("home");
      else window.STIPRouter?.set?.("home");
    });
    state.root.querySelector("[data-communication-notifications]")?.addEventListener("click", () => {
      window.STIPRouter?.set?.("notifications");
    });
    state.root.querySelectorAll("[data-communication-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = normalizeTab(button.dataset.communicationTab);
        if (tab === state.tab) return;
        if (window.STIPRouter?.set) {
          window.STIPRouter.set(routeForTab(tab));
          return;
        }
        setTab(tab);
      });
    });
  }

  async function renderBody() {
    const root = state.root;
    const host = root?.querySelector("[data-communication-body]");
    if (!host) return;
    if (state.rendering) {
      state.renderPending = true;
      return;
    }

    state.rendering = true;
    const version = state.renderVersion;
    const tab = state.tab;
    const conversation = state.conversation;
    const focus = state.focus;
    const message = state.message;
    const isCurrent = () =>
      state.root === root &&
      state.renderVersion === version &&
      host.isConnected;

    try {
      if (tab === "dm") {
        window.STIPTableau?.unmountFull?.();
        if (!isCurrent()) return;
        if (!window.STIPCommunication?.mountInbox) {
          host.innerHTML = '<section class="ca-error">Messages privés indisponibles.</section>';
          return;
        }
        window.STIPCommunication.mountInbox(host, { conversation });
        if (isCurrent() && state.conversation === conversation) state.conversation = "";
        return;
      }

      window.STIPCommunication?.unmountInbox?.();
      if (!window.STIPTableau?.mount) {
        if (typeof window.STIPLoad?.tableau === "function") await window.STIPLoad.tableau();
      }
      if (!isCurrent()) return;
      if (!window.STIPTableau?.mount) {
        host.innerHTML = '<section class="ca-error">Chat indisponible.</section>';
        return;
      }
      window.STIPTableau.mount(host, {
        mode: tab === "wheelchair" ? "wheelchair" : "chat",
        focus,
        message,
      });
      if (isCurrent()) {
        if (state.focus === focus) state.focus = false;
        if (state.message === message) state.message = "";
      }
    } catch (error) {
      if (isCurrent()) {
        host.innerHTML = '<section class="ca-error">' +
          esc(error?.message || "Communication indisponible.") +
          "</section>";
      }
    } finally {
      state.rendering = false;
      if (state.renderPending) {
        state.renderPending = false;
        queueMicrotask(() => {
          if (state.root?.isConnected) renderBody();
        });
      }
    }
  }

  function render() {
    if (!state.root) return;
    state.renderVersion += 1;
    state.root.innerHTML = shellMarkup();
    bindShell();
    bindShellScroll();
    renderBody();
  }

  function mount(root, options = {}) {
    if (!root) return;
    state.root = root;
    state.tab = normalizeTab(options.tab || tabFromRoute(window.STIPRouter?.get?.() || ""));
    state.chromeCompact = false;
    state.focus = !!options.focus;
    state.conversation = String(options.conversation || "");
    state.message = String(options.message || "");
    render();
  }

  function setTab(tab, options = {}) {
    const next = normalizeTab(tab);
    if (next !== state.tab) state.chromeCompact = false;
    state.tab = next;
    if (options.focus != null) state.focus = !!options.focus;
    if (options.conversation) state.conversation = String(options.conversation);
    if (options.message) state.message = String(options.message);
    if (!state.root?.isConnected) return;
    render();
  }

  function unmount() {
    window.STIPCommunication?.unmountInbox?.();
    window.STIPTableau?.unmountFull?.();
    unbindShellScroll();
    state.renderVersion += 1;
    state.root = null;
    state.rendering = false;
    state.renderPending = false;
    state.conversation = "";
    state.message = "";
  }

  window.addEventListener("stip:messages-unread", () => {
    if (!state.root?.isConnected) return;
    const currentHost = state.root.querySelector("[data-communication-body]");
    const preserved = currentHost;
    const tabs = state.root.querySelector(".ca-tabs");
    if (!tabs) return;
    const dm = tabs.querySelector('[data-communication-tab="dm"]');
    if (!dm) return;
    dm.querySelector(".ca-tab-badge")?.remove();
    const count = Math.max(0, Number(window.STIPDMUnread || 0));
    if (count) dm.insertAdjacentHTML("beforeend", '<b class="ca-tab-badge">' + esc(count > 99 ? "99+" : count) + "</b>");
    void preserved;
  });

  window.STIPCommunicationApp = {
    build: "20260930-wheelchair-three-actions2",
    mount,
    setTab,
    unmount,
    tabFromRoute,
    routeForTab,
  };
})();
