#!/usr/bin/env node
/* ============================================================
   FREE RANGE TUTORS — build-paid-resources.js

   Builds the paid-resources page from one data file:

       tools/payhip-drafts/paid-resources.json   ->   paid-resources/index.html

   (tools/ is kept off the public site by .assetsignore, so the data file,
   including draft notes, is never published.)

       node tools/build-paid-resources.js            # write the page
       node tools/build-paid-resources.js --check    # change nothing; exit 1 if stale

   Two modes, set by page.status in the data file:

   "draft" (the default and the current state)
     - <meta name="robots" content="noindex, nofollow">; no canonical, no social tags, no analytics
     - a visible "draft preview" banner
     - EVERY product is shown as a preview and NO purchase link is ever written,
       whatever the products' own status says

   "live"
     - indexable, canonical, social tags, analytics
     - only products with status "live" are shown, each with a Payhip link
     - refuses to build unless every live product has a payhip.com/b/<id> link AND a
       link_verified date (the day someone opened the link in a private window and saw
       a working Buy button), and at least one product is live (never an empty shop)

   Going live is also a manual step list: see tools/payhip-drafts/README.md.
   No dependencies.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = 'tools/payhip-drafts/paid-resources.json';
const OUT_FILE = 'paid-resources/index.html';
const SITE = 'https://www.freerangetutors.com';
const PAGE_URL = SITE + '/paid-resources/';

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

function renderProduct(p, live) {
  const facts = p.facts.map((f) => '            <div><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>').join('\n');
  const action = live
    ? '          <a class="pr-btn" href="' + esc(p.payhip_url) + '" target="_blank" rel="noopener noreferrer">Buy on Payhip <span aria-hidden="true">↗</span><small>Opens Payhip in a new tab</small></a>'
    : '          <p class="pr-status">Draft preview: not on sale yet</p>';
  return [
    '      <article class="pr-item" id="' + esc(p.id) + '">',
    '        <img class="pr-cover" src="' + esc(p.image) + '" width="750" height="750" alt="' + esc(p.image_alt) + '" loading="lazy" />',
    '        <div class="pr-body">',
    '          <p class="pr-kind">' + esc(p.kind) + '</p>',
    '          <h2 class="pr-name">' + esc(p.title) + '</h2>',
    '          <p class="pr-summary">' + esc(p.summary) + '</p>',
    '          <dl class="pr-facts">',
    facts,
    '          </dl>',
    '          <div class="pr-buy">',
    '          <p class="pr-price">' + esc(price(p)) + ' <small>' + esc(p.price.currency) + '</small></p>',
    action,
    '          </div>',
    p.price_note ? '          <p class="pr-note">' + esc(p.price_note) + '</p>' : '',
    '        </div>',
    '      </article>'
  ].join('\n');
}

function render(cfg) {
  validate(cfg);
  const live = cfg.page.status === 'live';
  const shown = live ? cfg.products.filter((p) => p.status === 'live') : cfg.products;
  const desc = 'Teaching resources published by GapTheMind that cost a small amount, sold through Payhip. Most of the Free Range Tutors site is free.';

  const head = live
    ? [
      '  <title>Paid resources by GapTheMind — Free Range Tutors</title>',
      '',
      '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-KKHTF8PMYV"></script>',
      '  <script>',
      '    window.dataLayer = window.dataLayer || [];',
      '    function gtag(){dataLayer.push(arguments);}',
      '    gtag(\'js\', new Date());',
      '    gtag(\'config\', \'G-KKHTF8PMYV\');',
      '  </script>',
      '',
      '  <meta name="description" content="' + esc(desc) + '" />',
      '  <link rel="canonical" href="' + PAGE_URL + '" />',
      '  <meta property="og:type" content="website" />',
      '  <meta property="og:site_name" content="Free Range Tutors" />',
      '  <meta property="og:url" content="' + PAGE_URL + '" />',
      '  <meta property="og:title" content="Paid resources by GapTheMind — Free Range Tutors" />',
      '  <meta property="og:description" content="' + esc(desc) + '" />',
      '  <meta property="og:image" content="' + SITE + '/images/social/og-image.png" />'
    ]
    : [
      '  <title>DRAFT — Paid resources — Free Range Tutors</title>',
      '  <meta name="robots" content="noindex, nofollow" />',
      '  <meta name="description" content="' + esc(desc) + '" />'
    ];

  const lead = live
    ? 'Most of this site is free. These resources are published under the GapTheMind name and cost a small amount. Each one is described here so you can see what it is before you decide. Checkout and download are handled by Payhip, on its own page.'
    : 'Most of this site is free. This page will list resources published under the GapTheMind name that cost a small amount, so you can see what each one is before you decide. Checkout and download will be handled by Payhip, on its own page.';

  const banner = live ? [] : [
    '      <aside class="pr-draft" role="note">',
    '        <p><strong>Draft preview.</strong> This page is not published, is hidden from search engines and cannot be reached from the rest of the site. Nothing on it can be bought yet, and the product below is an example.</p>',
    '      </aside>'
  ];

  const empty = shown.length ? [] : ['      <p class="pr-empty">No resources are listed yet.</p>'];
  const store = (live && cfg.page.store_url)
    ? ['      <p class="pr-store"><a href="' + esc(cfg.page.store_url) + '" target="_blank" rel="noopener noreferrer">Browse the whole Free Range Tutors store on Payhip <span aria-hidden="true">↗</span></a></p>']
    : [];

  const footNote = 'Built by one teacher. Mostly free to use; a few resources are paid. No login and no ads.' +
    (live ? ' Basic visit statistics are collected with Google Analytics.' : '');

  return [
    '<!DOCTYPE html>',
    '<html lang="en-GB">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    head.join('\n'),
    '',
    '  <link rel="icon" href="/favicon.ico" sizes="any" />',
    '  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png" />',
    '  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />',
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />',
    '  <link rel="stylesheet" href="/dispatch-tokens.css" />',
    '  <link rel="stylesheet" href="/directory.css" />',
    '  <link rel="stylesheet" href="/paid-resources/paid-resources.css" />',
    '</head>',
    '<body class="directory pr">',
    '  <a class="skip-link" href="#main">Skip to the list</a>',
    '',
    '  <div class="wrap">',
    '    <header>',
    '      <div class="masthead">',
    '        <a class="wordmark" href="/">Free Range Tutors</a>',
    '        <nav class="site-nav" aria-label="Site">',
    '          <a href="/#all-resources">Resources</a>',
    '          <a href="/made-by-frt/">Made by FRT</a>',
    '          <a href="/stop-the-slop/">Stop the Slop</a>',
    '          <a href="/paid-resources/" aria-current="page">Paid resources</a>',
    '          <a href="/about">About</a>',
    '        </nav>',
    '      </div>',
    '      <hr class="rule" />',
    '    </header>',
    '',
    '    <main id="main">',
    '      <p class="pr-crumb"><a href="/">&larr; All resources</a></p>',
    '      <h1 class="pr-title">Paid resources</h1>',
    '      <p class="pr-lead">' + esc(lead) + '</p>',
    banner.join('\n'),
    '',
    '      <div class="pr-list">',
    empty.concat(shown.map((p) => renderProduct(p, live))).join('\n'),
    '      </div>',
    store.join('\n'),
    '    </main>',
    '  </div>',
    '',
    '  <footer class="directory-footer">',
    '    <div class="wrap">',
    '      <div class="foot-grid">',
    '        <div>',
    '          <p class="foot-brand">Free Range Tutors</p>',
    '          <p class="foot-note">' + esc(footNote) + '</p>',
    '        </div>',
    '        <nav class="foot-nav" aria-label="Footer">',
    '          <a href="/">All resources</a>',
    '          <a href="/made-by-frt/">Made by FRT</a>',
    '          <a href="/stop-the-slop/">Stop the Slop</a>',
    '          <a href="/paid-resources/">Paid resources</a>',
    '          <a href="/about">About</a>',
    '        </nav>',
    '      </div>',
    '    </div>',
    '  </footer>',
    '</body>',
    '</html>',
    ''
  ].join('\n').replace(/\n{3,}/g, '\n\n');
}

function build(cfg) {
  return [{ file: OUT_FILE, html: render(cfg || load()) }];
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
    console.log('paid-resources page is up to date.');
  } else {
    console.log(stale.length ? 'Wrote: ' + stale.join(', ') : 'Nothing to change.');
  }
}

module.exports = { run, build, render, validate, load, sameContent, DATA_FILE, OUT_FILE };
