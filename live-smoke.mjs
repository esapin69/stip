import assert from "node:assert/strict";
const base="https://fauteuils-entraide-ghe.onrender.com";
async function get(path,contains) {
 const res=await fetch(base+path,{redirect:"error",headers:{"cache-control":"no-cache"}});
 assert.equal(res.status,200,base+path+" returned "+res.status);
 const body=await res.text();
 assert.ok(body.includes(contains),path+" is missing expected content");
 return body;
}
const html=await get("/","id=\"fw-login-form\"");
assert.ok(!html.includes("patient_id") && !html.includes("SUPABASE_SERVICE_ROLE_KEY"),"no private data or server key in public HTML");
const code=await get("/fauteuil-app.js","function dropLocalSession()");
assert.match(code,/accessFamily\(session\) === "brancardage"/);
assert.match(code,/messages === true/);
const manifest=JSON.parse(await get("/manifest.webmanifest","\"Fauteuils\""));
assert.equal(manifest.id,"/");
await get("/robots.txt","Disallow: /");
const engine=await fetch("https://ghe.esapin.com/team-chat.js",{redirect:"error"});
assert.equal(engine.status,200,"shared GHE engine must be accessible");
assert.match(await engine.text(),/wheelchair_catalog/);
const api=await fetch("https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages",{
 method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"wheelchair_catalog"})
});
assert.ok([401,403].includes(api.status),"unauthenticated catalog access must be refused, received "+api.status);
const authBody=await api.text();
assert.ok(!authBody.includes('"buildings"') && !authBody.includes('"targets"'),"catalog data must not be returned to unauthenticated request");
console.log("PASS : site distant disponible, fichiers sûrs, moteur GHE accessible, catalogue refusé sans session.");
