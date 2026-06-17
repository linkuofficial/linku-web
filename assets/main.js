/* ---------- Tweak runtime defaults (read by vanilla scripts) ---------- */
window.__tweaks = {
  stagger: 120,
  particleParallax: 0.3,
  heroRise: 0.08,
  statementRise: 0.05
};

/* ---------- Particle background ---------- */
(function () {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let w, h, dpr, particles = [];
  let COUNT = 90;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  function init() {
    particles = [];
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 1.1 + 0.3) * dpr,
        vx: (Math.random() - 0.5) * 0.12 * dpr,
        vy: (Math.random() - 0.5) * 0.12 * dpr,
        a: Math.random() * 0.5 + 0.1,
        tw: Math.random() * 0.02 + 0.004
      });
    }
  }
  let t = 0;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    t += 1;
    const off = reduceMotion ? 0 :
      (((window.scrollY * dpr * (window.__tweaks.particleParallax || 0)) % h) + h) % h;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      let yy = p.y - off; if (yy < 0) yy += h;
      const alpha = p.a + Math.sin(t * p.tw) * 0.18;
      ctx.beginPath();
      ctx.arc(p.x, yy, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232, 230, 224, ' + Math.max(0, alpha) + ')';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.__setParticleCount = function (n) { COUNT = Math.round(n); init(); };
  resize(); init(); draw();
  addEventListener('resize', () => { resize(); init(); });
})();

/* ---------- Custom dot cursor ---------- */
(function () {
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
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
