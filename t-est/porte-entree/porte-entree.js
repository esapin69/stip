(() => {
  "use strict";

  const view = document.getElementById("loginView");
  const shell = view?.querySelector(".t-entry-shell");
  const auth = view?.querySelector(".t-auth-stage");
  const input = document.getElementById("accessCode");
  if (!view || !shell || !auth || !input) return;

  const viewport = window.visualViewport;
  window.addEventListener("stip:login-success", () => {
    location.replace(new URL("./", document.baseURI).href);
  }, { once: true });

  let keyboardOpen = false;
  let baselineHeight = Math.max(
    window.innerHeight || 0,
    viewport?.height || 0,
    document.documentElement.clientHeight || 0
  );

  function visibleHeight() {
    return Math.max(1, Math.round(viewport?.height || window.innerHeight || baselineHeight));
  }

  function refreshBaseline() {
    if (document.activeElement === input) return;
    baselineHeight = Math.max(
      baselineHeight,
      window.innerHeight || 0,
      viewport?.height || 0,
      document.documentElement.clientHeight || 0
    );
  }

  function syncViewport() {
    const vvHeight = visibleHeight();
    const vvTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    view.style.setProperty("--t-vv-height", vvHeight + "px");
    view.style.setProperty("--t-vv-top", vvTop + "px");

    const focused = document.activeElement === input;
    const currentLayoutHeight = Math.max(
      window.innerHeight || 0,
      viewport?.height || 0,
      document.documentElement.clientHeight || 0
    );
    const shrunk = Math.min(vvHeight, currentLayoutHeight) < baselineHeight - 120;
    const next = focused && shrunk;

    if (next !== keyboardOpen) {
      keyboardOpen = next;
      view.classList.toggle("t-keyboard-open", keyboardOpen);
      document.body.classList.toggle("t-entry-keyboard-lock", keyboardOpen);
      if (keyboardOpen) shell.scrollTop = 0;
    }

    if (!focused && !keyboardOpen) refreshBaseline();
  }

  input.addEventListener("focus", () => {
    syncViewport();
    setTimeout(syncViewport, 80);
    setTimeout(syncViewport, 220);
    setTimeout(syncViewport, 420);
  });
  input.addEventListener("blur", () => {
    setTimeout(syncViewport, 80);
    setTimeout(refreshBaseline, 260);
  });
  viewport?.addEventListener("resize", syncViewport);
  viewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", () => {
    baselineHeight = 0;
    setTimeout(() => {
      refreshBaseline();
      syncViewport();
    }, 280);
  });
  window.addEventListener("pageshow", () => {
    refreshBaseline();
    syncViewport();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshBaseline();
      syncViewport();
    }
  });

  refreshBaseline();
  syncViewport();
})();