import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const fail=(message)=>{throw new Error("[Communication contract] "+message)};
const has=(text,needle,message)=>{if(!text.includes(needle))fail(message)};

const app=read("communication-app.js");
const home=read("home-shell.js");
const hub=read("communication-hub.js");
const chat=read("team-chat.js");
const selector=read("stip-agent-selector.js");
const sw=read("stip-sw.js");
const messages=read("supabase/functions/stip-messages/index.ts");
const rules=read("COMMUNICATION_RULES.md");
const migration=read("supabase/migrations/20260927225000_communication_notification_types.sql");

for(const label of ["Chat équipe","DM & groupes","Fauteuils"])has(app,label,"onglet manquant: "+label);
for(const route of ["communication/chat","communication/dm","communication/fauteuils"])has(app,route,"route manquante: "+route);
has(home,'app("communication", "Communication"',"l’application Communication n’est pas exposée dans Applications");
has(home,'communication/fauteuils',"le raccourci Fauteuils n’aboutit pas à Communication/Fauteuils");
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
if(chat.includes('class="tb-dm-shortcut"'))fail("le raccourci DM ne doit plus vivre dans Chat/Fauteuils");

for(const key of ["dm_received","team_chat_received","wheelchair_received"]){
  has(messages,key,"event_key backend manquant: "+key);
  has(migration,key,"event_key migration manquant: "+key);
}
has(sw,"/images/notifications/dm.webp","icône DM manquante");
has(sw,"team-chat.svg","icône Chat équipe manquante");
has(sw,"/images/notifications/wheelchair.webp","icône Fauteuils manquante");
has(messages,"quick=communication&tab=dm","une notification DM ne cible pas l’onglet DM");
has(messages,'tab=wheelchair?"fauteuils":"chat"',"les notifications Chat/Fauteuils ne ciblent pas leur onglet");
has(rules,"Une seule application, trois vues","contrat Communication incomplet");

console.log("STIP Communication contract: OK");
