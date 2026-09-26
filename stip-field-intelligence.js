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
      return { level, symbol: "✔", label: "Effectif prévu conforme" };
    return { level: "unknown", symbol: "", label: "Pas assez de données" };
  }

  function rowsOf(staff) {
    const rows = staff?.rows || staff?.shifts || [];
    return Array.isArray(rows) ? rows.filter(Boolean) : [];
  }

  function rowGap(row) {
    if (row?.gap != null && Number.isFinite(Number(row.gap)))
      return Number(row.gap);
    if (row?.planned_count == null || row?.target_count == null) return null;
    const planned = Number(row.planned_count);
    const target = Number(row.target_count);
    return Number.isFinite(planned) && Number.isFinite(target)
      ? planned - target
      : null;
  }

  function minuteLabel(value) {
    const minute = ((Number(value) % 1440) + 1440) % 1440;
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}h${String(minute % 60).padStart(2, "0")}`;
  }

  function transferOptions(rows) {
    const shiftRows = (Array.isArray(rows) ? rows : []).filter(
      (row) => row?.shift_code && rowGap(row) != null,
    );
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
        const fromSurplus = rowGap(source);
        const toGap = rowGap(target);
        if (fromSurplus == null || toGap == null) continue;
        const count = Math.min(fromSurplus, Math.abs(toGap));
        if (count <= 0) continue;
        const overlapStart = Math.max(fromMeta.start, toMeta.start);
        const overlapEnd = Math.min(fromMeta.end, toMeta.end);
        const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
        out.push({
          kind: "schedule_exchange",
          fromShift,
          toShift,
          count,
          fromSurplus,
          fromGapAfter: fromSurplus - count,
          toGap,
          toGapAfter: toGap + count,
          severity: number(target?.severity),
          overlapStart: overlapMinutes ? minuteLabel(overlapStart) : null,
          overlapEnd: overlapMinutes ? minuteLabel(overlapEnd) : null,
          overlapMinutes,
        });
      }
    }
    return out.sort(
      (a, b) =>
        b.severity - a.severity ||
        b.count - a.count ||
        b.fromSurplus - a.fromSurplus ||
        b.overlapMinutes - a.overlapMinutes,
    );
  }

  function recommendedTransfers(rows) {
    const options = transferOptions(rows).slice();
    const donorLeft = new Map();
    const targetLeft = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const code = String(row?.shift_code || "").trim().toUpperCase();
      const gap = rowGap(row);
      if (gap != null && gap > 0) donorLeft.set(code, gap);
      if (gap != null && gap < 0) targetLeft.set(code, Math.abs(gap));
    });
    const selected = [];
    for (const option of options) {
      const donor = number(donorLeft.get(option.fromShift));
      const need = number(targetLeft.get(option.toShift));
      const count = Math.min(number(option.count), donor, need);
      if (count <= 0) continue;
      selected.push({
        ...option,
        count,
        fromGapAfter: donor - count,
        toGapAfter: -need + count,
      });
      donorLeft.set(option.fromShift, donor - count);
      targetLeft.set(option.toShift, need - count);
    }
    return selected;
  }

  function transferProposal(option) {
    if (!option) return "";
    const count = Math.max(1, number(option.count, 1));
    const noun = count > 1 ? `${count} changements d’horaire` : "1 changement d’horaire";
    const donorAfter = number(option.fromGapAfter);
    const targetAfter = number(option.toGapAfter);
    const targetResult =
      targetAfter < 0
        ? `le déficit de ${option.toShift} resterait à ${targetAfter}`
        : targetAfter === 0
          ? `${option.toShift} atteindrait sa cible HCL`
          : `${option.toShift} passerait à +${targetAfter} au-dessus de sa cible HCL`;
    return `Piste d’échange à étudier : ${option.fromShift} dispose de +${option.fromSurplus} par rapport à sa cible HCL. ${noun} de ${option.fromShift} vers ${option.toShift} laisserait ${option.fromShift} à ${donorAfter >= 0 ? "+" + donorAfter : donorAfter} et ${targetResult}. À proposer seulement après vérification des contraintes individuelles et terrain.`;
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
    const incomplete =
      summary?.data_complete === false ||
      rows.some(
        (row) =>
          row?.status === "unknown" ||
          (row?.target_count != null && row?.planned_count == null),
      );
    const knownRows = rows.filter(
      (row) => row?.target_count != null && row?.planned_count != null,
    );
    const known =
      Boolean(staff) &&
      staff?.available !== false &&
      (knownRows.length > 0 ||
        (summary.planned != null && summary.target != null));

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

    const transferOptionsAll = transferOptions(shiftRows);
    const transfers = recommendedTransfers(shiftRows);
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
      if (incomplete) {
        return {
          ...statusMeta("unknown"),
          known: false,
          headline: "Lecture incomplète",
          detail: "La cible HCL est connue, mais au moins un effectif prévu manque dans le bloc Cumul par Horaire. STIP ne conclut pas à la place de la donnée source.",
          reasons: [],
          totalGap: null,
          transferOptions: [],
          recommendedTransfers: [],
        };
      }
      return {
        ...meta,
        known: true,
        headline: "Effectif prévu conforme",
        detail:
          totalGap != null && totalGap > 0
            ? `Les créneaux suivis tiennent leur cible HCL, avec +${totalGap} de marge au total.`
            : "Les créneaux suivis sont au niveau de leur cible HCL.",
        reasons: [],
        totalGap,
        transferOptions: transferOptionsAll,
        recommendedTransfers: transfers,
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
        : `Il manque ${missing} sur ce créneau par rapport à la cible HCL.`;
    const specialCount = number(summary.special_count);

    if (totalGap != null && totalGap >= 0 && bestSurplus) {
      headline = `${label.charAt(0).toUpperCase() + label.slice(1)} fragile malgré un total correct`;
      detail = `Le total masque le déséquilibre : ${String(first.shift_code).toUpperCase()} est à ${gap}, pendant que ${String(bestSurplus.shift_code).toUpperCase()} a +${rowGap(bestSurplus)}.`;
    } else if (second) {
      detail += ` ${String(second.shift_code).toUpperCase()} est aussi à ${rowGap(second)}.`;
    }

    if (specialCount > 0)
      detail += ` ${specialCount} horaire${specialCount > 1 ? "s" : ""} spécifique${specialCount > 1 ? "s" : ""} reste${specialCount > 1 ? "nt" : ""} compté${specialCount > 1 ? "s" : ""} à part.`;
    if (incomplete)
      detail += " Lecture partielle : au moins une valeur prévue manque dans le tableau source.";

    const reasons = deficits.slice(0, 3).map((row) => ({
        shift: String(row.shift_code || "").toUpperCase(),
        gap: rowGap(row),
        severity: number(row.severity),
        planned: row.planned_count,
        target: row.target_count,
      }));
    const bestTransfer = transfers[0] || null;
    const proposal = bestTransfer
      ? transferProposal(bestTransfer)
      : level === "critical"
        ? "Aucun autre créneau M/J/J4/S n’est au-dessus de sa cible HCL ce jour-là. Ne pas compter sur un simple échange interne : préparer en amont un renfort, un changement volontaire compatible ou une organisation dégradée validée par le chef."
        : "Aucune marge sûre n’est identifiée sur un autre créneau M/J/J4/S. Anticiper la solution avant le jour J plutôt que déplacer le sous-effectif.";

    return {
      ...meta,
      known: true,
      headline,
      detail,
      reasons,
      proposal,
      totalGap,
      specialCount,
      transferOptions: transferOptionsAll,
      recommendedTransfers: transfers,
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
    if (row?.status === "unknown" || row?.planned_count == null || row?.target_count == null)
      return {
        ...statusMeta("unknown"),
        symbol: "○",
        gap: null,
        planned: row?.planned_count ?? null,
        target: row?.target_count ?? null,
        detail: "Cible HCL connue mais effectif prévu indisponible dans le tableau source.",
        proposal: "",
      };

    const severity = number(row?.severity);
    const gap = rowGap(row);
    const planned = row?.planned_count;
    const target = row?.target_count;
    const allocated = recommendedTransfers(rows);
    const support = allocated.find((item) => item.toShift === base);
    const donor = allocated.find((item) => item.fromShift === base);

    if (severity >= 4 || gap < 0) {
      const level = severity >= 4 ? "critical" : "warning";
      const missing = Math.abs(gap);
      const detail =
        planned != null && target != null
          ? `${planned} prévus pour ${target} : il manque ${missing}.`
          : `Il manque ${missing} par rapport à la cible HCL.`;
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
              : `Il manque ${missing} par rapport à la cible HCL.`,
          proposal: String(item?.recommendation_text || "").trim(),
          source: item,
        };
      }
      if (gap > 0 && opportunityContext(context)) {
        return {
          level: "opportunity",
          headline: "Marge utile disponible",
          detail: `+${gap} par rapport à la cible HCL sur ce créneau.`,
          proposal: String(item?.recommendation_text || "").trim(),
          source: item,
        };
      }
      return {
        level: "ok",
        headline: "Effectif conforme",
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
            ? `${summary.planned} prévus · cible HCL ${summary.target} · écart ${totalGap}.`
            : `Écart global ${totalGap} par rapport à la cible HCL.`,
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
        title: "Effectif prévu au niveau attendu",
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
    recommendedTransfers,
    isMeaningful,
    meaningfulItems,
    terrainItem,
    dayStatus,
    dayChecklist,
    brief,
  };
})();
