(() => {
  "use strict";

  const SHIFT = {
    M: { label: "Matin", time: "06h50 – 14h40" },
    J: { label: "Journée", time: "08h30 – 16h20" },
    J4: { label: "J4", time: "10h10 – 18h00" },
    S: { label: "Soir", time: "13h30 – 21h00" },
    N: { label: "Nuit", time: "21h00 – 06h50" },
  };
  const SHIFT_ORDER = Object.keys(SHIFT);
  const ABSENCE_ORDER = ["AR","AT","MA","CA","CP","RH","RTT","RTA","RTTA","RC","AA","RF","SYR"];
  const SPECIAL_SHIFT = {
    J0464: { base: "J", text: "08h30–16h20 · fixe" },
    M0130: { base: "M", text: "3h45 · libre entre 06h00 et 21h30" },
    M0131: { base: "M", text: "7h30 · libre entre 06h30 et 21h15" },
    M0177: { base: "M", text: "7h30 · libre entre 06h25 et 21h35" },
    S0113: { base: "S", text: "13h30–21h00 · fixe" },
  };
  const SAFE_ABSENCE = {
    CA: "Congé",
    CP: "Congé",
    RH: "Repos",
    RTT: "RTT",
    RTA: "Repos / récupération",
    RTTA: "Repos / récupération",
    RC: "Récupération",
    RF: "Repos",
    OFF: "Repos",
    REPOS: "Repos",
  };
  const PRIVATE_ABSENCE = new Set(["AR","AT","MA","AM","AA","ABS","SYR"]);
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-FR");
  }

  function name(agent) {
    return (
      window.STIPName?.format?.(agent) ||
      [String(agent?.prenom || "").toLocaleUpperCase("fr-FR"),
       String(agent?.nom || "").toLocaleLowerCase("fr-FR")]
        .filter(Boolean)
        .join(" ") ||
      "Agent"
    );
  }

  function initials(agent) {
    const parts = name(agent).trim().split(/\s+/).filter(Boolean);
    return (`${parts[0]?.[0] || ""}${parts.at(-1)?.[0] || ""}`).toUpperCase() || "ST";
  }

  const ABSENCE_CODES = new Set([...ABSENCE_ORDER, "ABS", "AM", "OFF", "REPOS", "-", ""]);

  function baseShift(value) {
    let code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code || ABSENCE_CODES.has(code)) return "";
    if (code.endsWith("*")) code = code.slice(0, -1);
    if (SHIFT[code]) return code;
    if (/^J4\d+$/.test(code)) return "J4";
    if (/^M\d+$/.test(code)) return "M";
    if (/^J\d+$/.test(code)) return "J";
    if (/^S\d+$/.test(code)) return "S";
    if (/^N\d+$/.test(code)) return "N";
    return "";
  }

  function isWorking(agent) {
    if (typeof agent?.is_working === "boolean") return agent.is_working;
    return Boolean(baseShift(agent?.today_code));
  }

  function avatar(agent) {
    const url = String(
      agent?.profile_photo_url ||
      window.STIPBootCache?.media?.avatars?.[agent?.source_key] ||
      agent?.avatar_signed_url ||
      agent?.avatar_url ||
      "",
    );
    const value = esc(initials(agent));
    return `<span class="sas-avatar" data-initials="${value}">${/^https?:/i.test(url)
      ? `<img src="${esc(url)}" alt="" loading="lazy">`
      : value}</span>`;
  }

  function gheText(agent) {
    const raw = String(agent?.ghe || "").replace(/^GHE\s*/i, "").trim();
    const match = raw.match(/\d+/);
    return match ? String(Number(match[0])).padStart(2, "0") : "—";
  }

  function gheNumber(agent) {
    const raw = String(agent?.ghe || "").replace(/^GHE\s*/i, "");
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  }

  function compareGhe(a, b) {
    const ga = gheNumber(a), gb = gheNumber(b);
    if (ga !== gb) return ga - gb;
    return name(a).localeCompare(name(b), "fr", { sensitivity: "base" });
  }

  function specialText(agent, code) {
    const source = agent?.today_special_schedule;
    if (source && String(source.code || "").toUpperCase() === code) {
      const minutes = Number(source.duration_minutes || 0);
      const duration = minutes
        ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`
        : "";
      const start = String(source.window_start || "").slice(0, 5).replace(":", "h");
      const end = String(source.window_end || "").slice(0, 5).replace(":", "h");
      return String(source.schedule_mode || "") === "flexible"
        ? `${duration || "Durée spécifique"} · libre entre ${start} et ${end}`
        : `${start}–${end} · fixe`;
    }
    return SPECIAL_SHIFT[code]?.text || "";
  }

  function publicAbsence(code) {
    const c = String(code || "").toUpperCase();
    if (SAFE_ABSENCE[c]) return SAFE_ABSENCE[c];
    if (!c || c === "-") return "Absent aujourd’hui";
    if (PRIVATE_ABSENCE.has(c)) return "Absent aujourd’hui";
    return "Indisponible aujourd’hui";
  }

  function row(agent, options) {
    const code = String(agent.today_code || "").toUpperCase();
    const base = baseShift(code);
    const shift = SHIFT[base];
    const standardCode = code === base || code === `${base}*`;
    const special = specialText(agent, code);
    const full = options.privacy === "full";
    let status = "";
    let marker = "";
    if (shift) {
      if (standardCode) status = `${base} · ${shift.time}`;
      else {
        status = special || "Horaire particulier";
        marker = '<span class="sas-status-chip is-adapted" title="Horaire adapté">⏱ Horaire adapté</span>';
      }
    } else if (full) {
      status = `Absent · ${code || "motif non renseigné"}`;
    } else {
      status = publicAbsence(code);
    }
    const phone = String(agent?.telephone || "").replace(/\D/g, "");
    const codeChip = !shift && full
      ? `<span class="sas-absence-code">${esc(code || "—")}</span>`
      : "";
    return `<div class="sas-person" data-sas-row="${esc(agent.id)}">
      <button class="sas-person-main" type="button" data-sas-agent="${esc(agent.id)}" aria-label="Ouvrir ${esc(name(agent))}">
        <span class="sas-ghe"><small>GHE</small><b>${esc(gheText(agent))}</b></span>
        ${options.showAvatar === false ? "" : avatar(agent)}
        <span class="sas-person-copy">
          <strong>${esc(name(agent))}</strong>
          <small>${esc(status)}</small>
          ${marker}
        </span>
        ${codeChip}
        <em aria-hidden="true">›</em>
      </button>
      ${options.showPhone !== false && phone
        ? `<button class="sas-call" type="button" data-sas-call="${esc(agent.id)}" aria-label="Appeler ${esc(name(agent))}">☎</button>`
        : ""}
    </div>`;
  }

  function workGroup(code, items, options) {
    if (!items.length) return "";
    const shift = SHIFT[code];
    return `<section class="sas-shift shift-${code.toLowerCase()}"><header><b>${code}</b><span><strong>${shift.label}</strong><small>${shift.time}</small></span><em>${items.length}</em></header><div>${items.map((a) => row(a, options)).join("")}</div></section>`;
  }

  function absenceGroup(code, items, options) {
    if (!items.length) return "";
    const full = options.privacy === "full";
    const title = full ? (code || "Sans motif") : publicAbsence(code);
    return `<section class="sas-absence-group"><header><span><b>${esc(title)}</b><small>Non présents aujourd’hui</small></span><strong>${items.length}</strong></header><div>${items.map((a) => row(a, options)).join("")}</div></section>`;
  }

  function phoneHref(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("33") ? `tel:+${digits}` : `tel:${digits}`;
  }

  function hiddenPhoneHref(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("33")) digits = `0${digits.slice(2)}`;
    return `tel:%2331%23${digits}`;
  }

  function closeCallSheet() {
    document.getElementById("sasCallOverlay")?.remove();
  }

  function openCallSheet(agent) {
    const normal = phoneHref(agent?.telephone);
    const hidden = hiddenPhoneHref(agent?.telephone);
    if (!normal) return;
    closeCallSheet();
    const overlay = document.createElement("div");
    overlay.id = "sasCallOverlay";
    overlay.className = "sas-call-overlay";
    overlay.innerHTML = `
      <button class="sas-call-backdrop" type="button" aria-label="Fermer"></button>
      <section class="sas-call-sheet" role="dialog" aria-modal="true" aria-label="Choisir le type d’appel">
        <div class="sas-call-handle" aria-hidden="true"></div>
        <small>APPELER</small>
        <strong>${esc(name(agent))}</strong>
        <div class="sas-call-actions">
          <a class="primary" href="${esc(normal)}"><span aria-hidden="true">☎</span><b>Appeler</b></a>
          ${hidden ? `<a href="${esc(hidden)}"><span aria-hidden="true">◉</span><b>Appeler en inconnu</b></a>` : ""}
        </div>
        <button class="sas-call-cancel" type="button">Annuler</button>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".sas-call-backdrop")?.addEventListener("click", closeCallSheet);
    overlay.querySelector(".sas-call-cancel")?.addEventListener("click", closeCallSheet);
    overlay.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => setTimeout(closeCallSheet, 250)),
    );
  }

  function mount(host, rawOptions = {}) {
    if (!host) throw Error("Conteneur de sélection d’agent introuvable.");
    const options = {
      privacy: rawOptions.privacy === "full" ? "full" : "team",
      showPhone: rawOptions.showPhone !== false,
      showAvatar: rawOptions.showAvatar !== false,
      ...rawOptions,
    };
    const state = {
      items: Array.isArray(options.items) ? options.items : [],
      query: String(options.query || ""),
    };

    function selectedItems() {
      const query = normalize(state.query.trim());
      if (query.length < 2) return null;
      return state.items
        .filter((agent) =>
          normalize([name(agent), agent.source_key, agent.ghe, agent.today_code]
            .filter(Boolean)
            .join(" ")).includes(query),
        )
        .sort(compareGhe);
    }

    function render() {
      const working = state.items.filter(isWorking);
      const absent = state.items.filter((agent) => !isWorking(agent));
      const results = selectedItems();
      const work = SHIFT_ORDER.map((code) =>
        workGroup(
          code,
          working.filter((agent) => baseShift(agent.today_code) === code).sort(compareGhe),
          options,
        ),
      ).join("");
      const absenceCodes = [...new Set(absent.map((agent) => String(agent.today_code || "")))].sort((a, b) => {
        if (options.privacy !== "full") {
          const la = publicAbsence(a), lb = publicAbsence(b);
          const label = la.localeCompare(lb, "fr");
          if (label) return label;
        }
        const ai = ABSENCE_ORDER.indexOf(a.toUpperCase());
        const bi = ABSENCE_ORDER.indexOf(b.toUpperCase());
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return a.localeCompare(b, "fr");
      });
      const absentHtml = absenceCodes.map((code) =>
        absenceGroup(
          code,
          absent.filter((agent) => String(agent.today_code || "") === code).sort(compareGhe),
          options,
        ),
      ).join("");
      host.innerHTML = `<section class="sas-selector">
        <header class="sas-heading">
          <span>${esc(options.kicker || "ÉQUIPE DU JOUR")}</span>
          <h2>${esc(options.title || "Équipe")}</h2>
          <p>${esc(options.description || "Présents, horaires et absences utiles en un coup d’œil.")}</p>
        </header>
        <label class="sas-search"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" value="${esc(state.query)}" placeholder="Nom, prénom ou GHE · dès 2 lettres" aria-label="Rechercher dans l’équipe"><button type="button" ${state.query ? "" : "hidden"} aria-label="Effacer">×</button></label>
        ${results
          ? `<section class="sas-results"><header><span>RÉSULTATS</span><b>${results.length}</b></header>${results.length ? results.map((a) => row(a, options)).join("") : '<p class="sas-empty">Aucun agent trouvé.</p>'}</section>`
          : `<section class="sas-present"><div class="sas-section-title"><span>PRÉSENTS AUJOURD’HUI</span><b>${working.length}</b></div>${work || '<p class="sas-empty">Aucun agent présent aujourd’hui.</p>'}</section><div class="sas-absence-divider"><span>ABSENTS AUJOURD’HUI</span><b>${absent.length}</b></div><section class="sas-absent">${absentHtml || '<p class="sas-empty">Aucune absence aujourd’hui.</p>'}</section>`}
      </section>`;
      wire();
    }

    function wire() {
      const input = host.querySelector(".sas-search input");
      input?.addEventListener("input", (event) => {
        state.query = event.target.value;
        render();
        requestAnimationFrame(() => {
          const current = host.querySelector(".sas-search input");
          current?.focus();
          current?.setSelectionRange?.(state.query.length, state.query.length);
        });
      });
      host.querySelector(".sas-search button")?.addEventListener("click", () => {
        state.query = "";
        render();
        requestAnimationFrame(() => host.querySelector(".sas-search input")?.focus());
      });
      host.querySelectorAll(".sas-avatar img").forEach((image) =>
        image.addEventListener("error", () => {
          const box = image.parentElement;
          if (box) box.textContent = box.dataset.initials || "ST";
        }, { once: true }),
      );
      host.querySelectorAll("[data-sas-agent]").forEach((button) =>
        button.addEventListener("click", () => {
          const agent = state.items.find((item) => String(item.id) === String(button.dataset.sasAgent));
          if (agent) options.onSelect?.(agent);
        }),
      );
      host.querySelectorAll("[data-sas-call]").forEach((button) =>
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const agent = state.items.find((item) => String(item.id) === String(button.dataset.sasCall));
          if (!agent) return;
          if (options.onCall) options.onCall(agent);
          else openCallSheet(agent);
        }),
      );
    }

    render();
    return {
      setItems(items) {
        state.items = Array.isArray(items) ? items : [];
        render();
      },
      setQuery(query) {
        state.query = String(query || "");
        render();
      },
      focus() {
        host.querySelector(".sas-search input")?.focus();
      },
    };
  }

  window.STIPAgentSelector = {
    mount,
    name,
    baseShift,
    isWorking,
    compareGhe,
    openCallSheet,
  };
})();