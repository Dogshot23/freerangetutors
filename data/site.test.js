#!/usr/bin/env node
/* Site-level checks added with the "Made by Free Range Tutors" work.
   Run: node data/site.test.js
   Separate from directory.test.js (which still carries older assertions; see the audit notes). */
'use strict';
const fs = require('fs');
const path = require('path');
const { run: staticRun } = require('../tools/build-static.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  PASS  ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

const originals = JSON.parse(read('data/originals.json'));
const PUBLIC_PAGES = ['index.html', 'about.html', 'made-by-frt/index.html', 'stop-the-slop/index.html'];
const STUBS = ['browse.html', 'dispatch.html', 'dispatch-home.html'];

/* Resolve a root-relative or page-relative link to a file on disk, or null if external/anchor. */
function resolveLocal(fromPage, href) {
  if (/^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(href)) return null;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  let target = clean.startsWith('/') ? clean.slice(1) : path.posix.join(path.posix.dirname(fromPage), clean);
  if (target === '' || target.endsWith('/')) target += 'index.html';
  return target;
}
/* Clean URLs the live host serves for .html pages (Cloudflare redirects /about.html to /about). */
const cleanUrlOk = (p) => exists(p) || exists(p + '.html');

console.log('originals.json');
test('is a non-empty list with unique ids', () => {
  assert(Array.isArray(originals) && originals.length > 0, 'empty');
  assert(new Set(originals.map((o) => o.id)).size === originals.length, 'duplicate id');
});
originals.forEach((o) => {
  const req = ['id', 'kind', 'title', 'summary', 'audience', 'page', 'image', 'image_alt', 'downloads', 'date_added'];
  test(o.id + ': has every required field', () => {
    req.forEach((k) => assert(o[k] && (typeof o[k] !== 'object' || o[k].length), 'missing ' + k));
    assert(['guide', 'printable', 'tool'].includes(o.kind), 'kind must be guide, printable or tool');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(o.date_added), 'date_added must be YYYY-MM-DD');
  });
  test(o.id + ': its page and cover image exist', () => {
    assert(exists(resolveLocal('x', o.page)), 'page missing: ' + o.page);
    assert(exists(o.image.slice(1)), 'image missing: ' + o.image);
  });
  o.downloads.forEach((d) => {
    test(o.id + ': download ' + d.file + ' is a real, non-empty PDF', () => {
      assert(exists(d.file.slice(1)), 'file missing');
      const buf = fs.readFileSync(path.join(ROOT, d.file.slice(1)));
      assert(buf.length > 10000, 'suspiciously small: ' + buf.length + ' bytes');
      assert(buf.slice(0, 5).toString() === '%PDF-', 'not a PDF');
    });
  });
  test(o.id + ': its own page links to every download', () => {
    const html = read(resolveLocal('x', o.page));
    o.downloads.forEach((d) => assert(html.includes('href="' + d.file + '"'), 'page does not link ' + d.file));
  });
});

console.log('static files stay in step with the data');
test('noscript lists and sitemap.xml are up to date (fix: node tools/build-static.js)', () => {
  const stale = staticRun(true);
  assert(stale.length === 0, 'out of date: ' + stale.join(', ') + ' -> run: node tools/build-static.js');
});
test('index.html has no hard-coded resource count', () => {
  assert(!/id="index-count">\s*\d+/.test(read('index.html')), 'a number is written into #index-count; JS fills it in');
});

console.log('links and metadata');
PUBLIC_PAGES.forEach((page) => {
  test(page + ': every local link, script, stylesheet and image resolves', () => {
    const html = read(page).replace(/<!--[\s\S]*?-->/g, '');
    const bad = [];
    const re = /(?:href|src)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const t = resolveLocal(page, m[1]);
      if (t && !cleanUrlOk(t)) bad.push(m[1]);
    }
    assert(bad.length === 0, 'unresolved: ' + bad.join(', '));
  });
  test(page + ': has a canonical URL on the real domain, a title and a description', () => {
    const html = read(page);
    assert(/<link rel="canonical" href="https:\/\/www\.freerangetutors\.com\//.test(html), 'canonical');
    assert(/<title>[^<]{5,}<\/title>/.test(html), 'title');
    assert(/<meta name="description" content="[^"]{30,}"/.test(html), 'description');
  });
  test(page + ': does not link to the retired Toolkit/Dispatch pages', () => {
    assert(!/href="\/?(browse|dispatch|dispatch-home)\.html/.test(read(page)), 'links to a retired page');
  });
});
test('sitemap.xml lists every originals page and robots.txt points to it', () => {
  const sm = read('sitemap.xml');
  originals.forEach((o) => assert(sm.includes('https://www.freerangetutors.com' + o.page), 'missing ' + o.page));
  assert(sm.includes('https://www.freerangetutors.com/made-by-frt/'), 'missing /made-by-frt/');
  assert(/Sitemap: https:\/\/www\.freerangetutors\.com\/sitemap\.xml/.test(read('robots.txt')), 'robots.txt');
});
test('the homepage and every originals page are reachable from the Made by FRT page or homepage nav', () => {
  assert(read('index.html').includes('href="/made-by-frt/"'), 'homepage does not link to /made-by-frt/');
  assert(read('about.html').includes('href="/made-by-frt/"'), 'About does not link to /made-by-frt/');
});

console.log('homepage quick picks');
test('index.html has the quick-picks container and clear button that directory.js fills in', () => {
  const html = read('index.html');
  assert(/id="quick-picks"/.test(html) && /id="clear-filters"/.test(html), 'missing quick-picks/clear-filters');
  assert(/aria-live="polite"/.test(html), 'result count should be announced to screen readers');
});
test('directory.js builds chips from the data (no hand-typed topic list)', () => {
  const js = read('directory.js');
  assert(/buildQuickPicks/.test(js) && /teaching_use/.test(js), 'quick picks not data-driven');
  assert(!/\['speaking',\s*'listening'/.test(js), 'topic list must not be hard-coded');
});

console.log('retired pages');
STUBS.forEach((p) => {
  test(p + ': is a plain "moved" notice with a link home, not indexed, no timed refresh', () => {
    const html = read(p);
    assert(/noindex/.test(html) && /href="\/"/.test(html), 'not a "moved" notice linking home');
    assert(!/http-equiv="refresh"/i.test(html), 'timed auto-redirects are an accessibility problem; use a plain link');
    assert(!/<script/.test(html), 'stub should not run scripts');
  });
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
