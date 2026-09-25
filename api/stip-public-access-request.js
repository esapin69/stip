const TARGET = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-public-access-request";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const body =
      typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body || {});

    const upstream = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    console.error("stip-public-access-request proxy failed", error);
    res.status(502).json({ error: "Envoi temporairement indisponible." });
  }
};
