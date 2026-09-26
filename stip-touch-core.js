(() => {
  "use strict";

  /*
   * Embedded STIP pages are same-origin iframes whose height is expanded to
   * their full content. The child document therefore has nothing to scroll:
   * vertical gestures must be handed to the parent page explicitly.
   *
   * Keep this logic here, once, rather than adding page-specific swipe code.
   */

  function hostWindowFor(frame) {
    return frame?.ownerDocument?.defaultView || window;
  }

  function scrollableAncestor(doc, target, deltaY) {
    const win = doc?.defaultView;
    let node = target?.nodeType === 1 ? target : target?.parentElement;

    while (node && node !== doc.body && node !== doc.documentElement) {
      const style = win?.getComputedStyle?.(node);
      const overflowY = String(style?.overflowY || "");
      const canScroll =
        /(auto|scroll|overlay)/.test(overflowY) &&
        node.scrollHeight > node.clientHeight + 1;

      if (canScroll) {
        const top = Number(node.scrollTop || 0);
        const max = Math.max(0, node.scrollHeight - node.clientHeight);
        if ((deltaY > 0 && top < max - 1) || (deltaY < 0 && top > 1))
          return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  function parentCanScroll(hostWindow, deltaY) {
    const doc = hostWindow?.document;
    if (!doc || !deltaY) return false;

    const root = doc.scrollingElement || doc.documentElement;
    const top = Number(hostWindow.scrollY || root?.scrollTop || 0);
    const viewport = Number(hostWindow.innerHeight || 0);
    const max = Math.max(
      0,
      Number(root?.scrollHeight || 0) - viewport,
    );

    return deltaY > 0 ? top < max - 1 : top > 1;
  }

  function bindEmbeddedVerticalScroll(frame, doc) {
    if (!frame || !doc) return () => {};

    const hostWindow = hostWindowFor(frame);
    let gesture = null;
    let inertiaRaf = 0;

    const stopInertia = () => {
      if (inertiaRaf) hostWindow.cancelAnimationFrame(inertiaRaf);
      inertiaRaf = 0;
    };

    const reset = () => {
      gesture = null;
    };

    const startInertia = (velocity) => {
      stopInertia();
      let v = Math.max(-2.6, Math.min(2.6, Number(velocity || 0)));
      if (Math.abs(v) < 0.08) return;

      let last = hostWindow.performance?.now?.() || Date.now();

      const tick = (now) => {
        const current = Number(now || Date.now());
        const dt = Math.max(8, Math.min(32, current - last || 16));
        last = current;

        const deltaY = v * dt;
        if (!parentCanScroll(hostWindow, deltaY)) {
          inertiaRaf = 0;
          return;
        }

        hostWindow.scrollBy(0, deltaY);
        v *= Math.pow(0.93, dt / 16);

        if (Math.abs(v) < 0.025) {
          inertiaRaf = 0;
          return;
        }

        inertiaRaf = hostWindow.requestAnimationFrame(tick);
      };

      inertiaRaf = hostWindow.requestAnimationFrame(tick);
    };

    const onTouchStart = (event) => {
      stopInertia();

      if (
        event.touches.length !== 1 ||
        frame.dataset.stipViewportLayer === "1"
      ) {
        reset();
        return;
      }

      const touch = event.touches[0];
      const now = hostWindow.performance?.now?.() || Date.now();

      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        lastAt: now,
        axis: "",
        velocity: 0,
        relayed: false,
      };
    };

    const onTouchMove = (event) => {
      if (
        !gesture ||
        event.touches.length !== 1 ||
        frame.dataset.stipViewportLayer === "1"
      )
        return;

      const touch = event.touches[0];
      const dxTotal = touch.clientX - gesture.startX;
      const dyTotal = touch.clientY - gesture.startY;
      const ax = Math.abs(dxTotal);
      const ay = Math.abs(dyTotal);

      if (!gesture.axis) {
        if (Math.max(ax, ay) < 5) return;

        // There is no page-level horizontal swipe here anymore. Only a clearly
        // horizontal gesture is left alone; every vertical/diagonal gesture
        // belongs to the parent page scroll.
        gesture.axis = ax > ay * 1.55 ? "x" : "y";
      }

      if (gesture.axis !== "y") return;

      const now = hostWindow.performance?.now?.() || Date.now();
      const deltaY = gesture.lastY - touch.clientY;
      const dt = Math.max(1, now - gesture.lastAt);

      gesture.lastX = touch.clientX;
      gesture.lastY = touch.clientY;
      gesture.lastAt = now;

      if (Math.abs(deltaY) < 0.1) return;

      // Genuine scrollable sheets/dialogs inside the embedded page keep their
      // own native vertical scroll until they reach an edge.
      if (scrollableAncestor(doc, event.target, deltaY)) return;
      if (!parentCanScroll(hostWindow, deltaY)) return;

      hostWindow.scrollBy(0, deltaY);
      gesture.relayed = true;

      const instantVelocity = deltaY / dt;
      gesture.velocity =
        gesture.velocity * 0.72 + instantVelocity * 0.28;

      // Cancelling the child default is essential on Android Chrome: otherwise
      // the iframe can claim the gesture even though its own document is locked.
      if (event.cancelable) event.preventDefault();
    };

    const finishTouch = () => {
      const velocity =
        gesture?.axis === "y" && gesture?.relayed
          ? gesture.velocity
          : 0;
      reset();
      startInertia(velocity);
    };

    const onWheel = (event) => {
      if (frame.dataset.stipViewportLayer === "1") return;

      const deltaY = Number(event.deltaY || 0);
      if (!deltaY || scrollableAncestor(doc, event.target, deltaY)) return;
      if (!parentCanScroll(hostWindow, deltaY)) return;

      hostWindow.scrollBy(0, deltaY);
      if (event.cancelable) event.preventDefault();
    };

    const previousOverscroll =
      doc.documentElement.style.overscrollBehaviorY;
    doc.documentElement.style.overscrollBehaviorY = "none";

    doc.addEventListener("touchstart", onTouchStart, {
      passive: true,
      capture: true,
    });
    doc.addEventListener("touchmove", onTouchMove, {
      passive: false,
      capture: true,
    });
    doc.addEventListener("touchend", finishTouch, {
      passive: true,
      capture: true,
    });
    doc.addEventListener("touchcancel", finishTouch, {
      passive: true,
      capture: true,
    });
    doc.addEventListener("wheel", onWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      stopInertia();
      doc.removeEventListener("touchstart", onTouchStart, true);
      doc.removeEventListener("touchmove", onTouchMove, true);
      doc.removeEventListener("touchend", finishTouch, true);
      doc.removeEventListener("touchcancel", finishTouch, true);
      doc.removeEventListener("wheel", onWheel, true);
      doc.documentElement.style.overscrollBehaviorY = previousOverscroll;
      reset();
    };
  }

  window.STIPTouchCore = Object.freeze({
    bindEmbeddedVerticalScroll,
  });
})();
