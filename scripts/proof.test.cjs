'use strict';

const assert = require('node:assert/strict');
const { create } = require('../assets/proof.js');

function side(th = 0) {
  return { th, inBand: -1, settle: null };
}

const sides = [side(), side()];
const tracker = create(sides, 4 * Math.PI / 180);

tracker.mark(1, 0);
sides[0].settle = 0.8;
sides[1].settle = 0.4;

assert.equal(tracker.targetChanged(2, 2 * Math.PI / 180), false,
  'sub-threshold pointer jitter must not restart statistics');
assert.deepEqual(sides.map((s) => s.settle), [0.8, 0.4]);

assert.equal(tracker.targetChanged(3, 20 * Math.PI / 180), true,
  'a material pointer aim must restart statistics');
assert.equal(tracker.jumpT, 3);
assert.ok(Math.abs(tracker.jumpTarget - 20 * Math.PI / 180) < 1e-12);
assert.deepEqual(sides.map((s) => s.settle), [null, null]);
assert.deepEqual(sides.map((s) => s.inBand), [-1, -1]);

sides.forEach((s) => { s.th = tracker.jumpTarget; });
tracker.settle(3.1, tracker.jumpTarget, 2 * Math.PI / 180, 0.3);
tracker.settle(3.5, tracker.jumpTarget, 2 * Math.PI / 180, 0.3);
assert.deepEqual(sides.map((s) => Number(s.settle.toFixed(1))), [0.1, 0.1]);

console.log('proof stats: PASS');
