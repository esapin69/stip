(() => {
  "use strict";
  if (window.STIPOverlayNav) return;

  // A modal is a navigation level. The browser Back gesture must dismiss it
  // before it can leave the STIP document. A nested detail is another level.
  const KEY = "__stipOverlayNavigation";
  const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entries = [];
  const observedDialogs = new WeakSet();
  let depth = 0;
  let applying = false;
  let transitioning = false;
  let afterTransition = null;

  function marker(state) {
    const value = state && state[KEY];
    return value && value.session === session ? value : null;
  }

  function current() {
    return entries[depth - 1] || null;
  }

  function findRoot(target, type) {
    for (let i = depth - 1; i >= 0; i--) {
      if (entries[i].target === target && entries[i].type === type) return i;
    }
    return -1;
  }

  function add(entry) {
    if (applying || transitioning) return false;
    // Branching after Back intentionally discards the abandoned Forward path.
    entries.splice(depth);
    const next = depth + 1;
    try {
      const previous =
        history.state && typeof history.state === "object" ? history.state : {};
      history.pushState(
        { ...previous, [KEY]: { session, depth: next } },
        "",
        location.href,
      );
    } catch (error) {
      console.warn("STIP overlay history unavailable", error);
      return false;
    }
    entries.push(entry);
    depth = next;
    return true;
  }

  function goTo(targetDepth, after) {
    if (applying || transitioning || targetDepth < 0 || targetDepth >= depth)
      return false;
    transitioning = true;
    afterTransition = typeof after === "function" ? after : null;
    history.go(targetDepth - depth);
    return true;
  }

  function showDialog(dialog) {
    if (!dialog || !dialog.isConnected || dialog.open) return;
    try {
      dialog.showModal();
    } catch (error) {
      console.warn("STIP dialog restore unavailable", error);
    }
  }

  function track(dialog) {
    if (!dialog || !dialog.open || dialog.dataset.stipOverlayHistory === "off")
      return false;
    if (findRoot(dialog, "dialog") >= 0) return true;
    if (!observedDialogs.has(dialog)) {
      observedDialogs.add(dialog);
      dialog.addEventListener("close", () => {
        // Native X, Escape and backdrop closes must clear their history levels.
        if (!applying && !transitioning) close(dialog);
      });
    }
    return add({
      type: "dialog",
      target: dialog,
      backward: () => { if (dialog.open) dialog.close(); },
      forward: () => showDialog(dialog),
    });
  }

  function step(dialog, callbacks = {}) {
    if (!track(dialog)) return false;
    return add({
      type: "step",
      target: dialog,
      backward: typeof callbacks.back === "function" ? callbacks.back : () => {},
      forward: typeof callbacks.forward === "function" ? callbacks.forward : () => {},
    });
  }

  function back(dialog) {
    const layer = current();
    return !!(
      layer &&
      layer.type === "step" &&
      layer.target === dialog &&
      goTo(depth - 1)
    );
  }

  function close(dialog, after) {
    const index = findRoot(dialog, "dialog");
    return index >= 0 ? goTo(index, after) : false;
  }

  // Non-native overlays opt in explicitly, preserving their existing UI logic.
  function trackElement(element, callbacks = {}) {
    if (!element || !element.isConnected) return false;
    if (findRoot(element, "element") >= 0) return true;
    return add({
      type: "element",
      target: element,
      backward: typeof callbacks.close === "function"
        ? callbacks.close
        : () => element.remove(),
      forward: typeof callbacks.reopen === "function"
        ? callbacks.reopen
        : () => {},
    });
  }

  function closeElement(element, after) {
    const index = findRoot(element, "element");
    return index >= 0 ? goTo(index, after) : false;
  }

  function sync(event) {
    const state = marker(event.state);
    const wanted = state ? Math.min(state.depth, entries.length) : 0;
    const before = depth;
    if (wanted === before) {
      if (transitioning) {
        transitioning = false;
        const callback = afterTransition;
        afterTransition = null;
        callback?.();
      }
      return;
    }
    applying = true;
    try {
      while (depth > wanted) {
        depth -= 1;
        try { entries[depth].backward(); }
        catch (error) { console.warn("STIP overlay Back", error); }
      }
      while (depth < wanted) {
        const entry = entries[depth];
        depth += 1;
        try { entry.forward(); }
        catch (error) { console.warn("STIP overlay Forward", error); }
      }
    } finally {
      applying = false;
      transitioning = false;
      // Other hash/page routers must not interpret a modal-only Back as a route.
      event.stopImmediatePropagation?.();
      const callback = afterTransition;
      afterTransition = null;
      callback?.();
    }
  }
  window.addEventListener("popstate", sync, true);

  function inspect(node) {
    if (!node || node.nodeType !== 1) return;
    const dialogs = [];
    if (node.matches?.("dialog[open]")) dialogs.push(node);
    node.querySelectorAll?.("dialog[open]").forEach((dialog) => dialogs.push(dialog));
    for (const dialog of dialogs) {
      let modal = false;
      try { modal = dialog.matches(":modal"); } catch { modal = dialog.open; }
      if (modal) track(dialog);
    }
  }

  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "attributes") inspect(change.target);
      else for (const node of change.addedNodes) inspect(node);
    }
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    inspect(document.documentElement);
  }

  window.STIPOverlayNav = {
    track, step, back, close, trackElement, closeElement,
    isStep: (dialog) =>
      current()?.type === "step" && current()?.target === dialog,
  };
})();