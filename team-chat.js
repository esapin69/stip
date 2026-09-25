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

  const dmState = {
    open: false,
    view: "home",
    home: null,
    me: null,
    agents: [],
    onDuty: [],
    selected: new Set(),
    conversationId: "",
    thread: null,
    loading: false,
    sending: false,
    timer: null,
    signature: "",
    search: "",
    draft: "",
    pendingImage: null,
    pendingPreviewUrl: "",
    scrollToLatest: false,
    unread: Number(window.STIPDMUnread || 0),
    statusLoading: false,
    statusTimer: null,
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

  let BUILDINGS = [
    { key: "neuro", label: "Neuro", aliases: ["neuro", "pierre wertheimer", "wertheimer", "pw"] },
    { key: "cardio", label: "Cardio", aliases: ["cardio", "louis pradel", "pradel", "hlp"] },
    { key: "hfme", label: "HFME", aliases: ["hfme", "femme mere enfant", "femme mère enfant", "mere enfant", "mère enfant"] },
    { key: "a4", label: "POP (A4)", aliases: ["pop", "a4", "pop a4", "batiment pop", "bâtiment pop", "batiment a4", "bâtiment a4"] },
    { key: "b14", label: "Médecine nucléaire", aliases: ["médecine nucléaire", "medecine nucleaire", "b14", "tep", "tep-ct", "tep ct", "imagerie nucléaire", "imagerie nucleaire"] },
  ];

  // Repères compacts issus du référentiel "Visiter les lieux" / 00 MASTER (09/2026).
  // L'interface les révèle progressivement : bâtiment -> niveau -> repère.
  // Catalogue des lieux : une seule source de vérité, stip_places via stip-messages.
  // Aucun service/niveau n'est maintenu en double dans ce fichier.
  const WHEELCHAIR_LOCATIONS = Object.create(null);
  let WHEELCHAIR_SEARCH_TARGETS = [];
  let wheelchairCatalogPromise = null;

  async function loadWheelchairCatalog() {
    if (wheelchairCatalogPromise) return wheelchairCatalogPromise;
    wheelchairCatalogPromise = (async () => {
      const catalog = await api("wheelchair_catalog");
      for (const key of Object.keys(WHEELCHAIR_LOCATIONS)) delete WHEELCHAIR_LOCATIONS[key];

      const merged = new Map(BUILDINGS.map((building) => [building.key, building]));
      for (const building of catalog?.all_buildings || catalog?.buildings || []) {
        if (!building?.key) continue;
        const previous = merged.get(building.key) || {};
        merged.set(building.key, {
          ...previous,
          key: building.key,
          label: building.label || previous.label || building.key,
          aliases: [...new Set([...(previous.aliases || []), ...(building.aliases || [])])],
        });
      }
      BUILDINGS = [...merged.values()];

      for (const building of catalog?.buildings || []) {
        if (!building?.key) continue;
        WHEELCHAIR_LOCATIONS[building.key] = (building.levels || []).map((group) => ({
          level: String(group.level || ""),
          places: (group.places || [])
            .map((place) => typeof place === "string" ? place : place?.label)
            .filter(Boolean),
        }));
      }

      WHEELCHAIR_SEARCH_TARGETS = (catalog?.targets || []).map((target) => ({
        buildingKey: String(target?.building_key || ""),
        buildingLabel: String(target?.building_label || ""),
        buildingAliases: Array.isArray(target?.building_aliases) ? target.building_aliases : [],
        level: String(target?.level || ""),
        location: String(target?.location || target?.label || ""),
        label: String(target?.label || target?.location || ""),
        aliases: Array.isArray(target?.aliases) ? target.aliases : [],
        summary: String(target?.summary || ""),
        type: String(target?.type || ""),
      })).filter((target) => target.buildingKey && target.label);

      return catalog;
    })().catch((error) => {
      wheelchairCatalogPromise = null;
      console.error("Catalogue fauteuils indisponible", error);
      return null;
    });
    return wheelchairCatalogPromise;
  }

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
        { label: "Ascenseurs · côté STIP", value: "Ascenseurs · côté STIP", icon: "🛗", persistence: "fast" },
        { label: "Ascenseurs · côté bloc", value: "Ascenseurs · côté bloc", icon: "🛗", persistence: "fast" },
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

  function wheelchairSpotKind(value = "") {
    const text = norm(value);
    if (/local a fauteuil|local fauteuil/.test(text)) return "wheelchair-local";
    if (/tout au fond|fond du couloir|fond de couloir/.test(text)) return "corridor-deep";
    if (/couloir isole/.test(text)) return "corridor-isolated";
    if (/couloir de passage/.test(text)) return "corridor-passage";
    if (/couloir/.test(text)) return "corridor";
    if (/ascenseur/.test(text) && /stip/.test(text)) return "lift-stip";
    if (/ascenseur/.test(text) && /bloc/.test(text)) return "lift-bloc";
    if (/ascenseur/.test(text)) return "lift";
    if (/salon d accueil|accueil principal|salon accueil/.test(text)) return "welcome";
    if (/hall/.test(text)) return "hall";
    if (/passerelle/.test(text)) return "bridge";
    if (/escalier escargot/.test(text)) return "spiral-stairs";
    if (/escalier/.test(text)) return "stairs";
    return text;
  }

  function sourcedWheelchairSpot(place = "") {
    const label = String(place || "").trim();
    const text = norm(label);
    if (!label) return null;

    if (/local a fauteuil|local fauteuil/.test(text)) {
      return { label, value:label, icon:"🦽", persistence:"sheltered", sourced:true };
    }
    if (/ascenseur/.test(text)) {
      return { label, value:label, icon:"🛗", persistence:"fast", sourced:true };
    }
    if (/hall/.test(text)) {
      return { label, value:label, icon:"🚪", persistence:"fast", sourced:true };
    }
    if (/salon d accueil|accueil principal|salon accueil/.test(text)) {
      return { label, value:label, icon:"🏥", persistence:"fast", sourced:true };
    }
    if (/passerelle/.test(text)) {
      return { label, value:label, icon:"↔", persistence:"sheltered", sourced:true };
    }
    if (/escalier escargot/.test(text)) {
      return { label, value:label, icon:"↕", persistence:"sheltered", sourced:true };
    }

    // Any canonical service/unit/landmark is already a valid precise place.
    // Keep it available instead of dropping it in favour of generic field clues.
    return { label, value:label, icon:"📍", persistence:"normal", sourced:true };
  }

  function wheelchairFieldSpots(buildingKey = "", level = "") {
    const key = String(buildingKey || "");
    const config = WHEELCHAIR_FIELD_SPOTS[key] || {};
    const featured = Array.isArray(config.featured?.[level]) ? config.featured[level] : [];
    const common = Array.isArray(config.common) ? config.common : [];
    const sourceLevel = (WHEELCHAIR_LOCATIONS[key] || []).find(
      (item) => String(item.level || "") === String(level || ""),
    );
    const sourced = Array.isArray(sourceLevel?.places)
      ? sourceLevel.places.map(sourcedWheelchairSpot).filter(Boolean)
      : [];

    const candidates = [
      ...featured.map((item) => ({ ...item, featured:true })),
      ...sourced.map((item) => ({ ...item, featured:false })),
      ...common.map((item) => ({ ...item, featured:false })),
    ];

    const seenValues = new Set();
    const seenKinds = new Set();
    const result = [];

    for (const item of candidates) {
      const valueKey = norm(item.value || item.label || "");
      const kind = wheelchairSpotKind(item.value || item.label || "");
      if (!valueKey || seenValues.has(valueKey)) continue;

      // A sourced, more precise lift/hall/accueil replaces the generic version.
      if (seenKinds.has(kind)) continue;

      seenValues.add(valueKey);
      seenKinds.add(kind);
      result.push(item);
      if (result.length >= 5) break;
    }

    return result;
  }

  function wheelchairLevelContextOptions(buildingKey = "", level = "", exclude = []) {
    const group = (WHEELCHAIR_LOCATIONS[String(buildingKey || "")] || []).find(
      (item) => String(item.level || "") === String(level || ""),
    );
    const excluded = new Set((exclude || []).map((value) => norm(value)));
    const seen = new Set();
    const options = [];

    for (const place of group?.places || []) {
      const label = String(place || "").trim();
      const key = norm(label);
      if (!label || !key || seen.has(key) || excluded.has(key)) continue;
      if (isVagueWheelchairSpotLocation(label)) continue;
      seen.add(key);
      options.push(label);
      if (options.length >= 6) break;
    }

    return options;
  }

  const norm = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  function wheelchairLevelDisplay(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^RDC$/i.test(raw) || /^RDJ$/i.test(raw) || /^TM$/i.test(raw)) return raw.toUpperCase();
    const numeric = raw.match(/^(\d{1,2})(?:er|e|eme|ème)?$/i);
    if (!numeric) return raw;
    const floor = Number(numeric[1]);
    return floor === 1 ? "1er étage" : floor + "e étage";
  }

  function isVagueWheelchairSpotLocation(value = "") {
    const parts = String(value || "")
      .split("|")
      .map((part) => norm(part))
      .filter(Boolean);
    if (!parts.length) return true;

    const generic = new Set([
      "ascenseur",
      "ascenseurs",
      "couloir",
      "escalier",
      "escaliers",
      "hall",
      "accueil",
      "entree",
    ]);

    return parts.every((part) =>
      generic.has(part) ||
      /^tout le\b/.test(part) ||
      /^tout l etage\b/.test(part),
    );
  }

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

  function agentFirstName(agent = {}) {
    const preferred = String(agent.nickname || agent.prenom || "").trim();
    if (preferred) return preferred.split(/\s+/)[0];
    const fallback = String(agentName(agent)).trim();
    return fallback ? fallback.split(/\s+/)[0] : "Agent";
  }

  function avatar(agent = {}, { showFirstName = false } = {}) {
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
      '<span class="tb-avatar' + (showFirstName ? ' has-name' : '') + '" data-avatar-fallback="' +
      esc(initials) +
      '">' +
        '<span class="tb-avatar-photo">' +
          (src
            ? '<img src="' + esc(src) + '" alt="" loading="lazy">'
            : esc(initials)) +
        '</span>' +
        (showFirstName
          ? '<small class="tb-avatar-name">' + esc(agentFirstName(agent)) + '</small>'
          : '') +
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
      '<span class="tb-active-count" data-active-count hidden></span><span class="tb-readonly" data-readonly hidden>Lecture seule</span>' +
      '<button type="button" class="tb-dm-shortcut" data-dm-open aria-label="Ouvrir les messages privés"><span class="tb-dm-shortcut-icon">✉</span><strong>DM</strong><b class="tb-dm-shortcut-badge" data-dm-unread hidden></b></button>' +
      '<button type="button" class="tb-manage" data-select hidden>Gérer</button>' +
      "</section>" +
      '<section class="tb-dm-panel" data-dm-panel hidden aria-label="Messages privés"></section>' +
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
      startDmStatus();
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
    stopDmStatus();
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
      const dmOpen = event.target.closest?.("[data-dm-open]");
      if (dmOpen) {
        event.preventDefault();
        openDm();
        return;
      }
      const dmClose = event.target.closest?.("[data-dm-close]");
      if (dmClose) {
        event.preventDefault();
        closeDm();
        return;
      }
      const dmBack = event.target.closest?.("[data-dm-back]");
      if (dmBack) {
        event.preventDefault();
        loadDmHome(false);
        return;
      }
      const dmAgent = event.target.closest?.("[data-dm-agent]");
      if (dmAgent) {
        event.preventDefault();
        toggleDmRecipient(String(dmAgent.dataset.dmAgent || ""));
        return;
      }
      const dmDuty = event.target.closest?.("[data-dm-duty]");
      if (dmDuty) {
        event.preventDefault();
        selectDmOnDuty();
        return;
      }
      const dmAll = event.target.closest?.("[data-dm-all]");
      if (dmAll) {
        event.preventDefault();
        selectDmAll();
        return;
      }
      const dmStart = event.target.closest?.("[data-dm-start]");
      if (dmStart) {
        event.preventDefault();
        startDmConversation();
        return;
      }
      const dmConversation = event.target.closest?.("[data-dm-conversation]");
      if (dmConversation) {
        event.preventDefault();
        openDmConversation(String(dmConversation.dataset.dmConversation || ""));
        return;
      }
      const dmAttach = event.target.closest?.("[data-dm-attach]");
      if (dmAttach) {
        event.preventDefault();
        state.root?.querySelector("[data-dm-file]")?.click();
        return;
      }
      const dmRemoveImage = event.target.closest?.("[data-dm-remove-image]");
      if (dmRemoveImage) {
        event.preventDefault();
        clearDmImage();
        renderDmThread();
        return;
      }
      const dmPhoto = event.target.closest?.("[data-dm-photo]");
      if (dmPhoto) {
        event.preventDefault();
        event.stopPropagation();
        openPhoto(String(dmPhoto.dataset.dmPhoto || ""));
        return;
      }

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
    if (WHEELCHAIR_SEARCH_TARGETS.length) {
      return WHEELCHAIR_SEARCH_TARGETS
        .filter((target) => !buildingKey || target.buildingKey === buildingKey)
        .filter((target) => !level || target.level === level)
        .map((target) => {
          const unit = String(target.label || "").match(/\bU\s*(\d{2,3})\b/i)?.[1] || "";
          const baseSearch = [
            target.buildingLabel,
            ...(target.buildingAliases || []),
            target.level,
            levelSearchAliases(target.level),
            target.label,
            ...(target.aliases || []),
            target.summary,
            unit ? "unite " + unit + " unité " + unit + " u" + unit : "",
          ].join(" ");
          return {
            buildingKey: target.buildingKey,
            buildingLabel: target.buildingLabel,
            level: target.level,
            location: target.location,
            label: target.label,
            hint: [target.buildingLabel, target.level].filter(Boolean).join(" · "),
            search: norm(baseSearch),
          };
        });
    }

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

  async function chooseLocationShortcut(options = {}) {
    await loadWheelchairCatalog();
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

  function chooseQuantityOnly(contextLabel = "") {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      wrap.innerHTML =
        '<section class="tb-confirm tb-quantity-picker">' +
          '<div class="tb-confirm-icon">🦽</div>' +
          "<h3>Combien de fauteuils ?</h3>" +
          "<p>" + esc(contextLabel) + "</p>" +
          '<div class="tb-quantity-choices" aria-label="Nombre de fauteuils">' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
              '<button type="button" class="tb-quantity-choice" data-qty="' + n + '">' +
                '<span class="tb-quantity-wheel" aria-hidden="true">🦽</span>' +
                '<strong>×' + n + "</strong>" +
              "</button>"
            ).join("") +
            '<button type="button" class="more tb-quantity-choice" data-qty-more>' +
              '<span class="tb-quantity-wheel" aria-hidden="true">🦽</span>' +
              '<strong>×10+</strong><small>10 à 20</small>' +
            "</button>" +
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
    if (level) parts.push(wheelchairLevelDisplay(level));
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
      quantity = await chooseQuantityOnly([result.buildingLabel, wheelchairLevelDisplay(result.level)].filter(Boolean).join(" · "));
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
        '<div class="tb-place-featured">' +
          '<button type="button" class="tb-place-featured-btn' + (state.selectedBuilding === "b14" ? " is-active" : "") + '" data-building-compose="b14" aria-pressed="' + (state.selectedBuilding === "b14" ? "true" : "false") + '">' +
            '<span aria-hidden="true">☢</span><strong>Médecine nucléaire</strong><small>B14</small>' +
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
    if (type === "spot" && isVagueWheelchairSpotLocation(finalLocation)) {
      throw Error("Précise l’endroit pour que le fauteuil puisse être retrouvé.");
    }
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
    let persistenceOverride = ["fast", "sheltered"].includes(
      String(payload.persistenceOverride || "").trim(),
    )
      ? String(payload.persistenceOverride)
      : "";
    let persistence = persistenceOverride || "normal";
    const summary = structuredDraft({
      type,
      building,
      quantity: payload.quantity || 1,
      level: payload.level || "",
      location,
    });
    const needsPrecision = type === "spot" && isVagueWheelchairSpotLocation(location);

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
        (type === "spot"
          ? '<div class="tb-confidence-override" aria-label="Information supplémentaire">' +
              '<div class="tb-confidence-label"><strong>Info en plus</strong><small data-confidence-mode>facultatif</small></div>' +
              '<div class="tb-confidence-actions">' +
                '<button type="button" data-confidence="fast" aria-label="Peut partir vite"><span>🧊</span><strong>Peut partir vite</strong></button>' +
                '<button type="button" data-confidence="sheltered" aria-label="Plutôt stable"><span>🔥</span><strong>Plutôt stable</strong></button>' +
              '</div>' +
            '</div>'
          : '') +

        '<label class="tb-precision-field"><span>' +
          (needsPrecision ? 'Préciser l’endroit <em>obligatoire</em>' : 'Ajouter une précision <em>facultatif</em>') +
          '</span>' +
          '<textarea rows="3" maxlength="160" placeholder="Ex. devant Pneumologie B, ascenseur central…"></textarea>' +
        "</label>" +
        '<button type="button" class="tb-review-send" data-review-send' + (needsPrecision ? ' disabled' : '') + '>' +
          '<span>' + (type === "search" ? "Envoyer ma demande" : "Envoyer l’info") + '</span><b>↑</b>' +
        "</button>" +
        '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
      "</section>";

    const input = wrap.querySelector(".tb-precision-field textarea");
    const syncReviewSend = () => {
      const button = wrap.querySelector("[data-review-send]");
      if (!button || type !== "spot") return;
      const candidateLocation = [location, String(input?.value || "").trim()]
        .filter(Boolean)
        .join(" · ");
      const vague = isVagueWheelchairSpotLocation(candidateLocation);
      button.disabled = vague;
      button.setAttribute("aria-disabled", vague ? "true" : "false");
    };
    input?.addEventListener("input", syncReviewSend);
    syncReviewSend();

    const syncConfidence = () => {
      if (type !== "spot") return;
      persistence = persistenceOverride || "normal";
      wrap.querySelectorAll("[data-confidence]").forEach((button) => {
        const value = String(button.dataset.confidence || "");
        const active = persistenceOverride === value;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const mode = wrap.querySelector("[data-confidence-mode]");
      if (mode) {
        mode.textContent =
          persistenceOverride === "fast"
            ? "🧊 peut partir vite"
            : persistenceOverride === "sheltered"
              ? "🔥 plutôt stable"
              : "facultatif";
      }
    };

    wrap.querySelectorAll("[data-confidence]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = String(button.dataset.confidence || "");
        persistenceOverride = persistenceOverride === value ? "" : value;
        payload.persistenceOverride = persistenceOverride;
        payload.persistence = persistenceOverride || "normal";
        syncConfidence();
      });
    });
    syncConfidence();

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
      payload.persistence = persistenceOverride || "normal";
      payload.persistenceOverride = persistenceOverride;
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
          persistence: persistenceOverride || "normal",
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

  async function chooseSpotDetails(building) {
    await loadWheelchairCatalog();
    return new Promise((resolve) => {
      const levels = WHEELCHAIR_LOCATIONS[building.key] || [];
      let quantity = 0;
      let level = "";
      let persistenceOverride = "";
      const selectedPlaces = new Set();

      const wrap = document.createElement("div");
      wrap.className = "tb-modal-wrap";
      const close = (value = false) => {
        wrap.remove();
        resolve(value);
      };

      const wizardProgress = (active) => {
        const steps = [
          ["1", "Étage"],
          ["2", "Fauteuils"],
          ["3", "Endroit"],
        ];
        return (
          '<div class="tb-wizard-progress" aria-label="Étape ' + active + ' sur 3">' +
            steps.map((step, index) => {
              const number = index + 1;
              const cls = number === active ? " is-active" : number < active ? " is-done" : "";
              return '<span class="tb-wizard-progress-step' + cls + '">' +
                '<b>' + step[0] + '</b><small>' + step[1] + '</small>' +
              '</span>';
            }).join('<i aria-hidden="true">›</i>') +
          '</div>'
        );
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
            persistence: persistenceOverride || "normal",
            persistenceOverride,
          },
          { back: level ? renderPlaces : renderLevels, close },
        );
      };

      const renderLevels = () => {
        wrap.innerHTML =
          '<section class="tb-confirm tb-spot-wizard">' +
            '<div class="tb-wizard-head"><span></span><div class="tb-confirm-icon">↕</div></div>' +
            wizardProgress(1) +
            "<h3>Quel étage ?</h3>" +
            "<p>" + esc(building.label) + "</p>" +
            '<div class="tb-level-choices tb-spot-level-choices" aria-label="Choisir un étage">' +
              levels.map((item) =>
                '<button type="button" data-level="' + esc(item.level) + '">' +
                  '<small>NIVEAU</small><strong>' + esc(wheelchairLevelDisplay(item.level)) + "</strong>" +
                "</button>"
              ).join("") +
            "</div>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";

        wrap.querySelectorAll("[data-level]").forEach((button) => {
          button.addEventListener("click", () => {
            level = String(button.dataset.level || "");
            quantity = 0;
            selectedPlaces.clear();
            renderQuantity();
          });
        });
        wrap.querySelector("[data-no]")?.addEventListener("click", () => close(false));
      };

      const renderQuantity = () => {
        wrap.innerHTML =
          '<section class="tb-confirm tb-spot-wizard">' +
            '<div class="tb-wizard-head"><button type="button" class="tb-wizard-back" data-back-level aria-label="Retour aux étages">‹</button><div class="tb-confirm-icon">🦽</div></div>' +
            wizardProgress(2) +
            "<h3>Combien de fauteuils ?</h3>" +
            "<p>" + esc(building.label) + " · " + esc(wheelchairLevelDisplay(level)) + "</p>" +
            '<div class="tb-quantity-choices" aria-label="Nombre de fauteuils">' +
              [1,2,3,4,5,6,7,8,9].map((n) =>
                '<button type="button" class="tb-quantity-choice" data-spot-qty="' + n + '">' +
                  '<span class="tb-quantity-wheel" aria-hidden="true">🦽</span>' +
                  '<strong>×' + n + "</strong>" +
                "</button>"
              ).join("") +
              '<button type="button" class="more tb-quantity-choice" data-spot-more>' +
                '<span class="tb-quantity-wheel" aria-hidden="true">🦽</span>' +
                '<strong>×10+</strong><small>10 à 20</small>' +
              "</button>" +
            "</div>" +
            '<div class="tb-quantity-more" data-spot-more-panel hidden>' +
              '<label for="tbSpotQuantity">Nombre de fauteuils</label>' +
              '<div><input id="tbSpotQuantity" type="number" inputmode="numeric" min="10" max="20" step="1" value="10">' +
              '<button type="button" data-spot-more-ok>Valider</button></div>' +
              '<small data-spot-qty-error aria-live="polite"></small>' +
            "</div>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";

        wrap.querySelector("[data-back-level]")?.addEventListener("click", renderLevels);
        bindQuantity();
      };

      const renderPlaces = () => {
        const quickPlaces = wheelchairFieldSpots(building.key, level);
        const selectedValues = [...selectedPlaces];
        const vagueSelections = selectedValues.filter((value) =>
          isVagueWheelchairSpotLocation(value),
        );
        const activeVague = vagueSelections[0] || "";
        const contextOptions = activeVague
          ? wheelchairLevelContextOptions(building.key, level, selectedValues)
          : [];
        const unresolved = vagueSelections.length > 0;
        const elevatorFollowup = !!activeVague && norm(activeVague).includes("ascenseur");

        wrap.innerHTML =
          '<section class="tb-confirm tb-spot-wizard">' +
            '<div class="tb-wizard-head"><button type="button" class="tb-wizard-back" data-back-quantity aria-label="Retour au nombre de fauteuils">‹</button><div class="tb-confirm-icon">📍</div></div>' +
            wizardProgress(3) +
            "<h3>Où exactement ?</h3>" +
            "<p>" + esc(building.label) + " · " + esc(wheelchairLevelDisplay(level)) + " · 🦽 ×" + esc(quantity) + "</p>" +
            '<div class="tb-place-choices tb-field-spot-choices">' +
              quickPlaces.map((place) => {
                const selected = selectedPlaces.has(place.value);
                return '<button type="button" class="tb-place-toggle' + (place.featured ? " is-featured" : "") + (selected ? " is-selected" : "") + '" data-place="' + esc(place.value) + '" aria-pressed="' + (selected ? "true" : "false") + '">' +
                  '<span class="tb-place-icon" aria-hidden="true">' + esc(place.icon || "📍") + '</span>' +
                  '<strong>' + esc(place.label) + '</strong>' +
                "</button>";
              }).join("") +
              '<button type="button" class="other" data-place-other><strong>Autre endroit…</strong></button>' +
            "</div>" +
            (activeVague
              ? '<section class="tb-place-followup' + (elevatorFollowup ? " is-elevator-panel" : "") + '" aria-label="Préciser le repère choisi">' +
                  '<div class="tb-place-followup-copy"><strong>' + esc(activeVague) + '</strong><small>' +
                    (elevatorFollowup
                      ? "Choisis le repère qui correspond à la sortie ou au côté de l’ascenseur."
                      : "Précise avec un repère du " + esc(wheelchairLevelDisplay(level))) +
                  '</small></div>' +
                  (contextOptions.length
                    ? '<div class="tb-place-followup-options' + (elevatorFollowup ? " is-elevator-options" : "") + '">' +
                        contextOptions.map((label) =>
                          '<button type="button" data-place-followup="' + esc(label) + '">' +
                            '<span aria-hidden="true">' + (elevatorFollowup ? "🛗" : "＋") + '</span>' +
                            '<strong>' + esc(label) + '</strong>' +
                          '</button>'
                        ).join("") +
                      '</div>'
                    : '') +
                  '<button type="button" class="tb-place-followup-other" data-place-followup-other>Autre précision…</button>' +
                '</section>'
              : '') +
            '<div class="tb-place-temperature" aria-label="Information supplémentaire sur la stabilité">' +
              '<div class="tb-place-temperature-copy"><strong>Info en plus</strong><small>facultatif · ce n’est pas un lieu</small></div>' +
              '<div class="tb-place-temperature-actions">' +
                '<button type="button" class="' + (persistenceOverride === "fast" ? "is-selected" : "") + '" data-place-temperature="fast" aria-pressed="' + (persistenceOverride === "fast" ? "true" : "false") + '"><span>🧊</span><strong>Peut partir vite</strong></button>' +
                '<button type="button" class="' + (persistenceOverride === "sheltered" ? "is-selected" : "") + '" data-place-temperature="sheltered" aria-pressed="' + (persistenceOverride === "sheltered" ? "true" : "false") + '"><span>🔥</span><strong>Plutôt stable</strong></button>' +
              "</div>" +
            "</div>" +
            '<button type="button" class="tb-review-send tb-place-continue" data-place-continue' + (!selectedPlaces.size || unresolved ? " disabled" : "") + '>' +
              '<span>' + (unresolved ? "Précise le repère ci-dessus" : "Continuer" + (selectedValues.length > 1 ? " · " + selectedValues.length + " endroits" : "")) + '</span><b>›</b>' +
            "</button>" +
            '<button type="button" class="tb-take-cancel" data-no>Annuler</button>' +
          "</section>";

        wrap.querySelector("[data-back-quantity]")?.addEventListener("click", renderQuantity);

        wrap.querySelectorAll("[data-place]").forEach((button) => {
          button.addEventListener("click", () => {
            const value = String(button.dataset.place || "");
            if (selectedPlaces.has(value)) selectedPlaces.delete(value);
            else selectedPlaces.add(value);
            renderPlaces();
          });
        });

        wrap.querySelectorAll("[data-place-followup]").forEach((button) => {
          button.addEventListener("click", () => {
            if (!activeVague) return;
            const context = String(button.dataset.placeFollowup || "").trim();
            if (!context) return;
            selectedPlaces.delete(activeVague);
            selectedPlaces.add(activeVague + " · " + context);
            renderPlaces();
          });
        });

        wrap.querySelector("[data-place-followup-other]")?.addEventListener("click", async () => {
          if (!activeVague) return;
          const result = await chooseLocationShortcut({
            buildingKey: building.key,
            level,
          });
          if (!result || !wrap.isConnected) return;
          const precise = String(result.location || "").trim();
          if (!precise) return;
          selectedPlaces.delete(activeVague);
          selectedPlaces.add(activeVague + " · " + precise);
          renderPlaces();
        });

        wrap.querySelectorAll("[data-place-temperature]").forEach((button) => {
          button.addEventListener("click", () => {
            const value = String(button.dataset.placeTemperature || "");
            persistenceOverride = persistenceOverride === value ? "" : value;
            renderPlaces();
          });
        });

        wrap.querySelector("[data-place-continue]")?.addEventListener("click", () => {
          if (!selectedPlaces.size || unresolved) return;
          const locations = [...selectedPlaces];
          renderStructuredReview(
            wrap,
            {
              type:"spot",
              buildingKey:building.key,
              quantity,
              level,
              location:locations.join(" | "),
              persistence:persistenceOverride || "normal",
              persistenceOverride,
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
            if (quantity) {
              selectedPlaces.clear();
              renderPlaces();
            }
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
          selectedPlaces.clear();
          renderPlaces();
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
      renderLevels();
    });
  }

  async function chooseSearchDetails(building) {
    await loadWheelchairCatalog();
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
        const resolved =
          window.STIPGesture?.axis?.(x, y, {
            deadZone: 8,
            horizontalRatio: 1.35,
          }) ||
          (Math.max(Math.abs(x), Math.abs(y)) < 8
            ? ""
            : Math.abs(x) >= Math.abs(y) * 1.35
              ? "x"
              : "y");
        if (!resolved) return;
        if (resolved === "y") {
          clearTimer();
          active = false;
          resetSwipe();
          return;
        }

        const canReply = swipeCard?.dataset.canReply === "1";
        if (x > 0 && !canReply) {
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
      swipeWrap?.classList.toggle("is-reply", dx > 0);
      swipeWrap?.classList.toggle("is-delete", dx < 0 && canDelete);
      swipeWrap?.classList.toggle("is-react", dx < 0 && !canDelete);
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
        if (finalDx > 72 && canReply) {
          swiped = true;
          try { navigator.vibrate?.(10); } catch {}
          await openFreeReply(id);
        } else if (finalDx < -72) {
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

    const rawLevel = String(wheelchair?.level || "").trim();
    const level = wheelchairLevelDisplay(rawLevel);
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
        if (
          rawLevel &&
          afterHospital[0] &&
          [norm(rawLevel), norm(level)].includes(norm(afterHospital[0]))
        ) {
          afterHospital.shift();
        }
        service = afterHospital.shift() || "";
        landmark = afterHospital.join(" · ");
      }
    }

    return {
      hospital,
      level,
      service,
      landmark,
      locations: distributedLocations,
      needsPrecision:
        wheelchair?.type !== "search" &&
        isVagueWheelchairSpotLocation(rawLocation),
    };
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
    // The label is a countdown, so the marker must also decrease toward zero.
    const position = Math.round((1 - progress) * 100);
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
    const aria = freshness.timeLabel + " restantes · " + freshness.label;
    return (
      '<div class="tb-wheelchair-freshness is-' + freshness.stage +
        '" data-wheelchair-freshness data-freshness-at="' + esc(seenAt) +
        '" data-freshness-persistence="' + esc(String(wheelchair.persistence || "normal")) +
        '" data-freshness-quantity="' + esc(String(wheelchair.quantity_remaining || wheelchair.quantity_total || 1)) +
        '" title="' + esc(freshness.label) + '">' +
        '<div class="tb-freshness-track" role="img" aria-label="' + esc(aria) + '">' +
          '<span class="tb-freshness-state">' +
            '<strong data-freshness-time>' + esc(freshness.timeLabel) + '</strong>' +
            '<small data-freshness-label>' + esc(freshness.label) + '</small>' +
          '</span>' +
          '<i class="tb-freshness-marker" style="--freshness-position:' + freshness.position + '%">' +
            '<span data-freshness-icon>' + freshness.icon + '</span>' +
          '</i>' +
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
      node.title = freshness.label;

      const time = node.querySelector("[data-freshness-time]");
      if (time) time.textContent = freshness.timeLabel;

      const label = node.querySelector("[data-freshness-label]");
      if (label) label.textContent = freshness.label;

      const track = node.querySelector(".tb-freshness-track");
      if (track) {
        track.setAttribute(
          "aria-label",
          freshness.timeLabel + " restantes · " + freshness.label,
        );
      }

      const marker = node.querySelector(".tb-freshness-marker");
      if (marker) {
        marker.style.setProperty("--freshness-position", freshness.position + "%");
        const icon = marker.querySelector("[data-freshness-icon]");
        if (icon) icon.textContent = freshness.icon;
      }
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

      html.push(avatar(message.sender, { showFirstName: true }));
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
          '</div>',
        );

        if (detail.level) {
          html.push(
            '<div class="tb-wheelchair-floor">' +
              '<span aria-hidden="true">↕</span>' +
              '<strong>' + esc(detail.level) + '</strong>' +
            '</div>',
          );
        }

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
        if (detail.needsPrecision) {
          html.push(
            '<span class="tb-wheelchair-location-warning">⚠ Endroit à préciser</span>',
          );
        }
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
      if (
        structured &&
        type === "spot" &&
        isVagueWheelchairSpotLocation(state.selectedLocation || "")
      ) {
        throw Error("Précise l’endroit pour que le fauteuil puisse être retrouvé.");
      }
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



  function dmPanel() {
    return state.root?.querySelector("[data-dm-panel]") || null;
  }
  function renderDmShortcut() {
    const button = state.root?.querySelector("[data-dm-open]");
    if (!button) return;
    const count = Math.max(0, Number(dmState.unread || 0));
    const badge = button.querySelector("[data-dm-unread]");
    button.classList.toggle("has-unread", count > 0);
    button.setAttribute(
      "aria-label",
      count
        ? "Ouvrir les messages privés · " + count + " non lu" + (count > 1 ? "s" : "")
        : "Ouvrir les messages privés",
    );
    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 99 ? "99+" : String(count);
    }
  }

  function setDmUnread(count) {
    dmState.unread = Math.max(0, Number(count || 0));
    window.STIPDMUnread = dmState.unread;
    renderDmShortcut();
  }

  async function loadDmStatus() {
    if (!state.root?.isConnected || dmState.statusLoading) return;
    dmState.statusLoading = true;
    try {
      const result = await api("dm_status");
      setDmUnread(result?.unread || 0);
    } catch {
    } finally {
      dmState.statusLoading = false;
    }
  }

  function stopDmStatus() {
    if (dmState.statusTimer) clearInterval(dmState.statusTimer);
    dmState.statusTimer = null;
    dmState.statusLoading = false;
  }

  function startDmStatus() {
    stopDmStatus();
    renderDmShortcut();
    loadDmStatus();
    dmState.statusTimer = setInterval(() => {
      if (!state.root?.isConnected) return stopDmStatus();
      if (!document.hidden) loadDmStatus();
    }, 10000);
  }


  function clearDmImage() {
    if (dmState.pendingPreviewUrl) {
      try { URL.revokeObjectURL(dmState.pendingPreviewUrl); } catch {}
    }
    dmState.pendingImage = null;
    dmState.pendingPreviewUrl = "";
  }

  function stopDmTimer() {
    if (dmState.timer) clearInterval(dmState.timer);
    dmState.timer = null;
  }

  function closeDm(reset = true) {
    stopDmTimer();
    const panel = dmPanel();
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = "";
    }
    state.root?.classList.remove("is-dm-open");
    dmState.open = false;
    dmState.loading = false;
    dmState.sending = false;
    if (!reset) return;
    clearDmImage();
    dmState.view = "home";
    dmState.home = null;
    dmState.me = null;
    dmState.agents = [];
    dmState.onDuty = [];
    dmState.selected.clear();
    dmState.conversationId = "";
    dmState.thread = null;
    dmState.signature = "";
    dmState.search = "";
    dmState.draft = "";
    dmState.scrollToLatest = false;
  }

  function dmAgentLabel(agent = {}) {
    return String(agent.nickname || [agent.prenom, agent.nom].filter(Boolean).join(" ") || "Agent").trim();
  }

  function dmConversationLabel(conversation = {}) {
    const title = String(conversation.title || "").trim();
    if (title) return title;
    const names = (conversation.others || []).map(dmAgentLabel).filter(Boolean);
    return names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? " +" + (names.length - 3) : "") : "Discussion privée";
  }

  function dmLastPreview(conversation = {}) {
    const last = conversation.last_message || {};
    const text = String(last.body || "").trim();
    if (text) return text;
    if (Array.isArray(last.payload?.attachments) && last.payload.attachments.length) return "Photo";
    return "Aucun message";
  }

  function dmThreadSignature(data) {
    return JSON.stringify([
      data?.conversation?.id || "",
      (data?.members || []).map((m) => [m.agent_id, m.last_read_at || ""]),
      (data?.messages || []).map((m) => [
        m.id,
        m.body,
        m.created_at,
        m.sender_agent_id,
        (Array.isArray(m.payload?.attachments) ? m.payload.attachments : []).map((a) => a.storage_path || ""),
      ]),
    ]);
  }

  async function openDm() {
    if (dmState.open) return;
    if (!(await ensurePrivacy())) return;
    const panel = dmPanel();
    if (!panel) return;
    dmState.open = true;
    dmState.view = "home";
    state.root?.classList.add("is-dm-open");
    panel.hidden = false;
    panel.innerHTML =
      '<section class="tb-dm-shell"><header class="tb-dm-head"><div><small>CHAT STIP</small><h3>Messages privés</h3></div><button type="button" data-dm-close aria-label="Fermer">×</button></header><div class="tb-dm-loading">Chargement…</div></section>';
    await loadDmHome(false);
  }

  async function loadDmHome(quiet = false) {
    if (!dmState.open || dmState.loading) return;
    stopDmTimer();
    dmState.loading = true;
    try {
      const [home, agentsData, dutyData] = await Promise.all([
        api("home"),
        api("agents", { q: "" }),
        api("on_duty"),
      ]);
      dmState.home = home || {};
      dmState.me = home?.me || dmState.me;
      dmState.agents = Array.isArray(agentsData?.items) ? agentsData.items : [];
      dmState.onDuty = Array.isArray(dutyData?.items) ? dutyData.items : [];
      dmState.view = "home";
      dmState.conversationId = "";
      dmState.thread = null;
      dmState.signature = "";
      setDmUnread(home?.dm_unread || 0);
      if (!quiet || document.activeElement?.closest?.("[data-dm-panel]") == null) renderDmHome();
      else renderDmHome();
    } catch (error) {
      const panel = dmPanel();
      if (panel && !quiet) panel.innerHTML =
        '<section class="tb-dm-shell"><header class="tb-dm-head"><div><small>CHAT STIP</small><h3>Messages privés</h3></div><button type="button" data-dm-close>×</button></header><p class="tb-dm-error">' +
        esc(error.message || "Messages privés indisponibles.") + "</p></section>";
    } finally {
      dmState.loading = false;
    }
  }

  function dmPushViewState() {
    const me = dmState.home?.me || dmState.me || {};
    const adminEnabled = me.dm_push_available !== false;
    const userEnabled = me.dm_push_enabled !== false;
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    if (!adminEnabled) return { enabled: false, disabled: true, label: "Désactivées par l’administrateur", tone: "off" };
    if (!userEnabled) return { enabled: false, disabled: false, label: "Désactivées pour moi", tone: "off" };
    if (permission === "denied") return { enabled: false, disabled: false, label: "Bloquées par le téléphone", tone: "blocked" };
    if (permission === "granted") return { enabled: true, disabled: false, label: "Activées · même STIP fermé", tone: "on" };
    return { enabled: false, disabled: false, label: "À autoriser sur ce téléphone", tone: "pending" };
  }

  async function toggleDmPushFromPanel(button) {
    const view = dmPushViewState();
    if (view.disabled) return;
    const target = !(dmState.home?.me?.dm_push_enabled !== false && view.enabled);
    button.disabled = true;
    try {
      const ok = await window.STIPCommunication?.setDmPush?.(target, button);
      if (ok !== false) await loadDmHome(false);
    } finally {
      button.disabled = false;
    }
  }

  function renderDmHome() {
    const panel = dmPanel();
    if (!panel || !dmState.open) return;
    panel.hidden = false;

    const pushView = dmPushViewState();
    const conversations = (dmState.home?.conversations || []).filter((item) =>
      item?.kind === "direct" || item?.kind === "group",
    );
    const q = norm(dmState.search || "");
    const agents = dmState.agents.filter((agent) => {
      const hay = norm(
        [dmAgentLabel(agent), agent.prenom, agent.nom, agent.ghe, agent.equipe]
          .filter(Boolean).join(" "),
      );
      return !q || hay.includes(q);
    });

    const conversationHtml = conversations.length
      ? conversations.map((conversation) =>
          '<button type="button" class="tb-dm-conversation" data-dm-conversation="' + esc(conversation.id) + '">' +
          '<span class="tb-dm-conversation-main"><strong>' + esc(dmConversationLabel(conversation)) + '</strong><small>' +
          esc(dmLastPreview(conversation)) + '</small></span>' +
          (Number(conversation.unread || 0) > 0
            ? '<b class="tb-dm-unread">' + esc(Math.min(99, Number(conversation.unread || 0))) + "</b>"
            : '<span class="tb-dm-chevron">›</span>') +
          "</button>"
        ).join("")
      : '<p class="tb-dm-empty">Aucun DM pour le moment.</p>';

    const agentHtml = agents.length
      ? agents.map((agent) => {
          const id = String(agent.id || "");
          const selected = dmState.selected.has(id);
          return '<button type="button" class="tb-dm-agent' + (selected ? " is-selected" : "") +
            '" data-dm-agent="' + esc(id) + '" aria-pressed="' + (selected ? "true" : "false") + '">' +
            avatar(agent, { showFirstName: true }) +
            '<span><strong>' + esc(dmAgentLabel(agent)) + '</strong><small>' +
            esc([agent.ghe, agent.equipe].filter(Boolean).join(" · ")) + '</small></span>' +
            '<b>' + (selected ? "✓" : "+") + "</b></button>";
        }).join("")
      : '<p class="tb-dm-empty">Aucun agent trouvé.</p>';

    panel.innerHTML =
      '<section class="tb-dm-shell">' +
      '<header class="tb-dm-head"><div><small>CHAT STIP</small><h3>Messages privés</h3></div><button type="button" data-dm-close aria-label="Fermer">×</button></header>' +
      '<div class="tb-dm-home">' +
      '<button type="button" class="tb-dm-push-access is-' + esc(pushView.tone) + '" data-dm-push-access aria-pressed="' + (pushView.enabled ? "true" : "false") + '" ' + (pushView.disabled ? "disabled" : "") + '>' +
      '<span class="tb-dm-push-access-icon" aria-hidden="true">🔔</span>' +
      '<span class="tb-dm-push-access-copy"><strong>Notifications DM</strong><small>' + esc(pushView.label) + '</small></span>' +
      '<b aria-hidden="true">' + (pushView.enabled ? "✓" : "›") + '</b></button>' +
      '<section class="tb-dm-section"><div class="tb-dm-section-title"><strong>Discussions</strong><span>' +
      esc(conversations.length) + "</span></div>" + conversationHtml + "</section>" +
      '<section class="tb-dm-section tb-dm-new"><div class="tb-dm-section-title"><strong>Nouveau DM</strong><span>' +
      esc(dmState.selected.size) + " sélectionné" + (dmState.selected.size > 1 ? "s" : "") + "</span></div>" +
      '<div class="tb-dm-picks">' +
      '<button type="button" data-dm-duty><span>●</span><strong>En poste</strong><small>' + esc(dmState.onDuty.length) + "</small></button>" +
      '<button type="button" data-dm-all><span>◎</span><strong>Tout le monde</strong><small>' + esc(dmState.agents.length) + "</small></button>" +
      "</div>" +
      '<label class="tb-dm-search"><span>⌕</span><input type="search" data-dm-search placeholder="Rechercher un agent…" value="' + esc(dmState.search) + '"></label>' +
      '<div class="tb-dm-agent-list">' + agentHtml + "</div>" +
      "</section></div>" +
      '<footer class="tb-dm-home-actions"><button type="button" data-dm-start ' + (!dmState.selected.size ? "disabled" : "") + ">" +
      (dmState.selected.size > 1 ? "Ouvrir le DM de groupe" : "Ouvrir le DM") +
      (dmState.selected.size ? " · " + esc(dmState.selected.size) : "") +
      "</button></footer></section>";

    panel.querySelector("[data-dm-push-access]")?.addEventListener("click", (event) =>
      toggleDmPushFromPanel(event.currentTarget),
    );

    const search = panel.querySelector("[data-dm-search]");
    if (search) {
      search.addEventListener("input", () => {
        dmState.search = search.value;
        const pos = search.selectionStart || search.value.length;
        renderDmHome();
        const next = dmPanel()?.querySelector("[data-dm-search]");
        next?.focus({ preventScroll: true });
        try { next?.setSelectionRange(pos, pos); } catch {}
      });
    }
  }

  function toggleDmRecipient(id) {
    if (!id) return;
    if (dmState.selected.has(id)) dmState.selected.delete(id);
    else dmState.selected.add(id);
    renderDmHome();
  }

  function selectDmOnDuty() {
    dmState.selected = new Set(dmState.onDuty.map((agent) => String(agent.id || "")).filter(Boolean));
    renderDmHome();
  }

  function selectDmAll() {
    dmState.selected = new Set(dmState.agents.map((agent) => String(agent.id || "")).filter(Boolean));
    renderDmHome();
  }

  async function startDmConversation() {
    const ids = [...dmState.selected].filter(Boolean);
    if (!ids.length || dmState.loading) return;
    dmState.loading = true;
    try {
      const result = ids.length === 1
        ? await api("direct", { agent_id: ids[0] })
        : await api("group", { agent_ids: ids });
      const id = String(result?.conversation?.id || "");
      if (!id) throw new Error("Conversation introuvable.");
      dmState.selected.clear();
      await openDmConversation(id);
    } catch (error) {
      alert(error.message || "Impossible d’ouvrir le DM.");
    } finally {
      dmState.loading = false;
    }
  }

  async function openDmConversation(id) {
    if (!id) return;
    stopDmTimer();
    dmState.view = "thread";
    dmState.conversationId = id;
    dmState.signature = "";
    dmState.scrollToLatest = true;
    await loadDmThread(false);
    if (!dmState.open || dmState.view !== "thread") return;
    dmState.timer = setInterval(() => {
      if (!dmState.open || dmState.view !== "thread" || !dmState.conversationId) {
        stopDmTimer();
        return;
      }
      if (!document.hidden) loadDmThread(true);
    }, 3000);
  }

  async function loadDmThread(quiet = false) {
    if (!dmState.open || !dmState.conversationId || dmState.loading) return;
    dmState.loading = true;
    try {
      const data = await api("thread", { conversation_id: dmState.conversationId });
      dmState.thread = data;
      const signature = dmThreadSignature(data);
      const changed = signature !== dmState.signature;
      dmState.signature = signature;
      const panel = dmPanel();
      const editing = !!panel?.querySelector("[data-dm-text]:focus");
      if (!quiet || (changed && !editing)) renderDmThread();
      loadDmStatus();
    } catch (error) {
      const panel = dmPanel();
      if (panel && !quiet) panel.innerHTML =
        '<section class="tb-dm-shell"><header class="tb-dm-head"><button type="button" data-dm-back>‹</button><div><small>DM</small><h3>Discussion</h3></div><button type="button" data-dm-close>×</button></header><p class="tb-dm-error">' +
        esc(error.message || "Discussion indisponible.") + "</p></section>";
    } finally {
      dmState.loading = false;
    }
  }

  function dmThreadTitle(data = {}) {
    const me = String(dmState.me?.id || "");
    const others = (data.members || [])
      .filter((member) => String(member.agent_id || "") !== me)
      .map((member) => dmAgentLabel(member.agent || {}))
      .filter(Boolean);
    return String(data.conversation?.title || "").trim() ||
      (others.length ? others.slice(0, 3).join(", ") + (others.length > 3 ? " +" + (others.length - 3) : "") : "Discussion privée");
  }

  function renderDmThread() {
    const panel = dmPanel();
    const data = dmState.thread;
    if (!panel || !data || !dmState.open) return;
    const me = String(dmState.me?.id || "");
    const messages = data.messages || [];
    const bodyHtml = messages.length
      ? messages.map((message) => {
          const mine = String(message.sender_agent_id || "") === me;
          const sender = message.sender || {};
          const attachments = Array.isArray(message.payload?.attachments) ? message.payload.attachments : [];
          const photos = attachments.filter((item) => item?.url).map((item) =>
            '<button type="button" class="tb-dm-photo" data-dm-photo="' + esc(item.url) + '"><img src="' +
            esc(item.url) + '" alt="' + esc(item.file_name || "Photo") + '"></button>'
          ).join("");
          const text = String(message.body || "").trim();
          return '<article class="tb-dm-message' + (mine ? " is-mine" : "") + '">' +
            (!mine ? avatar(sender, { showFirstName: true }) : "") +
            '<div class="tb-dm-bubble"><header><strong>' + esc(mine ? "Moi" : dmAgentLabel(sender)) +
            '</strong><time>' + esc(fmtTime(message.created_at)) + "</time></header>" +
            (photos ? '<div class="tb-dm-photos">' + photos + "</div>" : "") +
            (text ? "<p>" + esc(text).replace(/\n/g, "<br>") + "</p>" : "") +
            "</div></article>";
        }).join("")
      : '<div class="tb-dm-thread-empty"><span>✉</span><strong>Discussion privée</strong><p>Seuls les participants sélectionnés peuvent lire ce fil.</p></div>';

    const imagePreview = dmState.pendingImage
      ? '<div class="tb-dm-pending"><img src="' + esc(dmState.pendingPreviewUrl) + '" alt=""><span><strong>' +
        esc(dmState.pendingImage.name || "Photo") + '</strong><small>Photo jointe</small></span><button type="button" data-dm-remove-image aria-label="Retirer">×</button></div>'
      : "";

    panel.innerHTML =
      '<section class="tb-dm-shell is-thread">' +
      '<header class="tb-dm-head"><button type="button" class="tb-dm-back" data-dm-back aria-label="Retour">‹</button><div><small>DM · ' +
      esc((data.members || []).length) + ' participant' + ((data.members || []).length > 1 ? "s" : "") + "</small><h3>" +
      esc(dmThreadTitle(data)) + '</h3></div><button type="button" data-dm-close aria-label="Fermer">×</button></header>' +
      '<div class="tb-dm-thread" data-dm-thread>' + bodyHtml + "</div>" +
      '<form class="tb-dm-composer" data-dm-form>' + imagePreview +
      '<div class="tb-dm-compose-row"><button type="button" class="tb-dm-attach" data-dm-attach aria-label="Ajouter une photo">＋</button>' +
      '<input type="file" data-dm-file accept="image/jpeg,image/png,image/webp" capture="environment" hidden>' +
      '<textarea data-dm-text rows="1" maxlength="2000" placeholder="Message privé…">' + esc(dmState.draft) + "</textarea>" +
      '<button type="submit" class="tb-dm-send" ' + ((!dmState.draft.trim() && !dmState.pendingImage) || dmState.sending ? "disabled" : "") + ">↑</button></div>" +
      "</form></section>";

    const thread = panel.querySelector("[data-dm-thread]");
    if (thread && dmState.scrollToLatest) {
      requestAnimationFrame(() => {
        thread.scrollTop = thread.scrollHeight;
        dmState.scrollToLatest = false;
      });
    }
    const textarea = panel.querySelector("[data-dm-text]");
    textarea?.addEventListener("input", () => {
      dmState.draft = textarea.value;
      autoGrow(textarea);
      const sendButton = panel.querySelector(".tb-dm-send");
      if (sendButton) sendButton.disabled = (!dmState.draft.trim() && !dmState.pendingImage) || dmState.sending;
    });
    autoGrow(textarea);
    panel.querySelector("[data-dm-file]")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) setDmImage(file);
      event.target.value = "";
    });
    panel.querySelector("[data-dm-form]")?.addEventListener("submit", sendDm);
  }

  async function setDmImage(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(String(file.type || "").toLowerCase())) {
      alert("Format accepté : JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 3000000) {
      alert("Photo trop lourde : 3 Mo maximum.");
      return;
    }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = () => reject(new Error("Lecture de la photo impossible."));
        reader.readAsDataURL(file);
      });
      if (!data) throw new Error("Photo invalide.");
      clearDmImage();
      dmState.pendingImage = { name: file.name || "photo", mime: file.type, data };
      dmState.pendingPreviewUrl = URL.createObjectURL(file);
      renderDmThread();
    } catch (error) {
      alert(error.message || "Photo impossible à joindre.");
    }
  }

  async function sendDm(event) {
    event?.preventDefault?.();
    if (dmState.sending || !dmState.conversationId) return;
    const text = String(dmState.draft || "").trim().slice(0, 2000);
    if (!text && !dmState.pendingImage) return;
    dmState.sending = true;
    renderDmThread();
    try {
      await api("send", {
        conversation_id: dmState.conversationId,
        body: text,
        image: dmState.pendingImage ? {
          name: dmState.pendingImage.name,
          mime: dmState.pendingImage.mime,
          data: dmState.pendingImage.data,
        } : null,
      });
      dmState.draft = "";
      clearDmImage();
      dmState.scrollToLatest = true;
      await loadDmThread(false);
      loadDmStatus();
    } catch (error) {
      alert(error.message || "Envoi du DM impossible.");
    } finally {
      dmState.sending = false;
      renderDmThread();
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
    closeDm();
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
  window.addEventListener("stip:messages-unread", (event) => {
    const value = event?.detail?.dmCount;
    if (value == null) return;
    setDmUnread(value);
  });
  window.addEventListener("stip:dm-push-state", () => {
    if (dmState.open && dmState.view === "home") loadDmHome(false);
  });

  const apiSurface = {
    build: "20260925-dm-push3",
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