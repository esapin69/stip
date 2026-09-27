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
      const calendar = grid.closest(".stip-month-calendar");
      calendar?.querySelectorAll(".stip-month-weekdays, .hc-date-jump-weekdays").forEach((el) => el.remove());
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
/* T-EST — fusion validée :
   carte mensuelle native conservée + semaines numérotées + jours répétés.
   Aucune surcharge locale des icônes. */
.stip-month-weekdays{display:none!important}
.stip-month-calendar .stip-month-grid{row-gap:5px!important}

.t-est-week-separator{
  grid-column:1/-1!important;
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;
  align-items:center!important;
  gap:9px!important;
  min-height:18px!important;
  margin:7px 2px 0!important;
  padding:0 3px!important;
  pointer-events:none!important;
}
.t-est-week-separator:first-child{margin-top:0!important}
.t-est-week-separator:before,
.t-est-week-separator:after{
  content:""!important;
  height:1px!important;
  border-radius:999px!important;
  background:linear-gradient(90deg,transparent,rgba(20,112,132,.22))!important;
}
.t-est-week-separator:after{
  background:linear-gradient(90deg,rgba(20,112,132,.22),transparent)!important;
}
.t-est-week-separator>span{
  display:block!important;
  padding:2px 7px!important;
  border:1px solid rgba(20,112,132,.10)!important;
  border-radius:999px!important;
  background:rgba(247,252,253,.92)!important;
  color:#6e858d!important;
  font-size:.56rem!important;
  line-height:1!important;
  font-weight:950!important;
  letter-spacing:.07em!important;
}

.t-est-week-weekdays{
  grid-column:1/-1!important;
  display:grid!important;
  grid-template-columns:repeat(7,minmax(0,1fr))!important;
  align-items:center!important;
  gap:4px!important;
  margin:1px 0 2px!important;
  padding:0!important;
  color:#748890!important;
  font-size:.58rem!important;
  line-height:1!important;
  font-weight:950!important;
  letter-spacing:.035em!important;
  pointer-events:none!important;
}
.t-est-week-weekdays>span{
  display:block!important;
  min-width:0!important;
  padding:3px 0 2px!important;
  text-align:center!important;
}

/* Une semaine grandit seulement si son contenu le demande.
   Les jours de la même ligne restent naturellement de même hauteur grâce à CSS Grid. */
.stip-month-calendar .stip-month-day{
  min-height:0!important;
  height:auto!important;
  grid-template-rows:auto minmax(26px,auto) auto!important;
}
.stip-month-calendar .stip-month-day:not(.has-event){
  grid-template-rows:auto minmax(26px,auto)!important;
}
.stip-month-calendar .stip-month-events:empty{
  display:none!important;
  min-height:0!important;
  height:0!important;
  margin:0!important;
  padding:0!important;
}
`;
      enhanceWeekRows(doc);
    } catch {}
  }
  frame.addEventListener("load", () => { enhance(); setTimeout(enhance,250); setTimeout(enhance,900); });
  setInterval(enhance,1500);
})();
