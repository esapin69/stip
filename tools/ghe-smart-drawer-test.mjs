import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const rail=read("ghe-smart-drawer.js"),page=read("ghe-invitations.js"),shell=read("home-shell.js");
const api=read("supabase/functions/stip-leisure/index.ts");
const sql=read("supabase/migrations/20261016151500_ghe_smart_event_choices_and_date_alerts.sql");
const home=read("index.html"),leisure=read("sorties-loisirs.html");
for (const file of [home,leisure]) {
 assert.match(file,/ghe-smart-drawer\.css/,"styles deployed on main entrypoints");
 assert.match(file,/ghe-smart-drawer\.js/,"rail loaded on main entrypoints");
}
assert.match(rail,/\["closed","compact","expanded"\]/,"three positions");
assert.match(rail,/entries\.sort/,"chronological queue");
assert.match(rail,/ghe-agenda\.html/,"one dedicated page for pending work");
assert.match(rail,/series_conversation_id|ghe:agenda-change/,"refresh tied to canonical events");
assert.match(page,/data-day-decision/);
assert.match(page,/call\("respond_day"/,"response written through server");
assert.match(page,/data-show-roster/,"roster actionable");
assert.match(page,/series_conversation_id/,"one canonical group chat");
assert.match(shell,/STIPDrawerAppointments/,"existing professional dates retained");
assert.match(api,/b.action==='respond_day'/,"backend decision action");
assert.match(api,/stip_leisure_answer_day/,"server per-date RPC");
assert.match(sql,/stip_leisure_date_decisions/);
assert.match(sql,/stip_leisure_dates_changed_log/);
assert.match(sql,/old_responses/,"change history preserved");
assert.doesNotMatch(rail,/showModal\(/,"drawer itself must not become modal");

assert.match(read("ghe-smart-drawer.js"),/date_change_history/,"rail exposes cancelled historical dates");
assert.match(read("ghe-invitations.js"),/is-cancelled/,"pending page shows cancelled original dates");
assert.match(api,/date_change_history/,"backend supplies changes and old dates");
const retention=read("supabase/migrations/20261016162000_ghe_ephemeral_chat_retention.sql");
assert.match(retention,/stip_purge_expired_leisure/,"event + seven-day retention task");
assert.match(retention,/stip_leisure_series_chat/,"preserve active canonical event chats");
assert.match(retention,/leisure_response_chat_sync/,"disable legacy per-day chat creation");
const decline=read("supabase/migrations/20261016163000_ghe_leave_declined_event_chat.sql");
assert.match(decline,/status <> 'declined'/,"declined participants leave the group");
const communication=read("COMMUNICATION_RULES.md");
assert.match(communication,/refus global.*retire/i,"shared communications contract excludes global refusals");
console.log("GHE smart drawer contract passed.");
