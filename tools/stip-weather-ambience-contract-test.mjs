import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

const read = name => readFileSync(name, "utf8");
const home = read("team-home-fusion.js");
const css = read("team-home-fusion.css");
const weather = read("shift-weather-mini.js");
const index = read("index.html");
const loader = read("stip-loader.js");
const worker = read("stip-sw.js");

assert.match(home, /function seasonForDay\(day\)/);
assert.match(home, /class="thf-weather-stage thf-weather-sky"/);
assert.doesNotMatch(home, /IntersectionObserver|watchWeather|periodForShift/);
// Artistic layers are static SVG shapes, not character emoji or moving DOM clouds.
assert.doesNotMatch(home, /thf-lightning|thf-cloud cloud-one/);
assert.match(home, /function staticWeatherArt\(identity\)/);
const artFunction = home.match(/function staticWeatherArt\(identity\) \{([\s\S]*?)\n  \}/)?.[1];
assert(artFunction, "One reusable vector artwork generator is required");
const art = new Function("identity", artFunction);
const cardArt = art("card-20261014"), popupArt = art("popup-20261014");
assert(cardArt.includes('<svg ') && cardArt.includes('<defs>'));
for (const layer of ["thf-art-sun", "thf-art-cloud-back", "thf-art-cloud-main",
  "thf-art-rain", "thf-art-snow", "thf-art-fog", "thf-art-lightning"])
  assert(cardArt.includes('class="' + layer + '"'), "Missing atmospheric layer: " + layer);
assert(cardArt.includes('aria-hidden="true"') && cardArt.includes('focusable="false"'));
assert(cardArt.includes('thf-wx-card-20261014-cloud'));
assert(popupArt.includes('thf-wx-popup-20261014-cloud'));
assert(!/src=|<image|<animate|<foreignObject/i.test(cardArt),
  "Weather art must remain fully local, static, and lightweight");
