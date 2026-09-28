import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const fail = (msg) => { console.error("STIP card signature contract:", msg); process.exitCode = 1; };
const assert = (ok, msg) => { if (!ok) fail(msg); };

const base = read("stip-theme-base.css");
const patterns = read("stip-patterns.css");
const theme = read("stip-theme.css");
const monthJs = read("stip-month-table.js");
const monthCss = read("stip-month-table.css");
const rules = read("THEME_FIRST.md");
const sw = read("stip-sw.js");
const index = read("index.html");

for (const token of [
  "--stip-card-accent",
  "--stip-card-surface",
  "--stip-card-border",
  "--stip-card-shadow",
  "--stip-card-shadow-active",
  "--stip-card-liseret-height",
  "--stip-card-liseret-inset",
]) {
  assert(base.includes(token), `missing shared token ${token}`);
}

assert(patterns.includes("SIGNATURE DE CARTE PREMIUM"), "shared premium card signature block missing");
assert(patterns.includes(".stip-card-signature"), "opt-in card signature class missing");
for (const family of [
  ".stip-time-month",
  ".stip-time-week",
  ".stip-action-surface",
  ".stip-catalog-surface",
  ".stip-cockpit-surface",
  ".stip-legend-surface",
]) {
  assert(patterns.includes(family), `shared family not wired to card signature: ${family}`);
}
for (const tone of ["neutral","active","success","warning","danger","lavender"]) {
  assert(patterns.includes(`data-stip-card-tone="${tone}"`), `semantic card tone missing: ${tone}`);
}
assert(patterns.includes("linear-gradient(") && patterns.includes("--stip-card-liseret-height"),
  "luminous top accent line is missing");
assert(monthJs.includes('calendar.classList.add("stip-card-signature")'),
  "monthly planning table is not attached to the shared card signature");
assert(!monthCss.includes("0 28px 68px"),
  "monthly planning table still owns the old duplicated premium shadow");
assert(theme.includes("stip-theme-base.css?v=20260928-card-signature1"),
  "master theme does not load the versioned card tokens");
assert(theme.includes("stip-patterns.css?v=20260928-card-signature1"),
  "master theme does not load the versioned card component");
assert(sw.includes('STIP_SW_BUILD="20260928-card-signature1"'),
  "service worker cache version was not invalidated for the card signature");
assert(index.includes('stip-theme.css?v=20260928-card-signature1'),
  "main app does not request the new master theme version");
assert(rules.includes("MAÎTRE VALIDÉ — Signature de carte premium") &&
       rules.includes("liseré supérieur lumineux"),
  "human-readable theme contract does not protect the premium card signature");

if (!process.exitCode) console.log("STIP premium card signature contract OK");
