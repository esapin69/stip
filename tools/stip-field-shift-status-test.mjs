import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Test the canonical field engine used by Esprit d'équipe and the other views.
const code = fs.readFileSync(new URL("../stip-field-intelligence.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(code, sandbox, { filename: "stip-field-intelligence.js" });
const engine = sandbox.window.STIPFieldIntel;
assert.equal(typeof engine?.shiftStatus, "function", "Shared shift-status engine must exist");

const staff = (rows) => ({ available: true, rows });
const row = (shift_code, planned_count, target_count, severity = 0) => ({
  shift_code, planned_count, target_count, severity,
  gap: planned_count == null || target_count == null ? null : planned_count - target_count,
});

// Realistic five-shift snapshot: surplus without any possible transfer must be '+', not '✔'.
const snapshot = staff([
  row("M", 13, 12),
  row("J", 10, 10),
  row("J4", 6, 6),
  row("S", 7, 7),
  row("N", null, null),
]);
for (const [code, expected] of [
  ["M", "opportunity"],
  ["J", "ok"],
  ["J4", "ok"],
  ["S", "ok"],
  ["N", "unknown"],
]) {
  const result = engine.shiftStatus(snapshot, code);
  assert.equal(result.level, expected, `${code}: wrong HCL comparison status`);
  if (code === "M") {
    assert.equal(result.gap, 1, "M must retain the +1 staffing margin");
    assert.equal(result.proposal, "", "An optional transfer must not be invented");
    assert.equal(result.symbol, engine.statusMeta("opportunity").symbol);
  }
}

const deficit = engine.shiftStatus(staff([row("M", 11, 12, 1)]), "M");
assert.equal(deficit.level, "warning", "One missing agent must produce a warning");
const critical = engine.shiftStatus(staff([row("M", 9, 12, 4)]), "M");
assert.equal(critical.level, "critical", "Severe shortage must remain critical");
const missing = engine.shiftStatus({ available: false, rows: [] }, "M");
assert.equal(missing.level, "unknown", "Missing data must never be displayed as OK");

// The card's visible icon comes from the same shared status, with '+' for opportunity.
const spirit = fs.readFileSync(new URL("../esprit-equipe.js", import.meta.url), "utf8");
assert.match(spirit, /field\(\)\?\.shiftStatus\?\.\(staff, base\)/);
assert.match(spirit, /if \(level === "opportunity"\) return "\+"/);
console.log("STIP HCL shift icons: 5 shifts + shortage + missing-data checks OK");
