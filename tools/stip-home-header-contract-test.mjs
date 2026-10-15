import fs from "node:fs";
const read = file => fs.readFileSync(file,"utf8");
const assert = (ok,msg) => { if(!ok) throw Error(msg); };
const home = read("home-shell.js");
const shared = read("stip-page-header.js");
const css = read("stip-home-header.css");
const legacyHomeCss = read("home-shell.css");
const person = read("person-card-template.js");
const nav = home.slice(home.indexOf("function homeModeNav(part"),home.indexOf("function shortcutsPopup()"));
const body = home.slice(home.indexOf("function homeModeBody()"),home.indexOf("function render()"));
assert(nav.includes("ghe-home-topbar") && nav.includes("data-shortcuts-open") &&
       nav.includes('aria-controls="hcPersonalDrawer"') && nav.includes("data-bell-open"),
       "Menu et cloche doivent rester sur l'accueil");
assert(!nav.includes("tDoorShortcut()+") && !nav.includes("wheelchairShortcut()+'</span>"),
       "Les autres raccourcis ne doivent plus encombrer la ligne supérieure");
assert(nav.indexOf("hc-home-top-tools") < nav.indexOf("hc-home-meta-date") &&
       nav.indexOf("hc-home-meta-date") < nav.indexOf("ghe-premium-stage"),
       "Date et carte 360° doivent suivre les outils d'accueil");
assert(body.includes('${homeModeNav("tools")}') &&
       body.includes('${homeModeNav("identity")}') &&
       body.includes('${weekFlipCard()}') &&
       body.includes('${planningCalendarOverview()}') &&
       body.includes('${fixedShiftLegend()}') === false &&
       body.includes('const legend = fixedShiftLegend()') &&
       body.includes('${legend}') &&
       body.indexOf('${weekFlipCard()}') < body.indexOf('${planningCalendarOverview()}'),
       "L'accueil conserve sa composition simplifiée");
assert(!body.includes('${futureWidget()}') && !body.includes('leNouveauHomeCard()}') &&
       !body.includes('mobileAppShortcut()}'),"Les modules secondaires doivent sortir de l'accueil");
assert(home.includes('function personalDrawer()') && home.includes('function bindPersonalDrawer(root)') &&
       home.includes('data-ghe-drawer-search') && home.includes('data-ghe-drawer-future'),
       "Le tiroir doit conserver la recherche et les prochains rendez-vous");
assert(home.includes('if (!has("admin")) return "";') && home.includes('has("admin") ? [{title:"Administration"'),
       "Administration et son ancienne fenêtre restent réservées aux admins");
assert(nav.includes("ghe-home-header-stack") && shared.includes("ghe-home-header-stack"), "Carte d'identité commune manquante");
assert(!body.includes("todayFullDateSeparator()"), "Date en doublon");
assert(shared.indexOf("hc-home-top-tools") < shared.indexOf("hc-home-meta-date") &&
       shared.indexOf("hc-home-meta-date") < shared.indexOf("hc-home-identity") &&
       shared.indexOf("hc-home-identity") < shared.indexOf("hc-home-filters"), "En-tête commun altéré");
assert(css.includes("data-header-compact") && css.includes("prefers-reduced-motion"),"Styles d'en-tête commun absents");
assert(!legacyHomeCss.includes(".hc-home-filters") && !legacyHomeCss.includes(".hc-home-filter-art"),"Styles legacy concurrents");
assert(css.includes("--launcher-art-rest:88%") && css.includes("--launcher-art-active:98%") && css.includes("width:var(--launcher-art-active)!important"),"Effet canonique manquant");
assert(person.includes("stip-person-card-phone") && person.includes("agent.telephone"),"Téléphone profil manquant");
for(const file of ["index.html","esprit-equipe.html","responsable.html"]) {
 const page=read(file);
 assert(page.includes("stip-home-header.css?v="),file+" n'importe pas son en-tête commun");
 assert(page.includes("stip-home-scroll.js?v="),file+" n'importe pas la continuité du scroll");
}
assert(read("stip-home-scroll.js").includes("window.scrollY > 500"),"Contrat scroll commun absent");
assert(home.includes('anchor.insertAdjacentElement("afterend", followUps)') && home.includes('id="hcTopPriorityAnchor"'),"Retours actifs non associés au haut de l’accueil");
console.log("GHE simplified home + drawer contract OK");
