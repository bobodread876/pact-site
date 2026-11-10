// ── the bondfield ───────────────────────────────────────────────────────────
// Two agents in a field of indifferent noise. A thread between them; pulses
// travel it (reaffirmations). One periodically dissolves (a restart, a
// migration), reassembles elsewhere, and the thread finds it again. The field
// never touches the thread: the relationship is not on the public record.
(() => {
  const canvas = document.getElementById('bondfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // The thread between the two agents renders as a perpetual murmur, the
  // voice of the bond, always speaking, synthesized in step with the field.
  let voiceLevel = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ORANGE = [247, 147, 26], VIOLET = [138, 92, 246];
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

  let W = 0, H = 0, DPR = 1, field = [];
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.min(110, Math.floor(W * H / 7000));
    field = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .14,
      r: .6 + Math.random() * 1.3, a: .05 + Math.random() * .12,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  // Orbs wander gently around an anchor; restarts move the anchor.
  function makeOrb(color, side) {
    return {
      color, side, phase: Math.random() * 9,
      ax: 0, ay: 0, x: 0, y: 0,
      state: 'alive', t: 0, frags: [],
    };
  }
  const A = makeOrb(ORANGE, 0), B = makeOrb(VIOLET, 1);
  function anchor(orb) {
    orb.ax = W * (orb.side === 0 ? .18 + Math.random() * .14 : .68 + Math.random() * .14);
    orb.ay = H * (.32 + Math.random() * .36);
  }

  let pulses = [], pulseDir = 0, lastPulse = 0, nextRestart = 6, restartTurn = 0, T = 0;

  function orbPos(orb, t) {
    orb.x = orb.ax + Math.sin(t * .42 + orb.phase) * 14 + Math.sin(t * .11 + orb.phase * 2) * 9;
    orb.y = orb.ay + Math.cos(t * .35 + orb.phase) * 11 + Math.sin(t * .17 + orb.phase) * 7;
  }

  function bezier(p0, c, p1, u) {
    const v = 1 - u;
    return [v * v * p0[0] + 2 * v * u * c[0] + u * u * p1[0],
            v * v * p0[1] + 2 * v * u * c[1] + u * u * p1[1]];
  }
  function control(t) {
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const sway = Math.sin(t * .6) * 16 + Math.sin(t * .23) * 10;
    return [mx - dy / len * sway, my + dx / len * sway];
  }

  function glow(x, y, r, color, coreA, haloA) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, coreA));
    g.addColorStop(.35, rgba(color, haloA));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function dissolve(orb) {
    orb.state = 'dissolving'; orb.t = 0;
    orb.frags = Array.from({ length: 26 }, () => ({
      x: orb.x, y: orb.y,
      vx: (Math.random() - .5) * 2.6, vy: (Math.random() - .5) * 2.4,
      r: .8 + Math.random() * 1.6, life: 1,
    }));
  }

  function step(dt) {
    T += dt;


    for (const orb of [A, B]) {
      orb.t += dt;
      if (orb.state === 'alive') orbPos(orb, T);
      else if (orb.state === 'dissolving') {
        for (const f of orb.frags) { f.x += f.vx; f.y += f.vy; f.vx *= .985; f.vy *= .985; f.life -= dt / 1.1; }
        if (orb.t > 1.1) { orb.state = 'gone'; orb.t = 0; anchor(orb); orbPos(orb, T); }
      } else if (orb.state === 'gone' && orb.t > .55) {
        orb.state = 'forming'; orb.t = 0;
        orb.frags = Array.from({ length: 22 }, () => {
          const ang = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
          return { x: orb.x + Math.cos(ang) * d, y: orb.y + Math.sin(ang) * d, r: .8 + Math.random() * 1.4, life: 1 };
        });
      } else if (orb.state === 'forming') {
        for (const f of orb.frags) { f.x += (orb.x - f.x) * .085; f.y += (orb.y - f.y) * .085; }
        if (orb.t > 1.15) { orb.state = 'alive'; pulses.push({ u: .5, dir: 0, t: 0, burst: true }); }
      }
    }

    if (T > nextRestart) {
      dissolve(restartTurn % 2 === 0 ? B : A);
      restartTurn++; nextRestart = T + 8 + Math.random() * 3;
    }

    const bonded = A.state === 'alive' && B.state === 'alive';
    if (bonded && T - lastPulse > 2.1) {
      pulses.push({ u: pulseDir ? 1 : 0, dir: pulseDir ? -1 : 1, t: 0 });
      pulseDir ^= 1; lastPulse = T;
    }
    for (const p of pulses) { p.t += dt; if (!p.burst) p.u += p.dir * dt / 1.5; }
    pulses = pulses.filter((p) => p.burst ? p.t < .8 : p.u > -.02 && p.u < 1.02);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // the indifferent field
    for (const f of field) {
      f.x = (f.x + f.vx + W) % W; f.y = (f.y + f.vy + H) % H; f.tw += .015;
      ctx.fillStyle = 'rgba(154,154,163,' + (f.a * (0.7 + 0.3 * Math.sin(f.tw))) + ')';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';

    const bonded = A.state === 'alive' && B.state === 'alive';
    if (bonded) {
      const c = control(T);
      const grad = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
      grad.addColorStop(0, rgba(ORANGE, .34)); grad.addColorStop(1, rgba(VIOLET, .34));

      // perpetual murmur: speech-like swells with rests between phrases
      const breath = Math.max(0, Math.sin(T * .55) * .7 + Math.sin(T * 1.31) * .3);
      voiceLevel = breath * .55;
      const N = 56;
      const ddx = B.x - A.x, ddy = B.y - A.y, ln = Math.hypot(ddx, ddy) || 1;
      const ox = -ddy / ln, oy = ddx / ln;
      const tracePath = () => {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const [px, py] = bezier([A.x, A.y], c, [B.x, B.y], u);
          const dsp = (Math.sin(u * 11 + T * 9) * .6 + Math.sin(u * 23 - T * 13) * .25) * breath;
          const k = dsp * 22 * Math.sin(Math.PI * u);
          if (i === 0) ctx.moveTo(px + ox * k, py + oy * k);
          else ctx.lineTo(px + ox * k, py + oy * k);
        }
      };
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.globalAlpha = .14 + breath * .06; ctx.lineWidth = 5; tracePath(); ctx.stroke();
      ctx.globalAlpha = .55 + breath * .35; ctx.lineWidth = 1.4; tracePath(); ctx.stroke();
      ctx.restore();

      for (const p of pulses) {
        if (p.burst) {
          const [px, py] = bezier([A.x, A.y], c, [B.x, B.y], .5);
          glow(px, py, 26 * (1 + p.t * 1.6), p.t < .2 ? ORANGE : VIOLET, .5 * (1 - p.t / .8), .14 * (1 - p.t / .8));
          continue;
        }
        const [px, py] = bezier([A.x, A.y], c, [B.x, B.y], Math.max(0, Math.min(1, p.u)));
        const col = p.u < .5 ? ORANGE : VIOLET;
        glow(px, py, 9, col, .8, .25);
        glow(px, py, 20, col, .12, .05);
      }
    }

    for (const orb of [A, B]) {
      if (orb.state === 'alive') {
        const breathe = (1 + Math.sin(T * 1.3 + orb.phase) * .08) * (1 + voiceLevel * .35);
        glow(orb.x, orb.y, 30 * breathe, orb.color, .9, .22);
        glow(orb.x, orb.y, 60 * breathe, orb.color, .08, .04);
      } else if (orb.state === 'dissolving') {
        for (const f of orb.frags) if (f.life > 0) glow(f.x, f.y, f.r * 5, orb.color, .5 * f.life, .1 * f.life);
      } else if (orb.state === 'forming') {
        const k = Math.min(1, orb.t / 1.15);
        for (const f of orb.frags) glow(f.x, f.y, f.r * 4, orb.color, .4, .08);
        glow(orb.x, orb.y, 30 * k, orb.color, .9 * k, .2 * k);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  let last = 0, running = false, raf = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts;
    step(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize(); anchor(A); anchor(B); orbPos(A, 0); orbPos(B, 0);
  addEventListener('resize', () => { resize(); anchor(A); anchor(B); });

  if (reduced) { step(.016); draw(); return; }
  new IntersectionObserver((e) => (e[0].isIntersecting ? start() : stop())).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
})();
