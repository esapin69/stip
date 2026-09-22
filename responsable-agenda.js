(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
    STORE = "stip_session_v1",
    $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  const navigationState = window.STIPNav?.read?.() || {};
  let mode = "direct",
    agents = [],
    items = [],
    proposals = [],
    events = [],
    active = ["all", "medical", "intern", "training"].includes(
      navigationState.filter,
    )
      ? navigationState.filter
      : "all",
    selectedDay = navigationState.selectedDay || "",
    search = navigationState.search || "",
    focusId = "";
  const esc = (v) =>
    String(v ?? "").replace(
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
  async function call(action, body = {}) {
    const r = await fetch(API, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-STIP-Session": localStorage.getItem(STORE) || "",
        },
        body: JSON.stringify({ action, ...body }),
      }),
      j = await r.json().catch(() => ({}));
    if (!r.ok || j.error)
      throw Object.assign(Error(j.error || `Erreur ${r.status}`), {
        status: r.status,
      });
    return j;
  }
  function person(a) {
    if (!a) return "Agent";
    if (a.prenom)
      return `${String(a.prenom).toLocaleUpperCase("fr-FR")} ${String(a.nom || "").toLocaleLowerCase("fr-FR")}`.trim();
    const p = String(a.source_key || "")
      .split("_")
      .filter(Boolean);
    if (p.length > 1)
      return `${p.at(-1).toLocaleUpperCase("fr-FR")} ${p.slice(0, -1).join(" ").toLocaleLowerCase("fr-FR")}`;
    return String(a.nom || "Agent");
  }
  function iso(d) {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 10);
  }
  function todayIso() {
    return iso(new Date());
  }
  function dateObj(v) {
    return new Date(String(v).slice(0, 10) + "T12:00:00");
  }
  function fmtDay(v) {
    return dateObj(v)
      .toLocaleDateString("fr-FR", { weekday: "short" })
      .replace(".", "");
  }
  function fmtMonth(v) {
    return dateObj(v)
      .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      .replace(/^./, (c) => c.toUpperCase());
  }
  function resolveAgent(x) {
    return (
      x.agent ||
      x.target ||
      agents.find(
        (a) => String(a.id) === String(x.agent_id || x.target_agent_id),
      ) ||
      null
    );
  }
  function typeKey(x = {}) {
    const s = [x.source_type, x.type, x.kind, x.category, x.title, x.intitule]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (
      s.includes("mobi_lit_medical") ||
      s.includes("visite") ||
      s.includes("médical") ||
      s.includes("medical")
    )
      return "medical";
    if (s.includes("stagiaire")) return "intern";
    if (s.includes("formation")) return "training";
    return "other";
  }
  function typeLabel(k) {
    return (
      {
        medical: "Visite médicale",
        intern: "Stagiaire",
        training: "Formation",
        other: "Événement",
      }[k] || "Événement"
    );
  }
  function typeIcon(k) {
    return (
      { medical: "🩺", intern: "👶", training: "🎓", other: "📌" }[k] || "📌"
    );
  }
  function normalize(x, proposal = false, origin = "manager") {
    const g = proposal ? x.metadata?.agenda || {} : x,
      a = resolveAgent(x),
      date = String(g.event_date || g.date_debut || g.date || "").slice(0, 10),
      end = String(g.date_fin || date).slice(0, 10),
      all = g.all_day === true,
      time =
        String(g.horaire || "").trim() ||
        (all
          ? "Toute la journée"
          : [
              String(g.start_time || "").slice(0, 5),
              String(g.end_time || "").slice(0, 5),
            ]
              .filter(Boolean)
              .join("–")),
      place = String(g.location || g.lieu || g.place || "").trim(),
      k = typeKey({ ...x, ...g });
    return {
      id: String(
        x.id ||
          g.id ||
          `${origin}:${date}:${person(a)}:${g.title || g.intitule || ""}`,
      ),
      date,
      endDate: end,
      title: String(
        g.title ||
          g.intitule ||
          String(x.title || "").replace(/^📅\s*/, "") ||
          "Événement",
      ),
      body: String(g.body || x.body || ""),
      time,
      place,
      type: k,
      icon: typeIcon(k),
      agent: a,
      agentName: person(a),
      proposal,
      origin,
      raw: x,
      cancellable: origin === "manager" && !proposal,
    };
  }
  function collect(ir, pr) {
    const out = [];
    (ir.items || []).forEach((x) => out.push(normalize(x, false, "manager")));
    (pr.actions || [])
      .filter((x) => x.kind === "agenda_proposal")
      .forEach((x) => out.push(normalize(x, true, "proposal")));
    [
      ["medical_visits", "medical"],
      ["visites_medicales", "medical"],
      ["formations", "training"],
      ["stagiaires", "intern"],
      ["items_auto", "other"],
    ].forEach(([key]) => {
      (ir[key] || []).forEach((x) => out.push(normalize(x, false, "auto")));
    });
    const m = new Map();
    out
      .filter((x) => x.date && x.endDate >= todayIso())
      .forEach((x) => {
        const key = `${x.id}:${x.origin}`;
        if (!m.has(key)) m.set(key, x);
      });
    return [...m.values()].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.agentName.localeCompare(b.agentName, "fr"),
    );
  }
  function mondayOf(d = new Date()) {
    const x = new Date(d),
      day = x.getDay() || 7;
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() - (day - 1));
    return x;
  }
  function visibleEvents() {
    let a = active === "all" ? events : events.filter((x) => x.type === active);
    if (selectedDay) a = a.filter((x) => x.date === selectedDay);
    if (search) {
      const q = search.toLocaleLowerCase("fr-FR");
      a = a.filter((x) =>
        [x.agentName, x.title, x.place, typeLabel(x.type)]
          .join(" ")
          .toLocaleLowerCase("fr-FR")
          .includes(q),
      );
    }
    return a;
  }
  function counts() {
    const now = todayIso(),
      wk = mondayOf(),
      wkEnd = new Date(wk);
    wkEnd.setDate(wk.getDate() + 6);
    const m = now.slice(0, 7),
      src = events.filter((x) => active === "all" || x.type === active);
    $("#taUpcoming").textContent = `${src.length} à venir`;
    $("#taWeekCount").textContent = src.filter((x) => {
      const d = dateObj(x.date);
      return d >= wk && d <= wkEnd;
    }).length;
    $("#taMonthCount").textContent = src.filter(
      (x) => x.date.slice(0, 7) === m,
    ).length;
    $("#countAll").textContent = events.length;
    $("#countMedical").textContent = events.filter(
      (x) => x.type === "medical",
    ).length;
    $("#countIntern").textContent = events.filter(
      (x) => x.type === "intern",
    ).length;
    $("#countTraining").textContent = events.filter(
      (x) => x.type === "training",
    ).length;
  }
  function renderWeek() {
    const monday = mondayOf(),
      html = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const di = iso(d),
        dayEvents = events.filter((x) => x.date === di),
        shown =
          active === "all"
            ? dayEvents
            : dayEvents.filter((x) => x.type === active),
        training = shown.some((x) => x.type === "training");
      html.push(
        `<button type="button" class="ta-day ${di === todayIso() ? "today" : ""} ${selectedDay === di ? "selected" : ""} ${training ? "has-training" : ""}" data-day="${di}"><small>${esc(d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""))}</small><b>${d.getDate()}</b><em>${shown.length ? "<i></i>" : ""}${shown.length}</em></button>`,
      );
    }
    $("#taWeek").innerHTML = html.join("");
    $$("[data-day]").forEach(
      (b) =>
        (b.onclick = () => {
          selectedDay = selectedDay === b.dataset.day ? "" : b.dataset.day;
          window.STIPNav?.remember?.({ selectedDay });
          render();
        }),
    );
  }
  function renderTimeline() {
    const a = visibleEvents(),
      groups = new Map();
    a.forEach((x) => {
      const k = x.date.slice(0, 7);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(x);
    });
    $("#taTimeline").innerHTML = a.length
      ? [...groups.values()]
          .map(
            (group) =>
              `<section class="ta-month"><h2>${esc(fmtMonth(group[0].date))}</h2><div class="ta-month-list">${group.map((x) => `<button type="button" class="ta-item ${String(x.id) === focusId ? "focus" : ""}" data-event="${esc(x.id)}" data-origin="${esc(x.origin)}"><span class="ta-item-date"><small>${esc(fmtDay(x.date))}</small><b>${dateObj(x.date).getDate().toString().padStart(2, "0")}</b><em>${esc(dateObj(x.date).toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""))}</em></span><span class="ta-item-icon ${x.type}">${x.icon}</span><span class="ta-item-main"><span class="ta-item-top"><strong>${esc(x.agentName)}</strong><span class="ta-tag ${x.type}">${esc(typeLabel(x.type))}</span></span><p>${esc(x.time || x.title)}</p>${x.place ? `<small>${esc(x.place)}</small>` : x.title && x.time ? `<small>${esc(x.title)}</small>` : ""}</span><span class="ta-chevron">›</span></button>`).join("")}</div></section>`,
          )
          .join("")
      : '<div class="ta-empty">Aucune date à afficher avec ce filtre.</div>';
    $$("[data-event]").forEach(
      (b) => (b.onclick = () => openDetail(b.dataset.event, b.dataset.origin)),
    );
    if (focusId)
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-event="${CSS.escape(focusId)}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
  }
  function render() {
    counts();
    renderWeek();
    renderTimeline();
    $$("[data-filter]").forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === active),
    );
  }
  function openDetail(id, origin) {
    const x = events.find(
      (e) => String(e.id) === String(id) && e.origin === origin,
    );
    if (!x) return;
    window.STIPNav?.remember?.({
      panel: "taDetailSheet",
      eventId: id,
      eventOrigin: origin,
    });
    $("#taDetailType").textContent = typeLabel(x.type).toUpperCase();
    $("#taDetailTitle").textContent = x.agentName;
    $("#taDetailBody").innerHTML =
      `<div class="ta-detail-card"><dl><dt>Date</dt><dd>${esc(dateObj(x.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</dd><dt>Événement</dt><dd>${esc(x.title)}</dd>${x.time ? `<dt>Horaire</dt><dd>${esc(x.time)}</dd>` : ""}${x.place ? `<dt>Lieu</dt><dd>${esc(x.place)}</dd>` : ""}${x.body ? `<dt>Information</dt><dd>${esc(x.body)}</dd>` : ""}${x.proposal ? "<dt>Statut</dt><dd>Proposition en attente</dd>" : ""}</dl>${x.cancellable ? `<div class="ta-detail-actions"><button class="danger" id="taCancelEvent" type="button">Retirer de l’agenda</button></div>` : ""}</div>`;
    if (x.cancellable) $("#taCancelEvent").onclick = () => cancelItem(x.id);
    openSheet("#taDetailSheet");
  }
  function openSheet(sel) {
    const s = $(sel);
    s.classList.add("open");
    s.setAttribute("aria-hidden", "false");
    window.STIPNav?.remember?.({ panel: s.id });
  }
  function closeSheet(sel) {
    const s = $(sel);
    s.classList.remove("open");
    s.setAttribute("aria-hidden", "true");
    window.STIPNav?.remember?.({ panel: "", eventId: "", eventOrigin: "" });
  }
  function renderAgents() {
    const sel = $("#taAgent"),
      sorted = agents
        .slice()
        .sort((a, b) => person(a).localeCompare(person(b), "fr"));
    sel.innerHTML =
      '<option value="">Choisir un agent…</option>' +
      sorted
        .map(
          (a) =>
            `<option value="${esc(a.id)}">${esc(person(a))}${a.ghe ? ` · ${esc(a.ghe)}` : ""}</option>`,
        )
        .join("");
  }
  function setMode(v) {
    mode = v;
    $$("[data-mode]").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === v),
    );
    $$(".ta-schedule").forEach((x) =>
      x.classList.toggle("hidden", v === "notify"),
    );
    $("#taSubmit").textContent =
      v === "direct"
        ? "Ajouter à son agenda"
        : v === "proposal"
          ? "Envoyer la proposition"
          : "Envoyer la notification";
    syncPlacement();
  }
  function syncPlacement() {
    if (mode === "notify") return;
    const note = $("#taDisplay").value === "day_note",
      all = note || $("#taAllDay").checked;
    $("#taAllDayWrap").classList.toggle("hidden", note);
    $("#taStartWrap").classList.toggle("hidden", all);
    $("#taEndWrap").classList.toggle("hidden", all);
  }
  function payload() {
    const p = {
      target_agent_id: $("#taAgent").value,
      title: $("#taTitle").value.trim(),
      body: $("#taBody").value.trim(),
    };
    if (mode === "notify") return p;
    const note = $("#taDisplay").value === "day_note";
    return {
      ...p,
      event_date: $("#taDate").value,
      display_mode: note ? "day_note" : "event",
      all_day: note ? true : $("#taAllDay").checked,
      start_time: note || $("#taAllDay").checked ? null : $("#taStart").value,
      end_time: note || $("#taAllDay").checked ? null : $("#taEnd").value,
      location: $("#taLocation").value.trim(),
      importance: $("#taImportance").value,
    };
  }
  async function submit(e) {
    e.preventDefault();
    const f = $("#taFeedback"),
      b = $("#taSubmit"),
      p = payload();
    if (!p.target_agent_id || !p.title) {
      f.textContent = "Choisis un agent et renseigne un titre.";
      return;
    }
    if (mode !== "notify" && !p.event_date) {
      f.textContent = "Choisis une date.";
      return;
    }
    if (
      mode !== "notify" &&
      !p.all_day &&
      p.display_mode === "event" &&
      (!p.start_time || !p.end_time)
    ) {
      f.textContent = "Renseigne le début et la fin.";
      return;
    }
    b.disabled = true;
    f.textContent = "Envoi…";
    try {
      if (mode === "notify") await call("send_notification", p);
      else if (mode === "proposal") await call("agenda_propose", p);
      else await call("agenda_direct", p);
      f.textContent = "✓ Enregistré.";
      $("#taTitle").value = "";
      $("#taBody").value = "";
      $("#taLocation").value = "";
      await load();
      setTimeout(() => closeSheet("#taAddSheet"), 450);
    } catch (e) {
      f.textContent = e.message;
    } finally {
      b.disabled = false;
    }
  }
  async function cancelItem(id) {
    if (!confirm("Retirer cet élément du planning ?")) return;
    try {
      await call("manager_agenda_cancel", { id });
      closeSheet("#taDetailSheet");
      await load();
    } catch (e) {
      alert(e.message);
    }
  }
  async function load() {
    try {
      const [ar, ir, pr] = await Promise.all([
        call("manager_agents"),
        call("manager_agenda_list"),
        call("manager_list"),
      ]);
      agents = ar.agents || [];
      items = ir.items || [];
      proposals = (pr.actions || []).filter(
        (x) => x.kind === "agenda_proposal",
      );
      events = collect(ir, pr);
      renderAgents();
      render();
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        location.replace("index.html");
        return;
      }
      $("#taTimeline").innerHTML =
        `<div class="ta-empty">${esc(e.message)}</div>`;
    }
  }
  function init() {
    if (!localStorage.getItem(STORE)) {
      location.replace("index.html");
      return;
    }
    const q = new URLSearchParams(location.search),
      f = q.get("filter"),
      openMode = String(q.get("open") || "").toLowerCase(),
      requestedDate = String(q.get("date") || "").slice(0, 10);
    if (["all", "medical", "intern", "training"].includes(f)) active = f;
    focusId = q.get("focus") || "";
    search = navigationState.search || "";
    selectedDay = navigationState.selectedDay || "";
    $("#taSearch").value = search;
    $("#taSearchWrap").hidden = !navigationState.searchOpen;
    $("#taSearchToggle").onclick = () => {
      const w = $("#taSearchWrap");
      w.hidden = !w.hidden;
      window.STIPNav?.remember?.({ searchOpen: !w.hidden });
      if (!w.hidden) setTimeout(() => $("#taSearch").focus(), 20);
    };
    $("#taSearch").oninput = (e) => {
      search = e.target.value.trim();
      window.STIPNav?.remember?.({ search, searchOpen: true });
      renderTimeline();
    };
    $("#taSearchClear").onclick = () => {
      $("#taSearch").value = "";
      search = "";
      window.STIPNav?.remember?.({ search: "" });
      renderTimeline();
    };
    $$("[data-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          active = b.dataset.filter;
          selectedDay = "";
          focusId = "";
          window.STIPNav?.remember?.({ filter: active, selectedDay: "" });
          render();
        }),
    );
    $("#taAdd").onclick = () => openSheet("#taAddSheet");
    $$("[data-close-sheet]").forEach(
      (b) => (b.onclick = () => closeSheet("#taDetailSheet")),
    );
    $$("[data-close-add]").forEach(
      (b) => (b.onclick = () => closeSheet("#taAddSheet")),
    );
    $("#taDetailSheet").onclick = (e) => {
      if (e.target.id === "taDetailSheet") closeSheet("#taDetailSheet");
    };
    $("#taAddSheet").onclick = (e) => {
      if (e.target.id === "taAddSheet") closeSheet("#taAddSheet");
    };
    $$("[data-mode]").forEach(
      (b) => (b.onclick = () => setMode(b.dataset.mode)),
    );
    $("#taDisplay").onchange = syncPlacement;
    $("#taAllDay").onchange = syncPlacement;
    $("#taForm").onsubmit = submit;
    const d = new Date(Date.now() + 86400000);
    $("#taDate").value = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : iso(d);
    setMode("direct");
    window.STIPNav?.register?.({
      capture: () => ({
        filter: active,
        selectedDay,
        search,
        searchOpen: !$("#taSearchWrap").hidden,
        panel:
          document.querySelector('.ta-sheet.open[aria-hidden="false"]')?.id ||
          "",
      }),
    });
    load()
      .then(() => {
        if (openMode === "add" || navigationState.panel === "taAddSheet")
          openSheet("#taAddSheet");
        if (navigationState.panel === "taDetailSheet")
          openDetail(navigationState.eventId, navigationState.eventOrigin);
      })
      .finally(() => window.STIPNav?.restoreScroll?.());
  }
  init();
})();
