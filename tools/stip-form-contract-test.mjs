#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) out.push(full);
  }
  return out;
}

const rules = read("t-est/regles-communes/FORM_RULES.md");
const formJs = read("t-est/regles-communes/global.js");
const formCss = read("t-est/regles-communes/global.css");
const legacyJs = read("t-est/regles-communes/form-engine-v2.js");
const legacyCss = read("t-est/regles-communes/form-engine-v2.css");
const architecture = read("ARCHITECTURE_FIRST.md");
const agents = read("AGENTS.md");

check(
  rules.includes("contrat canonique") &&
    rules.includes("global.js") &&
    rules.includes("global.css"),
  "FORM_RULES.md doit rester le contrat canonique et nommer le moteur commun."
);

const allowedModes = new Set(["sequential", "standard", "search", "composer", "native", "legacy", "exempt"]);
const formModeProblems = [];
for (const file of walkHtml(ROOT)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/<form\\b([^>]*)>/gi)) {
    const attrs = match[1] || "";
    const modeMatch = attrs.match(/\\bdata-stip-form-mode=["']([^"']+)["']/i);
    const relative = path.relative(ROOT, file).replaceAll("\\\\", "/");
    if (!modeMatch) formModeProblems.push(`${relative}: formulaire sans data-stip-form-mode`);
    else if (!allowedModes.has(String(modeMatch[1]).toLowerCase()))
      formModeProblems.push(`${relative}: mode inconnu "${modeMatch[1]}"`);
  }
}
check(
  formModeProblems.length === 0,
  "Chaque formulaire HTML doit déclarer un mode FormUX explicite. " + formModeProblems.join(" | ")
);

check(
  formJs.includes('const FORM_MODE_ATTR = "data-stip-form-mode"') &&
    formJs.includes('"sequential", "standard", "search", "composer", "native", "legacy", "exempt"') &&
    formJs.includes("function formMode(form)"),
  "Le moteur commun doit interpréter les modes explicites documentés."
);

check(
  rules.includes("pas de **Suivant** sans vraie étape suivante") &&
    rules.includes("dernière étape = action terminale explicite"),
  "Le contrat doit protéger la différence entre progression et action terminale."
);

check(
  formJs.includes('function finalActionLabel(submit)') &&
    formJs.includes('if (!submit) return "Terminer"') &&
    formJs.includes('? "Valider" : label'),
  "Le moteur doit conserver Valider/Terminer sur la dernière étape."
);

check(
  formJs.includes('const isFinal = !next') &&
    formJs.includes('isFinal ? "  ✓" : "  →"'),
  "Une action terminale ne doit pas conserver la flèche de progression."
);

check(
  formJs.includes('[hidden],.hidden,[aria-hidden="true"],[inert]') &&
    formJs.includes('["hidden", "submit", "reset", "button", "image"]'),
  "Les contrôles invisibles ou techniques ne doivent pas créer de fausse étape."
);

check(
  formJs.includes('if (event.key !== "Enter"') &&
    formJs.includes('if (!field || field.tagName === "TEXTAREA") return;') &&
    formJs.includes("advanceFromField(field);"),
  "Entrée doit suivre le moteur commun, sauf dans les textarea."
);

check(
  formJs.includes("window.visualViewport") &&
    formCss.includes("--stip-vv-height") &&
    formJs.includes('overview.textContent = "Vue complète"'),
  "Le contrat clavier doit rester basé sur le viewport visible et conserver Vue complète."
);

check(
  formJs.includes('return "given-name"') &&
    formJs.includes('return "family-name"') &&
    formJs.includes("function identityOrdered(controls)"),
  "Le moteur ne doit pas reperdre la sémantique Nom/Prénom ni réordonner les champs."
);

check(
  formJs.includes("function normalizePinField(field)") &&
    formJs.includes('field.setAttribute("inputmode", "numeric")') &&
    formJs.includes('field.setAttribute("autocomplete", "off")') &&
    formCss.includes('input[data-stip-pin-field="1"]'),
  "Le contrat commun des codes personnels à 6 chiffres a disparu."
);

const chatJs = read("team-chat.js");
check(
  chatJs.includes('<form class="tb-composer" data-form data-stip-form-mode="composer">') &&
    chatJs.includes('<form class="tb-dm-composer" data-dm-form data-stip-form-mode="composer">'),
  "Chat STIP doit garder ses compositeurs sur son moteur propre."
);

check(
  formJs.includes('const explicit = target.querySelector("[data-stip-autofocus]")') &&
    !formJs.includes('target.querySelector("[data-stip-autofocus]") || target.querySelector(FOCUS)'),
  "Ouvrir une surface ne doit pas ouvrir le clavier sans autofocus explicite."
);

check(
  legacyJs.includes("Adaptateur ciblé de compatibilité") &&
    legacyCss.includes("Adaptateur ciblé de compatibilité"),
  "form-engine-v2 doit rester identifié comme adaptateur ciblé, pas comme moteur canonique."
);

check(
  architecture.includes("t-est/regles-communes/FORM_RULES.md") &&
    agents.includes("t-est/regles-communes/FORM_RULES.md"),
  "Les contrats d’architecture doivent pointer vers FORM_RULES.md."
);

if (failures.length) {
  console.error(failures.map((message) => `FAIL — ${message}`).join("\n"));
  process.exit(1);
}

console.log("STIP form contract OK");
