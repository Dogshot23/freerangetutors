#!/usr/bin/env node
/* ============================================================
   FREE RANGE TUTORS — build-paid-resources.js

   The paid products live in one data file:

       tools/payhip-drafts/paid-resources.json

   (tools/ is kept off the public site by .assetsignore, so the data file,
   including its internal notes, is never published.)

   Since the unified catalogue, the paid products are SHOWN on /made-by-frt/ (built by tools/build-catalogue.js, which
   reads this file through load() and validate() below). The old /paid-resources/ page is now only a small "moved" notice
   (the same convention as dispatch.html), written by this script:

       node tools/build-paid-resources.js            # write the notice
       node tools/build-paid-resources.js --check    # change nothing; exit 1 if stale

   The real redirect is the root _redirects file (/paid-resources/ -> /made-by-frt/, 301). The notice is the fallback for
   any host that does not apply _redirects. The 13 cover images stay in paid-resources/images/ so every image URL keeps working.

   validate() refuses to build unless every live product has a payhip.com/b/<id> link AND a link_verified date (the day
   someone opened the link in a private window and saw a working Buy button). No dependencies.
   Going live is also a manual step list: see tools/payhip-drafts/README.md.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = 'tools/payhip-drafts/paid-resources.json';
const OUT_FILE = 'paid-resources/index.html';

const PAYHIP_PRODUCT_RE = /^https:\/\/payhip\.com\/b\/[A-Za-z0-9]+$/;
const PAYHIP_STORE_RE = /^https:\/\/payhip\.com\/[A-Za-z0-9_-]+$/;
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOLS = { USD: '$', GBP: '£', EUR: '€' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function load() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, DATA_FILE), 'utf8'));
}

function validate(cfg) {
  const fail = (m) => { throw new Error('paid-resources data: ' + m); };
  if (!cfg || typeof cfg !== 'object') fail('not an object');
  if (!cfg.page || !['draft', 'live'].includes(cfg.page.status)) fail('page.status must be "draft" or "live"');
  if (!Array.isArray(cfg.products)) fail('products must be an array');
  const seen = new Set();
  cfg.products.forEach((p) => {
    const w = 'product "' + (p && p.id) + '": ';
    if (!p || !ID_RE.test(p.id || '')) fail('every product needs a slug id (lower-case letters, digits, hyphens)');
    if (seen.has(p.id)) fail('duplicate id ' + p.id);
    seen.add(p.id);
    if (!['draft', 'live'].includes(p.status)) fail(w + 'status must be "draft" or "live"');
    ['title', 'kind', 'summary', 'image', 'image_alt'].forEach((k) => {
      if (typeof p[k] !== 'string' || !p[k].trim()) fail(w + k + ' is required');
    });
    if (p.price_note != null && (typeof p.price_note !== 'string' || !p.price_note.trim())) fail(w + 'price_note must be a non-empty string when present');
    if (!/^\/paid-resources\/images\/[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp)$/.test(p.image)) fail(w + 'image must be under /paid-resources/images/');
    if (!fs.existsSync(path.join(ROOT, p.image.replace(/^\//, '')))) fail(w + 'image file is missing: ' + p.image);
    if (!Array.isArray(p.facts) || p.facts.some((f) => !f || !f.label || !f.value)) fail(w + 'facts must be a list of {label, value}');
    if (!p.price || typeof p.price.amount !== 'number' || !(p.price.amount > 0) || !SYMBOLS[p.price.currency]) fail(w + 'price needs a positive amount and a currency of ' + Object.keys(SYMBOLS).join('/'));
    if (cfg.page.status === 'live' && p.status === 'live') {
      if (!PAYHIP_PRODUCT_RE.test(p.payhip_url || '')) fail(w + 'a live product needs a https://payhip.com/b/<id> payhip_url');
      if (!DATE_RE.test(p.link_verified || '')) fail(w + 'a live product needs link_verified (YYYY-MM-DD): the day the link was opened in a private window and showed a working Buy button');
    }
  });
  if (cfg.page.status === 'live') {
    if (!cfg.products.some((p) => p.status === 'live')) fail('refusing to build a live page with no live products (no empty shop)');
    if (cfg.page.store_url != null && !PAYHIP_STORE_RE.test(cfg.page.store_url)) fail('page.store_url must look like https://payhip.com/<StoreName>');
  }
}

function price(p) {
  const n = p.price.amount;
  return SYMBOLS[p.price.currency] + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

/* The "moved" notice for the retired /paid-resources/ page: noindex, canonical to the catalogue, no analytics, no timed refresh. */
function render(cfg) {
  validate(cfg || load());
  return [
    '<!DOCTYPE html>',
    '<html lang="en-GB">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <title>Moved: Made by Free Range Tutors</title>',
    '  <meta name="robots" content="noindex" />',
    '  <link rel="canonical" href="https://www.freerangetutors.com/made-by-frt/" />',
    '  <style>',
    '    body { margin: 0; background: #F3EEE1; color: #17140F; font-family: Inter, system-ui, sans-serif; }',
    '    main { max-width: 34rem; margin: 18vh auto 0; padding: 0 24px; }',
    '    h1 { font-family: Fraunces, Georgia, serif; font-size: 2rem; margin: 0 0 12px; }',
    '    p { line-height: 1.6; }',
    '    a { color: #17140F; font-weight: 600; }',
    '    a:focus-visible { outline: 3px solid #1E4FD8; outline-offset: 3px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <h1>This page has moved</h1>',
    '    <p>The paid resources are now listed with the free ones on one page.</p>',
    '    <p><a href="/made-by-frt/">Made by Free Range Tutors &rarr;</a> &nbsp;·&nbsp; <a href="/">All resources &rarr;</a></p>',
    '  </main>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function build(cfg) {
  return [{ file: OUT_FILE, html: render(cfg) }];
}

/* True when two texts are the same apart from line endings. A Windows checkout (core.autocrlf) turns the
   committed LF file into CRLF, which must not count as "out of date". Only CRLF pairs are normalised, so every
   other difference, including a lone CR, still counts. */
function sameContent(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
}

/* Returns the list of files that were (or, with check=true, would be) out of date. */
function run(check) {
  const stale = [];
  build().forEach(({ file, html }) => {
    const p = path.join(ROOT, file);
    const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (!sameContent(current, html)) {
      stale.push(file);
      if (!check) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html); }
    }
  });
  return stale;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale;
  try { stale = run(check); } catch (e) { console.error(e.message); process.exit(1); }
  if (check) {
    if (stale.length) { console.error('Out of date: ' + stale.join(', ') + '\nRun: node tools/build-paid-resources.js'); process.exit(1); }
    console.log('paid-resources notice is up to date.');
  } else {
    console.log(stale.length ? 'Wrote: ' + stale.join(', ') : 'Nothing to change.');
  }
}

module.exports = { run, build, render, validate, load, sameContent, price, esc, DATA_FILE, OUT_FILE, SYMBOLS };
