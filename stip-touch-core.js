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

  function bindEmbeddedVerticalScroll(frame, doc) {
    if (!frame || !doc) return () => {};

    let tracking = false;
    let lastX = 0;
    let lastY = 0;

    const reset = () => {
      tracking = false;
      lastX = 0;
      lastY = 0;
    };

    const onTouchStart = (event) => {
      if (event.touches.length !== 1 || frame.dataset.stipViewportLayer === "1") {
        reset();
        return;
      }
      const touch = event.touches[0];
      tracking = true;
      lastX = touch.clientX;
      lastY = touch.clientY;
    };

    const onTouchMove = (event) => {
      if (!tracking || event.touches.length !== 1 || frame.dataset.stipViewportLayer === "1") return;

      const touch = event.touches[0];
      const dx = touch.clientX - lastX;
      const dy = touch.clientY - lastY;
      lastX = touch.clientX;
      lastY = touch.clientY;

      if (Math.abs(dy) < 0.1) return;
      if (Math.abs(dx) > Math.abs(dy) * 2.4) return;

      const deltaY = -dy;
      if (scrollableAncestor(doc, event.target, deltaY)) return;
      window.scrollBy(0, deltaY);
    };

    const onWheel = (event) => {
      if (frame.dataset.stipViewportLayer === "1") return;
      const deltaY = Number(event.deltaY || 0);
      if (!deltaY || scrollableAncestor(doc, event.target, deltaY)) return;
      window.scrollBy(0, deltaY);
    };

    doc.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    doc.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    doc.addEventListener("touchend", reset, { passive: true, capture: true });
    doc.addEventListener("touchcancel", reset, { passive: true, capture: true });
    doc.addEventListener("wheel", onWheel, { passive: true, capture: true });

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