(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-dates",
    ACCESS =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access",
    STORE = "stip_session_v1",
    $ = (s) => document.querySelector(s);
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
  async function post(url, action, body = {}) {
    const r = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-stip-session": localStorage.getItem(STORE) || "",
        },
        body: JSON.stringify({ action, ...body }),
      }),
      j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Error(j.error || "Erreur " + r.status);
    return j;
  }
  function dobj(v) {
    return new Date(String(v).slice(0, 10) + "T12:00:00");
  }
  function longDate(v) {
    return dobj(v).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function shortDate(v) {
    return dobj(v)
      .toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
      .replace(".", "");
  }
  function dateTile(v) {
    const d = dobj(v);
    return (
      '<span class="dd-date"><small>' +
      esc(
        d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
      ) +
      "</small><b>" +
      String(d.getDate()).padStart(2, "0") +
      "</b><em>" +
      esc(d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")) +
      "</em></span>"
    );
  }
  function setHead(title, sub = "") {
    document.title = title + " · Date des agents";
    $("#ddTitle").textContent = title;
    $("#ddSubtitle").textContent = sub;
  }
  function renderIntern(x) {
    setHead("Planning stagiaire", "Toutes les affectations prévues");
    const days = x.days || [],
      next = days.filter(
        (d) => d.date >= new Date().toISOString().slice(0, 10),
      ).length;
    $("#ddContent").innerHTML =
      '<section class="dd-hero"><div class="dd-hero-row"><span class="dd-hero-icon">👶</span><div><h2>' +
      esc(x.title) +
      '</h2><p>Planning complet du stagiaire, avec horaires et référents.</p></div></div><div class="dd-stats"><span><b>' +
      days.length +
      "</b><small>journées</small></span><span><b>" +
      next +
      "</b><small>à venir</small></span><span><b>" +
      new Set(days.map((d) => d.referent).filter(Boolean)).size +
      '</b><small>référents</small></span></div></section><section class="dd-section"><h3>Affectations prévues</h3><div class="dd-list">' +
      days
        .map(
          (d) =>
            '<article class="dd-row ' +
            (d.id === x.selected_id ? "selected" : "") +
            '">' +
            dateTile(d.date) +
            '<div class="dd-copy"><strong>' +
            esc(d.time || "Horaire à confirmer") +
            "</strong><p>" +
            (d.referent
              ? "Référent : " + esc(d.referent)
              : "Référent non indiqué") +
            "</p>" +
            (d.observation ? "<small>" + esc(d.observation) + "</small>" : "") +
            (d.id === x.selected_id
              ? '<span class="dd-pill">Jour sélectionné</span>'
              : "") +
            "</div></article>",
        )
        .join("") +
      "</div></section>";
  }
  function renderTraining(x) {
    setHead("Participants formation", "Les agents inscrits à la même session");
    const ps = x.participants || [];
    $("#ddContent").innerHTML =
      '<section class="dd-hero"><div class="dd-hero-row"><span class="dd-hero-icon">🎓</span><div><h2>' +
      esc(x.title) +
      "</h2><p>" +
      esc(longDate(x.date)) +
      (x.end_date && x.end_date !== x.date
        ? " → " + esc(shortDate(x.end_date))
        : "") +
      (x.time ? " · " + esc(x.time) : "") +
      '</p></div></div><div class="dd-stats"><span><b>' +
      ps.length +
      "</b><small>inscrits</small></span><span><b>" +
      esc(shortDate(x.date)) +
      "</b><small>début</small></span><span><b>" +
      esc(x.status || "—") +
      "</b><small>statut</small></span></div></section>" +
      (x.location
        ? '<section class="dd-section"><h3>Lieu</h3><div class="dd-card">' +
          esc(x.location) +
          "</div></section>"
        : "") +
      '<section class="dd-section"><h3>Inscrits à cette session</h3><div class="dd-list">' +
      ps
        .map(
          (p) =>
            '<article class="dd-time-row ' +
            (p.selected ? "selected" : "") +
            '"><span class="dd-time">#</span><div class="dd-person"><strong>' +
            esc(p.name) +
            "</strong><small>" +
            esc(p.agent_source_key || "") +
            "</small></div>" +
            (p.selected ? '<span class="dd-you">sélectionné</span>' : "") +
            "</article>",
        )
        .join("") +
      "</div></section>";
  }
  function renderMedical(x) {
    setHead("Visites médicales", "Tous les rendez-vous de cette journée");
    const ps = x.appointments || [];
    $("#ddContent").innerHTML =
      '<section class="dd-hero"><div class="dd-hero-row"><span class="dd-hero-icon">🩺</span><div><h2>' +
      esc(longDate(x.date)) +
      '</h2><p>Vue de la journée complète, classée par heure.</p></div></div><div class="dd-stats"><span><b>' +
      ps.length +
      "</b><small>rendez-vous</small></span><span><b>" +
      esc(ps[0]?.time || "—") +
      "</b><small>premier</small></span><span><b>" +
      esc(ps.at(-1)?.time || "—") +
      '</b><small>dernier</small></span></div></section><section class="dd-section"><h3>Rendez-vous du jour</h3><div class="dd-list">' +
      ps
        .map(
          (p) =>
            '<article class="dd-time-row ' +
            (p.selected ? "selected" : "") +
            '"><span class="dd-time">' +
            esc(p.time || "—") +
            '</span><div class="dd-person"><strong>' +
            esc(p.name) +
            "</strong><small>" +
            esc(p.title || "Visite médicale") +
            (p.location ? " · " + esc(p.location) : "") +
            "</small></div>" +
            (p.selected ? '<span class="dd-you">sélectionné</span>' : "") +
            "</article>",
        )
        .join("") +
      "</div></section>";
  }
  function renderAgenda(x) {
    setHead("Événement", "Détail de l’événement STIP");
    $("#ddContent").innerHTML =
      '<section class="dd-hero"><div class="dd-hero-row"><span class="dd-hero-icon">' +
      esc(x.icon || "📌") +
      '</span><div><h2>' +
      esc(x.title || "Événement") +
      "</h2><p>" +
      esc(longDate(x.date)) +
      (x.time ? " · " + esc(x.time) : "") +
      '</p></div></div></section><section class="dd-section"><h3>Informations</h3><div class="dd-card"><strong>' +
      esc(x.person_name || "Agent") +
      "</strong>" +
      (x.location ? "<p>" + esc(x.location) + "</p>" : "") +
      (x.detail ? "<small>" + esc(x.detail) + "</small>" : "") +
      "</div></section>";
  }

  async function init() {
    if (!localStorage.getItem(STORE)) {
      location.replace("index.html");
      return;
    }
    try {
      const me = await post(ACCESS, "me");
      if (!me.permissions?.agent_dates) {
        location.replace("index.html");
        return;
      }
    } catch {
      location.replace("index.html");
      return;
    }
    const p = new URLSearchParams(location.search),
      type = p.get("type") || "",
      source = p.get("source") || "";
    if (!source) {
      $("#ddContent").innerHTML =
        '<div class="dd-empty">Élément introuvable.</div>';
      return;
    }
    try {
      const action =
        type === "intern"
          ? "intern_detail"
          : type === "training"
            ? "training_detail"
            : type === "medical"
              ? "medical_detail"
              : type === "agenda"
                ? "agenda_detail"
                : "";
      if (!action) throw Error("Type non pris en charge.");
      const r = await post(API, action, { source_id: source });
      if (type === "intern") renderIntern(r);
      else if (type === "training") renderTraining(r);
      else if (type === "medical") renderMedical(r);
      else renderAgenda(r);
    } catch (e) {
      $("#ddContent").innerHTML =
        '<div class="dd-empty">' + esc(e.message) + "</div>";
    }
  }
  init();
})();
