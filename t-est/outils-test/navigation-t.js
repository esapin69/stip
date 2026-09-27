(() => {
  "use strict";
  const mirrors = [
    { match: u => u.pathname === "/" && (!u.hash || u.hash === "#/home"), target: "/t-est/accueil/" }
  ];
  function targetFor(raw, base = location.href) {
    try {
      const u = new URL(raw, base);
      if (u.origin !== location.origin) return null;
      if (u.pathname.startsWith("/t-est/")) return null;
      const found = mirrors.find(x => x.match(u));
      return found?.target || false;
    } catch { return false; }
  }
  function guard(doc, base) {
    if (!doc || doc.documentElement.dataset.tNavGuard === "1") return;
    doc.documentElement.dataset.tNavGuard = "1";
    doc.addEventListener("click", e => {
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      const t = targetFor(a.getAttribute("href"), base);
      if (t === null) return;
      e.preventDefault();
      if (t) top.location.href = t;
      else {
        a.setAttribute("aria-disabled", "true");
        const old = a.getAttribute("title") || "";
        a.setAttribute("title", "Pas encore disponible dans T-est");
        a.animate?.([{opacity:.45},{opacity:1}],{duration:360});
        setTimeout(() => { if (old) a.setAttribute("title",old); else a.removeAttribute("title"); },1800);
      }
    }, true);
  }
  window.STIPTNav = { guard, targetFor };
  guard(document, location.href);
})();
