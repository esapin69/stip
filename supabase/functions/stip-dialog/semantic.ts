import { extractShift, normalize, type DialogContext, type Intent } from "./core.ts";

export type AppTarget =
  | "profile_photo" | "planning_personal" | "planning_team" | "change_app"
  | "calendar_subscribe" | "agent_dates" | "contacts" | "responsable"
  | "notes" | "nouveaux_arrivants" | "file_upload" | "activity" | "admin"
  | "places" | "access_manage" | "messages" | "tomorrow" | "agent_directory";

export type SemanticResult = { intent: Intent; confidence: number; app?: AppTarget; reason?: string };

const SHORT: Record<string,string> = {
  ki:"qui", kan:"quand", qd:"quand", qnd:"quand", avc:"avec", num:"numero",
  tel:"telephone", vac:"vacances", vacs:"vacances", proch:"prochain", prochene:"prochaine",
  sem:"semaine", msg:"message", stp:"", svp:"", taf:"travail", bosse:"travaille", bosser:"travailler", jbosse:"travaille",
};

export function semanticText(raw:string){
  return normalize(raw).split(" ").map(t=>SHORT[t] ?? t).filter(Boolean).join(" ");
}

function lev(a:string,b:string){
  if(a===b)return 0;
  if(!a.length)return b.length;if(!b.length)return a.length;
  const p=Array.from({length:b.length+1},(_,i)=>i), n=new Array(b.length+1).fill(0);
  for(let i=1;i<=a.length;i++){
    n[0]=i;
    for(let j=1;j<=b.length;j++) n[j]=Math.min(n[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));
    for(let j=0;j<=b.length;j++)p[j]=n[j];
  }
  return p[b.length];
}
function near(a:string,b:string){
  if(a===b)return true;
  const m=Math.max(a.length,b.length);
  if(m<4)return false;
  return lev(a,b) <= (m>=8?2:1);
}
function hasWord(q:string, words:string[]){
  const tokens=q.split(" ").filter(Boolean);
  return words.some(w=>w.includes(" ") ? (` ${q} `).includes(` ${w} `) : tokens.some(t=>near(t,w)));
}
function hasAny(q:string, words:string[]){return hasWord(q,words)}

export function semanticClassify(raw:string, old:DialogContext = {}):SemanticResult{
  const q=semanticText(raw), previous=String(old.last_intent||"");
  const wantsOpen=hasAny(q,["ouvre","ouvrir","aller","acces","lance","affiche","montre"]);

  if(hasAny(q,["photo","avatar"]) && hasAny(q,["change","changer","modifier","remplacer"])) return {intent:"app_navigation",app:"profile_photo",confidence:.98};
  if(hasAny(q,["synchroniser calendrier","synchro calendrier","abonnement calendrier","calendrier telephone"])) return {intent:"app_navigation",app:"calendar_subscribe",confidence:.99};
  if(hasAny(q,["visite medicale","formation","stagiaire"])) return {intent:"app_navigation",app:"agent_dates",confidence:.94};
  if(hasAny(q,["nouvel agent","nouveau agent","arrivant","onboarding"])) return {intent:"app_navigation",app:"nouveaux_arrivants",confidence:.95};
  if(hasAny(q,["importer","import","depot fichier","deposer fichier"])) return {intent:"app_navigation",app:"file_upload",confidence:.96};
  if(hasAny(q,["note","notes"]) && !hasAny(q,["numero","planning"])) return {intent:"app_navigation",app:"notes",confidence:.86};
  if(hasAny(q,["administration","admin"]) && (wantsOpen || q.split(" ").length<=3)) return {intent:"app_navigation",app:"admin",confidence:.98};
  if(hasAny(q,["acces securite","gestion acces","droits","qui a acces"]) || (hasAny(q,["acces"]) && hasAny(q,["gerer","gestion","donner","retirer"]))) return {intent:"app_navigation",app:"access_manage",confidence:.94};
  if(hasAny(q,["responsable","cockpit"]) && wantsOpen) return {intent:"app_navigation",app:"responsable",confidence:.94};
  if(hasAny(q,["esprit equipe","activite"]) && wantsOpen) return {intent:"app_navigation",app:"activity",confidence:.90};
  if(hasAny(q,["annuaire","equipe"]) && wantsOpen) return {intent:"app_navigation",app:"agent_directory",confidence:.90};
  if(hasAny(q,["actions demain","a faire demain","dois faire demain","j ai quoi demain"])) return {intent:"app_navigation",app:"tomorrow",confidence:.91};

  if(hasAny(q,["vacance","vacances","conge","conges","ca","rtt","repos","jour off","off"]) &&
     hasAny(q,["prochain","prochaine","prochains","prochaines","quand","mes","mon","vacances","rtt","repos","ca"]) &&
     !hasAny(q,["poser","demander","demande","prendre","soumettre"])) return {intent:"leave_lookup",confidence:.96};

  if(hasAny(q,["echange","echanger","permuter","permutation"]) ||
     (previous==="exchange" && (!!extractShift(q) || hasAny(q,["soir","matin","nuit","journee"]))) ||
     (hasAny(q,["passer","changer"]) && hasAny(q,["soir","matin","nuit","shift"]))) return {intent:"exchange",confidence:.95};

  if(hasAny(q,["numero","telephone","mail","email","coordonnees","appeler"]) ||
     (previous==="contact" && hasAny(q,["son","sa","lui","elle"]))) return {intent:"contact",confidence:.95};

  if(hasAny(q,["irm","imagerie","batiment","ascenseur","etage","service","lieu","chemin","itineraire","route"]) ||
     (old.place_id && hasAny(q,["autour","proche","details","info","repere","comment y aller","la bas"]))) return {intent:"place",confidence:.95};

  if(hasAny(q,["effectif","combien on est","on est combien","manque combien","couverture","reference hcl"])) return {intent:"organization",confidence:.94};

  if(hasAny(q,["avec moi","meme heure","commence comme moi","finit avec moi","travaille avec moi","bosse avec moi","croise"]) ||
     (previous==="colleagues" && hasAny(q,["les memes","eux","elles"]))) return {intent:"colleagues",confidence:.94};

  if(hasAny(q,["qui est la","qui travaille","qui est present","qui sont presents","sur le terrain","qui bosse"]) && !hasAny(q,["avec moi"])) return {intent:"on_duty",confidence:.91};

  if(extractShift(q) && (hasAny(q,["qui","liste","montre","agents"]) || q.split(" ").length<=3)) return {intent:"shift_roster",confidence:.93};

  if(hasAny(q,["message","messagerie","ecris","ecrire","parle","contacter"]) || previous==="messaging_help" && hasAny(q,["lui","elle","eux","elles"])) return {intent:"messaging_help",confidence:.90};

  if(hasAny(q,["absence","absent","absente"]) || hasAny(q,["poser conge","demande conge","demander conge","prendre conge"])) return {intent:"request_help",confidence:.96};

  if(hasAny(q,["planning","horaire","travaille","travail","poste","shift","je fais quoi","je suis quoi"]) ||
     hasAny(q,["demain","aujourd hui","apres demain","lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"])) return {intent:"planning",confidence:.82};

  if(hasAny(q,["qui est","trouve","recherche","chercher"])) return {intent:"person",confidence:.80};

  if(/^et\b/.test(q) && ["planning","colleagues","shift_roster","organization","place","contact"].includes(previous)) return {intent:previous as Intent,confidence:.78,reason:"context_followup"};
  if(hasAny(q,["son numero","son mail","je peux l appeler"]) && old.subject_agent_ids?.length) return {intent:"contact",confidence:.92};

  return {intent:"help",confidence:0};
}
