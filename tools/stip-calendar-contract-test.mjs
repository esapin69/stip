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

const homeCss = read("home-shell.css");
const teamCss = read("esprit-equipe.css");
const agentCss = read("agent-agenda-view.css");
const rrCss = read("responsable-agenda-home.css");
assert(!/\.hc-date-jump-icon\s*\{[^}]*translateY/s.test(homeCss), "home month still offsets icons locally");
assert(!/\.team-cal-icon\s*\{[^}]*translateY/s.test(teamCss), "team month still offsets icons locally");
assert(!/\.aav-cal-shift\s+\.aav-dot\s*\{/s.test(agentCss), "agent month still resizes dots locally");
assert(!/#rrWeek\s+\.stip-week-day\s*\{/s.test(rrCss), "Responsable still owns week day geometry");
assert(!/#rrMonth\s+\.stip-month-day\s*\{/s.test(rrCss), "Responsable still owns month day geometry");

if (!process.exitCode) console.log("STIP calendar raw/common contract OK");
