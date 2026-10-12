(() => {
  "use strict";

  const API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-readonly";
  const STORE = "stip_session_v1";
  const root = document.getElementById("agentDirectoryApp");
  let directory = null;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  async function call(action, body = {}) {
    const response = await fetch(API, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": localStorage.getItem(STORE) || "",
      },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      const raw = data.error || `Erreur ${response.status}`;
      const error = Error(typeof raw === "string" ? raw : raw?.message || "Erreur");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function goBack() {
    if (window.STIPNav?.canBack?.()) {
      window.STIPNav.back("index.html#/apps");
      return;
    }
    location.assign("index.html#/apps");
  }

  function header() {
    return `<header class="ad-head">
      <button type="button" class="ad-back" data-ad-home aria-label="Retour">‹</button>
      <div>
        <small>APPLICATION STIP</small>
        <h1>Équipe</h1>
        <p>Qui est présent aujourd’hui, où le trouver et comment le joindre.</p>
      </div>
    </header>`;
  }

  function openAgent(agent) {
    if (window.STIPAgentAgenda?.open) {
      window.STIPAgentAgenda.open(agent.source_key, agent);
      return;
    }
    const host = document.getElementById("agentDirectorySelector");
    host?.insertAdjacentHTML(
      "beforeend",
      '<div class="ad-error"><strong>Fiche indisponible</strong><span>Recharge la page puis réessaie.</span></div>',
    );
  }

  function openAgentActions(agent) {
    if (!window.STIPPersonActions?.open) {
      openAgent(agent);
      return;
    }
    const actions = [
      {
        key: "planning",
        icon: "📅",
        label: "Voir le planning",
        detail: "Planning et événements de l’agent",
        primary: true,
        onSelect: () => openAgent(agent),
      },
      { key: "afterwork", icon: "🏃", label: "Proposer après le travail", detail: "Voir vos prochaines fins de service compatibles", href: "sorties-loisirs.html?with=" + encodeURIComponent(agent.id || "") },
      agent?.telephone
        ? {
            key: "call",
            icon: "☎",
            label: "Appeler",
            detail: String(agent.telephone),
            onSelect: () => window.STIPAgentSelector?.openCallSheet?.(agent),
          }
        : null,
    ].filter(Boolean);

    window.STIPPersonActions.open({
      agent,
      contextLabel: "ÉQUIPE",
      actions,
    });
  }

  function renderDirectory() {
    root.innerHTML =
      header() +
      '<section class="ad-search-card"><div id="agentDirectorySelector"></div></section>';

    root.querySelector("[data-ad-home]")?.addEventListener("click", goBack);

    const host = document.getElementById("agentDirectorySelector");
    if (!window.STIPAgentSelector) {
      host.innerHTML =
        '<div class="ad-error"><strong>Équipe indisponible</strong><span>Recharge la page pour réessayer.</span></div>';
      return;
    }

    window.STIPAgentSelector.mount(host, {
      items: directory?.items || [],
      date: directory?.date,
      privacy: "team",
      showPhone: true,
      kicker: "ÉQUIPE DU JOUR",
      title: "Présents et absents",
      description:
        "Tri par GHE. Les horaires particuliers sont expliqués sans exposer les motifs sensibles.",
      onSelect: openAgentActions,
    });
  }

  (async () => {
    // Show an authorized recent snapshot immediately; revalidate it in the background.
    const preloaded = window.STIPReadCache?.agentWarm?.read("directory");
    if (preloaded) {
      directory = preloaded;
      renderDirectory();
    }
    try {
      const fresh = await call("directory");
      const changed = !directory ||
        JSON.stringify([directory.date, directory.items]) !== JSON.stringify([fresh.date, fresh.items]);
      directory = fresh;
      window.STIPReadCache?.agentWarm?.write("directory", fresh);
      if (changed) renderDirectory();
      const requested = String(
        new URLSearchParams(location.search).get("agent") || "",
      ).trim();
      if (requested) {
        const agent = (directory?.items || []).find((item) =>
          [item?.source_key, item?.id, item?.matricule]
            .map((value) => String(value || "").trim())
            .includes(requested),
        );
        if (agent) requestAnimationFrame(() => openAgent(agent));
      }
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        window.STIPReadCache?.agentWarm?.clear("directory");
        directory = null;
      } else if (directory) {
        // Keep the last working view if a temporary network error occurs.
        return;
      }
      root.innerHTML =
        header() +
        `<div class="ad-error page"><strong>Accès indisponible</strong><span>${esc(error.message || "Erreur")}</span><button type="button" data-ad-home>Retour à l’accueil</button></div>`;
      root.querySelectorAll("[data-ad-home]").forEach((button) =>
        button.addEventListener("click", goBack),
      );
    }
  })();
})();