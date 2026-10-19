import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const source = read("ensemble-v3.js");
const page = read("sorties-loisirs.html");
const styles = read("ensemble-v3.css");
const apps = read("quick-access.js");
const appsStyles = read("quick-access.css");

assert.doesNotMatch(apps, /data-app-create-leisure|stip-app-propose/, "Do not inject a proposal shortcut into Applications");
assert.doesNotMatch(appsStyles, /\.stip-app-propose/, "Remove obsolete proposal shortcut styling");
assert.match(page, /<header class="ev3-header">/, "Static page must already contain a header");
assert.match(page, /<nav class="ev3-tabs(?: [^"]+)?"/, "Static page must already contain navigation");
assert.match(page, /<section class="ev3-loading"/, "Static page must show a meaningful loading skeleton");
assert.match(styles, /@media\(max-width:460px\)/, "Use a compact mobile layout");
assert.match(styles, /\.ev3-quiet-empty/, "Use compact useful empty states");

function createPage(search) {
  const pending = [];
  const listeners = new Map();
  const host = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  const document = {
    readyState: "loading",
    activeElement: null,
    getElementById: (id) => id === "ensembleV3" ? host : null,
    querySelectorAll: () => [],
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  const window = { addEventListener() {} };
  const fetch = (_url, options) => new Promise((resolve) => pending.push({
    action: JSON.parse(options.body).action,
    finish(payload) { resolve({ ok: true, json: async () => payload }); },
  }));
  runInNewContext(source, {
    window, document, fetch, URLSearchParams,
    localStorage: { getItem: () => "session-test" },
    location: { search, href: "https://ghe.esapin.com/sorties-loisirs.html" + search },
    Date, Intl, console,
    setTimeout() {},
  });
  listeners.get("DOMContentLoaded")();
  return { host, pending, document };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const finish = (page, action, payload) => {
  const request = page.pending.find((x) => x.action === action);
  assert.ok(request, "Expected request " + action);
  request.finish(payload);
};

const agenda = createPage("?tab=agenda");
assert.match(agenda.host.innerHTML, /ev3-loading/, "Agenda must paint instantly");
assert.equal(agenda.pending.length, 5, "API requests should start independently");
finish(agenda, "list", {
  events: [{ id: "event-test", title: "Test sortie", icon: "⚽", dates: ["2099-10-15"], is_organizer: true, status: "active", schedule_mode: "fixed", time_label: "18:00" }],
});
await flush();
assert.match(agenda.host.innerHTML, /Test sortie/, "Agenda must render as soon as the primary request finishes");
assert.ok(agenda.pending.some((x) => x.action === "calendar"), "Calendar may still be pending");

const trips = createPage("?tab=trips");
assert.match(trips.host.innerHTML, /Recherche des trajets/, "Trips view must show targeted loading");
finish(trips, "carpool_home", { preference: { opted_in: true, sector: "Bron" }, trips: [] });
await flush();
assert.match(trips.host.innerHTML, /Aucun trajet proposé/, "Empty trips must render without a full-page wait");
assert.match(trips.host.innerHTML, /Proposer un trajet/, "Trips view must provide its own creation action");

const create = createPage("?tab=create");
assert.match(create.host.innerHTML, /Proposer une activité/, "Proposal form must paint before API data");
assert.match(create.host.innerHTML, /id="ev3IconPicker"/, "Additional icons open a real palette");
assert.match(create.host.innerHTML, /data-ev3-custom/, "The plus button opens the catalog, not a free-text field");
assert.match(create.host.innerHTML, /id="ev3IconSearch"/, "Typing only filters the emoji catalog");
assert.match(create.host.innerHTML, /data-ev3-icon-group="sport"/, "Icon picker includes category filters");
assert.match(create.host.innerHTML, /data-ev3-icon-group="repas"/, "The palette contains meals as well as sports");
assert.doesNotMatch(create.host.innerHTML, /id="ev3OtherIcon"/, "No raw text may be saved as an icon");
assert.doesNotMatch(source, /state\.icon\s*=\s*other\.value/, "Icon selection cannot accept arbitrary input");
assert.match(source, /if\(!isCatalogIcon\(state\.icon\)\)/, "Submission validates the icon against the fixed catalog");
assert.match(source, /creator\.addEventListener\("click"/, "Date and icon choices use stable delegated events");
assert.match(source, /day\.classList\.toggle\("is-selected"/, "Date choices update in place, without remounting the form");
assert.match(create.host.innerHTML, /id="ev3ComposeFeedback"/, "Validation remains visible next to submission");
assert.match(styles, /\.ev3-icon-results/, "Picker has a responsive icon grid");

assert.match(create.host.innerHTML, /Vérification de tes disponibilités/, "Date selection must show pending state");
assert.match(create.host.innerHTML, /Chargement des disponibilités et des collègues/, "Proposal must not submit before required data");
finish(create, "calendar", { days: [{ date: "2099-10-15", is_working: true }] });
finish(create, "colleagues", { colleagues: [{ id: "agent-test", name: "Collègue Test", can_invite: true }] });
await flush();
assert.match(create.host.innerHTML, /Collègue Test/, "Directory must be available after its own response");
assert.doesNotMatch(create.host.innerHTML, /Chargement des disponibilités et des collègues/, "Submission should unlock when its required data are ready");

const available = createPage("?tab=dispos");
assert.match(available.host.innerHTML, /On se retrouve/, "New shared entry uses the community name");
assert.match(available.host.innerHTML, /Qui finit en même temps que moi/, "Availability tab must open directly");
assert.match(available.host.innerHTML, /créneaux possibles/, "Availability must never claim confirmed attendance");
finish(available, "colleagues", { colleagues: [
  { id: "peer-1", name: "Collègue Exemple", can_invite: true },
  { id: "peer-2", name: "Autre collègue", can_invite: true }
] });
await flush();
assert.match(available.host.innerHTML, /Collègue Exemple/, "Use canonical colleague directory");
assert.match(source, /call\("matches",\{target_agent_id:id\}\)/, "Reuse canonical authenticated schedule comparison");
assert.match(source, /state\.mode=names\.every\(d=>d\.my_end===d\.peer_end\)\?"afterwork":"fixed"/,
  "Respect exact same-shift requirement for afterwork invitations");
assert.match(source, /state\.guests=new Set\(names\.map\(d=>d\.id\)\)/,
  "A proposed compatible slot must preselect actual matched colleagues");
assert.doesNotMatch(available.host.innerHTML, /Camille|Samir|Noa/, "Never insert fictitious colleagues");

const invitations = createPage("?tab=invitations");
finish(invitations, "list", { events: [
  { id:"invite-1", title:"Boxe", icon:"🥊", dates:["2099-10-22"], needs_response:true, invitation_status:"pending", status:"active", schedule_mode:"fixed", time_label:"19:00", participants:[] }
] });
await flush();
assert.match(invitations.host.innerHTML, /Mes invitations/, "Dedicated invitation lens is available");
assert.match(invitations.host.innerHTML, /Boxe/, "Pending invitation appears in the single canonical list");

const incompatibleInvite = createPage("?tab=invitations");
finish(incompatibleInvite, "list", { events: [{
 id:"incompatible-1", title:"Invitation sans horaire commun", icon:"🎉", dates:["2099-11-23"],
 visible_dates:[], needs_response:true, invitation_status:"pending", is_organizer:false,
 status:"active", schedule_mode:"afterwork", participants:[]
}] });
await flush();
assert.match(incompatibleInvite.host.innerHTML,/Invitation sans horaire commun/,
  "An invitation must remain visible even with no common shift, so it can be declined");
assert.match(incompatibleInvite.host.innerHTML,/Aucune fin de service compatible/,
  "Do not imply an invitation without common shifts is an actual free timeslot");

console.log("PASS — GHE Sorties mobile: catalogue, instant shell, progressive requests, create and trips.");
