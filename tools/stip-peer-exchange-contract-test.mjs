import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=p=>readFileSync(resolve(root,p),'utf8');

test('peer exchange is accessible from personal planning and loaded once',()=>{
  const home=file('home-shell.js'),html=file('index.html');
  assert.match(home,/J’ai déjà échangé des jours/);
  assert.match(home,/p\.planning_personal/);
  assert.match(html,/peer-exchange\.css/);
  assert.match(html,/peer-exchange\.js/);
  assert.doesNotThrow(()=>new Function(file('peer-exchange.js')));
  assert.doesNotThrow(()=>new Function(home));
});
test('both parties consent before the planning changes',()=>{
  const ui=file('peer-exchange.js'),api=file('supabase/functions/stip-change/peer-exchanges.ts');
  assert.match(ui,/data-peer-decide="accept"/);
  assert.match(ui,/data-peer-decide="refuse"/);
  assert.match(ui,/stip:session-ready/);
  assert.match(api,/stip_peer_exchange_decide/);
  assert.match(api,/planning_personal===true/);
  assert.match(api,/CORRESPONDANCE_JOURS_DUPLIQUEE/);
  assert.match(api,/mode==='cross'/);
  assert.doesNotMatch(api,/SERVICE_ROLE_KEY|sendMail|mailCall/);
});
test('changes are atomic, private and retained in planning history',()=>{
  const sql=file('supabase/migrations/20261102170000_peer_confirmed_exchange.sql');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all.*anon, authenticated/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/PLANNING_MODIFIE_DEPUIS_PROPOSITION/);
  assert.match(sql,/stip_planning_change_history/);
  assert.match(sql,/v_modified=0/);
  assert.match(sql,/p_target_agent_id/);
  assert.match(sql,/grant execute.*service_role/i);
});
test('subscribed ICS remains based on canonical planning with change timestamps',()=>{
  const ics=file('supabase/functions/stip-calendar/index.ts');
  assert.match(ics,/db\.from\('planning'\)/);
  assert.match(ics,/stip_planning_change_history/);
  assert.match(ics,/manualStamps/);
  assert.match(ics,/changedAt/);
  assert.match(ics,/LAST-MODIFIED/);
});
