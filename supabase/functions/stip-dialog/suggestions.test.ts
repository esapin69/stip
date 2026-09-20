import { adaptSuggestions } from "./suggestions.ts";
import type { DialogResponse, SessionCtx } from "./types.ts";

const c: SessionCtx = {
  agent: { id: "me", prenom: "Eddy" }, level: "pro", team: "jour",
  permissions: { messages: true },
};
function eq(a: unknown, e: unknown, label: string) {
  if (JSON.stringify(a) !== JSON.stringify(e)) throw new Error(`${label}\nexpected ${JSON.stringify(e)}\nactual   ${JSON.stringify(a)}`);
}
const selfPlan: DialogResponse = {
  kind: "planning", title: "Moi", text: "M", cards: [{ type: "person", id: "me", title: "Moi" }],
  context: { date_scope: { start: "2026-09-21", end: "2026-09-21" } },
};
eq(adaptSuggestions(selfPlan, "Je suis de quoi moi ?", c).suggestions, [
  "Avec qui je travaille ce jour-là ?",
  "Qui commence avec moi ce jour-là ?",
  "Je peux échanger ce jour-là ?",
], "self planning follows context");

const otherPlan: DialogResponse = {
  kind: "planning", title: "Yael", text: "S", cards: [{ type: "person", id: "yael", title: "Yael", can_message: true }],
  context: { date_scope: { start: "2026-09-25", end: "2026-09-25" } },
};
eq(adaptSuggestions(otherPlan, "Et vendredi ?", c).suggestions?.slice(0, 3), [
  "Avec qui travaille Yael ce jour-là ?",
  "Coordonnées de Yael ?",
  "Message à Yael",
], "other planning uses subject");

const exchange: DialogResponse = {
  kind: "exchange", title: "Échange", text: "2 compatibles",
  cards: [{ type: "person", id: "a", title: "Yael", can_message: true }, { type: "person", id: "b", title: "Yacine", can_message: true }],
  context: { last_choice_ids: ["a", "b"], last_choice_kind: "agent" },
};
eq(adaptSuggestions(exchange, "Je peux échanger avec qui ?", c).suggestions?.[0], "Les 2", "two exchange candidates expose safe selection");

const noLoop: DialogResponse = {
  kind: "team", title: "J4", text: "3 agents", cards: [],
  context: { date_scope: { start: "2026-09-21", end: "2026-09-21" }, suggestion_history: ["qui est sur le terrain ce jour la ?"] },
};
const noLoopSuggestions = adaptSuggestions(noLoop, "Qui est sur le terrain ce jour-là ?", c).suggestions || [];
if (noLoopSuggestions.some((x) => x.toLowerCase().includes("sur le terrain"))) throw new Error("anti loop removes already-used rebound");
console.log("suggestion tests: ok");
