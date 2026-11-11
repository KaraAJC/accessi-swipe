// Tiny dependency-free confetti burst.
// Decorative only: aria-hidden, ignores pointer events, and skipped entirely
// when the user prefers reduced motion (WCAG 2.3.3 Animation from Interactions).
(function () {
  'use strict';

  const COLORS = ['#a08ef9', '#4fd79c', '#ff9bb8', '#e3b341', '#ffd166', '#f3f1f9'];
  const DURATION_MS = 3500; // well under 5s, and stops on its own (WCAG 2.2.2)

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function burst() {
    if (prefersReducedMotion()) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Two cannons firing up and inward from the bottom corners.
    const pieces = [];
    const perSide = Math.min(90, Math.round(w / 6));
    [[0, -1], [w, 1]].forEach(([x0, dir]) => {
      for (let i = 0; i < perSide; i++) {
        const angle = (-Math.PI / 2) + dir * -(0.25 + Math.random() * 0.55);
        const speed = 9 + Math.random() * 10;
        pieces.push({
          x: x0, y: h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * (h / 700 + 0.4),
          size: 6 + Math.random() * 6,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          tilt: Math.random() * Math.PI,
        });
      }
    });

    const start = performance.now();
    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      const fade = t > DURATION_MS - 800 ? Math.max(0, (DURATION_MS - t) / 800) : 1;
      ctx.globalAlpha = fade;
      pieces.forEach(p => {
        p.vy += 0.35;      // gravity
        p.vx *= 0.985;     // drag
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.tilt += 0.1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.tilt)) + 1);
        ctx.restore();
      });
      if (t < DURATION_MS) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  window.confettiBurst = burst;
})();
