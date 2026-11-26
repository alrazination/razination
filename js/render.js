/* =====================================================================
   RAZINATION · page renderer
   Turns data/site.json into the editable regions of the static pages.
   Used by the admin panel (in the browser, on Publish) and by
   tools/build.js (with Node). The public pages never load this file.

   A region in a page looks like:  <!--@name--> ... <!--/@name-->
   ===================================================================== */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lines(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
  var WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
  function shown(d) { return (d.sims || []).filter(function (s) { return s.on; }); }
  function fill(str, d) {
    var n = shown(d).length;
    return String(str || '').replace(/\{n\}/g, n).replace(/\{N\}/g, WORDS[n] || String(n));
  }
  function bySlug(d, slug) { return shown(d).filter(function (s) { return s.slug === slug; })[0]; }
  function homeSims(d) {
    var list = (d.home && d.home.sims || []).map(function (slug) { return bySlug(d, slug); }).filter(Boolean);
    return list.length ? list : shown(d).slice(0, 3);
  }
  function reel(d) {
    var list = shown(d).filter(function (s) { return s.clip; });
    var f = d.hero && d.hero.reelFirst;
    list.sort(function (a, b) { return (b.slug === f) - (a.slug === f); });
    return list;
  }
  function moveImg(s) { return s.img.move || s.img.start; }
  function abs(d, p) { return (d.settings && d.settings.siteUrl || '').replace(/\/?$/, '/') + p; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todo(v, label) { return v && String(v).trim() ? lines(v) : '<span class="todo">[' + esc(label) + ']</span>'; }
  function first(name) { return String(name || '').split(' ')[0]; }
  function weeks(s) {
    var a = Math.floor(+s.start || 0) + 1, b = Math.max(a, Math.ceil(+s.end || 0));
    return a === b ? 'Week ' + a : 'Week ' + a + '–' + b;
  }
  var ARROW = '<svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg>';
  var OUT = '<svg class="ic" aria-hidden="true"><use href="#i-out"/></svg>';
  var PLAY = '<svg class="ic" aria-hidden="true"><use href="#i-play"/></svg>';

  function meta(d, page) {
    var m = d.meta[page] || {};
    var url = abs(d, page === 'home' ? '' : 'simulations.html');
    return '\n<title>' + esc(fill(m.title, d)) + '</title>' +
      '\n<meta name="description" content="' + esc(fill(m.description, d)) + '">' +
      '\n<meta property="og:title" content="' + esc(fill(m.ogTitle || m.title, d)) + '">' +
      '\n<meta property="og:description" content="' + esc(fill(m.ogDescription || m.description, d)) + '">' +
      '\n<meta property="og:image" content="' + esc(abs(d, 'img/og/razination.jpg')) + '">' +
      '\n<meta property="og:image:width" content="1200">' +
      '\n<meta property="og:image:height" content="630">' +
      '\n<meta property="og:url" content="' + esc(url) + '">' +
      '\n<link rel="canonical" href="' + esc(url) + '">' +
      '\n<meta property="og:type" content="website">' +
      '\n<meta name="twitter:card" content="summary_large_image">\n';
  }

  /* a simulation card: plays its footage on hover, opens the player on click */
  function card(s, i, big) {
    var lang = s.lang ? ' lang="' + esc(s.lang) + '"' : '';
    var media = s.clip
      ? '<video muted loop playsinline preload="none" poster="' + esc(moveImg(s)) + '" data-src="' + esc(s.clip) + '"></video>'
      : '<img class="card__after" src="' + esc(s.img.mistake) + '" alt="" loading="lazy">';
    return '\n        <article class="card' + (big ? ' card--big' : '') + '" id="sim-' + esc(s.slug) + '" data-sim="' + esc(s.slug) + '">' +
      '\n          <button class="card__hit" type="button" data-play="' + esc(s.slug) + '" aria-label="' + esc('Play ' + s.title) + '"></button>' +
      '\n          <div class="card__media"><img src="' + esc(moveImg(s)) + '" alt="' + esc(s.altMove || s.alt) + '" loading="lazy">' + media +
      '<span class="card__play">' + PLAY + 'Play</span><span class="card__n">' + pad(i + 1) + '</span></div>' +
      '\n          <div class="card__body">' +
      '\n            <p class="card__topic">' + esc(s.topic) + ' <span>· ' + esc(s.audience) + '</span></p>' +
      '\n            <h3' + lang + '>' + esc(s.title) + '</h3>' +
      '\n            <p class="card__chain"><span>' + esc(s.triad[0]) + '</span>' + ARROW + '<b>' + esc(s.triad[1]) + '</b></p>' +
      '\n          </div>' +
      '\n        </article>';
  }

  function footer(d, home) {
    var c = d.contact, h = home ? '#' : './#', links = [];
    if (c.email) links.push('<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>');
    if (c.phone) links.push('<li><a href="tel:' + esc(c.phone.replace(/[^+\d]/g, '')) + '">' + esc(c.phone) + '</a></li>');
    if (c.linkedin) links.push('<li><a href="' + esc(c.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a></li>');
    return '\n    <div class="foot__top">' +
      '\n      <p class="foot__why"><i class="sq" aria-hidden="true"></i>' + esc(d.footer.why) + '</p>' +
      '\n      <nav class="foot__nav" aria-label="Footer"><a href="simulations.html">Simulations</a><a href="' + h + 'how">How it works</a><a href="' + h + 'pricing">Pricing</a><a href="' + h + 'about">About</a><a href="' + h + 'contact">Contact</a></nav>' +
      '\n      <ul class="foot__contact">' + links.join('') + '</ul>' +
      '\n    </div>' +
      '\n    <p class="foot__mark" aria-hidden="true">raz<span class="i">ı</span>nation</p>' +
      '\n    <div class="foot__base"><span>© ' + esc(d.footer.year) + ' Razination · ' + esc(d.about.place) + '</span><span><a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></span></div>\n  ';
  }

  /* ---------------- home page ---------------- */
  function homeRegions(d) {
    var H = d.hero, A = d.about, P = d.process, R = d.pricing, C = d.contact, CS = d.contactSection;
    var r = {};
    r.meta = meta(d, 'home');

    r.hero = '\n      <p class="eyebrow reveal"><i class="sq" aria-hidden="true"></i>' + esc(H.eyebrow || '') + '</p>' +
      '\n      <h1 class="hero__h"><span class="ln"><span>' + esc(H.line1) + '</span></span><span class="ln ln--hot"><span>' + esc(H.line2) + '</span></span></h1>' +
      '\n      <div class="hero__foot">' +
      '\n        <p class="hero__lede reveal">' + esc(H.lede) + '</p>' +
      '\n        <div class="hero__cta reveal">' +
      '\n          <button class="btn btn--hot" type="button" data-play="' + esc(homeSims(d)[0].slug) + '">' + PLAY + esc(H.button) + '</button>' +
      '\n          <a class="btn btn--line" href="#contact">Get a fixed quote</a>' +
      '\n        </div>' +
      '\n      </div>\n    ';

    var reelFirst = reel(d)[0];
    r.reel = reelFirst ? '<img class="hero__poster" src="' + esc(reelFirst.img.mistake) + '" alt="" fetchpriority="high">' : '';

    r.facts = '\n      <ul class="facts">' + (d.plate || []).map(function (p) {
      return '\n        <li><span>' + esc(fill(p.label, d)) + '</span><b>' + esc(fill(p.value, d)) + '</b></li>';
    }).join('') + '\n      </ul>\n    ';

    var picks = homeSims(d), rest = shown(d).filter(function (s) { return picks.indexOf(s) < 0; }), all = picks.concat(rest);
    r.play = '\n      <div class="sec__head sec__head--row">' +
      '\n        <div><p class="eyebrow"><i class="sq" aria-hidden="true"></i>Play one. Get it wrong.</p>' +
      '\n        <h2 class="big reveal-up"><span>Pick your</span> <span class="hot">disaster.</span></h2></div>' +
      '\n        <p class="sec__lede">' + esc(d.home.demoNote) + '</p>' +
      '\n      </div>' +
      '\n      <div class="carousel" data-carousel>' +
      '\n        <div class="carousel__track" tabindex="0" aria-label="Simulations, scroll sideways">' +
      all.map(function (s) { return card(s, shown(d).indexOf(s), false); }).join('') +
      '\n        </div>' +
      '\n        <div class="carousel__ui">' +
      '\n          <button class="carousel__btn" type="button" data-dir="-1" aria-label="Previous simulation"><svg class="ic" aria-hidden="true" style="transform:scaleX(-1)"><use href="#i-arrow"/></svg></button>' +
      '\n          <button class="carousel__btn" type="button" data-dir="1" aria-label="Next simulation">' + ARROW + '</button>' +
      '\n          <span class="carousel__count"><b data-count>01</b> / ' + pad(all.length) + '</span>' +
      '\n          <span class="carousel__bar"><i></i></span>' +
      '\n          <a class="more" href="simulations.html">' + esc(fill('All {n} simulations', d)) + ARROW + '</a>' +
      '\n        </div>' +
      '\n      </div>\n    ';

    var ART = [
      /* find the moment: a lens scans the steps and stops on the one that goes wrong */
      '<svg viewBox="0 0 160 90" class="art art--find"><g class="art__row">' +
        [10, 36, 62, 88, 114, 140].map(function (x, k) { return '<rect x="' + (x - 9) + '" y="38" width="18" height="14" rx="2" class="' + (k === 3 ? 'art__bad' : 'art__ok') + '"/>'; }).join('') +
        '<path d="M10 45H150" class="art__thin"/></g><g class="art__lens"><circle cx="0" cy="45" r="15" class="art__ring"/><path d="M11 56l12 12" class="art__stroke"/></g></svg>',
      /* sketch it: a storyboard frame draws itself, then the consequence appears */
      '<svg viewBox="0 0 160 90" class="art art--sketch"><rect x="22" y="12" width="116" height="66" rx="3" class="art__draw"/>' +
        '<path d="M34 62h30l10-16 12 10 14-22 18 28" class="art__draw art__draw--2"/><circle cx="120" cy="30" r="7" class="art__pop"/></svg>',
      /* design the mistakes: one path splits, the wrong branch ends in a consequence */
      '<svg viewBox="0 0 160 90" class="art art--fork"><path d="M12 45h44c16 0 22-22 40-22h40" class="art__thin"/><path d="M56 45c16 0 22 22 40 22h40" class="art__thin"/>' +
        '<circle r="5" class="art__runner"><animateMotion dur="3.2s" repeatCount="indefinite" path="M12 45h44c16 0 22 22 40 22h40"/></circle>' +
        '<path d="M130 17l12 12M142 17l-12 12" class="art__ok-s"/><g class="art__boom"><path d="M130 61l12 12M142 61l-12 12" class="art__stroke art__stroke--hot"/></g></svg>',
      /* build: blocks stack up into the finished piece */
      '<svg viewBox="0 0 160 90" class="art art--build"><path d="M30 80h100" class="art__thin"/>' +
        '<rect x="44" y="60" width="72" height="16" class="art__blk art__blk--1"/><rect x="52" y="42" width="56" height="16" class="art__blk art__blk--2"/><rect x="60" y="24" width="40" height="16" class="art__blk art__blk--3"/><rect x="72" y="8" width="16" height="14" class="art__blk art__blk--4 art__bad"/></svg>',
      /* play-test: a cursor plays, the meter settles into the fair zone */
      '<svg viewBox="0 0 160 90" class="art art--test"><rect x="20" y="58" width="120" height="8" rx="4" class="art__track"/><rect x="78" y="58" width="34" height="8" rx="4" class="art__zone"/>' +
        '<rect x="20" y="58" width="120" height="8" rx="4" class="art__fill"/><path d="M0 0l0 18 5-5 4 9 4-2-4-9 7 0z" class="art__cursor"/>' +
        '<path d="M70 26l8 8 16-16" class="art__tick"/></svg>'
    ];
    r.process = '\n      <div class="sec__head sec__head--row">' +
      '\n        <div><p class="eyebrow"><i class="sq" aria-hidden="true"></i>How it works</p>' +
      '\n        <h2 class="big reveal-up"><span>' + esc(P.heading) + '</span></h2></div>' +
      '\n        <p class="sec__lede">' + esc(P.intro) + '</p>' +
      '\n      </div>' +
      '\n      <div class="flow" data-flow>' +
      '\n        <div class="flow__line" aria-hidden="true"><i class="flow__run"></i></div>' +
      '\n        <ol class="steps">' + P.steps.map(function (s, i) {
        return '\n          <li class="step' + (s.mistakes ? ' step--hot' : '') + '" style="--i:' + i + '">' +
          '<span class="step__wk">' + weeks(s) + '</span>' +
          '<span class="step__dot" aria-hidden="true"></span>' +
          '<div class="step__art" aria-hidden="true">' + (ART[i] || ART[ART.length - 1]) + '</div>' +
          '<span class="step__n">' + pad(i + 1) + '</span>' +
          '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p>' +
          (s.you ? '<p class="step__you"><b>You:</b> ' + esc(s.you) + '</p>' : '') + '</li>';
      }).join('') + '\n        </ol>' +
      '\n      </div>\n    ';

    r.pricing = '\n      <div class="sec__head">' +
      '\n        <p class="eyebrow"><i class="sq" aria-hidden="true"></i>Pricing</p>' +
      '\n        <h2 class="big reveal-up"><span>' + esc(R.heading) + '</span></h2>' +
      '\n        <p class="sec__lede">' + esc(R.intro) + '</p>' +
      '\n      </div>' +
      '\n      <div class="prices">' + R.packages.map(function (p) {
        return '\n        <article class="price' + (p.core ? ' price--core' : '') + '">' +
          '\n          <p class="price__wk">About ' + esc(p.weeks) + ' week' + (+p.weeks === 1 ? '' : 's') + '</p>' +
          '\n          <h3>' + esc(p.name) + '</h3>' +
          '\n          <p class="price__amt"><span>from</span>' + esc(p.price) + '</p>' +
          '\n          <p class="price__for">' + esc(p.for) + '</p>' +
          '\n          <ul>' + (p.items || []).filter(Boolean).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>' +
          '\n          <a class="btn ' + (p.core ? 'btn--hot' : 'btn--line') + '" href="#contact">' + esc(p.button) + '</a>' +
          '\n        </article>';
      }).join('') + '\n      </div>' +
      '\n      <p class="terms">' + (R.terms || []).filter(Boolean).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</p>\n    ';

    r.about = '\n      <figure class="who__pic reveal">' +
      '\n        <img src="' + esc(A.photo) + '" alt="' + esc(A.name) + '" width="480" height="480" loading="lazy">' +
      '\n        <figcaption>' + esc(A.name) + '<span>' + esc(A.place) + '</span></figcaption>' +
      '\n      </figure>' +
      '\n      <div class="who__text">' +
      '\n        <p class="eyebrow"><i class="sq" aria-hidden="true"></i>' + esc(A.heading) + '</p>' +
      '\n        <blockquote class="reveal-up"><span>“' + esc(A.quote) + '”</span></blockquote>' +
      '\n        <dl class="who__facts">' + (A.facts || []).map(function (f) {
        return '<div><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>';
      }).join('') + '</dl>' +
      (C.linkedin ? '\n        <a class="more" href="' + esc(C.linkedin) + '" target="_blank" rel="noopener">' + esc(first(A.name)) + ' on LinkedIn' + OUT + '</a>' : '') +
      '\n      </div>\n    ';

    r.faq = '\n      <div class="sec__head sec__head--side">' +
      '\n        <p class="eyebrow"><i class="sq" aria-hidden="true"></i>FAQ</p>' +
      '\n        <h2 class="big reveal-up"><span>' + esc(d.faqHeading) + '</span></h2>' +
      '\n      </div>' +
      '\n      <div class="qa">' + (d.faq || []).filter(function (q) { return q.q; }).map(function (q) {
        return '\n        <details><summary>' + esc(q.q) + '<i aria-hidden="true"></i></summary><p>' + esc(q.a) + '</p></details>';
      }).join('') + '\n      </div>\n    ';

    var alt = [];
    if (C.email) alt.push('email <a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a>');
    if (C.phone) alt.push('call <a href="tel:' + esc(C.phone.replace(/[^+\d]/g, '')) + '">' + esc(C.phone) + '</a>');
    if (C.linkedin) alt.push('message ' + esc(first(A.name)) + ' on <a href="' + esc(C.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
    if (C.booking) alt.push('<a href="' + esc(C.booking) + '" target="_blank" rel="noopener">book a call</a>');
    var joined = alt.length > 1 ? alt.slice(0, -1).join(', ') + ' or ' + alt[alt.length - 1] : (alt[0] || '');
    var altText = joined ? 'Prefer not to use the form? ' + joined.charAt(0).toUpperCase() + joined.slice(1) + '.' : '';
    var formOn = !!C.web3formsKey;
    r.contact = '\n      <div class="contact__grid">' +
      '\n        <div class="contact__side">' +
      '\n          <p class="eyebrow"><i class="sq" aria-hidden="true"></i>Contact</p>' +
      '\n          <h2 class="big reveal-up"><span>' + esc(CS.heading) + '</span></h2>' +
      '\n          <p class="sec__lede">' + esc(CS.lede) + '</p>' +
      '\n          <ul class="promise">' + (CS.promises || []).filter(Boolean).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
      (altText ? '\n          <p class="contact__alt">' + altText + '</p>' : '') +
      '\n        </div>' +
      '\n        <div class="report">' +
      '\n          <p class="report__head"><span>Tell us the mistake</span><span>Reply within 1 working day</span></p>' +
      '\n          <form id="report" action="' + (formOn ? 'https://api.web3forms.com/submit' : 'mailto:' + esc(C.email)) + '" method="POST"' + (formOn ? '' : ' enctype="text/plain"') + '>' +
      (formOn ? '\n            <input type="hidden" name="access_key" value="' + esc(C.web3formsKey) + '">' : '') +
      '\n            <input type="hidden" name="subject" value="New enquiry from razination">' +
      '\n            <input type="hidden" name="from_name" value="Razination website">' +
      '\n            <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '\n            <div class="f2">' +
      '\n              <label class="fld"><span>Your name</span><input name="name" autocomplete="name" required></label>' +
      '\n              <label class="fld"><span>Work email</span><input name="email" type="email" autocomplete="email" required></label>' +
      '\n            </div>' +
      '\n            <label class="fld"><span>Where do people go wrong?</span><textarea name="message" rows="4" required placeholder="' + esc(CS.placeholder) + '"></textarea></label>' +
      '\n            <fieldset class="chips"><legend>Topic <em>optional</em></legend>' + (CS.topics || []).filter(Boolean).map(function (t) {
        return '<label><input type="checkbox" name="topic" value="' + esc(t) + '"><span>' + esc(t) + '</span></label>';
      }).join('') + '</fieldset>' +
      '\n            <div class="f2">' +
      '\n              <label class="fld"><span>Organisation <em>optional</em></span><input name="organisation" autocomplete="organization"></label>' +
      '\n              <label class="fld"><span>When do you need it? <em>optional</em></span><input name="deadline"></label>' +
      '\n            </div>' +
      '\n            <p class="report__err" aria-live="assertive"></p>' +
      '\n            <div class="report__foot">' +
      '\n              <p>We use your details only to reply. More in the <a href="datenschutz.html">Datenschutz</a>.</p>' +
      '\n              <button class="btn btn--hot" type="submit"><span class="lab">Send it over</span>' + ARROW + '</button>' +
      '\n            </div>' +
      '\n          </form>' +
      '\n          <div class="report__done" tabindex="-1"><p class="eyebrow"><i class="sq" aria-hidden="true"></i>Received</p><h3>Thanks. ' + esc(first(A.name)) + ' replies within one working day.</h3></div>' +
      '\n        </div>' +
      '\n      </div>\n    ';

    r.footer = footer(d, true);
    return r;
  }

  /* ---------------- simulations page ---------------- */
  function simsRegions(d) {
    var S = d.simsPage, all = shown(d), r = {};
    r.meta = meta(d, 'sims');
    r.hero = '\n      <p class="eyebrow reveal"><i class="sq" aria-hidden="true"></i>' + esc(S.note) + '</p>' +
      '\n      <h1 class="hero__h hero__h--page"><span class="ln"><span>' + esc(fill(S.line1, d)) + '</span></span><span class="ln ln--hot"><span>' + esc(fill(S.line2, d)) + '</span></span></h1>' +
      '\n      <p class="hero__lede reveal">' + esc(S.lede) + '</p>\n    ';
    var groups = [['work', S.workHeading], ['class', S.classHeading]];
    r.cards = groups.map(function (g) {
      var items = all.map(function (s, i) { return [s, i]; }).filter(function (x) { return x[0].group === g[0]; });
      if (!items.length) return '';
      var topics = items.map(function (x) { return x[0].topic; }).filter(function (t, k, a) { return t && a.indexOf(t) === k; });
      return '\n      <div class="group">' +
        '\n        <div class="group__head"><h2 class="big reveal-up"><span>' + esc(g[1]) + '</span></h2><p>' + esc(topics.join(' · ')) + '</p></div>' +
        '\n        <div class="cards cards--grid">' + items.map(function (x) { return card(x[0], x[1], false); }).join('') +
        '\n        </div>' +
        '\n      </div>';
    }).join('') + '\n    ';
    r.footer = footer(d, false);
    return r;
  }

  /* ---------------- legal pages (German) ---------------- */
  function address(L) {
    return 'Razination<br>Inhaber: ' + esc(L.owner) + '<br>' + todo(L.street, 'Straße und Hausnummer') + '<br>' + todo(L.city, 'PLZ und Ort') + '<br>' + esc(L.country || 'Deutschland');
  }
  function impressum(d) {
    var L = d.legal, C = d.contact;
    var vat = L.vatId && L.vatId.trim()
      ? '\n<h2>Umsatzsteuer-ID</h2>\n<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: ' + esc(L.vatId) + '</p>'
      : (L.noVatId ? '' : '\n<h2>Umsatzsteuer-ID</h2>\n<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: <span class="todo">[USt-IdNr., falls vorhanden; sonst im Admin „Keine USt-IdNr.“ wählen]</span></p>');
    var missing = !L.street || !L.city || !C.email;
    return '\n    ' + (missing ? '<p class="notice">Vorlage: Die gelb markierten Angaben vor der Veröffentlichung ausfüllen (im Admin unter „Kontakt &amp; Rechtliches“).</p>\n' : '') +
      '<h1>Impressum</h1>' +
      '\n<h2>Angaben gemäß § 5 DDG</h2>' +
      '\n<address>' + address(L) + '</address>' +
      '\n<h2>Kontakt</h2>' +
      '\n<p>E-Mail: ' + (C.email ? '<a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a>' : todo('', 'E-Mail-Adresse')) +
      (C.phone ? '<br>Telefon: ' + esc(C.phone) : '') + '</p>' + vat +
      '\n<h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>' +
      '\n<address>' + esc(L.owner) + '<br>' + todo(L.street, 'Straße und Hausnummer') + '<br>' + todo(L.city, 'PLZ und Ort') + '</address>\n  ';
  }
  function datenschutz(d) {
    var L = d.legal, C = d.contact;
    var missing = !L.street || !L.city || !C.email || !L.hostingTransfer || (C.web3formsKey && !L.formProvider) || !L.authority || !L.updated;
    return '\n    ' + (missing ? '<p class="notice">Vorlage: Die gelb markierten Angaben ausfüllen (im Admin unter „Kontakt &amp; Rechtliches“) und den Text vor der Veröffentlichung prüfen lassen. Er beschreibt die Website so, wie sie gebaut ist: ohne Cookies, ohne Analyse-Tools, mit lokal eingebundenen Schriften, mit einem Kontaktformular über Web3Forms und mit Simulationen und Videos, die lokal von dieser Website geladen werden.</p>\n' : '') +
      '<h1>Datenschutzerklärung</h1>' +
      '\n<h2>Verantwortlicher</h2>' +
      '\n<address>Razination, Inhaber ' + esc(L.owner) + '<br>' + todo(L.street, 'Straße und Hausnummer') + ', ' + todo(L.city, 'PLZ und Ort') + '<br>E-Mail: ' + (C.email ? esc(C.email) : todo('', 'E-Mail-Adresse')) + '</address>' +
      '\n<h2>Hosting</h2>' +
      '\n<p>Diese Website wird bei ' + todo(L.hostingProvider, 'Hosting-Anbieter, z. B. GitHub Pages (GitHub, Inc.)') + ' gehostet. Beim Aufruf der Seiten verarbeitet der Anbieter technisch notwendige Daten, insbesondere Ihre IP-Adresse, Datum und Uhrzeit des Zugriffs sowie Informationen zu Browser und Betriebssystem, um die Website auszuliefern und ihre Sicherheit zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in der sicheren und zuverlässigen Bereitstellung der Website. ' + todo(L.hostingTransfer, 'Hinweis zur Datenübermittlung in Drittländer, je nach Anbieter') + '</p>' +
      '\n<h2>Cookies und Analyse</h2>' +
      '\n<p>Diese Website setzt keine Cookies und verwendet keine Analyse- oder Tracking-Werkzeuge.</p>' +
      '\n<h2>Schriftarten und Videos</h2>' +
      '\n<p>Die verwendeten Schriftarten und Videos werden lokal von unserem Server geladen. Es wird dabei keine Verbindung zu Servern Dritter aufgebaut.</p>' +
      '\n<h2>Kontakt per E-Mail oder LinkedIn</h2>' +
      '\n<p>Wenn Sie uns per E-Mail oder über LinkedIn kontaktieren, verarbeiten wir Ihre Angaben, um Ihre Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit Ihre Anfrage auf einen Vertrag abzielt, sonst Art. 6 Abs. 1 lit. f DSGVO. Wir löschen die Daten, sobald sie für diesen Zweck nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>' +
      (C.web3formsKey
        ? '\n<h2>Kontaktformular</h2>' +
          '\n<p>Wenn Sie uns über das Formular auf dieser Website schreiben, werden Ihre Angaben (Name, E-Mail-Adresse, Ihre Nachricht sowie freiwillige Angaben wie Organisation, Thema und Zeitraum) über den Dienst Web3Forms per E-Mail an uns weitergeleitet. Anbieter ist ' + todo(L.formProvider, 'Name und Anschrift des Anbieters von Web3Forms') + '. ' + todo(L.formTransfer, 'Hinweis zur Datenübermittlung in Drittländer und zur Garantie, z. B. Standardvertragsklauseln, je nach Anbieter') + '</p>' +
          '\n<p>Wir verwenden diese Angaben nur, um Ihre Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit Ihre Anfrage auf einen Vertrag abzielt, sonst Art. 6 Abs. 1 lit. f DSGVO. Wir löschen die Daten, sobald sie für diesen Zweck nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>'
        : '') +
      '\n<h2>Simulationen</h2>' +
      '\n<p>Die Simulationen auf dieser Website laufen vollständig in Ihrem Browser. Sie werden erst geladen, wenn Sie auf „Play“ klicken. Sie erfassen keine personenbezogenen Daten und senden keine Daten an uns oder an Dritte.</p>' +
      '\n<p>Die Simulation „Wo ist der Löffel?“ speichert, welche Wörter Sie bereits entdeckt haben, lokal in Ihrem Browser (localStorage). Diese Angabe verlässt Ihr Gerät nicht; Sie können sie in den Einstellungen Ihres Browsers löschen. Für die Sprachausgabe nutzt die Simulation die Sprachsynthese Ihres Browsers. Je nach Browser und Stimme kann der Browser die vorgelesenen Wörter dafür an einen Dienst seines Herstellers übermitteln.</p>' +
      (C.linkedin ? '\n<h2>Links zu LinkedIn</h2>\n<p>Diese Website verlinkt auf ein Profil bei LinkedIn. Erst wenn Sie dem Link folgen, werden Daten an LinkedIn übertragen; dort gelten die Datenschutzhinweise von LinkedIn.</p>' : '') +
      '\n<h2>Ihre Rechte</h2>' +
      '\n<p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen die Verarbeitung (Art. 21). Wenden Sie sich dazu an die oben genannte Adresse.</p>' +
      '\n<h2>Beschwerderecht</h2>' +
      '\n<p>Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes. Zuständig für uns ist ' + todo(L.authority, 'zuständige Aufsichtsbehörde, z. B. Bayerisches Landesamt für Datenschutzaufsicht') + '.</p>' +
      '\n<p>Stand: ' + todo(L.updated, 'Monat und Jahr') + '</p>\n  ';
  }

  /* the data the player and the hero reel read */
  function simsData(d) {
    var list = shown(d).map(function (s) {
      var o = {
        slug: s.slug, tab: s.tab, readout: s.readout, title: s.title, topic: s.topic, group: s.group,
        audience: s.audience, hook: s.hook, play: s.play, triad: s.triad,
        alt: s.alt, altMistake: s.altMistake, path: s.path, img: s.img, clip: s.clip || ''
      };
      if (s.altMove) o.altMove = s.altMove;
      if (s.lang) o.lang = s.lang;
      return o;
    });
    return '/* Generated from data/site.json by the admin panel (or tools/build.js).\n' +
      '   Edit simulations in /admin/, not here: this file is overwritten on Publish. */\n' +
      'window.RAZ_SIMS = ' + JSON.stringify(list, null, 2) + ';\n' +
      'window.RAZ_REEL = ' + JSON.stringify(reel(d).map(function (s) { return s.slug; })) + ';\n';
  }

  function apply(html, regions, file) {
    Object.keys(regions).forEach(function (name) {
      var open = '<!--@' + name + '-->', close = '<!--/@' + name + '-->';
      var a = html.indexOf(open), b = html.indexOf(close);
      if (a < 0 || b < a) throw new Error((file || 'page') + ' is missing the region markers for "' + name + '".');
      html = html.slice(0, a + open.length) + regions[name] + html.slice(b);
    });
    return html;
  }
  function build(d, pages) {
    return {
      'index.html': apply(pages['index.html'], homeRegions(d), 'index.html'),
      'simulations.html': apply(pages['simulations.html'], simsRegions(d), 'simulations.html'),
      'impressum.html': apply(pages['impressum.html'], { legal: impressum(d) }, 'impressum.html'),
      'datenschutz.html': apply(pages['datenschutz.html'], { legal: datenschutz(d) }, 'datenschutz.html'),
      'js/sims-data.js': simsData(d)
    };
  }

  var API = { build: build, apply: apply, homeRegions: homeRegions, simsRegions: simsRegions, simsData: simsData, fill: fill, shown: shown, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.RazRender = API;
})(this);
