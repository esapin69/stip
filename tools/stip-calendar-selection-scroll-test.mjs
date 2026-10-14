import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../home-shell.js", import.meta.url), "utf8");
function sourceBetween(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, "Missing calendar function: " + start);
  return source.slice(first, last);
}
function liveFunction(segment, exports, context) {
  const parameters = Object.keys(context);
  const factory = new Function(...parameters, segment + "\nreturn " + exports + ";");
  return factory(...parameters.map((key) => context[key]));
}
function day(data, css = "") {
  const classes = new Set(css.split(" ").filter(Boolean));
  const attributes = {};
  return {
    dataset: data, attributes,
    classList: {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    setAttribute(name, value) { attributes[name] = String(value); },
    has(name) { return classes.has(name); },
  };
}

const weekDays = [
  day({ homeDay: "2026-10-14" }, "stip-week-day selected"),
  day({ homeDay: "2026-10-15" }, "stip-week-day"),
];
const monthDays = [
  day({ calDay: "2026-10-14" }),
  day({ calDay: "2026-10-15" }),
];
const monthPanel = {
  dataset: { calendarMonth: "2026-10" },
  querySelectorAll() { return monthDays; },
};
const state = {
  dayFocus: "2026-10-14",
  monthDayFocus: "",
  dateJumpMonth: "2026-10",
  weekOffset: 0,
};
let monthRenders = 0, weekJumps = 0, popupOpens = 0;
const document = {
  querySelector(query) {
    return query.includes("date-jump-panel") ? monthPanel : null;
  },
  querySelectorAll(query) {
    return query.includes("hc-week-context-master") ? weekDays : [];
  },
};
const changeWeek = liveFunction(
  sourceBetween("  function selectWeekDay(iso) {", "  function dateIsoLocal(d) {"),
  "selectWeekDay",
  {
    state, document,
    navigationWeek: () => [{ iso: "2026-10-14" }, { iso: "2026-10-15" }],
    selectedWeek: () => [{ iso: "2026-10-14" }, { iso: "2026-10-15" }],
    jumpToDate: () => { weekJumps += 1; },
  },
);
const month = liveFunction(
  sourceBetween("  function markMonthSelection(panel) {", "  function weekRangeLabel(w = []) {"),
  "{ selectMonthDay, moveCalendarMonth }",
  {
    state, document,
    renderMonthContext: () => { monthRenders += 1; },
    shiftMonthKey: (monthKey, step) => step === 1 ? "2026-11" : "2026-09",
    parisIso: () => "2026-10-14",
  },
);

// The month is unselected until its user explicitly picks a day.
assert.equal(state.monthDayFocus, "");
month.selectMonthDay("2026-10-15");
assert.equal(state.dayFocus, "2026-10-14");
assert.equal(state.monthDayFocus, "2026-10-15");
assert.equal(monthDays[1].has("is-selected"), true);
assert.equal(monthDays[0].has("is-selected"), false);
assert.equal(monthDays[1].attributes["aria-pressed"], "true");
assert.equal(weekDays[0].has("selected"), true);
assert.equal(monthRenders, 0, "Picking a day must not remount any calendar");

changeWeek("2026-10-15");
assert.equal(state.dayFocus, "2026-10-15");
assert.equal(state.monthDayFocus, "2026-10-15");
assert.equal(weekDays[1].has("selected"), true);
assert.equal(weekDays[0].has("selected"), false);
assert.equal(weekJumps, 0, "Visible week day must not rebuild the page");
changeWeek("2026-10-14");
assert.equal(state.monthDayFocus, "2026-10-15");
assert.equal(monthDays[1].has("is-selected"), true);

month.moveCalendarMonth(1);
assert.equal(state.dateJumpMonth, "2026-11");
assert.equal(state.dayFocus, "2026-10-14");
assert.equal(monthRenders, 1, "Only the month subview is refreshed");

const savedScroll = sourceBetween(
  "  let shiftDetailReadingPosition = null;",
  "  function openShiftDetail(iso, fromHistory = false) {",
);
function testClosingByHistory(track) {
  let modal = { remove() { modal = null; } };
  const page = {
    scrollY: 0,
    innerHeight: 800,
    STIPRouter: { get: () => "home" },
    STIPOverlayNav: { closeElement: () => track },
    scrollTo({ top }) { this.scrollY = top; },
  };
  const doc = {
    getElementById: () => modal,
    documentElement: { scrollHeight: 2600 },
    body: { classList: { remove() {} } },
  };
  const action = liveFunction(savedScroll,
    "{ closeShiftDetail, save: (snapshot) => { shiftDetailReadingPosition = snapshot; } }",
    { window: page, document: doc, location: { pathname: "/" }, requestAnimationFrame: (f) => f() });
  action.save({ y: 900, path: "/", route: "home" });
  action.closeShiftDetail(false);
  if (track) {
    assert.ok(modal, "A tracked popup closes only when the history event arrives");
    action.closeShiftDetail(true);
  }
  assert.equal(modal, null);
  assert.equal(page.scrollY, 900, "X / Android Back must restore reading position");
}
testClosingByHistory(false);
testClosingByHistory(true);

assert.doesNotMatch(
  sourceBetween("  function selectMonthDay(iso) {", "  function weekRangeLabel(w = []) {"),
  /\brender\(\)/,
  "Monthly day selection must not remount the home page",
);
assert.doesNotMatch(
  sourceBetween("  function selectWeekDay(iso) {", "  function dateIsoLocal(d) {"),
  /\brender\(\)/,
  "Weekly day selection must not remount the home page",
);


// A week swipe/navigation is rendered inside the week only. It must never
// replace the full home DOM or issue a corrective window.scrollBy().
const weekMoveSource = sourceBetween(
  "  function moveWeek(step) {",
  "  function dayCard(",
);
assert.doesNotMatch(weekMoveSource, /\brender\(\)|window\.scrollBy|requestAnimationFrame/);
assert.match(weekMoveSource, /renderWeekContext\(\)/);
assert.match(source, /function weekContextMarkup\(\)/);
assert.match(source, /bindWeekContext\(root\.querySelector/);
const weekContext = { innerHTML: "initial", addEventListener(name, cb) { this[name] = cb; } };
const monthContext = { innerHTML: "untouched" };
const newWeekMarkup = "<section>Next week</section>";
const redrawWeek = liveFunction(
  sourceBetween("  function renderWeekContext() {", "  function bindWeekContext(week) {"),
  "renderWeekContext",
  {
    document: { querySelector: (q) => q.includes(".hc-week-context-master") ? weekContext : monthContext },
    weekContextMarkup: () => newWeekMarkup,
  },
);
redrawWeek();
assert.equal(weekContext.innerHTML, newWeekMarkup);
assert.equal(monthContext.innerHTML, "untouched", "Week rendering must not affect month DOM");

let weekSteps = 0, weekDaySelections = 0, weekDetailOpens = 0;
const bindWeek = liveFunction(
  sourceBetween("  function bindWeekContext(week) {", "  // Month navigation"),
  "bindWeekContext",
  {
    planningLoading: () => false,
    moveWeek: (step) => { weekSteps += Number(step); },
    resetWeekToCurrent: () => {},
    window: { STIPLeaveCart: { isSelecting: () => false } },
    planningRowForDate: (iso) => ({ date: iso }),
    selectWeekDay: () => { weekDaySelections += 1; },
    openShiftDetail: () => { weekDetailOpens += 1; },
    openWidget: () => {},
  },
);
bindWeek(weekContext);
function weeklyClick(selector, data, cls = "") {
  const selected = day(data, cls);
  weekContext.click({
    target: {
      closest(query) { return query === selector ? selected : null; },
    },
  });
}
weeklyClick("[data-week-step]", { weekStep: "1" });
assert.equal(weekSteps, 1);
weeklyClick("[data-home-day]", { homeDay: "2026-10-15" }, "stip-week-day");
assert.equal(weekDaySelections, 1);
assert.equal(weekDetailOpens, 1);
assert.equal(monthContext.innerHTML, "untouched");

console.log("GHE calendar selection, weekly navigation and popup scroll contract: OK");
