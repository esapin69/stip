import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const TEAM_KEY = "__stip_team_chat_v1__";
const TEAM_BUCKET = "stip-team-chat";
const TTL_DAYS = 15;
const ORPHAN_GRACE_MS = 2 * 60 * 60 * 1000;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

async function allMessageRows(conversationId: string, expiredBefore?: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    let query = db
      .from("stip_messages")
      .select("id,payload,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (expiredBefore) query = query.lt("created_at", expiredBefore);
    const { data, error } = await query;
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

async function removePaths(paths: string[]) {
  const unique = [...new Set(paths.map((x) => String(x || "").trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await db.storage.from(TEAM_BUCKET).remove(unique.slice(i, i + 100));
    if (error) throw error;
  }
  return unique.length;
}

async function deleteMessages(ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from("stip_messages").delete().in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}

async function listAll(prefix: string) {
  const out: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage
      .from(TEAM_BUCKET)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const batch = data || [];
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

async function cleanupOrphanPhotos(conversationId: string) {
  const current = await allMessageRows(conversationId);
  const referenced = new Set(
    current
      .map((row: any) => String(row?.payload?.photo_path || "").trim())
      .filter(Boolean),
  );
  const root = await listAll(conversationId);
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const orphanCutoff = now - ORPHAN_GRACE_MS;
  const orphans: string[] = [];

  for (const folder of root) {
    const folderName = String(folder?.name || "").trim();
    if (!folderName) continue;
    const files = await listAll(conversationId + "/" + folderName);
    for (const file of files) {
      if (!file?.id || !file?.name) continue;
      const path = conversationId + "/" + folderName + "/" + String(file.name);
      if (referenced.has(path)) continue;
      const timestamp = Date.parse(String(file.created_at || file.updated_at || ""));
      const oldEnough = Number.isFinite(timestamp)
        ? timestamp < orphanCutoff
        : /^\d{4}-\d{2}-\d{2}$/.test(folderName) && folderName < today;
      if (oldEnough) orphans.push(path);
    }
  }
  return removePaths(orphans);
}

async function purgeExpired() {
  const { data: conversation, error: conversationError } = await db
    .from("stip_conversations")
    .select("id")
    .eq("direct_key", TEAM_KEY)
    .maybeSingle();

  if (conversationError) throw conversationError;
  if (!conversation) return { deleted: 0, photos: 0, orphan_photos: 0 };

  const cutoff = new Date(Date.now() - TTL_DAYS * 86400000).toISOString();
  const rows = await allMessageRows(conversation.id, cutoff);
  const paths = rows
    .map((row: any) => String(row?.payload?.photo_path || "").trim())
    .filter(Boolean);

  const photos = await removePaths(paths);
  const ids = rows.map((row: any) => String(row.id));
  if (ids.length) await deleteMessages(ids);

  const orphanPhotos = await cleanupOrphanPhotos(String(conversation.id));
  return { deleted: ids.length, photos, orphan_photos: orphanPhotos };
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
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String((error as any).message || "Erreur serveur.")
          : String(error || "Erreur serveur.");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: HEADERS,
    });
  }
});
