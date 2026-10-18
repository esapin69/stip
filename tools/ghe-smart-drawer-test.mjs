import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const rail=read("ghe-smart-drawer.js"),page=read("ghe-invitations.js"),shell=read("home-shell.js");
const api=read("supabase/functions/stip-leisure/index.ts");
const sql=read("supabase/migrations/20261016151500_ghe_smart_event_choices_and_date_alerts.sql");
const home=read("index.html"),leisure=read("sorties-loisirs.html");
for (const file of [home,leisure]) {
 assert.match(file,/ghe-smart-drawer\.css/,"styles deployed on main entrypoints");
 assert.match(file,/ghe-smart-drawer\.js/,"rail loaded on main entrypoints");
}
assert.match(rail,/\["closed","compact","expanded"\]/,"three positions");
assert.match(rail,/entries\.sort/,"chronological queue");
assert.match(rail,/ghe-agenda\.html/,"one dedicated page for pending work");
assert.match(rail,/series_conversation_id|ghe:agenda-change/,"refresh tied to canonical events");
assert.match(page,/data-day-decision/);
assert.match(page,/call\("respond_day"/,"response written through server");
assert.match(page,/data-show-roster/,"roster actionable");
assert.match(page,/series_conversation_id/,"one canonical group chat");
assert.match(shell,/STIPDrawerAppointments/,"existing professional dates retained");
assert.match(api,/b.action==='respond_day'/,"backend decision action");
assert.match(api,/stip_leisure_answer_day/,"server per-date RPC");
assert.match(sql,/stip_leisure_date_decisions/);
assert.match(sql,/stip_leisure_dates_changed_log/);
assert.match(sql,/old_responses/,"change history preserved");
assert.doesNotMatch(rail,/rail\.showModal\(/,"the rail itself must never become a dialog");
assert.match(rail,/data-smart-pending-open/,"only one shared pending action entry");
assert.match(rail,/function openPendingDialog\(/,"shared action opens a real popup");
assert.match(rail,/group\.items\.map/,"each pending item retains its event icon");
assert.match(rail,/STIPDrawerActionItems/,"professional actions share the same inbox");
assert.match(rail,/ghe-action-inbox\.svg/,"unique visual identity for action group");
assert.match(shell,/STIPDrawerActionItems/,"professional action source is wired");

assert.match(read("ghe-smart-drawer.js"),/date_change_history/,"rail exposes cancelled historical dates");
assert.match(read("ghe-invitations.js"),/is-cancelled/,"pending page shows cancelled original dates");
assert.match(api,/date_change_history/,"backend supplies changes and old dates");
const retention=read("supabase/migrations/20261016162000_ghe_ephemeral_chat_retention.sql");
assert.match(retention,/stip_purge_expired_leisure/,"event + seven-day retention task");
assert.match(retention,/stip_leisure_series_chat/,"preserve active canonical event chats");
assert.match(retention,/leisure_response_chat_sync/,"disable legacy per-day chat creation");
const decline=read("supabase/migrations/20261016163000_ghe_leave_declined_event_chat.sql");
assert.match(decline,/status <> 'declined'/,"declined participants leave the group");
const communication=read("COMMUNICATION_RULES.md");
assert.match(communication,/refus global.*retire/i,"shared communications contract excludes global refusals");
// Regression: an organizer's ten proposals are not ten confirmed events.
import vm from "node:vm";
const groupedSource=rail.slice(rail.indexOf("function groupedEntries(){"),rail.indexOf("function link(entry){"));
assert(groupedSource.startsWith("function groupedEntries(){"),"group source available");
const event={
 id:"muscu",title:"Muscu",icon:"🏋️",is_organizer:true,status:"active",
 dates:["2026-10-16","2026-10-19","2026-10-20"],date_roster:{
  "2026-10-16":[{state:"organizer",compatible:true}],
  "2026-10-19":[{state:"organizer",compatible:true}],
  "2026-10-20":[{state:"organizer",compatible:true}]
 }
};
const actions=[{id:"leave-1",title:"Demande de congés",type:"leave",date:"2026-10-23"}];
const context={
 events:[event],today:()=>"2026-10-16",dlabel:s=>s,
 window:{
  STIPDrawerAppointments:()=>({groups:[{key:"upcoming",items:[]},{key:"feedback",items:[]}]}),
  STIPDrawerActionItems:()=>actions
 },
 route:s=>"/"+s,urlForEvent:e=>"/leisure/"+e.id,encodeURIComponent
};
const entries=()=>vm.runInNewContext(groupedSource+";groupedEntries();",context);
let result=entries(),groups=result.filter(x=>x.kind==="pending");
assert.equal(result.filter(x=>x.kind==="event").length,0,"no date has accepted participants yet");
assert.equal(groups.length,1,"exactly one universal pending icon");
assert.equal(groups[0].count,4,"three Muscu dates and one professional action are grouped");
assert.equal(groups[0].date,"2026-10-16","group appears at the nearest pending date");
event.date_roster["2026-10-19"].push({state:"accepted",compatible:true});
result=entries();groups=result.filter(x=>x.kind==="pending");
assert.equal(result.filter(x=>x.kind==="event").length,1,"only the date with an actual confirmed participant appears");
assert.equal(result.find(x=>x.kind==="event").date,"2026-10-19");
assert.equal(groups.length,1,"other unconfirmed dates remain under one icon");
assert.equal(groups[0].count,3,"remaining two dates and professional action grouped");
assert.match(rail,/data-smart-pending-open/,"single action icon opens the shared popup");
assert.match(rail,/gheSmartExpand/,"one exterior bookmark-like chevron");
assert.doesNotMatch(rail,/data-ctrl="expand"/,"no second arrow inside the header");
assert.match(rail,/ghe-smart-close/,"expanded mode has one top-right close cross");
assert.match(rail,/setMode\(mode==="closed"\?"compact":"closed"\)/,"original hamburger opens the compact drawer");
assert.match(rail,/if\(reopen\)\{event.preventDefault\(\);setMode\("compact"\)/,"three bars reopen to icons");
assert.match(rail,/mode==="expanded"&&!document.getElementById/,"outside tap collapses to icons");
assert.match(rail,/ghe-smart-admin-tools/,"nonessential shortcuts are behind Admin");
assert.match(rail,/const destination=event.target.closest/,"destination collapses to icons");
const style=read("ghe-smart-drawer.css");
assert.match(style,/\.ghe-smart-expand-tab/,"one exterior arrow style");
assert.match(style,/#gheSmartRail:not\(\[data-mode="expanded"\]\) \.ghe-smart-close\{display:none!important/,"compact rail hides the close cross and uses one chevron");
assert.match(style,/\.ghe-smart-rail[^\n]*background:#fff/,"solid white drawer surface");
assert.match(style,/data-smart-drawer="closed"\] #homeView \[data-shortcuts-open\]/,"hamburger visible only when closed");
assert.match(read("ensemble-v3.js"),/deepLinked=true;openEvent\(id,\{inline:true\}\)/,"direct activity links render a single inline detail page");
assert.match(read("ensemble-v3.css"),/\.ev3-inline-detail/,"inline detail receives page layout");

// The same drawer occupies the mobile layout on every authenticated document.
// Most pages reuse STIPNav; standalone exceptions include the identical CSS/JS.
const sharedNav=read("stip-navigation.js");
const drawerCss=read("ghe-smart-drawer.css");
assert.match(sharedNav,/const ensureSmartDrawer = \(\) =>/,"shared navigation mounts the canonical drawer");
assert.match(sharedNav,/localStorage\.getItem\("stip_session_v1"\)/,"guest pages do not mount a private drawer");
assert.match(sharedNav,/window\.self !== window\.top/,"embedded pages do not acquire a second sidebar");
assert.match(sharedNav,/script\[src\*="ghe-smart-drawer\.js"\]/,"pages with an existing drawer do not import twice");
assert.match(drawerCss,/body\.ghe-smart-active :is\(main, \.app-shell, #appView, #homeView, \.view\)/,"page containers fit the remaining mobile width");
for (const path of ["places.html","mon-compte.html"]) {
  const standalone=read(path);
  assert.match(standalone,/ghe-smart-drawer\.css/,`${path} includes shared styles`);
  assert.match(standalone,/ghe-smart-drawer\.js/,`${path} includes canonical script`);
}
const authenticatedPages=[
  "access-manage.html","agent-date-detail.html","agent-dates.html",
  "agent-directory.html","agent-readonly.html","application-mobile.html",
  "assistant.html","cadre-activite.html","cadre-documents.html",
  "cadre.html","control.html","depot.html","dudy-admin.html",
  "esprit-equipe.html","ghe-agenda.html","le-nouveau.html",
  "meeting-notes.html","places-app.html","places-export.html",
  "planning-compare-app.html","responsable-agenda.html","responsable-demandes.html",
  "responsable-evaluations.html","responsable.html","signature-agent.html",
  "sorties-loisirs.html"
];
for(const path of authenticatedPages){
 const html=read(path);
 assert.match(html,/stip-navigation\.js|ghe-smart-drawer\.js/,`${path} has a common drawer entrypoint`);
}

console.log("GHE smart drawer contract passed.");


// RDV / home accessibility and active-icon regression (2026-10-18).
assert.match(rail,/data-smart-home data-smart-active-key="home"/,"house is explicitly routed outside popup choice handlers");
assert.match(rail,/if\(home\)\{event\.preventDefault\(\);event\.stopImmediatePropagation\(\);goHomeDirect\(\);return;\}/,"home click must stop popup delegation");
assert.match(rail,/function goHomeDirect\(\)\{[\s\S]*?setMode\("closed"\)/,"house closes rail, including persisted mode");
assert.match(rail,/location\.assign\(target\.href\)/,"house routes to the actual home document");
assert.match(rail,/function ensureRdvQuick\(\)/,"legacy RDV button is removed without removing its destination");
assert.match(rail,/function openRdvDialog\(\)/,"RDV opens one centered dialog");
assert.doesNotMatch(rail,/<div class="ghe-smart-rdv-dock"><button/,"RDV is removed from the rail");
assert.match(shell,/function agenda360Markup\(\)/,"RDV belongs to the home flip card");
assert.match(rail,/appointmentDays\(entries\)/,"RDV uses canonical grouped data");
assert.match(rail,/data-smart-date-open/,"one date = one calendar icon remains intact");
assert.match(style,/ghe-smart-active-zoom/,"active destination gets visible zoom");
assert.match(style,/prefers-reduced-motion:reduce/,"animations honor OS accessibility settings");
assert.match(read("ghe-smart-choices.js"),/data-ghe-choice-item/,"unified hub offers grouped choices");

// The global choice popup must not intercept the house before the rail click handler.
const choice=read("ghe-choice-master.js");
assert.match(choice,/el\.closest\("#gheSmartRail,#gheSmartDrawerPanel,#gheSmartGlobalSearch"\)/,"global modal must not intercept rail clicks");
assert.match(choice,/#gheSmartRail,#gheSmartRdvDialog/,"RDV event details continue to the requested destination");


// Contrat d'interface : maison, recherche, créer+calendrier, chat+apps, réserve, réglages.
const compact=rail.slice(rail.indexOf('const markup=\'<header class="ghe-smart-head"'),rail.indexOf(' // Keep the search input'));
assert(compact.length>0,"markup du rail présent");
const order=["homeLink+","pending+divider+","data-smart-create-open","(appointments||navLink","data-smart-chat-open","apps+","ghe-smart-reserved-slot","ghe-smart-search-dock","data-smart-search-open","ghe-smart-settings-dock","data-smart-settings-open"];
let previous=-1;
for(const token of order){const index=compact.indexOf(token);assert(index>previous,"ordre du tiroir : "+token);previous=index;}
assert.match(rail,/appointmentDays\(entries\)\.map\(calendarDayGroup\)/,"les dates doivent rester visibles directement");
assert.match(compact,/apps\+/, "les applications restent visibles après les messages");
assert.match(rail,/function openNavDialog\(kind\)/,"recherche, applications et réglages disponibles");
assert.match(rail,/function appEntries\(\)/,"applications et permissions conservées");
assert.match(rail,/function openDeferredSettings\(\)/,"réglages accessibles depuis les pages annexes");
assert.doesNotMatch(shell.slice(shell.indexOf("function homeModeNav(part"),shell.indexOf("function shortcutsPopup()")),/ghe-top-aux-actions/,"les icônes redondantes du haut disparaissent");
assert.match(read("ghe-leisure-quick.js"),/window\.GHELeisureQuick=\{show\}/,"création rapide préservée via ➕");
assert.match(read("ghe-smart-choices.js"),/leisureQuick/,"la création rapide est accessible depuis le menu Ajouter");

/* Accueil 360 : propositions côté rendez-vous, pas sur la face À clôturer. */
const agendaMarkup=shell.slice(shell.indexOf("function agenda360Markup()"),shell.indexOf("function bindAgenda360("));
const frontFace=agendaMarkup.slice(agendaMarkup.indexOf('data-agenda360-face="front"'),agendaMarkup.indexOf('data-agenda360-face="back"'));
const backFace=agendaMarkup.slice(agendaMarkup.indexOf('data-agenda360-face="back"'));
assert.doesNotMatch(frontFace,/data-agenda360-proposals/,"colleague proposals must not appear among feedback to close");
assert.match(backFace,/data-agenda360-proposals/,"colleague proposals belong with upcoming appointments");
assert.match(agendaMarkup,/const hasOpen=feedback\.length>0;/,"proposals alone must not force a blank À clôturer face");
assert.match(shell.slice(shell.indexOf("function bindAgenda360("),shell.indexOf("function homeModeBody()")),/const available=feedback;/,"live face sync only counts feedback");
assert.match(shell,/GHESmartChoices\?\.show\?\.\("proposals"\)/,"proposal button must still open its existing popup");
const topBarCss=read("ghe-premium-safe-flip.css");
assert.match(topBarCss,/transform:translateX\(-clamp\(30px,10vw,65px\)\)!important;/,"En direct should be moved left responsively");


// En direct sur le rail : classement compact et un seul chemin d'action au clic.
assert.match(rail,/group\.items\.map\(item=>\{/,"dated groups use a compact detail rather than repeat the date");
assert.match(rail,/function showDrawerChoice\(destination\)/,"all drawer items use the same choice dialog");
assert.match(rail,/event\.stopImmediatePropagation\(\);\s*selectIcon\(detailLink/,"expanded event cards are not also handled by the global click listener");
assert.match(rail,/const pendingDialog=destination\.closest\("#gheSmartPendingDialog"\)/,"pending popup remains actionable");
assert.match(rail,/openDestination:navigateDrawerDestination/,"one canonical destination dispatcher is exposed");
const choiceAction=read("ghe-choice-master.js");
assert.match(choiceAction,/#gheSmartPendingDialog/,"pending entries get the same continuation behavior");
assert.match(choiceAction,/GHE\w*Drawer\?\.openDestination\?\.\(el\)/,"the choice button opens its real destination, without a replayed click");
assert.match(style,/#gheSmartRail\[data-mode="expanded"\] \.ghe-smart-date-details \.ghe-smart-link\{/,"expanded RDV rows are compact");
assert.match(read("ghe-smart-choices.js"),/feedback_key=/,"feedback popup has a direct fallback");

assert.match(style,/#gheSmartRail \.ghe-smart-search-dock\{/,"loupe isolated in its dedicated bottom dock");
assert.match(rail,/ghe-smart-search-dock/, "global search stays in a fixed dock above settings");
assert.doesNotMatch(compact.slice(compact.indexOf("'ghe-smart-scroll ghe-smart-navigation"),compact.indexOf("ghe-smart-search-dock")),/data-smart-search-open/,"search is no longer mixed into the appointment navigation");

// Panneaux du tiroir : même position et comportement que la recherche, sans modale.
const lateral=read("ghe-drawer-inline-panels.js");
assert.match(read("index.html"),/ghe-drawer-inline-panels\.js/,"the unified side panel is loaded");
assert.match(read("stip-navigation.js"),/ghe-drawer-inline-panels\.js/,"standalone authenticated pages load the same panel");
assert.match(lateral,/className="ghe-global-search-panel ghe-smart-side-panel"/,"reuses search's panel master");
assert.match(lateral,/function sync\(focus=false\)/,"panels follow drawer mode and anchor");
assert.match(lateral,/function preserve\(\)/,"panels survive rail re-render");
assert.match(lateral,/function close\(\)/,"panel closes without navigation");
assert.match(lateral,/role","region"/,"drawer panels are nonmodal regions");
assert.doesNotMatch(lateral,/showModal\(/,"drawer panels never invoke a native modal");
assert.match(rail,/GHEDrawerPanels\?\.open\("pending"/,"pending click opens side panel");
assert.match(rail,/GHEDrawerPanels\?\.open\("date"/,"date click opens side panel");
assert.match(rail,/GHEDrawerPanels\?\.open\("detail"/,"event and shortcut details open side panel");
assert.match(rail,/GHEDrawerPanels\?\.open\(createChat/,"create and chat open side panel");
assert.match(rail,/GHEDrawerPanels\?\.open\(nav/,"settings and apps open side panel");
assert.match(read("ghe-smart-choices.js"),/GHESmartChoices=\{show,entriesFor,choose\}/,"choice actions are reusable without modal");
assert.match(style,/\.ghe-smart-side-panel/,"shared nonmodal panel has a styled mobile layout");
console.log("GHE side panel contract passed.");

for(const page of ["places.html","mon-compte.html"])assert.match(read(page),/ghe-drawer-inline-panels\.js/,"standalone page uses same panels");
