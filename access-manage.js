(() => {
  "use strict";
  const API =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access-manage";
  const DATES_API =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-dates-admin";
  const STORE = "stip_session_v1";
  const PREVIEW_STORE = "stip_admin_preview_v1";
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const ESPRIT_KEYS = ["planning_team", "activity", "assistant_enabled"];
  const HISTORY_PAGE_LABELS = {
    home: "Accueil",
    planning_personal: "Planning perso",
    tomorrow: "Pour demain",
    team: "Esprit d’équipe",
    activity: "Activité",
    agent_directory: "Équipe",
    planning_compare: "Comparer les plannings",
    change: "Changement",
    calendar: "Synchroniser mon calendrier",
    agent_dates: "Date des agents",
    contacts: "Contacts",
    responsable: "Responsable",
    notifications: "Notifications",
    messages: "Fauteuils",
    places: "Visiter les lieux",
    assistant: "Assistant STIP",
    access: "Accès",
    profile: "Mon compte",
  };
  const PARIS_DATE = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const PARIS_TIME = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  let data = null,
    current = null,
    selectedRole = "",
    creating = false,
    peopleMode = "with",
    renderBasePermissions = {},
    historyMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    historyData = null,
    historySelectedDay = "",
    sortMode = "nom",
    candidateCache = [],
    peopleWall = null,
    agentAgendaLoader = null,
    notificationSettings = [];

  function parisDay(iso) {
    const parts = Object.fromEntries(
      PARIS_DATE.formatToParts(new Date(iso))
        .filter((x) => x.type !== "literal")
        .map((x) => [x.type, x.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function localDay(date) {
    const y = date.getFullYear(),
      m = String(date.getMonth() + 1).padStart(2, "0"),
      d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function profileAgent(profile = {}) {
    const a = Array.isArray(profile.agents) ? profile.agents[0] : profile.agents;
    const i = Array.isArray(profile.stip_access_identities)
      ? profile.stip_access_identities[0]
      : profile.stip_access_identities;
    return {
      name:
        [a?.prenom, a?.nom].filter(Boolean).join(" ").trim() ||
        [i?.first_name, i?.last_name].filter(Boolean).join(" ").trim() ||
        "Profil externe",
      ghe: a?.ghe || "",
      role: profile.role_key || i?.professional_role || "",
    };
  }
  function roleLabel(role = "") {
    return (
      {
        admin: "Admin",
        chef_equipe: "Chef d’équipe",
        responsable: "Responsable",
        cadre: "Cadre",
        brancardier: "Brancardier",
        stagiaire: "Stagiaire",
        visiteur: "Visiteur",
      }[role] || role.replaceAll("_", " ")
    );
  }
  function historyProfileMap() {
    return new Map((historyData?.profiles || []).map((p) => [p.id, p]));
  }
  function historyCounts() {
    const days = new Map();
    const add = (day, profileId) => {
      if (!day || !profileId) return;
      if (!days.has(day)) days.set(day, new Set());
      days.get(day).add(profileId);
    };
    for (const s of historyData?.sessions || [])
      add(parisDay(s.created_at), s.profile_id);
    for (const a of historyData?.activity || [])
      add(parisDay(a.occurred_at), a.profile_id);
    return days;
  }
  function renderHistoryDay() {
    if (!historyData || !historySelectedDay) return;
    const profiles = historyProfileMap(),
      events = [];
    for (const s of historyData.sessions || [])
      if (parisDay(s.created_at) === historySelectedDay)
        events.push({
          profile_id: s.profile_id,
          at: s.created_at,
          type: "session",
          key: "",
        });
    for (const a of historyData.activity || [])
      if (parisDay(a.occurred_at) === historySelectedDay)
        events.push({
          profile_id: a.profile_id,
          at: a.occurred_at,
          type: "page",
          key: a.page_key,
        });
    events.sort((a, b) => new Date(a.at) - new Date(b.at));

    const groups = new Map();
    for (const event of events) {
      if (!groups.has(event.profile_id)) groups.set(event.profile_id, []);
      const list = groups.get(event.profile_id),
        previous = list[list.length - 1];
      if (
        event.type === "page" &&
        previous?.type === "page" &&
        previous.key === event.key &&
        new Date(event.at) - new Date(previous.at) < 60000
      )
        continue;
      list.push(event);
    }

    const date = new Date(`${historySelectedDay}T12:00:00`);
    $("historyDayTitle").textContent = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    $("historyDayCount").textContent = groups.size
      ? `${groups.size} personne${groups.size > 1 ? "s" : ""}`
      : "Aucune activité";

    if (!groups.size) {
      $("historyDayList").innerHTML =
        '<p class="access-help">Aucune connexion ni ouverture de module enregistrée ce jour.</p>';
      return;
    }

    $("historyDayList").innerHTML = [...groups.entries()]
      .map(([profileId, list]) => {
        const info = profileAgent(profiles.get(profileId) || {}),
          lines = list
            .map((event) => {
              const label =
                event.type === "session"
                  ? "Session ouverte"
                  : HISTORY_PAGE_LABELS[event.key] || event.key;
              return `<div class="access-history-event ${event.type}"><time>${esc(PARIS_TIME.format(new Date(event.at)))}</time><span>${esc(label)}</span></div>`;
            })
            .join("");
        return `<details class="access-history-person"><summary><div><strong>${esc(info.name)}</strong><small>${esc([roleLabel(info.role), info.ghe ? `GHE ${String(info.ghe).replace(/^GHE\s*/i, "")}` : ""].filter(Boolean).join(" · "))}</small></div><span class="access-history-toggle" aria-hidden="true"></span></summary><div class="access-history-events">${lines}</div></details>`;
      })
      .join("");
  }
  function renderHistoryCalendar() {
    const first = new Date(
        historyMonth.getFullYear(),
        historyMonth.getMonth(),
        1,
      ),
      daysInMonth = new Date(
        historyMonth.getFullYear(),
        historyMonth.getMonth() + 1,
        0,
      ).getDate(),
      offset = (first.getDay() + 6) % 7,
      counts = historyCounts(),
      today = localDay(new Date()),
      cells = [];

    $("historyMonthLabel").textContent = first.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });

    for (let i = 0; i < offset; i++)
      cells.push('<span class="access-history-blank" aria-hidden="true"></span>');

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(first.getFullYear(), first.getMonth(), day),
        key = localDay(date),
        count = counts.get(key)?.size || 0;
      cells.push(
        `<button type="button" class="access-history-date ${key === today ? "today" : ""} ${key === historySelectedDay ? "selected" : ""} ${count ? "has-data" : ""}" data-history-day="${key}" aria-label="${day} : ${count} personne${count > 1 ? "s" : ""}"><span>${day}</span>${count ? `<b>${count}</b>` : ""}</button>`,
      );
    }
    $("historyCalendar").innerHTML = cells.join("");
    $("historyCalendar")
      .querySelectorAll("[data-history-day]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            historySelectedDay = button.dataset.historyDay;
            renderHistoryCalendar();
            renderHistoryDay();
          }),
      );
    renderHistoryDay();
  }
  async function loadHistory() {
    const start = new Date(
        historyMonth.getFullYear(),
        historyMonth.getMonth(),
        1,
      ),
      end = new Date(
        historyMonth.getFullYear(),
        historyMonth.getMonth() + 1,
        1,
      );
    $("historyCalendar").innerHTML =
      '<p class="access-help access-history-loading">Chargement…</p>';
    try {
      historyData = await call("history", {
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const counts = historyCounts(),
        today = localDay(new Date()),
        monthPrefix = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-`;
      if (!historySelectedDay.startsWith(monthPrefix)) {
        const activeDays = [...counts.keys()]
          .filter((x) => x.startsWith(monthPrefix))
          .sort();
        historySelectedDay =
          today.startsWith(monthPrefix) ? today : activeDays.at(-1) || `${monthPrefix}01`;
      }
      renderHistoryCalendar();
    } catch (e) {
      $("historyCalendar").innerHTML =
        `<p class="access-help">${esc(e.message)}</p>`;
    }
  }
  function renderNotificationSettings() {
    const host = $("notificationSettingsList");
    if (!host) return;
    if (!notificationSettings.length) {
      host.innerHTML =
        '<p class="access-help">Aucun type de notification native n’est configuré.</p>';
      return;
    }
    host.innerHTML = notificationSettings
      .map((item) => {
        const enabled = item.push_enabled !== false;
        return `<label class="access-notification-row${enabled ? " is-enabled" : ""}">
          <input type="checkbox" data-notification-key="${esc(item.event_key)}" ${enabled ? "checked" : ""}>
          <span class="access-notification-copy">
            <strong>${esc(item.label || item.event_key)}</strong>
            <small>${esc(item.description || "")}</small>
          </span>
          <span class="access-notification-state">${enabled ? "ACTIF" : "COUPÉ"}</span>
        </label>`;
      })
      .join("");
    host.querySelectorAll("[data-notification-key]").forEach((input) => {
      input.addEventListener("change", async () => {
        const key = String(input.dataset.notificationKey || "");
        const checked = !!input.checked;
        input.disabled = true;
        try {
          const result = await call("notification_setting_save", {
            event_key: key,
            push_enabled: checked,
          });
          notificationSettings = Array.isArray(result.items) ? result.items : notificationSettings;
          renderNotificationSettings();
          message(
            checked
              ? "Notification téléphone activée pour ce type."
              : "Notification téléphone coupée pour ce type.",
          );
        } catch (error) {
          input.checked = !checked;
          input.disabled = false;
          message(error?.message || "Impossible de modifier cette notification.");
        }
      });
    });
  }

  async function loadNotificationSettings() {
    const host = $("notificationSettingsList");
    if (host)
      host.innerHTML = '<p class="access-help">Chargement…</p>';
    try {
      const result = await call("notification_settings");
      notificationSettings = Array.isArray(result.items) ? result.items : [];
      renderNotificationSettings();
    } catch (error) {
      if (host)
        host.innerHTML = `<p class="access-help">${esc(error?.message || "Notifications indisponibles.")}</p>`;
    }
  }

  function setAccessMode(mode) {
    const history = mode === "history",
      notifications = mode === "notifications",
      manage = !history && !notifications;
    document.body.classList.toggle("access-history-mode", history);
    document.body.classList.toggle("access-notifications-mode", notifications);
    $("historyPanel").classList.toggle("hidden", !history);
    $("notificationsPanel")?.classList.toggle("hidden", !notifications);
    $("accessManageTab").classList.toggle("active", manage);
    $("accessHistoryTab").classList.toggle("active", history);
    $("accessNotificationsTab")?.classList.toggle("active", notifications);
    $("accessControlTab")?.classList.remove("active");
    $("accessManageTab").setAttribute("aria-selected", manage ? "true" : "false");
    $("accessHistoryTab").setAttribute("aria-selected", history ? "true" : "false");
    $("accessNotificationsTab")?.setAttribute("aria-selected", notifications ? "true" : "false");
    $("accessControlTab")?.setAttribute("aria-selected", "false");
    if (history) loadHistory();
    if (notifications) loadNotificationSettings();
  }

  async function request(url, action, body = {}) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stip-session": localStorage.getItem(STORE) || "",
      },
      body: JSON.stringify({ action, ...body }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error)
      throw Error(
        typeof j.error === "string" ? j.error : j.error?.message || "Erreur",
      );
    return j;
  }
  const call = (action, body) => request(API, action, body);
  const callDates = (action, body) => request(DATES_API, action, body);
  function message(text) {
    const value = String(text || "");
    if (/tape\s+au\s+moins\s+2\s+lettres/i.test(value)) {
      $("msg").textContent = "";
      return;
    }
    $("msg").textContent = value;
  }
  function displayAccessText(value = "") {
    return String(value)
      .replace(/\bVisiteur\b/gi, "MINI")
      .replace(/\bPro\b/g, "MAXI");
  }
  function terrainMode(permissions = {}) {
    const raw = String(permissions.team_chat_mode || "").toLowerCase();
    if (raw === "read" || raw === "write" || raw === "admin") return raw;
    return permissions.admin ? "admin" : "write";
  }

  async function load() {
    message("");
    try {
      data = await call("list", { q: $("q").value });
      if (peopleMode === "with") renderPeople();
      else await renderCandidates();
      message("");
      $("accessHistoryTab").hidden = !data.can_history;
      $("accessNotificationsTab").hidden = !data.can_notifications;
      if (!data.can_history && document.body.classList.contains("access-history-mode"))
        setAccessMode("manage");
      if (!data.can_notifications && document.body.classList.contains("access-notifications-mode"))
        setAccessMode("manage");
    } catch (e) {
      message(e.message);
    }
  }
  function agentOf(value = {}) {
    const nested = Array.isArray(value.agents) ? value.agents[0] : value.agents;
    return nested || value;
  }
  function wallFilter() {
    return sortMode === "prenom" ? "first" : sortMode === "ghe" ? "ghe" : "last";
  }
  function wallItems(items = []) {
    return items.map((value, index) => {
      const a = agentOf(value) || {},
        fallbackId = `access-wall-${peopleMode}-${index}`;
      return {
        ...a,
        id: a.id || value.id || fallbackId,
        __access_index: index,
      };
    });
  }
  function ensureAgentAgenda() {
    if (window.STIPAgentAgenda?.open)
      return Promise.resolve(window.STIPAgentAgenda);
    if (agentAgendaLoader) return agentAgendaLoader;
    agentAgendaLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "agent-agenda-view.js?v=20260925-person-actions1";
      script.async = false;
      script.onload = () =>
        window.STIPAgentAgenda?.open
          ? resolve(window.STIPAgentAgenda)
          : reject(Error("Planning agent indisponible."));
      script.onerror = () => reject(Error("Impossible de charger le planning agent."));
      document.body.appendChild(script);
    }).catch((error) => {
      agentAgendaLoader = null;
      throw error;
    });
    return agentAgendaLoader;
  }

  async function openAgentPlanning(agent) {
    const key = String(agent?.source_key || "").trim();
    if (!key) {
      message("Planning indisponible pour cet agent.");
      return;
    }
    try {
      const agenda = await ensureAgentAgenda();
      await agenda.open(key, agent);
    } catch (error) {
      message(error?.message || "Planning agent indisponible.");
    }
  }

  function openAccessActions(item, createMode = false) {
    const agent = agentOf(item) || {};
    if (!window.STIPPersonActions?.open) {
      if (createMode) editNew(item);
      else edit(item);
      return;
    }
    const actions = [
      {
        key: createMode ? "create-access" : "manage-access",
        icon: "🔐",
        label: createMode ? "Créer l’accès" : "Gérer l’accès",
        detail: createMode
          ? "Créer le profil et son code"
          : "Droits, niveau et code d’accès",
        primary: true,
        onSelect: () => (createMode ? editNew(item) : edit(item)),
      },
      agent.source_key
        ? {
            key: "planning",
            icon: "📅",
            label: "Voir le planning",
            detail: "Planning et événements de l’agent",
            onSelect: () => openAgentPlanning(agent),
          }
        : null,
      agent.telephone
        ? {
            key: "call",
            icon: "☎",
            label: "Appeler",
            detail: String(agent.telephone),
            onSelect: () => window.STIPAgentSelector?.openCallSheet?.(agent),
          }
        : null,
    ].filter(Boolean);

    window.STIPPersonActions.open({
      agent,
      contextLabel: createMode ? "SANS ACCÈS" : "ACCÈS & SÉCURITÉ",
      actions,
    });
  }

  function mountPeopleWall(items = [], createMode, emptyText) {
    peopleWall?.destroy?.();
    peopleWall = null;
    if (!window.STIPAgentSelector?.mountWall) {
      $("people").innerHTML =
        '<p class="access-help">Le mur commun des agents est indisponible.</p>';
      return;
    }
    peopleWall = window.STIPAgentSelector.mountWall($("people"), {
      items: wallItems(items),
      filter: wallFilter(),
      emptyText,
      onSelect(agent) {
        const item = items[Number(agent.__access_index)];
        if (item) openAccessActions(item, createMode);
      },
    });
  }
  function renderPeople() {
    const people = data.people || [];
    mountPeopleWall(people, false, "Aucun profil trouvé.");
  }
  function renderCandidateList() {
    const candidates = candidateCache || [];
    mountPeopleWall(candidates, true, "Aucun agent sans accès trouvé.");
  }

  async function renderCandidates() {
    $("people").innerHTML =
      '<p class="access-help">Chargement des agents sans accès…</p>';
    const j = await call("find_new", { q: $("q").value });
    candidateCache = j.candidates || [];
    renderCandidateList();
  }
  function setPeopleMode(mode) {
    peopleMode = mode === "without" ? "without" : "with";
    const withAccess = peopleMode === "with";
    $("withAccessBtn").classList.toggle("active", withAccess);
    $("withoutAccessBtn").classList.toggle("active", !withAccess);
    $("withAccessBtn").setAttribute("aria-selected", String(withAccess));
    $("withoutAccessBtn").setAttribute("aria-selected", String(!withAccess));
    load();
  }
  function setSortMode(mode) {
    sortMode = mode === "prenom" || mode === "ghe" ? mode : "nom";
    const states = {
      sortNomBtn: sortMode === "nom",
      sortPrenomBtn: sortMode === "prenom",
      sortGheBtn: sortMode === "ghe",
    };
    for (const [id, active] of Object.entries(states)) {
      $(id).classList.toggle("active", active);
      $(id).setAttribute("aria-selected", String(active));
    }
    if (peopleMode === "with") renderPeople();
    else renderCandidateList();
  }
  function presetUI() {
    $("presetRows").innerHTML = (data.presets || [])
      .map(
        (p) =>
          `<button class="access-preset ${p.role_key === selectedRole ? "active" : ""}" data-role="${esc(p.role_key)}" type="button">${esc(p.label)}</button>`,
      )
      .join("");
    $("presetRows")
      .querySelectorAll("[data-role]")
      .forEach((b) => (b.onclick = () => choosePreset(b.dataset.role)));
    $("savePreset").disabled = !selectedRole;
  }
  function choosePreset(role) {
    selectedRole = role;
    const p = (data.presets || []).find((x) => x.role_key === role);
    if (p) renderApps(p.permissions || {});
    presetUI();
  }
  function productApps() {
    return (data.apps || [])
      .filter((app) => !["planning_team", "assistant_enabled"].includes(app.key))
      .map((app) => {
        if (app.key === "activity")
          return {
            ...app,
            label: "Esprit d’équipe",
            help: "Planning équipe, activité et assistant réunis dans une même application.",
            levels: false,
            pro_only: false,
            product_bundle: "esprit",
          };
        if (app.key === "messages")
          return {
            ...app,
            label: "Fauteuils",
            help: "Signalements de fauteuils du jour, avec suivi de récupération.",
            terrain_access: true,
          };
        return app;
      });
  }
  function renderApps(permissions = {}) {
    renderBasePermissions = JSON.parse(JSON.stringify(permissions || {}));
    const levels = permissions.__levels || {};
    $("apps").innerHTML = productApps()
      .map((app) => {
        const checked =
          app.product_bundle === "esprit"
            ? ESPRIT_KEYS.some((key) => !!permissions[key])
            : !!permissions[app.key];
        const level = app.pro_only
          ? "pro"
          : String(levels[app.key] || "visitor").toLowerCase() === "pro"
            ? "pro"
            : "visitor";
        let control = '<span class="access-single">MINI</span>';
        let levelHelp =
          app.product_bundle === "esprit"
            ? "MINI : l’accès unifié actuel. MAXI n’est pas proposé tant qu’aucune différence fonctionnelle réelle n’existe."
            : "MINI : accès disponible actuellement pour cette application.";
        if (app.terrain_access) {
          const mode = terrainMode(permissions);
          control =
            '<div class="access-levels access-terrain-levels" aria-label="Accès Fauteuils">' +
            '<button type="button" data-team-mode="read" class="' + (mode === "read" ? "active" : "") + '">Lire</button>' +
            '<button type="button" data-team-mode="write" class="' + (mode === "write" ? "active" : "") + '">Lire + écrire</button>' +
            '<button type="button" data-team-mode="admin" class="' + (mode === "admin" ? "active" : "") + '">Admin</button>' +
            "</div>";
          levelHelp = "Fauteuils : Lire consulte seulement. Lire + écrire permet de publier. Admin peut aussi gérer et supprimer tous les messages.";
        } else if (app.pro_only) {
          control = '<span class="access-single access-maxi-only">MAXI</span>';
          levelHelp = "MAXI : cette application est réservée au niveau le plus complet.";
        } else if (app.levels) {
          control = `<div class="access-levels stip-levels" aria-label="Niveau ${esc(app.label)}"><button type="button" data-level="${esc(app.key)}" data-value="visitor" class="${level === "visitor" ? "active" : ""}">MINI</button><button type="button" data-level="${esc(app.key)}" data-value="pro" class="${level === "pro" ? "active" : ""}">MAXI</button></div>`;
          levelHelp = "MINI donne l’essentiel. MAXI ouvre la version la plus complète prévue pour cette application.";
        }
        const visibleHelp = displayAccessText(app.help || "");
        const help = [visibleHelp.trim(), levelHelp].filter(Boolean).join(" ");
        return `<div class="access-app stip-catalog-row"><label class="access-app-main"><input type="checkbox" data-permission="${esc(app.key)}" ${app.product_bundle ? `data-bundle="${esc(app.product_bundle)}"` : ""} ${checked ? "checked" : ""}><span><strong>${esc(app.label)}</strong><small>${esc(visibleHelp)}</small></span></label><div class="access-app-tools"><button class="access-info-btn" type="button" data-app-help="${esc(app.key)}" aria-expanded="false" aria-label="Comprendre ${esc(app.label)}">?</button>${control}</div><div class="access-app-info" data-app-info="${esc(app.key)}" hidden>${esc(help)}</div></div>`;
      })
      .join("");
    $("apps")
      .querySelectorAll("[data-level]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const key = b.dataset.level;
            $("apps")
              .querySelectorAll(`[data-level="${CSS.escape(key)}"]`)
              .forEach((x) => x.classList.toggle("active", x === b));
          }),
      );
    $("apps")
      .querySelectorAll("[data-team-mode]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            $("apps")
              .querySelectorAll("[data-team-mode]")
              .forEach((x) => x.classList.toggle("active", x === b));
          }),
      );
    $("apps")
      .querySelectorAll("[data-permission]")
      .forEach((input) => {
        const sync = () => {
          const row = input.closest(".access-app");
          row?.classList.toggle("is-enabled", input.checked);
          row
            ?.querySelectorAll("[data-level],[data-team-mode]")
            .forEach((button) => (button.disabled = !input.checked));
        };
        input.addEventListener("change", () => {
          if (input.dataset.bundle) input.dataset.dirty = "1";
          sync();
        });
        sync();
      });
    $("apps")
      .querySelectorAll("[data-app-help]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const key = b.dataset.appHelp;
            const info = $("apps").querySelector(
              `[data-app-info="${CSS.escape(key)}"]`,
            );
            if (!info) return;
            const open = info.hidden;
            $("apps").querySelectorAll("[data-app-info]").forEach((x) => (x.hidden = true));
            $("apps").querySelectorAll("[data-app-help]").forEach((x) => x.setAttribute("aria-expanded", "false"));
            info.hidden = !open;
            b.setAttribute("aria-expanded", open ? "true" : "false");
          }),
      );
  }
  function collect() {
    const permissions = {},
      levels = { ...(renderBasePermissions.__levels || {}) };
    for (const app of data.apps || [])
      permissions[app.key] = !!renderBasePermissions[app.key];

    $("apps")
      .querySelectorAll("[data-permission]")
      .forEach((x) => {
        if (!x.dataset.bundle) permissions[x.dataset.permission] = x.checked;
      });

    if (permissions.messages) {
      permissions.team_chat_mode =
        $("apps").querySelector("[data-team-mode].active")?.dataset.teamMode ||
        terrainMode(renderBasePermissions);
    } else delete permissions.team_chat_mode;

    const esprit = $("apps").querySelector('[data-bundle="esprit"]');
    if (esprit?.dataset.dirty === "1") {
      for (const key of ESPRIT_KEYS) permissions[key] = esprit.checked;
      if (esprit.checked)
        levels.activity =
          String(renderBasePermissions.__levels?.activity || "").toLowerCase() ===
          "pro"
            ? "pro"
            : "visitor";
      else delete levels.activity;
    }

    for (const app of data.apps || []) {
      if (ESPRIT_KEYS.includes(app.key)) continue;
      if (!permissions[app.key]) {
        delete levels[app.key];
        continue;
      }
      if (app.pro_only) levels[app.key] = "pro";
      else if (app.levels)
        levels[app.key] =
          $("apps").querySelector(
            `[data-level="${CSS.escape(app.key)}"].active`,
          )?.dataset.value || "visitor";
    }
    return { permissions, levels };
  }
  function previewCurrent() {
    if (!current || creating) return;
    const agent = current.agents || {};
    const preview = {
      version: 1,
      profile_id: current.id || "",
      role_key: current.role_key || selectedRole || "",
      agent: {
        id: agent.id || current.agent_id || "",
        source_key: agent.source_key || "",
        nom: agent.nom || "",
        prenom: agent.prenom || "",
        ghe: agent.ghe || "",
        equipe: agent.equipe || "",
        type_planning: agent.type_planning || "",
      },
      permissions: JSON.parse(JSON.stringify(current.permissions || {})),
      created_at: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(PREVIEW_STORE, JSON.stringify(preview));
    } catch {
      message("Impossible d’ouvrir l’aperçu sur cet appareil.");
      return;
    }
    if (window.STIPNav?.go) window.STIPNav.go("index.html?preview=1");
    else location.assign("index.html?preview=1");
  }

  function openEditor() {
    $("editor").classList.remove("hidden");
    presetUI();
    requestAnimationFrame(() =>
      $("editor").scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  }
  function edit(profile) {
    creating = false;
    current = profile;
    selectedRole = profile.role_key || "";
    $("who").textContent =
      `${profile.agents?.prenom || ""} ${profile.agents?.nom || "Accès"}`.trim();
    $("currentCode").innerHTML = profile.current_code
      ? `Code actuel : <b>${esc(profile.current_code)}</b>`
      : 'Code actuel : <span class="access-help">non disponible</span>';
    $("setCode").textContent = "Changer";
    $("save").textContent = "Enregistrer";
    renderApps(profile.permissions || {});
    $("preview").disabled = false;
    openEditor();
  }
  function editNew(agent) {
    creating = true;
    current = { agent_id: agent.id, agents: agent };
    selectedRole = "brancardier";
    $("who").textContent = `${agent.prenom || ""} ${agent.nom || ""}`.trim();
    $("currentCode").innerHTML =
      '<span class="access-help">Choisissez un profil métier et un code à six chiffres.</span>';
    $("code").value = "";
    $("setCode").textContent = "Code";
    $("save").textContent = "Créer l’accès";
    const preset = (data.presets || []).find(
      (x) => x.role_key === selectedRole,
    );
    renderApps(preset?.permissions || {});
    $("preview").disabled = true;
    openEditor();
  }
  async function save() {
    if (!current) return;
    try {
      if (!selectedRole) throw Error("Choisissez un profil métier.");
      const picked = collect();
      if (creating) {
        const code = $("code").value.replace(/\D/g, "");
        if (!/^\d{6}$/.test(code))
          throw Error("Saisissez un code à six chiffres.");
        const created = await call("create_access", {
          agent_id: current.agent_id,
          role_key: selectedRole,
          code,
          ...picked,
        });
        await callDates("set_agent", {
          agent_id: current.agent_id,
          enabled: !!created.permissions?.agent_dates,
        });
        message("Accès créé.");
        closeEditor();
        await load();
        return;
      }
      await call("save", {
        profile_id: current.id,
        role_key: selectedRole,
        ...picked,
      });
      await callDates("set", {
        profile_id: current.id,
        enabled: !!picked.permissions.agent_dates,
      });
      message("Accès enregistré pour cette personne.");
      await load();
    } catch (e) {
      message(e.message);
    }
  }
  async function savePreset() {
    if (!selectedRole) return;
    try {
      const picked = collect();
      const j = await call("save_preset", {
        role_key: selectedRole,
        ...picked,
      });
      await callDates("set_model", {
        model_key: `${selectedRole}_minimum`,
        enabled: !!picked.permissions.agent_dates,
      }).catch(() => null);
      data.presets = j.presets;
      message("Profil métier par défaut enregistré.");
      presetUI();
    } catch (e) {
      message(e.message);
    }
  }
  function closeEditor() {
    creating = false;
    current = null;
    selectedRole = "";
    $("editor").classList.add("hidden");
    $("code").value = "";
    $("preview").disabled = true;
  }

  $("accessManageTab").onclick = () => setAccessMode("manage");
  $("accessHistoryTab").onclick = () => setAccessMode("history");
  $("accessNotificationsTab").onclick = () => setAccessMode("notifications");
  $("accessControlTab").onclick = () =>
    window.STIPNav?.go?.("control.html") || location.assign("control.html");
  $("historyPrev").onclick = () => {
    historyMonth = new Date(
      historyMonth.getFullYear(),
      historyMonth.getMonth() - 1,
      1,
    );
    historySelectedDay = "";
    loadHistory();
  };
  $("historyNext").onclick = () => {
    historyMonth = new Date(
      historyMonth.getFullYear(),
      historyMonth.getMonth() + 1,
      1,
    );
    historySelectedDay = "";
    loadHistory();
  };
  $("preview").onclick = previewCurrent;
  $("save").onclick = save;
  $("savePreset").onclick = savePreset;
  $("cancel").onclick = closeEditor;
  $("backBtn").onclick = () => {
    if (window.STIPNav?.back) window.STIPNav.back("index.html");
    else if (history.length > 1) history.back();
    else location.assign("index.html");
  };
  $("setCode").onclick = async () => {
    if (!current) return;
    if (creating) {
      message("Le code sera enregistré avec « Créer l’accès ».");
      return;
    }
    try {
      const j = await call("set_code", {
        profile_id: current.id,
        code: $("code").value,
      });
      current.current_code = j.code;
      $("currentCode").innerHTML = `Code actuel : <b>${esc(j.code)}</b>`;
      $("code").value = "";
      message("Code modifié.");
    } catch (e) {
      message(e.message);
    }
  };
  $("withAccessBtn").onclick = () => setPeopleMode("with");
  $("withoutAccessBtn").onclick = () => setPeopleMode("without");
  $("sortNomBtn").onclick = () => setSortMode("nom");
  $("sortPrenomBtn").onclick = () => setSortMode("prenom");
  $("sortGheBtn").onclick = () => setSortMode("ghe");
  let searchTimer;
  $("q").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 250);
  };
  $("code").oninput = () => {
    $("code").value = $("code").value.replace(/\D/g, "").slice(0, 6);
  };
  load();
})();
