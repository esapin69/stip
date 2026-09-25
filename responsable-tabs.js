(() => {
  "use strict";

  const VALID = new Set(["dates", "suivi", "equipe", "agenda"]),
    $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];

  let current = "",
    agendaLoadPromise = null;

  function initialTab() {
    const params = new URLSearchParams(location.search),
      explicit = String(params.get("tab") || "").toLowerCase();
    if (VALID.has(explicit)) return explicit;
    const open = String(params.get("open") || params.get("tool") || "").toLowerCase();
    if (open === "tracking" || open === "suivi") return "suivi";
    if (["evaluation", "official", "directory", "brancardiers"].includes(open))
      return "equipe";
    if (open === "agenda" || open === "add") return "agenda";
    return "dates";
  }

  function legacyTeamMode() {
    const p = new URLSearchParams(location.search),
      mode = String(p.get("mode") || "").toLowerCase(),
      open = String(p.get("open") || p.get("tool") || "").toLowerCase();
    if (mode === "evaluation" || open === "evaluation") return "evaluation";
    if (open === "official" || String(p.get("tool") || "").toLowerCase() === "official")
      return "official";
    return "directory";
  }

  function syncUrl(tab) {
    const url = new URL(location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("tool");
    if (tab !== "equipe") url.searchParams.delete("mode");
    if (tab !== "agenda") {
      if (["add", "agenda"].includes(String(url.searchParams.get("open") || "").toLowerCase()))
        url.searchParams.delete("open");
      url.searchParams.delete("date");
      url.searchParams.delete("filter");
      url.searchParams.delete("focus");
    }
    if (tab !== "equipe") {
      const open = String(url.searchParams.get("open") || "").toLowerCase();
      if (["evaluation", "official", "directory", "brancardiers"].includes(open))
        url.searchParams.delete("open");
    }
    if (tab !== "suivi") {
      const open = String(url.searchParams.get("open") || "").toLowerCase();
      if (["tracking", "suivi"].includes(open)) url.searchParams.delete("open");
    }
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }

  function closeInlineTeamPanel() {
    const panel = $("#respPanel");
    if (!panel) return;
    panel.classList.remove("open", "ra-native-panel");
    panel.setAttribute("aria-hidden", "true");
  }

  function closeAgendaSheets() {
    $$(".resp-agenda-inline .ta-sheet.open").forEach((sheet) => {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    });
  }

  function waitForAccess() {
    if (document.documentElement.dataset.responsableLevel)
      return Promise.resolve(document.documentElement.dataset.responsableLevel);
    return new Promise((resolve) => {
      const finish = () => {
        observer.disconnect();
        resolve(document.documentElement.dataset.responsableLevel || "visitor");
      };
      const observer = new MutationObserver(() => {
        if (document.documentElement.dataset.responsableLevel) finish();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-responsable-level"],
      });
      setTimeout(finish, 4000);
    });
  }

  async function ensureTeam() {
    const panel = $("#respPanel");
    if (panel?.classList.contains("open") && $("#respPanelBody")?.childElementCount)
      return;

    const requested = legacyTeamMode(),
      level = await waitForAccess(),
      mode = requested === "directory" || level === "pro" ? requested : "directory",
      selector =
        mode === "evaluation"
          ? '[data-resp-agents="evaluation"]'
          : mode === "official"
            ? "[data-resp-official]"
            : '[data-resp-agents="directory"]';

    requestAnimationFrame(() => document.querySelector(selector)?.click());
  }

  function ensureAgenda() {
    if (window.STIPResponsableAgenda?.version === "20260925-canonical-events5")
      return Promise.resolve(window.STIPResponsableAgenda);
    if (agendaLoadPromise) return agendaLoadPromise;
    agendaLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-resp-inline-agenda="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.STIPResponsableAgenda), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "responsable-agenda.js?v=20260925-canonical-events5";
      script.dataset.respInlineAgenda = "1";
      script.onload = () => {
        window.STIPResponsableAgendaLoaded = true;
        resolve(window.STIPResponsableAgenda);
      };
      script.onerror = (error) => {
        agendaLoadPromise = null;
        reject(error);
      };
      document.body.appendChild(script);
    });
    return agendaLoadPromise;
  }

  async function openAgendaAdd(date = "") {
    activate("agenda");
    await ensureAgenda();
    window.STIPResponsableAgenda?.openAdd?.(date);
  }

  function ensureRequests() {
    if (window.STIPResponsableRequestsLoaded) return;
    if (document.querySelector('script[data-resp-inline-requests="1"]')) return;
    const script = document.createElement("script");
    script.src = "responsable-demandes.js?v=20260922-tabs1";
    script.dataset.respInlineRequests = "1";
    script.onload = () => {
      window.STIPResponsableRequestsLoaded = true;
    };
    document.body.appendChild(script);
  }

  function maybeOpenRequestTool() {
    const params = new URLSearchParams(location.search);
    if (String(params.get("tool") || "").toLowerCase() !== "requests") return;
    const details = $("#respRequestCompose");
    if (!details) return;
    details.open = true;
    ensureRequests();
    requestAnimationFrame(() =>
      details.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function activate(tab, options = {}) {
    if (!VALID.has(tab)) tab = "dates";
    const previous = current;
    current = tab;

    document.body.classList.remove(
      "resp-tab-dates",
      "resp-tab-suivi",
      "resp-tab-equipe",
      "resp-tab-agenda",
      "resp-tracking-view",
    );
    document.body.classList.add("resp-tab-" + tab);

    $$("[data-resp-tab]").forEach((button) => {
      const selected = button.dataset.respTab === tab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    $$("[data-resp-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.respPane !== tab;
    });

    if (previous === "equipe" && tab !== "equipe") closeInlineTeamPanel();
    if (previous === "agenda" && tab !== "agenda") closeAgendaSheets();

    if (tab === "suivi") {
      const tracking = $("#respTrackingTool");
      if (tracking) tracking.hidden = false;
      window.dispatchEvent(
        new CustomEvent("stip:responsable-tab", { detail: { tab: "suivi" } }),
      );
      maybeOpenRequestTool();
    } else if (tab === "equipe") {
      ensureTeam();
    } else if (tab === "agenda") {
      ensureAgenda();
    }

    if (options.syncUrl !== false) syncUrl(tab);
    try {
      sessionStorage.setItem("stip_responsable_tab_v1", tab);
    } catch {}
  }

  document.addEventListener("click", (event) => {
    const requestSummary = event.target.closest?.("#respRequestCompose > summary");
    if (requestSummary) ensureRequests();

    const button = event.target.closest?.("[data-resp-tab]");
    if (!button) return;
    event.preventDefault();
    activate(button.dataset.respTab);
    window.scrollTo({ top: 0, behavior: "auto" });
  });

  addEventListener("popstate", () => activate(initialTab(), { syncUrl: false }));

  const start = initialTab();
  activate(start, { syncUrl: !new URLSearchParams(location.search).has("tab") });
  window.STIPResponsableTabs = { activate, current: () => current, ensureAgenda, openAgendaAdd };
})();