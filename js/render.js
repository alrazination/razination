/* =====================================================================
   RAZINATION · page renderer
   Turns data/site.json into the editable regions of the static pages.
   Used by the admin panel (in the browser, on Publish) and by
   tools/build.js (locally, with Node). The pages themselves never load
   this file: they stay plain, fast, static HTML.

   A region in a page looks like:  <!--@name--> ... <!--/@name-->
   ===================================================================== */
(function (root) {
  'use strict';

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* plain text with line breaks → <br> */
  function lines(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
  var WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
  function shown(d) { return (d.sims || []).filter(function (s) { return s.on; }); }
  /* {n} → 8, {N} → Eight */
  function fill(str, d) {
    var n = shown(d).length;
    return String(str || '').replace(/\{n\}/g, n).replace(/\{N\}/g, WORDS[n] || String(n));
  }
  function bySlug(d, slug) {
    return shown(d).filter(function (s) { return s.slug === slug; })[0];
  }
  function homeSims(d) {
    var list = (d.home && d.home.sims || []).map(function (slug) { return bySlug(d, slug); }).filter(Boolean);
    if (!list.length) list = shown(d).slice(0, 3);
    return list;
  }
  function moveImg(s) { return s.img.move || s.img.start; }
  function abs(d, path) {
    var base = (d.settings && d.settings.siteUrl || '').replace(/\/?$/, '/');
    return base + path;
  }
  function clampW(v) { v = +v || 0; return Math.max(0, Math.min(5, v)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todo(v, label) {
    return v && String(v).trim() ? lines(v) : '<span class="todo">[' + esc(label) + ']</span>';
  }

  var ICON = {
    arrow: '<svg aria-hidden="true"><use href="#i-arrow"/></svg>',
    out: '<svg aria-hidden="true"><use href="#i-out"/></svg>',
    tick: '<svg class="tick" aria-hidden="true" style="color:var(--paper)"><use href="#i-tick"/></svg>'
  };

  /* ---------------- shared pieces ---------------- */
  function meta(d, page) {
    var m = d.meta[page] || {};
    var img = abs(d, 'img/og/razination.jpg');
    var url = abs(d, page === 'home' ? '' : 'simulations.html');
    var first = page === 'home' ? homeSims(d)[0] : shown(d)[0];
    return '\n<title>' + esc(fill(m.title, d)) + '</title>' +
      '\n<meta name="description" content="' + esc(fill(m.description, d)) + '">' +
      '\n<meta property="og:title" content="' + esc(fill(m.ogTitle || m.title, d)) + '">' +
      '\n<meta property="og:description" content="' + esc(fill(m.ogDescription || m.description, d)) + '">' +
      '\n<meta property="og:image" content="' + esc(img) + '">' +
      '\n<meta property="og:image:width" content="1200">' +
      '\n<meta property="og:image:height" content="630">' +
      '\n<meta property="og:url" content="' + esc(url) + '">' +
      '\n<link rel="canonical" href="' + esc(url) + '">' +
      '\n<meta property="og:type" content="website">' +
      '\n<meta name="twitter:card" content="summary_large_image">' +
      (first ? '\n<link rel="preload" href="' + esc(first.img.mistake) + '" as="image" fetchpriority="high">' : '') + '\n';
  }

  function placard(id, lineA, lineB, fit, fitM) {
    var style = (fit ? '--fit:' + fit + ';' : '') + (fitM ? '--fit-m:' + fitM : '');
    return '<h1 class="placard" id="' + id + '"' + (style ? ' style="' + style + '"' : '') + '><span>' + esc(lineA) + '</span>' +
      (lineB ? ' <span>' + esc(lineB) + '</span>' : '') + '</h1>';
  }

  /* the 1280x720 player: tabs (home) or a title bar (simulations page) */
  function stage(d, opts) {
    var s = opts.sim, t = s.triad || ['', '', ''];
    var langAttr = s.lang ? ' lang="' + esc(s.lang) + '"' : '';
    var actions =
      '\n          <div class="deck__act data">' +
      '\n            <button type="button" data-reset><svg aria-hidden="true"><use href="#i-redo"/></svg>Restart</button>' +
      '\n            <button type="button" data-fullscreen><svg aria-hidden="true"><use href="#i-full"/></svg>Full screen</button>' +
      '\n            <a href="' + esc(s.path) + '" target="_blank" rel="noopener" data-newtab><svg aria-hidden="true"><use href="#i-out"/></svg>New tab</a>' +
      '\n          </div>';
    var bar;
    if (opts.tabs) {
      bar = '\n          <div class="tabs" role="tablist" aria-label="Pick a simulation" data-tabs="stage">' +
        '\n            <span class="tabs__lab data" aria-hidden="true">Pick a mistake</span>' +
        opts.tabs.map(function (x, i) {
          return '\n            <button class="tab" role="tab" aria-selected="' + (i === 0) + '"' + (i ? ' tabindex="-1"' : '') +
            ' aria-controls="stage-screen" data-sim="' + esc(x.slug) + '"><img src="' + esc(moveImg(x)) + '" alt="" width="58" height="33"' +
            (i ? ' loading="lazy"' : '') + '><b>' + esc(x.tab) + '</b><span' + (x.lang ? ' lang="' + esc(x.lang) + '"' : '') + '>' + esc(x.title) + '</span></button>';
        }).join('') +
        '\n          </div>' + actions;
    } else {
      bar = '\n          <div class="stage__title">' +
        '\n            <span class="data" data-field="num">01 / ' + pad(shown(d).length) + '</span>' +
        '\n            <h2 tabindex="-1" data-field="title"' + langAttr + '>' + esc(s.title) + '</h2>' +
        '\n            <span class="data"><span data-field="topic">' + esc(s.topic) + '</span> · <span data-field="audience">' + esc(s.audience) + '</span></span>' +
        '\n          </div>' + actions +
        '\n          <div class="stage__nav">' +
        '\n            <button type="button" data-step="-1" aria-label="Previous simulation"><svg aria-hidden="true"><use href="#i-back"/></svg></button>' +
        '\n            <button type="button" data-step="1" aria-label="Next simulation"><svg aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
        '\n          </div>';
    }
    var foot = opts.tabs
      ? '\n          <p>' + esc(d.home.demoNote) + '</p>' +
        '\n          <button class="arrow share" type="button" data-share><span class="lab">Send it to my laptop</span><svg aria-hidden="true"><use href="#i-send"/></svg></button>' +
        '\n          <span style="display:flex;gap:28px;flex-wrap:wrap">' +
        '\n            <a class="arrow" href="#contact">Want one like this? Get a fixed quote' + ICON.arrow + '</a>' +
        '\n            <a class="arrow" href="simulations.html">' + esc(fill('All {n} simulations', d)) + ICON.arrow + '</a>' +
        '\n          </span>'
      : '\n          <p>Made for a laptop or tablet. Every simulation runs in 1280 × 720 and scales to your screen.</p>' +
        '\n          <button class="arrow share" type="button" data-share><span class="lab">Send it to my laptop</span><svg aria-hidden="true"><use href="#i-send"/></svg></button>' +
        '\n          <a class="arrow" href="./#contact">Want one like this? Get a fixed quote' + ICON.arrow + '</a>';

    return '\n      <div class="stage" id="' + (opts.tabs ? 'stage' : 'theater') + '"' + (opts.tabs ? '' : ' data-theater') + ' data-sim="' + esc(s.slug) + '">' +
      '\n        <div class="stage__bar">' + bar + '\n        </div>' +
      '\n\n        <div class="screen"' + (opts.tabs ? ' id="stage-screen" role="tabpanel" aria-label="Simulation"' : '') + '>' +
      '\n          <div class="cover">' +
      '\n            <img class="before" src="' + esc(moveImg(s)) + '" alt="' + esc('Your move: ' + (s.altMove || s.alt)) + '" width="1280" height="720">' +
      '\n            <img class="after" src="' + esc(s.img.mistake) + '" alt="' + esc('What happens: ' + s.altMistake) + '" width="1280" height="720" fetchpriority="high">' +
      '\n            <button class="btn start" type="button"><i class="tri" aria-hidden="true"></i><span class="lab">' + esc('Play: ' + s.tab) + '</span> <small>no sign-up</small></button>' +
      '\n          </div>' +
      '\n          <div class="screen__loading data" aria-hidden="true">Loading simulation</div>' +
      '\n        </div>' +
      '\n\n        <div class="replay">' +
      '\n          <button class="replay__btn" type="button" aria-label="Pause the replay"></button>' +
      '\n          <span class="replay__lab data" aria-hidden="true">Your move</span>' +
      '\n          <div class="track">' +
      '\n            <input type="range" min="0" max="1000" value="1000" aria-label="Replay of the mistake. Drag to go from your move to what happens.">' +
      '\n            <span class="track__head"></span>' +
      '\n            <span class="track__fill"></span>' +
      '\n            <span class="track__cut"></span>' +
      '\n          </div>' +
      '\n          <span class="replay__lab replay__lab--hap data" aria-hidden="true">What happens</span>' +
      '\n        </div>' +
      '\n\n        <div class="deck">' +
      '\n          <div class="deck__cell deck__cell--do"><span class="data">01 · You do</span><b data-triad="0">' + esc(t[0]) + '</b>' +
        (opts.tabs ? '' : '<small data-field="play">' + esc(s.play) + '</small>') + '</div>' +
      '\n          <div class="deck__cell deck__cell--hap"><span class="data"><i class="sq sq--ink" aria-hidden="true"></i>02 · What happens</span><b data-triad="1">' + esc(t[1]) + '</b><small data-field="readout">' + esc(s.readout) + '</small></div>' +
      '\n          <div class="deck__cell deck__cell--stick"><span class="data"><svg class="tick" aria-hidden="true"><use href="#i-tick"/></svg>03 · What sticks</span><b data-triad="2">' + esc(t[2]) + '</b></div>' +
      '\n        </div>' +
      '\n        <p class="sr-only" aria-live="polite" data-live></p>' +
      '\n\n        <div class="stage__foot">' + foot + '\n        </div>' +
      '\n      </div>\n';
  }

  function footer(d, home) {
    var c = d.contact, h = home ? '#' : './#';
    var links = [];
    if (c.linkedin) links.push('<li><a href="' + esc(c.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a></li>');
    if (c.email) links.push('<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>');
    if (c.phone) links.push('<li><a href="tel:' + esc(c.phone.replace(/[^+\d]/g, '')) + '">' + esc(c.phone) + '</a></li>');
    return '\n    <div class="foot__grid">' +
      '\n      <div>' +
      '\n        <a class="logo" href="./" aria-label="Razination, home">raz<span class="i">ı</span>nation</a>' +
      '\n        <p class="foot__why"><i class="sq" aria-hidden="true"></i><span>' + esc(d.footer.why) + '</span></p>' +
      '\n      </div>' +
      '\n      <div><h4 class="data">Site</h4><ul><li><a href="simulations.html">Simulations</a></li><li><a href="' + h + 'how">How it works</a></li><li><a href="' + h + 'pricing">Pricing</a></li><li><a href="' + h + 'about">About</a></li><li><a href="' + h + 'contact">Contact</a></li></ul></div>' +
      '\n      <div><h4 class="data">Contact</h4><ul>' + links.join('') + '</ul></div>' +
      '\n      <div><h4 class="data">Legal</h4><ul><li><a href="impressum.html">Impressum</a></li><li><a href="datenschutz.html">Datenschutz</a></li></ul></div>' +
      '\n    </div>' +
      '\n    <div class="foot__base"><span>© ' + esc(d.footer.year) + ' Razination · ' + esc(d.about.place) + '</span><span>Every simulation here is hand-built and runs in your browser.</span></div>\n  ';
  }

  /* ---------------- home page ---------------- */
  function homeRegions(d) {
    var H = d.hero, A = d.about, P = d.process, R = d.pricing, C = d.contact;
    var sims = homeSims(d);
    var r = {};
    r.meta = meta(d, 'home');

    r.hero = '\n      ' + placard('h1', H.line1, H.line2, H.fit, H.fitM) +
      '\n      <div class="hero__row">' +
      '\n        <div>' +
      '\n          <p class="lede">' + esc(H.lede) + '</p>' +
      '\n          <a class="byline" href="#about"><img src="' + esc(A.photo) + '" alt="" width="34" height="34"><span>Built by <b>' + esc(A.name) + '</b> in ' + esc(A.place) + '</span></a>' +
      '\n        </div>' +
      '\n        <div class="hero__side">' +
      '\n          <div class="hero__cta">' +
      '\n            <a class="btn" href="#play" data-play-hero><i class="tri" aria-hidden="true"></i>' + esc(H.button) + ' <small>no sign-up</small></a>' +
      '\n          </div>' +
      '\n          <p class="hero__facts data">' + (H.facts || []).filter(Boolean).map(function (f) {
        return '<span><i class="sq" aria-hidden="true"></i>' + esc(f) + '</span>';
      }).join('') + '</p>' +
      '\n        </div>' +
      '\n      </div>\n    ';

    r.stage = stage(d, { sim: sims[0], tabs: sims });

    r.plate = '\n      <dl class="plate" id="after-stage">' + (d.plate || []).map(function (p) {
      return '\n        <div><dt class="data">' + esc(fill(p.label, d)) + '</dt><dd>' + esc(fill(p.value, d)) + '</dd></div>';
    }).join('') + '\n      </dl>\n    ';

    r.about = '\n      <figure class="who__pic">' +
      '\n        <img src="' + esc(A.photo) + '" alt="' + esc(A.name) + '" width="480" height="480" loading="lazy">' +
      '\n        <figcaption class="data">' + esc(A.name + ' · ' + A.place) + '</figcaption>' +
      '\n      </figure>' +
      '\n      <div>' +
      '\n        <h2 class="placard" id="who-h">' + esc(A.heading) + '</h2>' +
      '\n        <blockquote>' + esc(A.quote) + '</blockquote>' +
      '\n        <dl class="facts">' + (A.facts || []).map(function (f) {
        return '\n          <div><dt class="data">' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>';
      }).join('') + '\n        </dl>' +
      (C.linkedin ? '\n        <a class="arrow" href="' + esc(C.linkedin) + '" target="_blank" rel="noopener">' + esc(A.name.split(' ')[0]) + ' on LinkedIn' + ICON.out + '</a>' : '') +
      '\n      </div>\n    ';

    var wk = []; for (var w = 1; w <= 5; w++) wk.push('<span>Week ' + w + '</span>');
    r.process = '\n      <div class="sec-head">' +
      '\n        <h2 class="placard" id="how-h">' + esc(P.heading) + '</h2>' +
      '\n        <p>' + esc(P.intro) + '</p>' +
      '\n      </div>' +
      '\n\n      <div class="gantt" role="list" aria-label="Project plan, week by week">' +
      '\n        <div class="gantt__weeks data" aria-hidden="true"><span></span>' + wk.join('') + '</div>' +
      '\n        <span class="g-live" aria-hidden="true"><svg class="tick" style="color:var(--paper)"><use href="#i-tick"/></svg>Live</span>' +
      P.steps.map(function (s, i) {
        var youW = Math.max(16, Math.min(40, Math.round((+s.youWidth || 28))));
        return '\n\n        <div class="g-row" role="listitem">' +
          '\n          <div class="g-row__lab"><h3><span class="n">' + pad(i + 1) + '</span>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>' +
          '\n          <div class="g-row__lane">' +
          '\n            <span class="g-bar' + (s.mistakes ? ' g-bar--mistake' : '') + '" style="--s:' + clampW(s.start) + ';--e:' + clampW(s.end) + ';--i:' + i + '">' + esc(s.bar) + '</span>' +
          (s.you ? '\n            <span class="g-you" style="--s:' + clampW(s.youAt) + ';--i:' + i + '"><i style="--w:' + youW + '"></i><b>You:</b> ' + esc(s.you) + '</span>' : '') +
          '\n          </div>' +
          '\n        </div>';
      }).join('') +
      '\n        <div class="gantt__legend" aria-hidden="true">' +
      '\n          <span><i></i>Razination</span><span><i class="y"></i>You</span><span><i class="m"></i>Where the mistakes get designed</span>' +
      '\n        </div>' +
      '\n      </div>\n    ';

    r.pricing = '\n      <div class="sec-head">' +
      '\n        <h2 class="placard" id="price-h">' + esc(R.heading) + '</h2>' +
      '\n        <p>' + esc(R.intro) + '</p>' +
      '\n      </div>' +
      '\n      <div class="prices">' + R.packages.map(function (p) {
        var bars = ''; for (var k = 1; k <= 5; k++) bars += k <= +p.weeks ? '<i class="on"></i>' : '<i></i>';
        return '\n        <article class="price' + (p.core ? ' price--core' : '') + '">' +
          '\n          <div class="price__weeks" aria-hidden="true">' + bars + '</div>' +
          '\n          <span class="price__wk data">About ' + esc(p.weeks) + ' week' + (+p.weeks === 1 ? '' : 's') + '</span>' +
          '\n          <h3>' + esc(p.name) + '</h3>' +
          '\n          <div class="price__amt"><span class="data">from</span><b>' + esc(p.price) + '</b></div>' +
          '\n          <p class="price__for">' + esc(p.for) + '</p>' +
          '\n          <ul>' + (p.items || []).filter(Boolean).map(function (it) { return '\n            <li>' + esc(it) + '</li>'; }).join('') + '\n          </ul>' +
          '\n          <a class="btn' + (p.core ? '' : ' btn--ghost') + ' btn--sm" href="#contact">' + esc(p.button) + '</a>' +
          '\n        </article>';
      }).join('') + '\n      </div>' +
      '\n      <div class="terms">' + (R.terms || []).filter(Boolean).map(function (t) {
        return '\n        <span><i class="sq" aria-hidden="true"></i>' + esc(t) + '</span>';
      }).join('') + '\n      </div>\n    ';

    r.faq = '\n      <div class="sec-head">' +
      '\n        <h2 class="placard" id="faq-h">' + esc(d.faqHeading) + '</h2>' +
      '\n      </div>' +
      '\n      <div class="qa">' + (d.faq || []).filter(function (q) { return q.q; }).map(function (q) {
        return '\n        <div><h3>' + esc(q.q) + '</h3><p>' + esc(q.a) + '</p></div>';
      }).join('') + '\n      </div>\n    ';

    var alt = [];
    if (C.email) alt.push('email <a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a>');
    if (C.phone) alt.push('call <a href="tel:' + esc(C.phone.replace(/[^+\d]/g, '')) + '">' + esc(C.phone) + '</a>');
    if (C.linkedin) alt.push('message ' + esc(A.name.split(' ')[0]) + ' on <a href="' + esc(C.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
    if (C.booking) alt.push('<a href="' + esc(C.booking) + '" target="_blank" rel="noopener">book a call</a>');
    var altJoined = alt.length > 1 ? alt.slice(0, -1).join(', ') + ' or ' + alt[alt.length - 1] : (alt[0] || '');
    var altText = altJoined ? 'Prefer not to use the form? ' + altJoined.charAt(0).toUpperCase() + altJoined.slice(1) + '.' : '';
    var formOn = !!C.web3formsKey;
    r.contact = '\n      <div>' +
      '\n        <h2 class="placard" id="contact-h">' + esc(d.contactSection.heading) + '</h2>' +
      '\n        <p class="lede">' + esc(d.contactSection.lede) + '</p>' +
      '\n        <ul class="promise">' + (d.contactSection.promises || []).filter(Boolean).map(function (p) {
        return '\n          <li>' + ICON.tick + esc(p) + '</li>';
      }).join('') + '\n        </ul>' +
      (altText ? '\n        <p class="contact__alt">' + altText + '</p>' : '') +
      '\n      </div>' +
      '\n\n      <div class="report">' +
      '\n        <div class="report__head data"><span>Incident report</span><span>Reply within 1 working day</span></div>' +
      '\n        <form id="report" action="' + (formOn ? 'https://api.web3forms.com/submit' : 'mailto:' + esc(C.email)) + '" method="POST"' + (formOn ? '' : ' enctype="text/plain"') + '>' +
      (formOn ? '\n          <input type="hidden" name="access_key" value="' + esc(C.web3formsKey) + '">' : '') +
      '\n          <input type="hidden" name="subject" value="New incident report from razination">' +
      '\n          <input type="hidden" name="from_name" value="Razination website">' +
      '\n          <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '\n          <div class="report__body">' +
      '\n            <div class="field"><label for="f-name"><span class="data">01</span>Your name</label><input id="f-name" name="name" autocomplete="name" required></div>' +
      '\n            <div class="field"><label for="f-email"><span class="data">02</span>Work email</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>' +
      '\n            <div class="field field--wide"><label for="f-msg"><span class="data">03</span>What goes wrong?</label><textarea id="f-msg" name="message" required placeholder="' + esc(d.contactSection.placeholder) + '"></textarea></div>' +
      '\n            <fieldset class="field field--wide"><legend><span class="data">04</span>Topic <em>optional</em></legend>' +
      '\n              <div class="chips">' + (d.contactSection.topics || []).filter(Boolean).map(function (t) {
        return '\n                <label><input type="checkbox" name="topic" value="' + esc(t) + '"><span>' + esc(t) + '</span></label>';
      }).join('') + '\n              </div>' +
      '\n            </fieldset>' +
      '\n            <div class="field"><label for="f-org"><span class="data">05</span>Organisation <em>optional</em></label><input id="f-org" name="organisation" autocomplete="organization"></div>' +
      '\n            <div class="field"><label for="f-when"><span class="data">06</span>When do you need it? <em>optional</em></label><input id="f-when" name="deadline" placeholder="e.g. before March onboarding"></div>' +
      '\n          </div>' +
      '\n          <p class="report__err" aria-live="assertive"></p>' +
      '\n          <div class="report__foot">' +
      '\n            <p>We use your details only to reply. More in the <a href="datenschutz.html">Datenschutz</a>.</p>' +
      '\n            <button class="btn" type="submit"><span class="lab">Send it over</span><svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
      '\n          </div>' +
      '\n        </form>' +
      '\n        <div class="report__done" tabindex="-1">' +
      '\n          <span class="data" style="display:flex;gap:10px;align-items:center"><i class="sq" aria-hidden="true"></i>Report received</span>' +
      '\n          <h3>Thanks. ' + esc(A.name.split(' ')[0]) + ' replies within one working day.</h3>' +
      '\n          <p class="mute">With a first idea of how to fix it.</p>' +
      '\n        </div>' +
      '\n      </div>\n    ';

    r.footer = footer(d, true);
    return r;
  }

  /* ---------------- simulations page ---------------- */
  function card(s, i) {
    var langAttr = s.lang ? ' lang="' + esc(s.lang) + '"' : '';
    return '\n        <a class="card" href="#' + esc(s.slug) + '" data-card="' + esc(s.slug) + '" aria-current="false">' +
      '\n          <span class="card__pic"><img class="before" src="' + esc(s.img.start) + '" alt="' + esc(s.alt) + '" width="1280" height="720" loading="lazy"><img class="after" src="' + esc(s.img.mistake) + '" alt="" width="1280" height="720" loading="lazy"><span class="flag data"><i class="sq" aria-hidden="true"></i>The mistake</span><span class="play"><i class="tri" aria-hidden="true"></i>Play</span></span>' +
      '\n          <span class="card__body"><span class="n data">' + pad(i + 1) + '</span><h3' + langAttr + '>' + esc(s.title) + '</h3><p>' + esc(s.hook) + '</p><span class="data">' + esc(s.topic) + ' · ' + esc(s.audience) + '</span></span>' +
      '\n        </a>';
  }
  function simsRegions(d) {
    var S = d.simsPage, all = shown(d), r = {};
    r.meta = meta(d, 'sims');
    r.hero = '\n      ' + placard('h1', fill(S.line1, d), fill(S.line2, d), S.fit, S.fitM) +
      '\n      <div class="hero__row">' +
      '\n        <p class="lede">' + esc(S.lede) + '</p>' +
      '\n        <p class="data mute" style="max-width:36ch">' + esc(S.note) + '</p>' +
      '\n      </div>\n    ';
    r.theater = all.length ? stage(d, { sim: all[0] }) : '';
    var groups = [['work', S.workHeading], ['class', S.classHeading]];
    r.cards = groups.map(function (g) {
      var items = all.map(function (s, i) { return [s, i]; }).filter(function (x) { return x[0].group === g[0]; });
      if (!items.length) return '';
      var topics = items.map(function (x) { return x[0].topic; }).filter(function (t, k, a) { return t && a.indexOf(t) === k; });
      return '\n      <div class="group">' +
        '\n        <div class="group__head"><h2>' + esc(g[1]) + '</h2><span class="data">' + esc(topics.join(' · ')) + '</span></div>' +
        '\n        <div class="cards' + (items.length === 5 ? ' cards--wide' : '') + '">' +
        items.map(function (x) { return card(x[0], x[1]); }).join('') +
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
      '<h1 class="placard">Impressum</h1>' +
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
    return '\n    ' + (missing ? '<p class="notice">Vorlage: Die gelb markierten Angaben ausfüllen (im Admin unter „Kontakt &amp; Rechtliches“) und den Text vor der Veröffentlichung prüfen lassen. Er beschreibt die Website so, wie sie gebaut ist: ohne Cookies, ohne Analyse-Tools, mit lokal eingebundenen Schriften, mit einem Kontaktformular über Web3Forms und mit Simulationen, die lokal im Browser laufen.</p>\n' : '') +
      '<h1 class="placard">Datenschutzerklärung</h1>' +
      '\n<h2>Verantwortlicher</h2>' +
      '\n<address>Razination, Inhaber ' + esc(L.owner) + '<br>' + todo(L.street, 'Straße und Hausnummer') + ', ' + todo(L.city, 'PLZ und Ort') + '<br>E-Mail: ' + (C.email ? esc(C.email) : todo('', 'E-Mail-Adresse')) + '</address>' +
      '\n<h2>Hosting</h2>' +
      '\n<p>Diese Website wird bei ' + todo(L.hostingProvider, 'Hosting-Anbieter, z. B. GitHub Pages (GitHub, Inc.)') + ' gehostet. Beim Aufruf der Seiten verarbeitet der Anbieter technisch notwendige Daten, insbesondere Ihre IP-Adresse, Datum und Uhrzeit des Zugriffs sowie Informationen zu Browser und Betriebssystem, um die Website auszuliefern und ihre Sicherheit zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in der sicheren und zuverlässigen Bereitstellung der Website. ' + todo(L.hostingTransfer, 'Hinweis zur Datenübermittlung in Drittländer, je nach Anbieter') + '</p>' +
      '\n<h2>Cookies und Analyse</h2>' +
      '\n<p>Diese Website setzt keine Cookies und verwendet keine Analyse- oder Tracking-Werkzeuge.</p>' +
      '\n<h2>Schriftarten</h2>' +
      '\n<p>Die verwendeten Schriftarten werden lokal von unserem Server geladen. Es wird dabei keine Verbindung zu Servern Dritter aufgebaut.</p>' +
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

  /* ---------------- the data file the player reads ---------------- */
  function simsData(d) {
    var list = shown(d).map(function (s) {
      var o = {
        slug: s.slug, tab: s.tab, readout: s.readout, title: s.title, topic: s.topic, group: s.group,
        audience: s.audience, hook: s.hook, play: s.play, triad: s.triad,
        alt: s.alt, altMistake: s.altMistake, path: s.path, img: s.img
      };
      if (s.altMove) o.altMove = s.altMove;
      if (s.lang) o.lang = s.lang;
      return o;
    });
    return '/* Generated from data/site.json by the admin panel (or tools/build.js).\n' +
      '   Edit simulations in /admin/, not here: this file is overwritten on Publish. */\n' +
      'window.RAZ_SIMS = ' + JSON.stringify(list, null, 2) + ';\n';
  }

  /* ---------------- applying regions to a page ---------------- */
  function apply(html, regions, file) {
    Object.keys(regions).forEach(function (name) {
      var open = '<!--@' + name + '-->', close = '<!--/@' + name + '-->';
      var a = html.indexOf(open), b = html.indexOf(close);
      if (a < 0 || b < a) throw new Error((file || 'page') + ' is missing the region markers for "' + name + '".');
      html = html.slice(0, a + open.length) + regions[name] + html.slice(b);
    });
    return html;
  }

  /* Everything a publish writes: { path: newText }, given current page text. */
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
