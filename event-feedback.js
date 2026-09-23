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
        mode: "administrative",
        rating: false,
        reasonTitle: "PROBLÈME RENCONTRÉ",
        reasons: [
          ["cancelled", "Rendez-vous annulé"],
          ["delay", "Retard important"],
          ["location", "Lieu / adresse incorrecte"],
          ["convocation", "Convocation manquante"],
          ["organization", "Autre problème d’organisation"],
        ],
      },
      training: {
        mode: "rated",
        rating: true,
        reasonTitle: "CE QUI EXPLIQUE TA NOTE",
        reasons: [
          ["content", "Contenu"],
          ["facilitator", "Formateur"],
          ["organization", "Organisation"],
          ["schedule", "Horaires"],
          ["usefulness", "Utilité"],
          ["other", "Autre"],
        ],
      },
      intern: {
        mode: "rated",
        rating: true,
        reasonTitle: "CE QUI EXPLIQUE TA NOTE",
        reasons: [
          ["reception", "Accueil"],
          ["supervision", "Encadrement"],
          ["autonomy", "Autonomie"],
          ["organization", "Organisation"],
          ["communication", "Communication"],
          ["other", "Autre"],
        ],
      },
      meeting: {
        mode: "rated",
        rating: true,
        reasonTitle: "CE QUI EXPLIQUE TA NOTE",
        reasons: [
          ["organization", "Organisation"],
          ["schedule", "Horaires"],
          ["usefulness", "Utilité"],
          ["communication", "Communication"],
          ["clarity", "Clarté"],
          ["other", "Autre"],
        ],
      },
      other: {
        mode: "rated",
        rating: true,
        reasonTitle: "CE QUI EXPLIQUE TA NOTE",
        reasons: [
          ["organization", "Organisation"],
          ["schedule", "Horaires"],
          ["communication", "Communication"],
          ["usefulness", "Utilité"],
          ["process", "Déroulement"],
          ["other", "Autre"],
        ],
      },
    };
    return profiles[kind] || profiles.other;
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
      const before =
        planning.querySelector(".hc-home-today-separator") ||
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

    const profile = feedbackProfile(event.kind);
    const modal = document.createElement("div");
    modal.id = "hcEventFeedbackModal";
    modal.className = "hc-feedback-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "hcFeedbackTitle");

    const noteBlock =
      event.kind === "medical"
        ? ""
        : '<section class="hc-feedback-note"><label for="hcFeedbackNote">Précision <small>facultative</small></label><textarea id="hcFeedbackNote" maxlength="500" rows="3" placeholder="Une information utile, si nécessaire"></textarea></section>';
    const custom = event.question && event.kind !== "medical"
      ? `<section class="hc-feedback-question hc-feedback-custom" hidden><span>QUESTION LIÉE À CET ÉVÉNEMENT</span><strong>${esc(
          event.question,
        )}</strong><div class="hc-feedback-pair"><button type="button" data-custom="yes">Oui</button><button type="button" data-custom="no">Non</button></div></section>`
      : "";

    const attendanceProblemLabel = profile.rating
      ? "J’étais présent, mais…"
      : "J’ai rencontré un problème";
    const attendanceOkLabel = profile.rating
      ? "Tout s’est bien déroulé"
      : "Rendez-vous terminé sans problème";
    const ratingBlock = profile.rating
      ? `<section class="hc-feedback-rating hc-feedback-rating-hero" hidden>
          <div class="hc-feedback-rating-title"><span>APPRÉCIATION DE L’ÉVÉNEMENT</span><strong>Comment l’évaluer ?</strong></div>
          <div class="hc-feedback-rating-bar" role="group" aria-label="Note sur 5">
            <button type="button" data-rating="1" aria-label="1 sur 5"><b>1</b></button>
            <button type="button" data-rating="2" aria-label="2 sur 5"><b>2</b></button>
            <button type="button" data-rating="3" aria-label="3 sur 5"><b>3</b></button>
            <button type="button" data-rating="4" aria-label="4 sur 5"><b>4</b></button>
            <button type="button" data-rating="5" aria-label="5 sur 5"><b>5</b></button>
          </div>
          <div class="hc-feedback-rating-labels"><small>À revoir</small><small>Très bien</small></div>
          <small class="hc-feedback-rating-hint">Choisis une note, puis ce qui l’explique.</small>
        </section>`
      : "";
    const reasonBlock = `<section class="hc-feedback-reason" hidden>
      <span>${esc(profile.reasonTitle)}</span>
      <div class="hc-feedback-reason-options">
        ${profile.reasons
          .map(
            ([code, label]) =>
              `<button type="button" data-reason="${esc(code)}">${esc(label)}</button>`,
          )
          .join("")}
      </div>
    </section>`;
    const medicalBlock = profile.rating
      ? ""
      : '<section class="hc-feedback-medical-summary"><strong>Suivi administratif</strong><span>Aucune note ni information médicale n’est demandée.</span></section>';

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
      <div class="hc-feedback-section-separator"><span>COMMENT ÇA S’EST PASSÉ ?</span></div>
      <section class="hc-feedback-presence">
        <div class="hc-feedback-presence-options">
          <button type="button" data-attendance="absent"><span class="hc-feedback-choice-mark" aria-hidden="true">×</span><strong>Je n’étais pas présent</strong></button>
          <button type="button" data-attendance="problem"><span class="hc-feedback-choice-mark" aria-hidden="true">!</span><strong>${esc(attendanceProblemLabel)}</strong></button>
          <button type="button" data-attendance="ok"><span class="hc-feedback-choice-mark" aria-hidden="true">✓</span><strong>${esc(attendanceOkLabel)}</strong></button>
        </div>
      </section>
      <div class="hc-feedback-following" hidden>
        ${ratingBlock}
        ${reasonBlock}
        <section class="hc-feedback-question" data-follow-section hidden>
          <span>SUITE</span>
          <strong>Une suite est-elle nécessaire ?</strong>
          <div class="hc-feedback-pair">
            <button type="button" data-follow="yes">Oui</button>
            <button type="button" data-follow="no">Non</button>
          </div>
        </section>
        <section class="hc-feedback-mail-actions" hidden>
          <div class="hc-feedback-section-separator"><span>COMMENT POURSUIVRE ?</span></div>
          <div class="hc-feedback-mail-paths">
            <button type="button" data-mail-flow="prepare"><span aria-hidden="true">✉</span><div><strong>Préparer le mail ici</strong><small>Destinataires, objet et texte déjà préparés</small></div><b>›</b></button>
            <button type="button" data-mail-flow="native"><span aria-hidden="true">↗</span><div><strong>Ouvrir ma boîte mail</strong><small>STIP remplit le mail avant l’ouverture</small></div><b>›</b></button>
          </div>
        </section>
        <section class="hc-feedback-mail-compose" hidden>
          <header class="hc-feedback-mail-compose-head">
            <div><small>MAIL DE SUIVI</small><strong>Prêt à envoyer</strong></div>
            <button type="button" data-mail-back aria-label="Retour">‹</button>
          </header>
          <div class="hc-feedback-mail-sender" data-mail-sender>Préparation des destinataires…</div>
          <div class="hc-feedback-mail-recipient-group">
            <div class="hc-feedback-mail-recipient-title"><strong>À</strong><small>Destinataire principal</small></div>
            <div class="hc-feedback-mail-recipient-list" data-mail-to-list></div>
          </div>
          <div class="hc-feedback-mail-recipient-group">
            <div class="hc-feedback-mail-recipient-title"><strong>Cc</strong><small>Copie rapide</small></div>
            <div class="hc-feedback-mail-recipient-list compact" data-mail-cc-list></div>
          </div>
          <label class="hc-feedback-mail-field"><span>Objet</span><input type="text" maxlength="180" data-mail-subject></label>
          <label class="hc-feedback-mail-field"><span>Message</span><textarea rows="8" maxlength="5000" data-mail-body></textarea></label>
          <p class="hc-feedback-mail-privacy" data-mail-privacy hidden>Événement sensible : les collègues du shift ne sont pas proposés comme destinataires.</p>
          <p class="hc-feedback-mail-status" data-mail-status aria-live="polite"></p>
          <div class="hc-feedback-mail-buttons">
            <button type="button" class="hc-feedback-mail-send" data-mail-send>Envoyer depuis STIP</button>
            <button type="button" class="hc-feedback-mail-native" data-mail-native>Ouvrir dans ma boîte mail</button>
          </div>
        </section>
        ${custom}
        ${noteBlock}
        <p class="hc-feedback-error" aria-live="polite"></p>
        <button type="button" class="hc-feedback-submit" disabled>Valider mon retour</button>
      </div>
      <button type="button" class="hc-feedback-dismiss" data-feedback-dismiss>Masquer cette carte</button>
    </div>`;

    document.body.appendChild(modal);

    let attendance = "",
      rating = 0,
      reasonCode = "",
      followUp = null,
      customAnswer = "",
      mailContext = null,
      mailContextAttendance = "",
      mailMode = "",
      nativeOpened = false,
      mailLoading = false;
    const mailTo = new Set(),
      mailCc = new Set();

    const following = modal.querySelector(".hc-feedback-following"),
      ratingBox = modal.querySelector(".hc-feedback-rating"),
      reasonBox = modal.querySelector(".hc-feedback-reason"),
      followSection = modal.querySelector("[data-follow-section]"),
      customBox = modal.querySelector(".hc-feedback-custom"),
      submit = modal.querySelector(".hc-feedback-submit"),
      error = modal.querySelector(".hc-feedback-error"),
      note = modal.querySelector("#hcFeedbackNote"),
      mailActions = modal.querySelector(".hc-feedback-mail-actions"),
      mailCompose = modal.querySelector(".hc-feedback-mail-compose"),
      mailSender = modal.querySelector("[data-mail-sender]"),
      mailToList = modal.querySelector("[data-mail-to-list]"),
      mailCcList = modal.querySelector("[data-mail-cc-list]"),
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
      if (attendance === "absent") return true;
      if (profile.rating && (!rating || !reasonCode)) return false;
      if (!profile.rating && attendance === "problem" && !reasonCode)
        return false;
      if (event.question && !customAnswer) return false;
      return true;
    };

    const feedbackBody = () => ({
      event_key: event.eventKey,
      attendance,
      rating:
        attendance === "absent" || !profile.rating ? null : rating,
      reason_code:
        attendance === "absent" ||
        (!profile.rating && attendance !== "problem")
          ? null
          : reasonCode || null,
      follow_up: followUp,
      custom_answer:
        attendance === "absent" || !profile.rating
          ? null
          : customAnswer || null,
      note:
        !profile.rating || !note
          ? null
          : String(note.value || "").trim() || null,
    });

    const finish = (message) => {
      state.done.add(event.eventKey);
      state.loadedAt = Date.now();
      close();
      render();
      toast(message);
    };

    const resetMailFlow = () => {
      mailContext = null;
      mailContextAttendance = "";
      mailMode = "";
      nativeOpened = false;
      mailLoading = false;
      mailTo.clear();
      mailCc.clear();
      if (mailCompose) mailCompose.hidden = true;
      if (mailStatus) mailStatus.textContent = "";
    };

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
      const candidates = Array.isArray(ctx?.candidates) ? ctx.candidates : [];
      if (!mailTo.size && candidates.length) {
        const preferred =
          candidates.find((x) => x.recommended && x.kind === "encadrement") ||
          candidates.find((x) => x.recommended) ||
          candidates[0];
        if (preferred?.email) mailTo.add(preferred.email);
      }
      if (mailToList)
        mailToList.innerHTML =
          candidates.map((x) => recipientMarkup(x, "to")).join("") ||
          '<span class="hc-feedback-mail-empty">Aucun destinataire avec adresse professionnelle n’a été trouvé.</span>';
      if (mailCcList)
        mailCcList.innerHTML =
          candidates.map((x) => recipientMarkup(x, "cc")).join("") ||
          '<span class="hc-feedback-mail-empty">Aucune copie proposée.</span>';
      if (mailSubject) mailSubject.value = ctx?.draft?.subject || "";
      if (mailBody) mailBody.value = ctx?.draft?.body || "";
      if (mailPrivacy) mailPrivacy.hidden = !ctx?.event?.sensitive;
      if (mailSender) {
        const reply = ctx?.sender?.reply_to
          ? ` · réponses vers ${ctx.sender.reply_to}`
          : "";
        mailSender.textContent = ctx?.direct_send
          ? `Envoi : ${ctx.sender.from || "STIP"}${reply}`
          : `Envoi direct STIP à activer${reply}. La boîte mail native reste disponible.`;
      }
      if (mailSend) {
        mailSend.textContent = ctx?.direct_send
          ? "Envoyer depuis STIP"
          : "Envoi direct STIP à activer";
      }
      syncMailSelections();
    };

    const loadMailContext = async (mode) => {
      if (!coreValid() || mailLoading) return;
      mailMode = mode;
      nativeOpened = false;
      mailActions.hidden = true;
      mailCompose.hidden = false;
      if (mailContext && mailContextAttendance === attendance) {
        renderMailContext(mailContext);
        mailCompose.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      mailLoading = true;
      mailStatus.textContent = "STIP cherche les destinataires utiles…";
      mailTo.clear();
      mailCc.clear();
      try {
        const ctx = await post("event_mail_context", {
          event_key: event.eventKey,
          attendance,
        });
        mailContext = ctx;
        mailContextAttendance = attendance;
        renderMailContext(ctx);
        mailStatus.textContent = "";
      } catch (e) {
        mailContext = null;
        mailStatus.textContent =
          "Impossible de préparer les destinataires pour le moment.";
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
        "La boîte mail va s’ouvrir. Au retour, finalise simplement le retour dans STIP.";
      sync();
      window.location.href = `mailto:${path}?${params.toString()}`;
    };

    const sync = () => {
      following.hidden = !attendance;

      if (ratingBox)
        ratingBox.hidden =
          !profile.rating || !attendance || attendance === "absent";

      const showReason =
        !!attendance &&
        attendance !== "absent" &&
        ((profile.rating && rating > 0) ||
          (!profile.rating && attendance === "problem"));
      if (reasonBox) reasonBox.hidden = !showReason;

      if (customBox)
        customBox.hidden =
          !attendance ||
          attendance === "absent" ||
          !profile.rating ||
          !rating ||
          !reasonCode;

      if (attendance === "absent") {
        rating = 0;
        reasonCode = "";
        customAnswer = "";
        modal
          .querySelectorAll("[data-rating],[data-reason],[data-custom]")
          .forEach((b) => b.classList.remove("selected", "current"));
      }

      if (ratingBox) {
        const ratingHint = ratingBox.querySelector(
          ".hc-feedback-rating-hint",
        );
        if (ratingHint)
          ratingHint.textContent = rating
            ? `Note sélectionnée : ${rating}/5 · choisis ce qui l’explique.`
            : "Choisis une note, puis ce qui l’explique.";
      }

      const validCore = coreValid();
      if (followSection) followSection.hidden = !validCore;

      const valid = validCore && followUp !== null;
      mailActions.hidden = !(valid && followUp === true) || !mailCompose.hidden;
      if ((!validCore || followUp !== true) && !mailCompose.hidden)
        resetMailFlow();
      submit.hidden = followUp === null || (followUp === true && !nativeOpened);
      submit.textContent =
        followUp === true ? "Finaliser mon retour" : "Valider mon retour";
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
        if (attendance && attendance !== next) {
          resetMailFlow();
          rating = 0;
          reasonCode = "";
          customAnswer = "";
          followUp = null;
          modal
            .querySelectorAll(
              "[data-rating],[data-reason],[data-custom],[data-follow]",
            )
            .forEach((b) => b.classList.remove("selected", "current"));
        }
        attendance = next;
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
          const value = Number(b.dataset.rating || 0);
          b.classList.toggle("selected", value <= rating);
          b.classList.toggle("current", value === rating);
        });
        sync();
      };
    });

    modal.querySelectorAll("[data-reason]").forEach((button) => {
      button.onclick = () => {
        reasonCode = button.dataset.reason || "";
        modal
          .querySelectorAll("[data-reason]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        sync();
      };
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
        customAnswer = button.dataset.custom || "";
        modal
          .querySelectorAll("[data-custom]")
          .forEach((b) => b.classList.toggle("selected", b === button));
        sync();
      };
    });

    modal.querySelectorAll("[data-mail-flow]").forEach((button) => {
      button.onclick = () => loadMailContext(button.dataset.mailFlow || "prepare");
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
        else {
          mailTo.add(email);
          mailCc.delete(email);
        }
      } else {
        if (mailCc.has(email)) mailCc.delete(email);
        else {
          mailCc.add(email);
          mailTo.delete(email);
        }
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
            ? "L’envoi direct STIP n’est pas encore activé. Utilise la boîte mail native."
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
          followUp === true ? "Finaliser mon retour" : "Valider mon retour";
        error.textContent =
          e?.message === "RETOUR_TROP_TOT"
            ? "Ce retour sera disponible une heure après la fin prévue."
            : e?.message === "RETOUR_MOTIF_REQUIS"
              ? "Choisis ce qui explique ton retour."
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
