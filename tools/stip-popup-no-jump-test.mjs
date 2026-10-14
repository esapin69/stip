import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../stip-popup-continuity.js', import.meta.url), 'utf8');

function fixture() {
  let y = 1240, mounted = false, hiddenByClass = false, hash = '#/home';
  let mutations, watched = {}, raf = [], timeouts = [], writes = [];
  const listeners = {}, windowListeners = {};
  const popup = {
    isConnected: true, open: true, hidden: false, dataset: {},
    matches: query => query === 'dialog' || query.includes('dialog[open]'),
    closest: () => null, querySelector: () => null,
    getClientRects: () => [1], getBoundingClientRect: () => ({ width: 340 }),
  };
  const document = {
    documentElement: {},
    scrollingElement: { scrollHeight: 3000, get scrollTop() { return y; } },
    querySelectorAll: () => mounted ? [popup] : [],
    addEventListener: (name, cb) => { listeners[name] = cb; },
  };
  const window = {
    get scrollY() { return y; },
    scrollTo: ({ top }) => { writes.push(top); y = top; },
    STIPRouter: { cancelPendingScrollRestore() {}, saveScroll() {} },
    addEventListener: (name, cb) => { windowListeners[name] = cb; },
  };
  const location = { pathname: '/', search: '', get hash() { return hash; } };
  class MutationObserver {
    constructor(callback) { mutations = callback; }
    observe(element, options) { watched = options; }
  }
  runInNewContext(source, {
    window, document, location, MutationObserver,
    getComputedStyle: () => ({ display: hiddenByClass ? 'none' : 'block', visibility: 'visible' }),
    innerWidth: 390, performance: { now: () => 2000 },
    requestAnimationFrame: cb => raf.push(cb),
    setTimeout: cb => timeouts.push(cb),
  });
  const changed = (attr = 'open') =>
    mutations([{ type: 'attributes', attributeName: attr, target: popup }]);
  return {
    pointer: () => listeners.pointerdown(),
    wheel: () => windowListeners.wheel(),
    open: () => { mounted = true; changed(); },
    close: () => { mounted = false; changed(); },
    hideClass: () => { hiddenByClass = true; changed('class'); },
    setY: next => { y = next; },
    setHash: next => { hash = next; },
    flush: () => {
      for (let i = 0; i < 3; i++) {
        const work = raf;
        raf = [];
        work.forEach(cb => cb());
      }
      const work = timeouts;
      timeouts = [];
      work.forEach(cb => cb());
    },
    get y() { return y; },
    get writes() { return writes; },
    get watched() { return watched; },
  };
}

test('popup is restored in the same microtask, before next animation frame', () => {
  const page = fixture();
  page.pointer(); page.open();
  page.setY(0); page.close();
  assert.equal(page.y, 1240, 'The page must not wait for two animation frames');
  page.flush();
  assert.deepEqual(page.writes, [1240]);
});

test('later user scroll wins over delayed restoration', () => {
  const page = fixture();
  page.pointer(); page.open();
  page.setY(0); page.close();
  page.pointer(); page.setY(1600);
  page.flush();
  assert.equal(page.y, 1600);
});

test('wheel scrolling after popup close also wins', () => {
  const page = fixture();
  page.pointer(); page.open();
  page.setY(0); page.close();
  page.wheel(); page.setY(1600);
  page.flush();
  assert.equal(page.y, 1600);
});

test('CSS class dismissal of a popup is detected', () => {
  const page = fixture();
  page.pointer(); page.open();
  page.setY(0); page.hideClass();
  assert.equal(page.y, 1240);
  assert.ok(page.watched.attributeFilter.includes('class'));
});

test('real route changes do not restore previous page position', () => {
  const page = fixture();
  page.pointer(); page.open();
  page.setHash('#/apps');
  page.setY(0); page.close();
  assert.equal(page.y, 0);
  assert.deepEqual(page.writes, []);
});
