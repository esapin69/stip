(() => {
  "use strict";

  const current = (() => {
    const file = (location.pathname.split("/").pop() || "").toLowerCase();
    if (file === "esprit-equipe.html") return "team";
    if (file === "responsable.html") return "responsable";
    return "";
  })();

  if (!current || document.getElementById("stipSharedPageHeader")) return;

  const go = (target) => {
    const url = new URL(target, document.baseURI);
    location.assign(url.pathname + url.search + url.hash);
  };

  function todayHeader() {
    const date = new Date();
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric"
      }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value])
    );
    return `<div class="hc-home-today-separator stip-section-separator" aria-label="${[parts.weekday,parts.day,parts.month,parts.year].join(" ")}">
      <span class="hc-home-today-label"><span>${parts.weekday.toLocaleUpperCase("fr-FR")}</span><b class="hc-home-today-day">${parts.day}</b><span>${parts.month.toLocaleUpperCase("fr-FR")}</span></span>
    </div>`;
  }

  const host = document.createElement("div");
  host.id = "stipSharedPageHeader";
  host.className = "stip-page-header-host";
  host.innerHTML = `
    <section class="hc-home-top-nav hc-home-top-nav-3" data-header-compact aria-label="Navigation GHE">
      <div class="hc-home-top-tools">
        <button type="button" class="hc-profile-bell" data-shared-page="notifications" aria-label="Notifications"><span aria-hidden="true">🔔</span></button>
        <div class="hc-home-wheelchair-slot">
          <button type="button" class="hc-wheelchair-shortcut" data-shared-page="tableau" aria-label="Ouvrir Fauteuils">
            <span class="hc-wheelchair-shortcut-icon"><img src="images/icone_app/home-access-wheelchairs.webp?v=20260923-wheelchair-left-badge2" alt="" aria-hidden="true"></span>
            <span class="hc-wheelchair-shortcut-copy"><strong>Fauteuils</strong></span>
            <span class="hc-wheelchair-shortcut-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <div class="hc-home-meta-date hc-calendar-driven-planning">${todayHeader()}</div>
      <div class="hc-home-identity" id="stipSharedIdentity"></div>
      <nav class="hc-home-filters" data-count="3" aria-label="Accueil GHE">
        <button type="button" data-shared-page="apps" aria-label="Applications">
          <span class="hc-home-filter-art"><img src="images/icone_app/home-access-applications.webp?v=20260922-topimages3" alt="" aria-hidden="true"></span>
          <strong>Applications</strong>
        </button>
        <button type="button" data-shared-page="planning" aria-label="Mon espace">
          <span class="hc-home-filter-art"><img src="images/icone_app/home-access-personal.webp?v=20260922-topimages3" alt="" aria-hidden="true"></span>
          <strong>Mon espace</strong>
        </button>
        <button type="button" data-shared-page="team" aria-label="Esprit d’équipe" class="${current === "team" ? "active" : ""}" aria-pressed="${current === "team"}">
          <span class="hc-home-filter-art"><img src="images/icone_app/esprit-equipe.webp?v=20260921-team1" alt="" aria-hidden="true"></span>
          <strong>Esprit d’équipe</strong>
        </button>
      </nav>
    </section>`;

  function renderSharedIdentity(snapshot = window.STIPContinuity?.read?.()) {
    const agent = snapshot?.agent || snapshot?.session?.agent || window.STIPSession?.agent || {};
    const card = window.STIPPersonCard?.render?.({
      agent, self: false, compact: true, label: "MON PROFIL"
    }) || '<span class="hc-home-identity-fallback">Accéder à mon espace</span>';
    const identity = host.querySelector("#stipSharedIdentity");
    if (identity) identity.innerHTML =
      '<a href="index.html#/home" class="hc-home-identity-link" aria-label="Accéder à mon espace">' +
        card + '</a>';
  }
  document.body.prepend(host);
  renderSharedIdentity();
  window.addEventListener("stip:session-snapshot", (event) => renderSharedIdentity(event.detail));
  document.body.classList.add("stip-page-header-native");

  if (current === "team") {
    document.querySelector(".team-top")?.setAttribute("hidden", "");
  }

  host.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-shared-page]");
    if (!button) return;
    const target = button.dataset.sharedPage || "";
    if (target === "team") {
      if (current !== "team") go("esprit-equipe.html?entry=shared-header");
      return;
    }
    if (target === "apps") return go("index.html#/apps");
    if (target === "planning") return go("index.html#/home");
    if (target === "notifications") return go("index.html?quick=notifications");
    if (target === "tableau") return go("index.html?quick=tableau");
  });
})();