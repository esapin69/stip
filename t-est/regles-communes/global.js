/* STIP native-field baseline, 2026-10-14.
   Navigation, scrolling and keyboard positioning belong to the browser.
   This file deliberately does not listen to input focus, resize or Enter. */
(() => {
  "use strict";

  // Request that supported mobile browsers resize the layout for the keyboard,
  // without manual viewport calculations, scroll positions or focus.
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta && !/interactive-widget\s*=/.test(meta.content || "")) {
    meta.content = [String(meta.content || "").replace(/,\s*$/, ""), "interactive-widget=resizes-content"].filter(Boolean).join(",");
  }

  // Overlay history is an independent business/navigation feature.
  if (!window.STIPOverlayNavigationReady) {
    window.STIPOverlayNavigationReady = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/stip-overlay-navigation.js?v=20260930-safari-overlay-history1";
      script.async = false;
      script.onload = () => resolve(window.STIPOverlayNav || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  if (window.STIPFormUX) return;
  const intentSelector = "[data-stip-intent-reveal]";
  const pinSelector = "input[data-stip-pin-field],input[inputmode='numeric'][maxlength='6']";

  function formMode(form) {
    return String(form?.getAttribute?.("data-stip-form-mode") || "native").trim().toLowerCase();
  }

  function isPin(field) {
    if (!field?.matches?.("input")) return false;
    if (field.hasAttribute("data-stip-pin-field")) return true;
    const name = [field.id, field.name].join(" ").toLowerCase();
    return field.maxLength === 6 && field.inputMode === "numeric" && /code|pin|access/.test(name);
  }

  function normalizePin(field) {
    if (!isPin(field) || formMode(field.form) === "exempt") return;
    field.dataset.stipPinField = "1";
    field.type = "text";
    field.setAttribute("inputmode", "numeric");
    field.setAttribute("autocomplete", "off");
    if (!field.hasAttribute("pattern")) field.setAttribute("pattern", "[0-9]{6}");
    if (field.dataset.stipPinBound === "1") return;
    field.dataset.stipPinBound = "1";
    field.addEventListener("input", () => {
      const digits = String(field.value || "").replace(/\D/g, "").slice(0, 6);
      if (field.value !== digits) field.value = digits;
    });
  }

  function inferAutocomplete(field) {
    const key = [field.id, field.name].join("_").replace(/([a-z])([A-Z])/g, "$1_$2")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/first_name|given_name|prenom/.test(key)) return "given-name";
    if (/last_name|family_name|surname|nom/.test(key)) return "family-name";
    if (/email|courriel/.test(key) || field.type === "email") return "email";
    if (/telephone|phone|mobile/.test(key) || field.type === "tel") return "tel";
    return "";
  }

  function normalizeAutofill(root = document) {
    const elements = [];
    if (root?.matches?.("input,textarea,select")) elements.push(root);
    root?.querySelectorAll?.("input,textarea,select").forEach((field) => elements.push(field));
    elements.forEach((field) => {
      if (formMode(field.form || field.closest("form")) === "exempt") return;
      normalizePin(field);
      // Respect explicit browser autocomplete settings and HTML field order.
      if (field.hasAttribute("autocomplete") || !field.matches("input")) return;
      const token = inferAutocomplete(field);
      if (token) field.setAttribute("autocomplete", token);
    });
    return root;
  }

  function bindPinToggles(root = document) {
    const buttons = [];
    if (root?.matches?.("[data-stip-pin-toggle]")) buttons.push(root);
    root?.querySelectorAll?.("[data-stip-pin-toggle]").forEach((b) => buttons.push(b));
    buttons.forEach((button) => {
      if (button.dataset.stipPinToggleBound === "1") return;
      const selector = String(button.dataset.stipPinToggle || "").trim();
      let field = null;
      try { if (selector) field = document.querySelector(selector); } catch {}
      if (!field) field = button.closest("label,form,div")?.querySelector(pinSelector);
      if (!field) return;
      normalizePin(field);
      button.dataset.stipPinToggleBound = "1";
      const sync = () => {
        const revealed = field.dataset.stipPinRevealed === "1";
        button.textContent = revealed ? (button.dataset.stipPinHideLabel || "Masquer") : (button.dataset.stipPinShowLabel || "Voir");
        button.setAttribute("aria-pressed", String(revealed));
      };
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (field.dataset.stipPinRevealed === "1") delete field.dataset.stipPinRevealed;
        else field.dataset.stipPinRevealed = "1";
        sync();
      });
      sync();
    });
  }

  function autoEnroll(root = document) {
    normalizeAutofill(root);
    bindPinToggles(root);
    // All inputs, selects, textareas and content-editable areas retain
    // native browser keyboard, focus, selection, Tab and Enter behavior.
    return root;
  }

  function fields(form) {
    return [...(form?.querySelectorAll?.("input,textarea,select") || [])].filter((field) => {
      if (field.disabled || field.readOnly || ["hidden", "submit", "button", "reset", "image"].includes(field.type)) return false;
      return !field.closest('[hidden],.hidden,[aria-hidden="true"],[inert]');
    });
  }

  function collapseIntent(trigger, target, options = {}) {
    if (!trigger || !target) return false;
    target.hidden = true;
    delete target.dataset.stipRevealed;
    trigger.hidden = false;
    trigger.setAttribute("aria-expanded", "false");
    if (options.focus === true) trigger.focus();
    window.dispatchEvent(new CustomEvent("stip:intent-collapsed", { detail: { trigger, target } }));
    return true;
  }

  function reveal(trigger) {
    const selector = trigger?.getAttribute?.("data-stip-intent-reveal");
    let target = null;
    try { if (selector) target = document.querySelector(selector); } catch {}
    if (!target) return null;
    target.hidden = false;
    target.dataset.stipRevealed = "1";
    trigger.setAttribute("aria-expanded", "true");
    if (trigger.dataset.stipIntentCollapse === "1") {
      trigger.hidden = true;
      if (!target.querySelector(".stip-intent-back-action")) {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "stip-intent-back-action";
        back.textContent = "← Retour";
        back.addEventListener("click", () => collapseIntent(trigger, target));
        target.appendChild(back);
      }
    }
    // Deliberately do not focus a field or open the keyboard here.
    window.dispatchEvent(new CustomEvent("stip:intent-revealed", { detail: { trigger, target } }));
    return target;
  }

  function resetIntents(root = document) {
    root.querySelectorAll?.(intentSelector).forEach((trigger) => {
      let target = null;
      try { target = document.querySelector(trigger.getAttribute("data-stip-intent-reveal")); } catch {}
      if (target) collapseIntent(trigger, target);
    });
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.(intentSelector);
    if (!trigger) return;
    event.preventDefault();
    reveal(trigger);
  });

  window.addEventListener("stip:session-ended", () => resetIntents());
  autoEnroll();
  new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node?.nodeType === 1) autoEnroll(node);
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Compatibility entrypoints: no global keyboard or scrolling intervention.
  window.STIPFormUX = {
    reveal,
    resetIntents,
    syncKeyboard() {},
    transferFocus(field) { if (!field) return false; field.focus(); return true; },
    release() {},
    exit() {},
    enter() {},
    showOverview() {},
    autoEnroll,
    normalizeAutofill,
    fields,
    formMode,
    version: 29,
    inputMode: "native"
  };
})();
