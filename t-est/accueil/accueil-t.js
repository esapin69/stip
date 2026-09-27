(() => {
  "use strict";
  const frame = document.querySelector(".t-est-home-frame");
  if (!frame) return;
  function isoWeekNumber(iso) {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return 0;
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1, 12);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  function enhanceWeekRows(doc) {
    doc.querySelectorAll(".stip-month-calendar .stip-month-grid").forEach((grid) => {
      const days = [...grid.querySelectorAll(":scope > .stip-month-day[data-cal-day]")];
      if (!days.length) return;
      const signature = days.map((day) => day.dataset.calDay || "").join("|");
      if (
        grid.dataset.tEstWeekRows === signature &&
        grid.querySelector(":scope > .t-est-week-separator") &&
        grid.querySelector(":scope > .t-est-week-weekdays")
      ) return;
      grid.querySelectorAll(":scope > .t-est-week-separator, :scope > .t-est-week-weekdays").forEach((el) => el.remove());
      days.forEach((day, index) => {
        const iso = day.dataset.calDay || "";
        const date = new Date(`${iso}T12:00:00`);
        if (Number.isNaN(date.getTime())) return;
        if (index !== 0 && date.getDay() !== 1) return;
        const week = isoWeekNumber(iso);
        if (!week) return;
        const separator = doc.createElement("div");
        separator.className = "t-est-week-separator";
        separator.setAttribute("role", "separator");
        separator.setAttribute("aria-label", `Semaine ${week}`);
        separator.innerHTML = `<span>S${week}</span>`;
        const weekdays = doc.createElement("div");
        weekdays.className = "t-est-week-weekdays";
        weekdays.setAttribute("aria-hidden", "true");
        weekdays.innerHTML = "<span>LU</span><span>MA</span><span>ME</span><span>JE</span><span>VE</span><span>SA</span><span>DI</span>";
        grid.insertBefore(separator, day);
        grid.insertBefore(weekdays, day);
      });
      grid.dataset.tEstWeekRows = signature;
    });
  }
  function enhance() {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      window.STIPTNav?.guard(doc, frame.contentWindow.location.href);
      let style = doc.getElementById("t-est-premium-month");
      if (!style) { style = doc.createElement("style"); style.id = "t-est-premium-month"; doc.head.appendChild(style); }
      style.textContent = `
/* T-EST — MONTH PREMIUM V2. Visual only: no calendar/data logic changed. */
.hc-month-context-master{position:relative!important;margin-top:24px!important;padding-top:8px!important}
.hc-month-context-master .hc-section-divider,.hc-month-context-master .hc-section-title{position:relative!important;z-index:1!important;margin-bottom:10px!important;color:#657b84!important;font-size:.74rem!important;line-height:1!important;font-weight:950!important;letter-spacing:.19em!important;text-transform:uppercase!important}
.hc-month-context-master .hc-section-divider:before,.hc-month-context-master .hc-section-divider:after{opacity:.62!important}
.hc-planning-month-subblock{position:relative!important;border:1px solid rgba(21,67,81,.11)!important;border-radius:32px!important;background:linear-gradient(160deg,#ffffff 0%,#fbfdfe 52%,#f3f8fa 100%)!important;box-shadow:0 24px 60px rgba(16,57,70,.13),0 5px 16px rgba(16,57,70,.06),inset 0 1px 0 #fff!important;overflow:hidden!important;isolation:isolate!important}
.hc-planning-month-subblock:before{content:""!important;position:absolute!important;z-index:-1!important;inset:0 0 auto!important;height:150px!important;background:radial-gradient(ellipse at 50% -15%,rgba(35,167,190,.13),transparent 66%)!important;pointer-events:none!important}
.stip-month-nav{min-height:76px!important;padding:12px 15px 8px!important;grid-template-columns:54px minmax(0,1fr) 54px!important;gap:12px!important}
.stip-month-nav>button{width:52px!important;height:52px!important;border:1px solid rgba(20,72,87,.11)!important;background:linear-gradient(145deg,#fff,#f0f6f8)!important;color:#174b5d!important;box-shadow:0 8px 20px rgba(20,62,76,.10),inset 0 1px 0 #fff!important;font-size:1.55rem!important}
.stip-month-nav>div{display:flex!important;flex-direction:column!important;align-items:center!important;gap:3px!important}
.stip-month-nav>strong,.stip-month-nav>div>strong{color:#103f53!important;font-size:clamp(1.25rem,5vw,1.55rem)!important;font-weight:950!important;letter-spacing:-.045em!important}
.stip-month-nav>div>small{color:#1494aa!important;font-size:.58rem!important;letter-spacing:.13em!important}
.stip-month-weekdays{display:none!important}
.stip-month-calendar .stip-month-grid{row-gap:5px!important}
.t-est-week-separator{grid-column:1/-1!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:center!important;gap:9px!important;min-height:18px!important;margin:7px 2px 0!important;padding:0 3px!important;pointer-events:none!important}
.t-est-week-separator:first-child{margin-top:0!important}
.t-est-week-separator:before,.t-est-week-separator:after{content:""!important;height:1px!important;border-radius:999px!important;background:linear-gradient(90deg,transparent,rgba(20,112,132,.22))!important}
.t-est-week-separator:after{background:linear-gradient(90deg,rgba(20,112,132,.22),transparent)!important}
.t-est-week-separator>span{display:block!important;padding:2px 7px!important;border:1px solid rgba(20,112,132,.10)!important;border-radius:999px!important;background:rgba(247,252,253,.92)!important;color:#6e858d!important;font-size:.56rem!important;line-height:1!important;font-weight:950!important;letter-spacing:.07em!important}
.t-est-week-weekdays{grid-column:1/-1!important;display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr))!important;align-items:center!important;gap:5px!important;margin:1px 0 2px!important;padding:0!important;color:#748890!important;font-size:.58rem!important;line-height:1!important;font-weight:950!important;letter-spacing:.035em!important;pointer-events:none!important}
.t-est-week-weekdays>span{display:block!important;min-width:0!important;padding:3px 0 2px!important;text-align:center!important}
.stip-month-calendar{padding:0 12px 10px!important;gap:6px!important}
.stip-month-calendar .stip-month-day{position:relative!important;min-height:70px!important;border:1px solid rgba(19,66,80,.055)!important;border-radius:17px!important;background:linear-gradient(155deg,rgba(249,252,253,.98),rgba(236,243,246,.96))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 3px 9px rgba(17,61,74,.035)!important;overflow:hidden!important;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease!important}
.stip-month-calendar .stip-month-day:after{content:"";position:absolute;inset:auto 10px 0;height:2px;border-radius:99px;background:linear-gradient(90deg,transparent,rgba(21,117,137,.10),transparent);opacity:.65}
.stip-month-calendar .stip-month-day-number{font-size:1.13rem!important;line-height:1!important;font-weight:950!important;letter-spacing:-.045em!important;color:#123f52!important}
.stip-month-calendar .stip-month-day.is-weekend{background:linear-gradient(155deg,#fafcfd,#f1f5f7)!important}
.stip-month-calendar .stip-month-day.is-weekend .stip-month-day-number{color:#bb2c3e!important}
.stip-month-calendar .stip-month-dot{width:18px!important;height:18px!important;border:2px solid rgba(255,255,255,.92)!important;box-shadow:0 4px 9px rgba(20,62,78,.14),inset 0 0 0 1px rgba(0,0,0,.05)!important}
.stip-month-calendar .stip-month-events{font-size:1.38rem!important;filter:drop-shadow(0 2px 2px rgba(18,55,65,.08))!important}
.stip-month-calendar .stip-month-day.is-today{border:2px solid rgba(13,148,169,.42)!important;background:linear-gradient(150deg,#f7feff,#eaf7f9)!important;box-shadow:0 0 0 4px rgba(14,151,172,.07),0 9px 20px rgba(16,93,108,.10),inset 0 1px 0 #fff!important}
.stip-month-calendar .stip-month-day.is-selected{border:2px solid #0b91a9!important;background:linear-gradient(145deg,#f8ffff 0%,#e4f6f8 100%)!important;box-shadow:0 0 0 4px rgba(11,145,169,.11),0 13px 27px rgba(11,111,130,.16),inset 0 1px 0 #fff!important}
.stip-month-calendar .stip-month-day.is-selected:before{content:""!important;position:absolute!important;left:10px!important;right:10px!important;bottom:5px!important;height:3px!important;border-radius:99px!important;background:linear-gradient(90deg,#16b6c9,#087e9b)!important;box-shadow:0 2px 7px rgba(8,126,155,.25)!important}
.hc-planning-month-subblock .hc-month-compare,.hc-planning-month-subblock [data-month-compare],.hc-planning-month-subblock a[href*="compare"],.hc-planning-month-subblock button[class*="compare"]{margin:8px 15px 13px!important;padding-top:13px!important;border-top:1px solid rgba(18,76,91,.08)!important;color:#164b59!important;font-weight:950!important;letter-spacing:-.02em!important}
@media(max-width:520px){
 .hc-planning-month-subblock{border-radius:28px!important}
 .stip-month-nav{min-height:70px!important;grid-template-columns:50px minmax(0,1fr) 50px!important;padding-inline:12px!important}
 .stip-month-nav>button{width:48px!important;height:48px!important}
 .stip-month-calendar{padding-inline:10px!important;gap:5px!important}
 .stip-month-weekdays{padding-inline:11px!important}
 .stip-month-calendar .stip-month-day{min-height:68px!important;border-radius:16px!important}
}
@media(min-width:760px){.hc-planning-month-subblock{max-width:820px!important;margin-inline:auto!important}.stip-month-calendar .stip-month-day{min-height:84px!important}}
      `;
      enhanceWeekRows(doc);
    } catch {}
  }
  frame.addEventListener("load", () => { enhance(); setTimeout(enhance,250); setTimeout(enhance,900); });
  setInterval(enhance,1500);
})();
