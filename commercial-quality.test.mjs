import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const read = (name) => readFileSync(new URL("./" + name, import.meta.url), "utf8");

test("Le moteur professionnel et tous les identifiants essentiels sont conservés", () => {
  const html = read("index.html");
  const app = read("fauteuil-app.js");
  for (const id of ["fw-auth","fw-pin","fw-login-button","fw-login-form","fw-trainee","fw-trainee-form","fw-trainee-select","fw-board","fw-chat","fw-refresh","fw-logout","fw-retry","fw-login-status","fw-connection-status","fw-user","fw-account"]) {
    assert.match(html, new RegExp('id="' + id + '"'), id + " doit subsister");
  }
  assert.match(app, /STIPTableau\.mount\(ids\("chat"\), \{ mode: "wheelchair" \}\)/);
  assert.match(app, /session\?\.permissions\?\.messages === true/);
  assert.match(app, /accessFamily\(session\) === "brancardage"/);
  assert.match(html, /fauteuil-premium\.css/);
  assert.match(html, /ghe\.esapin\.com\/team-chat\.js/);
});

test("La vitrine n’expose ni catalogue ni backend professionnel", () => {
  const landing = read("presentation.html");
  assert.match(landing, /Donn\u00e9es fictives exclusivement/);
  assert.match(landing, /Aucune affiliation hospitali\u00e8re revendiqu\u00e9e/);
  assert.match(landing, /href="\.\/demo\.html"/);
  assert.doesNotMatch(landing, /yzsrmuxghlengnkyphxj|functions\/v1\/|session_token/);
  assert.doesNotMatch(landing, /<form/);
});

test("La démo reste locale et n'utilise aucun jeton ni API", () => {
  const demo = read("demo.html"), js = read("demo.js");
  assert.match(demo, /EXEMPLE|ENVIRONNEMENT DE D\u00c9MONSTRATION/);
  assert.match(demo, /id="demo-create-form"/);
  assert.match(demo, /id="demo-filter"/);
  assert.match(demo, /id="demo-reset"/);
  assert.match(js, /records\.unshift/);
  assert.match(js, /records = records\.filter/);
  for (const marker of ["fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "indexedDB", "supabase.co", "ghe.esapin.com", "document.cookie", "sendBeacon", "WebSocket"]) {
    assert.ok(!js.includes(marker), "Démo ne doit pas appeler " + marker);
  }
  assert.doesNotMatch(demo, /src="https?:\/\//);
  assert.doesNotMatch(demo, /<form[^>]+action=/);
});

test("Les versions mobile et accessibilité sont prises en compte", () => {
  const style = read("premium.css"), secureStyle = read("fauteuil-premium.css");
  for (const css of [style, secureStyle]) {
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /max-width:6(?:20|60)px|max-width:760px/);
    assert.match(css, /focus-visible/);
  }
  assert.match(read("demo.html"), /aria-live="polite"/);
  assert.match(read("presentation.html"), /class="pr-skip"/);
});