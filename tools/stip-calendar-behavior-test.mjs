import fs from "node:fs";
import vm from "node:vm";

const fail = (message) => {
  console.error("STIP calendar behavior:", message);
  process.exitCode = 1;
};
const assert = (condition, message) => { if (!condition) fail(message); };
const same = (actual, expected, message) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail(`${message} — reçu ${a}, attendu ${e}`);
};

const source = fs.readFileSync("stip-week-engine.js", "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "stip-week-engine.js" });

const engine = sandbox.window.STIPWeekEngine;
assert(engine && typeof engine.display === "function", "moteur STIPWeekEngine indisponible");

const model = (today, state = {}) =>
  JSON.parse(JSON.stringify(engine.display(state, { today })));

const monday = model("2026-09-21");
same(monday.dates, ["2026-09-21","2026-09-22","2026-09-23","2026-09-24","2026-09-25","2026-09-26","2026-09-27"],
  "lundi doit afficher la semaine courante jusqu’au dimanche");
assert(monday.nextMonday === "" && monday.slotCount === 7, "lundi ne doit pas prévisualiser le lundi suivant");

const thursday = model("2026-09-24");
same(thursday.dates, ["2026-09-24","2026-09-25","2026-09-26","2026-09-27"], "jeudi doit afficher jeudi à dimanche");
assert(thursday.nextMonday === "" && thursday.slotCount === 4, "jeudi ne doit pas afficher le pont lundi");

const friday = model("2026-09-25");
same(friday.dates, ["2026-09-25","2026-09-26","2026-09-27"], "vendredi doit afficher vendredi à dimanche");
assert(friday.nextMonday === "2026-09-28", "vendredi doit prévisualiser le lundi suivant");
same(friday.visualDates, ["2026-09-25","2026-09-26","2026-09-27","2026-09-28"],
  "vendredi doit conserver les dates réelles sans transformer le pont en date");
assert(friday.slotCount === 5, "vendredi doit réserver 3 jours + 1 pont + 1 lundi");

const saturday = model("2026-09-26");
same(saturday.dates, ["2026-09-26","2026-09-27"], "samedi doit afficher samedi et dimanche");
assert(saturday.nextMonday === "2026-09-28" && saturday.slotCount === 4,
  "samedi doit réserver samedi + dimanche + pont + lundi");

const sunday = model("2026-09-27");
same(sunday.dates, ["2026-09-27"], "dimanche doit afficher dimanche");
assert(sunday.nextMonday === "2026-09-28" && sunday.slotCount === 3,
  "dimanche doit réserver dimanche + pont + lundi");

const nextMonday = model("2026-09-28");
assert(nextMonday.nextMonday === "" && nextMonday.slotCount === 7,
  "le nouveau lundi doit redevenir une semaine normale sans pont");

const currentPast = model("2026-09-26", { weekPast: true });
same(currentPast.dates, ["2026-09-21","2026-09-22","2026-09-23","2026-09-24","2026-09-25"],
  "la partie passée de la semaine courante doit rester lundi à vendredi");
assert(currentPast.nextMonday === "" && currentPast.slotCount === 5,
  "la partie passée ne doit jamais afficher le pont lundi");

const futureWeek = model("2026-09-26", { weekOffset: 1 });
same(futureWeek.dates, ["2026-09-28","2026-09-29","2026-09-30","2026-10-01","2026-10-02","2026-10-03","2026-10-04"],
  "une semaine future doit être complète");
assert(futureWeek.nextMonday === "" && futureWeek.slotCount === 7, "une semaine future ne doit pas afficher le pont lundi");

const pastWeek = model("2026-09-26", { weekOffset: -1 });
same(pastWeek.dates, ["2026-09-14","2026-09-15","2026-09-16","2026-09-17","2026-09-18","2026-09-19","2026-09-20"],
  "une semaine passée doit être complète");
assert(pastWeek.nextMonday === "" && pastWeek.slotCount === 7, "une semaine passée ne doit pas afficher le pont lundi");

const focusedElsewhere = model("2026-09-26", { dayFocus: "2026-09-28" });
same(focusedElsewhere.dates, ["2026-09-26","2026-09-27"], "dayFocus ne doit pas déplacer la date réelle");
assert(focusedElsewhere.nextMonday === "2026-09-28", "la prévisualisation dépend d’aujourd’hui, pas de dayFocus");

const previousFromLive = JSON.parse(JSON.stringify(engine.move({}, -1, { today: "2026-09-26" })));
assert(previousFromLive.weekOffset === 0 && previousFromLive.weekPast === true,
  "précédent depuis samedi doit ouvrir d’abord le début de la même semaine");
assert(previousFromLive.dayFocus === "2026-09-21", "la partie passée doit sélectionner son premier jour visible");

const forwardToLive = JSON.parse(JSON.stringify(engine.move(previousFromLive, 1, { today: "2026-09-26" })));
assert(forwardToLive.weekOffset === 0 && forwardToLive.weekPast === false && forwardToLive.dayFocus === "2026-09-26",
  "suivant depuis la partie passée doit revenir à la période courante");

const futureState = JSON.parse(JSON.stringify(engine.stateForDate("2026-09-28", { today: "2026-09-26" })));
assert(futureState.weekOffset === 1 && futureState.weekFull === true && futureState.dayFocus === "2026-09-28",
  "sélectionner le lundi suivant doit ouvrir sa vraie semaine future");

if (!process.exitCode) console.log("STIP calendar behavior OK");
