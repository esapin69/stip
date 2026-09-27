(() => {
  "use strict";

  if (window.STIPFormUX) return;

  const FOCUS = "[data-stip-keyboard-focus]";
  const SCOPE = "[data-stip-keyboard-scope]";
  const FORM_FOCUS = "[data-stip-form-focus]";
  const INTENT = "[data-stip-intent-reveal]";
  const NEXT_ACTION = ".stip-keyboard-next-action";
  const PREV_ACTION = ".stip-keyboard-prev-action";
  const OVERVIEW_ACTION = ".stip-keyboard-overview-action";
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

  const AUTOFILL_CONTEXT_CLASS = "stip-autofill-context";
  const PROFILE_AUTOFILL_TOKENS = new Set([
    "name",
    "given-name",
    "family-name",
    "email",
    "tel",
    "organization",
    "street-address",
    "postal-code",
    "address-level1",
    "address-level2",
    "country-name"
  ]);

  function fieldIdentityKey(field) {
    return [field?.name, field?.id, field?.dataset?.stipField]
      .filter(Boolean)
      .join("_")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
  }

  function explicitAutocompleteToken(field) {
    const value = String(field?.getAttribute?.("autocomplete") || "").trim().toLowerCase();
    if (!value || value === "on" || value === "off") return "";
    const parts = value.split(/\s+/);
    return parts[parts.length - 1] || "";
  }

  function inferredAutocompleteToken(field) {
    const key = fieldIdentityKey(field);
    if (/(^|_)(first_name|given_name|given|prenom)(_|$)/.test(key)) return "given-name";
    if (/(^|_)(last_name|family_name|surname|nom)(_|$)/.test(key)) return "family-name";
    if (/(^|_)(full_name|display_name|fullname)(_|$)/.test(key)) return "name";
    if (/(^|_)(email|mail|courriel)(_|$)/.test(key) || field?.type === "email") return "email";
    if (/(^|_)(phone|telephone|tel|mobile)(_|$)/.test(key) || field?.type === "tel") return "tel";
    if (/(^|_)(organization|organisation|company|entreprise|workplace|employer)(_|$)/.test(key)) return "organization";
    if (/(^|_)(postal_code|postcode|zip)(_|$)/.test(key)) return "postal-code";
    return "";
  }

  function autocompleteSection(field) {
    const form = field?.form || field?.closest?.("form");
    const raw = String(form?.id || form?.getAttribute?.("name") || "stip");
    const key = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "stip";
    return "section-" + key;
  }

  function normalizeAutofillField(field) {
    if (!field?.matches?.("input,textarea,select")) return "";
    const inferred = inferredAutocompleteToken(field);
    const explicit = explicitAutocompleteToken(field);
    if (inferred && (!explicit || PROFILE_AUTOFILL_TOKENS.has(explicit))) {
      const semantic = autocompleteSection(field) + " " + inferred;
      if (String(field.getAttribute("autocomplete") || "").trim().toLowerCase() !== semantic)
        field.setAttribute("autocomplete", semantic);
      if ((inferred === "given-name" || inferred === "family-name" || inferred === "name") && !field.hasAttribute("autocapitalize"))
        field.setAttribute("autocapitalize", "words");
      if ((inferred === "given-name" || inferred === "family-name" || inferred === "name") && !field.hasAttribute("type"))
        field.setAttribute("type", "text");
      return inferred;
    }
    return explicit || inferred;
  }

  function normalizeIdentityDomOrder(form) {
    if (!form) return;
    const controls = [...form.querySelectorAll("input,textarea,select")];
    const family = controls.find((field) => normalizeAutofillField(field) === "family-name");
    const given = controls.find((field) => normalizeAutofillField(field) === "given-name");
    if (!family || !given) return;
    const familyWrap = family.closest("label") || family;
    const givenWrap = given.closest("label") || given;
    if (!familyWrap.parentElement || familyWrap.parentElement !== givenWrap.parentElement) return;
    const siblings = [...familyWrap.parentElement.children];
    if (siblings.indexOf(familyWrap) > siblings.indexOf(givenWrap))
      familyWrap.parentElement.insertBefore(familyWrap, givenWrap);
  }

  function markAutofillContext(form) {
    if (!form) return;
    form.querySelectorAll("input,textarea,select").forEach((field) => {
      const token = normalizeAutofillField(field);
      if (!PROFILE_AUTOFILL_TOKENS.has(token)) return;
      let node = field;
      while (node && node !== form) {
        node.classList?.add?.(AUTOFILL_CONTEXT_CLASS);
        node = node.parentElement;
      }
    });
  }

  function normalizeAutofill(root = document) {
    const forms = new Set();
    if (root?.matches?.("form")) forms.add(root);
    const owner = root?.closest?.("form");
    if (owner) forms.add(owner);
    root?.querySelectorAll?.("form").forEach((form) => forms.add(form));
    forms.forEach((form) => {
      if (!form.hasAttribute("autocomplete")) form.setAttribute("autocomplete", "on");
      form.querySelectorAll("input,textarea,select").forEach(normalizeAutofillField);
      normalizeIdentityDomOrder(form);
      markAutofillContext(form);
    });
    return forms;
  }

  function identityOrdered(controls) {
    const ordered = [...controls];
    const familyIndex = ordered.findIndex((field) => normalizeAutofillField(field) === "family-name");
    const givenIndex = ordered.findIndex((field) => normalizeAutofillField(field) === "given-name");
    if (familyIndex >= 0 && givenIndex >= 0 && givenIndex < familyIndex) {
      const [family] = ordered.splice(familyIndex, 1);
      ordered.splice(givenIndex, 0, family);
    }
    return ordered;
  }

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

  /* L'entrée reste visuellement fixe, mais on ne consomme jamais le pan vertical :
     le navigateur doit garder la main pour son pull-to-refresh natif. */
  function pinEntryScroll() {
    if (!entryScreenLocked()) return;
    if (window.scrollX !== 0 || window.scrollY > 0) {
      window.scrollTo({ left: 0, top: 0, behavior: "auto" });
    }
  }

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
    const previous = root?.querySelector?.(PREV_ACTION);
    if (previous) previous.hidden = true;
    const overview = root?.querySelector?.(OVERVIEW_ACTION);
    if (overview) overview.hidden = true;
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
    const submit = form?.querySelector?.('button[type="submit"],input[type="submit"],[data-stip-keyboard-action]');
    fields.forEach((field, index) => {
      if (field.tagName === "TEXTAREA" || field.hasAttribute("enterkeyhint")) return;
      field.setAttribute("enterkeyhint", index < fields.length - 1 ? "next" : submit ? "done" : "next");
    });
  }

  function enrollField(field) {
    if (!writableField(field) || field.disabled || field.readOnly || field.matches(FOCUS)) return;
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
    normalizeAutofill(root);
    const fields = [];
    if (root?.matches?.(WRITABLE_SELECTOR)) fields.push(root);
    root?.querySelectorAll?.(WRITABLE_SELECTOR).forEach((field) => fields.push(field));
    fields.forEach(enrollField);
    const forms = new Set(fields.map((field) => field.closest?.("form")).filter(Boolean));
    forms.forEach(syncFormHints);
  }

  function usableFields(form) {
    normalizeAutofill(form);
    return identityOrdered(
      [...(form?.querySelectorAll?.(FOCUS) || [])].filter(
        (field) =>
          !field.disabled &&
          !field.readOnly &&
          field.type !== "hidden" &&
          !field.closest("[hidden]")
      )
    );
  }

  function sequentialControls(form) {
    normalizeAutofill(form);
    return identityOrdered(
      [...(form?.querySelectorAll?.("input,textarea,select") || [])].filter((control) => {
        if (control.disabled || control.readOnly || control.type === "hidden") return false;
        if (control.closest("[hidden]")) return false;
        if (control.matches('[data-stip-keyboard-native],[data-stip-keyboard-exempt]')) return false;
        if (control.matches('input[type="search"]')) return false;
        return true;
      })
    );
  }

  function submitLabel(submit) {
    const explicit = submit?.dataset?.stipKeyboardLabel?.trim?.();
    if (explicit) return explicit;
    const span = submit?.querySelector?.("span")?.textContent?.trim?.();
    if (span) return span.replace(/[→›»]+\s*$/, "").trim();
    const text = submit?.textContent?.trim?.() || "";
    return text.replace(/[→›»]+\s*$/, "").trim() || "Continuer";
  }

  function showFormOverview(form, field = active) {
    const target = field || active;
    if (form) form.dataset.stipOverview = "1";
    try { target?.blur?.(); } catch {}
    clearMode();
    requestAnimationFrame(() => {
      const anchor =
        target?.closest?.(".request-step, label, .request-code-card") ||
        target ||
        form;
      anchor?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    });
    window.dispatchEvent(
      new CustomEvent("stip:form-overview", {
        detail: { form, field: target }
      })
    );
  }

  function prepareFormPath(field, root = scope) {
    const form = formFor(field);
    if (!form?.matches?.(FORM_FOCUS)) return;
    clearFormPath(root);
    ensureQuestion(field, form);
    let node = field;
    while (node && node !== root) { node.classList.add("stip-keyboard-path"); node = node.parentElement; }

    const controls = sequentialControls(form);
    const index = controls.indexOf(field);
    if (index < 0) return;

    let action = form.querySelector(NEXT_ACTION);
    if (!action) {
      action = document.createElement("button");
      action.type = "button";
      action.className = "stip-keyboard-next-action";
      form.appendChild(action);
    }

    const stepNavigation = form.hasAttribute("data-stip-step-nav");
    let previous = form.querySelector(PREV_ACTION);
    let overview = form.querySelector(OVERVIEW_ACTION);

    if (stepNavigation && !previous) {
      previous = document.createElement("button");
      previous.type = "button";
      previous.className = "stip-keyboard-prev-action";
      previous.textContent = "← Précédent";
      form.appendChild(previous);
    }
    if (stepNavigation && !overview) {
      overview = document.createElement("button");
      overview.type = "button";
      overview.className = "stip-keyboard-overview-action";
      overview.textContent = "Vue complète";
      overview.setAttribute("aria-label", "Quitter le plein écran et voir le formulaire complet");
      overview.setAttribute("title", "Voir le formulaire complet");
      overview.setAttribute("data-stip-keyboard-keep", "");
      form.appendChild(overview);
    }

    for (const button of [action, previous, overview]) {
      if (!button || button.dataset.stipKeepFocusBound === "1") continue;
      button.dataset.stipKeepFocusBound = "1";
      button.setAttribute("data-stip-keyboard-keep", "");
      button.addEventListener("pointerdown", (event) => event.preventDefault(), { passive: false });
    }

    const prev = controls[index - 1] || null;
    const next = controls[index + 1] || null;
    const submit = form.querySelector('button[type="submit"],input[type="submit"],[data-stip-keyboard-action]');
    const nextIsWritable = !!next?.matches?.(FOCUS);
    const label = next ? (nextIsWritable ? "Suivant" : "Continuer") : submitLabel(submit);

    action.hidden = false;
    action.textContent = label + "  →";
    action.setAttribute("aria-label", label);
    action.onclick = () => {
      if (typeof field.reportValidity === "function" && !field.reportValidity()) return;
      if (nextIsWritable) {
        transferFocus(next);
        return;
      }
      if (next) {
        clearMode();
        try { next.focus({ preventScroll: true }); } catch { next.focus?.(); }
        requestAnimationFrame(() => next.scrollIntoView?.({ block: "center", behavior: "smooth" }));
        return;
      }
      if (typeof form.requestSubmit === "function") form.requestSubmit(submit || undefined);
      else submit?.click();
    };

    if (previous) {
      previous.hidden = false;
      previous.onclick = () => {
        const previousEvent = new CustomEvent("stip:form-previous-request", {
          detail: { form, field, index, previous: prev },
          cancelable: true
        });
        if (!window.dispatchEvent(previousEvent)) return;
        if (prev?.matches?.(FOCUS)) {
          transferFocus(prev);
          return;
        }
        if (prev) {
          clearMode();
          try { prev.focus({ preventScroll: true }); } catch { prev.focus?.(); }
          requestAnimationFrame(() => prev.scrollIntoView?.({ block: "center", behavior: "smooth" }));
          return;
        }
        showFormOverview(form, field);
      };
    }

    if (overview) {
      overview.hidden = false;
      overview.onclick = () => showFormOverview(form, field);
    }

    window.dispatchEvent(
      new CustomEvent("stip:form-step", {
        detail: { form, field, index, count: controls.length }
      })
    );
  }

  function setDialogMode(root, open) { root?.closest?.("dialog")?.classList.toggle("stip-keyboard-dialog-mode", Boolean(open)); }
  function setMode(open) {
    if (!scope) return;
    modeOpen = Boolean(open);
    scope.classList.toggle(MODE_CLASS, modeOpen);
    setDialogMode(scope, modeOpen);
    document.body.classList.toggle(LOCK_CLASS, modeOpen);
    if (modeOpen) {
      prepareFormPath(active, scope);
      return;
    }
    const action = scope.querySelector?.(NEXT_ACTION);
    const previous = scope.querySelector?.(PREV_ACTION);
    const overview = scope.querySelector?.(OVERVIEW_ACTION);
    if (action) action.hidden = true;
    if (previous) previous.hidden = true;
    if (overview) overview.hidden = true;
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
    const stepNavigation = !!formFor(active)?.hasAttribute?.("data-stip-step-nav");
    const forceFocusMode = !!active?.closest?.("[data-stip-force-focus-mode]");
    if (stepNavigation || forceFocusMode) {
      const retained =
        focused === active ||
        (focused && scope.contains(focused) && focused.closest?.("[data-stip-keyboard-keep]"));
      if (retained) setMode(true);
      return;
    }
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
    const stepNavigation = !!formFor(field)?.hasAttribute?.("data-stip-step-nav");
    const forceFocusMode = !!field?.closest?.("[data-stip-force-focus-mode]");
    if (stepNavigation || forceFocusMode || (preserveKeyboard && previousModeOpen)) {
      modeOpen = true;
      scope.classList.add(MODE_CLASS);
      setDialogMode(scope, true);
      document.body.classList.add(LOCK_CLASS);
      prepareFormPath(field, scope);
    }
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

  document.addEventListener("pointerdown", (event) => {
    const field = event.target.closest?.(FOCUS);
    if (field) {
      const form = formFor(field);
      if (form?.dataset?.stipOverview === "1") delete form.dataset.stipOverview;
      captureBaseline();
      return;
    }
    if (event.target.closest?.(INTENT)) captureBaseline();
  }, true);
  document.addEventListener("click", (event) => { const trigger = event.target.closest?.(INTENT); if (!trigger) return; event.preventDefault(); reveal(trigger); });
  document.addEventListener("focusin", (event) => {
    const field = event.target.closest?.(FOCUS);
    if (!field) return;
    const form = formFor(field);
    if (form?.dataset?.stipOverview === "1") {
      try { field.blur?.(); } catch {}
      const overviewFocus = form.closest?.("dialog")?.querySelector?.("[data-stip-overview-focus],[autofocus]");
      try { overviewFocus?.focus?.({ preventScroll: true }); } catch { overviewFocus?.focus?.(); }
      return;
    }
    focusField(field);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    const field = event.target.closest?.(FOCUS);
    if (!field || field.tagName === "TEXTAREA") return;
    const form = formFor(field);
    if (!form?.matches?.(FORM_FOCUS)) return;
    event.preventDefault();
    if (typeof field.reportValidity === "function" && !field.reportValidity()) return;
    const controls = sequentialControls(form);
    const index = controls.indexOf(field);
    const next = index >= 0 ? controls[index + 1] : null;
    if (next?.matches?.(FOCUS)) {
      transferFocus(next);
      return;
    }
    if (next) {
      clearMode();
      try { next.focus({ preventScroll: true }); } catch { next.focus?.(); }
      requestAnimationFrame(() => next.scrollIntoView?.({ block: "center", behavior: "smooth" }));
      return;
    }
    const submit = form.querySelector('button[type="submit"],input[type="submit"],[data-stip-keyboard-action]');
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
  viewport?.addEventListener("scroll", () => { if (active) syncKeyboard(); });
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

  normalizeAutofill(document);
  const autofillObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (node?.nodeType === 1) normalizeAutofill(node);
      }
    }
  });
  autofillObserver.observe(document.documentElement, { childList: true, subtree: true });

  pinEntryScroll();
  window.STIPFormUX = {
    reveal,
    resetIntents,
    syncKeyboard,
    transferFocus,
    release: clearMode,
    showOverview: showFormOverview,
    autoEnroll,
    normalizeAutofill,
    fields: sequentialControls,
    version: 14
  };
})();