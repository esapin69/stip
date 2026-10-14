import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

const read = path => readFileSync(path, "utf8");
const home = read("team-home-fusion.js");
const css = read("team-home-fusion.css");
const weather = read("shift-weather-mini.js");
const html = read("index.html");
const sw = read("stip-sw.js");
const loader = read("stip-loader.js");

const seasonSource = home.match(/function seasonForDay\(day\) \{([\s\S]*?)\n  \}/)?.[1];
const periodSource = home.match(/function periodForShift\(hours\) \{([\s\S]*?)\n  \}/)?.[1];
assert(seasonSource && periodSource, "Season and service-hour classifiers are required");
const seasonForDay = new Function("day", seasonSource);
const periodForShift = new Function("range", "hours", periodSource);
assert.equal(seasonForDay("2026-03-01"), "spring");
assert.equal(seasonForDay("2026-07-10"), "summer");
assert.equal(seasonForDay("2026-10-14"), "autumn");
assert.equal(seasonForDay("2026-12-25"), "winter");
assert.equal(periodForShift(v => v, [610, 1080]), "day");
assert.equal(periodForShift(v => v, [1170, 1230]), "evening");
assert.equal(periodForShift(v => v, [1300, 1500]), "night");

const sceneStart = home.indexOf('thf-weather-stage thf-weather-sky');
const header = home.indexOf('thf-day-trigger', sceneStart);
const stageBody = home.indexOf('thf-weather-body', header);
const post = home.indexOf('thf-day-post', stageBody);
const colleagues = home.indexOf('thf-shift-colleagues', post);
const chiefs = home.indexOf('thf-day-chief', colleagues);
assert(sceneStart >= 0 && sceneStart < header && header < stageBody &&
  stageBody < post && post < colleagues && colleagues < chiefs,
  "The scene must include date, shift and colleagues but exclude chiefs");
assert(home.includes("watchWeather(host);") &&
  home.includes("IntersectionObserver") &&
  home.includes("visibilitychange"), "Offscreen and background pause are required");
assert(css.includes("prefers-reduced-motion:reduce") &&
  css.includes("prefers-reduced-data:reduce") &&
  css.includes("thf-weather-page-hidden"), "Respect motion and data-saving modes");
const effects = css.slice(css.indexOf("/* Météo légère et saisonnière"));
assert(effects && !/url\(|@import|image-set\(/i.test(effects),
  "Weather animation cannot download media assets");

const build = html.match(/name="stip-ui-build" content="([^"]+)"/)?.[1];
const loaderBuild = loader.match(/\bV\s*=\s*"([^"]+)"/)?.[1];
const swBuild = sw.match(/STIP_SW_BUILD="([^"]+)"/)?.[1];
assert(build && build === loaderBuild && build === swBuild, "Runtime builds must match");
for (const asset of ["team-home-fusion.js", "team-home-fusion.css", "stip-loader.js", "stip-sw.js"])
  assert(html.includes(asset + "?v=" + build), "Asset cache version mismatch: " + asset);

// Existing Open-Meteo client: two cards must share the original single forecast fetch.
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date());
const part = type => parts.find(p => p.type === type).value;
const day = part("year") + "-" + part("month") + "-" + part("day");
const rows = [];
for (let d = 0; d < 16; d++) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + d);
  for (let hour = 0; hour < 24; hour++)
    rows.push(date.toISOString().slice(0, 10) + "T" + String(hour).padStart(2, "0") + ":00");
}
const data = {hourly: {
  time:rows,
  temperature_2m:rows.map(() => 15),
  precipitation_probability:rows.map(() => 10),
  precipitation:rows.map(() => 0),
  weather_code:rows.map(() => 45),
  cloud_cover:rows.map(() => 95)
}};
let requests = 0;
const sandbox = {
  window: {},
  document: {createElement: tag => ({tagName:tag, className:"", textContent:"", title:""})},
  fetch: async () => {requests++; return {ok:true,json:async()=>data}},
  localStorage: {getItem:()=>null,setItem:()=>{}},
  URLSearchParams,AbortController,setTimeout,clearTimeout,Date,Intl
};
vm.runInNewContext(weather, sandbox);
const makeHost = () => {
  const scene = {dataset:{},setAttribute(){}};
  return {scene,isConnected:true,hidden:true,
    closest:()=>scene,replaceChildren(){this.children=[]},
    append(...children){this.children.push(...children)}};
};
const first = makeHost(), second = makeHost();
await sandbox.window.STIPShiftWeather.mount(first, {
  date:day,start:"10h10",end:"18h00",isWorking:true,compact:true
});
await sandbox.window.STIPShiftWeather.mount(second, {
  date:day,start:"10h10",end:"18h00",isWorking:true,compact:true
});
assert.equal(requests, 1, "Both cards must reuse the same cached weather data");
assert.equal(first.scene.dataset.sky, "fog", "Actual forecast must drive the scene");
assert.equal(second.scene.dataset.sky, "fog");
assert.equal(first.hidden,false,"Weather values must appear");
console.log("Weather ambience: seasons, stage boundary, motion safety, builds, cache and real sky OK");
