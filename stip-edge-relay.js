(() => {
  "use strict";

  const SUPABASE_FUNCTIONS =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/";
  const RELAY = "https://stip-ten.vercel.app/api/stip-access";
  const nativeFetch = window.fetch.bind(window);

  const BREAKER_KEY = "stip_edge_breaker_v1";
  const BREAKER_402_MS = 5 * 60 * 1000;
  const BREAKER_429_MS = 60 * 1000;
  const BREAKER_5XX_MS = 30 * 1000;
  let breaker = readBreaker();

  function readBreaker() {
    try {
      const value = JSON.parse(localStorage.getItem(BREAKER_KEY) || "null");
      if (!value || Number(value.until || 0) <= Date.now())
        return { until: 0, status: 0 };
      return {
        until: Number(value.until || 0),
        status: Number(value.status || 0),
      };
    } catch {
      return { until: 0, status: 0 };
    }
  }

  function writeBreaker(status, duration) {
    breaker = {
      status: Number(status || 0),
      until: Date.now() + Math.max(1000, Number(duration || 0)),
    };
    try {
      localStorage.setItem(BREAKER_KEY, JSON.stringify(breaker));
    } catch {}
    window.dispatchEvent(
      new CustomEvent("stip:network-breaker", { detail: { ...breaker } }),
    );
  }

  function clearBreaker() {
    breaker = { until: 0, status: 0 };
    try {
      localStorage.removeItem(BREAKER_KEY);
    } catch {}
  }

  function managed(rawUrl) {
    return rawUrl.startsWith(SUPABASE_FUNCTIONS) || rawUrl === RELAY;
  }

  function breakerOpen() {
    if (Number(breaker.until || 0) > Date.now()) return true;
    if (breaker.until) clearBreaker();
    return false;
  }

  function blockedResponse() {
    return new Response(
      JSON.stringify({
        error:
          "Service STIP temporairement limité. Les tentatives automatiques sont suspendues quelques minutes.",
        code: "stip_circuit_open",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-STIP-Circuit": "open",
        },
      },
    );
  }

  function observe(response) {
    if (!response) return response;
    if (response.status === 402) {
      writeBreaker(402, BREAKER_402_MS);
      return blockedResponse();
    }
    if (response.status === 429) writeBreaker(429, BREAKER_429_MS);
    else if ([502, 503, 504].includes(response.status))
      writeBreaker(response.status, BREAKER_5XX_MS);
    else if (response.ok && breaker.until) clearBreaker();
    return response;
  }

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

  async function relay(input, init, rawUrl) {
    const url = new URL(rawUrl);
    const target = url.pathname
      .slice("/functions/v1/".length)
      .split("/")[0]
      .trim();
    const method = String(
      init?.method || (input instanceof Request ? input.method : "GET"),
    ).toUpperCase();

    if (!target || method !== "POST") throw new Error("relay-not-applicable");

    const body = await bodyText(input, init);
    if (body == null) throw new Error("relay-body-unsupported");

    let payload = {};
    if (body) payload = JSON.parse(body);

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

    return nativeFetch(RELAY, {
      method: "POST",
      cache: "no-store",
      headers: relayHeaders,
      body: JSON.stringify(relayBody),
      signal:
        init?.signal ||
        (input instanceof Request ? input.signal : undefined),
    });
  }

  window.fetch = async function stipFetch(input, init = {}) {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input || "");

    if (!managed(rawUrl)) return nativeFetch(input, init);
    if (breakerOpen()) return blockedResponse();

    if (rawUrl.startsWith(SUPABASE_FUNCTIONS)) {
      try {
        return observe(await nativeFetch(input, init));
      } catch (directError) {
        try {
          return observe(await relay(input, init, rawUrl));
        } catch {
          throw directError;
        }
      }
    }

    return observe(await nativeFetch(input, init));
  };

  window.STIPEdgeRelay = {
    active: true,
    mode: "direct-first-fallback+circuit-breaker",
    relay: RELAY,
    version: "20260926-network-budget1",
    breaker: () => ({ ...breaker, open: breakerOpen() }),
    resetBreaker: clearBreaker,
  };
})();