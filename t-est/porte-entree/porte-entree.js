(() => {
  "use strict";

  const view = document.getElementById("loginView");
  const shell = view?.querySelector(".t-entry-shell");
  const auth = view?.querySelector(".t-auth-stage");
  const input = document.getElementById("accessCode");
  if (!view || !shell || !auth || !input) return;

  const viewport = window.visualViewport;
  let keyboardOpen = false;

  function syncViewport() {
    const vvHeight = Math.max(1, Math.round(viewport?.height || window.innerHeight));
    const vvTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    view.style.setProperty("--t-vv-height", vvHeight + "px");
    view.style.setProperty("--t-vv-top", vvTop + "px");

    const focused = document.activeElement === input;
    const shrunk = viewport ? viewport.height < window.innerHeight - 120 : false;
    const next = focused && shrunk;

    if (next !== keyboardOpen) {
      keyboardOpen = next;
      view.classList.toggle("t-keyboard-open", keyboardOpen);
      document.body.classList.toggle("t-entry-keyboard-lock", keyboardOpen);
      if (keyboardOpen) shell.scrollTop = 0;
    }
  }

  input.addEventListener("focus", () => {
    syncViewport();
    setTimeout(syncViewport, 80);
    setTimeout(syncViewport, 220);
  });
  input.addEventListener("blur", () => {
    setTimeout(syncViewport, 80);
  });
  viewport?.addEventListener("resize", syncViewport);
  viewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);
  window.addEventListener("pageshow", syncViewport);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncViewport();
  });

  syncViewport();
})();
