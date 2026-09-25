(() => {
  "use strict";

  const EMBEDDED =
    new URLSearchParams(location.search).has("embed") ||
    window.self !== window.top;
  if (EMBEDDED) document.documentElement.classList.add("stip-team-embedded");

  const ROOT = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/";
  const STORE = "stip_session_v1";
  const CACHE_TTL = 5 * 60 * 1000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  const navigationState = window.STIPNav?.read?.() || {};
  const state = {
    access: null,
    tab: "team",
    weekStart: monday(todayIso()),
    weekPast: false,
    weekFull: false,
    dayFocus: todayIso(),
    weeks: new Map(),
    request: 0,
    rendered: false,
    openShift: "",
    dateJumpMonth: monthKey(todayIso()),
    daySignals: new Map(),
    staffingByDate: new Map(),
    signalMonths: new Map(),
    openShifts: new Map(),
  };

  function token() {
    return localStorage.getItem(STORE) || "";
  }

  const field = () => window.STIPFieldIntel || null;

  async function post(fn, body) {
    const response = await fetch(ROOT + fn, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": token(),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error)
      throw Error(data.error || `Erreur ${response.status}`);
    return data;
  }

  function dateObj(value) {
    return new Date(`${value}T12:00:00`);
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function todayIso() {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Paris",
    }).format(new Date());
  }

  function addDays(value, count) {
    const date = dateObj(value);
    date.setDate(date.getDate() + count);
    return iso(date);
  }

  function monday(value) {
    const date = dateObj(value);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return iso(date);
  }

  function daysOfWeek(start = state.weekStart) {
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  function teamWeekState() {
    const engine=window.STIPWeekEngine,
      weekOffset=engine?.weekOffsetFor?.(state.weekStart,todayIso()) ?? Math.round((dateObj(state.weekStart)-dateObj(monday(todayIso())))/604800000);
    return {weekOffset,weekPast:state.weekPast,weekFull:state.weekFull,dayFocus:state.dayFocus};
  }
  function visibleTeamDates() {
    const engine=window.STIPWeekEngine;
    return engine?.visibleDates?.(teamWeekState(),{today:todayIso()})||daysOfWeek(state.weekStart);
  }
  function teamWeekDisplay() {
    const engine=window.STIPWeekEngine;
    return engine?.display?.(teamWeekState(),{today:todayIso()})||{dates:daysOfWeek(state.weekStart),visualDates:daysOfWeek(state.weekStart),nextMonday:"",slotCount:7};
  }

  function isoWeek(value) {
    const date = dateObj(value);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const first = new Date(date.getFullYear(), 0, 4, 12);
    return (
      1 +
      Math.round(
        ((date - first) / 86400000 - 3 + ((first.getDay() + 6) % 7)) / 7,
      )
    );
  }

  function shortDay(value) {
    return dateObj(value)
      .toLocaleDateString("fr-FR", { weekday: "short" })
      .replace(".", "")
      .toUpperCase();
  }

  function dayTitle(value) {
    return dateObj(value)
      .toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      .replace(/^./, (char) => char.toUpperCase());
  }

  function monthContext(start = state.weekStart) {
    const end = addDays(start, 6);
    const first = dateObj(start);
    const last = dateObj(end);
    const months =
      first.getMonth() === last.getMonth()
        ? [first.toLocaleDateString("fr-FR", { month: "long" })]
        : [
            first.toLocaleDateString("fr-FR", { month: "long" }),
            last.toLocaleDateString("fr-FR", { month: "long" }),
          ];
    const years =
      first.getFullYear() === last.getFullYear()
        ? [first.getFullYear()]
        : [first.getFullYear(), last.getFullYear()];
    return {
      month: months.map((value) => value.toUpperCase()).join(" · "),
      year: years.join(" · "),
    };
  }

  function weekRange(start = state.weekStart) {
    const end = addDays(start, 6);
    const first = dateObj(start);
    const last = dateObj(end);
    const sameMonth = first.getMonth() === last.getMonth();
    const left = first.toLocaleDateString("fr-FR", {
      day: "numeric",
      ...(sameMonth ? {} : { month: "short" }),
    });
    const right = last.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${left} – ${right}`;
  }
  function monthKey(value) {
    const date = dateObj(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function shiftMonthKey(key, step) {
    const [year, month] = String(key || "").split("-").map(Number);
    const date = new Date(
      year || dateObj(state.weekStart).getFullYear(),
      (month || dateObj(state.weekStart).getMonth() + 1) - 1 + Number(step || 0),
      1,
      12,
    );
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function firstMondayOfMonth(key) {
    const date = dateObj(`${key}-01`);
    const day = date.getDay() || 7;
    if (day !== 1) date.setDate(date.getDate() + ((8 - day) % 7));
    return iso(date);
  }

  function daysOfMonth(key) {
    if (!/^\d{4}-\d{2}$/.test(String(key || ""))) return [];
    const [year, month] = key.split("-").map(Number);
    const last = new Date(year, month, 0, 12).getDate();
    return Array.from(
      { length: last },
      (_, index) => `${key}-${String(index + 1).padStart(2, "0")}`,
    );
  }

  function signalForDate(value) {
    return state.daySignals.get(value) || null;
  }

  function statusSymbol(level, fallback = "") {
    if (level === "opportunity") return "+";
    if (level === "ok") return "✔";
    if (level === "warning") return "⚠️";
    if (level === "critical") return "🛑";
    return fallback || "○";
  }

  function assistantItemsForDate(bundle, value) {
    return (bundle?.assistant?.items || []).filter(
      (item) => String(item?.date || "").slice(0, 10) === value,
    );
  }

  function signalStatus(staff, items = []) {
    return (
      field()?.dayStatus?.({ staffing: staff, items }) ||
      (() => {
        const worst = Math.max(
          0,
          ...items.map((item) => Number(item?.severity || 0)),
        );
        return worst >= 4
          ? { level: "critical", symbol: "🛑", label: "Ça coince" }
          : worst >= 2
            ? { level: "warning", symbol: "⚠️", label: "À surveiller" }
            : staff?.available
              ? { level: "ok", symbol: "✔", label: "Rien ne coince" }
              : { level: "unknown", symbol: "", label: "Pas assez de données" };
      })()
    );
  }

  async function loadWeekSignals(start, bundle, force = false) {
    const cached = cacheEntry(start);
    if (
      !force &&
      cached.signalLoaded &&
      Date.now() - Number(cached.signalFetchedAt || 0) < CACHE_TTL
    )
      return;
    if (cached.signalPromise && !force) return cached.signalPromise;
    const days = daysOfWeek(start);
    cached.signalPromise = (async () => {
      const rows = new Array(days.length);
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(3, Math.max(1, days.length)) },
        async () => {
          while (cursor < days.length) {
            const index = cursor++;
            try {
              rows[index] = {
                status: "fulfilled",
                value: await post("stip-staffing", { action: "day", date: days[index] }),
              };
            } catch (reason) {
              rows[index] = { status: "rejected", reason };
            }
          }
        },
      );
      await Promise.all(workers);
      rows.forEach((result, index) => {
        const date = days[index],
          staff = result?.status === "fulfilled" ? result.value : null,
          items = assistantItemsForDate(bundle, date),
          status = signalStatus(staff, items);
        state.staffingByDate.set(date, staff);
        state.daySignals.set(date, status);
      });
      cached.signalLoaded = true;
      cached.signalFetchedAt = Date.now();
      if (start === state.weekStart) {
        renderHeader();
        if (state.rendered) renderContent(cached);
      }
    })().catch(() => {}).finally(() => {
      cached.signalPromise = null;
    });
    return cached.signalPromise;
  }

  async function loadMonthSignals(key, force = false) {
    const days = daysOfMonth(key);
    if (!days.length) return;
    let cached = state.signalMonths.get(key);
    if (!cached) {
      cached = {
        loaded: false,
        fetchedAt: 0,
        promise: null,
        assistantItems: [],
      };
      state.signalMonths.set(key, cached);
    }
    if (
      !force &&
      cached.loaded &&
      Date.now() - Number(cached.fetchedAt || 0) < CACHE_TTL
    ) {
      if (state.dateJumpMonth === key) renderMonthDigest(key);
      return;
    }
    if (cached.promise && !force) return cached.promise;

    cached.promise = (async () => {
      const assistant = allowed("assistant_enabled")
        ? await post("stip-assistant", {
            action: "feed",
            start_date: days[0],
            end_date: days.at(-1),
          }).catch(() => null)
        : null;
      const assistantItems = assistant?.items || [];
      cached.assistantItems = assistantItems;
      const targetDays = force
        ? days
        : days.filter((date) => !state.daySignals.has(date));
      let cursor = 0;
      let completed = 0;
      const workers = Array.from(
        { length: Math.min(2, Math.max(1, targetDays.length)) },
        async () => {
          while (cursor < targetDays.length) {
            const date = targetDays[cursor++];
            let staff = null;
            try {
              staff = await post("stip-staffing", { action: "day", date });
            } catch {}
            const items = assistantItems.filter(
              (item) => String(item?.date || "").slice(0, 10) === date,
            );
            state.staffingByDate.set(date, staff);
            state.daySignals.set(date, signalStatus(staff, items));
            completed += 1;
            if (
              state.dateJumpMonth === key &&
              (completed % 4 === 0 || completed === targetDays.length)
            )
              {
                renderDateJumpCalendar(key);
                renderMonthDigest(key);
              }
          }
        },
      );
      await Promise.all(workers);
      cached.loaded = true;
      cached.fetchedAt = Date.now();
      if (state.dateJumpMonth === key) {
        renderDateJumpCalendar(key);
        renderMonthDigest(key);
      }
    })().finally(() => {
      cached.promise = null;
    });
    return cached.promise;
  }

  function monthAssistantItems(key) {
    return state.signalMonths.get(key)?.assistantItems || [];
  }

  function monthDigestRows(key) {
    const items = monthAssistantItems(key);
    return daysOfMonth(key)
      .map((day) => {
        const dayItems = items.filter(
          (item) => String(item?.date || "").slice(0, 10) === day,
        );
        const signal = signalForDate(day) || {
          level: "unknown",
          label: "Pas encore analysé",
          symbol: "",
        };
        const staff = state.staffingByDate.get(day);
        const formationCount = dayItems.filter(
          (item) => item?.source_family === "formation",
        ).length;
        const traineeCount = dayItems.filter(
          (item) => item?.source_family === "trainee",
        ).length;
        const significant = dayItems.filter(
          (item) =>
            Number(item?.severity || 0) >= 2 ||
            ["anticipation", "warning", "opportunity", "proposal"].includes(
              String(item?.kind || ""),
            ) ||
            ["changes", "onboarding", "strategy"].includes(
              String(item?.source_family || ""),
            ),
        );
        const gaps = staffingRows(staff)
          .map((row) => ({
            code: baseShift(row?.shift_code || row?.shift || row?.code),
            gap: staffingRowGap(row),
          }))
          .filter((row) => row.code && row.gap !== 0)
          .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
        const meaningful =
          ["critical", "warning", "opportunity"].includes(signal.level) ||
          formationCount > 0 ||
          traineeCount > 0 ||
          significant.length > 0;
        if (!meaningful) return null;

        const details = [];
        if (formationCount)
          details.push(
            `🎓 ${formationCount} formation${formationCount > 1 ? "s" : ""}`,
          );
        if (traineeCount)
          details.push(
            `👶 ${traineeCount} stagiaire${traineeCount > 1 ? "s" : ""}`,
          );
        if (gaps.length) {
          const useful = gaps
            .filter((row) =>
              ["critical", "warning"].includes(signal.level)
                ? row.gap < 0
                : signal.level === "opportunity"
                  ? row.gap > 0
                  : true,
            )
            .slice(0, 2);
          for (const row of useful)
            details.push(
              `${row.code} · ${row.gap < 0 ? "équipe plus légère" : "présence plus large"}`,
            );
        }
        const lead = significant[0];
        const leadText =
          field()?.terrainItem?.(lead)?.headline ||
          lead?.title ||
          "";
        if (leadText && !details.some((part) => part.includes(leadText)))
          details.push(leadText);

        return {
          day,
          level: signal.level || "unknown",
          symbol: statusSymbol(signal.level, signal.symbol),
          label:
            signal.level === "critical"
              ? "Point important"
              : signal.level === "warning"
                ? "À anticiper"
                : signal.level === "ok"
                  ? "Journée habituelle"
                  : "À retenir",
          details: details.slice(0, 4),
          formationCount,
          traineeCount,
        };
      })
      .filter(Boolean);
  }

  function renderMonthDigest(key = state.dateJumpMonth) {
    const host = $("#teamMonthDigestHost");
    if (!host) return;
    const cache = state.signalMonths.get(key);
    if (!cache?.loaded) {
      host.innerHTML =
        '<div class="team-month-digest-loading">Analyse du mois…</div>';
      return;
    }
    const rows = monthDigestRows(key);
    if (!rows.length) {
      host.innerHTML =
        '<div class="team-month-digest-empty"><strong>Rien à signaler ce mois</strong><span>Les journées sans point utile ne sont pas répétées ici.</span></div>';
      return;
    }

    const formationTotal = rows.reduce(
        (sum, row) => sum + row.formationCount,
        0,
      ),
      traineeTotal = rows.reduce((sum, row) => sum + row.traineeCount, 0),
      alertDays = rows.filter((row) =>
        ["critical", "warning"].includes(row.level),
      ).length,
      groups = new Map();

    for (const row of rows) {
      const start = monday(row.day);
      if (!groups.has(start)) groups.set(start, []);
      groups.get(start).push(row);
    }

    const summary = [
      `${rows.length} jour${rows.length > 1 ? "s" : ""} à retenir`,
      alertDays
        ? `${alertDays} à surveiller`
        : "",
      formationTotal
        ? `${formationTotal} formation${formationTotal > 1 ? "s" : ""}`
        : "",
      traineeTotal
        ? `${traineeTotal} stagiaire${traineeTotal > 1 ? "s" : ""}`
        : "",
    ].filter(Boolean);

    const weeks = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([start, weekRows]) => {
        const end = addDays(start, 6),
          inSelectedWeek =
            state.dayFocus >= start && state.dayFocus <= end,
          label =
            dateObj(start)
              .toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
              .replace(".", "") +
            " → " +
            dateObj(end)
              .toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
              .replace(".", "");
        return `<details class="team-month-week" ${inSelectedWeek ? "open" : ""}>
          <summary><span>${esc(label)}</span><b>${weekRows.length}</b></summary>
          <div>${weekRows
            .map((row) => {
              const d = dateObj(row.day),
                labelDay = d
                  .toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                  })
                  .replace(".", "");
              return `<button type="button" class="team-month-line status-${esc(row.level)}" data-team-month-day="${esc(row.day)}">
                <span class="team-month-line-status" aria-hidden="true">${esc(row.symbol)}</span>
                <div><strong>${esc(labelDay)} · ${esc(row.label)}</strong><small>${esc(row.details.join(" · ") || "Point utile détecté")}</small></div>
                <i aria-hidden="true">›</i>
              </button>`;
            })
            .join("")}</div>
        </details>`;
      })
      .join("");

    host.innerHTML =
      `<section class="team-month-digest-card">
        <header><strong>${esc(
          dateObj(key + "-01")
            .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
            .replace(/^./, (char) => char.toUpperCase()),
        )}</strong><span>${esc(summary.join(" · "))}</span></header>
        <div class="team-month-weeks">${weeks}</div>
      </section>`;
  }

  function renderDateJumpCalendar(key = "") {
    const panel = $("#teamDateJumpPanel");
    if (!panel) return;
    const basis = /^\d{4}-\d{2}$/.test(key)
        ? dateObj(`${key}-01`)
        : dateObj(state.dayFocus || state.weekStart),
      year = basis.getFullYear(),
      month = basis.getMonth(),
      first = new Date(year, month, 1, 12),
      last = new Date(year, month + 1, 0, 12),
      leading = (first.getDay() + 6) % 7,
      today = todayIso(),
      weekEnd = addDays(state.weekStart, 6),
      cells = [];
    for (let i = 0; i < leading; i++)
      cells.push('<span class="team-date-jump-empty" aria-hidden="true"></span>');
    for (let day = 1; day <= last.getDate(); day++) {
      const date = new Date(year, month, day, 12),
        value = iso(date),
        weekend = date.getDay() === 0 || date.getDay() === 6,
        signal = signalForDate(value),
        cls = [
          value === today ? "is-today" : "",
          value >= state.weekStart && value <= weekEnd ? "is-week" : "",
          value === state.dayFocus ? "is-selected" : "",
          weekend ? "is-weekend" : "",
          signal?.level ? `status-${signal.level}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        marker =
          signal?.level && signal.level !== "unknown"
            ? `<span class="team-cal-status stip-month-icon status-${esc(signal.level)}" aria-hidden="true">${esc(statusSymbol(signal.level, signal.symbol))}</span>`
            : '<span class="team-cal-marker-empty" aria-hidden="true"></span>',
        aria = [dayTitle(value), signal?.label || ""].filter(Boolean).join(", ");
      cells.push(
        `<button type="button" class="stip-month-day ${cls}" data-team-cal-day="${value}" aria-label="${esc(aria)}"><b class="team-cal-day-number stip-month-day-number">${day}</b><span class="team-cal-marker stip-month-primary">${marker}</span><small class="team-cal-events stip-month-events"></small></button>`,
      );
    }
    state.dateJumpMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    panel.dataset.calendarMonth = state.dateJumpMonth;
    panel.innerHTML =
      `<div class="team-date-jump-head stip-month-nav"><button type="button" data-team-cal-step="-1" aria-label="Mois précédent">‹</button><strong>${esc(
        first
          .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          .replace(/^./, (char) => char.toUpperCase()),
      )}</strong><button type="button" data-team-cal-step="1" aria-label="Mois suivant">›</button></div>` +
      '<div class="team-date-jump-weekdays stip-month-weekdays"><span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span><span>Sa</span><span>Di</span></div>' +
      `<div class="team-date-jump-grid stip-month-grid">${cells.join("")}</div>`;
  }

  function chooseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return;
    const shared=window.STIPWeekEngine?.stateForDate?.(value,{today:todayIso()});
    state.weekStart = monday(value);
    state.weekPast = Boolean(shared?.weekPast);
    state.weekFull = Boolean(shared?.weekFull);
    state.dayFocus = value;
    state.dateJumpMonth = monthKey(value);
    state.openShift = "";
    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
      scrollY: 0,
    });
    showWeek({ preserve: true });
  }

  function allowed(key) {
    return Boolean(state.access?.permissions?.[key]);
  }

  function shiftDefinition(value) {
    return window.STIPShiftRegistry?.resolve?.(value) || null;
  }

  function workShiftDefinitions() {
    const seen = new Set();
    return (window.STIPShiftRegistry?.all?.() || [])
      .filter((row) => {
        const code = String(row?.code || "").toUpperCase(),
          base = String(row?.base_code || row?.code || "").toUpperCase();
        if (!row?.is_working || code !== base || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .sort((a, b) => Number(a?.sort_order || 999) - Number(b?.sort_order || 999));
  }

  function shiftMeta(value) {
    const def = shiftDefinition(value),
      base = window.STIPShiftRegistry?.baseCode?.(value) || "";
    return def?.is_working
      ? {
          definition: def,
          code: base,
          label: String(def.label || base),
          time: window.STIPShiftRegistry?.time?.(value) || "",
        }
      : null;
  }

  function baseShift(value) {
    return shiftMeta(value)?.code || "";
  }

  function adaptedShift(value) {
    const raw = String(value || "").trim().toUpperCase().replace(/\*+$/, ""),
      meta = shiftMeta(raw);
    return Boolean(
      meta?.code &&
        (raw !== meta.code ||
          String(meta.definition?.schedule_mode || "standard") !== "standard"),
    );
  }

  function displayName(agent) {
    if (window.STIPName?.format) return window.STIPName.format(agent);
    return [agent?.prenom, agent?.nom].filter(Boolean).join(" ") || "Agent";
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function phoneHref(value) {
    const digits = phoneDigits(value);
    if (!digits) return "";
    return digits.startsWith("33") ? `tel:+${digits}` : `tel:${digits}`;
  }

  function hiddenPhoneHref(value) {
    let digits = phoneDigits(value);
    if (!digits) return "";
    if (digits.startsWith("33")) digits = `0${digits.slice(2)}`;
    return `tel:%2331%23${digits}`;
  }

  function gheNumber(item) {
    const raw = String(item?.agents?.ghe || "").replace(/^GHE\s*/i, "");
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  }

  function compareAgentGhe(a, b) {
    const byGhe = gheNumber(a) - gheNumber(b);
    if (Number.isFinite(byGhe) && byGhe !== 0) return byGhe;
    if (gheNumber(a) !== gheNumber(b)) return gheNumber(a) - gheNumber(b);
    return displayName(a?.agents || {}).localeCompare(
      displayName(b?.agents || {}),
      "fr",
      { sensitivity: "base" },
    );
  }

  function cacheEntry(start) {
    if (!state.weeks.has(start))
      state.weeks.set(start, {
        fetchedAt: 0,
        team: null,
        assistant: null,
        activity: null,
        activityPromise: null,
        corePromise: null,
        coreLoaded: false,
        signalLoaded: false,
        signalFetchedAt: 0,
        signalPromise: null,
      });
    return state.weeks.get(start);
  }

  async function loadCore(start, force = false) {
    const cached = cacheEntry(start);
    if (
      !force &&
      cached.coreLoaded &&
      Date.now() - cached.fetchedAt < CACHE_TTL
    )
      return cached;
    if (cached.corePromise && !force) return cached.corePromise;
    const end = addDays(start, 6);
    cached.corePromise = Promise.allSettled([
      allowed("planning_team")
        ? post("stip-data", {
            action: "spirit_week",
            start_date: start,
            end_date: end,
          })
        : Promise.resolve(null),
      allowed("assistant_enabled")
        ? post("stip-assistant", {
            action: "feed",
            start_date: start,
            end_date: end,
          })
        : Promise.resolve(null),
    ]).then((results) => {
      cached.team = results[0].status === "fulfilled" ? results[0].value : null;
      if (cached.team?.shift_definitions)
        window.STIPShiftRegistry?.set?.(cached.team.shift_definitions);
      cached.assistant =
        results[1].status === "fulfilled" ? results[1].value : null;
      cached.fetchedAt = Date.now();
      cached.coreLoaded = true;
      cached.corePromise = null;
      cached.coreError = results.find(
        (result) => result.status === "rejected",
      )?.reason;
      return cached;
    });
    return cached.corePromise;
  }

  async function loadActivity(start, force = false) {
    const cached = cacheEntry(start);
    if (!allowed("activity")) return cached;
    if (!force && cached.activity) return cached;
    if (cached.activityPromise && !force) return cached.activityPromise;
    const days = daysOfWeek(start);
    cached.activityPromise = (async () => {
      const results = new Array(days.length);
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(2, Math.max(1, days.length)) },
        async () => {
          while (cursor < days.length) {
            const index = cursor++;
            try {
              results[index] = {
                status: "fulfilled",
                value: await post("stip-cadre", { action: "dashboard", date: days[index] }),
              };
            } catch (reason) {
              results[index] = { status: "rejected", reason };
            }
          }
        },
      );
      await Promise.all(workers);
      cached.activity = new Map();
      results.forEach((result, index) => {
        if (result?.status === "fulfilled")
          cached.activity.set(days[index], result.value?.day || {});
      });
      cached.activityError = results.find(
        (result) => result?.status === "rejected",
      )?.reason;
      return cached;
    })().finally(() => {
      cached.activityPromise = null;
    });
    return cached.activityPromise;
  }

  function normalizeDayFocus() {
    const days = visibleTeamDates();
    if (state.dayFocus && !days.includes(state.dayFocus)) state.dayFocus = "";
  }

  function renderWeekStrip() {
    const host = $("#teamDays");
    if (!host) return;
    const today = todayIso(),model=teamWeekDisplay(),dates=model.dates||[];
    const renderDay=(day)=>{
      const d = dateObj(day);
      const signal = signalForDate(day) || {
        level: "unknown",
        symbol: "",
        label: "Pas encore analysé",
      };
      const level = signal.level || "unknown";
      const cls = [
        "stip-week-day",
        "neutral",
        level ? `status-${level}` : "",
        day === state.dayFocus ? "selected" : "",
        day === today ? "today" : "",
      ].filter(Boolean).join(" ");
      const weekday = d
        .toLocaleDateString("fr-FR", { weekday: "long" })
        .replace(".", "")
        .toUpperCase()
        .slice(0, 2);
      const symbol =
        level && level !== "unknown"
          ? statusSymbol(level, signal.symbol)
          : "○";
      return `<button type="button" class="${cls}" data-team-day="${day}" aria-pressed="${day === state.dayFocus}" aria-label="${esc(dayTitle(day))}, ${esc(signal.label || "")}"><span class="stip-week-day-head"><i>${esc(weekday)}</i><b>${d.getDate()}</b></span><span class="stip-week-day-body"><strong class="stip-week-code" aria-hidden="true"></strong><span class="stip-week-main"><span class="stip-week-main-icon team-day-intel status-${esc(level)}" aria-hidden="true">${esc(symbol)}</span></span><span class="stip-week-divider is-empty" aria-hidden="true"></span><span class="stip-week-events is-empty" aria-hidden="true"></span></span></button>`;
    };
    const out=dates.map(renderDay);
    if(model.nextMonday){
      out.push('<span class="stip-week-next-bridge" aria-hidden="true"><span class="stip-week-next-word">LUNDI</span><span class="stip-week-next-arrow">→</span></span>');
      out.push(renderDay(model.nextMonday));
    }
    host.style.setProperty("--stip-week-columns",String(model.slotCount||dates.length||1));
    host.classList.toggle("has-next-monday",Boolean(model.nextMonday));
    host.innerHTML=out.join("");
  }

  function teamLegendItem(key, iconHtml, label, meta = "") {
    return `<button class="stip-legend-item" type="button" data-stip-legend-key="${esc(key)}" aria-pressed="false"><span class="stip-legend-icon" aria-hidden="true">${iconHtml}</span><span class="stip-legend-bullet" aria-hidden="true">•</span><b>${esc(label)}</b>${meta ? `<small>${esc(meta)}</small>` : ""}</button>`;
  }

  function renderPageLegend() {
    const list = $("#teamLegendList");
    if (!list) return;
    const sources = [
        $("#teamContent"),
        $("#teamDateJumpPanel"),
        $("#teamMonthDigestHost"),
        $("#teamDutyChiefTodayHost"),
      ].filter(Boolean),
      has = (selector) => sources.some((root) => root.querySelector(selector)),
      textContent = sources.map((root) => root.textContent || "").join(" "),
      items = [],
      seen = new Set(),
      add = (key, iconHtml, label, meta = "") => {
        if (!key || seen.has(key)) return;
        seen.add(key);
        items.push(teamLegendItem(key, iconHtml, label, meta));
      };

    // Shift colours are meaningful visual cues on the selected day's cards.
    for (const code of ["M", "J", "J4", "S", "N"]) {
      const cls = code.toLowerCase(),
        block = sources
          .flatMap((root) => [...root.querySelectorAll(`.team-shift.shift-${cls}`)])
          .find(Boolean);
      if (!block) continue;
      const meta = shiftMeta(code);
      add(
        "shift:" + code,
        `<i class="team-legend-shift-dot shift-${cls}"></i>`,
        meta?.label || code,
        meta?.time || "",
      );
    }

    const statuses = [
      ["ok", "✔", "Rien ne coince"],
      ["warning", "⚠", "À surveiller"],
      ["critical", "🛑", "Journée tendue"],
      ["opportunity", "+", "Présence plus large"],
      ["unknown", "○", "Pas encore analysé"],
    ];
    for (const [level, icon, label] of statuses) {
      if (
        has(`.team-day-intel.status-${level},.team-shift-mini-status.status-${level},.team-cal-status.status-${level},.team-month-line.status-${level}`)
      )
        add("status:" + level, icon, label);
    }

    if (has(".hc-duty-chief-icon,.team-chef-mark"))
      add("chef", "🎨", "Chef d’équipe");
    if (has(".team-adapted-mark"))
      add("adapted", "⏱", "Horaire adapté");
    if (has(".team-part-mark"))
      add("part-time", "◐", "Temps partiel");
    if (textContent.includes("🎓"))
      add("training", "🎓", "Formation");
    if (textContent.includes("👶"))
      add("trainee", "👶", "Stagiaire");

    list.innerHTML =
      items.join("") ||
      teamLegendItem("empty", "○", "Aucun repère affiché");
  }

  function schedulePageLegend() {
    cancelAnimationFrame(schedulePageLegend.frame || 0);
    schedulePageLegend.frame = requestAnimationFrame(renderPageLegend);
  }

  function renderHeader() {
    normalizeDayFocus();
    if (!state.dateJumpMonth)
      state.dateJumpMonth = monthKey(state.dayFocus || state.weekStart);
    renderWeekStrip();
    renderDateJumpCalendar(state.dateJumpMonth);
    renderMonthDigest(state.dateJumpMonth);
  }

  function dayContainer(day, summary, body, kind) {
    const today = day === todayIso();
    return `<article id="team-day-${day}" class="team-day stip-time-surface ${today ? "is-today" : ""}" data-day-kind="${kind}"><header><div><span>${today ? "AUJOURD’HUI" : shortDay(day)}</span><h2>${esc(dayTitle(day))}</h2></div><strong>${esc(summary)}</strong></header><div class="team-day-body">${body}</div></article>`;
  }

  function staffingRows(staff) {
    const rows = staff?.rows || staff?.shifts || [];
    return Array.isArray(rows) ? rows.filter(Boolean) : [];
  }

  function staffingRowGap(row) {
    if (row?.gap != null && Number.isFinite(Number(row.gap)))
      return Number(row.gap);
    const planned = Number(row?.planned_count);
    const target = Number(row?.target_count);
    return Number.isFinite(planned) && Number.isFinite(target)
      ? planned - target
      : 0;
  }

  function shiftSignalForDate(day, code) {
    const staff = state.staffingByDate.get(day);
    const base = baseShift(code);
    const shared = field()?.shiftStatus?.(staff, base);
    if (shared)
      return {
        ...shared,
        label:
          shared.level === "critical"
            ? "Équipe très légère"
            : shared.level === "warning"
              ? "Équipe plus légère"
              : shared.level === "opportunity"
                ? "Présence plus large"
                : shared.level === "ok"
                  ? "Présence habituelle"
                  : "Pas encore analysé",
      };
    if (!staff || staff?.available === false)
      return { level: "unknown", symbol: "○", label: "Pas encore analysé" };

    const row = staffingRows(staff).find(
      (item) => baseShift(item?.shift_code || item?.shift || item?.code) === base,
    );
    if (!row)
      return { level: "unknown", symbol: "○", label: "Pas encore analysé" };

    const severity = Number(row?.severity || 0);
    const gap = staffingRowGap(row);
    if (severity >= 4)
      return { level: "critical", symbol: "🛑", label: "Équipe très légère" };
    if (gap < 0 || severity >= 2)
      return { level: "warning", symbol: "⚠️", label: "Équipe plus légère" };
    if (gap > 0)
      return { level: "opportunity", symbol: "+", label: "Présence plus large" };
    return { level: "ok", symbol: "✔", label: "Présence habituelle" };
  }

  function isChefItem(item) {
    const agent = item?.agents || {};
    return (
      String(item?.equipe || "").toLowerCase() === "chefs" ||
      String(agent.type_planning || "").toLowerCase() === "chefs" ||
      /chef/i.test(String(agent.role || ""))
    );
  }

  function agentRow(item) {
    const agent = item.agents || {};
    const phone = phoneDigits(agent.telephone);
    const ghe = String(agent.ghe || "").replace(/^GHE\s*/i, "");
    const key = String(agent.source_key || "");
    const isChef = isChefItem(item);
    const quotite = Number(agent.quotite);
    const partTime = Number.isInteger(quotite) && quotite >= 1 && quotite < 100;
    return `<div class="team-agent ${isChef ? "is-chef" : ""}">
      <button class="team-agent-main" type="button" data-team-agent="${esc(key)}" ${key ? "" : "disabled"}>
        <span class="team-agent-ghe">GHE ${esc(ghe || "—")}</span>
        <span><strong>${esc(displayName(agent))}${isChef ? '<em class="team-chef-mark">🎨 Chef</em>' : ""}${adaptedShift(item.code) ? '<em class="team-adapted-mark" title="Horaire adapté">⏱</em>' : ""}${partTime ? `<em class="team-part-mark" title="Temps partiel">◐ ${quotite}%</em>` : ""}</strong><small>${esc(isChef ? "Chef d’équipe" : agent.role || "Brancardier")}</small></span>
        <i aria-hidden="true">›</i>
      </button>
      ${phone ? `<button class="team-agent-call" type="button" data-team-call="${esc(phone)}" data-team-call-name="${esc(displayName(agent))}" aria-label="Choisir comment appeler ${esc(displayName(agent))}">☎</button>` : ""}
    </div>`;
  }


  function closeShiftAnalysis() {
    document.getElementById("teamShiftAnalysisOverlay")?.remove();
  }

  function shiftStaffingRow(day, base) {
    return staffingRows(state.staffingByDate.get(day)).find(
      (item) =>
        baseShift(item?.shift_code || item?.shift || item?.code) === base,
    );
  }

  function shiftPlanningRows(day, base) {
    const bundle = cacheEntry(monday(day));
    return (bundle?.team?.planning || []).filter(
      (item) => item.date === day && baseShift(item.code) === base,
    );
  }

  function dayContextRows(day, base) {
    const bundle = cacheEntry(monday(day)),
      activity = bundle?.activity?.get(day) || {},
      rows = [];

    for (const item of activity.alerts || []) {
      rows.push({
        icon: Number(item?.severity || 0) >= 4 ? "🛑" : "⚠️",
        title: item?.title || "Alerte",
        detail: item?.body || item?.note || "",
        type: "Alerte",
      });
    }
    for (const item of activity.events?.formations || []) {
      rows.push({
        icon: "🎓",
        title: item?.title || "Formation",
        detail: [item?.horaire, item?.lieu].filter(Boolean).join(" · "),
        type: "Formation",
      });
    }
    for (const item of activity.events?.stagiaires || []) {
      rows.push({
        icon: "👶",
        title: item?.name || "Stagiaire",
        detail: [
          item?.horaires,
          item?.referent ? `Référent : ${item.referent}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        type: "Stagiaire",
      });
    }

    for (const item of assistantItemsForDate(bundle, day)) {
      const contextShift = baseShift(
        item?.context?.shift_code ||
          item?.context?.shift ||
          item?.context?.code ||
          "",
      );
      if (contextShift && contextShift !== base) continue;
      const family = String(item?.source_family || "");
      if (["staffing", "compound"].includes(family) && !contextShift) continue;
      const terrain = field()?.terrainItem?.(item),
        level =
          terrain?.level ||
          (Number(item?.severity || 0) >= 4
            ? "critical"
            : Number(item?.severity || 0) >= 2
              ? "warning"
              : item?.kind === "opportunity"
                ? "opportunity"
                : "info");
      rows.push({
        icon:
          item?.source_family === "formation"
            ? "🎓"
            : item?.source_family === "trainee"
              ? "👶"
              : statusSymbol(level, ""),
        title: terrain?.headline || item?.title || "Information",
        detail: [
          terrain?.detail || item?.body || "",
          terrain?.proposal || item?.recommendation_text || item?.proposal || "",
        ]
          .filter(Boolean)
          .filter((value, index, list) => list.indexOf(value) === index)
          .join(" "),
        type:
          item?.source_family === "formation"
            ? "Formation"
            : item?.source_family === "trainee"
              ? "Stagiaire"
              : "Analyse",
      });
    }

    const seen = new Set();
    return rows.filter((row) => {
      const key = [row.type, row.title, row.detail].join("|").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function openShiftAnalysis(day, code) {
    const base = baseShift(code);
    if (!base) return;
    const signal = shiftSignalForDate(day, base) || {
        level: "unknown",
        label: "Pas encore analysé",
        symbol: "○",
      },
      meta = shiftMeta(base) || { label: base, time: "" },
      planRows = shiftPlanningRows(day, base),
      present = planRows.length,
      specialAgents = planRows.filter((item) => {
        const q = Number(item?.agents?.quotite);
        return adaptedShift(item?.code) || (Number.isInteger(q) && q < 100);
      }),
      contextRows = dayContextRows(day, base),
      visibleContext = contextRows.slice(0, 10),
      hiddenContext = Math.max(0, contextRows.length - visibleContext.length),
      analysisText =
        signal.level === "critical"
          ? "La présence est nettement plus légère sur ce créneau. Le rythme peut être plus soutenu."
          : signal.level === "warning"
            ? "La présence est un peu plus légère sur ce créneau. Le rythme peut être plus soutenu."
            : signal.level === "opportunity"
              ? "Davantage de collègues sont prévus sur ce créneau si le planning reste inchangé."
              : signal.level === "ok"
                ? "La présence prévue est habituelle sur ce créneau."
                : "Pas assez de données pour donner un repère fiable sur ce créneau.",
      symbol = statusSymbol(signal.level, signal.symbol);

    const stats =
      '<div class="team-shift-analysis-stats">' +
      '<span><small>PRÉSENTS</small><b>' +
      esc(present) +
      "</b></span>" +
      '<span><small>REPÈRE</small><b>' +
      esc(symbol) +
      "</b></span>" +
      '<span><small>À REPÉRER</small><b>' +
      esc(specialAgents.length) +
      "</b></span>" +
      "</div>";

    const special =
      specialAgents.length
        ? '<section class="team-shift-analysis-block"><strong>Agents à repérer</strong><div class="team-shift-analysis-tags">' +
          specialAgents
            .map((item) => {
              const agent = item?.agents || {},
                q = Number(agent.quotite),
                bits = [
                  String(item?.code || "").toUpperCase(),
                  adaptedShift(item?.code) ? "horaire spécifique" : "",
                  Number.isInteger(q) && q < 100 ? `${q}%` : "",
                ].filter(Boolean);
              return '<span><b>' +
                esc(displayName(agent)) +
                "</b><small>" +
                esc(bits.join(" · ")) +
                "</small></span>";
            })
            .join("") +
          "</div></section>"
        : "";

    const context =
      visibleContext.length
        ? '<section class="team-shift-analysis-block"><strong>Contexte de la journée</strong><div class="team-shift-context-list">' +
          visibleContext
            .map(
              (row) =>
                '<div><span aria-hidden="true">' +
                esc(row.icon || "•") +
                "</span><p><b>" +
                esc(row.title) +
                "</b>" +
                (row.detail ? "<small>" + esc(row.detail) + "</small>" : "") +
                "</p></div>",
            )
            .join("") +
          (hiddenContext
            ? '<p class="team-shift-context-more">+' +
              hiddenContext +
              " autre" +
              (hiddenContext > 1 ? "s" : "") +
              " point" +
              (hiddenContext > 1 ? "s" : "") +
              "</p>"
            : "") +
          "</div></section>"
        : "";

    closeShiftAnalysis();
    const overlay = document.createElement("div");
    overlay.id = "teamShiftAnalysisOverlay";
    overlay.className = "team-shift-analysis-overlay";
    overlay.innerHTML =
      '<button class="team-shift-analysis-backdrop" type="button" aria-label="Fermer"></button>' +
      '<section class="team-shift-analysis-sheet status-' +
      esc(signal.level || "unknown") +
      '" role="dialog" aria-modal="true" aria-label="Détail ' +
      esc(meta.label || base) +
      '">' +
      '<div class="team-shift-analysis-handle" aria-hidden="true"></div>' +
      '<header><span class="team-shift-analysis-symbol" aria-hidden="true">' +
      esc(symbol) +
      "</span><div><small>" +
      esc(base) +
      " · " +
      esc(meta.time || "") +
      "</small><strong>" +
      esc(signal.label || "À regarder") +
      "</strong></div></header>" +
      stats +
      '<section class="team-shift-analysis-block"><strong>Lecture STIP</strong><p>' +
      esc(analysisText) +
      "</p></section>" +
      (signal.proposal
        ? '<div class="team-shift-analysis-proposal"><strong>Ce que STIP conseille</strong><p>' +
          esc(signal.proposal) +
          "</p></div>"
        : "") +
      special +
      context +
      '<button class="team-shift-analysis-close" type="button">Fermer</button>' +
      "</section>";
    document.body.appendChild(overlay);
    overlay
      .querySelector(".team-shift-analysis-backdrop")
      ?.addEventListener("click", closeShiftAnalysis);
    overlay
      .querySelector(".team-shift-analysis-close")
      ?.addEventListener("click", closeShiftAnalysis);
  }

  function shiftBlock(day, code, items) {
    const base = baseShift(code);
    const meta = shiftMeta(base);
    if (!meta || !items.length) return "";
    const sortedItems = items.slice().sort(compareAgentGhe);
    // Les chefs sont déjà présentés dans MAINTENANT / AUJOURD'HUI.
    // On les conserve dans les données et le total du shift, mais on ne les répète pas dans la liste dépliée.
    const team = sortedItems.filter((item) => !isChefItem(item));
    const key = `${day}|${code}`;
    const open = state.openShifts.get(day) === key;
    const signal = shiftSignalForDate(day, base);
    const group = (rows, label, className) =>
      rows.length
        ? `<section class="team-agent-group ${className}"><div class="team-agent-group-label">${esc(label)}</div>${rows.map(agentRow).join("")}</section>`
        : "";
    return `<div class="team-shift-row">
      <button class="team-shift-analysis-trigger status-${esc(signal.level)}" type="button" data-team-shift-analysis="${esc(day)}|${esc(base)}" title="${esc(signal.label)}" aria-label="Ouvrir l’analyse ${esc(meta.label)} · ${esc(signal.label)}">
        <span aria-hidden="true">${esc(statusSymbol(signal.level, signal.symbol))}</span>
      </button>
      <section class="team-shift shift-${base.toLowerCase()} ${open ? "open" : ""}">
        <button class="team-shift-head" type="button" data-team-shift="${esc(key)}" aria-expanded="${open}">
          <b>${esc(code)}</b>
          <span><strong>${esc(meta.label)}</strong><small>${esc(meta.time)}</small></span>
          <em>${sortedItems.length}</em>
          <i aria-hidden="true">⌄</i>
        </button>
        <div class="team-shift-agents" ${open ? "" : "hidden"}>${group(team, "ÉQUIPE", "is-team")}</div>
      </section>
    </div>`;
  }

  function dayAssistantLevel(item) {
    const terrain = field()?.terrainItem?.(item);
    const severity = Number(item?.severity || 0);
    return (
      terrain?.level ||
      (severity >= 4
        ? "critical"
        : severity >= 2
          ? "warning"
          : item?.kind === "opportunity"
            ? "opportunity"
            : "info")
    );
  }

  function mergedDayRows(bundle, day) {
    const activity = bundle?.activity?.get?.(day) || {},
      rows = [],
      add = (row) => {
        const title = String(row?.title || "").trim();
        const detail = String(row?.detail || "").trim();
        if (!title && !detail) return;
        const key = [row.type || "", title, detail].join("|").toLowerCase();
        if (rows.some((item) => item.key === key)) return;
        rows.push({ ...row, key });
      };

    for (const item of activity.alerts || []) {
      const severity = Number(item?.severity || 0);
      add({
        type: "Alerte",
        level: severity >= 4 ? "critical" : "warning",
        icon: severity >= 4 ? "🛑" : "⚠️",
        title: item?.title || "Alerte",
        detail: item?.body || item?.note || item?.description || "",
      });
    }
    for (const item of activity.events?.formations || []) {
      add({
        type: "Formation",
        level: "info",
        icon: "🎓",
        title: item?.title || "Formation",
        detail: [item?.horaire, item?.lieu].filter(Boolean).join(" · "),
      });
    }
    for (const item of activity.events?.stagiaires || []) {
      add({
        type: "Stagiaire",
        level: "info",
        icon: "👶",
        title: item?.name || item?.title || "Stagiaire",
        detail: [
          item?.horaires,
          item?.referent ? `Référent : ${item.referent}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    for (const item of assistantItemsForDate(bundle, day)) {
      const family = String(item?.source_family || ""),
        contextShift = baseShift(
          item?.context?.shift_code ||
            item?.context?.shift ||
            item?.context?.code ||
            "",
        );
      // Internal staffing/compound wording belongs to the Responsable page.
      // Esprit d'équipe keeps only an agent-facing translation of the situation.
      if (["staffing", "compound"].includes(family) || contextShift) continue;

      const terrain = field()?.terrainItem?.(item),
        level = dayAssistantLevel(item),
        detail = [
          terrain?.detail || item?.body || "",
          terrain?.proposal || item?.recommendation_text || item?.proposal || "",
        ]
          .filter(Boolean)
          .filter((value, index, list) => list.indexOf(value) === index)
          .join(" ");
      add({
        type:
          family === "formation"
            ? "Formation"
            : family === "trainee"
              ? "Stagiaire"
              : "Analyse",
        level,
        icon:
          family === "formation"
            ? "🎓"
            : family === "trainee"
              ? "👶"
              : statusSymbol(level, "•"),
        title: terrain?.headline || item?.title || "Information",
        detail,
      });
    }
    const staffingGaps = staffingRows(state.staffingByDate.get(day))
      .map((row) => ({
        code: baseShift(row?.shift_code || row?.shift || row?.code),
        gap: staffingRowGap(row),
      }))
      .filter((row) => row.code && row.gap !== 0);
    const lighter = staffingGaps.filter((row) => row.gap < 0);
    const wider = staffingGaps.filter((row) => row.gap > 0);

    if (lighter.length) {
      const shifts = lighter.slice(0, 2).map((row) => row.code).join(" · ");
      add({
        type: "Effectif",
        level:
          Math.min(...lighter.map((row) => row.gap)) <= -2
            ? "critical"
            : "warning",
        icon: "⚠️",
        title: `Équipe plus légère${shifts ? ` sur ${shifts}` : ""}`,
        detail: "Le rythme peut être plus soutenu sur ce créneau.",
      });
    } else if (wider.length) {
      const shifts = wider.slice(0, 2).map((row) => row.code).join(" · ");
      add({
        type: "Effectif",
        level: "opportunity",
        icon: "+",
        title: `Présence plus large${shifts ? ` sur ${shifts}` : ""}`,
        detail: "Davantage de collègues sont prévus sur ce créneau.",
      });
    }

    return rows;
  }

  function dayAdvice(bundle, day) {
    const staff = state.staffingByDate.get(day),
      deficits = staffingRows(staff)
        .map((row) => ({
          code: baseShift(row?.shift_code || row?.shift || row?.code),
          gap: staffingRowGap(row),
        }))
        .filter((row) => row.code && row.gap < 0)
        .sort((a, b) => a.gap - b.gap);

    if (!deficits.length) return null;
    const shifts = deficits.slice(0, 2).map((row) => row.code).join(" · ");
    return {
      text: `Si la charge devient difficile à absorber${shifts ? ` sur ${shifts}` : ""}, signale le point au chef d’équipe présent : son bouton d’appel est disponible plus haut.`,
      strength: "moderate",
    };
  }

  function teamDaySummary(bundle, day) {
    const rows = mergedDayRows(bundle, day),
      advice = dayAdvice(bundle, day);
    if (!rows.length && !advice) return "";

    const signal = signalForDate(day) || {
        level: "info",
        symbol: "•",
        label: "Informations du jour",
      },
      level = signal.level === "unknown" ? "info" : signal.level,
      checklist = rows.length
        ? `<div class="team-day-checklist">${rows
            .map(
              (row) =>
                `<div class="team-day-check status-${esc(row.level || "info")}"><span aria-hidden="true">${esc(row.icon || "•")}</span><div><strong>${esc(row.title)}</strong>${row.detail ? `<p>${esc(row.detail)}</p>` : ""}</div></div>`,
            )
            .join("")}</div>`
        : "";

    return `<section class="team-day-summary status-${esc(level)}">
      <header><span aria-hidden="true">${esc(statusSymbol(level, signal.symbol))}</span><div><small>REPÈRES DU JOUR</small><strong>À retenir aujourd’hui</strong></div></header>
      ${checklist}
      ${advice ? `<div class="team-day-advice strength-${esc(advice.strength)}"><strong>Si besoin</strong><p>${esc(advice.text)}</p></div>` : ""}
    </section>`;
  }

  function weekControlsMarkup() {
    const engine=window.STIPWeekEngine,model=teamWeekDisplay(),days=model.dates||[],
      range=engine?.rangeLabel?.(days)||weekRange(state.weekStart),
      label=engine?.separatorLabel?.(teamWeekState(),{today:todayIso()})||"CETTE SEMAINE";
    return `<section id="teamWeekControls" class="team-week-inline-block team-time-stack stip-time-stack" aria-label="${esc(label)}">
      <div class="team-week-section-label stip-section-separator" aria-hidden="true">
        <span>${esc(label)}</span>
      </div>
      <div class="stip-week-master-nav" role="group" aria-label="Navigation par semaine">
        <button class="team-week-step" type="button" data-team-week-step="-1" aria-label="Période précédente">‹</button>
        <strong>${esc(range)}</strong>
        <button class="team-week-step" type="button" data-team-week-step="1" aria-label="Période suivante">›</button>
      </div>
      <nav id="teamDays" class="stip-week-line" style="--stip-week-columns:${model.slotCount||days.length||1}" aria-label="Jours de la période"></nav>
    </section>`;
  }

  function teamDay(bundle, day) {
    const items = (bundle?.team?.planning || []).filter(
      (item) => item.date === day,
    );
    const groups = new Map();
    items.forEach((item) => {
      const original = String(item.code || "").toUpperCase(),
        base = baseShift(original);
      if (!base) return;
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base).push(item);
    });
    const order = new Map(
      workShiftDefinitions().map((row, index) => [
        String(row.code || "").toUpperCase(),
        index,
      ]),
    );
    const ordered = [...groups.entries()].sort(
      ([a], [b]) => (order.get(baseShift(a)) ?? 999) - (order.get(baseShift(b)) ?? 999),
    );
    const shifts = ordered.map(([code, rows]) => shiftBlock(day, code, rows)).join("");
    const staffing =
        shifts || '<p class="team-empty-inline">Aucun agent planifié.</p>',
      selectedDayLabel = day === todayIso() ? "AUJOURD’HUI" : "JOUR SÉLECTIONNÉ",
      daySeparator = `<div class="team-selected-day-separator stip-section-separator" aria-hidden="true"><span>${selectedDayLabel}</span></div>`,
      body = weekControlsMarkup() + daySeparator + staffing + teamDaySummary(bundle, day);
    return dayContainer(
      day,
      `${items.length} présent${items.length > 1 ? "s" : ""}`,
      body,
      "team",
    );
  }

  function syncShiftPanels() {
    $("#teamContent")
      ?.querySelectorAll("[data-team-shift]")
      .forEach((button) => {
        const key = button.dataset.teamShift || "";
        const day = key.split("|")[0] || state.dayFocus;
        const active = state.openShifts.get(day) === key;
        button.setAttribute("aria-expanded", String(active));
        const section = button.closest(".team-shift");
        section?.classList.toggle("open", active);
        const agents = section?.querySelector(".team-shift-agents");
        if (agents) agents.hidden = !active;
      });
  }

  function closeCallSheet() {
    document.getElementById("teamCallOverlay")?.remove();
  }

  function openCallSheet(phone, person) {
    const normal = phoneHref(phone);
    const hidden = hiddenPhoneHref(phone);
    if (!normal || !hidden) return;
    closeCallSheet();
    const overlay = document.createElement("div");
    overlay.id = "teamCallOverlay";
    overlay.className = "team-call-overlay";
    overlay.innerHTML = `
      <button class="team-call-backdrop" type="button" aria-label="Fermer"></button>
      <section class="team-call-sheet" role="dialog" aria-modal="true" aria-label="Choisir le type d’appel">
        <div class="team-call-handle" aria-hidden="true"></div>
        <small>APPELER</small>
        <strong>${esc(person || "Agent")}</strong>
        <div class="team-call-actions">
          <a class="primary" href="${esc(normal)}"><span aria-hidden="true">☎</span><b>Appeler</b></a>
          <a href="${esc(hidden)}"><span aria-hidden="true">◉</span><b>Appeler en inconnu</b></a>
        </div>
        <button class="team-call-cancel" type="button">Annuler</button>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".team-call-backdrop")?.addEventListener("click", closeCallSheet);
    overlay.querySelector(".team-call-cancel")?.addEventListener("click", closeCallSheet);
    overlay.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => setTimeout(closeCallSheet, 250)),
    );
  }

  function closeAgentSheet() {
    window.STIPAgentAgenda?.close?.();
    document.getElementById("teamAgentOverlay")?.remove();
    document.body.classList.remove("team-sheet-open");
  }

  function formatAgentDate(value) {
    return dateObj(value).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  async function openAgentSheet(sourceKey) {
    if (!sourceKey) return;
    const planning = cacheEntry(state.weekStart)?.team?.planning || [];
    const fallback =
      planning.find((item) => item.agents?.source_key === sourceKey)?.agents || {};
    if (window.STIPAgentAgenda?.open)
      return window.STIPAgentAgenda.open(sourceKey, fallback);
    $("#teamError").textContent =
      "Le nouvel agenda agent n’est pas encore chargé. Recharge la page.";
  }

  function renderContent(bundle) {
    const host = $("#teamContent");
    normalizeDayFocus();
    const day = state.dayFocus;
    if (!allowed("planning_team")) {
      host.innerHTML =
        '<div class="team-empty">Le planning équipe n’est pas inclus dans votre accès.</div>';
    } else {
      host.innerHTML = teamDay(bundle, day);
    }
    host.setAttribute("aria-busy", "false");
    state.rendered = true;
    renderWeekStrip();
  }

  function setBusy(message = "Actualisation de la semaine…") {
    $("#teamContent").setAttribute("aria-busy", "true");
    $("#teamContent").classList.add("is-refreshing");
    $("#teamError").textContent = message;
  }

  function clearBusy() {
    $("#teamContent").classList.remove("is-refreshing");
    $("#teamError").textContent = "";
  }

  async function showWeek({ force = false, preserve = state.rendered } = {}) {
    const request = ++state.request;
    renderHeader();
    if (preserve) setBusy();
    try {
      const bundle = await loadCore(state.weekStart, force);
      if (request !== state.request) return;

      window.STIPDutyChiefs?.hydrateFromPlanning?.(
        bundle?.team?.planning || [],
        todayIso(),
      );
      renderContent(bundle);

      const activityPromise = allowed("activity")
        ? loadActivity(state.weekStart, force).catch(() => null)
        : Promise.resolve(null);

      activityPromise.then(() => {
        if (request === state.request) renderContent(bundle);
      });

      const runSignals = () => {
        if (request !== state.request) return;
        loadWeekSignals(state.weekStart, bundle, force)
          .then(() => {
            if (request === state.request) renderContent(bundle);
          })
          .catch(() => {})
          .finally(() => {
            const runMonthSignals = () => {
              if (request !== state.request) return;
              loadMonthSignals(state.dateJumpMonth, force).catch(() => {});
            };
            if ("requestIdleCallback" in window)
              requestIdleCallback(runMonthSignals, { timeout: 2200 });
            else setTimeout(runMonthSignals, 1200);
          });
      };
      if ("requestIdleCallback" in window)
        requestIdleCallback(runSignals, { timeout: 700 });
      else setTimeout(runSignals, 140);

      clearBusy();
      if (!force) prefetchAdjacentWeeks();
    } catch (error) {
      clearBusy();
      $("#teamError").textContent = error.message || String(error);
      if (!state.rendered)
        $("#teamContent").innerHTML =
          '<div class="team-empty">Impossible de charger cette semaine.</div>';
    }
  }

  function prefetchAdjacentWeeks() {
    const run = () => {
      loadCore(addDays(state.weekStart, -7)).catch(() => {});
      loadCore(addDays(state.weekStart, 7)).catch(() => {});
    };
    if ("requestIdleCallback" in window)
      requestIdleCallback(run, { timeout: 1800 });
    else setTimeout(run, 500);
  }

  function moveWeek(offset) {
    const engine=window.STIPWeekEngine,step=Math.sign(Number(offset)||0),
      current=teamWeekState(),
      next=engine?.move?.(current,step,{today:todayIso()});
    if(next){
      state.weekPast=Boolean(next.weekPast);
      state.weekFull=Boolean(next.weekFull);
      state.dayFocus=next.dayFocus||"";
      const dates=engine.visibleDates(next,{today:todayIso()});
      state.weekStart=monday(dates[0]||todayIso());
      state.dateJumpMonth=monthKey(dates[0]||todayIso());
    }else{
      state.weekStart = addDays(state.weekStart, step * 7);
      state.weekPast=false;
      state.weekFull=true;
      state.dayFocus = "";
      state.dateJumpMonth = monthKey(state.weekStart);
    }
    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
      scrollY: 0,
    });
    showWeek({ preserve: true });
  }

  $("#teamMonthDigestHost")?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-team-month-day]");
    if (!day) return;
    chooseDate(day.dataset.teamMonthDay);
    document.querySelector("#teamContent")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
  $("#teamDateJumpPanel").addEventListener("click", (event) => {
    const step = event.target.closest("[data-team-cal-step]"),
      day = event.target.closest("[data-team-cal-day]");
    if (step) {
      const nextMonth = shiftMonthKey(
        $("#teamDateJumpPanel").dataset.calendarMonth,
        step.dataset.teamCalStep,
      );
      const now = todayIso();
      const target = now.startsWith(nextMonth)
        ? now
        : firstMondayOfMonth(nextMonth);
      state.dateJumpMonth = nextMonth;
      return chooseDate(target);
    }
    if (day) return chooseDate(day.dataset.teamCalDay);
  });
  $("#teamStandaloneBack")?.addEventListener("click", () => {
    if (EMBEDDED && window.parent !== window) {
      try {
        window.parent.STIPRouter?.set?.("home");
        return;
      } catch {}
    }
    location.assign("index.html#/home");
  });
  $("#teamRefresh").addEventListener("click", () =>
    showWeek({ force: true, preserve: true }),
  );
  $("#teamSubscribe")?.addEventListener("click", () =>
    window.STIPCalendars?.quick?.("team"),
  );
  $("#teamContent").addEventListener("click", (event) => {
    const weekStep = event.target.closest("[data-team-week-step]");
    if (weekStep) {
      moveWeek(Number(weekStep.dataset.teamWeekStep || 0));
      return;
    }
    const weekDay = event.target.closest("[data-team-day]");
    if (weekDay) {
      chooseDate(weekDay.dataset.teamDay);
      return;
    }
    const analysis = event.target.closest("[data-team-shift-analysis]");
    if (analysis) {
      event.preventDefault();
      event.stopPropagation();
      const [day, code] = String(analysis.dataset.teamShiftAnalysis || "").split("|");
      openShiftAnalysis(day || state.dayFocus, code || "");
      return;
    }
    const shift = event.target.closest("[data-team-shift]");
    if (shift) {
      const key = shift.dataset.teamShift || "";
      const day = key.split("|")[0] || state.dayFocus;
      const beforeTop = shift.getBoundingClientRect().top;
      if (state.openShifts.get(day) === key) state.openShifts.delete(day);
      else state.openShifts.set(day, key);
      syncShiftPanels();
      requestAnimationFrame(() => {
        const afterTop = shift.getBoundingClientRect().top;
        const delta = afterTop - beforeTop;
        if (Math.abs(delta) > 1) window.scrollTo(0, window.scrollY + delta);
        shift.blur?.();
      });
      return;
    }
    const call = event.target.closest("[data-team-call]");
    if (call) {
      openCallSheet(call.dataset.teamCall, call.dataset.teamCallName);
      return;
    }
    const agent = event.target.closest("[data-team-agent]");
    if (agent) openAgentSheet(agent.dataset.teamAgent);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAgentSheet();
      closeCallSheet();
      closeShiftAnalysis();
    }
  });

  function observePageLegendSources() {
    const observer = new MutationObserver(schedulePageLegend);
    [
      $("#teamContent"),
      $("#teamDateJumpPanel"),
      $("#teamMonthDigestHost"),
      $("#teamDutyChiefTodayHost"),
    ]
      .filter(Boolean)
      .forEach((root) =>
        observer.observe(root, { childList: true, subtree: true, characterData: true }),
      );
    schedulePageLegend();
  }

  async function boot() {
    observePageLegendSources();
    if (!token()) return location.replace("index.html");
    try {
      state.access = await post("stip-access", { action: "me" });
      state.weekStart = monday(todayIso());
      state.weekPast = false;
      state.weekFull = false;
      state.dayFocus = todayIso();
      state.dateJumpMonth = monthKey(todayIso());
      const teamSubscribe = $("#teamSubscribe");
      const canSubscribe =
        allowed("planning_team") && allowed("calendar_subscribe");
      if (teamSubscribe) {
        teamSubscribe.hidden = !canSubscribe;
        const pocket = teamSubscribe.closest(".stip-option-pocket");
        if (pocket) pocket.hidden = !canSubscribe;
      }
      if (!allowed("planning_team"))
        return location.replace("index.html");
      state.tab = "team";
      renderHeader();
      await showWeek({ preserve: false });
      window.STIPNav?.restoreScroll?.();
    } catch (error) {
      $("#teamError").textContent = error.message || String(error);
      $("#teamContent").innerHTML =
        '<div class="team-empty">Impossible de charger Esprit d’équipe.</div>';
    }
  }

  window.STIPNav?.register?.({
    capture: () => ({
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
    }),
  });
  boot();
})();
