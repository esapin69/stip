import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const fail = (msg) => { console.error("STIP calendar contract:", msg); process.exitCode = 1; };
const assert = (ok, msg) => { if (!ok) fail(msg); };

const theme = read("stip-theme.css");
const core = read("stip-calendar-core.css");
const visual = read("stip-calendar-visual.css");
const patterns = read("stip-patterns.css");
const weekEngine = read("stip-week-engine.js");
const calendarRules = read("STIP-CALENDAR-RULES.md");
const monthTableCss = read("stip-month-table.css");
const monthTableJs = read("stip-month-table.js");
const mainIndex = read("index.html");
const metiersIndex = read("metiers/index.html");
const metiersCss = read("metiers/metiers.css");
const metiersJs = read("metiers/metiers.js");
const tMonthBridge = read("t-est/accueil/accueil-t.js");

assert(theme.includes("@layer stip-calendar-core, stip-calendar-visual;"), "cascade layers are not declared");
const coreImport = theme.indexOf("stip-calendar-core.css");
const visualImport = theme.indexOf("stip-calendar-visual.css");
assert(coreImport >= 0 && visualImport > coreImport, "raw core must load before common visual");

assert(!/(^|[;{])\s*(background|background-color|color|box-shadow|text-shadow)\s*:/m.test(core),
  "raw core contains decorative declarations");
const structuralGeometry = "(?:display|grid-template-columns|grid-template-rows|width|height|min-width|min-height|margin|padding|gap|transform|filter)";
assert(!new RegExp("\\.stip-week-day\\s*\\{[^}]*" + structuralGeometry + "\\s*:", "s").test(visual),
  "visual layer redefines base week-day geometry");
assert(!new RegExp("\\.stip-month-calendar \\.stip-month-day\\s*\\{[^}]*" + structuralGeometry + "\\s*:", "s").test(visual),
  "visual layer redefines base month-day geometry");

assert(core.includes(".stip-week-line"), "week raw core missing");
assert(core.includes(".stip-month-calendar .stip-month-day"), "month raw core missing");
assert(core.includes("transform:none!important"), "raw core must neutralize positional transforms");
assert(core.includes(".stip-events-vertical"), "vertical event stack must be a shared primitive");
assert(core.includes("grid-template-rows:none!important"), "common week body still reserves the personal 4-row layout");
assert(core.includes(".stip-week-day.stip-week-personal-layout .stip-week-day-body"), "personal-home week modifier missing");
assert(core.includes(".stip-week-work-marker"), "worked-shift marker exception missing");
assert(/\.stip-week-line\{[\s\S]*?touch-action:pan-y!important/.test(core),
  "week swipe surface must preserve native vertical panning");
assert(core.includes(".stip-month-calendar{touch-action:pan-y!important}"),
  "month swipe surface must preserve native vertical panning");
assert(/\.stip-week-day\{[\s\S]*?min-height:0!important/.test(core),
  "default week cards still carry the profile fixed height");
assert(core.includes(".stip-week-day.stip-week-personal-layout{min-height:100px!important}"),
  "profile week compact height is missing");
assert(core.includes("align-content:start!important"),
  "default week body still vertically reserves empty profile space");
assert(core.includes(".stip-week-personal-line .stip-week-next-bridge"),
  "profile-only next-Monday bridge height is not scoped");
assert(visual.includes(".stip-week-events{font-size:1.45rem!important}"), "week secondary markers are not normalized");
assert(visual.includes(".stip-month-calendar .stip-month-events{color:var(--stip-ink-2)!important;font-size:1.45rem!important}"), "month secondary markers are not normalized");

assert(!patterns.includes(".stip-week-line{") && !patterns.includes(".stip-week-line {"),
  "week geometry leaked back into stip-patterns.css");
assert(!patterns.includes(".stip-month-calendar .stip-month-day"),
  "month geometry leaked back into stip-patterns.css");
assert(!patterns.includes("Emergency canonical calendar patch"),
  "old Responsable emergency calendar patch still exists");

assert(!weekEngine.includes("{passive:false,capture:true}"),
  "week engine must not install a blocking document-level touch listener");
assert(visual.includes(".stip-week-next-bridge") && visual.includes("color:#c53333!important") && visual.includes("text-decoration:underline!important"),
  "next-Monday bridge visual contract is missing");

assert(calendarRules.includes("stip-week-engine.js") && calendarRules.includes("vendredi") && calendarRules.includes("samedi") && calendarRules.includes("dimanche"),
  "human-readable calendar contract is incomplete");

assert(calendarRules.includes("stip-month-table.css") && calendarRules.includes("stip-month-table.js"),
  "human-readable calendar contract does not protect the shared monthly table");
assert(mainIndex.includes("stip-month-table.css?v=20261015-week-shift-symbols1") && mainIndex.includes("stip-month-table.js?v=20260928-month-badges1"),
  "main app does not load the shared monthly table");
assert(metiersIndex.includes("stip-month-table.css?v=20261015-week-shift-symbols1") && metiersIndex.includes("stip-month-table.js?v=20260928-month-badges1"),
  "métiers does not load the shared monthly table");
assert(monthTableJs.includes("dataset?.calDay") && monthTableJs.includes("dataset?.phDate") && monthTableJs.includes("dataset?.stipDate"),
  "shared monthly table no longer accepts all active date sources");
assert(monthTableJs.includes("stip-month-table-week-separator") && monthTableJs.includes("stip-month-table-weekdays"),
  "shared monthly table week composition is missing");
assert(monthTableCss.includes('[data-stip-month-table="1"]') && monthTableCss.includes(".stip-month-table-week-separator"),
  "shared monthly table visual scope is missing");
assert(monthTableJs.includes("shiftBadgeHtml") && monthTableJs.includes("stip-month-shift-badge"),
  "shared monthly worked-shift badge renderer is missing");
assert(monthTableCss.includes(".stip-month-shift-badge.code-m") &&
       monthTableCss.includes(".stip-month-shift-badge.code-j4") &&
       monthTableCss.includes(".stip-month-shift-badge.code-n"),
  "shared monthly worked-shift badge palette is incomplete");
assert(!metiersCss.includes(".metiers-home .stip-month-calendar"),
  "métiers has reintroduced local monthly table styling");
assert(tMonthBridge.includes("STIPMonthTable") && !tMonthBridge.includes("t-est-premium-month"),
  "T no longer consumes the shared monthly table directly");
assert(weekEngine.includes("liveTail") && weekEngine.includes("dow>=5") && weekEngine.includes("nextMonday"),
  "late-current-week Friday/Saturday/Sunday bridge rule is missing from the master engine");
assert(weekEngine.includes("function currentState") && weekEngine.includes("stateForDate(today,{today})"),
  "master engine no longer exposes the canonical current-week reset state");

const rr = read("responsable-agenda-home.js");
assert(rr.includes("stip-week-events stip-events-vertical rr-week-marks"),
  "Responsable week is not using the common event slot");
assert(rr.includes("stip-month-events stip-events-vertical rr-month-events"),
  "Responsable month is not using the common event slot");
assert(!rr.includes("stip-week-day-body rr-events-only"),
  "Responsable still bypasses the canonical week body");

const planning = read("planning-home.js");
assert(!planning.includes(".ph-month-card{") && !planning.includes(".ph-day-cell{") && !planning.includes(".ph-day-head{"),
  "Planning personal has reintroduced local monthly table geometry");
assert(planning.includes("ph-month-weekdays stip-month-weekdays"),
  "Planning personal still mixes weekday labels into the month grid");

const homeJs = read("home-shell.js");
assert(homeJs.includes("STIPMonthTable?.shiftBadgeHtml?.(shift.raw || shift.code)") &&
       !homeJs.includes("hc-date-jump-dot stip-month-dot shift-"),
  "Accueil monthly planning is not using the validated text badges for worked shifts");
assert(planning.includes("STIPMonthTable?.shiftBadgeHtml?.(rawDisplay)"),
  "Planning personal is not using the shared monthly worked-shift badge");
assert(metiersJs.includes("STIPMonthTable?.shiftBadgeHtml?.(code)") &&
       !metiersCss.includes(".metiers-shift-code{"),
  "Métiers has reintroduced a local worked-shift badge implementation");
assert(metiersJs.includes('data-stip-date="${dateKey}"') &&
       metiersJs.includes("window.STIPMonthTable?.enhance?.(host)"),
  "Métiers renders dates but does not pass them to the shared monthly table engine");
assert(metiersJs.includes("stip-month-nav metiers-period-nav") &&
       metiersJs.includes("stip-month-events metiers-month-event-dots") &&
       !metiersJs.includes("metiers-month-empty") &&
       !metiersJs.includes('class="stip-month-weekdays"'),
  "Métiers still rebuilds monthly geometry instead of consuming the shared engine");
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
const calendarConsumers = [
  ["home", homeJs],
  ["team", teamJs],
  ["agent agenda", agentJs],
  ["Responsable", rrHomeJs],
];
for (const [name, source] of calendarConsumers) {
  assert(source.includes("STIPWeekEngine") && source.includes("display"),
    `${name} no longer consumes the master week display engine`);
  assert(!/\bliveTail\b/.test(source),
    `${name} duplicates the late-week business rule instead of consuming the master engine`);
}
assert(homeJs.includes("hc-next-monday-bridge"), "home no longer renders the canonical next-Monday bridge");
assert(/const openDetail\s*=\s*\n?\s*b\.classList\.contains\("stip-week-day"\)/.test(homeJs),
  "weekly day button no longer declares its detail-state locally");
assert(!/\n\s*openDetail\s*=\s*\n?\s*b\.classList\.contains\("stip-week-day"\)/.test(homeJs),
  "weekly day button can throw by assigning an undeclared openDetail");
assert(teamJs.includes("stip-week-next-bridge"), "team no longer renders the canonical next-Monday bridge");
assert(agentJs.includes("stip-week-next-bridge"), "agent agenda no longer renders the canonical next-Monday bridge");
assert(rrHomeJs.includes("stip-week-next-bridge"), "Responsable no longer renders the canonical next-Monday bridge");
assert(!homeJs.includes("function weekDaysVertical(") && !homeJs.includes("hc-days-vertical"),
  "obsolete Home vertical week renderer has returned");
const legacyHomeDayCount = (homeCss.match(/\.hc-day\b/g) || []).length;
assert(legacyHomeDayCount <= 420,
  `legacy .hc-day CSS debt grew (${legacyHomeDayCount}); new week work must use .stip-week-day`);
assert(!/\.hc-date-jump-icon\s*\{[^}]*translateY/s.test(homeCss), "home month still offsets icons locally");
assert(!/\.team-cal-icon\s*\{[^}]*translateY/s.test(teamCss), "team month still offsets icons locally");
assert(!/\.aav-cal-shift\s+\.aav-dot\s*\{/s.test(agentCss), "agent month still resizes dots locally");
assert(!/#rrWeek\s+\.stip-week-day\s*\{/s.test(rrCss), "Responsable still owns week day geometry");
assert(!/#rrMonth\s+\.stip-month-day\s*\{/s.test(rrCss), "Responsable still owns month day geometry");
assert(homeJs.includes("STIPWeekEngine?.currentState") &&
       homeJs.includes("state.weekOffset !== 0 || state.weekPast") &&
       homeJs.includes("visibleWeek[0]?.iso"),
  "home no longer guarantees a reliable return to the current week/day");
assert(homeJs.includes("stip-week-personal-layout"), "home week does not opt into its personal compact layout");
assert(homeJs.includes("weekWorkSymbol(x.row?.code || x.row?.source_value || x.code)") &&
       homeJs.includes("weekTimeHtml(x.time)"),
  "home must use the monthly shift badge with precise hours, not the old duplicate marker");
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
// One canonical badge shared by month, week, and legends.
assert(homeJs.includes("function weekWorkSymbol(raw)") &&
       homeJs.includes("STIPMonthTable?.shiftBadgeHtml?.(raw)") &&
       homeJs.includes("weekWorkSymbol(x.row?.code || x.row?.source_value || x.code)") &&
       homeJs.includes("weekTimeHtml(x.time)"),
  "personal week does not reuse monthly badge with effective shift hours");
assert(homeJs.includes("shiftTime(raw, planningRowForDate(iso) || {})") &&
       homeJs.includes('"shift:" + raw + "|" + time'),
  "home legend does not follow the displayed shifts/hours");
assert(planning.includes("workSymbol") &&
       planning.includes("STIPMonthTable?.shiftBadgeHtml?.(raw)") &&
       planning.includes('"shift:" + raw + "|" + time'),
  "planning legend must use the monthly symbol / actual hours");
assert(monthTableCss.includes(".stip-week-day,.stip-legend-item") &&
       core.includes(".stip-week-work-hours") &&
       visual.includes(".stip-week-work-hours"),
  "month badge styling must work in weekly cards and legends");
assert(core.includes(".stip-week-events.is-empty") &&
       core.includes("display:none!important"),
  "empty weekly event rows still take space");
assert(calendarRules.includes("Représentation hebdomadaire des shifts"),
  "weekly shift reference not documented");

const beginDay = homeJs.indexOf("  function dayCard(x, cls = ");
const endDay = homeJs.indexOf("  function weekEventsForDay(x)", beginDay);
assert(beginDay >= 0 && endDay > beginDay, "home personal renderer missing");
if (beginDay >= 0 && endDay > beginDay) {
  const source = homeJs.slice(beginDay, endDay);
  const escape = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;");
  const defs = {
    J4:{is_working:true,icon:"🟠",label:"J4"},
    RH:{is_working:false,icon:"🛋️",label:"Repos hebdomadaire"}
  };
  const symbol = value => '<span class="stip-month-shift-badge code-j4">' + escape(value) + '</span>';
  const timeBegin = homeJs.indexOf("  function weekTimeHtml(v)");
  const timeEnd = homeJs.indexOf("  function weekWorkSymbol(raw)", timeBegin);
  const formatHours = new Function("esc", homeJs.slice(timeBegin,timeEnd) + "return weekTimeHtml;")(escape);
  const renderCard = new Function("canonicalShift","shiftDefinition","shiftStatusIcon",
    "shiftMeta","workShiftIcon","shiftIconHtml","esc","weekTimeHtml","weekWorkSymbol",
    "weekEventsForDay","weekEventBadges","state",
    source + "return dayCard;")(
    x=>x,x=>defs[x],x=>defs[x]?.is_working?"" : defs[x]?.icon,
    x=>["other",defs[x]?.label||x],x=>defs[x]?.is_working?defs[x]?.icon:"",
    x=>escape(defs[x]?.icon||""),escape,formatHours,symbol,
    x=>x.events||[],x=>x.events?.length?'<span class="stip-week-events">📌</span>':
      '<span class="stip-week-events is-empty"></span>',
    {dayFocus:"2026-10-14"}
  );
  const sample=(code,date,time,events=[])=>({
    code,d:new Date(date+"T12:00:00"),iso:date,dow:3,today:true,
    row:{code},time,events
  });
  const worked=renderCard(sample("J4","2026-10-14","10h10–18h00"),"stip-week-day");
  const off=renderCard(sample("RH","2026-10-15",""),"stip-week-day");
  assert(worked.includes('stip-month-shift-badge') &&
         worked.includes("10h10") && worked.includes("18h00") &&
         !worked.includes('class="hc-shift-code'),
    "worked day duplicates the code or loses work hours");
  assert(off.includes("🛋️") && !off.includes('class="hc-shift-code') &&
         !off.includes('class="hc-status-code') &&
         !off.includes("stip-week-work-hours"),
    "nonworking day should show only its status pictogram");
  assert(worked.includes('data-home-day="2026-10-14"') &&
         worked.includes('aria-pressed="true"'),
    "weekly navigation/selection must stay intact");
}

assert(!homeCss.includes(".hc-calendar-driven-planning .hc-days-landscape .hc-week-event-chip"),
  "legacy home week marker sizing layer still exists");

if (!process.exitCode) console.log("STIP calendar raw/common contract OK");
