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
    const started = performance.now();
    const result = await answer(c, body);
    const adapted = adaptSuggestions(result, String(body.text || ""), c);
    console.info(JSON.stringify({
      event:"stip_dialog",
      kind:String(adapted.kind||""),
      intent:String((adapted.context as any)?.last_intent||""),
      level:c.level,
      latency_ms:Math.round(performance.now()-started),
      cards:Array.isArray(adapted.cards)?adapted.cards.length:0,
      actions:Array.isArray(adapted.actions)?adapted.actions.length:0,
    }));
    return J(adapted);
  } catch (e) {
    console.error(e);
    const m = e instanceof Error ? e.message : String(e);
    return J({ error: m }, /Session|autorisé|accès/i.test(m) ? 403 : 400);
  }
});
