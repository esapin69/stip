(() => {
  "use strict";

  // Public weather data only: fixed hospital-area location (Lyon).
  // No GHE schedule, identity, access code or other private data is sent to the provider.
  const LOCATION = Object.freeze({ latitude: 45.764, longitude: 4.8357 });
  const API = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "stip_shift_weather_lyon_v1";
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
    const stored = readStored(SHARED_CACHE_KEY) || readStored(CACHE_KEY);
    if (stored) {
      inMemory = { data: stored, at: Date.now() };
      return stored;
    }
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const parameters = new URLSearchParams({
        latitude: String(LOCATION.latitude),
        longitude: String(LOCATION.longitude),
        timezone: "Europe/Paris",
        forecast_days: String(MAX_DAYS),
        hourly: "temperature_2m,precipitation_probability"
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
        if (!validate(data)) throw new Error("Incomplete forecast");
        inMemory = { data, at: Date.now() };
        writeStored(data);
        return data;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => { inFlight = null; });
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
      overnight
    };
  }

  function calculate(data, shift) {
    const h = data.hourly;
    const numbers = [], chance = [];
    for (let i = 0; i < h.time.length; i++) {
      const ts = h.time[i];
      if (typeof ts !== "string" || ts < shift.first) continue;
      if (ts > shift.last || (ts === shift.last && !shift.lastHasPartialHour))
        continue;
      const temp = h.temperature_2m[i], pop = h.precipitation_probability[i];
      if (typeof temp === "number" && Number.isFinite(temp)) numbers.push(temp);
      if (typeof pop === "number" && Number.isFinite(pop)) chance.push(pop);
    }
    if (!numbers.length || !chance.length) return null;
    const min = Math.round(Math.min(...numbers));
    const max = Math.round(Math.max(...numbers));
    const risk = Math.round(Math.max(...chance));
    return { min, max, risk };
  }

  function show(host, values) {
    if (!host?.isConnected) return;
    host.replaceChildren();
    const tag = document.createElement("span");
    tag.className = "hc-shift-weather-label";
    tag.textContent = "🌦️ MÉTÉO DU POSTE";
    const numbers = document.createElement("span");
    numbers.className = "hc-shift-weather-values";
    const temps = document.createElement("strong");
    temps.textContent = values.min + "° / " + values.max + "°";
    temps.title = "Températures minimale et maximale estimées pendant les heures du service";
    const rain = document.createElement("strong");
    rain.className = "hc-shift-weather-rain";
    rain.textContent = "☂ " + values.risk + " %";
    rain.title = "Risque maximal horaire de précipitations pendant les heures du service";
    numbers.append(temps, rain);
    const source = document.createElement("span");
    source.className = "hc-shift-weather-source";
    source.textContent = "Lyon · prévisions horaires · Open-Meteo";
    host.append(tag, numbers, source);
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
      if (values) show(host, values);
    } catch (_) {
      // Optional information must not block or clutter the planning modal.
      if (host.isConnected) host.hidden = true;
    }
  }

  window.STIPShiftWeather = Object.freeze({ mount });
})();
