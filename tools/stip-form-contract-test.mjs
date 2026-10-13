#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=(f)=>fs.readFileSync(path.join(root,f),"utf8");
const js=read("t-est/regles-communes/global.js");
const css=read("t-est/regles-communes/global.css");
const rules=read("t-est/regles-communes/FORM_RULES.md");
const login=read("index.html");
const resp=read("responsable.html");
const legacy=read("public-access-request-legacy.js");
const hub=read("communication-hub.js");
const hubCss=read("communication-hub.css");
const failures=[];
function check(ok,message){if(!ok)failures.push(message)}
check(rules.includes("Contrat de saisie native"),"Contrat natif non documenté");
check(js.includes('inputMode: "native"'),"Mode natif STIPFormUX non exposé");
check(!js.includes('addEventListener("focusin"')&&!js.includes('addEventListener("keydown"'),"Le moteur intercepte encore focus/Entrée");
check(!js.includes("visualViewport")&&!js.includes("scrollIntoView"),"Le moteur recale encore le viewport ou le scroll");
check(!js.includes("stip-keyboard-focus-mode"),"Plein écran programmé encore actif");
check(!css.includes(".stip-keyboard-focus-mode")&&!css.includes(".stip-select-source"),"Ancien mode plein écran / faux select CSS encore présent");
check(js.includes('setAttribute("inputmode", "numeric")')&&js.includes('dataset.stipPinField'),"Code 6 chiffres non préservé");
check(login.includes('id="accessRequestForm"')&&login.includes('data-stip-form-mode="standard"'),"Demande d’accès pas en formulaire standard");
check(resp.includes('id="form" data-stip-form-mode="standard"'),"Suivi agent pas en formulaire standard");
check(!resp.includes('data-stip-select-menu'),"Le faux select du suivi est toujours activé");
check(!legacy.includes("recordField")&&!legacy.includes("focusStep")&&!legacy.includes("stip:form-previous-request"),"Historique par champ encore branché");
check(!hub.includes("keepActiveComposerVisible")&&!hub.includes("queueViewportSync"),"Défilement chat piloté par JS");
check(!hubCss.includes("ch-keyboard-open .ch-dialog-form"),"Saisie chat déplacée avec le clavier");
if(failures.length){console.error(failures.map(x=>"FAIL — "+x).join("\n"));process.exit(1)}
console.log("STIP native form contract OK");
