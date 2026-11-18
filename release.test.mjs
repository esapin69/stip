import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {test} from "node:test";
const read=x=>readFileSync(new URL(x,import.meta.url),"utf8");
test("Le site de publication est séparé de GHE et de ses sessions",()=>{
  const html=read("./index.html"),js=read("./fauteuil-app.js");
  assert.match(html,/https:\/\/ghe\.esapin\.com\/team-chat\.js/);
  assert.match(html,/https:\/\/ghe\.esapin\.com\/team-chat\.css/);
  assert.match(js,/supabase\.co\/functions\/v1\/stip-access/);
  assert.match(js,/STIPTableau\.mount\(ids\("chat"\), \{ mode: "wheelchair" \}\)/);
  assert.match(js,/session\?\.permissions\?\.messages === true/);
  assert.match(js,/accessFamily\(session\) === "brancardage"/);
  assert.match(js,/function dropLocalSession\(\)/);
  assert.doesNotMatch(js,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(html,/<iframe|<script[^>]+src="\/team-chat\.js/i);
  assert.equal(JSON.parse(read("./manifest.webmanifest")).id,"/");
  assert.match(read("./robots.txt"),/Disallow: \//);
});
