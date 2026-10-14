import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source=readFileSync(new URL("../team-home-fusion.js",import.meta.url),"utf8");
const anchor="window.STIPTeamFusion={mount};";
assert.equal(source.split(anchor).length,2,"Injection réservée aux tests");
const defs={
  CP:{label:"Congé payé",is_working:false,icon:"🏝️"},
  RH:{label:"Repos hebdomadaire",is_working:false,icon:"🛋️"},
  RTT:{label:"RTT",is_working:false,icon:"🌿"},
  MAL:{label:"Maladie",is_working:false},F0:{label:"Formation",is_working:false},
  J:{label:"Journée",is_working:true}
};
const clean=code=>String(code||"").toUpperCase();
const window={
  STIPShiftRegistry:{
    resolve:code=>defs[clean(code)]||null,
    baseCode:clean,
    displayName:code=>defs[clean(code)]?.label||clean(code),
    isWorking:code=>Boolean(defs[clean(code)]?.is_working),
    icon:code=>defs[clean(code)]?.icon||""
  },
  STIPName:{format:a=>a?.name||"Agent"}
};
runInNewContext(
  source.replace(anchor,"window.STIPTeamFusion={mount,_test:{restInfo,restPeersForDay,peopleGroups}};"),
  {window,document:{addEventListener(){}},Intl,Date}
);
const {restInfo,restPeersForDay,peopleGroups}=window.STIPTeamFusion._test;
for(const [code,type] of [["CP","rest:cp"],["RH","rest:rh"],["RTT","rest:rtt"]])
  assert.equal(restInfo(code)?.key,type,code+" doit être un repos");
for(const code of ["MAL","F0","J","UNKNOWN"])
  assert.equal(restInfo(code),null,code+" ne doit pas compter comme repos");
const rows=[
  ["a","CP"],["b","RH"],["c","RTT"],["b","RH"],
  ["d","MAL"],["e","F0"],["f","J"]
].map(([name,code])=>({code,agents:{name,source_key:name}}));
const peers=restPeersForDay(rows);
assert.equal(peers.length,3,"Compte les trois repos, sans doublon");
const groups=peopleGroups(peers);
assert.equal(groups.length,3,"Chaque type de repos a son groupe");
assert.deepEqual([...groups.map(x=>x.items.length)].sort(),[1,1,1]);
assert.match(source,/restMode\?restPeers\.length:exact\.length/,"Le compteur dépend du type de jour");
assert.match(source,/groups\.map\(peopleGroupHtml\)/,"Les groupes apparaissent séparément");
assert.match(source,/if\(host\._thfSummary\?\.restMode\)/,"Fenêtre de repos dédiée");
assert.match(source,/data-thf-people-tab="exact"/,"La fenêtre des jours travaillés est conservée");
console.log("GHE · collègues en repos : tests de regroupement et exclusions OK");
