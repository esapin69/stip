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
  const ABSENCE_ORDER = [
    "AR",
    "AT",
    "MA",
    "CA",
    "RH",
    "RTT",
    "RTA",
    "RTTA",
    "RC",
    "AA",
    "RF",
    "SYR",
  ];
  const SPECIAL_SHIFT = {
    J0464: { base: "J", text: "08h30–16h20 · fixe" },
    M0130: { base: "M", text: "3h45 · libre entre 06h00 et 21h30" },
    M0131: { base: "M", text: "7h30 · libre entre 06h30 et 21h15" },
    M0177: { base: "M", text: "7h30 · libre entre 06h25 et 21h35" },
    S0113: { base: "S", text: "13h30–21h00 · fixe" },
  };
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-FR");
  }

  function name(agent) {
    return (
      window.STIPName?.format?.(agent) ||
      window.GHEBase?.displayName?.(agent) ||
      [agent?.prenom, agent?.nom].filter(Boolean).join(" ") ||
      "Agent"
    );
  }

  function initials(agent) {
    const parts = name(agent).trim().split(/\s+/).filter(Boolean);
    return (
      `${parts[0]?.[0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase() || "ST"
    );
  }

  const ABSENCE_CODES = new Set([
    ...ABSENCE_ORDER,
    "ABS",
    "OFF",
    "REPOS",
    "-",
    "",
  ]);

  function baseShift(value) {
    let code = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    if (!code || ABSENCE_CODES.has(code)) return "";
    if (code.endsWith("*")) code = code.slice(0, -1);
    if (SHIFT[code]) return code;

    // Certains codes planning gardent le shift en préfixe et ajoutent
    // un identifiant numérique (ex. M0130, J0464). Ils restent travaillés.
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
    const url = String(agent?.profile_photo_url || window.STIPBootCache?.media?.avatars?.[agent?.source_key] || agent?.avatar_signed_url || agent?.avatar_url || "");
    const value = esc(initials(agent));
    return `<span class="sas-avatar" data-initials="${value}">${/^https?:/i.test(url) ? `<img src="${esc(url)}" alt="" loading="lazy">` : value}</span>`;
  }

  function specialText(agent, code) {
    const source = agent?.today_special_schedule;
    if (source && String(source.code || "").toUpperCase() === code) {
      const minutes = Number(source.duration_minutes || 0),
        duration = minutes
          ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`
          : "",
        start = String(source.window_start || "").slice(0, 5).replace(":", "h"),
        end = String(source.window_end || "").slice(0, 5).replace(":", "h");
      return String(source.schedule_mode || "") === "flexible"
        ? `${duration || "Durée spécifique"} · libre entre ${start} et ${end}`
        : `${start}–${end} · fixe`;
    }
    return SPECIAL_SHIFT[code]?.text || "";
  }

  function row(agent) {
    const code = String(agent.today_code || "").toUpperCase(),
      base = baseShift(code),
      shift = SHIFT[base],
      standardCode = code === base || code === `${base}*`,
      special = specialText(agent, code);
    const status = shift
      ? standardCode
        ? `${code} · ${shift.time}`
        : special
          ? `Présent · ${code} · ${special}`
          : `Présent · ${code} · horaire spécifique`
      : `Absent · ${code || "motif non renseigné"}`;
    const meta = [status, agent.ghe ? `GHE ${agent.ghe}` : ""]
      .filter(Boolean)
      .join(" · ");
    return `<button class="sas-person" type="button" data-sas-agent="${esc(agent.id)}">${avatar(agent)}<span><strong>${esc(name(agent))}</strong><small>${esc(meta)}</small></span>${shift ? `<i class="sas-dot shift-${baseShift(code).toLowerCase()}"></i>` : `<b class="sas-absence-code">${esc(code || "—")}</b>`}<em>›</em></button>`;
  }

  function workGroup(code, items) {
    if (!items.length) return "";
    const shift = SHIFT[code];
    return `<section class="sas-shift shift-${code.toLowerCase()}"><header><b>${code}</b><span><strong>${shift.label}</strong><small>${shift.time}</small></span><em>${items.length}</em></header><div>${items.map(row).join("")}</div></section>`;
  }

  function absenceGroup(code, items) {
    if (!items.length) return "";
    return `<section class="sas-absence-group"><header><span><b>${esc(code || "Sans motif")}</b><small>Non présents aujourd’hui</small></span><strong>${items.length}</strong></header><div>${items.map(row).join("")}</div></section>`;
  }

  function mount(host, options = {}) {
    if (!host) throw Error("Conteneur de sélection d’agent introuvable.");
    const state = {
      items: Array.isArray(options.items) ? options.items : [],
      query: String(options.query || ""),
    };

    function selectedItems() {
      const query = normalize(state.query.trim());
      if (query.length < 2) return null;
      return state.items
        .filter((agent) =>
          normalize(
            [name(agent), agent.source_key, agent.ghe, agent.today_code]
              .filter(Boolean)
              .join(" "),
          ).includes(query),
        )
        .sort((a, b) => name(a).localeCompare(name(b), "fr"));
    }

    function render() {
      const working = state.items.filter(isWorking);
      const absent = state.items.filter((agent) => !isWorking(agent));
      const results = selectedItems();
      const date = options.date ? new Date(`${options.date}T12:00:00`) : null;
      const contextDate = date
        ? date.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })
        : "";
      const work = SHIFT_ORDER.map((code) =>
        workGroup(
          code,
          working
            .filter((agent) => baseShift(agent.today_code) === code)
            .sort((a, b) => name(a).localeCompare(name(b), "fr")),
        ),
      ).join("");
      const absenceCodes = [
        ...new Set(absent.map((agent) => String(agent.today_code || ""))),
      ].sort((a, b) => {
        const ai = ABSENCE_ORDER.indexOf(a.toUpperCase());
        const bi = ABSENCE_ORDER.indexOf(b.toUpperCase());
        if (ai !== -1 || bi !== -1)
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return a.localeCompare(b, "fr");
      });
      const absentHtml = absenceCodes
        .map((code) =>
          absenceGroup(
            code,
            absent
              .filter((agent) => String(agent.today_code || "") === code)
              .sort((a, b) => name(a).localeCompare(name(b), "fr")),
          ),
        )
        .join("");
      host.innerHTML = `<section class="sas-selector"><header class="sas-heading"><span>${esc(options.kicker || "SÉLECTION D’AGENT")}</span><h2>${esc(options.title || "Choisir un agent")}</h2><p>${esc(options.description || contextDate || "Sélectionne la personne concernée.")}</p></header><label class="sas-search"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" value="${esc(state.query)}" placeholder="Nom ou prénom · dès 2 lettres" aria-label="Rechercher un agent"><button type="button" ${state.query ? "" : "hidden"} aria-label="Effacer">×</button></label>${results ? `<section class="sas-results"><header><span>RÉSULTATS</span><b>${results.length}</b></header>${results.length ? results.map(row).join("") : '<p class="sas-empty">Aucun agent trouvé.</p>'}</section>` : `<section class="sas-present"><div class="sas-section-title"><span>PRÉSENTS AUJOURD’HUI</span><b>${working.length}</b></div>${work || '<p class="sas-empty">Aucun agent présent aujourd’hui.</p>'}</section><div class="sas-absence-divider"><span>ABSENTS AUJOURD’HUI</span><b>${absent.length}</b></div><section class="sas-absent">${absentHtml || '<p class="sas-empty">Aucune absence aujourd’hui.</p>'}</section>`}</section>`;
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
      host
        .querySelector(".sas-search button")
        ?.addEventListener("click", () => {
          state.query = "";
          render();
          requestAnimationFrame(() =>
            host.querySelector(".sas-search input")?.focus(),
          );
        });
      host.querySelectorAll(".sas-avatar img").forEach((image) =>
        image.addEventListener(
          "error",
          () => {
            const box = image.parentElement;
            if (box) box.textContent = box.dataset.initials || "ST";
          },
          { once: true },
        ),
      );
      host.querySelectorAll("[data-sas-agent]").forEach((button) =>
        button.addEventListener("click", () => {
          const agent = state.items.find(
            (item) => String(item.id) === String(button.dataset.sasAgent),
          );
          if (agent) options.onSelect?.(agent);
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

  window.STIPAgentSelector = { mount, name, baseShift, isWorking };
})();
