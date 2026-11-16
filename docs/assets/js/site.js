/* Youssef Kartah · portfolio. Small, dependency-free enhancements.
   Every page reads fine without this file; it only adds the interactions. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;

  /* On a web server, link to "/" instead of "/index.html". Local files keep the full name. */
  if (location.protocol !== 'file:') {
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/(^|\/)index\.html(#|$)/.test(h)) a.setAttribute('href', h.replace(/index\.html(?=#|$)/, '') || './');
    });
  }

  /* ---------- video: our own play button, autoplay only when it is welcome ---------- */
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
    btn.addEventListener('click', function () {
      v.dataset.user = '1';
      if (v.paused) v.play(); else v.pause();
    });
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) { if (!v.paused) v.pause(); return; }
          if (v.hasAttribute('data-autoplay') && !reduce && !saveData && !v.dataset.user) {
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          }
        });
      }, { threshold: 0.35 }).observe(v);
    }
    sync();
  });

  /* ---------- figures with a two-state switch ---------- */
  $$('[data-toggle]').forEach(function (fig) {
    var btns = $$('[data-set]', fig);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var kv = b.getAttribute('data-set').split(':');
        fig.setAttribute('data-' + kv[0], kv[1]);
        btns.forEach(function (o) {
          if (o.getAttribute('data-set').split(':')[0] === kv[0]) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
        });
      });
    });
  });

  /* ---------- annotated photos: link each pin to its line in the list ---------- */
  $$('[data-pins]').forEach(function (box) {
    var fig = box.closest('.cols') || box.closest('figure') || document;
    var list = $('[data-pin-list]', fig) || $('[data-pin-list]', box.closest('section') || document);
    if (!list) return;
    function mark(n, on) {
      $$('[data-pin="' + n + '"]', box).concat($$('[data-pin="' + n + '"]', list)).forEach(function (el) { el.classList.toggle('on', on); });
    }
    $$('[data-pin]', box).concat($$('[data-pin]', list)).forEach(function (el) {
      var n = el.getAttribute('data-pin');
      el.addEventListener('pointerenter', function () { mark(n, true); });
      el.addEventListener('pointerleave', function () { mark(n, false); });
    });
  });

  /* ---------- case pages: mark the section being read ---------- */
  (function () {
    var links = $$('.toc a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var current = null;
      Object.keys(map).forEach(function (id) { if (visible[id] && !current) current = id; });
      if (current) links.forEach(function (a) { a.classList.toggle('on', a === map[current]); });
    }, { rootMargin: '-18% 0px -62% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  })();

  /* ---------- résumé ---------- */
  $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });

  /* ---------- Newton's method on the drag curve (analysis case study) ----------
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
      say('Searching from ' + V0 + ' m/s', 'Each step follows the tangent from the current guess to the orange line.');
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
