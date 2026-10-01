import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes,createRequire} from 'node:module';
const edge=fs.readFileSync('supabase/functions/stip-messages/index.ts','utf8');
const code=edge.slice(edge.indexOf('const WHEELCHAIR_BUILDINGS='),edge.indexOf('\nDeno.serve',edge.indexOf('async function wheelchairCatalog(){')));
const rows=[
 {id:'hfme',display_name:'HFME',building_code:'HFME',place_type:'hospital',parent_id:'ghe'},
 {id:'l1',display_name:'1er',building_code:'HFME',level:'1',place_type:'level'},
 {id:'l2',display_name:'2e',building_code:'HFME',level:'2',place_type:'level'},
 {id:'blue',display_name:'Ascenseur bleu',building_code:'HFME',place_type:'elevator'},
 {id:'green',display_name:'Ascenseur vert',building_code:'HFME',place_type:'elevator'},
 {id:'block',display_name:'Bloc pédiatrique',building_code:'HFME',level:'1',place_type:'block'},
 {id:'staff',display_name:'Salle de pause',building_code:'HFME',level:'2',place_type:'staff_room'}
];
const tables={stip_places:rows,stip_place_aliases:[],stip_place_elevator_stops:[
 {elevator_id:'blue',stop_label:'1',linked_place_id:'l1',is_served:true},
 {elevator_id:'blue',stop_label:'2',linked_place_id:'l2',is_served:false},
 {elevator_id:'green',stop_label:'1',linked_place_id:'l1',is_served:true}],
 stip_place_relations:[{from_place_id:'blue',to_place_id:'block'},{from_place_id:'blue',to_place_id:'staff'}]};
const db={from(table){const q={select(){return q},in(){return q},order(){return q},then(resolve){return Promise.resolve({data:tables[table]||[],error:null}).then(resolve)}};return q}};
const context={db};vm.createContext(context);vm.runInContext(stripTypeScriptTypes(code),context);
const catalog=await context.wheelchairCatalog();const b=catalog.buildings.find(x=>x.key==='hfme');
const l1=b.levels.find(x=>x.level==='1'),l2=b.levels.find(x=>x.level==='2');
assert(l1.places.some(x=>x.label==='Ascenseur bleu'));assert(l1.places.some(x=>x.label==='Ascenseur vert'));
assert.deepEqual(Array.from(l1.places.find(x=>x.id==='blue').nearby,x=>x.label),['Bloc pédiatrique']);
assert(!l2.places.some(x=>x.id==='blue'),'explicitly unserved stop must remain excluded even with a nearby relation');
console.log('Catalog: actual lifts, same-floor context and unserved stops OK');
if (!process.env.STIP_BROWSER_TEST) {
 console.log('Mobile browser test not run (set STIP_BROWSER_TEST=1 with Playwright Chromium installed).');
 process.exit(0);
}
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const chat=fs.readFileSync('team-chat.js','utf8');
 const chooser=chat.slice(chat.indexOf('  async function chooseSpotDetails('),chat.indexOf('  async function chooseSearchDetails('));
 await page.setContent('<!doctype html><html><body></body></html>');
 await page.addStyleTag({content:fs.readFileSync('team-chat.css','utf8')});
 await page.evaluate(chooser=>{
  window.loadWheelchairCatalog=async()=>{};window.WHEELCHAIR_LOCATIONS={hfme:[{level:'1',places:[]}]};
  window.esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  window.norm=x=>String(x).toLowerCase();window.wheelchairLevelDisplay=x=>x==='1'?'1er étage':x;
  window.isVagueWheelchairSpotLocation=x=>x==='Couloir';window.wheelchairLevelContextOptions=()=>[];
  window.wheelchairFieldSpots=()=>[{value:'Ascenseur bleu',label:'Ascenseur bleu',icon:'🛗',nearby:['Bloc pédiatrique']},{value:'Local à fauteuils',label:'Local à fauteuils',icon:'🦽'}];
  window.renderStructuredReview=(wrap,payload)=>{window.result=payload;};window.publishStructuredWheelchair=async payload=>{window.result=payload;return true;};
  window.chooseLocationShortcut=async()=>null;
  (0,eval)(chooser);void window.chooseSpotDetails({key:'hfme',label:'Mère-enfant'});
 },chooser);
 await page.locator('[data-level="1"]').click();await page.locator('[data-spot-qty="2"]').click();
 assert(await page.locator('.tb-place-copy small').textContent()==='Bloc pédiatrique');
 await page.evaluate(()=>{window.savedButton=document.querySelector('[data-place="Ascenseur bleu"]');window.savedPanel=document.querySelector('.tb-spot-wizard');});
 await page.locator('[data-place="Ascenseur bleu"]').click();
 assert(await page.evaluate(()=>savedButton===document.querySelector('[data-place="Ascenseur bleu"]')&&savedPanel===document.querySelector('.tb-spot-wizard')));
 assert(await page.locator('[data-place="Ascenseur bleu"]').getAttribute('aria-pressed')==='true');
 await page.locator('[data-place-temperature="fast"]').click();
 assert(await page.evaluate(()=>savedPanel===document.querySelector('.tb-spot-wizard')));
 await page.locator('[data-place-continue]').click();
 const result=await page.evaluate(()=>window.result);assert.equal(result.location,'Ascenseur bleu');assert.equal(result.quantity,2);assert.equal(result.persistenceOverride,'fast');
 console.log('Mobile chooser: nearby service, stable DOM, selection and review payload OK');
}finally{await browser.close()}
