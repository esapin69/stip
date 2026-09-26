(() => {
  "use strict";

  function scrollableAncestor(doc, target, deltaY) {
    const win = doc?.defaultView;
    let node = target?.nodeType === 1 ? target : target?.parentElement;
    while (node && node !== doc.body && node !== doc.documentElement) {
      const style = win?.getComputedStyle?.(node);
      const overflowY = String(style?.overflowY || "");
      if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
        const top = Number(node.scrollTop || 0);
        const max = Math.max(0, node.scrollHeight - node.clientHeight);
        if ((deltaY > 0 && top < max - 1) || (deltaY < 0 && top > 1)) return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function hostWindowFor(frame) {
    return frame?.ownerDocument?.defaultView || window;
  }

  function hostCanScroll(hostWindow, deltaY) {
    if (!hostWindow || !deltaY) return false;
    const doc = hostWindow.document;
    const root = doc?.scrollingElement || doc?.documentElement;
    if (!root) return false;
    const top = Number(hostWindow.scrollY || root.scrollTop || 0);
    const max = Math.max(0, Number(root.scrollHeight || 0) - Number(hostWindow.innerHeight || 0));
    return deltaY > 0 ? top < max - 1 : top > 1;
  }

  function bindEmbeddedVerticalScroll(frame, doc) {
    if (!frame || !doc) return () => {};

    const hostWindow = hostWindowFor(frame);
    let gesture = null;

    const reset = () => {
      gesture = null;
    };

    const onTouchStart = (event) => {
      if (event.touches.length !== 1 || frame.dataset.stipViewportLayer === "1") {
        reset();
        return;
      }
      const touch = event.touches[0];
      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastY: touch.clientY,
        axis: "",
      };
    };

    const onTouchMove = (event) => {
      if (!gesture || event.touches.length !== 1 || frame.dataset.stipViewportLayer === "1") return;

      const touch = event.touches[0];
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);

      if (!gesture.axis) {
        if (Math.max(ax, ay) < 5) return;
        gesture.axis = ax > ay * 1.55 ? "x" : "y";
      }
      if (gesture.axis !== "y") return;

      const deltaY = gesture.lastY - touch.clientY;
      gesture.lastY = touch.clientY;
      if (Math.abs(deltaY) < 0.1) return;

      if (scrollableAncestor(doc, event.target, deltaY)) return;
      if (!hostCanScroll(hostWindow, deltaY)) return;

      const before = Number(hostWindow.scrollY || 0);
      hostWindow.scrollBy(0, deltaY);
      const after = Number(hostWindow.scrollY || 0);

      if (Math.abs(after - before) > 0.1 && event.cancelable) event.preventDefault();
    };

    const onWheel = (event) => {
      if (frame.dataset.stipViewportLayer === "1") return;
      const deltaY = Number(event.deltaY || 0);
      if (!deltaY || scrollableAncestor(doc, event.target, deltaY)) return;
      if (!hostCanScroll(hostWindow, deltaY)) return;

      const before = Number(hostWindow.scrollY || 0);
      hostWindow.scrollBy(0, deltaY);
      const after = Number(hostWindow.scrollY || 0);
      if (Math.abs(after - before) > 0.1 && event.cancelable) event.preventDefault();
    };

    doc.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    doc.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    doc.addEventListener("touchend", reset, { passive: true, capture: true });
    doc.addEventListener("touchcancel", reset, { passive: true, capture: true });
    doc.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      doc.removeEventListener("touchstart", onTouchStart, true);
      doc.removeEventListener("touchmove", onTouchMove, true);
      doc.removeEventListener("touchend", reset, true);
      doc.removeEventListener("touchcancel", reset, true);
      doc.removeEventListener("wheel", onWheel, true);
      reset();
    };
  }

  window.STIPTouchCore = Object.freeze({
    bindEmbeddedVerticalScroll,
  });
})();