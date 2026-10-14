(() => {
  "use strict";

  const API = "https://api.open-meteo.com/v1/forecast";
  const GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
  const LOCATION_KEY = "ghe_meteo_location_v1";
  const CACHE_PREFIX = "ghe_meteo_forecast_v1_";
  const CACHE_MS = 15 * 60 * 1000;
  const STALE_MS = 36 * 60 * 60 * 1000;
  const LYON = { name: "Lyon", admin: "", country: "France", lat: 45.764, lon: 4.8357 };

  const $ = (id) => document.getElementById(id);
  const state = {
    location: readLocation(),
    payload: null,
    updated: 0,
    selected: null,
    loading: false,
    request: null,
    cityAbort: null,
    cityTimer: null,
    searchResults: []
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function numeric(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function round(value, digits = 0) {
    if (!numeric(value)) return "—";
    return new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: digits, minimumFractionDigits: digits
    }).format(value);
  }

  function temperature(value) {
    return numeric(value) ? round(value) + "°" : "—";
  }

  function rainfall(value) {
    return numeric(value) ? round(value, 1) + " mm" : "—";
  }

  function percent(value) {
    return numeric(value) ? round(value) + " %" : "—";
  }

  function forecastStatus(code) {
    if (code === 0) return ["Ensoleillé", "☀️"];
    if (code === 1) return ["Peu nuageux", "🌤️"];
    if (code === 2) return ["Éclaircies", "⛅"];
    if (code === 3) return ["Couvert", "☁️"];
    if (code === 45 || code === 48) return ["Brouillard", "🌫️"];
    if (code >= 51 && code <= 57) return ["Bruine", "🌦️"];
    if (code >= 61 && code <= 67) return ["Pluie", "🌧️"];
    if (code >= 71 && code <= 77) return ["Neige", "🌨️"];
    if (code >= 80 && code <= 82) return ["Averses", "🌧️"];
    if (code >= 85 && code <= 86) return ["Averses de neige", "🌨️"];
    if (code >= 95 && code <= 99) return ["Orages", "⛈️"];
    return ["Prévisions", "🌡️"];
  }

  function labelForDate(dateIso, index) {
    if (index === 0) return "Aujourd'hui";
    if (index === 1) return "Demain";
    const date = new Date(dateIso + "T12:00:00Z");
    const label = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "UTC", weekday: "long"
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function shortDate(dateIso) {
    const date = new Date(dateIso + "T12:00:00Z");
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "UTC", day: "numeric", month: "short"
    }).format(date);
  }

  function dateTimeLabel(date) {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short", timeStyle: "short"
    }).format(date);
  }

  function placeLabel(loc) {
    return [loc.name, loc.admin, loc.country].filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i).join(", ");
  }

  function readLocation() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCATION_KEY));
      if (raw && numeric(raw.lat) && numeric(raw.lon) &&
          Math.abs(raw.lat) <= 90 && Math.abs(raw.lon) <= 180 &&
          typeof raw.name === "string" && raw.name.length <= 100) {
        return raw;
      }
    } catch (_) {}
    return { ...LYON };
  }

  function persistLocation() {
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify(state.location)); } catch (_) {}
  }

  function cacheKey() {
    return CACHE_PREFIX + state.location.lat.toFixed(3) + "_" +
      state.location.lon.toFixed(3);
  }

  function matchesForecastDay(data) {
    try {
      if (!data || typeof data.timezone !== "string" ||
          !data.daily || !Array.isArray(data.daily.time)) return false;
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: data.timezone, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const value = (type) => parts.find((part) => part.type === type)?.value;
      return data.daily.time[0] === value("year") + "-" + value("month") + "-" + value("day");
    } catch (_) {
      return false;
    }
  }

  function loadCache() {
    try {
      const value = JSON.parse(localStorage.getItem(cacheKey()));
      if (!value || !numeric(value.at) || Date.now() - value.at > STALE_MS ||
          value.at > Date.now() + 60000 || !validPayload(value.data) ||
          !matchesForecastDay(value.data)) return null;
      return value;
    } catch (_) { return null; }
  }

  function saveCache(payload) {
    try {
      localStorage.setItem(cacheKey(), JSON.stringify({
        at: Date.now(), data: payload
      }));
    } catch (_) {}
  }

  function validPayload(data) {
    const day = data && data.daily;
    const hour = data && data.hourly;
    return !!(data && data.current && day &&
      Array.isArray(day.time) && day.time.length >= 16 &&
      Array.isArray(day.temperature_2m_max) && day.temperature_2m_max.length >= 16 &&
      Array.isArray(day.temperature_2m_min) && day.temperature_2m_min.length >= 16 &&
      Array.isArray(day.precipitation_probability_max) &&
      day.precipitation_probability_max.length >= 16 &&
      Array.isArray(day.rain_sum) && day.rain_sum.length >= 16 &&
      Array.isArray(day.weather_code) && day.weather_code.length >= 16 &&
      hour && Array.isArray(hour.time) && hour.time.length >= 16 &&
      Array.isArray(hour.temperature_2m) &&
      Array.isArray(hour.precipitation_probability) &&
      Array.isArray(hour.rain) && Array.isArray(hour.weather_code));
  }

  function setNotice(message, kind = "") {
    const el = $("notice");
    el.textContent = message;
    el.className = "notice" + (kind ? " is-" + kind : "");
  }

  function renderLocation() {
    $("place-name").textContent = placeLabel(state.location);
  }

  function renderNow() {
    const now = state.payload && state.payload.current;
    if (!now) return;
    const condition = forecastStatus(now.weather_code);
    const icon = now.is_day === 0 && now.weather_code === 0 ? "🌙" : condition[1];
    $("current-icon").textContent = icon;
    $("current-temp").textContent = temperature(now.temperature_2m);
    $("current-condition").textContent = condition[0];
    $("feels-like").textContent = temperature(now.apparent_temperature);
    $("current-wind").textContent = numeric(now.wind_speed_10m) ?
      round(now.wind_speed_10m) + " km/h" : "—";
    $("current-rain").textContent = rainfall(now.precipitation);
  }

  function renderDays() {
    const day = state.payload && state.payload.daily;
    if (!day) return;
    const grid = $("forecast-grid");
    const panel = $("detail-section");
    // Move the details outside the grid before replacing card markup.
    if (panel.parentElement === grid) grid.after(panel);
    grid.innerHTML = day.time.slice(0, 16).map((dateIso, i) => {
      const condition = forecastStatus(day.weather_code[i]);
      const selected = state.selected === i;
      return '<button class="day-card' + (selected ? ' is-active' : '') +
        '" type="button" data-index="' + i + '" aria-controls="detail-section" aria-expanded="' + selected +
        '" aria-label="' + esc(labelForDate(dateIso, i) + " " + shortDate(dateIso) +
        ", " + condition[0] + ", maximale " +
        temperature(day.temperature_2m_max[i]) + ", minimale " +
        temperature(day.temperature_2m_min[i]) + ", risque horaire maximal de précipitations " +
        percent(day.precipitation_probability_max[i]) + ", pluie prévue " +
        rainfall(day.rain_sum[i])) + '">' +
        '<span class="day-label">' + esc(labelForDate(dateIso, i)) + '</span>' +
        '<span class="day-date">' + esc(shortDate(dateIso)) + '</span>' +
        '<span class="day-icon" aria-hidden="true">' + condition[1] + '</span>' +
        '<span class="day-condition">' + esc(condition[0]) + '</span>' +
        '<span class="temperatures"><span class="temp-max">' +
        esc(temperature(day.temperature_2m_max[i])) +
        '</span><span class="temp-min">' +
        esc(temperature(day.temperature_2m_min[i])) + '</span></span>' +
        '<span class="card-separator"></span><span class="card-weather">' +
        '<span class="card-metric"><span class="metric-label">☂ Risque max.</span><strong>' +
        esc(percent(day.precipitation_probability_max[i])) + '</strong></span>' +
        '<span class="card-metric"><span class="metric-label">💧 Pluie prévue</span><strong class="rain-mm">' +
        esc(rainfall(day.rain_sum[i])) + '</strong></span></span>' +
        '<span class="card-cta">' + (selected ? "Masquer le détail ↑" : "Voir heure par heure ↓") + '</span></button>';
    }).join("");
    grid.setAttribute("aria-busy", "false");
    positionDetails();
  }

  function detailColumns() {
    // These match the three CSS grid breakpoints.
    if (window.matchMedia("(max-width: 650px)").matches) return 2;
    if (window.matchMedia("(max-width: 1020px)").matches) return 4;
    return 7;
  }

  function positionDetails() {
    const panel = $("detail-section");
    const grid = $("forecast-grid");
    if (state.selected === null) {
      panel.hidden = true;
      return;
    }
    const columns = detailColumns();
    const lastIndex = Math.min(
      Math.floor(state.selected / columns) * columns + columns - 1,
      15
    );
    const lastCard = grid.querySelector('button[data-index="' + lastIndex + '"]');
    if (lastCard) lastCard.after(panel);
  }

  function renderDetails() {
    const payload = state.payload;
    const section = $("detail-section");
    if (!payload || state.selected === null) {
      section.hidden = true;
      return;
    }
    const day = payload.daily;
    const idx = state.selected;
    const dayId = day.time[idx];
    $("details-title").textContent = labelForDate(dayId, idx) + " · " + shortDate(dayId);
    $("details-summary").textContent =
      "Pluie prévue : " + rainfall(day.rain_sum[idx]) +
      " · Risque maximal de précipitations sur une heure : " +
      percent(day.precipitation_probability_max[idx]) +
      ". Faites défiler les heures pour consulter les détails.";
    const hourly = payload.hourly;
    let cards = "";
    for (let i = 0; i < hourly.time.length; i++) {
      const timestamp = hourly.time[i];
      if (typeof timestamp !== "string" || !timestamp.startsWith(dayId + "T")) continue;
      const code = forecastStatus(hourly.weather_code[i]);
      const time = timestamp.split("T")[1].slice(0, 5);
      cards += '<div class="hour-card">' +
        '<span class="hour-time">' + esc(time) + '</span>' +
        '<span class="hour-icon" aria-hidden="true">' + code[1] + '</span>' +
        '<strong class="hour-temp">' + esc(temperature(hourly.temperature_2m[i])) + '</strong>' +
        '<span class="hour-risk">☂ ' + esc(percent(hourly.precipitation_probability[i])) + '</span>' +
        '<span class="hour-mm">💧 ' + esc(rainfall(hourly.rain[i])) + '</span></div>';
    }
    $("hourly-list").innerHTML = cards || '<p>Données horaires indisponibles pour ce jour.</p>';
    $("hourly-scroll").scrollLeft = 0;
    positionDetails();
    section.hidden = false;
  }

  function renderAll() {
    renderLocation();
    renderNow();
    renderDays();
    renderDetails();
    $("updated-at").textContent = state.updated ?
      "Actualisé le " + dateTimeLabel(new Date(state.updated)) : "Données non disponibles";
  }

  function buildForecastUrl() {
    const params = new URLSearchParams({
      latitude: String(state.location.lat),
      longitude: String(state.location.lon),
      timezone: "auto",
      forecast_days: "16",
      current: [
        "temperature_2m", "apparent_temperature", "weather_code",
        "is_day", "wind_speed_10m", "precipitation"
      ].join(","),
      daily: [
        "weather_code", "temperature_2m_max", "temperature_2m_min",
        "precipitation_probability_max", "rain_sum"
      ].join(","),
      hourly: [
        "temperature_2m", "precipitation_probability", "rain", "weather_code"
      ].join(",")
    });
    return API + "?" + params.toString();
  }

  async function updateForecast(force = false) {
    if (state.request) state.request.abort();
    const request = new AbortController();
    state.request = request;
    state.loading = true;
    $("refresh-btn").disabled = true;
    renderLocation();

    const cached = loadCache();
    if (cached) {
      state.payload = cached.data;
      state.updated = cached.at;
      renderAll();
      if (!force && Date.now() - cached.at < CACHE_MS) {
        state.loading = false;
        state.request = null;
        $("refresh-btn").disabled = false;
        $("data-state").textContent = "Données récentes en mémoire";
        setNotice("");
        return;
      }
      setNotice("Actualisation des prévisions en arrière-plan…");
    } else {
      state.payload = null;
      state.updated = 0;
      $("forecast-grid").innerHTML = '<p class="empty-state">Chargement des sept jours…</p>';
      $("forecast-grid").setAttribute("aria-busy", "true");
      $("detail-section").hidden = true;
      setNotice("Récupération des prévisions météorologiques…");
    }

    try {
      const response = await fetch(buildForecastUrl(), {
        signal: request.signal,
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error("Réponse du service météo : " + response.status);
      const data = await response.json();
      if (!validPayload(data)) throw new Error("Données météo incomplètes");
      if (state.request !== request) return;
      state.payload = data;
      state.updated = Date.now();
      saveCache(data);
      renderAll();
      $("data-state").textContent = "Prévision météo actualisée";
      setNotice("");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      if (state.request !== request) return;
      if (cached) {
        $("data-state").textContent = "Dernières prévisions enregistrées";
        setNotice("Service indisponible : les dernières prévisions enregistrées sont affichées (elles peuvent avoir changé).", "warn");
      } else {
        $("current-temp").textContent = "—°";
        $("current-condition").textContent = "Service indisponible";
        $("current-icon").textContent = "⛅";
        $("feels-like").textContent = "—";
        $("current-wind").textContent = "—";
        $("current-rain").textContent = "—";
        $("forecast-grid").innerHTML = '<p class="empty-state">Impossible de charger la météo. Utilisez « Actualiser » pour réessayer.</p>';
        $("forecast-grid").setAttribute("aria-busy", "false");
        $("data-state").textContent = "Connexion requise";
        setNotice("Impossible de récupérer les prévisions. Vérifiez votre connexion et réessayez.", "error");
      }
    } finally {
      if (state.request === request) {
        state.request = null;
        state.loading = false;
        $("refresh-btn").disabled = false;
      }
    }
  }

  function selectLocation(loc) {
    if (state.cityAbort) state.cityAbort.abort();
    state.location = loc;
    state.selected = null;
    persistLocation();
    $("city-input").value = "";
    $("city-results").replaceChildren();
    $("location-search").hidden = true;
    $("search-toggle").setAttribute("aria-expanded", "false");
    updateForecast();
  }

  function renderCities(cities) {
    const panel = $("city-results");
    panel.replaceChildren();
    state.searchResults = cities;
    if (!cities.length) {
      const info = document.createElement("p");
      info.className = "city-hint";
      info.textContent = "Aucune ville trouvée. Essayez un autre nom.";
      panel.appendChild(info);
      return;
    }
    cities.forEach((city) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "city-option";
      button.textContent = placeLabel(city);
      button.addEventListener("click", () => selectLocation(city));
      panel.appendChild(button);
    });
  }

  async function searchCity(search) {
    if (state.cityAbort) state.cityAbort.abort();
    state.cityAbort = new AbortController();
    const controller = state.cityAbort;
    $("city-results").textContent = "Recherche…";
    try {
      const url = GEOCODING + "?" + new URLSearchParams({
        name: search, count: "7", language: "fr", format: "json"
      }).toString();
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Recherche impossible");
      const data = await response.json();
      if (state.cityAbort !== controller) return;
      renderCities((Array.isArray(data.results) ? data.results : []).filter((item) =>
        numeric(item.latitude) && numeric(item.longitude)
      ).map((item) => ({
        name: item.name || "Localité",
        admin: item.admin1 || "",
        country: item.country || "",
        lat: item.latitude,
        lon: item.longitude
      })));
    } catch (err) {
      if (err && err.name === "AbortError") return;
      if (state.cityAbort === controller) $("city-results").textContent = "Recherche indisponible. Réessayez.";
    }
  }

  $("forecast-grid").addEventListener("click", (event) => {
    const card = event.target.closest("button[data-index]");
    if (!card || !state.payload) return;
    const index = Number(card.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index > 15) return;
    state.selected = state.selected === index ? null : index;
    renderDays();
    renderDetails();
    if (state.selected !== null) {
      // The panel is now directly under the selected row, never at the page bottom.
      $("detail-section").scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant" : "smooth",
        block: "nearest"
      });
    }
    $("forecast-grid").querySelector('button[data-index="' + index + '"]')?.focus({
      preventScroll: true
    });
  });

  $("close-detail").addEventListener("click", () => {
    const previous = state.selected;
    state.selected = null;
    renderDays();
    renderDetails();
    if (previous !== null) {
      $("forecast-grid").querySelector('[data-index="' + previous + '"]')?.focus({
        preventScroll: true
      });
    }
  });

  $("refresh-btn").addEventListener("click", () => updateForecast(true));

  $("search-toggle").addEventListener("click", () => {
    const showing = $("location-search").hidden;
    $("location-search").hidden = !showing;
    $("search-toggle").setAttribute("aria-expanded", String(showing));
    if (showing) $("city-input").focus();
  });

  $("city-input").addEventListener("input", () => {
    clearTimeout(state.cityTimer);
    if (state.cityAbort) state.cityAbort.abort();
    const query = $("city-input").value.trim();
    if (query.length < 2) {
      $("city-results").textContent = query ? "Saisissez au moins deux caractères." : "";
      return;
    }
    state.cityTimer = setTimeout(() => searchCity(query), 420);
  });

  $("location-search").addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = state.searchResults[0];
    if (selected) selectLocation(selected);
    else {
      const query = $("city-input").value.trim();
      if (query.length >= 2) searchCity(query);
    }
  });

  $("locate-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      setNotice("La localisation n'est pas disponible sur cet appareil. Choisissez une ville.", "warn");
      return;
    }
    const button = $("locate-btn");
    button.disabled = true;
    setNotice("Recherche de votre position avec votre autorisation…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        button.disabled = false;
        selectLocation({
          name: "Ma position", admin: "", country: "",
          lat: position.coords.latitude, lon: position.coords.longitude
        });
      },
      () => {
        button.disabled = false;
        setNotice("Localisation refusée ou indisponible. Vous pouvez rechercher une ville.", "warn");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.selected !== null) positionDetails();
    }, 130);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !state.loading &&
        (!state.updated || Date.now() - state.updated > CACHE_MS)) {
      updateForecast();
    }
  });

  renderLocation();
  updateForecast();
})();