import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("la personne connectée figure dans l'équipe, sans doublon",()=>{
  const src=read("team-home-fusion.js");
  const start=src.indexOf("  function visibleWorkersForDay(");
  const end=src.indexOf("  function paint(",start);
  assert.ok(start>=0 && end>start,"Moteur commun introuvable");
  const rows=[
    {agents:{source_key:"eddy",nom:"Eddy"},code:"S"},
    {agents:{source_key:"collegue",nom:"Collègue"},code:"S"},
    {agents:{source_key:"eddy",nom:"Eddy"},code:"S"},
    {equipe:"chefs",agents:{source_key:"chef",nom:"Chef"},code:"S"}
  ];
  const context=vm.createContext({rows,isChef:x=>x.equipe==="chefs",name:a=>a.nom});
  const visible=vm.runInContext(src.slice(start,end)+";visibleWorkersForDay(rows)",context);
  assert.deepEqual(Array.from(visible,x=>x.agents.source_key),["eddy","collegue"]);
  assert.match(src,/if\(loaded&&working&&selfAgent\?\.id&&!selfAlreadyIncluded\)/);
});

test("l'accès aux plannings collectifs reste contrôlé sur le serveur",()=>{
  const data=read("supabase/functions/stip-data/index.ts");
  assert.match(data,/function needCollective\(p:any\)/);
  for(const action of ["official","spirit_week","spirit","collective_public","duty_chiefs","agent_planning"])
    assert.match(data,new RegExp("if\\(action==='"+action+"'\\)\\{needCollective\\(p\\)"));
  const agent=read("supabase/functions/stip-agent-planning/index.ts");
  assert.match(agent,/canViewOthers=Boolean\(viewer\.permissions\?\.responsable/);
  const cal=read("supabase/functions/stip-calendar/index.ts");
  assert.match(cal,/if\(f.kind==='team'\).*p\.permissions\?\.responsable/);
  const home=read("home-shell.js");
  assert.match(home,/values\.planning_team=false/);
});

test("le planning personnel n'est pas supprimé par le filtrage collectif",()=>{
  const data=read("supabase/functions/stip-data/index.ts");
  assert.match(data,/if\(action==='personal'\)/);
  const cal=read("supabase/functions/stip-calendar/index.ts");
  assert.match(cal,/if\(f.kind==='personal'\)return personal\(p\.agent\)/);
});