import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const css = read('styles.css');
const app = read('app.js');
const home = read('home-shell.js');
const popup = read('stip-popup-continuity.js');
const html = read('index.html');
const worker = read('stip-sw.js');

test('native document scroll is the default; only explicit navigations may animate', () => {
  assert.match(css, /^html\{scroll-behavior:auto\}/);
  assert.doesNotMatch(css, /^html\{scroll-behavior:smooth\}/);
});

test('route owns route restoration, not a repeating timer after user interaction', () => {
  assert.match(app, /history\.scrollRestoration='manual'/);
  assert.doesNotMatch(app, /setTimeout\(attempt,\s*140\)/);
  assert.match(app, /window\.addEventListener\('stip:home-rendered'/);
  assert.match(app, /document\.addEventListener\('touchstart',cancelPendingScrollForInput/);
  assert.match(app, /window\.addEventListener\('wheel',cancelPendingScrollForInput/);
  assert.match(app, /STIPPopupContinuity\?\.isOpen/);
});

test('refreshing the home DOM does not launch another delayed page move', () => {
  const start = home.indexOf('  function render() {');
  const end = home.indexOf('  document.addEventListener("keydown"', start);
  assert.ok(start >= 0 && end > start, 'Expected to locate home render');
  const block = home.slice(start, end);
  assert.doesNotMatch(block, /window\.scrollTo\s*\(/);
  assert.match(block, /stip:home-rendered/);
});

test('closing a popup restores position before paint without later overrides', () => {
  const start = popup.indexOf('  function restorePosition(saved)');
  const end = popup.indexOf('  function reconcile()', start);
  assert.ok(start >= 0 && end > start);
  const block = popup.slice(start, end);
  assert.match(block, /window\.scrollTo\(/);
  assert.doesNotMatch(block, /setTimeout|requestAnimationFrame/);
  assert.match(popup, /attributeFilter: \['open', 'hidden', 'aria-hidden', 'class', 'style'\]/);
});

test('changed scroll assets refresh independently of the shared GHE UI build', () => {
  const revision = '20261017-native-scroll-reconciled1';
  for (const asset of ['styles.css', 'app.js', 'stip-popup-continuity.js']) {
    assert.ok(html.includes(asset + '?v=' + revision), asset + ' must be refreshed');
  }
  const build = html.match(/name="stip-ui-build" content="([^"]+)"/)?.[1];
  assert.ok(build);
  assert.ok(html.includes('home-shell.js?v=' + build));
  assert.ok(html.includes('stip-sw.js?v=' + build));
  assert.ok(worker.includes('STIP_SW_BUILD="' + build + '"'));
});
