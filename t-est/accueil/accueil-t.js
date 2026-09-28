(() => {
  "use strict";
  const frame = document.querySelector(".t-est-home-frame");
  if (!frame) return;

  function syncSharedMonthTable() {
    try {
      const doc = frame.contentDocument;
      const api = frame.contentWindow?.STIPMonthTable;
      if (!doc || !api?.enhance) return;
      api.enhance(doc);
    } catch {}
  }

  frame.addEventListener("load", () => {
    syncSharedMonthTable();
    setTimeout(syncSharedMonthTable, 250);
    setTimeout(syncSharedMonthTable, 900);
  });
})();
