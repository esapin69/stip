import fs from "node:fs";
import vm from "node:vm";

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
assert(core.includes(".stip-week-day.stip-week-personal-layout{min-height:112px!important}"),
  "profile-only fixed week height is missing");
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
const mainBuild = mainIndex.match(/name="stip-ui-build" content="([^"]+)"/)?.[1];
assert(mainBuild && mainIndex.includes("stip-month-table.css?v=" + mainBuild) &&
  mainIndex.includes("stip-month-table.js?v=" + mainBuild),
  "main app does not load the shared monthly table");
assert(metiersIndex.includes("stip-month-table.css?v=20261018-month-rest-codes1") && metiersIndex.includes("stip-month-table.js?v=20261018-month-rest-codes1"),
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
const homeRender=homeJs.split("function homeModeBody()")[1]?.split("function render()")[0] || "";
const flipBack=homeJs.split("function weekFlipBack()")[1]?.split("function weekFlipCard()")[0] || "";
const flipCard=homeJs.split("function weekFlipCard()")[1]?.split("function syncWeekFlipHeight(")[0] || "";
const flipCss=read("home-week-flip.css");
// La semaine courante reste en 5 + 2 ; seul le lundi suivant peut être affiché à part.
assert(weekEngine.includes("function fullDates") && weekEngine.includes("function upcomingSevenDates"),
  "le moteur de calendrier canonique doit conserver tous ses consommateurs");
assert(homeJs.includes("function weekFlipDates()") &&
       homeJs.includes("STIPWeekEngine?.fullDates?.({ weekOffset: 0 }, { today })"),
  "la semaine en cours doit provenir exclusivement du moteur maitre");
assert(flipBack.includes("current.slice(0,5)") && flipBack.includes("current.slice(5)") &&
       flipBack.includes("weekFlipDates()") &&
       !flipBack.includes("weekFlipDates(1)") &&
       flipBack.includes("ghe-weekflip-next-divider") &&
       flipBack.includes("${weekFlipNextMonday()}"),
  "verso : 5 jours puis weekend de 2 jours, sans semaine suivante");
assert(flipCard.includes('class="hc-days-grid"') &&
       flipCard.includes('id="hcTeamFusion"') &&
       flipCard.includes('id="hcTomorrowFusion"'),
  "recto : Aujourd'hui et Demain restent ensemble avec les memes composants");
assert(homeRender.includes("${weekFlipCard()}") &&
       !homeRender.includes("${weekWidget()}") &&
       !homeRender.includes("${planningWeekSeparator()}"),
  "l'ancien bloc glissant est remplace par un unique composant recto-verso");
assert(flipCard.includes('data-week-turn-open') && flipCard.includes('data-week-turn-close') &&
       flipCard.includes('inert aria-hidden="true"') &&
       homeJs.includes('const weekFlip=root.querySelector("[data-week-flip]")'),
  "le bloc doit pouvoir tourner et la face inactive etre inaccessible");
assert(homeJs.includes("prepareWeekFlip(root)") &&
       homeJs.includes("syncWeekFlipHeight(weekFlip)") &&
       flipCss.includes("backface-visibility:hidden") &&
       flipCss.includes("rotateY(180deg)"),
  "le retournement 3D doit utiliser une hauteur adaptee et les faces masquees");
assert(homeJs.includes("STIPMonthTable?.shiftBadgeHtml?.(x.code)") &&
       homeJs.includes("weekEventBadges(x)") &&
       !flipBack.includes("hc-rolling-monday-flag"),
  "shifts badges du mois, evenements centres, pas de repere LUNDI");
assert(flipCss.includes("grid-template-columns:repeat(5,minmax(0,1fr))") &&
       flipCss.includes("grid-template-columns:repeat(2,minmax(0,1fr))") &&
       flipCss.includes(".ghe-weekflip-next-divider") &&
       flipCss.includes(".ghe-weekflip-next-action"),
  "le verso doit utiliser deux rangs : 5 jours puis 2 jours");
assert(flipCss.includes("background:#f1f5f6!important") &&
       flipCss.includes("background:#fff!important") &&
       flipCss.includes("border-bottom:3px solid") &&
       !flipCss.includes("80%,#fff"),
  "le verso doit utiliser des surfaces neutres sans imposer le bleu par defaut");
const flipDay=homeJs.split("function weekFlipDay(")[1]?.split("function weekFlipBack()")[0] || "";
assert(!flipDay.includes("ghe-weekflip-rest-icon") &&
       !flipDay.includes("shiftStatusIcon(canonical)") &&
       flipDay.includes("ghe-weekflip-rest-code") &&
       flipDay.includes("weekEventBadges(x)"),
  "les repos restent des codes seuls sur le verso et les rendez-vous sont conserves");
assert(flipCard.includes("Voir cette semaine") &&
       !flipCard.includes("Voir les deux semaines"),
  "le bouton de retournement annonce la semaine en cours");
assert(homeJs.includes("function weekFlipNextMonday()") &&
       homeJs.includes("STIPWeekEngine?.fullDates?.({ weekOffset: 1 }, { today: parisIso() })?.[0]") &&
       homeJs.includes("working && day.time") &&
       flipBack.includes("${weekFlipNextMonday()}") &&
       !flipBack.includes("weekFlipDates(1)"),
  "l'aperçu doit afficher uniquement le lundi suivant et son horaire de planning");
const preview=homeJs.split("function weekFlipNextMonday()")[1]?.split("function weekFlipBack()")[0] || "";
assert(preview.includes("STIPMonthTable?.shiftBadgeHtml?.(day.code)") &&
       preview.includes("ghe-weekflip-monday-preview") &&
       preview.includes("Horaire non communiqué") &&
       !preview.includes("weekEventBadges("),
  "lundi prochain : code, horaire connu ou indisponible, pas de semaine supplementaire");
assert(flipCss.includes("height:auto!important") &&
       flipCss.includes("grid-template-rows:auto!important") &&
       homeJs.includes('track.style.removeProperty("height")') &&
       !homeJs.includes('track.style.height=height+"px"'),
  "recto et verso doivent occuper la meme hauteur naturelle, meme avec les images");
assert(flipCss.includes(".ghe-weekflip-day.work .ghe-weekflip-day-head") &&
       flipCss.includes("var(--weekflip-marker) 17%,white") &&
       flipCss.includes(".ghe-weekflip-monday-preview.stip-week-day"),
  "le style doit reprendre les nuances des shifts sans imposer un fond bleu");
assert(!flipBack.includes("data-week-step") &&
       !flipBack.includes("weekFlipDates(1)") &&
       flipBack.includes("ghe-weekflip-next-divider"),
  "le verso ne doit pas avoir de fleches de navigation ou de seconde semaine");

const eventBadges = homeJs.split("function weekEventBadges(")[1]?.split("function weekDisplayModel(")[0] || "";
assert(eventBadges.includes("events.slice(0, 2)") &&
       eventBadges.includes("hc-rolling-event-overflow"), "au-delà de deux repères, afficher un compteur");
const eventSources = homeJs.split("function weekEventsForDay(")[1]?.split("function weekEventBadges(")[0] || "";
assert(eventSources.includes("STIPLeisure?.dayItems") &&
       !eventSources.includes("STIPDutyChiefs"), "loisirs presents, chefs absents des cartes");
const teamFusion=read("team-home-fusion.js");
assert(teamFusion.includes("async function openDate(") &&
       teamFusion.includes("window.STIPTeamFusion={mount,openDate}") &&
       homeJs.includes("STIPTeamFusion.openDate({ ...sharedTeamOptions, day: iso })"),
       "le popup du jour doit rester partage");
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
assert(/const weekDay\s*=\s*b\.classList\.contains\("stip-week-day"\)/.test(homeJs) &&
       homeJs.includes("STIPTeamFusion.openDate({ ...sharedTeamOptions, day: iso })"),
  "weekly day button must declare its local state and open the shared detail popup");
assert(!/\n\s*weekDay\s*=\s*b\.classList\.contains\("stip-week-day"\)/.test(homeJs),
  "weekly day button must not assign an undeclared variable");
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
assert(homeJs.includes("stip-week-personal-layout"), "home week does not opt into its personal reserved-row layout");
assert(homeJs.includes('shiftDefinition(canonical)?.is_working === true') &&
       homeJs.includes('? "" // Une journée travaillée'),
  "home worked shifts must show their code, with no work icon or marker");
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

// Behavioral check against the actual shared monthly renderer.
const monthlyWindow = { STIPShiftRegistry: {
  resolve(code) {
    return {
      R: { kind: "rest", family: "off", label: "Repos", is_working: false },
      RH: { kind: "leave", family: "rh", label: "Congé", is_working: false },
      RTT: { kind: "rest", family: "off", label: "RTT", is_working: false },
      CP: { kind: "leave", family: "rh", label: "Congé payé", is_working: false },
      J4: { kind: "work", family: "j4", label: "J4", is_working: true },
    }[code] || null;
  },
  baseCode(code) { return String(code).trim().toUpperCase().replace(/\*+$/, ""); },
} };
vm.runInNewContext(monthTableJs, {
  window: monthlyWindow,
  document: { readyState: "loading", addEventListener() {} },
  MutationObserver: class {},
});
const nonWork = monthlyWindow.STIPMonthTable?.nonWorkCodeBadgeHtml;
assert(typeof nonWork === "function", "monthly nonworking-code renderer missing");
if (typeof nonWork === "function") {
  for (const code of ["R", "RH", "RTT", "CP", "CA", "OFF"]) {
    const badge = nonWork(code);
    assert(badge.includes(`>${code}</span>`) && badge.includes("stip-month-nonwork-badge"),
      `monthly nonworking code ${code} was not rendered as letters`);
  }
  assert(nonWork("J4") === "", "working shift must never use the nonworking code badge");
  assert(nonWork("") === "", "missing planning code must remain empty");
  assert(nonWork("UNKNOWN") === "", "unknown codes must not be silently classified as rest");
}
assert(homeJs.includes("nonWorkCodeBadgeHtml?.(shift.raw || shift.code)"), "home month not using rest code badge");
assert(planning.includes("nonWorkCodeBadgeHtml?.(rawDisplay)"), "personal month not using rest code badge");
assert(metiersJs.includes("nonWorkCodeBadgeHtml?.(code)") && metiersJs.includes("shiftVisual(item, true)"), "métiers month not using rest code badge");
assert(agentJs.includes("nonWorkCodeBadgeHtml?.(row.code||row.source_value||\"\")"), "agent month not using rest code badge");
assert(monthTableCss.includes(".stip-month-nonwork-badge.kind-rest") && monthTableCss.includes(".stip-month-nonwork-badge.kind-leave"), "month rest/leave badge styling missing");
if (!process.exitCode) console.log("STIP calendar raw/common contract OK");
