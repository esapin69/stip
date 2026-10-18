(() => {
  "use strict";
  // The same actual-date component is used for all GHE date-group headings.
  if (window.GHEDateSeparator) return;
  const esc = text => String(text ?? "").replace(/[&<>"']/g,
    c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function parts(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
    const day = new Date(iso + "T12:00:00Z");
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== iso) return null;
    const f = new Intl.DateTimeFormat("fr-FR", {weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
    const values = Object.fromEntries(f.formatToParts(day).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
    return {iso,day:Number(values.day),weekday:values.weekday.toUpperCase(),
      month:values.month.toUpperCase(),label:f.format(day)};
  }
  function calendar(iso) {
    const p = parts(iso);
    return p ? '<span class="ghe-smart-calendar-glyph" aria-hidden="true"><span class="ghe-smart-calendar-cap"></span><b>'+p.day+'</b></span>' : "";
  }
  function separator(iso,{className="",count=0}={}) {
    const p = parts(iso);
    if (!p) return "";
    const extra = String(className||"").replace(/[^a-zA-Z0-9_ -]/g,"").trim();
    const badge = Number.isInteger(count)&&count>1?'<small class="ghe-date-separator-count">×'+count+'</small>':"";
    return '<div class="ghe-date-separator'+(extra?" "+extra:"")+'" role="separator" data-ghe-date="'+p.iso+'" aria-label="'+esc(p.label)+'">'+
      '<span class="ghe-date-separator-weekday">'+esc(p.weekday)+'</span>'+calendar(iso)+
      '<span class="ghe-date-separator-month">'+esc(p.month)+'</span>'+badge+'</div>';
  }
  window.GHEDateSeparator=Object.freeze({parts,calendar,separator});
})();
