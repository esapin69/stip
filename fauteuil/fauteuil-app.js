(() => {
  "use strict";
  // The GHE backend is the only source of truth. No independent database or copied chat.
  const ACCESS = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access";
  const SESSION = "stip_session_v1";
  const ids = (name) => document.getElementById("fw-" + name);
  const auth = ids("auth");
  const board = ids("board");
  const trainee = ids("trainee");
  const account = ids("account");
  let currentSession = null;
  let working = false;

  function token() {
    try { return localStorage.getItem(SESSION) || ""; } catch { return ""; }
  }

  function saveToken(value) {
    if (!value) return;
    localStorage.setItem(SESSION, value);
  }

  function clearToken() {
    try { localStorage.removeItem(SESSION); } catch {}
  }

  async function request(action, fields = {}) {
    const response = await fetch(ACCESS, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", "x-stip-session": token() },
      body: JSON.stringify({ action, ...fields }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      const error = data.error;
      throw new Error(typeof error === "string" ? error : error?.message || "Connexion indisponible.");
    }
    return data;
  }

  function status(message = "", target = ids("login-status")) {
    target.textContent = message;
  }

  function show(which) {
    auth.hidden = which !== "auth";
    trainee.hidden = which !== "trainee";
    board.hidden = which !== "board";
    account.hidden = which === "auth";
  }

  function accessFamily(session) {
    const explicit = String(session?.permissions?.communication_family || "").trim().toLowerCase();
    if (explicit) return explicit;
    const role = String(session?.role_key || "").toLowerCase();
    return ["brancardier", "chef_equipe", "stagiaire", "admin"].includes(role)
      ? "brancardage" : "hors_brancardage";
  }

  function allowed(session) {
    return session?.permissions?.messages === true && accessFamily(session) === "brancardage";
  }

  function displayAgent(session) {
    const agent = session?.agent || {};
    const full = [agent.prenom, agent.nom].filter(Boolean).join(" ").trim();
    return String(agent.nickname || full || session?.role_label || "Agent");
  }

  async function displaySession(session) {
    currentSession = session;
    if (!session || !allowed(session)) {
      window.STIPTableau?.unmountFull?.();
      ids("user").textContent = "";
      show("auth");
      status("Ce profil n’a pas accès au module Fauteuils. Demande l’autorisation à un administrateur GHE.");
      return;
    }

    window.STIPSession = session;
    window.STIPAccess = { has: (key) => session?.permissions?.[key] === true };
    ids("user").textContent = displayAgent(session);
    status();

    if (session.trainee_selection_required) {
      show("trainee");
      await loadTrainees();
      return;
    }
    if (!window.STIPTableau?.mount) {
      show("auth");
      status("Le moteur Fauteuils n'a pas pu charger. Vérifie ta connexion puis réessaie.");
      return;
    }
    show("board");
    window.STIPTableau.mount(ids("chat"), { mode: "wheelchair" });
  }

  async function loadTrainees() {
    const select = ids("trainee-select");
    ids("trainee-error").textContent = "";
    select.replaceChildren(new Option("Sélectionner un profil", ""));
    try {
      const data = await request("trainee_list");
      for (const item of data.items || []) {
        const text = [item.prenom, item.nom].filter(Boolean).join(" ").trim();
        if (item.key && text) select.add(new Option(text, item.key));
      }
      if (select.options.length === 1) status("Aucun profil stagiaire disponible.", ids("trainee-error"));
    } catch (error) {
      status(error.message, ids("trainee-error"));
    }
  }

  ids("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (working) return;
    const pin = ids("pin");
    const code = String(pin.value || "").trim();
    if (!/^\d{6}$/.test(code)) return status("Saisis ton code GHE à 6 chiffres.");
    working = true;
    ids("login-button").disabled = true;
    status("Vérification du code…");
    try {
      const session = await request("login", { code });
      if (!session.session_token) throw Error("Réponse de connexion incomplète.");
      saveToken(session.session_token);
      pin.value = "";
      await displaySession(session);
    } catch (error) {
      pin.value = "";
      status(error.message || "Connexion impossible.");
    } finally {
      ids("login-button").disabled = false;
      working = false;
    }
  });

  ids("trainee-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (working) return;
    const key = ids("trainee-select").value;
    if (!key) return status("Choisis un profil.", ids("trainee-error"));
    working = true;
    try {
      const session = await request("trainee_select", { trainee_key: key });
      await displaySession(session);
    } catch (error) {
      status(error.message, ids("trainee-error"));
    } finally { working = false; }
  });

  ids("refresh").addEventListener("click", () => window.STIPTableau?.refresh?.());

  ids("logout").addEventListener("click", async () => {
    if (working) return;
    working = true;
    window.STIPTableau?.stop?.();
    try { await request("logout"); } catch {}
    clearToken();
    currentSession = null;
    window.STIPSession = null;
    ids("pin").value = "";
    show("auth");
    status("Session fermée.");
    working = false;
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.hidden || !currentSession || !token()) return;
    try {
      const session = await request("me");
      if (!allowed(session)) await displaySession(session);
    } catch {
      window.STIPTableau?.stop?.();
      clearToken();
      currentSession = null;
      show("auth");
      status("Ta session a expiré. Reconnecte-toi.");
    }
  });

  async function boot() {
    show("auth");
    if (!token()) return;
    status("Reconnexion à GHE…");
    try {
      const session = await request("me");
      await displaySession(session);
    } catch {
      clearToken();
      status("Session expirée. Saisis ton code GHE.");
    }
  }

  boot();
})();
