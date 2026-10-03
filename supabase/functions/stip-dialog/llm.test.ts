import { assertEquals } from "jsr:@std/assert@1";
import { extractRouteFromResponse, shouldUseOpenAI, validateModelRoute } from "./llm.ts";

Deno.test("STIP IA keeps high-confidence deterministic routes local", () => {
  assertEquals(shouldUseOpenAI({ intent: "place", confidence: 0.95 }, "où est l'IRM ?"), false);
});

Deno.test("STIP IA asks the model for low-confidence or unknown formulations", () => {
  assertEquals(shouldUseOpenAI({ intent: "help", confidence: 0 }, "je reprends avec qui après mes vacances"), true);
  assertEquals(shouldUseOpenAI({ intent: "planning", confidence: 0.82 }, "je fais quoi mardi"), true);
});

Deno.test("model route validation rejects unknown intents and incomplete app navigation", () => {
  assertEquals(validateModelRoute({ intent: "delete_database", app: "", confidence: 1, reason: "x" }), null);
  assertEquals(validateModelRoute({ intent: "app_navigation", app: "", confidence: 0.9, reason: "x" }), null);
});

Deno.test("model route validation accepts only registered STIP apps", () => {
  assertEquals(
    validateModelRoute({ intent: "app_navigation", app: "planning_personal", confidence: 0.93, reason: "ouvrir planning" }),
    { intent: "app_navigation", app: "planning_personal", confidence: 0.93, reason: "ouvrir planning" },
  );
});

Deno.test("Responses API tool output is parsed without model prose", () => {
  const response = {
    output: [
      { type: "message", content: [{ type: "output_text", text: "texte à ignorer" }] },
      {
        type: "function_call",
        name: "route_stip_request",
        arguments: JSON.stringify({ intent: "exchange", app: "", confidence: 0.97, reason: "échange horaire" }),
      },
    ],
  };
  assertEquals(extractRouteFromResponse(response), {
    intent: "exchange",
    confidence: 0.97,
    reason: "échange horaire",
  });
});
