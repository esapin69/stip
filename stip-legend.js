(() => {
  "use strict";

  if (window.STIPLegend) return;

  function keyOf(button) {
    return String(button?.dataset?.stipLegendKey || "").trim();
  }

  function select(button) {
    if (!button) return;
    const root = button.closest(".stip-legend");
    const next = button.getAttribute("aria-pressed") !== "true";
    root
      ?.querySelectorAll(".stip-legend-item[data-stip-legend-key]")
      .forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", String(next));
    button.dispatchEvent(
      new CustomEvent("stip:legend-select", {
        bubbles: true,
        detail: { key: keyOf(button), selected: next },
      }),
    );
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(
      ".stip-legend-item[data-stip-legend-key]",
    );
    if (!button) return;
    select(button);
  });

  window.STIPLegend = { select, keyOf };
})();
