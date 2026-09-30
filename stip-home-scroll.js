(() => {
  "use strict";
  if (window.STIPHomeScrollTop) return;
  window.STIPHomeScrollTop = true;

  function setup() {
    if (document.getElementById("gheBackToTop")) return;
    const button = document.createElement("button");
    button.id = "gheBackToTop";
    button.className = "ghe-back-to-top";
    button.type = "button";
    button.textContent = "↑ Haut";
    button.setAttribute("aria-label", "Revenir en haut de la page");
    button.hidden = true;
    document.body.appendChild(button);

    const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    button.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" })
    );

    let scheduled = false;
    const update = () => {
      scheduled = false;
      const nav = document.querySelector(".hc-home-top-nav[data-header-compact]");
      const modal = document.querySelector('dialog[open],.hc-shift-detail-overlay,.hs-panel[aria-hidden="false"]');
      button.hidden = !(nav && nav.getClientRects().length && window.scrollY > 500 && !modal);
    };
    const request = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    window.addEventListener("stip:home-rendered", request);
    window.addEventListener("stip:route", request);
    update();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
