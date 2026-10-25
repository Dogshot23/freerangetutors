#!/usr/bin/env node
/* ============================================================
   FREE RANGE TUTORS — build-catalogue.js

   Builds the unified "Made by Free Range Tutors" catalogue (free and paid) as one static page:

       data/originals.json                       (free items, public)
       tools/payhip-drafts/paid-resources.json   (paid items; has internal notes, never published)
       tools/catalogue.json                      (page order, category, temporary tags)
                       ->   made-by-frt/index.html

   Every card is written into the HTML, so the whole catalogue is indexable and readable without JavaScript;
   made-by-frt/made-by-frt.js only adds the filter buttons. Only the public fields below are ever written out:
   internal_notes, link_verified, status and the other draft fields in the paid data file are not read into the page.

       node tools/build-catalogue.js            # write the page
       node tools/build-catalogue.js --check    # change nothing; exit 1 if stale

   To add an item: add it to its data file (see data/ORIGINALS.md or tools/payhip-drafts/README.md), then add a line to
   tools/catalogue.json at the position it should appear, and run this script. No dependencies.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const paid = require('./build-paid-resources.js');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.freerangetutors.com';
const PAGE_URL = SITE + '/made-by-frt/';
const OUT_FILE = 'made-by-frt/index.html';
const ORDER_FILE = 'tools/catalogue.json';

/* Filter order and labels. A category in tools/catalogue.json must be one of these. */
const CATEGORIES = [
  { id: 'interactive-stories', label: 'Interactive stories' },
  { id: 'partner-speaking', label: 'Partner speaking' },
  { id: 'guides', label: 'Guides' }
];
/* Temporary tags: shown on the card, not a filter. */
const TAGS = { halloween: 'Halloween' };
const KIND_LABELS = { guide: 'Free guide', printable: 'Free printable', tool: 'Browser tool', story: 'Interactive story' };

const TITLE = 'Made by Free Range Tutors — free and paid teaching resources';
const DESCRIPTION = 'Teaching resources made by Free Range Tutors, some free to download and some paid and sold through Payhip.';
const LEAD = 'Resources made by Free Range Tutors, from interactive stories and speaking activities to practical guides. Some are free to download; others are paid, with prices shown on each product. Looking for resources from other creators? Visit the';

const esc = paid.esc;
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

function load() {
  return { originals: readJson('data/originals.json'), paid: paid.load(), order: readJson(ORDER_FILE) };
}

/* Joins the three sources into one ordered list of public card records. Throws on anything inconsistent. */
function combine(src) {
  const fail = (m) => { throw new Error('catalogue: ' + m); };
  paid.validate(src.paid);
  if (src.paid.page.status !== 'live') fail('paid-resources.json page.status must be "live"');
  const free = new Map(src.originals.map((o) => [o.id, o]));
  const sold = new Map(src.paid.products.filter((p) => p.status === 'live').map((p) => [p.id, p]));
  const order = src.order && src.order.items;
  if (!Array.isArray(order) || !order.length) fail(ORDER_FILE + ' needs a non-empty items list');
  const seen = new Set();
  const cards = order.map((o) => {
    if (seen.has(o.id)) fail('duplicate id in ' + ORDER_FILE + ': ' + o.id);
    seen.add(o.id);
    if (!CATEGORIES.some((c) => c.id === o.category)) fail(o.id + ': unknown category "' + o.category + '"');
    (o.tags || []).forEach((t) => { if (!TAGS[t]) fail(o.id + ': unknown tag "' + t + '"'); });
    const inFree = free.has(o.id), inPaid = sold.has(o.id);
    if (inFree && inPaid) fail(o.id + ' is both free and paid');
    if (!inFree && !inPaid) fail(o.id + ' is in ' + ORDER_FILE + ' but in neither data file (or the paid product is not live)');
    return { order: o, free: free.get(o.id), paid: sold.get(o.id) };
  });
  free.forEach((v, id) => { if (!seen.has(id)) fail('free item ' + id + ' is missing from ' + ORDER_FILE); });
  sold.forEach((v, id) => { if (!seen.has(id)) fail('live paid product ' + id + ' is missing from ' + ORDER_FILE); });
  return cards;
}

function badge(access) {
  return '<span class="cat-badge cat-badge-' + access + '">' + (access === 'free' ? 'Free' : 'Paid') + '</span>';
}
function tagsHtml(order) {
  return (order.tags || []).map((t) => '<span class="cat-tag">' + esc(TAGS[t]) + '</span>').join(' ');
}

