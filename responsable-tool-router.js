(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const open = String(params.get("open") || params.get("tool") || "").toLowerCase();

  function showTracking() {
    document.body.classList.add("resp-tracking-view");
    const tracking = document.getElementById("respTrackingTool");
    const agenda = document.getElementById("rrAgendaCanvas");
    if (tracking) tracking.hidden = false;
    if (agenda) agenda.hidden = true;
  }

  function clickHook(selector) {
    const run = () => {
      const el = document.querySelector(selector);
      if (el) el.click();
    };
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(run), { once: true });
    else
      requestAnimationFrame(run);
  }

  if (open === "tracking" || open === "suivi") showTracking();
  else if (open === "official") clickHook("[data-resp-official]");
  else if (open === "directory" || open === "brancardiers")
    clickHook('[data-resp-agents="directory"]');
})();