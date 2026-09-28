(() => {
  "use strict";

  const API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data";
  const STORE = "stip_session_v1";
  const MONTHS = [
    "JANVIER","FÉVRIER","MARS","AVRIL","MAI","JUIN",
    "JUILLET","AOÛT","SEPTEMBRE","OCTOBRE","NOVEMBRE","DÉCEMBRE"
  ];
  const DAYS = ["LUN","MAR","MER","JEU","VEN","SAM","DIM"];

  const state = {
    loaded: false,
    loading: null,
    items: [],
    months: [],
    monthKey: ""
  };

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function parisMonthKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Europe/Paris"
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("year")}-${get("month")}`;
  }

  function parisDateKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Paris"
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  async function callBootstrap() {
    const token = localStorage.getItem(STORE) || "";
    if (!token) {
      location.replace("/");
      return null;
    }
    const response = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": token
      },
      body: JSON.stringify({ action: "bootstrap" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw Error(data.error || `Erreur ${response.status}`);
    return data;
  }

  function validItem(item) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(item?.date || "")) &&
      !!String(item?.code || item?.source_value || "").trim();
  }

  function chooseMonth() {
    const current = parisMonthKey();
    if (state.months.includes(current)) {
      state.monthKey = current;
      return;
    }
    state.monthKey =
      state.months.find((month) => month > current) ||
      state.months.at(-1) ||
      current;
  }

  function codeMarkup(rawCode) {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) return "";

    const def = window.STIPShiftRegistry?.resolve?.(code);
    if (def && def.is_working === false) {
      const icon = window.STIPShiftRegistry?.icon?.(code) || "";
      return icon
        ? `<span class="stip-month-icon" aria-label="${esc(def.label || code)}">${esc(icon)}</span>`
        : `<span class="metiers-shift-code">${esc(code)}</span>`;
    }

    return window.STIPMonthTable?.shiftBadgeHtml?.(code) ||
      `<span class="stip-month-shift-badge">${esc(code)}</span>`;
  }

  function monthMarkup(key) {
    const [year, month] = key.split("-").map(Number);
    const byDate = new Map(
      state.items
        .filter((item) => String(item.date || "").startsWith(key))
        .map((item) => [String(item.date), item])
    );
    const first = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (first.getDay() + 6) % 7;
    const today = parisDateKey();
    const index = state.months.indexOf(key);

    let cells = "";
    for (let i = 0; i < pad; i += 1) {
      cells += '<span class="stip-month-day metiers-month-empty" aria-hidden="true"></span>';
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${key}-${String(day).padStart(2, "0")}`;
      const item = byDate.get(dateKey);
      const code = String(item?.code || item?.source_value || "").trim();
      const dow = new Date(`${dateKey}T12:00:00`).getDay();
      const weekend = dow === 0 || dow === 6;
      cells += `<div class="stip-month-day${weekend ? " is-weekend" : ""}${dateKey === today ? " is-today" : ""}" data-stip-date="${dateKey}">
        <b class="stip-month-day-number">${day}</b>
        <div class="stip-month-primary">${codeMarkup(code)}</div>
        <div class="stip-month-events" aria-hidden="true"></div>
      </div>`;
    }

    const used = pad + daysInMonth;
    const tail = (7 - (used % 7)) % 7;
    for (let i = 0; i < tail; i += 1) {
      cells += '<span class="stip-month-day metiers-month-empty" aria-hidden="true"></span>';
    }

    return `<section class="stip-month-calendar metiers-month-card" aria-label="Calendrier du mois">
      <header class="stip-month-nav">
        <button type="button" data-month-step="-1" aria-label="Mois précédent" ${index <= 0 ? "disabled" : ""}>‹</button>
        <div class="metiers-month-title"><strong>${MONTHS[month - 1]}</strong><small>${year}</small></div>
        <button type="button" data-month-step="1" aria-label="Mois suivant" ${index < 0 || index >= state.months.length - 1 ? "disabled" : ""}>›</button>
      </header>
      <div class="stip-month-weekdays">${DAYS.map((day) => `<span>${day}</span>`).join("")}</div>
      <div class="stip-month-grid">${cells}</div>
    </section>`;
  }

  function renderMonth() {
    const host = document.getElementById("metiersMonthHost");
    if (!host) return;
    host.innerHTML = monthMarkup(state.monthKey);
  }

  async function loadMonth() {
    if (state.loaded) {
      renderMonth();
      return;
    }
    if (state.loading) return state.loading;

    state.loading = (async () => {
      const host = document.getElementById("metiersMonthHost");
      try {
        const data = await callBootstrap();
        if (!data) return;
        if (data.shift_definitions) window.STIPShiftRegistry?.set?.(data.shift_definitions);
        state.items = (data.personal || data.items || []).filter(validItem);
        state.months = [...new Set(state.items.map((item) => String(item.date).slice(0, 7)))].sort();
        chooseMonth();
        state.loaded = true;
        renderMonth();
      } catch (error) {
        if (host) host.innerHTML = `<div class="metiers-error">${esc(error.message || "Chargement impossible.")}</div>`;
      } finally {
        state.loading = null;
      }
    })();

    return state.loading;
  }

  function selectPeriod(period) {
    document.querySelectorAll("[data-period]").forEach((button) => {
      const active = button.dataset.period === period;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== period;
    });
    if (period === "month") loadMonth();
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest?.("[data-period]");
    if (tab) {
      selectPeriod(tab.dataset.period);
      return;
    }

    const nav = event.target.closest?.("[data-month-step]");
    if (!nav || nav.disabled || !state.loaded) return;
    const current = state.months.indexOf(state.monthKey);
    const next = current + Number(nav.dataset.monthStep || 0);
    if (current < 0 || next < 0 || next >= state.months.length) return;
    state.monthKey = state.months[next];
    renderMonth();
  });

  selectPeriod("month");
})();
