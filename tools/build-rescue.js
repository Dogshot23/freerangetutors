#!/usr/bin/env node
/* ============================================================
   FREE RANGE TUTORS — build-rescue.js

   Builds the Rescue Cards page as one static HTML file:

       data/rescue-cards.json   (the 33 cards and 6 categories: the authoritative content)
                  ->   rescue/index.html

   Every card is written into the HTML as a native <details> element, so the whole page is readable, searchable
   by crawlers and usable without JavaScript. rescue/rescue.js only adds the search box and the category buttons,
   which show and hide cards. The script never fetches the JSON.

       node tools/build-rescue.js            # write the page
       node tools/build-rescue.js --check    # change nothing; exit 1 if stale

   To change a card: edit data/rescue-cards.json, then run this script. data/rescue.test.js checks the result.
   No dependencies.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.freerangetutors.com';
const PAGE_URL = SITE + '/rescue/';
const OUT_FILE = 'rescue/index.html';
const DATA_FILE = 'data/rescue-cards.json';

const TITLE = 'Rescue Cards — quick fixes for online English lessons | Free Range Tutors';
const DESCRIPTION = 'Quick fixes for online English lessons that are not going to plan: silent students, spare time to fill, tech problems, restless children and awkward conversations with parents.';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cardAnchor = (id) => 'card-' + String(id).replace('.', '-');

function load() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, DATA_FILE), 'utf8'));
}

/* Card text is HTML-escaped, then references such as "card 1.5" or "card 5.1 or 5.2" become links to those cards.
   The words are unchanged; only the numbers are wrapped in links. */
function html(text) {
  const link = (n) => '<a href="#' + cardAnchor(n) + '">' + n + '</a>';
  return esc(text)
    .replace(/\bcard (\d\.\d) or (\d\.\d)\b/g, (m, a, b) => 'card ' + link(a) + ' or ' + link(b))
    .replace(/\bcard (\d\.\d)\b/g, (m, a) => 'card ' + link(a));
}

function renderCard(c) {
  const meta = [['Time', c.time], ['Prep', c.prep], ['Level', c.level], ['Age', c.age]]
    .filter((m) => m[1])
    .map((m) => '<div><dt>' + m[0] + '</dt><dd>' + esc(m[1]) + '</dd></div>')
    .join('');
  const extra = (label, text) => text
    ? '\n            <h3 class="rc-h">' + label + '</h3>\n            <p>' + html(text) + '</p>'
    : '';
  return [
    '        <li class="rc-card" data-cat="' + esc(c.category) + '">',
    '          <details id="' + cardAnchor(c.id) + '">',
    '            <summary><span class="rc-sum-title">' + esc(c.title) + '</span>' +
      '<span class="rc-sum-time"><span class="visually-hidden">Takes about </span>' + esc(c.time_short) + '</span></summary>',
    '            <div class="rc-body">',
    '            <dl class="rc-meta">' + meta + '</dl>',
    '            <h3 class="rc-h">Problem</h3>',
    '            <p>' + html(c.problem) + '</p>',
    '            <h3 class="rc-h">Steps</h3>',
    '            <ol class="rc-steps">' + c.steps.map((s) => '<li>' + html(s) + '</li>').join('') + '</ol>',
    '            <h3 class="rc-h">Say</h3>',
    '            <p class="rc-say">' + html(c.say) + '</p>',
    '            <h3 class="rc-h">Fallback</h3>',
    '            <p>' + html(c.fallback) + '</p>' + extra('Adapt', c.adapt) + extra('Note', c.note),
    '            </div>',
    '          </details>',
    '        </li>'
  ].join('\n');
}

function renderGroup(cat, cards) {
  return [
    '      <section class="rc-group" data-cat="' + esc(cat.id) + '" aria-labelledby="rc-h-' + esc(cat.id) + '">',
    '        <h2 class="rc-group-h" id="rc-h-' + esc(cat.id) + '"><span class="rc-group-n" aria-hidden="true">' + cat.number + '</span>' + esc(cat.label) + '</h2>',
    '        <ul class="rc-list">',
    cards.map(renderCard).join('\n'),
    '        </ul>',
    '      </section>'
  ].join('\n');
}

