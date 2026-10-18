import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const read=name=>readFileSync(join(root,name),"utf8");
const choices=read("ghe-smart-choices.js");
const leisure=read("ensemble-v3.js");
const directory=read("agent-directory.js");
const agenda=read("agent-agenda-view.js");
const inbox=read("communication-hub.js");
const routes={
  createPerson:"agent-directory.html?intent=add-event",
  activity:"sorties-loisirs.html?tab=create",
  driver:"sorties-loisirs.html?tab=trips&choice=driver",
  passenger:"sorties-loisirs.html?tab=trips&choice=passenger",
  messages:"index.html?quick=communication&tab=dm&filter=colleagues#/communication/dm",
  eventChats:"index.html?quick=communication&tab=dm&filter=events#/communication/dm",
  wheelchairs:"index.html?quick=communication&tab=fauteuils#/communication/fauteuils"
};
for(const [key,href] of Object.entries(routes)){
  assert.ok(choices.includes(key+':"'+href+'"'),key+" a perdu sa destination");
  assert.ok(existsSync(join(root,href.split(/[?#]/)[0])),key+" pointe vers une page inexistante");
}
assert.match(choices,/row\("🚗","Proposer un covoiturage"[^\n]*"carpool"\)/);
assert.match(leisure,/entryCarpoolChoice==="driver"/);
assert.match(leisure,/kind==="offer"&&t\.status==="active"/);
assert.match(leisure,/data-ev3-driver-enable/);
assert.match(directory,/createEventIntent/);
assert.match(directory,/openPlanning\(agent\.source_key, agent, \{ intent: "add-event" \}\)/);
assert.match(agenda,/options\.intent==="add-event"/);
assert.match(agenda,/if\(!viewer\.can_manage&&!viewer\.is_self\)return""/);
assert.match(inbox,/scope==="events"/);
assert.match(inbox,/scope==="colleagues"/);
assert.match(inbox,/conversations\.filter\(c=>!!c\.event\)/);
assert.match(read("index.html"),/ghe-smart-choices\.js\?v=20261018-choice-routes1/);
assert.match(read("sorties-loisirs.html"),/ensemble-v3\.js\?v=20261018-choice-routes1/);
assert.match(read("agent-directory.html"),/agent-directory\.js\?v=20261018-choice-routes1/);
console.log("GHE : 8 choix, routes, permissions et assets vérifiés.");
