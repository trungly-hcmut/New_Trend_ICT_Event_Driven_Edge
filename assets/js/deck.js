/* =========================================================
   Từ Batch đến Real-time — deck engine
   Navigation, language (VI/EN), theme, TOC, speaker notes, scroll view.
   ========================================================= */
(function () {
  'use strict';

  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const params = new URLSearchParams(location.search);

  const store = {
    get(k) { try { return localStorage.getItem('edge:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('edge:' + k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- section labels shown at the top of each slide ---------- */
  const SECTIONS = {
    'agenda': { vi: 'Nội dung', en: 'Agenda' },
    '1.1': { vi: 'Hook', en: 'Hook' },
    '1.2': { vi: 'Batch & giới hạn', en: 'Batch & its limits' },
    '2.1': { vi: 'Khái niệm nền tảng', en: 'Core concepts' },
    '2.2': { vi: 'Batch vs Streaming', en: 'Batch vs streaming' },
    '2.3': { vi: 'Những con số', en: 'The numbers' },
    '2.4': { vi: 'Edge hoạt động thế nào', en: 'How the edge works' },
    '2.5': { vi: 'Hai mô hình serverless', en: 'Two serverless models' },
    '2.6': { vi: 'Kiến trúc pipeline', en: 'Pipeline architecture' },
    '3.1': { vi: 'Case study · Uber', en: 'Case study · Uber' },
    '3.2': { vi: 'Case study · Grab', en: 'Case study · Grab' },
    '3.3': { vi: 'Case study · Krungsri', en: 'Case study · Krungsri' },
    '4.1': { vi: 'Mặt trái · Chi phí', en: 'Downside · Cost' },
    '4.2': { vi: 'Mặt trái · Data locality', en: 'Downside · Data locality' },
    '4.3': { vi: 'Thách thức kỹ thuật', en: 'Engineering challenges' },
    '5.1': { vi: 'Dòng thời gian', en: 'Timeline' },
    '5.2': { vi: 'Xu hướng 2025–2026', en: 'Trends 2025–2026' },
    '6.1': { vi: 'Kiến trúc demo', en: 'Demo architecture' },
    '6.2': { vi: 'Demo trực tiếp', en: 'Live demo' },
    '6.3': { vi: 'Demo cho thấy gì', en: 'What the demo shows' },
    '6.4': { vi: 'Video dự phòng', en: 'Backup video' },
    'end': { vi: 'Kết luận', en: 'Conclusion' },
    'qa': { vi: 'Hỏi & đáp', en: 'Q&A' },
    'read': { vi: 'Đọc thêm', en: 'Further reading' },
    'ref': { vi: 'Tài liệu tham khảo', en: 'References' }
  };

  const CHAPTERS = {
    '0': { vi: 'Mở đầu', en: 'Introduction' },
    '1': { vi: '01 · Vì sao phải nhanh?', en: '01 · Why so fast?' },
    '2': { vi: '02 · Làm thế nào?', en: '02 · How does it work?' },
    '3': { vi: '03 · Ai đang làm?', en: '03 · Who is doing it?' },
    '4': { vi: '04 · Khi nào KHÔNG nên?', en: '04 · When NOT to?' },
    '5': { vi: '05 · Đi về đâu?', en: '05 · Where is it heading?' },
    '6': { vi: '06 · Demo', en: '06 · Demo' },
    'e': { vi: 'Kết thúc', en: 'Wrap-up' }
  };
  const CH_COLOR = { '1': '--c1', '2': '--c2', '3': '--c3', '4': '--c4', '5': '--c5', '6': '--c6' };

  const L = (o) => (typeof o === 'string' ? o : `<span class="vi">${o.vi}</span><span class="en">${o.en}</span>`);
  const pad = (n) => String(n).padStart(2, '0');

  let slides = [];
  let idx = 0;
  let docMode = false;
  const stage = $('#stage');
  const viewport = $('#viewport');

  /* ---------- language ---------- */
  function setLang(l) {
    if (l !== 'en' && l !== 'vi') l = 'vi';
    root.lang = l;
    store.set('lang', l);
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    document.title = l === 'vi'
      ? 'Từ Batch đến Real-time · Event-driven, Serverless & Edge'
      : 'From Batch to Real-time · Event-driven, Serverless & Edge';
    $$('[data-pptx]').forEach((a) => { a.href = a.getAttribute('href').replace(/_(VI|EN)\.pptx$/, `_${l.toUpperCase()}.pptx`); });
    document.dispatchEvent(new CustomEvent('lang:change', { detail: l }));
  }
  const toggleLang = () => setLang(root.lang === 'vi' ? 'en' : 'vi');

  /* ---------- theme (dark unless the viewer picked light) ---------- */
  const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
  function setTheme(t) {
    root.dataset.theme = t;
    store.set('theme', t);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = t === 'light' ? '#f3f6fb' : '#060a13';
  }
  const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

  /* ---------- speaker notes ---------- */
  function setNotes(on) {
    root.classList.toggle('show-notes', on);
    store.set('notes', on ? '1' : '0');
    $$('.tb-notes').forEach((b) => b.setAttribute('aria-pressed', String(on)));
    renderNotes();
  }
  const toggleNotes = () => setNotes(!root.classList.contains('show-notes'));
  function renderNotes() {
    const panel = $('#notes-panel');
    if (!panel || !root.classList.contains('show-notes')) return;
    const n = slides[idx] && slides[idx].querySelector('.notes');
    panel.innerHTML = `<span class="nh">${L({ vi: 'Ý để nói', en: 'Speaker notes' })}</span>` +
      (n ? n.innerHTML : `<p class="muted">${L({ vi: 'Slide này không có ghi chú.', en: 'No notes for this slide.' })}</p>`);
  }

  /* ---------- slide headers ---------- */
  function buildHeaders() {
    slides.forEach((s, i) => {
      const key = s.dataset.sec;
      if (!key || !SECTIONS[key] || s.querySelector('.s-top')) return;
      const ch = CHAPTERS[s.dataset.ch] || CHAPTERS['0'];
      const num = /^\d/.test(key) ? `<b>${key}</b>` : '';
      const head = document.createElement('div');
      head.className = 's-top';
      head.innerHTML =
        `<span class="chp">${L(ch)}</span><span class="sep">/</span>` +
        `<span class="sec">${num}${L(SECTIONS[key])}</span>` +
        `<span class="no">${pad(i + 1)} / ${pad(slides.length)}</span><i class="pk"></i>`;
      s.insertBefore(head, s.firstChild);
    });
  }

  /* ---------- TOC ---------- */
  function slideTitle(s) {
    if (s.dataset.tocVi) return L({ vi: s.dataset.tocVi, en: s.dataset.tocEn || s.dataset.tocVi });
    const h = s.querySelector('h2, h1');
    return h ? h.innerHTML.replace(/<br\s*\/?>/gi, ' ') : '—';
  }
  function buildToc() {
    const nav = $('#toc nav');
    let html = '';
    let last = null;
    slides.forEach((s, i) => {
      const ch = s.dataset.ch || '0';
      if (ch !== last) {
        const c = CH_COLOR[ch] ? `style="--c:var(${CH_COLOR[ch]})"` : '';
        html += `<h4><i ${c}></i>${L(CHAPTERS[ch] || CHAPTERS['0'])}</h4>`;
        last = ch;
      }
      html += `<a href="#/${i + 1}" data-i="${i}"><span class="i">${i + 1}</span><span>${slideTitle(s)}</span></a>`;
    });
    nav.innerHTML = html;
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-i]');
      if (!a) return;
      e.preventDefault();
      toggleToc(false);
      go(+a.dataset.i);
    });
  }
  function toggleToc(force) {
    const t = $('#toc');
    const open = typeof force === 'boolean' ? force : !t.classList.contains('open');
    t.classList.toggle('open', open);
    $('#scrim').classList.toggle('show', open);
    if (open) {
      const cur = t.querySelector('a.cur');
      if (cur) cur.scrollIntoView({ block: 'center' });
    }
  }

  /* ---------- navigation ---------- */
  function updateChrome() {
    $('#counter').textContent = `${idx + 1} / ${slides.length}`;
    const s = slides[idx];
    const bar = $('#progress i');
    bar.style.width = `${((idx + 1) / slides.length) * 100}%`;
    const c = CH_COLOR[s.dataset.ch];
    bar.style.setProperty('--prog', c ? `var(${c})` : 'var(--accent)');
    $$('#toc a').forEach((a) => a.classList.toggle('cur', +a.dataset.i === idx));
    renderNotes();
  }

  function go(n, opts = {}) {
    n = Math.max(0, Math.min(slides.length - 1, n | 0));
    if (docMode) {
      idx = n;
      updateChrome();
      if (!opts.silent) slides[n].scrollIntoView({ behavior: opts.instant ? 'auto' : 'smooth', block: 'start' });
      if (!opts.fromHash) history.replaceState(null, '', '#/' + (n + 1));
      return;
    }
    const prevIdx = idx;
    slides.forEach((s, i) => {
      const on = i === n;
      s.classList.toggle('active', on);
      s.classList.toggle('past', i < n);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      s.inert = !on;
    });
    idx = n;
    updateChrome();
    if (!opts.fromHash) history.replaceState(null, '', '#/' + (n + 1));
    if (prevIdx !== n || opts.force) {
      document.dispatchEvent(new CustomEvent('slide:enter', { detail: { slide: slides[n], index: n } }));
    }
  }
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  function fromHash() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (!h) return 0;
    if (/^\d+$/.test(h)) return Math.max(0, +h - 1);
    const el = document.getElementById(h);
    const i = el ? slides.indexOf(el.closest('.slide')) : -1;
    return i >= 0 ? i : 0;
  }

  /* ---------- scaling & modes ---------- */
  function fit() {
    if (docMode) return;
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.setProperty('--scale', s.toFixed(4));
  }

  const mq = matchMedia('screen and (max-width: 860px)');
  function applyMode(keep) {
    const pref = store.get('mode');
    const wantDoc = pref ? pref === 'doc' : mq.matches;
    if (wantDoc === docMode && !keep) return;
    const cur = idx;
    docMode = wantDoc;
    root.classList.toggle('doc-mode', docMode);
    slides.forEach((s) => { s.inert = false; s.setAttribute('aria-hidden', 'false'); });
    $$('.tb-mode').forEach((b) => b.setAttribute('aria-pressed', String(docMode)));
    if (docMode) {
      requestAnimationFrame(() => go(cur, { instant: true }));
    } else {
      fit();
      go(cur, { force: true });
    }
  }
  function toggleMode() {
    store.set('mode', docMode ? 'slides' : 'doc');
    applyMode();
  }

  // in scroll view, keep the counter in sync with the slide on screen
  let scrollTick = null;
  window.addEventListener('scroll', () => {
    if (!docMode || scrollTick) return;
    scrollTick = requestAnimationFrame(() => {
      scrollTick = null;
      const mid = window.innerHeight * 0.35;
      let best = 0;
      slides.forEach((s, i) => { if (s.getBoundingClientRect().top <= mid) best = i; });
      if (best !== idx) {
        idx = best;
        updateChrome();
        document.dispatchEvent(new CustomEvent('slide:enter', { detail: { slide: slides[idx], index: idx } }));
      }
    });
  }, { passive: true });

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
  }

  /* ---------- input ---------- */
  function onKey(e) {
    // a focused video keeps Space / arrows for play-pause and seeking
    if (e.target.closest('input, textarea, select, video, audio, [contenteditable="true"]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    const lk = k.length === 1 ? k.toLowerCase() : k;
    if (lk === 'l') { toggleLang(); return; }
    if (lk === 't') { toggleTheme(); return; }
    if (lk === 'm' || lk === 'o') { toggleToc(); return; }
    if (lk === 'n') { toggleNotes(); return; }
    if (k === 'Escape') { toggleToc(false); return; }
    if (docMode) return;
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(slides.length - 1); break;
      case 'f': case 'F': fullscreen(); break;
      default: break;
    }
  }

  function onClick(e) {
    const g = e.target.closest('[data-go]');
    if (g) {
      e.preventDefault();
      const v = g.dataset.go;
      if (v === 'next') next();
      else if (v === 'prev') prev();
      else if (v.startsWith('#')) {
        const el = document.getElementById(v.slice(1));
        if (el) go(slides.indexOf(el.closest('.slide')));
      } else go(+v - 1);
      g.blur();
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'lang') setLang(a.dataset.lang);
    else if (act === 'theme') toggleTheme();
    else if (act === 'toc') toggleToc();
    else if (act === 'notes') toggleNotes();
    else if (act === 'full') fullscreen();
    else if (act === 'mode') toggleMode();
    else if (act === 'print') window.print();
    a.blur();
  }

  let tx = null;
  let ty = null;
  function onTouchStart(e) {
    if (docMode) return;
    const t = e.changedTouches[0];
    tx = t.clientX; ty = t.clientY;
  }
  function onTouchEnd(e) {
    if (docMode || tx === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tx;
    const dy = t.clientY - ty;
    tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
  }

  let idleTimer = null;
  function wake() {
    const tb = $('#toolbar');
    tb.classList.remove('idle');
    clearTimeout(idleTimer);
    if (!docMode) idleTimer = setTimeout(() => tb.classList.add('idle'), 2800);
  }

  /* ---------- overflow checker: add ?check to the URL ---------- */
  function checkOverflow() {
    const report = [];
    // decorative elements are allowed to bleed off the slide
    $$('.divider .big, .title-art').forEach((d) => { d.style.display = 'none'; });
    root.classList.add('no-anim');
    slides.forEach((s, i) => {
      const over = s.scrollHeight - s.clientHeight;
      const overW = s.scrollWidth - s.clientWidth;
      // content must also clear the source line at the bottom
      const src = s.querySelector('.src');
      let clash = 0;
      if (src) {
        const top = src.getBoundingClientRect().top;
        $$('.s-body', s).forEach((b) => {
          const bottom = Math.max(0, ...Array.from(b.querySelectorAll('*')).map((c) => c.getBoundingClientRect().bottom));
          clash = Math.max(clash, Math.round((bottom - top) / (parseFloat(getComputedStyle(stage).getPropertyValue('--scale')) || 1)));
        });
      }
      if (over > 2 || overW > 2 || clash > 0) {
        report.push(`#${i + 1} ${s.id || ''} +${over}px h, +${overW}px w, src clash ${clash}px`);
        const f = document.createElement('div');
        f.className = 'overflow-flag';
        f.textContent = `OVERFLOW h+${over} w+${overW} src${clash}`;
        s.appendChild(f);
      }
    });
    $$('.divider .big, .title-art').forEach((d) => { d.style.display = ''; });
    root.classList.remove('no-anim');
    const pre = document.createElement('pre');
    pre.id = 'check-report';
    pre.hidden = true;
    pre.textContent = report.length ? report.join('\n') : 'OK – no overflow';
    document.body.appendChild(pre);
    if (report.length) console.warn('[deck] overflowing slides:\n' + report.join('\n'));
  }

  /* ---------- init ---------- */
  function init() {
    slides = $$('.slide', stage);
    slides.forEach((s, i) => { if (!s.id) s.id = 's' + (i + 1); });
    $$('table.tbl', stage).forEach((t) => {
      if (t.closest('.tbl-wrap')) return;
      const w = document.createElement('div');
      w.className = 'tbl-wrap';
      t.replaceWith(w);
      w.appendChild(t);
    });

    setLang(params.get('lang') || store.get('lang') || 'vi');
    const t = params.get('theme') || store.get('theme');
    if (t === 'dark' || t === 'light') root.dataset.theme = t;

    buildHeaders();
    buildToc();

    idx = fromHash();
    applyMode(true);
    fit();
    go(idx, { fromHash: true, force: true });
    if (params.get('notes') === '1' || store.get('notes') === '1') setNotes(true);

    window.addEventListener('resize', fit);
    mq.addEventListener('change', () => applyMode());
    window.addEventListener('hashchange', () => go(fromHash(), { fromHash: true }));
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('mousemove', wake, { passive: true });
    $('#scrim').addEventListener('click', () => toggleToc(false));
    wake();

    if (params.has('check')) {
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(checkOverflow, 300));
    }
    document.dispatchEvent(new CustomEvent('deck:ready'));
  }

  window.Deck = { go, next, prev, setLang, chapters: CHAPTERS, get index() { return idx; }, get slides() { return slides; }, get docMode() { return docMode; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
