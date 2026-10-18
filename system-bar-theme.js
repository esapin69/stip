/* Chrome / Android system chrome: derive the supported browser theme from the visible page.
   This does not control Android's own gesture navigation strip or browser dark-mode settings. */
(() => {
  "use strict";

  const FALLBACK = "#f3f6f8";
  let frame = 0;

  function usable(color) {
    const value = String(color || "").trim();
    if (!value || value === "transparent" || value === "inherit" || value === "initial") return "";
    if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(value)) return "";
    if (/^rgba\(/i.test(value) && !/[,\s]1(?:\.0+)?\s*\)$/i.test(value)) return "";
    return typeof CSS === "undefined" || CSS.supports("color", value) ? value : "";
  }

  function activeSurface() {
    const app = document.getElementById("appView");
    if (app && getComputedStyle(app).display !== "none") {
      const views = app.querySelectorAll(".view");
      for (const view of views) {
        if (getComputedStyle(view).display !== "none") return view;
      }
      return app;
    }
    const login = document.getElementById("loginView");
    if (login && getComputedStyle(login).display !== "none") return login;
    return document.body;
  }

  function currentColor() {
    const root = document.documentElement;
    const surface = activeSurface();
    const surfaceStyle = surface && getComputedStyle(surface);
    const rootStyle = getComputedStyle(root);

    return (
      usable(surface?.getAttribute("data-stip-system-bar-color")) ||
      usable(surfaceStyle?.getPropertyValue("--stip-system-bar-color")) ||
      usable(document.body?.getAttribute("data-stip-system-bar-color")) ||
      usable(root.getAttribute("data-stip-system-bar-color")) ||
      usable(surfaceStyle?.backgroundColor) ||
      usable(surfaceStyle?.getPropertyValue("--stip-bg")) ||
      usable(rootStyle.getPropertyValue("--stip-system-bar-color")) ||
      usable(rootStyle.getPropertyValue("--stip-bg")) ||
      FALLBACK
    );
  }

  function refresh() {
    frame = 0;
    const color = currentColor();
    let tag = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "theme-color";
      document.head.appendChild(tag);
    }
    if (tag.content !== color) tag.content = color;
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(refresh);
  }

  function start() {
    const options = { attributes: true, attributeFilter: ["class", "style", "data-stip-system-bar-color"] };
    const observer = new MutationObserver(schedule);
    const targets = [
      document.documentElement,
      document.body,
      document.getElementById("appView"),
      document.getElementById("loginView"),
      ...document.querySelectorAll("#appView .view")
    ];
    for (const target of targets) if (target) observer.observe(target, options);

    for (const event of [
      "stip:route", "stip:login-success", "stip:session-ended",
      "stip:session-ready", "stip:home-rendered", "hashchange", "popstate", "pageshow"
    ]) window.addEventListener(event, schedule, { passive: true });

    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
