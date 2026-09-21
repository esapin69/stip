(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-admin-access-requests",
    STORE = "stip_session_v1";
  let data = null,
    busy = false;
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot",
          "'": "&#39;",
        })[c],
    );
  function isAdmin() {
    return !!(window.STIPBootCache?.permissions || {}).admin;
  }
  async function api(action, body = {}) {
    const token = localStorage.getItem(STORE) || "",
      r = await fetch(API, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-STIP-Session": token,
        },
        body: JSON.stringify({ action, ...body }),
      }),
      j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Error(j.error || "Erreur");
    return j;
  }
  function renderCard() {
    if (!isAdmin()) {
      window.STIPActionCenter?.remove("admin-access");
      document.getElementById("adminAccessRequestsCard")?.remove();
      return;
    }
    document.getElementById("adminAccessRequestsCard")?.remove();
    const items = [
      ...(data?.security_items || []).map((r, i) => ({
        id: `access-security-${r.profile_id || i}`,
        source: "admin-access",
        category: "access",
        title:
          `Accès à vérifier · ${r.agent?.prenom || ""} ${r.agent?.nom || ""}`.trim(),
        body: r.evidence?.note || "La preuve planning doit être contrôlée.",
        security_index: i,
      })),
      ...(data?.items || []).map((r) => ({
        id: `access-request-${r.id}`,
        source: "admin-access",
        category: "access",
        title:
          `${r.unresolved ? "Accès non relié" : "Demande d’accès"} · ${r.first_name || ""} ${r.last_name || ""}`.trim(),
        body: r.evidence?.note || r.comment || "Décision requise.",
        request_id: r.id,
      })),
    ];
    window.STIPActionCenter?.publish("admin-access", items);
  }
  async function refresh() {
    if (!isAdmin() || busy) return;
    busy = true;
    try {
      data = await api("list");
      renderCard();
    } catch (e) {
      window.STIPActionCenter?.publish("admin-access", [
        {
          id: "access-load-error",
          source: "admin-access",
          category: "access",
          title: "Contrôle des accès indisponible",
          body: e.message,
        },
      ]);
    } finally {
      busy = false;
    }
  }
  function ensureDialog() {
    let d = document.getElementById("aarDialog");
    if (d) return d;
    d = document.createElement("dialog");
    d.id = "aarDialog";
    d.className = "aar-dialog";
    d.innerHTML =
      '<div class="aar-shell"><header><div><span>ADMINISTRATION STIP</span><h2>Accès & preuves</h2></div><button type="button" data-aar-close aria-label="Fermer">×</button></header><div id="aarBody"></div></div>';
    document.body.appendChild(d);
    d.querySelector("[data-aar-close]").onclick = () => d.close();
    d.addEventListener("click", (e) => {
      if (e.target === d) d.close();
    });
    return d;
  }
  function fmtDate(v) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(v));
    } catch {
      return "";
    }
  }
  function listMarkup() {
    const req = data?.items || [],
      sec = data?.security_items || [],
      manage =
        '<div class="aar-list-tools"><button type="button" class="aar-manage-access" data-aar-manage>Gérer les accès</button></div>';
    if (!req.length && !sec.length)
      return manage + '<div class="aar-empty"><strong>Rien à traiter</strong><p>Tous les accès contrôlables sont actuellement reliés à une source.</p></div>';
    return manage + `<div class="aar-list">${sec.map((r, i) => `<button type="button" class="aar-alert" data-aar-security="${i}"><span><strong>${esc(r.agent?.prenom || "")} ${esc(r.agent?.nom || "")}</strong><small>Sécurité · absent du planning actuel · accès suspendu/revue</small></span><b>›</b></button>`).join("")}${req.map((r) => `<button type="button" data-aar-request="${esc(r.id)}"><span><strong>${esc(r.first_name)} ${esc(r.last_name)}</strong><small>${r.unresolved ? "Accès accordé mais non relié" : "Demande en attente"} · ${esc(fmtDate(r.created_at))}</small></span><b>›</b></button>`).join("")}</div>`;
  }
  async function openList() {
    const d = ensureDialog(),
      body = d.querySelector("#aarBody");
    d.showModal();
    body.innerHTML = '<div class="aar-loading">Chargement…</div>';
    try {
      data = await api("list");
      renderCard();
      body.innerHTML = listMarkup();
      body
        .querySelectorAll("[data-aar-manage]")
        .forEach((b) => (b.onclick = () => location.assign("access-manage.html")));
      body
        .querySelectorAll("[data-aar-request]")
        .forEach((b) => (b.onclick = () => openRequest(b.dataset.aarRequest)));
      body
        .querySelectorAll("[data-aar-security]")
        .forEach(
          (b) =>
            (b.onclick = () => openSecurity(Number(b.dataset.aarSecurity))),
        );
    } catch (e) {
      body.innerHTML = `<div class="aar-error">${esc(e.message)}</div>`;
    }
  }
  function evidenceMarkup(ev = {}) {
    const source = ev.source_url
      ? `<a class="aar-source-link" href="${esc(ev.source_url)}" target="_blank" rel="noopener">Ouvrir le fichier source ↗</a>`
      : "";
    const fresh = (ev.fresh_sources || [])
      .map(
        (s) =>
          `<li>${esc(s.scope)} · ${esc(s.file_name)} · jusqu’au ${esc(s.max_date)}</li>`,
      )
      .join("");
    return `<div class="aar-evidence ${ev.planning_match ? "is-ok" : ev.checkable === false ? "is-soft" : "is-warn"}"><span>PREUVE / SOURCE</span><strong>${esc(ev.label || "À contrôler")}</strong><p>${esc(ev.note || "")}</p>${ev.source_file ? `<dl><div><dt>Fichier</dt><dd>${esc(ev.source_file)}</dd></div>${ev.source_sheet ? `<div><dt>Onglet</dt><dd>${esc(ev.source_sheet)}</dd></div>` : ""}${ev.last_date ? `<div><dt>Présence jusqu’au</dt><dd>${esc(ev.last_date)}</dd></div>` : ""}</dl>` : ""}${fresh ? `<ul>${fresh}</ul>` : ""}${source}</div>`;
  }
  function openRequest(id) {
    const r = (data?.items || []).find((x) => String(x.id) === String(id));
    if (!r) return;
    const body = document.getElementById("aarBody"),
      code = String(r.requested_code || ""),
      recommended = r.recommended_role || "visiteur",
      matched = r.matched_agent,
      approved = r.status === "approved";
    body.innerHTML = `<button type="button" class="aar-back" id="aarBack">‹ Tous les contrôles</button><section class="aar-request"><span class="aar-kicker">${approved ? "ACCÈS NON RÉSOLU" : "DEMANDE D’ACCÈS"}</span><h3>${esc(r.first_name)} ${esc(r.last_name)}</h3>${r.comment ? `<dl><div><dt>Commentaire libre</dt><dd>${esc(r.comment)}</dd></div></dl>` : ""}${evidenceMarkup(r.evidence)}${matched ? `<div class="aar-match"><span>CORRESPONDANCE</span><strong>${esc(matched.prenom || "")} ${esc(matched.nom || "")}</strong><small>${esc(matched.equipe || matched.type_planning || "Agent STIP")}</small></div>` : '<div class="aar-match is-missing"><span>CORRESPONDANCE</span><strong>Aucune personne exacte retrouvée</strong><small>Ne pas inventer de rattachement.</small></div>'}${!approved ? `<label>Code choisi<div class="aar-request-code"><span id="aarRequestedCode">••••••</span><button type="button" id="aarToggleRequestedCode">Voir</button></div></label><label>Accès proposé<select id="aarRole">${(data?.roles || []).map((x) => `<option value="${esc(x.key)}" ${x.key === recommended ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select></label><label>Message pour la personne<textarea id="aarDecisionNote" rows="3" placeholder="Message facultatif"></textarea></label><div class="aar-actions"><button type="button" class="aar-reject" id="aarReject">Refuser</button><button type="button" class="aar-grant" id="aarGrant">Valider l’accès</button></div>` : `<p class="aar-hint">Cet accès reste volontairement visible tant qu’il n’est pas relié à une personne suivie par une source probante ou supprimé.</p><div class="aar-actions aar-actions-danger">${matched && r.evidence?.planning_match ? '<button type="button" class="aar-link" id="aarLink">Relier à cette personne</button>' : ""}<button type="button" class="aar-delete" id="aarDelete">Supprimer tout l’accès STIP</button></div>`}<p id="aarMessage" class="aar-message"></p></section>`;
    document.getElementById("aarBack").onclick = openList;
    if (!approved) {
      let visible = false;
      document.getElementById("aarToggleRequestedCode").onclick = () => {
        visible = !visible;
        document.getElementById("aarRequestedCode").textContent = visible
          ? code
          : "••••••";
        document.getElementById("aarToggleRequestedCode").textContent = visible
          ? "Cacher"
          : "Voir";
      };
      document.getElementById("aarReject").onclick = () => rejectRequest(r.id);
      document.getElementById("aarGrant").onclick = () => grantRequest(r.id);
    } else {
      if (document.getElementById("aarLink"))
        document.getElementById("aarLink").onclick = () =>
          linkRequest(r.id, matched.id);
      document.getElementById("aarDelete").onclick = () => deleteTrace(r.id);
    }
  }
  function openSecurity(i) {
    const r = (data?.security_items || [])[i];
    if (!r) return;
    const body = document.getElementById("aarBody");
    body.innerHTML = `<button type="button" class="aar-back" id="aarBack">‹ Tous les contrôles</button><section class="aar-request"><span class="aar-kicker">SÉCURITÉ D’ACCÈS</span><h3>${esc(r.agent?.prenom || "")} ${esc(r.agent?.nom || "")}</h3>${evidenceMarkup(r.evidence)}<p class="aar-hint">Règle douce mais ferme : si une source planning actuelle existe et que la personne n’y figure plus, son accès opérationnel ne doit pas rester utilisable. La source n’est jamais supprimée.</p><div class="aar-actions"><button type="button" class="aar-delete" id="aarRevoke">Confirmer la révocation</button><button type="button" id="aarBack2">Retour</button></div><p id="aarMessage" class="aar-message"></p></section>`;
    document.getElementById("aarBack").onclick = openList;
    document.getElementById("aarBack2").onclick = openList;
    document.getElementById("aarRevoke").onclick = () =>
      revokeProfile(r.profile_id);
  }
  async function rejectRequest(id) {
    const note =
      document.getElementById("aarDecisionNote")?.value.trim() ||
      "Votre demande n’a pas été acceptée.";
    if (!confirm("Refuser cette demande d’accès ?")) return;
    const m = document.getElementById("aarMessage");
    m.textContent = "Traitement…";
    try {
      await api("reject", { request_id: id, decision_note: note });
      await refresh();
      openList();
    } catch (e) {
      m.textContent = e.message;
    }
  }
  async function grantRequest(id) {
    const role = document.getElementById("aarRole")?.value || "visiteur",
      note =
        document.getElementById("aarDecisionNote")?.value.trim() ||
        "Votre accès STIP est prêt.",
      m = document.getElementById("aarMessage"),
      btn = document.getElementById("aarGrant"),
      reject = document.getElementById("aarReject"),
      actions = btn?.closest(".aar-actions");
    if (!btn || !m) return;
    btn.disabled = true;
    if (reject) reject.disabled = true;
    btn.textContent = "Validation…";
    m.className = "aar-message is-working";
    m.textContent = "Création de l’accès…";
    try {
      const r = await api("grant", {
        request_id: id,
        role_key: role,
        decision_note: note,
      });
      m.className = "aar-message is-success";
      m.textContent = r.unresolved
        ? "Accès validé ✓ · créé, mais encore à rattacher."
        : "Accès validé ✓ · créé et relié.";
      if (actions) {
        actions.innerHTML =
          '<button type="button" class="aar-reject" id="aarDoneBack">Tous les contrôles</button><button type="button" class="aar-manage-access" id="aarDoneManage">Gérer les accès</button>';
        document.getElementById("aarDoneBack").onclick = openList;
        document.getElementById("aarDoneManage").onclick = () =>
          location.assign("access-manage.html");
      }
      refresh();
    } catch (e) {
      m.className = "aar-message";
      m.textContent = e.message;
      btn.disabled = false;
      btn.textContent = "Valider l’accès";
      if (reject) reject.disabled = false;
    }
  }
  async function linkRequest(id, agentId) {
    if (!confirm("Relier cet accès à cette personne suivie ?")) return;
    const m = document.getElementById("aarMessage");
    m.textContent = "Rattachement…";
    try {
      await api("link", { request_id: id, agent_id: agentId });
      await refresh();
      openList();
    } catch (e) {
      m.textContent = e.message;
    }
  }
  async function deleteTrace(id) {
    if (
      !confirm(
        "Supprimer cet accès STIP, ses sessions, son code et son identité isolée ? Les données source planning restent intactes.",
      )
    )
      return;
    const m = document.getElementById("aarMessage");
    m.textContent = "Suppression…";
    try {
      await api("delete_trace", { request_id: id });
      await refresh();
      openList();
    } catch (e) {
      m.textContent = e.message;
    }
  }
  async function revokeProfile(profileId) {
    if (!confirm("Confirmer la révocation de cet accès ?")) return;
    const m = document.getElementById("aarMessage");
    m.textContent = "Révocation…";
    try {
      await api("revoke_profile", { profile_id: profileId });
      await refresh();
      openList();
    } catch (e) {
      m.textContent = e.message;
    }
  }
  function boot() {
    if (!isAdmin()) {
      renderCard();
      return;
    }
    setTimeout(refresh, 100);
  }
  window.addEventListener("stip:boot-updated", boot);
  window.addEventListener("stip:session-ready", boot);
  window.addEventListener("stip:action-center-open", async (e) => {
    const detail = e.detail || {};
    if (detail.source !== "admin-access" || !isAdmin()) return;
    try {
      if (!data) data = await api("list");
      renderCard();
      const d = ensureDialog();
      if (!d.open) d.showModal();
      if (detail.request_id) return openRequest(detail.request_id);
      if (Number.isInteger(detail.security_index))
        return openSecurity(detail.security_index);
      return openList();
    } catch {
      openList();
    }
  });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
