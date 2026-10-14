import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../home-shell.js", import.meta.url), "utf8");
function extract(start, end) {
  const first = home.indexOf(start);
  const last = home.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, "Missing function: " + start);
  return home.slice(first, last);
}
function control(attr, day, active = false) {
  const classes = new Set(active ? ["selected"] : []);
  const attrs = {};
  return {
    dataset: { [attr]: day },
    classList: {
      toggle(name, checked) {
        if (checked) classes.add(name);
        else classes.delete(name);
      },
    },
    setAttribute(name, value) { attrs[name] = String(value); },
    hasClass(name) { return classes.has(name); },
    attrs,
  };
}
const weekDays = [
  control("homeDay", "2026-10-14", true),
  control("homeDay", "2026-10-15"),
];
const monthDays = [
  control("calDay", "2026-10-14"),
  control("calDay", "2026-10-15"),
];
const state = {
  weekOffset: 0,
  dayFocus: "2026-10-14",
  monthDayFocus: "",
  dateJumpMonth: "2026-10",
};
const calls = [];
const document = {
  querySelectorAll(selector) {
    if (selector.includes(".hc-week-context-master")) return weekDays;
    if (selector.includes(".hc-month-context-master")) return monthDays;
    throw new Error("Unexpected selector: " + selector);
  },
};
const chooseMonth = new Function(
  "state", "document",
  extract("  function selectMonthDay(iso) {", "  function weekRangeLabel(w = []) {") +
  "\nreturn selectMonthDay;",
)(state, document);
const chooseWeek = new Function(
  "state", "document", "selectedWeek", "jumpToDate",
  extract("  function selectVisibleWeekDay(iso) {", "  function dateIsoLocal(d) {") +
  "\nreturn selectVisibleWeekDay;",
)(
  state,
  document,
  () => [{ iso: "2026-10-14" }, { iso: "2026-10-15" }],
  (iso) => calls.push(iso),
);

// There is no forced month selection until the user clicks it.
assert.match(home, /monthDayFocus: ""/);
chooseMonth("2026-10-15");
assert.equal(state.monthDayFocus, "2026-10-15");
assert.equal(state.dayFocus, "2026-10-14");
assert.equal(state.weekOffset, 0);
assert.equal(monthDays[1].hasClass("is-selected"), true);
assert.equal(monthDays[0].hasClass("is-selected"), false);
assert.equal(monthDays[1].attrs["aria-pressed"], "true");
assert.equal(weekDays[0].hasClass("selected"), true);
assert.deepEqual(calls, [], "Month selection must not navigate weeks");

chooseWeek("2026-10-15");
assert.equal(state.dayFocus, "2026-10-15");
assert.equal(state.monthDayFocus, "2026-10-15");
assert.equal(weekDays[1].hasClass("selected"), true);
assert.equal(weekDays[0].hasClass("selected"), false);
assert.equal(weekDays[1].attrs["aria-pressed"], "true");
assert.equal(monthDays[1].hasClass("is-selected"), true);
assert.deepEqual(calls, [], "Visible week day must not remount home");

chooseWeek("2026-10-19");
assert.deepEqual(calls, ["2026-10-19"], "Next Monday bridge still navigates");
assert.doesNotMatch(
  extract("  function selectMonthDay(iso) {", "  function weekRangeLabel(w = []) {"),
  /\brender\(\)|window\.scrollBy|window\.scrollTo/,
);
assert.doesNotMatch(
  extract("  function selectVisibleWeekDay(iso) {", "  function dateIsoLocal(d) {"),
  /\brender\(\)|window\.scrollBy|window\.scrollTo/,
);
console.log("Independent calendar tap contract: OK");
