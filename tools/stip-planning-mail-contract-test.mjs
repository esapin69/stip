import fs from 'node:fs';
import vm from 'node:vm';
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
let failed=0;
function check(ok,label){if(ok)console.log('OK '+label);else{console.error('FAIL '+label);failed++}}
const ui=read('change-workflow.js');
const api=read('supabase/functions/stip-change-mail/index.ts');
const migration=read('supabase/migrations/20260930004000_cadre_mail_decision_workflow.sql');
const loader=read('stip-loader.js');
try{new vm.Script(ui);check(true,'Client JavaScript syntax')}catch(e){check(false,'Client JavaScript syntax: '+e.message)}
check(ui.includes('data-cw-recipient')&&ui.includes('data-cw-edit')&&ui.includes('data-cw-send'),'Choice, edit and send UI');
check(ui.includes("mailCall('send',{id})"),'Send after colleague agreement and direct requests');
check(loader.includes('change-workflow.js?v=20260930-mail-approval'),'Client cache bust');
check(api.includes("req.method==='GET'")&&api.includes("return display("),'GET only renders confirmation');
check(api.includes("return respond(await req.formData())"),'Only form POST decides');
check(api.includes("db.rpc('stip_change_mail_decide'"),'Decision delegates to atomic SQL RPC');
check(api.includes('SELECTIONNER_AU_MOINS_UN_CADRE'),'A cadre is required for final email decision');
check(api.includes('RESEND_API_KEY')&&api.includes('STIP_CHANGE_FROM_EMAIL'),'Verified-sender configuration');
check(api.includes('token_hash:await hash(secret)'),'Only a token hash is persisted');
check(api.includes("recipient_role:x.role"),'Each selected recipient receives their own role');
check(migration.includes('create table if not exists public.stip_change_mail_actions'),'Mail token schema is tracked');
check(migration.includes('AVIS_CHEF_SEULEMENT')&&migration.includes("recipient_role<>'cadre'"),'A chef cannot approve the planning');
check(migration.includes('stip_apply_change_request')&&migration.includes('superseded'),'Cadre decision is atomic and first decision wins');
check(migration.includes('enable row level security')&&migration.includes('grant execute on function public.stip_change_mail_decide'),'Service-only database access');
if(failed)process.exit(1);
console.log('Mail decision contract OK');
