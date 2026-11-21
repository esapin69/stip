import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = dirname(fileURLToPath(import.meta.url));
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".webmanifest":"application/manifest+json"};
const server = createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  const file = resolve(root, "." + (pathname === "/" ? "/presentation.html" : pathname));
  if (!file.startsWith(root + "/") || !existsSync(file)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, {"content-type": mime[extname(file)] || "application/octet-stream", "cache-control":"no-store"});
  res.end(readFileSync(file));
});
await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const base = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  for (const viewport of [{width:390,height:844},{width:1280,height:900}]) {
    const ctx = await browser.newContext({viewport});
    const page = await ctx.newPage();
    const errors = [];
    const outside = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => {
      if (route.request().url().startsWith(base)) return route.continue();
      outside.push(route.request().url());
      return route.abort();
    });
    await page.goto(base + "/presentation.html", {waitUntil:"domcontentloaded"});
    assert.equal(await page.locator("h1").count(), 1);
    assert.ok(await page.locator("h1").innerText().then(text => text.includes("Chaque fauteuil")));
    const dx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(dx <= 3, "Vitrine trop large sur "+viewport.width+"px : "+dx);
    await page.getByRole("link", {name:/Découvrir en situation/}).click();
    await page.waitForURL("**/demo.html");
    assert.ok(await page.getByText("Hôpital Démo", {exact:false}).count()>0);
    const count = await page.locator(".pr-demo-item").count();
    assert.equal(count,4,"Quatre signalements fictifs à l'ouverture");

    await page.locator("#demo-filter").selectOption("search");
    assert.equal(await page.locator(".pr-demo-item").count(),1);
    await page.locator("#demo-filter").selectOption("all");
    await page.locator("#demo-search").fill("Bâtiment B");
    assert.equal(await page.locator(".pr-demo-item").count(),1);
    await page.locator("#demo-search").fill("");

    await page.locator("#demo-add-top").click();
    await page.locator("#demo-location").fill("devant le poste de soins fictif");
    await page.locator("#demo-create-form button[type=submit]").click();
    assert.equal(await page.locator(".pr-demo-item").count(),5,"L'ajout fictif fonctionne");
    await page.locator(".pr-demo-item").first().locator("button").click();
    assert.equal(await page.locator(".pr-demo-item").count(),4,"La récupération fictive fonctionne");
    await page.locator("#demo-reset").click();
    assert.equal(await page.locator(".pr-demo-item").count(),4,"Le retour à zéro fonctionne");
    const demoDx = await page.evaluate(() => document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(demoDx <= 3,"Démo trop large sur "+viewport.width+"px : "+demoDx);
    assert.equal(errors.length,0,errors.join(" / "));
    assert.equal(outside.some(url => /supabase\.co|ghe\.esapin\.com/.test(url)),false,"La démo ne doit jamais joindre GHE ou Supabase");
    await ctx.close();
  }
  console.log("PASS : vitrine et démo sur mobile et ordinateur, filtres, création, récupération, remise à zéro, zéro API métier.");
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}