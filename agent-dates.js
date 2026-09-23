(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-dates",
    STORE = "stip_session_v1",
    CACHE = "stip_agent_dates_cache_v2",
    $ = (s) => document.querySelector(s),
    all = (s) => [...document.querySelectorAll(s)];
  const navigationState = window.STIPNav?.read?.() || {};
  let items = [],
    active = ["all", "medical", "intern", "training"].includes(
      navigationState.filter,
    )
      ? navigationState.filter
      : "all",
    query = navigationState.search || "",
    focus = "",
    scopeDate = "",
    refreshing = false;
  const esc = (v) =>
    String(v ?? "").replace(
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
  async function post(url, action, body = {}, timeout = 14000) {
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await fetch(url, {
          method: "POST",
          cache: "no-store",
          signal: c.signal,
          headers: {
            "content-type": "application/json",
            "x-stip-session": localStorage.getItem(STORE) || "",
          },
          body: JSON.stringify({ action, ...body }),
        }),
        j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) {
        const e = Error(j.error || "Erreur " + r.status);
        e.status = r.status;
        throw e;
      }
      return j;
    } catch (e) {
      if (e?.name === "AbortError")
        throw Error("Le chargement prend trop de temps. Nouvelle tentative…");
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
  function cached() {
    try {
      const x = JSON.parse(localStorage.getItem(CACHE) || "null");
      if (
        !x ||
        !Array.isArray(x.items) ||
        Date.now() - Number(x.saved_at || 0) > 21600000
      )
        return null;
      return x;
    } catch {
      return null;
    }
  }
  function saveCache(r) {
    try {
      localStorage.setItem(
        CACHE,
        JSON.stringify({
          saved_at: Date.now(),
          generated_at: r.generated_at || "",
          items: r.items || [],
        }),
      );
    } catch {}
  }
  function dobj(v) {
    return new Date(String(v).slice(0, 10) + "T12:00:00");
  }
  function iso(x) {
    const z = new Date(x);
    z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
    return z.toISOString().slice(0, 10);
  }
  function today() {
    return iso(new Date());
  }
  function monday() {
    const x = dobj(today()),
      n = x.getDay() || 7;
    x.setDate(x.getDate() - (n - 1));
    return x;
  }
  function label(k) {
    return (
      {
        medical: "Visite médicale",
        intern: "Stagiaire",
        training: "Formation",
      }[k] || "Événement"
    );
  }
  function icon(k) {
    return { medical: "🩺", intern: "👶", training: "🎓" }[k] || "📌";
  }
  function filtered() {
    let a =
      active === "all" ? items : items.filter((x) => x.category === active);
    if (scopeDate) a = a.filter((x) => String(x.date).slice(0, 10) === scopeDate);
    if (query) {
      const q = query.toLocaleLowerCase("fr-FR");
      a = a.filter((x) =>
        [
          x.person_name,
          x.title,
          x.location,
          x.time,
          x.meta?.referent,
          label(x.category),
        ]
          .join(" ")
          .toLocaleLowerCase("fr-FR")
          .includes(q),
      );
    }
    return a;
  }
  function counts() {
    const src =
        active === "all" ? items : items.filter((x) => x.category === active),
      m = today().slice(0, 7),
      start = monday(),
      end = new Date(start);
    end.setDate(end.getDate() + 6);
    $("#daUpcoming").textContent = scopeDate
      ? filtered().length + " ce jour"
      : src.length + " à venir";
    $("#daWeekCount").textContent = src.filter((x) => {
      const y = dobj(x.date);
      return y >= start && y <= end;
    }).length;
    $("#daMonthCount").textContent = src.filter(
      (x) => String(x.date).slice(0, 7) === m,
    ).length;
  }
  function renderList() {
    const a = filtered()
        .slice()
        .sort(
          (a, b) =>
            String(a.date).localeCompare(String(b.date)) ||
            String(a.time || "99:99").localeCompare(String(b.time || "99:99")) ||
            String(a.person_name || "").localeCompare(
              String(b.person_name || ""),
              "fr",
            ),
        ),
      months = new Map();
    a.forEach((x) => {
      const k = String(x.date).slice(0, 7);
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(x);
    });
    if (!a.length) {
      $("#daList").innerHTML =
        '<div class="da-empty">Aucune date à afficher avec ce filtre.</div>';
      return;
    }
    let out = "";
    for (const monthItems of months.values()) {
      const days = new Map();
      monthItems.forEach((x) => {
        const k = String(x.date).slice(0, 10);
        if (!days.has(k)) days.set(k, []);
        days.get(k).push(x);
      });
      out +=
        '<section class="da-month"><div class="stip-section-separator is-compact"><span>' +
        esc(
          dobj(monthItems[0].date).toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          }),
        ) +
        '</span></div><div class="da-month-days">';
      for (const [dayIso, dayItems] of days) {
        const d = dobj(dayIso),
          dayLabel = d.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
        out +=
          '<section class="da-day-group"><div class="stip-section-separator da-day-separator"><span>' +
          esc(dayLabel) +
          '</span></div><div class="da-day-events">';
        for (const x of dayItems) {
          const sourceFocus = focus ? focus.split(":").pop() : "",
            foc = !!focus && (x.id === focus || x.source_id === sourceFocus),
            referent =
              x.category === "intern" && x.meta?.referent
                ? String(x.meta.referent).trim()
                : "",
            sub = referent ? "" : x.location || x.title || "";
          out +=
            '<button class="da-item da-item-event ' +
            (foc ? "focus" : "") +
            '" data-id="' +
            esc(x.id) +
            '"><span class="da-icon ' +
            esc(x.category) +
            '">' +
            icon(x.category) +
            '</span><span class="da-copy"><span class="da-top"><strong>' +
            esc(x.person_name) +
            '</strong><span class="da-tag ' +
            esc(x.category) +
            '">' +
            esc(label(x.category)) +
            "</span></span><p>" +
            esc(x.time || x.title || "") +
            "</p>" +
            (referent
              ? '<span class="da-referent"><em>Référent</em><b>' +
                esc(referent) +
                "</b></span>"
              : "") +
            (sub ? "<small>" + esc(sub) + "</small>" : "") +
            '</span><span class="da-chev">›</span></button>';
        }
        out += "</div></section>";
      }
      out += "</div></section>";
    }
    $("#daList").innerHTML = out;
    all("[data-id]").forEach(
      (b) => (b.onclick = () => openDetail(b.dataset.id)),
    );
    if (focus)
      requestAnimationFrame(() =>
        document
          .querySelector(".da-item.focus")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
  }
  function renderScope() {
    const box = $("#daScope"),
      txt = $("#daScopeText");
    if (!box || !txt) return;
    box.hidden = !scopeDate;
    if (!scopeDate) return;
    txt.textContent = dobj(scopeDate).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function render() {
    counts();
    renderScope();
    renderList();
    $("[data-filter]").forEach((b) =>
      b.classList.toggle("active", b.dataset.filter === active),
    );
  }
  function openDetail(id) {
    const x = items.find((v) => v.id === id);
    if (!x) return;
    const type =
      x.category === "intern"
        ? "intern"
        : x.category === "training"
          ? "training"
          : x.category === "medical"
            ? "medical"
            : "other";
    const url =
      "agent-date-detail.html?type=" +
      encodeURIComponent(type) +
      "&source=" +
      encodeURIComponent(x.source_id) +
      "&from=" +
      encodeURIComponent(active);
    if (window.STIPNav) window.STIPNav.go(url);
    else location.href = url;
  }
  function closeSheet() {
    const s = $("#daSheet");
    s.classList.remove("open");
    s.setAttribute("aria-hidden", "true");
  }
  async function load() {
    if (refreshing) return;
    refreshing = true;
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await post(API, "list", {}, attempt ? 20000 : 12000);
        items = r.items || [];
        saveCache(r);
        render();
        refreshing = false;
        return;
      } catch (e) {
        last = e;
        if (e?.status === 401 || e?.status === 403) {
          location.replace("index.html");
          return;
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 350));
      }
    }
    refreshing = false;
    if (!items.length)
      $("#daList").innerHTML =
        '<div class="da-empty">' +
        esc(last?.message || "Chargement impossible.") +
        '<br><button type="button" id="daRetry">Réessayer</button></div>';
    $("#daRetry")?.addEventListener("click", () => load());
  }
  async function init() {
    if (!localStorage.getItem(STORE)) {
      location.replace("index.html");
      return;
    }
    const p = new URLSearchParams(location.search),
      f = p.get("filter"),
      requestedDate = String(p.get("date") || "").slice(0, 10);
    if (["all", "medical", "intern", "training"].includes(f)) active = f;
    if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) scopeDate = requestedDate;
    focus = p.get("focus") || "";
    if (
      !f &&
      ["all", "medical", "intern", "training"].includes(navigationState.filter)
    )
      active = navigationState.filter;
    query = navigationState.search || "";
    $("#daSearch").value = query;
    $("#daSearchWrap").hidden = !navigationState.searchOpen;
    $("#daSearchBtn").onclick = () => {
      const w = $("#daSearchWrap");
      w.hidden = !w.hidden;
      window.STIPNav?.remember?.({ searchOpen: !w.hidden });
      if (!w.hidden) setTimeout(() => $("#daSearch").focus(), 10);
    };
    $("#daSearch").oninput = (e) => {
      query = e.target.value.trim();
      window.STIPNav?.remember?.({ search: query, searchOpen: true });
      renderList();
    };
    $("#daClear").onclick = () => {
      $("#daSearch").value = "";
      query = "";
      window.STIPNav?.remember?.({ search: "" });
      renderList();
    };
    $("#daScopeClear").onclick = () => {
      scopeDate = "";
      const next = new URL(location.href);
      next.searchParams.delete("date");
      history.replaceState(history.state, "", next.pathname + next.search + next.hash);
      render();
    };
    all("[data-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          active = b.dataset.filter;
          focus = "";
          window.STIPNav?.remember?.({ filter: active });
          render();
        }),
    );
    $("#daSheetClose").onclick = closeSheet;
    $("#daSheet").onclick = (e) => {
      if (e.target.id === "daSheet") closeSheet();
    };
    const c = cached();
    if (c?.items?.length) {
      items = c.items;
      render();
    }
    window.STIPNav?.register?.({
      capture: () => ({
        filter: active,
        date: scopeDate,
        search: query,
        searchOpen: !$("#daSearchWrap").hidden,
      }),
    });
    load().finally(() => window.STIPNav?.restoreScroll?.());
  }
  init();
})();
