/* ---------- Tweak runtime defaults (read by vanilla scripts) ---------- */
window.__tweaks = {
  stagger: 120,
  fieldParallax: 0.06,
  heroRise: 0.08,
  statementRise: 0.05
};

/* ============================================================
   Brand field — particles coalescing into a structure.
   "Intelligence, made physical": scattered points (data) draw
   together into a slowly-rotating 3D core (matter), then breathe.
   Rendered with WebGL (additive glow) when available; a single
   static 2D frame is the fallback. Honors prefers-reduced-motion
   by rendering one settled frame with no animation loop.
   ============================================================ */
(function () {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, R = 1, FOV = 1;
  let nowS = 0, curCyOff = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    cx = w / 2; cy = h / 2;
    R = Math.min(w, h) * 0.30;
    FOV = R * 3.2;
  }

  /* ---- geometry: a Fibonacci-sphere shell of points ---- */
  let N = 0;
  let sx, sy, sz, tx, ty, tz, seed, accent;
  function build() {
    N = w < 700 ? 900 : 1800;
    sx = new Float32Array(N); sy = new Float32Array(N); sz = new Float32Array(N);
    tx = new Float32Array(N); ty = new Float32Array(N); tz = new Float32Array(N);
    seed = new Float32Array(N); accent = new Uint8Array(N);
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const yy = 1 - (i / (N - 1)) * 2;            // 1 .. -1
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = GOLDEN * i;
      const dx = Math.cos(th) * rad, dz = Math.sin(th) * rad;
      const rr = R * (0.80 + Math.random() * 0.22); // shell thickness
      tx[i] = dx * rr; ty[i] = yy * rr; tz[i] = dz * rr;
      // scattered start — a wide volume the points fly in from
      sx[i] = (Math.random() - 0.5) * R * 5.0;
      sy[i] = (Math.random() - 0.5) * R * 5.0;
      sz[i] = (Math.random() - 0.5) * R * 5.0;
      seed[i] = Math.random();
      accent[i] = Math.random() < 0.17 ? 1 : 0;
    }
  }

  /* ---- per-frame projection into screen space ----
     F holds [x_css, y_css, size_css, alpha] per point. */
  let F;
  function update(pe, rotY, rotX, cyOff) {
    if (!F || F.length !== N * 4) F = new Float32Array(N * 4);
    const cY = Math.cos(rotY), sY = Math.sin(rotY);
    const cX = Math.cos(rotX), sX = Math.sin(rotX);
    const drift = R * 0.015 * pe;
    for (let i = 0; i < N; i++) {
      // rotate the target structure (Y then X)
      const x = tx[i], y = ty[i], z = tz[i];
      const x1 = x * cY + z * sY;
      const z1 = -x * sY + z * cY;
      let rx = x1;
      let ry = y * cX - z1 * sX;
      const rz = y * sX + z1 * cX;
      // gentle breathing once settled
      const ph = seed[i] * 6.2831853;
      rx += Math.sin(nowS * 0.6 + ph) * drift;
      ry += Math.cos(nowS * 0.5 + ph) * drift;
      // coalesce: scatter -> structure
      const px = sx[i] + (rx - sx[i]) * pe;
      const py = sy[i] + (ry - sy[i]) * pe;
      const pz = sz[i] + (rz - sz[i]) * pe;
      const s = FOV / (FOV + pz);
      const df = Math.max(0, Math.min(1, (s - 0.7) / 0.8)); // near = brighter
      const tw = 0.75 + Math.sin(nowS * (1.2 + seed[i]) + ph) * 0.25;
      const b = i * 4;
      F[b] = cx + px * s;
      F[b + 1] = cy + cyOff + py * s;
      F[b + 2] = (1.4 + df * 1.8) * s;
      F[b + 3] = (0.18 + df * 0.42) * tw * (0.25 + 0.75 * pe);
    }
  }

  /* ---- WebGL renderer ---- */
  let gl = null, prog = null, buf = null, glArr = null;
  const loc = {};
  const STRIDE = 7; // x, y, size, r, g, b, a
  function initGL() {
    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false, depth: false })
        || canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
    } catch (e) { gl = null; }
    if (!gl) return false;
    const vsSrc =
      'attribute vec2 a_pos; attribute float a_size; attribute vec4 a_col;' +
      'varying vec4 v_col;' +
      'void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); gl_PointSize = a_size; v_col = a_col; }';
    const fsSrc =
      'precision mediump float; varying vec4 v_col;' +
      'void main(){ float d = distance(gl_PointCoord, vec2(0.5));' +
      'float a = smoothstep(0.5, 0.04, d);' +
      'gl_FragColor = vec4(v_col.rgb, v_col.a * a); }';
    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('shader compile failed:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    const v = sh(gl.VERTEX_SHADER, vsSrc), f = sh(gl.FRAGMENT_SHADER, fsSrc);
    if (!v || !f) { gl = null; return false; }
    prog = gl.createProgram();
    gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);
    loc.pos = gl.getAttribLocation(prog, 'a_pos');
    loc.size = gl.getAttribLocation(prog, 'a_size');
    loc.col = gl.getAttribLocation(prog, 'a_col');
    buf = gl.createBuffer();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive — overlaps bloom
    gl.clearColor(0.039, 0.039, 0.039, 1); // matches --bg (#0a0a0a)
    return true;
  }

  function drawGL() {
    if (!glArr || glArr.length !== N * STRIDE) glArr = new Float32Array(N * STRIDE);
    let o = 0;
    for (let i = 0; i < N; i++) {
      const b = i * 4;
      glArr[o++] = (F[b] / w) * 2 - 1;
      glArr[o++] = 1 - (F[b + 1] / h) * 2;
      glArr[o++] = F[b + 2] * dpr;
      if (accent[i]) { glArr[o++] = 0.40; glArr[o++] = 0.62; glArr[o++] = 0.80; }
      else { glArr[o++] = 0.92; glArr[o++] = 0.905; glArr[o++] = 0.87; }
      glArr[o++] = F[b + 3];
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, glArr, gl.DYNAMIC_DRAW);
    const FB = 4, stride = STRIDE * FB;
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.size);
    gl.vertexAttribPointer(loc.size, 1, gl.FLOAT, false, stride, 2 * FB);
    gl.enableVertexAttribArray(loc.col);
    gl.vertexAttribPointer(loc.col, 4, gl.FLOAT, false, stride, 3 * FB);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  /* ---- 2D fallback (single static frame) ---- */
  function draw2D() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const b = i * 4;
      const a = Math.max(0, Math.min(1, F[b + 3]));
      ctx.beginPath();
      ctx.arc(F[b], F[b + 1], Math.max(0.4, F[b + 2]), 0, 6.2831853);
      ctx.fillStyle = accent[i]
        ? 'rgba(102,158,204,' + a + ')'
        : 'rgba(235,231,222,' + a + ')';
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- boot ---- */
  resize();
  build();
  const hasGL = initGL();

  // mouse tilt
  let tmx = 0, tmy = 0, cmx = 0, cmy = 0;
  if (!reduce) {
    addEventListener('mousemove', (e) => {
      tmx = (e.clientX / innerWidth) * 2 - 1;
      tmy = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  function renderStatic() {
    nowS = 0; curCyOff = 0;
    update(1, 0.6, -0.15, 0);
    if (hasGL) drawGL(); else draw2D();
  }

  let rotY = 0, prevTs = 0, startTs = 0;
  const INTRO = 2.2; // seconds
  function loop(ts) {
    if (document.hidden) { prevTs = 0; requestAnimationFrame(loop); return; }
    const t = ts / 1000;
    if (!startTs) startTs = t;
    const dt = prevTs ? Math.min(0.05, t - prevTs) : 0.016;
    prevTs = t;
    nowS = t - startTs;
    const pe = easeOutCubic(Math.min(1, nowS / INTRO));
    rotY += dt * 0.05;
    cmx += (tmx - cmx) * 0.04;
    cmy += (tmy - cmy) * 0.04;
    curCyOff = -Math.min(window.scrollY, innerHeight * 1.2) * (window.__tweaks.fieldParallax || 0);
    update(pe, rotY + cmx * 0.6, cmy * 0.4, curCyOff);
    drawGL();
    requestAnimationFrame(loop);
  }

  if (reduce || !hasGL) {
    renderStatic();
  } else {
    requestAnimationFrame(loop);
    // recover from a lost GL context
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
    canvas.addEventListener('webglcontextrestored', () => { if (initGL()) gl.viewport(0, 0, canvas.width, canvas.height); }, false);
  }

  addEventListener('resize', () => {
    resize();
    build();
    if (hasGL) gl.viewport(0, 0, canvas.width, canvas.height);
    if (reduce || !hasGL) renderStatic();
  }, { passive: true });
})();

/* ---------- Custom dot cursor ---------- */
(function () {
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let mx = innerWidth / 2, my = innerHeight / 2;
  let rx = mx, ry = my;
  addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  });
  function loop() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();
  document.querySelectorAll('a, button, [data-cursor="hover"]').forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });
})();

