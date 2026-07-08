/* ============================================================
   Proof — "Same hardware, two outcomes." (/technology/)
   Two identical simulated plants track one target on one shared noise
   sequence. Left: fixed-gain PID on raw differenced encoder signals.
   Right: Kalman + one-tick prediction, PTOS governor, feedforward, DOB.
   Text lives in the DOM (i18n); canvas draws geometry only. Honors
   prefers-reduced-motion (+ play toggle), pauses off-screen, fixed-step
   sim clock (tab-throttle immune). #still swaps in a static image.
   ============================================================ */
(function () {
  'use strict';
  var cv = document.getElementById('proof-canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  var TAU = Math.PI * 2, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function wrap(a) { return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; }

  /* ---------------- identical "hardware" ---------------- */
  var J = 1.0, B = 0.15, TMAX = 6.0;
  var QUANT = 1.5 * D2R, NOISE = 0.5 * D2R;
  var LAT = 1;                              // 1-tick sensing latency @240Hz (both sides)
  var DT = 1 / 240, SUB = 4;
  var A_MAX = 0.8 * TMAX / J;               // trajectory accel cap — feedback headroom
  var V_MAX = 6.0;
  var E_LIN = 0.06;                         // PTOS linear terminal radius (≈3.4°)
  var K_LIN = Math.sqrt(2 * A_MAX / E_LIN); // C0-continuous boundary match

  function gauss() {
    var u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function makeSide(kind) {
    return {
      kind: kind, th: 0, w: 0, measBuf: [], est: 0, estW: 0,
      I: 0, refTh: 0, refW: 0, dHat: 0, pHat: 0, tauPrev: 0,
      trail: [], errHist: [], inBand: -1, settle: null,
    };
  }
  var S = [makeSide('naive'), makeSide('linku')];
  var target = 0;

  function sense(side, n) {
    var m = Math.round((side.th + n * NOISE) / QUANT) * QUANT;
    side.measBuf.push(m);
    if (side.measBuf.length > LAT + 6) side.measBuf.shift();
    return side.measBuf[Math.max(0, side.measBuf.length - 1 - LAT)];
  }

  function stepSide(side, dt, n, distT) {
    var mLag = sense(side, n);
    var tq;
    if (side.kind === 'naive') {
      /* the status quo: ZN-style fixed-gain PID + encoder differencing
         (noise passes straight into D), crude integral clamp (windup on
         large steps), raw step commands — no trajectory, no model */
      var buf = side.measBuf;
      var i = Math.max(0, buf.length - 1 - LAT);
      var iPrev = Math.max(0, i - 3);
      var vel = wrap(buf[i] - buf[iPrev]) / (dt * (i - iPrev || 1));
      var e = wrap(target - mLag);
      side.I = Math.max(-0.6 * TMAX, Math.min(0.6 * TMAX, side.I + 5.0 * e * dt));
      tq = 9.0 * e + side.I - 1.5 * vel;
    } else {
      /* public best practice, deployed correctly:
         steady-state Kalman estimate + one-tick forward prediction →
         near-time-optimal trajectory (PTOS) → model feedforward +
         momentum disturbance observer + well-tuned feedback */
      var innov = wrap(mLag - side.est);
      side.est = wrap(side.est + side.estW * dt + 0.28 * innov);
      side.estW = side.estW + 9.0 * innov;             // ω≈46 rad/s, ζ≈0.72
      side.pHat += (side.tauPrev - B * side.estW + side.dHat) * dt;
      var pErr = J * side.estW - side.pHat;
      side.pHat += 24 * pErr * dt;                     // DOB ω≈12 rad/s, ζ≈1
      side.dHat = Math.max(-TMAX, Math.min(TMAX, side.dHat + 144 * pErr * dt));
      // PTOS: sqrt profile far out, linear terminal zone near the target —
      // pure sqrt limit-cycles under discretization (measured), linear kills it
      var eR = wrap(target - side.refTh), ae = Math.abs(eR);
      var vProf = ae < E_LIN ? K_LIN * ae : Math.sqrt(2 * A_MAX * ae);
      var vDes = (eR >= 0 ? 1 : -1) * Math.min(vProf, V_MAX);
      var applied = Math.max(-A_MAX * dt, Math.min(A_MAX * dt, vDes - side.refW));
      side.refW += applied;
      side.refTh = wrap(side.refTh + side.refW * dt);
      var aRef = applied / dt;
      var predTh = wrap(side.est + side.estW * dt * (LAT + 1));
      tq = J * aRef + B * side.refW
        + 40.0 * wrap(side.refTh - predTh) + 11.0 * (side.refW - side.estW)
        - side.dHat;
    }
    tq = Math.max(-TMAX, Math.min(TMAX, tq));
    if (side.kind !== 'naive') side.tauPrev = tq;
    side.w += ((tq - B * side.w + distT) / J) * dt;
    side.th = wrap(side.th + side.w * dt);
  }

  var dist = 0;
  function physics() {
    for (var s = 0; s < SUB; s++) {
      var n = gauss(), envN = gauss() * 0.15;
      stepSide(S[0], DT, n, dist + envN);
      stepSide(S[1], DT, n, dist + envN);
      dist *= Math.exp(-DT * 6);
    }
  }

  /* ---------------- target + events (jump = stats origin) ---------------- */
  var lastJump = 0, jumpT = -1, pointerT = -10;
  function markJump(t) {
    jumpT = t;
    S.forEach(function (s) { s.inBand = -1; s.settle = null; });
  }
  function autoTarget(t) {
    if (t - pointerT < 3.5) { lastJump = t; return; } // interaction cooldown keeps deferring
    if (t - lastJump > 6.0) {
      lastJump = t;
      target = wrap(target + (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.3));
      markJump(t);
    }
  }
  function settleTrack(t) {
    S.forEach(function (s) {
      if (jumpT < 0 || s.settle !== null) return;
      if (Math.abs(wrap(target - s.th)) < 2 * D2R) {
        if (s.inBand < 0) s.inBand = t;
        else if (t - s.inBand > 0.3) s.settle = s.inBand - jumpT;
      } else s.inBand = -1;
    });
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
    R = Math.min(Wc * 0.155, Hc * 0.30);
    CX = [Wc * 0.27, Wc * 0.73]; CY = Hc * 0.36;
    BY = Hc * 0.76; BH = Hc * 0.15; BW = Math.min(Wc * 0.34, 460);
  }

  var CREAM = '#e8e6e0', LINE = 'rgba(232,230,224,.12)', MUTED = '#6a6a6a';
  var STEEL = '#8194ab', STEEL_D = 'rgba(129,148,171,';
  var ORDER = '#e8b478', ORDER_HI = '#f7d9a8', ORDER_D = 'rgba(232,180,120,';

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
    ctx.strokeStyle = i ? ORDER : STEEL; ctx.lineWidth = 1.3;
    if (i) { ctx.shadowColor = ORDER_D + '0.35)'; ctx.shadowBlur = 6; }
    ctx.beginPath();
    for (var k = 0; k < n; k++) {
      var x = x0 + BW - (n - 1 - k) * (BW / (HIST - 1));
      var y = y1 - Math.min(h[k], 50) / 50 * BH;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  var R0 = document.getElementById('proof-r0'), R1 = document.getElementById('proof-r1');
  var S0 = document.getElementById('proof-s0'), S1 = document.getElementById('proof-s1');
  var SETTLE_WORD = cv.getAttribute('data-l-settle') || 'settling';
  var lastTxt = -1;
  function rms(h) { var s = 0; for (var k = 0; k < h.length; k++) s += h[k] * h[k]; return Math.sqrt(s / (h.length || 1)); }
  function draw(t) {
    ctx.clearRect(0, 0, Wc, Hc);
    drawRing(0); drawRing(1);
    drawStrip(0); drawStrip(1);
    if (t - lastTxt > 0.2) {
      lastTxt = t;
      if (R0) R0.textContent = 'RMS ' + rms(S[0].errHist).toFixed(1) + '°';
      if (R1) R1.textContent = 'RMS ' + rms(S[1].errHist).toFixed(1) + '°';
      if (S0) S0.textContent = S[0].settle !== null ? SETTLE_WORD + ' ' + S[0].settle.toFixed(1) + ' s' : SETTLE_WORD + ' —';
      if (S1) S1.textContent = S[1].settle !== null ? SETTLE_WORD + ' ' + S[1].settle.toFixed(1) + ' s' : SETTLE_WORD + ' —';
    }
  }

  /* ---------------- interaction ---------------- */
  var perfT = 0;
  function pointerTarget(e) {
    var r = cv.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var cx = (x < Wc / 2) ? CX[0] : CX[1];
    target = wrap(-Math.atan2(y - CY, x - cx));
    pointerT = perfT;
  }
  cv.addEventListener('pointermove', pointerTarget, { passive: true });
  cv.addEventListener('pointerdown', function (e) {
    pointerTarget(e);
    dist = (Math.random() < 0.5 ? -1 : 1) * 30;
    markJump(perfT);
  });

  /* ---------------- main loop ---------------- */
  var prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    || location.hash.indexOf('reduce') >= 0;
  var still = location.hash.indexOf('still') >= 0;
  var running = !prefersReduced && !still, inView = true, rafId = 0;

  var simT = 0;
  function loop() {
    rafId = requestAnimationFrame(loop);
    simT += SUB * DT;      // fixed-step sim clock: immune to tab/scroll pauses
    perfT = simT;
    autoTarget(simT);
    physics(); record(simT); draw(simT);
  }
  function start() { if (!rafId && running && inView) rafId = requestAnimationFrame(loop); }
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
  if (btn && prefersReduced && !still) {
    btn.hidden = false;
    btn.addEventListener('click', function () {
      running = !running;
      btn.textContent = running ? (btn.getAttribute('data-pause') || 'Pause')
        : (btn.getAttribute('data-play') || 'Play');
      if (running) start(); else stop();
    });
  }

  var rT = 0;
  addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(resize, 120); });

  resize();

  // introspection handle (verification tooling; no behavior)
  window.__proof = {
    get simT() { return simT; }, get jumpT() { return jumpT; },
    get lastJump() { return lastJump; }, get pointerT() { return pointerT; },
    get running() { return running && !!rafId; },
    get settles() { return [S[0].settle, S[1].settle]; },
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
      var eL = Math.abs(wrap(target - S[0].th)) * R2D;
      if (tW - t0 > 1.2 && eL > 15 && S[1].settle !== null) break;
    }
    simT = tW; perfT = tW; lastJump = tW;
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
