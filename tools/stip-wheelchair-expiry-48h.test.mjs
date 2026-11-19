import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const api=read("supabase/functions/stip-messages/index.ts");
const purge=read("supabase/functions/stip-team-chat-purge/index.ts");
const front=read("team-chat.js");

function retention(source) {
  const matched=source.match(/const WHEELCHAIR_MAX_AGE_MS\s*=\s*48\s*\*\s*60\s*\*\s*60\s*\*\s*1000;?[\s\S]*?function isActiveWheelchairRow\(row(?::\s*any)?\)\s*\{[\s\S]*?\n\}/);
  assert.ok(matched,"Fonctions de conservation introuvables");
  const js=matched[0].replace(/row:\s*any/g,"row");
  class FixedDate extends Date {}
  FixedDate.now=()=>now;
  return new Function("Date",js+"\nreturn {isExpiredWheelchairRow,isActiveWheelchairRow};")(FixedDate);
}
const now=Date.parse("2026-11-19T12:00:00Z");
const backend=retention(api),scheduler=retention(purge);
const hour=60*60*1000;
const wheelchair=(ageInHours,type="spot",status="active")=>({
  created_at:new Date(now-ageInHours*hour).toISOString(),
  payload:{wheelchair:{type,status}}
});
const chat=(ageInHours)=>({created_at:new Date(now-ageInHours*hour).toISOString(),payload:{}});

test("Un fauteuil actif expire exactement à 48 heures dans les deux moteurs",()=>{
  for(const engine of [backend,scheduler]){
    assert.equal(engine.isActiveWheelchairRow(wheelchair(47.999),now),true);
    assert.equal(engine.isExpiredWheelchairRow(wheelchair(47.999),now),false);
    assert.equal(engine.isActiveWheelchairRow(wheelchair(48),now),false);
    assert.equal(engine.isExpiredWheelchairRow(wheelchair(48),now),true);
    assert.equal(engine.isExpiredWheelchairRow(wheelchair(60),now),true);
    assert.equal(engine.isExpiredWheelchairRow(wheelchair(72),now),true);
  }
});

test("Un message normal, un 'Je cherche' et un signalement résolu ne sont pas visés par cette expiration",()=>{
  for(const engine of [backend,scheduler]){
    assert.equal(engine.isExpiredWheelchairRow(chat(120),now),false);
    assert.equal(engine.isExpiredWheelchairRow(wheelchair(120,"search","active"),now),false);
    assert.equal(engine.isExpiredWheelchairRow(wheelchair(120,"spot","resolved"),now),false);
  }
});

test("Une date manquante ou invalide ne rend pas un ancien signalement immortel",()=>{
  for(const engine of [backend,scheduler]){
    const bad={payload:{wheelchair:{type:"spot",status:"active"}},created_at:"invalid-date"};
    assert.equal(engine.isActiveWheelchairRow(bad,now),false);
    assert.equal(engine.isExpiredWheelchairRow(bad,now),true);
  }
});

test("Le backend filtre le fil sans attendre le nettoyage nocturne",()=>{
  assert.match(api,/const messages=\[\.\.\.carryover,\.\.\.\(currentMessages\|\|\[\]\)\.filter\(\(row:any\)=>!isExpiredWheelchairRow\(row\)\)\]/);
  assert.match(api,/rows\.push\(\.\.\.batch\.filter\(isActiveWheelchairRow\)\)/);
  assert.match(api,/async function teamFeedVersion\(ctx:any\)/);
  assert.equal((api.match(/version:await teamFeedVersion\(ctx\)/g)||[]).length,2);
  assert.match(api,/Math\.floor\(Date\.now\(\)\/\(5\*60\*1000\)\)/);
});

test("Le nettoyage existant supprime les seuls messages non protégés et leurs photos",()=>{
  assert.match(purge,/const stale = rows\.filter\([\s\S]*?!isActiveWheelchairRow\(row\)/);
  assert.match(purge,/const kept = rows\.filter\(isActiveWheelchairRow\)/);
  assert.match(purge,/const stale = rows\.filter\(\(row: any\) => !isActiveWheelchairRow\(row\)\)/);
  assert.match(purge,/deleteMessages\(ids\)/);
  assert.match(purge,/removePaths\(/);
});

test("L'interface n'annonce plus une conservation illimitée",()=>{
  assert.doesNotMatch(front,/Repère indicatif · aucune expiration automatique/);
  assert.match(front,/Visible 48 h après signalement/);
});

test("La purge refuse les appels non authentifiés avant toute suppression",()=>{
  assert.match(purge,/req\.headers\.get\("x-stip-cron-token"\)/);
  assert.match(purge,/\^\[a-f0-9\]\{64\}\$/i);
  assert.match(purge,/db\.rpc\([\s\S]*?"stip_authorize_tableau_purge"/);
  assert.match(purge,/authorized !== true/);
  assert.match(purge,/body\?\.action === "verify_auth"/);
  assert.ok(purge.indexOf('db.rpc(') < purge.indexOf('const result = await purgePreviousDays()'));
  assert.doesNotMatch(purge,/console\.log\(providedToken\)/);
});

test("La migration du cron sécurise le jeton sans créer de nouveau service",()=>{
  const sql=read("docs/fauteuils-48h-secure-cron.sql");
  assert.match(sql,/vault\.create_secret\(/);
  assert.match(sql,/extensions\.gen_random_bytes\(32\)/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.stip_authorize_tableau_purge\(text\)/);
  assert.match(sql,/FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.stip_authorize_tableau_purge\(text\)/);
  assert.match(sql,/TO service_role/);
  assert.match(sql,/cron\.alter_job\(/);
  assert.match(sql,/x-stip-cron-token/);
  assert.doesNotMatch(sql,/cron\.schedule\(/);
  assert.doesNotMatch(sql,/sb_secret_[A-Za-z0-9]/);
});
