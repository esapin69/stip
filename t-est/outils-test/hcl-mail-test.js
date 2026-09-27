(() => {
  "use strict";
  const frame = document.querySelector(".t-est-home-frame");
  if (!frame) return;

  const PREVIEW = [
    { from: "expediteur@chu-lyon.fr", subject: "Planning / information professionnelle", meta: "Aperçu de rendu · contenu masqué" },
    { from: "service@chu-lyon.fr", subject: "Information HCL", meta: "Aperçu de rendu · contenu masqué" },
    { from: "equipe@chu-lyon.fr", subject: "Message professionnel", meta: "Aperçu de rendu · contenu masqué" }
  ];

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function markup() {
    return `<section class="t-est-hcl-mail" data-t-est-hcl-mail aria-label="Mails HCL — test">
      <header class="t-est-hcl-mail__head">
        <div class="t-est-hcl-mail__title">
          <span class="t-est-hcl-mail__kicker">T-EST · MAILS PROFESSIONNELS</span>
          <h3>📨 Mails HCL</h3>
        </div>
        <span class="t-est-hcl-mail__badge">TEST</span>
      </header>
      <p class="t-est-hcl-mail__source"><strong>Filtre prévu :</strong> Gmail personnel → uniquement les expéditeurs <b>@chu-lyon.fr</b>.</p>
      <div class="t-est-hcl-mail__list">
        ${PREVIEW.map((mail) => `<div class="t-est-hcl-mail__row" aria-label="Aperçu de mail HCL">
          <span class="t-est-hcl-mail__icon" aria-hidden="true">✉️</span>
          <span class="t-est-hcl-mail__copy">
            <span class="t-est-hcl-mail__from">${esc(mail.from)}</span>
            <span class="t-est-hcl-mail__subject">${esc(mail.subject)}</span>
            <span class="t-est-hcl-mail__meta">${esc(mail.meta)}</span>
          </span>
          <span class="t-est-hcl-mail__chev" aria-hidden="true">›</span>
        </div>`).join("")}
      </div>
      <footer class="t-est-hcl-mail__foot">Prototype visuel uniquement : aucun contenu réel de ta boîte Gmail n’est enregistré dans le dépôt.</footer>
    </section>`;
  }

  function ensure() {
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.querySelector("[data-t-est-hcl-mail]")) return;
      const profile = doc.querySelector(".hc-profile-section");
      if (!profile) return;
      const holder = doc.createElement("div");
      holder.innerHTML = markup();
      const node = holder.firstElementChild;
      profile.insertAdjacentElement("afterend", node);
    } catch {}
  }

  function watch() {
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      ensure();
      const observer = new MutationObserver(() => ensure());
      observer.observe(doc.body, { childList: true, subtree: true });
    } catch {}
  }

  frame.addEventListener("load", () => {
    setTimeout(watch, 120);
    setTimeout(ensure, 650);
  });
  setInterval(ensure, 1800);
})();