/* ---------- Magnetic interactive marks ---------- */
(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = document.querySelectorAll('.brand, .nav-links a, .contact-mail');
  els.forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = 'translate(' + (dx * 0.3).toFixed(2) + 'px,' + (dy * 0.3).toFixed(2) + 'px)';
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
})();

/* ---------- Scroll reveal ---------- */
(function () {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const stagger = (window.__tweaks && window.__tweaks.stagger) || 0;
        const delay = el.parentElement && el.parentElement.classList.contains('pillar-list')
          ? Array.from(el.parentElement.children).indexOf(el) * stagger : 0;
        setTimeout(() => el.classList.add('in'), delay);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  els.forEach((el) => io.observe(el));
})();

/* ---------- Statement word-group reveal ---------- */
(function () {
  const sb = document.querySelector('.statement-body');
  if (!sb) return;
  const groups = sb.querySelectorAll('.sg');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    groups.forEach((g) => g.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        groups.forEach((g, i) => setTimeout(() => g.classList.add('in'), i * 200));
        io.disconnect();
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });
  io.observe(sb);
})();

/* ---------- Parallax depth ---------- */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const heroTitle = document.querySelector('.hero-title');
  const statementBody = document.querySelector('.statement-body');
  let ticking = false;
  function frame() {
    const sy = window.scrollY;
    const T = window.__tweaks;
    if (heroTitle && sy < innerHeight * 1.3)
      heroTitle.style.transform = 'translateY(' + (sy * -(T.heroRise || 0)) + 'px)';
    if (statementBody) {
      const r = statementBody.getBoundingClientRect();
      const delta = (r.top + r.height / 2) - innerHeight / 2;
      statementBody.style.transform = 'translateY(' + (delta * -(T.statementRise || 0)) + 'px)';
    }
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(frame); ticking = true; }
  }, { passive: true });
  frame();
})();
