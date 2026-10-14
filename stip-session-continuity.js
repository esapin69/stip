(() => {
  "use strict";

  if (window.STIPContinuity) return;

  const TOKEN_KEY = "stip_session_v1";
  const SNAPSHOT_KEY = "stip_session_snapshot_v1";
  const PERSIST_KEY = "stip_session_snapshot_persistent_v1";
  const SNAPSHOT_VERSION = 1;
  const FRESH_MS = 2 * 60 * 1000;
  // A saved, account-scoped snapshot remains usable until logout or server revocation.
  // FRESH_MS only controls when online revalidation is required.
  const MAX_MS = Number.POSITIVE_INFINITY;
  const API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access";
  let inFlight = null;
  let inFlightToken = "";

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function fingerprint(value = token()) {
    const raw = String(value || "");
    return raw ? raw.slice(-16) : "";
  }

  function readRecord() {
    if (!token()) return null;
    // sessionStorage is the fast path; localStorage survives closing the browser.
    for (const store of [sessionStorage, localStorage]) {
      try {
        const key = store === sessionStorage ? SNAPSHOT_KEY : PERSIST_KEY;
        const value = JSON.parse(store.getItem(key) || "null");
        if (!value || value.version !== SNAPSHOT_VERSION || !value.session) continue;
        if (value.token !== fingerprint()) continue;
        if (!Number.isFinite(Number(value.at)) || Number(value.at) > Date.now() + 60000) continue;
        return value;
      } catch {}
    }
    return null;
  }

  function read(maxAge = MAX_MS) {
    const record = readRecord();
    if (!record) return null;
    if (Date.now() - Number(record.at || 0) > maxAge) return null;
    return record.session;
  }

  function readFresh() {
    return read(FRESH_MS);
  }

  function write(session) {
    if (!session || !token()) return session || null;
    const snapshot = JSON.stringify({
      version: SNAPSHOT_VERSION,
      token: fingerprint(),
      at: Date.now(),
      session,
    });
    try { sessionStorage.setItem(SNAPSHOT_KEY, snapshot); } catch {}
    try { localStorage.setItem(PERSIST_KEY, snapshot); } catch {}
    window.dispatchEvent(
      new CustomEvent("stip:session-snapshot", { detail: session }),
    );
    return session;
  }

  function clear({ clearToken = false } = {}) {
    try { sessionStorage.removeItem(SNAPSHOT_KEY); } catch {}
    try { localStorage.removeItem(PERSIST_KEY); } catch {}
    if (clearToken) {
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
    }
  }

  async function requestMe(expectedToken = token()) {
    const currentToken = String(expectedToken || "");
    if (!currentToken) {
      const error = new Error("Session STIP requise.");
      error.status = 401;
      error.requestToken = "";
      throw error;
    }
    const response = await fetch(API, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": currentToken,
      },
      body: JSON.stringify({ action: "me" }),
    });
    const data = await response.json().catch(() => ({}));
    if (token() !== currentToken) {
      const error = new Error("Vérification de session remplacée.");
      error.stale = true;
      error.requestToken = currentToken;
      throw error;
    }
    if (!response.ok || data?.error) {
      const error = new Error(data?.error || `Erreur ${response.status}`);
      error.status = response.status;
      error.code = data?.error || "";
      error.requestToken = currentToken;
      throw error;
    }
    return write(data);
  }

  async function validate({ force = false } = {}) {
    if (!force) {
      const fresh = readFresh();
      if (fresh) return fresh;
    }
    const expectedToken = token();
    if (inFlight && inFlightToken === expectedToken) return inFlight;
    inFlightToken = expectedToken;
    const requestToken = expectedToken;
    const promise = requestMe(requestToken)
      .catch((error) => {
        if (error?.stale || token() !== requestToken) {
          const cached = readFresh();
          if (cached) return cached;
          throw error;
        }
        if (error?.status === 401 || error?.status === 403) {
          clear({ clearToken: true });
          window.dispatchEvent(
            new CustomEvent("stip:session-expired", { detail: error }),
          );
          throw error;
        }
        const cached = read();
        if (cached) return cached;
        throw error;
      })
      .finally(() => {
        if (inFlight === promise) {
          inFlight = null;
          inFlightToken = "";
        }
      });
    inFlight = promise;
    return promise;
  }

  window.STIPContinuity = {
    version: SNAPSHOT_VERSION,
    freshMs: FRESH_MS,
    maxMs: MAX_MS,
    token,
    read,
    readFresh,
    write,
    clear,
    validate,
  };
})();
