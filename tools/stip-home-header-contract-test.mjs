import fs from "node:fs";
const read = (file) => fs.readFileSync(file, "utf8");
const assert = (value, msg) => { if (!value) throw Error(msg); };
const home = read("home-shell.js");
const shared = read("stip-page-header.js");
const css = read("stip-home-header.css");
const nav = home.slice(home.indexOf("function homeModeNav()"), home.indexOf("function shortcutsLauncher()"));
const body = home.slice(home.indexOf("function homeModeBody()"), home.indexOf("function render()"));
assert(nav.indexOf('hc-home-top-tools') < nav.indexOf('hc-home-meta-date') &&
  nav.indexOf('hc-home-meta-date') < nav.indexOf('hc-home-identity') &&
  nav.indexOf('hc-home-identity') < nav.indexOf('hc-home-filters'), "Personal header order changed");
assert(nav.includes('label: "Mon espace"'), "Personal header tab name changed");
assert(nav.includes('showChief: state.homeMode === "planning"'), "Duty chief must not leak onto Applications or Notifications");
assert(!body.includes("todayFullDateSeparator()"), "Duplicate date in planning body");
assert(body.indexOf("weekWidget()") < body.indexOf("agendaAlertBanner()"), "Week must precede expanded alert banner");
assert(shared.indexOf('hc-home-top-tools') < shared.indexOf('hc-home-meta-date') &&
  shared.indexOf('hc-home-meta-date') < shared.indexOf('hc-home-identity') &&
  shared.indexOf('hc-home-identity') < shared.indexOf('hc-home-filters'), "Shared native header order changed");
assert(shared.includes('<strong>Mon espace</strong>'), "Native tab label changed");
assert(css.includes("data-header-compact") && css.includes("prefers-reduced-motion"), "Shared responsive header styles missing");
for (const file of ["index.html","esprit-equipe.html","responsable.html"]) {
  const page=read(file);
  assert(page.includes("stip-home-header.css?v="), file+" missing shared styles");
}
console.log("GHE common header contract: OK");