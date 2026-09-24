#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTINUITY_VERSION = "20260925-workspace-auto1";
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

function inject(content) {
  const tag =
    `<script src="stip-navigation.js?v=${CONTINUITY_VERSION}"></script>`;
  if (/<\/body>/i.test(content))
    return content.replace(/<\/body>/i, `${tag}</body>`);
  return content + "\n" + tag + "\n";
}

const changed = [];

for (const file of walk(ROOT)) {
  const content = fs.readFileSync(file, "utf8");
  if (isExempt(file, content) || CONTINUITY_RE.test(content)) continue;
  const next = inject(content);
  if (next === content) continue;
  fs.writeFileSync(file, next, "utf8");
  changed.push(rel(file));
}

if (changed.length) {
  console.log("STIP continuity autofix");
  for (const file of changed) console.log("  +", file);
  console.log(
    `\n${changed.length} page(s) raccordée(s) automatiquement au moteur de continuité.`,
  );
} else {
  console.log("STIP continuity autofix — aucune page à corriger.");
}
