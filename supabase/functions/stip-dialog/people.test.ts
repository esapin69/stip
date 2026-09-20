import { resolvePeople } from "./people.ts";

const agents = [
  { id: "1", prenom: "Yael", nom: "Ridde" },
  { id: "2", prenom: "Yacine", nom: "Bendahmane" },
  { id: "3", prenom: "Marion", nom: "Chatillon" },
];
function ids(x: ReturnType<typeof resolvePeople>) { return x.candidates.map((a: any) => a.id); }
function eq(a: unknown, e: unknown, label: string) { if (JSON.stringify(a) !== JSON.stringify(e)) throw new Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(e)}`); }

eq(ids(resolvePeople("Yael", agents)), ["1"], "firstname");
eq(ids(resolvePeople("Bendahmane", agents)), ["2"], "surname");
eq(ids(resolvePeople("Y a-t-il un système de chat ici ?", agents)), [], "generic chat must not hit Chatillon");
eq(ids(resolvePeople("ya", agents)), [], "too short");
eq(ids(resolvePeople("son horaire", agents, ["1"], true)), ["1"], "context subject");
console.log("people tests: ok");
