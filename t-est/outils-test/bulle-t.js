(() => {
  "use strict";

  function getTLocation() {
    const path = location.pathname.replace(/\/+$/, "");
    if (path.includes("/t-est/accueil")) return { label: "T · ACCUEIL", href: "/t-est/" };
    if (path.includes("/t-est/porte-entree")) return { label: "T · PORTE", href: "/t-est/" };
    return { label: "T · EST", href: "/t-est/porte-entree/" };
  }

  function mountTOnlyBubble() {
    if (document.querySelector("[data-t-est-global-bubble]")) return;
    const current = getTLocation();
    const bubble = document.createElement("a");
    bubble.className = "t-est-global-bubble";
    bubble.dataset.tEstGlobalBubble = "1";
    bubble.href = current.href;
    bubble.setAttribute("aria-label", `Univers T-est — ${current.label}`);
    bubble.setAttribute("title", `Univers T-est — ${current.label}`);
    bubble.innerHTML =
      '<span class="t-est-global-bubble-mark" aria-hidden="true"></span>' +
      `<strong class="t-est-global-bubble-label">${current.label}</strong>`;
    document.body.appendChild(bubble);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mountTOnlyBubble, { once: true });
  else
    mountTOnlyBubble();
})();
