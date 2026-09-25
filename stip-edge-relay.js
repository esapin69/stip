(() => {
  "use strict";

  const SUPABASE_FUNCTIONS =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/";
  const RELAY = "https://stip-ten.vercel.app/api/stip-access";
  const nativeFetch = window.fetch.bind(window);

  function mergedHeaders(input, init) {
    const headers = new Headers(
      input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) =>
        headers.set(key, value),
      );
    }
    return headers;
  }

  async function bodyText(input, init) {
    if (typeof init?.body === "string") return init.body;
    if (init?.body instanceof URLSearchParams) return init.body.toString();
    if (init?.body != null) return null;
    if (input instanceof Request) {
      try {
        return await input.clone().text();
      } catch {
        return null;
      }
    }
    return "";
  }

  async function direct(input, init) {
    return nativeFetch(input, init);
  }

  window.fetch = async function stipFetch(input, init = {}) {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input || "");

    if (!rawUrl.startsWith(SUPABASE_FUNCTIONS))
      return direct(input, init);

    const url = new URL(rawUrl);
    const target = url.pathname
      .slice("/functions/v1/".length)
      .split("/")[0]
      .trim();

    const method = String(
      init.method || (input instanceof Request ? input.method : "GET"),
    ).toUpperCase();

    if (!target || method !== "POST") return direct(input, init);

    const text = await bodyText(input, init);
    if (text == null) return direct(input, init);

    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        return direct(input, init);
      }
    }

    const sourceHeaders = mergedHeaders(input, init);
    const relayHeaders = new Headers({ "Content-Type": "application/json" });
    const session = sourceHeaders.get("x-stip-session");
    if (session) relayHeaders.set("X-STIP-Session", session);

    const relayBody =
      target === "stip-access"
        ? payload
        : {
            action: "relay",
            target,
            query: url.search || "",
            payload,
          };

    try {
      const response = await nativeFetch(RELAY, {
        method: "POST",
        cache: "no-store",
        headers: relayHeaders,
        body: JSON.stringify(relayBody),
        signal:
          init?.signal ||
          (input instanceof Request ? input.signal : undefined),
      });
      if (response.status < 500) return response;
    } catch {}

    return direct(input, init);
  };

  window.STIPEdgeRelay = {
    active: true,
    relay: RELAY,
    version: "20260925-network-core2",
  };
})();
