import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { answer } from "./engine.ts";
import { adaptSuggestions } from "./suggestions.ts";
import { H, J, session } from "./runtime.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return J({ error: "Méthode non autorisée." }, 405);
  try {
    const c = await session(req), body = await req.json().catch(() => ({}));
    if (String(body.action || "answer") !== "answer") return J({ error: "Action inconnue." }, 400);
    const result = await answer(c, body);
    return J(adaptSuggestions(result, String(body.text || ""), c));
  } catch (e) {
    console.error(e);
    const m = e instanceof Error ? e.message : String(e);
    return J({ error: m }, /Session|autorisé|accès/i.test(m) ? 403 : 400);
  }
});
