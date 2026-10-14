(() => {
  "use strict";
  const host = document.getElementById("respEventFeedbackLog");
  if (!host) return;
  const api = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions";
  const records = host.querySelector("[data-feedback-records]");
  const status = host.querySelector("[data-feedback-status]");
  const summaryCount = host.querySelector("[data-feedback-total]");
  const followCount = host.querySelector("[data-feedback-follow]");
  let items = [], loadedAt = 0, busy = false, filter = "all";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateText = (value, time = false) => {
    if (!value) return "—";
    const d = new Date(time ? value : String(value).slice(0,10) + "T12:00:00");
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric",
      ...(time ? {hour:"2-digit",minute:"2-digit"} : {})
    }).format(d);
  };
  const name = x => [x?.agent?.prenom, x?.agent?.nom].filter(Boolean).join(" ") || "Agent";
  const outcome = x => ({"ok":"Réalisé","problem":"Différent du prévu","absent":"Non réalisé"}[x?.attendance] || "Non précisé");
  const reasonLabels = {
    delay:"Retard important",location:"Lieu différent / incorrect",
    convocation:"Convocation manquante",organization:"Organisation",
    other:"Autre",schedule:"Horaires différents / incorrects",
    facilitator:"Formateur / intervenant",information:"Information manquante",
    cancelled:"Annulation",not_informed:"Information non reçue",
    unavailable:"Participation impossible",supervision:"Encadrement",
    communication:"Communication",trainee_absent:"Stagiaire absent",
    not_found:"Personne non trouvée",participants:"Participants",process:"Déroulement"
  };
  const reason = x => reasonLabels[x?.reason_code] || x?.reason_code || "—";
  const subset = () => filter === "follow" ? items.filter(x => x.follow_up === true) : items;

  function render() {
    summaryCount.textContent = String(items.length);
    followCount.textContent = String(items.filter(x => x.follow_up === true).length);
    host.querySelectorAll("[data-feedback-filter]").forEach(b => {
      const selected = b.dataset.feedbackFilter === filter;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
    const shown = subset();
    records.innerHTML = shown.length ? shown.slice(0, 100).map(x => {
      const snap = x.event_snapshot || {}, medical = snap.feedback_kind === "medical";
      const date = dateText(snap.end_date || snap.date);
      const details = [date, medical ? "Suivi administratif" : (snap.time || ""), reason(x) !== "—" ? reason(x) : ""].filter(Boolean).join(" · ");
      return `<article class="resp-feedback-item${x.follow_up ? " is-follow" : ""}">
        <div class="resp-feedback-row"><strong>${esc(snap.title || "Événement")}</strong>
          <span class="resp-feedback-outcome">${esc(outcome(x))}</span></div>
        <span class="resp-feedback-meta">${esc(name(x))} · ${esc(details)}</span>
        ${x.follow_up ? '<b class="resp-feedback-need">Suivi demandé</b>' : ""}
        ${!medical && x.note ? `<p class="resp-feedback-note">${esc(x.note)}</p>` : ""}
        <small>Déclaré le ${esc(dateText(x.submitted_at,true))} · Réf. ${esc(x.id || x.event_key || "")}</small>
      </article>`;
    }).join("") : '<p class="resp-feedback-empty">Aucun retour correspondant.</p>';
    status.textContent = items.length >= 160
      ? "Affichage limité aux 160 derniers retours enregistrés."
      : "Retours datés et enregistrés par les agents. Les rendez-vous médicaux restent administratifs.";
  }
  async function load(force = false) {
    if (busy || (loadedAt && Date.now() - loadedAt < 60000 && !force)) return;
    busy = true;
    status.textContent = "Chargement des retours…";
    try {
      const r = await fetch(api, {
        method: "POST", cache:"no-store",
        headers: {"content-type":"application/json","x-stip-session":localStorage.getItem("stip_session_v1") || ""},
        body:JSON.stringify({action:"manager_event_feedback"})
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error) throw Error(data.error || "Erreur " + r.status);
      items = Array.isArray(data.items) ? data.items : [];
      loadedAt = Date.now();
      render();
    } catch {
      status.textContent = "Les retours sont momentanément indisponibles.";
    } finally {
      busy = false;
    }
  }
  function csvField(raw) {
    let value = String(raw ?? "");
    if (/^[\s]*[=+@-]/.test(value)) value = "'" + value;
    return '"' + value.replace(/"/g,'""').replace(/\r?\n/g," ") + '"';
  }
  function exportCsv() {
    const headers = ["Référence","Agent","Événement","Date prévue","Type","Résultat","Motif","Suivi demandé","Question événement","Précision","Déclaré le"];
    const rows = subset().map(x => {
      const snap = x.event_snapshot || {};
      return [x.id || x.event_key,name(x),snap.title || "",snap.end_date || snap.date || "",
        snap.feedback_kind || x.event_type || "",outcome(x),reason(x),x.follow_up ? "Oui" : "Non",
        x.custom_answer || "",snap.feedback_kind === "medical" ? "" : (x.note || ""),x.submitted_at || ""];
    });
    const csv = "\ufeff" + [headers, ...rows].map(row => row.map(csvField).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ghe-retours-professionnels-" + new Date().toISOString().slice(0,10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  host.addEventListener("toggle", () => { if (host.open && !host.hidden) load(); });
  host.addEventListener("click", event => {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.dataset.feedbackFilter) { filter = b.dataset.feedbackFilter; render(); }
    if (b.hasAttribute("data-feedback-refresh")) load(true);
    if (b.hasAttribute("data-feedback-export") && loadedAt) exportCsv();
  });
  window.addEventListener("stip:responsable-tab", e => {
    if (e.detail?.tab === "suivi" && host.open && !host.hidden) load(true);
  });
})();
