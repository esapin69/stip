(() => {
  "use strict";

  let overlay = null;
  let keyHandler = null;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  function name(agent = {}) {
    return (
      window.STIPAgentSelector?.name?.(agent) ||
      window.STIPName?.format?.(agent) ||
      [agent.prenom, agent.nom].filter(Boolean).join(" ") ||
      "Agent"
    );
  }

  function initials(agent = {}) {
    return (
      window.STIPAgentSelector?.initials?.(agent) ||
      String(name(agent))
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0] || "")
        .join("")
        .toUpperCase() ||
      "ST"
    );
  }

  function photoUrl(agent = {}) {
    return String(
      window.STIPAgentSelector?.photoUrl?.(agent) ||
        agent.profile_photo_url ||
        window.STIPBootCache?.media?.avatars?.[agent.source_key] ||
        agent.avatar_signed_url ||
        agent.avatar_url ||
        "",
    );
  }

  function gheLabel(agent = {}) {
    if (window.STIPAgentSelector?.gheLabel)
      return window.STIPAgentSelector.gheLabel(agent);
    const raw = String(agent.ghe || "").replace(/^GHE\s*/i, "").trim();
    const match = raw.match(/\d+/);
    return match ? `GHE ${Number(match[0])}` : raw ? "AUTRE GHE" : "SANS GHE";
  }

  function close() {
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
    overlay?.remove();
    overlay = null;
    document.documentElement.classList.remove("spa-open");
  }

  function portrait(agent) {
    const url = photoUrl(agent),
      fallback = esc(initials(agent)),
      photo = /^https?:/i.test(url)
        ? `<img src="${esc(url)}" alt="" loading="lazy">`
        : fallback;
    return `<span class="spa-portrait" aria-hidden="true">
      <span class="spa-photo" data-initials="${fallback}">${photo}</span>
      <span class="spa-ghe">${esc(gheLabel(agent))}</span>
    </span>`;
  }

  function open(rawOptions = {}) {
    close();
    const agent = rawOptions.agent || {},
      actions = (Array.isArray(rawOptions.actions) ? rawOptions.actions : [])
        .filter((action) => action && action.visible !== false && action.hidden !== true)
        .slice(0, 5);

    if (!actions.length) return null;

    overlay = document.createElement("div");
    overlay.id = "stipPersonActions";
    overlay.className = "spa-overlay";
    overlay.innerHTML = `
      <button class="spa-backdrop" type="button" aria-label="Fermer"></button>
      <section class="spa-sheet" role="dialog" aria-modal="true" aria-label="Actions pour ${esc(name(agent))}">
        <div class="spa-handle" aria-hidden="true"></div>
        <header class="spa-head">
          ${portrait(agent)}
          <div class="spa-identity">
            <small>${esc(rawOptions.contextLabel || "AGENT")}</small>
            <strong>${esc(name(agent))}</strong>
            <span>${esc(rawOptions.subtitle || gheLabel(agent))}</span>
          </div>
          <button class="spa-close" type="button" aria-label="Fermer">×</button>
        </header>
        <div class="spa-actions">
          ${actions.map((action, index) => {
            const cls = [
              "spa-action",
              action.primary ? "primary" : "",
              action.danger ? "danger" : "",
            ].filter(Boolean).join(" ");
            const inner = `<span class="spa-action-icon" aria-hidden="true">${esc(action.icon || "›")}</span><span class="spa-action-copy"><strong>${esc(action.label || "Action")}</strong>${action.detail ? `<small>${esc(action.detail)}</small>` : ""}</span><em aria-hidden="true">›</em>`;
            if (action.href)
              return `<a class="${cls}" data-spa-index="${index}" href="${esc(action.href)}">${inner}</a>`;
            return `<button class="${cls}" data-spa-index="${index}" type="button" ${action.disabled ? "disabled" : ""}>${inner}</button>`;
          }).join("")}
        </div>
        <button class="spa-cancel" type="button">Annuler</button>
      </section>`;

    document.body.appendChild(overlay);
    document.documentElement.classList.add("spa-open");

    overlay.querySelector(".spa-backdrop")?.addEventListener("click", close);
    overlay.querySelector(".spa-close")?.addEventListener("click", close);
    overlay.querySelector(".spa-cancel")?.addEventListener("click", close);
    overlay.querySelector(".spa-photo img")?.addEventListener("error", (event) => {
      const host = event.currentTarget.parentElement;
      if (host) host.textContent = host.dataset.initials || "ST";
    }, { once: true });

    overlay.querySelectorAll("[data-spa-index]").forEach((control) => {
      control.addEventListener("click", (event) => {
        const action = actions[Number(control.dataset.spaIndex)];
        if (!action || action.disabled) {
          event.preventDefault();
          return;
        }
        if (action.href) {
          setTimeout(close, 180);
          action.onSelect?.(agent, action);
          return;
        }
        event.preventDefault();
        const shouldClose = action.closeOnSelect !== false;
        if (shouldClose) close();
        Promise.resolve(action.onSelect?.(agent, action)).catch((error) => {
          console.error("STIPPersonActions", error);
        });
      });
    });

    keyHandler = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", keyHandler);

    return { close, element: overlay };
  }

  window.STIPPersonActions = { open, close };
})();
