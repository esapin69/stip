(() => {
  "use strict";
  function mountTOnlyBubble() {
    if (document.querySelector("[data-t-est-global-bubble]")) return;
    const bubble = document.createElement("a");
    bubble.className = "t-est-global-bubble";
    bubble.dataset.tEstGlobalBubble = "1";
    bubble.href = "/t-est/porte-entree/";
    bubble.setAttribute("aria-label", "T-est");
    bubble.innerHTML =
      '<span class="t-est-global-bubble-mark" aria-hidden="true"></span>';
    document.body.appendChild(bubble);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mountTOnlyBubble, { once: true });
  else
    mountTOnlyBubble();
})();
