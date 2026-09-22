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
    viewportHandler: null,
    viewportHeight: 0,
    draft: "",
    draftKind: "spot",
  };

  const homeState = {
    button: null,
    timer: null,
    loading: false,
    data: null,
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

  const BUILDINGS = [
    { key: "neuro", label: "Neuro", aliases: ["neuro", "pierre wertheimer", "wertheimer", "pw"] },
    { key: "cardio", label: "Cardio", aliases: ["cardio", "louis pradel", "pradel", "hlp"] },
    { key: "hfme", label: "HFME", aliases: ["hfme", "femme mere enfant", "femme mère enfant", "mere enfant", "mère enfant"] },
    { key: "a4", label: "POP (A4)", aliases: ["pop", "a4", "pop a4", "batiment pop", "bâtiment pop", "batiment a4", "bâtiment a4"] },
  ];

  const norm = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  function buildingForMessage(message = {}) {
    const explicit = String(message.payload?.wheelchair?.building || "").trim();
    if (explicit && BUILDINGS.some((building) => building.key === explicit)) return explicit;
    const body = norm(message.body || "");
    return (
      BUILDINGS.find((building) =>
        building.aliases.some((alias) => {
          const clean = norm(alias);
          return body === clean || body.startsWith(clean + " ") || body.includes(" " + clean + " ");
        }),
      )?.key || ""
    );
  }

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
        message.payload?.wheelchair?.status || "",
        message.payload?.wheelchair?.resolved_at || "",
        message.payload?.wheelchair?.resolved_by_name || "",
      ]),
    );
  }

  function pageMarkup() {
    return (
      '<section class="tb-page">' +
      '<section class="tb-inline-head">' +
      '<div><small>FAUTEUILS</small><h2>Recherche & signalements</h2><p>Fil terrain du jour</p></div>' +
      '<div class="tb-inline-actions"><span class="tb-active-count" data-active-count hidden></span><span class="tb-readonly" data-readonly hidden>Lecture seule</span><button type="button" class="tb-manage" data-select hidden>Gérer</button></div>' +
      "</section>" +
      '<section class="tb-search-shortcuts" data-search-shortcuts aria-label="Recherche rapide par bâtiment"></section>' +
      '<main class="tb-dialogue" data-feed aria-live="polite"></main>' +
      '<section class="tb-selection-bar" data-selection-bar hidden>' +
      '<button type="button" data-select-all>Tout sélectionner</button>' +
      '<strong data-selection-count>0</strong>' +
      '<button type="button" class="danger" data-delete-selected>Supprimer</button>' +
      '<button type="button" data-selection-close>Annuler</button>' +
      "</section>" +
      '<form class="tb-composer" data-form>' +
      '<textarea name="body" rows="1" maxlength="2000" placeholder="Ex. 4 fauteuils · P8 couloir fond" aria-label="Signaler des fauteuils"></textarea>' +
      '<button type="submit" class="tb-send" aria-label="Signaler">↑</button>' +
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
      const textarea = root.querySelector("textarea");
      if (textarea && state.draft) {
        textarea.value = state.draft;
        autoGrow(textarea);
      }
    }
    state.focusAfterLoad = !!options.focus;
    bindViewport();
    syncViewport();
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
    unbindViewport();
  }

  function syncComposerDock() {
    if (!state.root) return;
    const composer = state.root.querySelector(".tb-composer");
    if (!composer || !state.root.classList.contains("is-composing")) return;

    const viewport = window.visualViewport;
    const layoutHeight = Math.max(
      Math.round(document.documentElement?.clientHeight || 0),
      Math.round(window.innerHeight || 0),
    );
    const visualBottom = viewport
      ? Math.round(viewport.offsetTop + viewport.height)
      : layoutHeight;
    const hiddenByKeyboard = Math.max(0, layoutHeight - visualBottom);
    const keyboardInset = hiddenByKeyboard > 140 ? hiddenByKeyboard : 0;

    state.root.style.setProperty("--tb-keyboard-inset", keyboardInset + "px");
    state.root.style.setProperty(
      "--tb-composer-height",
      Math.ceil(composer.getBoundingClientRect().height) + "px",
    );
  }

  function syncViewport() {
    if (!state.root) return;
    const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
    if (height > 0 && Math.abs(height - state.viewportHeight) >= 3) {
      state.viewportHeight = height;
      state.root.style.setProperty("--tb-viewport-height", height + "px");
    }
    syncComposerDock();
  }

  function bindViewport() {
    if (state.viewportHandler || !window.visualViewport) return;
    state.viewportHandler = () => {
      syncViewport();
    };
    window.visualViewport.addEventListener("resize", state.viewportHandler, { passive: true });
    window.visualViewport.addEventListener("scroll", state.viewportHandler, { passive: true });
  }

  function unbindViewport() {
    if (!state.viewportHandler || !window.visualViewport) return;
    window.visualViewport.removeEventListener("resize", state.viewportHandler);
    window.visualViewport.removeEventListener("scroll", state.viewportHandler);
    state.viewportHandler = null;
    state.viewportHeight = 0;
  }

  function bind(root) {
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
    textarea?.addEventListener("input", () => {
      state.draft = textarea.value;
      if (!textarea.value.trim()) state.draftKind = "spot";
      autoGrow(textarea);
    });
    textarea?.addEventListener("focus", () => {
      root.classList.add("is-composing");
      syncViewport();
      [60, 180, 360].forEach((delay) => {
        setTimeout(() => {
          if (!root.isConnected || document.activeElement !== textarea) return;
          syncViewport();
        }, delay);
      });
    });
    textarea?.addEventListener("blur", () => {
      setTimeout(() => {
        const composer = root.querySelector(".tb-composer");
        if (!root.isConnected || composer?.contains(document.activeElement)) return;
        root.classList.remove("is-composing");
        root.style.removeProperty("--tb-keyboard-inset");
        root.style.removeProperty("--tb-composer-height");
      }, 220);
    });

    root.addEventListener("click", (event) => {
      const building = event.target.closest?.("[data-building-compose]");
      if (building) {
        event.preventDefault();
        composeSearch(String(building.dataset.buildingCompose || ""));
        return;
      }
      const photo = event.target.closest?.("[data-photo-url]");
      if (photo) {
        event.stopPropagation();
        openPhoto(photo.dataset.photoUrl);
        return;
      }
      const resolve = event.target.closest?.("[data-resolve]");
      if (resolve) {
        event.preventDefault();
        resolveWheelchair(resolve.dataset.resolve);
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
      homeState.data = data;
      renderHomeStatus();
      const active = activeWheelchairs(data);
      const activeLabel = state.root.querySelector("[data-active-count]");
      if (activeLabel) {
        activeLabel.hidden = active < 1;
        activeLabel.textContent = active + " actif" + (active > 1 ? "s" : "");
      }
      renderSearchShortcuts();
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

  function isPluralSignal(message = {}) {
    const body = String(message.body || "").trim();
    const explicit = body.match(/^(\d{1,2})\s*(?:fauteuils?|fauteuil|f\b)/i);
    if (explicit) return Number(explicit[1]) > 1;
    const shorthand = body.match(/^(\d{1,2})\s+(?!(?:e|eme|ème|er)\b)/i);
    return shorthand ? Number(shorthand[1]) > 1 : false;
  }

  function renderSearchShortcuts() {
    const host = state.root?.querySelector("[data-search-shortcuts]");
    if (!host) return;
    host.innerHTML =
      '<div class="tb-search-shortcuts-head"><strong>Où cherches-tu le fauteuil ?</strong><small>Choisis le bâtiment : le message se prépare, puis appuie sur ↑.</small></div>' +
      '<div class="tb-search-shortcuts-grid">' +
      BUILDINGS.map(
        (building) =>
          '<button type="button" class="tb-search-shortcut" data-building-compose="' +
          esc(building.key) +
          '"><strong>' +
          esc(building.label) +
          "</strong></button>",
      ).join("") +
      "</div>";
  }

  function composeSearch(key) {
    const building = BUILDINGS.find((item) => item.key === key);
    const textarea = state.root?.querySelector(".tb-composer textarea");
    if (!building || !textarea) return;
    const text = "Je cherche un fauteuil · " + building.label;
    state.draftKind = "search";
    state.draft = text;
    textarea.value = text;
    autoGrow(textarea);
    textarea.focus();
    textarea.setSelectionRange(text.length, text.length);
  }

  function renderMessages() {
    const feed = state.root?.querySelector("[data-feed]");
    if (!feed) return;

    const messages = state.data?.messages || [];
    const me = String(state.data?.me?.id || "");

    if (!messages.length) {
      feed.innerHTML =
        '<section class="tb-empty-state"><strong>Aucun message pour l’instant</strong><p>Signale un fauteuil, ou utilise un raccourci pour dire où tu en cherches un.</p></section>';
      updateSelectionBar();
      return;
    }

    const html = [];
    for (const message of messages) {
      const id = String(message.id);
      const mine = String(message.sender_agent_id) === me;
      const checked = state.selected.has(id);
      const photo = message.payload?.photo_url || "";
      const wheelchair = message.payload?.wheelchair || null;
      const resolved = wheelchair?.status === "resolved";
      const activeSignal = wheelchair?.status === "active";
      const searchSignal = activeSignal && wheelchair?.type === "search";

      html.push(
        '<article class="tb-entry ' +
          (mine ? "is-mine" : "") +
          (activeSignal ? " is-wheelchair" : "") +
          (searchSignal ? " is-search" : "") +
          (resolved ? " is-resolved" : "") +
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

      if (activeSignal) {
        html.push(
          '<span class="tb-status-chip' +
            (searchSignal ? " is-search" : "") +
            '">' +
            (searchSignal ? "Recherche" : "À récupérer") +
            "</span>",
        );
      }
      if (message.body) {
        html.push(
          '<p class="' + (activeSignal || resolved ? "tb-location-line" : "") + '">' +
            esc(message.body).replace(/\n/g, "<br>") +
          "</p>",
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
      if (activeSignal && !state.selection && state.data?.can_write !== false && state.data?.access_mode !== "read") {
        html.push(
          '<button type="button" class="tb-resolve' +
            (searchSignal ? " is-search" : "") +
            '" data-resolve="' +
            esc(id) +
            '"><span aria-hidden="true">✓</span><strong>' +
            (searchSignal
              ? "J’ai trouvé"
              : (isPluralSignal(message) ? "Je les prends" : "Je le prends")) +
            "</strong></button>",
        );
      } else if (resolved) {
        const wasSearch = wheelchair?.type === "search";
        html.push(
          '<div class="tb-resolved-line"><span aria-hidden="true">✓</span><strong>' +
            (wasSearch ? "Trouvé" : "Pris") +
            (wheelchair.resolved_at ? " à " + esc(fmtTime(wheelchair.resolved_at)) : "") +
            "</strong>" +
            (wheelchair.resolved_by_name ? "<small>" + esc(wheelchair.resolved_by_name) + "</small>" : "") +
            "</div>",
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
      await api("team_send", {
        body,
        wheelchair: { type: state.draftKind === "search" ? "search" : "spot" },
      });
      textarea.value = "";
      state.draft = "";
      state.draftKind = "spot";
      autoGrow(textarea);
      await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
      textarea.focus();
    } catch (error) {
      alert(error.message || "Publication impossible.");
    } finally {
      button.disabled = false;
    }
  }

  async function resolveWheelchair(messageId) {
    if (!messageId) return;
    const button = state.root?.querySelector('[data-resolve="' + CSS.escape(String(messageId)) + '"]');
    if (button) button.disabled = true;
    try {
      await api("team_resolve", { message_id: String(messageId) });
      await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
    } catch (error) {
      alert(error.message || "Impossible de confirmer la prise du fauteuil.");
      if (button) button.disabled = false;
    }
  }

  function activeWheelchairs(data) {
    return (data?.messages || []).filter(
      (message) => message?.payload?.wheelchair?.status === "active",
    ).length;
  }

  function renderHomeStatus() {
    const button = homeState.button;
    if (!button?.isConnected) return;
    const count = activeWheelchairs(homeState.data);
    const badge = button.querySelector("[data-wheelchair-count]");
    button.classList.toggle("has-live", count > 0);
    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.setAttribute(
        "aria-label",
        count + " signalement" + (count > 1 ? "s" : "") + " fauteuil actif" + (count > 1 ? "s" : ""),
      );
    }
  }

  async function loadHomeStatus(quiet = true) {
    if (!homeState.button?.isConnected || homeState.loading) return;
    homeState.loading = true;
    try {
      homeState.data = await api("team_thread");
      renderHomeStatus();
    } catch (error) {
      if (!quiet) console.error(error);
    } finally {
      homeState.loading = false;
    }
  }

  function stopHomeStatus() {
    if (homeState.timer) clearInterval(homeState.timer);
    homeState.timer = null;
    homeState.button = null;
    homeState.data = null;
  }

  function bindHomeButton(button) {
    if (!button) {
      stopHomeStatus();
      return;
    }
    if (homeState.button !== button) {
      if (homeState.timer) clearInterval(homeState.timer);
      homeState.button = button;
      renderHomeStatus();
      loadHomeStatus(true);
      homeState.timer = setInterval(() => {
        if (!homeState.button?.isConnected) return stopHomeStatus();
        if (!document.hidden) loadHomeStatus(true);
      }, 5000);
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
    const visible = messages;
    const count = messages.length;

    const rows = visible
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
    stopHomeStatus();
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
    bindHomeButton,
    refresh: () => loadFull(false),
    stop: stopAll,
  };

  window.STIPTableau = apiSurface;
  window.STIPTeamChat = apiSurface;
})();