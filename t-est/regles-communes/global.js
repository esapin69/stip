(() => {
  "use strict";

  if (window.STIPFormUX) return;

  const FOCUS = "[data-stip-keyboard-focus]";
  const SCOPE = "[data-stip-keyboard-scope]";
  const FORM_FOCUS = "[data-stip-form-focus]";
  const INTENT = "[data-stip-intent-reveal]";
  const NEXT_ACTION = ".stip-keyboard-next-action";
  const QUESTION_CLASS = "stip-keyboard-question";
  const WRITABLE_SELECTOR = [
    'input:not([type])',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="url"]',
    'input[type="password"]',
    'input[type="number"]',
    'textarea'
  ].join(",");
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

  function entryScreenLocked() {
    const entry = document.querySelector("#loginView.t-entry-screen:not(.hidden)");
    if (!entry) return false;
    const dialog = entry.querySelector("#accessRequestDialog");
    if (dialog?.open) return false;
    return true;
  }

  /* Hard stop for the public entry screen. CSS overflow alone is not enough on
     mobile Chrome because the root visual viewport/browser chrome can still react
     to a vertical pan. The entry screen has no vertical navigation, so consume
     that gesture at the document boundary. Forms/dialogs are explicitly exempt. */
  document.addEventListener(
    "touchmove",
    (event) => {
      if (!entryScreenLocked()) return;
      event.preventDefault();
    },
    { passive: false, capture: true }
  );

  document.addEventListener(
    "wheel",
    (event) => {
      if (!entryScreenLocked()) return;
      event.preventDefault();
    },
    { passive: false, capture: true }
  );

  function pinEntryScroll() {
    if (!entryScreenLocked()) return;
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  window.addEventListener("scroll", pinEntryScroll, { passive: true });
  viewport?.addEventListener("scroll", pinEntryScroll, { passive: true });

  function visualHeight() {
    return Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
  }

  function layoutHeight() {
    return Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || viewport?.height || 1));
  }

  function measureFullHeight() {
    return Math.max(visualHeight(), layoutHeight(), Math.round(document.documentElement.clientHeight || 0));
  }

  function updateStableHeight() {
    if (active || modeOpen) return;
    stableHeight = measureFullHeight();
  }

  function captureBaseline() {
    pendingBaseline = Math.max(stableHeight || 0, measureFullHeight());
  }

  function scheduleSync(delay) {
    const timer = setTimeout(() => { timers.delete(timer); syncKeyboard(); }, delay);
    timers.add(timer);
  }

  function clearScheduled() { timers.forEach((timer) => clearTimeout(timer)); timers.clear(); }
  function formFor(field) { return field?.closest?.(FORM_FOCUS) || field?.closest?.("form") || null; }

  function clearFormPath(root = scope) {
    root?.querySelectorAll?.(".stip-keyboard-path").forEach((node) => node.classList.remove("stip-keyboard-path"));
    root?.querySelectorAll?.("." + QUESTION_CLASS).forEach((node) => {
      if (node.dataset.stipGeneratedQuestion === "1") node.remove();
      else node.classList.remove(QUESTION_CLASS);
    });
    const action = root?.querySelector?.(NEXT_ACTION);
    if (action) action.hidden = true;
  }

  function writableField(field) {
    return !!field?.matches?.(WRITABLE_SELECTOR);
  }

  function fieldRole(field) {
    if (!writableField(field)) return "other";
    if (field.matches('[data-stip-keyboard-native],[data-stip-keyboard-exempt]') || field.closest('[data-stip-keyboard-native],[data-stip-keyboard-exempt]')) return "native";
    if (field.matches('input[type="search"]')) return "search";
    return field.closest("form") ? "form" : "native";
  }

  function questionText(field) {
    const explicit = field.dataset.stipQuestion?.trim?.();
    if (explicit) return explicit;
    const label = field.labels?.[0] || field.closest?.("label");
    if (label) {
      const clone = label.cloneNode(true);
      clone.querySelectorAll("input,textarea,select,button").forEach((node) => node.remove());
      const text = clone.textContent?.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    return (
      field.getAttribute("aria-label") ||
      field.getAttribute("placeholder") ||
      field.getAttribute("name") ||
      "Votre réponse"
    ).trim();
  }

  function ensureQuestion(field, form) {
    const label = field.labels?.[0] || field.closest?.("label");
    if (label && form?.contains(label)) {
      label.classList.add(QUESTION_CLASS);
      return label;
    }
    let question = form?.querySelector?.(':scope > [data-stip-generated-question="1"]');
    if (!question && form) {
      question = document.createElement("div");
      question.className = QUESTION_CLASS;
      question.dataset.stipGeneratedQuestion = "1";
      form.prepend(question);
    }
    if (question) question.textContent = questionText(field);
    return question;
  }

  function syncFormHints(form) {
    const fields = usableFields(form);
    const submit = form?.querySelector?.('button[type="submit"],input[type="submit"]');
    fields.forEach((field, index) => {
      if (field.tagName === "TEXTAREA" || field.hasAttribute("enterkeyhint")) return;
      field.setAttribute("enterkeyhint", index < fields.length - 1 ? "next" : submit ? "done" : "next");
    });
  }

  function enrollField(field) {
    if (!writableField(field) || field.matches(FOCUS)) return;
    const role = fieldRole(field);
    field.dataset.stipKeyboardRole = role;
    if (role !== "form") return;
    const form = field.closest("form");
    if (!form) return;
    field.setAttribute("data-stip-keyboard-focus", "");
    form.setAttribute("data-stip-keyboard-scope", "");
    form.setAttribute("data-stip-form-focus", "");
    syncFormHints(form);
  }

  function autoEnroll(root = document) {
    const fields = [];
    if (root?.matches?.(WRITABLE_SELECTOR)) fields.push(root);
    root?.querySelectorAll?.(WRITABLE_SELECTOR).forEach((field) => fields.push(field));
    fields.forEach(enrollField);
    const forms = new Set(fields.map((field) => field.closest?.("form")).filter(Boolean));
    forms.forEach(syncFormHints);
  }

  function usableFields(form) {
    return [...(form?.querySelectorAll?.(FOCUS) || [])].filter((field) => !field.disabled && field.type !== "hidden" && !field.closest("[hidden]"));
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
    ensureQuestion(field, form);
    let node = field;
    while (node && node !== root) { node.classList.add("stip-keyboard-path"); node = node.parentElement; }
    const fields = usableFields(form);
    const index = fields.indexOf(field);
    if (index < 0) return;
    let action = form.querySelector(NEXT_ACTION);
    if (!action) { action = document.createElement("button"); action.type = "button"; action.className = "stip-keyboard-next-action"; form.appendChild(action); }
    const next = fields[index + 1] || null;
    const submit = form.querySelector('button[type="submit"]');
    const label = next ? "Suivant" : submitLabel(submit);
    action.hidden = false;
    action.textContent = label + "  →";
    action.setAttribute("aria-label", label);
    action.onclick = () => {
      if (typeof field.reportValidity === "function" && !field.reportValidity()) return;
      if (next) { try { next.focus({ preventScroll: true }); } catch { next.focus?.(); } return; }
      if (typeof form.requestSubmit === "function") form.requestSubmit(submit || undefined); else submit?.click();
    };
  }

  function setDialogMode(root, open) { root?.closest?.("dialog")?.classList.toggle("stip-keyboard-dialog-mode", Boolean(open)); }
  function setMode(open) {
    if (!scope) return;
    modeOpen = Boolean(open);
    scope.classList.toggle(MODE_CLASS, modeOpen);
    setDialogMode(scope, modeOpen);
    document.body.classList.toggle(LOCK_CLASS, modeOpen);
    const action = scope.querySelector?.(NEXT_ACTION);
    if (modeOpen) prepareFormPath(active, scope); else if (action) action.hidden = true;
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
      const retained = focused && scope.contains(focused) && (focused.matches?.(NEXT_ACTION) || focused.closest?.("[data-stip-keyboard-keep]"));
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
    const continuingSameFlow = !changingScope && scope === nextScope && Boolean(active) && (modeOpen || keyboardDetected());
    if (changingScope) {
      clearFormPath(previousScope); previousScope.classList.remove(MODE_CLASS); setDialogMode(previousScope, false);
      previousScope.style.removeProperty("--stip-vv-height"); previousScope.style.removeProperty("--stip-vv-top"); modeOpen = false;
    }
    scope = nextScope; active = field;
    const preserveKeyboard = options.preserveKeyboard === true;
    if (preserveKeyboard && previousBaseline) { baselineHeight = previousBaseline; pendingBaseline = previousBaseline; }
    else if (!continuingSameFlow || !baselineHeight) baselineHeight = Math.max(pendingBaseline || 0, stableHeight || 0, measureFullHeight());
    pendingBaseline = 0;
    prepareFormPath(field, scope);
    if (preserveKeyboard && previousModeOpen) { modeOpen = true; scope.classList.add(MODE_CLASS); setDialogMode(scope, true); document.body.classList.add(LOCK_CLASS); }
    syncKeyboard(); scheduleSync(60); scheduleSync(160); scheduleSync(320);
  }

  function clearMode() {
    clearScheduled(); clearFormPath(scope);
    if (scope) { scope.classList.remove(MODE_CLASS); setDialogMode(scope, false); scope.style.removeProperty("--stip-vv-height"); scope.style.removeProperty("--stip-vv-top"); }
    document.body.classList.remove(LOCK_CLASS); active = null; scope = null; baselineHeight = 0; pendingBaseline = 0; modeOpen = false;
    setTimeout(updateStableHeight, 80);
  }

  function reveal(trigger) {
    const selector = trigger.getAttribute("data-stip-intent-reveal") || "";
    if (!selector) return null;
    let target = null; try { target = document.querySelector(selector); } catch {}
    if (!target) return null;
    captureBaseline(); target.hidden = false; target.dataset.stipRevealed = "1"; trigger.setAttribute("aria-expanded", "true");
    if (trigger.dataset.stipIntentCollapse === "1") trigger.hidden = true;
    requestAnimationFrame(() => {
      const next = target.querySelector("[data-stip-autofocus]") || target.querySelector(FOCUS) || target.querySelector("input, textarea, select, button");
      if (!next) return;
      try { next.focus({ preventScroll: true }); } catch { next.focus?.(); }
    });
    window.dispatchEvent(new CustomEvent("stip:intent-revealed", { detail: { trigger, target } }));
    return target;
  }

  function resetIntents(root = document) {
    root.querySelectorAll(INTENT).forEach((trigger) => {
      const selector = trigger.getAttribute("data-stip-intent-reveal") || "";
      let target = null; try { target = selector ? document.querySelector(selector) : null; } catch {}
      if (target) { target.hidden = true; delete target.dataset.stipRevealed; }
      trigger.hidden = false; trigger.setAttribute("aria-expanded", "false");
    });
    clearMode(); pinEntryScroll();
  }

  document.addEventListener("pointerdown", (event) => { if (event.target.closest?.(FOCUS) || event.target.closest?.(INTENT)) captureBaseline(); }, true);
  document.addEventListener("click", (event) => { const trigger = event.target.closest?.(INTENT); if (!trigger) return; event.preventDefault(); reveal(trigger); });
  document.addEventListener("focusin", (event) => { const field = event.target.closest?.(FOCUS); if (field) focusField(field); });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    const field = event.target.closest?.(FOCUS);
    if (!field || field.tagName === "TEXTAREA") return;
    const form = formFor(field);
    if (!form?.matches?.(FORM_FOCUS)) return;
    event.preventDefault();
    if (typeof field.reportValidity === "function" && !field.reportValidity()) return;
    const fields = usableFields(form);
    const index = fields.indexOf(field);
    const next = index >= 0 ? fields[index + 1] : null;
    if (next) {
      transferFocus(next);
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (typeof form.requestSubmit === "function") form.requestSubmit(submit || undefined);
    else submit?.click();
  }, true);
  document.documentElement.dataset.stipEnterManaged = "1";

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      const focused = document.activeElement; const nextField = focused?.closest?.(FOCUS);
      if (nextField && nextField.closest(SCOPE) === scope) { active = nextField; prepareFormPath(nextField, scope); syncKeyboard(); return; }
      if (focused && scope?.contains?.(focused) && (focused.matches?.(NEXT_ACTION) || focused.closest?.("[data-stip-keyboard-keep]"))) return;
      setTimeout(() => {
        const current = document.activeElement;
        if (current?.closest?.(FOCUS)) return;
        if (current && scope?.contains?.(current) && (current.matches?.(NEXT_ACTION) || current.closest?.("[data-stip-keyboard-keep]"))) return;
        clearMode();
      }, 160);
    }, 0);
  });

  viewport?.addEventListener("resize", () => { if (active) syncKeyboard(); else { updateStableHeight(); pinEntryScroll(); } });
  viewport?.addEventListener("scroll", () => { if (active) syncKeyboard(); else pinEntryScroll(); });
  window.addEventListener("resize", () => { if (active) syncKeyboard(); else { updateStableHeight(); pinEntryScroll(); } });
  window.addEventListener("orientationchange", () => { clearScheduled(); setTimeout(() => { if (active) { baselineHeight = Math.max(measureFullHeight(), stableHeight || 0); syncKeyboard(); } else { stableHeight = measureFullHeight(); pinEntryScroll(); } }, 320); });
  window.addEventListener("pageshow", () => { if (active) syncKeyboard(); else { updateStableHeight(); pinEntryScroll(); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) return; if (active) syncKeyboard(); else { updateStableHeight(); pinEntryScroll(); } });
  window.addEventListener("stip:session-ended", () => resetIntents());

  function transferFocus(field) {
    if (!field) return false;
    const preserved = baselineHeight || pendingBaseline || stableHeight || measureFullHeight(); pendingBaseline = preserved;
    try { field.focus({ preventScroll: true }); } catch { field.focus?.(); }
    if (document.activeElement === field) { focusField(field, { preserveKeyboard: true }); return true; }
    return false;
  }

  autoEnroll(document);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) autoEnroll(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  pinEntryScroll();
  window.STIPFormUX = { reveal, resetIntents, syncKeyboard, transferFocus, release: clearMode, autoEnroll, version: 7 };
})();