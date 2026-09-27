(() => {
  "use strict";
  function mountHomePreviewLink() {
    if (document.querySelector("[data-t-est-home-preview]")) return;
    const host = document.querySelector("#loginView .t-entry-shell") || document.body;
    const link = document.createElement("a");
    link.href = "/t-est/accueil/";
    link.dataset.tEstHomePreview = "1";
    link.textContent = "Ouvrir l’accueil T-est";
    link.className = "t-est-home-preview-link";
    host.appendChild(link);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountHomePreviewLink, { once:true });
  else mountHomePreviewLink();
})();
