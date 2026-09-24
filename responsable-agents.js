(() => {
  "use strict";

  const API =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-readonly";
  const STORE = "stip_session_v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const buttons = $$("[data-resp-agents]");
  if (!buttons.length) return;

  let directory = null;
  let mode = "directory";

  function errorText(error) {
    if (!error) return "Erreur inconnue";
    if (typeof error === "string") return error;
    if (
      typeof error.message === "string" &&
      error.message !== "[object Object]"
    )
      return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return "Erreur inconnue";
    }
  }

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
      throw Error(
        typeof raw === "string" ? raw : raw?.message || JSON.stringify(raw),
      );
    }
    return data;
  }

  function isBrancardier(agent) {
    return (
      !/^chef/i.test(String(agent.type_planning || agent.equipe || "")) &&
      !/chef|cadre/i.test(String(agent.role || ""))
    );
  }

  function displayName(agent) {
    return window.STIPAgentSelector?.name(agent) || "Agent";
  }

  function initials(agent) {
    const parts = displayName(agent).trim().split(/\s+/).filter(Boolean);
    return (
      `${parts[0]?.[0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase() || "ST"
    );
  }

  function avatar(agent, big = false) {
    const url = String(agent.profile_photo_url || window.STIPBootCache?.media?.avatars?.[agent.source_key] || agent.avatar_signed_url || agent.avatar_url || "");
    const value = esc(initials(agent));
    return `<span class="ra-avatar${big ? " big" : ""}" data-initials="${value}">${/^https?:/i.test(url) ? `<img src="${esc(url)}" alt="" loading="lazy">` : value}</span>`;
  }

  document.addEventListener("error", (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const host = img.closest?.(".ra-avatar");
    if (!host) return;
    host.textContent = host.dataset.initials || "ST";
  }, true);

  function renderSelector() {
    const body = $("#respPanelBody");
    if (!body || !directory) return;
    const all = (directory.items || []).filter(isBrancardier);
    const evaluation = mode === "evaluation";
    $("#respPanelTitle").textContent = evaluation
      ? "Évaluation"
      : "Équipe";
    body.innerHTML =
      '<main class="ra-day"><div id="respAgentSelector"></div></main>';
    if (!window.STIPAgentSelector) {
      $("#respAgentSelector").innerHTML =
        '<div class="ra-error"><b>Sélecteur indisponible</b><span>Recharge la page pour réessayer.</span></div>';
      return;
    }
    window.STIPAgentSelector.mount($("#respAgentSelector"), {
      items: all,
      date: directory.date,
      kicker: evaluation ? "ÉVALUATION 2026" : "ÉQUIPE · AUJOURD’HUI",
      title: evaluation ? "Choisir un agent" : "Équipe",
      description: evaluation
        ? "Recherche un agent pour ouvrir ou commencer son évaluation."
        : "Tri par GHE, appel direct, horaires particuliers et absences détaillées pour l’encadrement.",
      privacy: "full",
      showPhone: true,
      onSelect: evaluation ? openEvaluation : openAgentAgenda,
    });
  }

  async function openAgentAgenda(agent) {
    window.STIPNav?.remember?.({
      panelKind: "agents",
      agentMode: mode,
      agentId: agent.id,
    });
    if (window.STIPAgentAgenda?.open) {
      window.STIPAgentAgenda.open(agent.source_key, agent);
      return;
    }
    openAgent(agent);
  }

  async function openEvaluation(agent) {
    const body = $("#respPanelBody");
    body.innerHTML = `<div class="ra-load"><i></i><b>Ouverture de l’évaluation de ${esc(displayName(agent))}…</b></div>`;
    try {
      await GHEBase.openAgentEvaluation(agent.id);
    } catch (error) {
      body.innerHTML = `<div class="ra-error"><b>Impossible d’ouvrir l’évaluation</b><span>${esc(errorText(error))}</span><button type="button" id="raBackList">Retour à la liste</button></div>`;
      $("#raBackList")?.addEventListener("click", renderSelector);
    }
  }

  function openAgent(agent) {
    window.STIPNav?.remember?.({
      panelKind: "agents",
      agentMode: mode,
      agentId: agent.id,
    });
    $("#respPanelTitle").textContent = displayName(agent);
    const code = String(agent.today_code || "").toUpperCase() || "—";
    const meta = [agent.role, agent.ghe ? `GHE ${agent.ghe}` : "", code]
      .filter(Boolean)
      .join(" · ");
    $("#respPanelBody").innerHTML =
      `<main class="ra-profile"><button type="button" id="raBackList" class="ra-profile-back">‹ Retour à l’équipe</button><section class="ra-hero">${avatar(agent, true)}<div><span class="ra-kicker">FICHE AGENT</span><h2>${esc(displayName(agent))}</h2><p>${esc(meta)}</p></div></section><section class="ra-actions"><button type="button" id="raOpenAgenda">Planning complet</button><button type="button" id="raOpenProfile">Fiche agent</button><button type="button" id="raOpenEval">Évaluation</button></section><p class="ra-hint">La fiche et l’évaluation utilisent le même agent et le même identifiant.</p><div id="raActionStatus"></div></main>`;
    $("#raBackList")?.addEventListener("click", renderSelector);
    $("#raOpenAgenda")?.addEventListener("click", () =>
      window.STIPAgentAgenda?.open?.(agent.source_key, agent),
    );
    $("#raOpenEval")?.addEventListener("click", () => openEvaluation(agent));
    $("#raOpenProfile")?.addEventListener("click", () => openReadonly(agent));
  }

  async function openReadonly(agent) {
    const status = $("#raActionStatus");
    if (status) status.textContent = "Ouverture de la fiche…";
    try {
      const result = await call("issue_grant", { agent_id: agent.id });
      if (!result.grant) throw Error("Laissez-passer indisponible.");
      const url = `agent-readonly.html#g=${encodeURIComponent(result.grant)}`;
      if (window.STIPNav) window.STIPNav.go(url);
      else location.href = url;
    } catch (error) {
      if (status)
        status.innerHTML = `<div class="ra-error"><b>Impossible d’ouvrir la fiche</b><span>${esc(errorText(error))}</span></div>`;
    }
  }

  async function openPanel(trigger) {
    mode = trigger?.dataset?.respAgents || "directory";
    const savedBeforeOpen = window.STIPNav?.read?.() || {};
    const restoringAgent =
      savedBeforeOpen.panelKind === "agents" &&
      savedBeforeOpen.agentMode === mode
        ? savedBeforeOpen.agentId
        : "";
    window.STIPNav?.remember?.({
      panelKind: "agents",
      agentMode: mode,
      agentId: restoringAgent,
    });
    const panel = $("#respPanel");
    panel.classList.add("open", "ra-native-panel");
    panel.setAttribute("aria-hidden", "false");
    $("#respPanelTitle").textContent =
      mode === "evaluation" ? "Évaluation" : "Équipe";
    $("#respPanelBody").innerHTML =
      `<div class="ra-load"><i></i><b>${mode === "evaluation" ? "Chargement des agents…" : "Lecture de l’équipe du jour…"}</b></div>`;
    try {
      directory = await call("directory");
      renderSelector();
      const selected = (directory.items || []).find(
        (agent) => String(agent.id) === String(restoringAgent || ""),
      );
      if (selected) {
        if (mode === "evaluation") openEvaluation(selected);
        else openAgentAgenda(selected);
      }
    } catch (error) {
      $("#respPanelBody").innerHTML =
        `<div class="ra-error"><b>Impossible de charger les agents</b><span>${esc(errorText(error))}</span></div>`;
    }
  }

  buttons.forEach((button) =>
    button.addEventListener("click", () => openPanel(button)),
  );
})();
