(() => {
  "use strict";
  const BUTTON = "ghe-leisure-quick";
  // Bouton supprimé de l’en-tête ; le dialogue reste accessible depuis ➕.
  function install() {document.querySelectorAll("[data-ghe-leisure-quick]").forEach(button=>button.remove());}
  function show() {
    if (!document.querySelector("#homeView .ghe-home-topbar") || !localStorage.getItem("stip_session_v1")) return;
    const existing = document.getElementById("gheLeisureQuickDialog");
    if (existing?.open) return;
    existing?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "gheLeisureQuickDialog";
    dialog.className = "ghe-leisure-quick-dialog";
    dialog.setAttribute("aria-labelledby", "gheLeisureQuickTitle");
    dialog.innerHTML = '<section class="ghe-leisure-quick-sheet">' +
      '<header><div><small>ENTRE COLLÈGUES</small><h2 id="gheLeisureQuickTitle">Proposer une sortie</h2></div>' +
      '<button type="button" data-leisure-dismiss aria-label="Fermer">×</button></header>' +
      '<div class="ghe-leisure-quick-choices">' +
      '<button type="button" data-leisure-schedule="afterwork"><span aria-hidden="true">🕔</span>' +
      '<span><strong>Après le travail</strong><small>Choisir mes dates et les fins de mes shifts.</small></span><b aria-hidden="true">›</b></button>' +
      '<button type="button" data-leisure-schedule="fixed"><span aria-hidden="true">🎉</span>' +
      '<span><strong>À un autre moment</strong><small>Sport, repas ou sortie à l’heure de mon choix.</small></span><b aria-hidden="true">›</b></button>' +
      '</div></section>';
    const close = () => dialog.open ? dialog.close() : dialog.remove();
    dialog.addEventListener("click", event => {
      if (event.target === dialog || event.target.closest("[data-leisure-dismiss]")) { close(); return; }
      const button = event.target.closest("[data-leisure-schedule]");
      if (!button) return;
      const mode = button.dataset.leisureSchedule === "fixed" ? "fixed" : "afterwork";
      close();
      const destination = "sorties-loisirs.html?tab=create&schedule=" + mode;
      if (window.STIPLoad?.navigateDocument) window.STIPLoad.navigateDocument(destination);
      else location.assign(new URL(destination, document.baseURI).href);
    });
    dialog.addEventListener("close", () => dialog.remove(), { once:true });
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-ghe-leisure-quick]")) show();
  });
  window.GHELeisureQuick={show};
  window.addEventListener("stip:home-rendered", install);
  window.addEventListener("pageshow", install);
  window.addEventListener("stip:session-ended", () => document.getElementById("gheLeisureQuickDialog")?.close());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
  else install();
})();
