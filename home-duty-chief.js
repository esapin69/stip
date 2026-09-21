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
        .sort((a, b) => nextStartKey(a).localeCompare(nextStartKey(b))),
      today = items
        .filter((x) => String(x?.date || "").slice(0, 10) === now.date)
        .sort((a, b) => nextStartKey(a).localeCompare(nextStartKey(b)));
    return { current, next: upcoming[0] || null, today, now };
  }

  function dayLabel(iso, todayIso) {
    const value = String(iso || "").slice(0, 10);
    if (!value) return "";
    if (value === todayIso) return "Aujourd’hui";
    if (value === addDay(todayIso, 1)) return "Demain";
    return new Date(value + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  function shiftText(item) {
    const code = baseCode(item?.code),
      meta = SHIFT[code];
    return [code, meta?.label].filter(Boolean).join(" · ");
  }

  async function fetchDuty(force = false) {
    if (!document.querySelector("#teamDutyChiefHost")) return null;
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

  function summaryMarkup() {
    if (!data) return "";
    const { current, next, now } = dutyState();
    if (current.length) {
      const first = current[0],
        names = current.map((x) => personName(x.agents || {})),
        shifts = [...new Set(current.map(shiftText).filter(Boolean))].join(" · ");
      return `<button type="button" class="hc-duty-chief-card is-present" data-duty-chief data-duty-chief-toggle aria-expanded="false">
        <span class="hc-duty-chief-icon" aria-hidden="true">🎨</span>
        <span class="hc-duty-chief-summary">
          <small>CHEF${current.length > 1 ? "S" : ""} PRÉSENT${current.length > 1 ? "S" : ""} MAINTENANT</small>
          <strong>${esc(current.length > 1 ? names.join(" · ") : names[0])}</strong>
          <em>${esc(shifts || shiftText(first))}</em>
        </span>
        <span class="hc-duty-chief-chevron" aria-hidden="true">›</span>
      </button>`;
    }
    if (next) {
      const a = next.agents || {};
      return `<button type="button" class="hc-duty-chief-card is-next" data-duty-chief data-duty-chief-toggle aria-expanded="false">
        <span class="hc-duty-chief-icon" aria-hidden="true">🎨</span>
        <span class="hc-duty-chief-summary">
          <small>AUCUN CHEF PRÉSENT MAINTENANT</small>
          <strong>Prochain : ${esc(personName(a))}</strong>
          <em>${esc(dayLabel(next.date, now.date))} · ${esc(shiftText(next))}</em>
        </span>
        <span class="hc-duty-chief-chevron" aria-hidden="true">›</span>
      </button>`;
    }
    return `<button type="button" class="hc-duty-chief-card is-next" data-duty-chief data-duty-chief-toggle aria-expanded="false">
      <span class="hc-duty-chief-icon" aria-hidden="true">🎨</span>
      <span class="hc-duty-chief-summary"><small>CHEF D’ÉQUIPE</small><strong>Aucune présence planifiée trouvée</strong><em>Voir les informations</em></span>
      <span class="hc-duty-chief-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function todayRow(item) {
    const a = item?.agents || {},
      href = tel(a.telephone);
    return `<div class="hc-duty-chief-person">
      <span class="hc-duty-chief-shift">${esc(baseCode(item.code))}</span>
      <span class="hc-duty-chief-copy"><strong>${esc(personName(a))}</strong><small>${esc(shiftText(item))}</small></span>
      ${href ? `<a class="hc-duty-chief-call" href="${esc(href)}" aria-label="Appeler ${esc(personName(a))}"><span>☎</span><b>Appeler</b></a>` : '<span class="hc-duty-chief-no-phone">N° indisponible</span>'}
    </div>`;
  }

  function bubbleMarkup() {
    const { today, next, now } = dutyState(),
      todayContent = today.length
        ? `<div class="hc-duty-chief-list">${today.map(todayRow).join("")}</div>`
        : '<p class="hc-duty-chief-empty">Aucun chef planifié aujourd’hui.</p>',
      nextBlock =
        !today.length && next
          ? `<div class="hc-duty-chief-next"><small>PROCHAIN PLANIFIÉ</small><strong>${esc(personName(next.agents || {}))}</strong><span>${esc(dayLabel(next.date, now.date))} · ${esc(shiftText(next))}</span></div>`
          : "";
    return `<section class="hc-duty-chief-bubble" data-duty-chief-bubble hidden>
      <header><div><small>PRÉSENCE DU JOUR</small><strong>Chefs d’équipe</strong></div><button type="button" data-duty-chief-close aria-label="Fermer">×</button></header>
      ${todayContent}${nextBlock}
    </section>`;
  }

  function closeBubble(root) {
    const toggle = root?.querySelector("[data-duty-chief-toggle]"),
      bubble = root?.querySelector("[data-duty-chief-bubble]");
    if (!toggle || !bubble) return;
    toggle.setAttribute("aria-expanded", "false");
    bubble.hidden = true;
  }
  function bind(root) {
    const toggle = root?.querySelector("[data-duty-chief-toggle]"),
      bubble = root?.querySelector("[data-duty-chief-bubble]");
    if (!toggle || !bubble) return;
    toggle.onclick = (e) => {
      e.preventDefault();
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      bubble.hidden = open;
    };
    bubble.querySelector("[data-duty-chief-close]")?.addEventListener("click", () =>
      closeBubble(root),
    );
  }

  function render() {
    const oldHome = document.querySelector("#homeView .hs-home");
    oldHome?.querySelector("[data-duty-chief]")?.remove();
    oldHome?.querySelector("[data-duty-chief-bubble]")?.remove();
    oldHome?.querySelector(".hc-duty-chief-host")?.remove();

    const mount = document.querySelector("#teamDutyChiefHost");
    if (!mount) return;
    const summary = summaryMarkup();
    if (!summary) {
      mount.innerHTML = "";
      return;
    }
    mount.innerHTML = `<div class="hc-duty-chief-host">${summary}${bubbleMarkup()}</div>`;
    bind(mount.querySelector(".hc-duty-chief-host"));
  }

  const style = document.createElement("style");
  style.textContent = `
    .team-duty-chief-host{margin:14px 0 16px}
    .hc-duty-chief-host{position:relative;margin:0}
    .hc-duty-chief-card{
      box-sizing:border-box;width:100%;min-height:78px;
      display:grid;grid-template-columns:48px minmax(0,1fr) 18px;align-items:center;gap:11px;
      padding:11px 12px;border:1px solid rgba(104,64,159,.20);border-radius:20px;
      background:linear-gradient(145deg,#fff,#f8f3ff);color:#173e4b;text-align:left;
      box-shadow:0 10px 24px rgba(58,37,86,.09),inset 0 1px 0 rgba(255,255,255,.98);
      font:inherit;-webkit-tap-highlight-color:transparent
    }
    .hc-duty-chief-card:active{transform:translateY(1px);box-shadow:0 4px 11px rgba(58,37,86,.09),inset 0 1px 0 #fff}
    .hc-duty-chief-icon{
      box-sizing:border-box;width:48px;height:48px;display:grid;place-items:center;
      border:1px solid rgba(112,64,159,.13);border-radius:15px;background:#efe4fb;
      font-size:1.45rem;box-shadow:inset 0 0 0 1px rgba(255,255,255,.64)
    }
    .hc-duty-chief-summary{min-width:0;display:block}
    .hc-duty-chief-summary small,.hc-duty-chief-summary strong,.hc-duty-chief-summary em{display:block}
    .hc-duty-chief-summary small{
      color:#70409f;font-size:.61rem;font-weight:950;line-height:1.05;letter-spacing:.08em
    }
    .hc-duty-chief-summary strong{margin-top:3px;color:#173e4b;font-size:.96rem;font-weight:950;line-height:1.08}
    .hc-duty-chief-summary em{margin-top:4px;color:#74878e;font-size:.7rem;font-style:normal;font-weight:850;line-height:1.08}
    .hc-duty-chief-chevron{color:#8d75aa;font-size:1.35rem;font-weight:900;line-height:1}
    .hc-duty-chief-card[aria-expanded="true"] .hc-duty-chief-chevron{transform:rotate(90deg)}
    .hc-duty-chief-bubble{
      position:absolute;z-index:30;left:10px;right:10px;top:calc(100% + 8px);
      box-sizing:border-box;padding:12px;border:1px solid rgba(104,64,159,.18);border-radius:20px;
      background:rgba(255,255,255,.98);box-shadow:0 18px 42px rgba(43,34,59,.19),inset 0 1px 0 #fff;
      backdrop-filter:blur(10px)
    }
    .hc-duty-chief-bubble[hidden]{display:none}
    .hc-duty-chief-bubble>header{display:grid;grid-template-columns:minmax(0,1fr) 34px;align-items:center;gap:8px;margin-bottom:9px}
    .hc-duty-chief-bubble>header small{display:block;color:#70409f;font-size:.57rem;font-weight:950;letter-spacing:.1em}
    .hc-duty-chief-bubble>header strong{display:block;margin-top:2px;color:#173e4b;font-size:.95rem}
    .hc-duty-chief-bubble>header button{
      width:34px;height:34px;border:0;border-radius:50%;background:#f2edf8;color:#70409f;font-size:1.2rem
    }
    .hc-duty-chief-list{display:grid;gap:7px}
    .hc-duty-chief-person{
      display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:8px;
      padding:8px;border:1px solid rgba(112,64,159,.11);border-radius:14px;background:#fff
    }
    .hc-duty-chief-shift{
      width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f0e7f8;
      color:#70409f;font-size:.78rem;font-weight:950
    }
    .hc-duty-chief-copy{min-width:0}
    .hc-duty-chief-copy strong,.hc-duty-chief-copy small{display:block}
    .hc-duty-chief-copy strong{font-size:.82rem;line-height:1.05}
    .hc-duty-chief-copy small{margin-top:3px;color:#778991;font-size:.65rem;font-weight:800;line-height:1.05}
    .hc-duty-chief-call{
      min-height:38px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border-radius:11px;
      background:#70409f;color:#fff!important;text-decoration:none!important;font-size:.68rem;font-weight:950
    }
    .hc-duty-chief-no-phone{color:#8b999e;font-size:.61rem;font-weight:800}
    .hc-duty-chief-empty{margin:4px 2px;color:#71858d;font-size:.72rem;font-weight:800}
    .hc-duty-chief-next{
      margin-top:8px;padding:9px;border-radius:14px;background:#f7f3fb;border:1px solid rgba(112,64,159,.10)
    }
    .hc-duty-chief-next small,.hc-duty-chief-next strong,.hc-duty-chief-next span{display:block}
    .hc-duty-chief-next small{color:#70409f;font-size:.55rem;font-weight:950;letter-spacing:.08em}
    .hc-duty-chief-next strong{margin-top:3px;font-size:.82rem}
    .hc-duty-chief-next span{margin-top:3px;color:#778991;font-size:.66rem;font-weight:800}
    @media(max-width:390px){
      .hc-duty-chief-card{min-height:74px;grid-template-columns:44px minmax(0,1fr) 16px;gap:9px;padding:10px}
      .hc-duty-chief-icon{width:44px;height:44px;border-radius:14px;font-size:1.35rem}
      .hc-duty-chief-summary strong{font-size:.92rem}
      .hc-duty-chief-bubble{left:4px;right:4px}
      .hc-duty-chief-call b{display:none}
      .hc-duty-chief-call{width:38px;padding:0;justify-content:center}
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("click", (e) => {
    const host = document.querySelector("#teamDutyChiefHost .hc-duty-chief-host");
    if (!host || host.contains(e.target)) return;
    closeBubble(host);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      closeBubble(document.querySelector("#teamDutyChiefHost .hc-duty-chief-host"));
  });

  window.addEventListener("stip:home-rendered", () => render());
  window.addEventListener("stip:session-ready", () => fetchDuty(true));
  window.addEventListener("stip:session-ended", () => {
    data = null;
    lastFetch = 0;
    render();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) fetchDuty();
  });
  const init = () => {
    render();
    fetchDuty();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  setInterval(() => {
    render();
    if (Date.now() - lastFetch > 5 * 60 * 1000) fetchDuty();
  }, 30000);
})();