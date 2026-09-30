#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const overlay = read("stip-overlay-navigation.js");
const global = read("t-est/regles-communes/global.js");
const access = read("admin-access-requests-home.js");
const home = read("home-shell.js");
const architecture = read("ARCHITECTURE_FIRST.md");

check(overlay.includes("history.pushState("), "Le moteur overlay doit créer un niveau d’historique.");
check(overlay.includes('addEventListener("popstate", sync, true)'), "Le moteur overlay doit intercepter le retour navigateur.");
check(overlay.includes('dialog[open]') && overlay.includes('matches(":modal")'), "Les <dialog> modaux doivent être enrôlés automatiquement.");
check(overlay.includes("step(dialog") && overlay.includes("back(dialog"), "Les sous-vues d’une popup doivent avoir un niveau Retour.");
check(global.includes("/stip-overlay-navigation.js?v=20260930-safari-overlay-history1"), "Le moteur overlay doit être chargé par le moteur commun.");
check(access.includes("STIPOverlayNav?.step") && access.includes("STIPOverlayNav?.back"), "Accès & preuves doit relier détail → liste à l’historique.");
check(access.includes("STIPOverlayNavigationReady"), "Accès & preuves doit attendre le moteur avant showModal.");
check(home.includes("STIPOverlayNav?.trackElement?.(wrap") && home.includes("closeShiftDetail(true)"), "La popup détail shift doit suivre le même Retour navigateur.");
check(architecture.includes("stip-overlay-navigation.js"), "Le contrat d’architecture doit documenter la navigation des popups.");

if (failures.length) {
  console.error("STIP overlay navigation contract — ECHEC");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}
console.log("STIP overlay navigation contract — OK");
