import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../stip-popup-continuity.js', import.meta.url), 'utf8');
function fixture() {
  let opened = false, y = 1240, hash = '#/home', now = 2000;
  let mutations, writes = [], saves = 0, cancellations = 0;
  const handlers = {};
  const dialog = {
    isConnected: true, open: true, hidden: false, dataset: {},
    matches: selector => selector === 'dialog',
    closest: () => null,
    getBoundingClientRect: () => ({ width: 340 }),
  };
  const document = {
    documentElement: {},
    scrollingElement: { scrollHeight: 3000, get scrollTop() { return y; } },
    querySelectorAll: () => opened ? [dialog] : [],
    addEventListener: (type, callback) => { handlers[type] = callback; },
  };
  const window = {
    get scrollY() { return y; },
    scrollTo: ({ top }) => { writes.push(top); y = top; },
    STIPRouter: { cancelPendingScrollRestore: () => cancellations++, saveScroll: () => saves++ },
    addEventListener: () => {},
  };
  const location = { pathname: '/', search: '', get hash() { return hash; } };
  class MutationObserver { constructor(callback) { mutations = callback; } observe() {} }
  runInNewContext(code, {
    window, document, location, MutationObserver, performance: { now: () => now },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    get innerWidth() { return 390; },
    requestAnimationFrame: callback => callback(),
    setTimeout: callback => callback(),
  });
  return {
    trigger: () => handlers.pointerdown(),
    open: () => { opened = true; mutations(); },
    close: () => { opened = false; mutations(); },
    setY: n => { y = n; },
    setHash: n => { hash = n; },
    get y() { return y; },
    get writes() { return writes; },
    get saves() { return saves; },
    get cancellations() { return cancellations; },
    get decorated() { return dialog.dataset.stipPopupViewport; },
  };
}

test('fermer une fenêtre restaure le même défilement', () => {
  const f = fixture();
  f.trigger(); f.open(); assert.equal(f.decorated, '1');
  assert.equal(f.cancellations, 1);
  f.setY(0); f.close();
  assert.equal(f.y, 1240);
  assert.ok(f.saves > 0);
});

test('le changement de page ne rétablit pas une ancienne position', () => {
  const f = fixture();
  f.trigger(); f.setHash('#/autre'); f.open();
  f.setY(0); f.close();
  assert.equal(f.y, 0);
  assert.deepEqual(f.writes, []);
});

test('une fenêtre en cours ne restaure pas prématurément le défilement', () => {
  const f = fixture();
  f.trigger(); f.open(); f.open(); f.setY(0);
  assert.equal(f.y, 0);
  f.close(); assert.equal(f.y, 1240);
});
