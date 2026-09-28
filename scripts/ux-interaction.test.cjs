'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function emitter(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    fire(type, detail = {}) { for (const fn of listeners.get(type) || []) fn(detail); },
  }, extra);
}
function classes() {
  const values = new Set();
  return { add: name => values.add(name), remove: name => values.delete(name),
    contains: name => values.has(name), toggle(name, on) { if (on) values.add(name); else values.delete(name); } };
}
function clock() {
  let id = 0, now = 0;
  const pending = new Map();
  return { pending, performance: { now: () => now },
    requestAnimationFrame(fn) { pending.set(++id, fn); return id; },
    cancelAnimationFrame(key) { pending.delete(key); },
    step(time) { now = time; const batch = [...pending.values()]; pending.clear(); for (const fn of batch) fn(time); },
  };
}
function cursorHarness(source) {
  const timing = clock();
  const root = emitter({ classList: classes() });
  const dot = { style: {} }, ring = { style: {}, classList: classes() };
  const fine = emitter({ matches: true }), reduced = emitter({ matches: false });
  const document = emitter({ hidden: false, documentElement: root,
    querySelector: selector => selector === '.cursor-dot' ? dot : ring, querySelectorAll: () => [] });
  const win = emitter();
  const context = { ...timing, document, innerWidth: 1000, innerHeight: 800,
    matchMedia: query => query.includes('reduced-motion') ? reduced : fine, addEventListener: win.addEventListener.bind(win) };
  const start = source.indexOf('/* ---------- Custom dot cursor ---------- */');
  const end = source.indexOf('/* ---------- Magnetic interactive marks ---------- */');
  vm.runInNewContext(source.slice(start, end), context);
  return { ...timing, root, dot, ring, fine, reduced, document, move: (x, y) => win.fire('mousemove', { clientX: x, clientY: y }) };
}
function proofHarness(source, { fine = true, reduced = false } = {}) {
  const timing = clock();
  const ctx = new Proxy({}, { get: (target, key) => target[key] || (() => {}) });
  const element = attrs => emitter({ disabled: false, hidden: true, textContent: '', getAttribute: name => attrs[name] || null });
  const elements = {
    'proof-canvas': Object.assign(element({}), { getContext: () => ctx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }) }),
    'proof-target': element({}), 'proof-disturb': element({}), 'proof-paused-note': element({}),
    'proof-play': element({ 'data-play': 'Play simulation', 'data-pause': 'Pause simulation' }),
  };
  const document = emitter({ hidden: false, documentElement: {}, getElementById: name => elements[name] });
  const win = emitter({ __proofRandom: () => 0.61 });
  vm.runInNewContext(source, { ...timing, document, window: win, location: { hash: '' }, devicePixelRatio: 1,
    matchMedia: query => ({ matches: query.includes('reduced-motion') ? reduced : fine }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener: win.addEventListener.bind(win), clearTimeout() {}, setTimeout() {} });
  return { ...timing, document, elements, proof: win.__proof };
}

const main = fs.readFileSync(path.join(__dirname, '../assets/main.js'), 'utf8');
const proofSource = fs.readFileSync(path.join(__dirname, '../assets/proof.js'), 'utf8');

// Cursor follows elapsed time, settles without a perpetual frame, and resumes once.
const positions = [];
for (const hz of [60, 120, 144]) {
  const h = cursorHarness(main);
  h.step(0); assert.equal(h.pending.size, 0, 'stationary cursor has no pending frame');
  h.move(900, 700); h.move(900, 700);
  assert.equal(h.pending.size, 1, 'movement must not duplicate the loop');
  for (let n = 1; n <= hz; n++) h.step(n * 1000 / hz);
  assert.equal(h.pending.size, 0, hz + ' Hz cursor settles');
  assert.match(h.ring.style.transform, /translate\(900px, 700px\)/);
  h.move(700, 500); h.root.fire('mouseleave');
  assert.equal(h.pending.size, 0, 'leaving the document cancels the cursor');
  assert.equal(h.root.classList.contains('cursor-ready'), false);
  h.move(710, 510); assert.equal(h.pending.size, 1, 'reentry restarts once');
  h.reduced.matches = true; h.reduced.fire('change');
  assert.equal(h.pending.size, 0, 'changing to reduced motion cancels frames');
  assert.equal(h.root.classList.contains('cursor-ready'), false, 'native cursor returns');
  h.move(800, 600); assert.equal(h.pending.size, 0, 'reduced motion stays idle');
  h.reduced.matches = false; h.reduced.fire('change'); assert.equal(h.pending.size, 1);
  h.document.hidden = true; h.document.fire('visibilitychange'); assert.equal(h.pending.size, 0);
  h.document.hidden = false; h.document.fire('visibilitychange'); assert.equal(h.pending.size, 1);
  h.fine.matches = false; h.fine.fire('change'); assert.equal(h.pending.size, 0);
  const cadence = cursorHarness(main); cadence.step(0); cadence.move(900, 700);
  for (let n = 1; n <= hz / 4; n++) cadence.step(n * 1000 / hz);
  positions.push(Number(cadence.ring.style.transform.match(/translate\(([\d.]+)px/)[1]));
}
assert.ok(Math.max(...positions) - Math.min(...positions) < 0.001, 'equal elapsed time produces equal cursor position');

// Paused input cannot create invisible target changes on either pointer model.
for (const fine of [true, false]) for (const reduced of [true, false]) {
  const h = proofHarness(proofSource, { fine, reduced });
  const { elements: e, proof } = h;
  if (!reduced) e['proof-play'].fire('click');
  assert.equal(e['proof-target'].disabled, true); assert.equal(e['proof-disturb'].disabled, true);
  assert.equal(e['proof-paused-note'].hidden, false);
  assert.equal(e['proof-play'].textContent, 'Play simulation');
  const initial = [proof.target, proof.jumpT, proof.pointerT];
  e['proof-target'].fire('click'); e['proof-disturb'].fire('click'); proof.newTarget();
  for (const type of ['pointermove', 'pointerdown', 'click']) e['proof-canvas'].fire(type, { clientX: 750, clientY: 50 });
  assert.deepEqual([proof.target, proof.jumpT, proof.pointerT], initial, 'paused input leaves simulation state unchanged');
  assert.equal(h.pending.size, 0, 'input never auto-resumes');
  e['proof-play'].fire('click');
  assert.equal(e['proof-target'].disabled, false); assert.equal(e['proof-paused-note'].hidden, true);
  assert.equal(h.pending.size, 1); proof.newTarget(); assert.notEqual(proof.target, initial[0]);
  h.document.fire('linku-motion-toggle', { detail: { running: false } });
  assert.equal(e['proof-disturb'].disabled, true); assert.equal(h.pending.size, 0);
  h.document.fire('linku-motion-toggle', { detail: { running: true } });
  assert.equal(e['proof-disturb'].disabled, false); assert.equal(h.pending.size, 1);
}
console.log('UX interactions: PASS (paused input, global/local controls, reduced-motion changes, idle cursor, 60/120/144 Hz)');
