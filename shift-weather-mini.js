(() => {
  "use strict";

  // Public weather data only: fixed hospital-area location (Lyon).
  // No GHE schedule, identity, access code or other private data is sent to the provider.
  const LOCATION = Object.freeze({ latitude: 45.764, longitude: 4.8357 });
  const API = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "stip_shift_weather_lyon_visual_v3";
  const SHARED_CACHE_KEY = "ghe_meteo_forecast_v1_45.764_4.836";
  const CACHE_TTL = 20 * 60 * 1000;
  const MAX_DAYS = 16;
  let inMemory = null;
  let inFlight = null;

  function todayInParis() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const p = (type) => parts.find(x => x.type === type)?.value || "";
    return p("year") + "-" + p("month") + "-" + p("day");
  }

  function nextDate(iso) {
    const d = new Date(iso + "T12:00:00Z");
    if (!Number.isFinite(d.getTime())) return "";
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function daysFromToday(iso) {
    return Math.round((Date.parse(iso + "T12:00:00Z") -
      Date.parse(todayInParis() + "T12:00:00Z")) / 86400000);
  }

  function validate(data) {
    const h = data?.hourly;
    if (!h || !Array.isArray(h.time) || !Array.isArray(h.temperature_2m) ||
        !Array.isArray(h.precipitation_probability) ||
        h.time.length < 24 || h.time.length !== h.temperature_2m.length ||
        h.time.length !== h.precipitation_probability.length ||
        typeof h.time[0] !== "string" ||
        h.time[0].slice(0, 10) !== todayInParis()) return false;
    return true;
  }

  function rich(data) {
    const h=data?.hourly;
    return validate(data)&&Array.isArray(h.precipitation)&&
      Array.isArray(h.weather_code)&&Array.isArray(h.cloud_cover)&&
      [h.precipitation,h.weather_code,h.cloud_cover].every(v=>v.length===h.time.length);
  }

  function readStored(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (!saved || !Number.isFinite(saved.at) ||
          saved.at > Date.now() + 60000 ||
          Date.now() - saved.at >= CACHE_TTL || !validate(saved.data)) return null;
      return saved.data;
    } catch (_) {
      return null;
    }
  }

  function writeStored(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); }
    catch (_) {}
  }

  async function getForecast() {
    if (inMemory && Date.now() - inMemory.at < CACHE_TTL &&
        validate(inMemory.data)) return inMemory.data;
    const stored = readStored(CACHE_KEY);
    if (stored && rich(stored)) {
      inMemory = { data: stored, at: Date.now() };
      return stored;
    }
    // Ancien cache compatible pour les chiffres, mais insuffisant pour représenter le ciel.
    const fallback = readStored(SHARED_CACHE_KEY) || stored;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const parameters = new URLSearchParams({
        latitude: String(LOCATION.latitude),
        longitude: String(LOCATION.longitude),
        timezone: "Europe/Paris",
        forecast_days: String(MAX_DAYS),
        hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,cloud_cover",
        current: "precipitation,weather_code,cloud_cover"
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(API + "?" + parameters.toString(), {
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Forecast unavailable");
        const data = await response.json();
        if (!rich(data)) throw new Error("Incomplete hourly weather details");
        inMemory = { data, at: Date.now() };
        writeStored(data);
        return data;
      } finally {
        clearTimeout(timer);
      }
    })().catch(error => {
      if (fallback) return fallback; // Garder les températures déjà disponibles, jamais inventer un ciel.
      throw error;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  function parseHour(value) {
    const m = String(value || "").match(/^(\d{1,2})(?::|h)(\d{2})$/i);
    if (!m) return null;
    const hours = Number(m[1]), minutes = Number(m[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
  }

  function validShift(date, start, end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
    const startMinute = parseHour(start), endMinute = parseHour(end);
    if (startMinute === null || endMinute === null ||
        startMinute === endMinute) return null;
    const offset = daysFromToday(date);
    if (!Number.isFinite(offset) || offset < 0 || offset >= MAX_DAYS) return null;
    const overnight = endMinute < startMinute;
    if (overnight && offset >= MAX_DAYS - 1) return null;
    const next = nextDate(date);
    return {
      first: date + "T" + String(Math.floor(startMinute / 60)).padStart(2, "0") + ":00",
      last: (overnight ? next : date) + "T" +
        String(Math.floor(endMinute / 60)).padStart(2, "0") + ":00",
      // Partial final hour overlaps work; include that hourly bucket.
      lastHasPartialHour: endMinute % 60 !== 0,
      overnight,
      startText: String(Math.floor(startMinute / 60)).padStart(2, "0") + "h" +
        String(startMinute % 60).padStart(2, "0"),
      endText: String(Math.floor(endMinute / 60)).padStart(2, "0") + "h" +
        String(endMinute % 60).padStart(2, "0")
    };
  }

  // Forecasts are hourly. Interpolate the value at the service's exact minute
  // instead of reporting min/max during the entire day or shift.
  function temperatureAt(hourly, iso) {
    const hour = iso.slice(0, 13) + ":00";
    const index = hourly.time.indexOf(hour);
    if (index < 0 || !Number.isFinite(hourly.temperature_2m[index])) return null;
    const minutes = Number(iso.slice(14, 16));
    const start = hourly.temperature_2m[index];
    if (minutes === 0) return Math.round(start);
    const next = hourly.time[index + 1];
    const expected = new Date(Date.parse(hour + ":00Z") + 3600000)
      .toISOString().slice(0, 16);
    if (next !== expected || !Number.isFinite(hourly.temperature_2m[index + 1])) return null;
    return Math.round(start + (hourly.temperature_2m[index + 1] - start) * minutes / 60);
  }

  function weatherKind(code, cloud) {
    if (!Number.isFinite(code)) return "unknown";
    if (code >= 95) return "storm";
    if (code >= 71 && code <= 77 || code >= 85 && code <= 86) return "snow";
    if ([65, 67, 82].includes(code)) return "heavy-rain";
    if (code >= 61 && code <= 67 || code >= 80 && code <= 82) return "rain";
    if (code >= 51 && code <= 57) return "drizzle";
    if (code >= 45 && code <= 48) return "fog";
    if (code === 3 || Number.isFinite(cloud) && cloud > 78) return "cloudy";
    if (code === 1 || code === 2 || Number.isFinite(cloud) && cloud > 28) return "partly";
    if (code === 0) return "sunny";
    return "unknown";
  }

  const LABELS = Object.freeze({
    sunny: "Ensoleillé", partly: "Éclaircies", cloudy: "Nuageux",
    fog: "Brouillard", drizzle: "Pluie faible", rain: "Pluie",
    "heavy-rain": "Pluie forte", storm: "Orage", snow: "Neige",
    mixed: "Temps variable", unknown: "Prévisions indisponibles"
  });

  function calculate(data, shift) {
    const h = data.hourly;
    const startIso = shift.first.slice(0, 11) + shift.startText.replace("h", ":");
    const endIso = shift.last.slice(0, 11) + shift.endText.replace("h", ":");
    const startTemp = temperatureAt(h, startIso);
    const endTemp = temperatureAt(h, endIso);
    if (startTemp === null || endTemp === null) return null;
    const start = Date.parse(startIso + ":00Z");
    const end = Date.parse(endIso + ":00Z");
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

    // Weight each hourly forecast by its actual overlap with the shift.
    // A single misty hour can no longer label eight hours as "fog".
    const weights = new Map();
    let maxRisk = null, total = 0;
    for (let i = 0; i < h.time.length; i++) {
      const ts = h.time[i];
      if (typeof ts !== "string") continue;
      const bucket = Date.parse(ts + ":00Z");
      if (!Number.isFinite(bucket) || bucket >= end || bucket + 3600000 <= start) continue;
      const minutes = Math.max(0, Math.min(end, bucket + 3600000) -
        Math.max(start, bucket)) / 60000;
      if (!minutes) continue;
      const risk = h.precipitation_probability[i];
      if (Number.isFinite(risk)) maxRisk = Math.max(maxRisk ?? 0, risk);
      const sky = weatherKind(h.weather_code?.[i], h.cloud_cover?.[i]);
      if (sky !== "unknown") {
        weights.set(sky, (weights.get(sky) || 0) + minutes);
        total += minutes;
      }
    }
    const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
    let sky = "unknown";
    if (ranked.length) {
      sky = ranked[0][0];
      if (ranked.length > 1 && ranked[0][1] / total < 0.55) {
        const fairSkies = ranked.every(([kind]) => ["sunny", "partly", "cloudy"].includes(kind));
        sky = fairSkies ? "partly" : "mixed";
      }
    }
    const description = LABELS[sky];
    const thermal = Math.max(startTemp, endTemp) >= 28 ? "hot" :
      Math.min(startTemp, endTemp) <= 5 ? "cold" : "mild";
    return {startTemp, endTemp, risk:maxRisk == null ? null : Math.round(maxRisk),
      sky, description, thermal};
  }

  function show(host, values, shift, options = {}) {
    if (!host?.isConnected) return;
    const scene = host.closest?.(".thf-weather-sky");
    if (scene) {
      scene.dataset.sky = values.sky;
        if(scene.classList.contains("thf-weather-stage")){
          const card=scene.closest(".thf-day-card");
          if(card)card.dataset.sky=values.sky;
        }
      scene.dataset.thermal = values.thermal;
      scene.setAttribute("aria-label",
        shift.startText + " : " + values.startTemp + " degrés, " +
        shift.endText + " : " + values.endTemp + " degrés. " +
        values.description + " pendant le service" +
        (values.risk === null ? "" : ". Risque maximal de pluie : " + values.risk + " %"));
    }
    host.replaceChildren();
    const endpoints = document.createElement("span");
    endpoints.className = "thf-weather-endpoints";
    const point = (time, temp) => {
      const outer = document.createElement("span");
      outer.className = "thf-weather-point";
      const label = document.createElement("small");
      label.textContent = time;
      const number = document.createElement("strong");
      number.textContent = temp + "°";
      outer.append(label, number);
      return outer;
    };
    const arrow = document.createElement("span");
    arrow.className = "thf-weather-arrow";
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    endpoints.append(point(shift.startText, values.startTemp), arrow,
      point(shift.endText, values.endTemp));
    const state = document.createElement("span");
    state.className = "hc-shift-weather-state";
    state.textContent = values.description;
    host.append(endpoints, state);
    // Always expose the actual highest hourly precipitation probability on compact cards too.
    if (values.risk !== null) {
      const rain = document.createElement("span");
      rain.className = "hc-shift-weather-rain";
      rain.textContent = "Pluie : " + values.risk + " % max";
      rain.setAttribute("aria-label", "Risque maximal de pluie pendant le service : " + values.risk + " %");
      host.append(rain);
    }
    host.hidden = false;
  }

  async function mount(host, args = {}) {
    if (!host) return;
    host.hidden = true;
    const shift = validShift(args.date, args.start, args.end);
    if (!shift || !args.isWorking) return;
    try {
      const data = await getForecast();
      // Stale overlay results must never change the next day's popup.
      if (!host.isConnected) return;
      const values = calculate(data, shift);
      if (values) show(host, values, shift, args);
    } catch (_) {
      // Optional information must not block or clutter the planning modal.
      if (host.isConnected) host.hidden = true;
    }
  }


  // Vue journalière réservée aux repos/absences. Réutilise la même prévision
  // Open-Meteo que les shifts ; pas de seconde API, pas d'horaires inventés.
  const RAIN_SKIES = new Set(["drizzle", "rain", "heavy-rain", "storm"]);
  function dayValues(data, iso) {
    if (!rich(data)) return null;
    const h = data.hourly;
    const indices = [];
    for (let i = 0; i < h.time.length; i++) {
      if (String(h.time[i]).slice(0, 10) === iso) indices.push(i);
    }
    if (!indices.length) return null;
    const temps = indices.map(i => h.temperature_2m[i]).filter(Number.isFinite);
    if (!temps.length) return null;
    const risks = indices.map(i => h.precipitation_probability[i]).filter(Number.isFinite);
    const amounts = indices.map(i => Number(h.precipitation?.[i] || 0));
    const today = iso === todayInParis();
    const current = today && data.current && String(data.current.time || "").slice(0,10) === iso ? data.current : null;
    const currentSky = current ? weatherKind(current.weather_code, current.cloud_cover) : "unknown";
    // Le ciel du jour est la condition actuelle quand elle est disponible,
    // sinon la météo dominante de la journée.
    const weights = new Map();
    for (const i of indices) {
      const kind = weatherKind(h.weather_code?.[i], h.cloud_cover?.[i]);
      if (kind !== "unknown") weights.set(kind, (weights.get(kind) || 0) + 1);
    }
    const forecastSky = [...weights].sort((a,b) => b[1]-a[1])[0]?.[0] || "unknown";
    const sky = currentSky !== "unknown" ? currentSky : forecastSky;
    const currentRain = current ? Math.max(0, Number(current.precipitation || 0)) : 0;
    const rainingNow = today && Boolean(current) &&
      (currentRain > 0 || RAIN_SKIES.has(currentSky));
    const forecastRain = amounts.some(x => x > 0) || risks.some(x => x >= 60);
    // Un sol mouillé visualise une ambiance prévue, sans prétendre qu'il a plu.
    const rainingScene = today ? rainingNow : (RAIN_SKIES.has(forecastSky) && forecastRain);
    return {
      min: Math.round(Math.min(...temps)), max: Math.round(Math.max(...temps)),
      risk: risks.length ? Math.round(Math.max(...risks)) : null,
      sky, rainingScene, wetScene: rainingNow || forecastRain,
      description: LABELS[sky] || LABELS.unknown,
      current: today && currentSky !== "unknown"
    };
  }
  async function mountDay(host, args = {}) {
    if (!host) return;
    host.hidden = true;
    const iso = String(args.date || "").slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
        daysFromToday(iso) < 0 || daysFromToday(iso) >= MAX_DAYS) return;
    try {
      const data = await getForecast();
      const dayCardHost = host.closest("[data-thf-day]");
      if (!host.isConnected || (dayCardHost && dayCardHost.dataset.thfDay !== iso)) return;
      const values = dayValues(data, iso);
      if (!values) return;
      const scene = host.closest(".thf-weather-sky");
      if (scene) {
        scene.dataset.sky = values.sky;
        if(scene.classList.contains("thf-weather-stage")){
          const card=scene.closest(".thf-day-card");
          if(card)card.dataset.sky=values.sky;
        }
        scene.dataset.raining = values.rainingScene ? "true" : "false";
        scene.dataset.wet = values.wetScene ? "true" : "false";
      }
      host.innerHTML = "";
      const range = document.createElement("span");
      range.className = "thf-rest-forecast-range";
      const min = document.createElement("span");
      min.innerHTML = "<strong>" + values.min + "°</strong><small>min</small>";
      const max = document.createElement("span");
      max.innerHTML = "<strong>" + values.max + "°</strong><small>max</small>";
      range.append(min, max);
      const risk = document.createElement("span");
      risk.className = "thf-rest-forecast-risk";
      risk.textContent = values.risk === null ? "Pluie : —" : "💧 " + values.risk + " % max";
      const state = document.createElement("small");
      state.className = "thf-rest-forecast-state";
      state.textContent = (values.current ? "Maintenant (estimé) : " : "Prévision : ") + values.description;
      host.append(range, risk, state);
      host.setAttribute("aria-label", "Météo du " + iso + " : minimum " +
        values.min + " degrés, maximum " + values.max + " degrés, " +
        (values.risk == null ? "risque de pluie indisponible" : "risque de pluie maximal " + values.risk + " pour cent") +
        ". " + state.textContent);
      host.hidden = false;
    } catch (_) { if (host.isConnected) host.hidden = true; }
  }

  window.STIPShiftWeather = Object.freeze({ mount, mountDay });
})();
