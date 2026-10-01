import fs from "node:fs";
const read = (file) => fs.readFileSync(file, "utf8");
const assert = (value, msg) => { if (!value) throw Error(msg); };
const home = read("home-shell.js");
const shared = read("stip-page-header.js");
const css = read("stip-home-header.css");
const legacyHomeCss = read("home-shell.css");
const person = read("person-card-template.js");
const nav = home.slice(home.indexOf("function homeModeNav()"), home.indexOf("function shortcutsLauncher()"));
const body = home.slice(home.indexOf("function homeModeBody()"), home.indexOf("function render()"));
assert(nav.indexOf('hc-home-top-tools') < nav.indexOf('hc-home-meta-date') &&
  nav.indexOf('hc-home-meta-date') < nav.indexOf('hc-home-identity') &&
  nav.indexOf('hc-home-identity') < nav.indexOf('hc-home-filters'), "Personal header order changed");
assert(nav.includes('label: "Mon espace"'), "Personal header tab name changed");
assert(!nav.includes('homeDutyChiefNowHost'), "Duty chief must remain outside header");
assert(!body.includes("todayFullDateSeparator()"), "Duplicate date in planning body");
assert(nav.includes("ghe-home-header-stack") && shared.includes("ghe-home-header-stack"), "Common visual component missing");
assert(body.indexOf('weekWidget()') < body.indexOf('id="homeDutyChiefNowHost"') && body.indexOf('id="homeDutyChiefNowHost"') < body.indexOf('AU MOIS'), "Chief must be below week");
assert(body.indexOf("weekWidget()") < body.indexOf("agendaAlertBanner()"), "Week must precede expanded alert banner");
assert(shared.indexOf('hc-home-top-tools') < shared.indexOf('hc-home-meta-date') &&
  shared.indexOf('hc-home-meta-date') < shared.indexOf('hc-home-identity') &&
  shared.indexOf('hc-home-identity') < shared.indexOf('hc-home-filters'), "Shared native header order changed");
assert(shared.includes('<strong>Mon espace</strong>'), "Native tab label changed");
assert(css.includes("data-header-compact") && css.includes("prefers-reduced-motion"), "Shared responsive header styles missing");
assert(!legacyHomeCss.includes(".hc-home-filters") && !legacyHomeCss.includes(".hc-home-filter-art"), "Legacy Home CSS still competes with the canonical launcher component");
assert(css.includes("--launcher-art-rest:88%") && css.includes("--launcher-art-active:98%") && css.includes("width:var(--launcher-art-active)!important") && css.includes("transform:scale(1.025)!important"), "Active launcher artwork must visibly grow from the canonical rest size");
assert(person.includes("stip-person-card-phone") && person.includes("agent.telephone"), "Shared identity phone is missing");
for (const file of ["index.html","esprit-equipe.html","responsable.html"]) {
  const page=read(file);
  assert(page.includes("stip-home-header.css?v="), file+" missing shared styles");
  assert(page.includes("stip-home-scroll.js?v="), file+" missing return-to-top control");
}
assert(read("stip-home-scroll.js").includes("window.scrollY > 500"), "Return-to-top must stay contextual");
assert(read("event-feedback.js").includes('week.insertAdjacentElement("afterend", host)'), "Pending feedback must follow, not bury, the week");
console.log("GHE common header contract: OK");