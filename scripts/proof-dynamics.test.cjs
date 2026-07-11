'use strict';

const assert = require('node:assert/strict');
const proof = require('../assets/proof.js');
const { dynamics } = proof;
const { DT, SUB, D2R } = dynamics.config;

// Seeded source + Box–Muller: every run drives both controllers with the same
// repeatable sensing and ambient-noise sequence.
let seed = 0x4c494e4b;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function gauss() {
  let u = 0, v = 0;
  while (!u) u = random();
  while (!v) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

const sides = [dynamics.makeSide('naive'), dynamics.makeSide('linku')];
let target = 0;
function chunk() {
  for (let i = 0; i < SUB; i++) {
    const sensingNoise = gauss();
    const ambient = gauss() * 0.15;
    dynamics.stepSide(sides[0], target, DT, sensingNoise, ambient);
    dynamics.stepSide(sides[1], target, DT, sensingNoise, ambient);
  }
}

for (let i = 0; i < Math.round(2.5 / (DT * SUB)); i++) chunk();

target = 1.9;
const tracker = proof.create(sides, 4 * D2R);
tracker.mark(0, target);
let t = 0;
while (t < 5 && sides.some((side) => side.settle === null)) {
  chunk();
  t += DT * SUB;
  tracker.settle(t, target, 2 * D2R, 0.3);
}

assert.ok(sides.every((side) => side.settle !== null), 'both competent controllers must settle');
assert.ok(sides[1].settle < sides[0].settle,
  'model-based controller must settle before the fixed-gain PID in the published scenario');
assert.ok(sides[1].settle > 0.6 && sides[1].settle < 1.6,
  'model-based settling time must stay within the reviewed regression envelope');
assert.ok(sides[0].settle > 1.8 && sides[0].settle < 3.6,
  'PID settling time must stay within the reviewed regression envelope');

console.log('proof dynamics: PASS — PID ' + sides[0].settle.toFixed(2)
  + ' s, model-based ' + sides[1].settle.toFixed(2) + ' s');
