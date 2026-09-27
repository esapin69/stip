(() => {
  "use strict";

  const ACTION_API =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions";
  const DIRECTORY_API =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-readonly";
  const STORE = "stip_session_v1";
  const $ = (selector) => document.querySelector(selector);

  let selected = null;
  let directory = [];
  let directoryPromise = null;

  function errorText(error) {
    if (!error) return "Service indisponible.";
    if (typeof error === "string") return error;
    if (typeof error.message === "string" && error.message !== "[object Object]")
      return error.message;
    return "Service indisponible.";
  }

  async function call(url, action, body = {}) {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": localStorage.getItem(STORE) || "",
      },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error)
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : data.error?.message || `Erreur ${response.status}`,
      );
    return data;
  }

  function agentName(agent) {
    return (
      window.STIPAgentSelector?.name?.(agent) ||
      window.GHEBase?.displayName?.(agent) ||
      [agent?.prenom, agent?.nom].filter(Boolean).join(" ") ||
      "Agent"
    );
  }

  function setDirectoryStatus(message = "", error = false) {
    const node = $("#requestAgentLoadStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", Boolean(error));
  }

  function syncSelectedAgent() {
    const form = $("#form");
    const id = $("#agentId");
    const name = $("#requestAgentName");
    const meta = $("#requestAgentMeta");
    if (id) id.value = selected?.id || "";

    if (selected) {
      const display = agentName(selected);
      if (name) name.textContent = display;
      if (meta)
        meta.textContent = [selected.role, selected.ghe ? `GHE ${selected.ghe}` : ""]
          .filter(Boolean)
          .join(" · ") || "Agent sélectionné";
      if (form) form.dataset.stipContextWho = display;
      setDirectoryStatus("Agent sélectionné.");
    } else {
      if (name) name.textContent = "Choisir un agent";
      if (meta) meta.textContent = "Rechercher par prénom, nom ou GHE";
      if (form) delete form.dataset.stipContextWho;
    }
    window.STIPFormUX?.autoEnroll?.(form);
  }

  async function loadDirectory(force = false) {
    if (directory.length && !force) return directory;
    if (directoryPromise && !force) return directoryPromise;

    setDirectoryStatus("Chargement de l’annuaire…");
    directoryPromise = call(DIRECTORY_API, "directory")
      .then((data) => {
        directory = Array.isArray(data.items) ? data.items : [];
        if (data.shift_definitions)
          window.STIPShiftRegistry?.set?.(data.shift_definitions);
        setDirectoryStatus(
          directory.length
            ? `${directory.length} agent${directory.length > 1 ? "s" : ""} disponible${directory.length > 1 ? "s" : ""}.`
            : "Aucun agent disponible.",
          !directory.length,
        );
        return directory;
      })
      .catch((error) => {
        directory = [];
        setDirectoryStatus(
          `Annuaire indisponible · touche « Choisir un agent » pour réessayer. ${errorText(error)}`,
          true,
        );
        throw error;
      })
      .finally(() => {
        directoryPromise = null;
      });

    return directoryPromise;
  }

  async function openAgentPicker() {
    try {
      const items = await loadDirectory(!directory.length);
      if (!window.STIPAgentSelector?.openPicker)
        throw new Error("Sélecteur d’agents indisponible.");

      window.STIPAgentSelector.openPicker({
        items,
        selectedId: selected?.id || "",
        filter: "first",
        title: "Rechercher un agent",
        placeholder: "Nom ou prénom",
        privacy: "full",
        showPhone: false,
        showStatus: false,
        autoFocus: false,
        onSelect(agent) {
          selected = agent;
          syncSelectedAgent();
          requestAnimationFrame(() =>
            $("#form")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }),
          );
        },
      });
    } catch (error) {
      setDirectoryStatus(errorText(error), true);
    }
  }

  function syncMode() {
    const kind = $("#kind");
    const form = $("#form");
    const notification = kind?.value === "notification";

    $("#modeNote").textContent = notification
      ? "Ce message va dans la cloche de l’agent. Il ne crée aucune tâche dans son carousel."
      : "Cette demande apparaîtra sur l’accueil de l’agent tant qu’elle n’est pas traitée.";
    $("#priorityLabel").hidden = notification;
    $("#sendBtn").textContent = notification
      ? "Envoyer la notification"
      : "Envoyer dans STIP";

    if (form)
      form.dataset.stipContextWhy =
        kind?.selectedOptions?.[0]?.textContent?.trim() || "Demande";
    window.STIPFormUX?.autoEnroll?.(form);
  }

  async function submit(event) {
    event.preventDefault();
    const status = $("#status");
    const targetId = $("#agentId")?.value || "";
    const notification = $("#kind")?.value === "notification";

    if (!targetId) {
      status.textContent = "Choisis d’abord l’agent destinataire.";
      await openAgentPicker();
      return;
    }

    const title = $("#title")?.value.trim() || "";
    if (!title) {
      status.textContent = "Le titre est obligatoire.";
      $("#title")?.focus();
      return;
    }

    status.textContent = "Envoi…";
    try {
      if (notification) {
        await call(ACTION_API, "send_notification", {
          target_agent_id: targetId,
          title,
          body: $("#body")?.value.trim() || "",
        });
      } else {
        await call(ACTION_API, "create", {
          target_agent_id: targetId,
          kind: $("#kind")?.value || "request",
          title,
          body: $("#body")?.value.trim() || "",
          priority: Number($("#priority")?.value || 50),
        });
      }
      status.textContent = notification
        ? "Notification envoyée."
        : "Demande envoyée. Elle reste visible sur l’accueil de l’agent jusqu’à son traitement.";
      $("#title").value = "";
      $("#body").value = "";
    } catch (error) {
      status.textContent = errorText(error);
    }
  }

  $("#requestAgentPicker")?.addEventListener("click", openAgentPicker);
  $("#kind")?.addEventListener("change", syncMode);
  $("#form")?.addEventListener("submit", submit);

  syncMode();
  syncSelectedAgent();
  loadDirectory().catch(() => {});
})();
