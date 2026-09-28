import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const sw = read('stip-sw.js');
const home = read('home-shell.js');
const responsible = read('responsable-home.js');
const engine = read('supabase/functions/stip-agenda-alerts/index.ts');
const migration = read('supabase/migrations/20260928120000_agenda_alert_engine.sql');
const idempotency = read('supabase/migrations/20260928122000_agenda_alert_idempotency.sql');
const push = read('supabase/functions/stip-push/index.ts');
const actions = read('supabase/functions/stip-actions/index.ts');

assert(fs.existsSync('images/notifications/alert-danger.webp'), 'Danger alert asset is missing.');
assert(sw.includes('agenda_alert') && sw.includes('/images/notifications/alert-danger.webp'), 'Service worker must map agenda alerts to the approved danger asset.');
assert(home.includes('hc-agenda-alert') && home.includes('recipient_kind'), 'Personal home must expose conflict alerts outside the bell.');
assert(home.includes('alert_key') && home.includes('openNotificationDetail'), 'Push deep links must open the matching STIP notification detail.');
assert(responsible.includes('agenda-alert') && responsible.includes('agenda_alert'), 'Responsable tracking must surface agenda alerts.');
assert(engine.includes('from("formations")'), 'Alert engine must read canonical formations.');
assert(engine.includes('from("stip_agent_agenda_items")'), 'Alert engine must read canonical agenda items.');
assert(engine.includes('from("stagiaires")'), 'Alert engine must read canonical trainee/referent dates.');
assert(engine.includes('from("planning")'), 'Alert engine must cross the planning source.');
assert(engine.includes('from("stip_shift_definitions")'), 'Alert engine must use canonical shift definitions.');
assert(engine.includes('event_overlap'), 'Alert engine must detect overlapping future events.');
assert(engine.includes('before_shift') && engine.includes('after_shift') && engine.includes('non_working_day'), 'Alert engine must detect time/planning incompatibilities.');
assert(engine.includes('expected_event_missing') && engine.includes('referent_unresolved'), 'Alert engine must detect missing expected events and unresolved trainee referents.');
assert(engine.includes('chef_equipe') && engine.includes('communication_family'), 'Alert engine must route conflicts to the correct team chiefs.');
assert(engine.includes('send_internal') && engine.includes('event_key:"agenda_alert"'), 'Alert engine must use the existing push pipeline.');
assert(engine.includes('action==="dry_run"'), 'Alert engine must keep a non-writing diagnostic path.');
assert(push.includes('payload?.urgency') && push.includes('urgency'), 'Shared push engine must support high-urgency alerts.');
assert(actions.includes('read_notification') && actions.includes('readNotification'), 'Opening a notification must mark it read so the second reminder can stop.');
assert(migration.includes('stip-agenda-alerts-five-minutes'), 'Agenda vigilance cron job is missing.');
assert(migration.includes('stip_agenda_alert_cron_token'), 'Agenda vigilance cron token must live in Vault.');
assert(migration.includes("'watch','advance','urgent'"), 'Agenda alert delivery stages must include watch, advance and urgent.');
assert(migration.includes("'formation','agenda','intern','planning','event_pair'"), 'Agenda alert sources must cover every canonical future-event family.');
assert(migration.includes('enable row level security'), 'Agenda alert internal tables must have RLS enabled.');
assert(engine.includes('stip_agenda_alert_claim'), 'Agenda alert delivery must atomically claim each stage before sending.');
assert(engine.includes('claimed_elsewhere'), 'Concurrent scans must skip work claimed by another scan.');
assert(idempotency.includes('stip_notifications_agenda_alert_unique'), 'Agenda alert notifications need a unique recipient/alert guard.');
assert(idempotency.includes("'processing'"), 'Agenda alert delivery must support an in-flight processing state.');
assert(engine.includes('r.kind==="target" || st==="urgent"'), 'Advance chief alerts must stay in Responsable/Cloche instead of causing push spam.');

console.log('STIP agenda alert contract: OK');
