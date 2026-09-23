(() => {
  "use strict";

  const ACTION_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
    STORE = "stip_session_v1";

  const state = {
    boot: window.STIPBootCache || null,
    done: new Set(),
    loadedAt: 0,
    loading: false,
  };

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

  function token() {
    return localStorage.getItem(STORE) || "";
  }

  function parisStamp(d = new Date()) {
    const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d),
      g = (k) => p.find((x) => x.type === k)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
  }

  function parisDateOf(value) {
    const d = new Date(value || Date.now());
    if (Number.isNaN(d.getTime())) return String(value || "").slice(0, 10);
    const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d),
      g = (k) => p.find((x) => x.type === k)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")}`;
  }

  function parisTimeOf(value) {
    const d = new Date(value || "");
    if (Number.isNaN(d.getTime())) return "";
    const p = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d),
      g = (k) => p.find((x) => x.type === k)?.value || "";
    return `${g("hour")}:${g("minute")}`;
  }

  function lastClock(value) {
    const found = [];
    for (const m of String(value || "").matchAll(
      /(?:^|\D)([01]?\d|2[0-3])(?:[:hH.])([0-5]\d)(?!\d)/g,
    )) {
      found.push(`${String(+m[1]).padStart(2, "0")}:${m[2]}`);
    }
    return found.at(-1) || "";
  }

  function plusLocalMinutes(date, clock, minutes = 60) {
    const safe = /^\d{2}:\d{2}$/.test(clock) ? clock : "18:00",
      d = new Date(`${date}T${safe}:00Z`);
    d.setUTCMinutes(d.getUTCMinutes() + minutes);
    return d.toISOString().slice(0, 16);
  }

  function isDone(x = {}) {
    const status = String(x.status || x.statut || "").toLowerCase();
    return (
      x.completed_at ||
      x.cancelled_at ||
      x.resolved_at ||
      [
        "done",
        "termine",
        "terminé",
        "cancelled",
        "annule",
        "annulé",
        "resolved",
        "traite",
        "traité",
      ].includes(status)
    );
  }

  function kindOf(x = {}) {
    const s = [
      x.source_type,
      x.event_kind,
      x.type,
      x.title,
      x.intitule,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (/mobi_lit_medical|visite|médical|medical/.test(s)) return "medical";
    if (/formation/.test(s)) return "training";
    if (/stagiaire/.test(s)) return "intern";
    return "other";
  }

  function iconOf(kind, x = {}) {
    return (
      String(x.icon || "").trim() ||
      { medical: "🩺", training: "🎓", intern: "👶", other: "📌" }[kind] ||
      "📌"
    );
  }

  function normalizeEvents() {
    const b = state.boot || window.STIPBootCache || {},
      out = [];

    for (const x of b.agenda_items || []) {
      if (!x?.id || isDone(x) || x.feedback_enabled === false) continue;
      if (String(x.display_mode || "event") === "day_note") continue;
      const date = String(x.event_date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const allDay = !!x.all_day,
        start = String(x.start_time || "").slice(0, 5),
        end = String(x.end_time || "").slice(0, 5),
        clock = allDay ? "18:00" : end || start || "18:00",
        kind = kindOf(x);
      out.push({
        eventKey: `agenda:${x.id}`,
        title: String(x.title || "Événement"),
        date,
        endDate: date,
        time: allDay ? "Toute la journée" : [start, end].filter(Boolean).join("–"),
        location: String(x.location || "").trim(),
        question: String(x.feedback_question || "").trim(),
        kind,
        icon: iconOf(kind, x),
        due: plusLocalMinutes(date, clock, 60),
      });
    }

    for (const x of b.personal_formations || []) {
      if (!x?.id || isDone(x)) continue;
      const date = parisDateOf(x.date_debut),
        endDate = parisDateOf(x.date_fin || x.date_debut),
        timestampClock = parisTimeOf(x.date_fin || ""),
        clock =
          lastClock(x.horaire) ||
          (timestampClock && timestampClock !== "00:00" ? timestampClock : "18:00");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      out.push({
        eventKey: `formation:${x.id}`,
        title: String(x.intitule || "Formation"),
        date,
        endDate,
        time: String(x.horaire || "").trim(),
        location: String(x.lieu || "").trim(),
        question: "",
        kind: "training",
        icon: "🎓",
        due: plusLocalMinutes(endDate, clock, 60),
      });
    }

    for (const x of b.personal_stagiaires || []) {
      if (!x?.id || isDone(x)) continue;
      const date = String(x.date_debut || "").slice(0, 10),
        endDate = String(x.date_fin || x.date_debut || "").slice(0, 10),
        clock = lastClock(x.horaires) || "18:00";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      out.push({
        eventKey: `stagiaire:${x.id}`,
        title:
          [x.prenom, x.nom].filter(Boolean).join(" ").trim() || "Stagiaire",
        date,
        endDate,
        time: String(x.horaires || "").trim(),
        location: "",
        question: "",
        kind: "intern",
        icon: "👶",
        due: plusLocalMinutes(endDate, clock, 60),
      });
    }

    return out;
  }

  function passedEvents() {
    const now = parisStamp();
    return normalizeEvents()
      .filter((x) => x.due <= now)
      .sort(
        (a, b) =>
          b.due.localeCompare(a.due) ||
          String(a.title).localeCompare(String(b.title), "fr"),
      );
  }

  function pendingEvents() {
    return passedEvents().filter((x) => !state.done.has(x.eventKey));
  }

  function formatDate(iso) {
    const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
    return d
      .toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
      .replace(".", "");
  }

  async function post(action, body = {}) {
    const r = await fetch(ACTION_API, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-stip-session": token(),
        },
        body: JSON.stringify({ action, ...body }),
      }),
      j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Error(j.error || "Erreur " + r.status);
    return j;
  }

  async function loadDone(force = false) {
    if (!token() || state.loading) return;
    if (!force && Date.now() - state.loadedAt < 15000) return;
    state.loading = true;
    try {
      const r = await post("event_feedback_list");
      state.done = new Set(
        (r.items || []).map((x) => String(x.event_key || "")).filter(Boolean),
      );
      state.loadedAt = Date.now();
    } catch {
      return;
    } finally {
      state.loading = false;
      render();
    }
  }

  function suppressMovedCards(passed) {
    const keys = new Set(passed.map((x) => x.eventKey));
    document
      .querySelectorAll(".hc-home-pane-planning [data-future-id]")
      .forEach((button) => {
        if (keys.has(String(button.dataset.futureId || ""))) button.remove();
      });
    document
      .querySelectorAll(".hc-home-pane-planning .hc-week-event-date-group")
      .forEach((group) => {
        if (!group.querySelector("[data-future-id]")) group.remove();
      });
    const detailBlock = document.querySelector(
      ".hc-home-pane-planning .hc-planning-details-subblock",
    );
    if (detailBlock && !detailBlock.querySelector("[data-future-id]"))
      detailBlock.remove();
  }

  function cardMarkup(x) {
    const meta = [
      formatDate(x.endDate || x.date),
      x.time,
      x.location,
    ].filter(Boolean);
    return `<button type="button" class="hc-week-event-key-item hc-feedback-card type-${esc(
      x.kind,
    )}" data-event-feedback="${esc(x.eventKey)}"><span class="hc-week-event-key-icon" aria-hidden="true">${esc(
      x.icon,
    )}</span><span class="hc-week-event-copy"><strong>${esc(
      x.title,
    )}</strong><span class="hc-week-event-when"><b class="hc-feedback-to-do">Retour à faire</b>${meta
      .map((v) => `<span>${esc(v)}</span>`)
      .join("")}</span></span><span class="hc-week-event-chevron" aria-hidden="true">›</span></button>`;
  }

  function render() {
    const planning = document.querySelector(
      ".hc-home-pane-planning .hc-planning-group",
    );
    if (!planning) return;

    const passed = passedEvents();
    suppressMovedCards(passed);

    const pending = passed.filter((x) => !state.done.has(x.eventKey));
    let host = document.getElementById("hcEventFeedbackHost");
    if (!pending.length) {
      host?.remove();
      return;
    }

    if (!host) {
      host = document.createElement("section");
      host.id = "hcEventFeedbackHost";
      host.className = "hc-feedback-pending";
      const before =
        planning.querySelector(".hc-planning-details-subblock") ||
        planning.querySelector(".hc-planning-week-separator");
      if (before) planning.insertBefore(host, before);
      else planning.prepend(host);
    }

    host.innerHTML =
      '<div class="hc-planning-period-separator stip-section-separator hc-feedback-separator"><span>À CLÔTURER</span></div><div class="hc-feedback-list">' +
      pending.map(cardMarkup).join("") +
      "</div>";

    host.querySelectorAll("[data-event-feedback]").forEach((button) => {
      button.onclick = () => {
        const event = pending.find(
          (x) => x.eventKey === button.dataset.eventFeedback,
        );
        if (event) openModal(event);
      };
    });
  }

  function toast(message) {
    let el = document.querySelector(".hc-feedback-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "hc-feedback-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function openModal(event) {
    document.getElementById("hcEventFeedbackModal")?.remove();
    document.body.classList.add("hc-feedback-modal-open");

    const modal = document.createElement("div");
    modal.id = "hcEventFeedbackModal";
    modal.className = "hc-feedback-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "hcFeedbackTitle");

    const noteBlock =
      event.kind === "medical"
        ? '<section class="hc-feedback-note hc-feedback-medical-safe"><strong>Retour administratif uniquement</strong><p class="hc-feedback-privacy">Aucun commentaire libre n’est demandé ni enregistré pour une visite médicale.</p></section>'
        : '<section class="hc-feedback-note"><label for="hcFeedbackNote">Précision <small>facultative</small></label><textarea id="hcFeedbackNote" maxlength="500" rows="3" placeholder="Une information utile, si nécessaire"></textarea></section>';
    const custom = event.question
      ? `<section class="hc-feedback-question hc-feedback-custom" hidden><span>QUESTION LIÉE À CET ÉVÉNEMENT</span><strong>${esc(
          event.question,
        )}</strong><div class="hc-feedback-pair"><button type="button" data-custom="yes">Oui</button><button type="button" data-custom="no">Non</button></div></section>`
      : "";

    modal.innerHTML = `<div class="hc-feedback-dialog">
      <header class="hc-feedback-head">
        <div><small>RETOUR RAPIDE</small><h2 id="hcFeedbackTitle">Faire mon retour</h2></div>
        <button type="button" class="hc-feedback-close" aria-label="Fermer">×</button>
      </header>
      <section class="hc-feedback-event">
        <span class="hc-feedback-event-icon" aria-hidden="true">${esc(event.icon)}</span>
        <div><strong>${esc(event.title)}</strong><p>${esc(
          [formatDate(event.endDate || event.date), event.time, event.location]
            .filter(Boolean)
            .join(" · "),
        )}</p></div>
      </section>
      <section class="hc-feedback-presence">
        <span>COMMENT ÇA S’EST PASSÉ ?</span>
        <div class="hc-feedback-presence-options">
          <button type="button" data-attendance="absent">Je n’étais pas présent</button>
          <button type="button" data-attendance="problem">J’étais présent, mais…</button>
          <button type="button" data-attendance="ok">Tout s’est bien déroulé</button>
        </div>
      </section>
      <div class="hc-feedback-following" hidden>
        <section class="hc-feedback-rating" hidden>
          <span>APPRÉCIATION GLOBALE</span>
          <div class="hc-feedback-rating-bar" role="group" aria-label="Note sur 5">
            <button type="button" data-rating="1" aria-label="1 sur 5">1</button>
            <button type="button" data-rating="2" aria-label="2 sur 5">2</button>
            <button type="button" data-rating="3" aria-label="3 sur 5">3</button>
            <button type="button" data-rating="4" aria-label="4 sur 5">4</button>
            <button type="button" data-rating="5" aria-label="5 sur 5">5</button>
          </div>
          <div class="hc-feedback-rating-labels"><small>À revoir</small><small>Très bien</small></div>
        </section>
        <section class="hc-feedback-question">
          <span>SUITE</span>
          <strong>Une suite est-elle nécessaire ?</strong>
          <div class="hc-feedback-pair">
            <button type="button" data-follow="yes">Oui</button>
            <button type="button" data-follow="no">Non</button>
          </div>
        </section>
        ${custom}
        ${noteBlock}
        <p class="hc-feedback-error" aria-live="polite"></p>
        <button type="button" class="hc-feedback-submit" disabled>Valider mon retour</button>
      </div>
    </div>`;

    document.body.appendChild(modal);

    let attendance = "",
      rating = 0,
      followUp = null,
      customAnswer = "";

    const following = modal.querySelector(".hc-feedback-following"),
      ratingBox = modal.querySelector(".hc-feedback-rating"),
      customBox = modal.querySelector(".hc-feedback-custom"),
      submit = modal.querySelector(".hc-feedback-submit"),
      error = modal.querySelector(".hc-feedback-error"),
      note = modal.querySelector("#hcFeedbackNote");

    const close = () => {
      modal.remove();
      document.body.classList.remove("hc-feedback-modal-open");
    };

    const sync = () => {
      following.hidden = !attendance;
      ratingBox.hidden = !attendance || attendance === "absent";
      if (customBox)
        customBox.hidden = !attendance || attendance === "absent";
      if (attendance === "absent") {
        rating = 0;
        customAnswer = "";
        modal
          .querySelectorAll("[data-rating],[data-custom]")
          .forEach((b) => b.classList.remove("selected"));
      }
      const valid =
        !!attendance &&
        followUp !== null &&
        (attendance === "absent" || rating > 0) &&
        (attendance === "absent" || !event.question || !!customAnswer);
      submit.disabled = !valid;
    };

    modal.querySelector(".hc-feedback-close").onclick = close;

    modal.querySelectorAll("[data-attendance]").forEach((button) => {
      button.onclick = () => {
        attendance = button.dataset.attendance || "";
        modal
          .querySelectorAll("[data-attendance]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        sync();
      };
    });

    modal.querySelectorAll("[data-rating]").forEach((button) => {
      button.onclick = () => {
        rating = Number(button.dataset.rating || 0);
        modal.querySelectorAll("[data-rating]").forEach((b) => {
          b.classList.toggle(
            "selected",
            Number(b.dataset.rating || 0) <= rating,
          );
        });
        sync();
      };
    });

    modal.querySelectorAll("[data-follow]").forEach((button) => {
      button.onclick = () => {
        followUp = button.dataset.follow === "yes";
        modal
          .querySelectorAll("[data-follow]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        sync();
      };
    });

    modal.querySelectorAll("[data-custom]").forEach((button) => {
      button.onclick = () => {
        customAnswer = button.dataset.custom || "";
        modal
          .querySelectorAll("[data-custom]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        sync();
      };
    });

    submit.onclick = async () => {
      if (submit.disabled) return;
      submit.disabled = true;
      error.textContent = "";
      submit.textContent = "Enregistrement…";
      try {
        await post("event_feedback_submit", {
          event_key: event.eventKey,
          attendance,
          rating: attendance === "absent" ? null : rating,
          follow_up: followUp,
          custom_answer:
            attendance === "absent" ? null : customAnswer || null,
          note: note ? String(note.value || "").trim() || null : null,
        });
        state.done.add(event.eventKey);
        state.loadedAt = Date.now();
        close();
        render();
        toast("Retour enregistré");
      } catch (e) {
        submit.disabled = false;
        submit.textContent = "Valider mon retour";
        error.textContent =
          e?.message === "RETOUR_TROP_TOT"
            ? "Ce retour sera disponible une heure après la fin prévue."
            : "Impossible d’enregistrer le retour. Réessaie.";
      }
    };

    modal.querySelector("[data-attendance]")?.focus();
  }

  function refreshFromBoot(event) {
    state.boot = event?.detail || window.STIPBootCache || state.boot;
    render();
    loadDone().catch(() => {});
  }

  window.addEventListener("stip:boot-updated", refreshFromBoot);
  window.addEventListener("stip:home-rendered", () => {
    state.boot = window.STIPBootCache || state.boot;
    render();
    loadDone().catch(() => {});
  });
  window.addEventListener("stip:session-ready", () => {
    state.boot = window.STIPBootCache || state.boot;
    loadDone(true).catch(() => {});
  });
  window.addEventListener("stip:session-ended", () => {
    state.done.clear();
    state.boot = null;
    state.loadedAt = 0;
    document.getElementById("hcEventFeedbackHost")?.remove();
    document.getElementById("hcEventFeedbackModal")?.remove();
    document.body.classList.remove("hc-feedback-modal-open");
  });

  setInterval(() => {
    if (!document.hidden) render();
  }, 30000);

  state.boot = window.STIPBootCache || state.boot;
  if (token()) loadDone(true).catch(() => {});
  render();
})();
