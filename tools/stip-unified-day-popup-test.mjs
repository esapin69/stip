import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const home = read("home-shell.js");
const team = read("team-home-fusion.js");
const weekCss = read("home-week-flip.css");
const index = read("index.html");
const loader = read("stip-loader.js");
const serviceWorker = read("stip-sw.js");

test("month and current-week days use one shared popup, not legacy shift overlay", () => {
  const month = home.split('dateJumpPanel?.addEventListener("click"')[1]?.split('root\n')[0] || "";
  const week = home.split('.querySelectorAll("[data-home-day]")')[1]?.split('root\n')[0] || "";
  assert.match(month, /selectMonthDay\(iso\);\s*openUnifiedDay\(iso\);/);
  assert.match(week, /openUnifiedDay\(iso\)/);
  assert.match(home, /STIPTeamFusion\.openDate\(\{ \.\.\.sharedTeamOptions, day: iso \}\)/);
  assert.doesNotMatch(month, /openShiftDetail\(|requestAnimationFrame/);
  assert.doesNotMatch(week, /openShiftDetail\(|requestAnimationFrame/);
  assert.match(month, /STIPLeaveCart\.toggle\(iso,/);
  assert.match(week, /STIPLeaveCart\.toggle\(iso,/);
});

test("only next Monday is previewed without navigating to the following week", () => {
  const preview = home.split("function weekFlipNextMonday()")[1].split("function weekFlipBack()")[0];
  assert.match(preview, /weekOffset: 1/);
  assert.match(preview, /SEMAINE PROCHAINE · LUNDI SEULEMENT/);
  assert.match(preview, /Voir ce lundi/);
  assert.match(home, /!b\.classList\.contains\("ghe-weekflip-monday-preview"\)/);
  assert.match(weekCss, /\.ghe-weekflip-next-divider/);
  assert.match(weekCss, /\.ghe-weekflip-next-action/);
});

test("shared popup opens before network responses settle and refreshes in place", async () => {
  const declaration = "  async function openDate(opts={}) {" + team.split("  async function openDate(opts={}) {")[1].split("  // Une fenêtre d'événement")[0];
  const popup = {
    open: true,
    dataset: { thfDay: "2026-10-19", thfUserInteracted: "0" },
    classList: { contains: (name) => name === "thf-day-popup" }
  };
  const host = { isConnected: true, dataset: {}, _thfSummary: { day: "2026-10-19" } };
  const events = [];
  let resolveUpdates;
  const updates = new Promise((resolve) => { resolveUpdates = resolve; });
  const document = {
    getElementById: (id) => id === "hcWeekFusionPopupHost" ? host : id === "thfPopup" ? popup : null,
    createElement: () => { throw new Error("Unexpected host recreation"); },
    body: { appendChild: () => { throw new Error("Unexpected append"); } }
  };
  const mount = (opts) => {
    host.dataset.thfDay = opts.day;
    events.push("mount");
    return updates;
  };
  const openDay = (_, opts = {}) => { events.push(opts.refresh ? "refresh" : "open"); };
  const context = { document, mount, openDay, Promise, console, pendingWeekPopup: 0 };
  vm.runInNewContext(declaration + "\nthis.openDate = openDate;", context, { timeout: 1000 });
  const result = context.openDate({ day: "2026-10-19" });
  assert.deepEqual(events, ["mount", "open"], "dialog must already be visible before the network resolves");
  assert.equal(await result, true);
  resolveUpdates();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["mount", "open", "refresh"], "data update must reuse open dialog");
});

test("cache revision stays coherent across page, loader and service worker", () => {
  const version = index.match(/stip-ui-build" content="([^"]+)"/)?.[1];
  assert.ok(version);
  assert.equal(version, loader.match(/V = "([^"]+)"/)?.[1]);
  assert.equal(version, serviceWorker.match(/STIP_SW_BUILD="([^"]+)"/)?.[1]);
  for (const asset of ["home-shell.js", "team-home-fusion.js", "home-week-flip.css", "/stip-sw.js"]) {
    assert.ok(index.includes(asset + "?v=" + version), "Outdated asset: " + asset);
  }
});
