(() => {
  "use strict";
  const currentScript = document.currentScript;
  const tEstRoot = currentScript?.src
    ? new URL("../", currentScript.src)
    : new URL("/t-est/", location.origin);

  function mountGlobalT() {
    if (document.querySelector("[data-t-est-global-bubble]")) return;
    const bubble = document.createElement("a");
    bubble.className = "t-est-global-bubble";
    bubble.dataset.tEstGlobalBubble = "1";
    bubble.href = new URL("porte-entree/", tEstRoot).href;
    bubble.setAttribute("aria-label", "T-est");
    bubble.innerHTML =
      '<span class="t-est-global-bubble-mark" aria-hidden="true"></span>';
    document.body.appendChild(bubble);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mountGlobalT, { once: true });
  else
    mountGlobalT();
})();
