import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const TEAM_KEY = "__stip_team_chat_v1__";
const TEAM_BUCKET = "stip-team-chat";
const TTL_DAYS = 15;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

async function purgeExpired() {
  const { data: conversation, error: conversationError } = await db
    .from("stip_conversations")
    .select("id")
    .eq("direct_key", TEAM_KEY)
    .maybeSingle();

  if (conversationError) throw conversationError;
  if (!conversation) return { deleted: 0, photos: 0 };

  const cutoff = new Date(Date.now() - TTL_DAYS * 86400000).toISOString();
  const { data: rows, error } = await db
    .from("stip_messages")
    .select("id,payload")
    .eq("conversation_id", conversation.id)
    .lt("created_at", cutoff);

  if (error) throw error;
  if (!rows?.length) return { deleted: 0, photos: 0 };

  const paths = [
    ...new Set(
      rows
        .map((row: any) => String(row?.payload?.photo_path || "").trim())
        .filter(Boolean),
    ),
  ];

  if (paths.length) {
    const removed = await db.storage.from(TEAM_BUCKET).remove(paths);
    if (removed.error) throw removed.error;
  }

  const ids = rows.map((row: any) => row.id);
  const deleted = await db.from("stip_messages").delete().in("id", ids);
  if (deleted.error) throw deleted.error;

  return { deleted: ids.length, photos: paths.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
      status: 405,
      headers: HEADERS,
    });
  }

  try {
    const result = await purgeExpired();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: HEADERS,
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: HEADERS },
    );
  }
});
