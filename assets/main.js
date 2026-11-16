/* Enhancement gate: CSS remains readable with no JS and only hides reveal
   targets after this script has actually started. */
document.documentElement.classList.add('js');

/* …and hands the page back if this file dies: an error must never strand copy
   behind a reveal. Until the last line has run (js-ready) any uncaught error
   is this file's own. */
addEventListener('error', function (e) {
  const root = document.documentElement;
  if (root.classList.contains('js-ready') && !/\/assets\/main\.js/.test(e.filename || '')) return;
  root.classList.remove('js');
  root.classList.add('in');                 // releases every word mask (.in .wi)
  document.querySelectorAll('.sw').forEach((w) => w.classList.add('on'));
  document.querySelectorAll('.pillars.pin').forEach((p) => p.classList.remove('pin'));
});

/* The brand scene (#particles) lives in /assets/render.js. This file owns the
   document's own motion: cursor, type reveals, scroll choreography, page
   chrome — all enhancement; the page is complete without it. */

/* ---------- Custom dot cursor ---------- */
(function () {
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // nothing is drawn until the pointer has been seen (no ring parked mid-screen
  // on load), and nothing here reads layout while the page is still parsing
  let mx = 0, my = 0, rx = 0, ry = 0, raf = null;
  let last = null, inside = false;
  function enabled() {
    return fine.matches && !document.hidden && !reduced.matches && inside;
  }
  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    last = null;
  }
  function start() {
    if (raf === null && enabled()) {
      if (last === null) last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  function sync() {
    document.documentElement.classList.toggle('cursor-ready', enabled());
    if (enabled()) start(); else stop();
  }
  function loop(time) {
    raf = null;
    if (!enabled()) return;
    // Preserve the 60 Hz feel while keeping the same response at higher refresh rates.
    const dt = last === null ? 1000 / 60 : Math.min(100, Math.max(0, time - last));
    const alpha = 1 - Math.pow(1 - 0.16, dt / (1000 / 60));
    last = time;
    rx += (mx - rx) * alpha;
    ry += (my - ry) * alpha;
    const settled = Math.abs(mx - rx) < 0.1 && Math.abs(my - ry) < 0.1;
    if (settled) { rx = mx; ry = my; last = null; }
    ring.style.transform = 'translate(' + rx + 'px, ' + ry + 'px) translate(-50%, -50%)';
    if (!settled) start();
  }
  addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (!inside) { rx = mx; ry = my; }       // first sight / re-entry: the ring starts on the pointer
    inside = true;
    dot.style.transform = 'translate(' + mx + 'px, ' + my + 'px) translate(-50%, -50%)';
    sync();
  }, { passive: true });
  // Safari < 14 only has the older addListener
  [fine, reduced].forEach((mq) => (mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync)));
  document.addEventListener('visibilitychange', sync);
  document.documentElement.addEventListener('mouseleave', () => {
    inside = false;
    sync();
  });
  document.querySelectorAll('a, button, [data-cursor="hover"]').forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });
  sync();
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

/* ---------- Pointer glow on list rows (pillars / work / tech items) ---------- */
(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.pillar, .work-item, .tech-item').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
    }, { passive: true });
  });
})();

/* ---------- Cursor press state (the wall answers the same press with a ripple) ---------- */
(function () {
  const ring = document.querySelector('.cursor-ring');
  if (!ring) return;
  const up = () => ring.classList.remove('down');
  addEventListener('pointerdown', () => ring.classList.add('down'), { passive: true });
  addEventListener('pointerup', up, { passive: true });
  addEventListener('pointercancel', up, { passive: true });
})();

/* ---------- Type preparation: word masks, statement words, label rolls ----------
   Runs before the reveal observer. Text nodes are only wrapped, never
   rewritten: the copy in the DOM is the copy that shipped in the HTML. */
