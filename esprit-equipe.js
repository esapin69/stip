(() => {
  "use strict";

  const ROOT = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/";
  const STORE = "stip_session_v1";
  const CACHE_TTL = 5 * 60 * 1000;
  const SHIFT_ORDER = ["M", "J", "J4", "S", "N"];
  const SHIFT = {
    M: { label: "Matin", time: "06h50 – 14h40" },
    J: { label: "Journée", time: "08h30 – 16h20" },
    J4: { label: "J4", time: "10h10 – 18h00" },
    S: { label: "Soir", time: "13h30 – 21h00" },
    N: { label: "Nuit", time: "21h00 – 06h50" },
  };
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
    cached.signalPromise = Promise.allSettled(
      days.map((date) => post("stip-staffing", { action: "day", date })),
    ).then((rows) => {
      rows.forEach((result, index) => {
        const date = days[index],
          staff = result.status === "fulfilled" ? result.value : null,
          items = assistantItemsForDate(bundle, date),
          status = signalStatus(staff, items);
        state.staffingByDate.set(date, staff);
        state.daySignals.set(date, status);
      });
      cached.signalLoaded = true;
      cached.signalFetchedAt = Date.now();
      cached.signalPromise = null;
      if (start === state.weekStart) {
        renderHeader();
        if (state.rendered) renderContent(cached);
      }
    }).catch(() => {
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
        { length: Math.min(6, Math.max(1, targetDays.length)) },
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
              `${row.code} ${row.gap > 0 ? "+" : ""}${row.gap}`,
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
          label: signal.label || "À regarder",
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
        signal = signalForDate(value),
        cls = [
          value === today ? "is-today" : "",
          value >= state.weekStart && value <= weekEnd ? "is-week" : "",
          value === state.dayFocus ? "is-selected" : "",
          signal?.level ? `status-${signal.level}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        marker =
          signal?.level && signal.level !== "unknown"
            ? `<span class="team-cal-status status-${esc(signal.level)}" aria-hidden="true">${esc(statusSymbol(signal.level, signal.symbol))}</span>`
            : '<span class="team-cal-marker-empty" aria-hidden="true"></span>',
        aria = [dayTitle(value), signal?.label || ""].filter(Boolean).join(", ");
      cells.push(
        `<button type="button" class="${cls}" data-team-cal-day="${value}" aria-label="${esc(aria)}"><b class="team-cal-day-number">${day}</b><span class="team-cal-marker">${marker}</span><small class="team-cal-events"></small></button>`,
      );
    }
    state.dateJumpMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    panel.dataset.calendarMonth = state.dateJumpMonth;
    panel.innerHTML =
      `<div class="team-date-jump-head"><button type="button" data-team-cal-step="-1" aria-label="Mois précédent">‹</button><strong>${esc(
        first
          .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          .replace(/^./, (char) => char.toUpperCase()),
      )}</strong><button type="button" data-team-cal-step="1" aria-label="Mois suivant">›</button></div>` +
      '<div class="team-date-jump-weekdays"><span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span><span>Sa</span><span>Di</span></div>' +
      `<div class="team-date-jump-grid">${cells.join("")}</div>`;
  }

  function chooseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return;
    state.weekStart = monday(value);
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

  function baseShift(value) {
    const code = String(value || "").trim().toUpperCase().replace(/\*/g, "");
    if (SHIFT[code]) return code;
    if (code === "J0464" || /^J\d+$/.test(code)) return "J";
    if (/^J4\d+$/.test(code)) return "J4";
    if (/^M\d+$/.test(code)) return "M";
    if (/^S\d+$/.test(code)) return "S";
    if (/^N\d+$/.test(code)) return "N";
    return "";
  }

  function adaptedShift(value) {
    const raw = String(value || "").trim().toUpperCase().replace(/\*/g, "");
    const base = baseShift(raw);
    return Boolean(base && raw !== base);
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
    cached.activityPromise = Promise.allSettled(
      days.map((date) => post("stip-cadre", { action: "dashboard", date })),
    ).then((results) => {
      cached.activity = new Map();
      results.forEach((result, index) => {
        if (result.status === "fulfilled")
          cached.activity.set(days[index], result.value?.day || {});
      });
      cached.activityPromise = null;
      cached.activityError = results.find(
        (result) => result.status === "rejected",
      )?.reason;
      return cached;
    });
    return cached.activityPromise;
  }

  function normalizeDayFocus() {
    const days = daysOfWeek();
    const today = todayIso();
    if (!days.includes(state.dayFocus))
      state.dayFocus = days.includes(today) ? today : days[0];
  }

  function renderWeekStrip() {
    const host = $("#teamDays");
    if (!host) return;
    const today = todayIso();
    host.innerHTML = daysOfWeek(state.weekStart)
      .map((day) => {
        const d = dateObj(day);
        const signal = signalForDate(day) || {
          level: "unknown",
          symbol: "",
          label: "Pas encore analysé",
        };
        const cls = [
          day === state.dayFocus ? "selected" : "",
          day === today ? "today" : "",
          signal.level ? `status-${signal.level}` : "",
        ].filter(Boolean).join(" ");
        const weekday = d
          .toLocaleDateString("fr-FR", { weekday: "short" })
          .replace(".", "")
          .toUpperCase();
        const symbol = statusSymbol(signal.level, signal.symbol);
        const marker =
          signal.level && signal.level !== "unknown"
            ? `<span class="team-day-intel status-${esc(signal.level)}" aria-hidden="true">${esc(symbol)}</span>`
            : '<span class="team-day-intel status-unknown" aria-hidden="true">○</span>';
        return `<button type="button" class="${cls}" data-team-day="${day}" aria-label="${esc(dayTitle(day))}, ${esc(signal.label || "")}"><small>${esc(weekday)}</small><b>${d.getDate()}</b>${marker}</button>`;
      })
      .join("");
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
    if (shared) return shared;
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
      return { level: "critical", symbol: "🛑", label: "Ça coince" };
    if (gap < 0 || severity >= 2)
      return { level: "warning", symbol: "⚠️", label: "À surveiller" };
    return { level: "ok", symbol: "✔", label: "Rien ne coince" };
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
      if (
        ["staffing", "compound"].includes(String(item?.source_family || "")) &&
        !["formation", "trainee"].includes(String(item?.source_family || ""))
      )
        continue;
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
        detail:
          terrain?.detail ||
          item?.body ||
          terrain?.proposal ||
          item?.recommendation_text ||
          "",
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
      meta = SHIFT[base] || { label: base, time: "" },
      planRows = shiftPlanningRows(day, base),
      staffRow = shiftStaffingRow(day, base),
      plannedValue = Number(staffRow?.planned_count),
      targetValue = Number(staffRow?.target_count),
      planned = Number.isFinite(plannedValue) ? plannedValue : planRows.length,
      target = Number.isFinite(targetValue) ? targetValue : null,
      gap =
        staffRow?.gap != null && Number.isFinite(Number(staffRow.gap))
          ? Number(staffRow.gap)
          : target != null
            ? planned - target
            : null,
      specialAgents = planRows.filter((item) => {
        const q = Number(item?.agents?.quotite);
        return adaptedShift(item?.code) || (Number.isInteger(q) && q < 100);
      }),
      contextRows = dayContextRows(day, base),
      visibleContext = contextRows.slice(0, 10),
      hiddenContext = Math.max(0, contextRows.length - visibleContext.length),
      analysisText =
        signal.detail ||
        (signal.level === "ok"
          ? "Aucun écart prioritaire détecté sur ce shift avec les données actuelles."
          : signal.level === "unknown"
            ? "Pas assez de données pour analyser ce shift correctement."
            : signal.label || ""),
      symbol = statusSymbol(signal.level, signal.symbol);

    const stats =
      '<div class="team-shift-analysis-stats">' +
      '<span><small>PRÉVU</small><b>' +
      esc(planned) +
      "</b></span>" +
      '<span><small>CIBLE</small><b>' +
      esc(target == null ? "—" : target) +
      "</b></span>" +
      '<span class="' +
      (gap == null ? "" : gap > 0 ? "positive" : gap < 0 ? "negative" : "neutral") +
      '"><small>ÉCART</small><b>' +
      esc(gap == null ? "—" : `${gap > 0 ? "+" : ""}${gap}`) +
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

  function weekSummaryBlock(bundle) {
    const intel = field();
    if (!intel?.dayChecklist) return "";
    const days = daysOfWeek(state.weekStart);
    const rows = days.map((day) => {
      const staff = state.staffingByDate.get(day);
      const items = assistantItemsForDate(bundle, day);
      const read = intel.dayChecklist({ staffing: staff, items });
      const meaningful = (read?.points || []).filter(
        (point) => !["info", "ok"].includes(point.level),
      );
      const detail =
        meaningful
          .slice(0, 2)
          .map((point) => point.detail || point.title)
          .filter(Boolean)
          .join(" · ") ||
        (read?.points || [])
          .slice(0, 1)
          .map((point) => point.detail || point.title)
          .filter(Boolean)
          .join(" · ") ||
        "Pas assez de données pour cette journée.";
      return { day, read, detail };
    });

    const rank = { critical: 5, warning: 4, opportunity: 3, ok: 2, unknown: 1 };
    const strengthRank = { strong: 5, moderate: 4, suggestion: 3, none: 2, unknown: 1 };
    const strongest = rows
      .slice()
      .sort(
        (a, b) =>
          (rank[b.read?.level] || 0) - (rank[a.read?.level] || 0) ||
          (strengthRank[b.read?.strength] || 0) - (strengthRank[a.read?.strength] || 0),
      )[0];

    const overallLevel = strongest?.read?.level || "unknown";
    const overallMeta =
      intel.statusMeta?.(overallLevel) || {
        symbol: overallLevel === "warning" ? "⚠️" : "",
        label: "Lecture de la semaine",
      };
    const adviceSource = rows
      .slice()
      .sort(
        (a, b) =>
          (strengthRank[b.read?.strength] || 0) - (strengthRank[a.read?.strength] || 0) ||
          (rank[b.read?.level] || 0) - (rank[a.read?.level] || 0),
      )
      .find((row) => row.read?.advice);
    const strength = adviceSource?.read?.strength || "unknown";
    const strengthLabel = {
      strong: "Conseil fort",
      moderate: "Conseil",
      suggestion: "Suggestion",
      none: "Aucune action particulière",
      unknown: "Données insuffisantes",
    }[strength] || "Conseil";
    const advice = adviceSource?.read?.advice || "Pas assez de données pour recommander un ajustement fiable.";

    const checks = rows
      .map(({ day, read, detail }) => {
        const meta =
          intel.statusMeta?.(read?.level || "unknown") || {
            symbol: "",
            label: "Pas assez de données",
          };
        const label = dateObj(day)
          .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })
          .replace(/^./, (char) => char.toUpperCase());
        return '<button type="button" class="team-week-check status-' + esc(read?.level || "unknown") + '" data-team-week-summary-day="' + esc(day) + '">' +
          '<span aria-hidden="true">' + esc(meta.symbol || "○") + '</span>' +
          '<div><strong>' + esc(label) + ' · ' + esc(meta.label || "") + '</strong>' +
          '<p>' + esc(detail) + '</p></div>' +
          '<i aria-hidden="true">›</i></button>';
      })
      .join("");

    return '<section class="team-day-summary team-week-summary status-' + esc(overallLevel) + '">' +
      '<header><span aria-hidden="true">' + esc(overallMeta.symbol || "○") + '</span>' +
      '<div><small>BILAN DE LA SEMAINE ' + esc(isoWeek(state.weekStart)) + '</small>' +
      '<strong>' + esc(weekRange(state.weekStart)) + '</strong></div></header>' +
      '<div class="team-week-checklist">' + checks + '</div>' +
      '<div class="team-day-advice strength-' + esc(strength) + '">' +
      '<strong>' + esc(strengthLabel) + '</strong><p>' + esc(advice) + '</p></div>' +
      '</section>';
  }

  function shiftBlock(day, code, items) {
    const base = baseShift(code);
    const meta = SHIFT[base];
    if (!meta || !items.length) return "";
    const sortedItems = items.slice().sort(compareAgentGhe);
    const chefs = sortedItems.filter(isChefItem);
    const team = sortedItems.filter((item) => !isChefItem(item));
    const key = `${day}|${code}`;
    const open = state.openShifts.get(day) === key;
    const signal = shiftSignalForDate(day, base);
    const group = (rows, label, className) =>
      rows.length
        ? `<section class="team-agent-group ${className}"><div class="team-agent-group-label">${esc(label)}</div>${rows.map(agentRow).join("")}</section>`
        : "";
    return `<section class="team-shift shift-${base.toLowerCase()} ${open ? "open" : ""}">
      <button class="team-shift-head" type="button" data-team-shift="${esc(key)}" aria-expanded="${open}">
        <b>${esc(code)}</b>
        <span><strong>${esc(meta.label)}</strong><small>${esc(meta.time)}</small></span>
        <span class="team-shift-mini-status status-${esc(signal.level)} is-clickable" data-team-shift-analysis="${esc(day)}|${esc(base)}" title="${esc(signal.label)}" aria-label="${esc(signal.label)}">${esc(statusSymbol(signal.level, signal.symbol))}</span>
        <em>${sortedItems.length}</em>
        <i aria-hidden="true">⌄</i>
      </button>
      <div class="team-shift-agents" ${open ? "" : "hidden"}>${group(chefs, chefs.length > 1 ? "CHEFS D’ÉQUIPE" : "CHEF D’ÉQUIPE", "is-chefs")}${group(team, "ÉQUIPE", "is-team")}</div>
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
    const ordered = [...groups.entries()].sort(
      ([a], [b]) =>
        SHIFT_ORDER.indexOf(baseShift(a)) - SHIFT_ORDER.indexOf(baseShift(b)),
    );
    const shifts = ordered.map(([code, rows]) => shiftBlock(day, code, rows)).join("");
    const body = shifts || '<p class="team-empty-inline">Aucun agent planifié.</p>';
    return dayContainer(
      day,
      `${items.length} présent${items.length > 1 ? "s" : ""}`,
      body,
      "team",
    );
  }

  function activityDay(bundle, day) {
    const data = bundle?.activity?.get(day) || {};
    const rows = [
      ...(data.alerts || []),
      ...(data.events?.formations || []),
      ...(data.events?.stagiaires || []),
    ];
    const body = rows.length
      ? `<div class="team-subsections">${rows
          .map(
            (item) =>
              `<section><span>${esc(item.type || item.kind || "Information")}</span><strong>${esc(item.title || item.label || "Information")}</strong>${item.body || item.note || item.description ? `<p>${esc(item.body || item.note || item.description)}</p>` : ""}</section>`,
          )
          .join("")}</div>`
      : '<p class="team-empty-inline">Rien à signaler pour cette journée.</p>';
    return dayContainer(
      day,
      `${rows.length} élément${rows.length > 1 ? "s" : ""}`,
      body,
      "activity",
    );
  }

  function assistantDay(bundle, day) {
    const rows = (bundle?.assistant?.items || []).filter(
      (item) => item.date === day,
    );
    const body = rows.length
      ? `<div class="team-subsections">${rows
          .map((item) => {
            const terrain = field()?.terrainItem?.(item);
            const severity = Number(item.severity || 0);
            const level = terrain?.level || (severity >= 4 ? "critical" : severity >= 2 ? "warning" : "ok");
            const tag =
              level === "critical"
                ? "🛑 À traiter"
                : level === "warning"
                  ? "⚠️ À surveiller"
                  : level === "opportunity"
                    ? "➕ Marge utile"
                    : "✔ Information";
            const headline = terrain?.headline || item.title || "Information";
            const details = [terrain?.detail || item.body, terrain?.proposal || item.recommendation_text]
              .filter(Boolean)
              .join(" ");
            return `<section class="status-${esc(level)}"><span>${esc(tag)}</span><strong>${esc(headline)}</strong>${details ? `<p>${esc(details)}</p>` : ""}</section>`;
          })
          .join("")}</div>`
      : '<p class="team-empty-inline">Aucun point prioritaire détecté.</p>';
    return dayContainer(
      day,
      `${rows.length} point${rows.length > 1 ? "s" : ""}`,
      body,
      "assistant",
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
        '<div class="team-empty">La vue équipe n’est pas incluse dans votre accès.</div>';
    } else {
      host.innerHTML = teamDay(bundle, day);
    }
    host.setAttribute("aria-busy", "false");
    state.rendered = true;
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
      if (allowed("activity")) await loadActivity(state.weekStart, force);
      if (request !== state.request) return;
      renderContent(bundle);
      loadWeekSignals(state.weekStart, bundle, force)
        .catch(() => {})
        .finally(() =>
          loadMonthSignals(state.dateJumpMonth, force).catch(() => {}),
        );
      const issue = bundle.coreError || bundle.activityError;
      clearBusy();
      if (issue)
        $("#teamError").textContent =
          "Certaines données n’ont pas pu être actualisées.";
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

  async function selectTab(tab) {
    if (tab === state.tab) return;
    state.tab = tab;
    renderHeader();
    const bundle = cacheEntry(state.weekStart);
    if (tab === "activity" && !bundle.activity) {
      renderContent(bundle);
      setBusy("Chargement de l’activité de la semaine…");
      await loadActivity(state.weekStart);
      clearBusy();
    }
    renderContent(bundle);
    history.replaceState(
      { ...(history.state || {}), stipTeamTab: tab },
      "",
      `${location.pathname}?tab=${encodeURIComponent(tab)}`,
    );
    window.STIPNav?.remember?.({ tab, weekStart: state.weekStart });
  }

  function moveWeek(offset) {
    state.weekStart = addDays(state.weekStart, offset * 7);
    state.dayFocus = state.weekStart;
    state.dateJumpMonth = monthKey(state.dayFocus);
    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
      scrollY: 0,
    });
    showWeek({ preserve: true });
  }

  $("#teamDays")?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-team-day]");
    if (day) chooseDate(day.dataset.teamDay);
  });
  $("#teamPrevWeek")?.addEventListener("click", () => moveWeek(-1));
  $("#teamNextWeek")?.addEventListener("click", () => moveWeek(1));
  $("#teamMonthDigestHost")?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-team-month-day]");
    if (!day) return;
    chooseDate(day.dataset.teamMonthDay);
    document.querySelector(".team-day-section-label")?.scrollIntoView({
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
  $("#teamRefresh").addEventListener("click", () =>
    showWeek({ force: true, preserve: true }),
  );
  $("#teamSubscribe")?.addEventListener("click", () =>
    window.STIPCalendars?.quick?.("team"),
  );
  $("#teamContent").addEventListener("click", (event) => {
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

  async function boot() {
    if (!token()) return location.replace("index.html");
    try {
      state.access = await post("stip-access", { action: "me" });
      state.weekStart = monday(todayIso());
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
      if (!["planning_team", "activity", "assistant_enabled"].some(allowed))
        return location.replace("index.html");
      const required =
        state.tab === "team"
          ? "planning_team"
          : state.tab === "activity"
            ? "activity"
            : "assistant_enabled";
      if (!allowed(required))
        state.tab = allowed("planning_team")
          ? "team"
          : allowed("activity")
            ? "activity"
            : "assistant";
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
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
    }),
  });
  boot();
})();
