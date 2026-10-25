/* Ocean engine: scroll maps to depth. Draws water colour, light shafts, marine snow,
   a fish school, bioluminescent jellyfish, a pointer glow trail and sonar pings.
   Each page sets its depth range with data-depth-start / data-depth-end on <body>. */
(() => {
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 760px)").matches;
  const D0 = +body.dataset.depthStart || 0;
  const D1 = +body.dataset.depthEnd || 4000;

  /* ---------- UI: nav, menu, reveal, card glow, counters ---------- */
  const nav = document.querySelector(".nav");
  const menuBtn = document.querySelector(".menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const open = body.classList.toggle("menu-open");
      menuBtn.setAttribute("aria-expanded", open);
    });
    document.querySelectorAll(".nav ul a").forEach(a => a.addEventListener("click", () => body.classList.remove("menu-open")));
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.dataset.count) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal, [data-count]").forEach(el => io.observe(el));

  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const dec = (el.dataset.count.split(".")[1] || "").length;
    const suffix = el.dataset.suffix || "";
    if (reduce) { el.textContent = target.toFixed(dec) + suffix; return; }
    const t0 = performance.now(), dur = 1400;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  document.querySelectorAll(".card").forEach(c => {
    c.addEventListener("pointermove", e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", `${e.clientX - r.left}px`);
      c.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------- depth gauge ---------- */
  const ZONES = [[0, "Sunlight zone"], [200, "Twilight zone"], [1000, "Midnight zone"], [4000, "Abyssal zone"]];
  const gauge = document.createElement("div");
  gauge.className = "gauge";
  gauge.setAttribute("aria-hidden", "true");
  gauge.innerHTML = `<div class="read"><b>0 m</b><span></span></div><div class="track">${
    [0, 25, 50, 75, 100].map(p => `<i class="tick" style="top:${p}%"></i>`).join("")}<i class="marker"></i></div>`;
  body.appendChild(gauge);
  const gRead = gauge.querySelector("b"), gZone = gauge.querySelector("span"), gMark = gauge.querySelector(".marker");

  let frac = 0, depth = D0;
  function readScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    frac = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    depth = D0 + (D1 - D0) * frac;
    const m = Math.round(depth);
    gRead.textContent = m ? `−${m.toLocaleString("en-IN")} m` : "0 m";
    let z = ZONES[0][1];
    for (const [d, name] of ZONES) if (depth >= d) z = name;
    gZone.textContent = z;
    gMark.style.top = `${frac * 100}%`;
    if (nav) nav.classList.toggle("solid", scrollY > 30);
  }

  /* ---------- canvas ---------- */
  const cv = document.getElementById("ocean");
  if (!cv) { addEventListener("scroll", readScroll, { passive: true }); readScroll(); return; }
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  // Water colour stops by absolute depth (top colour, bottom colour).
  const WATER = [
    [0, [14, 74, 102], [5, 38, 60]],
    [200, [6, 38, 61], [3, 22, 38]],
    [1000, [2, 16, 29], [1, 10, 20]],
    [4000, [1, 7, 14], [0, 3, 7]],
  ];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const band = (d, a, b, c, e) => smooth(a, b, d) * (1 - smooth(c, e, d));
  function water(d) {
    let i = 0;
    while (i < WATER.length - 2 && d > WATER[i + 1][0]) i++;
    const [da, ta, ba] = WATER[i], [db, tb, bb] = WATER[i + 1];
    const t = clamp((d - da) / (db - da), 0, 1);
    const mix = (x, y) => x.map((v, k) => Math.round(lerp(v, y[k], t)));
    return [mix(ta, tb), mix(ba, bb)];
  }
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

  const rand = (a, b) => a + Math.random() * (b - a);
  let snow = [], fish = [], jellies = [], trail = [], pings = [], bubbles = [];

  function seed() {
    const area = W * H;
    const nSnow = Math.round(clamp(area / (small ? 9000 : 7000), 50, 220));
    snow = Array.from({ length: nSnow }, () => ({
      x: rand(0, W), y: rand(0, H), z: rand(0.25, 1), r: rand(0.5, 1.8),
      vx: rand(-0.06, 0.06), vy: rand(0.04, 0.22), ph: rand(0, 6.28),
      glow: Math.random() < 0.07,
    }));
    const nFish = small ? 18 : 38;
    const cx = W * 0.7, cy = H * 0.45;
    fish = Array.from({ length: nFish }, () => ({
      x: cx + rand(-120, 120), y: cy + rand(-60, 60), vx: rand(-1, 1), vy: rand(-0.4, 0.4), s: rand(0.8, 1.25),
    }));
    const nJelly = small ? 3 : 5;
    jellies = Array.from({ length: nJelly }, (_, i) => newJelly(rand(0, H), i));
  }
  function newJelly(y, i = 0) {
    const violet = Math.random() < 0.35;
    return {
      x: rand(W * 0.06, W * 0.94), y, s: rand(small ? 14 : 18, small ? 30 : 44), ph: rand(0, 6.28),
      rate: rand(0.7, 1.1), hue: violet ? rand(228, 250) : rand(168, 186), drift: rand(-0.12, 0.12), z: rand(0.5, 1), seed: i * 1.7,
    };
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  // Wandering attractor for the school.
  function attractor(t) {
    return {
      x: W * (0.5 + 0.32 * Math.sin(t * 0.00011) + 0.08 * Math.sin(t * 0.00037)),
      y: H * (0.45 + 0.22 * Math.sin(t * 0.00017 + 1.3)),
    };
  }

  let pointer = { x: -999, y: -999, active: false };
  let lastY = scrollY;

  function drawRays(t, k) {
    if (k <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const n = small ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const base = (i + 0.5) / n * W + Math.sin(t * 0.00023 + i * 1.9) * W * 0.04;
      const spread = W * (0.05 + 0.03 * Math.sin(t * 0.0003 + i));
      const len = H * (0.75 + 0.2 * Math.sin(i * 2.1));
      const lean = W * 0.12;
      const g = ctx.createLinearGradient(0, 0, 0, len);
      const a = (0.055 + 0.035 * Math.sin(t * 0.0006 + i * 2.3)) * k;
      g.addColorStop(0, `rgba(170,235,255,${a})`);
      g.addColorStop(1, "rgba(170,235,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(base - spread * 0.3, -10);
      ctx.lineTo(base + spread * 0.3, -10);
      ctx.lineTo(base + lean + spread, len);
      ctx.lineTo(base + lean - spread, len);
      ctx.closePath();
      ctx.fill();
    }
    // surface shimmer
    const sg = ctx.createLinearGradient(0, 0, 0, H * 0.25);
    sg.addColorStop(0, `rgba(160,230,250,${0.09 * k})`);
    sg.addColorStop(1, "rgba(160,230,250,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H * 0.25);
    ctx.restore();
  }

  function drawSnow(t, dy, deep) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of snow) {
      p.y += p.vy * p.z - dy * p.z * 0.35;
      p.x += p.vx + Math.sin(t * 0.0005 + p.ph) * 0.08 * p.z;
      if (p.y > H + 4) { p.y = -4; p.x = rand(0, W); }
      if (p.y < -4) { p.y = H + 4; p.x = rand(0, W); }
      if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4;
      if (p.glow && deep > 0.05) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.0012 + p.ph * 3);
        const a = deep * tw * 0.8 * p.z;
        const r = 7 * p.z;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(120,255,230,${a})`);
        g.addColorStop(1, "rgba(120,255,230,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = `rgba(200,230,240,${0.12 + 0.4 * p.z * p.z})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.z, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBubbles(k) {
    if (k > 0.05 && Math.random() < 0.06 * k && bubbles.length < 26) {
      bubbles.push({ x: rand(0, W), y: H + 10, r: rand(1.5, 4.5), vy: rand(0.5, 1.3), ph: rand(0, 6) });
    }
    ctx.save();
    ctx.lineWidth = 1;
    bubbles = bubbles.filter(b => b.y > -10);
    for (const b of bubbles) {
      b.y -= b.vy; b.x += Math.sin(b.y * 0.03 + b.ph) * 0.3;
      ctx.strokeStyle = `rgba(200,240,255,${0.35 * k})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.stroke();
      ctx.fillStyle = `rgba(230,250,255,${0.4 * k})`;
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  function drawFish(t, dy, k) {
    if (k <= 0.02) return;
    const a = attractor(t);
    const R = 60, SEP = 18, MAX = small ? 1.6 : 2.1;
    for (const f of fish) {
      let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0;
      for (const o of fish) {
        if (o === f) continue;
        const dx = o.x - f.x, dy2 = o.y - f.y, d2 = dx * dx + dy2 * dy2;
        if (d2 < R * R) {
          n++; ax += o.vx; ay += o.vy; cx += o.x; cy += o.y;
          if (d2 < SEP * SEP) { sx -= dx / (d2 + 1); sy -= dy2 / (d2 + 1); }
        }
      }
      if (n) {
        f.vx += (ax / n - f.vx) * 0.05 + (cx / n - f.x) * 0.0009;
        f.vy += (ay / n - f.vy) * 0.05 + (cy / n - f.y) * 0.0009;
      }
      f.vx += sx * 1.2 + (a.x - f.x) * 0.00022;
      f.vy += sy * 1.2 + (a.y - f.y) * 0.00022;
      const px = f.x - pointer.x, py = f.y - pointer.y, pd = px * px + py * py;
      if (pointer.active && pd < 140 * 140) { f.vx += px / (pd + 50) * 6; f.vy += py / (pd + 50) * 6; }
      for (const p of pings) {
        const qx = f.x - p.x, qy = f.y - p.y, qd = Math.hypot(qx, qy);
        if (Math.abs(qd - p.r) < 30) { f.vx += qx / (qd + 1) * 0.6; f.vy += qy / (qd + 1) * 0.6; }
      }
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > MAX) { f.vx *= MAX / sp; f.vy *= MAX / sp; }
      if (sp < 0.6) { f.vx *= 1.05; f.vy *= 1.05; }
      f.x += f.vx; f.y += f.vy - dy * 0.5;
      if (f.y < -80) f.y += H + 160; if (f.y > H + 80) f.y -= H + 160;
      if (f.x < -80) f.x += W + 160; if (f.x > W + 80) f.x -= W + 160;
    }
    ctx.save();
    for (const f of fish) {
      const ang = Math.atan2(f.vy, f.vx), L = 9 * f.s, Wd = 2.2 * f.s;
      ctx.translate(f.x, f.y); ctx.rotate(ang);
      ctx.fillStyle = `rgba(190,220,235,${0.42 * k})`;
      ctx.beginPath();
      ctx.moveTo(L, 0);
      ctx.quadraticCurveTo(0, -Wd, -L * 0.7, 0);
      ctx.quadraticCurveTo(0, Wd, L, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-L * 0.6, 0); ctx.lineTo(-L * 1.05, -Wd * 0.9); ctx.lineTo(-L * 1.05, Wd * 0.9); ctx.closePath();
      ctx.fill();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.restore();
  }

  function drawJellies(t, dy, k) {
    if (k <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < jellies.length; i++) {
      const j = jellies[i];
      const cyc = t * 0.001 * j.rate + j.ph;
      const pulse = Math.pow(Math.max(0, Math.sin(cyc)), 3); // sharp contraction, slow relax
      j.y += -(0.12 + pulse * 0.55) * j.z - dy * 0.22 * j.z;
      j.x += j.drift + Math.sin(cyc * 0.3) * 0.08;
      if (pointer.active) {
        const dx = j.x - pointer.x, dyy = j.y - pointer.y, d = Math.hypot(dx, dyy);
        if (d > 1 && d < 160) { j.x += dx / d * 0.6; j.y += dyy / d * 0.3; }
      }
      if (j.y < -j.s * 5) Object.assign(j, newJelly(H + j.s * 2, i));
      if (j.y > H + j.s * 6) Object.assign(j, newJelly(-j.s * 2, i));
      if (j.x < -60) j.x = W + 60; if (j.x > W + 60) j.x = -60;

      const s = j.s * j.z, bw = s * (1 - 0.14 * pulse), bh = s * 0.78 * (1 + 0.1 * pulse);
      const alpha = k * (0.55 + 0.3 * j.z);
      const hue = j.hue;

      // halo
      const halo = ctx.createRadialGradient(j.x, j.y, 0, j.x, j.y, s * 3.2);
      halo.addColorStop(0, `hsla(${hue},90%,65%,${0.16 * alpha})`);
      halo.addColorStop(1, `hsla(${hue},90%,65%,0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(j.x - s * 3.2, j.y - s * 3.2, s * 6.4, s * 6.4);

      // tentacles
      ctx.lineCap = "round";
      const nT = 7;
      for (let n = 0; n < nT; n++) {
        const ox = (n / (nT - 1) - 0.5) * bw * 1.6;
        const len = s * (2.4 + 0.9 * Math.sin(n * 1.7 + j.seed));
        ctx.strokeStyle = `hsla(${hue},85%,72%,${0.22 * alpha})`;
        ctx.lineWidth = n % 3 === 0 ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(j.x + ox, j.y);
        const seg = 8;
        for (let q = 1; q <= seg; q++) {
          const f = q / seg;
          const sway = Math.sin(cyc * 1.1 - f * 3 + n) * s * 0.35 * f;
          ctx.lineTo(j.x + ox * (1 - f * 0.4) + sway, j.y + len * f);
        }
        ctx.stroke();
      }
      // oral arms
      ctx.strokeStyle = `hsla(${hue},80%,80%,${0.3 * alpha})`;
      ctx.lineWidth = 2;
      for (let n = -1; n <= 1; n += 2) {
        ctx.beginPath();
        ctx.moveTo(j.x + n * bw * 0.15, j.y);
        ctx.bezierCurveTo(j.x + n * bw * 0.35 + Math.sin(cyc) * 4, j.y + s * 0.8,
          j.x - n * bw * 0.2, j.y + s * 1.2, j.x + n * bw * 0.1 + Math.sin(cyc * 0.8) * 6, j.y + s * 1.7);
        ctx.stroke();
      }
      // bell
      const g = ctx.createRadialGradient(j.x, j.y - bh * 0.6, 0, j.x, j.y - bh * 0.3, bw);
      g.addColorStop(0, `hsla(${hue},95%,86%,${0.55 * alpha})`);
      g.addColorStop(0.6, `hsla(${hue},90%,66%,${0.28 * alpha})`);
      g.addColorStop(1, `hsla(${hue},90%,60%,${0.06 * alpha})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(j.x - bw, j.y);
      ctx.bezierCurveTo(j.x - bw, j.y - bh * 1.35, j.x + bw, j.y - bh * 1.35, j.x + bw, j.y);
      ctx.quadraticCurveTo(j.x + bw * 0.5, j.y + bh * 0.16, j.x, j.y + bh * 0.05);
      ctx.quadraticCurveTo(j.x - bw * 0.5, j.y + bh * 0.16, j.x - bw, j.y);
      ctx.fill();
      // rim lights
      for (let n = 0; n < 9; n++) {
        const f = n / 8, rx = j.x + (f - 0.5) * 2 * bw * 0.96;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.004 + n * 0.9 + j.seed);
        ctx.fillStyle = `hsla(${hue},100%,85%,${0.6 * alpha * tw})`;
        ctx.beginPath(); ctx.arc(rx, j.y + Math.sin(f * Math.PI) * bh * 0.1, 1.1, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTrail(deepish) {
    if (!trail.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const base = 0.35 + 0.55 * deepish;
    trail = trail.filter(p => (p.life -= 0.016) > 0);
    for (const p of trail) {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy = p.vy * 0.97 - 0.004;
      const a = base * p.life, r = 6 * p.life + 1;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `hsla(${p.h},100%,75%,${a})`);
      g.addColorStop(1, `hsla(${p.h},100%,75%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function drawPings() {
    if (!pings.length) return;
    ctx.save();
    pings = pings.filter(p => (p.r += 3.2) < p.max);
    for (const p of pings) {
      const f = 1 - p.r / p.max;
      for (let k = 0; k < 2; k++) {
        const r = p.r - k * 26;
        if (r <= 0) continue;
        ctx.strokeStyle = `rgba(94,234,212,${0.5 * f * (1 - k * 0.45)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function frame(t) {
    readScroll();
    const dy = scrollY - lastY;
    lastY = scrollY;
    const d = depth;
    const [top, bot] = water(d);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, rgb(top));
    bg.addColorStop(1, rgb(bot));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const rays = 1 - smooth(0, 380, d);
    const fishK = band(d, 20, 120, 700, 1300);
    const jellyK = band(d, 250, 700, 3600, 4200);
    const deep = smooth(600, 2500, d);
    drawRays(t, rays);
    drawSnow(t, dy, deep);
    if (!reduce) drawBubbles(1 - smooth(0, 160, d));
    drawFish(t, reduce ? 0 : dy, fishK);
    drawJellies(t, reduce ? 0 : dy, jellyK);
    drawTrail(smooth(0, 1000, d));
    drawPings();
    // vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,2,6,${0.35 + 0.3 * deep})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  let running = true;
  function loop(t) {
    if (running) frame(t);
    requestAnimationFrame(loop);
  }

  addEventListener("resize", () => { resize(); if (reduce) frame(performance.now()); });
  resize();
  if (reduce) {
    addEventListener("scroll", () => frame(performance.now()), { passive: true });
    frame(performance.now());
    return;
  }
  document.addEventListener("visibilitychange", () => { running = !document.hidden; });
  requestAnimationFrame(loop);

  addEventListener("pointermove", e => {
    pointer = { x: e.clientX, y: e.clientY, active: true };
    if (trail.length < 90) {
      for (let i = 0; i < 2; i++) trail.push({
        x: e.clientX + rand(-4, 4), y: e.clientY + rand(-4, 4), vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.2),
        life: rand(0.6, 1), h: Math.random() < 0.8 ? rand(165, 185) : rand(225, 245),
      });
    }
  }, { passive: true });
  document.addEventListener("pointerout", e => { if (!e.relatedTarget) pointer.active = false; });
  addEventListener("pointerup", e => { if (e.pointerType !== "mouse") pointer.active = false; });
  document.addEventListener("pointerdown", e => {
    if (e.target.closest("a, button, input, dialog, .toggle, .cell")) return;
    pings.push({ x: e.clientX, y: e.clientY, r: 0, max: small ? 180 : 260 });
  });
})();
