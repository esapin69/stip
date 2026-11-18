import { readFileSync } from "node:fs";
import vm from "node:vm";
import { strict as assert } from "node:assert";
import { test } from "node:test";

const source = readFileSync(new URL("./fauteuil-app.js", import.meta.url), "utf8");
const allowed = (overrides = {}) => ({
  role_key: "brancardier",
  permissions: { messages: true, communication_family: "brancardage" },
  agent: { prenom: "Agent", nom: "Test" },
  ...overrides,
});
const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

function harness({ savedToken = "", routes = {}, engine = true } = {}) {
  const values = new Map(savedToken ? [["stip_session_v1", savedToken]] : []);
  const elements = new Map();
  const documentHandlers = new Map();
  const windowHandlers = new Map();
  const requests = [];
  const mounts = [];
  const stops = [];
  const node = (id) => {
    if (!elements.has(id)) elements.set(id, {
      id, hidden: false, textContent: "", value: "", disabled: false,
      listeners: new Map(), options: [],
      addEventListener(type, callback) { this.listeners.set(type, callback); },
      replaceChildren(...options) { this.options = [...options]; },
      add(option) { this.options.push(option); },
    });
    return elements.get(id);
  };
  const tableau = engine ? {
    mount(element, options) { mounts.push({ element, options }); },
    stop() { stops.push("stop"); },
    refresh() {},
  } : null;
  const context = {
    console,
    document: {
      hidden: false,
      getElementById: node,
      addEventListener(type, callback) { documentHandlers.set(type, callback); },
    },
    window: {
      STIPTableau: tableau,
      addEventListener(type, callback) { windowHandlers.set(type, callback); },
    },
    localStorage: {
      getItem(key) { return values.get(key) || null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); },
    },
    Option: class { constructor(text, value) { this.text = text; this.value = value; } },
    fetch: async (_, request) => {
      const body = JSON.parse(request.body);
      requests.push({ action: body.action, body, token: request.headers["x-stip-session"] });
      const selected = routes[body.action];
      if (selected === undefined) throw new Error("Missing test route: " + body.action);
      const payload = typeof selected === "function" ? await selected(body) : selected;
      if (payload instanceof Error) throw payload;
      const status = Number(payload?.status || 200);
      const responseBody = payload?.status ? payload.body : payload;
      return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => responseBody || {},
      };
    },
  };
  vm.runInNewContext(source, context, { filename: "fauteuil-app.js", timeout: 1000 });
  return {
    context, node, requests, mounts, stops,
    saved: () => values.get("stip_session_v1") || "",
    async submit(code) {
      node("fw-pin").value = code;
      await node("fw-login-form").listeners.get("submit")({ preventDefault() {} });
      await flush();
    },
    async selectTrainee(key) {
      node("fw-trainee-select").value = key;
      await node("fw-trainee-form").listeners.get("submit")({ preventDefault() {} });
      await flush();
    },
    async retry() { await node("fw-retry").listeners.get("click")(); await flush(); },
    async visibility() { await documentHandlers.get("visibilitychange")(); await flush(); },
    async online() { await windowHandlers.get("online")(); await flush(); },
    async ready() { await flush(); },
  };
}

test("Sans code : aucun accès aux messages et aucun appel réseau", async () => {
  const h = harness();
  await h.ready();
  assert.equal(h.node("fw-auth").hidden, false);
  assert.equal(h.node("fw-board").hidden, true);
  assert.equal(h.mounts.length, 0);
  assert.equal(h.requests.length, 0);
});

test("Connexion autorisée : même moteur fauteuils, même session", async () => {
  const h = harness({ routes: { login: { ...allowed(), session_token: "validtoken" } } });
  await h.submit("123456");
  assert.equal(h.saved(), "validtoken");
  assert.equal(h.node("fw-board").hidden, false);
  assert.equal(h.mounts.length, 1);
  assert.equal(h.mounts[0].options.mode, "wheelchair");
  assert.equal(h.requests[0].action, "login");
});

