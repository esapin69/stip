(() => {
  "use strict";
  if (window.__STIPActivityRuntimeLoaded) return;
  window.__STIPActivityRuntimeLoaded = true;

  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access",
    STORE = "stip_session_v1",
    LAST = "stip_activity_last_v1",
    MIN_REPEAT_MS = 15000;

  function currentKey() {
    const path = location.pathname.toLowerCase(),
      params = new URLSearchParams(location.search),
      route = window.STIPRouter?.get?.() || "";

    const routeMap = {
      "planning/personal": "planning_personal",
      "planning/calendar": "calendar",
      "planning/team": "team",
      "planning/spirit": "team",
      "planning/change": "change",
      contacts: "contacts",
      notifications: "notifications",
      profile: "profile",
      home: "home",
    };
    if (routeMap[route]) return routeMap[route];

    const quick = String(params.get("quick") || "").toLowerCase();
    const quickMap = {
      personal: "planning_personal",
      tomorrow: "tomorrow",
      team: "team",
      change: "change",
      calendar: "calendar",
      contacts: "contacts",
      notifications: "notifications",
      profile: "profile",
    };
    if (quickMap[quick]) return quickMap[quick];

    const tab = String(params.get("tab") || "").toLowerCase();
    if (path.endsWith("/esprit-equipe.html")) {
      if (tab === "assistant") return "assistant";
      if (tab === "activity") return "activity";
      return "team";
    }

    if (path.includes("agent-date")) return "agent_dates";
    if (path.includes("agent-directory") || path.includes("agent-agenda"))
      return "agent_directory";
    if (path.includes("planning-compare")) return "planning_compare";
    if (path.includes("responsable")) return "responsable";
    if (path.includes("cadre-activite")) return "activity";
    if (path.endsWith("/assistant.html")) return "assistant";
    if (path.includes("places")) return "places";
    if (path.includes("access-manage")) return "access";
    if (path.includes("notification")) return "notifications";
    if (path.includes("message") || path.includes("fauteuil")) return "messages";

    const bodyKey = String(document.body?.dataset?.stipApp || "").toLowerCase();
    const bodyMap = {
      access: "access",
      responsable: "responsable",
      places: "places",
      messages: "messages",
      notifications: "notifications",
      profile: "profile",
      activity: "activity",
      assistant: "assistant",
      team: "team",
    };
    if (bodyMap[bodyKey]) return bodyMap[bodyKey];

    if (
      path.endsWith("/index.html") ||
      path === "/" ||
      path === "" ||
      /\/stip\/?$/.test(path)
    )
      return "home";

    return "";
  }

  let inFlightKey = "";
  function recentDuplicate(key, now) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(LAST) || "null");
      return saved?.key === key && Number(saved?.at || 0) > now - MIN_REPEAT_MS;
    } catch {
      return false;
    }
  }

  function mark(key, now) {
    try {
      sessionStorage.setItem(LAST, JSON.stringify({ key, at: now }));
    } catch {}
  }

  async function track() {
    if (window.STIPPreview?.active) return;
    const token = localStorage.getItem(STORE) || "",
      key = currentKey(),
      now = Date.now();
    if (!token || !key || inFlightKey === key || recentDuplicate(key, now))
      return;

    inFlightKey = key;
    mark(key, now);
    try {
      await fetch(API, {
        method: "POST",
        cache: "no-store",
        keepalive: true,
        headers: {
          "content-type": "application/json",
          "x-stip-session": token,
        },
        body: JSON.stringify({ action: "activity", page_key: key }),
      });
    } catch {
      // La journalisation ne doit jamais bloquer l'application.
    } finally {
      inFlightKey = "";
    }
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(track, 60);
  }

  [
    "pageshow",
    "popstate",
    "hashchange",
    "stip:session-ready",
    "stip:route",
    "stip:home-rendered",
    "stip:lazy-ready",
  ].forEach((name) => window.addEventListener(name, schedule));

  schedule();
})();
