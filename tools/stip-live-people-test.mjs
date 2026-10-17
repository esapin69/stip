import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../home-shell.js',import.meta.url),'utf8');
function roster(entries,chiefs){
 const start=source.indexOf('  function liveRoster()');
 const end=source.indexOf('  const premiumShiftRank',start);
 const context={document:{getElementById:()=>({_thfLiveLoaded:true,_thfLiveAgents:entries})},has:p=>p==='planning_team',liveParisClock:()=>({day:'2026-10-17'}),liveCurrentlyWorking:x=>x.active!==false,isLiveChief:x=>x.equipe==='chefs',agentName:a=>a.nom||'',window:{STIPDutyChiefs:{liveSnapshot:()=>({loaded:true,current:chiefs})}},liveWorkInterval:()=>({start:0})};
 vm.createContext(context);return vm.runInContext(source.slice(start,end)+';liveRoster()',context);
}
const person=(id,extra={})=>({agents:{source_key:String(id),nom:'Agent '+id},code:'M',...extra});
test('12 agents et un chef donnent 13 personnes, chef inclus dans la liste',()=>{
 const r=roster(Array.from({length:12},(_,i)=>person(i)),[person('chef',{equipe:'chefs'})]);
 assert.equal(r.rows.length,12);assert.equal(r.chiefs.length,1);assert.equal(r.people.length,13);
});
test('Une personne dans les deux sources n’est comptée qu’une fois',()=>{
 const r=roster([person(1),person(2),person(2)],[person(2,{equipe:'chefs'})]);
 assert.equal(r.people.length,2);assert.equal(r.rows.length,1);assert.equal(r.chiefs.length,1);
});
test('Les shifts terminés ne sont pas ajoutés au total',()=>{
 assert.equal(roster([person(1,{active:false}),person(2)],[]).people.length,1);
});
