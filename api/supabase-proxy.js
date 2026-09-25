const SUPABASE_ORIGIN = "https://yzsrmuxghlengnkyphxj.supabase.co";
const ALLOWED_PREFIXES = [
  "/functions/v1/",
  "/rest/v1/",
  "/storage/v1/",
  "/auth/v1/",
  "/realtime/v1/",
];

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function allowedPath(path) {
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body;
  if (req.body !== undefined && req.body !== null) {
    const type = String(req.headers["content-type"] || "").toLowerCase();
    if (type.includes("application/json")) return JSON.stringify(req.body);
    if (req.body instanceof Uint8Array) return Buffer.from(req.body);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const rawPath = first(req.query?.path);
  const path = typeof rawPath === "string" ? rawPath : "";
  if (!path.startsWith("/") || !allowedPath(path)) {
    res.status(400).json({ error: "Chemin Supabase non autorisé." });
    return;
  }

  try {
    const headers = {};
    const forward = [
      "authorization",
      "apikey",
      "content-type",
      "accept",
      "accept-profile",
      "content-profile",
      "prefer",
      "range",
      "if-none-match",
      "if-modified-since",
      "x-client-info",
      "x-supabase-api-version",
      "x-stip-session",
    ];
    for (const key of forward) {
      const value = first(req.headers[key]);
      if (value !== undefined) headers[key] = value;
    }

    const upstream = await fetch(SUPABASE_ORIGIN + path, {
      method: req.method,
      headers,
      body: await requestBody(req),
      redirect: "follow",
    });

    const responseHeaders = [
      "content-type",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
      "cache-control",
      "content-disposition",
    ];
    for (const key of responseHeaders) {
      const value = upstream.headers.get(key);
      if (value) res.setHeader(key, value);
    }
    res.setHeader("x-stip-supabase-proxy", "1");

    const payload = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(payload);
  } catch (error) {
    console.error("supabase proxy failed", error);
    res.status(502).json({ error: "Connexion aux services STIP indisponible." });
  }
};
