import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../ensemble-v3.js", import.meta.url), "utf8");
const callbacks = new Map(), controls = new Map();
const colleagueId = "11111111-1111-4111-8111-111111111111";
const date = "2099-11-22";
function control(key) {
 if(!controls.has(key))controls.set(key,{onclick:null,onchange:null,checked:false,dataset:{}});
 return controls.get(key);
}
const host = {
 innerHTML: "",
 querySelector(selector) {
  if(selector === "[data-ev3-compare]" && this.innerHTML.includes("data-ev3-compare"))return control("compare");
  return null;
 },
 querySelectorAll(selector) {
  if(selector === "[data-ev3-plan-day]"){
   return [...this.innerHTML.matchAll(/data-ev3-plan-day="([^"]+)"/g)].map(match=>{
    const el=control("plan:"+match[1]);el.dataset={ev3PlanDay:match[1]};return el;
   });
  }
  return [];
 }
};
const list = {
 innerHTML:"",
 querySelectorAll(selector){
  if(selector !== "[data-ev3-availability-person]")return [];
  return [...host.innerHTML.matchAll(/data-ev3-availability-person="([^"]+)"/g)].map(match=>{
   const el=control("person:"+match[1]);el.dataset={ev3AvailabilityPerson:match[1]};return el;
  });
 }
};
const document = {
 readyState:"loading",activeElement:null,
 addEventListener(name,callback){callbacks.set(name,callback)},
 querySelectorAll(){return []},
 getElementById(id){
  if(id==="ensembleV3")return host;
  if(id==="ev3AvailabilityPeople")return list;
  if(id==="ev3AvailabilitySearch")return {value:"",oninput:null};
  return null;
 }
};
const actions = [];
async function fetch(_url,opts){
 const request=JSON.parse(opts.body);actions.push(request.action);
 const data={
  list:{events:[]},
  colleagues:{colleagues:[{id:colleagueId,name:"Collègue Vérification",can_invite:true}]},
  calendar:{days:[{date,is_working:true,end:"19:00"}]},
  carpool_home:{trips:[],preference:null},
  calendar_preview:{shifts:[{date,end:"19:00"}]},
  matches:{days:[{date,my_end:"19:00",peer_end:"19:00",minutes_apart:0}]}
 }[request.action];
 assert.ok(data,"Unexpected request "+request.action);
 return {ok:true,json:async()=>data};
}
runInNewContext(source,{
 window:{addEventListener(){}},document,fetch,location:{search:"?tab=dispos"},
 URLSearchParams,localStorage:{getItem:()=>"session-test"},Date,Intl,console,setTimeout(){},Map,Set
});
callbacks.get("DOMContentLoaded")();
const flush=async()=>{for(let n=0;n<20;n++)await Promise.resolve()};
await flush();
assert.match(host.innerHTML,/Collègue Vérification/);
const check=control("person:"+colleagueId);
assert.equal(typeof check.onchange,"function","Colleague checkbox must be bound");
check.checked=true;check.onchange();
assert.ok(host.innerHTML.includes("1/3 sélectionnés"));
const compare=control("compare");
assert.equal(typeof compare.onclick,"function","Compare button must be bound");
await compare.onclick();await flush();
assert.ok(actions.includes("matches"),"Compare must use the existing matches API");
assert.match(host.innerHTML,/Créneaux à proposer/);
assert.match(host.innerHTML,/Collègue Vérification/);
const plan=control("plan:"+date);
assert.equal(typeof plan.onclick,"function","Proposal button must be bound");
plan.onclick();
assert.match(host.innerHTML,/Proposer une activité/);
assert.ok(host.innerHTML.includes('data-ev3-day="2099-11-22"'));
assert.ok(host.innerHTML.includes("1 sélectionné(s)"));
assert.match(host.innerHTML,/À la fin du service/);
console.log("PASS — On se retrouve: select colleague → compare availability → prefilled invitation.");
