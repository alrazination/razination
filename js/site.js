/* =====================================================================
   RAZINATION · interaction layer (no libraries)
   1. Stage      one 1280x720 simulation at a time, scaled to fit
   2. Replay     the "your move → what happens" preview on each stage
   3. Tabs       the three simulations on the home page
   4. Theater    the simulations page (all eight)
   5. Slide 14   the slide vs simulation comparison
   6. Gantt      draws in once when it comes into view
   7. Contact    the incident report form (Web3Forms)
   8. Share      "send to my laptop" on phones
   ===================================================================== */
(function () {
  'use strict';

  var SIMS = window.RAZ_SIMS || [];
  var BY = {};
  SIMS.forEach(function (s, i) { s.index = i; BY[s.slug] = s; });
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 1280, H = 720;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function thumb(s, mistake) { return 'img/thumbs/' + s.slug + (mistake ? '' : '-start') + '.webp'; }
  function simSrc(s) { return 'sims/' + s.slug + '/index.html'; }

  /* ---------------------------------------------------------------
     1 + 2. STAGE with REPLAY
     --------------------------------------------------------------- */
  var stages = [];

  function Stage(el) {
    var self = this;
    this.el = el;
    this.screen = $('.screen', el);
    this.cover = $('.cover', el);
    this.before = $('.cover .before', el);
    this.after = $('.cover .after', el);
    this.markTxt = $('.cover__mark .txt', el);
    this.deck = $('.deck', el);
    this.track = $('.track', el);
    this.range = $('.track input', el);
    this.pauseBtn = $('.replay__btn', el);
    this.live = $('[data-live]', el);
    this.frame = null;
    this.sim = BY[el.getAttribute('data-sim')] || SIMS[0];
    this.v = 0;
    this.cutAt = 0.42;
    this.playing = false;
    this.userTook = false;   // any interaction stops autoplay for good
    this.visible = false;
    this.onEnd = null;

    $('.start', el).addEventListener('click', function () { self.start(true); });
    $$('[data-fullscreen]', el).forEach(function (b) { b.addEventListener('click', function () { self.fullscreen(); }); });
    $$('[data-reset]', el).forEach(function (b) { b.addEventListener('click', function () { self.unload(); self.start(true); }); });

    if (this.range) {
      this.range.addEventListener('input', function () { self.takeOver(); self.set(self.range.value / 1000, true); });
      this.range.addEventListener('pointerdown', function () { self.takeOver(); });
    }
    if (this.pauseBtn) this.pauseBtn.addEventListener('click', function () {
      if (self.playing) { self.takeOver(); }
      else { self.userTook = false; if (self.v >= 1) self.set(0); self.play(); }
    });
    // clicking the picture jumps between "your move" and "what happens"
    this.cover.addEventListener('click', function (e) {
      if (e.target.closest('.start')) return;
      self.takeOver(); self.set(self.v < self.cutAt ? 1 : 0, true);
    });
    el.addEventListener('mouseenter', function () { self.hover = true; });
    el.addEventListener('mouseleave', function () { self.hover = false; });
    el.addEventListener('focusin', function () { self.hover = true; });
    el.addEventListener('focusout', function () { self.hover = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        self.visible = en[0].intersectionRatio >= 0.3;
      }, { threshold: [0, 0.3, 0.6, 1] }).observe(this.screen);
    } else this.visible = true;

    if ('ResizeObserver' in window) new ResizeObserver(function () { self.fit(); }).observe(this.screen);
    else window.addEventListener('resize', function () { self.fit(); });
    document.addEventListener('fullscreenchange', function () { self.fit(); });
    document.addEventListener('webkitfullscreenchange', function () { self.fit(); });

    this.paint();
    this.set(reduce ? 1 : 0);
  }

  Stage.prototype.paint = function () {
    var s = this.sim;
    this.el.setAttribute('data-sim', s.slug);
    this.before.src = thumb(s, false); this.before.alt = 'Your move: ' + s.alt;
    this.after.src = thumb(s, true); this.after.alt = 'What happens: ' + s.altMistake;
    if (this.markTxt) this.markTxt.textContent = s.readout;
    var t = s.triad;
    $$('[data-triad]', this.el).forEach(function (n) { n.textContent = t[+n.getAttribute('data-triad')]; });
    $$('[data-field]', this.el).forEach(function (n) {
      var k = n.getAttribute('data-field');
      n.textContent = k === 'num' ? String(s.index + 1).padStart(2, '0') + ' / ' + String(SIMS.length).padStart(2, '0') : s[k];
      if (k === 'title') { if (s.lang) n.setAttribute('lang', s.lang); else n.removeAttribute('lang'); }
    });
    $$('[data-newtab]', this.el).forEach(function (a) { a.href = simSrc(s); });
    var startLabel = $('.start .lab', this.el);
    if (startLabel) startLabel.textContent = 'Play: ' + s.tab;
    var live = this.live;
    if (live) live.textContent = '';
  };

  Stage.prototype.set = function (v, announce) {
    v = Math.max(0, Math.min(1, v));
    var was = this.v >= this.cutAt;
    this.v = v;
    var after = v >= this.cutAt;
    this.track && this.track.style.setProperty('--v', v);
    if (this.range) {
      this.range.value = Math.round(v * 1000);
      this.range.setAttribute('aria-valuetext', after ? 'What happens: ' + this.sim.triad[1] : 'Your move: ' + this.sim.triad[0]);
    }
    this.cover.classList.toggle('is-after', after);
    if (after !== was && after && !reduce) {
      var c = this.cover;
      c.classList.add('is-cut');
      setTimeout(function () { c.classList.remove('is-cut'); }, 140);
    }
    if (this.deck) {
      var cells = $$('.deck__cell', this.deck);
      cells[1] && cells[1].classList.toggle('is-lit', after);
      cells[2] && cells[2].classList.toggle('is-lit', v >= 0.82);
    }
    if (this.tab) this.tab.style.setProperty('--prog', v);
    if (announce && this.live) {
      this.live.textContent = this.sim.tab + '. ' + (after ? 'What happens: ' + this.sim.triad[1] + '.' : 'Your move: ' + this.sim.triad[0] + '.');
    }
  };

  /* autoplay: 2.5 s "your move", hard cut, 3.5 s "what happens" */
  Stage.prototype.play = function () {
    if (reduce || this.frame) return;
    var self = this, DUR = 6000, last = null;
    this.playing = true;
    this.deck && this.deck.classList.add('is-replaying');
    this.el.classList.add('is-playing');
    this.pauseIcon(true);
    cancelAnimationFrame(this.raf);
    function step(ts) {
      if (!self.playing) return;
      var dt = last == null ? 0 : ts - last;
      last = ts;
      var hold = self.hover || !self.visible || document.hidden;
      if (!hold) self.set(self.v + dt / DUR);
      if (self.v >= 1) {
        self.playing = false;
        self.pauseIcon(false);
        self.deck && self.deck.classList.remove('is-replaying');
        if (self.onEnd && !self.userTook) setTimeout(function () { if (!self.userTook && !self.frame) self.onEnd(); }, 700);
        return;
      }
      self.raf = requestAnimationFrame(step);
    }
    this.raf = requestAnimationFrame(step);
  };

  Stage.prototype.stop = function () {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.deck && this.deck.classList.remove('is-replaying');
    this.el.classList.remove('is-playing');
    this.pauseIcon(false);
  };

  Stage.prototype.takeOver = function () {
    this.userTook = true;
    this.stop();
    if (this.v < 1 && this.deck) this.deck.classList.remove('is-replaying');
  };

  Stage.prototype.pauseIcon = function (playing) {
    if (!this.pauseBtn) return;
    this.pauseBtn.setAttribute('aria-label', playing ? 'Pause the replay' : 'Play the replay');
    this.pauseBtn.innerHTML = playing
      ? '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" fill="currentColor"/><rect x="8.5" y="1" width="3.5" height="12" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1 L13 7 L3 13Z" fill="currentColor"/></svg>';
  };

  Stage.prototype.fit = function () {
    var box = this.screen;
    var fs = (document.fullscreenElement || document.webkitFullscreenElement) === box;
    var bw = box.clientWidth, bh = fs ? box.clientHeight : bw * H / W;
    var s = Math.min(bw / W, bh / H);
    if (this.frame) {
      this.frame.style.transform = 'translate(' + Math.max(0, (bw - W * s) / 2) + 'px,' + Math.max(0, (bh - H * s) / 2) + 'px) scale(' + s + ')';
    }
  };

  Stage.prototype.start = function (scroll) {
    if (this.frame) return;
    var self = this;
    this.takeOver();
    stages.forEach(function (o) { if (o !== self) o.unload(); });
    var f = document.createElement('iframe');
    f.className = 'frame-sim';
    f.src = simSrc(this.sim);
    f.title = this.sim.title + ': interactive simulation';
    f.width = W; f.height = H;
    f.setAttribute('allow', 'autoplay; fullscreen');
    this.frame = f;
    this.screen.appendChild(f);
    this.el.classList.add('is-live');
    this.fit();
    f.addEventListener('load', function () {
      f.classList.add('is-ready');
      try { f.focus(); f.contentWindow.focus(); } catch (e) {}
    });
    if (scroll) {
      var top = this.screen.getBoundingClientRect().top + window.scrollY - (document.querySelector('.top') || {}).offsetHeight - 8;
      if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (this.live) this.live.textContent = this.sim.title + ' is loading. Press Tab to move into it.';
  };

  Stage.prototype.unload = function () {
    if (!this.frame) return;
    this.frame.remove();
    this.frame = null;
    this.el.classList.remove('is-live');
  };

  Stage.prototype.load = function (sim, opts) {
    opts = opts || {};
    this.unload();
    this.stop();
    this.sim = sim;
    this.paint();
    this.set(reduce || opts.showAfter ? 1 : 0);
    if (opts.start) this.start(opts.scroll);
    else if (opts.play) this.play();
  };

  Stage.prototype.fullscreen = function () {
    var box = this.screen, self = this;
    if (!this.frame) this.start(false);
    var req = box.requestFullscreen || box.webkitRequestFullscreen;
    function tab() { window.open(simSrc(self.sim), '_blank', 'noopener'); }
    if (!req) return tab();
    try { var p = req.call(box); if (p && p.catch) p.catch(tab); } catch (e) { tab(); }
  };

  $$('.stage').forEach(function (el) { var s = new Stage(el); el._stage = s; stages.push(s); });

  /* ---------------------------------------------------------------
     3. TABS (home page: three simulations in one stage)
     --------------------------------------------------------------- */
  $$('[data-tabs]').forEach(function (list) {
    var stage = document.getElementById(list.getAttribute('data-tabs'))._stage;
    var tabs = $$('[role=tab]', list);
    function select(i, how) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        t.style.setProperty('--prog', 0);
      });
      stage.tab = tabs[i];
      stage.load(BY[tabs[i].getAttribute('data-sim')], how);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { stage.userTook = true; select(i, { showAfter: false }); stage.play(); stage.userTook = true; });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowRight') n = (i + 1) % tabs.length;
        if (k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (k === 'Home') n = 0;
        if (k === 'End') n = tabs.length - 1;
        if (n != null) { e.preventDefault(); tabs[n].focus(); stage.userTook = true; select(n); stage.play(); stage.userTook = true; }
      });
    });
    stage.tab = tabs[0];
    // keep cycling through the three until the visitor takes over
    stage.onEnd = function () {
      var next = (tabs.indexOf(stage.tab) + 1) % tabs.length;
      select(next, { play: true });
    };
    if (!reduce) stage.play();
  });

  /* ---------------------------------------------------------------
     4. THEATER (simulations page)
     --------------------------------------------------------------- */
  var theater = $('[data-theater]');
  if (theater) {
    var st = theater._stage;
    var cards = $$('[data-card]');
    function mark(slug) {
      cards.forEach(function (c) { c.setAttribute('aria-current', c.getAttribute('data-card') === slug ? 'true' : 'false'); });
    }
    function go(slug, start) {
      var sim = BY[slug] || SIMS[0];
      st.load(sim, { start: start, scroll: start, showAfter: !start });
      mark(sim.slug);
      if (history.replaceState) history.replaceState(null, '', '#' + sim.slug);
      if (!start) { var h = $('.stage__title h2', theater); h && h.focus({ preventScroll: true }); }
    }
    cards.forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        go(c.getAttribute('data-card'), true);
        var h = $('.stage__title h2', theater);
        h && h.focus({ preventScroll: true });
      });
    });
    $$('[data-step]', theater).forEach(function (b) {
      b.addEventListener('click', function () {
        var n = (st.sim.index + (+b.getAttribute('data-step')) + SIMS.length) % SIMS.length;
        go(SIMS[n].slug, false);
      });
    });
    var initial = (location.hash || '').slice(1);
    st.userTook = true;
    if (BY[initial]) { st.load(BY[initial], { showAfter: true }); mark(initial); }
    else { mark(st.sim.slug); if (!reduce) { st.userTook = false; st.play(); st.onEnd = null; } }
    window.addEventListener('hashchange', function () {
      var h = location.hash.slice(1);
      if (BY[h] && h !== st.sim.slug) go(h, false);
    });
  }

  /* ---------------------------------------------------------------
     5. SLIDE 14
     --------------------------------------------------------------- */
  $$('[data-vs]').forEach(function (vs) {
    var btns = $$('.vs__switch button', vs);
    var live = $('[data-live]', vs);
    function show(sim) {
      vs.classList.toggle('is-sim', sim);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-show') === 'sim') === sim)); });
      if (live) live.textContent = sim ? 'Now showing the simulation: the car rolls off the jack.' : 'Now showing slide 14 of 38.';
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-show') === 'sim'); }); });
    $$('[data-next]', vs).forEach(function (b) { b.addEventListener('click', function () { show(true); }); });
    $$('[data-back]', vs).forEach(function (b) { b.addEventListener('click', function () { show(false); }); });
  });

  /* ---------------------------------------------------------------
     6. GANTT draws in once
     --------------------------------------------------------------- */
  var gantt = $('.gantt');
  if (gantt && !reduce && 'IntersectionObserver' in window) {
    gantt.classList.add('is-hidden');
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { gantt.classList.remove('is-hidden'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(gantt);
  }

  /* ---------------------------------------------------------------
     7. CONTACT (Web3Forms; works without JS as a normal POST)
     --------------------------------------------------------------- */
  var form = $('#report');
  if (form && window.fetch && window.FormData) {
    var box = form.closest('.report');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var btn = $('[type=submit]', form);
      btn.disabled = true;
      var data = new FormData(form);
      var topics = data.getAll('topic').join(', ');
      data.delete('topic');
      if (topics) data.append('topic', topics);
      box.classList.remove('is-error');
      fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.success) throw new Error(j.message || 'failed');
          box.classList.add('is-sent');
          var d = $('.report__done', box); d && d.focus();
        })
        .catch(function () { box.classList.add('is-error'); btn.disabled = false; });
    });
  }

  /* ---------------------------------------------------------------
     8. SHARE: phones can't play 1280x720 sims well; send the link on
     --------------------------------------------------------------- */
  $$('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.href.split('#')[0].replace(/index\.html$/, '') ;
      var st = b.closest('.stage') ? b.closest('.stage')._stage : null;
      var link = new URL('simulations.html' + (st ? '#' + st.sim.slug : ''), url).href;
      if (navigator.share) navigator.share({ title: 'Razination simulation', url: link }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { b.querySelector('.lab').textContent = 'Link copied'; });
    });
  });
})();
