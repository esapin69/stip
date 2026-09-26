(() => {
  "use strict";
  const API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-tomorrow";
  const STORE = "stip_session_v1";
  const cache = new Map();
  let loadingDay = "";
  const core = () => window.STIPTomorrow;
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
    const initials = [a.prenom?.[0], a.nom?.[0]].filter(Boolean).join("").toUpperCase() || "ST";
    const signed = window.STIPBootCache?.media?.avatars?.[a.source_key] || "";
    const src = a.profile_photo_url || signed || a.avatar_signed_url || a.avatar_url || "";
    return src ? '<span class="tdn-avatar" data-avatar-fallback="'+esc(initials)+'"><img src="'+esc(src)+'" alt="" loading="lazy"></span>' : '<span class="tdn-avatar">'+esc(initials)+'</span>';
  }
  document.addEventListener("error", (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const host = img.closest?.(".tdn-avatar");
    if (!host) return;
    host.textContent = host.dataset.avatarFallback || "ST";
  }, true);
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
    const intel = window.STIPFieldIntel,
      alerts = (org.advice || [])
        .filter((x) =>
          x.status === "below_reference" ||
          x.status === "opportunity" ||
          Number(x.severity || 0) >= 2 ||
          x.suggested_to_shift ||
          x.destination_shift
        )
        .slice(0, 3),
      terrain = alerts.map((x) => {
        const planned = x.planned_count == null ? null : Number(x.planned_count),
          target = x.target_count == null ? null : Number(x.target_count),
          gap =
            planned != null &&
            target != null &&
            Number.isFinite(planned) &&
            Number.isFinite(target)
              ? planned - target
              : null;
        return intel?.terrainItem?.({
          severity: Number(x.severity || 2),
          source_family: "staffing",
          context: {
            shift_code: x.shift_code || x.metric || "",
            planned_count: x.planned_count,
            target_count: x.target_count,
            gap,
            suggested_to_shift: x.suggested_to_shift || x.destination_shift || "",
          },
          title: x.text || "Point effectif",
          body: x.text || "",
        }) || {
          headline: x.text || "Point effectif",
          detail: "",
          level: Number(x.severity || 0) >= 4 ? "critical" : "warning",
        };
      });
    return '<details class="td-section tdn-org" open><summary>Organisation · MAXI</summary><div class="td-content">'+
      '<div class="tdn-org-head"><span><b>'+Number(org.total_working || 0)+'</b><small>agents prévus</small></span><button type="button" data-assign-note>+ Note pour un agent</button></div>'+
      '<div class="tdn-shifts">'+shifts+'</div>'+
      (terrain.length ? '<div class="tdn-alerts">'+terrain.map((x) => '<article class="status-'+esc(x.level)+'"><b>'+(intel?.statusMeta?.(x.level)?.symbol || (x.level === "critical" ? "🛑" : x.level === "opportunity" ? "➕" : "⚠️"))+'</b><div><strong>'+esc(x.headline)+'</strong>'+(x.detail ? '<p>'+esc(x.detail)+'</p>' : '')+(x.proposal ? '<small>'+esc(x.proposal)+'</small>' : '')+'</div></article>').join("")+'</div>' : '<p class="td-empty">✔ Rien ne coince côté organisation.</p>')+
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
  function taskFromNote(n) {
    return {
      id: "remote:" + n.id,
      remoteId: n.id,
      clientId: n.client_id || "",
      title: n.title || "",
      time: n.time || "",
      note: n.body || "",
      done: n.status === "done",
      order: Number(n.sort_order || 0),
      createdAt: n.created_at || "",
      remote: true,
    };
  }
  function publishPersonal(day, data) {
    const personal = (data?.notes || []).filter((n) => n.kind === "personal").map(taskFromNote);
    core()?.setRemoteTasks?.(day, personal);
  }
  async function migrateLocal(day, data) {
    const c = core();
    if (!c?.localTasks || !c?.clearLocal) return false;
    const local = c.localTasks(day);
    if (!local.length) return false;
    for (const item of local) {
      const clientId = String(item.clientId || item.id || "").trim() || ("legacy-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
      await call("note_create", {
        date: day,
        client_id: clientId,
        title: item.title,
        time: item.time,
        body: item.note,
        done: !!item.done,
        sort_order: Number(item.order || 0),
      });
    }
    c.clearLocal(day);
    return true;
  }
  async function taskUpsert(day, item = {}) {
    const clientId = String(item.clientId || item.id || ("web-" + (crypto.randomUUID?.() || (Date.now() + "-" + Math.random().toString(36).slice(2, 8)))));
    if (item.remoteId) {
      await call("note_update", {
        id: item.remoteId,
        date: day,
        title: item.title,
        time: item.time,
        body: item.note,
        sort_order: Number(item.order || 0),
      });
    } else {
      await call("note_create", {
        date: day,
        client_id: clientId,
        title: item.title,
        time: item.time,
        body: item.note,
        done: !!item.done,
        sort_order: Number(item.order || 0),
      });
    }
    cache.delete(day);
    return load(day, true);
  }
  async function taskStatus(day, item, done) {
    if (!item?.remoteId) throw Error("Note locale non synchronisée.");
    await call("note_status", { id: item.remoteId, status: done ? "done" : "active" });
    cache.delete(day);
    return load(day, true);
  }
  async function taskDelete(day, item) {
    if (!item?.remoteId) throw Error("Note locale non synchronisée.");
    await call("note_delete", { id: item.remoteId });
    cache.delete(day);
    return load(day, true);
  }
  async function taskMoveNext(day, item) {
    if (!item?.remoteId) throw Error("Note locale non synchronisée.");
    const next = core()?.add?.(day, 1);
    await call("note_update", { id: item.remoteId, date: next });
    cache.delete(day);
    if (next) cache.delete(next);
    await load(day, true);
    if (next) await load(next, true);
  }
  async function taskReorder(day, ids = []) {
    const rows = core()?.tasks?.(day) || [];
    const byId = new Map(rows.map((x) => [String(x.id), x]));
    const remoteIds = ids.map((id) => byId.get(String(id))?.remoteId).filter(Boolean);
    if (!remoteIds.length) return;
    if (remoteIds.length !== ids.length) throw Error("Synchronisation incomplète.");
    await call("note_reorder", { date: day, ids: remoteIds });
    cache.delete(day);
    return load(day, true);
  }

  async function load(day, force = false) {
    if (!day) return;
    if (!force && cache.has(day)) {
      const cached = cache.get(day);
      publishPersonal(day, cached);
      render(cached, day);
      return cached;
    }
    if (loadingDay === day) return;
    loadingDay = day;
    try {
      let data = await call("day", { date: day });
      const migrated = await migrateLocal(day, data);
      if (migrated) data = await call("day", { date: day });
      cache.set(day, data);
      publishPersonal(day, data);
      render(data, day);
      window.dispatchEvent(new CustomEvent("stip:tomorrow-remote", { detail: data }));
      setTimeout(() => window.STIPTomorrowUI?.refresh?.(), 0);
      return data;
    } catch (e) {
      const page = document.getElementById("tdPage");
      if (page && !page.hidden && page.dataset.remoteDay === day) {
        page.querySelectorAll("[data-tdn-injected]").forEach((x) => x.remove());
        const hero = page.querySelector(".td-hero");
        const box = document.createElement("div");
        box.dataset.tdnInjected = "1";
        box.className = "tdn-block";
        box.innerHTML = '<div class="tdn-error">Synchronisation indisponible. Tes ajouts locaux restent utilisables et seront repris plus tard.</div>';
        hero?.insertAdjacentElement("afterend", box);
      }
      throw e;
    } finally {
      if (loadingDay === day) loadingDay = "";
    }
  }
  window.addEventListener("stip:tomorrow-page", (e) => {
    const day = String(e.detail?.day || "");
    const page = document.getElementById("tdPage");
    if (page) page.dataset.remoteDay = day;
    load(day).catch(() => {});
  });
  window.STIPTomorrowRemote = { load, refresh: (day) => load(day, true), call, taskUpsert, taskStatus, taskDelete, taskMoveNext, taskReorder };
})();