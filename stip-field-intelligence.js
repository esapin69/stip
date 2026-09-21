(() => {
  "use strict";

  const SHIFT = {
    M: "matin",
    J: "journée",
    J4: "J4",
    S: "soir",
    N: "nuit",
  };

  const number = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function shiftLabel(code) {
    const key = String(code || "").trim().toUpperCase();
    return SHIFT[key] || key || "créneau";
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

    let level = worstSeverity >= 4 ? "critical" : deficits.length ? "warning" : "ok";
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
    const guide = (summary.guide || []).find(
        (item) =>
          item &&
          (String(item.shift_code || "").toUpperCase() ===
            String(first.shift_code || "").toUpperCase() ||
            item.suggested_from_shift),
      ),
      specialCount = number(summary.special_count);

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
      })),
      proposal =
        guide?.suggested_from_shift && number(guide?.suggested_from_surplus) > 0
          ? `À regarder sur le terrain : ${String(guide.suggested_from_shift).toUpperCase()} a +${number(guide.suggested_from_surplus)} pendant que ${String(first.shift_code || "").toUpperCase()} est court.`
          : "";

    return {
      ...meta,
      known: true,
      headline,
      detail,
      reasons,
      proposal,
      totalGap,
      specialCount,
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
    isMeaningful,
    meaningfulItems,
    terrainItem,
    dayStatus,
    brief,
  };
})();
