import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const extract = (source, start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
};

// Run the actual CORS functions: GHE and the retained origins work, outsiders do not.
for (const slug of ['stip-actions', 'stip-evaluations']) {
  const source = read('supabase/functions/' + slug + '/index.ts');
  const origins = source.match(/const ORIGINS=new Set\([^\n]+/)[0];
  const cors = source.match(/function cors\([^\n]+/)[0].replace('req:Request', 'req');
  const check = vm.runInNewContext(origins + ';' + cors + ';cors;', {});
  for (const origin of ['https://ghe.esapin.com', 'https://stip.esapin.com', 'https://esapin69.github.io']) {
    const result = check(new Request('https://example.test', {headers: {origin}}));
    assert.equal(result.ok, true);
    assert.equal(result.h['Access-Control-Allow-Origin'], origin);
  }
  assert.equal(check(new Request('https://example.test', {headers: {origin: 'https://outsider.test'}})).ok, false);
}

// Same dated rows feed the total and shift lists; absences, chiefs and duplicates stay out.
const spirit = read('esprit-equipe.js');
const working = vm.runInNewContext(extract(spirit, '  function teamWorkingRows(', '\n  function teamDay(') + ';teamWorkingRows;', {
  baseShift: code => ({M:'M',J:'J',J4:'J4',S:'S',N:'N',J0965:'J'}[code] || ''),
  isChefItem: item => item.equipe === 'chefs',
});
const day = '2026-10-17';
const rows = [];
for (const [code, count] of [['M',5],['J',3],['S',4],['N',3],['RH',42],['MA',3],['AI',1],['CSN',2]]) {
  for (let i=0; i<count; i++) rows.push({date:day, code, agent_id:code+i});
}
rows.push({date:day,code:'J',equipe:'chefs',agent_id:'chief'}, rows[0], {date:'2026-10-18',code:'M',agent_id:'tomorrow'});
const selected = working(rows,day);
assert.equal(selected.length,15);
assert.equal(selected.filter(x=>x.code==='N').length,3);
assert.equal(working([{date:day,code:'J0965',agent_id:'adapted'}],day).length,1);
const block = vm.runInNewContext(extract(spirit, '  function shiftBlock(', '\n  function dayAssistantLevel(') + ';shiftBlock;', {
  baseShift: code=>code,shiftMeta:()=>({label:'Nuit',time:'20h50–06h50'}),
  shiftStaffingRow:()=>null, compareAgentGhe:()=>0,isChefItem:item=>item.equipe==='chefs',
  state:{openShifts:new Map()},shiftSignalForDate:()=>({level:'unknown',label:'Non analysé'}),
  esc:String,statusSymbol:()=> '○',agentRow:()=> '<span>Agent</span>',
});
assert.match(block(day,'N',selected.filter(x=>x.code==='N')),/>3<\/em>/);

// Imported full names must not receive a guessed first-name prefix from their source key.
const selector = read('stip-agent-selector.js');
const sandbox = {window:{}};
vm.runInNewContext(selector,sandbox);
assert.equal(sandbox.window.STIPAgentSelector.name({nom:'BEN JEDDOU Mohamed',source_key:'ben_jeddou_mohamed'}), 'ben jeddou mohamed');
assert.equal(sandbox.window.STIPAgentSelector.name({prenom:'Eddy',nom:'Sapin'}), 'EDDY sapin');

// External identities keep their actual identity without impersonating an employee.
const access = read('access-manage.js');
const agentOf = vm.runInNewContext(extract(access,'  function agentOf(', '\n  function wallFilter(') + ';agentOf;', {});
const external = agentOf({stip_access_identities:{id:'external',first_name:'Alice',last_name:'Exemple',professional_role:'Cadre'}});
assert.equal(external.prenom,'Alice');assert.equal(external.nom,'Exemple');assert.equal(external.source_key,undefined);
assert.equal(agentOf({agents:[{id:'employee',nom:'Sapin'}]}).id,'employee');

// Desktop hit target observed at x=329 was behind the navigation column ending at x=600.
// The existing dock sizing now follows its content column on every layout sync.
const chat = read('team-chat.js'), properties = new Map();
const root = {
  querySelector: selector => selector==='.tb-input-dock' ? {getBoundingClientRect:()=>({height:82})} : null,
  closest:()=>({getBoundingClientRect:()=>({left:600,width:460})}),
  style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)},
};
vm.runInNewContext(extract(chat,'  function syncComposerDock()', '\n  function syncViewport()') + ';syncComposerDock();', {state:{root}});
assert.equal(properties.get('--tb-dock-left'),'600px');
assert.equal(properties.get('--tb-dock-width'),'460px');
assert.match(read('team-chat.css'),/left:var\(--tb-dock-left\)!important/);

// A loaded invitation/follow-up from the existing meeting runtime must have a consumer.
const home = read('home-shell.js');
const homeContext = {
  state:{homeMode:'planning'},has:key=>key==='meeting_notes',fixedShiftLegend:()=>'',
  homeModeNav:part=>'['+part+']',agenda360Markup:()=> '[agenda360]',weekFlipCard:()=> '[week]',
  monthFlipCard:()=>'',planningCalendarOverview:()=>'',esc:String,
  window:{STIPMeeting:{pendingHTML:()=>'<section>Pending meeting</section>'}},
};
const body = vm.runInNewContext(extract(home,'  function homeModeBody()', '\n  // Le moteur des retours') + ';homeModeBody;',homeContext);
const markup = body();
assert(markup.indexOf('Pending meeting')>markup.indexOf('[identity]'));
assert(markup.indexOf('Pending meeting')<markup.indexOf('[week]'));
homeContext.has=()=>false;
assert(!body().includes('Pending meeting'));

// Administrative permissions alone never grant access to another person's meeting.
const meeting = read('supabase/functions/stip-meeting-notes/index.ts');
let invitation = null;
const accessMeeting = vm.runInNewContext(extract(meeting,'async function access(', '\nasync function organizer(')
  .replace('(c:any,m:any)','(c,m)')+';access;', {
    checked:async()=>invitation,
    db:{from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:()=>query};return query;}},
  });
await assert.rejects(accessMeeting({agent_id:'admin',isAdmin:true},{id:'meeting',owner_agent_id:'owner'}),/ACCES_REUNION_REFUSE/);
invitation={status:'pending',member_role:'invitee'};
await assert.rejects(accessMeeting({agent_id:'admin',isAdmin:true},{id:'meeting',owner_agent_id:'owner'}),/ACCES_REUNION_REFUSE/);
invitation={status:'accepted',member_role:'invitee'};
assert.equal((await accessMeeting({agent_id:'member'},{id:'meeting',owner_agent_id:'owner'})).role,'invitee');
console.log('PASS — GHE full audit: real CORS, dated populations, missing Cumul, names, external identities and desktop dock.');
