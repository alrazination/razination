#!/usr/bin/env node
/* Rebuild the editable parts of the pages from data/site.json.
   The admin panel does the same thing on Publish; use this when you edit
   data/site.json by hand.   Usage:  node tools/build.js            */
'use strict';
var fs = require('fs');
var path = require('path');
var R = require('../js/render.js');

var root = path.join(__dirname, '..');
var data = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8'));
var pages = {};
['index.html', 'simulations.html', 'impressum.html', 'datenschutz.html'].forEach(function (f) {
  pages[f] = fs.readFileSync(path.join(root, f), 'utf8');
});
var out = R.build(data, pages);
Object.keys(out).forEach(function (f) {
  var p = path.join(root, f);
  var before = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  if (before !== out[f]) { fs.writeFileSync(p, out[f]); console.log('updated', f); }
  else console.log('unchanged', f);
});
