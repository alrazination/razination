/* =====================================================================
   RAZINATION · interaction layer (no libraries)
   reel · reveals · story scroll · cards · steps · player · form
   ===================================================================== */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  var SIMS = window.RAZ_SIMS || [];
  var BY = {}; SIMS.forEach(function (s, i) { s.index = i; BY[s.slug] = s; });
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---------------- entrance + header ---------------- */
  requestAnimationFrame(function () { document.body.classList.add('is-in'); });
  var top = $('.top');
  function onScrollHeader() { top && top.classList.toggle('is-scrolled', window.scrollY > 30); }
  window.addEventListener('scroll', onScrollHeader, { passive: true }); onScrollHeader();

  /* ---------------- reveals ---------------- */
  var revealEls = $$('.reveal-up, .sec .reveal, .who .reveal, .hero--page .reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var rio = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { rio.observe(el); });
  } else revealEls.forEach(function (el) { el.classList.add('is-in'); });

  /* ---------------- cursor light ---------------- */
  var glow = $('.glow');
  if (glow && fine && !reduce) {
    window.addEventListener('pointermove', function (e) {
      glow.style.setProperty('--gx', e.clientX + 'px'); glow.style.setProperty('--gy', e.clientY + 'px');
      glow.classList.add('is-on');
    }, { passive: true });
    document.addEventListener('pointerleave', function () { glow.classList.remove('is-on'); });
  }

  /* ---------------- hero reel: real footage, back to back ---------------- */
  (function () {
    var hero = $('.hero:not(.hero--page)');
    if (!hero) return;
    var order = window.RAZ_REEL || [];
    var reel = order.length ? order.map(function (k) { return BY[k]; }).filter(Boolean) : SIMS.filter(function (s) { return s.clip; });
    var vids = $$('.hero__v', hero);
    if (!reel.length || reduce || !vids.length) return;
    var tc = $('[data-tc]', hero), cs = $('[data-case]', hero), tp = $('[data-topic]', hero);
    var dO = $('[data-do]', hero), hp = $('[data-hap]', hero), cue = $('.cue', hero);
    // ambient light: paint a tiny copy of the footage, blurred, behind everything
    var amb = $('.hero__amb', hero), ctx = amb && amb.getContext('2d');
    (function paint() {
      if (ctx && visible && !document.hidden) { try { ctx.drawImage(vids[active], 0, 0, amb.width, amb.height); } catch (e) {} }
      setTimeout(function () { requestAnimationFrame(paint); }, 120);
    })();
    var cur = 0, active = 0, elapsed = 0, visible = true, cutDone = false;

    function caption(s) {
      cs.textContent = pad(cur + 1) + '/' + pad(reel.length);
      tp.textContent = s.topic;
      dO.textContent = s.triad[0];
      hp.textContent = s.triad[1]; hp.style.opacity = 0; cutDone = false;
    }
    function start(p) { if (p && p.catch) p.catch(function () {}); }
    function play(i) {
      cur = i % reel.length;
      var s = reel[cur], v = vids[active], other = vids[1 - active];
      if (v.getAttribute('src') !== s.clip) v.src = s.clip;
      v.currentTime = 0;
      caption(s);
      start(v.play());
      v.classList.add('is-on'); other.classList.remove('is-on');
      var n = reel[(cur + 1) % reel.length];
      setTimeout(function () { if (other.getAttribute('src') !== n.clip) { other.src = n.clip; other.load(); } }, 900);
    }
    vids.forEach(function (v, k) {
      v.addEventListener('timeupdate', function () {
        if (k !== active || !v.duration) return;
        var f = v.currentTime / v.duration;
        cue.style.setProperty('--p', f.toFixed(3));
        var t = Math.floor(elapsed + v.currentTime);
        tc.textContent = pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t / 60) % 60) + ':' + pad(t % 60);
        if (f > .4 && !cutDone) {
          cutDone = true; hp.style.opacity = 1;
          hero.classList.remove('is-cut'); void hero.offsetWidth; hero.classList.add('is-cut');
        }
      });
      v.addEventListener('ended', function () {
        if (k !== active) return;
        elapsed += v.duration || 0;
        active = 1 - active;
        play(cur + 1);
      });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible) start(vids[active].play()); else vids[active].pause();
      }, { threshold: .05 }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) vids[active].pause(); else if (visible) start(vids[active].play());
    });
    play(0);
  })();

  /* ---------------- story: slide 14 vs the simulation ---------------- */
  (function () {
    var story = $('.story');
    if (!story) return;
    var vid = $('.story__sim video', story);
    if (reduce) { vid.src = vid.getAttribute('data-src'); vid.controls = true; return; }
    var caps = $$('.story__cap', story), loaded = false, last = -1;
    function update() {
      var r = story.getBoundingClientRect(), H = window.innerHeight;
      var p = clamp(-r.top / (r.height - H), 0, 1);
      var s1 = clamp(p / .35, 0, 1), s2 = clamp((p - .38) / .27, 0, 1);
      story.style.setProperty('--p', p.toFixed(4));
      story.style.setProperty('--s1', s1.toFixed(4));
      story.style.setProperty('--s2', s2.toFixed(4));
      var step = p < .16 ? 0 : p < .4 ? 1 : p < .74 ? 2 : 3;
      if (step !== last) { caps.forEach(function (c, i) { c.classList.toggle('is-on', i === step); }); last = step; }
      if (p > .2 && !loaded) { vid.src = vid.getAttribute('data-src'); vid.load(); loaded = true; }
      if (loaded) {
        if (p > .42 && r.bottom > H * .5 && vid.paused && !vid.ended) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); }
        if (p <= .38) { vid.pause(); if (vid.currentTime) vid.currentTime = 0; }
      }
    }
    var ticking = false;
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
    window.addEventListener('resize', update); update();
  })();

  /* ---------------- process: the signal walks the weeks, each drawing appears as it arrives ---------------- */
  (function () {
    var flow = $('[data-flow]');
    if (!flow) return;
    var steps = $$('.step', flow), line = $('.flow__line', flow);
    if (reduce) { steps.forEach(function (st) { st.classList.add('is-on'); }); return; }
    flow.classList.add('is-js');
    var k = -1, timer = null, live = false;
    function pos(i) {
      var dot = $('.step__dot', steps[i]), lr = line.getBoundingClientRect(), dr = dot.getBoundingClientRect();
      return { x: dr.left + dr.width / 2 - lr.left, y: dr.top + dr.height / 2 - lr.top };
    }
    function go(i) {
      k = i;
      var p = pos(i);
      flow.style.setProperty('--fx', Math.max(0, p.x) + 'px');
      flow.style.setProperty('--fy', Math.max(0, p.y) + 'px');
      steps.forEach(function (st, j) { st.classList.toggle('is-on', j <= i); });
    }
    function reset() {
      flow.classList.add('is-reset');
      steps.forEach(function (st) { st.classList.remove('is-on'); });
      flow.style.setProperty('--fx', '0px'); flow.style.setProperty('--fy', '0px');
      void flow.offsetWidth; flow.classList.remove('is-reset'); k = -1;
    }
    function tick() {
      if (!live) return;
      if (k >= steps.length - 1) { timer = setTimeout(function () { reset(); timer = setTimeout(tick, 700); }, 3200); return; }
      go(k + 1);
      timer = setTimeout(tick, 2100);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        var was = live; live = en[0].isIntersecting;
        if (live && !was) { clearTimeout(timer); timer = setTimeout(tick, 400); }
        if (!live) clearTimeout(timer);
      }, { threshold: .35 }).observe(flow);
    } else steps.forEach(function (st) { st.classList.add('is-on'); });
    window.addEventListener('resize', function () { if (k >= 0) go(k); });
  })();

  /* ---------------- carousel: the centred card faces you and plays ---------------- */
  $$('[data-carousel]').forEach(function (car) {
    var track = $('.carousel__track', car), cards = $$('.card', track), count = $('[data-count]', car), center = null;
    function update() {
      var r = track.getBoundingClientRect(), mid = r.left + r.width / 2, best = null, bestD = 1e9;
      cards.forEach(function (c) {
        var cr = c.getBoundingClientRect(), d = (cr.left + cr.width / 2 - mid) / (cr.width + 24);
        var dd = clamp(d, -1.6, 1.6);
        c.style.setProperty('--d', dd.toFixed(3));
        c.style.setProperty('--ad', Math.min(1, Math.abs(dd)).toFixed(3));
        if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = c; }
      });
      var max = track.scrollWidth - track.clientWidth;
      car.style.setProperty('--cp', max > 0 ? (track.scrollLeft / max).toFixed(3) : 0);
      if (best !== center) {
        if (center) { center.classList.remove('is-center'); var ov = $('video', center); if (ov) ov.pause(); }
        center = best; center.classList.add('is-center');
        if (count) count.textContent = pad(cards.indexOf(center) + 1);
        var v = $('video', center);
        if (v && !reduce && inView) {
          if (!v.getAttribute('src')) { v.src = v.getAttribute('data-src'); v.addEventListener('playing', function () { v.classList.add('is-ready'); }, { once: true }); }
          var pp = v.play(); if (pp && pp.catch) pp.catch(function () {});
        }
      }
    }
    var inView = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
      inView = en[0].isIntersecting;
      if (!inView && center) { var v = $('video', center); if (v) v.pause(); }
      else if (center) { var c0 = center; center = null; c0.classList.remove('is-center'); update(); }
    }, { threshold: .3 }).observe(track);
    var ticking = false;
    track.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
    window.addEventListener('resize', update);
    function go(dir) {
      var i = clamp(cards.indexOf(center) + dir, 0, cards.length - 1), c = cards[i];
      track.scrollTo({ left: c.offsetLeft - (track.clientWidth - c.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
    $$('.carousel__btn', car).forEach(function (b) { b.addEventListener('click', function () { go(+b.getAttribute('data-dir')); }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    // drag with a mouse; a click without movement still opens the card
    var down = null, moved = false;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, s: track.scrollLeft }; moved = false; });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (Math.abs(dx) > 6) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = down.s - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = null; track.classList.remove('is-drag');
      if (moved) { go(0); setTimeout(function () { moved = false; }, 0); }
    });
    track.addEventListener('click', function (e) {
      if (moved) { e.stopPropagation(); e.preventDefault(); return; }
      var c = e.target.closest('.card');
      if (c && c !== center) { e.stopPropagation(); e.preventDefault(); go(cards.indexOf(c) - cards.indexOf(center)); }
    }, true);
    update();
  });

  /* ---------------- player ---------------- */
  var dlg = $('.player'), screenEl = dlg && $('.player__screen', dlg), frame = null, curSim = null, opener = null;
  function fit() {
    if (!frame) return;
    var w = screenEl.clientWidth, h = screenEl.clientHeight, s = Math.min(w / 1280, h / 720);
    frame.style.transform = 'translate(' + ((w - 1280 * s) / 2) + 'px,' + ((h - 720 * s) / 2) + 'px) scale(' + s + ')';
  }
  function load(sim) {
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.src = sim.path;
    frame.title = sim.title + ': interactive simulation';
    frame.setAttribute('allow', 'autoplay; fullscreen');
    screenEl.appendChild(frame);
    fit();
    frame.addEventListener('load', function () {
      try {
        frame.focus();
        // Escape inside the simulation closes the player too (same origin)
        frame.contentWindow.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      } catch (e) {}
    });
  }
  function fullscreen(sideways) {
    var req = screenEl.requestFullscreen || screenEl.webkitRequestFullscreen;
    if (!req) return;
    try {
      var p = req.call(screenEl);
      if (p && p.then) p.then(function () {
        if (sideways && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
      }).catch(function () {});
    } catch (e) {}
  }
  function open(slug) {
    var sim = BY[slug];
    if (!sim || !dlg) return;
    curSim = sim; opener = document.activeElement;
    $('[data-p-topic]', dlg).textContent = sim.topic + ' · ' + sim.audience;
    var t = $('[data-p-title]', dlg); t.textContent = sim.title;
    if (sim.lang) t.setAttribute('lang', sim.lang); else t.removeAttribute('lang');
    $('[data-p-do]', dlg).textContent = sim.triad[0];
    $('[data-p-hap]', dlg).textContent = sim.triad[1];
    $('[data-p-stick]', dlg).textContent = sim.triad[2];
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    load(sim);
    if (!matchMedia('(min-width: 821px)').matches) fullscreen(true);
  }
  function close() {
    if (dlg.open && dlg.close) dlg.close(); else { dlg.removeAttribute('open'); cleanup(); }
  }
  function cleanup() {
    if (frame) { frame.remove(); frame = null; }
    document.body.style.overflow = '';
    if (opener && opener.focus) opener.focus();
  }
  if (dlg) {
    dlg.addEventListener('close', cleanup);
    $('[data-p-close]', dlg).addEventListener('click', close);
    $('[data-p-restart]', dlg).addEventListener('click', function () { if (curSim) load(curSim); });
    $('[data-p-full]', dlg).addEventListener('click', function () { fullscreen(false); });
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(screenEl);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-play]');
    if (!b) return;
    e.preventDefault();
    open(b.getAttribute('data-play'));
  });

  /* deep links: #slug highlights a card, ?play=slug opens it */
  (function () {
    var q = new URLSearchParams(location.search).get('play');
    if (q && BY[q]) open(q);
    var h = location.hash.slice(1), card = h && document.getElementById('sim-' + h);
    if (card) { card.classList.add('is-target'); setTimeout(function () { card.scrollIntoView({ block: 'center' }); }, 60); }
  })();

  /* ---------------- questionnaire: one question at a time ---------------- */
  (function () {
    var box = $('[data-wizard]');
    if (!box) return;
    var qs = $$('.qs', box), label = $('[data-step-label]', box), cur = 0;
    box.classList.add('is-wizard');
    function show(i, focus) {
      cur = clamp(i, 0, qs.length - 1);
      qs.forEach(function (q, j) { q.classList.toggle('is-on', j === cur); });
      label.textContent = 'Question ' + (cur + 1) + ' of ' + qs.length;
      box.style.setProperty('--wp', ((cur + 1) / qs.length).toFixed(3));
      if (focus) { var f = $('input:not([type=hidden]), textarea', qs[cur]); if (f) f.focus({ preventScroll: true }); }
    }
    qs.forEach(function (q, i) {
      var next = $('[data-next]', q), back = $('[data-back]', q), multi = q.hasAttribute('data-multi');
      if (next) next.addEventListener('click', function () { show(i + 1, true); });
      if (back) back.addEventListener('click', function () { show(i - 1, true); });
      q.addEventListener('change', function (e) {
        if (!e.target.matches('input[type=radio], input[type=checkbox]')) return;
        if (!multi) setTimeout(function () { show(i + 1, true); }, 260);
        else if (next) next.firstChild.textContent = $$('input:checked', q).length ? 'Next' : 'Skip';
      });
    });
    show(0, false);
  })();

  /* ---------------- contact form (Web3Forms; plain POST without JS) ---------------- */
  var form = $('#report');
  if (form && window.fetch && window.FormData && /web3forms/.test(form.action)) {
    var box = form.closest('.report');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var btn = $('[type=submit]', form), label = $('.lab', btn), was = label.textContent, err = $('.report__err', box);
      btn.disabled = true; label.textContent = 'Sending…'; err.textContent = '';
      var data = new FormData(form), keys = {};
      Array.prototype.forEach.call(form.querySelectorAll('.qs input[type=checkbox]'), function (i) { keys[i.name] = 1; });
      Object.keys(keys).forEach(function (k) { var v = data.getAll(k).join(', '); data.delete(k); if (v) data.append(k, v); });
      fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.success) throw new Error(j.message || 'failed');
          box.classList.add('is-sent');
          var d = $('.report__done', box); d && d.focus();
        })
        .catch(function () {
          btn.disabled = false; label.textContent = was;
          err.textContent = 'That didn’t go through. Please try again, or use the links on the left.';
        });
    });
  }
})();
