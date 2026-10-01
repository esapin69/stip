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
const hubCss=read("communication-hub.css");
const profilePhoto=read("profile-photo.js");
const personActions=read("stip-person-actions.js");
const chat=read("team-chat.js");
const chatCss=read("team-chat.css");
const selector=read("stip-agent-selector.js");
const sw=read("stip-sw.js");
const messages=read("supabase/functions/stip-messages/index.ts");
const rules=read("COMMUNICATION_RULES.md");
const agents=read("AGENTS.md");
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
has(profilePhoto,'label:"Paramètres"',"le menu profil n’expose pas Paramètres");
has(profilePhoto,'label:"Notifications"',"Paramètres n’expose pas le réglage Notifications");
has(profilePhoto,"notificationSettings()","le panneau profil ne charge pas la liste canonique des notifications");
has(hub,"async function notificationSettings()","le moteur Communication n’expose pas la liste canonique des préférences");
has(hub,"async function setNotificationPreference(","le moteur Communication n’expose pas le réglage générique par event_key");
has(hub,"async function setNotificationPreview(","l’aperçu des notifications n’est pas centralisé dans le moteur");
has(personActions,"action.toggle === true","la feuille d’actions ne supporte pas les réglages cochés/décochés");
for(const legacyNotificationAccess of ["data-dm-push-toggle","data-dm-push-sheet","data-inbox-push",'name="preview"',"maybePromptDmPush"]){
  if(hub.includes(legacyNotificationAccess))fail("ancien accès notification encore présent dans Communication: "+legacyNotificationAccess);
}
for(const legacyNotificationStyle of [".ch-dm-push-toggle",".ch-push-consent-wrap",".ch-inbox-push"]){
  if(hubCss.includes(legacyNotificationStyle))fail("ancien style d’accès notification encore présent: "+legacyNotificationStyle);
}

const hubForms=[...hub.matchAll(/<form\b[^>]*>/g)].map((match)=>match[0]);
if(!hubForms.length)fail("aucun formulaire Communication trouvé");
for(const tag of hubForms){
  if(!tag.includes("data-stip-form-mode="))fail("formulaire sans mode explicite: "+tag.slice(0,140));
}
has(chat,'data-stip-form-mode="composer"',"le compositeur Chat/Fauteuils n’est pas déclaré composer");
has(chat,"WHEELCHAIR_PLACE_DETAILS","Fauteuils doit conserver les métadonnées canoniques des repères");
has(chat,"place.nearby.join", "Les services proches doivent être visibles sous le repère");
has(chat,"const quickPlaces = wheelchairFieldSpots", "Le sélecteur doit utiliser les lieux réels sans transformer un service en ascenseur");
has(chat,"composerExpanded: false","Fauteuils n’a pas d’état compact explicite");
has(chat,"composerWriting: false","Fauteuils doit avoir un mode Écrire minimal");
has(chat,'data-compact-mode="spot"',"J’ai vu doit lancer le parcours guidé");
has(chat,'data-compact-mode="search"',"Je cherche doit lancer le parcours guidé");
has(chat,"openFreeComposer(true)","Écrire doit lancer une saisie libre seule");
has(chatCss,"grid-template-columns:repeat(3,minmax(0,1fr))","trois boutons compacts attendus");
if(chat.includes("data-composer-expand") || chat.includes("tb-compact-actions") || chatCss.includes(".tb-compact-actions"))fail("ancien bloc d’actions compactes redondant");
has(chat,"tb-shortcuts-compact","le dock Fauteuils compact n’est pas rendu");
has(chat,"data-composer-toggle","la poignée de déploiement/réduction Fauteuils manque");
has(chat,"collapseWheelchairComposerFromScroll","le dock Fauteuils ne se replie pas pendant la lecture vers le haut");
has(chat,"setWheelchairComposerExpanded(false)","le dock Fauteuils ne revient pas compact après envoi");
has(chatCss,"is-wheelchair-composer-collapsed","les styles du dock compact Fauteuils manquent");
has(chatCss,"20260930-wheelchair-card-fit1","le correctif responsive des cartes Fauteuils a disparu");
has(chatCss,"20260930-wheelchair-premium-card1","les styles premium des cartes Fauteuils ont disparu");
has(chatCss,"linear-gradient(137deg,#147f78 0%,#09685f 100%)","l’action prioritaire Fauteuils a perdu son contraste");
has(chatCss,"center bottom / 100% 8px no-repeat","la bande de fraîcheur premium n’a plus sa progression lisible");
has(chat,"html.push('</div>');","la ligne des métadonnées Fauteuils doit être fermée après l’étage");
has(agents,"Premium wheelchair card presentation","le contrat des cartes premium Fauteuils est absent");
has(chatCss,"overflow-wrap:anywhere!important","la fraîcheur et les dates des cartes peuvent déborder sur mobile");
has(agents,"stack freshness time and probability on two lines","le contrat de lisibilité mobile des cartes Fauteuils est absent");
has(communicationApp,"syncChromeCompact","le shell Communication ne compacte pas son chrome en lecture Fauteuils");
has(communicationApp,"is-chrome-compact","le shell Communication n’expose pas l’état compact");
has(agents,"compact two-state dock","le contrat Fauteuils ne protège pas le dock compact à deux états");
has(agents,"exactly three direct buttons","le contrat Fauteuils doit imposer trois choix");
has(agents,"Accueil | ♿ Fauteuils | 🔔","le contrat Fauteuils ne protège pas le chrome mobile compact");
has(agents,"no extra follow-up panel opens","le contrat Fauteuils ne protège pas la suppression du panneau ascenseur à deux choix");
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
has(rules,"Mon profil > Paramètres > Notifications","le contrat ne protège pas la centralisation des réglages de notifications");

