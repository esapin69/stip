import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = dirname(fileURLToPath(import.meta.url));

const requestActions = [];
const clientErrors = [];
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json" };
const server = createServer((req,res)=>{
  const file = resolve(root, "." + new URL(req.url || "/", "http://localhost").pathname.replace(/\/$/,"/index.html"));
  if (!file.startsWith(root + "/") || !existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, {"content-type":mime[extname(file)] || "application/octet-stream", "cache-control":"no-store"});
  res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const port = server.address().port;

const allowed = {
  role_key:"brancardier",
  permissions:{messages:true,communication_family:"brancardage"},
  agent:{id:"fixture-agent",prenom:"Test",nom:"Agent"},
  trainee_selection_required:false
};
const response = (status,body) => ({status,headers:{
    "access-control-allow-origin":"*",
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"content-type, x-stip-session",
    "cache-control":"no-store",
    "content-type":"application/json"
  },body:JSON.stringify(body)
});
let deny = false;
let serviceName = "Service fictif initial";
let browser;
try {
  browser = await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.route(/^https:\/\/yzsrmuxghlengnkyphxj\.supabase\.co\//, async route => {
    if(route.request().method()==="OPTIONS") return route.fulfill(response(200,{ok:true}));
    const body=route.request().postDataJSON();
    const action=String(body.action||"");
    requestActions.push(action);
    if(route.request().url().includes("/stip-access")){
      if(action==="login")return route.fulfill(deny?response(401,{error:"Code inconnu ou désactivé."}):response(200,{...allowed,session_token:"fixture-session"}));
      if(action==="me")return route.fulfill(response(200,allowed));
      if(action==="logout")return route.fulfill(response(200,{ok:true}));
      return route.fulfill(response(200,{}));
    }
    if(action==="wheelchair_catalog")return route.fulfill(response(200,{
      buildings:[{key:"neuro",label:"Neuro",levels:[{level:"RDC",places:[{label:serviceName,nearby:[]}]}]}],
      all_buildings:[{key:"neuro",label:"Neuro",aliases:[]}],
      targets:[{building_key:"neuro",building_label:"Neuro",level:"RDC",label:serviceName,location:serviceName}]
    }));
    if(action==="team_thread")return route.fulfill(response(200,{
      me:allowed.agent,conversation:{id:"fixture-conversation"},day:"2026-11-18",
      access_mode:"write",can_write:true,admin:false,version:"fixture",messages:[]
    }));
    if(action==="team_probe")return route.fulfill(response(200,{version:"fixture"}));
    return route.fulfill(response(200,{ok:true}));
  });
  const page = await context.newPage();
  page.on("pageerror",error=>clientErrors.push(error.message));
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
  assert.equal(await page.locator("#fw-board").isVisible(),false,"non connecté : chat masqué");
  assert.equal(requestActions.length,0,"aucune requête de donnée hors connexion");
  await page.locator("#fw-pin").fill("123456");
  await page.locator("#fw-login-button").click();
  await page.locator("#fw-chat .tb-page").waitFor({state:"visible",timeout:12000});
  assert.ok(requestActions.includes("wheelchair_catalog"),"le catalogue doit venir du backend central");
  assert.ok(requestActions.includes("team_thread"),"le fil doit venir du backend central");
  const html=await page.locator("#fw-chat").innerText();
  assert.match(html,/J.ai vu|Je cherche/,"le vrai moteur Fauteuils doit être affiché");
  assert.equal(clientErrors.length,0,"absence d'erreurs JavaScript : "+clientErrors.join(" | "));

  // L'historique se conserve côté serveur ; un rechargement redemande le catalogue.
  serviceName="Service fictif mis à jour";
  const before=requestActions.filter(x=>x==="wheelchair_catalog").length;
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#fw-chat .tb-page").waitFor({state:"visible",timeout:12000});
  assert.ok(requestActions.filter(x=>x==="wheelchair_catalog").length>before,"le service est relu depuis la source unique");

  await page.locator("#fw-logout").click();
  await page.locator("#fw-auth").waitFor({state:"visible"});
  assert.equal(await page.locator("#fw-board").isVisible(),false);

  deny=true;
  await page.locator("#fw-pin").fill("123456");
  await page.locator("#fw-login-button").click();
  await page.locator("#fw-login-status").getByText("Code inconnu ou désactivé.").waitFor({state:"visible"});
  assert.equal(await page.locator("#fw-board").isVisible(),false);

  console.log("PASS : vrai moteur UI, catalogue unique, connexion, persistance, déconnexion et refus (données fictives).");
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
