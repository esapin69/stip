(() => {
  "use strict";

  const DEFAULT_DEAD_ZONE = 12;
  const DEFAULT_HORIZONTAL_RATIO = 1.5;

  function axis(dx, dy, options = {}) {
    const ax = Math.abs(Number(dx) || 0);
    const ay = Math.abs(Number(dy) || 0);
    const deadZone = Math.max(
      0,
      Number(options.deadZone ?? DEFAULT_DEAD_ZONE) || DEFAULT_DEAD_ZONE,
    );
    const horizontalRatio = Math.max(
      1.05,
      Number(options.horizontalRatio ?? DEFAULT_HORIZONTAL_RATIO) ||
        DEFAULT_HORIZONTAL_RATIO,
    );
    if (Math.max(ax, ay) < deadZone) return "";
    return ax >= ay * horizontalRatio ? "x" : "y";
  }

  function clamp(value, min, max) {
    return Math.max(Number(min) || 0, Math.min(Number(max) || 0, Number(value) || 0));
  }

  function reducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

  function velocity(previousValue, previousTime, value, time) {
    const dt = Math.max(1, (Number(time) || 0) - (Number(previousTime) || 0));
    return ((Number(value) || 0) - (Number(previousValue) || 0)) / dt;
  }

  function shouldCommit({
    dx = 0,
    dy = 0,
    width = 1,
    velocityX = 0,
    minDistance = 44,
    progress = 0.14,
    flickDistance = 24,
    flickVelocity = 0.5,
    horizontalRatio = 1.25,
  } = {}) {
    const ax = Math.abs(Number(dx) || 0);
    const ay = Math.abs(Number(dy) || 0);
    if (ax <= ay * Math.max(1.05, Number(horizontalRatio) || 1.25)) return false;
    const distanceThreshold = Math.max(
      Number(minDistance) || 44,
      Math.max(1, Number(width) || 1) * (Number(progress) || 0.14),
    );
    if (ax >= distanceThreshold) return true;
    return (
      ax >= Math.max(1, Number(flickDistance) || 24) &&
      Math.abs(Number(velocityX) || 0) >= Math.max(0.1, Number(flickVelocity) || 0.5)
    );
  }

  window.STIPGesture = Object.freeze({
    axis,
    clamp,
    reducedMotion,
    velocity,
    shouldCommit,
    defaults: Object.freeze({
      deadZone: DEFAULT_DEAD_ZONE,
      horizontalRatio: DEFAULT_HORIZONTAL_RATIO,
    }),
  });
})();
