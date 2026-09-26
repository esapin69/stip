(() => {
  "use strict";

  if (window.STIPFormUX) return;

  const FOCUS = "[data-stip-keyboard-focus]";
  const SCOPE = "[data-stip-keyboard-scope]";
  const LOCK_CLASS = "stip-keyboard-focus-lock";
  const MODE_CLASS = "stip-keyboard-focus-mode";
  const viewport = window.visualViewport;

  let active = null;
  let scope = null;
  let baselineHeight = 0;

  function heightNow() {
    return Math.max(
      1,
      Math.round(
        viewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        1
      )
    );
  }

  function layoutHeight() {
    return Math.max(
      window.innerHeight || 0,
      viewport?.height || 0,
      document.documentElement.clientHeight || 0
    );
  }

  function setMode(open) {
    if (!scope) return;
    scope.classList.toggle(MODE_CLASS, open);
    document.body.classList.toggle(LOCK_CLASS, open);
  }

  function clearMode() {
    setMode(false);
    active = null;
    scope = null;
    baselineHeight = 0;
  }

  function syncKeyboard() {
    if (!active || !scope) return;
    const vvHeight = heightNow();
    const vvTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    scope.style.setProperty("--stip-vv-height", vvHeight + "px");
    scope.style.setProperty("--stip-vv-top", vvTop + "px");

    if (document.activeElement !== active) return;
    const current = Math.min(vvHeight, layoutHeight());
    setMode(current < baselineHeight - 120);
  }

  function focusField(field) {
    active = field;
    scope = field.closest(SCOPE);
    if (!scope) return;
    baselineHeight = Math.max(layoutHeight(), heightNow());
    syncKeyboard();
    setTimeout(syncKeyboard, 80);
    setTimeout(syncKeyboard, 220);
    setTimeout(syncKeyboard, 420);
  }

  function reveal(trigger) {
    const selector = trigger.getAttribute("data-stip-intent-reveal") || "";
    if (!selector) return null;
    let target = null;
    try { target = document.querySelector(selector); } catch {}
    if (!target) return null;

    target.hidden = false;
    target.dataset.stipRevealed = "1";
    trigger.setAttribute("aria-expanded", "true");
    if (trigger.dataset.stipIntentCollapse === "1") trigger.hidden = true;

    requestAnimationFrame(() => {
      const next =
        target.querySelector("[data-stip-autofocus]") ||
        target.querySelector(FOCUS) ||
        target.querySelector("input, textarea, select, button");
      if (!next) return;
      try { next.focus({ preventScroll: true }); } catch { next.focus?.(); }
    });

    window.dispatchEvent(
      new CustomEvent("stip:intent-revealed", {
        detail: { trigger, target }
      })
    );
    return target;
  }

  function resetIntents(root = document) {
    root.querySelectorAll("[data-stip-intent-reveal]").forEach((trigger) => {
      const selector = trigger.getAttribute("data-stip-intent-reveal") || "";
      let target = null;
      try { target = selector ? document.querySelector(selector) : null; } catch {}
      if (target) {
        target.hidden = true;
        delete target.dataset.stipRevealed;
      }
      trigger.hidden = false;
      trigger.setAttribute("aria-expanded", "false");
    });
    clearMode();
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-stip-intent-reveal]");
    if (!trigger) return;
    event.preventDefault();
    reveal(trigger);
  });

  document.addEventListener("focusin", (event) => {
    const field = event.target.closest?.(FOCUS);
    if (field) focusField(field);
  });

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      const next = document.activeElement?.closest?.(FOCUS);
      if (next && next.closest(SCOPE) === scope) {
        active = next;
        syncKeyboard();
        return;
      }
      setTimeout(() => {
        if (!document.activeElement?.closest?.(FOCUS)) clearMode();
      }, 120);
    }, 0);
  });

  viewport?.addEventListener("resize", syncKeyboard);
  viewport?.addEventListener("scroll", syncKeyboard);
  window.addEventListener("resize", syncKeyboard);
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      if (active) {
        baselineHeight = Math.max(layoutHeight(), heightNow());
        syncKeyboard();
      }
    }, 280);
  });
  window.addEventListener("pageshow", syncKeyboard);
  window.addEventListener("stip:session-ended", () => resetIntents());

  window.STIPFormUX = {
    reveal,
    resetIntents,
    syncKeyboard
  };
})();