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
const flipCss = read("ghe-flip-actions.css");
const index = read("index.html");
const weekCard = home.slice(home.indexOf("function weekFlipCard()"),home.indexOf("function syncWeekFlipHeight("));
const liveBack = home.slice(home.indexOf("function premiumBackMarkup()"),home.indexOf("function syncPremiumStageHeight("));
const monthCard = home.slice(home.indexOf("function monthFlipCard("),home.indexOf("function weekWidget()"));
assert((weekCard.match(/ghe-weekflip-turn[^"]*ghe-flip-cta/g)||[]).length === 2,"La semaine doit avoir deux CTA premium");
assert((nav.match(/ghe-premium-turn ghe-flip-cta/g)||[]).length === 2,"Le profil doit avoir deux CTA premium");
assert((monthCard.match(/ghe-monthflip-turn[^"]*ghe-flip-cta/g)||[]).length === 2,"Le mois doit avoir deux CTA premium");
assert(!liveBack.includes("data-premium-turn-close") &&
       nav.includes('ghe-premium-back-footer') && nav.includes('data-premium-turn-close'),
       "Le retour En direct doit rester en bas de la face");
assert(flipCss.includes("--ghe-flip-start:#e51d49") &&
       flipCss.includes(".ghe-flip-cta-dot") &&
       flipCss.includes("--ghe-flip-start:#116fc9") &&
       flipCss.includes("--ghe-flip-start:#0e6e81"),
       "Style rouge/bleu/turquoise des trois blocs 360 manquant");
assert(index.includes('ghe-flip-actions.css?v=') &&
       index.indexOf('home-month-flip.css?v=') < index.indexOf('ghe-flip-actions.css?v='),
       "Le style partagé doit être chargé après les autres styles des flips");
// Back-side CTAs alone are black; keep the three opening brand colors untouched.
for (const back of [
  ".ghe-weekflip-back>.ghe-flip-cta",
  ".ghe-monthflip-back>.ghe-flip-cta",
  ".hc-home-top-nav[data-header-compact] .ghe-premium-back .ghe-flip-cta"
]) assert(flipCss.includes(back), "Bouton retour noir manquant : " + back);
assert(flipCss.includes("--ghe-flip-start:#222329") &&
       flipCss.includes("--ghe-flip-mid:#111216") &&
       flipCss.includes("--ghe-flip-end:#050608"),
       "Le bouton de retour doit être noir avec texte blanc");
const currentBuild = index.match(/<meta\\s+name="stip-ui-build"\\s+content="([^"]+)"/)?.[1];
assert(Boolean(currentBuild) &&
       index.includes("ghe-flip-actions.css?v=" + currentBuild) &&
       index.includes("stip-loader.js?v=" + currentBuild) &&
       index.includes("stip-sw.js?v=" + currentBuild),
       "La version de style/cache doit être synchronisée");
assert(read("stip-loader.js").includes('V = "' + currentBuild + '"') &&
       read("stip-sw.js").includes('STIP_SW_BUILD="' + currentBuild + '"'),
       "Loader/service worker doivent suivre la version UI");
assert(flipCss.includes(".ghe-premium-front-footer>.ghe-flip-cta") &&
       flipCss.includes(".ghe-premium-back-footer>.ghe-flip-cta") &&
       flipCss.includes("width:clamp(220px,62%,350px)!important") &&
       flipCss.includes("min-height:44px!important"),
       "Les boutons En direct et retour doivent partager leur gabarit compact");
const nowCss = read("ghe-premium-safe-flip.css");
assert(liveBack.includes('ghe-premium-now-summary') &&
       liveBack.includes('ghe-premium-now-identity') &&
       liveBack.includes('ghe-premium-now-person') &&
       liveBack.includes('ghe-premium-now-shift'),
       "En direct doit afficher noms, horaires et shifts immédiatement");
assert(!liveBack.includes('homeDutyChiefNowHost') &&
       !liveBack.includes('RELÈVE') && !liveBack.includes('chef') &&
       !home.includes('STIPDutyChiefs') && !home.includes('openPremiumRoster('),
       "En direct ne doit pas charger de chef ou de relève future");
assert(home.includes('const person=event.target.closest("[data-premium-now-person][data-premium-agent]")') &&
       nowCss.includes('.ghe-premium-now-identity strong'),
       "Les agents doivent être lisibles et ouvrables");
assert(index.includes('ghe-premium-safe-flip.css?v=20261016-live-roster-black3') &&
       index.includes("home-shell.js?v=" + currentBuild),"Cache bust incohérent");
console.log("GHE header + 360° black returns + current roster contract OK");
