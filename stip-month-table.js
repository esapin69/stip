(() => {
  "use strict";

  const CALENDAR = ".stip-month-calendar";
  const GRID = ".stip-month-grid";
  const DAY = ".stip-month-day";
  const SEP = ".stip-month-table-week-separator";
  const WEEKDAYS = ".stip-month-table-weekdays";
  const LABELS = ["LU","MA","ME","JE","VE","SA","DI"];

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[ch]);
  }

  function shiftBadgeHtml(raw) {
    const source = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!source) return "";
    const registry = window.STIPShiftRegistry;
    const def = registry?.resolve?.(source) || null;
    const base = String(
      registry?.baseCode?.(source) ||
      def?.base_code ||
      def?.code ||
      source.replace(/[*★☆✱✳✶✷✸✹✺✻✼✽✾✿︎️]+$/u, "")
    ).trim().toUpperCase();
    const workLike = def?.is_working === true || ["M","J","J4","S","N"].includes(base);
    if (!workLike) return "";
    const starred = /[*★☆✱✳✶✷✸✹✺✻✼✽✾✿︎️]+$/u.test(source);
    const display = base + (starred ? "*" : "");
    const family = String(def?.family || "").trim().toLowerCase();
    const classKey = ({
      m:"m", morning:"m",
      j:"j", day:"j",
      j4:"j4", late:"j4",
      s:"s", evening:"s",
      n:"n", night:"n"
    })[family] || ({M:"m",J:"j",J4:"j4",S:"s",N:"n"})[base] || "other";
    const label = String(def?.label || base || source);
    return `<span class="stip-month-shift-badge code-${esc(classKey)}" data-shift-base="${esc(base)}" title="${esc(label)}" aria-label="${esc(label)}">${esc(display)}</span>`;
  }

  function isoDateOf(day) {
    return String(
      day?.dataset?.calDay ||
      day?.dataset?.phDate ||
      day?.dataset?.stipDate ||
      day?.getAttribute?.("data-date") ||
      ""
    ).trim();
  }

  function dateObj(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const d = new Date(iso + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function isoWeek(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
    const y = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    return Math.ceil((((x - y) / 86400000) + 1) / 7);
  }

  function weekdayColumn(d) {
    return ((d.getDay() + 6) % 7) + 1;
  }

  function expectedSeparators(days) {
    let count = 0;
    days.forEach((day, index) => {
      const d = dateObj(isoDateOf(day));
      if (d && (index === 0 || d.getDay() === 1)) count += 1;
    });
    return count;
  }

  function enhanceCalendar(calendar) {
    const grid = calendar?.querySelector?.(GRID);
    if (!grid) return;

    const days = [...grid.querySelectorAll(":scope > " + DAY)]
      .filter((day) => !!dateObj(isoDateOf(day)));
    if (!days.length) return;

    const signature = days.map(isoDateOf).join("|");
    const wanted = expectedSeparators(days);
    if (
      grid.dataset.stipMonthTableSignature === signature &&
      grid.querySelectorAll(":scope > " + SEP).length === wanted &&
      grid.querySelectorAll(":scope > " + WEEKDAYS).length === wanted
    ) {
      calendar.dataset.stipMonthTable = "1";
      calendar.classList.add("stip-card-signature");
      return;
    }

    grid.querySelectorAll(":scope > " + SEP + ",:scope > " + WEEKDAYS).forEach((node) => node.remove());
    grid.querySelectorAll(":scope > .ph-empty,:scope > .metiers-month-empty").forEach((node) => node.remove());

    calendar.querySelectorAll(":scope > .stip-month-weekdays,:scope > .hc-date-jump-weekdays")
      .forEach((node) => {
        node.hidden = true;
        node.setAttribute("aria-hidden", "true");
      });

    days.forEach((day, index) => {
      const iso = isoDateOf(day);
      const d = dateObj(iso);
      if (!d) return;

      if (index === 0) {
        day.style.setProperty("grid-column-start", String(weekdayColumn(d)));
      } else {
        day.style.removeProperty("grid-column-start");
      }

      if (index !== 0 && d.getDay() !== 1) return;

      const week = isoWeek(d);
      const separator = document.createElement("div");
      separator.className = "stip-month-table-week-separator";
      separator.setAttribute("role", "separator");
      separator.setAttribute("aria-label", "Semaine " + week);
      separator.innerHTML = "<span>S" + week + "</span>";

      const weekdays = document.createElement("div");
      weekdays.className = "stip-month-table-weekdays";
      weekdays.setAttribute("aria-hidden", "true");
      weekdays.innerHTML = LABELS.map((label) => "<span>" + label + "</span>").join("");

      grid.insertBefore(separator, day);
      grid.insertBefore(weekdays, day);
    });

    calendar.dataset.stipMonthTable = "1";
    calendar.classList.add("stip-card-signature");
    grid.dataset.stipMonthTableSignature = signature;
  }

  function enhance(root = document) {
    if (root?.matches?.(CALENDAR)) enhanceCalendar(root);
    root?.querySelectorAll?.(CALENDAR).forEach(enhanceCalendar);
  }

  let scheduled = false;
  function schedule(root = document) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance(root);
    });
  }

  const observer = new MutationObserver(() => schedule(document));

  function start() {
    enhance(document);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("stip:month-changed", () => schedule(document));
    window.addEventListener("stip:boot-updated", () => schedule(document));
  }

  window.STIPMonthTable = { enhance, enhanceCalendar, schedule, shiftBadgeHtml };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