assert(!/🌤|🌦|🌧|☁️|☀️|🌫/.test(cardArt), "No replacement emoji");
assert.doesNotMatch(css, /@keyframes thf-|thf-weather-cloud-drift|thf-weather-fall\b|thf-flash|animation:\s*thf-/);
assert.doesNotMatch(css, /#19305cb8|data-period="night"|content:"☁️"|content:"🌦️"/);
assert.match(css, /\.thf-weather-stage::after/);
assert.match(css, /\.thf-weather-stage\[data-sky="fog"\]::after/);
assert.match(css, /\.thf-popup \.thf-popup-hero \.thf-weather-art/);
assert.match(css, /\.thf-art-cloud-main\{display:block\}/);
assert.match(css, /opacity:\.70;pointer-events:none;user-select:none;/,
  "Sun and cloud illustration must be visible, not faded to 21% opacity");
assert.match(css, /filter:saturate\(1\.22\) contrast\(1\.08\)/,
  "Weather art must retain a readable colored silhouette");
assert(css.includes("#87c9f0") && css.includes("#9bcfeb") &&
  css.includes("#88b8d4") && css.includes("#7fa5bb"),
  "Sky palettes must visibly distinguish sunny, mixed, rain and storm");
assert(home.includes('<span aria-hidden="true">🎨</span><b>'),
  "Chiefs use the approved palette icon, not a crown");
const dayCard=home.slice(home.indexOf('host.innerHTML='),home.indexOf('const weather=host.querySelector'));
const dayPopup=home.slice(home.indexOf('function openDay(host)'),home.indexOf('function openChiefs(host)'));
assert(!dayCard.includes('thf-day-brief') && !dayCard.includes('à retenir'),
  "A day card must no longer show a generic notice counter");
assert(dayPopup.includes('thf-day-popup-notices') &&
  dayPopup.includes('noteButtons(host._thfNotes||[])'),
  "The day detail dialog must expose individual notices immediately");
assert(dayPopup.indexOf('thf-day-popup-notices') < dayPopup.indexOf('thf-day-popup-actions'),
  "Notice titles and icons must be visible before ancillary actions");
assert(home.includes('thf-note-icon') && home.includes('thf-note-copy') &&
  home.includes('esc(x.title)') && home.includes('esc(x.detail)'),
  "Each notice must display its own icon, real title and description");
assert(!dayPopup.includes('data-thf-open="notes"'),
  "The day dialog must not open a redundant generic notes dialog");
assert(css.includes('.thf-popup.thf-day-popup{overflow-y:auto'),
  "Day details must remain vertically accessible on mobile");
assert.doesNotMatch(css, /@import|image-set\(|url\(["']?https?:/i);
for (const sky of ["sunny", "partly", "cloudy", "fog", "drizzle",
  "rain", "heavy-rain", "storm", "snow", "mixed"]) {
  assert(css.includes('data-sky="' + sky + '"'), "Static visual missing: " + sky);
}
const start = home.indexOf("thf-weather-stage thf-weather-sky");
const shift = home.indexOf("thf-day-post", start);
const actions = home.indexOf('class="thf-shift-actions"', shift);
const colleagues = home.indexOf("thf-shift-colleagues", actions);
const chief = home.indexOf("thf-shift-chiefs", colleagues);
const body = home.indexOf('class="thf-day-more"', chief);
assert(start >= 0 && shift > start && actions > shift &&
  colleagues > actions && chief > colleagues && body > chief,
  "Colleagues and chiefs must share the shift action row");
assert(home.slice(actions, chief).includes('data-thf-open="people"'));
assert(home.slice(chief, body).includes('data-thf-open="chiefs"'));
assert(!home.slice(body, home.indexOf("'</article>'", body)).includes("thf-day-chief-launch"),
  "The day card must not show a second chiefs button");
assert(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),
  "Two responsive shift buttons are required");
assert(css.includes("bottom:7%;z-index:0"),
  "Weather scenery must sit discreetly behind the lower card");
const rainStyle=css.slice(css.indexOf("/* Risque pluie réel"),css.indexOf("/* Fin du carré J4/CP"));
assert(rainStyle.includes("background:transparent!important") &&
  rainStyle.includes("border:0!important"),
  "Rain percentage must remain legible without a separate box");
assert(worker.includes("event.respondWith(networkFirst(request,STATIC_CACHE))"),
  "Site code assets must be fetched network-first and cached for offline use");

// Global shell updates independently. Only the two illustrated assets need a
// new URL to bypass the existing service worker's cache-first policy.
const globalBuild = index.match(/name="stip-ui-build" content="([^"]+)"/)?.[1];
assert(globalBuild);
assert.equal(worker.match(/STIP_SW_BUILD="([^"]+)"/)?.[1], globalBuild);
const loadedVersion = loader.match(/\bV\s*=\s*"([^"]+)"/)?.[1];
assert(loadedVersion && index.includes("stip-loader.js?v=" + loadedVersion));
for (const asset of ["team-home-fusion.js", "team-home-fusion.css"])
  assert(index.includes(asset + "?v=20261015-weather-contrast-notices3"),
    "New card asset URL not refreshed: " + asset);
assert(index.includes("shift-weather-mini.js?v=20261015-chefs-rest-rain1"),
  "The unchanged canonical weather engine must stay available");
assert(index.includes('stip-loader.js?v=' + globalBuild) &&
  index.includes('stip-sw.js?v=' + globalBuild),
  "Loader and service worker must match the HTML build");
assert(index.includes("stip-ui-version-check") &&
  index.indexOf("scheduleHeal(0)") < index.indexOf("<title>"),
  "The startup version gate must protect the first paint");
assert.match(home, /data-rest=/, "Rest cards must have a dedicated decorative state");
assert.match(home, /data-thf-open="chiefs"/, "Chef entries must open a dedicated popup");
assert.match(weather, /if \(values\.risk !== null\)/, "Compact forecast must display precipitation risk");
assert.match(weather, /const CACHE_TTL = 20 \* 60 \* 1000/);
assert.match(weather, /const API = "https:\/\/api\.open-meteo\.com\/v1\/forecast"/);

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date());
const part = type => fmt.find(x => x.type === type).value;
const day = part("year") + "-" + part("month") + "-" + part("day");
const next = new Date(day + "T12:00:00Z");
next.setUTCDate(next.getUTCDate() + 1);
const tomorrow = next.toISOString().slice(0, 10);
const time = [];
for (let n = 0; n < 16; n++) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + n);
  for (let hour = 0; hour < 24; hour++)
    time.push(date.toISOString().slice(0, 10) + "T" +
      String(hour).padStart(2, "0") + ":00");
}
const hour = s => Number(s.slice(11, 13));
const hourly = {
  time,
  temperature_2m:time.map(s => ({10:10,11:16,18:20,21:12,22:14,5:7})[hour(s)] ?? 16),
  precipitation_probability:time.map(() => 10),
  precipitation:time.map(() => 0),
  weather_code:time.map(s => s === day + "T10:00" ? 45 : 3),
  cloud_cover:time.map(() => 95)
};
let calls = 0;
const element = tag => ({
  tagName:tag, className:"", textContent:"", children:[],
  append(...children){this.children.push(...children)},
  setAttribute(name,value){this[name]=value}
});
const sandbox = {
  window:{}, document:{createElement:element},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  fetch:async () => {calls++; return {ok:true,json:async()=>({hourly})}},
  URLSearchParams,AbortController,setTimeout,clearTimeout,Date,Intl
};
vm.runInNewContext(weather, sandbox);
const mount = sandbox.window.STIPShiftWeather.mount;
const host = () => {
  const scene = {dataset:{},setAttribute(){}};
  return {scene,hidden:true,isConnected:true,children:[],
    closest:()=>scene,replaceChildren(){this.children=[]},
    append(...nodes){this.children.push(...nodes)}};
};
const one=host(), two=host(), nextDay=host();
const args={date:day,start:"10h10",end:"18h00",isWorking:true,compact:true};
await Promise.all([mount(one,args),mount(two,args),
  mount(nextDay,{...args,date:tomorrow})]);
