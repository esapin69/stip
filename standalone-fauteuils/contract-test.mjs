import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";
const root = new URL("./", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");

test("Fauteuils utilise le moteur et le catalogue canoniques", () => {
  const html = read("index.html");
  const app = read("fauteuil-app.js");
  assert.match(html, /https:\/\/ghe\.esapin\.com\/team-chat\.js/);
  assert.match(html, /https:\/\/ghe\.esapin\.com\/team-chat\.css/);
  assert.match(app, /functions\/v1\/stip-access/);
  assert.match(app, /STIPTableau\.mount\(ids\("chat"\), \{ mode: "wheelchair" \}\)/);
  assert.doesNotMatch(app, /\.from\(["']stip_places["']\)/);
  assert.doesNotMatch(html, /<script[^>]*src=["']\/team-chat\.js/);
});

test("Session protégée et tolérante aux pannes", () => {
  const app = read("fauteuil-app.js");
  assert.match(app, /accessFamily\(session\) === "brancardage"/);
  assert.match(app, /permissions\?\.messages === true/);
  assert.match(app, /httpStatus === 401 \|\| error\?\.httpStatus === 403/);
  assert.match(app, /ids\("retry"\)\.addEventListener\("click", boot\)/);
  assert.match(read("index.html"), /id="fw-connection-status"/);
});

test("Le paquet n'impose pas de CNAME du site GHE", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.id, "/");
  assert.equal(manifest.scope, "./");
});
