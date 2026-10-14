(() => {
  "use strict";
  if (window.STIPPopupContinuity) return;

  // Keep the underlying document at its original position when a popup closes.
  // A popup is not a route change: don't rely on stale per-route scroll history.
  const POPUPS = [
    'dialog[open]',
    '#hcShiftDetail',
    '.hc-confirm-backdrop',
    '.stip-favorites-panel',
    '.sas-picker-overlay',
    '.hc-feedback-modal',
    '[role="dialog"][aria-modal="true"]',
  ].join(',');
  const PAGE_SURFACES = '#hsPanel, .hs-panel';
  let snapshot = null;
  let lastTrigger = null;

  const locationKey = () => location.pathname + location.search + location.hash;
  const scrollY = () => Math.max(0, window.scrollY || document.scrollingElement?.scrollTop || 0);
  const visible = (node) => {
    if (!node.isConnected || node.closest(PAGE_SURFACES) || node.matches(PAGE_SURFACES)) return false;
    if (node.matches('dialog') && !node.open) return false;
    if (node.hidden || node.getClientRects?.().length === 0) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  function popups() {
    return Array.from(document.querySelectorAll(POPUPS)).filter(visible);
  }
  function rememberTrigger() {
    if (snapshot || popups().length) return;
    lastTrigger = { y: scrollY(), key: locationKey(), at: performance.now() };
  }
  document.addEventListener('pointerdown', rememberTrigger, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') rememberTrigger();
  }, true);

  function decorate(nodes) {
    for (const node of nodes) {
      if (!node.matches('dialog') || node.dataset.stipPopupLayout === 'page') continue;
      // Full-screen application panels must remain full-screen, not forced into cards.
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.width < innerWidth - 5) node.dataset.stipPopupViewport = '1';
    }
  }

  function restorePosition(saved) {
    // Closing a modal is not navigation: preserve the current background
    // position synchronously, before the next paint. No delayed scroll writes.
    if (locationKey() !== saved.key) return;
    const root = document.scrollingElement || document.documentElement;
    const maximum = Math.max(0, root.scrollHeight - window.innerHeight);
    if (maximum + 3 < saved.y) return;
    if (Math.abs(scrollY() - saved.y) > 2) {
      window.scrollTo({ top: saved.y, left: 0, behavior: 'auto' });
    }
  }

  function reconcile() {
    const nodes = popups();
    if (nodes.length) {
      decorate(nodes);
      if (!snapshot) {
        const recent = lastTrigger && performance.now() - lastTrigger.at < 1600;
        snapshot = { key: recent ? lastTrigger.key : locationKey(), y: recent ? lastTrigger.y : scrollY() };
        window.STIPRouter?.cancelPendingScrollRestore?.();
      }
    } else if (snapshot) {
      const saved = snapshot;
      snapshot = null;
      lastTrigger = null;
      restorePosition(saved);
    }
  }

  const observer = new MutationObserver(changes => {
    // Some custom overlays close by toggling a CSS class rather than "open".
    // Ignore ordinary class changes on the rest of the page.
    if (changes.some(change =>
      change.type !== 'attributes' ||
      !['class', 'style'].includes(change.attributeName) ||
      change.target === document.body ||
      change.target === document.documentElement ||
      change.target.matches?.(POPUPS) ||
      change.target.querySelector?.(POPUPS)
    )) reconcile();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open', 'hidden', 'aria-hidden', 'class', 'style'],
  });
  window.addEventListener('pagehide', () => { snapshot = null; });
  window.STIPPopupContinuity = { reconcile, isOpen: () => popups().length > 0 };
  reconcile();
})();