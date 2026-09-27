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
    rules.includes("global.css") &&
    rules.includes("une seule référence UX est validée") &&
    rules.includes("accessRequestForm") &&
    rules.includes("Chat STIP / Fauteuils / DM est hors périmètre"),
  "FORM_RULES.md doit rester limité à la référence validée Demander un accès."
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

const responsableHtml = read("responsable.html");
const responsableDemandesHtml = read("responsable-demandes.html");
const responsableAgendaHtml = read("responsable-agenda.html");
const responsableEvaluationsHtml = read("responsable-evaluations.html");

check(
  responsableHtml.includes('<form id="form" data-stip-form-mode="sequential" data-stip-form-pilot="access-request-v1" hidden>'),
  "Le pilote FormUX doit rester limité à Responsable > Suivi > Envoyer à un agent."
);
check(
  responsableDemandesHtml.includes('data-stip-form-mode="legacy"') &&
    responsableAgendaHtml.includes('data-stip-form-mode="legacy"') &&
    responsableEvaluationsHtml.includes('data-stip-form-mode="legacy"'),
  "Les autres formulaires historiques ne doivent pas être promus avant validation."
);
check(
  formJs.includes('mode === "legacy") return "native"') &&
    formJs.includes('mode === "legacy" || mode === "exempt") return;'),
  "Un formulaire legacy ne doit pas être enrôlé automatiquement dans le moteur séquentiel."
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
