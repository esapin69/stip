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
  const hiddenTel = (v) => {
    let d = digits(v);
    if (!d) return "";
    if (d.startsWith("33")) d = `0${d.slice(2)}`;
    return `tel:%2331%23${d}`;
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
  function shiftBadge(item) {
    const code = baseCode(item?.code),
      meta = SHIFT[code];
    if (!code || !meta) return "";
    const tone = code.toLowerCase();
    return `<span class="hc-duty-chief-shift tone-${esc(tone)}" aria-label="${esc(shiftText(item))}"><i aria-hidden="true"></i><b>${esc(code)}</b></span>`;
  }

  function highlightedChief() {
    if (!data) return null;
    const { current, next } = dutyState();
    if (current.length === 1) return current[0];
    if (!current.length && next) return next;
    return null;
  }

  function summaryCallMarkup() {
    const item = highlightedChief();
    if (!item) return "";
    const a = item.agents || {},
      phone = digits(a.telephone),
      label = personName(a);
    if (!phone)
      return `<button class="hc-duty-chief-summary-call is-disabled" type="button" disabled aria-label="Numéro indisponible pour ${esc(label)}"><span aria-hidden="true">☎</span></button>`;
    return `<button class="hc-duty-chief-summary-call" type="button" data-duty-chief-call="${esc(phone)}" data-duty-chief-call-name="${esc(label)}" aria-label="Appeler ${esc(label)}"><span aria-hidden="true">☎</span></button>`;
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
      phone = digits(a.telephone),
      key = String(a.source_key || ""),
      label = personName(a);
    return `<div class="hc-duty-chief-person">
      <button class="hc-duty-chief-person-main" type="button" data-duty-chief-agent="${esc(key)}" ${key ? "" : "disabled"} aria-label="Voir le planning de ${esc(label)}">
        ${shiftBadge(item)}
        <span class="hc-duty-chief-copy"><strong>${esc(label)}</strong><small>${esc(SHIFT[baseCode(item.code)]?.label || shiftText(item))}</small></span>
        <i class="hc-duty-chief-row-chevron" aria-hidden="true">›</i>
      </button>
      ${phone ? `<button class="hc-duty-chief-call" type="button" data-duty-chief-call="${esc(phone)}" data-duty-chief-call-name="${esc(label)}" aria-label="Appeler ${esc(label)}"><span aria-hidden="true">☎</span></button>` : `<button class="hc-duty-chief-call is-disabled" type="button" disabled aria-label="Numéro indisponible pour ${esc(label)}"><span aria-hidden="true">☎</span></button>`}
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

  function closeCallChoice() {
    document.querySelector(".hc-duty-chief-call-overlay")?.remove();
  }

  function openCallChoice(phone, person) {
    const normal = tel(phone),
      hidden = hiddenTel(phone);
    if (!normal) return;
    closeCallChoice();
    const overlay = document.createElement("div");
    overlay.className = "hc-duty-chief-call-overlay";
    overlay.innerHTML = `
      <button class="hc-duty-chief-call-backdrop" type="button" aria-label="Fermer"></button>
      <section class="hc-duty-chief-call-sheet" role="dialog" aria-modal="true" aria-label="Choisir le type d’appel">
        <div class="hc-duty-chief-call-handle" aria-hidden="true"></div>
        <small>APPELER</small>
        <strong>${esc(person || "Chef d’équipe")}</strong>
        <a class="hc-duty-chief-call-option primary" href="${esc(normal)}"><span aria-hidden="true">☎</span><b>Appeler normalement</b></a>
        <a class="hc-duty-chief-call-option" href="${esc(hidden)}"><span aria-hidden="true">◉</span><b>Appeler en inconnu</b></a>
        <button class="hc-duty-chief-call-cancel" type="button">Annuler</button>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".hc-duty-chief-call-backdrop")?.addEventListener("click", closeCallChoice);
    overlay.querySelector(".hc-duty-chief-call-cancel")?.addEventListener("click", closeCallChoice);
    overlay.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => setTimeout(closeCallChoice, 250)),
    );
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
    bubble.querySelectorAll("[data-duty-chief-agent]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = String(button.dataset.dutyChiefAgent || "");
        if (!key) return;
        const item = (data?.items || []).find(
          (row) => String(row?.agents?.source_key || "") === key,
        );
        closeBubble(root);
        window.STIPAgentAgenda?.open?.(key, item?.agents || {});
      });
    });
    root.querySelectorAll("[data-duty-chief-call]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        openCallChoice(
          String(button.dataset.dutyChiefCall || ""),
          String(button.dataset.dutyChiefCallName || ""),
        );
      });
    });
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
    mount.innerHTML = `<div class="hc-duty-chief-host"><div class="hc-duty-chief-summary-shell">${summary}${summaryCallMarkup()}</div>${bubbleMarkup()}</div>`;
    bind(mount.querySelector(".hc-duty-chief-host"));
  }

  const style = document.createElement("style");
  style.textContent = `
    .team-duty-chief-host{margin:14px 0 16px}
    .hc-duty-chief-host{position:relative;margin:0}
    .hc-duty-chief-summary-shell{position:relative}
    .hc-duty-chief-card{
      box-sizing:border-box;width:100%;min-height:82px;
      display:grid;grid-template-columns:48px minmax(0,1fr) 18px;align-items:center;gap:11px;
      padding:11px 12px;border:2px solid rgba(112,64,159,.28);border-radius:21px;
      background:linear-gradient(135deg,#fff 0%,#f7efff 62%,#fcf9ff 100%);color:#173e4b;text-align:left;
      box-shadow:inset 5px 0 0 #70409f,0 13px 30px rgba(58,37,86,.15),inset 0 1px 0 rgba(255,255,255,.98);
      font:inherit;-webkit-tap-highlight-color:transparent
    }
    .hc-duty-chief-card:active{transform:translateY(1px);box-shadow:0 4px 11px rgba(58,37,86,.09),inset 0 1px 0 #fff}
    .hc-duty-chief-icon{
      box-sizing:border-box;width:48px;height:48px;display:grid;place-items:center;
      border:1px solid rgba(112,64,159,.13);border-radius:15px;background:#efe4fb;
      font-size:1.45rem;box-shadow:inset 0 0 0 1px rgba(255,255,255,.64)
    }
    .hc-duty-chief-summary{min-width:0;display:grid;align-content:center;text-align:left;padding-right:48px}
    .hc-duty-chief-summary small,.hc-duty-chief-summary strong,.hc-duty-chief-summary em{display:block}
    .hc-duty-chief-summary small{
      color:#70409f;font-size:.61rem;font-weight:950;line-height:1.05;letter-spacing:.08em
    }
    .hc-duty-chief-summary strong{margin-top:3px;color:#173e4b;font-size:.96rem;font-weight:950;line-height:1.08}
    .hc-duty-chief-summary em{margin-top:4px;color:#74878e;font-size:.7rem;font-style:normal;font-weight:850;line-height:1.08}
    .hc-duty-chief-chevron{color:#8d75aa;font-size:1.35rem;font-weight:900;line-height:1}
    .hc-duty-chief-card[aria-expanded="true"] .hc-duty-chief-chevron{transform:rotate(90deg)}
    .hc-duty-chief-summary-call{
      position:absolute;z-index:4;top:50%;right:39px;transform:translateY(-50%);
      width:42px;height:42px;display:grid;place-items:center;padding:0;
      border:0;border-radius:14px;background:#70409f;color:#fff;font:inherit;font-size:1.05rem;
      box-shadow:0 7px 17px rgba(112,64,159,.24);cursor:pointer;-webkit-tap-highlight-color:transparent
    }
    .hc-duty-chief-summary-call:active{transform:translateY(-50%) scale(.94)}
    .hc-duty-chief-summary-call.is-disabled{background:#e7e9ec;color:#98a2a8;box-shadow:none;cursor:default}
    .hc-duty-chief-bubble{
      position:relative;z-index:2;
      box-sizing:border-box;margin-top:9px;padding:12px;border:1px solid rgba(104,64,159,.18);border-radius:20px;
      background:#fff;box-shadow:0 12px 30px rgba(43,34,59,.12),inset 0 1px 0 #fff
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
      width:100%;display:flex;align-items:center;gap:10px;
      padding:8px 9px;border:1px solid rgba(112,64,159,.13);border-radius:15px;background:#fff
    }
    .hc-duty-chief-person-main{
      width:100%;flex:1 1 auto;min-width:0;min-height:54px;display:grid;grid-template-columns:50px minmax(0,1fr) 16px;
      align-items:center;gap:9px;padding:0;border:0;background:transparent;color:#173e4b;
      text-align:left;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent
    }
    .hc-duty-chief-person-main:active{transform:scale(.992);background:#fafcff;border-radius:11px}
    .hc-duty-chief-person-main:disabled{cursor:default}
    .hc-duty-chief-shift{
      --shift-color:#81909b;
      min-width:48px;height:38px;display:flex;align-items:center;justify-content:center;gap:5px;
      padding:0 7px;border-radius:12px;
      border:1px solid color-mix(in srgb,var(--shift-color) 28%,#dce7e9);
      background:color-mix(in srgb,var(--shift-color) 9%,#fff);
      color:#173e4b;font-size:.75rem;font-weight:950
    }
    .hc-duty-chief-shift>i{
      width:18px;height:18px;display:block;border-radius:50%;
      background:var(--shift-color);
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.08),0 2px 5px rgba(20,62,78,.10)
    }
    .hc-duty-chief-shift.tone-m{--shift-color:var(--stip-shift-m)}
    .hc-duty-chief-shift.tone-j{--shift-color:var(--stip-shift-j)}
    .hc-duty-chief-shift.tone-j4{--shift-color:var(--stip-shift-j4)}
    .hc-duty-chief-shift.tone-s{--shift-color:var(--stip-shift-s)}
    .hc-duty-chief-shift.tone-n{--shift-color:var(--stip-shift-n)}
    .hc-duty-chief-row-chevron{color:#8799a0;font-size:1.15rem;font-style:normal;font-weight:900}
    .hc-duty-chief-copy{min-width:0}
    .hc-duty-chief-copy strong,.hc-duty-chief-copy small{display:block}
    .hc-duty-chief-copy strong{font-size:.82rem;line-height:1.05}
    .hc-duty-chief-copy small{margin-top:3px;color:#778991;font-size:.65rem;font-weight:800;line-height:1.05}
    .hc-duty-chief-call{
      flex:0 0 42px;width:42px;height:42px;display:grid;place-items:center;padding:0;border:0;border-radius:13px;
      background:#70409f;color:#fff;font:inherit;font-size:1rem;font-weight:950;
      box-shadow:0 5px 14px rgba(112,64,159,.20);cursor:pointer;-webkit-tap-highlight-color:transparent
    }
    .hc-duty-chief-call:active{transform:scale(.94)}
    .hc-duty-chief-call.is-disabled{background:#edf0f2;color:#9aa5aa;box-shadow:none;cursor:default}
    .hc-duty-chief-empty{margin:4px 2px;color:#71858d;font-size:.72rem;font-weight:800}
    .hc-duty-chief-next{
      margin-top:8px;padding:9px;border-radius:14px;background:#f7f3fb;border:1px solid rgba(112,64,159,.10)
    }
    .hc-duty-chief-next small,.hc-duty-chief-next strong,.hc-duty-chief-next span{display:block}
    .hc-duty-chief-next small{color:#70409f;font-size:.55rem;font-weight:950;letter-spacing:.08em}
    .hc-duty-chief-next strong{margin-top:3px;font-size:.82rem}
    .hc-duty-chief-next span{margin-top:3px;color:#778991;font-size:.66rem;font-weight:800}
    .hc-duty-chief-call-overlay{
      position:fixed;inset:0;z-index:1600;display:grid;align-items:end
    }
    .hc-duty-chief-call-backdrop{
      position:absolute;inset:0;border:0;background:rgba(8,22,31,.46);backdrop-filter:blur(3px)
    }
    .hc-duty-chief-call-sheet{
      position:relative;z-index:1;display:grid;gap:9px;padding:9px 16px calc(16px + env(safe-area-inset-bottom));
      border-radius:24px 24px 0 0;background:#fff;box-shadow:0 -18px 48px rgba(10,24,35,.24)
    }
    .hc-duty-chief-call-handle{width:44px;height:5px;justify-self:center;border-radius:99px;background:#cad4d8}
    .hc-duty-chief-call-sheet>small{margin-top:2px;color:#70409f;font-size:.58rem;font-weight:950;letter-spacing:.11em}
    .hc-duty-chief-call-sheet>strong{color:#173e4b;font-size:1.08rem}
    .hc-duty-chief-call-option{
      min-height:50px;display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:8px;
      padding:0 13px;border:1px solid #dce5e8;border-radius:15px;background:#f8fbfc;
      color:#173e4b;text-decoration:none;font-size:.78rem;font-weight:950
    }
    .hc-duty-chief-call-option.primary{border-color:#70409f;background:#70409f;color:#fff}
    .hc-duty-chief-call-option>span{display:grid;place-items:center;font-size:1rem}
    .hc-duty-chief-call-cancel{
      min-height:42px;border:0;background:transparent;color:#687d85;font:inherit;font-size:.74rem;font-weight:900
    }
    @media(min-width:700px){
      .hc-duty-chief-call-sheet{width:min(520px,calc(100% - 32px));justify-self:center;margin-bottom:16px;border-radius:24px}
    }
    @media(max-width:390px){
      .hc-duty-chief-card{min-height:78px;grid-template-columns:44px minmax(0,1fr) 16px;gap:9px;padding:10px}
      .hc-duty-chief-icon{width:44px;height:44px;border-radius:14px;font-size:1.35rem}
      .hc-duty-chief-summary{padding-right:44px}
      .hc-duty-chief-summary strong{font-size:.92rem}
      .hc-duty-chief-summary-call{right:34px;width:39px;height:39px;border-radius:13px}
      .hc-duty-chief-bubble{margin-top:8px}
      .hc-duty-chief-person{gap:7px;padding:7px}
      .hc-duty-chief-person-main{grid-template-columns:47px minmax(0,1fr) 13px;gap:7px}
      .hc-duty-chief-shift{min-width:44px;padding-inline:4px}
      .hc-duty-chief-call{flex-basis:39px;width:39px;height:39px}
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("click", (e) => {
    const host = document.querySelector("#teamDutyChiefHost .hc-duty-chief-host");
    if (!host || host.contains(e.target)) return;
    closeBubble(host);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeBubble(document.querySelector("#teamDutyChiefHost .hc-duty-chief-host"));
      closeCallChoice();
    }
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