/* =========================================================
   Từ Batch đến Real-time — generated figures
   Title art (edge PoPs + event packets), 60 s countdown,
   surge-pricing hex map, incremental-compute grid.
   ========================================================= */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // small deterministic RNG so the art looks the same on every load
  function rng(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  const isLive = (slide) => !document.hidden && (slide.classList.contains('active') || document.documentElement.classList.contains('doc-mode'));

  /* ---------- title art: users → nearest PoP → queue ---------- */
  function titleArt() {
    const host = document.getElementById('title-art');
    if (!host) return;
    const slide = host.closest('.slide');
    const svg = el('svg', { viewBox: '0 0 620 720', 'aria-hidden': 'true' }, host);
    const rand = rng(20261022);

    const POPS = [
      { code: 'HAN', vi: 'Hà Nội', en: 'Hanoi', x: 300, y: 170 },
      { code: 'DAD', vi: 'Đà Nẵng', en: 'Da Nang', x: 430, y: 365 },
      { code: 'SGN', vi: 'TP.HCM', en: 'Ho Chi Minh City', x: 320, y: 575 }
    ];
    const LOG = { x: 556, y: 232, w: 18, h: 20, gap: 4, n: 14 };

    // backbone between the three PoPs
    el('path', { d: 'M300 170 C 380 220 452 290 430 365 S 320 500 320 575', class: 'ln dash', opacity: '.8' }, svg);

    // users scattered around each PoP
    const users = [];
    const gUsers = el('g', {}, svg);
    POPS.forEach((p, pi) => {
      for (let i = 0; i < 22; i++) {
        const a = rand() * Math.PI * 2;
        const r = 46 + rand() * 120;
        const x = Math.max(70, Math.min(520, p.x + Math.cos(a) * r * 1.15));
        const y = Math.max(40, Math.min(700, p.y + Math.sin(a) * r * .8));
        users.push({ x, y, pop: pi });
        el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: '2.3', class: 'tm', fill: 'currentColor', style: 'fill:var(--muted);opacity:.55' }, gUsers);
      }
    });

    // queue / log on the right
    el('text', { x: LOG.x + LOG.w / 2, y: LOG.y - 14, 'text-anchor': 'middle', class: 'mono tm', 'font-size': '11', 'font-weight': '700', 'letter-spacing': '1.2' }, svg).textContent = 'QUEUE';
    const cells = [];
    for (let i = 0; i < LOG.n; i++) {
      cells.push(el('rect', { x: LOG.x, y: LOG.y + i * (LOG.h + LOG.gap), width: LOG.w, height: LOG.h, rx: '3', class: 'cell' }, svg));
    }

    // PoPs: pulse rings, dot, labels
    POPS.forEach((p, i) => {
      for (let k = 0; k < 2; k++) {
        el('circle', { cx: p.x, cy: p.y, r: '9', class: 'pop-ring', style: `animation-delay:${i * .6 + k * 1.8}s` }, svg);
      }
      el('circle', { cx: p.x, cy: p.y, r: '7', style: 'fill:var(--accent)', class: 'glow' }, svg);
      el('circle', { cx: p.x, cy: p.y, r: '2.6', style: 'fill:var(--bg)' }, svg);
      const t = el('text', { x: p.x + 16, y: p.y - 2, class: 'mono', 'font-size': '15', 'font-weight': '700', 'letter-spacing': '1' }, svg);
      t.textContent = p.code;
      const vi = el('text', { x: p.x + 16, y: p.y + 15, class: 'tm vi', 'font-size': '12.5' }, svg);
      vi.textContent = p.vi;
      const en = el('text', { x: p.x + 16, y: p.y + 15, class: 'tm en', 'font-size': '12.5' }, svg);
      en.textContent = p.en;
    });

    // ticker
    const ticker = el('text', { x: '604', y: '700', 'text-anchor': 'end', class: 'mono tm', 'font-size': '11.5' }, svg);
    ticker.textContent = 'evt #000000';

    if (reduced) return;

    const gPk = el('g', { class: 'pkt-live' }, svg);
    const live = [];
    const TYPES = ['page.view', 'cart.add', 'order.created', 'payment.authorized', 'ride.requested', 'sensor.reading'];
    let evtNo = 0;
    let cellNo = 0;
    let lastSpawn = 0;
    let lastTick = 0;
    let clock = 0;

    function spawn(from, to, dur, onDone, big) {
      const c = el('circle', { r: big ? '3.4' : '2.6', style: 'fill:var(--accent)', class: 'glow' }, gPk);
      live.push({ c, from, to, t0: clock, dur, onDone, arc: big ? -40 : 0 });
    }

    function frame(now) {
      requestAnimationFrame(frame);
      clock = now;
      if (!isLive(slide)) return;
      if (now - lastSpawn > 150) {
        lastSpawn = now;
        const u = users[(rand() * users.length) | 0];
        const p = POPS[u.pop];
        spawn(u, p, 520 + rand() * 380, () => {
          const slot = cellNo++ % LOG.n;
          const target = { x: LOG.x + LOG.w / 2, y: LOG.y + slot * (LOG.h + LOG.gap) + LOG.h / 2 };
          spawn(p, target, 700 + rand() * 300, () => {
            const cell = cells[slot];
            cell.classList.add('on');
            setTimeout(() => cell.classList.remove('on'), 90);
            evtNo++;
            if (now - lastTick > 250) {
              lastTick = now;
              ticker.textContent = `evt #${String(evtNo).padStart(6, '0')}  ${TYPES[evtNo % TYPES.length]}  ${p.code} → queue`;
            }
          }, true);
        });
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const k = live[i];
        let t = Math.max(0, (now - k.t0) / k.dur);
        if (t >= 1) {
          k.c.remove();
          live.splice(i, 1);
          if (k.onDone) k.onDone();
          continue;
        }
        t = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const x = k.from.x + (k.to.x - k.from.x) * t;
        const y = k.from.y + (k.to.y - k.from.y) * t + k.arc * Math.sin(Math.PI * t);
        k.c.setAttribute('cx', x.toFixed(1));
        k.c.setAttribute('cy', y.toFixed(1));
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 60-second countdown on the hook slide ---------- */
  function countdown() {
    const box = document.querySelector('[data-fig="countdown"]');
    if (!box) return;
    const slide = box.closest('.slide');
    const arc = box.querySelector('.arc');
    const val = box.querySelector('.val b');
    const C = 2 * Math.PI * 104;
    arc.style.strokeDasharray = C.toFixed(1);
    arc.style.strokeDashoffset = '0';
    let t0 = 0;
    let timer = null;

    function tick() {
      const left = Math.max(0, 60 - (Date.now() - t0) / 1000);
      arc.style.strokeDashoffset = (C * (1 - left / 60)).toFixed(1);
      val.textContent = String(Math.ceil(left));
      box.classList.toggle('late', left <= 10);
      if (left <= 0) { clearInterval(timer); timer = null; }
    }
    document.addEventListener('slide:enter', (e) => {
      if (e.detail.slide === slide) {
        if (reduced) return;
        t0 = Date.now();
        clearInterval(timer);
        timer = setInterval(tick, 200);
        tick();
      } else if (timer && !document.documentElement.classList.contains('doc-mode')) {
        clearInterval(timer);
        timer = null;
      }
    });
  }

  /* ---------- Uber: surge multiplier per zone (illustrative) ---------- */
  function surge() {
    const g = document.getElementById('surge-hex');
    if (!g) return;
    const r = parseFloat(g.dataset.r) || 16.5;
    const w = Math.sqrt(3) * r;
    const hot = [{ x: 2, y: 2, a: 1.25 }, { x: 3.4, y: 4.2, a: .6 }];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 5; col++) {
        const cx = col * w + (row % 2) * (w / 2) + w / 2;
        const cy = row * 1.5 * r + r;
        const hx = col + (row % 2) * .5;
        let v = 1;
        hot.forEach((h) => {
          const d2 = Math.pow(hx - h.x, 2) + Math.pow((row - h.y) * .87, 2);
          v += h.a * Math.exp(-d2 / 1.6);
        });
        v = Math.round(v * 10) / 10;
        const pts = [];
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 180 * (60 * k - 90);
          pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
        }
        el('polygon', {
          points: pts.join(' '),
          style: `fill:var(--ch);fill-opacity:${(.07 + (v - 1) / 1.3 * .8).toFixed(2)};stroke:var(--bg);stroke-width:1.6`
        }, g);
        if (v >= 1.5) {
          const t = el('text', { x: cx.toFixed(1), y: (cy + r * .22).toFixed(1), 'text-anchor': 'middle', class: 'mono', 'font-size': (r * .55).toFixed(1), 'font-weight': '700' }, g);
          t.textContent = v.toFixed(1) + '×';
        }
      }
    }
  }

  /* ---------- batch vs incremental recompute grid ---------- */
  function incr() {
    const svg = document.querySelector('svg[data-fig="incr"]');
    if (!svg) return;
    const cols = 12;
    const rows = 4;
    const s = 13;
    const gap = 3;
    const fresh = new Set([45, 46, 47]);
    [0, 232].forEach((x0, gi) => {
      for (let i = 0; i < cols * rows; i++) {
        const c = i % cols;
        const rr = (i / cols) | 0;
        const on = gi === 0 || fresh.has(i);
        el('rect', {
          x: x0 + c * (s + gap),
          y: 22 + rr * (s + gap),
          width: s,
          height: s,
          rx: 2.5,
          style: on
            ? `fill:var(${gi === 0 ? '--c1' : '--ch'});fill-opacity:${gi === 0 ? .55 : 1}`
            : 'fill:var(--surface-3)'
        }, svg);
      }
    });
  }

  function init() {
    titleArt();
    countdown();
    surge();
    incr();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
