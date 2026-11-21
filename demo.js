(() => {
  "use strict";

  // Démonstration 100 % locale. Aucun fetch, API, stockage ou service GHE.
  const $ = (id) => document.getElementById(id);
  const initial = [
    { id: 1, type: "spot", building: "Bâtiment A", floor: "Niveau 2", location: "près de l'ascenseur", minutes: 6 },
    { id: 2, type: "search", building: "Accueil central", floor: "RDC", location: "hall principal", minutes: 14 },
    { id: 3, type: "spot", building: "Bâtiment B", floor: "Niveau 1", location: "à côté de l'espace d'attente", minutes: 23 },
    { id: 4, type: "spot", building: "Bâtiment A", floor: "RDC", location: "près de l'accueil", minutes: 41 }
  ];
  let records = initial.map((item) => ({ ...item }));
  let nextId = 5;
  let currentView = "list";
  let timer = null;
  const views = { list: "Signalements", new: "Nouveau signalement", info: "À propos" };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function notify(message) {
    const toast = $("demo-toast");
    toast.textContent = message;
    toast.hidden = false;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { toast.hidden = true; }, 3300);
  }

  function switchView(view) {
    if (!Object.hasOwn(views, view)) return;
    currentView = view;
    for (const key of Object.keys(views)) {
      $("demo-panel-" + key).hidden = key !== view;
      const nav = $("demo-nav-" + key);
      if (key === view) nav.setAttribute("aria-current", "page");
      else nav.removeAttribute("aria-current");
    }
    $("demo-crumb").textContent = views[view];
    if (view === "list") render();
    if (view === "new") $("demo-type").focus();
  }

  function emptyState() {
    const box = el("div", "pr-demo-empty");
    box.append(
      el("strong", "", "Aucun signalement correspondant."),
      el("span", "", "Essayez un autre filtre ou créez un signalement fictif.")
    );
    return box;
  }

  function card(record) {
    const item = el("article", "pr-demo-item");
    item.dataset.type = record.type;
    const symbol = el("span", "pr-demo-item-icon", record.type === "spot" ? "♿" : "⌕");
    symbol.setAttribute("aria-hidden", "true");
    const body = el("div", "pr-demo-item-body");
    const line = el("div", "pr-demo-item-line");
    const title = el("h3", "", record.type === "spot" ? "Fauteuil disponible" : "Fauteuil recherché");
    const tag = el("span", "pr-demo-tag", record.type === "spot" ? "Disponible" : "Recherche");
    tag.dataset.type = record.type;
    line.append(title, tag);
    const address = el("p", "", "Hôpital Démo · " + record.building + " · " + record.floor + " · " + record.location);
    const date = el("small", "", record.minutes === 0 ? "À l'instant" : "Il y a " + record.minutes + " min");
    const actions = el("div", "pr-demo-item-actions");
    const action = el("button", "pr-demo-small-button", record.type === "spot" ? "Simuler la récupération ✓" : "Clôturer la recherche ✓");
    action.type = "button";
    action.addEventListener("click", () => {
      records = records.filter((entry) => entry.id !== record.id);
      render();
      notify(record.type === "spot" ? "Récupération simulée. Le signalement a été retiré." : "Recherche fictive clôturée.");
    });
    actions.append(action);
    body.append(line, address, date, actions);
    item.append(symbol, body);
    return item;
  }

  function render() {
    const q = $("demo-search").value.trim().toLocaleLowerCase("fr");
    const filter = $("demo-filter").value;
    const visible = records.filter((entry) => {
      if (filter !== "all" && entry.type !== filter) return false;
      const haystack = [entry.building, entry.floor, entry.location, entry.type].join(" ").toLocaleLowerCase("fr");
      return haystack.includes(q);
    });
    $("demo-stat-all").textContent = String(records.length);
    $("demo-stat-spot").textContent = String(records.filter((r) => r.type === "spot").length);
    $("demo-stat-search").textContent = String(records.filter((r) => r.type === "search").length);
    const list = $("demo-list");
    list.replaceChildren(...(visible.length ? visible.map(card) : [emptyState()]));
  }

  for (const button of document.querySelectorAll("[data-view]")) {
    button.addEventListener("click", () => switchView(button.dataset.view));
  }
  $("demo-add-top").addEventListener("click", () => switchView("new"));
  $("demo-go-list").addEventListener("click", () => switchView("list"));
  $("demo-search").addEventListener("input", render);
  $("demo-filter").addEventListener("change", render);
  $("demo-reset").addEventListener("click", () => {
    records = initial.map((item) => ({ ...item }));
    nextId = 5;
    $("demo-search").value = "";
    $("demo-filter").value = "all";
    render();
    notify("Données de démonstration réinitialisées.");
  });
  $("demo-create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const type = $("demo-type").value;
    if (type !== "spot" && type !== "search") return;
    const location = $("demo-location").value.trim().slice(0, 80);
    if (!location) { $("demo-location").focus(); return; }
    records.unshift({
      id: nextId++,
      type,
      building: $("demo-building").value,
      floor: $("demo-floor").value,
      location,
      minutes: 0
    });
    form.reset();
    $("demo-filter").value = "all";
    $("demo-search").value = "";
    switchView("list");
    notify(type === "spot" ? "Fauteuil fictif ajouté." : "Recherche fictive ajoutée.");
  });
  switchView("list");
})();