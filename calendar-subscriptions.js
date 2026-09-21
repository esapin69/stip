(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-calendar",
    STORE = "stip_session_v1",
    GOOGLE_ADD_URL =
      "https://calendar.google.com/calendar/u/0/r/settings/addbyurl",
    REQUESTED_KIND = "stip_calendar_requested_kind_v1";

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

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || "");
  }

  async function feed(kind) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const r = await fetch(API, {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              "X-STIP-Session": localStorage.getItem(STORE) || "",
            },
            body: JSON.stringify({ kind }),
            signal: controller.signal,
          }),
          j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) {
          const e = new Error(
            j.error ||
              (r.status === 401
                ? "Calendrier non autorisé pour ce profil STIP."
                : "Abonnement indisponible."),
          );
          e.status = r.status;
          throw e;
        }
        if (!j.https_url || !j.webcal_url)
          throw Error("Adresse d’abonnement incomplète.");
        return j;
      } catch (e) {
        lastError =
          e?.name === "AbortError"
            ? Error("Le serveur calendrier met trop de temps à répondre.")
            : e;
        if (e?.status && e.status < 500) break;
        if (attempt === 0) await new Promise((ok) => setTimeout(ok, 350));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError || Error("Abonnement indisponible.");
  }

  function choice(kind, icon, title, small, cls) {
    return `<button type="button" class="cal-choice ${cls}" data-cal-kind="${kind}"><span>${icon}</span><div><strong>${title}</strong><small>${small}</small></div><b>›</b></button>`;
  }

  function choicesMarkup() {
    return `<div class="cal-grid">${choice(
      "personal",
      "▦",
      "Mon planning",
      "Mes shifts et horaires personnels",
      "personal",
    )}${choice(
      "team",
      "👥",
      "Esprit d’équipe",
      "Un événement par jour avec le détail de l’équipe",
      "team",
    )}${choice(
      "formations",
      "🎓",
      "Formations",
      "Formations prévues et informations utiles",
      "formations",
    )}${choice(
      "stagiaires",
      "🧑‍🎓",
      "Stagiaires",
      "Périodes, horaires et référents",
      "stagiaires",
    )}</div><div class="cal-status" aria-live="polite"></div>`;
  }

  function requestedKind() {
    try {
      const v = sessionStorage.getItem(REQUESTED_KIND) || "";
      sessionStorage.removeItem(REQUESTED_KIND);
      return v;
    } catch {
      return "";
    }
  }

  function bind(host) {
    host.onclick = (e) => {
      const b = e.target.closest("[data-cal-kind]");
      if (b) prepare(b.dataset.calKind, b, host);
    };
  }

  function mount(host, initial = "") {
    if (typeof host === "string") host = document.querySelector(host);
    if (!host) return false;
    host.classList.add("cal-inline");
    host.innerHTML = choicesMarkup();
    bind(host);
    const kind = initial || requestedKind();
    if (kind) {
      const safeKind = String(kind).replace(/[^a-z]/gi, "");
      const b = host.querySelector(`[data-cal-kind="${safeKind}"]`);
      if (b) setTimeout(() => prepare(kind, b, host), 0);
    }
    return true;
  }

  function open(initial = "") {
    if (initial) {
      try {
        sessionStorage.setItem(REQUESTED_KIND, initial);
      } catch {}
    }
    const host = document.getElementById("phCalendarSubscriptions");
    if (host && (window.STIPRouter?.get?.() || "").includes("planning/calendar"))
      return mount(host, initial);
    if (window.STIPHubs?.planning) return window.STIPHubs.planning("calendar");
    window.STIPRouter?.set?.("planning/calendar");
  }

  async function writeClipboard(url) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  function manualUrl(url, status) {
    status.innerHTML = `<div class="cal-url"><input readonly value="${esc(url)}"><small>Sélectionne et copie cette adresse.</small></div>`;
    status.querySelector("input")?.select?.();
  }

  async function copyLink(url, status, androidHelp = false) {
    const ok = await writeClipboard(url);
    if (!ok) return manualUrl(url, status);
    status.innerHTML = androidHelp
      ? `<div class="cal-ok">✓ Adresse d’abonnement copiée</div><a class="cal-open-google" href="${GOOGLE_ADD_URL}" target="_blank" rel="noopener">Ouvrir Google Agenda sur le Web</a><small>Sur Android, l’application Google Agenda ne sait pas ajouter directement un abonnement par URL. Dans Chrome, active « Version pour ordinateur » si nécessaire, puis Autres agendas → + → À partir de l’URL, et colle l’adresse.</small>`
      : '<div class="cal-ok">✓ Adresse d’abonnement copiée</div><small>Colle cette adresse dans la fonction « Ajouter à partir de l’URL » de ton calendrier.</small>';
  }

  function methods(j, title, status) {
    const android = isAndroid();
    status.innerHTML = android
      ? `<div class="cal-methods"><div class="cal-method-title"><b>${esc(
          title,
        )}</b><small>Android détecté · on évite le lien webcal qui peut afficher « chargement impossible ».</small></div><button type="button" class="cal-method primary" data-cal-android><span>⧉</span><div><strong>Configurer Google Agenda</strong><small>Copier l’adresse d’abonnement puis l’ajouter depuis le Web</small></div></button><button type="button" class="cal-method" data-cal-copy><span>⧉</span><div><strong>Copier seulement l’adresse</strong><small>Pour une autre application de calendrier compatible</small></div></button><button type="button" class="cal-method-back" data-cal-method-back>‹ Choisir un autre calendrier</button></div>`
      : `<div class="cal-methods"><div class="cal-method-title"><b>${esc(
          title,
        )}</b><small>L’adresse reste la même et STIP maintient le calendrier à jour.</small></div><button type="button" class="cal-method primary" data-cal-direct><span>↗</span><div><strong>S’abonner directement</strong><small>Apple Calendrier et applications compatibles webcal</small></div></button><button type="button" class="cal-method" data-cal-copy><span>⧉</span><div><strong>Copier l’adresse d’abonnement</strong><small>Google Agenda et calendriers demandant une URL</small></div></button><button type="button" class="cal-method-back" data-cal-method-back>‹ Choisir un autre calendrier</button></div>`;

    status.querySelector("[data-cal-direct]")?.addEventListener("click", () => {
      location.href = j.webcal_url;
    });
    status.querySelector("[data-cal-android]")?.addEventListener("click", () =>
      copyLink(j.https_url, status, true),
    );
    status.querySelector("[data-cal-copy]")?.addEventListener("click", () =>
      copyLink(j.https_url, status, android),
    );
    status
      .querySelector("[data-cal-method-back]")
      ?.addEventListener("click", () => {
        const host = status.closest(".cal-inline");
        if (host) mount(host);
      });
  }

  async function prepare(kind, button, host) {
    const status = host?.querySelector(".cal-status"),
      title = button?.querySelector("strong")?.textContent || "Calendrier";
    if (!status || !button) return;
    host
      .querySelectorAll("[data-cal-kind]")
      .forEach((b) => (b.disabled = true));
    status.innerHTML =
      '<div class="cal-loading"><i></i><span>Préparation de l’abonnement…</span></div>';
    try {
      const j = await feed(kind);
      host.querySelector.classList.add("is-prepared");
      methods(j, title, status);
    } catch (e) {
      status.innerHTML = `<div class="cal-error"><strong>Impossible de préparer ce calendrier</strong><small>${esc(
        e?.message || "Réessaie dans quelques secondes.",
      )}</small><button type="button" data-cal-retry>Réessayer</buttton></div>`;

      status.querySelector("[data-cal-retry]")?.addEventListener("click", () =>
        prepare(kind, button, host),
      );
    } finally {
      host
        .querySelectorAll("[data-cal-kind]")
        .forEach((b) => (b.disabled = false));
    }
  }

  window.STIPCalendars = {
    open,
    mount,
    close() {},
  };

  const st = document.createElement("style");
  st.textContent = `
    .cal-inline{display:grid;gap:10px}
    .cal-grid{display:grid;grid-template-columns:1fr;gap:8px;transition:opacity .15s ease}
    .cal-grid.is-prepared{display:none}
    .cal-choice{width:100%;display:grid;grid-template-columns:48px minmax(0,1fr) 24px;align-items:center;gap:10px;text-align:left;border:1px solid #d9e7ea;background:#fff;border-radius:19px;padding:11px;color:#103f50;cursor:pointer}
    .cal-choice:disabled{opacity:.58;cursor:wait}
    .cal-choice>span{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#fff;font-size:1.2rem}
    .cal-choice.personal>span{background:#1688d3}.cal-choice.team>span{background:#6e55d8}.cal-choice.formations>span{background:#2d9d78}.cal-choice.stagiaires>span{background:#d98a2b}
    .cal-choice strong,.cal-choice small{display:block}.cal-choice small{margin-top:3px;color:#70858d}.cal-choice>b{font-size:1.25rem;color:#5c7780}
    .cal-status{color:#17708a}.cal-status:empty{display:none}
    .cal-loading{min-height:74px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #d9e7ea;border-radius:17px;background:#f7fbfc;color:#607983;font-weight:850}
    .cal-loading i{width:18px;height:18px;border:2px solid #c7dde2;border-top-color:#1688d3;border-radius:50%;animation:calSpin .7s linear infinite}@keyframes calSpin{to{transform:rotate(360deg)}}
    .cal-methods{display:grid;gap:8px}.cal-method-title{text-align:left;padding:8px 3px}.cal-method-title b,.cal-method-title small{display:block}.cal-method-title b{font-size:1.05rem;color:#103f50}.cal-method-title small{margin-top:3px;color:#70858d;line-height:1.35}
    .cal-method{width:100%;display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;text-align:left;border:1px solid #d9e7ea;border-radius:17px;background:#fff;padding:11px;color:#103f50;cursor:pointer}
    .cal-method>span{width:42px;height:42px;border-radius:13px;background:#e8f3f6;display:grid;place-items:center;font-size:1.25rem;color:#14728c}.cal-method.primary>span{background:#14728c;color:#fff}
    .cal-method strong,.cal-method small{display:block}.cal-method small{margin-top:2px;color:#70858d;line-height:1.3}.cal-method-back{justify-self:start;border:0;background:none;padding:8px 2px;color:#17708a;font-weight:850;cursor:pointer}
    .cal-ok{font-weight:900;color:#167d55;margin:4px 0 8px}.cal-status>small{display:block;color:#607983;line-height:1.45}
    .cal-open-google{display:flex;align-items:center;justify-content:center;min-height:46px;margin:7px 0 9px;border-radius:14px;background:#14728c;color:#fff!important;text-decoration:none;font-weight:900}
    .cal-url input{box-sizing:border-box;width:100%;padding:11px;border:1px solid #cfdfe3;border-radius:11px;background:#fff;color:#315866}.cal-url small{display:block;margin-top:6px;color:#607983}
    .cal-error{display:grid;gap:7px;padding:13px;border:1px solid #eccdcd;border-radius:16px;background:#fff8f8;color:#7e3030}.cal-error strong,.cal-error small{display:block}.cal-error small{line-height:1.4}.cal-error button{justify-self:start;border:0;border-radius:11px;background:#7e3030;color:#fff;padding:9px 12px;font-weight:900}
    @media(min-width:620px){.cal-grid{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(st);
})();