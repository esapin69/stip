(() => {
  "use strict";

  const SHIFT = {
    M: { label: "matin", start: 6 * 60 + 50, end: 14 * 60 + 40 },
    J: { label: "journée", start: 8 * 60 + 30, end: 16 * 60 + 20 },
    J4: { label: "J4", start: 10 * 60 + 10, end: 18 * 60 },
    S: { label: "soir", start: 13 * 60 + 30, end: 21 * 60 },
    N: { label: "nuit", start: 21 * 60, end: 24 * 60 + 6 * 60 + 50 },
  };
  const MIN_USEFUL_OVERLAP = 60;

  const number = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function shiftLabel(code) {
    const key = String(code || "").trim().toUpperCase();
    return SHIFT[key]?.label || key || "créneau";
  }

  function levelFromSeverity(value) {
    const severity = number(value);
    if (severity >= 4) return "critical";
    if (severity >= 2) return "warning";
    return "ok";
  }

  function statusMeta(level) {
    if (level === "critical")
      return { level, symbol: "🛑", label: "Ça coince" };
    if (level === "warning")
      return { level, symbol: "⚠️", label: "À surveiller" };
    if (level === "opportunity")
      return { level, symbol: "➕", label: "Marge utile" };
    if (level === "ok")
      return { level, symbol: "✔", label: "Rien ne coince" };
    return { level: "unknown", symbol: "", label: "Pas assez de données" };
  }

  function rowsOf(staff) {
    const rows = staff?.rows || staff?.shifts || [];
    return Array.isArray(rows) ? rows.filter(Boolean) : [];
  }

  function rowGap(row) {
    if (row?.gap != null && Number.isFinite(Number(row.gap)))
      return Number(row.gap);
    const planned = Number(row?.planned_count);
    const target = Number(row?.target_count);
    return Number.isFinite(planned) && Number.isFinite(target)
      ? planned - target
      : 0;
  }

  function minuteLabel(value) {
    const minute = ((Number(value) % 1440) + 1440) % 1440;
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}h${String(minute % 60).padStart(2, "0")}`;
  }

  function transferOptions(rows) {
    const shiftRows = (Array.isArray(rows) ? rows : []).filter((row) => row?.shift_code);
    const deficits = shiftRows.filter((row) => rowGap(row) < 0);
    const donors = shiftRows.filter((row) => rowGap(row) > 0);
    const out = [];
    for (const target of deficits) {
      const toShift = String(target.shift_code || "").toUpperCase();
      const toMeta = SHIFT[toShift];
      if (!toMeta) continue;
      for (const source of donors) {
        const fromShift = String(source.shift_code || "").toUpperCase();
        const fromMeta = SHIFT[fromShift];
        if (!fromMeta || fromShift === toShift) continue;
        const start = Math.max(fromMeta.start, toMeta.start);
        const end = Math.min(fromMeta.end, toMeta.end);
        const minutes = end - start;
        if (minutes < MIN_USEFUL_OVERLAP) continue;
        const count = Math.min(rowGap(source), Math.abs(rowGap(target)));
        if (count <= 0) continue;
        out.push({
          fromShift,
          toShift,
          count,
          fromSurplus: rowGap(source),
          toGap: rowGap(target),
          severity: number(target?.severity),
          start: minuteLabel(start),
          end: minuteLabel(end),
          minutes,
        });
      }
    }
    return out.sort((a, b) =>
      b.severity - a.severity ||
      b.count - a.count ||
      b.minutes - a.minutes
    );
  }

  function transferProposal(option) {
    if (!option) return "";
    const count = Math.max(1, number(option.count, 1));
    const noun = count > 1 ? `${count} renforts` : "1 renfort";
    const action = count > 1 ? "peuvent être mobilisés" : "peut être mobilisé";
    const timing = option.minutes < 180 ? " ponctuellement" : "";
    return `Piste faisable sur les horaires : ${option.fromShift} a +${option.fromSurplus} et recouvre ${option.toShift} de ${option.start} à ${option.end}. ${noun} ${action} sur cette plage${timing}, après vérification terrain.`;
  }

  function opportunityContext(context = {}) {
    const fromShift = String(
      context.shift_code || context.shift || context.code || "",
    ).trim().toUpperCase();
    const toShift = String(
      context.suggested_to_shift ||
      context.destination_shift ||
      context.deficit_shift ||
      context.shortage_shift ||
      context.transfer_to_shift ||
      context.coverage_shift ||
      "",
    ).trim().toUpperCase();
    const from = SHIFT[fromShift];
    const to = SHIFT[toShift];
    if (!from || !to || fromShift === toShift) return false;
    return Math.min(from.end, to.end) - Math.max(from.start, to.start) >= MIN_USEFUL_OVERLAP;
  }

  function staffing(staff) {
    const summary = staff?.summary || {};
    const rows = rowsOf(staff);
    const known =
      Boolean(staff) &&
      staff?.available !== false &&
      (rows.length > 0 ||
        summary.planned != null ||
        summary.target != null ||
        summary.gap != null);

    if (!known) {
      return {
        ...statusMeta("unknown"),
        known: false,
        headline: "Pas assez de données",
        detail: "STIP ne peut pas comparer cette journée correctement.",
        reasons: [],
      };
    }

    const shiftRows = rows.filter((row) => row?.shift_code);
    const deficits = shiftRows
      .filter((row) => rowGap(row) < 0)
      .sort(
        (a, b) =>
          number(b?.severity) - number(a?.severity) ||
          rowGap(a) - rowGap(b),
      );
    const surplus = shiftRows
      .filter((row) => rowGap(row) > 0)
      .sort((a, b) => rowGap(b) - rowGap(a));

    const worstSeverity = Math.max(
      number(summary.worst_severity),
      0,
      ...rows.map((row) => number(row?.severity)),
    );

    const transfers = transferOptions(shiftRows);
    let level = deficits.some((row) => number(row?.severity) >= 4)
      ? "critical"
      : deficits.length
        ? "warning"
        : "ok";
    const meta = statusMeta(level);
    const totalGap =
      summary.gap != null
        ? number(summary.gap)
        : summary.planned != null && summary.target != null
          ? number(summary.planned) - number(summary.target)
          : null;

    if (!deficits.length) {
      return {
        ...meta,
        known: true,
        headline: "Rien ne coince côté effectif",
        detail:
          totalGap != null && totalGap > 0
            ? `Les créneaux suivis tiennent la référence, avec +${totalGap} de marge au total.`
            : "Les créneaux suivis sont au niveau attendu.",
        reasons: [],
        totalGap,
        transferOptions: transfers,
      };
    }

    const first = deficits[0];
    const gap = rowGap(first);
    const missing = Math.abs(gap);
    const label = shiftLabel(first.shift_code);
    const planned = first.planned_count;
    const target = first.target_count;
    const second = deficits[1];
    const bestSurplus = surplus[0];

    let headline =
      level === "critical"
        ? `Ça coince sur le ${label}`
        : `${label.charAt(0).toUpperCase() + label.slice(1)} fragile`;
    let detail =
      planned != null && target != null
        ? `${planned} prévus pour ${target} : il manque ${missing}.`
        : `Il manque ${missing} sur ce créneau par rapport à la référence.`;
    const specialCount = number(summary.special_count);

    if (totalGap != null && totalGap >= 0 && bestSurplus) {
      headline = `${label.charAt(0).toUpperCase() + label.slice(1)} fragile malgré un total correct`;
      detail = `Le total masque le déséquilibre : ${String(first.shift_code).toUpperCase()} est à ${gap}, pendant que ${String(bestSurplus.shift_code).toUpperCase()} a +${rowGap(bestSurplus)}.`;
    } else if (second) {
      detail += ` ${String(second.shift_code).toUpperCase()} est aussi à ${rowGap(second)}.`;
    }

    if (specialCount > 0)
      detail += ` ${specialCount} horaire${specialCount > 1 ? "s" : ""} spécifique${specialCount > 1 ? "s" : ""} reste${specialCount > 1 ? "nt" : ""} compté${specialCount > 1 ? "s" : ""} à part.`;

    const reasons = deficits.slice(0, 3).map((row) => ({
        shift: String(row.shift_code || "").toUpperCase(),
        gap: rowGap(row),
        severity: number(row.severity),
        planned: row.planned_count,
        target: row.target_count,
      }));
    const bestTransfer = transfers[0] || null;
    const proposal = transferProposal(bestTransfer);

    return {
      ...meta,
      known: true,
      headline,
      detail,
      reasons,
      proposal,
      totalGap,
      specialCount,
      transferOptions: transfers,
    };
  }

  function shiftStatus(staff, code) {
    const base = String(code || "").trim().toUpperCase();
    const rows = rowsOf(staff);
    const row = rows.find(
      (item) => String(item?.shift_code || item?.shift || item?.code || "").trim().toUpperCase() === base,
    );
    if (!staff || staff?.available === false || !row)
      return { ...statusMeta("unknown"), symbol: "○", gap: null, detail: "", proposal: "" };

    const severity = number(row?.severity);
    const gap = rowGap(row);
    const planned = row?.planned_count;
    const target = row?.target_count;
    const support = transferOptions(rows).find((item) => item.toShift === base);
    const donor = transferOptions(rows).find((item) => item.fromShift === base);

    if (severity >= 4 || gap < 0) {
      const level = severity >= 4 ? "critical" : "warning";
      const missing = Math.abs(gap);
      const detail =
        planned != null && target != null
          ? `${planned} prévus pour ${target} : il manque ${missing}.`
          : `Il manque ${missing} par rapport à la référence.`;
      return {
        ...statusMeta(level),
        gap,
        planned,
        target,
        detail,
        proposal: support ? transferProposal(support) : "",
        support: support || null,
      };
    }

    if (severity >= 2) {
      return {
        ...statusMeta("warning"),
        gap,
        planned,
        target,
        detail: "Ce créneau demande une vigilance particulière.",
        proposal: "",
      };
    }

    if (gap > 0 && donor) {
      return {
        ...statusMeta("opportunity"),
        gap,
        planned,
        target,
        detail: `${base} a +${gap} de marge et recouvre ${donor.toShift} de ${donor.start} à ${donor.end}.`,
        proposal: transferProposal(donor),
        transfer: donor,
      };
    }

    return {
      ...statusMeta("ok"),
      gap,
      planned,
      target,
      detail:
        planned != null && target != null
          ? `${planned} prévus pour ${target} : niveau attendu.`
          : "",
      proposal: "",
    };
  }

  function contextGap(item) {
    const context = item?.context || {};
    const raw = context.gap ?? context.gap_total;
    return raw == null || !Number.isFinite(Number(raw)) ? null : Number(raw);
  }

  function isMeaningful(item) {
    if (!item) return false;
    const severity = number(item.severity);
    const kind = String(item.kind || "").toLowerCase();
    const family = String(item.source_family || "").toLowerCase();
    const gap = contextGap(item);
    if (severity >= 2) return true;
    if (number(item.priority) >= 60) return true;
    if (["warning", "anticipation", "opportunity", "proposal"].includes(kind))
      return true;
    if (family === "strategy") return true;
    if (gap != null && gap < 0) return true;
    return false;
  }

  function terrainItem(item) {
    const context = item?.context || {};
    const family = String(item?.source_family || "").toLowerCase();
    const gap = contextGap(item);
    const shift = String(
      context.shift_code || context.shift || context.code || "",
    )
      .trim()
      .toUpperCase();
    const planned = context.planned_count ?? context.planned_total;
    const target = context.target_count ?? context.target_total;
    const severity = number(item?.severity);
    const level = levelFromSeverity(severity);

    if ((family === "staffing" || family === "compound") && gap != null) {
      if (gap < 0) {
        const missing = Math.abs(gap);
        const where = shift ? ` sur ${shiftLabel(shift)}` : "";
        return {
          level,
          headline:
            severity >= 4
              ? `Ça coince${where}`
              : `${shift ? shiftLabel(shift).replace(/^./, (c) => c.toUpperCase()) : "Journée"} fragile`,
          detail:
            planned != null && target != null
              ? `${planned} prévus pour ${target} : il manque ${missing}.`
              : `Il manque ${missing} par rapport à la référence.`,
          proposal: String(item?.recommendation_text || "").trim(),
          source: item,
        };
      }
      if (gap > 0 && opportunityContext(context)) {
        return {
          level: "opportunity",
          headline: "Marge utile disponible",
          detail: `+${gap} par rapport à la référence sur ce créneau.`,
          proposal: String(item?.recommendation_text || "").trim(),
          source: item,
        };
      }
      return {
        level: "ok",
        headline: "Rien ne coince côté effectif",
        detail: "",
        proposal: "",
        source: item,
      };
    }

    return {
      level,
      headline: String(item?.title || "Point à regarder").trim(),
      detail: String(item?.body || "").trim(),
      proposal: String(item?.recommendation_text || "").trim(),
      source: item,
    };
  }

  function meaningfulItems(items) {
    return (Array.isArray(items) ? items : [])
      .filter(isMeaningful)
      .slice()
      .sort(
        (a, b) =>
          number(b?.severity) - number(a?.severity) ||
          number(b?.priority) - number(a?.priority),
      );
  }

  function dayStatus({ staffing: staff = null, items = [], alerts = [] } = {}) {
    const staffRead = staffing(staff);
    const all = [...(items || []), ...(alerts || [])].filter(Boolean);
    const worst = Math.max(0, ...all.map((item) => number(item.severity)));

    let level = "unknown";
    if (staffRead.known) level = staffRead.level;
    if (worst >= 4) level = "critical";
    else if (worst >= 2 && level !== "critical") level = "warning";
    else if (level === "unknown" && meaningfulItems(all).length) level = "warning";

    const reasons = meaningfulItems(all).slice(0, 3).map(terrainItem);
    if (
      staffRead.known &&
      staffRead.level !== "ok" &&
      !reasons.some((reason) => reason.headline === staffRead.headline)
    ) {
      reasons.unshift({
        level: staffRead.level,
        headline: staffRead.headline,
        detail: staffRead.detail,
        proposal: staffRead.proposal || "",
      });
    }

    return {
      ...statusMeta(level),
      known: level !== "unknown",
      reasons: reasons.slice(0, 3),
      staffing: staffRead,
    };
  }

  function dayChecklist({ staffing: staff = null, items = [], alerts = [] } = {}) {
    const rows = rowsOf(staff).filter((row) => row?.shift_code);
    const staffRead = staffing(staff);
    const all = [...(items || []), ...(alerts || [])].filter(Boolean);
    const points = [];
    const seen = new Set();

    const push = (point) => {
      const key = [point.level, point.title, point.detail].join("|");
      if (!point.title || seen.has(key)) return;
      seen.add(key);
      points.push(point);
    };

    rows.forEach((row) => {
      const code = String(row.shift_code || "").trim().toUpperCase();
      const status = shiftStatus(staff, code);
      if (!["critical", "warning", "opportunity"].includes(status.level)) return;
      push({
        level: status.level,
        symbol: status.symbol,
        title: `${code} · ${status.label}`,
        detail: status.detail || "",
        proposal: status.proposal || "",
        shift: code,
      });
    });

    const summary = staff?.summary || {};
    const totalGap =
      summary.gap != null
        ? number(summary.gap)
        : summary.planned != null && summary.target != null
          ? number(summary.planned) - number(summary.target)
          : null;
    if (staffRead.known && totalGap != null && totalGap < 0) {
      push({
        level: staffRead.level,
        symbol: staffRead.symbol,
        title: "Total de la journée",
        detail:
          summary.planned != null && summary.target != null
            ? `${summary.planned} prévus · cible ${summary.target} · écart ${totalGap}.`
            : `Écart global ${totalGap} par rapport à la référence.`,
        proposal: "",
        shift: "",
      });
    }

    if (number(staffRead.specialCount) > 0) {
      const n = number(staffRead.specialCount);
      push({
        level: "info",
        symbol: "•",
        title: "Horaires spécifiques",
        detail: `${n} horaire${n > 1 ? "s" : ""} spécifique${n > 1 ? "s" : ""} reste${n > 1 ? "nt" : ""} compté${n > 1 ? "s" : ""} à part.`,
        proposal: "",
        shift: "",
      });
    }

    meaningfulItems(all).forEach((item) => {
      const family = String(item?.source_family || "").toLowerCase();
      if (family === "staffing") return;
      const terrain = terrainItem(item);
      const shift = String(
        item?.context?.shift_code ||
        item?.context?.shift ||
        item?.context?.code ||
        "",
      ).trim().toUpperCase();
      push({
        level: terrain.level,
        symbol: statusMeta(terrain.level).symbol || "•",
        title: terrain.headline,
        detail: terrain.detail || "",
        proposal: terrain.proposal || "",
        shift,
      });
    });

    if (!points.length && staffRead.known) {
      push({
        level: "ok",
        symbol: "✔",
        title: "Effectif au niveau attendu",
        detail: staffRead.detail || "Aucun point prioritaire détecté.",
        proposal: "",
        shift: "",
      });
    }

    const critical = points.filter((p) => p.level === "critical");
    const warning = points.filter((p) => p.level === "warning");
    const opportunity = points.filter((p) => p.level === "opportunity");
    const proposals = [...critical, ...warning, ...opportunity]
      .map((p) => p.proposal)
      .filter(Boolean);

    let level = critical.length
      ? "critical"
      : warning.length
        ? "warning"
        : opportunity.length
          ? "opportunity"
          : staffRead.known
            ? "ok"
            : "unknown";
    let strength = "none";
    let advice = "Aucune modification particulière n’est recommandée.";

    if (critical.length) {
      strength = "strong";
      advice = proposals[0]
        ? `Conseil fort : traiter d’abord le ou les créneaux en manque. ${proposals[0]}`
        : "Conseil fort : traiter d’abord le ou les créneaux en manque réel avant les autres ajustements.";
    } else if (warning.length) {
      strength = "moderate";
      advice = proposals[0]
        ? `Conseil : un ajustement est utile. ${proposals[0]}`
        : "Conseil : surveiller ces écarts et ajuster l’organisation si le terrain se tend.";
    } else if (opportunity.length) {
      strength = "suggestion";
      advice = proposals[0]
        ? `Suggestion : la marge peut être utilisée utilement. ${proposals[0]}`
        : "Suggestion : une marge existe ; l’utiliser seulement si un besoin réel apparaît ailleurs.";
    } else if (!staffRead.known) {
      strength = "unknown";
      advice = "Pas assez de données pour recommander un ajustement fiable.";
    }

    return {
      ...statusMeta(level),
      level,
      strength,
      points,
      advice,
    };
  }

  function brief(items) {
    const rows = meaningfulItems(items);
    const terrain = rows.map(terrainItem);
    const critical = rows.filter((x) => number(x.severity) >= 4).length;
    const warning = rows.filter(
      (x) => number(x.severity) >= 2 && number(x.severity) < 4,
    ).length;
    const opportunity = rows.filter((x) =>
      ["opportunity", "proposal"].includes(String(x.kind || "").toLowerCase()),
    ).length;

    return {
      rows,
      terrain,
      critical,
      warning,
      opportunity,
      headline: terrain[0]?.headline || "Rien d’utile à signaler",
      meta: rows.length
        ? `${rows.length} point${rows.length > 1 ? "s" : ""} qui changent vraiment la lecture des prochains jours.`
        : "STIP n’a rien trouvé qui mérite de te faire perdre du temps.",
    };
  }

  window.STIPFieldIntel = {
    shiftLabel,
    levelFromSeverity,
    statusMeta,
    staffing,
    shiftStatus,
    transferOptions,
    isMeaningful,
    meaningfulItems,
    terrainItem,
    dayStatus,
    dayChecklist,
    brief,
  };
})();
