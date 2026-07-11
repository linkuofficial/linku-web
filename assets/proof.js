/* Settling-stat event state is kept pure so Node can test the same logic the
   browser uses. It deliberately tracks the target at the last marked event:
   a pointer aim that materially changes that target starts a fresh window. */
var ProofStats = (function () {
  'use strict';
  var TAU = Math.PI * 2;
  function wrap(a) { return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
  function create(sides, threshold) {
    var jumpT = -1, jumpTarget = 0;
    function mark(t, target) {
      jumpT = t; jumpTarget = target;
      sides.forEach(function (s) { s.inBand = -1; s.settle = null; });
    }
    function targetChanged(t, target) {
      if (jumpT < 0 || Math.abs(wrap(target - jumpTarget)) >= threshold) {
        mark(t, target);
        return true;
      }
      return false;
    }
    function settle(t, target, band, hold) {
      sides.forEach(function (s) {
        if (jumpT < 0 || s.settle !== null) return;
        if (Math.abs(wrap(target - s.th)) < band) {
          if (s.inBand < 0) s.inBand = t;
          else if (t - s.inBand > hold) s.settle = s.inBand - jumpT;
        } else s.inBand = -1;
      });
    }
    return {
      mark: mark, targetChanged: targetChanged, settle: settle,
      get jumpT() { return jumpT; }, get jumpTarget() { return jumpTarget; },
    };
  }
  return { wrap: wrap, create: create };
})();

/* The controller/plant core is also pure: browser rendering and deterministic
   Node regression tests step the exact same dynamics. */
var ProofDynamics = (function () {
  'use strict';
  var TAU = Math.PI * 2, D2R = Math.PI / 180;
  var J = 1.0, B = 0.15, TMAX = 6.0;
  var QUANT = 1.5 * D2R, NOISE = 0.5 * D2R;
  var LAT = 1, DT = 1 / 240, SUB = 4;
  var A_MAX = 0.8 * TMAX / J, V_MAX = 6.0, E_LIN = 0.06;
  var K_LIN = Math.sqrt(2 * A_MAX / E_LIN);
  var PID_KP = 20, PID_KD = 5.8, PID_KI = 12, PID_WF = 20, PID_ND = 6;
  function wrap(a) { return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function makeSide(kind) {
    return {
      kind: kind, th: 0, w: 0, measBuf: [], est: 0, estW: 0,
      I: 0, vF: 0, refTh: 0, refW: 0, dHat: 0, pHat: 0, tauPrev: 0,
      trail: [], errHist: [], inBand: -1, settle: null,
    };
  }
  function sense(side, n) {
    var m = Math.round((side.th + n * NOISE) / QUANT) * QUANT;
    side.measBuf.push(m);
    if (side.measBuf.length > LAT + PID_ND + 2) side.measBuf.shift();
    side.lagIdx = Math.max(0, side.measBuf.length - 1 - LAT);
    return side.measBuf[side.lagIdx];
  }
  function stepSide(side, target, dt, n, distT) {
    var mLag = sense(side, n), tq;
    if (side.kind === 'naive') {
      var buf = side.measBuf, i = side.lagIdx;
      var iPrev = Math.max(0, i - PID_ND);
      var vRaw = wrap(buf[i] - buf[iPrev]) / (dt * (i - iPrev || 1));
      side.vF += (1 - Math.exp(-PID_WF * dt)) * (vRaw - side.vF);
      var e = wrap(target - mLag);
      var unsat = PID_KP * e + side.I - PID_KD * side.vF;
      tq = clamp(unsat, -TMAX, TMAX);
      if (unsat === tq || e * unsat < 0) side.I = clamp(side.I + PID_KI * e * dt, -0.9 * TMAX, 0.9 * TMAX);
    } else {
      var innov = wrap(mLag - side.est);
      side.est = wrap(side.est + side.estW * dt + 0.28 * innov);
      side.estW += 9.0 * innov;
      side.pHat += (side.tauPrev - B * side.estW + side.dHat) * dt;
      var pErr = J * side.estW - side.pHat;
      side.pHat += 24 * pErr * dt;
      side.dHat = clamp(side.dHat + 144 * pErr * dt, -TMAX, TMAX);
      var eR = wrap(target - side.refTh), ae = Math.abs(eR);
      var vProf = ae < E_LIN ? K_LIN * ae : Math.sqrt(2 * A_MAX * ae);
      var vDes = (eR >= 0 ? 1 : -1) * Math.min(vProf, V_MAX);
      var applied = clamp(vDes - side.refW, -A_MAX * dt, A_MAX * dt);
      side.refW += applied;
      side.refTh = wrap(side.refTh + side.refW * dt);
      var predTh = wrap(side.est + side.estW * dt * (LAT + 1));
      tq = J * (applied / dt) + B * side.refW
        + 40.0 * wrap(side.refTh - predTh) + 11.0 * (side.refW - side.estW)
        - side.dHat;
    }
    tq = clamp(tq, -TMAX, TMAX);
    if (side.kind !== 'naive') side.tauPrev = tq;
    side.w += ((tq - B * side.w + distT) / J) * dt;
    side.th = wrap(side.th + side.w * dt);
  }
  return {
    config: { DT: DT, SUB: SUB, D2R: D2R },
    makeSide: makeSide,
    stepSide: stepSide,
  };
})();
if (typeof module !== 'undefined' && module.exports) {
  ProofStats.dynamics = ProofDynamics;
  module.exports = ProofStats;
}

/* ============================================================
   Proof — "Same hardware, two outcomes." (/technology/)
   Two identical simulated plants, one shared noise sequence. Left: a
   COMPETENT fixed-gain PID (not a strawman — always converges, ~2.5x
   slower). Right: Kalman + prediction, PTOS, feedforward, DOB. The gap
   is structural, not bad tuning. Text in DOM (i18n); canvas geometry
   only. Reduced-motion (+ play toggle), off-screen pause, wall-clock
   fixed-DT stepping. #still swaps a static image.
   ============================================================ */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var cv = document.getElementById('proof-canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  var TAU = Math.PI * 2, D2R = ProofDynamics.config.D2R, R2D = 180 / Math.PI;
  var wrap = ProofStats.wrap;
  var random = typeof window.__proofRandom === 'function' ? window.__proofRandom : Math.random;

  // solid palette tokens come from the stylesheet (single source of truth)
  var rootCss = getComputedStyle(document.documentElement);
  function tok(name, fb) { var v = rootCss.getPropertyValue(name).trim(); return v || fb; }
  var CREAM = tok('--cream', '#e8e6e0'), MUTED = tok('--muted', '#6a6a6a');
  var STEEL = tok('--steel', '#8194ab'), ORDER = tok('--amber', '#e8b478');
  var ORDER_HI = '#f7d9a8', LINE = 'rgba(232,230,224,.12)';
  var STEEL_D = 'rgba(129,148,171,', ORDER_D = 'rgba(232,180,120,';

  /* ---------------- identical simulated plant ---------------- */
  var DT = ProofDynamics.config.DT, SUB = ProofDynamics.config.SUB;

  function gauss() {
    var u = 0, v = 0;
    while (!u) u = random();
    while (!v) v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  var makeSide = ProofDynamics.makeSide;
  var S = [makeSide('naive'), makeSide('linku')];
  var target = 0;

  var dist = 0;
  function physics() {
    for (var s = 0; s < SUB; s++) {
      var n = gauss(), envN = gauss() * 0.15;
      ProofDynamics.stepSide(S[0], target, DT, n, dist + envN);
      ProofDynamics.stepSide(S[1], target, DT, n, dist + envN);
      dist *= Math.exp(-DT * 6);
    }
  }

  /* ---------------- target + events (jump = stats origin) ---------------- */
  var lastJump = 0, pointerT = -10;
  var stats = ProofStats.create(S, 4 * D2R);
  function markJump(t) {
    stats.mark(t, target);
  }
  function autoTarget(t) {
    if (t - pointerT < 3.5) { lastJump = t; return; } // interaction cooldown keeps deferring
    if (t - lastJump > 6.0) {
      lastJump = t;
      target = wrap(target + (random() < 0.5 ? -1 : 1) * (0.9 + random() * 1.3));
      markJump(t);
    }
  }
  function settleTrack(t) {
    stats.settle(t, target, 2 * D2R, 0.3);
  }

  /* ---------------- layout: rings above, error strips below ---------------- */
  var Wc = 0, Hc = 0, R = 0, CX = [0, 0], CY = 0, BY = 0, BH = 0, BW = 0;
  function resize() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    Wc = r.width; Hc = r.height;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // narrow/portrait (phones): bigger rings, higher-centred, error strips
    // pulled up so the instrument fills the frame instead of floating in a
    // tall box with dead space below (desktop layout unchanged)
    var narrow = Wc < 620;
    R = narrow ? Math.min(Wc * 0.20, Hc * 0.21) : Math.min(Wc * 0.155, Hc * 0.30);
    CX = [Wc * 0.27, Wc * 0.73];
    CY = narrow ? Hc * 0.33 : Hc * 0.36;
    BY = narrow ? Hc * 0.68 : Hc * 0.76;
    BH = narrow ? Hc * 0.16 : Hc * 0.15;
    BW = Math.min(narrow ? Wc * 0.40 : Wc * 0.34, 460);
  }

  var HIST = 240; // ~4 s of error history
  function record(t) {
    S.forEach(function (s) {
      s.trail.push(s.th); if (s.trail.length > 64) s.trail.shift();
      s.errHist.push(Math.abs(wrap(target - s.th)) * R2D);
      if (s.errHist.length > HIST) s.errHist.shift();
    });
    settleTrack(t);
  }

  function drawRing(i) {
    var cx = CX[i], cy = CY, side = S[i];
    var mainD = i ? ORDER_D : STEEL_D;

    var err = wrap(target - side.th);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R * 0.985, -side.th, -side.th - err, err > 0);
    ctx.closePath();
    ctx.fillStyle = mainD + '0.10)'; ctx.fill();

    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, TAU); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1;

    var tr = side.trail, n = tr.length;
    for (var k = 1; k < n; k++) {
      var d = wrap(tr[k] - tr[k - 1]);
      if (Math.abs(d) < 1e-4) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -tr[k - 1], -tr[k], d > 0);
      ctx.strokeStyle = mainD + (0.03 + 0.30 * (k / n)) + ')';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    var ta = -target;
    ctx.strokeStyle = CREAM; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ta) * (R + 7), cy + Math.sin(ta) * (R + 7));
    ctx.lineTo(cx + Math.cos(ta) * (R + 17), cy + Math.sin(ta) * (R + 17));
    ctx.stroke();

    var aa = -side.th;
    ctx.strokeStyle = mainD + '0.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R); ctx.stroke();
    if (i) { ctx.shadowColor = ORDER_D + '0.55)'; ctx.shadowBlur = 10; }
    ctx.fillStyle = i ? ORDER_HI : STEEL;
    ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R, 4.2, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = MUTED;
    ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, TAU); ctx.fill();
  }

  /* error-over-time strip: flat = good; 50° full scale, newest at right */
  function drawStrip(i) {
    var side = S[i], x0 = CX[i] - BW / 2, y1 = BY + BH;
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0 + BW, y1); ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(x0, BY); ctx.lineTo(x0 + BW, BY); ctx.stroke();
    ctx.globalAlpha = 1;
    var h = side.errHist, n = h.length;
    if (n < 2) return;
    // no shadowBlur: canvas shadows force a slow blur pass per stroke
    ctx.strokeStyle = i ? ORDER : STEEL; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (var k = 0; k < n; k++) {
      var x = x0 + BW - (n - 1 - k) * (BW / (HIST - 1));
      var y = y1 - Math.min(h[k], 50) / 50 * BH;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // one number per side: settling time — definitions live in the spec fold
  var S0 = document.getElementById('proof-s0'), S1 = document.getElementById('proof-s1');
  var SETTLE_WORD = cv.getAttribute('data-l-settle') || 'settling';
  var lastTxt = -1;
  function draw(t) {
    ctx.clearRect(0, 0, Wc, Hc);
    drawRing(0); drawRing(1);
    drawStrip(0); drawStrip(1);
    if (t - lastTxt > 0.2) {
      lastTxt = t;
      if (S0) S0.textContent = S[0].settle !== null ? SETTLE_WORD + ' ' + S[0].settle.toFixed(1) + ' s' : SETTLE_WORD + ' —';
      if (S1) S1.textContent = S[1].settle !== null ? SETTLE_WORD + ' ' + S[1].settle.toFixed(1) + ' s' : SETTLE_WORD + ' —';
    }
  }

  /* ---------------- interaction ---------------- */
  // aim = set the shared target to the angle under the point; disturb = kick
  // both sides equally. Kept as separate verbs so touch can bind them to
  // separate gestures (a drag-to-aim on a phone just fights page scrolling).
  function aimAt(e) {
    var r = cv.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var cx = (x < Wc / 2) ? CX[0] : CX[1];
    target = wrap(-Math.atan2(y - CY, x - cx));
    pointerT = simT;
    stats.targetChanged(simT, target);
  }
  function disturb() {
    dist = (random() < 0.5 ? -1 : 1) * 30;
    markJump(simT);
  }
  function newTarget() {
    target = wrap(target + (random() < 0.5 ? -1 : 1) * (0.9 + random() * 1.3));
    pointerT = simT;
    markJump(simT);
  }
  var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (FINE) {
    // desktop: cursor aims continuously, click also disturbs
    cv.addEventListener('pointermove', aimAt, { passive: true });
    cv.addEventListener('pointerdown', function (e) { aimAt(e); disturb(); });
  } else {
    // touch: a genuine tap aims (click never fires mid-scroll, so it can't
    // hijack the page), and a dedicated button injects the disturbance —
    // aim and disturb never collide on one gesture
    cv.addEventListener('click', aimAt);
  }
  var tb = document.getElementById('proof-target');
  var db = document.getElementById('proof-disturb');
  if (tb) tb.addEventListener('click', newTarget);
  if (db) db.addEventListener('click', disturb);

  /* ---------------- main loop ---------------- */
  // exact-match dev flags — substring matching would misfire on future
  // anchors like #stillness (render.js uses the same contract)
  var prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    || location.hash === '#reduce';
  var still = location.hash === '#still';
  var running = !prefersReduced && !still, inView = true, rafId = 0;

  // wall-clock accumulator in fixed DT chunks: refresh-rate independent
  // (120/144 Hz), settle seconds = real seconds; clamp swallows tab-away gaps
  var simT = 0, simAcc = 0, lastTs = 0;
  var CHUNK = SUB * DT;
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (!lastTs) { lastTs = ts; return; }
    simAcc += Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    var stepped = false;
    while (simAcc >= CHUNK) {
      simAcc -= CHUNK;
      simT += CHUNK;
      autoTarget(simT);
      physics(); record(simT);
      stepped = true;
    }
    if (stepped) draw(simT);
  }
  function start() { if (!rafId && running && inView) { lastTs = 0; rafId = requestAnimationFrame(loop); } }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      // batched entries arrive oldest-first (e.g. after a hash jump) — only
      // the newest reflects the current state
      inView = es[es.length - 1].isIntersecting;
      if (inView) start(); else stop();
    }, { threshold: 0.05 }).observe(cv);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  var btn = document.getElementById('proof-play');
  function syncButton() {
    if (!btn) return;
    btn.textContent = running ? (btn.getAttribute('data-pause') || 'Pause')
      : (btn.getAttribute('data-play') || 'Play');
    btn.setAttribute('aria-pressed', running ? 'true' : 'false');
  }
  if (btn && !still) {
    syncButton();
    btn.addEventListener('click', function () {
      running = !running;
      syncButton();
      if (running) start(); else stop();
    });
  }
  document.addEventListener('linku-motion-toggle', function (e) {
    running = !!(e.detail && e.detail.running);
    syncButton();
    if (running) start(); else stop();
  });

  var rT = 0;
  addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      resize();
      if (!rafId) draw(simT); // setting canvas size wipes it — repaint stills
    }, 120);
  });

  resize();

  // introspection handle (verification tooling; no behavior)
  window.__proof = {
    get simT() { return simT; }, get jumpT() { return stats.jumpT; },
    get jumpTarget() { return stats.jumpTarget; }, get target() { return target; },
    get lastJump() { return lastJump; }, get pointerT() { return pointerT; },
    get running() { return running && !!rafId; },
    get settles() { return [S[0].settle, S[1].settle]; }, newTarget: newTarget,
  };

  /* warm-up; still/reduced freeze at the most telling moment: right side
     settled, left side still fighting */
  var tW = 0;
  function warmStep() { physics(); tW += DT * SUB; record(tW); }
  for (var k = 0; k < Math.round(2.5 / (DT * SUB)); k++) warmStep();

  if (still || prefersReduced) {
    target = wrap(target + 1.9);
    markJump(tW);
    var t0 = tW;
    while (tW - t0 < 3.5) {
      warmStep();
      // freeze at the telling moment: right settled, competent left still
      // closing in (it always settles too — just later)
      if (tW - t0 > 1.4 && S[1].settle !== null && S[0].settle === null) break;
    }
    simT = tW; lastJump = tW;
    draw(tW + 1);
    if (still) {
      try {
        var img = document.createElement('img');
        img.alt = cv.getAttribute('aria-label') || '';
        img.src = cv.toDataURL('image/png');
        img.style.cssText = 'display:block;width:100%;height:' + Hc + 'px;';
        cv.replaceWith(img);
      } catch (e) { }
    }
  } else {
    start();
  }
})();