function render(data) {
  const cards = data.cards;
  const chips = ['<button type="button" class="rc-chip" data-cat="" aria-pressed="true">All</button>']
    .concat(data.categories.map((k) => '<button type="button" class="rc-chip" data-cat="' + esc(k.id) + '" aria-pressed="false">' + esc(k.label) + '</button>'))
    .join('\n          ');
  const groups = data.categories
    .map((k) => renderGroup(k, cards.filter((c) => c.category === k.id)))
    .join('\n\n');
  const countText = cards.length + ' cards in ' + data.categories.length + ' situations';

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
    "    gtag('js', new Date());",
    "    gtag('config', 'G-KKHTF8PMYV');",
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
    '  <meta property="og:title" content="Rescue Cards — quick fixes for online English lessons" />',
    '  <meta property="og:description" content="' + esc(DESCRIPTION) + '" />',
    '  <meta property="og:image" content="' + SITE + '/images/social/og-image.png" />',
    '  <meta property="og:image:width" content="1200" />',
    '  <meta property="og:image:height" content="630" />',
    '  <meta name="twitter:card" content="summary_large_image" />',
    '  <meta name="twitter:title" content="Rescue Cards — quick fixes for online English lessons" />',
    '  <meta name="twitter:description" content="' + esc(DESCRIPTION) + '" />',
    '  <meta name="twitter:image" content="' + SITE + '/images/social/og-image.png" />',
    '',
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />',
    '  <link rel="stylesheet" href="/dispatch-tokens.css" />',
    '  <link rel="stylesheet" href="/directory.css" />',
    '  <link rel="stylesheet" href="/rescue/rescue.css" />',
    '</head>',
    '<body class="directory rc">',
    '  <a class="skip-link" href="#main">Skip to the cards</a>',
    '',
    '  <div class="wrap">',
    '    <header>',
    '      <div class="masthead">',
    '        <a class="wordmark" href="/">Free Range Tutors</a>',
    '        <nav class="site-nav" aria-label="Site">',
    '          <a href="/#all-resources">Resources</a>',
    '          <a href="/rescue/" aria-current="page">Rescue Cards</a>',
    '          <a href="/made-by-frt/">Made by FRT</a>',
    '          <a href="/stop-the-slop/">Stop the Slop</a>',
    '          <a href="/about">About</a>',
    '        </nav>',
    '      </div>',
    '      <hr class="rule" />',
    '    </header>',
    '',
    '    <main id="main">',
    '      <h1 class="rc-title">Rescue Cards</h1>',
    '      <p class="rc-lead">' + cards.length + ' quick fixes for lessons that are not going to plan, written for independent online tutors, mostly teaching one-to-one. Find the situation, open the card and try the steps.</p>',
    '      <p class="rc-note">These are starting points, not rules. Adapt each one to your student and your platform.</p>',
    '',
    '      <div class="rc-controls" id="rc-controls" hidden>',
    '        <div class="rc-search" role="search">',
    '          <label class="visually-hidden" for="rc-search">Search the cards</label>',
    '          <input type="search" id="rc-search" placeholder="Search, e.g. silent, audio, homework" autocomplete="off" />',
    '        </div>',
    '        <div class="rc-chips" id="rc-chips" role="group" aria-label="Filter by situation">',
    '          ' + chips,
    '        </div>',
    '      </div>',
    '',
    '      <p class="rc-count" id="rc-count" role="status">' + countText + '</p>',
    '      <p class="rc-empty" id="rc-empty" hidden>No card matches that. <button type="button" class="rc-link" id="rc-reset">Show all cards</button></p>',
    '',
    '      <div id="rc-groups">',
    groups,
    '      </div>',
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
    '          <a href="/made-by-frt/">Made by FRT</a>',
    '          <a href="/stop-the-slop/">Stop the Slop</a>',
    '          <a href="/about">About</a>',
    '        </nav>',
    '      </div>',
    '    </div>',
    '  </footer>',
    '',
    '  <script src="/rescue/rescue.js"></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function build(data) { return render(data || load()); }

/* Returns the list of files that were (or, with check=true, would be) out of date. CRLF versus LF does not count. */
function run(check) {
  const html = build();
  const p = path.join(ROOT, OUT_FILE);
  const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const lf = (s) => s.replace(/\r\n/g, '\n');
  if (lf(html) === lf(current)) return [];
  if (!check) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html); }
  return [OUT_FILE];
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale;
  try { stale = run(check); } catch (e) { console.error(e.message); process.exit(1); }
  if (check) {
    if (stale.length) { console.error('Out of date: ' + stale.join(', ') + '\nRun: node tools/build-rescue.js'); process.exit(1); }
    console.log('Rescue Cards page is up to date.');
  } else {
    console.log(stale.length ? 'Wrote: ' + stale.join(', ') : 'Nothing to change.');
  }
}

module.exports = { run, build, render, load, html, cardAnchor, OUT_FILE, DATA_FILE, TITLE, DESCRIPTION };
