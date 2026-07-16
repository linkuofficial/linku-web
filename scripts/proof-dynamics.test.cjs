'use strict';

const assert = require('node:assert/strict');
const proof = require('../assets/proof.js');
const { dynamics } = proof;
const { DT, SUB, D2R } = dynamics.config;

function seededRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return function random() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function simulate({ seed, target, disturbance = 0, maxTime = 8 }) {
  const random = seededRandom(seed);
  function gauss() {
    let u = 0, v = 0;
    while (!u) u = random();
    while (!v) v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
  }

  const sides = [dynamics.makeSide('naive'), dynamics.makeSide('linku')];
  const finiteFields = [
    'th', 'w', 'est', 'estW', 'I', 'vF', 'refTh', 'refW',
    'dHat', 'pHat', 'tauPrev',
  ];
  let command = 0;
  let disturbanceTorque = 0;

  function chunk() {
    for (let i = 0; i < SUB; i++) {
      const sensingNoise = gauss();
      const ambient = gauss() * 0.15;
      dynamics.stepSide(sides[0], command, DT, sensingNoise, disturbanceTorque + ambient);
      dynamics.stepSide(sides[1], command, DT, sensingNoise, disturbanceTorque + ambient);
      disturbanceTorque *= Math.exp(-DT * 6);
    }
    for (const side of sides) {
      for (const field of finiteFields) {
        assert.ok(Number.isFinite(side[field]), field + ' must remain finite');
      }
    }
  }

  // Match the browser warm-up before a published target event.
  for (let i = 0; i < Math.round(2.5 / (DT * SUB)); i++) chunk();

  command = target;
  disturbanceTorque = disturbance;
  const tracker = proof.create(sides, 4 * D2R);
  tracker.mark(0, command);
  let t = 0;
  while (t < maxTime && sides.some((side) => side.settle === null)) {
    chunk();
    t += DT * SUB;
    tracker.settle(t, command, 2 * D2R, 0.3);
  }

  return { sides, settles: sides.map((side) => side.settle) };
}

// The exact scenario used by the static/reduced-motion published frame keeps
// its reviewed performance envelope.
const published = simulate({ seed: 0x4c494e4b, target: 1.9, maxTime: 5 });
assert.ok(published.settles.every(Number.isFinite), 'both competent controllers must settle');
assert.ok(published.settles[1] < published.settles[0],
  'model-based controller must settle before the fixed-gain PID in the published scenario');
assert.ok(published.settles[1] > 0.6 && published.settles[1] < 1.6,
  'model-based settling time must stay within the reviewed regression envelope');
assert.ok(published.settles[0] > 1.8 && published.settles[0] < 3.6,
  'PID settling time must stay within the reviewed regression envelope');

// Boundary matrix: cover multiple deterministic noise sequences, both signs
// of the UI's impulse disturbance, ordinary target steps, and a deliberately
// difficult 2.5 rad pointer target. The difficult edge only promises stable
// recovery; the page does not claim one controller wins every possible event.
const seeds = [1, 2, 3, 0x4c494e4b];
const targets = [0.9, 1.9, -1.9, 2.5];
const disturbances = [0, 30, -30];
let scenarios = 0;
let modelFaster = 0;
for (const seed of seeds) {
  for (const target of targets) {
    for (const disturbance of disturbances) {
      const result = simulate({ seed, target, disturbance });
      scenarios++;
      assert.ok(result.settles.every(Number.isFinite),
        `both controllers must settle (seed=${seed}, target=${target}, disturbance=${disturbance})`);
      if (result.settles[1] < result.settles[0]) modelFaster++;
      if (Math.abs(target) <= 1.9) {
        assert.ok(result.settles[1] < result.settles[0],
          `model-based side must lead in the reviewed operating range (seed=${seed}, target=${target}, disturbance=${disturbance})`);
      }
    }
  }
}

console.log('proof dynamics: PASS — published PID ' + published.settles[0].toFixed(2)
  + ' s, model-based ' + published.settles[1].toFixed(2) + ' s; matrix '
  + scenarios + ' scenarios, model-based faster in ' + modelFaster);
