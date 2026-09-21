import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const TABLEAU_PREFIX = "__stip_tableau_day__:";
const TEAM_BUCKET = "stip-team-chat";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function parisDayKey(value: Date | string | number = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((x) => x.type === type)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

async function allRows(conversationId: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("stip_messages")
      .select("id,payload,created_at")
      .eq("conversation_id", conversationId)
      .range(from, from + 999);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

async function removePaths(paths: string[]) {
  const unique = [
    ...new Set(paths.map((path) => String(path || "").trim()).filter(Boolean)),
  ];
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await db.storage
      .from(TEAM_BUCKET)
      .remove(unique.slice(i, i + 100));
    if (error) throw error;
  }
  return unique.length;
}

async function deleteMessages(ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db
      .from("stip_messages")
      .delete()
      .in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}

async function listFolder(prefix: string) {
  const items: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage
      .from(TEAM_BUCKET)
      .list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw error;
    const batch = data || [];
    items.push(...batch);
    if (batch.length < 1000) break;
  }
  return items;
}

async function removeStorageTree(conversationId: string) {
  const root = await listFolder(conversationId);
  const paths: string[] = [];

  for (const entry of root) {
    const name = String(entry?.name || "").trim();
    if (!name) continue;

    if (entry?.id) {
      paths.push(conversationId + "/" + name);
      continue;
    }

    const files = await listFolder(conversationId + "/" + name);
    for (const file of files) {
      if (file?.id && file?.name) {
        paths.push(
          conversationId + "/" + name + "/" + String(file.name),
        );
      }
    }
  }

  return removePaths(paths);
}

async function purgeCurrentConversation(conversation: any) {
  if (!conversation?.id) return { messages: 0, photos: 0 };
  const today = parisDayKey();
  const rows = await allRows(String(conversation.id));
  const stale = rows.filter(
    (row: any) => parisDayKey(row.created_at) !== today,
  );

  const photos = await removePaths(
    stale
      .map((row: any) => String(row?.payload?.photo_path || "").trim())
      .filter(Boolean),
  );

  const ids = stale.map((row: any) => String(row.id));
  if (ids.length) await deleteMessages(ids);

  const root = await listFolder(String(conversation.id));
  const oldFolderPaths: string[] = [];
  for (const entry of root) {
    const name = String(entry?.name || "").trim();
    if (!name || name === today) continue;
    if (entry?.id) {
      oldFolderPaths.push(String(conversation.id) + "/" + name);
      continue;
    }
    const files = await listFolder(String(conversation.id) + "/" + name);
    for (const file of files) {
      if (file?.id && file?.name)
        oldFolderPaths.push(
          String(conversation.id) + "/" + name + "/" + String(file.name),
        );
    }
  }
  const orphanPhotos = await removePaths(oldFolderPaths);
  return { messages: ids.length, photos: photos + orphanPhotos };
}

async function purgePreviousDays() {
  const todayKey = TABLEAU_PREFIX + parisDayKey();
  const { data: conversations, error } = await db
    .from("stip_conversations")
    .select("id,direct_key")
    .eq("kind", "team_chat");

  if (error) throw error;

  const current = (conversations || []).find(
    (conversation: any) => String(conversation.direct_key || "") === todayKey,
  );
  const old = (conversations || []).filter(
    (conversation: any) => String(conversation.direct_key || "") !== todayKey,
  );

  const currentCleanup = await purgeCurrentConversation(current);
  let deletedMessages = currentCleanup.messages;
  let deletedPhotos = currentCleanup.photos;
  let deletedConversations = 0;

  for (const conversation of old) {
    const id = String(conversation.id);
    const rows = await allRows(id);

    deletedPhotos += await removePaths(
      rows
        .map((row: any) => String(row?.payload?.photo_path || "").trim())
        .filter(Boolean),
    );

    const ids = rows.map((row: any) => String(row.id));
    if (ids.length) {
      await deleteMessages(ids);
      deletedMessages += ids.length;
    }

    deletedPhotos += await removeStorageTree(id);

    const { error: deleteConversationError } = await db
      .from("stip_conversations")
      .delete()
      .eq("id", id);
    if (deleteConversationError) throw deleteConversationError;

    deletedConversations += 1;
  }

  return {
    day: parisDayKey(),
    deleted_messages: deletedMessages,
    deleted_photos: deletedPhotos,
    deleted_conversations: deletedConversations,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: HEADERS });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
      status: 405,
      headers: HEADERS,
    });
  }

  try {
    const result = await purgePreviousDays();
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
