(() => {
  "use strict";

  const ACTION_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
    STORE = "stip_session_v1";

  const state = {
    boot: window.STIPBootCache || null,
    done: new Set(),
    hidden: new Set(),
    hiddenOwner: "",
    doneLoaded: false,
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

  function hiddenOwner() {
    const a = state.boot?.agent || window.STIPBootCache?.agent || {};
    return String(a.id || a.source_key || "session");
  }

  function hiddenStoreKey() {
    return `stip_event_feedback_hidden_v1:${hiddenOwner()}`;
  }

  function loadHidden() {
    const owner = hiddenOwner();
    if (state.hiddenOwner === owner) return;
    state.hiddenOwner = owner;
    try {
      const raw = JSON.parse(localStorage.getItem(hiddenStoreKey()) || "[]");
      state.hidden = new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      state.hidden = new Set();
    }
  }

  function saveHidden() {
    try {
      localStorage.setItem(hiddenStoreKey(), JSON.stringify([...state.hidden]));
    } catch {}
  }

  function hideFeedbackCard(eventKey) {
    loadHidden();
    state.hidden.add(String(eventKey || ""));
    saveHidden();
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
    if (/formation|training/.test(s)) return "training";
    if (/stagiaire|stage/.test(s)) return "intern";
    if (/réunion|reunion|briefing|staff/.test(s)) return "meeting";
    return "other";
  }

  function iconOf(kind, x = {}) {
    return (
      String(x.icon || "").trim() ||
      {
        medical: "🩺",
        training: "🎓",
        intern: "👶",
        meeting: "👥",
        other: "📌",
      }[kind] ||
      "📌"
    );
  }

  function feedbackProfile(kind) {
    const profiles = {
      medical: {
        sectionTitle: "RÉSULTAT DU RENDEZ-VOUS",
        labels: {
          ok: "Rendez-vous réalisé",
          problem: "Avec un problème",
          absent: "Rendez-vous non réalisé",
        },
        reasons: {
          problem: [
            ["delay", "Retard important"],
            ["location", "Lieu / adresse incorrecte"],
            ["convocation", "Convocation manquante"],
            ["organization", "Problème d’organisation"],
            ["other", "Autre"],
          ],
          absent: [
            ["cancelled", "Rendez-vous annulé"],
            ["convocation", "Convocation manquante"],
            ["location", "Lieu / adresse incorrecte"],
            ["unavailable", "Impossible de le réaliser"],
            ["other", "Autre"],
          ],
        },
        allowNote: false,
      },
      training: {
        sectionTitle: "RÉSULTAT DE LA FORMATION",
        labels: {
          ok: "Formation réalisée",
          problem: "Différente du prévu",
          absent: "Formation non réalisée",
        },
        reasons: {
          problem: [
            ["schedule", "Horaires différents"],
            ["location", "Lieu différent"],
            ["organization", "Organisation différente"],
            ["facilitator", "Formateur / intervenant"],
            ["information", "Information manquante"],
            ["other", "Autre"],
          ],
          absent: [
            ["cancelled", "Formation annulée"],
            ["not_informed", "Je n’avais pas l’information"],
            ["schedule", "Horaires / date incorrects"],
            ["location", "Lieu incorrect"],
            ["unavailable", "Impossible d’y participer"],
            ["other", "Autre"],
          ],
        },
        allowNote: true,
      },
      intern: {
        sectionTitle: "RÉSULTAT DE L’ACCOMPAGNEMENT",
        labels: {
          ok: "Accompagnement réalisé",
          problem: "Différent du prévu",
          absent: "Accompagnement non réalisé",
        },
        reasons: {
          problem: [
            ["schedule", "Horaires différents"],
            ["organization", "Organisation différente"],
            ["supervision", "Encadrement différent"],
            ["information", "Information manquante"],
            ["communication", "Communication"],
            ["other", "Autre"],
          ],
          absent: [
            ["trainee_absent", "Stagiaire absent"],
            ["not_informed", "Je n’avais pas été informé"],
            ["not_found", "Je ne l’ai pas vu / trouvé"],
            ["schedule", "Horaires / présence différents"],
            ["organization", "Organisation modifiée"],
            ["other", "Autre"],
          ],
        },
        allowNote: true,
      },
      meeting: {
        sectionTitle: "RÉSULTAT DE LA RÉUNION",
        labels: {
          ok: "Réunion réalisée",
          problem: "Avec un imprévu",
          absent: "Réunion non réalisée",
        },
        reasons: {
          problem: [
            ["schedule", "Horaires différents"],
            ["organization", "Organisation"],
            ["participants", "Participants"],
            ["information", "Information manquante"],
            ["communication", "Communication"],
            ["other", "Autre"],
          ],
          absent: [
            ["cancelled", "Réunion annulée"],
            ["not_informed", "Je n’avais pas l’information"],
            ["schedule", "Horaires / date incorrects"],
            ["location", "Lieu incorrect"],
            ["other", "Autre"],
          ],
        },
        allowNote: true,
      },
      other: {
        sectionTitle: "RÉSULTAT",
        labels: {
          ok: "Prévu réalisé",
          problem: "Déroulement différent",
          absent: "Non réalisé",
        },
        reasons: {
          problem: [
            ["schedule", "Horaires"],
            ["organization", "Organisation"],
            ["information", "Information manquante"],
            ["communication", "Communication"],
            ["process", "Déroulement"],
            ["other", "Autre"],
          ],
          absent: [
            ["cancelled", "Annulé"],
            ["not_informed", "Je n’avais pas l’information"],
            ["schedule", "Horaires / date"],
            ["location", "Lieu"],
            ["unavailable", "Impossible à réaliser"],
            ["other", "Autre"],
          ],
        },
        allowNote: true,
      },
    };
    return profiles[kind] || profiles.other;
  }

  function outcomeName(value) {
    return { ok: "realized", problem: "different", absent: "not_realized" }[
      value
    ] || "";
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
        question:
          kind === "medical"
            ? ""
            : String(x.feedback_question || "").trim(),
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
      state.doneLoaded = true;
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

    if (!state.doneLoaded) return;
    loadHidden();

    const passed = passedEvents();
    suppressMovedCards(passed);

    const pending = passed.filter(
      (x) => !state.done.has(x.eventKey) && !state.hidden.has(x.eventKey),
    );
    let host = document.getElementById("hcEventFeedbackHost");
    if (!pending.length) {
      host?.remove();
      return;
    }

    if (!host) {
      host = document.createElement("section");
      host.id = "hcEventFeedbackHost";
      host.className = "hc-feedback-pending";
      // Keep the dated weekly overview immediately below the common header.
      // insertBefore requires a direct child, not a nested week/detail node.
      const week = planning.querySelector(":scope > .hc-week-context-master");
      if (week) week.insertAdjacentElement("afterend", host);
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

    const profile = feedbackProfile(event.kind);
    const modal = document.createElement("div");
    modal.id = "hcEventFeedbackModal";
    modal.className = "hc-feedback-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "hcFeedbackTitle");

    const noteBlock = profile.allowNote
      ? '<section class="hc-feedback-note" data-feedback-note hidden><label for="hcFeedbackNote">Précision <small>facultative</small></label><textarea id="hcFeedbackNote" maxlength="500" rows="3" placeholder="Ajoute seulement l’information utile"></textarea></section>'
      : "";
    const custom = event.question
      ? `<section class="hc-feedback-question hc-feedback-custom" hidden><span>QUESTION LIÉE À CET ÉVÉNEMENT</span><strong>${esc(
          event.question,
        )}</strong><div class="hc-feedback-pair"><button type="button" data-custom="yes">Oui</button><button type="button" data-custom="no">Non</button></div></section>`
      : "";
    const medicalBlock =
      event.kind === "medical"
        ? '<section class="hc-feedback-medical-summary"><strong>Suivi administratif</strong><span>Aucune information médicale n’est demandée ni enregistrée.</span></section>'
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
      ${medicalBlock}
      <div class="hc-feedback-section-separator"><span>${esc(profile.sectionTitle)}</span></div>
      <section class="hc-feedback-presence">
        <div class="hc-feedback-presence-options">
          <button type="button" data-attendance="ok"><span class="hc-feedback-choice-mark" aria-hidden="true">✓</span><strong>${esc(profile.labels.ok)}</strong></button>
          <button type="button" data-attendance="problem"><span class="hc-feedback-choice-mark" aria-hidden="true">!</span><strong>${esc(profile.labels.problem)}</strong></button>
          <button type="button" data-attendance="absent"><span class="hc-feedback-choice-mark" aria-hidden="true">×</span><strong>${esc(profile.labels.absent)}</strong></button>
        </div>
      </section>
      <div class="hc-feedback-following" hidden>
        <section class="hc-feedback-reason" hidden>
          <span>QUE S’EST-IL PASSÉ ?</span>
          <div class="hc-feedback-reason-options"></div>
        </section>
        ${custom}
        ${noteBlock}
        <section class="hc-feedback-question" data-follow-section hidden>
          <span>SUITE</span>
          <strong>Une action est-elle nécessaire ?</strong>
          <div class="hc-feedback-pair">
            <button type="button" data-follow="yes">Oui</button>
            <button type="button" data-follow="no">Non</button>
          </div>
        </section>
        <section class="hc-feedback-mail-actions" hidden>
          <button type="button" class="hc-feedback-mail-one" data-mail-flow="prepare">
            <span aria-hidden="true">✉</span>
            <div><strong>Préparer un mail</strong><small>STIP propose le bon destinataire et un texte adapté</small></div>
            <b aria-hidden="true">›</b>
          </button>
        </section>
        <section class="hc-feedback-mail-compose" hidden>
          <header class="hc-feedback-mail-compose-head">
            <div><small>MAIL DE SUIVI</small><strong>Mail proposé</strong></div>
            <button type="button" data-mail-back aria-label="Retour">‹</button>
          </header>
          <div class="hc-feedback-mail-sender" data-mail-sender></div>
          <div class="hc-feedback-mail-recipient-group">
            <div class="hc-feedback-mail-recipient-title"><strong>À</strong><small>Destinataire conseillé</small></div>
            <div class="hc-feedback-mail-recipient-list" data-mail-to-list></div>
          </div>
          <div class="hc-feedback-mail-recipient-group" data-mail-cc-group>
            <div class="hc-feedback-mail-recipient-title"><strong>Cc</strong><small>Copies facultatives</small></div>
            <div class="hc-feedback-mail-recipient-list compact" data-mail-cc-list></div>
          </div>
          <div class="hc-feedback-mail-preview" data-mail-preview></div>
          <details class="hc-feedback-mail-edit">
            <summary>Voir ou modifier le mail</summary>
            <label class="hc-feedback-mail-field"><span>Objet</span><input type="text" maxlength="180" data-mail-subject></label>
            <label class="hc-feedback-mail-field"><span>Message</span><textarea rows="8" maxlength="5000" data-mail-body></textarea></label>
          </details>
          <p class="hc-feedback-mail-privacy" data-mail-privacy hidden>Événement sensible : seuls les destinataires administratifs utiles sont proposés.</p>
          <p class="hc-feedback-mail-status" data-mail-status aria-live="polite"></p>
          <div class="hc-feedback-mail-buttons">
            <button type="button" class="hc-feedback-mail-send" data-mail-send hidden>Envoyer maintenant</button>
            <button type="button" class="hc-feedback-mail-native" data-mail-native>Ouvrir dans ma boîte mail</button>
          </div>
        </section>
        <p class="hc-feedback-error" aria-live="polite"></p>
        <button type="button" class="hc-feedback-submit" disabled>Valider mon retour</button>
      </div>
      <button type="button" class="hc-feedback-dismiss" data-feedback-dismiss>Masquer cette carte</button>
    </div>`;

    document.body.appendChild(modal);

    let attendance = "",
      reasonCode = "",
      followUp = null,
      customAnswer = "",
      mailContext = null,
      mailContextKey = "",
      nativeOpened = false,
      mailLoading = false;
    const mailTo = new Set(),
      mailCc = new Set();

    const following = modal.querySelector(".hc-feedback-following"),
      reasonBox = modal.querySelector(".hc-feedback-reason"),
      reasonOptions = modal.querySelector(".hc-feedback-reason-options"),
      followSection = modal.querySelector("[data-follow-section]"),
      customBox = modal.querySelector(".hc-feedback-custom"),
      noteBox = modal.querySelector("[data-feedback-note]"),
      submit = modal.querySelector(".hc-feedback-submit"),
      error = modal.querySelector(".hc-feedback-error"),
      note = modal.querySelector("#hcFeedbackNote"),
      mailActions = modal.querySelector(".hc-feedback-mail-actions"),
      mailCompose = modal.querySelector(".hc-feedback-mail-compose"),
      mailSender = modal.querySelector("[data-mail-sender]"),
      mailToList = modal.querySelector("[data-mail-to-list]"),
      mailCcList = modal.querySelector("[data-mail-cc-list]"),
      mailCcGroup = modal.querySelector("[data-mail-cc-group]"),
      mailPreview = modal.querySelector("[data-mail-preview]"),
      mailSubject = modal.querySelector("[data-mail-subject]"),
      mailBody = modal.querySelector("[data-mail-body]"),
      mailPrivacy = modal.querySelector("[data-mail-privacy]"),
      mailStatus = modal.querySelector("[data-mail-status]"),
      mailSend = modal.querySelector("[data-mail-send]"),
      mailNative = modal.querySelector("[data-mail-native]");

    const close = () => {
      modal.remove();
      document.body.classList.remove("hc-feedback-modal-open");
    };

    const coreValid = () => {
      if (!attendance) return false;
      if (attendance !== "ok" && !reasonCode) return false;
      if (event.question && attendance !== "absent" && !customAnswer) return false;
      return true;
    };

    const feedbackBody = () => ({
      event_key: event.eventKey,
      attendance,
      outcome: outcomeName(attendance),
      rating: null,
      reason_code: attendance === "ok" ? null : reasonCode || null,
      follow_up: followUp,
      custom_answer:
        attendance === "absent" ? null : customAnswer || null,
      note:
        profile.allowNote && note
          ? String(note.value || "").trim() || null
          : null,
    });

    const finish = (message) => {
      state.done.add(event.eventKey);
      state.loadedAt = Date.now();
      close();
      render();
      window.dispatchEvent(
        new CustomEvent("stip:event-feedback-completed", {
          detail: { event_key: event.eventKey },
        }),
      );
      toast(message);
    };

    const resetMailFlow = () => {
      mailContext = null;
      mailContextKey = "";
      nativeOpened = false;
      mailLoading = false;
      mailTo.clear();
      mailCc.clear();
      if (mailCompose) mailCompose.hidden = true;
      if (mailStatus) mailStatus.textContent = "";
    };

    const currentMailKey = () =>
      JSON.stringify({
        attendance,
        reasonCode,
        customAnswer,
        note: note ? String(note.value || "").trim() : "",
      });

    const syncMailSelections = () => {
      if (!mailContext) return;
      mailToList?.querySelectorAll("[data-mail-address]").forEach((b) => {
        const email = b.dataset.mailAddress || "";
        b.classList.toggle("selected", mailTo.has(email));
      });
      mailCcList?.querySelectorAll("[data-mail-address]").forEach((b) => {
        const email = b.dataset.mailAddress || "";
        b.classList.toggle("selected", mailCc.has(email));
      });
      if (mailNative) mailNative.disabled = !mailTo.size;
      if (mailSend)
        mailSend.disabled =
          !mailContext.direct_send || !mailTo.size || !coreValid();
    };

    const recipientMarkup = (candidate, bucket) => {
      const selected = bucket === "to" ? mailTo.has(candidate.email) : mailCc.has(candidate.email);
      return `<button type="button" class="hc-feedback-mail-recipient${selected ? " selected" : ""}" data-mail-bucket="${bucket}" data-mail-address="${esc(candidate.email)}"><span><strong>${esc(candidate.name)}</strong><small>${esc(candidate.role || candidate.reason || "")}</small></span><em>${esc(candidate.reason || "")}</em></button>`;
    };

    const renderMailContext = (ctx) => {
      const candidates = Array.isArray(ctx?.candidates) ? ctx.candidates : [],
        toCandidates = candidates.filter((x) => x.bucket !== "cc"),
        ccCandidates = candidates.filter((x) => x.bucket === "cc");

      if (!mailTo.size && toCandidates.length) {
        const preferred =
          toCandidates.find((x) => x.recommended) || toCandidates[0];
        if (preferred?.email) mailTo.add(preferred.email);
      }

      if (mailToList)
        mailToList.innerHTML =
          toCandidates.map((x) => recipientMarkup(x, "to")).join("") ||
          '<span class="hc-feedback-mail-empty">Aucun destinataire professionnel directement lié n’a été trouvé.</span>';

      if (mailCcList)
        mailCcList.innerHTML =
          ccCandidates.map((x) => recipientMarkup(x, "cc")).join("") ||
          '<span class="hc-feedback-mail-empty">Aucune copie utile proposée.</span>';
      if (mailCcGroup) mailCcGroup.hidden = !ccCandidates.length;

      if (mailSubject) mailSubject.value = ctx?.draft?.subject || "";
      if (mailBody) mailBody.value = ctx?.draft?.body || "";
      if (mailPreview) {
        const body = String(ctx?.draft?.body || "").replace(/\s+/g, " ").trim();
        const excerpt = body.length > 190 ? body.slice(0, 187) + "…" : body;
        mailPreview.innerHTML = `<strong>${esc(ctx?.draft?.subject || "Mail de suivi")}</strong><p>${esc(excerpt)}</p>`;
      }
      if (mailPrivacy) mailPrivacy.hidden = !ctx?.event?.sensitive;
      if (mailSender) {
        mailSender.textContent = ctx?.direct_send
          ? "Tu peux l’envoyer directement depuis STIP ou l’ouvrir dans ta messagerie."
          : "Le mail sera ouvert dans ta messagerie avec les champs déjà remplis.";
      }
      if (mailSend) mailSend.hidden = !ctx?.direct_send;
      syncMailSelections();
    };

    const loadMailContext = async () => {
      if (!coreValid() || mailLoading) return;
      nativeOpened = false;
      mailActions.hidden = true;
      mailCompose.hidden = false;
      const key = currentMailKey();
      if (mailContext && mailContextKey === key) {
        renderMailContext(mailContext);
        mailCompose.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      mailLoading = true;
      mailStatus.textContent = "STIP cherche les destinataires liés à cet événement…";
      mailTo.clear();
      mailCc.clear();
      try {
        const ctx = await post("event_mail_context", feedbackBody());
        mailContext = ctx;
        mailContextKey = key;
        renderMailContext(ctx);
        mailStatus.textContent = "";
      } catch (e) {
        mailContext = null;
        mailStatus.textContent =
          "Impossible de préparer le mail pour le moment.";
      } finally {
        mailLoading = false;
        mailCompose.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    const openNativeMail = () => {
      if (!mailContext || !mailTo.size) return;
      const subject = String(mailSubject?.value || "").trim(),
        body = String(mailBody?.value || "").trim(),
        to = [...mailTo],
        cc = [...mailCc].filter((x) => !mailTo.has(x)),
        path = to.map((x) => encodeURIComponent(x)).join(","),
        params = new URLSearchParams();
      if (cc.length) params.set("cc", cc.join(","));
      if (subject) params.set("subject", subject);
      if (body) params.set("body", body);
      nativeOpened = true;
      mailStatus.textContent =
        "La messagerie va s’ouvrir. Au retour, tu pourras clôturer ce retour.";
      sync();
      window.location.href = `mailto:${path}?${params.toString()}`;
    };

    const renderReasons = () => {
      const options = profile.reasons?.[attendance] || [];
      if (reasonOptions)
        reasonOptions.innerHTML = options
          .map(
            ([code, label]) =>
              `<button type="button" data-reason="${esc(code)}">${esc(label)}</button>`,
          )
          .join("");
      if (reasonBox)
        reasonBox.hidden = attendance === "ok" || !options.length;
    };

    const sync = () => {
      following.hidden = !attendance;
      renderReasons();

      if (noteBox) noteBox.hidden = !attendance;

      if (customBox)
        customBox.hidden =
          !attendance || attendance === "absent" || !event.question;

      const validCore = coreValid();
      if (followSection) followSection.hidden = !validCore;

      const valid = validCore && followUp !== null;
      mailActions.hidden = !(valid && followUp === true) || !mailCompose.hidden;
      if ((!validCore || followUp !== true) && !mailCompose.hidden)
        resetMailFlow();

      submit.hidden = followUp === null || (followUp === true && !nativeOpened);
      submit.textContent =
        followUp === true ? "Clôturer mon retour" : "Valider mon retour";
      submit.disabled = !valid || (followUp === true && !nativeOpened);

      modal.querySelectorAll("[data-mail-flow]").forEach((b) => {
        b.disabled = !validCore;
      });
      syncMailSelections();
    };

    modal.querySelector(".hc-feedback-close").onclick = close;
    modal.querySelector("[data-feedback-dismiss]")?.addEventListener("click", () => {
      if (!confirm("Masquer cette carte sans envoyer de retour ?")) return;
      hideFeedbackCard(event.eventKey);
      close();
      render();
      toast("Carte masquée");
    });

    modal.querySelectorAll("[data-attendance]").forEach((button) => {
      button.onclick = () => {
        const next = button.dataset.attendance || "";
        if (attendance !== next) {
          resetMailFlow();
          attendance = next;
          reasonCode = "";
          customAnswer = "";
          followUp = null;
          modal
            .querySelectorAll("[data-custom],[data-follow]")
            .forEach((b) => b.classList.remove("selected", "current"));
        }
        modal
          .querySelectorAll("[data-attendance]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        sync();
      };
    });

    reasonBox?.addEventListener("click", (clickEvent) => {
      const button = clickEvent.target.closest("[data-reason]");
      if (!button) return;
      const next = button.dataset.reason || "";
      if (reasonCode !== next) resetMailFlow();
      reasonCode = next;
      reasonBox
        .querySelectorAll("[data-reason]")
        .forEach((b) => b.classList.toggle("selected", b === button));
      sync();
    });

    modal.querySelectorAll("[data-follow]").forEach((button) => {
      button.onclick = () => {
        followUp = button.dataset.follow === "yes";
        modal
          .querySelectorAll("[data-follow]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        if (!followUp) resetMailFlow();
        sync();
      };
    });

    modal.querySelectorAll("[data-custom]").forEach((button) => {
      button.onclick = () => {
        const next = button.dataset.custom || "";
        if (customAnswer !== next) resetMailFlow();
        customAnswer = next;
        modal
          .querySelectorAll("[data-custom]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        sync();
      };
    });

    note?.addEventListener("input", () => {
      if (mailContext) resetMailFlow();
      sync();
    });

    modal.querySelectorAll("[data-mail-flow]").forEach((button) => {
      button.onclick = loadMailContext;
    });

    modal.querySelector("[data-mail-back]")?.addEventListener("click", () => {
      mailCompose.hidden = true;
      mailActions.hidden = false;
      nativeOpened = false;
      sync();
    });

    mailCompose?.addEventListener("click", (eventClick) => {
      const b = eventClick.target.closest("[data-mail-address]");
      if (!b) return;
      const email = b.dataset.mailAddress || "",
        bucket = b.dataset.mailBucket || "to";
      if (!email) return;
      if (bucket === "to") {
        if (mailTo.has(email)) mailTo.delete(email);
        else mailTo.add(email);
      } else {
        if (mailCc.has(email)) mailCc.delete(email);
        else mailCc.add(email);
      }
      syncMailSelections();
    });

    mailNative?.addEventListener("click", openNativeMail);

    mailSend?.addEventListener("click", async () => {
      if (!mailContext?.direct_send || !mailTo.size || !coreValid()) return;
      mailSend.disabled = true;
      mailNative.disabled = true;
      mailStatus.textContent = "Envoi du mail…";
      try {
        await post("event_mail_send", {
          ...feedbackBody(),
          follow_up: true,
          to: [...mailTo],
          cc: [...mailCc].filter((x) => !mailTo.has(x)),
          subject: String(mailSubject?.value || "").trim(),
          body: String(mailBody?.value || "").trim(),
        });
        finish("Mail envoyé · retour clôturé");
      } catch (e) {
        mailStatus.textContent =
          e?.message === "ENVOI_MAIL_STIP_NON_CONFIGURE"
            ? "L’envoi direct STIP n’est pas activé. Utilise ta boîte mail."
            : "Le mail n’a pas été envoyé. Vérifie les destinataires puis réessaie.";
        syncMailSelections();
      }
    });

    submit.onclick = async () => {
      if (submit.disabled) return;
      submit.disabled = true;
      error.textContent = "";
      submit.textContent = "Enregistrement…";
      try {
        await post("event_feedback_submit", feedbackBody());
        finish(
          followUp === true
            ? "Retour clôturé"
            : "Retour enregistré",
        );
      } catch (e) {
        submit.disabled = false;
        submit.textContent =
          followUp === true ? "Clôturer mon retour" : "Valider mon retour";
        error.textContent =
          e?.message === "RETOUR_TROP_TOT"
            ? "Ce retour sera disponible une heure après la fin prévue."
            : e?.message === "RETOUR_MOTIF_REQUIS"
              ? "Choisis ce qui explique ce résultat."
              : "Impossible d’enregistrer le retour. Réessaie.";
      }
    };

    sync();
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
    state.hidden.clear();
    state.hiddenOwner = "";
    state.doneLoaded = false;
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
