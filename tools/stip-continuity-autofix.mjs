#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTINUITY_VERSION = "20260925-workspace-auto1";
const FORMUX_VERSION = "20260927-sitewide19";
const EXEMPT = new Set([
  "index.html",
  "print.html",
  "mon-compte.html",
  "places.html",
  "team-chat.html",
  "tableau-stip.html",
  "responsable-evaluation-agents.html",
  "rejoindre-equipe.html",
  "nouvel-arrivant-pro.html",
]);

const CONTINUITY_RE =
  /(?:stip-navigation|quick-access-universal|stip-workspace)\.js(?:\?|["'])/i;
const FORMUX_CSS_RE =
  /\/t-est\/regles-communes\/global\.css(?:\?v=[^"']+)?/i;
const FORMUX_JS_RE =
  /\/t-est\/regles-communes\/global\.js(?:\?v=[^"']+)?/i;
const OPT_OUT_RE =
  /<meta\s+name=["']stip-workspace["']\s+content=["']off["'][^>]*>/i;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
      out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function isExempt(file, content) {
  const base = path.basename(file);
  if (EXEMPT.has(base)) return true;
  if (OPT_OUT_RE.test(content)) return true;
  return false;
}

function injectContinuity(content) {
  const tag =
    `<script src="stip-navigation.js?v=${CONTINUITY_VERSION}"></script>`;
  if (/<\/body>/i.test(content))
    return content.replace(/<\/body>/i, `${tag}</body>`);
  return content + "\n" + tag + "\n";
}

function wireFormUx(content) {
  const css =
    `/t-est/regles-communes/global.css?v=${FORMUX_VERSION}`;
  const js =
    `/t-est/regles-communes/global.js?v=${FORMUX_VERSION}`;

  let next = content;
  if (FORMUX_CSS_RE.test(next))
    next = next.replace(FORMUX_CSS_RE, css);
  else {
    const tag = `<link rel="stylesheet" href="${css}" />`;
    next = /<\/head>/i.test(next)
      ? next.replace(/<\/head>/i, `  ${tag}\n</head>`)
      : tag + "\n" + next;
  }

  if (FORMUX_JS_RE.test(next))
    next = next.replace(FORMUX_JS_RE, js);
  else {
    const tag = `<script defer src="${js}"></script>`;
    next = /<\/head>/i.test(next)
      ? next.replace(/<\/head>/i, `  ${tag}\n</head>`)
      : tag + "\n" + next;
  }
  return next;
}

const changed = [];

for (const file of walk(ROOT)) {
  const content = fs.readFileSync(file, "utf8");
  let next = wireFormUx(content);

  if (!isExempt(file, next) && !CONTINUITY_RE.test(next))
    next = injectContinuity(next);

  if (next === content) continue;
  fs.writeFileSync(file, next, "utf8");
  changed.push(rel(file));
}

if (changed.length) {
  console.log("STIP continuity autofix");
  for (const file of changed) console.log("  +", file);
  console.log(
    `\n${changed.length} page(s) raccordée(s) automatiquement aux moteurs communs STIP.`,
  );
} else {
  console.log("STIP continuity autofix — aucune page à corriger.");
}