test("Profil hors brancardage : pas d'affichage et jeton local supprimé", async () => {
  const h = harness({ routes: {
    login: { ...allowed({ permissions: { messages: true, communication_family: "hors_brancardage" } }), session_token: "invalidScope" },
  } });
  await h.submit("123456");
  assert.equal(h.saved(), "");
  assert.equal(h.node("fw-board").hidden, true);
  assert.equal(h.mounts.length, 0);
  assert.equal(h.node("fw-auth").hidden, false);
});

test("Accès messages refusé : impossible de monter le chat", async () => {
  const h = harness({ routes: {
    login: { ...allowed({ permissions: { messages: false, communication_family: "brancardage" } }), session_token: "noMessages" },
  } });
  await h.submit("123456");
  assert.equal(h.saved(), "");
  assert.equal(h.mounts.length, 0);
});

test("Session expirée au démarrage : efface le jeton, jamais de messages", async () => {
  const h = harness({ savedToken: "expired", routes: { me: { status: 401, body: { error: "Session expirée." } } } });
  await h.ready();
  assert.equal(h.saved(), "");
  assert.equal(h.mounts.length, 0);
  assert.equal(h.node("fw-auth").hidden, false);
});

test("Panne réseau au démarrage : conserve jeton et bouton réessayer", async () => {
  const h = harness({ savedToken: "keep", routes: { me: new Error("offline") } });
  await h.ready();
  assert.equal(h.saved(), "keep");
  assert.equal(h.node("fw-retry").hidden, false);
  assert.equal(h.node("fw-board").hidden, true);
});

test("Moteur absent : reste fermé et propose une reprise sans perdre le jeton", async () => {
  const h = harness({ savedToken: "keep", routes: { me: allowed() }, engine: false });
  await h.ready();
  assert.equal(h.saved(), "keep");
  assert.equal(h.mounts.length, 0);
  assert.equal(h.node("fw-retry").hidden, false);
  h.context.window.STIPTableau = { mount(el, opts) { h.mounts.push({ element: el, options: opts }); } };
  await h.retry();
  assert.equal(h.mounts.length, 1);
  assert.equal(h.node("fw-board").hidden, false);
});

test("Session refusée au retour : l'interface se ferme et le jeton est effacé", async () => {
  let blocked = false;
  const h = harness({ savedToken: "active", routes: {
    me: () => blocked ? { status: 403, body: { error: "Accès non autorisé." } } : allowed(),
  } });
  await h.ready();
  assert.equal(h.node("fw-board").hidden, false);
  blocked = true;
  await h.visibility();
  assert.equal(h.saved(), "");
  assert.equal(h.node("fw-board").hidden, true);
  assert.ok(h.stops.length >= 1);
});

test("Retour de connexion : conserve la session et efface le message d'erreur", async () => {
  let online = true;
  const h = harness({ savedToken: "active", routes: {
    me: () => online ? allowed() : new Error("offline"),
  } });
  await h.ready();
  online = false;
  await h.visibility();
  assert.equal(h.saved(), "active");
  assert.equal(h.node("fw-board").hidden, false);
  assert.match(h.node("fw-connection-status").textContent, /indisponible/);
  online = true;
  await h.online();
  assert.equal(h.node("fw-connection-status").textContent, "");
});

test("Stagiaire : sélection du profil exigée avant montage du chat", async () => {
  const h = harness({ routes: {
    login: { ...allowed({ role_key: "stagiaire", trainee_selection_required: true }), session_token: "student" },
    trainee_list: { items: [{ key: "student-1", prenom: "Etudiant", nom: "Test" }] },
    trainee_select: { ...allowed({ role_key: "stagiaire", trainee_selection_required: false }) },
  } });
  await h.submit("123456");
  assert.equal(h.mounts.length, 0);
  assert.equal(h.node("fw-trainee").hidden, false);
  assert.equal(h.node("fw-trainee-select").options.length, 2);
  await h.selectTrainee("student-1");
  assert.equal(h.mounts.length, 1);
  assert.equal(h.saved(), "student");
});
