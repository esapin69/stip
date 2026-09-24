(() => {
  "use strict";

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

  function shiftDef(value) {
    return window.STIPShiftRegistry?.resolve?.(value) || null;
  }

  function shiftOrder() {
    const seen = new Set();
    return (window.STIPShiftRegistry?.all?.() || [])
      .filter((row) => {
        const code = String(row?.code || "").toUpperCase(),
          base = String(row?.base_code || row?.code || "").toUpperCase();
        if (!row?.is_working || code !== base || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .sort((a, b) => Number(a?.sort_order || 999) - Number(b?.sort_order || 999));
  }

  function baseShift(value) {
    const def = shiftDef(value);
    return def?.is_working
      ? String(def.base_code || def.code || "").toUpperCase()
      : "";
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
    const source = agent?.today_shift_definition || agent?.today_special_schedule,
      registryTime = window.STIPShiftRegistry?.time?.(code) || "";
    if (source && String(source.schedule_mode || "standard") !== "standard")
      return registryTime || String(source.source_label || "Horaire adapté");
    const base = baseShift(code);
    return base && String(code || "").replace(/\*+$/, "") !== base
      ? registryTime || "Horaire adapté"
      : "";
  }

  function publicAbsence(code) {
    const c = String(code || "").toUpperCase();
    if (!c || c === "-") return "Absent aujourd’hui";
    if (PRIVATE_ABSENCE.has(c)) return "Absent aujourd’hui";
    const def = shiftDef(c);
    if (def && !def.is_working) return String(def.label || "Indisponible aujourd’hui");
    return "Indisponible aujourd’hui";
  }

  function row(agent, options) {
    const code = String(agent.today_code || "").toUpperCase();
    const base = baseShift(code);
    const shift = base ? shiftDef(base) : null;
    const standardCode = code === base || code === `${base}*`;
    const special = specialText(agent, code);
    const full = options.privacy === "full";
    const picker = options.mode === "picker";
    const selected = picker && String(agent?.id ?? "") === String(options.selectedId ?? "");
    let status = "";
    let marker = "";
    if (shift) {
      if (standardCode) status = `${base} · ${window.STIPShiftRegistry?.time?.(base) || ''}`;
      else {
        status = special || "Horaire particulier";
        marker = `<span class="sas-status-chip is-adapted" title="Horaire adapté">⏱ Horaire adapté${full ? ` · ${esc(code)}` : ""}</span>`;
      }
    } else if (full) {
      status = `Absent · ${code || "motif non renseigné"}`;
    } else {
      status = publicAbsence(code);
    }
    const phone = String(agent?.telephone || "").replace(/\D/g, "");
    const codeChip = !picker && !shift && full
      ? `<span class="sas-absence-code">${esc(code || "—")}</span>`
      : "";
    const statusHtml = options.showStatus === false
      ? ""
      : `<small>${esc(status)}</small>${marker}`;
    const trailing = picker
      ? `<span class="sas-select-mark" aria-hidden="true"></span>`
      : `<em aria-hidden="true">›</em>`;
    const actionLabel = picker ? "Choisir" : "Ouvrir";
    return `<div class="sas-person${selected ? " is-selected" : ""}" data-sas-row="${esc(agent.id)}">
      <button class="sas-person-main" type="button" data-sas-agent="${esc(agent.id)}" aria-label="${actionLabel} ${esc(name(agent))}">
        <span class="sas-ghe"><small>GHE</small><b>${esc(gheText(agent))}</b></span>
        ${options.showAvatar === false ? "" : avatar(agent)}
        <span class="sas-person-copy">
          <strong>${esc(name(agent))}</strong>
          ${statusHtml}
        </span>
        ${codeChip}
        ${trailing}
      </button>
      ${options.showPhone !== false && phone
        ? `<button class="sas-call" type="button" data-sas-call="${esc(agent.id)}" aria-label="Appeler ${esc(name(agent))}">☎</button>`
        : ""}
    </div>`;
  }

  function workGroup(code, items, options) {
    if (!items.length) return "";
    const shift = shiftDef(code);
    return `<section class="sas-shift shift-${String(code).toLowerCase()}"><header><b>${esc(code)}</b><span><strong>${esc(shift?.label || code)}</strong><small>${esc(window.STIPShiftRegistry?.time?.(code) || "")}</small></span><em>${items.length}</em></header><div>${items.map((a) => row(a, options)).join("")}</div></section>`;
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
    const mode = rawOptions.mode === "picker" ? "picker" : "directory";
    const minQueryValue = Number(rawOptions.minQuery);
    const options = {
      ...rawOptions,
      mode,
      privacy: rawOptions.privacy === "full" ? "full" : "team",
      showPhone: typeof rawOptions.showPhone === "boolean" ? rawOptions.showPhone : mode !== "picker",
      showAvatar: rawOptions.showAvatar !== false,
      showStatus: typeof rawOptions.showStatus === "boolean" ? rawOptions.showStatus : mode !== "picker",
      minQuery: Number.isFinite(minQueryValue) ? Math.max(0, minQueryValue) : 2,
    };
    const state = {
      items: Array.isArray(options.items) ? options.items : [],
      query: String(options.query || ""),
    };

    function selectedItems() {
      const query = normalize(state.query.trim());
      if (query.length < options.minQuery) return null;
      return state.items
        .filter((agent) =>
          normalize([name(agent), agent.source_key, agent.ghe, agent.today_code]
            .filter(Boolean)
            .join(" ")).includes(query),
        )
        .sort(compareGhe);
    }

    function render() {
      const picker = options.mode === "picker";
      const working = state.items.filter(isWorking);
      const absent = state.items.filter((agent) => !isWorking(agent));
      const results = selectedItems();
      const work = shiftOrder().map((definition) => {
        const code = String(definition.code || "").toUpperCase();
        return workGroup(
          code,
          working.filter((agent) => baseShift(agent.today_code) === code).sort(compareGhe),
          options,
        );
      }).join("");
      let absentHtml = "";
      if (!picker && options.privacy === "full") {
        const absenceCodes = [...new Set(absent.map((agent) => String(agent.today_code || "")))].sort((a, b) => {
          const ad = shiftDef(a), bd = shiftDef(b),
            ai = Number(ad?.sort_order || 999),
            bi = Number(bd?.sort_order || 999);
          return ai !== bi ? ai - bi : a.localeCompare(b, "fr");
        });
        absentHtml = absenceCodes.map((code) =>
          absenceGroup(
            code,
            absent.filter((agent) => String(agent.today_code || "") === code).sort(compareGhe),
            options,
          ),
        ).join("");
      } else if (!picker) {
        const groups = new Map();
        absent.forEach((agent) => {
          const label = publicAbsence(agent.today_code);
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label).push(agent);
        });
        absentHtml = [...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b, "fr"))
          .map(([label, rows]) =>
            `<section class="sas-absence-group"><header><span><b>${esc(label)}</b><small>Non présents aujourd’hui</small></span><strong>${rows.length}</strong></header><div>${rows.sort(compareGhe).map((agent) => row(agent, options)).join("")}</div></section>`,
          )
          .join("");
      }

      const kicker = options.kicker || (picker ? "PERSONNES" : "ÉQUIPE DU JOUR");
      const title = options.title || (picker ? "Rechercher un agent" : "Équipe");
      const description = options.description || (
        picker
          ? `Nom, prénom ou GHE · saisissez au moins ${options.minQuery} lettre${options.minQuery > 1 ? "s" : ""}.`
          : "Présents, horaires et absences utiles en un coup d’œil."
      );
      const placeholder = options.placeholder || `Nom, prénom ou GHE · dès ${options.minQuery} lettre${options.minQuery > 1 ? "s" : ""}`;
      const searchLabel = options.searchLabel || (picker ? "Rechercher un agent" : "Rechercher dans l’équipe");
      const pickerBody = results
        ? `<section class="sas-results"><header><span>RÉSULTATS</span><b>${results.length}</b></header>${results.length ? results.map((agent) => row(agent, options)).join("") : '<p class="sas-empty">Aucun agent trouvé.</p>'}</section>`
        : `<section class="sas-picker-idle" aria-live="polite"><span aria-hidden="true">⌕</span><strong>Recherchez un agent</strong><small>Nom, prénom ou GHE · dès ${options.minQuery} lettre${options.minQuery > 1 ? "s" : ""}</small></section>`;

      host.innerHTML = `<section class="sas-selector${picker ? " is-picker" : ""}">
        <header class="sas-heading">
          <span>${esc(kicker)}</span>
          <h2>${esc(title)}</h2>
          <p>${esc(description)}</p>
        </header>
        <label class="sas-search"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" value="${esc(state.query)}" placeholder="${esc(placeholder)}" aria-label="${esc(searchLabel)}"><button type="button" ${state.query ? "" : "hidden"} aria-label="Effacer">×</button></label>
        ${picker
          ? pickerBody
          : results
            ? `<section class="sas-results"><header><span>RÉSULTATS</span><b>${results.length}</b></header>${results.length ? results.map((agent) => row(agent, options)).join("") : '<p class="sas-empty">Aucun agent trouvé.</p>'}</section>`
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
      setSelected(selectedId) {
        options.selectedId = selectedId;
        render();
      },
      focus() {
        host.querySelector(".sas-search input")?.focus();
      },
      destroy() {
        host.replaceChildren();
      },
    };
  }

  function mountPicker(host, rawOptions = {}) {
    return mount(host, { ...rawOptions, mode: "picker" });
  }

  function closePickerOverlay() {
    document.getElementById("sasPickerOverlay")?.remove();
  }

  function openPicker(rawOptions = {}) {
    closePickerOverlay();
    const overlay = document.createElement("div");
    overlay.id = "sasPickerOverlay";
    overlay.className = "sas-picker-overlay";
    overlay.innerHTML = `
      <button class="sas-picker-backdrop" type="button" aria-label="Fermer"></button>
      <section class="sas-picker-sheet" role="dialog" aria-modal="true" aria-label="${esc(rawOptions.title || "Rechercher un agent")}">
        <button class="sas-picker-close" type="button" aria-label="Fermer">×</button>
        <div class="sas-picker-host"></div>
      </section>`;
    document.body.appendChild(overlay);

    let closed = false;
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      rawOptions.onClose?.();
    };

    overlay.querySelector(".sas-picker-backdrop")?.addEventListener("click", close);
    overlay.querySelector(".sas-picker-close")?.addEventListener("click", close);
    document.addEventListener("keydown", onKeyDown);

    const selector = mountPicker(overlay.querySelector(".sas-picker-host"), {
      ...rawOptions,
      onSelect(agent) {
        rawOptions.onSelect?.(agent);
        close();
      },
    });
    if (rawOptions.autoFocus === true) requestAnimationFrame(() => selector.focus());

    return { close, selector, element: overlay };
  }

  window.STIPAgentSelector = {
    mount,
    mountPicker,
    openPicker,
    closePicker: closePickerOverlay,
    name,
    baseShift,
    isWorking,
    compareGhe,
    openCallSheet,
  };
})();