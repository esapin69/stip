(() => {
  "use strict";

  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    const currentViewport = String(viewportMeta.getAttribute("content") || "");
    if (!/interactive-widget\s*=/.test(currentViewport)) {
      viewportMeta.setAttribute(
        "content",
        [currentViewport.replace(/\s*,\s*$/, ""), "interactive-widget=resizes-content"]
          .filter(Boolean)
          .join(",")
      );
    }
  }

  if (window.STIPFormUX) return;

  const FOCUS = "[data-stip-keyboard-focus]";
  const SCOPE = "[data-stip-keyboard-scope]";
  const FORM_FOCUS = "[data-stip-form-focus]";
  const FORM_MODE_ATTR = "data-stip-form-mode";
  const FORM_MODES = new Set(["sequential", "standard", "search", "composer", "native", "legacy", "exempt"]);
  const INTENT = "[data-stip-intent-reveal]";
  const NEXT_ACTION = ".stip-keyboard-next-action";
  const PREV_ACTION = ".stip-keyboard-prev-action";
  const OVERVIEW_ACTION = ".stip-keyboard-overview-action";
  const NAV_ACTIONS = ".stip-keyboard-nav-actions";
  const QUESTION_CLASS = "stip-keyboard-question";
  const CONTEXT_CLASS = "stip-keyboard-context";
  const HELP_CLASS = "stip-keyboard-help";
  const SEARCH_QUESTION = ".stip-keyboard-search-question";
  const SELECT_MENU_SELECTOR = "select[data-stip-select-menu]";
  const WRITABLE_SELECTOR = [
    'input:not([type])',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="url"]',
    'input[type="password"]',
    'input[type="search"]',
    'input[type="number"]',
    'textarea'
  ].join(",");
  const LOCK_CLASS = "stip-keyboard-focus-lock";
  const MODE_CLASS = "stip-keyboard-focus-mode";
  const SEARCH_MODE_ATTR = "data-stip-search-focus";
  const SEARCH_EXIT = ".stip-keyboard-search-exit";
  const INTENT_BACK = ".stip-intent-back-action";
  const SEARCH_RESULT_SELECTOR = '[class*="result"],[id*="result"],[class*="suggest"],[id*="suggest"],[data-picker],[class*="list"],[id*="list"],[id*="List"]';
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

  function isSixDigitPin(field) {
    if (!field?.matches?.("input")) return false;
    const key = fieldIdentityKey(field);
    const maxlength = Number(field.getAttribute("maxlength") || field.maxLength || 0);
    const numeric = String(field.getAttribute("inputmode") || "").toLowerCase() === "numeric";
    const pattern = String(field.getAttribute("pattern") || "");
    const codeLike = /(^|_)(code|pin|passcode|requested_code|access_code)(_|$)/.test(key);
    return maxlength === 6 && numeric && (codeLike || /0-9|\\d/.test(pattern));
  }

  function normalizePinField(field) {
    if (formMode(field?.form || field?.closest?.("form")) === "exempt") return false;
    if (!isSixDigitPin(field)) return false;
    field.dataset.stipPinField = "1";
    field.classList.add("stip-pin-field");
    if (field.type !== "text") field.type = "text";
    field.setAttribute("inputmode", "numeric");
    field.setAttribute("autocomplete", "off");
    if (!field.hasAttribute("pattern")) field.setAttribute("pattern", "[0-9]{6}");
    if (field.dataset.stipPinBound !== "1") {
      field.dataset.stipPinBound = "1";
      field.addEventListener("input", () => {
        const clean = String(field.value || "").replace(/\D/g, "").slice(0, 6);
        if (field.value !== clean) field.value = clean;
      });
    }
    return true;
  }

  function normalizeAutofillField(field) {
    if (!field?.matches?.("input,textarea,select")) return "";
    if (formMode(field.form || field.closest?.("form")) === "exempt") return "";
    if (normalizePinField(field)) return "one-time-code";
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

  /* Règle identité : une seule source d'ordre = le DOM.
     Ne jamais inverser Nom/Prénom en JavaScript ni avec un ordre caché.
     Chaque formulaire garde son ordre visuel réel dans le DOM et déclare
     explicitement family-name / given-name pour l'autoremplissage navigateur. */

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

  function bindPinToggles(root = document) {
    const toggles = [];
    if (root?.matches?.("[data-stip-pin-toggle]")) toggles.push(root);
    root?.querySelectorAll?.("[data-stip-pin-toggle]").forEach((button) => toggles.push(button));
    toggles.forEach((button) => {
      if (button.dataset.stipPinToggleBound === "1") return;
      const selector = String(button.dataset.stipPinToggle || "").trim();
      let field = null;
      try { field = selector ? document.querySelector(selector) : null; } catch {}
      if (!field) field = button.closest?.("label,form,div")?.querySelector?.("input[data-stip-pin-field],input[inputmode='numeric'][maxlength='6']");
      if (!field) return;
      normalizePinField(field);
      button.dataset.stipPinToggleBound = "1";
      const showLabel = button.dataset.stipPinShowLabel || "Voir";
      const hideLabel = button.dataset.stipPinHideLabel || "Masquer";
      const sync = () => {
        const revealed = field.dataset.stipPinRevealed === "1";
        button.textContent = revealed ? hideLabel : showLabel;
        button.setAttribute("aria-pressed", revealed ? "true" : "false");
      };
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (field.dataset.stipPinRevealed === "1") delete field.dataset.stipPinRevealed;
        else field.dataset.stipPinRevealed = "1";
        sync();
        try { field.focus({ preventScroll: true }); } catch { field.focus?.(); }
      });
      sync();
    });
  }

  function normalizeAutofill(root = document) {
    const forms = new Set();
    if (root?.matches?.("form")) forms.add(root);
    const owner = root?.closest?.("form");
    if (owner) forms.add(owner);
    root?.querySelectorAll?.("form").forEach((form) => forms.add(form));
    forms.forEach((form) => {
      if (formMode(form) === "exempt") return;
      if (!form.hasAttribute("autocomplete")) form.setAttribute("autocomplete", "on");
      form.querySelectorAll("input,textarea,select").forEach((field) => {
        normalizePinField(field);
        normalizeAutofillField(field);
      });
      markAutofillContext(form);
    });
    return forms;
  }

  function identityOrdered(controls) {
    return [...controls];
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
    const nav = root?.querySelector?.(NAV_ACTIONS);
    if (nav) nav.hidden = true;
    root?.querySelectorAll?.("." + CONTEXT_CLASS + ",." + HELP_CLASS).forEach((node) => node.remove());
  }

  function writableField(field) {
    return !!field?.matches?.(WRITABLE_SELECTOR);
  }

  function formMode(form) {
    if (!form) return "native";
    const explicit = String(form.getAttribute?.(FORM_MODE_ATTR) || "").trim().toLowerCase();
    if (FORM_MODES.has(explicit)) return explicit;
    if (form.matches?.("[data-stip-keyboard-exempt]") || form.closest?.("[data-stip-keyboard-exempt]")) return "exempt";
    if (form.matches?.("[data-stip-keyboard-native]") || form.closest?.("[data-stip-keyboard-native]")) return "native";
    const key = [form.id, form.className, form.getAttribute?.("aria-label")].filter(Boolean).join(" ").toLowerCase();
    if (/(?:^|[\\s_-])(chat|message|messages|composer|compose|dialog-form)(?:$|[\\s_-])/.test(key)) return "composer";
    return "auto";
  }

  function composerForm(form) {
    const mode = formMode(form);
    return mode === "composer" || mode === "native" || mode === "exempt";
  }

  function searchScopeFor(field) {
    const explicit = field?.closest?.("[data-stip-search-scope]");
    if (explicit) return explicit;
    let node = field?.parentElement || null;
    let named = null;
    for (let depth = 0; node && node !== document.body && depth < 7; depth += 1, node = node.parentElement) {
      const key = [node.id, node.className, node.getAttribute?.("role")].filter(Boolean).join(" ").toLowerCase();
      if (/search|recherch|lookup|finder|picker/.test(key)) named = node;
      if (node.querySelector?.(SEARCH_RESULT_SELECTOR)) return node;
    }
    return named || field?.parentElement || null;
  }

  function ensureSearchExit(root) {
    if (!root) return null;
    let button = root.querySelector?.(SEARCH_EXIT);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "stip-keyboard-search-exit";
      button.textContent = "×";
      button.setAttribute("aria-label", "Quitter la recherche plein écran");
      button.setAttribute("title", "Quitter");
      button.setAttribute("data-stip-keyboard-keep", "");
      root.appendChild(button);
    }
    button.onclick = () => {
      try { active?.blur?.(); } catch {}
      clearMode();
    };
    return button;
  }

  function prepareSearchPath(field, root = scope) {
    if (!field || !root || !root.hasAttribute?.(SEARCH_MODE_ATTR)) return;
    root.querySelectorAll?.(".stip-keyboard-search-path").forEach((node) => node.classList.remove("stip-keyboard-search-path"));
    ensureSearchQuestion(root, field);
    let node = field;
    while (node && node !== root) {
      node.classList?.add?.("stip-keyboard-search-path");
      node = node.parentElement;
    }
    ensureSearchExit(root);
  }

  function fieldRole(field) {
    if (!writableField(field)) return "other";
    if (field.matches('[data-stip-keyboard-native],[data-stip-keyboard-exempt]') || field.closest('[data-stip-keyboard-native],[data-stip-keyboard-exempt]')) return "native";
    const form = field.closest("form");
    const mode = formMode(form);
    if (mode === "exempt" || mode === "native" || mode === "composer" || mode === "legacy") return "native";
    if (field.matches('input[type="search"]') || mode === "search") return "search";
    if (mode === "standard") return "native";
    return form ? "form" : "native";
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

  function ensureSearchQuestion(root, field) {
    if (!root || !field) return null;
    let question = root.querySelector?.(SEARCH_QUESTION);
    if (!question) {
      question = document.createElement("div");
      question.className = "stip-keyboard-search-question";
      question.setAttribute("aria-live", "polite");
      root.prepend(question);
    }
    question.textContent = questionText(field);
    return question;
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

  function formContextEntries(form, index, total) {
    if (!form) return [];
    const entries = [];
    const who = String(form.dataset.stipContextWho || "").trim();
    const why = String(form.dataset.stipContextWhy || "").trim();
    if (who) entries.push(["POUR QUI", who]);
    if (why) entries.push(["POURQUOI", why]);
    if (total > 1 && index >= 0) entries.push(["ÉTAPE", (index + 1) + " / " + total]);
    return entries;
  }

  function ensureFormContext(form, field, index, total) {
    if (!form) return null;
    form.querySelectorAll?.("." + CONTEXT_CLASS).forEach((node) => node.remove());
    const entries = formContextEntries(form, index, total);
    if (!entries.length) return null;
    const box = document.createElement("div");
    box.className = CONTEXT_CLASS;
    box.setAttribute("aria-label", "Contexte de la saisie");
    for (const [label, value] of entries) {
      const item = document.createElement("span");
      const small = document.createElement("small");
      const strong = document.createElement("strong");
      small.textContent = label;
      strong.textContent = value;
      item.append(small, strong);
      box.appendChild(item);
    }
    form.prepend(box);
    return box;
  }

  function ensureFieldHelp(form, field) {
    if (!form) return null;
    form.querySelectorAll?.("." + HELP_CLASS).forEach((node) => node.remove());
    const text = String(field?.dataset?.stipHelp || "").trim();
    if (!text) return null;
    const help = document.createElement("div");
    help.className = HELP_CLASS;
    const small = document.createElement("small");
    const body = document.createElement("span");
    small.textContent = "COMMENT";
    body.textContent = text;
    help.append(small, body);
    form.appendChild(help);
    return help;
  }

  function selectMenuTitle(select) {
    const explicit = String(select?.dataset?.stipSelectTitle || "").trim();
    if (explicit) return explicit;
    const label = select?.labels?.[0] || select?.closest?.("label");
    if (!label) return "Choisir";
    const clone = label.cloneNode(true);
    clone.querySelectorAll("select,input,textarea,button").forEach((node) => node.remove());
    return clone.textContent?.replace(/\s+/g, " ").trim() || "Choisir";
  }

  function syncSelectTrigger(select, trigger) {
    const option = select?.selectedOptions?.[0] || select?.options?.[select.selectedIndex];
    trigger.querySelector("strong").textContent = option?.textContent?.trim?.() || "Choisir";
    trigger.setAttribute("aria-label", selectMenuTitle(select) + " : " + (option?.textContent?.trim?.() || "Choisir"));
  }

  function openSelectMenu(select, trigger) {
    if (!select || !trigger || select.disabled) return;
    try { document.activeElement?.blur?.(); } catch {}
    clearMode();

    document.querySelectorAll(".stip-select-layer").forEach((node) => node.remove());
    const layer = document.createElement("div");
    layer.className = "stip-select-layer";
    layer.setAttribute("role", "presentation");

    const sheet = document.createElement("section");
    sheet.className = "stip-select-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", selectMenuTitle(select));

    const head = document.createElement("div");
    head.className = "stip-select-head";
    const copy = document.createElement("div");
    const kicker = document.createElement("small");
    const title = document.createElement("h3");
    kicker.textContent = "CHOIX";
    title.textContent = selectMenuTitle(select);
    copy.append(kicker, title);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "stip-select-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Fermer");
    head.append(copy, close);

    const options = document.createElement("div");
    options.className = "stip-select-options";

    const closeLayer = (restoreFocus = true) => {
      layer.remove();
      document.body.classList.remove("stip-select-menu-open");
      if (restoreFocus) {
        requestAnimationFrame(() => {
          try { trigger.focus({ preventScroll: true }); } catch { trigger.focus?.(); }
        });
      }
    };

    [...select.options].forEach((option) => {
      if (option.disabled) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stip-select-option";
      const label = document.createElement("span");
      const mark = document.createElement("b");
      label.textContent = option.textContent?.trim?.() || option.value;
      mark.textContent = option.selected ? "✓" : "";
      button.classList.toggle("is-selected", option.selected);
      button.setAttribute("aria-pressed", option.selected ? "true" : "false");
      button.append(label, mark);
      button.addEventListener("click", () => {
        if (select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        syncSelectTrigger(select, trigger);
        closeLayer();
      });
      options.appendChild(button);
    });

    close.addEventListener("click", () => closeLayer());
    layer.addEventListener("click", (event) => {
      if (event.target === layer) closeLayer();
    });
    layer.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLayer();
      }
    });

    sheet.append(head, options);
    layer.appendChild(sheet);
    document.body.appendChild(layer);
    document.body.classList.add("stip-select-menu-open");
    requestAnimationFrame(() => {
      const selected = options.querySelector(".is-selected") || options.querySelector("button");
      try { selected?.focus?.({ preventScroll: true }); } catch { selected?.focus?.(); }
      selected?.scrollIntoView?.({ block: "nearest" });
    });
  }

  function enhanceSelectMenu(select) {
    if (!select?.matches?.(SELECT_MENU_SELECTOR) || select.dataset.stipSelectBound === "1") return;
    select.dataset.stipSelectBound = "1";
    select.setAttribute("data-stip-keyboard-exempt", "");
    select.classList.add("stip-select-source");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "stip-select-trigger";
    trigger.setAttribute("data-stip-select-trigger", "");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.innerHTML = "<strong></strong><span aria-hidden=\"true\">⌄</span>";
    select.insertAdjacentElement("afterend", trigger);
    syncSelectTrigger(select, trigger);
    trigger.addEventListener("click", () => openSelectMenu(select, trigger));
    select.addEventListener("change", () => syncSelectTrigger(select, trigger));
  }

  function bindSelectMenus(root = document) {
    if (root?.matches?.(SELECT_MENU_SELECTOR)) enhanceSelectMenu(root);
    root?.querySelectorAll?.(SELECT_MENU_SELECTOR).forEach(enhanceSelectMenu);
  }

  function syncFormHints(form) {
    const mode = formMode(form);
    if (mode === "standard" || mode === "search" || mode === "composer" || mode === "native" || mode === "legacy" || mode === "exempt") return;
    const fields = usableFields(form);
    const submit = form?.querySelector?.('button[type="submit"],input[type="submit"],[data-stip-keyboard-action]');
    fields.forEach((field, index) => {
      if (field.tagName === "TEXTAREA" || field.hasAttribute("enterkeyhint")) return;
      field.setAttribute("enterkeyhint", index < fields.length - 1 ? "next" : submit ? "done" : "next");
    });
  }

  function enrollField(field) {
    if (!writableField(field) || field.disabled || field.readOnly) return;
    const role = fieldRole(field);
    field.dataset.stipKeyboardRole = role;
    if (role === "search") {
      const root = searchScopeFor(field);
      if (!root) return;
      field.setAttribute("data-stip-keyboard-focus", "");
      root.setAttribute("data-stip-keyboard-scope", "");
      root.setAttribute(SEARCH_MODE_ATTR, "");
      ensureSearchExit(root);
      return;
    }
    if (role !== "form") return;
    const form = field.closest("form");
    if (!form) return;
    const mode = formMode(form);
    field.setAttribute("data-stip-keyboard-focus", "");
    form.setAttribute("data-stip-keyboard-scope", "");
    form.setAttribute("data-stip-form-focus", "");
    if ((mode === "sequential" || mode === "auto") && sequentialControls(form).length > 1)
      form.setAttribute("data-stip-step-nav", "");
    syncFormHints(form);
  }

  function autoEnroll(root = document) {
    normalizeAutofill(root);
    bindPinToggles(root);
    bindSelectMenus(root);
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
          !field.closest('[hidden],.hidden,[aria-hidden="true"],[inert]')
      )
    );
  }

  function sequentialControls(form) {
    normalizeAutofill(form);
    return identityOrdered(
      [...(form?.querySelectorAll?.("input,textarea,select") || [])].filter((control) => {
        const type = String(control.type || "").toLowerCase();
        if (control.disabled || control.readOnly || ["hidden", "submit", "reset", "button", "image"].includes(type)) return false;
        if (control.closest('[hidden],.hidden,[aria-hidden="true"],[inert]')) return false;
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
    return text.replace(/[→›»]+\s*$/, "").trim() || "Valider";
  }

  function finalActionLabel(submit) {
    if (!submit) return "Terminer";
    const label = submitLabel(submit);
    return /^(?:suivant|continuer)$/i.test(label) ? "Valider" : label;
  }

  function focusPlainControl(control) {
    if (!control) return false;
    clearMode();
    const focus = () => {
      try { control.focus({ preventScroll: true }); } catch { control.focus?.(); }
      if (document.activeElement === control) {
        requestAnimationFrame(() => control.scrollIntoView?.({ block: "center", behavior: "smooth" }));
        return true;
      }
      return false;
    };
    if (focus()) return true;
    requestAnimationFrame(() => {
      if (focus()) return;
      setTimeout(focus, 40);
    });
    return true;
  }

  function advanceFromField(field) {
    const form = formFor(field);
    if (!field || !form?.matches?.(FORM_FOCUS)) return false;
    if (typeof field.reportValidity === "function" && !field.reportValidity()) return false;

    const controls = sequentialControls(form);
    const index = controls.indexOf(field);
    if (index < 0) return false;
    const next = controls[index + 1] || null;

    if (next?.matches?.(FOCUS)) return transferFocus(next);
    if (next) return focusPlainControl(next);

    const submit = form.querySelector('button[type="submit"],input[type="submit"],[data-stip-keyboard-action]');
    if (!submit) {
      showFormOverview(form, field);
      return true;
    }
    if (typeof form.requestSubmit === "function") form.requestSubmit(submit);
    else submit.click();
    return true;
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
    ensureFormContext(form, field, index, controls.length);
    ensureFieldHelp(form, field);

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
    let nav = form.querySelector(NAV_ACTIONS);

    if (stepNavigation && !nav) {
      nav = document.createElement("div");
      nav.className = "stip-keyboard-nav-actions";
      nav.setAttribute("data-stip-keyboard-keep", "");
      form.appendChild(nav);
    }
    if (stepNavigation && !previous) {
      previous = document.createElement("button");
      previous.type = "button";
      previous.className = "stip-keyboard-prev-action";
      previous.textContent = "← Précédent";
    }
    if (stepNavigation && nav) {
      if (previous && previous.parentElement !== nav) nav.appendChild(previous);
      if (action.parentElement !== nav) nav.appendChild(action);
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

    if (nav) nav.hidden = false;

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
    const isFinal = !next;
    const label = isFinal ? finalActionLabel(submit) : (nextIsWritable ? "Suivant" : "Continuer");

    action.hidden = false;
    action.dataset.stipFinalAction = isFinal ? "1" : "0";
    action.textContent = label + (isFinal ? "  ✓" : "  →");
    action.setAttribute("aria-label", label);
    action.onclick = () => {
      advanceFromField(field);
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
          focusPlainControl(prev);
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
        detail: { form, field, index, count: controls.length, final: !next }
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
      if (scope.hasAttribute?.(SEARCH_MODE_ATTR)) prepareSearchPath(active, scope);
      else prepareFormPath(active, scope);
      return;
    }
    const action = scope.querySelector?.(NEXT_ACTION);
    const previous = scope.querySelector?.(PREV_ACTION);
    const overview = scope.querySelector?.(OVERVIEW_ACTION);
    const nav = scope.querySelector?.(NAV_ACTIONS);
    if (action) action.hidden = true;
    if (previous) previous.hidden = true;
    if (overview) overview.hidden = true;
    if (nav) nav.hidden = true;
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
    const forceFocusMode = !!active?.closest?.("[data-stip-force-focus-mode]");
    if (forceFocusMode) {
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
    if (scope.hasAttribute?.(SEARCH_MODE_ATTR)) prepareSearchPath(field, scope);
    else prepareFormPath(field, scope);
    const forceFocusMode = !!field?.closest?.("[data-stip-force-focus-mode]");
    if (forceFocusMode || (preserveKeyboard && previousModeOpen)) {
      modeOpen = true;
      scope.classList.add(MODE_CLASS);
      setDialogMode(scope, true);
      document.body.classList.add(LOCK_CLASS);
      if (scope.hasAttribute?.(SEARCH_MODE_ATTR)) prepareSearchPath(field, scope);
      else prepareFormPath(field, scope);
    }
    syncKeyboard(); scheduleSync(60); scheduleSync(160); scheduleSync(320);
  }

  function clearMode() {
    clearScheduled(); clearFormPath(scope);
    if (scope) { scope.classList.remove(MODE_CLASS); setDialogMode(scope, false); scope.style.removeProperty("--stip-vv-height"); scope.style.removeProperty("--stip-vv-top"); }
    document.body.classList.remove(LOCK_CLASS); active = null; scope = null; baselineHeight = 0; pendingBaseline = 0; modeOpen = false;
    setTimeout(updateStableHeight, 80);
  }

  function collapseIntent(trigger, target, options = {}) {
    if (!trigger || !target) return false;
    const activeInside = target.contains(document.activeElement);
    if (activeInside) {
      try { document.activeElement?.blur?.(); } catch {}
    }
    clearMode();
    target.hidden = true;
    delete target.dataset.stipRevealed;
    trigger.hidden = false;
    trigger.setAttribute("aria-expanded", "false");
    if (options.focus !== false) {
      requestAnimationFrame(() => {
        try { trigger.focus({ preventScroll: true }); } catch { trigger.focus?.(); }
      });
    }
    window.dispatchEvent(new CustomEvent("stip:intent-collapsed", { detail: { trigger, target } }));
    return true;
  }

  function ensureIntentBack(trigger, target) {
    if (!trigger || !target || trigger.dataset.stipIntentCollapse !== "1") return null;
    let button = target.querySelector?.(INTENT_BACK);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "stip-intent-back-action";
      button.textContent = "← Retour";
      button.setAttribute("aria-label", "Revenir à l’écran précédent");
      button.setAttribute("data-stip-keyboard-accessory", "");
      button.setAttribute("data-stip-keyboard-keep", "");
      target.appendChild(button);
    }
    if (button.dataset.stipIntentBackBound !== "1") {
      button.dataset.stipIntentBackBound = "1";
      button.addEventListener("pointerdown", (event) => event.preventDefault(), { passive: false });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        collapseIntent(trigger, target);
      });
    }
    return button;
  }

  function reveal(trigger) {
    const selector = trigger.getAttribute("data-stip-intent-reveal") || "";
    if (!selector) return null;
    let target = null; try { target = document.querySelector(selector); } catch {}
    if (!target) return null;
    captureBaseline(); target.hidden = false; target.dataset.stipRevealed = "1"; trigger.setAttribute("aria-expanded", "true");
    ensureIntentBack(trigger, target);
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
      if (target) collapseIntent(trigger, target, { focus: false });
      else { trigger.hidden = false; trigger.setAttribute("aria-expanded", "false"); }
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
    advanceFromField(field);
  }, true);
  document.documentElement.dataset.stipEnterManaged = "1";

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      const focused = document.activeElement; const nextField = focused?.closest?.(FOCUS);
      if (nextField && nextField.closest(SCOPE) === scope) { active = nextField; if (scope?.hasAttribute?.(SEARCH_MODE_ATTR)) prepareSearchPath(nextField, scope); else prepareFormPath(nextField, scope); syncKeyboard(); return; }
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
    const preserved = baselineHeight || pendingBaseline || stableHeight || measureFullHeight();
    pendingBaseline = preserved;

    const focus = () => {
      try { field.focus({ preventScroll: true }); } catch { field.focus?.(); }
      if (document.activeElement !== field) return false;
      focusField(field, { preserveKeyboard: true });
      return true;
    };

    if (focus()) return true;
    requestAnimationFrame(() => {
      if (focus()) return;
      setTimeout(focus, 40);
    });
    return true;
  }

  autoEnroll(document);
  const autofillObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (node?.nodeType === 1) autoEnroll(node);
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
    formMode,
    version: 27
  };
})();