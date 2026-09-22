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

  const name = (agent) =>
    window.STIPAgentSelector?.name?.(agent) ||
    [agent?.prenom, agent?.nom].filter(Boolean).join(" ").trim() ||
    "Agent";

  const initials = (agent) => {
    const parts = name(agent).trim().split(/\s+/).filter(Boolean);
    return (`${parts[0]?.[0] || ""}${parts.at(-1)?.[0] || ""}`).toUpperCase() || "ST";
  };

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
      throw Error(typeof raw === "string" ? raw : raw?.message || "Erreur");
    }
    return data;
  }

  function header() {
    return `<header class="ad-head">
      <button type="button" class="ad-back" data-ad-home aria-label="Retour">‹</button>
      <div>
        <small>APPLICATION STIP</small>
        <h1>Agents</h1>
        <p>Trouver une personne puis ouvrir les informations autorisées.</p>
      </div>
    </header>`;
  }

  function avatar(agent) {
    const url = String(
      agent?.profile_photo_url ||
      agent?.avatar_signed_url ||
      agent?.avatar_url ||
      "",
    );
    const ini = esc(initials(agent));
    return `<span class="ad-avatar" data-initials="${ini}">${/^https?:/i.test(url)
      ? `<img src="${esc(url)}" alt="" loading="lazy">`
      : ini}</span>`;
  }

  function statusText(agent) {
    const code = String(agent?.today_code || "").toUpperCase();
    const special = agent?.today_special_schedule;
    if (special) {
      const start = String(special.window_start || "").slice(0, 5);
      const end = String(special.window_end || "").slice(0, 5);
      const duration = Number(special.duration_minutes || 0);
      const durationLabel = duration
        ? `${Math.floor(duration / 60)}h${String(duration % 60).padStart(2, "0")}`
        : "";
      return [code, durationLabel, start && end ? `${start}–${end}` : ""]
        .filter(Boolean)
        .join(" · ");
    }
    const shifts = {
      M: "M · 06h50–14h40",
      J: "J · 08h30–16h20",
      J4: "J4 · 10h10–18h00",
      S: "S · 13h30–21h00",
      N: "N · 21h00–06h50",
    };
    return shifts[code] || (code || "Non présent aujourd’hui");
  }

  function renderDirectory() {
    root.innerHTML =
      header() +
      '<section class="ad-search-card"><div id="agentDirectorySelector"></div></section>';

    root.querySelector("[data-ad-home]")?.addEventListener("click", () => {
      location.href = "./";
    });

    const host = document.getElementById("agentDirectorySelector");
    if (!window.STIPAgentSelector) {
      host.innerHTML =
        '<div class="ad-error"><strong>Recherche indisponible</strong><span>Recharge la page pour réessayer.</span></div>';
      return;
    }

    window.STIPAgentSelector.mount(host, {
      items: directory?.items || [],
      date: directory?.date,
      kicker: "RECHERCHE RAPIDE",
      title: "Quel agent cherchez-vous ?",
      description: "Nom ou prénom · deux lettres suffisent.",
      onSelect: renderAgent,
    });
  }

  function renderAgent(agent) {
    const telephone = String(agent?.telephone || "");
    const meta = [
      agent?.role || "Agent",
      agent?.ghe ? `GHE ${agent.ghe}` : "",
      agent?.equipe || "",
    ]
      .filter(Boolean)
      .join(" · ");

    root.innerHTML =
      header() +
      `<button type="button" class="ad-list-back" data-ad-list>‹ Rechercher un autre agent</button>
      <section class="ad-agent-card">
        <div class="ad-agent-identity">
          ${avatar(agent)}
          <div>
            <small>FICHE AGENT</small>
            <h2>${esc(name(agent))}</h2>
            <p>${esc(meta)}</p>
          </div>
        </div>

        <section class="ad-now">
          <span>AUJOURD’HUI</span>
          <strong>${esc(statusText(agent))}</strong>
          ${agent?.today_observation
            ? `<small>${esc(agent.today_observation)}</small>`
            : ""}
        </section>

        ${telephone
          ? `<a class="ad-phone" href="tel:${esc(telephone.replace(/\s+/g, ""))}">
              <span>☎</span>
              <div><small>TÉLÉPHONE</small><strong>${esc(telephone)}</strong></div>
              <b>Appeler</b>
            </a>`
          : ""}

        <div class="ad-actions">
          <button type="button" class="primary" data-ad-full>
            <span>Fiche complète</span>
            <small>Planning, informations et outils autorisés</small>
            <b>›</b>
          </button>
          <button type="button" data-ad-planning>
            <span>Planning complet</span>
            <small>Agenda et événements de l’agent</small>
            <b>›</b>
          </button>
        </div>
      </section>`;

    root.querySelector("[data-ad-home]")?.addEventListener("click", () => {
      location.href = "./";
    });
    root.querySelector("[data-ad-list]")?.addEventListener("click", renderDirectory);
    root.querySelector("[data-ad-planning]")?.addEventListener("click", () => {
      if (window.STIPAgentAgenda?.open) {
        window.STIPAgentAgenda.open(agent.source_key, agent);
      } else {
        openFull(agent);
      }
    });
    root.querySelector("[data-ad-full]")?.addEventListener("click", () =>
      openFull(agent),
    );
  }

  async function openFull(agent) {
    const button = root.querySelector("[data-ad-full]");
    button?.classList.add("loading");
    try {
      const result = await call("issue_grant", { agent_id: agent.id });
      if (!result.grant) throw Error("Fiche indisponible.");
      location.href =
        `agent-readonly.html?from=agents#g=${encodeURIComponent(result.grant)}`;
    } catch (error) {
      root.querySelector(".ad-error")?.remove();
      root.querySelector(".ad-agent-card")?.insertAdjacentHTML(
        "beforeend",
        `<div class="ad-error"><strong>Impossible d’ouvrir la fiche</strong><span>${esc(error.message || "Erreur")}</span></div>`,
      );
      button?.classList.remove("loading");
    }
  }

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const host = image.closest?.(".ad-avatar");
      if (host) host.textContent = host.dataset.initials || "ST";
    },
    true,
  );

  (async () => {
    try {
      directory = await call("directory");
      renderDirectory();
    } catch (error) {
      root.innerHTML =
        header() +
        `<div class="ad-error page"><strong>Accès indisponible</strong><span>${esc(error.message || "Erreur")}</span><a href="./">Retour à l’accueil</a></div>`;
      root.querySelector("[data-ad-home]")?.addEventListener("click", () => {
        location.href = "./";
      });
    }
  })();
})();
