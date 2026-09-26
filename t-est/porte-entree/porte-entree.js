(() => {
  "use strict";

  window.addEventListener(
    "stip:login-success",
    () => location.replace(new URL("./", document.baseURI).href),
    { once: true }
  );
})();