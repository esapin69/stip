import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const fail=(message)=>{throw new Error("[Communication contract] "+message)};
const has=(text,needle,message)=>{if(!text.includes(needle))fail(message)};

const app=read("communication-app.js");
const communicationApp=app;
const home=read("home-shell.js");
const quick=read("quick-access.js");
const accessRuntime=read("access-runtime.js");
const accessManage=read("access-manage.js");
const loader=read("stip-loader.js");
const appRuntime=read("app.js");
const hub=read("communication-hub.js");
const chat=read("team-chat.js");
const chatCss=read("team-chat.css");
const selector=read("stip-agent-selector.js");
const sw=read("stip-sw.js");
const messages=read("supabase/functions/stip-messages/index.ts");
const rules=read("COMMUNICATION_RULES.md");
const migration=read("supabase/migrations/20260927225000_communication_notification_types.sql");
const dmMigration=read("supabase/migrations/20260925151500_notification_push_controls.sql");

for(const label of ["Chat équipe","DM & groupes","Fauteuils"])has(app,label,"onglet manquant: "+label);
for(const route of ["communication/chat","communication/dm","communication/fauteuils"])has(app,route,"route manquante: "+route);
has(app,"renderPending","Communication ne rejoue pas un changement d’onglet arrivé pendant un chargement");
has(app,"renderVersion","Communication ne protège pas les rendus asynchrones obsolètes");
has(home,'app("homeChat", "Communication", "communication", "communication")',"l’application Communication n’est pas exposée avec son icône canonique");
has(home,'communication/fauteuils',"le raccourci Fauteuils n’aboutit pas à Communication/Fauteuils");
has(quick,'communication: {',"Communication manque dans le catalogue Applications");
has(quick,'communication: "messages"',"Communication n’est pas reliée à la permission messages dans Applications");
has(quick,'route.startsWith("communication/")',"Applications ne reconnaît pas les routes Communication");
has(accessRuntime,'communication: () => explicit("messages")',"le runtime d’accès ne reconnaît pas Communication");
has(accessRuntime,'["communication", "Communication", "communication"]',"Communication manque dans la politique de cartes d’accès");
has(accessManage,'label: "Communication"',"la permission messages n’est pas présentée comme Communication dans Accès");
has(loader,'void tableau().catch(() => {});',"le shell Communication attend encore le runtime Chat/Fauteuils au lieu de le préchauffer");
has(loader,'void style("communication-app.css").catch(() => {});',"Communication attend encore le CSS avant de charger son shell");
has(loader,'communicationPromise = load("communication-app.js")',"le JS du shell Communication n’est pas chargé directement");
has(home,"Communication met trop de temps à charger.","aucun garde-fou visible si le runtime Communication reste bloqué");
has(home,'root.querySelector("#hcCommunicationAppHost [data-communication-app]")',"le garde-fou Communication bloque encore le premier montage sur l’écran Chargement");
has(appRuntime,"r.startsWith('communication/')","le routeur principal ne conserve pas les routes Communication dans homeView");
has(hub,"STIPAgentSelector.mountPicker","DM n’utilise pas le sélecteur canonique d’agents");
has(selector,"setSelectedIds","STIPAgentSelector ne supporte pas la sélection multiple commune");
has(hub,"Créer un groupe","choix Créer un groupe manquant");
has(hub,"Envoyer séparément","choix Envoyer séparément manquant");

const hubForms=[...hub.matchAll(/<form\b[^>]*>/g)].map((match)=>match[0]);
if(!hubForms.length)fail("aucun formulaire Communication trouvé");
for(const tag of hubForms){
  if(!tag.includes("data-stip-form-mode="))fail("formulaire sans mode explicite: "+tag.slice(0,140));
}
has(chat,'data-stip-form-mode="composer"',"le compositeur Chat/Fauteuils n’est pas déclaré composer");
if(chat.includes('class="tb-dm-shortcut"')||chat.includes("dmState")||chat.includes("[data-dm-"))fail("l’ancien moteur DM ne doit plus vivre dans Chat/Fauteuils");
if(chatCss.includes(".tb-dm-"))fail("les anciens styles DM ne doivent plus rester dans Chat/Fauteuils");

for(const key of ["dm_received","team_chat_received","wheelchair_received"]){
  has(messages,key,"event_key backend manquant: "+key);
}
has(dmMigration,"dm_received","event_key migration manquant: dm_received");
for(const key of ["team_chat_received","wheelchair_received"]){
  has(migration,key,"event_key migration manquant: "+key);
}
has(sw,"/images/notifications/dm.webp","icône DM manquante");
has(sw,"/images/notifications/chat.webp","icône Chat équipe manquante");
has(sw,"/images/notifications/wheelchair.webp","icône Fauteuils manquante");
has(messages,"communication_family","le backend Communication ne porte pas la famille STIP");
has(messages,"activeMessagingAgents(communicationFamily(ctx))","l’annuaire/push Communication n’est pas limité à la famille STIP");
has(messages,'.eq("communication_family",communicationFamily(ctx))',"les conversations privées ne sont pas filtrées par famille");
has(messages,"assertCommunicationFamily(ctx","les fils privés ne revérifient pas la famille côté serveur");
has(messages,"TABLEAU_PREFIX+family+","le Chat/Fauteuils des autres métiers n’est pas séparé du brancardage");
has(accessManage,"TYPE · ","Accès n’affiche pas le type de famille Communication");
has(accessManage,"communication_family","Accès ne conserve pas la famille Communication");
has(rules,"Familles STIP","le contrat Communication ne documente pas les familles");
has(messages,"quick=communication&tab=dm","une notification DM ne cible pas l’onglet DM");
has(messages,'tab=wheelchair?"fauteuils":"chat"',"les notifications Chat/Fauteuils ne ciblent pas leur onglet");
has(rules,"Une seule application, trois vues","contrat Communication incomplet");

console.log("STIP Communication contract: OK");

has(communicationApp,"canUseWheelchairs","l’application Communication ne masque pas Fauteuils selon la famille");
has(communicationApp,'key !== "wheelchair" || canUseWheelchairs()', "l’onglet Fauteuils reste visible hors brancardage");
has(messages,"requireWheelchairAccess(ctx)","Fauteuils ne sont pas réservés au brancardage côté serveur");
has(rules,"module métier du brancardage uniquement","le contrat ne réserve pas Fauteuils au brancardage");
