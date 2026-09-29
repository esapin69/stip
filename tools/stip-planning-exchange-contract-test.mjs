import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const assert=(ok,msg)=>{if(!ok){console.error('❌ '+msg);process.exitCode=1}else console.log('✓ '+msg)};

const client=read('planning-print-reference.js');
const changeClient=read('change-workflow.js');

const home=read('planning-home.js');
const change=read('supabase/functions/stip-change/index.ts');
const pdf=read('supabase/functions/stip-planning-pdf/index.ts');
const migration1=read('supabase/migrations/20260930001000_planning_exchange_history_pdf.sql');
const migration2=read('supabase/migrations/20260930002000_preserve_stip_changes_across_planning_imports.sql');

assert(client.includes('/functions/v1/stip-planning-pdf'),'planning print action uses canonical Supabase PDF function');
assert(!client.includes('function monthCells('),'legacy client-side calendar PDF engine is not restored');
assert(!client.includes('<section class="grid">'),'legacy HTML print calendar is not restored');
assert(home.includes('PDF planning à jour'),'planning action is labelled as the current PDF export');

assert(change.includes("db.rpc('stip_apply_change_request'"),'responsible approval applies the canonical planning change RPC');
assert(change.includes("action==='planning_change_history'"),'planning exchange history is exposed by the change engine');
assert(changeClient.includes('selectedRecipientIds'),'planning change UI supports multiple official mail recipients');
assert(changeClient.includes('data-cw-recipient'),'planning change UI renders chef/cadre recipient choices');
assert(changeClient.includes('recipient_ids:selectedRecipientIds'),'planning change UI sends selected recipient IDs');
assert(change.includes('resolveRecipients'),'planning change backend validates selected recipients');
assert(change.includes('routed_recipients:recipients'),'planning change backend snapshots selected recipients');

assert(pdf.includes("from('stip_planning_change_history')"),'PDF reads planning change history');
assert(pdf.includes(".eq('effective',true)"),'PDF renders only currently effective STIP changes');
assert(pdf.includes("drawShiftVisual(baseCode"),'PDF keeps the cadre/base shift line');
assert(pdf.includes("drawShiftVisual(currentCode"),'PDF renders the effective shift on the additional line');

assert(migration1.includes('create table if not exists public.stip_planning_change_history'),'durable planning change history table is migration-backed');
assert(migration1.includes('stip_apply_change_request'),'planning application RPC is migration-backed');
assert(migration2.includes('trg_stip_reconcile_planning_import'),'cadre imports reconcile active STIP changes');
assert(migration2.includes('absorbed_by_official_import'),'official imports can absorb a STIP override without deleting history');
assert(migration2.includes('superseded_by_official_import'),'new official shifts can supersede an old STIP override');

if(process.exitCode)process.exit(process.exitCode);
console.log('Planning exchange/PDF contract OK');
