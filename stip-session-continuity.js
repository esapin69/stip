(() => {
  "use strict";

  if (window.STIPContinuity) return;

  const TOKEN_KEY = "stip_session_v1";
  const SNAPSHOT_KEY = "stip_session_snapshot_v1";
  const SNAPSHOT_VERSION = 1;
  const FRESH_MS = 2 * 60 * 1000;
  const MAX_MS = 30 * 60 * 1000;
  const API = "https://stip-ten.vercel.app/api/stip-access";
  let inFlight = null;

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
    try {
      const value = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY) || "null");
      if (!value || value.version !== SNAPSHOT_VERSION || !value.session) return null;
      if (!token() || value.token !== fingerprint()) return null;
      return value;
    } catch {
      return null;
    }
  }

  function read(maxAge = MAX_MS) {
    const record = readRecord();
    if (!record) return null;
    if (Date.now() - Number(record.at || 0) > Number(maxAge || 0)) return null;
    return record.session;
  }

  function readFresh() {
    return read(FRESH_MS);
  }

  function write(session) {
    if (!session || !token()) return session || null;
    try {
      sessionStorage.setItem(
        SNAPSHOT_KEY,
        JSON.stringify({
          version: SNAPSHOT_VERSION,
          token: fingerprint(),
          at: Date.now(),
          session,
        }),
      );
    } catch {}
    window.dispatchEvent(
      new CustomEvent("stip:session-snapshot", { detail: session }),
    );
    return session;
  }

  function clear({ clearToken = false } = {}) {
    try {
      sessionStorage.removeItem(SNAPSHOT_KEY);
    } catch {}
    if (clearToken) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}
    }
  }

  async function requestMe() {
    const currentToken = token();
    if (!currentToken) {
      const error = new Error("Session STIP requise.");
      error.status = 401;
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
    if (!response.ok || data?.error) {
      const error = new Error(data?.error || `Erreur ${response.status}`);
      error.status = response.status;
      error.code = data?.error || "";
      throw error;
    }
    return write(data);
  }

  async function validate({ force = false } = {}) {
    if (!force) {
      const fresh = readFresh();
      if (fresh) return fresh;
    }
    if (inFlight) return inFlight;
    inFlight = requestMe()
      .catch((error) => {
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
        inFlight = null;
      });
    return inFlight;
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
