#!/usr/bin/env node
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const overlay = read("stip-overlay-navigation.js");
const global = read("t-est/regles-communes/global.js");
const access = read("admin-access-requests-home.js");
const home = read("home-shell.js");
const architecture = read("ARCHITECTURE_FIRST.md");

for (const [name, source] of [["overlay", overlay], ["access", access], ["home", home]]) {
  try { new Function(source); }
  catch (error) { failures.push(name + " : syntaxe JavaScript invalide — " + error.message); }
}

check(overlay.includes("history.pushState("), "Le moteur overlay doit créer un niveau d’historique.");
check(overlay.includes('addEventListener("popstate", sync, true)'), "Le moteur overlay doit intercepter le retour navigateur.");
check(overlay.includes('dialog[open]') && overlay.includes('matches(":modal")'), "Les <dialog> modaux doivent être enrôlés automatiquement.");
check(overlay.includes("step(dialog") && overlay.includes("back(dialog"), "Les sous-vues d’une popup doivent avoir un niveau Retour.");
check(global.includes("/stip-overlay-navigation.js?v=20260930-safari-overlay-history1"), "Le moteur overlay doit être chargé par le moteur commun.");
check(access.includes("STIPOverlayNav?.step") && access.includes("STIPOverlayNav?.back"), "Accès & preuves doit relier détail → liste à l’historique.");
check(access.includes("STIPOverlayNavigationReady"), "Accès & preuves doit attendre le moteur avant showModal.");
check(home.includes("STIPOverlayNav?.trackElement?.(wrap") && home.includes("closeShiftDetail(true)"), "La popup détail shift doit suivre le même Retour navigateur.");
check(architecture.includes("stip-overlay-navigation.js"), "Le contrat d’architecture doit documenter la navigation des popups.");

// Behavioral simulation: the first Back returns detail -> popup list, the second
// closes the popup instead of allowing the browser to leave the STIP document.
const listeners = new Map();
const stack = [{ page: true }];
let stackIndex = 0;
const history = {
  state: stack[0],
  pushState(state) {
    stack.splice(stackIndex + 1);
    stack.push(state);
    stackIndex = stack.length - 1;
    this.state = state;
  },
  go(delta) {
    const next = stackIndex + delta;
    if (next < 0 || next >= stack.length) throw new Error("history.go hors pile");
    stackIndex = next;
    this.state = stack[stackIndex];
    const event = { state: this.state, stopImmediatePropagation() {} };
    listeners.get("popstate")?.(event);
  },
};
const window = {
  addEventListener(type, callback) { listeners.set(type, callback); },
};
const documentElement = {
  nodeType: 1,
  matches() { return false; },
  querySelectorAll() { return []; },
};
const document = { documentElement };
class MutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
}
const context = {
  window,
  document,
  history,
  location: { href: "https://ghe.esapin.com/" },
  MutationObserver,
  WeakSet,
  Date,
  Math,
  console,
};
vm.runInNewContext(overlay, context, { filename: "stip-overlay-navigation.js" });

let listRestored = 0;
let detailRestored = 0;
const closeListeners = [];
const dialog = {
  open: true,
  isConnected: true,
  dataset: {},
  addEventListener(type, callback) { if (type === "close") closeListeners.push(callback); },
  close() {
    this.open = false;
    for (const callback of closeListeners) callback();
  },
  showModal() { this.open = true; },
};
check(window.STIPOverlayNav.track(dialog), "Le dialogue de test n’a pas été inscrit dans l’historique.");
check(stack.length === 2 && stackIndex === 1, "L’ouverture doit ajouter exactement un niveau d’historique.");
check(
  window.STIPOverlayNav.step(dialog, {
    back: () => { listRestored += 1; },
    forward: () => { detailRestored += 1; },
  }),
  "La sous-vue de test n’a pas été inscrite dans l’historique.",
);
check(stack.length === 3 && stackIndex === 2, "Le détail doit ajouter un second niveau d’historique.");

history.go(-1);
check(dialog.open, "Le premier Précédent a fermé toute la popup au lieu de revenir à la liste.");
check(listRestored === 1, "Le premier Précédent n’a pas restauré la liste de la popup.");
check(stackIndex === 1, "Le premier Précédent n’a pas consommé uniquement le niveau détail.");

history.go(-1);
check(!dialog.open, "Le second Précédent n’a pas fermé la popup.");
check(stackIndex === 0, "La fermeture de popup n’est pas revenue à l’entrée STIP d’origine.");
check(detailRestored === 0, "Un retour arrière ne doit pas exécuter le callback Forward.");

if (failures.length) {
  console.error("STIP overlay navigation contract — ECHEC");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}
console.log("STIP overlay navigation contract — OK");