assert.equal(calls,1,"Concurrent agents must share one forecast fetch");
const values = root => root.children[0].children;
assert.equal(values(one)[0].children[0].textContent,"10h10");
assert.equal(values(one)[0].children[1].textContent,"11°",
  "10:10 must interpolate 10:00 and 11:00 forecasts");
assert.equal(values(one)[2].children[0].textContent,"18h00");
assert.equal(values(one)[2].children[1].textContent,"20°",
  "18:00 must use the 18:00 forecast, not the shift maximum");
assert.equal(one.scene.dataset.sky,"cloudy",
  "One foggy hour must not label the entire shift as fog");
assert.equal(two.scene.dataset.sky,"cloudy");
assert.equal(JSON.stringify(one.children),JSON.stringify(two.children),
  "Same day and shift must produce identical temperatures and sky");
assert.equal(one.hidden,false);
assert(one.children.some(child => child.className === "hc-shift-weather-rain" &&
  child.textContent.includes("10 %")), "Risk of precipitation must be visible on compact cards");
await mount(one,args);
assert.equal(calls,1,"Cached forecasts must not be downloaded again");

// Different hours read the same forecast, including overnight service.
const overnight=host();
await mount(overnight,{date:day,start:"21h30",end:"05h00",isWorking:true,compact:true});
assert.equal(calls,1);
assert.equal(values(overnight)[0].children[1].textContent,"13°");
assert.equal(values(overnight)[2].children[0].textContent,"05h00");
assert.equal(values(overnight)[2].children[1].textContent,"7°");

// If a forecast for the service's endpoint is missing, never invent it.
const impossible=host();
await mount(impossible,{date:day,start:"10h10",end:"10h10",isWorking:true,compact:true});
assert.equal(impossible.hidden,true);

console.log("Shift weather: hourly endpoints, dominant sky, overnight, premium static SVG scenery, cache and mobile assets OK");
