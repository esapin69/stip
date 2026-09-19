(() => {
  "use strict";
  const API =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access-manage";
  const DATES_API =
    "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-dates-admin";
  const STORE = "stip_session_v1";
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(
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
  let data = null,
    current = null,
    selectedRole = "",
    creating = false;

  async function request(url, action, body = {}) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stip-session": localStorage.getItem(STORE) || "",
      },
      body: JSON.stringify({ action, ...body }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error)
      throw Error(
        typeof j.error === "string" ? j.error : j.error?.message || "Erreur",
      );
    return j;
  }
  const call = (action, body) => request(API, action, body);
  const callDates = (action, body) => request(DATES_API, action, body);
  function message(text) {
    $("msg").textContent = text || "";
  }
  function displayAccessText(value = "") {
    return String(value)
      .replace(/\bVisiteur\b/gi, "MINI")
      .replace(/\bPro\b/g, "MAXI");
  }

  async function load() {
    try {
      data = await call("list", { q: $("q").value });
      renderPeople();
    } catch (e) {
      message(e.message);
    }
  }
  function alphaName(value = {}) {
    const a = value.agents || value;
    return [a.nom, a.prenom].filter(Boolean).join(" ").trim() || "Profil externe";
  }
  function sortPeople(items = []) {
    return [...items].sort((a, b) =>
      alphaName(a).localeCompare(alphaName(b), "fr", { sensitivity: "base" }),
    );
  }
  function renderPeople() {
    const people = sortPeople(data.people || []);
    $("people").innerHTML =
      people
        .map(
          (p, i) =>
            `<button class="access-person" data-person="${i}" type="button"><strong>${esc(p.agents?.prenom || "")} ${esc(p.agents?.nom || "Profil externe")}</strong><small>GHE ${esc(String(p.agents?.ghe || p.role_key || "—").replace(/^GHE\s*/i, ""))}</small></button>`,
        )
        .join("") || '<p class="access-help">Aucun profil trouvé.</p>';
    $("people")
      .querySelectorAll("[data-person]")
      .forEach(
        (b) => (b.onclick = () => edit(people[Number(b.dataset.person)])),
      );
  }
  function presetUI() {
    $("presetRows").innerHTML = (data.presets || [])
      .map(
        (p) =>
          `<button class="access-preset ${p.role_key === selectedRole ? "active" : ""}" data-role="${esc(p.role_key)}" type="button">${esc(p.label)}</button>`,
      )
      .join("");
    $("presetRows")
      .querySelectorAll("[data-role]")
      .forEach((b) => (b.onclick = () => choosePreset(b.dataset.role)));
    $("savePreset").disabled = !selectedRole;
  }
  function choosePreset(role) {
    selectedRole = role;
    const p = (data.presets || []).find((x) => x.role_key === role);
    if (p) renderApps(p.permissions || {});
    presetUI();
  }
  function renderApps(permissions = {}) {
    const levels = permissions.__levels || {};
    $("apps").innerHTML = (data.apps || [])
      .map((app) => {
        const checked = !!permissions[app.key];
        const level = app.pro_only
          ? "pro"
          : String(levels[app.key] || "visitor").toLowerCase() === "pro"
            ? "pro"
            : "visitor";
        let control = '<span class="access-single">MINI</span>';
        let levelHelp = "MINI : accès disponible actuellement pour cette application.";
        if (app.pro_only) {
          control = '<span class="access-single access-maxi-only">MAXI</span>';
          levelHelp = "MAXI : cette application est réservée au niveau le plus complet.";
        } else if (app.levels) {
          control = `<div class="access-levels stip-levels" aria-label="Niveau ${esc(app.label)}"><button type="button" data-level="${esc(app.key)}" data-value="visitor" class="${level === "visitor" ? "active" : ""}">MINI</button><button type="button" data-level="${esc(app.key)}" data-value="pro" class="${level === "pro" ? "active" : ""}">MAXI</button></div>`;
          levelHelp = "MINI donne l’essentiel. MAXI ouvre la version la plus complète prévue pour cette application.";
        }
        const visibleHelp = displayAccessText(app.help || "");
        const help = [visibleHelp.trim(), levelHelp].filter(Boolean).join(" ");
        return `<div class="access-app stip-catalog-row"><label class="access-app-main"><input type="checkbox" data-permission="${esc(app.key)}" ${checked ? "checked" : ""}><span><strong>${esc(app.label)}</strong><small>${esc(visibleHelp)}</small></span></label><div class="access-app-tools"><button class="access-info-btn" type="button" data-app-help="${esc(app.key)}" aria-expanded="false" aria-label="Comprendre ${esc(app.label)}">?</button>${control}</div><div class="access-app-info" data-app-info="${esc(app.key)}" hidden>${esc(help)}</div></div>`;
      })
      .join("");
    $("apps")
      .querySelectorAll("[data-level]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const key = b.dataset.level;
            $("apps")
              .querySelectorAll(`[data-level="${CSS.escape(key)}"]`)
              .forEach((x) => x.classList.toggle("active", x === b));
          }),
      );
    $("apps")
      .querySelectorAll("[data-permission]")
      .forEach((input) => {
        const sync = () => {
          const row = input.closest(".access-app");
          row?.classList.toggle("is-enabled", input.checked);
          row
            ?.querySelectorAll("[data-level]")
            .forEach((button) => (button.disabled = !input.checked));
        };
        input.addEventListener("change", sync);
        sync();
      });
    $("apps")
      .querySelectorAll("[data-app-help]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const key = b.dataset.appHelp;
            const info = $("apps").querySelector(
              `[data-app-info="${CSS.escape(key)}"]`,
            );
            if (!info) return;
            const open = info.hidden;
            $("apps").querySelectorAll("[data-app-info]").forEach((x) => (x.hidden = true));
            $("apps").querySelectorAll("[data-app-help]").forEach((x) => x.setAttribute("aria-expanded", "false"));
            info.hidden = !open;
            b.setAttribute("aria-expanded", open ? "true" : "false");
          }),
      );
  }
  function collect() {
    const permissions = {},
      levels = {};
    $("apps")
      .querySelectorAll("[data-permission]")
      .forEach((x) => (permissions[x.dataset.permission] = x.checked));
    for (const app of data.apps || []) {
      if (app.pro_only && permissions[app.key]) levels[app.key] = "pro";
      else if (app.levels && permissions[app.key])
        levels[app.key] =
          $("apps").querySelector(
            `[data-level="${CSS.escape(app.key)}"].active`,
          )?.dataset.value || "visitor";
    }
    return { permissions, levels };
  }
  function openEditor() {
    $("editor").classList.remove("hidden");
    presetUI();
    requestAnimationFrame(() =>
      $("editor").scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  }
  function edit(profile) {
    creating = false;
    current = profile;
    selectedRole = profile.role_key || "";
    $("who").textContent =
      `${profile.agents?.prenom || ""} ${profile.agents?.nom || "Accès"}`.trim();
    $("currentCode").innerHTML = profile.current_code
      ? `Code actuel : <b>${esc(profile.current_code)}</b>`
      : 'Code actuel : <span class="access-help">non disponible</span>';
    $("setCode").textContent = "Changer";
    $("save").textContent = "Enregistrer";
    renderApps(profile.permissions || {});
    openEditor();
  }
  function editNew(agent) {
    creating = true;
    current = { agent_id: agent.id, agents: agent };
    selectedRole = "brancardier";
    $("who").textContent = `${agent.prenom || ""} ${agent.nom || ""}`.trim();
    $("currentCode").innerHTML =
      '<span class="access-help">Choisissez un profil métier et un code à six chiffres.</span>';
    $("code").value = "";
    $("setCode").textContent = "Code";
    $("save").textContent = "Créer l’accès";
    const preset = (data.presets || []).find(
      (x) => x.role_key === selectedRole,
    );
    renderApps(preset?.permissions || {});
    openEditor();
  }
  async function save() {
    if (!current) return;
    try {
      if (!selectedRole) throw Error("Choisissez un profil métier.");
      const picked = collect();
      if (creating) {
        const code = $("code").value.replace(/\D/g, "");
        if (!/^\d{6}$/.test(code))
          throw Error("Saisissez un code à six chiffres.");
        const created = await call("create_access", {
          agent_id: current.agent_id,
          role_key: selectedRole,
          code,
        });
        await callDates("set_agent", {
          agent_id: current.agent_id,
          enabled: !!created.permissions?.agent_dates,
        });
        message("Accès créé.");
        closeEditor();
        await load();
        return;
      }
      await call("save", {
        profile_id: current.id,
        role_key: selectedRole,
        ...picked,
      });
      await callDates("set", {
        profile_id: current.id,
        enabled: !!picked.permissions.agent_dates,
      });
      message("Accès enregistré pour cette personne.");
      await load();
    } catch (e) {
      message(e.message);
    }
  }
  async function savePreset() {
    if (!selectedRole) return;
    try {
      const picked = collect();
      const j = await call("save_preset", {
        role_key: selectedRole,
        ...picked,
      });
      await callDates("set_model", {
        model_key: `${selectedRole}_minimum`,
        enabled: !!picked.permissions.agent_dates,
      }).catch(() => null);
      data.presets = j.presets;
      message("Profil métier par défaut enregistré.");
      presetUI();
    } catch (e) {
      message(e.message);
    }
  }
  function closeEditor() {
    creating = false;
    current = null;
    selectedRole = "";
    $("editor").classList.add("hidden");
    $("code").value = "";
  }

  $("save").onclick = save;
  $("savePreset").onclick = savePreset;
  $("cancel").onclick = closeEditor;
  $("backBtn").onclick = () =>
    history.length > 1 ? history.back() : location.assign("index.html");
  $("setCode").onclick = async () => {
    if (!current) return;
    if (creating) {
      message("Le code sera enregistré avec « Créer l’accès ».");
      return;
    }
    try {
      const j = await call("set_code", {
        profile_id: current.id,
        code: $("code").value,
      });
      current.current_code = j.code;
      $("currentCode").innerHTML = `Code actuel : <b>${esc(j.code)}</b>`;
      $("code").value = "";
      message("Code modifié.");
    } catch (e) {
      message(e.message);
    }
  };
  $("newBtn").onclick = async () => {
    try {
      const j = await call("find_new", { q: $("q").value });
      const candidates = sortPeople(j.candidates || []);
      $("candidates").innerHTML =
        candidates
          .map(
            (a, i) =>
              `<button class="access-person" data-candidate="${i}" type="button"><strong>${esc(a.prenom || "")} ${esc(a.nom || "")}</strong><small>GHE ${esc(String(a.ghe || "—").replace(/^GHE\s*/i, ""))}</small></button>`,
          )
          .join("") ||
        '<p class="access-help">Aucun agent sans accès trouvé.</p>';
      $("candidates")
        .querySelectorAll("[data-candidate]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              editNew(candidates[Number(b.dataset.candidate)])),
        );
    } catch (e) {
      message(e.message);
    }
  };
  let searchTimer;
  $("q").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 250);
  };
  $("code").oninput = () => {
    $("code").value = $("code").value.replace(/\D/g, "").slice(0, 6);
  };
  load();
})();
