import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../stip-loader.js", import.meta.url), "utf8");

function harness({ saveData = false } = {}) {
  const events = new Map();
  const idle = [];
  const requests = [];
  const storage = new Map();
  const location = {
    origin: "https://ghe.esapin.com",
    href: "https://ghe.esapin.com/index.html",
    pathname: "/index.html",
    search: "",
    assign: () => {},
  };
  const on = (type, fn) => {
    const list = events.get(type) || [];
    list.push(fn);
    events.set(type, list);
  };
  const document = {
    baseURI: location.href,
    hidden: false,
    documentElement: { dataset: {} },
    addEventListener: on,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { appendChild: () => {} },
    head: { appendChild: () => {} },
  };
  const window = {
    STIPSession: null,
    STIPPreview: null,
    addEventListener: on,
    requestIdleCallback: (fn) => idle.push(fn),
  };
  class DOMParser {
    parseFromString(markup) {
      return {
        querySelectorAll: () =>
          [...markup.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => ({
            getAttribute: () => match[1],
          })),
      };
    }
  }
  const fetch = async (raw, init = {}) => {
    const url = new URL(raw, location.href);
    assert.equal(url.origin, location.origin);
    assert.equal(init.method, "GET");
    requests.push(url.pathname + url.search);
    const stem = url.pathname.split("/").pop().replace(/\.html?$/, "");
    const html = '<link rel="stylesheet" href="' + stem + '.css?v=1"><script src="' + stem + '.js?v=1"></script>';
    return { ok: true, clone: () => ({ text: async () => html }) };
  };
  runInNewContext(source, {
    window, document, location, navigator: { connection: { saveData } },
    localStorage: { getItem: (key) => storage.get(key) || "" },
    fetch, DOMParser, URL, Promise, Map, Set, CustomEvent: class {},
    setTimeout: () => 1, console,
    requestIdleCallback: window.requestIdleCallback,
  }, { filename: "stip-loader.js" });
  const emit = (type, detail) =>
    (events.get(type) || []).forEach((fn) => fn({ detail }));
  async function flush() {
    while (idle.length) idle.shift()({ timeRemaining: () => 30 });
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return { window, document, storage, requests, emit, flush };
}

const app = harness();
await app.flush();
assert.deepEqual(app.requests, [], "No background requests before login");

app.storage.set("stip_session_v1", "test-session");
const session = {
  agent: { id: "employee-A" },
  role_key: "agent",
  permissions: {
    agent_directory: true,
    agent_dates: true,
    planning_team: false,
    activity: false,
    assistant_enabled: false,
  },
};
app.window.STIPSession = session;
app.emit("stip:session-ready", session);
await app.flush();

for (const file of ["mon-compte.html", "agent-directory.html", "agent-dates.html", "agent-date-detail.html"]) {
  assert.ok(app.requests.includes("/" + file), "Expected " + file + " to be preloaded");
}
assert.ok(!app.requests.includes("/esprit-equipe.html"), "Do not warm unauthorized pages");
assert.ok(app.requests.includes("/agent-directory.css?v=1"), "Warm page-specific CSS");
assert.ok(app.requests.includes("/agent-directory.js?v=1"), "Warm page-specific JS");
assert.ok(app.requests.every((url) => !url.includes("/functions/") && !url.includes("/api/")), "Never prefetch private APIs");

const length = app.requests.length;
app.emit("stip:session-refreshed", session);
await app.flush();
assert.equal(app.requests.length, length, "Deduplicate repeated session signals");

app.storage.delete("stip_session_v1");
app.window.STIPSession = null;
app.emit("stip:session-ended");
app.window.STIPLoad.warmAgentPages(session);
await app.flush();
assert.equal(app.requests.length, length, "Do not prefetch after logout");

const metered = harness({ saveData: true });
metered.storage.set("stip_session_v1", "metered-session");
metered.window.STIPSession = session;
metered.emit("stip:session-ready", session);
await metered.flush();
assert.deepEqual(metered.requests, [], "Respect data saver");

console.log("GHE agent-page prewarming: authorization, assets, session, and data saver OK.");
