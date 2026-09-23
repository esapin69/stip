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
    deleteBusy: false,
    interacting: false,
    interactionReleaseTimer: 0,
    scrollToLatestPending: true,
    lastSignature: "",
    focusAfterLoad: false,
    viewportHandler: null,
    viewportHeight: 0,
    draft: "",
    draftKind: "spot",
    composeMode: "spot",
    selectedBuilding: "",
    selectedQuantity: 0,
    selectedLevel: "",
    selectedLocation: "",
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

  // Repères compacts issus du référentiel "Visiter les lieux" / 00 MASTER (09/2026).
  // L'interface les révèle progressivement : bâtiment -> niveau -> repère.
  const WHEELCHAIR_LOCATIONS = {
    neuro: [
      { level: "RDJ", places: ["SRPR / salon d’accueil", "Psychiatrie / addictologie", "Neuro-rééducation", "HDJ artériographie / neurochirurgie"] },
      { level: "RDC", places: ["Entrée A", "Entrée B", "Hall / consultations", "Réanimation neurologique", "Radiologie / écho-Doppler", "Bureau des admissions"] },
      { level: "1er", places: ["Ascenseur 28 / imagerie", "Scanner", "IRM VENUS", "IRM JUPITER / SATURNE", "Bloc / salle de réveil", "U100", "U101", "U102", "Plateforme AIT"] },
      { level: "2e", places: ["U200", "U201", "U202", "Neuro-ophtalmo / ORL", "Service social"] },
      { level: "3e", places: ["U300", "U301", "U302"] },
      { level: "4e", places: ["U400", "U401", "U402"] },
      { level: "5e", places: ["U500", "U501", "U502 / HDJ", "EEG / ENMG"] },
      { level: "6e", places: ["Amphithéâtre Michel Jouvet", "Salle Lapras"] },
    ],
    cardio: [
      { level: "RDC", places: ["Entrée principale / hall", "Ascenseurs visiteurs", "Urgences cardio / CCU", "Plateau explorations", "Service social", "Bureau des admissions"] },
      { level: "TM", places: ["Consultations spécialisées", "Radiologie", "Scanner", "Coronarographie / PTI", "Fibroscopie", "Bloc / salle de réveil", "Réanimation adulte", "Unité d’abord vasculaire"] },
      { level: "1er", places: ["U10", "U11"] },
      { level: "2e", places: ["U20 / USIC", "U21 / soins continus"] },
      { level: "3e", places: ["U30 / rythmologie", "U31 / SICAT-transplantation"] },
      { level: "4e", places: ["U40 / Cardiologie A", "U41 / Cardiologie B"] },
      { level: "5e", places: ["U50 / chirurgie cardio-vasculaire", "Salon d’accueil J0"] },
      { level: "6e", places: ["U60 / chirurgie thoraco-pulmonaire", "U61 / HDJ cardiologie"] },
      { level: "7e", places: ["U70 / Pneumologie B", "U71 / Pneumologie C"] },
      { level: "8e", places: ["U81 / HDJ pneumologie"] },
      { level: "9e", places: ["U90 / Endocrino B-C", "U91 / Endocrino A-HDJ"] },
      { level: "10e", places: ["Salles / événements"] },
      { level: "11e", places: ["Hélistation"] },
    ],
    hfme: [
      { level: "RDJ", places: ["Urgences pédiatriques", "UHCD / USC", "Hospitalisation urgences pédiatriques", "IRM APOLLO / NEMO", "Scanner / radiologie / échographie", "Consultations gynécologie / CECOS", "Sénologie / service social"] },
      { level: "RDC", places: ["Accueil principal", "Consultations pédiatriques", "UAPED", "Bloc gynécologie / maternité", "Salles d’accouchement", "Urgences gynéco-obstétricales"] },
      { level: "1er", places: ["Réanimation pédiatrique", "Bloc pédiatrique", "Salon d’accueil de chirurgie", "ACHA / chirurgie pédiatrique"] },
      { level: "2e", places: ["Espace brancardiers / chef d’équipe", "Biberonnerie / diététique"] },
      { level: "3e", places: ["Hépato-gastro pédiatrique", "Pneumo / allergologie pédiatrique", "Pédiatrie générale", "Néonatologie / réanimation néonatale"] },
      { level: "4e", places: ["Pédiatrie générale", "Endocrino / diabéto / métabolique", "UERTD", "Maternité / suites de naissance", "Unité Kangourou", "USAP"] },
      { level: "5e", places: ["Dialyse pédiatrique", "Néphro / rhumato / dermato", "Neurologie pédiatrique", "EEG / EMG / sommeil", "Gynécologie / sénologie", "Gynécologie A-HDJ / B-ACHA", "Orthogénie / IVG"] },
      { level: "6e", places: ["Psychopathologie enfant / adolescent", "Hématologie / oncologie pédiatrique", "Consultation douleur", "Grossesse pathologique"] },
    ],
    a4: [
      { level: "RDC", places: ["POP / HDJ / chimiothérapie"] },
      { level: "1er", places: ["SEP / neuro-inflammation — conventionnel / semaine"] },
      { level: "2e", places: ["SEP / neuro-inflammation — HDJ"] },
    ],
  };

  // Repères terrain réellement utiles au signalement fauteuil.
  // Les boutons sont multi-sélectionnables : un même lot peut être dispersé.
  const WHEELCHAIR_FIELD_SPOTS = {
    cardio: {
      common: [
        { label: "Ascenseur", value: "Ascenseur", icon: "🛗", persistence: "fast" },
        { label: "Couloir", value: "Couloir", icon: "↔", persistence: "normal" },
        { label: "Tout au fond du couloir", value: "Tout au fond du couloir", icon: "↔", persistence: "sheltered" },
        { label: "Escalier", value: "Escalier", icon: "↕", persistence: "normal" },
      ],
      featured: {
        RDC: [
          { label: "Local à fauteuils", value: "Local à fauteuils", icon: "🦽", persistence: "sheltered" },
        ],
      },
    },
    neuro: {
      common: [
        { label: "Couloir isolé", value: "Couloir isolé", icon: "↔", persistence: "sheltered" },
        { label: "Couloir de passage", value: "Couloir de passage", icon: "↔", persistence: "fast" },
        { label: "Ascenseur", value: "Ascenseur", icon: "🛗", persistence: "fast" },
      ],
      featured: {
        RDC: [
          { label: "Bas escalier escargot · salle de pose", value: "Bas escalier escargot · salle de pose", icon: "↕", persistence: "sheltered" },
        ],
        "1er": [
          { label: "Local à fauteuils · côté imagerie", value: "Local à fauteuils · côté imagerie", icon: "🦽", persistence: "sheltered" },
        ],
      },
    },
    hfme: {
      common: [
        { label: "Ascenseurs · côté salle de pose STIP", value: "Ascenseurs · côté salle de pose STIP", icon: "🛗", persistence: "fast" },
        { label: "Ascenseurs · côté accouchées / bloc gynéco", value: "Ascenseurs · côté accouchées / bloc gynéco", icon: "🛗", persistence: "fast" },
        { label: "Couloir", value: "Couloir", icon: "↔", persistence: "normal" },
      ],
      featured: {
        "2e": [
          { label: "Passerelle · partie isolée", value: "Passerelle · partie isolée", icon: "↔", persistence: "sheltered" },
        ],
      },
    },
    a4: {
      common: [
        { label: "Ascenseur", value: "Ascenseur", icon: "🛗", persistence: "fast" },
        { label: "Couloir", value: "Couloir", icon: "↔", persistence: "normal" },
      ],
      featured: {},
    },
  };

  function wheelchairFieldSpots(buildingKey = "", level = "") {
    const config = WHEELCHAIR_FIELD_SPOTS[String(buildingKey || "")] || {};
    const featured = Array.isArray(config.featured?.[level]) ? config.featured[level] : [];
    const common = Array.isArray(config.common) ? config.common : [];
    const seen = new Set();
    return [
      ...featured.map((item) => ({ ...item, featured: true })),
      ...common.map((item) => ({ ...item, featured: false })),
    ].filter((item) => {
      const key = String(item.value || item.label || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }

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
        message.payload?.photo_path || "",
        message.payload?.wheelchair?.status || "",
        message.payload?.wheelchair?.resolved_at || "",
        message.payload?.wheelchair?.resolved_by_name || "",
        message.payload?.wheelchair?.quantity_total || "",
        message.payload?.wheelchair?.quantity_remaining || "",
        message.payload?.wheelchair?.last_seen_at || "",
        message.payload?.wheelchair?.persistence || "",
        JSON.stringify(message.payload?.wheelchair?.sightings || []),
        JSON.stringify(message.payload?.wheelchair?.takes || []),
        JSON.stringify(message.payload?.reactions || []),
      ]),
    );
  }

  function pageMarkup() {
    return (
      '<section class="tb-page">' +
      '<section class="tb-inline-tools" aria-label="Outils du chat">' +
      '<span class="tb-active-count" data-active-count hidden></span><span class="tb-readonly" data-readonly hidden>Lecture seule</span><button type="button" class="tb-manage" data-select hidden>Gérer</button>' +
      "</section>" +
      '<main class="tb-dialogue" data-feed aria-live="polite"></main>' +
      '<section class="tb-selection-bar" data-selection-bar hidden>' +
      '<button type="button" data-select-all>Tout sélectionner</button>' +
      '<strong data-selection-count>0</strong>' +
      '<button type="button" class="danger" data-delete-selected>Supprimer</button>' +
      '<button type="button" data-selection-close>Annuler</button>' +
      "</section>" +
      '<section class="tb-input-dock" data-input-dock>' +
      '<section class="tb-search-shortcuts" data-search-shortcuts aria-label="Actions rapides fauteuils"></section>' +
      '<form class="tb-composer" data-form>' +
      '<div class="tb-composer-main">' +
      '<div class="tb-draft-preview" data-draft-preview hidden></div>' +
      '<button type="button" class="tb-free-toggle" data-free-toggle>✎ Écrire librement</button>' +
      '<textarea name="body" rows="1" maxlength="2000" placeholder="Écrire ou préciser…" aria-label="Précision ou message libre" hidden></textarea>' +
      "</div>" +
      '<button type="submit" class="tb-send" data-send disabled><span>Envoyer</span><b>↑</b></button>' +
      "</form>" +
      "</section>" +
      "</section>"
    );
  }

  function mount(root, options = {}) {
    if (!root) return;
    if (state.root !== root) {
      stopFull();
      if (!state.draft) {
        state.draftKind = "spot";
        state.composeMode = "spot";
        state.selectedBuilding = "";
        state.selectedQuantity = 0;
        state.selectedLevel = "";
        state.selectedLocation = "";
      }
      state.root = root;
      state.data = null;
      state.selection = false;
      state.selected.clear();
      state.interacting = false;
      if (state.interactionReleaseTimer) clearTimeout(state.interactionReleaseTimer);
      state.interactionReleaseTimer = 0;
      state.scrollToLatestPending = true;
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
        updateWheelchairFreshnessIndicators();
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
    const composer = state.root.querySelector(".tb-input-dock");
    if (!composer) return;

    state.root.style.setProperty(
      "--tb-composer-height",
      Math.ceil(composer.getBoundingClientRect().height) + "px",
    );

    if (!state.root.classList.contains("is-composing")) {
      state.root.style.removeProperty("--tb-keyboard-inset");
      return;
    }

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
    const interactionStart = () => {
      if (state.interactionReleaseTimer) clearTimeout(state.interactionReleaseTimer);
      state.interactionReleaseTimer = 0;
      state.interacting = true;
    };
    const interactionEnd = () => {
      if (state.interactionReleaseTimer) clearTimeout(state.interactionReleaseTimer);
      state.interactionReleaseTimer = window.setTimeout(() => {
        state.interacting = false;
        state.interactionReleaseTimer = 0;
      }, 220);
    };
    root.addEventListener("pointerdown", interactionStart, { capture: true, passive: true });
    root.addEventListener("pointerup", interactionEnd, { capture: true, passive: true });
    root.addEventListener("pointercancel", interactionEnd, { capture: true, passive: true });

    root.querySelector("[data-form]")?.addEventListener("submit", send);
    bindMessageGestures(root);
    root.querySelector("[data-free-toggle]")?.addEventListener("click", () => {
      const textarea = root.querySelector(".tb-composer textarea");
      if (!textarea) return;
      const current = cleanWheelchairText(textarea.value);
      textarea.hidden = false;
      textarea.dataset.open = "1";
      if (current && !/\s·\s$/.test(textarea.value)) {
        textarea.value = current + " · ";
        state.draft = textarea.value;
      }
      textarea.placeholder = current
        ? "Ex. caché derrière l’escalier, près des ascenseurs…"
        : "Écris directement ton info…";
      autoGrow(textarea);
      textarea.focus();
      try {
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      } catch {}
      renderComposerState();
      requestAnimationFrame(syncViewport);
    });

    const textarea = root.querySelector("textarea");
    textarea?.addEventListener("input", () => {
      state.draft = textarea.value;
      if (!textarea.value.trim()) state.draftKind = state.composeMode;
      if (
        state.composeMode === "spot" &&
        state.selectedBuilding &&
        state.selectedQuantity
      ) {
        state.selectedQuantity = inferWheelchairQuantity(textarea.value);
        renderSearchShortcuts();
      }
      autoGrow(textarea);
      renderComposerState();
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
        requestAnimationFrame(syncViewport);
      }, 220);
    });

    root.addEventListener("click", (event) => {
      const selectOpen = event.target.closest?.("[data-select]");
      if (selectOpen) {
        event.preventDefault();
        toggleSelection(true);
        return;
      }
      const selectClose = event.target.closest?.("[data-selection-close]");
      if (selectClose) {
        event.preventDefault();
        toggleSelection(false);
        return;
      }
      const selectAllButton = event.target.closest?.("[data-select-all]");
      if (selectAllButton) {
        event.preventDefault();
        selectAll();
        return;
      }
      const deleteSelectedButton = event.target.closest?.("[data-delete-selected]");
      if (deleteSelectedButton) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      const messageSelect = event.target.closest?.("[data-message-select]");
      if (messageSelect) {
        event.preventDefault();
        if (!state.selection || state.deleteBusy) return;
        const id = String(messageSelect.dataset.messageSelect || "");
        if (!id) return;
        if (state.selected.has(id)) state.selected.delete(id);
        else state.selected.add(id);
        renderMessages();
        return;
      }

      const modeToggle = event.target.closest?.("[data-mode-toggle]");
      if (modeToggle) {
        event.preventDefault();
        setComposeMode(state.composeMode === "spot" ? "search" : "spot");
        return;
      }
      const mode = event.target.closest?.("[data-compose-mode]");
      if (mode) {
        event.preventDefault();
        setComposeMode(String(mode.dataset.composeMode || ""));
        return;
      }
      const locationSearch = event.target.closest?.("[data-location-search]");
      if (locationSearch) {
        event.preventDefault();
        openComposerLocationSearch();
        return;
      }
      const building = event.target.closest?.("[data-building-compose]");
      if (building) {
        event.preventDefault();
        composeBuilding(String(building.dataset.buildingCompose || ""));
        return;
      }
      const take = event.target.closest?.("[data-take]");
      if (take) {
        event.preventDefault();
        takeWheelchair(String(take.dataset.take || ""));
        return;
      }
      const missing = event.target.closest?.("[data-report-missing]");
      if (missing) {
        event.preventDefault();
        reportWheelchairMissing(String(missing.dataset.reportMissing || ""));
        return;
      }
      const stillThere = event.target.closest?.("[data-still-there]");
      if (stillThere) {
        event.preventDefault();
        confirmWheelchairStillThere(String(stillThere.dataset.stillThere || ""));
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
      if (!quiet) {
        renderSearchShortcuts();
        renderComposerState();
      }
      const manage = state.root.querySelector("[data-select]");
      if (manage) manage.hidden = !data.admin || !messages.length || state.selection;

      const form = state.root.querySelector("[data-form]");
      if (form) form.hidden = !canWrite;
      const inputDock = state.root.querySelector("[data-input-dock]");
      if (inputDock) inputDock.hidden = !canWrite;
      const readonly = state.root.querySelector("[data-readonly]");
      if (readonly) readonly.hidden = canWrite;

      if ((!data.admin || !messages.length) && state.selection) {
        state.selection = false;
        state.selected.clear();
      }

      const signature =
        dataSignature(data) + "|" + String(data.access_mode || "");
      const changed = signature !== state.lastSignature;
      if (!quiet || (changed && !state.interacting)) {
        state.lastSignature = signature;
        renderMessages();
      }

      if (state.focusAfterLoad && canWrite) {
        state.focusAfterLoad = false;
        requestAnimationFrame(() => {
          state.root?.querySelector("[data-input-dock]")?.scrollIntoView({
            block: "end",
            behavior: "smooth",
          });
        });
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

  function cleanWheelchairText(value = "") {
    return String(value || "").replace(/\s*·\s*$/, "").trim();
  }


  function inferWheelchairQuantity(text = "") {
    const body = String(text || "").trim();
    const explicit = body.match(/(?:^|[·,:;\s])(\d{1,2})\s*(?:fauteuils?|fauteuil|f\b)/i);
    if (explicit) return Math.min(20, Math.max(1, Number(explicit[1]) || 1));

    const tail = body.split("·").map((part) => part.trim()).filter(Boolean).at(-1) || "";
    const shorthand = tail.match(/^(\d{1,2})\s+(?:au\b|à\b|a\b)/i);
    return shorthand ? Math.min(20, Math.max(1, Number(shorthand[1]) || 1)) : 1;
  }

  function wheelchairStock(message = {}) {
    const wheelchair = message?.payload?.wheelchair || {};
    const total = Math.min(
      20,
      Math.max(1, Number(wheelchair.quantity_total) || inferWheelchairQuantity(message.body || "")),
    );
    const remainingRaw = Number(wheelchair.quantity_remaining);
    const remaining = Number.isFinite(remainingRaw)
      ? Math.min(total, Math.max(0, remainingRaw))
      : (wheelchair.status === "resolved" ? 0 : total);
    return { total, remaining };
  }

  function renderComposerState() {
    const root = state.root;
    if (!root) return;
    const textarea = root.querySelector(".tb-composer textarea");
    const preview = root.querySelector("[data-draft-preview]");
    const sendButton = root.querySelector("[data-send]");
    const toggle = root.querySelector("[data-free-toggle]");
    if (!textarea || !preview || !sendButton || !toggle) return;

    const body = cleanWheelchairText(textarea.value);
    preview.hidden = !body;
    preview.textContent = body;
    sendButton.disabled = !body;
    sendButton.classList.toggle("is-ready", !!body);
    toggle.textContent = body
      ? "✎ Ajouter un repère / une précision"
      : "✎ Écrire directement";
    toggle.setAttribute(
      "aria-label",
      body
        ? "Ajouter un repère ou une précision au signalement"
        : "Écrire directement sans passer par le questionnaire",
    );

    if (!textarea.dataset.open) textarea.hidden = true;
    requestAnimationFrame(syncViewport);
  }

  function levelSearchAliases(level = "") {
    const clean = String(level || "").trim();
    const n = clean.match(/^(\d{1,2})(?:er|e)?$/i)?.[1] || "";
    if (/^RDC$/i.test(clean)) return "rdc rez de chaussee rez-de-chaussee";
    if (/^RDJ$/i.test(clean)) return "rdj rez de jardin rez-de-jardin";
    if (/^TM$/i.test(clean)) return "tm";
    if (!n) return clean;
    return [clean, n, n + "e", n + "eme", n + "ème", n === "1" ? "premier" : ""].filter(Boolean).join(" ");
  }

  function locationSearchTargets({ buildingKey = "", level = "" } = {}) {
    const targets = [];
    for (const building of BUILDINGS) {
      if (buildingKey && building.key !== buildingKey) continue;
      const groups = WHEELCHAIR_LOCATIONS[building.key] || [];
      for (const group of groups) {
        if (level && group.level !== level) continue;
        const baseSearch = [
          building.label,
          ...(building.aliases || []),
          group.level,
          levelSearchAliases(group.level),
        ].join(" ");

        targets.push({
          buildingKey: building.key,
          buildingLabel: building.label,
          level: group.level,
          location: "",
          label: building.label + " · " + group.level,
          hint: "Valider au niveau",
          search: norm(baseSearch + " niveau etage étage"),
        });

        for (const place of group.places || []) {
          const unit = String(place).match(/\bU\s*(\d{2,3})\b/i)?.[1] || "";
          targets.push({
            buildingKey: building.key,
            buildingLabel: building.label,
            level: group.level,
            location: String(place),
            label: String(place),
            hint: building.label + " · " + group.level,
            search: norm(
              baseSearch + " " + place +
              (unit ? " unite " + unit + " unité " + unit + " u" + unit : ""),
            ),
          });
        }
      }
    }
    return targets;
  }

  function findLocationMatches(query, options = {}) {
    const q = norm(query);
    const targets = locationSearchTargets(options);
    if (!q) return targets.slice(0, 10);

    const words = q.split(/\s+/).filter(Boolean);
    return targets
      .map((target) => {
        const hay = target.search;
        if (!words.every((word) => hay.includes(word))) return null;
        let score = 0;
        if (hay === q) score += 100;
        if (hay.startsWith(q)) score += 50;
        if (norm(target.label).startsWith(q)) score += 35;
        if (norm(target.label).includes(q)) score += 20;
        score -= target.label.length / 100;
        return { ...target, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  function chooseLocationShortcut(options = {}) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap tb-location-search-modal";

      const context = [
        options.buildingKey
          ? BUILDINGS.find((item) => item.key === options.buildingKey)?.label
          : "",
        options.level || "",
      ].filter(Boolean).join(" · ");

      const searchMode = state.composeMode === "search";
      const finderTitle = searchMode ? "Préciser la zone" : "Indiquer l’endroit";
      const finderSubtitle = searchMode
        ? (context || "Où veux-tu chercher ?")
        : (context || "Où sont les fauteuils ?");

      wrap.innerHTML =
        '<section class="tb-confirm tb-location-finder">' +
          '<div class="tb-wizard-head">' +
            '<button type="button" class="tb-wizard-back" data-finder-close aria-label="Fermer">‹</button>' +
            '<div class="tb-confirm-icon">🔎</div>' +
          "</div>" +
          "<h3>" + esc(finderTitle) + "</h3>" +
          "<p>" + esc(finderSubtitle) + "</p>" +
          '<label class="tb-location-finder-input">' +
            '<span aria-hidden="true">⌕</span>' +
            '<input type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="Ex. U202, 6e cardio, ascenseur…">' +
          "</label>" +
          '<div class="tb-location-results" data-location-results></div>' +
        "</section>";

      const viewport = window.visualViewport;
      const fitViewport = () => {
        const height = Math.max(280, Math.round(viewport?.height || window.innerHeight || 0));
        const top = Math.max(0, Math.round(viewport?.offsetTop || 0));
        wrap.style.setProperty("--tb-modal-height", height + "px");
        wrap.style.setProperty("--tb-modal-top", top + "px");
      };
      const done = (value = null) => {
        viewport?.removeEventListener("resize", fitViewport);
        viewport?.removeEventListener("scroll", fitViewport);
        wrap.remove();
        resolve(value);
      };

      const input = wrap.querySelector("input");
      const results = wrap.querySelector("[data-location-results]");

      const paint = () => {
        const query = String(input?.value || "").trim();
        let matches = findLocationMatches(query, options);

        // Generic terrain landmarks become available when searched explicitly.
        const landmark = norm(query);
        if (landmark && options.buildingKey && options.level) {
          const building = BUILDINGS.find((item) => item.key === options.buildingKey);
          if (building) {
            if (landmark.includes("ascenseur")) {
              matches.unshift({
                buildingKey: building.key,
                buildingLabel: building.label,
                level: options.level,
                location: "Près des ascenseurs",
                label: "🛗 Près des ascenseurs",
                hint: building.label + " · " + options.level,
              });
            }
            if (landmark.includes("escalier")) {
              matches.unshift({
                buildingKey: building.key,
                buildingLabel: building.label,
                level: options.level,
                location: "Près de l’escalier",
                label: "↕ Près de l’escalier",
                hint: building.label + " · " + options.level,
              });
            }
          }
        }

        results.innerHTML = matches.length
          ? matches.slice(0, 12).map((item, index) =>
              '<button type="button" data-location-result="' + index + '">' +
                '<strong>' + esc(item.label) + "</strong>" +
                '<small>' + esc(item.hint || "") + "</small>" +
              "</button>"
            ).join("")
          : '<div class="tb-location-no-result"><strong>Aucun repère trouvé</strong><small>Tu peux revenir au formulaire et écrire le repère toi-même.</small></div>';

        results.querySelectorAll("[data-location-result]").forEach((button) => {
          button.addEventListener("click", () => {
            const item = matches[Number(button.dataset.locationResult) || 0];
            if (item) done(item);
          });
        });
      };

      wrap.querySelector("[data-finder-close]")?.addEventListener("click", () => done());
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) done();
      });
      input?.addEventListener("input", paint);
      input?.addEventListener("focus", () => {
        wrap.classList.add("is-keyboard");
        fitViewport();
        setTimeout(() => input.scrollIntoView({ block: "nearest" }), 80);
      });
      input?.addEventListener("blur", () => wrap.classList.remove("is-keyboard"));
      document.body.appendChild(wrap);
      fitViewport();
      viewport?.addEventListener("resize", fitViewport, { passive: true });
      viewport?.addEventListener("scroll", fitViewport, { passive: true });
      paint();
      setTimeout(() => {
        fitViewport();
        input?.focus();
      }, 40);
    });
  }

  function chooseQuantityOnly(buildingLabel = "") {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      wrap.innerHTML =
        '<section class="tb-confirm tb-quantity-picker">' +
          '<div class="tb-confirm-icon">🦽</div>' +
          "<h3>Combien de fauteuils ?</h3>" +
          "<p>" + esc(buildingLabel) + "</p>" +
          '<div class="tb-quantity-choices">' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
              '<button type="button" data-qty="' + n + '"><strong>' + n + "</strong></button>"
            ).join("") +
            '<button type="button" class="more" data-qty-more><strong>10+</strong><small>10 à 20</small></button>' +
          "</div>" +
          '<div class="tb-quantity-more" data-qty-more-panel hidden>' +
            '<label for="tbQuickQuantity">Nombre de fauteuils</label>' +
            '<div><input id="tbQuickQuantity" type="number" inputmode="numeric" min="10" max="20" step="1" value="10">' +
            '<button type="button" data-qty-more-ok>Valider</button></div>' +
            '<small data-qty-error aria-live="polite"></small>' +
          "</div>" +
          '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
        "</section>";

      const done = (value = 0) => {
        wrap.remove();
        resolve(value);
      };
      wrap.querySelectorAll("[data-qty]").forEach((button) => {
        button.addEventListener("click", () => done(Number(button.dataset.qty) || 0));
      });
      const panel = wrap.querySelector("[data-qty-more-panel]");
      const input = wrap.querySelector("#tbQuickQuantity");
      const error = wrap.querySelector("[data-qty-error]");
      wrap.querySelector("[data-qty-more]")?.addEventListener("click", () => {
        if (panel) panel.hidden = false;
        setTimeout(() => input?.focus(), 30);
      });
      const validateMore = () => {
        const value = Math.round(Number(input?.value) || 0);
        if (value < 10 || value > 20) {
          if (error) error.textContent = "Choisis un nombre entre 10 et 20.";
          input?.focus();
          return;
        }
        done(value);
      };
      wrap.querySelector("[data-qty-more-ok]")?.addEventListener("click", validateMore);
      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        validateMore();
      });
      wrap.querySelector("[data-no]")?.addEventListener("click", () => done(0));
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) done(0);
      });
      document.body.appendChild(wrap);
    });
  }

  function structuredDraft({ type, building, quantity = 1, level = "", location = "" }) {
    const parts = [];
    if (type === "search") {
      parts.push("Je cherche 1 fauteuil");
    } else {
      parts.push(
        quantity + " fauteuil" + (quantity > 1 ? "s" : "") +
        " disponible" + (quantity > 1 ? "s" : ""),
      );
    }
    if (building?.label) parts.push(building.label);
    if (level) parts.push(level);
    if (location) parts.push(location);
    return parts.join(" · ");
  }

  function applyComposeDetails({ buildingKey, quantity = 1, level = "", location = "" }) {
    const building = BUILDINGS.find((item) => item.key === buildingKey);
    const textarea = state.root?.querySelector(".tb-composer textarea");
    if (!building || !textarea) return;

    const type = state.composeMode === "search" ? "search" : "spot";
    state.selectedBuilding = building.key;
    state.selectedQuantity = type === "spot" ? quantity : 0;
    state.selectedLevel = level || "";
    state.selectedLocation = location || "";
    state.draftKind = type;

    const text = structuredDraft({
      type,
      building,
      quantity,
      level,
      location,
    });
    state.draft = text;
    textarea.value = text;
    delete textarea.dataset.open;
    textarea.hidden = true;
    autoGrow(textarea);
    renderSearchShortcuts();
    renderComposerState();
  }

  async function openComposerLocationSearch() {
    const result = await chooseLocationShortcut();
    if (!result || !state.root?.isConnected) return;

    let quantity = 1;
    if (state.composeMode === "spot") {
      quantity = await chooseQuantityOnly(result.buildingLabel);
      if (!quantity || !state.root?.isConnected) return;
    }

    await openStructuredReview({
      type: state.composeMode === "search" ? "search" : "spot",
      buildingKey: result.buildingKey,
      quantity,
      level: result.level,
      location: result.location,
    });
  }

  function renderSearchShortcuts() {
    const host = state.root?.querySelector("[data-search-shortcuts]");
    if (!host) return;

    const searchMode = state.composeMode === "search";
    const selected = BUILDINGS.find((building) => building.key === state.selectedBuilding);
    const currentLabel = searchMode ? "Je cherche" : "J’ai vu";

    const buildingButton = (key, area) => {
      const building = BUILDINGS.find((item) => item.key === key);
      if (!building) return "";
      const active = building.key === state.selectedBuilding;
      return (
        '<button type="button" class="tb-place-building is-' + area + (active ? " is-active" : "") +
        '" data-building-compose="' + esc(building.key) + '" aria-pressed="' + (active ? "true" : "false") + '">' +
          '<strong>' + esc(building.label) + '</strong>' +
        '</button>'
      );
    };

    const modeTab = (mode, icon, label) => {
      const active = state.composeMode === mode;
      return (
        '<button type="button" class="tb-mode-tab' + (active ? " is-active" : "") +
        '" data-compose-mode="' + mode + '" role="tab" aria-selected="' + (active ? "true" : "false") + '">' +
          '<span aria-hidden="true">' + icon + '</span><strong>' + esc(label) + '</strong>' +
        '</button>'
      );
    };

    host.innerHTML =
      '<div class="tb-shortcuts-full">' +
        '<div class="tb-mode-tabs" role="tablist" aria-label="Action">' +
          modeTab("spot", "👀", "J’ai vu") +
          modeTab("search", "🔎", "Je cherche") +
        '</div>' +
        '<div class="tb-place-deck-title"><strong>Où ?</strong></div>' +
        '<div class="tb-place-deck" role="group" aria-label="Choisir un bâtiment ou un service">' +
          buildingButton("cardio", "cardio") +
          buildingButton("hfme", "hfme") +
          buildingButton("neuro", "neuro") +
          buildingButton("a4", "a4") +
          '<button type="button" class="tb-place-known' + (state.selectedLocation ? " is-active" : "") + '" data-location-search>' +
            '<span aria-hidden="true">📍</span><strong>Service<br>/ repère</strong>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="tb-compose-summary" aria-live="polite"><span aria-hidden="true">' +
        (searchMode ? "🔎" : "🦽") +
        '</span><strong>' + esc(currentLabel) + '</strong><b>·</b><em>' +
        esc(selected?.label || (state.selectedLocation ? "Repère précis" : "Lieu à choisir")) +
        '</em>' +
        (!searchMode && state.selectedQuantity
          ? '<b>·</b><em>' + esc(String(state.selectedQuantity)) + ' fauteuil' + (state.selectedQuantity > 1 ? 's' : '') + '</em>'
          : '') +
        '</div>';
    requestAnimationFrame(syncViewport);
  }

  function setComposeMode(mode) {
    if (mode !== "search" && mode !== "spot") return;

    const textarea = state.root?.querySelector(".tb-composer textarea");
    const current = String(textarea?.value || "").trim();
    const generatedDraft =
      /^(?:Je cherche(?: 1)? un? fauteuil|Je cherche 1 fauteuil|\d{1,2}\s+fauteuils?\s+disponibles?)\s*·/i.test(current);

    state.composeMode = mode;
    state.draftKind = mode;
    state.selectedBuilding = "";
    state.selectedQuantity = 0;
    state.selectedLevel = "";
    state.selectedLocation = "";

    if (textarea) {
      textarea.placeholder = "Écrire directement si besoin…";
      if (generatedDraft) {
        textarea.value = "";
        state.draft = "";
        delete textarea.dataset.open;
        textarea.hidden = true;
        autoGrow(textarea);
      }
    }
    renderSearchShortcuts();
    renderComposerState();
  }

  function clearComposerDraft() {
    const textarea = state.root?.querySelector(".tb-composer textarea");
    if (textarea) {
      textarea.value = "";
      delete textarea.dataset.open;
      textarea.hidden = true;
      autoGrow(textarea);
    }
    state.draft = "";
    state.draftKind = state.composeMode;
    state.selectedBuilding = "";
    state.selectedQuantity = 0;
    state.selectedLevel = "";
    state.selectedLocation = "";
    renderSearchShortcuts();
    renderComposerState();
  }

  function normalizeWheelchairPersistence(value = "", quantity = 1) {
    const key = String(value || "").trim().toLowerCase();
    return ["fast", "normal", "sheltered"].includes(key) ? key : "normal";
  }

  function wheelchairPlacementText({ location = "", precision = "" } = {}) {
    return norm([location, precision].filter(Boolean).join(" "));
  }

  function hasStrongWheelchairPlacementClue({ location = "", precision = "" } = {}) {
    const text = wheelchairPlacementText({ location, precision });
    return /fond du couloir|fond de couloir|au fond|bout du couloir|fin du couloir|fin de couloir|cache|caché|derriere|derrière|recoin|alcove|à l ecart|a l ecart|discret|isol[eé]|ascenseur|entree|entrée|hall|passage|accueil|escalier/.test(text);
  }

  function inferWheelchairPersistence({ quantity = 1, location = "", precision = "" } = {}) {
    const text = wheelchairPlacementText({ location, precision });

    if (/fond du couloir|fond de couloir|au fond|bout du couloir|fin du couloir|fin de couloir|cache|caché|derriere|derrière|recoin|alcove|à l ecart|a l ecart|discret|isol[eé]|passerelle|local a fauteuil|local à fauteuil/.test(text)) {
      return "sheltered";
    }
    if (/ascenseur|entree|entrée|hall|passage|accueil/.test(text)) {
      return "fast";
    }
    if (/escalier|couloir/.test(text)) {
      return "normal";
    }
    return "normal";
  }

  function shouldAskWheelchairPersistence({
    quantity = 1,
    location = "",
    precision = "",
  } = {}) {
    const count = Math.max(1, Number(quantity) || 1);
    if (count >= 4) return false;
    if (count === 3 && hasStrongWheelchairPlacementClue({ location, precision })) {
      return false;
    }
    return true;
  }

  async function publishStructuredWheelchair({
    type,
    buildingKey,
    quantity = 1,
    level = "",
    location = "",
    precision = "",
    persistence = "normal",
  }) {
    const building = BUILDINGS.find((item) => item.key === buildingKey);
    if (!building) throw Error("Bâtiment inconnu.");
    if (!(await ensurePrivacy())) return false;

    const finalLocation = [location, String(precision || "").trim()]
      .filter(Boolean)
      .join(" · ");
    const body = structuredDraft({
      type,
      building,
      quantity,
      level,
      location: finalLocation,
    });

    await api("team_send", {
      body,
      wheelchair: {
        type,
        building: building.key,
        quantity: type === "spot" ? Math.max(1, Number(quantity) || 1) : 1,
        level: level || "",
        location: finalLocation,
        ...(type === "spot"
          ? { persistence: normalizeWheelchairPersistence(persistence, quantity) }
          : {}),
      },
    });

    clearComposerDraft();
    await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
    return true;
  }

  function renderStructuredReview(wrap, payload, { back = null, close = null } = {}) {
    const building = BUILDINGS.find((item) => item.key === payload.buildingKey);
    if (!building) return;
    const type = payload.type === "search" ? "search" : "spot";
    const quantity = Math.max(1, Number(payload.quantity) || 1);
    let location = String(payload.location || "").trim();
    let persistence = inferWheelchairPersistence({ quantity, location });
    const summary = structuredDraft({
      type,
      building,
      quantity: payload.quantity || 1,
      level: payload.level || "",
      location,
    });

    wrap.innerHTML =
      '<section class="tb-confirm tb-spot-wizard tb-final-review">' +
        '<div class="tb-wizard-head">' +
          (back ? '<button type="button" class="tb-wizard-back" data-review-back aria-label="Retour">‹</button>' : '<span></span>') +
          '<div class="tb-confirm-icon">' + (type === "search" ? "🔎" : "🦽") + '</div>' +
        "</div>" +
        "<h3>Prêt à envoyer</h3>" +
        '<p class="tb-review-summary">' + esc(summary) + "</p>" +
        '<button type="button" class="tb-wizard-search compact" data-review-location>' +
          '<span>📍</span><strong>Modifier / préciser l’endroit</strong><small>unité, étage, ascenseur, service…</small>' +
        "</button>" +

        '<label class="tb-precision-field"><span>Ajouter une précision <em>facultatif</em></span>' +
          '<textarea rows="3" maxlength="160" placeholder="Ex. caché derrière l’escalier, près des ascenseurs…"></textarea>' +
        "</label>" +
        '<button type="button" class="tb-review-send" data-review-send>' +
          '<span>' + (type === "search" ? "Envoyer ma demande" : "Envoyer l’info") + '</span><b>↑</b>' +
        "</button>" +
        '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
      "</section>";

    const input = wrap.querySelector(".tb-precision-field textarea");

    input?.addEventListener("input", () => {
      if (type !== "spot") return;
      persistence = inferWheelchairPersistence({
        quantity,
        location,
        precision: String(input.value || ""),
      });
    });

    wrap.querySelector("[data-review-back]")?.addEventListener("click", () => back?.());

    wrap.querySelector("[data-review-location]")?.addEventListener("click", async () => {
      const found = await chooseLocationShortcut({
        buildingKey: building.key,
        ...(payload.level ? { level: payload.level } : {}),
      });
      if (!found || !wrap.isConnected) return;
      payload.level = found.level || payload.level || "";
      location = found.location || "";
      payload.location = location;
      payload.persistence = inferWheelchairPersistence({ quantity, location });
      renderStructuredReview(wrap, payload, { back, close });
    });

    wrap.querySelector("[data-review-send]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.classList.add("is-loading");
      try {
        const sent = await publishStructuredWheelchair({
          ...payload,
          location,
          precision: String(input?.value || "").trim(),
          persistence: inferWheelchairPersistence({
            quantity,
            location,
            precision: String(input?.value || "").trim(),
          }),
        });
        if (sent) close?.(true);
        else {
          button.disabled = false;
          button.classList.remove("is-loading");
        }
      } catch (error) {
        alert(error.message || "Publication impossible.");
        button.disabled = false;
        button.classList.remove("is-loading");
      }
    });

    wrap.querySelector("[data-no]")?.addEventListener("click", () => close?.(false));
  }

  function openStructuredReview(payload) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      const close = (value = false) => {
        wrap.remove();
        resolve(value);
      };
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) close(false);
      });
      document.body.appendChild(wrap);
      renderStructuredReview(wrap, { ...payload }, { close });
    });
  }

  function chooseSpotDetails(building) {
    return new Promise((resolve) => {
      const levels = WHEELCHAIR_LOCATIONS[building.key] || [];
      let quantity = 0;
      let level = "";
      const selectedPlaces = new Set();

      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      const close = (value = false) => {
        wrap.remove();
        resolve(value);
      };

      const searchHere = async () => {
        const result = await chooseLocationShortcut({
          buildingKey: building.key,
          ...(level ? { level } : {}),
        });
        if (!result || !wrap.isConnected) return;
        level = result.level || level;
        renderStructuredReview(
          wrap,
          {
            type: "spot",
            buildingKey: building.key,
            quantity,
            level,
            location: result.location || "",
          },
          { back: level ? renderPlaces : renderLevels, close },
        );
      };

      const renderQuantity = () => {
        wrap.innerHTML =
          '<section class="tb-confirm tb-spot-wizard">' +
            '<div class="tb-confirm-icon">🦽</div>' +
            "<h3>Combien de fauteuils ?</h3>" +
            "<p>" + esc(building.label) + "</p>" +
            '<div class="tb-quantity-choices">' +
              [1,2,3,4,5,6,7,8,9].map((n) =>
                '<button type="button" data-spot-qty="' + n + '"><strong>' + n + "</strong></button>"
              ).join("") +
              '<button type="button" class="more" data-spot-more><strong>10+</strong><small>10 à 20</small></button>' +
            "</div>" +
            '<div class="tb-quantity-more" data-spot-more-panel hidden>' +
              '<label for="tbSpotQuantity">Nombre de fauteuils</label>' +
              '<div><input id="tbSpotQuantity" type="number" inputmode="numeric" min="10" max="20" step="1" value="10">' +
              '<button type="button" data-spot-more-ok>Valider</button></div>' +
              '<small data-spot-qty-error aria-live="polite"></small>' +
            "</div>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";
        bindQuantity();
      };

      const renderLevels = () => {
        wrap.innerHTML =
          '<section class="tb-confirm tb-spot-wizard">' +
            '<div class="tb-wizard-head"><button type="button" class="tb-wizard-back" data-back-qty aria-label="Retour">‹</button><div class="tb-confirm-icon">📍</div></div>' +
            "<h3>À quel niveau ?</h3>" +
            "<p>" + quantity + " fauteuil" + (quantity > 1 ? "s" : "") + " · " + esc(building.label) + "</p>" +
            '<div class="tb-level-choices">' +
              levels.map((item) =>
                '<button type="button" data-level="' + esc(item.level) + '"><strong>' + esc(item.level) + "</strong></button>"
              ).join("") +
            "</div>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";
        wrap.querySelector("[data-back-qty]")?.addEventListener("click", renderQuantity);
        wrap.querySelectorAll("[data-level]").forEach((button) => {
          button.addEventListener("click", () => {
            level = String(button.dataset.level || "");
            selectedPlaces.clear();
            renderPlaces();
          });
        });
        wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      };

      const renderPlaces = () => {
        const quickPlaces = wheelchairFieldSpots(building.key, level);
        const wholeSelected = selectedPlaces.has("__whole__");
        const selectedValues = [...selectedPlaces].filter((value) => value !== "__whole__");

        wrap.innerHTML =
          '<section class="tb-confirm tb-spot-wizard">' +
            '<div class="tb-wizard-head"><button type="button" class="tb-wizard-back" data-back-level aria-label="Retour">‹</button><div class="tb-confirm-icon">📍</div></div>' +
            "<h3>Où exactement ?</h3>" +
            "<p>" + esc(building.label) + " · " + esc(level) + "</p>" +
            '<button type="button" class="tb-wizard-finish tb-place-toggle' + (wholeSelected ? " is-selected" : "") + '" data-finish-level aria-pressed="' + (wholeSelected ? "true" : "false") + '">' +
              '<span aria-hidden="true">✓</span><span><strong>Tout le ' + esc(level) + '</strong></span>' +
            "</button>" +
            '<div class="tb-place-choices tb-field-spot-choices">' +
              quickPlaces.map((place) => {
                const selected = selectedPlaces.has(place.value);
                return '<button type="button" class="tb-place-toggle' + (place.featured ? " is-featured" : "") + (selected ? " is-selected" : "") + '" data-place="' + esc(place.value) + '" data-place-persistence="' + esc(place.persistence || "normal") + '" aria-pressed="' + (selected ? "true" : "false") + '">' +
                  '<span class="tb-place-icon" aria-hidden="true">' + esc(place.icon || "📍") + '</span><strong>' + esc(place.label) + "</strong></button>";
              }).join("") +
              '<button type="button" class="other" data-place-other><strong>Autre endroit…</strong></button>' +
            "</div>" +
            '<button type="button" class="tb-review-send tb-place-continue" data-place-continue' + (!selectedPlaces.size ? " disabled" : "") + '>' +
              '<span>Continuer' + (selectedValues.length > 1 ? " · " + selectedValues.length + " endroits" : "") + '</span><b>›</b>' +
            "</button>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";

        const selectedPersistence = () => {
          if (selectedPlaces.has("__whole__")) return "normal";
          const selected = quickPlaces.filter((place) => selectedPlaces.has(place.value));
          const modes = [...new Set(selected.map((place) => place.persistence || "normal"))];
          return modes.length === 1 ? modes[0] : "normal";
        };

        wrap.querySelector("[data-back-level]")?.addEventListener("click", renderLevels);

        wrap.querySelector("[data-finish-level]")?.addEventListener("click", () => {
          if (selectedPlaces.has("__whole__")) selectedPlaces.delete("__whole__");
          else {
            selectedPlaces.clear();
            selectedPlaces.add("__whole__");
          }
          renderPlaces();
        });

        wrap.querySelectorAll("[data-place]").forEach((button) => {
          button.addEventListener("click", () => {
            const value = String(button.dataset.place || "");
            selectedPlaces.delete("__whole__");
            if (selectedPlaces.has(value)) selectedPlaces.delete(value);
            else selectedPlaces.add(value);
            renderPlaces();
          });
        });

        wrap.querySelector("[data-place-continue]")?.addEventListener("click", () => {
          if (!selectedPlaces.size) return;
          const locations = [...selectedPlaces].filter((value) => value !== "__whole__");
          const persistence = selectedPersistence();
          renderStructuredReview(
            wrap,
            {
              type:"spot",
              buildingKey:building.key,
              quantity,
              level,
              location:locations.join(" | "),
              persistence,
            },
            { back:renderPlaces, close },
          );
        });

        wrap.querySelector("[data-place-other]")?.addEventListener("click", searchHere);
        wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      };

      const bindQuantity = () => {
        wrap.querySelectorAll("[data-spot-qty]").forEach((button) => {
          button.addEventListener("click", () => {
            quantity = Number(button.dataset.spotQty) || 0;
            if (quantity) renderLevels();
          });
        });
        const panel = wrap.querySelector("[data-spot-more-panel]");
        const input = wrap.querySelector("#tbSpotQuantity");
        const error = wrap.querySelector("[data-spot-qty-error]");
        wrap.querySelector("[data-spot-more]")?.addEventListener("click", () => {
          if (panel) panel.hidden = false;
          setTimeout(() => input?.focus(), 30);
        });
        wrap.querySelector("[data-spot-more-ok]")?.addEventListener("click", () => {
          const value = Math.round(Number(input?.value) || 0);
          if (value < 10 || value > 20) {
            if (error) error.textContent = "Choisis un nombre entre 10 et 20.";
            input?.focus();
            return;
          }
          quantity = value;
          renderLevels();
        });
        input?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          wrap.querySelector("[data-spot-more-ok]")?.click();
        });
        wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      };

      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) close(false);
      });
      document.body.appendChild(wrap);
      renderQuantity();
    });
  }

  function chooseSearchDetails(building) {
    return new Promise((resolve) => {
      const levels = WHEELCHAIR_LOCATIONS[building.key] || [];
      let level = "";

      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      const close = (value = false) => {
        wrap.remove();
        resolve(value);
      };

      const searchHere = async () => {
        const result = await chooseLocationShortcut({
          buildingKey: building.key,
          ...(level ? { level } : {}),
        });
        if (!result || !wrap.isConnected) return;
        level = result.level || level;
        renderStructuredReview(
          wrap,
          {
            type:"search",
            buildingKey:building.key,
            quantity:1,
            level,
            location:result.location || "",
          },
          { back: level ? renderPlaces : renderLevels, close },
        );
      };

      const renderLevels = () => {
        wrap.innerHTML =
          '<section class="tb-confirm tb-search-wizard">' +
            '<div class="tb-wizard-head"><span></span><div class="tb-confirm-icon">🔎</div></div>' +
            "<h3>Où cherches-tu ?</h3>" +
            "<p>" + esc(building.label) + "</p>" +
            '<button type="button" class="tb-wizard-finish" data-whole-building>' +
              '<span aria-hidden="true">✓</span><span><strong>Tout le bâtiment</strong></span>' +
            "</button>" +
            '<div class="tb-level-choices">' +
              levels.map((item) =>
                '<button type="button" data-level="' + esc(item.level) + '"><strong>' + esc(item.level) + "</strong></button>"
              ).join("") +
            "</div>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";

        wrap.querySelector("[data-whole-building]")?.addEventListener("click", () => {
          renderStructuredReview(
            wrap,
            { type:"search", buildingKey:building.key, quantity:1, level:"", location:"" },
            { back:renderLevels, close },
          );
        });
        wrap.querySelectorAll("[data-level]").forEach((button) => {
          button.addEventListener("click", () => {
            level = String(button.dataset.level || "");
            renderPlaces();
          });
        });
        wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      };

      const renderPlaces = () => {
        const group = levels.find((item) => item.level === level);
        const places = group?.places || [];
        wrap.innerHTML =
          '<section class="tb-confirm tb-search-wizard">' +
            '<div class="tb-wizard-head"><button type="button" class="tb-wizard-back" data-back-level aria-label="Retour">‹</button><div class="tb-confirm-icon">📍</div></div>' +
            "<h3>Quelle zone ?</h3>" +
            "<p>" + esc(building.label) + " · " + esc(level) + "</p>" +
            '<button type="button" class="tb-wizard-finish" data-finish-level>' +
              '<span aria-hidden="true">✓</span><span><strong>Tout le ' + esc(level) + '</strong></span>' +
            "</button>" +
            '<div class="tb-place-choices">' +
              places.map((place) =>
                '<button type="button" data-place="' + esc(place) + '"><strong>' + esc(place) + "</strong></button>"
              ).join("") +
              '<button type="button" class="other" data-place-other><strong>Autre endroit…</strong></button>' +
            "</div>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";

        wrap.querySelector("[data-back-level]")?.addEventListener("click", renderLevels);
        wrap.querySelector("[data-finish-level]")?.addEventListener("click", () => {
          renderStructuredReview(
            wrap,
            { type:"search", buildingKey:building.key, quantity:1, level, location:"" },
            { back:renderPlaces, close },
          );
        });
        wrap.querySelectorAll("[data-place]").forEach((button) => {
          button.addEventListener("click", () => {
            renderStructuredReview(
              wrap,
              {
                type:"search",
                buildingKey:building.key,
                quantity:1,
                level,
                location:String(button.dataset.place || ""),
              },
              { back:renderPlaces, close },
            );
          });
        });
        wrap.querySelector("[data-place-other]")?.addEventListener("click", () => {
          renderStructuredReview(
            wrap,
            { type:"search", buildingKey:building.key, quantity:1, level, location:"" },
            { back:renderPlaces, close },
          );
        });
        wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      };

      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) close(false);
      });
      document.body.appendChild(wrap);
      renderLevels();
    });
  }

  async function composeBuilding(key) {
    const building = BUILDINGS.find((item) => item.key === key);
    if (!building) return;
    if (state.composeMode === "search") {
      applyComposeDetails({
        buildingKey: building.key,
        quantity: 1,
        level: "",
        location: "",
      });
      return;
    }
    await chooseSpotDetails(building);
  }

  function reportWheelchairMissing(messageId) {
    return new Promise((resolve) => {
      const message = (state.data?.messages || []).find(
        (item) => String(item.id) === String(messageId),
      );
      if (!message) {
        resolve(false);
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      const parentBody = cleanWheelchairText(message.body || "");

      wrap.innerHTML =
        '<section class="tb-confirm tb-missing-report">' +
          '<div class="tb-confirm-icon">⚠️</div>' +
          "<h3>Je n’ai pas trouvé</h3>" +
          '<p class="tb-missing-parent">' + esc(parentBody) + "</p>" +
          '<label class="tb-precision-field"><span>Précision <em>facultative</em></span>' +
            '<textarea rows="2" maxlength="180" placeholder="Ajouter un détail si utile…"></textarea>' +
          "</label>" +
          '<button type="button" class="tb-missing-send" data-missing-send><span>Envoyer</span><b>↑</b></button>' +
          '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
        "</section>";

      const close = (value = false) => {
        wrap.remove();
        resolve(value);
      };
      const input = wrap.querySelector("textarea");

      wrap.querySelector("[data-missing-send]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const detail = String(input?.value || "").trim();
        const body = "⚠️ Je n’ai trouvé aucun fauteuil à cet endroit." +
          (detail ? " " + detail : "");
        button.disabled = true;
        try {
          if (!(await ensurePrivacy())) {
            button.disabled = false;
            return;
          }
          await api("team_send", {
            body,
            reply_to_id: String(messageId),
          });
          await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
          close(true);
        } catch (error) {
          alert(error.message || "Réponse impossible.");
          button.disabled = false;
        }
      });

      wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) close(false);
      });
      document.body.appendChild(wrap);
    });
  }

  async function confirmWheelchairStillThere(messageId) {
    if (!messageId) return;
    const button = state.root?.querySelector('[data-still-there="' + CSS.escape(String(messageId)) + '"]');
    if (button) button.disabled = true;
    try {
      await api("team_still_there", { message_id: String(messageId) });
      await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
    } catch (error) {
      alert(error.message || "Impossible d’enregistrer la vérification.");
      if (button) button.disabled = false;
    }
  }

  const DEFAULT_QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","🙏"];
  const MORE_REACTIONS = ["👍","❤️","😂","😮","😢","🙏","👏","🔥","✅","💪","🎉","🤝","👀","😅","😭","😡","🤔","💯","🚀","🫶","🤲","👌","🙌","⭐"];
  const REACTION_USAGE_STORAGE = "stip:team-chat:reaction-usage:v1";

  function reactionUsageKey() {
    const me = String(state.data?.me?.id || "anonymous");
    return REACTION_USAGE_STORAGE + ":" + me;
  }

  function loadReactionUsage() {
    try {
      const raw = localStorage.getItem(reactionUsageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveReactionUsage(usage) {
    try {
      localStorage.setItem(reactionUsageKey(), JSON.stringify(usage || {}));
    } catch {
      // Le classement fréquent reste simplement sur les valeurs par défaut.
    }
  }

  function rememberReactionUse(emoji) {
    const value = String(emoji || "").trim();
    if (!value || !MORE_REACTIONS.includes(value)) return;

    const usage = loadReactionUsage();
    const previous = usage[value] && typeof usage[value] === "object"
      ? usage[value]
      : {};

    usage[value] = {
      count: Math.max(0, Number(previous.count) || 0) + 1,
      last_used: Date.now(),
    };
    saveReactionUsage(usage);
  }

  function quickReactions() {
    const usage = loadReactionUsage();
    const defaultRank = new Map(
      DEFAULT_QUICK_REACTIONS.map((emoji, index) => [emoji, index]),
    );

    return MORE_REACTIONS
      .map((emoji, catalogRank) => {
        const saved = usage[emoji] && typeof usage[emoji] === "object"
          ? usage[emoji]
          : {};
        return {
          emoji,
          count: Math.max(0, Number(saved.count) || 0),
          lastUsed: Math.max(0, Number(saved.last_used) || 0),
          defaultRank: defaultRank.has(emoji) ? defaultRank.get(emoji) : 999,
          catalogRank,
        };
      })
      .sort((a, b) =>
        (b.count - a.count) ||
        (b.lastUsed - a.lastUsed) ||
        (a.defaultRank - b.defaultRank) ||
        (a.catalogRank - b.catalogRank)
      )
      .slice(0, DEFAULT_QUICK_REACTIONS.length)
      .map((item) => item.emoji);
  }

  function messageById(messageId) {
    return (state.data?.messages || []).find(
      (item) => String(item.id) === String(messageId),
    ) || null;
  }

  function reactionMarkup(message) {
    const reactions = Array.isArray(message?.payload?.reactions)
      ? message.payload.reactions
      : [];
    const me = String(state.data?.me?.id || "");
    const grouped = new Map();

    for (const reaction of reactions) {
      const emoji = String(reaction?.emoji || "").trim();
      if (!emoji) continue;
      const row = grouped.get(emoji) || { emoji, count: 0, mine: false };
      row.count += 1;
      if (String(reaction?.agent_id || "") === me) row.mine = true;
      grouped.set(emoji, row);
    }

    return (
      '<div class="tb-reactions' + (grouped.size ? "" : " is-empty") + '" aria-label="Réactions">' +
      [...grouped.values()].map((row) =>
        '<button type="button" class="tb-reaction-chip' + (row.mine ? " is-mine" : "") +
          '" data-react-quick="' + esc(String(message.id || "")) +
          '" data-reaction-emoji="' + esc(row.emoji) +
          '" aria-label="Réagir ' + esc(row.emoji) + '">' +
          '<span>' + esc(row.emoji) + '</span>' +
          (row.count > 1 ? '<b>' + row.count + '</b>' : '') +
        '</button>'
      ).join("") +
      '<button type="button" class="tb-reaction-open" data-reaction-open="' +
        esc(String(message.id || "")) +
        '" aria-label="Ajouter une réaction"><span aria-hidden="true">☺</span></button>' +
      "</div>"
    );
  }

  async function reactToMessage(messageId, emoji) {
    if (!messageId || !emoji) return;
    try {
      await api("team_react", {
        message_id: String(messageId),
        emoji: String(emoji),
      });
      await Promise.all([loadFull(false), loadPreview(false)]);
    } catch (error) {
      alert(error.message || "Réaction impossible.");
    }
  }

  function openReactionPicker(messageId) {
    const message = messageById(messageId);
    if (!message || state.selection) return;
    document.querySelector(".tb-reaction-wrap")?.remove();

    const visibleReactions = quickReactions();
    const wrap = document.createElement("div");
    wrap.className = "tb-reaction-wrap";
    wrap.innerHTML =
      '<section class="tb-reaction-sheet" role="dialog" aria-label="Réagir au message">' +
        '<div class="tb-reaction-quick">' +
          visibleReactions.map((emoji) =>
            '<button type="button" data-reaction-pick="' + esc(emoji) + '" aria-label="' + esc(emoji) + '">' +
              esc(emoji) +
            '</button>'
          ).join("") +
          '<button type="button" class="tb-reaction-more-toggle" data-reaction-more aria-label="Plus de réactions">＋</button>' +
        '</div>' +
        '<div class="tb-reaction-more" data-reaction-more-grid hidden>' +
          MORE_REACTIONS.map((emoji) =>
            '<button type="button" data-reaction-pick="' + esc(emoji) + '" aria-label="' + esc(emoji) + '">' +
              esc(emoji) +
            '</button>'
          ).join("") +
        '</div>' +
        (state.data?.admin
          ? '<button type="button" class="tb-reaction-delete" data-reaction-delete><span aria-hidden="true">🗑</span><strong>Supprimer ce message</strong></button>'
          : '') +
      '</section>';

    const close = () => wrap.remove();
    wrap.querySelector("[data-reaction-more]")?.addEventListener("click", () => {
      const grid = wrap.querySelector("[data-reaction-more-grid]");
      if (grid) grid.hidden = !grid.hidden;
    });
    wrap.querySelectorAll("[data-reaction-pick]").forEach((button) => {
      button.addEventListener("click", async () => {
        const emoji = String(button.dataset.reactionPick || "");
        rememberReactionUse(emoji);
        close();
        await reactToMessage(messageId, emoji);
      });
    });
    wrap.querySelector("[data-reaction-delete]")?.addEventListener("click", async () => {
      close();
      const confirmed = await confirmDelete(1);
      if (!confirmed) return;
      try {
        await api("team_delete", { message_ids: [String(messageId)] });
        state.selected.delete(String(messageId));
        await Promise.all([loadFull(false), loadPreview(false)]);
      } catch (error) {
        alert(error.message || "Suppression impossible.");
      }
    });
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) close();
    });
    document.body.appendChild(wrap);
  }

  function openFreeReply(messageId) {
    return new Promise((resolve) => {
      const id = String(messageId || "");
      const message = messageById(id);
      if (!message || state.data?.can_write === false || state.data?.access_mode === "read") {
        resolve(false);
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      const preview = cleanWheelchairText(message.body || "") ||
        (message.payload?.wheelchair ? "Signalement fauteuil" : "Message");
      wrap.innerHTML =
        '<section class="tb-confirm tb-free-reply">' +
          '<div class="tb-confirm-icon">↩</div>' +
          '<h3>Répondre à ' + esc(agentName(message.sender)) + '</h3>' +
          '<p class="tb-free-reply-parent">' + esc(preview).slice(0, 180) + '</p>' +
          '<label class="tb-precision-field"><span>Réponse libre</span>' +
            '<textarea rows="3" maxlength="500" placeholder="Écrire une réponse…"></textarea>' +
          '</label>' +
          '<button type="button" class="tb-reply-send" data-reply-send><span>Envoyer</span><b>↑</b></button>' +
          '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
        '</section>';

      const close = (value = false) => {
        wrap.remove();
        resolve(value);
      };
      const input = wrap.querySelector("textarea");

      wrap.querySelector("[data-reply-send]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const body = String(input?.value || "").trim();
        if (!body) {
          input?.focus();
          return;
        }
        button.disabled = true;
        try {
          if (!(await ensurePrivacy())) {
            button.disabled = false;
            return;
          }
          await api("team_send", {
            body,
            reply_to_id: id,
          });
          state.scrollToLatestPending = true;
          await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
          close(true);
        } catch (error) {
          alert(error.message || "Réponse impossible.");
          button.disabled = false;
        }
      });

      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        wrap.querySelector("[data-reply-send]")?.click();
      });
      wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) close(false);
      });

      document.body.appendChild(wrap);
    });
  }

  async function deleteMessageFromSwipe(messageId) {
    const id = String(messageId || "");
    if (!id || state.deleteBusy) return;

    const message = messageById(id);
    const me = String(state.data?.me?.id || "");
    const canDelete =
      !!state.data?.admin ||
      String(message?.sender_agent_id || "") === me;
    if (!canDelete) return;

    const confirmed = await confirmDelete(1);
    if (!confirmed || state.deleteBusy) return;

    state.deleteBusy = true;
    try {
      await api("team_delete", { message_ids: [id] });
      state.selected.delete(id);
      await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
    } catch (error) {
      alert(error.message || "Suppression impossible.");
    } finally {
      state.deleteBusy = false;
      updateSelectionBar();
    }
  }

  function bindMessageGestures(root) {
    if (!root || root.dataset.reactionGestures === "1") return;
    root.dataset.reactionGestures = "1";

    let timer = 0;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let targetId = "";
    let pointerId = null;
    let active = false;
    let horizontal = false;
    let swiped = false;
    let longPressOpened = false;
    let swipeWrap = null;
    let swipeCard = null;

    const resetSwipe = () => {
      if (swipeCard) swipeCard.style.transform = "";
      swipeWrap?.classList.remove("is-delete", "is-react", "is-reply", "is-dragging");
      swipeWrap = null;
      swipeCard = null;
      dx = 0;
      horizontal = false;
    };

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = 0;
    };

    const clear = () => {
      clearTimer();
      targetId = "";
      pointerId = null;
      active = false;
      resetSwipe();
    };

    root.addEventListener("pointerdown", (event) => {
      if (state.selection) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest?.("button,input,textarea,label,a")) return;

      const item = event.target.closest?.("[data-message-id]");
      if (!item) return;

      clear();
      longPressOpened = false;
      swiped = false;
      active = true;
      targetId = String(item.dataset.messageId || "");
      pointerId = event.pointerId;
      startX = Number(event.clientX || 0);
      startY = Number(event.clientY || 0);
      dx = 0;
      swipeCard = item;
      swipeWrap = item.closest(".tb-message-swipe");

      try {
        item.setPointerCapture?.(event.pointerId);
      } catch {}

      timer = window.setTimeout(() => {
        const id = targetId;
        timer = 0;
        if (!id || horizontal) return;
        longPressOpened = true;
        try { navigator.vibrate?.(14); } catch {}
        openReactionPicker(id);
      }, 420);
    }, { passive: true });

    root.addEventListener("pointermove", (event) => {
      if (!active || (pointerId != null && event.pointerId !== pointerId)) return;

      const x = Number(event.clientX || 0) - startX;
      const y = Number(event.clientY || 0) - startY;

      if (!horizontal) {
        if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
        if (Math.abs(y) > Math.abs(x) * 1.1) {
          clearTimer();
          active = false;
          resetSwipe();
          return;
        }

        const canReply = swipeCard?.dataset.canReply === "1";
        if (x < 0 && !canReply) {
          if (Math.abs(x) > 26) clearTimer();
          return;
        }

        horizontal = true;
        clearTimer();
        swipeWrap?.classList.add("is-dragging");
      }

      if (!horizontal || !swipeCard) return;
      event.preventDefault();

      dx = Math.max(-122, Math.min(122, x));
      swiped = Math.abs(dx) > 12;
      swipeCard.style.transform = "translate3d(" + dx + "px,0,0)";

      const canDelete = swipeCard.dataset.canDelete === "1";
      swipeWrap?.classList.toggle("is-reply", dx < 0);
      swipeWrap?.classList.toggle("is-delete", dx > 0 && canDelete);
      swipeWrap?.classList.toggle("is-react", dx > 0 && !canDelete);
    }, { passive: false });

    const finish = async (event) => {
      if (pointerId != null && event?.pointerId != null && event.pointerId !== pointerId) return;

      clearTimer();
      const id = targetId;
      const finalDx = dx;
      const hadHorizontalSwipe = horizontal;
      const canDelete = swipeCard?.dataset.canDelete === "1";
      const canReply = swipeCard?.dataset.canReply === "1";

      active = false;
      targetId = "";
      pointerId = null;
      resetSwipe();

      if (hadHorizontalSwipe && id) {
        if (finalDx < -72 && canReply) {
          swiped = true;
          try { navigator.vibrate?.(10); } catch {}
          await openFreeReply(id);
        } else if (finalDx > 72) {
          swiped = true;
          try { navigator.vibrate?.(10); } catch {}
          if (canDelete) await deleteMessageFromSwipe(id);
          else openReactionPicker(id);
        }
      }

      window.setTimeout(() => {
        swiped = false;
        longPressOpened = false;
      }, 180);
    };

    root.addEventListener("pointerup", finish);
    root.addEventListener("pointercancel", () => {
      clearTimer();
      active = false;
      targetId = "";
      pointerId = null;
      resetSwipe();
      window.setTimeout(() => {
        swiped = false;
        longPressOpened = false;
      }, 180);
    });

    root.addEventListener("contextmenu", (event) => {
      if (state.selection || swiped) return;
      if (event.target.closest?.("button,input,textarea,label,a")) return;
      const item = event.target.closest?.("[data-message-id]");
      if (!item) return;
      event.preventDefault();
      const id = String(item.dataset.messageId || "");
      clearTimer();
      if (!longPressOpened) openReactionPicker(id);
      longPressOpened = false;
    });

    root.addEventListener("click", (event) => {
      if (swiped) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const open = event.target.closest?.("[data-reaction-open]");
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        openReactionPicker(String(open.dataset.reactionOpen || ""));
        return;
      }

      const chip = event.target.closest?.("[data-react-quick]");
      if (!chip) return;
      event.preventDefault();
      event.stopPropagation();
      reactToMessage(
        String(chip.dataset.reactQuick || ""),
        String(chip.dataset.reactionEmoji || ""),
      );
    });
  }

  function scrollPageToLatest() {
    if (!state.root?.isConnected || state.selection) return;
    const apply = () => {
      if (!state.root?.isConnected || state.selection) return;
      syncComposerDock();
      const scroller = document.scrollingElement || document.documentElement;
      const maxTop = Math.max(0, scroller.scrollHeight - window.innerHeight);
      scroller.scrollTop = maxTop;
      window.scrollTo(0, maxTop);
    };

    requestAnimationFrame(() => requestAnimationFrame(apply));
    window.setTimeout(apply, 90);
  }

  function wheelchairDisplayParts(message, wheelchair) {
    const building = BUILDINGS.find(
      (item) => item.key === String(wheelchair?.building || ""),
    );
    const hospital =
      building?.label ||
      String(wheelchair?.building || "").trim() ||
      "STIP";

    const level = String(wheelchair?.level || "").trim();
    const rawLocation = String(wheelchair?.location || "").trim();
    const distributedLocations = rawLocation.includes("|")
      ? rawLocation.split("|").map((part) => part.trim()).filter(Boolean)
      : [];
    const locationParts = distributedLocations.length
      ? []
      : rawLocation
          .split("·")
          .map((part) => part.trim())
          .filter(Boolean);

    let service = locationParts.shift() || "";
    let landmark = locationParts.join(" · ");

    // Backward compatibility for older structured messages whose location
    // only exists in the generated body.
    if (!service && message?.body) {
      const parts = cleanWheelchairText(message.body)
        .split("·")
        .map((part) => part.trim())
        .filter(Boolean);
      const hospitalIndex = parts.findIndex(
        (part) => norm(part) === norm(hospital),
      );
      if (hospitalIndex >= 0) {
        const afterHospital = parts.slice(hospitalIndex + 1);
        if (level && afterHospital[0] && norm(afterHospital[0]) === norm(level)) {
          afterHospital.shift();
        }
        service = afterHospital.shift() || "";
        landmark = afterHospital.join(" · ");
      }
    }

    return { hospital, level, service, landmark, locations: distributedLocations };
  }

  function wheelchairFreshnessWindowMs(wheelchair = {}) {
    const remaining = Math.max(
      1,
      Number(wheelchair?.quantity_remaining) ||
        Number(wheelchair?.quantity_total) ||
        1,
    );
    const persistence = normalizeWheelchairPersistence(
      wheelchair?.persistence || "normal",
      remaining,
    );

    const quantityBand =
      remaining >= 6 ? "many" :
      remaining >= 4 ? "four" :
      remaining === 3 ? "three" :
      remaining === 2 ? "two" :
      "one";

    const minutesByPlacement = {
      fast: {
        one: 40,
        two: 55,
        three: 75,
        four: 100,
        many: 120,
      },
      normal: {
        one: 80,
        two: 105,
        three: 135,
        four: 180,
        many: 210,
      },
      sheltered: {
        one: 180,
        two: 210,
        three: 240,
        four: 285,
        many: 330,
      },
    };

    const minutes =
      minutesByPlacement[persistence]?.[quantityBand] ||
      minutesByPlacement.normal[quantityBand];

    return minutes * 60 * 1000;
  }

  function wheelchairFreshnessTimeLabel(ms = 0) {
    const minutes = Math.max(0, Math.ceil(Number(ms || 0) / 60000));
    if (minutes <= 0) return "à vérifier";
    if (minutes < 60) return minutes + " min";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? hours + " h " + String(rest).padStart(2, "0") : hours + " h";
  }

  function wheelchairFreshness(message = {}, wheelchair = {}, now = Date.now()) {
    const rawSeenAt = wheelchair?.last_seen_at || message?.created_at || "";
    const seenAt = Date.parse(String(rawSeenAt));
    const windowMs = wheelchairFreshnessWindowMs(wheelchair);
    const age = Number.isFinite(seenAt) ? Math.max(0, now - seenAt) : windowMs;
    const progress = Math.min(1, age / windowMs);
    const position = Math.round(progress * 100);
    const remainingMs = Math.max(0, windowMs - age);

    let stage = "frozen";
    let icon = "🧊";
    let label = "Très peu probable";

    if (progress < 0.24) {
      stage = "hot";
      icon = "🔥";
      label = "Très probable";
    } else if (progress < 0.50) {
      stage = "warm";
      icon = "🔥";
      label = "Probable";
    } else if (progress < 0.72) {
      stage = "cooling";
      icon = "🧊";
      label = "À surveiller";
    } else if (progress < 0.90) {
      stage = "cold";
      icon = "🧊";
      label = "Peu probable";
    }

    return {
      position,
      stage,
      icon,
      label,
      timeLabel: wheelchairFreshnessTimeLabel(remainingMs),
    };
  }

  function wheelchairFreshnessMarkup(message, wheelchair) {
    if (!wheelchair || wheelchair.type === "search" || wheelchair.status !== "active") return "";
    const seenAt = String(wheelchair.last_seen_at || message.created_at || "");
    const freshness = wheelchairFreshness(message, wheelchair);
    return (
      '<div class="tb-wheelchair-freshness is-' + freshness.stage +
        '" data-wheelchair-freshness data-freshness-at="' + esc(seenAt) +
        '" data-freshness-persistence="' + esc(String(wheelchair.persistence || "normal")) +
        '" data-freshness-quantity="' + esc(String(wheelchair.quantity_remaining || wheelchair.quantity_total || 1)) +
        '" title="' + esc(freshness.label) + '">' +
        '<div class="tb-freshness-copy">' +
          '<span aria-hidden="true">' + freshness.icon + '</span>' +
          '<strong>' + esc(freshness.timeLabel) + '</strong>' +
          '<small>' + esc(freshness.label) + '</small>' +
        '</div>' +
        '<div class="tb-freshness-track" aria-hidden="true">' +
          '<i class="tb-freshness-marker" style="--freshness-position:' + freshness.position + '%"></i>' +
        '</div>' +
      '</div>'
    );
  }

  function updateWheelchairFreshnessIndicators() {
    const root = state.root;
    if (!root?.isConnected) return;

    root.querySelectorAll("[data-wheelchair-freshness]").forEach((node) => {
      const seenAt = String(node.dataset.freshnessAt || "");
      const freshness = wheelchairFreshness(
        { created_at: seenAt },
        {
          status: "active",
          type: "spot",
          last_seen_at: seenAt,
          persistence: String(node.dataset.freshnessPersistence || "normal"),
          quantity_remaining: Math.max(1, Number(node.dataset.freshnessQuantity) || 1),
        },
      );

      node.classList.remove("is-hot", "is-warm", "is-cooling", "is-cold", "is-frozen");
      node.classList.add("is-" + freshness.stage);

      const copy = node.querySelector(".tb-freshness-copy");
      if (copy) {
        copy.innerHTML =
          '<span aria-hidden="true">' + freshness.icon + '</span>' +
          '<strong>' + esc(freshness.timeLabel) + '</strong>' +
          '<small>' + esc(freshness.label) + '</small>';
      }
      node.title = freshness.label;

      const marker = node.querySelector(".tb-freshness-marker");
      marker?.style.setProperty("--freshness-position", freshness.position + "%");
    });
  }

  function renderMessages() {
    const feed = state.root?.querySelector("[data-feed]");
    if (!feed) return;

    const messages = state.data?.messages || [];
    const byId = new Map(messages.map((message) => [String(message.id), message]));
    const me = String(state.data?.me?.id || "");

    const rootIdFor = (message) => {
      let current = message;
      const seen = new Set([String(message?.id || "")]);
      while (current?.payload?.reply_to_id) {
        const parentId = String(current.payload.reply_to_id || "");
        if (!parentId || seen.has(parentId) || !byId.has(parentId)) break;
        seen.add(parentId);
        current = byId.get(parentId);
      }
      return String(current?.id || message?.id || "");
    };
    const repliesByRoot = new Map();
    const rootMessages = [];
    for (const message of messages) {
      const ownId = String(message.id || "");
      const rootId = rootIdFor(message);
      if (rootId && rootId !== ownId && byId.has(rootId)) {
        const list = repliesByRoot.get(rootId) || [];
        list.push(message);
        repliesByRoot.set(rootId, list);
      } else {
        rootMessages.push(message);
      }
    }

    const page = state.root?.querySelector(".tb-page");
    page?.classList.toggle("is-feed-empty", !messages.length);
    feed.classList.toggle("is-empty", !messages.length);

    if (!messages.length) {
      feed.innerHTML = "";
      updateSelectionBar();
      return;
    }

    const html = [];
    for (const message of rootMessages) {
      const id = String(message.id);
      const mine = String(message.sender_agent_id) === me;
      const canDeleteMessage = !!state.data?.admin || mine;
      const canReplyMessage = state.data?.can_write !== false && state.data?.access_mode !== "read";
      const checked = state.selected.has(id);
      const photo = message.payload?.photo_url || "";
      const replyToId = String(message.payload?.reply_to_id || "");
      const replyParent = replyToId ? byId.get(replyToId) : null;
      const wheelchair = message.payload?.wheelchair || null;
      const resolved = wheelchair?.status === "resolved";
      const activeSignal = wheelchair?.status === "active";
      const isSearchType = wheelchair?.type === "search";
      const searchSignal = activeSignal && isSearchType;
      const stock = isSearchType ? { total: 1, remaining: 1 } : wheelchairStock(message);

      html.push(
        '<div class="tb-message-swipe' + (canDeleteMessage ? " can-delete" : " can-react") + (canReplyMessage ? " can-reply" : "") + '">' +
          '<div class="tb-message-right-bg ' + (canDeleteMessage ? "is-delete-bg" : "is-react-bg") + '" aria-hidden="true">' +
            '<span>' + (canDeleteMessage ? "✕" : "☺") + '</span><strong>' + (canDeleteMessage ? "Supprimer" : "Réagir") + '</strong>' +
          '</div>' +
          '<div class="tb-message-reply-bg" aria-hidden="true"><strong>Répondre</strong><span>↩</span></div>' +
        '<article class="tb-entry ' +
          (mine ? "is-mine" : "") +
          (activeSignal ? " is-wheelchair" : "") +
          (searchSignal ? " is-search" : "") +
          (resolved ? " is-resolved" : "") +
          (checked ? " is-selected" : "") +
          '" data-message-id="' +
          esc(id) +
          '" data-can-delete="' + (canDeleteMessage ? "1" : "0") +
          '" data-can-reply="' + (canReplyMessage ? "1" : "0") +
          '">',
      );

      if (state.selection) {
        html.push(
          '<button type="button" class="tb-check' + (checked ? " is-checked" : "") +
            '" data-message-select="' + esc(id) +
            '" aria-pressed="' + (checked ? "true" : "false") +
            '" aria-label="' + (checked ? "Retirer de la sélection" : "Sélectionner ce message") + '">' +
            '<span>✓</span></button>',
        );
      }

      html.push(avatar(message.sender));
      html.push('<div class="tb-entry-body">');

      if (wheelchair) {
        const detail = wheelchairDisplayParts(message, wheelchair);
        html.push(
          '<div class="tb-wheelchair-head">' +
            '<strong class="tb-wheelchair-hospital">' + esc(detail.hospital) + '</strong>' +
            '<time><span aria-hidden="true">◷</span>' + esc(fmtTime(message.created_at)) + '</time>' +
          '</div>',
        );

        html.push(
          '<div class="tb-wheelchair-priority">' +
            '<span class="tb-status-chip' + (searchSignal ? " is-search" : "") + '">' +
              (isSearchType
                ? "Je cherche"
                : (stock.remaining > 1 ? stock.remaining + " disponibles" : "1 disponible")) +
            '</span>' +
            (detail.level
              ? '<strong class="tb-wheelchair-level">' + esc(detail.level) + '</strong>'
              : '') +
          '</div>',
        );

        if (detail.service) {
          html.push(
            '<strong class="tb-wheelchair-service">' + esc(detail.service) + '</strong>',
          );
        }
        if (detail.landmark) {
          html.push(
            '<span class="tb-wheelchair-landmark">' + esc(detail.landmark) + '</span>',
          );
        }
        if (Array.isArray(detail.locations) && detail.locations.length) {
          html.push(
            '<div class="tb-wheelchair-locations">' +
              detail.locations.map((place) =>
                '<span><b aria-hidden="true">•</b>' + esc(place) + '</span>'
              ).join("") +
            '</div>',
          );
        }
        html.push(
          '<small class="tb-wheelchair-author">' +
            esc(agentName(message.sender)) +
            (isSearchType ? " cherche" : " · signalé") +
          '</small>',
        );
        if (activeSignal && !isSearchType) {
          html.push(wheelchairFreshnessMarkup(message, wheelchair));
          if (wheelchair?.last_seen_at) {
            html.push(
              '<div class="tb-last-seen">' +
                '<span class="tb-last-seen-check" aria-hidden="true">✓</span>' +
                '<div><strong>Toujours là à ' + esc(fmtTime(wheelchair.last_seen_at)) + '</strong>' +
                '<small>Confirmé' +
                  (wheelchair.last_seen_by_name ? ' par ' + esc(wheelchair.last_seen_by_name) : '') +
                  ' · chrono relancé</small></div>' +
              '</div>',
            );
          }
        }
      } else {
        html.push(
          '<header><div><strong>' +
            esc(agentName(message.sender)) +
            '</strong></div><time><span aria-hidden="true">◷</span>' +
            esc(fmtTime(message.created_at)) +
            '</time></header>',
        );
      }

      if (replyParent) {
        const parentWheelchair = replyParent.payload?.wheelchair || null;
        const parentLabel = parentWheelchair?.type === "search" ? "Demande" : "Signalement";
        html.push(
          '<div class="tb-reply-context"><span aria-hidden="true">↪</span><div><strong>' +
            esc(parentLabel + " de " + agentName(replyParent.sender)) +
            '</strong><small>' +
            esc(cleanWheelchairText(replyParent.body || "")).slice(0, 150) +
            '</small></div></div>',
        );
      }
      if (message.body && !wheelchair) {
        html.push(
          '<p class="' + (replyParent ? "tb-reply-body" : "") + '">' +
            esc(String(message.body)).replace(/\n/g, "<br>") +
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
      html.push(reactionMarkup(message));
      if (activeSignal && !state.selection && state.data?.can_write !== false && state.data?.access_mode !== "read") {
        if (searchSignal) {
          html.push(
            '<button type="button" class="tb-resolve is-search" data-resolve="' +
              esc(id) +
              '"><span aria-hidden="true">✓</span><strong>J’ai trouvé</strong></button>',
          );
        } else {
          const takeLabel = "Je récupère";
          html.push(
            '<div class="tb-wheelchair-actions">' +
              '<button type="button" class="tb-resolve is-take tb-take-primary" data-take="' +
                esc(id) +
                '"><span aria-hidden="true">🦽</span><strong>' + esc(takeLabel) + '</strong></button>' +
              '<div class="tb-wheelchair-secondary">' +
                '<button type="button" class="tb-still-there" data-still-there="' +
                  esc(id) +
                  '"><span aria-hidden="true">👁</span><strong>' +
                  (stock.remaining > 1 ? "Je confirme qu’ils sont là" : "Je confirme qu’il est là") +
                  '</strong></button>' +
                '<button type="button" class="tb-report-missing" data-report-missing="' +
                  esc(id) +
                  '"><span aria-hidden="true">⚠️</span><strong>Je n’ai pas trouvé</strong></button>' +
              '</div>' +
            "</div>",
          );
          const takes = Array.isArray(wheelchair?.takes) ? wheelchair.takes : [];
          if (takes.length && stock.remaining > 0) {
            const lastTake = takes[takes.length - 1] || {};
            html.push(
              '<div class="tb-take-note"><strong>' +
                esc(String(lastTake.quantity || 1)) +
                " pris</strong>" +
                (lastTake.taken_by_name ? "<span>" + esc(lastTake.taken_by_name) + "</span>" : "") +
                (lastTake.taken_at ? "<time>" + esc(fmtTime(lastTake.taken_at)) + "</time>" : "") +
              "</div>",
            );
          }
        }
      } else if (resolved) {
        const wasSearch = wheelchair?.type === "search";
        html.push(
          '<div class="tb-resolved-line"><span aria-hidden="true">✓</span><strong>' +
            (wasSearch ? "Trouvé" : (stock.total > 1 ? "Tous pris" : "Pris")) +
            (wheelchair.resolved_at ? " à " + esc(fmtTime(wheelchair.resolved_at)) : "") +
            "</strong>" +
            (wheelchair.resolved_by_name ? "<small>" + esc(wheelchair.resolved_by_name) + "</small>" : "") +
            "</div>",
        );
      }
      const linkedReplies = repliesByRoot.get(id) || [];
      if (linkedReplies.length) {
        html.push('<section class="tb-thread-replies" aria-label="Réponses liées à ce signalement">');
        for (const reply of linkedReplies) {
          const replyId = String(reply.id || "");
          const replyMine = String(reply.sender_agent_id || "") === me;
          const replyCanDelete = !!state.data?.admin || replyMine;
          const replyCanReply = state.data?.can_write !== false && state.data?.access_mode !== "read";
          const replyChecked = state.selected.has(replyId);
          const replyBody = cleanWheelchairText(reply.body || "");
          html.push(
            '<div class="tb-message-swipe tb-thread-swipe' + (replyCanDelete ? ' can-delete' : ' can-react') + (replyCanReply ? ' can-reply' : '') + '">' +
              '<div class="tb-message-right-bg ' + (replyCanDelete ? 'is-delete-bg' : 'is-react-bg') + '" aria-hidden="true">' +
                '<span>' + (replyCanDelete ? '✕' : '☺') + '</span><strong>' + (replyCanDelete ? 'Supprimer' : 'Réagir') + '</strong>' +
              '</div>' +
              '<div class="tb-message-reply-bg" aria-hidden="true"><strong>Répondre</strong><span>↩</span></div>' +
              '<article class="tb-thread-reply' + (replyChecked ? ' is-selected' : '') +
              '" data-message-id="' + esc(replyId) +
              '" data-can-delete="' + (replyCanDelete ? '1' : '0') +
              '" data-can-reply="' + (replyCanReply ? '1' : '0') + '">'
          );
          if (state.selection) {
            html.push(
              '<button type="button" class="tb-check tb-thread-check' + (replyChecked ? ' is-checked' : '') +
                '" data-message-select="' + esc(replyId) +
                '" aria-pressed="' + (replyChecked ? 'true' : 'false') +
                '" aria-label="' + (replyChecked ? 'Retirer de la sélection' : 'Sélectionner ce message') + '">' +
                '<span>✓</span></button>'
            );
          }
          html.push(avatar(reply.sender));
          html.push(
            '<div class="tb-thread-reply-body">' +
              '<header><strong>' + esc(agentName(reply.sender)) + '</strong><time><span aria-hidden="true">◷</span>' +
                esc(fmtTime(reply.created_at)) + '</time></header>' +
              '<small class="tb-thread-link">↪ Réponse à ce signalement</small>' +
              (replyBody ? '<p>' + esc(replyBody).replace(/\n/g, "<br>") + '</p>' : '') +
              reactionMarkup(reply) +
            '</div></article></div>'
          );
        }
        html.push("</section>");
      }
      html.push("</div></article></div>");
    }

    feed.innerHTML = html.join("");

    updateSelectionBar();
    if (state.scrollToLatestPending && !state.selection) {
      state.scrollToLatestPending = false;
      scrollPageToLatest();
    }
  }

  function toggleSelection(enabled) {
    if (!state.data?.admin || state.deleteBusy) return;
    state.selection = !!enabled;
    if (!enabled) state.selected.clear();
    state.root?.querySelector(".tb-page")?.classList.toggle("is-selecting", state.selection);
    renderMessages();
  }

  function selectAll() {
    if (!state.selection || state.deleteBusy) return;
    const messages = state.data?.messages || [];
    if (state.selected.size === messages.length) state.selected.clear();
    else messages.forEach((message) => state.selected.add(String(message.id)));
    renderMessages();
  }

  function updateSelectionBar() {
    const bar = state.root?.querySelector("[data-selection-bar]");
    const count = state.root?.querySelector("[data-selection-count]");
    const manage = state.root?.querySelector("[data-select]");
    const page = state.root?.querySelector(".tb-page");
    if (!bar || !count) return;

    const messages = state.data?.messages || [];
    const validIds = new Set(messages.map((message) => String(message.id)));
    for (const id of [...state.selected]) {
      if (!validIds.has(id)) state.selected.delete(id);
    }

    const total = messages.length;
    page?.classList.toggle("is-selecting", !!state.selection);
    bar.hidden = !state.selection;
    count.textContent = String(state.selected.size);

    if (manage) {
      manage.hidden = !state.data?.admin || !total || state.selection;
      manage.textContent = "Gérer";
    }

    const allButton = bar.querySelector("[data-select-all]");
    if (allButton) {
      allButton.disabled = state.deleteBusy || !total;
      allButton.textContent =
        total > 0 && state.selected.size === total ? "Tout retirer" : "Tout sélectionner";
    }

    const deleteButton = bar.querySelector("[data-delete-selected]");
    if (deleteButton) {
      deleteButton.disabled = state.deleteBusy || !state.selected.size;
      deleteButton.textContent = state.deleteBusy ? "Suppression…" : "Supprimer";
    }

    const closeButton = bar.querySelector("[data-selection-close]");
    if (closeButton) closeButton.disabled = state.deleteBusy;
  }

  async function deleteSelected() {
    if (state.deleteBusy) return;
    const ids = [...state.selected];
    if (!ids.length || !state.data?.admin) return;

    const confirmed = await confirmDelete(ids.length);
    if (!confirmed || state.deleteBusy) return;

    state.deleteBusy = true;
    updateSelectionBar();
    try {
      await api("team_delete", { message_ids: ids });
      state.selected.clear();
      state.selection = false;
      state.root?.querySelector(".tb-page")?.classList.remove("is-selecting");
      await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
    } catch (error) {
      alert(error.message || "Suppression impossible.");
    } finally {
      state.deleteBusy = false;
      updateSelectionBar();
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
        (count > 1 ? " seront" : " sera") +
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
    const body = cleanWheelchairText(textarea.value);
    if (!body) return;
    if (!(await ensurePrivacy())) return;

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const structured = !!state.selectedBuilding;
      const type = state.draftKind === "search" ? "search" : "spot";
      await api("team_send", {
        body,
        ...(structured ? {
          wheelchair: {
            type,
            building: state.selectedBuilding,
            quantity: type === "spot" ? (state.selectedQuantity || inferWheelchairQuantity(body)) : 1,
            level: state.selectedLevel || "",
            location: state.selectedLocation || "",
          },
        } : {}),
      });
      textarea.value = "";
      state.draft = "";
      state.draftKind = state.composeMode;
      state.selectedBuilding = "";
      state.selectedQuantity = 0;
      state.selectedLevel = "";
      state.selectedLocation = "";
      delete textarea.dataset.open;
      textarea.hidden = true;
      autoGrow(textarea);
      renderSearchShortcuts();
      renderComposerState();
      state.scrollToLatestPending = true;
      await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
    } catch (error) {
      alert(error.message || "Publication impossible.");
    } finally {
      renderComposerState();
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
      alert(error.message || "Impossible de confirmer que le fauteuil a été trouvé.");
      if (button) button.disabled = false;
    }
  }

  function chooseTakeQuantity(remaining) {
    return new Promise((resolve) => {
      const available = Math.max(1, Math.min(20, Number(remaining) || 1));
      const singles = [];
      for (let n = 1; n <= Math.min(3, available - 1); n += 1) singles.push(n);

      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      wrap.innerHTML =
        '<section class="tb-confirm tb-take-picker">' +
        '<div class="tb-confirm-icon">🦽</div>' +
        "<h3>Combien tu prends ?</h3>" +
        "<p>Il y en a " + available + " de disponibles.</p>" +
        '<div class="tb-take-choices">' +
          singles.map((quantity) =>
            '<button type="button" data-take-qty="' + quantity + '"><strong>' + quantity + "</strong></button>"
          ).join("") +
          '<button type="button" class="all" data-take-qty="' + available + '"><strong>Tous</strong><small>' + available + "</small></button>" +
        "</div>" +
        '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
        "</section>";
      document.body.appendChild(wrap);

      const done = (value) => {
        wrap.remove();
        resolve(value);
      };
      wrap.querySelectorAll("[data-take-qty]").forEach((button) => {
        button.addEventListener("click", () => done(Number(button.dataset.takeQty) || 0));
      });
      wrap.querySelector("[data-no]")?.addEventListener("click", () => done(0));
      wrap.addEventListener("click", (event) => {
        if (event.target === wrap) done(0);
      });
    });
  }

  async function takeWheelchair(messageId) {
    if (!messageId) return;
    const message = (state.data?.messages || []).find((item) => String(item.id) === String(messageId));
    if (!message) return;
    const stock = wheelchairStock(message);
    if (stock.remaining < 1) return;

    const quantity = stock.remaining > 1
      ? await chooseTakeQuantity(stock.remaining)
      : 1;
    if (!quantity) return;

    const button = state.root?.querySelector('[data-take="' + CSS.escape(String(messageId)) + '"]');
    if (button) button.disabled = true;
    try {
      await api("team_take", {
        message_id: String(messageId),
        quantity,
      });
      await Promise.all([loadFull(false), loadPreview(false), loadHomeStatus(false)]);
    } catch (error) {
      alert(error.message || "Impossible d’enregistrer la prise.");
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
    const body = message?.payload?.wheelchair
      ? cleanWheelchairText(message?.body || "")
      : String(message?.body || "").trim();
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
    state.deleteBusy = false;
    state.interacting = false;
    if (state.interactionReleaseTimer) clearTimeout(state.interactionReleaseTimer);
    state.interactionReleaseTimer = 0;
    state.scrollToLatestPending = true;
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
    build: "20260924-confirmation1",
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