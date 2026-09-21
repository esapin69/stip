(() => {
  "use strict";

  const API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
  const STORE = "stip_session_v1";
  const PRIVACY_KEY = "stip_tableau_privacy_seen_v1";

  const state = {
    root: null,
    data: null,
    timer: null,
    loading: false,
    selection: false,
    selected: new Set(),
    lastSignature: "",
    focusAfterLoad: false,
  };

  const previewState = {
    root: null,
    data: null,
    timer: null,
    loading: false,
    signature: "",
  };

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const token = () => localStorage.getItem(STORE) || "";

  async function api(action, body = {}) {
    const response = await fetch(API, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-stip-session": token(),
      },
      body: JSON.stringify({ action, ...body }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.error) {
      throw Error(
        typeof json.error === "string"
          ? json.error
          : json.error?.message || "Tableau STIP indisponible.",
      );
    }
    return json;
  }

  function fmtTime(value) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function agentName(agent = {}) {
    return (
      agent.nickname ||
      [agent.prenom, agent.nom].filter(Boolean).join(" ").trim() ||
      "Agent"
    );
  }

  function avatar(agent = {}) {
    const src =
      agent.profile_photo_url ||
      agent.avatar_signed_url ||
      agent.avatar_url ||
      "";
    const initials =
      ((agent.prenom?.[0] || "") + (agent.nom?.[0] || "")).toUpperCase() ||
      String(agentName(agent)).slice(0, 2).toUpperCase() ||
      "ST";
    return (
      '<span class="tb-avatar" data-avatar-fallback="' +
      esc(initials) +
      '">' +
      (src
        ? '<img src="' + esc(src) + '" alt="" loading="lazy">'
        : esc(initials)) +
      "</span>"
    );
  }

  function dataSignature(data) {
    return JSON.stringify(
      (data?.messages || []).map((message) => [
        message.id,
        message.created_at,
        message.body,
        message.payload?.photo_url || "",
      ]),
    );
  }

  function pageMarkup() {
    return (
      '<section class="tb-page">' +
      '<header class="tb-page-head">' +
      '<button type="button" class="tb-back" data-close aria-label="Retour">‹</button>' +
      '<div class="tb-page-title"><small>AUJOURD’HUI</small><h2>Tableau STIP</h2></div>' +
      '<span class="tb-readonly" data-readonly hidden>Lecture seule</span>' +
      '<button type="button" class="tb-manage" data-select hidden>Gérer</button>' +
      "</header>" +
      '<main class="tb-dialogue" data-feed aria-live="polite"></main>' +
      '<section class="tb-selection-bar" data-selection-bar hidden>' +
      '<button type="button" data-select-all>Tout sélectionner</button>' +
      '<strong data-selection-count>0</strong>' +
      '<button type="button" class="danger" data-delete-selected>Supprimer</button>' +
      '<button type="button" data-selection-close>Annuler</button>' +
      "</section>" +
      '<form class="tb-composer" data-form>' +
      '<textarea name="body" rows="1" maxlength="2000" placeholder="Écrire…" aria-label="Écrire au Tableau STIP"></textarea>' +
      '<button type="submit" class="tb-send" aria-label="Envoyer">↑</button>' +
      "</form>" +
      "</section>"
    );
  }

  function mount(root, options = {}) {
    if (!root) return;
    if (state.root !== root) {
      stopFull();
      state.root = root;
      state.data = null;
      state.selection = false;
      state.selected.clear();
      state.lastSignature = "";
      root.innerHTML = pageMarkup();
      bind(root);
    }
    state.focusAfterLoad = !!options.focus;
    loadFull(false);
    if (!state.timer) {
      state.timer = setInterval(() => {
        if (!state.root?.isConnected) {
          unmountFull();
          return;
        }
        if (!document.hidden) loadFull(true);
      }, 3000);
    }
  }

  function stopFull() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function bind(root) {
    root.querySelector("[data-close]")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("stip:tableau-close"));
    });
    root.querySelector("[data-select]")?.addEventListener("click", () =>
      toggleSelection(true),
    );
    root
      .querySelector("[data-selection-close]")
      ?.addEventListener("click", () => toggleSelection(false));
    root
      .querySelector("[data-select-all]")
      ?.addEventListener("click", selectAll);
    root
      .querySelector("[data-delete-selected]")
      ?.addEventListener("click", deleteSelected);
    root.querySelector("[data-form]")?.addEventListener("submit", send);

    const textarea = root.querySelector("textarea");
    textarea?.addEventListener("input", () => autoGrow(textarea));

    root.addEventListener("click", (event) => {
      const photo = event.target.closest?.("[data-photo-url]");
      if (photo) {
        event.stopPropagation();
        openPhoto(photo.dataset.photoUrl);
      }
    });
  }

  function autoGrow(element) {
    if (!element) return;
    element.style.height = "auto";
    element.style.height =
      Math.min(120, Math.max(46, element.scrollHeight)) + "px";
  }

  async function loadFull(quiet = false) {
    if (state.loading || !state.root) return;
    state.loading = true;
    try {
      const data = await api("team_thread");
      state.data = data;

      const canWrite =
        data.can_write !== false && data.access_mode !== "read";
      const messages = data.messages || [];
      const manage = state.root.querySelector("[data-select]");
      if (manage) manage.hidden = !data.admin || !messages.length;

      const form = state.root.querySelector("[data-form]");
      if (form) form.hidden = !canWrite;
      const readonly = state.root.querySelector("[data-readonly]");
      if (readonly) readonly.hidden = canWrite;

      if ((!data.admin || !messages.length) && state.selection) {
        state.selection = false;
        state.selected.clear();
      }

      const signature =
        dataSignature(data) + "|" + String(data.access_mode || "");
      if (!quiet || signature !== state.lastSignature) {
        state.lastSignature = signature;
        renderMessages();
      }

      if (state.focusAfterLoad && canWrite) {
        state.focusAfterLoad = false;
        requestAnimationFrame(() => state.root?.querySelector("textarea")?.focus());
      }
    } catch (error) {
      if (!quiet && state.root) {
        const feed = state.root.querySelector("[data-feed]");
        if (feed)
          feed.innerHTML =
            '<p class="tb-error">' + esc(error.message) + "</p>";
      }
    } finally {
      state.loading = false;
    }
  }

  function renderMessages() {
    const feed = state.root?.querySelector("[data-feed]");
    if (!feed) return;

    const messages = state.data?.messages || [];
    const me = String(state.data?.me?.id || "");

    if (!messages.length) {
      feed.innerHTML = "";
      updateSelectionBar();
      return;
    }

    const html = [];
    for (const message of messages) {
      const id = String(message.id);
      const mine = String(message.sender_agent_id) === me;
      const checked = state.selected.has(id);
      const photo = message.payload?.photo_url || "";

      html.push(
        '<article class="tb-entry ' +
          (mine ? "is-mine" : "") +
          (checked ? " is-selected" : "") +
          '" data-message-id="' +
          esc(id) +
          '">',
      );

      if (state.selection) {
        html.push(
          '<label class="tb-check"><input type="checkbox" data-message-check="' +
            esc(id) +
            '"' +
            (checked ? " checked" : "") +
            '><span>✓</span></label>',
        );
      }

      html.push(avatar(message.sender));
      html.push('<div class="tb-entry-body">');
      html.push(
        '<header><strong>' +
          esc(agentName(message.sender)) +
          "</strong><time>" +
          esc(fmtTime(message.created_at)) +
          "</time></header>",
      );

      if (message.body) {
        html.push(
          "<p>" + esc(message.body).replace(/\n/g, "<br>") + "</p>",
        );
      }
      if (photo) {
        html.push(
          '<button type="button" class="tb-photo" data-photo-url="' +
            esc(photo) +
            '"><img src="' +
            esc(photo) +
            '" alt="Photo publiée"></button>',
        );
      }
      html.push("</div></article>");
    }

    feed.innerHTML = html.join("");

    feed.querySelectorAll("[data-message-check]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = String(input.dataset.messageCheck || "");
        if (input.checked) state.selected.add(id);
        else state.selected.delete(id);
        renderMessages();
      });
    });

    updateSelectionBar();
    if (!state.selection) {
      requestAnimationFrame(() => {
        feed.scrollTop = feed.scrollHeight;
      });
    }
  }

  function toggleSelection(enabled) {
    if (!state.data?.admin) return;
    state.selection = !!enabled;
    if (!enabled) state.selected.clear();
    renderMessages();
  }

  function selectAll() {
    const messages = state.data?.messages || [];
    if (state.selected.size === messages.length) state.selected.clear();
    else messages.forEach((message) => state.selected.add(String(message.id)));
    renderMessages();
  }

  function updateSelectionBar() {
    const bar = state.root?.querySelector("[data-selection-bar]");
    const count = state.root?.querySelector("[data-selection-count]");
    const manage = state.root?.querySelector("[data-select]");
    if (!bar || !count) return;

    const total = state.data?.messages?.length || 0;
    bar.hidden = !state.selection;
    count.textContent = String(state.selected.size);

    if (manage) {
      manage.hidden = !state.data?.admin || !total;
      manage.textContent = state.selection ? "Sélection" : "Gérer";
    }

    const deleteButton = bar.querySelector("[data-delete-selected]");
    if (deleteButton) deleteButton.disabled = !state.selected.size;
  }

  async function deleteSelected() {
    const ids = [...state.selected];
    if (!ids.length) return;

    const confirmed = await confirmDelete(ids.length);
    if (!confirmed) return;

    try {
      await api("team_delete", { message_ids: ids });
      state.selected.clear();
      state.selection = false;
      await Promise.all([loadFull(false), loadPreview(false)]);
    } catch (error) {
      alert(error.message || "Suppression impossible.");
    }
  }

  function confirmDelete(count) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      wrap.innerHTML =
        '<section class="tb-confirm">' +
        '<div class="tb-confirm-icon">🗑️</div>' +
        "<h3>Supprimer définitivement ?</h3>" +
        "<p>" +
        count +
        " message" +
        (count > 1 ? "s" : "") +
        " sera" +
        (count > 1 ? "ont" : "") +
        " effacé" +
        (count > 1 ? "s" : "") +
        ".</p>" +
        '<div class="tb-confirm-actions">' +
        '<button type="button" data-no><span>❌</span><strong>Annuler</strong></button>' +
        '<button type="button" class="ok" data-yes><span>✔️</span><strong>Confirmer</strong></button>' +
        "</div></section>";
      document.body.appendChild(wrap);

      const done = (value) => {
        wrap.remove();
        resolve(value);
      };
      wrap.querySelector("[data-no]").onclick = () => done(false);
      wrap.querySelector("[data-yes]").onclick = () => done(true);
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) done(false);
      });
    });
  }

  async function send(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const textarea = form.elements.body;
    const body = String(textarea.value || "").trim();
    if (!body) return;
    if (!(await ensurePrivacy())) return;

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api("team_send", { body });
      textarea.value = "";
      autoGrow(textarea);
      await Promise.all([loadFull(false), loadPreview(false)]);
      textarea.focus();
    } catch (error) {
      alert(error.message || "Publication impossible.");
    } finally {
      button.disabled = false;
    }
  }

  async function ensurePrivacy() {
    try {
      if (localStorage.getItem(PRIVACY_KEY) === "1") return true;
    } catch {}

    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      wrap.innerHTML =
        '<section class="tb-confirm tb-privacy">' +
        '<div class="tb-confirm-icon">🔒</div>' +
        "<h3>Avant d’écrire</h3>" +
        "<p>Aucune donnée patient, information médicale nominative, photo d’écran ou document identifiable.</p>" +
        '<div class="tb-confirm-actions">' +
        '<button type="button" data-no><span>❌</span><strong>Annuler</strong></button>' +
        '<button type="button" class="ok" data-yes><span>✔️</span><strong>Compris</strong></button>' +
        "</div></section>";
      document.body.appendChild(wrap);

      const done = (value) => {
        if (value) {
          try {
            localStorage.setItem(PRIVACY_KEY, "1");
          } catch {}
        }
        wrap.remove();
        resolve(value);
      };
      wrap.querySelector("[data-no]").onclick = () => done(false);
      wrap.querySelector("[data-yes]").onclick = () => done(true);
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) done(false);
      });
    });
  }

  function previewText(message) {
    const body = String(message?.body || "").trim();
    if (body) return body;
    if (message?.payload?.photo_url) return "Photo";
    return "";
  }

  function sizeClass(count) {
    if (!count) return "is-empty";
    if (count <= 2) return "is-short";
    if (count <= 4) return "is-medium";
    return "is-full";
  }

  function previewMarkup(data) {
    const messages = data?.messages || [];
    const canWrite =
      data?.can_write !== false && data?.access_mode !== "read";
    const recent = messages.slice(-12);
    const count = messages.length;

    const rows = recent
      .map(
        (message) =>
          '<div class="tb-board-line">' +
          '<b>' +
          esc(agentName(message.sender)) +
          "</b>" +
          '<span>' +
          esc(previewText(message)) +
          "</span>" +
          '<time>' +
          esc(fmtTime(message.created_at)) +
          "</time>" +
          "</div>",
      )
      .join("");

    return (
      '<section class="tb-home-board ' +
      sizeClass(count) +
      '" aria-label="Tableau STIP">' +
      '<div class="tb-board-frame">' +
      '<div class="tb-board-plaque">TABLEAU STIP</div>' +
      '<div class="tb-board-surface" data-board-open tabindex="0" role="button">' +
      (rows ? '<div class="tb-board-lines">' + rows + "</div>" : "") +
      '<button type="button" class="tb-board-write" data-board-focus>' +
      (canWrite ? "Écrire" : "Ouvrir") +
      "</button>" +
      "</div>" +
      "</div>" +
      "</section>"
    );
  }

  function renderPreview() {
    if (!previewState.root) return;
    previewState.root.innerHTML = previewMarkup(previewState.data || {});
  }

  async function loadPreview(quiet = false) {
    if (!previewState.root || previewState.loading) return;
    previewState.loading = true;
    try {
      const data = await api("team_thread");
      previewState.data = data;
      const signature =
        dataSignature(data) + "|" + String(data.access_mode || "");
      if (!quiet || signature !== previewState.signature) {
        previewState.signature = signature;
        renderPreview();
      }
    } catch (error) {
      if (!quiet && previewState.root) {
        previewState.root.innerHTML =
          '<section class="tb-home-board is-error"><div class="tb-board-frame"><div class="tb-board-plaque">TABLEAU STIP</div><div class="tb-board-surface"></div></div></section>';
      }
    } finally {
      previewState.loading = false;
    }
  }

  function mountPreview(root) {
    if (!root) return;

    if (previewState.root !== root) {
      stopPreview();
      previewState.root = root;
      previewState.data = null;
      previewState.signature = "";
      root.innerHTML =
        '<section class="tb-home-board is-loading"><div class="tb-board-frame"><div class="tb-board-plaque">TABLEAU STIP</div><div class="tb-board-surface"></div></div></section>';

      root.onclick = (event) => {
        const open = event.target.closest?.("[data-board-open]");
        if (!open) return;
        const focus = !!event.target.closest?.("[data-board-focus]");
        window.dispatchEvent(
          new CustomEvent("stip:tableau-open", { detail: { focus } }),
        );
      };

      root.onkeydown = (event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          event.target.closest?.("[data-board-open]")
        ) {
          event.preventDefault();
          window.dispatchEvent(
            new CustomEvent("stip:tableau-open", { detail: { focus: false } }),
          );
        }
      };
    }

    loadPreview(false);

    if (!previewState.timer) {
      previewState.timer = setInterval(() => {
        if (!previewState.root?.isConnected) {
          unmountPreview();
          return;
        }
        if (!document.hidden) loadPreview(true);
      }, 3000);
    }
  }

  function stopPreview() {
    if (previewState.timer) clearInterval(previewState.timer);
    previewState.timer = null;
  }

  function unmountPreview() {
    stopPreview();
    previewState.root = null;
    previewState.data = null;
    previewState.signature = "";
  }

  function unmountFull() {
    stopFull();
    state.root = null;
    state.data = null;
    state.selection = false;
    state.selected.clear();
    state.lastSignature = "";
    state.focusAfterLoad = false;
  }

  function stopAll() {
    unmountFull();
    unmountPreview();
  }

  function openPhoto(url) {
    if (!url) return;
    const wrap = document.createElement("div");
    wrap.className = "tb-lightbox";
    wrap.innerHTML =
      '<button type="button" aria-label="Fermer">×</button><img src="' +
      esc(url) +
      '" alt="Photo">';
    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelector("button").onclick = close;
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) close();
    });
  }

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const host = image.closest?.(".tb-avatar");
      if (!host) return;
      host.textContent = host.dataset.avatarFallback || "ST";
    },
    true,
  );

  window.addEventListener("stip:session-ended", stopAll);

  const apiSurface = {
    mount,
    mountPreview,
    unmountFull,
    unmountPreview,
    refresh: () => loadFull(false),
    stop: stopAll,
  };

  window.STIPTableau = apiSurface;
  window.STIPTeamChat = apiSurface;
})();