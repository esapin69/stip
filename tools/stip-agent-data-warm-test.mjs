import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../stip-loading.js", import.meta.url), "utf8");
const directorySource = readFileSync(new URL("../agent-directory.js", import.meta.url), "utf8");
const datesSource = readFileSync(new URL("../agent-dates.js", import.meta.url), "utf8");
const datesHTML = readFileSync(new URL("../agent-dates.html", import.meta.url), "utf8");
const loaderSource = readFileSync(new URL("../stip-loader.js", import.meta.url), "utf8");

class Store {
  map = new Map();
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] || null; }
  getItem(k) { return this.map.get(k) ?? null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

function createPage({ saveData = false, sessionStorage = new Store(), localStorage = new Store(), status = 200 } = {}) {
  const events = new Map();
  const calls = [];
  const window = {
    STIPPreview: null,
    STIPSession: null,
    addEventListener(type, callback) {
      const list = events.get(type) || [];
      list.push(callback);
      events.set(type, list);
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const body = JSON.parse(options.body);
      const items = body.action === "directory"
        ? [{ id: "A", prenom: "Agent" }]
        : [{ id: "B", date: "2026-10-13", category: "medical" }];
      return { ok: status === 200, status, json: async () => ({ items }) };
    },
  };
  const document = { hidden: false, body: { appendChild() {} } };
  const navigator = { connection: { saveData } };
  runInNewContext(source, {
    window, document, navigator, sessionStorage, localStorage, console,
    Map, Set, Date, JSON, DOMException, Response, performance,
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams,
  }, { filename: "stip-loading.js" });
  return {
    window, calls, localStorage, sessionStorage,
    emit(event, detail) {
      for (const fn of events.get(event) || []) fn({ detail });
    },
  };
}

const storage = new Store(), local = new Store();
const first = createPage({ localStorage: local, sessionStorage: storage });
const session = {
  agent: { id: "A" },
  permissions: { agent_directory: true, agent_dates: true },
};
local.setItem("stip_session_v1", "token-A");
assert.equal(await first.window.STIPReadCache.agentWarm.warm("directory", { agent: {}, permissions: {} }), false);
assert.equal(first.calls.length, 0, "Unauthorized sessions must never prewarm");
first.window.STIPSession = session;
assert.equal(await first.window.STIPReadCache.agentWarm.warm("directory", session), true);
assert.equal(first.calls.length, 1);
assert.ok(first.calls[0].url.endsWith("/stip-agent-readonly"));
assert.equal(first.calls[0].options.headers["X-STIP-Session"], "token-A");
assert.deepEqual(JSON.parse(JSON.stringify(first.window.STIPReadCache.agentWarm.read("directory").items)), [
  { id: "A", prenom: "Agent" },
]);
assert.equal(await first.window.STIPReadCache.agentWarm.warm("directory", session), true);
assert.equal(first.calls.length, 1, "A fresh response must not generate redundant requests");
assert.equal(await first.window.STIPReadCache.agentWarm.warm("dates", session), true);
assert.equal(JSON.parse(first.calls[1].options.body).session_token, "token-A");

const destination = createPage({ localStorage: local, sessionStorage: storage });
assert.ok(destination.window.STIPReadCache.agentWarm.read("directory"), "Next document must see fresh scoped data");
assert.ok(destination.window.STIPReadCache.agentWarm.read("dates"));

local.setItem("stip_session_v1", "token-B");
assert.equal(destination.window.STIPReadCache.agentWarm.read("directory"), null, "Never show agent A data to agent B");
destination.emit("stip:session-ended");
assert.equal(storage.length, 0, "Logout removes all tab-level prewarming");

const metered = createPage({ saveData: true });
metered.localStorage.setItem("stip_session_v1", "token-C");
metered.window.STIPSession = session;
assert.equal(await metered.window.STIPReadCache.agentWarm.warm("directory", session), false);
assert.equal(metered.calls.length, 0, "Respect the phone's data saver");

const rejected = createPage({ status: 403 });
rejected.localStorage.setItem("stip_session_v1", "token-D");
rejected.window.STIPSession = session;
assert.equal(await rejected.window.STIPReadCache.agentWarm.warm("directory", session), false);
assert.equal(rejected.window.STIPReadCache.agentWarm.read("directory"), null, "Never cache rejected reads");

local.setItem("stip_session_v1", "token-A");
const again = createPage({ localStorage: local, sessionStorage: storage });
again.window.STIPSession = session;
await again.window.STIPReadCache.agentWarm.warm("directory", session);
again.emit("stip:session-refreshed", { permissions: { agent_directory: false, agent_dates: true } });
assert.equal(again.window.STIPReadCache.agentWarm.read("directory"), null, "Permission changes invalidate warm data");

assert.match(directorySource, /agentWarm\?\.read\("directory"\)/);
assert.match(directorySource, /const fresh = await call\("directory"\)/);
assert.match(datesSource, /agentWarm\?\.read\("dates"\)/);
assert.doesNotMatch(datesSource, /localStorage\.setItem\(\s*CACHE/);
assert.match(datesHTML, /stip-loading\.js/);
assert.match(loaderSource, /agentWarm\?\.warm\(dataKind, session\)/);

console.log("GHE warm agent data: authorized fetches, cross-document speedup, session isolation, revalidation and data saver OK.");
