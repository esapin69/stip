import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const script = read('stip-popup-continuity.js');

function fixture() {
  let y = 1180, hash = '#/home', mounted = [], mutations;
  const writes = [], events = [], handlers = {};
  const classes = new Set();
  const classList = {
    add: name => classes.add(name),
    remove: name => classes.delete(name),
    contains: name => classes.has(name),
  };
  const makePopup = () => ({
    isConnected: true, open: true, hidden: false, dataset: {},
    matches: selector => selector === 'dialog' || selector.includes('dialog[open]'),
    closest: () => null,
    getClientRects: () => [1],
    getBoundingClientRect: () => ({ width: 340 }),
    querySelector: () => null,
  });
  const document = {
    documentElement: { classList },
    scrollingElement: { scrollHeight: 3200, get scrollTop() { return y; } },
    querySelectorAll: () => mounted,
    addEventListener: (name, callback) => { handlers[name] = callback; },
  };
  const window = {
    innerHeight: 700,
    get scrollY() { return y; },
    scrollTo: ({ top }) => { writes.push(top); y = top; },
    dispatchEvent: event => events.push(event.type),
    STIPRouter: { cancelPendingScrollRestore() {}, saveScroll() {} },
    addEventListener: (name, callback) => { handlers['window:' + name] = callback; },
  };
  class MutationObserver {
    constructor(callback) { mutations = callback; }
    observe() {}
  }
  runInNewContext(script, {
    window, document, MutationObserver,
    location: { pathname: '/', search: '', get hash() { return hash; } },
    innerWidth: 390, performance: { now: () => 2000 },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    CustomEvent: class { constructor(type) { this.type = type; } },
  });
  const changed = () => mutations([{ type: 'childList', addedNodes: [] }]);
  return {
    click: () => handlers.pointerdown(),
    open: () => { mounted.push(makePopup()); changed(); },
    close: () => { mounted.pop(); changed(); },
    setY: value => { y = value; },
    route: value => { hash = value; },
    get scroll() { return y; },
    get locked() { return classes.has('stip-popup-locked'); },
    get writes() { return writes; },
    get events() { return events; },
  };
}

test('a popup locks the document and restores scroll immediately on close', () => {
  const page = fixture();
  page.click(); page.open();
  assert.equal(page.locked, true);
  page.setY(0);
  page.close();
  assert.equal(page.locked, false);
  assert.equal(page.scroll, 1180);
  assert.deepEqual(page.writes, [1180]);
  assert.deepEqual(page.events, ['stip:popup-closed']);
});

test('nested popups preserve the lock until the last one closes', () => {
  const page = fixture();
  page.click(); page.open(); page.open(); page.close();
  assert.equal(page.locked, true);
  assert.equal(page.events.length, 0);
  page.close();
  assert.equal(page.locked, false);
  assert.equal(page.events.length, 1);
});

test('route changes do not restore the previous page scroll', () => {
  const page = fixture();
  page.click(); page.open(); page.route('#/planning'); page.setY(0); page.close();
  assert.equal(page.locked, false);
  assert.equal(page.scroll, 0);
  assert.deepEqual(page.writes, []);
});

test('core scroll and home render avoid delayed position writes', () => {
  assert.match(read('styles.css'), /^html\{scroll-behavior:auto\}/);
  assert.match(read('stip-popup-continuity.css'), /html\.stip-popup-locked\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(read('app.js'), /setTimeout\(attempt,\s*140\)/);
  const home = read('home-shell.js');
  assert.match(home, /state\.popupRenderDeferred = true/);
  assert.match(home, /stip:popup-closed/);
  assert.doesNotMatch(home, /if \(onHome && y > 0\)\s*requestAnimationFrame/);
});

test('page and service worker use the same revision', () => {
  const build = '20261016-popup-stable1';
  const html = read('index.html');
  const sw = read('stip-sw.js');
  assert.ok(html.includes('name="stip-ui-build" content="' + build + '"'));
  for (const asset of ['styles.css','app.js','home-shell.js','stip-popup-continuity.js','stip-popup-continuity.css']) {
    assert.ok(html.includes(asset + '?v=' + build), asset + ' cache bust');
  }
  assert.ok(sw.includes('STIP_SW_BUILD="' + build + '"'));
});
