import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
function startup(savedSession) {
  const classes = new Set(), timers = [], events = new Map();
  const context = {
    localStorage: { getItem: () => savedSession ? 'test-session' : null },
    document: { documentElement: { classList: {
      add: (...items) => items.forEach(x => classes.add(x)),
      remove: (...items) => items.forEach(x => classes.delete(x)),
    } } },
    addEventListener: (name, callback) => events.set(name, callback),
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
  };
  vm.runInNewContext(script('stip-session-resume-flag'), context);
  vm.runInNewContext(script('stip-session-resume-watchdog'), context);
  return { classes, timers, events };
}

// A stalled external script prevents DOMContentLoaded. The escape must still run.
const stalled = startup(true);
assert(stalled.classes.has('stip-session-resume'));
assert(stalled.classes.has('stip-ui-version-check'));
const deadline = stalled.timers.find(x => x.delay === 3500);
assert(deadline, 'The deadline must already exist before DOMContentLoaded');
deadline.callback();
assert.equal(stalled.classes.size, 0);

// The loading status belongs to the root, not to an initially hidden home view.
assert.match(html, /html\.stip-session-resume::after,\s*html\.stip-ui-version-check::after\s*\{/);
assert(!html.includes('html.stip-ui-version-check #homeView::after'));

const publicEntry = startup(false);
assert.equal(publicEntry.classes.size, 0);
publicEntry.timers[0].callback();
assert.equal(publicEntry.classes.size, 0);

// BFCache recovery keeps the existing short release, without forcing navigation.
const restored = startup(true);
restored.events.get('pageshow')({ persisted: true });
restored.timers.find(x => x.delay === 500).callback();
assert.equal(restored.classes.size, 0);
console.log('Startup guard: stalled parser, loading status, public entry and BFCache passed.');