function renderFree(c) {
  const o = c.free;
  const downloads = o.downloads.map((d) =>
    '            <a class="cat-btn secondary" href="' + esc(d.file) + '" download>Download: ' + esc(d.label) + '<small>' + esc(d.format + ' · ' + d.detail) + '</small></a>').join('\n');
  return [
    '      <article class="cat-item" id="' + esc(o.id) + '" data-access="free" data-category="' + esc(c.order.category) + '">',
    '        <a class="cat-thumb" href="' + esc(o.page) + '"><img src="' + esc(o.image) + '" alt="' + esc(o.image_alt || '') + '" width="180" loading="lazy" /></a>',
    '        <div class="cat-head">',
    '          <p class="cat-kind">' + esc(KIND_LABELS[o.kind] || o.kind) + '</p>',
    '          <h2 class="cat-name"><a href="' + esc(o.page) + '">' + esc(o.title) + '</a></h2>',
    '          <p class="cat-cost">' + badge('free') + ' ' + tagsHtml(c.order) + '</p>',
    '        </div>',
    '        <div class="cat-main">',
    o.tagline ? '          <p class="cat-tagline">' + esc(o.tagline) + '</p>' : '',
    '          <p class="cat-summary">' + esc(o.summary) + '</p>',
    '          <p class="cat-audience">For: ' + esc(o.audience) + '</p>',
    '          <div class="cat-actions">',
    '            <a class="cat-btn" href="' + esc(o.page) + '">Read more <span aria-hidden="true">→</span></a>',
    downloads,
    '          </div>',
    '        </div>',
    '      </article>'
  ].filter(Boolean).join('\n');
}

function renderPaid(c) {
  const p = c.paid;
  const inc = p.facts.filter((f) => f.label === 'Includes');
  const facts = p.facts.filter((f) => f.label !== 'Includes')
    .map((f) => '            <div><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>').join('\n');
  return [
    '      <article class="cat-item' + (c.order.featured ? ' is-featured' : '') + '" id="' + esc(p.id) + '" data-access="paid" data-category="' + esc(c.order.category) + '">',
    '        <img class="cat-thumb" src="' + esc(p.image) + '" width="750" height="750" alt="' + esc(p.image_alt) + '" loading="lazy" />',
    '        <div class="cat-head">',
    '          <p class="cat-kind">' + esc(p.kind) + '</p>',
    '          <h2 class="cat-name">' + esc(p.title) + '</h2>',
    '          <p class="cat-cost">' + badge('paid') + ' <span class="cat-price">' + esc(paid.price(p)) + ' <small>' + esc(p.price.currency) + '</small></span> ' + tagsHtml(c.order) + '</p>',
    '        </div>',
    '        <div class="cat-main">',
    '          <p class="cat-summary">' + esc(p.summary) + '</p>',
    '          <dl class="cat-facts">',
    facts,
    '          </dl>',
    inc.length ? '          <details class="cat-more"><summary>What&rsquo;s included</summary><p>' + esc(inc[0].value) + '</p></details>' : '',
    '          <div class="cat-actions">',
    '            <a class="cat-btn" href="' + esc(p.payhip_url) + '" target="_blank" rel="noopener noreferrer">Buy on Payhip <span aria-hidden="true">↗</span><small>Opens Payhip in a new tab</small></a>',
    '          </div>',
    p.price_note ? '          <p class="cat-note">' + esc(p.price_note) + '</p>' : '',
    '        </div>',
    '      </article>'
  ].filter(Boolean).join('\n');
}

function renderFilters(n) {
  const chip = (attrs, label, pressed) => '<button type="button" class="cat-chip" ' + attrs + ' aria-pressed="' + (pressed ? 'true' : 'false') + '">' + esc(label) + '</button>';
  return [
    '      <div class="cat-filters" id="cat-filters" role="group" aria-label="Filter the resources" hidden>',
    '        <div class="cat-fgroup" role="group" aria-label="Show">',
    '          ' + chip('data-reset', 'All resources', true),
    '          ' + chip('data-group="access" data-value="free"', 'Free', false),
    '          ' + chip('data-group="access" data-value="paid"', 'Paid', false),
    '        </div>',
    '        <div class="cat-fgroup" role="group" aria-label="Category">',
    CATEGORIES.map((c) => '          ' + chip('data-group="category" data-value="' + c.id + '"', c.label, false)).join('\n'),
    '        </div>',
    '      </div>',
    '      <p class="cat-count" id="cat-count" role="status" aria-live="polite" data-total="' + n + '">' + n + ' resources</p>'
  ].join('\n');
}

const NAV = [['/#all-resources', 'Resources'], ['/made-by-frt/', 'Made by FRT'], ['/stop-the-slop/', 'Stop the Slop'], ['/about', 'About']];
const navLinks = (indent, current) => NAV.map(([h, t]) => indent + '<a href="' + h + '"' + (h === current ? ' aria-current="page"' : '') + '>' + t + '</a>').join('\n');

