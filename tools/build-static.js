#!/usr/bin/env node
/* ============================================================
   FREE RANGE TUTORS — build-static.js

   Keeps the parts of the site that must work WITHOUT JavaScript
   (search-engine crawlers, link previews, text-only readers) in
   step with the data files:

     - the <noscript> resource list in index.html
     - (the Made by FRT catalogue, made-by-frt/index.html, is a full static page of its own: tools/build-catalogue.js)
     - sitemap.xml

   Run it after adding or changing a resource:

       node tools/build-static.js          # rewrite the files
       node tools/build-static.js --check  # change nothing; exit 1 if stale

   data/site.test.js runs the --check logic, so a forgotten run
   shows up as a failing test with this command in the message.
   No dependencies. See data/SCHEMA.md and data/ORIGINALS.md.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.freerangetutors.com';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function build() {
  const manifest = JSON.parse(read('data/manifest.json'));
  const resources = manifest.map((id) => JSON.parse(read('data/resources/' + id + '.json')));
  const originals = JSON.parse(read('data/originals.json'));

  const resourceList = resources
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => '      <li><a href="' + esc(r.url) + '" rel="noopener noreferrer">' + esc(r.name) + '</a>' + (r.source_category === 'commercial' && r.creator ? ' (' + esc(r.creator) + ')' : '') + ' &mdash; ' + esc(r.description_short) + '</li>')
    .join('\n');
  const indexBlock =
    '    <noscript>\n' +
    '      <p>This list is normally searchable and filterable, which needs JavaScript. Without it, here are all ' + resources.length + ' resources:</p>\n' +
    '      <ul>\n' + resourceList + '\n      </ul>\n' +
    '    </noscript>';

  const pages = ['/', '/made-by-frt/', '/about'].concat(originals.map((o) => o.page));
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map((p) => '  <url><loc>' + SITE + p + '</loc></url>').join('\n') + '\n</urlset>\n';

  return [
    { file: 'index.html', marker: 'static:resources', block: indexBlock },
    { file: 'sitemap.xml', whole: sitemap }
  ];
}

function apply(entry, current) {
  if (entry.whole !== undefined) return entry.whole;
  const start = '<!-- ' + entry.marker + ':start -->';
  const end = '<!-- ' + entry.marker + ':end -->';
  const a = current.indexOf(start), b = current.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(entry.file + ' is missing the ' + start + ' / ' + end + ' markers');
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const block = entry.block.replace(/\n/g, eol);
  return current.slice(0, a + start.length) + eol + block + eol + '    ' + current.slice(b);
}

function run(check) {
  const stale = [];
  build().forEach((entry) => {
    const p = path.join(ROOT, entry.file);
    const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    const next = apply(entry, current);
    // Line endings differ between checkouts (Windows autocrlf); only content matters.
    const lf = (s) => s.replace(/\r\n/g, '\n');
    if (lf(next) !== lf(current)) {
      stale.push(entry.file);
      if (!check) fs.writeFileSync(p, next);
    }
  });
  return stale;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const changed = run(check);
  if (check) {
    if (changed.length) { console.error('Out of date: ' + changed.join(', ') + '\nRun: node tools/build-static.js'); process.exit(1); }
    console.log('Static files are up to date.');
  } else {
    console.log(changed.length ? 'Updated: ' + changed.join(', ') : 'Nothing to update.');
  }
}
module.exports = { run };
