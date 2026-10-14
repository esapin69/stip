(() => {
  "use strict";

  // Public weather data only: fixed hospital-area location (Lyon).
  // No GHE schedule, identity, access code or other private data is sent to the provider.
  const LOCATION = Object.freeze({ latitude: 45.764, longitude: 4.8357 });
  const API = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "stip_shift_weather_lyon_visual_v2";
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
        hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,cloud_cover"
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

  function calculate(data, shift) {
    const h=data.hourly;
    const numbers=[],chances=[],rainfall=[],codes=[],clouds=[];
    for(let i=0;i<h.time.length;i++){
      const ts=h.time[i];
      if(typeof ts!=="string"||ts<shift.first)continue;
      if(ts>shift.last||(ts===shift.last&&!shift.lastHasPartialHour))continue;
      const t=h.temperature_2m[i],risk=h.precipitation_probability[i];
      if(Number.isFinite(t))numbers.push(t);
      if(Number.isFinite(risk))chances.push(risk);
      if(Number.isFinite(h.precipitation?.[i]))rainfall.push(h.precipitation[i]);
      if(Number.isFinite(h.weather_code?.[i]))codes.push(h.weather_code[i]);
      if(Number.isFinite(h.cloud_cover?.[i]))clouds.push(h.cloud_cover[i]);
    }
    if(!numbers.length||!chances.length)return null;
    const min=Math.round(Math.min(...numbers)),max=Math.round(Math.max(...numbers));
    const risk=Math.round(Math.max(...chances));
    const maxRain=rainfall.length?Math.max(...rainfall):null;
    const mm=maxRain==null?null:Math.round(maxRain*10)/10;
    const isStorm=codes.some(c=>c>=95);
    const isSnow=codes.some(c=>c>=71&&c<=77||c>=85&&c<=86);
    const isRain=codes.some(c=>c>=51&&c<=67||c>=80&&c<=82);
    const isFog=codes.some(c=>c>=45&&c<=48);
    const heavy=mm!=null&&mm>=3||codes.some(c=>[65,67,82].includes(c));
    const cloudy=codes.some(c=>c===3)||(clouds.length&&clouds.reduce((a,b)=>a+b,0)/clouds.length>78);
    const partial=codes.some(c=>c===2||c===1)||(clouds.length&&clouds.reduce((a,b)=>a+b,0)/clouds.length>28);
    const wet=maxRain!=null&&maxRain>0;
    let sky="unknown",description="Conditions non disponibles";
    if(codes.length){
      if(isStorm){sky="storm";description="Orage";}
      else if(isSnow){sky="snow";description="Neige";}
      else if((isRain||wet)&&heavy){sky="heavy-rain";description="Pluie forte";}
      else if((isRain||wet)&&(mm!=null&&mm>=0.5||codes.some(c=>c>=61))){sky="rain";description="Pluie";}
      else if(isRain||wet){sky="drizzle";description="Pluie faible";}
      else if(isFog){sky="fog";description="Brouillard";}
      else if(cloudy){sky="cloudy";description="Nuageux";}
      else if(partial){sky="partly";description="Éclaircies";}
      else {sky="sunny";description="Ensoleillé";}
    }
    const thermal=max>=28?"hot":min<=5?"cold":"mild";
    return {min,max,risk,sky,description,thermal,maxRain:mm};
  }

  function show(host, values, shift, options = {}) {
    if (!host?.isConnected) return;
    const scene=host.closest?.(".thf-weather-sky");
    if(scene){
      scene.dataset.sky=values.sky;
      scene.dataset.thermal=values.thermal;
      scene.setAttribute("aria-label",values.description+" pendant le service : "+values.min+" à "+values.max+
        " degrés, risque maximal de précipitations "+values.risk+" %");
    }
    host.replaceChildren();
    // Carte comparative : garder les mêmes valeurs horaires, uniquement raccourcir les libellés.
    if (options.compact === true) {
      const temps = document.createElement("strong");
      temps.className = "hc-shift-weather-compact-temp";
      temps.textContent = "🌡 " + values.min + "–" + values.max + " °C";
      temps.title = "Températures min. et max. pendant le poste";
      const rain = document.createElement("strong");
      rain.className = "hc-shift-weather-compact-rain";
      rain.textContent = "☂ " + values.risk + " %";
      rain.title = "Risque maximal de précipitations pendant le poste";
      const state = document.createElement("span");
      state.className = "hc-shift-weather-state";
      state.textContent = values.description+
        (values.maxRain!=null&&values.maxRain>0?" · "+values.maxRain+" mm/h":"");
      host.append(temps, rain, state);
      host.hidden = false;
      return;
    }
    const tag = document.createElement("span");
    tag.className = "hc-shift-weather-label";
    tag.textContent = "🌦️ PRÉVISIONS PENDANT VOS HORAIRES";
    const numbers = document.createElement("span");
    numbers.className = "hc-shift-weather-values";
    const temps = document.createElement("strong");
    temps.textContent = "Min. " + values.min + "° · Max. " + values.max + "°";
    temps.title = "Températures minimale et maximale estimées pendant les heures du service";
    const rain = document.createElement("strong");
    rain.className = "hc-shift-weather-rain";
    rain.textContent = "☂ Risque max. " + values.risk + " %";
    rain.title = "Risque maximal horaire de précipitations pendant les heures du service";
    numbers.append(temps, rain);
    const source = document.createElement("span");
    source.className = "hc-shift-weather-source";
    source.textContent = shift.startText + " → " + shift.endText + (shift.overnight ? " (+1 jour)" : "") + " · Lyon · prévisions horaires";
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
      if (values) show(host, values, shift, args);
    } catch (_) {
      // Optional information must not block or clutter the planning modal.
      if (host.isConnected) host.hidden = true;
    }
  }

  window.STIPShiftWeather = Object.freeze({ mount });
})();
