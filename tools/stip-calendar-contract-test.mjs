import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const fail = (msg) => { console.error("STIP calendar contract:", msg); process.exitCode = 1; };
const assert = (ok, msg) => { if (!ok) fail(msg); };

const theme = read("stip-theme.css");
const core = read("stip-calendar-core.css");
const visual = read("stip-calendar-visual.css");
const patterns = read("stip-patterns.css");

assert(theme.includes("@layer stip-calendar-core, stip-calendar-visual;"), "cascade layers are not declared");
const coreImport = theme.indexOf("stip-calendar-core.css");
const visualImport = theme.indexOf("stip-calendar-visual.css");
assert(coreImport >= 0 && visualImport > coreImport, "raw core must load before common visual");

assert(!/(^|[;{])\s*(background|background-color|color|box-shadow|text-shadow)\s*:/m.test(core),
  "raw core contains decorative declarations");
assert(!/(^|[;{])\s*(display|grid-template-columns|grid-template-rows|width|height|min-width|min-height|margin|padding|gap|transform|filter)\s*:/m.test(visual),
  "visual layer contains structural geometry");

assert(core.includes(".stip-week-line"), "week raw core missing");
assert(core.includes(".stip-month-calendar .stip-month-day"), "month raw core missing");
assert(core.includes("transform:none!important"), "raw core must neutralize positional transforms");
assert(core.includes(".stip-events-vertical"), "vertical event stack must be a shared primitive");
assert(core.includes("grid-template-rows:none!important"), "common week body still reserves the personal 4-row layout");
assert(core.includes(".stip-week-day.stip-week-personal-layout .stip-week-day-body"), "personal-home week modifier missing");
assert(core.includes(".stip-week-work-marker"), "worked-shift marker exception missing");
assert(visual.includes(".stip-week-events{font-size:1.45rem!important}"), "week secondary markers are not normalized");
assert(visual.includes(".stip-month-calendar .stip-month-events{color:var(--stip-ink-2)!important;font-size:1.45rem!important}"), "month secondary markers are not normalized");

assert(!patterns.includes(".stip-week-line{") && !patterns.includes(".stip-week-line {"),
  "week geometry leaked back into stip-patterns.css");
assert(!patterns.includes(".stip-month-calendar .stip-month-day"),
  "month geometry leaked back into stip-patterns.css");
assert(!patterns.includes("Emergency canonical calendar patch"),
  "old Responsable emergency calendar patch still exists");

const rr = read("responsable-agenda-home.js");
assert(rr.includes("stip-week-events stip-events-vertical rr-week-marks"),
  "Responsable week is not using the common event slot");
assert(rr.includes("stip-month-events stip-events-vertical rr-month-events"),
  "Responsable month is not using the common event slot");
assert(!rr.includes("stip-week-day-body rr-events-only"),
  "Responsable still bypasses the canonical week body");

const planning = read("planning-home.js");
assert(planning.includes("ph-month-weekdays stip-month-weekdays"),
  "Planning personal still mixes weekday labels into the month grid");

const homeJs = read("home-shell.js");
const agentJs = read("agent-agenda-view.js");
const teamJs = read("esprit-equipe.js");
const rrHomeJs = read("responsable-agenda-home.js");
const rrStandaloneJs = read("responsable-agenda.js");
const spiritJs = read("spirit-team.js");
const hubJs = read("planning-hub-enhance.js");
const homeCss = read("home-shell.css");
const teamCss = read("esprit-equipe.css");
const agentCss = read("agent-agenda-view.css");
const rrCss = read("responsable-agenda-home.css");
assert(!/\.hc-date-jump-icon\s*\{[^}]*translateY/s.test(homeCss), "home month still offsets icons locally");
assert(!/\.team-cal-icon\s*\{[^}]*translateY/s.test(teamCss), "team month still offsets icons locally");
assert(!/\.aav-cal-shift\s+\.aav-dot\s*\{/s.test(agentCss), "agent month still resizes dots locally");
assert(!/#rrWeek\s+\.stip-week-day\s*\{/s.test(rrCss), "Responsable still owns week day geometry");
assert(!/#rrMonth\s+\.stip-month-day\s*\{/s.test(rrCss), "Responsable still owns month day geometry");
assert(homeJs.includes("stip-week-personal-layout"), "home week does not opt into its personal reserved-row layout");
assert(homeJs.includes("stip-week-work-marker"), "home worked shift does not use the smaller canonical marker");
assert(homeJs.includes('class="stip-month-event"'), "home month secondary events are still raw <small> text");
assert(agentJs.includes('class="stip-month-event"'), "agent month secondary events are still raw <small> text");
for (const [name, source] of [
  ["agent agenda", agentJs],
  ["team", teamJs],
  ["Responsable home", rrHomeJs],
  ["Responsable standalone", rrStandaloneJs],
  ["spirit fallback", spiritJs],
  ["planning hub fallback", hubJs],
]) {
  assert(!source.includes("stip-week-divider"), `${name} still renders the personal-only week divider`);
}
assert(!homeCss.includes(".hc-calendar-driven-planning .hc-days-landscape .hc-week-event-chip"),
  "legacy home week marker sizing layer still exists");

if (!process.exitCode) console.log("STIP calendar raw/common contract OK");
