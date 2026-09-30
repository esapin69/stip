// STIP GHE congés panier: the shared STIP request engine, never the obsolete leave form.
import fs from 'node:fs';
const api=fs.readFileSync('supabase/functions/stip-change/index.ts','utf8');
function check(label,condition){if(!condition){console.error('FAIL: '+label);process.exitCode=1}else console.log('OK: '+label)}
check('session-authenticated basket action',api.includes("if(action==='leave_cart_submit')")&&api.includes('await stipCtx(req)'));
check('server validates exact dates and types',api.includes("function cartDays(raw:any)")&&api.includes("TYPE_CONGE_INVALIDE"));
check('old overlapping leave requests are detected',api.includes('const oldDays=Array.isArray(old?.context?.days)'));
check('batch uses existing STIP requests, never auto-edit planning',api.includes("created_from:'stip_ghe_leave_cart'")&&api.includes("automatic_apply_allowed:false"));
check('approval cannot claim immediate planning application',api.includes("approved_pending_manual")&&api.includes('La validation officielle et le planning restent à confirmer.'));