has(communicationApp,"canUseWheelchairs","l’application Communication ne masque pas Fauteuils selon la famille");
has(communicationApp,'key !== "wheelchair" || canUseWheelchairs()', "l’onglet Fauteuils reste visible hors brancardage");
has(messages,"requireWheelchairAccess(ctx)","Fauteuils ne sont pas réservés au brancardage côté serveur");
has(rules,"module métier du brancardage uniquement","le contrat ne réserve pas Fauteuils au brancardage");

/* Audit team-chat 2026-09-30: preserve reviewed CSS rules and avoid duplicate JS functions. */
const guardedChatCssSelectors = new Set([
  ".tb-resolve:active",
  ".tb-resolve:disabled",
  ".tb-composer textarea",
  ".tb-pulse-stock",
  ".tb-pulse-search",
  ".tb-search-shortcuts-grid",
  ".tb-wheelchair-actions",
  ".tb-search-shortcuts",
  ".tb-wheelchair-freshness.is-hot .tb-freshness-track::after",
  ".tb-wheelchair-freshness.is-warm .tb-freshness-track::after",
  ".tb-wheelchair-freshness.is-cold .tb-freshness-track::after, .tb-wheelchair-freshness.is-frozen .tb-freshness-track::after",
]);
const normalizedCss = (s) => s.replace(/\s+/g, " ").trim();
const cssWithoutComments = chatCss.replace(/\/\*[\s\S]*?\*\//g, "");
const seenChatCssRules = new Set();
const cssDepth = [];
let cssStart = 0, cssQuote = "";
const cssChildren = [];
for (let i = 0; i < cssWithoutComments.length; i++) {
  const c = cssWithoutComments[i];
  if (cssQuote) {
    if (c === "\\") { i++; continue; }
    if (c === cssQuote) cssQuote = "";
    continue;
  }
  if (c === '"' || c === "'") { cssQuote = c; continue; }
  if (c === "{") {
    const rule = normalizedCss(cssWithoutComments.slice(cssStart, i));
    if (cssChildren.length) cssChildren[cssChildren.length - 1]++;
    cssDepth.push(rule);
    cssChildren.push(0);
    cssStart = i + 1;
    continue;
  }
  if (c === "}") {
    const children = cssChildren.pop();
    const rule = cssDepth.pop();
    if (children === 0 && guardedChatCssSelectors.has(rule)) {
      const context = cssDepth.join(" > ");
      const declarations = normalizedCss(cssWithoutComments.slice(cssStart, i));
      const key = [context, rule, declarations].join("|");
      if (seenChatCssRules.has(key)) fail("règle CSS Team Chat identique réintroduite: " + rule);
      seenChatCssRules.add(key);
    }
    cssStart = i + 1;
  }
}
for (const rule of guardedChatCssSelectors) {
  if (![...seenChatCssRules].some((key) => key.includes("|" + rule + "|"))) {
    fail("règle CSS Team Chat protégée absente: " + rule);
  }
}
const namedTeamFunctions = [...chat.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
const duplicatedTeamFunctions = namedTeamFunctions.filter((name, index) => namedTeamFunctions.indexOf(name) !== index);
if (duplicatedTeamFunctions.length) {
  fail("fonction JavaScript Team Chat déclarée plusieurs fois: " + [...new Set(duplicatedTeamFunctions)].join(", "));
}
console.log("STIP Communication contract: OK");
