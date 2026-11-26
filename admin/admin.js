/* =====================================================================
   RAZINATION · admin panel
   Edits data/site.json and rebuilds the pages' editable regions with
   js/render.js. Every "Publish" is one commit to the GitHub repo
   (data, pages and any uploaded files together). GitHub Pages puts it
   live about a minute later. Nothing here runs on the public site.
   ===================================================================== */
(function () {
  'use strict';

  var DEFAULTS = { repo: 'alrazination/razination', branch: 'main' };
  var DATA_PATH = 'data/site.json';
  var PAGES = ['index.html', 'simulations.html', 'impressum.html', 'datenschutz.html'];
  var STORE = 'raz_admin';

  var app = document.getElementById('app');
  var S = {
    token: '', repo: DEFAULTS.repo, branch: DEFAULTS.branch,
    data: null, original: null, tab: 'sims', open: {},
    files: {},          // path -> base64 content to add or replace
    delPaths: [],       // exact paths to delete
    delPrefixes: [],    // folders to delete, e.g. sims/foo/
    dirty: false, busy: false, msg: null
  };

  /* ---------------- utilities ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slugify(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  }
  function getPath(o, p) { return p.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split('.'), last = ks.pop();
    ks.reduce(function (x, k) { return x[k]; }, o)[last] = v;
  }
  function b64FromBytes(bytes) {
    var bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  }
  function b64FromText(t) { return b64FromBytes(new TextEncoder().encode(t)); }
  function textFromB64(b) {
    var bin = atob(b.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function fileToB64(file) { return file.arrayBuffer().then(function (buf) { return b64FromBytes(new Uint8Array(buf)); }); }
  function stamp() { return Date.now().toString(36).slice(-5); }

  /* Crop any image to W x H (cover), as WebP when the browser can. */
  function imageTo(file, W, H) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        var r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r;
        c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        c.toBlob(function (blob) {
          if (!blob) return rej(new Error('Could not process the image.'));
          var ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
          blob.arrayBuffer().then(function (buf) { res({ ext: ext, b64: b64FromBytes(new Uint8Array(buf)) }); });
        }, 'image/webp', 0.84);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { rej(new Error('That file is not an image the browser can read.')); };
      img.src = URL.createObjectURL(file);
    });
  }
  /* Show a pending upload before it's published. */
  function preview(path) {
    if (!path) return '';
    if (S.files[path]) return 'data:image/' + (/\.webp$/.test(path) ? 'webp' : 'jpeg') + ';base64,' + S.files[path];
    return /^(https?:|data:)/.test(path) ? path : '../' + path;
  }
  function siteUrl() { return (S.data && S.data.settings.siteUrl || '').replace(/\/?$/, '/'); }

  /* ---------------- GitHub API ---------------- */
  function gh(method, path, body) {
    return fetch('https://api.github.com/repos/' + S.repo + path, {
      method: method,
      headers: {
        Authorization: 'Bearer ' + S.token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var m = j.message || ('HTTP ' + r.status);
          if (r.status === 401) m = 'GitHub rejected the access key. It may be wrong or expired.';
          else if (r.status === 404 && path.indexOf('/contents/') === 0) m = 'Could not find ' + path.replace('/contents/', '').split('?')[0] + ' on branch "' + S.branch + '". Is the redesign merged into this branch? You can pick another branch on the sign-in screen.';
          else if (r.status === 403 || r.status === 404) m += '. Check that the key has "Contents: Read and write" access to ' + S.repo + '.';
          throw new Error(m);
        }
        return j;
      });
    });
  }
  function getText(path) {
    return gh('GET', '/contents/' + path + '?ref=' + encodeURIComponent(S.branch) + '&t=' + Date.now())
      .then(function (j) {
        if (j.content) return textFromB64(j.content);
        // files over 1 MB come without content; fetch the blob instead
        return gh('GET', '/git/blobs/' + j.sha).then(function (b) { return textFromB64(b.content); });
      });
  }
  function commit(message) {
    var head, baseTree;
    return gh('GET', '/git/ref/heads/' + S.branch).then(function (ref) {
      head = ref.object.sha;
      return gh('GET', '/git/commits/' + head);
    }).then(function (c) {
      baseTree = c.tree.sha;
      if (!S.delPrefixes.length) return [];
      return gh('GET', '/git/trees/' + baseTree + '?recursive=1').then(function (t) {
        return t.tree.filter(function (e) {
          return e.type === 'blob' && S.delPrefixes.some(function (p) { return e.path.indexOf(p) === 0; });
        }).map(function (e) { return e.path; });
      });
    }).then(function (prefixed) {
      var paths = Object.keys(S.files);
      return Promise.all(paths.map(function (p) {
        return gh('POST', '/git/blobs', { content: S.files[p], encoding: 'base64' }).then(function (b) {
          return { path: p, mode: '100644', type: 'blob', sha: b.sha };
        });
      })).then(function (entries) {
        var dels = S.delPaths.concat(prefixed).filter(function (p, i, a) { return a.indexOf(p) === i && !S.files[p]; });
        dels.forEach(function (p) { entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
        return gh('POST', '/git/trees', { base_tree: baseTree, tree: entries });
      });
    }).then(function (tree) {
      return gh('POST', '/git/commits', { message: message, tree: tree.sha, parents: [head] });
    }).then(function (c) {
      return gh('PATCH', '/git/refs/heads/' + S.branch, { sha: c.sha });
    });
  }

  /* ---------------- data helpers ---------------- */
  function homeSet() { return S.data.home.sims; }
  /* the home page shows the ticked simulations, in list order */
  function syncHome() {
    var set = homeSet();
    S.data.home.sims = S.data.sims.filter(function (s) { return s.on && set.indexOf(s.slug) >= 0; }).map(function (s) { return s.slug; });
  }
  function markDirty() { S.dirty = true; S.msg = null; renderTop(); }

  /* Fit the one-line headline to the 1280 frame by measuring it in the real font. */
  function measure(text) {
    var el = document.createElement('span');
    el.className = 'placard measure';
    el.textContent = text;
    document.body.appendChild(el);
    var w = el.getBoundingClientRect().width;
    el.remove();
    return w;
  }
  function fits(a, b) {
    var full = measure(a + (b ? ' ' + b : '')), longest = Math.max(measure(a), b ? measure(b) : 0);
    return {
      fit: Math.round(10000 / full * 0.99 * 100) / 100,
      fitM: Math.min(26, Math.round(10000 / longest * 0.97 * 10) / 10)
    };
  }

  /* ---------------- rendering ---------------- */
  /* the "add a simulation" form isn't bound to the data, so keep what's
     typed (and picked) in it when the panel re-renders, e.g. after an
     image finishes processing */
  function keepAddForm() {
    var f = document.getElementById('add-form');
    if (!f) return null;
    var snap = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name) return;
      snap[el.name] = el.type === 'file' ? Array.prototype.slice.call(el.files) : el.value;
    });
    return snap;
  }
  function restoreAddForm(snap) {
    var f = document.getElementById('add-form');
    if (!f || !snap) return;
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name || !(el.name in snap)) return;
      if (el.type === 'file') {
        if (!snap[el.name].length || typeof DataTransfer === 'undefined') return;
        try { var dt = new DataTransfer(); snap[el.name].forEach(function (x) { dt.items.add(x); }); el.files = dt.files; } catch (e) {}
      } else el.value = snap[el.name];
    });
  }

  function render() {
    if (!S.data) return renderLogin();
    var addSnap = keepAddForm();
    var panels = { sims: simsPanel, home: homePanel, pricing: pricingPanel, contact: contactPanel };
    app.innerHTML =
      '<header class="a-top"><div class="a-wrap" id="top"></div></header>' +
      '<main class="a-wrap">' +
        '<div class="a-tabs" role="tablist">' +
          tab('sims', 'Simulations') + tab('home', 'Home page') + tab('pricing', 'Pricing & FAQ') + tab('contact', 'Contact & legal') +
        '</div>' +
        (S.msg ? '<div class="msg msg--' + S.msg.kind + '" role="status">' + S.msg.html + '</div>' : '') +
        '<div id="panel">' + panels[S.tab]() + '</div>' +
      '</main>' +
      '<div class="sticky-note" id="note"><span>Unpublished changes</span><button class="btn" data-act="publish">Publish</button></div>';
    restoreAddForm(addSnap);
    renderTop();
  }
  function tab(id, label) {
    return '<button class="a-tab" role="tab" data-act="tab" data-id="' + id + '" aria-selected="' + (S.tab === id) + '">' + label + '</button>';
  }
  function renderTop() {
    var top = document.getElementById('top');
    if (!top) return;
    var st = S.busy ? 'Publishing…' : S.dirty ? 'Unpublished changes' : 'All changes published';
    top.innerHTML = '<span class="logo">raz<span class="i">ı</span>nation<small>admin</small></span>' +
      '<span class="a-status' + (S.dirty && !S.busy ? ' is-dirty' : '') + '">' + st + '</span>' +
      '<button class="lnk" data-act="preview">Preview</button>' +
      '<a class="lnk" href="' + esc(siteUrl()) + '" target="_blank" rel="noopener">Open site</a>' +
      '<button class="btn" data-act="publish"' + (S.dirty && !S.busy ? '' : ' disabled') + '>Publish changes</button>' +
      '<button class="lnk" data-act="logout">Sign out</button>';
    var note = document.getElementById('note');
    if (note) note.classList.toggle('show', S.dirty && !S.busy);
  }

  /* form controls bound to the data by path */
  function inp(bind, label, opts) {
    opts = opts || {};
    var val = getPath(S.data, bind);
    var attrs = ' data-bind="' + bind + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.num ? ' data-num' : '') + (opts.attrs || '');
    var tag;
    if (opts.lines) tag = '<textarea rows="' + (opts.rows || 3) + '" data-lines' + attrs + '>' + esc((val || []).join('\n')) + '</textarea>';
    else if (opts.area) tag = '<textarea rows="' + (opts.rows || 3) + '"' + attrs + '>' + esc(val) + '</textarea>';
    else if (opts.options) tag = '<select' + attrs + '>' + opts.options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
    else tag = '<input type="' + (opts.type || 'text') + '" value="' + esc(val) + '"' + attrs + '>';
    return '<label class="af">' + label + (opts.hint ? ' <small>' + opts.hint + '</small>' : '') + tag + '</label>';
  }
  function sw(bind, label, extra) {
    return '<label class="sw"><input type="checkbox" data-bind="' + bind + '"' + (getPath(S.data, bind) ? ' checked' : '') + (extra || '') + '>' + esc(label) + '</label>';
  }

  /* ---- Simulations ---- */
  function simsPanel() {
    var sims = S.data.sims, home = homeSet();
    return '<h1 class="a-h">Simulations</h1>' +
      '<p class="a-help">The order here is the order on the simulations page. <b>Show</b> hides a simulation without deleting it. <b>On home page</b> picks the ones in the home page player: one to three, in list order. Every simulation runs at 1280 × 720.</p>' +
      sims.map(function (s, i) {
        var b = 'sims.' + i + '.', hi = home.indexOf(s.slug);
        return '<div class="acard">' +
          '<div class="row">' +
            '<img class="thumb" src="' + esc(preview(s.img.mistake || s.img.start)) + '" alt="">' +
            '<div class="grow"><h3' + (s.lang ? ' lang="' + esc(s.lang) + '"' : '') + '>' + esc(s.title || 'Untitled') + '</h3><small>' + esc(s.hook) + '</small><div class="row" style="margin-top:6px;gap:6px">' +
              (hi >= 0 ? '<span class="badge badge--orange">Home page #' + (hi + 1) + '</span>' : '') +
              (!s.on ? '<span class="badge badge--line">Hidden</span>' : '') +
              (s.uploaded ? '<span class="badge badge--line">Uploaded</span>' : '') +
              '<span class="badge badge--line">' + (s.group === 'class' ? 'Classroom' : 'Workplace') + '</span>' +
            '</div></div>' +
            sw(b + 'on', 'Show') +
            '<label class="sw"><input type="checkbox" data-act="home" data-slug="' + esc(s.slug) + '"' + (hi >= 0 ? ' checked' : '') + (s.on ? '' : ' disabled') + '>On home page</label>' +
          '</div>' +
          '<div class="row" style="margin-top:14px">' +
            '<button class="ib" data-act="move" data-i="' + i + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑ Up</button>' +
            '<button class="ib" data-act="move" data-i="' + i + '" data-d="1"' + (i === sims.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓ Down</button>' +
            '<button class="ib" data-act="toggle" data-k="s' + i + '" aria-expanded="' + !!S.open['s' + i] + '">' + (S.open['s' + i] ? 'Close' : 'Edit') + '</button>' +
            '<a class="ib" target="_blank" rel="noopener" href="' + esc(/^https?:/.test(s.path) ? s.path : '../' + s.path) + '">Try it</a>' +
            '<span class="grow"></span>' +
            '<button class="ib ib--danger" data-act="del-sim" data-i="' + i + '">Delete</button>' +
          '</div>' +
          (S.open['s' + i] ? '<div class="edit">' + simFields(b, s, i) + '</div>' : '') +
        '</div>';
      }).join('') +
      '<h2 class="a-h" id="add">Add a simulation</h2>' + addSimForm();
  }
  var GROUPS = [['work', 'For the workplace'], ['class', 'For the classroom']];
  function simFields(b, s, i) {
    return '<div class="grid2">' + inp(b + 'title', 'Title') + inp(b + 'tab', 'Short name', { hint: 'on the home page tab, e.g. Fire safety' }) + '</div>' +
      '<div class="grid3">' + inp(b + 'topic', 'Topic', { hint: 'e.g. Safety' }) + inp(b + 'audience', 'Audience', { hint: 'e.g. Every workplace' }) + inp(b + 'group', 'Group', { options: GROUPS }) + '</div>' +
      inp(b + 'hook', 'Card line', { hint: 'the mistake in one line, under the card on the simulations page' }) +
      inp(b + 'play', 'How to play', { hint: 'one line' }) +
      '<div class="grid3">' + inp(b + 'triad.0', '01 · You do') + inp(b + 'triad.1', '02 · What happens') + inp(b + 'triad.2', '03 · What sticks') + '</div>' +
      '<div class="grid2">' + inp(b + 'readout', 'Readout', { hint: 'real numbers from the sim\'s own screen, e.g. 5/10 devices infected' }) +
        inp(b + 'lang', 'Language', { options: [['', 'English'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['it', 'Italian']] }) + '</div>' +
      '<p class="pill" style="margin:6px 0 10px">Pictures (1280 × 720; anything you upload is cropped to fit)</p>' +
      '<div class="imgs">' +
        imgSlot(i, 'start', 'Opening screen', 'Card picture on the simulations page') +
        imgSlot(i, 'move', 'Your move (optional)', 'The decision point just before the mistake. Without it, the opening screen is used') +
        imgSlot(i, 'mistake', 'What happens', 'The moment of the mistake') +
      '</div>' +
      '<div class="acard acard--flat" style="margin-top:14px"><p class="pill" style="margin-bottom:8px">Footage clip (optional)</p>' +
        '<p class="a-help" style="margin-bottom:10px">A short MP4 of the mistake happening (5–8 s, under 5 MB). Simulations with a clip play in the home page reel and on hover.</p>' +
        '<div class="row"><span class="grow">' + (s.clip ? '<code>' + esc(s.clip) + '</code>' + (S.files[s.clip] ? ' (new)' : '') : 'No clip yet') + '</span>' +
        '<label class="ib">Upload MP4<input type="file" accept="video/mp4" data-act="clip" data-i="' + i + '" hidden></label>' +
        (s.clip ? '<button class="ib ib--danger" data-act="clip-clear" data-i="' + i + '">Remove clip</button>' : '') + '</div></div>' +
      '<div class="grid3" style="margin-top:12px">' + inp(b + 'alt', 'Describe the opening screen', { area: true, rows: 2 }) + inp(b + 'altMove', 'Describe your move', { area: true, rows: 2 }) + inp(b + 'altMistake', 'Describe what happens', { area: true, rows: 2 }) + '</div>' +
      '<details class="more"><summary>Replace the simulation itself</summary>' +
        '<p class="a-help">Upload a new version: one HTML file, or a folder with an index.html. It should be built for a 1280 × 720 screen.</p>' +
        '<div class="grid2"><label class="af">Single HTML file<input type="file" data-act="replace-sim" data-i="' + i + '" accept=".html,.htm,text/html"></label>' +
        '<label class="af">…or a folder<input type="file" data-act="replace-sim" data-i="' + i + '" webkitdirectory multiple></label></div>' +
        '<p class="a-help">Now: <code>' + esc(s.path) + '</code></p>' +
      '</details>';
  }
  function imgSlot(i, key, label, hint) {
    var p = S.data.sims[i].img[key];
    return '<figure>' +
      (p ? '<img src="' + esc(preview(p)) + '" alt="">' : '<div class="empty">' + esc(hint) + '</div>') +
      '<label class="af">' + esc(label) + '<input type="file" accept="image/*" data-act="img" data-i="' + i + '" data-key="' + key + '"></label>' +
      (key === 'move' && p ? '<button class="ib" data-act="img-clear" data-i="' + i + '" data-key="move">Use the opening screen instead</button>' : '') +
    '</figure>';
  }
  function addSimForm() {
    return '<form class="acard" id="add-form">' +
      '<p class="a-help">It is added at the bottom of the list, shown on the simulations page, and goes live when you press <b>Publish</b>.</p>' +
      '<div class="grid2">' +
        '<label class="af">Title *<input name="title" required placeholder="e.g. Lock it out"></label>' +
        '<label class="af">Short name * <small>for the home page tab</small><input name="tab" required placeholder="e.g. Lockout"></label>' +
      '</div>' +
      '<div class="grid3">' +
        '<label class="af">Topic<input name="topic" placeholder="e.g. Safety"></label>' +
        '<label class="af">Audience<input name="audience" placeholder="e.g. Maintenance teams"></label>' +
        '<label class="af">Group<select name="group">' + GROUPS.map(function (g) { return '<option value="' + g[0] + '">' + g[1] + '</option>'; }).join('') + '</select></label>' +
      '</div>' +
      '<label class="af">Card line * <small>the mistake in one line</small><input name="hook" required placeholder="e.g. Skip the lock and the machine starts."></label>' +
      '<label class="af">How to play<input name="play" placeholder="e.g. Shut the machine down in the right order."></label>' +
      '<div class="grid3">' +
        '<label class="af">01 · You do *<input name="t0" required placeholder="e.g. Skip the padlock"></label>' +
        '<label class="af">02 · What happens *<input name="t1" required placeholder="e.g. The press starts"></label>' +
        '<label class="af">03 · What sticks *<input name="t2" required placeholder="e.g. Lock, tag, try"></label>' +
      '</div>' +
      '<label class="af">Readout <small>real numbers from the sim\'s own screen (optional)</small><input name="readout"></label>' +
      '<div class="grid3">' +
        '<label class="af">Opening screen *<input type="file" name="imgStart" accept="image/*" required></label>' +
        '<label class="af">Your move <small>optional</small><input type="file" name="imgMove" accept="image/*"></label>' +
        '<label class="af">What happens *<input type="file" name="imgMistake" accept="image/*" required></label>' +
      '</div>' +
      '<div class="grid3">' +
        '<label class="af">Describe the opening screen<input name="alt"></label>' +
        '<label class="af">Describe your move<input name="altMove"></label>' +
        '<label class="af">Describe what happens<input name="altMistake"></label>' +
      '</div>' +
      '<div class="acard acard--flat">' +
        '<p class="a-help" style="margin-bottom:10px"><b style="color:var(--ink)">The simulation itself *</b> One HTML file, or a whole folder with an index.html at its top. Build it for a 1280 × 720 screen.</p>' +
        '<div class="grid2">' +
          '<label class="af">Single HTML file<input type="file" name="simFile" accept=".html,.htm,text/html"></label>' +
          '<label class="af">…or a folder<input type="file" name="simFolder" webkitdirectory multiple></label>' +
        '</div>' +
      '</div>' +
      '<button class="btn" type="submit">Add simulation</button>' +
    '</form>';
  }

  /* ---- Home page ---- */
  function homePanel() {
    var d = S.data;
    return '<h1 class="a-h">Home page</h1>' +
      '<p class="a-help">Use <code>{n}</code> for the number of simulations shown (8) and <code>{N}</code> for it as a word (Eight). The headline is fitted to one line when you publish.</p>' +

      '<h2 class="a-h">Top of the page</h2><div class="acard">' +
        '<div class="grid2">' + inp('hero.line1', 'Headline, part 1') + inp('hero.line2', 'Headline, part 2', { hint: 'on phones the parts sit on two lines' }) + '</div>' +
        inp('hero.lede', 'Intro', { area: true, rows: 2 }) +
        '<div class="grid2">' + inp('hero.button', 'Button') + inp('hero.facts', 'Facts next to the button', { lines: true, hint: 'one per line, up to 3' }) + '</div>' +
        inp('home.demoNote', 'Line under the simulation carousel') +
        inp('hero.reelFirst', 'First clip in the hero reel', { options: d.sims.filter(function (s) { return s.on && s.clip; }).map(function (s) { return [s.slug, s.title]; }), hint: 'only simulations with a footage clip play in the reel' }) +
      '</div>' +

      '<h2 class="a-h">Facts strip</h2><div class="acard"><div class="grid2">' +
        d.plate.map(function (p, i) { return '<div class="grid2">' + inp('plate.' + i + '.label', 'Label') + inp('plate.' + i + '.value', 'Value') + '</div>'; }).join('') +
      '</div></div>' +

      '<h2 class="a-h">About</h2><div class="acard">' +
        '<div class="row" style="align-items:flex-start;margin-bottom:12px">' +
          '<img src="' + esc(preview(d.about.photo)) + '" alt="" style="width:120px;height:120px;object-fit:cover;border:2px solid var(--ink)">' +
          '<label class="af grow">Photo <small>cropped to a square</small><input type="file" accept="image/*" data-act="photo"></label>' +
        '</div>' +
        '<div class="grid3">' + inp('about.name', 'Name') + inp('about.place', 'City') + inp('about.heading', 'Heading') + '</div>' +
        inp('about.quote', 'Quote', { area: true, rows: 2 }) +
        d.about.facts.map(function (f, i) {
          return '<div class="row" style="align-items:flex-end">' +
            '<div class="grow">' + inp('about.facts.' + i + '.label', 'Label') + '</div>' +
            '<div class="grow" style="flex:3">' + inp('about.facts.' + i + '.value', 'Value') + '</div>' +
            '<button class="ib ib--danger" style="margin-bottom:14px" data-act="del-row" data-list="about.facts" data-i="' + i + '">Remove</button></div>';
        }).join('') +
        '<button class="ib" data-act="add-row" data-list="about.facts">+ Add a fact</button>' +
      '</div>' +

      '<h2 class="a-h">How it works</h2><div class="acard">' +
        '<div class="grid2">' + inp('process.heading', 'Heading') + inp('process.intro', 'Intro') + '</div>' +
        '<p class="a-help">Weeks run from 0 (start of week 1) to 5 (end of week 5). Halves are fine, e.g. 1.5.</p>' +
        d.process.steps.map(function (s, i) {
          var b = 'process.steps.' + i + '.';
          return '<div class="acard acard--flat"><p class="pill">Step ' + (i + 1) + '</p>' +
            '<div class="grid2">' + inp(b + 'title', 'Name') + inp(b + 'desc', 'One line') + '</div>' +
            '<div class="grid4">' + inp(b + 'bar', 'Bar label') + inp(b + 'start', 'Starts at week', { type: 'number', num: true, attrs: ' min="0" max="5" step="0.5"' }) + inp(b + 'end', 'Ends at week', { type: 'number', num: true, attrs: ' min="0" max="5" step="0.5"' }) + inp(b + 'youAt', 'Your part at week', { type: 'number', num: true, attrs: ' min="0" max="5" step="0.05"' }) + '</div>' +
            '<div class="row">' + '<div class="grow">' + inp(b + 'you', 'Your part', { hint: 'leave empty if there is none' }) + '</div>' + sw(b + 'mistakes', 'Orange bar (where the mistakes are designed)') + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +

      '<h2 class="a-h">Simulations page</h2><div class="acard">' +
        '<div class="grid2">' + inp('simsPage.line1', 'Headline, part 1', { hint: '{N} = number as a word' }) + inp('simsPage.line2', 'Headline, part 2') + '</div>' +
        '<div class="grid2">' + inp('simsPage.lede', 'Intro', { area: true, rows: 2 }) + inp('simsPage.note', 'Small note', { area: true, rows: 2 }) + '</div>' +
        '<div class="grid2">' + inp('simsPage.workHeading', 'Workplace group heading') + inp('simsPage.classHeading', 'Classroom group heading') + '</div>' +
      '</div>' +

      '<h2 class="a-h">Footer and search engines</h2><div class="acard">' +
        '<div class="grid2">' + inp('footer.why', 'Footer line', { area: true, rows: 2 }) + inp('footer.year', 'Year') + '</div>' +
        '<div class="grid2">' + inp('meta.home.title', 'Home page title', { hint: 'browser tab and search results' }) + inp('meta.sims.title', 'Simulations page title') + '</div>' +
        '<div class="grid2">' + inp('meta.home.description', 'Home page description', { area: true }) + inp('meta.sims.description', 'Simulations page description', { area: true }) + '</div>' +
      '</div>';
  }

  /* ---- Pricing & FAQ ---- */
  function pricingPanel() {
    var R = S.data.pricing;
    return '<h1 class="a-h">Pricing & FAQ</h1>' +
      '<div class="acard"><div class="grid2">' + inp('pricing.heading', 'Heading') + inp('pricing.intro', 'Intro') + '</div></div>' +
      '<div class="grid3">' + R.packages.map(function (p, i) {
        var b = 'pricing.packages.' + i + '.';
        return '<div class="acard">' +
          inp(b + 'name', 'Name') +
          '<div class="grid2">' + inp(b + 'price', 'Price', { hint: 'shown after "from"' }) + inp(b + 'weeks', 'Weeks', { options: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], num: true }) + '</div>' +
          inp(b + 'for', 'Who it is for', { area: true, rows: 2 }) +
          inp(b + 'items', 'What you get', { lines: true, rows: 5, hint: 'one per line' }) +
          inp(b + 'button', 'Button') +
          '<label class="sw"><input type="radio" name="core" data-act="core" data-i="' + i + '"' + (p.core ? ' checked' : '') + '>Highlight this one</label>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="acard">' + inp('pricing.terms', 'Terms under the prices', { lines: true, hint: 'one per line' }) + '</div>' +

      '<h2 class="a-h">FAQ</h2>' +
      '<div class="acard">' + inp('faqHeading', 'Heading') + '</div>' +
      S.data.faq.map(function (q, i) {
        return '<div class="acard">' + inp('faq.' + i + '.q', 'Question') + inp('faq.' + i + '.a', 'Answer', { area: true, rows: 2 }) +
          '<div class="row"><button class="ib" data-act="move-row" data-list="faq" data-i="' + i + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + '>↑ Up</button>' +
          '<button class="ib" data-act="move-row" data-list="faq" data-i="' + i + '" data-d="1"' + (i === S.data.faq.length - 1 ? ' disabled' : '') + '>↓ Down</button>' +
          '<span class="grow"></span><button class="ib ib--danger" data-act="del-row" data-list="faq" data-i="' + i + '">Delete</button></div></div>';
      }).join('') +
      '<button class="ib" data-act="add-row" data-list="faq">+ Add a question</button>';
  }

  /* ---- Contact & legal ---- */
  function contactPanel() {
    return '<h1 class="a-h">Contact & legal</h1>' +
      '<h2 class="a-h">How people reach you</h2><div class="acard">' +
        '<div class="grid2">' + inp('contact.email', 'Email', { type: 'email', hint: 'shown under the form, in the footer and in the Impressum' }) + inp('contact.phone', 'Phone', { type: 'tel', hint: 'optional' }) + '</div>' +
        '<div class="grid2">' + inp('contact.linkedin', 'LinkedIn', { type: 'url' }) + inp('contact.booking', 'Booking link', { type: 'url', hint: 'optional, e.g. Cal.com or Calendly' }) + '</div>' +
        inp('contact.web3formsKey', 'Web3Forms access key', { hint: 'makes the contact form email you. Get a free key at web3forms.com with the inbox that should receive messages. Empty: the form opens the visitor\'s email app (then set an email above).' }) +
      '</div>' +
      '<h2 class="a-h">Contact section</h2><div class="acard">' +
        '<div class="grid2">' + inp('contactSection.heading', 'Heading') + inp('contactSection.lede', 'Intro', { area: true, rows: 2 }) + '</div>' +
        '<div class="grid2">' + inp('contactSection.promises', 'Promises with ticks', { lines: true, hint: 'one per line' }) + inp('contactSection.topics', 'Topic choices in the form', { lines: true, rows: 6, hint: 'one per line' }) + '</div>' +
        inp('contactSection.placeholder', 'Example text in the message box') +
      '</div>' +
      '<h2 class="a-h">Impressum & Datenschutz</h2>' +
      '<p class="a-help">German legal pages. Empty fields show up there as yellow placeholders. Have the final text checked before you rely on it.</p>' +
      '<div class="acard">' +
        '<div class="grid2">' + inp('legal.owner', 'Inhaber') + inp('legal.country', 'Land') + '</div>' +
        '<div class="grid2">' + inp('legal.street', 'Straße und Hausnummer') + inp('legal.city', 'PLZ und Ort') + '</div>' +
        '<div class="row" style="align-items:flex-end"><div class="grow">' + inp('legal.vatId', 'USt-IdNr.') + '</div>' + sw('legal.noVatId', 'Keine USt-IdNr. (Abschnitt weglassen)') + '</div>' +
        '<div class="grid2">' + inp('legal.hostingProvider', 'Hosting-Anbieter', { ph: 'GitHub Pages (GitHub, Inc., USA)' }) + inp('legal.hostingTransfer', 'Hosting: Hinweis Drittland', { area: true, rows: 2 }) + '</div>' +
        '<div class="grid2">' + inp('legal.formProvider', 'Web3Forms: Anbieter mit Anschrift', { area: true, rows: 2 }) + inp('legal.formTransfer', 'Web3Forms: Hinweis Drittland', { area: true, rows: 2 }) + '</div>' +
        '<div class="grid2">' + inp('legal.authority', 'Zuständige Aufsichtsbehörde', { ph: 'Bayerisches Landesamt für Datenschutzaufsicht' }) + inp('legal.updated', 'Stand', { ph: 'z. B. Dezember 2026' }) + '</div>' +
      '</div>' +
      '<h2 class="a-h">Site</h2><div class="acard">' +
        inp('settings.siteUrl', 'Site address', { type: 'url', hint: 'used for link previews on LinkedIn, Teams and Slack' }) +
        '<p class="a-help" style="margin:0">Connected to <b>' + esc(S.repo) + '</b>, branch <b>' + esc(S.branch) + '</b>.</p>' +
      '</div>';
  }

  /* ---- Sign in ---- */
  function renderLogin(err) {
    app.innerHTML = '<form class="login" id="login">' +
      '<span class="logo" style="font-size:30px">raz<span class="i">ı</span>nation</span>' +
      '<h1>Admin</h1>' +
      '<p class="a-help">Sign in with a GitHub access key that can edit only this site.</p>' +
      (err ? '<div class="msg msg--err" role="alert">' + esc(err) + '</div>' : '') +
      '<label class="af">GitHub access key<input type="password" name="token" required autocomplete="off" placeholder="github_pat_…"></label>' +
      '<label class="sw" style="margin-bottom:18px"><input type="checkbox" name="remember" checked>Remember on this device</label>' +
      '<details class="more"><summary>How to get a key (2 minutes, once)</summary><ol>' +
        '<li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Settings → Fine-grained tokens → Generate new token</a>.</li>' +
        '<li>Name it "Razination admin" and pick an expiry, e.g. 1 year.</li>' +
        '<li>Repository access: <b>Only select repositories</b> → <b>' + esc(DEFAULTS.repo) + '</b>.</li>' +
        '<li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>' +
        '<li>Generate, copy the key and paste it here. Don\'t share it.</li>' +
      '</ol></details>' +
      '<details class="more"><summary>Repository settings</summary>' +
        '<div class="grid2"><label class="af">Repository<input name="repo" value="' + esc(S.repo) + '"></label><label class="af">Branch <small>the one GitHub Pages publishes</small><input name="branch" value="' + esc(S.branch) + '"></label></div>' +
      '</details>' +
      '<button class="btn" type="submit">Sign in</button></form>';
  }

  /* ---------------- events ---------------- */
  app.addEventListener('input', function (e) {
    var el = e.target, bind = el.getAttribute('data-bind');
    if (!bind || el.type === 'checkbox') return;
    var v = el.value;
    if (el.hasAttribute('data-lines')) v = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    else if (el.hasAttribute('data-num')) v = v === '' ? 0 : +v;
    setPath(S.data, bind, v);
    markDirty();
  });
  app.addEventListener('change', function (e) {
    var el = e.target, bind = el.getAttribute('data-bind'), act = el.getAttribute('data-act');
    if (bind && el.type === 'checkbox') {
      setPath(S.data, bind, el.checked);
      if (/^sims\.\d+\.on$/.test(bind)) { syncHome(); markDirty(); render(); return; }
      markDirty();
      return;
    }
    if (bind && el.tagName === 'SELECT') {
      setPath(S.data, bind, el.hasAttribute('data-num') ? +el.value : el.value);
      markDirty();
      return;
    }
    if (act === 'home') {
      var slug = el.getAttribute('data-slug'), set = homeSet();
      if (el.checked) {
        if (set.length >= 3) { el.checked = false; alert('The home page shows up to three simulations. Untick one first.'); return; }
        set.push(slug);
      } else {
        if (set.length <= 1) { el.checked = true; alert('The home page needs at least one simulation.'); return; }
        set.splice(set.indexOf(slug), 1);
      }
      syncHome(); markDirty(); render();
    }
    else if (act === 'core') {
      S.data.pricing.packages.forEach(function (p, i) { p.core = i === +el.getAttribute('data-i'); });
      markDirty();
    }
    else if (act === 'img') uploadImage(el);
    else if (act === 'photo') uploadPhoto(el);
    else if (act === 'replace-sim') replaceSim(el);
    else if (act === 'clip') uploadClip(el);
  });

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    var act = el.getAttribute('data-act'), d = S.data;
    if (act === 'tab') { S.tab = el.getAttribute('data-id'); S.msg = null; S.open = {}; render(); window.scrollTo(0, 0); }
    else if (act === 'toggle') { var k = el.getAttribute('data-k'); S.open[k] = !S.open[k]; render(); }
    else if (act === 'move') {
      var i = +el.getAttribute('data-i'), j = i + +el.getAttribute('data-d');
      var t = d.sims[i]; d.sims[i] = d.sims[j]; d.sims[j] = t;
      S.open = {}; syncHome(); markDirty(); render();
    }
    else if (act === 'move-row') {
      var list = getPath(d, el.getAttribute('data-list')), a = +el.getAttribute('data-i'), b = a + +el.getAttribute('data-d');
      var x = list[a]; list[a] = list[b]; list[b] = x; markDirty(); render();
    }
    else if (act === 'del-row') {
      var l = getPath(d, el.getAttribute('data-list'));
      if (!confirm('Remove this entry?')) return;
      l.splice(+el.getAttribute('data-i'), 1); markDirty(); render();
    }
    else if (act === 'add-row') {
      var name = el.getAttribute('data-list');
      getPath(d, name).push(name === 'faq' ? { q: '', a: '' } : { label: '', value: '' });
      markDirty(); render();
    }
    else if (act === 'img-clear') {
      var s0 = d.sims[+el.getAttribute('data-i')];
      dropUpload(s0.img.move); s0.img.move = ''; s0.altMove = '';
      markDirty(); render();
    }
    else if (act === 'clip-clear') {
      var sc = d.sims[+el.getAttribute('data-i')];
      dropUpload(sc.clip); sc.clip = ''; markDirty(); render();
    }
    else if (act === 'del-sim') delSim(+el.getAttribute('data-i'));
    else if (act === 'publish') publish();
    else if (act === 'preview') openPreview();
    else if (act === 'logout') {
      if (S.dirty && !confirm('You have unpublished changes. Sign out anyway?')) return;
      try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch (err) {}
      S.data = null; S.token = ''; S.dirty = false; renderLogin();
    }
  });

  app.addEventListener('submit', function (e) {
    e.preventDefault();
    if (e.target.id === 'login') return login(new FormData(e.target));
    if (e.target.id === 'add-form') return addSim(e.target);
  });

  /* an upload that hasn't been published yet can just be forgotten */
  function dropUpload(path) { if (path && S.files[path]) delete S.files[path]; }

  function uploadImage(el) {
    var i = +el.getAttribute('data-i'), key = el.getAttribute('data-key'), s = S.data.sims[i], f = el.files[0];
    if (!f) return;
    imageTo(f, 1280, 720).then(function (r) {
      dropUpload(s.img[key]);
      var suffix = key === 'start' ? '-start' : key === 'move' ? '-move' : '';
      var p = 'img/thumbs/' + s.slug + suffix + '-u' + stamp() + '.' + r.ext;
      S.files[p] = r.b64;
      s.img[key] = p;
      markDirty(); render();
    }).catch(function (err) { alert(err.message); });
  }
  function uploadClip(el) {
    var s = S.data.sims[+el.getAttribute('data-i')], f = el.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { alert('That clip is over 8 MB. Please keep it short (5–8 s) and compressed.'); return; }
    fileToB64(f).then(function (b) {
      dropUpload(s.clip);
      var p = 'media/' + s.slug + '-u' + stamp() + '.mp4';
      S.files[p] = b; s.clip = p;
      markDirty(); render();
    });
  }
  function uploadPhoto(el) {
    var f = el.files[0];
    if (!f) return;
    imageTo(f, 480, 480).then(function (r) {
      dropUpload(S.data.about.photo);
      var p = 'img/razin-portrait-u' + stamp() + '.' + r.ext;
      S.files[p] = r.b64;
      S.data.about.photo = p;
      markDirty(); render();
    }).catch(function (err) { alert(err.message); });
  }

  /* collect a single HTML file or a folder (with index.html) into sims/<slug>/ */
  function collectSim(slug, fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return Promise.reject(new Error('Pick an HTML file or a folder.'));
    var folder = files.length > 1 || (files[0].webkitRelativePath && files[0].webkitRelativePath.indexOf('/') > 0);
    var base = 'sims/' + slug + '/', out = {};
    if (!folder) {
      return fileToB64(files[0]).then(function (b) { out[base + 'index.html'] = b; return out; });
    }
    if (!files.some(function (f) { return /^[^/]+\/index\.html?$/i.test(f.webkitRelativePath); })) {
      return Promise.reject(new Error('That folder has no index.html at its top level.'));
    }
    return Promise.all(files.map(function (f) {
      var rel = f.webkitRelativePath.split('/').slice(1).join('/');
      if (!rel || /(^|\/)\./.test(rel)) return null;
      if (/^index\.htm$/i.test(rel)) rel = 'index.html';
      return fileToB64(f).then(function (b) { out[base + rel] = b; });
    })).then(function () { return out; });
  }

  function replaceSim(el) {
    var s = S.data.sims[+el.getAttribute('data-i')];
    if (!el.files.length) return;
    if (!confirm('Replace the simulation "' + s.title + '" with this upload?')) { el.value = ''; return; }
    collectSim(s.slug, el.files).then(function (files) {
      Object.keys(S.files).forEach(function (f) { if (f.indexOf('sims/' + s.slug + '/') === 0) delete S.files[f]; });
      if (S.delPrefixes.indexOf('sims/' + s.slug + '/') < 0) S.delPrefixes.push('sims/' + s.slug + '/');
      Object.keys(files).forEach(function (f) { S.files[f] = files[f]; });
      s.path = 'sims/' + s.slug + '/index.html';
      markDirty();
      S.msg = { kind: 'ok', html: 'New version of "' + esc(s.title) + '" is ready. Press <b>Publish changes</b> to put it live.' };
      render();
    }).catch(function (err) { alert(err.message); el.value = ''; });
  }

  function delSim(i) {
    var d = S.data, s = d.sims[i];
    var msg = 'Delete "' + s.title + '"?\n\n' + (s.uploaded
      ? 'Its uploaded files are deleted too.'
      : 'It is removed from the site. Its files stay in the repository. To keep it but hide it, use the Show switch instead.');
    if (!confirm(msg)) return;
    if (d.home.sims.indexOf(s.slug) >= 0 && d.home.sims.length <= 1) { alert('It is the only simulation on the home page. Tick another one first.'); return; }
    d.sims.splice(i, 1);
    d.home.sims = d.home.sims.filter(function (x) { return x !== s.slug; });
    if (s.uploaded) {
      ['start', 'move', 'mistake'].forEach(function (k) { var p = s.img[k]; if (p) { dropUpload(p); S.delPaths.push(p); } });
      Object.keys(S.files).forEach(function (f) { if (f.indexOf('sims/' + s.slug + '/') === 0) delete S.files[f]; });
      S.delPrefixes.push('sims/' + s.slug + '/');
    }
    S.open = {}; markDirty(); render();
  }

  function addSim(form) {
    var fd = new FormData(form), d = S.data;
    var title = String(fd.get('title')).trim();
    var slug = slugify(title) || 'simulation', base = slug, n = 2;
    while (d.sims.some(function (s) { return s.slug === slug; })) slug = base + '-' + n++;
    var simFiles = form.simFile.files.length ? form.simFile.files : form.simFolder.files;
    if (!simFiles.length) { alert('Add the simulation itself: an HTML file or a folder.'); return; }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Preparing files…';
    var s = {
      slug: slug, on: true, uploaded: true,
      title: title, tab: String(fd.get('tab')).trim(), topic: String(fd.get('topic') || '').trim(),
      group: String(fd.get('group') || 'work'), audience: String(fd.get('audience') || '').trim(),
      hook: String(fd.get('hook')).trim(), play: String(fd.get('play') || '').trim(),
      triad: [String(fd.get('t0')).trim(), String(fd.get('t1')).trim(), String(fd.get('t2')).trim()],
      readout: String(fd.get('readout') || '').trim(),
      alt: String(fd.get('alt') || '').trim() || title + ': opening screen',
      altMove: String(fd.get('altMove') || '').trim(),
      altMistake: String(fd.get('altMistake') || '').trim() || title + ': the moment of the mistake',
      lang: '', img: { start: '', move: '', mistake: '' },
      path: 'sims/' + slug + '/index.html'
    };
    var jobs = [
      imageTo(form.imgStart.files[0], 1280, 720).then(function (r) { s.img.start = 'img/thumbs/' + slug + '-start-u' + stamp() + '.' + r.ext; S.files[s.img.start] = r.b64; }),
      imageTo(form.imgMistake.files[0], 1280, 720).then(function (r) { s.img.mistake = 'img/thumbs/' + slug + '-u' + stamp() + '.' + r.ext; S.files[s.img.mistake] = r.b64; }),
      collectSim(slug, simFiles).then(function (files) { Object.keys(files).forEach(function (f) { S.files[f] = files[f]; }); })
    ];
    if (form.imgMove.files[0]) jobs.push(imageTo(form.imgMove.files[0], 1280, 720).then(function (r) {
      s.img.move = 'img/thumbs/' + slug + '-move-u' + stamp() + '.' + r.ext; S.files[s.img.move] = r.b64;
    }));
    Promise.all(jobs).then(function () {
      d.sims.push(s);
      markDirty();
      S.msg = { kind: 'ok', html: '"' + esc(title) + '" was added at the bottom of the list. Press <b>Publish changes</b> to put it live.' };
      form.reset();
      render(); window.scrollTo(0, 0);
    }).catch(function (err) {
      alert(err.message);
      btn.disabled = false; btn.textContent = 'Add simulation';
    });
  }

  /* ---------------- sign in ---------------- */
  function login(fd) {
    S.token = String(fd.get('token')).trim();
    S.repo = String(fd.get('repo') || DEFAULTS.repo).trim();
    S.branch = String(fd.get('branch') || DEFAULTS.branch).trim();
    var store = fd.get('remember') ? localStorage : sessionStorage;
    connect().then(function () {
      try { store.setItem(STORE, JSON.stringify({ token: S.token, repo: S.repo, branch: S.branch })); } catch (e) {}
    }).catch(function () {});
  }
  function connect() {
    app.innerHTML = '<div class="login"><p>Connecting to GitHub…</p></div>';
    return getText(DATA_PATH).then(function (t) {
      S.data = JSON.parse(t);
      S.original = JSON.parse(t);
      S.dirty = false; render();
    }).catch(function (err) {
      S.data = null; renderLogin(err.message); throw err;
    });
  }

  /* ---------------- build, preview, publish ---------------- */
  function checks() {
    var d = S.data, problems = [];
    var shown = d.sims.filter(function (s) { return s.on; });
    if (!shown.length) problems.push('Show at least one simulation.');
    if (!d.home.sims.length) problems.push('Tick at least one simulation for the home page.');
    d.sims.forEach(function (s) {
      if (!s.title) problems.push('A simulation has no title.');
      if (s.on && (!s.img.start || !s.img.mistake)) problems.push('"' + s.title + '" needs an opening screen and a "what happens" picture.');
      if (s.on && !s.tab) problems.push('"' + s.title + '" needs a short name.');
    });
    if (!d.contact.web3formsKey && !d.contact.email) problems.push('Set a Web3Forms key or an email, or the contact form can\'t reach you.');
    return problems;
  }
  function withFits() {
    var d = JSON.parse(JSON.stringify(S.data));
    var h = fits(d.hero.line1, d.hero.line2); d.hero.fit = h.fit; d.hero.fitM = h.fitM;
    var sp = fits(RazRender.fill(d.simsPage.line1, d), RazRender.fill(d.simsPage.line2, d)); d.simsPage.fit = sp.fit; d.simsPage.fitM = sp.fitM;
    return d;
  }
  function loadPages() {
    return Promise.all(PAGES.map(function (p) { return getText(p); })).then(function (texts) {
      var pages = {}; PAGES.forEach(function (p, i) { pages[p] = texts[i]; }); return pages;
    });
  }

  function openPreview() {
    var problems = checks();
    if (problems.length) { alert(problems.join('\n')); return; }
    var w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups for this page to see the preview.'); return; }
    w.document.write('<p style="font:16px sans-serif;padding:24px">Building the preview…</p>');
    document.fonts.ready.then(loadPages).then(function (pages) {
      var d = withFits(), out = RazRender.build(d, pages);
      var html = out['index.html'];
      var root = new URL('../', location.href).href;
      html = html.replace('<head>', '<head><base href="' + root + '">');
      html = html.replace('<script src="js/sims-data.js"></script>', '<script>' + out['js/sims-data.js'].replace(/<\/script/gi, '<\\/script') + '</script>');
      Object.keys(S.files).forEach(function (f) { if (/\.(webp|jpe?g|png)$/.test(f)) html = html.split(f).join(preview(f)); });
      html = html.replace('<body>', '<body><div style="position:sticky;top:0;z-index:99;background:#FF4F00;color:#0E0E0F;font:700 14px sans-serif;padding:8px 16px;text-align:center">Preview of the home page with your unpublished changes. Nothing is live yet.</div>');
      w.location.replace(URL.createObjectURL(new Blob([html], { type: 'text/html' })));
    }).catch(function (err) {
      w.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px">Preview failed: ' + esc(err.message) + '</p>';
    });
  }

  /* images that were uploaded through the admin and are no longer used */
  function staleUploads(d) {
    var used = {};
    d.sims.forEach(function (s) { ['start', 'move', 'mistake'].forEach(function (k) { if (s.img[k]) used[s.img[k]] = 1; }); });
    used[d.about.photo] = 1;
    var old = [];
    S.original.sims.forEach(function (s) { ['start', 'move', 'mistake'].forEach(function (k) { if (s.img[k]) old.push(s.img[k]); }); });
    old.push(S.original.about.photo);
    d.sims.forEach(function (s) { if (s.clip) used[s.clip] = 1; });
    S.original.sims.forEach(function (s) { if (s.clip) old.push(s.clip); });
    return old.filter(function (p) { return /-u[0-9a-z]+\.(webp|jpg|mp4)$/.test(p) && !used[p]; });
  }

  function publish() {
    if (S.busy) return;
    var problems = checks();
    if (problems.length) { alert('Before publishing:\n\n' + problems.join('\n')); return; }
    S.busy = true; renderTop();
    var d;
    document.fonts.ready.then(function () {
      d = withFits();
      return loadPages();
    }).then(function (pages) {
      var out = RazRender.build(d, pages);
      Object.keys(out).forEach(function (p) { S.files[p] = b64FromText(out[p]); });
      S.files[DATA_PATH] = b64FromText(JSON.stringify(d, null, 2) + '\n');
      staleUploads(d).forEach(function (p) { if (S.delPaths.indexOf(p) < 0) S.delPaths.push(p); });
      var nUp = Object.keys(S.files).filter(function (p) { return p !== DATA_PATH && !out[p]; }).length;
      return commit('Update site from admin panel' + (nUp ? ' (' + nUp + ' file' + (nUp > 1 ? 's' : '') + ' uploaded)' : ''));
    }).then(function () {
      S.data = d; S.original = JSON.parse(JSON.stringify(d));
      S.files = {}; S.delPaths = []; S.delPrefixes = [];
      S.dirty = false; S.busy = false;
      S.msg = { kind: 'ok', html: 'Published. The site updates in about a minute: <a href="' + esc(siteUrl()) + '" target="_blank" rel="noopener">open it</a>.' };
      render();
    }).catch(function (err) {
      ['index.html', 'simulations.html', 'impressum.html', 'datenschutz.html', 'js/sims-data.js', DATA_PATH].forEach(function (p) { delete S.files[p]; });
      S.busy = false;
      S.msg = { kind: 'err', html: 'Publishing failed: ' + esc(err.message) + ' Your changes are still here; try again.' };
      render();
    });
  }

  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- start ---------------- */
  var saved = null;
  try { saved = localStorage.getItem(STORE) || sessionStorage.getItem(STORE); } catch (e) {}
  if (saved) {
    try {
      var o = JSON.parse(saved); S.token = o.token; S.repo = o.repo || S.repo; S.branch = o.branch || S.branch;
      connect().catch(function () {});
    } catch (e) { renderLogin(); }
  } else renderLogin();
})();
