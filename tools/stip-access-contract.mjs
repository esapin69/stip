import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const checks = [];

function expect(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

const dates = read("supabase/functions/stip-agent-dates/index.ts");
expect(
  "Responsable can read agent dates",
  dates.includes("perms.agent_dates||perms.responsable||perms.admin"),
  "stip-agent-dates must treat Responsable/Admin as an internal read capability.",
);

const assistant = read("supabase/functions/stip-assistant/index.ts");
expect(
  "Responsable Pro receives Pro assistant context",
  assistant.includes("respPro") && assistant.includes("respPro?'pro'"),
  "The Responsable workspace must not depend on the standalone assistant role defaults.",
);

const staffing = read("supabase/functions/stip-staffing/index.ts");
expect(
  "Chef staffing uses operational day team",
  staffing.includes("return t==='nuit'?'nuit':'jour'"),
  "Chef identity must not redirect staffing to a non-existent 'chefs' reference set.",
);

const relay = read("stip-edge-relay.js");
expect(
  "Network relay is fallback only",
  relay.includes('mode: "direct-first-fallback"') &&
    relay.indexOf("nativeFetch(input, init)") < relay.indexOf("relay(input, init, rawUrl)"),
  "Authenticated data must use Supabase directly and relay only on network failure.",
);

const sw = read("stip-sw.js");
expect(
  "Service worker does not proxy API traffic",
  !sw.includes("SUPABASE_FUNCTIONS") && !sw.includes("STIP_RELAY"),
  "The service worker is for static caching/push, not access routing.",
);

const secureMigration = read(
  "supabase/migrations/20260925193000_restore_secure_code_verification.sql",
);
expect(
  "Code verification keeps bcrypt proof",
  secureMigration.includes("p.code_hash = crypt("),
  "Deterministic code_key lookup must still verify the bcrypt code_hash.",
);

const failed = checks.filter((x) => !x.ok);
for (const c of checks) {
  console.log(`${c.ok ? "OK" : "FAIL"} - ${c.name}`);
  if (!c.ok) console.log("  " + c.detail);
}
if (failed.length) process.exit(1);
console.log(`Access contract: ${checks.length} invariants verified.`);
