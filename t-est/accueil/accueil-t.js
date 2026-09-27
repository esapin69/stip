(() => {
  "use strict";
  const frame = document.querySelector(".t-est-home-frame");
  if (!frame) return;
  function enhance() {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      window.STIPTNav?.guard(doc, frame.contentWindow.location.href);
      if (doc.getElementById("t-est-premium-month")) return;
      const style = doc.createElement("style");
      style.id = "t-est-premium-month";
      style.textContent = `
        .hc-month-context-master{position:relative;margin-top:20px!important;padding-top:4px!important}
        .hc-month-context-master .hc-section-divider,.hc-month-context-master .hc-section-title{letter-spacing:.16em!important;font-weight:850!important;color:#607780!important}
        .hc-planning-month-subblock{border:1px solid rgba(18,74,86,.12)!important;border-radius:30px!important;background:linear-gradient(155deg,rgba(255,255,255,.98),rgba(246,250,251,.96))!important;box-shadow:0 18px 50px rgba(20,61,72,.10),0 2px 8px rgba(20,61,72,.06)!important;overflow:hidden}
        .hc-month-header,.hc-planning-month-header{padding:14px 12px 10px!important}
        .hc-month-title,.hc-planning-month-title{font-weight:950!important;letter-spacing:-.035em!important;color:#123f52!important}
        .hc-month-grid,.hc-planning-month-grid{gap:7px!important;padding:4px 12px 14px!important}
        .hc-month-day,.hc-planning-month-day{border:1px solid rgba(23,72,84,.06)!important;border-radius:19px!important;background:linear-gradient(180deg,#f4f8f9,#edf3f5)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 3px 9px rgba(24,64,74,.035)!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease!important}
        .hc-month-day[aria-current="date"],.hc-planning-month-day[aria-current="date"],.hc-month-day.is-selected,.hc-planning-month-day.is-selected{border:2px solid #1298a8!important;background:linear-gradient(180deg,#f8ffff,#e9f7f8)!important;box-shadow:0 0 0 4px rgba(18,152,168,.10),0 9px 22px rgba(18,90,104,.12)!important;transform:translateY(-1px)}
        .hc-month-day strong,.hc-planning-month-day strong{font-weight:950!important;letter-spacing:-.04em!important}
        .hc-month-nav button,.hc-planning-month-nav button{background:rgba(255,255,255,.92)!important;border:1px solid rgba(17,71,84,.12)!important;box-shadow:0 6px 18px rgba(17,71,84,.08)!important}
        @media(max-width:520px){.hc-planning-month-subblock{border-radius:26px!important}.hc-month-grid,.hc-planning-month-grid{gap:6px!important;padding-left:10px!important;padding-right:10px!important}.hc-month-day,.hc-planning-month-day{border-radius:17px!important}}
      `;
      doc.head.appendChild(style);
    } catch {}
  }
  frame.addEventListener("load", () => { enhance(); setTimeout(enhance,500); setTimeout(enhance,1500); });
  setInterval(enhance,2000);
})();
