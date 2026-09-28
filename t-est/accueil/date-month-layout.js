(() => {
  "use strict";
  const frame = document.querySelector(".t-est-home-frame");
  if (!frame) return;

  function apply() {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;

      const date = doc.querySelector(".hc-home-date-kicker");
      const month = doc.querySelector(".hc-month-context-master");
      if (!date || !month) return;

      const dateTitle = doc.querySelector(".hc-home-today-separator");
      const anchor = dateTitle || date;
      const parent = anchor.parentElement;
      if (!parent || month.parentElement !== parent) return;

      // T-est layout: DATE -> current date title -> MONTH.
      // Everything that previously sat between the date heading and the month
      // (weekly strip, selected-day detail, today/tomorrow event blocks) is hidden,
      // not deleted from the production engine.
      let node = anchor.nextElementSibling;
      while (node && node !== month) {
        node.dataset.tEstBetweenDateMonth = "1";
        node.hidden = true;
        node.style.setProperty("display", "none", "important");
        node = node.nextElementSibling;
      }

      month.dataset.tEstDirectAfterDate = "1";
      month.style.setProperty("margin-top", "18px", "important");
    } catch {}
  }

  frame.addEventListener("load", () => {
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 900);
  });
  setInterval(apply, 1200);
})();