function render(src) {
  const cards = combine(src || load());
  const body = cards.map((c) => (c.free ? renderFree(c) : renderPaid(c))).join('\n');
  return [
    '<!DOCTYPE html>',
    '<html lang="en-GB">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <title>' + esc(TITLE) + '</title>',
    '',
    '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-KKHTF8PMYV"></script>',
    '  <script>',
    '    window.dataLayer = window.dataLayer || [];',
    '    function gtag(){dataLayer.push(arguments);}',
    '    gtag(\'js\', new Date());',
    '    gtag(\'config\', \'G-KKHTF8PMYV\');',
    '  </script>',
    '',
    '  <meta name="description" content="' + esc(DESCRIPTION) + '" />',
    '  <link rel="canonical" href="' + PAGE_URL + '" />',
    '',
    '  <link rel="icon" href="/favicon.ico" sizes="any" />',
    '  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png" />',
    '  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />',
    '',
    '  <meta property="og:type" content="website" />',
    '  <meta property="og:site_name" content="Free Range Tutors" />',
    '  <meta property="og:url" content="' + PAGE_URL + '" />',
    '  <meta property="og:title" content="Made by Free Range Tutors" />',
    '  <meta property="og:description" content="' + esc(DESCRIPTION) + '" />',
    '  <meta property="og:image" content="' + SITE + '/images/social/og-image.png" />',
    '  <meta property="og:image:width" content="1200" />',
    '  <meta property="og:image:height" content="630" />',
    '  <meta name="twitter:card" content="summary_large_image" />',
    '  <meta name="twitter:title" content="Made by Free Range Tutors" />',
    '  <meta name="twitter:description" content="' + esc(DESCRIPTION) + '" />',
    '  <meta name="twitter:image" content="' + SITE + '/images/social/og-image.png" />',
    '',
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />',
    '  <link rel="stylesheet" href="/dispatch-tokens.css" />',
    '  <link rel="stylesheet" href="/directory.css" />',
    '  <link rel="stylesheet" href="/made-by-frt/made-by-frt.css" />',
    '</head>',
    '<body class="directory mbf">',
    '  <a class="skip-link" href="#main">Skip to the list</a>',
    '',
    '  <div class="wrap">',
    '    <header>',
    '      <div class="masthead">',
    '        <a class="wordmark" href="/">Free Range Tutors</a>',
    '        <nav class="site-nav" aria-label="Site">',
    navLinks('          ', '/made-by-frt/'),
    '        </nav>',
    '      </div>',
    '      <hr class="rule" />',
    '    </header>',
    '',
    '    <main id="main">',
    '      <p class="mbf-crumb"><a href="/">&larr; All resources</a></p>',
    '      <h1 class="mbf-title">Made by Free Range Tutors</h1>',
    '      <p class="mbf-lead">' + esc(LEAD) + ' <a href="/">main directory</a>.</p>',
    '',
    renderFilters(cards.length),
    '',
    '      <div id="mbf-list" class="mbf-list">',
    body,
    '      </div>',
    '      <p class="cat-empty" id="cat-empty" hidden>No resources match that combination. <button type="button" class="cat-link" data-reset>Show all resources</button></p>',
    '    </main>',
    '  </div>',
    '',
    '  <footer class="directory-footer">',
    '    <div class="wrap">',
    '      <div class="foot-grid">',
    '        <div>',
    '          <p class="foot-brand">Free Range Tutors</p>',
    '          <p class="foot-note">Built by one teacher. Mostly free to use; a few resources are paid. No login and no ads. Basic visit statistics are collected with Google Analytics.</p>',
    '        </div>',
    '        <nav class="foot-nav" aria-label="Footer">',
    '          <a href="/">All resources</a>',
    navLinks('          ', '').replace(/^\s+<a href="\/#all-resources">Resources<\/a>\n/, ''),
    '        </nav>',
    '      </div>',
    '    </div>',
    '  </footer>',
    '',
    '  <script src="/made-by-frt/made-by-frt.js"></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function build(src) {
  return [{ file: OUT_FILE, html: render(src) }];
}

/* Returns the list of files that were (or, with check=true, would be) out of date. CRLF versus LF does not count. */
function run(check) {
  const stale = [];
  build().forEach(({ file, html }) => {
    const p = path.join(ROOT, file);
    const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (!paid.sameContent(current, html)) {
      stale.push(file);
      if (!check) fs.writeFileSync(p, html);
    }
  });
  return stale;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale;
  try { stale = run(check); } catch (e) { console.error(e.message); process.exit(1); }
  if (check) {
    if (stale.length) { console.error('Out of date: ' + stale.join(', ') + '\nRun: node tools/build-catalogue.js'); process.exit(1); }
    console.log('Catalogue page is up to date.');
  } else {
    console.log(stale.length ? 'Wrote: ' + stale.join(', ') : 'Nothing to change.');
  }
}

module.exports = { run, build, render, combine, load, CATEGORIES, TAGS, OUT_FILE, ORDER_FILE, TITLE, DESCRIPTION, LEAD };
