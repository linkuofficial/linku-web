/* Enhancement gate: CSS remains readable with no JS and only hides reveal
   targets after this script has actually started. */
document.documentElement.classList.add('js');

/* ---------- Tweak runtime defaults (read by vanilla scripts) ---------- */
window.__tweaks = {
  stagger: 120,
  heroRise: 0.08,
  statementRise: 0.05
};

/* ---------- Remember language choice (drives first-visit auto-routing on the en pages) ---------- */
(function () {
  try {
    document.querySelectorAll('.lang-switch a[hreflang]').forEach(function (a) {
      a.addEventListener('click', function () {
        var hl = (a.getAttribute('hreflang') || '').toLowerCase();
        var v = hl.indexOf('zh') === 0 ? 'zh' : (hl.indexOf('ja') === 0 ? 'ja' : 'en');
        try { localStorage.setItem('linku_lang', v); } catch (e) {}
      });
    });
  } catch (e) {}
})();

/* The brand scene (WebGL gimbal core on #particles) lives in /assets/render.js. */

/* ---------- Custom dot cursor ---------- */
(function () {
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.documentElement.classList.add('cursor-ready');
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

/* ---------- Pointer glow on list rows (pillars / tech items) ---------- */
(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.pillar, .tech-item').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
    }, { passive: true });
  });
})();

/* ---------- Scroll reveal ---------- */
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
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
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
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

/* ---------- Parallax depth (typography only — the scene parallax lives in render.js) ---------- */
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
