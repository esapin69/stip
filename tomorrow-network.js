(() => {
  "use strict";
  const API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-tomorrow";
  const STORE = "stip_session_v1";
  const cache = new Map();
  let loadingDay = "";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  async function call(action, body = {}) {
    const r = await fetch(API, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", "x-stip-session": localStorage.getItem(STORE) || "" },
      body: JSON.stringify({ action, ...body }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Error(typeof j.error === "string" ? j.error : "Service Pour demain indisponible.");
    return j;
  }
  function name(a = {}) {
    return [a.prenom, a.nom].filter(Boolean).join(" ").trim() || "Agent";
  }
  function avatar(a = {}) {
    const src = a.profile_photo_url || a.avatar_url || "";
    const initials = [a.prenom?.[0], a.nom?.[0]].filter(Boolean).join("").toUpperCase() || "ST";
    return src ? '<span class="tdn-avatar"><img src="'+esc(src)+'" alt=""></span>' : '<span class="tdn-avatar">'+esc(initials)+'</span>';
  }
  function noteCard(n, received = false) {
    const person = received ? n.author : n.owner;
    const meta = [n.time, person ? name(person) : "", person?.ghe ? "GHE "+person.ghe : ""].filter(Boolean).join(" · ");
    return '<article class="tdn-note '+(n.status === "done" ? "done" : "")+'" data-remote-note="'+esc(n.id)+'">'+
      (person ? avatar(person) : "")+
      '<div><small>'+(received ? "DE "+esc(name(person)) : "POUR "+esc(name(person)))+'</small><strong>'+esc(n.title)+'</strong>'+
      (n.body ? '<p>'+esc(n.body)+'</p>' : "")+'<em>'+esc(meta)+'</em></div>'+
      (received ? '<button type="button" data-note-status="'+esc(n.id)+'">'+(n.status === "done" ? "↺" : "✓")+'</button>' : "")+
      '</article>';
  }
  function organizationHtml(org) {
    if (!org) return "";
    const order = ["M","J","J4","S","N"];
    const shifts = order.map((k) => {
      const x = org.shifts?.[k] || { count: 0, agents: [] };
      const names = (x.agents || []).slice(0, 4).map(name).join(" · ");
      return '<button type="button" class="tdn-shift" data-org-shift="'+k+'"><b>'+k+'</b><strong>'+x.count+'</strong><small>'+esc(names || "Personne")+'</small></button>';
    }).join("");
    const alerts = (org.advice || []).filter((x) => x.status === "below_reference" || Number(x.severity || 0) >= 2).slice(0, 3);
    return '<details class="td-section tdn-org" open><summary>Organisation · MAXI</summary><div class="td-content">'+
      '<div class="tdn-org-head"><span><b>'+Number(org.total_working || 0)+'</b><small>agents prévus</small></span><button type="button" data-assign-note>+ Note pour un agent</button></div>'+
      '<div class="tdn-shifts">'+shifts+'</div>'+
      (alerts.length ? '<div class="tdn-alerts">'+alerts.map((x) => '<article><b>'+esc(x.shift_code || x.metric || "Info")+'</b><div><strong>'+esc(String(x.planned_count ?? "—"))+' / '+esc(String(x.target_count ?? "—"))+'</strong><p>'+esc(x.text || "Sous la référence prévue.")+'</p></div></article>').join("")+'</div>' : '<p class="td-empty">Aucun écart organisationnel signalé pour cette journée.</p>')+
      '</div></details>';
  }
  function render(data, day) {
    const page = document.getElementById("tdPage");
    if (!page || page.hidden || page.dataset.remoteDay !== day) return;
    page.querySelectorAll("[data-tdn-injected]").forEach((x) => x.remove());
    const hero = page.querySelector(".td-hero");
    if (!hero) return;
    const box = document.createElement("div");
    box.dataset.tdnInjected = "1";
    box.className = "tdn-block";
    const received = (data.notes || []).filter((n) => n.kind === "assigned");
    const sent = data.sent_notes || [];
    box.innerHTML =
      '<div class="tdn-level '+(data.level === "MAXI" ? "maxi" : "mini")+'">'+esc(data.level)+'</div>'+
      (received.length ? '<details class="td-section tdn-received" open><summary>Notes reçues</summary><div class="td-content">'+received.map((n) => noteCard(n, true)).join("")+'</div></details>' : "")+
      organizationHtml(data.organization)+
      (data.level === "MAXI" && sent.length ? '<details class="td-section tdn-sent"><summary>Notes envoyées · '+sent.length+'</summary><div class="td-content">'+sent.map((n) => noteCard(n, false)).join("")+'</div></details>' : "");
    hero.insertAdjacentElement("afterend", box);
    box.querySelectorAll("[data-note-status]").forEach((b) => b.addEventListener("click", async () => {
      const note = received.find((n) => String(n.id) === String(b.dataset.noteStatus));
      if (!note) return;
      b.disabled = true;
      try {
        await call("note_status", { id: note.id, status: note.status === "done" ? "active" : "done" });
        await load(day, true);
      } catch (e) {
        b.disabled = false;
      }
    }));
    box.querySelector("[data-assign-note]")?.addEventListener("click", () => assignSheet(day));
    box.querySelectorAll("[data-org-shift]").forEach((b) => b.addEventListener("click", () => shiftSheet(data.organization, b.dataset.orgShift)));
  }
  function shiftSheet(org, shift) {
    const rows = org?.shifts?.[shift]?.agents || [];
    const wrap = document.createElement("div");
    wrap.className = "td-sheet-wrap";
    wrap.innerHTML = '<section class="td-sheet tdn-sheet"><h3>'+esc(shift)+' · '+rows.length+' agent'+(rows.length > 1 ? "s" : "")+'</h3><div class="tdn-agent-list">'+rows.map((a) => '<div>'+avatar(a)+'<span><strong>'+esc(name(a))+'</strong><small>'+(a.ghe ? "GHE "+esc(a.ghe) : "")+'</small></span></div>').join("")+'</div><button class="secondary" type="button" data-close>Fermer</button></section>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector("[data-close]")?.addEventListener("click", close);
  }
  async function assignSheet(day) {
    const wrap = document.createElement("div");
    wrap.className = "td-sheet-wrap";
    wrap.innerHTML = '<section class="td-sheet tdn-sheet"><h3>Note pour un agent</h3><p class="td-empty" data-load>Chargement des agents…</p></section>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    try {
      const r = await call("agents");
      const agents = r.items || [];
      wrap.querySelector(".td-sheet").innerHTML = '<h3>Note pour un agent</h3><form class="td-form">'+
        '<label>Destinataire<select name="agent" required><option value="">Choisir…</option>'+agents.map((a) => '<option value="'+esc(a.id)+'">'+esc(name(a))+(a.ghe ? " · GHE "+esc(a.ghe) : "")+'</option>').join("")+'</select></label>'+
        '<label>Titre<input name="title" maxlength="160" required placeholder="Ex. Passe au bureau avant ta prise de poste"></label>'+
        '<label>Heure facultative<input name="time" type="time"></label>'+
        '<label>Détail facultatif<textarea name="body" maxlength="1000"></textarea></label>'+
        '<div class="td-actions"><button type="button" data-cancel>Annuler</button><button class="primary" type="submit">Envoyer pour cette journée</button></div></form><p class="tdn-form-msg" role="status"></p>';
      wrap.querySelector("[data-cancel]")?.addEventListener("click", close);
      wrap.querySelector("form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.currentTarget, fd = new FormData(form), submit = form.querySelector('[type="submit"]'), msg = wrap.querySelector(".tdn-form-msg");
        submit.disabled = true;
        msg.textContent = "Envoi…";
        try {
          await call("note_create", { date: day, target_agent_id: fd.get("agent"), title: fd.get("title"), time: fd.get("time"), body: fd.get("body") });
          close();
          await load(day, true);
        } catch (err) {
          msg.textContent = err.message || "Envoi impossible.";
          submit.disabled = false;
        }
      });
    } catch (e) {
      wrap.querySelector(".td-sheet").innerHTML = '<h3>Note pour un agent</h3><p class="td-empty">'+esc(e.message || "Chargement impossible.")+'</p><button class="secondary" type="button" data-close>Fermer</button>';
      wrap.querySelector("[data-close]")?.addEventListener("click", close);
    }
  }
  async function load(day, force = false) {
    if (!day) return;
    if (!force && cache.has(day)) {
      render(cache.get(day), day);
      return cache.get(day);
    }
    if (loadingDay === day) return;
    loadingDay = day;
    try {
      const data = await call("day", { date: day });
      cache.set(day, data);
      render(data, day);
      window.dispatchEvent(new CustomEvent("stip:tomorrow-remote", { detail: data }));
      return data;
    } catch (e) {
      const page = document.getElementById("tdPage");
      if (page && !page.hidden && page.dataset.remoteDay === day) {
        page.querySelectorAll("[data-tdn-injected]").forEach((x) => x.remove());
        const hero = page.querySelector(".td-hero");
        const box = document.createElement("div");
        box.dataset.tdnInjected = "1";
        box.className = "tdn-block";
        box.innerHTML = '<div class="tdn-error">Les notes partagées ne se chargent pas pour le moment. Tes ajouts personnels restent disponibles.</div>';
        hero?.insertAdjacentElement("afterend", box);
      }
    } finally {
      if (loadingDay === day) loadingDay = "";
    }
  }
  window.addEventListener("stip:tomorrow-page", (e) => {
    const day = String(e.detail?.day || "");
    const page = document.getElementById("tdPage");
    if (page) page.dataset.remoteDay = day;
    load(day);
  });
  window.STIPTomorrowRemote = { load, refresh: (day) => load(day, true), call };
})();