(() => {
  "use strict";

  const state = {
    root: null,
    tab: "chat",
    focus: false,
    conversation: "",
    message: "",
    rendering: false,
  };

  const TAB_META = {
    chat: { label: "Chat équipe", icon: "💬", route: "communication/chat" },
    dm: { label: "DM & groupes", icon: "✉", route: "communication/dm" },
    wheelchair: { label: "Fauteuils", icon: "♿", route: "communication/fauteuils" },
  };

  function normalizeTab(value) {
    const key = String(value || "").toLowerCase();
    if (key === "fauteuils" || key === "wheelchairs") return "wheelchair";
    if (key === "messages" || key === "group" || key === "groups") return "dm";
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
    const tabs = Object.entries(TAB_META).map(([key, meta]) => {
      const active = key === state.tab;
      const badge = key === "dm" && dmUnread
        ? '<b class="ca-tab-badge">' + esc(dmUnread > 99 ? "99+" : dmUnread) + "</b>"
        : "";
      return '<button type="button" class="ca-tab' + (active ? " active" : "") +
        '" data-communication-tab="' + key + '" role="tab" aria-selected="' + active +
        '"><span aria-hidden="true">' + meta.icon + '</span><strong>' + esc(meta.label) +
        "</strong>" + badge + "</button>";
    }).join("");

    return '<section class="ca-app" data-communication-app>' +
      '<header class="ca-head">' +
        '<button type="button" class="ca-back" data-communication-close aria-label="Retour à l’accueil"><span aria-hidden="true">‹</span><strong>Accueil</strong></button>' +
        '<div class="ca-title"><strong>Communication</strong><small>STIP</small></div>' +
        '<button type="button" class="ca-bell" data-communication-notifications aria-label="Ouvrir les notifications"><span aria-hidden="true">🔔</span></button>' +
      '</header>' +
      '<nav class="ca-tabs" role="tablist" aria-label="Communication STIP">' + tabs + '</nav>' +
      '<main class="ca-body" data-communication-body><section class="ca-loading">Chargement…</section></main>' +
    '</section>';
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
    const host = state.root?.querySelector("[data-communication-body]");
    if (!host || state.rendering) return;
    state.rendering = true;
    try {
      if (state.tab === "dm") {
        window.STIPTableau?.unmountFull?.();
        if (!window.STIPCommunication?.mountInbox) {
          host.innerHTML = '<section class="ca-error">Messages privés indisponibles.</section>';
          return;
        }
        window.STIPCommunication.mountInbox(host, {
          conversation: state.conversation,
        });
        state.conversation = "";
        return;
      }

      window.STIPCommunication?.unmountInbox?.();
      if (!window.STIPTableau?.mount) {
        if (typeof window.STIPLoad?.tableau === "function") await window.STIPLoad.tableau();
      }
      if (!window.STIPTableau?.mount) {
        host.innerHTML = '<section class="ca-error">Chat indisponible.</section>';
        return;
      }
      window.STIPTableau.mount(host, {
        mode: state.tab === "wheelchair" ? "wheelchair" : "chat",
        focus: state.focus,
        message: state.message,
      });
      state.focus = false;
      state.message = "";
    } catch (error) {
      host.innerHTML = '<section class="ca-error">' + esc(error?.message || "Communication indisponible.") + "</section>";
    } finally {
      state.rendering = false;
    }
  }

  function render() {
    if (!state.root) return;
    state.root.innerHTML = shellMarkup();
    bindShell();
    renderBody();
  }

  function mount(root, options = {}) {
    if (!root) return;
    state.root = root;
    state.tab = normalizeTab(options.tab || tabFromRoute(window.STIPRouter?.get?.() || ""));
    state.focus = !!options.focus;
    state.conversation = String(options.conversation || "");
    state.message = String(options.message || "");
    render();
  }

  function setTab(tab, options = {}) {
    const next = normalizeTab(tab);
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
    state.root = null;
    state.rendering = false;
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
    build: "20260927-communication5",
    mount,
    setTab,
    unmount,
    tabFromRoute,
    routeForTab,
  };
})();
