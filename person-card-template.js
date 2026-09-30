(function personCardModule() {
  "use strict";

  if (window.STIPPersonCard) return;

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

  const cap = (value) => {
    const text = String(value || "").trim().toLocaleLowerCase("fr-FR");
    return text ? text[0].toLocaleUpperCase("fr-FR") + text.slice(1) : "";
  };

  function currentAgent() {
    const session = window.STIPSession?.agent || {};
    const boot = window.STIPBootCache?.agent || {};
    return {
      ...boot,
      ...session,
      profile_photo_url:
        session.profile_photo_url || boot.profile_photo_url || "",
    };
  }

  function photoUrl(agent = {}, media = {}) {
    return String(
      window.STIPAgentSelector?.photoUrl?.(agent) ||
        agent.profile_photo_url ||
        media?.avatars?.[agent.source_key] ||
        window.STIPBootCache?.media?.avatars?.[agent.source_key] ||
        agent.avatar_signed_url ||
        agent.avatar_url ||
        "",
    );
  }

  function initials(agent = {}) {
    return (
      `${String(agent.prenom || "").trim()[0] || ""}${String(agent.nom || "").trim()[0] || ""}`.toUpperCase() ||
      "ST"
    );
  }

  function fullName(agent = {}) {
    const first = cap(agent.prenom),
      last = cap(agent.nom);
    return [first, last].filter(Boolean).join(" ") || "Utilisateur";
  }

  function phoneValue(agent = {}) {
    return String(
      agent.telephone || agent.phone || agent.mobile || agent.portable || "",
    ).trim();
  }

  function phoneHref(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let normalized = raw.replace(/[^0-9+]/g, "");
    if (normalized.startsWith("00")) normalized = "+" + normalized.slice(2);
    if (!normalized) return "";
    return "tel:" + normalized;
  }

  function secondary(agent = {}) {
    const role = String(
        agent.role_metier || agent.role || agent.metier || "",
      ).trim(),
      team = String(agent.equipe || agent.type_planning || "").trim(),
      gheRaw = String(agent.ghe || "").trim(),
      ghe = gheRaw
        ? gheRaw.toUpperCase().startsWith("GHE")
          ? gheRaw.toUpperCase()
          : `GHE ${gheRaw}`
        : "";

    return [
      role,
      team && !role.toLowerCase().includes(team.toLowerCase()) ? team : "",
      ghe,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function render(rawOptions = {}) {
    const options = rawOptions || {},
      agent = options.agent || currentAgent(),
      media = options.media || window.STIPBootCache?.media || {},
      self = options.self !== false,
      compact = options.compact !== false,
      label = String(options.label || (self ? "MON PROFIL" : "PERSONNE")).trim(),
      image = photoUrl(agent, media),
      ini = initials(agent),
      name = fullName(agent),
      sub = String(options.subtitle || secondary(agent)).trim(),
      phone = phoneValue(agent),
      phoneLink = phoneHref(phone),
      rootClasses = [
        "stip-person-card",
        compact ? "is-compact" : "",
        self ? "is-self hc-id-card" : "",
      ]
        .filter(Boolean)
        .join(" "),
      avatarClasses = [
        "stip-person-card-avatar",
        self ? "hc-avatar" : "",
      ]
        .filter(Boolean)
        .join(" ");

    return `<section class="${rootClasses}" data-stip-person-card data-stip-person-self="${self ? "1" : "0"}" aria-label="${esc(label)}">
      <div class="${avatarClasses}" data-avatar-fallback="${esc(ini)}">
        ${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : `<span>${esc(ini)}</span>`}
      </div>
      <div class="stip-person-card-copy">
        <small>${esc(label)}</small>
        <strong>${esc(name)}</strong>
        ${sub ? `<span>${esc(sub)}</span>` : ""}
        ${phone ? `<a class="stip-person-card-phone" href="${esc(phoneLink)}" aria-label="Appeler ${esc(name)}">☎ ${esc(phone)}</a>` : ""}
      </div>
      ${self ? '<span class="stip-person-card-menu-hint" aria-hidden="true">•••</span>' : ""}
    </section>`;
  }

  function renderCurrent(options = {}) {
    return render({
      ...options,
      agent: currentAgent(),
      media: window.STIPBootCache?.media || {},
      self: true,
    });
  }

  function mount(target, options = {}) {
    const host =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!host) return false;
    host.innerHTML = render(options);
    return true;
  }

  window.STIPPersonCard = {
    render,
    renderCurrent,
    mount,
    currentAgent,
  };

  const style = document.createElement("style");
  style.dataset.stipPersonCardStyle = "1";
  style.textContent = `
    .stip-person-card{position:relative;display:grid;grid-template-columns:64px minmax(0,1fr) 24px;gap:11px;align-items:center;min-height:76px;padding:9px 10px;border:1px solid #dbe8eb;border-radius:19px;background:#fff;box-shadow:0 7px 19px rgba(21,67,82,.055);color:#153a4a}
    .stip-person-card.is-compact{margin-top:10px}
    .stip-person-card-avatar{width:64px;height:64px;border-radius:16px;overflow:hidden;display:grid;place-items:center;background:#eef5f7}
    .stip-person-card-avatar img{width:100%;height:100%;object-fit:cover;object-position:center}
    .stip-person-card-avatar>span{font-weight:950;font-size:1rem}
    .stip-person-card-copy{min-width:0;display:grid;gap:2px}
    .stip-person-card-copy small{color:#168297;font-size:.58rem;font-weight:950;letter-spacing:.09em}
    .stip-person-card-copy strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1rem;line-height:1.15}
    .stip-person-card-copy>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#70858d;font-size:.69rem;font-weight:760}
    .stip-person-card-phone{width:max-content;max-width:100%;color:#2c737c;font-size:.69rem;font-weight:900;line-height:1.18;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .stip-person-card-phone:focus-visible{outline:3px solid rgba(10,145,170,.22);outline-offset:2px;border-radius:6px}
    .stip-person-card-menu-hint{justify-self:end;color:#8aa0a8;font-size:.78rem;font-weight:950;letter-spacing:.02em}
    .stip-person-card.is-self .stip-person-card-avatar{cursor:pointer;-webkit-tap-highlight-color:transparent}
    .stip-person-card.is-self .stip-person-card-avatar:focus-visible{outline:3px solid rgba(10,145,170,.28);outline-offset:3px}
    @media(max-width:380px){
      .stip-person-card{grid-template-columns:58px minmax(0,1fr) 20px;gap:9px;min-height:70px;padding:8px 9px}
      .stip-person-card-avatar{width:58px;height:58px;border-radius:15px}
    }
  `;
  document.head.appendChild(style);
})();