(() => {
  "use strict";

  // Responsable is a first-class STIP workspace: direct/deep links are routed
  // through the main home shell so the canonical Applications / Mon profil /
  // Esprit d'équipe header, notification bell and shortcuts stay consistent.
  if (window.self === window.top) {
    try {
      const source = new URLSearchParams(location.search),
        keep = new URLSearchParams();
      for (const key of ["tab", "mode", "tool", "open"]) {
        const value = source.get(key);
        if (value) keep.set(key, value);
      }
      if ([...keep].length)
        sessionStorage.setItem(
          "stip_responsable_entry_search_v1",
          keep.toString(),
        );
      else sessionStorage.removeItem("stip_responsable_entry_search_v1");
    } catch {}
    location.replace("index.html#/responsable");
    return;
  }

  const V = "20260924-responsable-shared-head1",
    m = new Map(),
    done = new Set();
  function load(src) {
    if (done.has(src)) return Promise.resolve();
    if (m.has(src)) return m.get(src);
    const p = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = `${src}?v=${V}`;
      s.async = false;
      s.onload = () => {
        done.add(src);
        ok();
      };
      s.onerror = () => {
        m.delete(src);
        ko(new Error(src));
      };
      document.body.appendChild(s);
    });
    m.set(src, p);
    return p;
  }
  async function seq(a) {
    for (const x of a) await load(x);
  }
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest?.("[data-resp-agents]"))
        seq(["agent-agenda-view.js", "responsable-agents.js"]).catch(() => {});
      if (e.target.closest?.("[data-resp-agenda]"))
        seq(["responsable-agenda-entry.js"]).catch(() => {});
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "click",
    async (e) => {
      const a = e.target.closest?.("[data-resp-agents]");
      if (a && !done.has("responsable-agents.js")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        await seq(["agent-agenda-view.js", "responsable-agents.js"]);
        a.click();
        return;
      }
      const g = e.target.closest?.("[data-resp-agenda]");
      if (g && !done.has("responsable-agenda-entry.js")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        await seq(["responsable-agenda-entry.js"]);
        g.click();
      }
    },
    true,
  );
  const idle = () =>
    seq(["responsable-day-workflow.js", "responsable-intelligence.js"]).catch(
      () => {},
    );
  "requestIdleCallback" in window
    ? requestIdleCallback(idle, { timeout: 1800 })
    : setTimeout(idle, 800);
  const savedNavigation = window.STIPNav?.read?.() || {};
  const requestedAgents =
    new URLSearchParams(location.search).get("open") === "evaluation"
      ? "evaluation"
      : savedNavigation.panelKind === "agents"
        ? savedNavigation.agentMode || "directory"
        : "";
  if (requestedAgents)
    seq(["agent-agenda-view.js", "responsable-agents.js"])
      .then(() =>
        requestAnimationFrame(() =>
          document
            .querySelector(`[data-resp-agents="${requestedAgents}"]`)
            ?.click(),
        ),
      )
      .catch(() => {});
  window.STIPRespLoader = { load, seq };
})();
