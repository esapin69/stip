(() => {
  "use strict";

  if (window.STIPFormUX) return;

  const FOCUS = "[data-stip-keyboard-focus]";
  const SCOPE = "[data-stip-keyboard-scope]";
  const FORM_FOCUS = "[data-stip-form-focus]";
  const INTENT = "[data-stip-intent-reveal]";
  const NEXT_ACTION = ".stip-keyboard-next-action";
  const LOCK_CLASS = "stip-keyboard-focus-lock";
  const MODE_CLASS = "stip-keyboard-focus-mode";
  const viewport = window.visualViewport;

  let active = null;
  let scope = null;
  let baselineHeight = 0;
  let pendingBaseline = 0;
  let modeOpen = false;
  let stableHeight = measureFullHeight();
  const timers = new Set();

  function visualHeight() {
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
      1,
      Math.round(
        window.innerHeight ||
        document.documentElement.clientHeight ||
        viewport?.height ||
        1
      )
    );
  }

  function measureFullHeight() {
    return Math.max(
      visualHeight(),
      layoutHeight(),
      Math.round(document.documentElement.clientHeight || 0)
    );
  }

  function updateStableHeight() {
    if (active || modeOpen) return;
    stableHeight = measureFullHeight();
  }

  function captureBaseline() {
    pendingBaseline = Math.max(stableHeight || 0, measureFullHeight());
  }

  function scheduleSync(delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      syncKeyboard();
    }, delay);
    timers.add(timer);
  }

  function clearScheduled() {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  }

  function formFor(field) {
    return field?.closest?.(FORM_FOCUS) || field?.closest?.("form") || null;
  }

  function clearFormPath(root = scope) {
    root?.querySelectorAll?.(".stip-keyboard-path").forEach((node) => {
      node.classList.remove("stip-keyboard-path");
    });
    const action = root?.querySelector?.(NEXT_ACTION);
    if (action) action.hidden = true;
  }

  function usableFields(form) {
    return [...(form?.querySelectorAll?.(FOCUS) || [])].filter((field) => {
      if (field.disabled || field.type === "hidden") return false;
      if (field.closest("[hidden]")) return false;
      return true;
    });
  }

  function submitLabel(submit) {
    const explicit = submit?.dataset?.stipKeyboardLabel?.trim?.();
    if (explicit) return explicit;
    const span = submit?.querySelector?.("span")?.textContent?.trim?.();
    if (span) return span.replace(/[→›»]+\s*$/, "").trim();
    const text = submit?.textContent?.trim?.() || "";
    return text.replace(/[→›»]+\s*$/, "").trim() || "Continuer";
  }

  function prepareFormPath(field, root = scope) {
    const form = formFor(field);
    if (!form?.matches?.(FORM_FOCUS)) return;

    clearFormPath(root);

    let node = field;
    while (node && node !== root) {
      node.classList.add("stip-keyboard-path");
      node = node.parentElement;
    }

    const fields = usableFields(form);
    const index = fields.indexOf(field);
    if (index < 0) return;

    let action = form.querySelector(NEXT_ACTION);
    if (!action) {
      action = document.createElement("button");
      action.type = "button";
      action.className = "stip-keyboard-next-action";
      form.appendChild(action);
    }

    const next = fields[index + 1] || null;
    const submit = form.querySelector('button[type="submit"]');
    const label = next ? "Suivant" : submitLabel(submit);

    action.hidden = false;
    action.textContent = label + "  →";
    action.setAttribute("aria-label", label);

    action.onclick = () => {
      if (typeof field.reportValidity === "function" && !field.reportValidity()) {
        return;
      }
      if (next) {
        try {
          next.focus({ preventScroll: true });
        } catch {
          next.focus?.();
        }
        return;
      }
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit(submit || undefined);
      } else {
        submit?.click();
      }
    };
  }

  function setDialogMode(root, open) {
    root?.closest?.("dialog")?.classList.toggle(
      "stip-keyboard-dialog-mode",
      Boolean(open)
    );
  }

  function setMode(open) {
    if (!scope) return;
    modeOpen = Boolean(open);
    scope.classList.toggle(MODE_CLASS, modeOpen);
    setDialogMode(scope, modeOpen);
    document.body.classList.toggle(LOCK_CLASS, modeOpen);

    const action = scope.querySelector?.(NEXT_ACTION);
    if (modeOpen) {
      prepareFormPath(active, scope);
    } else if (action) {
      action.hidden = true;
    }
  }

  function keyboardDetected() {
    if (!baselineHeight) return false;
    const current = Math.min(visualHeight(), layoutHeight());
    const threshold = Math.max(96, Math.round(baselineHeight * 0.12));
    return baselineHeight - current > threshold;
  }

  function syncKeyboard() {
    if (!active || !scope) return;

    const vvHeight = visualHeight();
    const vvTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    scope.style.setProperty("--stip-vv-height", vvHeight + "px");
    scope.style.setProperty("--stip-vv-top", vvTop + "px");

    const focused = document.activeElement;
    if (focused !== active) {
      const retained =
        focused &&
        scope.contains(focused) &&
        (focused.matches?.(NEXT_ACTION) ||
          focused.closest?.("[data-stip-keyboard-keep]"));
      if (retained) return;
      return;
    }

    setMode(keyboardDetected());
  }

  function focusField(field, options = {}) {
    const nextScope = field?.closest?.(SCOPE);
    if (!nextScope) return;

    const previousScope = scope;
    const previousBaseline = baselineHeight;
    const previousModeOpen = modeOpen;
    const changingScope = previousScope && previousScope !== nextScope;
    const continuingSameFlow =
      !changingScope &&
      scope === nextScope &&
      Boolean(active) &&
      (modeOpen || keyboardDetected());

    if (changingScope) {
      clearFormPath(previousScope);
      previousScope.classList.remove(MODE_CLASS);
      setDialogMode(previousScope, false);
      previousScope.style.removeProperty("--stip-vv-height");
      previousScope.style.removeProperty("--stip-vv-top");
      modeOpen = false;
    }

    scope = nextScope;
    active = field;

    const preserveKeyboard = options.preserveKeyboard === true;
    if (preserveKeyboard && previousBaseline) {
      baselineHeight = previousBaseline;
      pendingBaseline = previousBaseline;
    } else if (!continuingSameFlow || !baselineHeight) {
      baselineHeight = Math.max(
        pendingBaseline || 0,
        stableHeight || 0,
        measureFullHeight()
      );
    }
    pendingBaseline = 0;

    prepareFormPath(field, scope);

    if (preserveKeyboard && previousModeOpen) {
      modeOpen = true;
      scope.classList.add(MODE_CLASS);
      setDialogMode(scope, true);
      document.body.classList.add(LOCK_CLASS);
    }

    syncKeyboard();
    scheduleSync(60);
    scheduleSync(160);
    scheduleSync(320);
  }

  function clearMode() {
    clearScheduled();
    clearFormPath(scope);
    if (scope) {
      scope.classList.remove(MODE_CLASS);
      setDialogMode(scope, false);
      scope.style.removeProperty("--stip-vv-height");
      scope.style.removeProperty("--stip-vv-top");
    }
    document.body.classList.remove(LOCK_CLASS);
    active = null;
    scope = null;
    baselineHeight = 0;
    pendingBaseline = 0;
    modeOpen = false;
    setTimeout(updateStableHeight, 80);
  }

  function reveal(trigger) {
    const selector = trigger.getAttribute("data-stip-intent-reveal") || "";
    if (!selector) return null;

    let target = null;
    try {
      target = document.querySelector(selector);
    } catch {}
    if (!target) return null;

    captureBaseline();
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
      try {
        next.focus({ preventScroll: true });
      } catch {
        next.focus?.();
      }
    });

    window.dispatchEvent(
      new CustomEvent("stip:intent-revealed", {
        detail: { trigger, target }
      })
    );
    return target;
  }

  function resetIntents(root = document) {
    root.querySelectorAll(INTENT).forEach((trigger) => {
      const selector = trigger.getAttribute("data-stip-intent-reveal") || "";
      let target = null;
      try {
        target = selector ? document.querySelector(selector) : null;
      } catch {}
      if (target) {
        target.hidden = true;
        delete target.dataset.stipRevealed;
      }
      trigger.hidden = false;
      trigger.setAttribute("aria-expanded", "false");
    });
    clearMode();
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target.closest?.(FOCUS) || event.target.closest?.(INTENT)) {
        captureBaseline();
      }
    },
    true
  );

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.(INTENT);
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
      const focused = document.activeElement;
      const nextField = focused?.closest?.(FOCUS);

      if (nextField && nextField.closest(SCOPE) === scope) {
        active = nextField;
        prepareFormPath(nextField, scope);
        syncKeyboard();
        return;
      }

      if (
        focused &&
        scope?.contains?.(focused) &&
        (focused.matches?.(NEXT_ACTION) ||
          focused.closest?.("[data-stip-keyboard-keep]"))
      ) {
        return;
      }

      setTimeout(() => {
        const current = document.activeElement;
        if (current?.closest?.(FOCUS)) return;
        if (
          current &&
          scope?.contains?.(current) &&
          (current.matches?.(NEXT_ACTION) ||
            current.closest?.("[data-stip-keyboard-keep]"))
        ) {
          return;
        }
        clearMode();
      }, 160);
    }, 0);
  });

  viewport?.addEventListener("resize", () => {
    if (active) syncKeyboard();
    else updateStableHeight();
  });
  viewport?.addEventListener("scroll", () => {
    if (active) syncKeyboard();
  });
  window.addEventListener("resize", () => {
    if (active) syncKeyboard();
    else updateStableHeight();
  });
  window.addEventListener("orientationchange", () => {
    clearScheduled();
    setTimeout(() => {
      if (active) {
        baselineHeight = Math.max(measureFullHeight(), stableHeight || 0);
        syncKeyboard();
      } else {
        stableHeight = measureFullHeight();
      }
    }, 320);
  });
  window.addEventListener("pageshow", () => {
    if (active) syncKeyboard();
    else updateStableHeight();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (active) syncKeyboard();
    else updateStableHeight();
  });
  window.addEventListener("stip:session-ended", () => resetIntents());

  function transferFocus(field) {
    if (!field) return false;
    const preserved = baselineHeight || pendingBaseline || stableHeight || measureFullHeight();
    pendingBaseline = preserved;
    try {
      field.focus({ preventScroll: true });
    } catch {
      field.focus?.();
    }
    if (document.activeElement === field) {
      focusField(field, { preserveKeyboard: true });
      return true;
    }
    return false;
  }

  window.STIPFormUX = {
    reveal,
    resetIntents,
    syncKeyboard,
    transferFocus,
    version: 4
  };
})();