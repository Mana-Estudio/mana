// Home: the full-bleed hero and the "Qué hacemos" arc right below it.
// - The header is see-through with light text while it sits over the hero (`on-dark`), and goes back to normal after.
// - The wall of sites behind the hero only moves while the hero is on screen.
// - The arc: project cards ride the rim of a big wheel. It turns on its own, by dragging, with the arrow keys, or by
//   clicking a card on the side; the card in the middle opens its site. Without JS it's a plain scrolling strip, and
//   with reduced motion it doesn't turn on its own.
(function () {
  'use strict';

  const root = document.querySelector('[data-mana-root]');
  if (!root) return;
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Header over the hero ----------
  const header = root.querySelector('header');
  const hero = root.querySelector('[data-hero]');
  if (header && hero) {
    let raf = 0;
    const check = () => {
      raf = 0;
      header.classList.toggle('on-dark', hero.getBoundingClientRect().bottom > header.offsetHeight * 0.6);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    check();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { hero.classList.toggle('is-off', !entries[0].isIntersecting); }).observe(hero);
    }
  } else if (header) {
    header.classList.remove('on-dark');
  }

  // ---------- The arc ----------
  const arc = root.querySelector('[data-arc]');
  if (!arc) return;
  const ring = arc.querySelector('[data-arc-ring]');
  const line = arc.querySelector('[data-arc-line]');
  const tour = arc.querySelector('[data-arc-tour]');
  const cards = Array.from(ring.children);
  const n = cards.length;
  if (n < 3) return;

  const STEP = 6;          // degrees between two cards on the wheel
  const RADIUS = 13.2;     // wheel radius, in card widths
  const VISIBLE = 3;       // cards farther than this from the middle are hidden (they fade out from VISIBLE - 0.6)
  const AUTO_MS = 3400;
  const rad = (d) => (d * Math.PI) / 180;

  arc.classList.add('is-live');

  let w = 0;        // card width
  let hc = 0;       // card height, caption included
  let R = 0;        // wheel radius
  let top = 0;      // room above the cards for the lifted one
  let spacing = 1;  // px between two cards, along the screen
  let pos = 1;      // index of the card in the middle (a float while turning)
  let target = 1;
  let active = -1;

  const measure = () => {
    const first = cards[0];
    w = first.offsetWidth;
    hc = first.offsetHeight;
    R = w * RADIUS;
    top = Math.round(w * 0.12);
    spacing = R * Math.sin(rad(STEP));
    const gap = Math.max(18, w * 0.12);
    const rl = R - hc - gap;                  // the line runs under the captions, on a smaller circle
    const lineTop = top + hc + gap;
    const badge = tour ? tour.offsetHeight || 112 : 0;
    const tourY = lineTop + 14 + badge / 2;   // the "Ver proyectos" seal hangs just under the line
    const drop = R * (1 - Math.cos(rad(STEP * 2)));
    const height = Math.round(Math.max(top + drop + hc + 12, tourY + badge / 2 + 8));
    arc.style.setProperty('--arc-h', `${height}px`);
    if (line) {
      line.style.width = line.style.height = `${rl * 2}px`;
      line.style.marginLeft = `${-rl}px`;
      line.style.top = `${lineTop}px`;
    }
    if (tour) arc.style.setProperty('--tour-y', `${tourY}px`);
  };

  const offsetOf = (i, p) => {
    let off = (i - p) % n;
    if (off < -n / 2) off += n;
    if (off >= n / 2) off -= n;
    return off;
  };

  const render = () => {
    let nearest = 0;
    let best = Infinity;
    cards.forEach((card, i) => {
      const off = offsetOf(i, pos);
      const a = Math.abs(off);
      const th = rad(off * STEP);
      const near = Math.max(0, 1 - a);
      const x = R * Math.sin(th);
      const y = top + R * (1 - Math.cos(th)) - near * w * 0.1;
      const s = 1 + near * 0.06;
      card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(off * STEP).toFixed(2)}deg) scale(${s.toFixed(3)})`;
      card.style.opacity = Math.max(0, Math.min(1, (VISIBLE - a) / 0.6)).toFixed(3);
      card.style.zIndex = String(100 - Math.round(a * 10));
      card.style.visibility = a >= VISIBLE ? 'hidden' : '';
      if (a < best) { best = a; nearest = i; }
    });
    if (nearest !== active) {
      if (active > -1) cards[active].classList.remove('is-active');
      active = nearest;
      cards[active].classList.add('is-active');
      cards.forEach((c, i) => c.setAttribute('data-cursor', i === active ? 'Visitar' : 'Ver'));
    }
  };

  // Turning: `pos` eases toward `target`. Both are plain numbers (never wrapped), so it always takes the short way.
  let running = false;
  let last = 0;
  const gsap = window.gsap;
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(64, now - (last || now)) / 1000;
    last = now;
    if (!dragging) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
      pos += (target - pos) * k;
      if (Math.abs(target - pos) < 0.0005) pos = target;
    }
    render();
    if (!dragging && pos === target) stop();
  };
  const tickRaf = () => { if (!running) return; frame(); requestAnimationFrame(tickRaf); };
  // With GSAP, ride its ticker: it sleeps while the "Hablemos" popup is open, so the arc stands still behind it.
  function start() {
    if (running) return;
    running = true;
    last = 0;
    if (gsap && gsap.ticker) gsap.ticker.add(frame);
    else requestAnimationFrame(tickRaf);
  }
  function stop() {
    if (!running) return;
    running = false;
    if (gsap && gsap.ticker) gsap.ticker.remove(frame);
  }
  const go = (t) => { target = t; start(); };
  const goToCard = (i) => go(pos + offsetOf(i, pos));

  // Autoplay: one card every few seconds, only while it's on screen, not touched and the tab is visible.
  let hovering = false;
  let focused = false;
  let onScreen = false;
  let dragging = false;
  let lastMove = 0;
  if (!reducedMotion) {
    setInterval(() => {
      if (hovering || focused || dragging || !onScreen || document.hidden) return;
      if (document.documentElement.classList.contains('hb-lock')) return;
      if (performance.now() - lastMove < AUTO_MS) return;
      go(Math.round(target) + 1);
    }, AUTO_MS);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; }, { threshold: 0.25 }).observe(arc);
  } else {
    onScreen = true;
  }
  arc.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
  arc.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hovering = false; });

  // Drag / swipe the wheel.
  let startX = 0;
  let startPos = 0;
  let moved = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0; // cards per second
  let downActive = -1; // the card in the middle when the press started
  ring.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    downActive = active;
    dragging = true;
    moved = 0;
    velocity = 0;
    startX = lastX = e.clientX;
    lastT = performance.now();
    startPos = pos;
    start();
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    moved = Math.max(moved, Math.abs(e.clientX - startX));
    if (moved > 6 && !arc.classList.contains('is-dragging')) {
      arc.classList.add('is-dragging');
      try { ring.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }
    pos = target = startPos - (e.clientX - startX) / spacing;
    const dtm = Math.max(1, now - lastT);
    velocity = velocity * 0.6 + (-(e.clientX - lastX) / spacing / dtm) * 1000 * 0.4;
    lastX = e.clientX;
    lastT = now;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    lastMove = performance.now();
    if (lastMove - lastT > 90) velocity = 0;
    if (moved > 6) go(Math.round(pos + Math.max(-2, Math.min(2, velocity * 0.18))));
    requestAnimationFrame(() => { arc.classList.remove('is-dragging'); });
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  ring.addEventListener('dragstart', (e) => e.preventDefault());

  // A click on a side card brings it to the middle; only the middle one opens its site.
  ring.addEventListener('click', (e) => {
    const card = e.target.closest('.arc-card');
    if (!card) return;
    if (moved > 6) { e.preventDefault(); moved = 0; return; }
    const i = cards.indexOf(card);
    const middle = e.detail === 0 || downActive < 0 ? active : downActive; // detail 0: Enter on a focused card
    downActive = -1;
    if (i !== middle) {
      e.preventDefault();
      lastMove = performance.now();
      goToCard(i);
    }
  });

  // Keyboard: the focused card comes to the middle, and the arrows turn the wheel.
  // (A mouse press focuses the link too: that case is handled by the click, so only keyboard focus counts here.)
  arc.addEventListener('focusin', (e) => {
    let keyboard = true;
    try { keyboard = e.target.matches(':focus-visible'); } catch (err) { /* old browser: assume keyboard */ }
    if (!keyboard || dragging) return;
    focused = true;
    const card = e.target.closest('.arc-card');
    if (card) goToCard(cards.indexOf(card));
  });
  arc.addEventListener('focusout', (e) => { if (!arc.contains(e.relatedTarget)) focused = false; });
  arc.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = (((Math.round(target) + (e.key === 'ArrowRight' ? 1 : -1)) % n) + n) % n;
    lastMove = performance.now();
    if (cards[next] && e.target.closest('.arc-card')) cards[next].focus({ preventScroll: true });
    else go(Math.round(target) + (e.key === 'ArrowRight' ? 1 : -1));
  });

  const layout = () => { measure(); render(); };
  window.addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
})();
