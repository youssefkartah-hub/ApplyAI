/* Youssef Kartah · portfolio. Small, dependency-free enhancements.
   Every page reads fine without this file; it only adds the motion and the interactions. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var canHover = window.matchMedia && matchMedia('(hover: hover)').matches;
  var root = document.documentElement;

  /* ---------- every page opens at its top ----------
     Browsers (and the viewers that embed this site) can restore an old scroll position
     after a navigation. Take scroll restoration over, and put the page at its top unless
     the link asked for a section (#hash) or the visitor has already started scrolling. */
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  var userScrolled = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, function () { userScrolled = true; }, { passive: true, once: true });
  });
  function toTop() {
    if (userScrolled || location.hash) return;
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
    /* also asks any frame this page sits in to show the top of the page */
    try { root.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (e) {}
  }
  toTop();
  window.addEventListener('load', function () { toTop(); setTimeout(toTop, 150); setTimeout(toTop, 600); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { userScrolled = false; toTop(); } });

  /* ---------- page transition: a blue curtain between pages ---------- */
  var curtain = $('.curtain');
  function go(url) {
    if (reduce || !curtain) { location.href = url; return; }
    try { sessionStorage.setItem('go', '1'); } catch (e) {}
    curtain.classList.add('up');
    setTimeout(function () { location.href = url; }, 580);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-go]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    e.preventDefault();
    go(a.href);
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && curtain) { curtain.classList.remove('up'); root.classList.remove('arriving'); }
  });

  /* ---------- scroll: progress bar and the cover's slow drift ---------- */
  var progress = $('.progress'), cover = $('.cover-in'), ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY || 0, max = Math.max(1, root.scrollHeight - window.innerHeight);
    if (progress) progress.style.setProperty('--p', Math.min(1, y / max).toFixed(4));
    if (cover && !reduce && y < window.innerHeight * 1.2) cover.style.setProperty('--cy', (y * 0.14).toFixed(1) + 'px');
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- the Projects button leans toward the pointer ---------- */
  $$('.go').forEach(function (b) {
    if (reduce || !canHover) return;
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
      b.style.setProperty('--mx', (x * 22).toFixed(1) + 'px');
      b.style.setProperty('--my', (y * 16).toFixed(1) + 'px');
    });
    b.addEventListener('pointerleave', function () { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });

  /* ---------- copy buttons ---------- */
  $$('[data-copy]').forEach(function (b) {
    var label = b.textContent;
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      function done() { b.setAttribute('data-done', ''); b.textContent = 'Copied'; setTimeout(function () { b.removeAttribute('data-done'); b.textContent = label; }, 1800); }
      function fallback() {
        var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); done(); } catch (e) { b.textContent = text; }
        document.body.removeChild(t);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    });
  });

  /* ---------- reveal on scroll (the hidden state exists only when this script runs) ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var targets = $$('.ph .wrap > *, .standing .wrap > *, .sec > *, .row-text, .row-media, .next-main, .foot .wrap > *, .gate-in > *');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) {
      var sibs = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.style.setProperty('--rd', Math.min(sibs, 5) * 0.06 + 's');
      el.classList.add('rv');
      io.observe(el);
    });
  }

  /* ---------- project list: previews play while you hover (or while visible on touch) ---------- */
  $$('video[data-preview]').forEach(function (v) {
    if (reduce || saveData) return;
    function play() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    function stop() { v.pause(); }
    if (canHover) {
      var row = v.closest('.row') || v;
      row.addEventListener('mouseenter', play); row.addEventListener('mouseleave', stop);
      row.addEventListener('focusin', play); row.addEventListener('focusout', stop);
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) play(); else stop(); }); }, { threshold: 0.6 }).observe(v);
    }
  });

  /* ---------- case-page videos with our own button ---------- */
  $$('.plate video').forEach(function (v) {
    var btn = $('.vbtn', v.parentNode);
    if (!btn) return;
    v.removeAttribute('controls');
    var label = $('span', btn);
    function sync() {
      var playing = !v.paused;
      btn.setAttribute('data-state', playing ? 'playing' : 'paused');
      btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
      if (label) label.textContent = playing ? 'Pause' : 'Play';
    }
    btn.addEventListener('click', function () { v.dataset.user = '1'; if (v.paused) v.play(); else v.pause(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) { if (!v.paused) v.pause(); return; }
          if (v.hasAttribute('data-autoplay') && !reduce && !saveData && !v.dataset.user) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        });
      }, { threshold: 0.35 }).observe(v);
    }
    sync();
  });

  /* ---------- two-state figures ---------- */
  $$('[data-toggle]').forEach(function (fig) {
    var btns = $$('[data-set]', fig);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var kv = b.getAttribute('data-set').split(':');
        fig.setAttribute('data-' + kv[0], kv[1]);
        btns.forEach(function (o) { if (o.getAttribute('data-set').split(':')[0] === kv[0]) o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      });
    });
  });

  /* ---------- annotated photos: link each pin to its line in the list ---------- */
  $$('[data-pins]').forEach(function (box) {
    var scope = box.closest('.cols') || box.closest('figure') || document;
    var list = $('[data-pin-list]', scope) || $('[data-pin-list]', box.closest('section') || document);
    if (!list) return;
    function mark(n, on) { $$('[data-pin="' + n + '"]', box).concat($$('[data-pin="' + n + '"]', list)).forEach(function (el) { el.classList.toggle('on', on); }); }
    $$('[data-pin]', box).concat($$('[data-pin]', list)).forEach(function (el) {
      var n = el.getAttribute('data-pin');
      el.addEventListener('pointerenter', function () { mark(n, true); });
      el.addEventListener('pointerleave', function () { mark(n, false); });
    });
  });

  /* ---------- explorers: pick a part, read what it is ---------- */
  $$('[data-explore]').forEach(function (rootEl) {
    var items = $$('[data-k]', rootEl), chips = $$('button[data-k]', rootEl);
    var rt = $('[data-r-title]', rootEl), rd = $('[data-r-text]', rootEl), cur = null;
    var def = { t: rt ? rt.textContent : '', d: rd ? rd.textContent : '' };
    function set(k) {
      cur = k;
      rootEl.classList.toggle('has-k', !!k);
      items.forEach(function (el) {
        var on = el.getAttribute('data-k') === k;
        el.classList.toggle('on', on);
        if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var src = k && chips.filter(function (b) { return b.getAttribute('data-k') === k; })[0];
      if (rt) rt.textContent = src ? src.getAttribute('data-title') : def.t;
      if (rd) rd.textContent = src ? src.getAttribute('data-text') : def.d;
    }
    items.forEach(function (el) {
      var k = el.getAttribute('data-k'), isBtn = el.tagName === 'BUTTON';
      if (isBtn) {
        el.addEventListener('click', function () { set(cur === k ? null : k); });
      } else {
        el.addEventListener('mouseenter', function () { set(k); });
        el.addEventListener('focus', function () { set(k); });
        el.addEventListener('click', function () { set(k); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(k); } });
      }
    });
  });

  /* ---------- tabs ---------- */
  $$('[data-tabs]').forEach(function (rootEl, n) {
    var tabs = $$('[role="tab"]', rootEl), panels = $$('[role="tabpanel"]', rootEl);
    tabs.forEach(function (t, i) {
      t.id = t.id || 'tab-' + n + '-' + i;
      if (panels[i]) { panels[i].setAttribute('aria-labelledby', t.id); t.setAttribute('aria-controls', panels[i].id || (panels[i].id = 'panel-' + n + '-' + i)); }
    });
    function sel(i, focus) {
      tabs.forEach(function (t, j) { var on = i === j; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      panels.forEach(function (p, j) { p.hidden = i !== j; });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(i); });
      t.addEventListener('keydown', function (e) {
        var len = tabs.length, k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); sel((i + 1) % len, true); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); sel((i - 1 + len) % len, true); }
        else if (k === 'Home') { e.preventDefault(); sel(0, true); }
        else if (k === 'End') { e.preventDefault(); sel(len - 1, true); }
      });
    });
    sel(0);
  });

  /* ---------- the room you can drag ---------- */
  $$('[data-orbit]').forEach(function (box) {
    var img = $('img', box), N = +box.getAttribute('data-n') || 30, base = box.getAttribute('data-base');
    var range = $('input[type="range"]', box.closest('figure') || box.parentNode), cur = Math.floor(N / 2), loaded = false, used = false, dragging = false, sx = 0, si = 0;
    function url(i) { return base + (i < 10 ? '0' : '') + i + '.webp'; }
    function set(i) {
      i = Math.max(0, Math.min(N - 1, Math.round(i)));
      if (i === cur) return;
      cur = i; img.src = url(i);
      if (range) range.value = i;
      box.setAttribute('aria-valuenow', i);
    }
    function preload() { if (loaded) return; loaded = true; for (var i = 0; i < N; i++) { var im = new Image(); im.src = url(i); } }
    function touched() { used = true; box.classList.add('used'); preload(); }
    box.addEventListener('pointerdown', function (e) { touched(); dragging = true; sx = e.clientX; si = cur; box.classList.add('drag'); try { box.setPointerCapture(e.pointerId); } catch (x) {} });
    box.addEventListener('pointermove', function (e) { if (dragging) set(si + (e.clientX - sx) / box.clientWidth * 58); });
    function end() { dragging = false; box.classList.remove('drag'); }
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); touched(); set(cur - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); touched(); set(cur + 1); }
    });
    if (range) range.addEventListener('input', function () { touched(); set(+range.value); });
    /* one slow look left and right the first time it scrolls into view, so it reads as something to drag */
    if (!reduce && 'IntersectionObserver' in window) {
      var seen = false;
      new IntersectionObserver(function (en, ob) {
        if (!en[0].isIntersecting || seen || used) return;
        seen = true; ob.disconnect(); preload();
        var t0 = null, mid = cur, dur = 3200;
        (function step(t) {
          if (used) return;
          if (t0 === null) t0 = t;
          var k = Math.min(1, (t - t0) / dur);
          set(mid + Math.sin(k * Math.PI * 2) * 7 * (1 - k * 0.2));
          if (k < 1) requestAnimationFrame(step);
        })(performance.now());
      }, { threshold: 0.7 }).observe(box);
    }
  });

  /* ---------- the film with chapters ---------- */
  $$('[data-film]').forEach(function (fig) {
    var v = $('video', fig), btns = $$('.chapter', fig), say = $('.film-desc', fig);
    function mark(i) { btns.forEach(function (b, j) { b.classList.toggle('on', i === j); }); if (say && btns[i]) say.innerHTML = '<b>' + btns[i].getAttribute('data-name') + '.</b> ' + btns[i].getAttribute('data-d'); }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { v.currentTime = +b.getAttribute('data-t'); var p = v.play(); if (p && p.catch) p.catch(function () {}); mark(i); });
    });
    v.addEventListener('timeupdate', function () {
      var t = v.currentTime, idx = 0;
      btns.forEach(function (b, i) { if (t >= +b.getAttribute('data-t') - 0.05) idx = i; });
      mark(idx);
    });
    mark(0);
  });

  /* ---------- the fee calculator ---------- */
  $$('[data-calc]').forEach(function (box) {
    var price = $('[data-in="price"]', box), take = $('[data-in="take"]', box);
    var out = { price: $('[data-o="price"]', box), take: $('[data-o="take"]', box) };
    function $m(n) { return (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2); }
    function run() {
      var p = +price.value, t = +take.value / 100;
      var rows = { take: p * t, card: 0.029 * p + 0.30, pay: 0.0025 * p + 0.25, acct: 2.00 };
      var net = rows.take - rows.card - rows.pay - rows.acct, top = rows.take;
      out.price.textContent = '$' + p; out.take.textContent = (+take.value) + '%';
      $('[data-l="take"]', box).textContent = (+take.value) + '% of the sale';
      Object.keys(rows).forEach(function (k) {
        $('[data-a="' + k + '"]', box).textContent = (k === 'take' ? '' : '−') + '$' + rows[k].toFixed(2);
        $('[data-b="' + k + '"]', box).style.width = Math.min(100, rows[k] / top * 100) + '%';
      });
      var n = $('[data-net]', box); n.textContent = $m(net); n.classList.toggle('neg', net < 0);
      $('[data-say]', box).textContent = net < 0
        ? 'At this price Roomly would lose money on every sale before it paid for anything else.'
        : 'Roomly would keep ' + $m(net) + ' of a $' + p + ' sale after the fees. Holding the money would also make it responsible for collecting sales tax.';
    }
    $$('input', box).forEach(function (i) { i.addEventListener('input', run); });
    $$('[data-price]', box).forEach(function (b) { b.addEventListener('click', function () { price.value = b.getAttribute('data-price'); run(); }); });
    run();
  });

  /* ---------- a bug you can reproduce: what "the same row" meant ---------- */
  $$('[data-bug]').forEach(function (box) {
    var ROWS = [
      ['Northwind Aerospace', 'Mechanical Design Engineer I', 'Sep 2', '3f9a'],
      ['Contoso Flight Systems', 'GNC Engineer, New Grad', 'Sep 4', '71c2'],
      ['Northwind Aerospace', 'Mechanical Design Engineer I', 'Sep 9', 'b05e'],
      ['Northwind Aerospace', 'Mechanical Design Engineer I', 'Sep 15', '8d44'],
      ['Litware Composites', 'Manufacturing Engineer I', 'Sep 16', 'e912'],
      ['Northwind Aerospace', 'Mechanical Design Engineer I', 'Sep 19', '2a6f']
    ];
    var body = $('tbody', box), nOut = $('[data-n]', box), arch = $('[data-arch]', box), say = $('[data-say]', box), segs = $$('.seg button', box);
    var mode = 'old', gone = {}, hit = -1;
    function key(r) { return mode === 'old' ? (r[0] + '|' + r[1]).toLowerCase() : 'page ' + r[3] + '…'; }
    function render() {
      body.innerHTML = '';
      var showing = 0, hidden = 0;
      ROWS.forEach(function (r, i) {
        var tr = document.createElement('tr'), g = !!gone[i];
        if (g) { tr.className = 'gone' + (i === hit ? ' hit' : ''); hidden++; } else showing++;
        var c1 = document.createElement('td'), s = document.createElement('strong');
        s.textContent = r[0]; c1.appendChild(s); c1.appendChild(document.createElement('br')); c1.appendChild(document.createTextNode(r[1]));
        var c2 = document.createElement('td'); c2.textContent = r[2];
        var c3 = document.createElement('td'); c3.className = 'key'; c3.textContent = key(r);
        var c4 = document.createElement('td');
        if (!g) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'rowbtn'; b.textContent = 'Archive';
          b.setAttribute('aria-label', 'Archive ' + r[0] + ', applied ' + r[2]);
          b.addEventListener('click', function () { archive(i); }); c4.appendChild(b);
        } else c4.textContent = 'hidden';
        tr.appendChild(c1); tr.appendChild(c2); tr.appendChild(c3); tr.appendChild(c4); body.appendChild(tr);
      });
      nOut.textContent = showing;
      arch.textContent = mode === 'new' && hidden ? '(+' + hidden + ' archived)' : '';
    }
    function archive(i) {
      hit = i;
      var before = Object.keys(gone).length;
      if (mode === 'old') { var k = key(ROWS[i]); ROWS.forEach(function (r, j) { if (key(r) === k) gone[j] = 1; }); } else gone[i] = 1;
      var removed = Object.keys(gone).length - before;
      say.textContent = removed > 1
        ? 'One click hid ' + removed + ' rows, because they shared a key. That is the bug.'
        : 'One click hid one row. The others stay.';
      render();
    }
    function reset() { gone = {}; hit = -1; say.textContent = 'Archive any one of the four identical rows.'; render(); }
    segs.forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); segs.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }); reset(); }); });
    var rb = $('[data-reset]', box); if (rb) rb.addEventListener('click', reset);
    reset();
  });

  /* ---------- case pages: mark the section being read ---------- */
  (function () {
    var links = $$('.toc a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {}, visible = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var current = null;
      Object.keys(map).forEach(function (id) { if (visible[id] && !current) current = id; });
      if (current) links.forEach(function (a) { a.classList.toggle('on', a === map[current]); });
    }, { rootMargin: '-18% 0px -62% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io2.observe(s); });
  })();

  /* ---------- Newton's method on the drag curve (analysis page) ----------
     Same model the figure is drawn from: D = Dmin/2 * ((V/Vmd)^2 + (Vmd/V)^2). */
  (function () {
    var svg = $('#nr-svg'), layer = $('#nr-layer'), v0 = $('#nr-v0'), runB = $('#nr-run');
    if (!svg || !layer || !v0 || !runB) return;
    var d = svg.dataset, NS = 'http://www.w3.org/2000/svg';
    var X0 = +d.x0, SX = +d.sx, VMIN = +d.vmin, Y0 = +d.y0, SY = +d.sy, VMD = +d.vmd, DMIN = +d.dmin, T = 1.1 * DMIN;
    var out = $('#nr-v0-o'), tt = $('#nr-t'), td = $('#nr-d'), timer = null;
    function D(V) { var r = V / VMD; return DMIN / 2 * (r * r + 1 / (r * r)); }
    function dD(V) { return DMIN * (V / (VMD * VMD) - VMD * VMD / (V * V * V)); }
    function px(V) { return X0 + (V - VMIN) * SX; }
    function py(F) { return Y0 - F * SY; }
    function el(name, a) { var n = document.createElementNS(NS, name); for (var k in a) n.setAttribute(k, a[k]); layer.appendChild(n); return n; }
    function clear() { clearTimeout(timer); while (layer.firstChild) layer.removeChild(layer.firstChild); }
    function solve(V) {
      var steps = [], res = { steps: steps, ok: false, why: '' };
      for (var k = 0; k < 25; k++) {
        var f = D(V) - T;
        if (Math.abs(f) < 1e-4) { res.ok = true; res.V = V; return res; }
        var s = dD(V);
        if (Math.abs(s) < 1e-7) { res.why = 'flat'; res.V = V; return res; }
        var Vn = V - f / s; steps.push([V, Vn]);
        if (!(Vn > 0)) { res.why = 'negative'; res.V = Vn; return res; }
        V = Vn;
      }
      res.why = 'slow'; res.V = V; return res;
    }
    function mark(V) {
      clear();
      el('line', { x1: px(V), x2: px(V), y1: py(50), y2: Y0, 'class': 'nr-start' });
      el('circle', { cx: px(V), cy: py(D(V)), r: 4.5, 'class': 'nr-dot' });
    }
    function draw(s, last) {
      var a = s[0], b = s[1], okb = b > 0 && isFinite(D(b));
      el('line', { x1: px(a).toFixed(1), y1: py(D(a)).toFixed(1), x2: px(b).toFixed(1), y2: py(T).toFixed(1), 'class': 'nr-tan' });
      if (okb) el('line', { x1: px(b).toFixed(1), y1: py(T).toFixed(1), x2: px(b).toFixed(1), y2: py(D(b)).toFixed(1), 'class': 'nr-drop' });
      el('circle', { cx: px(a).toFixed(1), cy: py(D(a)).toFixed(1), r: 3.4, 'class': 'nr-dot' });
      if (okb) el('circle', { cx: px(b).toFixed(1), cy: py(D(b)).toFixed(1), r: last ? 5 : 3.4, 'class': last ? 'nr-dot end' : 'nr-dot' });
    }
    function say(head, body, bad) { tt.textContent = head; tt.className = bad ? 'bad' : ''; td.textContent = body; }
    function verdict(V0, r) {
      var n = r.steps.length, far = 0, steps = n + (n === 1 ? ' step' : ' steps');
      r.steps.forEach(function (s) { if (s[1] > far) far = s[1]; });
      if (r.ok) {
        if (far > 300) say('Converged to ' + r.V.toFixed(1) + ' m/s in ' + steps, 'From ' + V0 + ' m/s the curve is nearly flat, so the first tangent sends the next guess to ' + Math.round(far) + ' m/s, far off the chart. It still converges, after a long detour.');
        else say('Converged to ' + r.V.toFixed(1) + ' m/s in ' + steps, 'The tangents walk along the curve to the ' + (r.V > VMD ? 'upper' : 'lower') + ' crossing. Which crossing you get depends on which side of the minimum you start.');
      } else if (r.why === 'negative') {
        say('Stopped after ' + steps + ': negative airspeed', 'This close to the bottom of the curve the tangent is almost flat, and the step lands at ' + Math.round(r.V) + ' m/s. The solver stopped without an answer, which is why ours reports success only when the residual is met.', true);
      } else if (r.why === 'flat') {
        say('Stopped: the slope is zero', 'At the minimum the tangent is flat, so Newton’s method has nowhere to go. It has to stop and say so.', true);
      } else {
        say('Stopped after 25 steps', 'No answer inside the step limit. Stopping is not the same as succeeding.', true);
      }
    }
    function run() {
      var V0 = +v0.value, r = solve(V0), i = 0;
      mark(V0);
      if (reduce || !r.steps.length) { r.steps.forEach(function (s, k) { draw(s, r.ok && k === r.steps.length - 1); }); verdict(V0, r); return; }
      say('Searching from ' + V0 + ' m/s', 'Each step follows the tangent from the current guess to the blue line.');
      (function next() {
        draw(r.steps[i], r.ok && i === r.steps.length - 1);
        tt.textContent = 'Step ' + (i + 1) + ': ' + r.steps[i][0].toFixed(1) + ' → ' + r.steps[i][1].toFixed(1) + ' m/s';
        i++;
        timer = setTimeout(i < r.steps.length ? next : function () { verdict(V0, r); }, i < 4 ? 600 : 300);
      })();
    }
    v0.addEventListener('input', function () {
      out.textContent = v0.value + ' m/s'; mark(+v0.value);
      say('Where is drag 10% above its minimum?', 'Press Run to search from ' + v0.value + ' m/s.');
    });
    runB.addEventListener('click', run);
    mark(+v0.value);
  })();
})();
