(() => {
  "use strict";

  const BUILTIN = {
    "work-morning": { label:"Matin", fallback_text:"🔵", view_box:"0 0 24 24", stroke_width:2.2, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"] },
    "work-day": { label:"Journée", fallback_text:"🟢", view_box:"0 0 24 24", stroke_width:2.2, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"] },
    "work-late": { label:"J4", fallback_text:"🟠", view_box:"0 0 24 24", stroke_width:2.2, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"] },
    "work-evening": { label:"Soir", fallback_text:"🟡", view_box:"0 0 24 24", stroke_width:2.2, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"] },
    "work-night": { label:"Nuit", fallback_text:"⚫", view_box:"0 0 24 24", stroke_width:2.2, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"] },
    "rest-home": { label:"Repos", fallback_text:"🏠", view_box:"0 0 24 24", stroke_width:1.9, paths:["M3 11.5 12 4l9 7.5","M5 10.5V21h14V10.5","M9 21v-6h6v6"] },
    "leave-island": { label:"Congé / vacances", fallback_text:"🏝️", view_box:"0 0 24 24", stroke_width:1.9, paths:["M3 20c2.2-2.1 5.2-3.2 9-3.2s6.8 1.1 9 3.2","M12 16V7","M12 8c-2.1-2-4.5-2.2-6.7-.7","M12 8c2-2 4.5-2.2 6.7-.7"] },
    "time-off": { label:"RTT", fallback_text:"⏱️", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2","M12 7v5l3.5 2","M9 2h6"] },
    "recovery": { label:"Récupération", fallback_text:"↻", view_box:"0 0 24 24", stroke_width:1.9, paths:["M20 7v5h-5","M20 12a8 8 0 1 1-2.3-5.7"] },
    "holiday-rest": { label:"Repos férié", fallback_text:"📅", view_box:"0 0 24 24", stroke_width:1.75, paths:["M4 5h16v16H4z","M8 3v4","M16 3v4","M4 9h16","M12 12.2l1.1 2.2 2.5.4-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.4z"] },
    "training": { label:"Formation", fallback_text:"🎓", view_box:"0 0 24 24", stroke_width:1.9, paths:["M3 9.5 12 5l9 4.5-9 4.5z","M7 12.2v4.1c3 2.2 7 2.2 10 0v-4.1","M21 9.5v6"] },
    "trainee": { label:"Stagiaire", fallback_text:"👶", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8","M5 21c.7-4.2 3.1-6.5 7-6.5s6.3 2.3 7 6.5","M18 6h4","M20 4v4"] },
    "medical": { label:"Médical", fallback_text:"🩺", view_box:"0 0 24 24", stroke_width:1.9, paths:["M6 3v6a4 4 0 0 0 8 0V3","M8 3H4","M16 3h-4","M10 13v2a4 4 0 0 0 8 0v-1","M18 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4"] },
    "union": { label:"Activité syndicale", fallback_text:"🤝", view_box:"0 0 24 24", stroke_width:1.8, paths:["M4 8l4-3 4 3 4-3 4 3","M3 9l5 5 3-2 2 2 3-2 5-5","M8 14l2 2","M11 12l3 3","M14 12l2 2"] },
    "medical-leave": { label:"Arrêt médical", fallback_text:"✚", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9","M12 8v8","M8 12h8"] },
    "absence": { label:"Absence", fallback_text:"×", view_box:"0 0 24 24", stroke_width:1.8, paths:["M4 5h16v16H4z","M8 3v4","M16 3v4","M4 9h16","M9 13l6 6","M15 13l-6 6"] },
    "other": { label:"Autre repère", fallback_text:"•", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9","M12 11v6","M12 8h.01"] },
    "person": { label:"Personne", fallback_text:"👤", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8","M5 21c.7-4.2 3.1-6.5 7-6.5s6.3 2.3 7 6.5"] },
    "manager": { label:"Responsable", fallback_text:"★", view_box:"0 0 24 24", stroke_width:1.75, paths:["M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7","M4 21c.6-4 2.8-6.2 6-6.2 1.6 0 3 .5 4.1 1.4","M18 11.5l1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z"] },
    "service": { label:"Service", fallback_text:"▦", view_box:"0 0 24 24", stroke_width:1.8, paths:["M5 21V4h10v17","M15 9h4v12","M8 8h4","M8 12h4","M8 16h4","M18 13h.01","M18 17h.01"] },
    "event": { label:"Événement", fallback_text:"📌", view_box:"0 0 24 24", stroke_width:1.8, paths:["M4 5h16v16H4z","M8 3v4","M16 3v4","M4 9h16","M8 13h8","M8 17h5"] },
    "meeting": { label:"Réunion", fallback_text:"◎", view_box:"0 0 24 24", stroke_width:1.8, paths:["M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6","M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6","M2.5 20c.5-4 2.4-6 5.5-6 1.7 0 3.1.6 4 1.6","M11.5 20c.5-4 2.4-6 5.5-6 3.1 0 5 2 5.5 6"] },
    "info": { label:"Information", fallback_text:"i", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9","M12 11v6","M12 8h.01"] },
    "alert": { label:"Urgent", fallback_text:"!", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 3 2.5 20h19z","M12 9v5","M12 17h.01"] },
    "priority": { label:"Important", fallback_text:"!", view_box:"0 0 24 24", stroke_width:1.9, paths:["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2","M12 7v6","M12 16h.01"] }
  };

  const catalog = new Map(Object.entries(BUILTIN));
  const pathRe = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/;
  const keyRe = /^[a-z0-9][a-z0-9-]{0,63}$/;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);

  function cleanRow(row = {}) {
    const key = String(row.icon_key || "").trim();
    if (!keyRe.test(key)) return null;
    const paths = (Array.isArray(row.paths) ? row.paths : [])
      .map((p) => String(p || "").trim())
      .filter((p) => p && p.length <= 2400 && pathRe.test(p))
      .slice(0, 12);
    if (!paths.length) return null;
    return [key, {
      label: String(row.label || key),
      fallback_text: String(row.fallback_text || ""),
      view_box: /^-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/.test(String(row.view_box || ""))
        ? String(row.view_box) : "0 0 24 24",
      stroke_width: Math.min(3, Math.max(1, Number(row.stroke_width || 1.9))),
      paths
    }];
  }

  function setCatalog(rows = []) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const entry = cleanRow(row);
      if (entry) catalog.set(entry[0], entry[1]);
    }
    return api;
  }

  function get(key) {
    return catalog.get(String(key || "").trim()) || null;
  }

  function fallback(key, explicit = "") {
    const def = get(key);
    return String(explicit || def?.fallback_text || "•");
  }

  function markup(key, explicitFallback = "", options = {}) {
    const def = get(key);
    if (!def?.paths?.length) return esc(fallback(key, explicitFallback));
    const className = String(options.className || "")
      .split(/\s+/).filter((x) => /^[a-zA-Z0-9_-]+$/.test(x)).join(" ");
    const label = String(options.label || def.label || "").trim();
    const title = String(options.title || "").trim();
    const a11y = label
      ? ` role="img" aria-label="${esc(label)}"`
      : ' aria-hidden="true"';
    return `<svg class="stip-icon-svg${className ? " " + className : ""}" viewBox="${esc(def.view_box)}" fill="none" stroke="currentColor" stroke-width="${def.stroke_width}" stroke-linecap="round" stroke-linejoin="round"${a11y}${title ? ` title="${esc(title)}"` : ""}>${def.paths.map((d) => `<path d="${esc(d)}"></path>`).join("")}</svg>`;
  }

  function fromRow(row = {}, options = {}) {
    return markup(row.icon_key, row.icon || row.icone || options.fallback || "", {
      ...options,
      label: options.label || row.label || row.title || ""
    });
  }

  function hydrate(root = document) {
    root.querySelectorAll?.("[data-stip-icon-key]").forEach((node) => {
      const key = node.getAttribute("data-stip-icon-key") || "";
      const fb = node.getAttribute("data-stip-icon-fallback") || node.textContent || "";
      node.innerHTML = markup(key, fb, {
        className: node.getAttribute("data-stip-icon-class") || "",
        label: node.getAttribute("aria-label") || ""
      });
    });
  }

  const api = { setCatalog, get, fallback, markup, fromRow, hydrate };
  window.STIPIcons = api;

  if (window.STIPBootCache?.icon_catalog) setCatalog(window.STIPBootCache.icon_catalog);
  window.addEventListener("stip:boot-updated", (event) => {
    if (event?.detail?.icon_catalog) setCatalog(event.detail.icon_catalog);
  });
})();