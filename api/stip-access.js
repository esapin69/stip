const TARGET = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-STIP-Session");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const headers = { "Content-Type": "application/json" };
    const session = req.headers["x-stip-session"];
    if (session) headers["X-STIP-Session"] = Array.isArray(session) ? session[0] : session;

    const body =
      typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body || {});

    const upstream = await fetch(TARGET, {
      method: "POST",
      headers,
      body,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(text);
  } catch (error) {
    console.error("stip-access proxy failed", error);
    res.status(502).json({ error: "Connexion STIP temporairement indisponible." });
  }
};
