(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data",
    STORE = "stip_session_v1",
    SHIFT = {
      M: { start: "06:30", end: "14:20", label: "Matin" },
      J: { start: "08:30", end: "16:20", label: "Journée" },
      J4: { start: "10:10", end: "18:00", label: "J4" },
      S: { start: "14:00", end: "21:30", label: "Soir" },
      N: { start: "21:00", end: "06:50", label: "Nuit" },
    };
  let data = null,
    loading = null,
    lastFetch = 0;

  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const digits = (v) => String(v || "").replace(/\D/g, "");
  const tel = (v) => {
    const d = digits(v);
    if (!d) return "";
    if (d.startsWith("33")) return `tel:+${d}`;
    return `tel:${d}`;
  };
  const personName = (a = {}) =>
    window.STIPName?.format?.(a) ||
    [a.prenom, a.nom].filter(Boolean).join(" ").trim() ||
    "Chef d’équipe";

  function parisParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date),
      get = (type) => parts.find((x) => x.type === type)?.value || "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      minutes: Number(get("hour")) * 60 + Number(get("minute")),
    };
  }
  function addDay(iso, step) {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + step);
    return d.toISOString().slice(0, 10);
  }
  function hmMinutes(v) {
    const [h, m] = String(v || "00:00").split(":").map(Number);
    return h * 60 + m;
  }
  function baseCode(v) {
    const c = String(v || "")
      .trim()
      .toUpperCase()
      .replace(/\*+$/, "");
    return SHIFT[c] ? c : "";
  }
  function isCurrent(item, now) {
    const code = baseCode(item?.code),
      meta = SHIFT[code];
    if (!meta) return false;
    const start = hmMinutes(meta.start),
      end = hmMinutes(meta.end),
      date = String(item?.date || "").slice(0, 10);
    if (end > start)
      return date === now.date && now.minutes >= start && now.minutes < end;
    return (
      (date === now.date && now.minutes >= start) ||
      (date === addDay(now.date, -1) && now.minutes < end)
    );
  }
  function nextStartKey(item) {
    const code = baseCode(item?.code),
      meta = SHIFT[code];
    if (!meta) return "";
    return `${String(item?.date || "").slice(0, 10)} ${meta.start}`;
  }
  function currentKey(now) {
    const h = String(Math.floor(now.minutes / 60)).padStart(2, "0"),
      m = String(now.minutes % 60).padStart(2, "0");
    return `${now.date} ${h}:${m}`;
  }
  function dutyState() {
    const items = (data?.items || []).filter((x) => baseCode(x?.code)),
      now = parisParts(),
      current = items.filter((x) => isCurrent(x, now)),
      key = currentKey(now),
      upcoming = items
        .filter((x) => {
          const k = nextStartKey(x);
          return k && k > key;
        })
        .sort((a, b) => nextStartKey(a).localeCompare(nextStartKey(b)));
    return { current, next: upcoming[0] || null };
  }

  async function fetchDuty(force = false) {
    if (!localStorage.getItem(STORE)) return null;
    if (!force && data && Date.now() - lastFetch < 5 * 60 * 1000) return data;
    if (loading) return loading;
    loading = fetch(API, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": localStorage.getItem(STORE) || "",
      },
      body: JSON.stringify({ action: "duty_chiefs" }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) throw Error(j.error || "Chefs indisponibles.");
        data = j;
        lastFetch = Date.now();
        render();
        return j;
      })
      .catch(() => null)
      .finally(() => (loading = null));
    return loading;
  }

  function callButton(item) {
    const a = item?.agents || {},
      href = tel(a.telephone),
      name = personName(a),
      code = baseCode(item.code),
      meta = SHIFT[code];
    return `<div class="hc-duty-chief-person">
      <div class="hc-duty-chief-copy">
        <strong>${esc(name)}</strong>
        <small>${esc(meta?.start || "")}–${esc(meta?.end || "")} · ${esc(meta?.label || code)}</small>
      </div>
      ${href ? `<a class="hc-duty-chief-call" href="${esc(href)}" aria-label="Appeler ${esc(name)}"><span>☎</span><b>Appeler</b></a>` : '<span class="hc-duty-chief-no-phone">N° indisponible</span>'}
    </div>`;
  }

  function markup() {
    if (!data) return "";
    const { current, next } = dutyState();
    if (current.length) {
      return `<section class="hc-duty-chief-card is-present" data-duty-chief>
        <header><span class="hc-duty-chief-icon">🎨</span><div><small>CHEF${current.length > 1 ? "S" : ""} PRÉSENT${current.length > 1 ? "S" : ""} MAINTENANT</small><strong>${current.length > 1 ? `${current.length} chefs joignables` : "Chef d’équipe"}</strong></div><i>●</i></header>
        <div class="hc-duty-chief-list">${current.map(callButton).join("")}</div>
      </section>`;
    }
    if (next) {
      const a = next.agents || {},
        code = baseCode(next.code),
        meta = SHIFT[code],
        sameDay = String(next.date).slice(0, 10) === parisParts().date,
        when = sameDay
          ? `à ${meta.start}`
          : `${new Date(String(next.date).slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à ${meta.start}`;
      return `<section class="hc-duty-chief-card is-next" data-duty-chief>
        <header><span class="hc-duty-chief-icon">🎨</span><div><small>AUCUN CHEF PRÉSENT MAINTENANT</small><strong>Prochain : ${esc(personName(a))}</strong><p>${esc(when)}</p></div></header>
      </section>`;
    }
    return `<section class="hc-duty-chief-card is-next" data-duty-chief><header><span class="hc-duty-chief-icon">🎨</span><div><small>CHEF D’ÉQUIPE</small><strong>Aucune présence planifiée trouvée</strong></div></header></section>`;
  }

  function render() {
    const root = document.querySelector("#homeView .hs-home"),
      mode = root?.querySelector(".hc-home-mode-content");
    root?.querySelector("[data-duty-chief]")?.remove();
    if (!root || !mode || mode.dataset.homeModeCurrent !== "planning") return;
    const html = markup();
    if (!html) return;
    mode.insertAdjacentHTML("afterbegin", html);
  }

  const style = document.createElement("style");
  style.textContent = `
    .hc-duty-chief-card{
      margin:0 0 12px;
      padding:12px;
      border:1px solid rgba(104,64,159,.20);
      border-radius:20px;
      background:linear-gradient(145deg,#fff,#f8f3ff);
      box-shadow:0 10px 24px rgba(58,37,86,.08);
      color:#173e4b;
    }
    .hc-duty-chief-card>header{
      display:flex;
      align-items:center;
      gap:10px;
    }
    .hc-duty-chief-card>header>div{min-width:0;flex:1}
    .hc-duty-chief-icon{
      width:42px;height:42px;flex:0 0 42px;
      display:grid;place-items:center;
      border-radius:14px;
      background:#efe4fb;
      font-size:1.3rem;
      box-shadow:inset 0 0 0 1px rgba(112,64,159,.12);
    }
    .hc-duty-chief-card header small,
    .hc-duty-chief-card header strong{display:block}
    .hc-duty-chief-card header small{
      color:#70409f;
      font-size:.61rem;
      font-weight:950;
      letter-spacing:.08em;
    }
    .hc-duty-chief-card header strong{margin-top:2px;font-size:.94rem}
    .hc-duty-chief-card header p{margin:2px 0 0;color:#74878e;font-size:.72rem;font-weight:800}
    .hc-duty-chief-card.is-present>header>i{
      color:#179b68;
      font-style:normal;
      font-size:.72rem;
      text-shadow:0 0 10px rgba(23,155,104,.45);
    }
    .hc-duty-chief-list{display:grid;gap:7px;margin-top:10px}
    .hc-duty-chief-person{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      align-items:center;
      gap:8px;
      padding:9px 9px 9px 11px;
      border:1px solid rgba(112,64,159,.13);
      border-radius:15px;
      background:#fff;
    }
    .hc-duty-chief-copy strong,.hc-duty-chief-copy small{display:block}
    .hc-duty-chief-copy strong{font-size:.83rem}
    .hc-duty-chief-copy small{margin-top:2px;color:#778991;font-size:.66rem;font-weight:800}
    .hc-duty-chief-call{
      min-height:40px;
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:0 11px;
      border-radius:12px;
      background:#70409f;
      color:#fff!important;
      text-decoration:none!important;
      font-size:.72rem;
      font-weight:950;
      box-shadow:0 6px 14px rgba(112,64,159,.2);
    }
    .hc-duty-chief-call span{font-size:.9rem}
    .hc-duty-chief-no-phone{color:#8b999e;font-size:.64rem;font-weight:800}
    @media(max-width:390px){
      .hc-duty-chief-card{padding:10px}
      .hc-duty-chief-person{grid-template-columns:minmax(0,1fr) auto}
      .hc-duty-chief-call b{display:none}
      .hc-duty-chief-call{width:40px;padding:0;justify-content:center}
    }
  `;
  document.head.appendChild(style);

  window.addEventListener("stip:home-rendered", () => {
    render();
    fetchDuty();
  });
  window.addEventListener("stip:session-ready", () => fetchDuty(true));
  window.addEventListener("stip:session-ended", () => {
    data = null;
    lastFetch = 0;
    render();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) fetchDuty();
  });
  setInterval(() => {
    render();
    if (Date.now() - lastFetch > 5 * 60 * 1000) fetchDuty();
  }, 30000);
})();