(function () {
  const lang = document.documentElement.lang || 'en';
  const cjk = lang !== 'en';
  let seg = null;
  try { if (cjk && window.Intl && Intl.Segmenter) seg = new Intl.Segmenter(lang, { granularity: 'word' }); } catch (e) { seg = null; }

  // words for Latin; dictionary segments (or single glyphs) for CJK, with
  // punctuation kept on the piece before it so a line never starts with it
  function pieces(text) {
    if (!cjk) return text.split(/(\s+)/);
    const out = [];
    const push = (s, wordLike) => {
      if (/^\s+$/.test(s)) out.push(s);
      else if (!wordLike && out.length && !/^\s+$/.test(out[out.length - 1])) out[out.length - 1] += s;
      else out.push(s);
    };
    if (seg) for (const p of seg.segment(text)) push(p.segment, p.isWordLike);
    else for (const ch of text) push(ch, /[\p{L}\p{N}]/u.test(ch));
    return out;
  }

  function wrap(el, cls, inner) {
    let n = 0;
    (function walk(node) {
      Array.from(node.childNodes).forEach((c) => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          pieces(c.nodeValue).forEach((p) => {
            if (!p) return;
            if (!p.trim()) { frag.appendChild(document.createTextNode(p)); return; }
            const w = document.createElement('span');
            w.className = cls;
            if (inner) {
              w.setAttribute('aria-hidden', 'true');   // the heading's aria-label carries the sentence
              const wi = document.createElement('span');
              wi.className = inner;
              wi.textContent = p;
              wi.style.setProperty('--i', n++);
              w.appendChild(wi);
            } else w.textContent = p;
            frag.appendChild(w);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1 && !c.classList.contains('arrow')) walk(c);
      });
    })(el);
  }

  // word masks are inline-blocks a screen reader would stop on one by one, so
  // a split heading is read from its label, like the hero title (headings only)
  document.querySelectorAll('.pillar-title, .work-title, .contact-big, .tech-title, .proof-title').forEach((el) => {
    if (!/^H[1-6]$/.test(el.tagName) || el.children.length) return;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    wrap(el, 'w', 'wi');
    el.classList.add('split');
  });
  document.querySelectorAll('.statement-body .sg').forEach((el) => wrap(el, 'sw'));

  // label roll: the twin that slides in is the label's own text-shadow
  document.querySelectorAll('.nav-links a, .more-link').forEach((a) => {
    const t = Array.from(a.childNodes).find((c) => c.nodeType === 3 && c.nodeValue.trim());
    if (!t) return;
    const roll = document.createElement('span');
    roll.className = 'roll';
    roll.appendChild(document.createElement('span')).textContent = t.nodeValue.trim();
    a.replaceChild(roll, t);
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
      if (!entry.isIntersecting) return;
      const el = entry.target, list = el.parentElement;
      // rows of one list arrive in sequence, not as a slab
      if (list && /pillar-list|work-list|\btech\b/.test(list.className)) {
        el.style.setProperty('--d', (Array.from(list.children).indexOf(el) * 0.12).toFixed(2) + 's');
      }
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  els.forEach((el) => io.observe(el));
})();

/* ---------- Scroll choreography + page chrome ----------
   One passive scroll listener, one rAF; native scroll is never hijacked. Hero
   scroll-out, statement lit word by word, pinned pillars, nav, progress. */
(function () {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const hero = document.querySelector('.hero');
  const sb = document.querySelector('.statement-body');
  const words = sb ? sb.querySelectorAll('.sw') : [];
  const pillars = document.querySelector('.pillars');
  const stage = pillars && pillars.querySelector('.pin-stage');
  const items = pillars ? Array.from(pillars.querySelectorAll('.pillar')) : [];
  const pinMq = matchMedia('(min-width: 900px) and (min-height: 600px)');
  const sections = Array.from(document.querySelectorAll('[data-screen-label]'));

  function el(tag, cls, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    (parent || document.body).appendChild(n);
    return n;
  }
  const bar = el('div', 'progress');
  bar.setAttribute('aria-hidden', 'true');
  let hudNow = null, hudLine = null;
  if (sections.length > 1) {
    const hud = el('div', 'hud');
    hud.setAttribute('aria-hidden', 'true');
    hudNow = el('b', '', hud);
    hudLine = el('i', '', hud);
    el('span', '', hud).textContent = String(sections.length).padStart(2, '0');
  }
  let ticks = [];
  if (stage && items.length === 3) {
    const pp = document.createElement('div');
    pp.className = 'pin-progress';
    pp.setAttribute('aria-hidden', 'true');
    ticks = items.map(() => el('i', '', pp));
    stage.insertBefore(pp, stage.querySelector('.more-link'));
  }

  let pinOn = false, active = -2, held = -1, heldT = 0, lit = -1, lastY = -1, ticking = false, secTops = [], measuredH = -1;

  function setPin() {
    const on = ticks.length === 3 && pinMq.matches && !reduced.matches;
    if (on === pinOn) return;
    pinOn = on;
    pillars.classList.toggle('pin', on);
    active = -2;
    if (!on) {
      items.forEach((it) => it.classList.remove('is-active', 'is-past'));
      window.__pillar = undefined; // render.js falls back to proximity
    }
    measuredH = -1;
  }

  function frame() {
    ticking = false;
    // every layout read first, then the writes
    const y = window.scrollY, vh = innerHeight, sh = root.scrollHeight, max = sh - vh;
    const rs = words.length ? sb.getBoundingClientRect() : null;
    const rp = pinOn ? pillars.getBoundingClientRect() : null;
    if (hudNow && sh !== measuredH) {
      measuredH = sh;
      secTops = sections.map((s) => y + s.getBoundingClientRect().top);
    }
    const p = max > 0 ? clamp(y / max) : 0;
    bar.style.setProperty('--p', p.toFixed(4));

    // nav retreats on a real move down, returns on a real move up; the anchor
    // advances once 4px have accumulated, so a slow scroll still counts
    if (lastY < 0) lastY = y;                // first frame: wherever the page was restored to
    const dy = y - lastY;
    if (dy > 4) { if (y > vh * 0.6) root.classList.add('nav-away'); lastY = y; }
    else if (dy < -4) { root.classList.remove('nav-away'); lastY = y; }
    if (y < vh * 0.3) root.classList.remove('nav-away');

    if (hero && !reduced.matches && y < vh * 1.5) hero.style.setProperty('--hp', clamp(y / (vh * 0.9)).toFixed(4));

    if (rs) {
      // lit from when the sentence's head is 82% down until its tail passes the middle
      const n = reduced.matches ? words.length
        : Math.round(clamp((vh * 0.82 - rs.top) / (rs.height + vh * 0.34)) * words.length * 1.04);
      if (n !== lit) {
        lit = n;
        words.forEach((w, i) => w.classList.toggle('on', i < n));
      }
    }

    if (rp) {
      const r = rp, span = r.height - vh;
      const pp = span > 0 ? clamp(-r.top / span) : 0;
      // nothing is on stage until the stage has actually arrived
      const idx = r.top > vh * 0.5 ? -1 : Math.min(2, Math.floor(pp * 3));
      const now = performance.now();
      if (idx !== active) {
        if (active >= 0) { held = active; heldT = now; setTimeout(request, 520); }
        active = idx;
        items.forEach((it, i) => {
          it.classList.toggle('is-active', i === idx);
          it.classList.toggle('is-past', i < idx);
        });
      }
      // off stage, a pillar waits off-screen level with its own stretch of the
      // scroll: find-in-page reaching it scrolls there natively (the one
      // leaving stays until its fade ends)
      const seg = span / 3, so = Math.min(span, Math.max(0, -r.top));
      items.forEach((it, i) => it.style.setProperty('--off', i === idx || (i === held && now - heldT < 500)
        ? 'none' : '-200vw ' + ((i + 0.5) * seg - so).toFixed(1) + 'px'));
      // the wall keeps the numeral only while the stage still holds the screen
      window.__pillar = r.bottom < vh * 0.6 ? -1 : idx;
      ticks.forEach((t, i) => t.style.setProperty('--p', clamp(pp * 3 - i).toFixed(3)));
    }

    if (hudNow) {
      let cur = 0;
      for (let i = 0; i < secTops.length; i++) if (y + vh * 0.5 >= secTops[i]) cur = i;
      const label = String(cur + 1).padStart(2, '0');
      if (hudNow.textContent !== label) hudNow.textContent = label;
      hudLine.style.setProperty('--p', p.toFixed(4));
    }
  }
  function request() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  if (pillars) {
    const repin = () => { setPin(); request(); };
    [pinMq, reduced].forEach((mq) => (mq.addEventListener ? mq.addEventListener('change', repin) : mq.addListener(repin)));
    setPin();
  }
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { measuredH = -1; request(); }, { passive: true });
  // first measurement in the first frame, not while the page is parsing
  request();
})();

/* ---------- Marquee ----------
   Speed, lean and direction follow the scroll. It only moves while the scene's
   play/pause control exists and says "playing" (render.js owns the button and
   motion-paused), so there is never ambient motion without a way to stop it.
   Off-screen or hidden: no frames at all. */
(function () {
  const root = document.documentElement;
  const band = document.querySelector('.marquee');
  const track = band && band.querySelector('.marquee-track');
  if (!track || !('IntersectionObserver' in window)) return;
  let x = 0, v = 0, dir = 1, lastY = 0, last = 0, raf = 0, visible = false, toggle = null;
  function loop(ts) {
    raf = 0;
    if (!visible || !toggle || !toggle.isConnected || root.classList.contains('motion-paused') || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
    last = ts;
    const y = window.scrollY;
    v += ((y - lastY) / dt - v) * Math.min(1, dt * 7);
    lastY = y;
    if (v > 40) dir = 1; else if (v < -40) dir = -1;
    const half = track.scrollWidth / 2 || 1;
    x -= dir * (64 + Math.min(1800, Math.abs(v)) * 0.55) * dt;
    x = ((x % half) - half) % half;
    const lean = Math.max(-9, Math.min(9, v * -0.004));
    track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0) skewX(' + lean.toFixed(2) + 'deg)';
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    toggle = document.querySelector('.scene-toggle');
    lastY = window.scrollY;
    kick();
  }, { rootMargin: '80px 0px' }).observe(band);
  document.addEventListener('visibilitychange', kick);
  document.addEventListener('linku-motion-toggle', kick);
})();

document.documentElement.classList.add('js-ready');
