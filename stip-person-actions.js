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
        .slice(0, 12);

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
            const toggle = action.toggle === true,
              checked = action.checked === true,
              cls = [
                "spa-action",
                action.primary ? "primary" : "",
                action.danger ? "danger" : "",
                toggle ? "toggle" : "",
              ].filter(Boolean).join(" "),
              tail = toggle
                ? `<span class="spa-toggle${checked ? " on" : ""}" aria-hidden="true"><i></i></span>`
                : '<em aria-hidden="true">›</em>',
              inner = `<span class="spa-action-icon" aria-hidden="true">${esc(action.icon || "›")}</span><span class="spa-action-copy"><strong>${esc(action.label || "Action")}</strong>${action.detail ? `<small>${esc(action.detail)}</small>` : ""}</span>${tail}`;
            if (action.href)
              return `<a class="${cls}" data-spa-index="${index}" href="${esc(action.href)}">${inner}</a>`;
            return `<button class="${cls}" data-spa-index="${index}" type="button" ${toggle ? `aria-pressed="${checked}"` : ""} ${action.disabled ? "disabled" : ""}>${inner}</button>`;
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
        const shouldClose = action.closeOnSelect !== false && action.toggle !== true;
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


  // Shared menu for all agent cards that previously opened an agenda.
  // "Voir le planning" calls the original planner directly, without recursion.
  function verifiedEmail(a={}) {
    const email=String(a.email||a.mail||a.email_pro||
      a.mail_pro||a.email_professionnel||"").trim();
    return email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:"";
  }
  function verifiedPhone(a={}) {
    const phone=String(a.telephone||a.phone||a.mobile||a.portable||"").trim();
    const digits=phone.replace(/\D/g,"");
    return digits.length>=6&&digits.length<=16?phone:"";
  }
  async function openPlanningFor(agent,sourceKey) {
    const key=String(sourceKey||agent.source_key||"").trim();
    if(!key)return;
    if(!window.STIPAgentAgenda?.openPlanning){
      try { await window.STIPLoad?.script?.("agent-agenda-view.js"); }
      catch(error){console.error("Agent agenda unavailable",error);return;}
    }
    return (window.STIPAgentAgenda?.openPlanning||window.STIPAgentAgenda?.open)?.(key,agent);
  }
  function openForAgent(agent={},options={}) {
    const key=String(options.sourceKey||agent.source_key||"").trim();
    const email=verifiedEmail(agent), phone=verifiedPhone(agent);
    return open({
      agent,contextLabel:options.contextLabel||"COLLÈGUE",
      subtitle:options.subtitle||gheLabel(agent),
      actions:[
        {key:"planning",icon:"📅",label:"Voir le planning",
          detail:"Accéder au planning existant",primary:true,
          disabled:!key&&!options.openPlanning,
          onSelect:()=>options.openPlanning?
            options.openPlanning():openPlanningFor(agent,key)},
        {key:"email",icon:"✉️",label:"Envoyer un mail",
          detail:email||"Adresse e-mail indisponible",
          disabled:!email,
          href:email?"mailto:"+encodeURIComponent(email):""},
        {key:"call",icon:"☎",label:"Appeler",
          detail:phone||"Numéro indisponible",disabled:!phone,
          onSelect:()=>{
            const target={...agent,telephone:phone};
            if(window.STIPAgentSelector?.openCallSheet)
              return window.STIPAgentSelector.openCallSheet(target);
            if(window.STIPDutyChiefs?.openCallChoice)
              return window.STIPDutyChiefs.openCallChoice(phone,name(agent));
            window.location.href="tel:"+phone.replace(/[^\d+]/g,"");
          }},
        ...(Array.isArray(options.additionalActions)?options.additionalActions:[])
      ]
    });
  }

  window.STIPPersonActions = { open, close, openForAgent };
})();
