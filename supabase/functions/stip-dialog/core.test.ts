import {
  classifyIntent,
  parseDateScope,
  selectionCount,
  offeredOptionIntent,
  type DialogContext,
} from "./core.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}\nexpected ${e}\nactual   ${a}`);
}

const base = "2026-09-20";
eq(parseDateScope("demain", base), { start: "2026-09-21", end: "2026-09-21" }, "tomorrow");
eq(parseDateScope("la dernière semaine de septembre", base), { start: "2026-09-28", end: "2026-09-30", label: "dernière semaine de septembre" }, "last week of month");
eq(parseDateScope("du 25 au 30 septembre", base), { start: "2026-09-25", end: "2026-09-30", label: "du 25 au 30 septembre" }, "range");
eq(parseDateScope("25 septembre 2026", base), { start: "2026-09-25", end: "2026-09-25" }, "named explicit date");
eq(parseDateScope("semaine prochaine", base), { start: "2026-09-21", end: "2026-09-27", label: "semaine prochaine" }, "next week");
eq(parseDateScope("phrase sans date", base), null, "no invented date");
const ctx: DialogContext = { date_scope: { start: "2026-09-21", end: "2026-09-21" } };
eq(parseDateScope("Et vendredi ?", base, ctx), { start: "2026-09-25", end: "2026-09-25" }, "follow up weekday");
eq(classifyIntent("Y a-t-il un système de chat ici ?"), "messaging_help", "chat intent");
eq(classifyIntent("Je peux échanger avec qui la dernière semaine de septembre ?"), "exchange", "exchange intent");
eq(classifyIntent("Qui est en J4 demain ?"), "shift_roster", "shift roster");
eq(classifyIntent("Qui est sur le terrain demain ?"), "on_duty", "on duty roster");
eq(classifyIntent("Combien on est en J4 demain ?"), "organization", "organization with shift routes later to roster");
eq(classifyIntent("cette phrase ne veut rien dire"), "help", "unknown stays help");
eq(selectionCount("Les 2"), 2, "two selection");
eq(selectionCount("tous les deux"), 2, "two words selection");
eq(offeredOptionIntent("son numéro", ["planning", "coordonnées", "message"]), "coordonnées", "offered contact");
console.log("core tests: ok");
