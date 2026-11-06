#!/usr/bin/env node
/* Checks for the unified Made by FRT catalogue (/made-by-frt/): free and paid items on one page.
   Run: node data/catalogue.test.js

   What this file protects, in plain terms:
     - all 15 items appear exactly once, in the approved order, with their text, prices, images and links unchanged
     - every card says Free or Paid, and paid cards show their price
     - the filters (Free / Paid / category) combine correctly and "All resources" resets them; without JavaScript every card shows
     - no internal note or draft field reaches the public page
     - /paid-resources/ redirects (root _redirects, 301) and the old card ids still exist for #fragment links
     - the sitemap, navigation and homepage promo are consistent, and the main directory is untouched
   The older checks on prices, Payhip links and publishing rules are in data/paid-resources.test.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const cat = require('../tools/build-catalogue.js');
const paid = require('../tools/build-paid-resources.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  PASS  ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), (m || 'differs') + '\n        got:      ' + JSON.stringify(a) + '\n        expected: ' + JSON.stringify(b));
const esc = paid.esc;
const clone = (o) => JSON.parse(JSON.stringify(o));

const html = read('made-by-frt/index.html');
const originals = JSON.parse(read('data/originals.json'));
const paidData = paid.load();
const order = JSON.parse(read('tools/catalogue.json')).items;
const FREE_IDS = originals.map((o) => o.id);
const PAID_IDS = paidData.products.filter((p) => p.status === 'live').map((p) => p.id);

/* The approved order, written out here on purpose so a change to tools/catalogue.json cannot agree with itself. */
const TOP_THREE = ['sold-as-seen', 'stop-the-slop', 'the-school-trip-that-should-have-been-cancelled'];
const HALLOWEEN = ['the-sixth-ghost', 'the-947-scream', 'grandpas-teeth', 'mr-bones-quits', 'too-much-money'];
const CHRISTMAS = 'the-christmas-dinner-that-keeps-getting-bigger';
const GUIDE = 'one-resource-start-to-finish';
const ALL_IDS = [
  'sold-as-seen', 'stop-the-slop', 'the-school-trip-that-should-have-been-cancelled', CHRISTMAS, GUIDE,
  'the-sixth-ghost', 'the-947-scream', 'grandpas-teeth', 'mr-bones-quits', 'too-much-money',
  'the-exploding-pudding', 'the-clocks-that-lie', 'the-escaped-specimen', 'the-too-helpful-robot', 'the-dog-translator',
  'the-queue-jumper', 'a-day-at-the-park'
];
const CATEGORY = {
  'sold-as-seen': 'interactive-stories', 'the-school-trip-that-should-have-been-cancelled': 'interactive-stories', 'stop-the-slop': 'guides',
  [CHRISTMAS]: 'interactive-stories', [GUIDE]: 'guides'
};
const categoryOf = (id) => CATEGORY[id] || 'partner-speaking';

/* The cards, split out of the generated page. */
const cards = {};
const cardOrder = [];
(html.match(/<article class="cat-item[^"]*"[^>]*>[\s\S]*?<\/article>/g) || []).forEach((c) => {
  const id = c.match(/ id="([^"]+)"/)[1];
  cardOrder.push(id);
  cards[id] = c;
});

console.log('the 17 items: each once, in the approved order');
test('exactly 17 cards: the 2 free items and the 15 live paid products, each once', () => {
  eq(cardOrder.slice().sort(), ALL_IDS.slice().sort(), 'card ids');
  assert(new Set(cardOrder).size === 17, 'duplicate card');
  eq(FREE_IDS.slice().sort(), ['stop-the-slop', 'the-school-trip-that-should-have-been-cancelled'], 'free ids in originals.json');
  eq(PAID_IDS.length, 15, 'live paid products');
});
test('order: SOLD AS SEEN, Stop the Slop, The School Trip, then The Christmas Dinner, then One Resource Start to Finish, then the Halloween group, then the other paid products in their existing order', () => {
  eq(cardOrder, ALL_IDS, 'page order');
  eq(cardOrder.slice(0, 3), TOP_THREE, 'top three');
  eq(cardOrder[3], CHRISTMAS, 'The Christmas Dinner follows the top three');
  eq(cardOrder[4], GUIDE, 'the guide follows The Christmas Dinner');
  eq(cardOrder.slice(5, 10), HALLOWEEN, 'Halloween group follows the guide');
  eq(order.map((o) => o.id), ALL_IDS, 'tools/catalogue.json order');
});
test('only SOLD AS SEEN is featured; the five Halloween products (only) carry the temporary Halloween tag and The Christmas Dinner (only) the Christmas tag', () => {
  assert(/<article class="cat-item is-featured" id="sold-as-seen"/.test(html), 'SOLD AS SEEN not featured');
  assert((html.match(/is-featured/g) || []).length === 1, 'more than one featured card');
  ALL_IDS.forEach((id) => assert(/cat-tag">Halloween</.test(cards[id]) === HALLOWEEN.includes(id), id + ': Halloween tag'));
  ALL_IDS.forEach((id) => assert(/cat-tag">Christmas</.test(cards[id]) === (id === CHRISTMAS), id + ': Christmas tag'));
});
test('each card has the category the owner approved', () => {
  ALL_IDS.forEach((id) => assert(cards[id].includes('data-category="' + categoryOf(id) + '"'), id + ': category'));
  assert(!/data-category="halloween"/.test(html), 'Halloween must not be a category');
});

console.log('\nfree or paid: unmistakable on every card');
test('every card has exactly one Free or Paid label; free = the 2 originals, paid = the 15 products with a visible price', () => {
  ALL_IDS.forEach((id) => {
    const free = FREE_IDS.includes(id);
    const c = cards[id];
    assert(c.includes('data-access="' + (free ? 'free' : 'paid') + '"'), id + ': data-access');
    eq((c.match(/class="cat-badge /g) || []).length, 1, id + ': badge count');
    assert(free ? /<span class="cat-badge cat-badge-free">Free<\/span>/.test(c) : /<span class="cat-badge cat-badge-paid">Paid<\/span>/.test(c), id + ': label');
    if (!free) assert(/<span class="cat-price">\$\d+\.\d\d <small>USD<\/small><\/span>/.test(c), id + ': price not shown');
    else assert(!/cat-price|\$\d/.test(c), id + ': a free card shows a price');
  });
});

console.log('\nnothing changed: text, prices, images and links come straight from the data files');
test('free cards keep title, summary, audience, tagline, image, alt text, page link and every download (file, label, format, detail)', () => {
  originals.forEach((o) => {
    const c = cards[o.id];
    [o.title, o.summary, 'For: ' + o.audience, o.image_alt].forEach((t) => assert(c.includes(esc(t)), o.id + ': missing "' + t.slice(0, 40) + '"'));
    if (o.tagline) assert(c.includes(esc(o.tagline)), o.id + ': tagline');
    assert(c.includes('src="' + o.image + '"') && c.includes('<a href="' + o.page + '">' + esc(o.title) + '</a>'), o.id + ': image/page link');
    assert(c.includes('class="cat-btn" href="' + o.page + '">Read more'), o.id + ': Read more link');
    o.downloads.forEach((d) => {
      assert(c.includes('href="' + d.file + '" download>Download: ' + esc(d.label)) && c.includes('<small>' + esc(d.format + ' · ' + d.detail) + '</small>'), o.id + ': download ' + d.file);
      assert(exists(d.file.slice(1)), d.file + ' is missing on disk');
    });
    assert(exists(o.image.slice(1)) && exists(o.page.slice(1) + 'index.html'), o.id + ': image or page file missing');
  });
});
test('paid cards keep title, kind, summary, every fact, price, VAT note, image, alt text and the Payhip link with its new-tab attributes', () => {
  paidData.products.filter((p) => p.status === 'live').forEach((p) => {
    const c = cards[p.id];
    [p.title, p.kind, p.summary, p.image_alt, p.price_note].forEach((t) => assert(c.includes(esc(t)), p.id + ': missing "' + String(t).slice(0, 40) + '"'));
    p.facts.forEach((f) => assert(c.includes(esc(f.value)) && (f.label === 'Includes' || c.includes('<dt>' + esc(f.label) + '</dt>')), p.id + ': fact ' + f.label));
    assert(c.includes('<span class="cat-price">' + paid.price(p) + ' <small>' + p.price.currency + '</small></span>'), p.id + ': price');
    assert(c.includes('src="' + p.image + '"') && exists(p.image.slice(1)), p.id + ': image');
    assert(c.includes('href="' + p.payhip_url + '" target="_blank" rel="noopener noreferrer">Buy on Payhip'), p.id + ': Payhip link');
  });
  assert(cards['sold-as-seen'].includes('$4.99 <small>USD'), 'SOLD AS SEEN price');
  assert(cards[CHRISTMAS].includes('$4.99 <small>USD'), 'The Christmas Dinner price');
  assert(cards[GUIDE].includes('$4.99 <small>USD'), 'the guide price');
  assert(PAID_IDS.filter((id) => id !== 'sold-as-seen' && id !== CHRISTMAS && id !== GUIDE).every((id) => cards[id].includes('$1.99 <small>USD')), 'a paid price is not $1.99');
});
test('the Includes fact is collapsible, every other fact is visible without opening anything', () => {
  PAID_IDS.forEach((id) => {
    const c = cards[id];
    const dl = (c.match(/<dl class="cat-facts">[\s\S]*?<\/dl>/) || [''])[0];
    assert(dl && !/<dt>Includes<\/dt>/.test(dl), id + ': Includes still in the visible facts');
    assert(/<details class="cat-more"><summary>What&rsquo;s included<\/summary><p>/.test(c), id + ': no details block');
  });
});
test('the card ids of the old /paid-resources/ page still exist, so #fragment links keep working', () => {
  PAID_IDS.forEach((id) => assert(html.includes(' id="' + id + '"'), 'missing #' + id));
});

console.log('\nprivacy: internal and draft fields never reach public output');
test('no internal note, verification date, draft status or private field is in the page or the public data files', () => {
  const notes = paidData.products.map((p) => p.internal_notes).filter(Boolean);
  assert(notes.length >= 13, 'expected internal notes in the private data file');
  const publicText = [html, read('made-by-frt/made-by-frt.js'), read('made-by-frt/made-by-frt.css'), read('data/originals.json'), read('paid-resources/index.html'), read('_redirects')].join('\n');
  notes.forEach((n) => assert(!publicText.includes(n.slice(0, 40)), 'an internal note leaked: ' + n.slice(0, 40)));
  assert(!/internal_notes|link_verified|store_url|"status"\s*:/.test(publicText), 'a private field name appears in public output');
  paidData.products.forEach((p) => assert(!publicText.includes(p.link_verified + '"'), 'a verification date leaked'));
});
test('the combined source lives under tools/ (excluded from the website), not in data/', () => {
  assert(exists('tools/catalogue.json') && !exists('data/catalogue.json'), 'catalogue.json location');
  assert(read('.assetsignore').split(/\r?\n/).map((l) => l.trim()).includes('tools'), 'tools is no longer excluded from the website');
  assert(!/internal_notes|payhip\.com/.test(read('data/originals.json')), 'originals.json gained private or paid data');
});

console.log('\nbuilder rules (in memory; nothing is written)');
test('the builder refuses: an item missing from the order file, an unknown category or tag, a duplicate, an unknown id', () => {
  const t = (mut, re) => {
    const src = cat.load(); mut(src);
    let err = null; try { cat.render(src); } catch (e) { err = e; }
    assert(err && re.test(err.message), 'expected ' + re + ', got ' + (err && err.message));
  };
  t((s) => { s.order.items.pop(); }, /missing from/);
  t((s) => { s.order.items[0].category = 'halloween'; }, /unknown category/);
  t((s) => { s.order.items[3].tags = ['sale']; }, /unknown tag/);
  t((s) => { s.order.items.push(clone(s.order.items[0])); }, /duplicate id/);
  t((s) => { s.order.items.push({ id: 'nope', category: 'guides' }); }, /neither data file/);
});

console.log('\nfilters: Free, Paid, categories, combinations, reset');
/* A very small DOM, enough to run made-by-frt/made-by-frt.js against the real generated markup. */
function runFilters() {
  const mk = (attrs) => {
    const a = Object.assign({}, attrs), handlers = {};
    return {
      hidden: false, textContent: '', attrs: a, handlers,
      getAttribute: (k) => (k in a ? a[k] : null),
      setAttribute: (k, v) => { a[k] = String(v); },
      addEventListener: (ev, fn) => { handlers[ev] = fn; },
      focus() { this.focused = true; }
    };
  };
  const attrsOf = (tag) => { const o = {}; tag.replace(/([\w-]+)="([^"]*)"/g, (m, k, v) => { o[k] = v; return m; }); if (/\sdata-reset[\s>]/.test(tag)) o['data-reset'] = ''; return o; };
  const cardEls = (html.match(/<article class="cat-item[^"]*"[^>]*>/g) || []).map((t) => mk(attrsOf(t)));
  const chipEls = (html.match(/<button type="button" class="cat-chip"[^>]*>/g) || []).map((t) => mk(attrsOf(t)));
  const emptyReset = mk({ 'data-reset': '' });
  const list = { querySelectorAll: () => cardEls };
  const filters = { hidden: true, querySelectorAll: () => chipEls, querySelector: () => chipEls.find((c) => 'data-reset' in c.attrs) };
  const count = mk({}), empty = Object.assign(mk({}), { hidden: true, querySelectorAll: () => [emptyReset] });
  const byId = { 'cat-filters': filters, 'mbf-list': list, 'cat-count': count, 'cat-empty': empty };
  new Function('document', read('made-by-frt/made-by-frt.js'))({ getElementById: (id) => byId[id] });
  const click = (label) => chipEls.find((c) => c.attrs['data-reset'] !== undefined ? label === 'All resources' : c.attrs['data-value'] === label).handlers.click();
  const visible = () => cardEls.filter((c) => !c.hidden).map((c) => c.attrs.id);
  const pressed = () => chipEls.filter((c) => c.attrs['aria-pressed'] === 'true').map((c) => c.attrs['data-value'] || 'all');
  return { click, visible, pressed, count, empty, filters, emptyReset, chipEls, cardEls };
}
const ids = (pred) => ALL_IDS.filter(pred);
const isFree = (id) => FREE_IDS.includes(id);
test('without JavaScript every card is in the HTML, none is hidden, and the filter bar is hidden until the script shows it', () => {
  assert(!/<article class="cat-item[^"]*"[^>]*\shidden/.test(html), 'a card is hidden in the HTML');
  assert(/<div class="cat-filters" id="cat-filters"[^>]*hidden>/.test(html), 'filter bar must start hidden');
  assert(/>17 resources<\/p>/.test(html), 'static count');
  assert(!/<noscript>/.test(html), 'no noscript copy is needed: the cards are the page');
});
test('on load: the filter bar appears, all 17 show, "All resources" is the only pressed button, the count reads "17 resources"', () => {
  const f = runFilters();
  assert(f.filters.hidden === false, 'bar not shown');
  eq(f.visible(), ALL_IDS, 'visible');
  eq(f.pressed(), ['all']);
  assert(f.count.textContent === '17 resources', f.count.textContent);
});
test('Free shows exactly the 2 free items; Paid shows exactly the 15 paid products', () => {
  let f = runFilters(); f.click('free');
  eq(f.visible(), ids(isFree)); assert(f.count.textContent === 'Showing 2 of 17 resources', f.count.textContent); eq(f.pressed(), ['free']);
  f = runFilters(); f.click('paid');
  eq(f.visible(), ids((id) => !isFree(id))); assert(f.count.textContent === 'Showing 15 of 17 resources', f.count.textContent);
});
test('each category shows the right items', () => {
  [['interactive-stories', 3], ['partner-speaking', 12], ['guides', 2]].forEach(([c, n]) => {
    const f = runFilters(); f.click(c);
    eq(f.visible(), ids((id) => categoryOf(id) === c), c); assert(f.visible().length === n, c + ' count');
  });
});
test('combinations: Paid then Partner speaking keeps both; Free + Interactive stories gives the School Trip only; Paid + Interactive stories gives SOLD AS SEEN and The Christmas Dinner; Free + Partner speaking is empty with a message', () => {
  let f = runFilters(); f.click('paid'); f.click('partner-speaking');
  eq(f.visible(), ids((id) => !isFree(id) && categoryOf(id) === 'partner-speaking')); eq(f.pressed().sort(), ['paid', 'partner-speaking']);
  assert(f.visible().length === 12 && f.count.textContent === 'Showing 12 of 17 resources', 'count ' + f.count.textContent);
  f = runFilters(); f.click('partner-speaking'); f.click('paid');   /* the other way round gives the same answer */
  eq(f.visible().length, 12);
  f = runFilters(); f.click('free'); f.click('interactive-stories');
  eq(f.visible(), ['the-school-trip-that-should-have-been-cancelled']);
  f = runFilters(); f.click('paid'); f.click('interactive-stories');
  eq(f.visible(), ['sold-as-seen', CHRISTMAS]);
  f = runFilters(); f.click('paid'); f.click('guides');
  eq(f.visible(), [GUIDE]);
  f = runFilters(); f.click('free'); f.click('partner-speaking');
  eq(f.visible(), []); assert(f.empty.hidden === false && f.count.textContent === 'Showing 0 of 17 resources', 'empty state');
});
test('pressing an active filter turns it off; switching Free to Paid replaces it (they do not both apply)', () => {
  let f = runFilters(); f.click('free'); f.click('free');
  eq(f.visible(), ALL_IDS); eq(f.pressed(), ['all']);
  f = runFilters(); f.click('free'); f.click('paid');
  eq(f.visible(), ids((id) => !isFree(id)));
});
test('"All resources" resets both groups, and so does the reset link in the empty message (which then returns focus to All resources)', () => {
  let f = runFilters(); f.click('free'); f.click('partner-speaking'); f.click('All resources');
  eq(f.visible(), ALL_IDS); eq(f.pressed(), ['all']); assert(f.empty.hidden === true && f.count.textContent === '17 resources', 'not reset');
  f = runFilters(); f.click('free'); f.click('partner-speaking');
  f.emptyReset.handlers.click();
  eq(f.visible(), ALL_IDS); assert(f.chipEls.find((c) => 'data-reset' in c.attrs).focused === true, 'focus not returned');
});
test('filter buttons are real <button type="button"> elements with aria-pressed, in labelled groups, with the six approved labels', () => {
  const labels = (html.match(/<button type="button" class="cat-chip"[^>]*>[^<]+<\/button>/g) || []).map((b) => b.replace(/<[^>]+>/g, ''));
  eq(labels, ['All resources', 'Free', 'Paid', 'Interactive stories', 'Partner speaking', 'Guides']);
  assert((html.match(/<button type="button" class="cat-chip"[^>]*aria-pressed="(true|false)"/g) || []).length === 6, 'aria-pressed on every button');
  assert(/role="group" aria-label="Show"/.test(html) && /role="group" aria-label="Category"/.test(html), 'group labels');
  assert(/id="cat-count" role="status" aria-live="polite"/.test(html), 'result count is announced');
  assert(!/id="[^"]*search/i.test(html), 'no search box: not needed for 15 items');
  assert(/\.cat-chip \{[^}]*min-height: 44px/.test(read('made-by-frt/made-by-frt.css')), 'tap target below 44px');
});

console.log('\nredirect from /paid-resources/');
/* Cloudflare Workers static assets: a root _redirects file, one rule per line "from to [status]", # comments, redirects evaluated first. */
const rules = read('_redirects').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const resolveRedirect = (url) => { const r = rules.find((x) => x[0] === url); return r ? { to: r[1], status: Number(r[2]) } : null; };
test('_redirects has only well-formed rules, all permanent (301), all to /made-by-frt/', () => {
  assert(rules.length >= 1, 'no rules');
  rules.forEach((r) => { assert(r.length === 3 && r[0].startsWith('/') && r[1] === '/made-by-frt/' && r[2] === '301', 'bad rule: ' + r.join(' ')); });
  assert(!rules.some((r) => /^\/(paid-resources\/images|made-by-frt|index)/.test(r[0]) || r[0].includes('*')), 'a rule is broader than the retired page');
});
test('/paid-resources/, /paid-resources and /paid-resources/index.html all redirect permanently to /made-by-frt/; images and the catalogue do not', () => {
  ['/paid-resources/', '/paid-resources', '/paid-resources/index.html'].forEach((u) => eq(resolveRedirect(u), { to: '/made-by-frt/', status: 301 }, u));
  ['/made-by-frt/', '/paid-resources/images/sold-as-seen.png', '/', '/about'].forEach((u) => assert(resolveRedirect(u) === null, u + ' must not redirect'));
  assert(exists('paid-resources/images/sold-as-seen.png'), 'the cover image URLs must keep working');
});
test('the redirect file is published, not excluded, and the fallback notice is noindex with the catalogue as canonical', () => {
  const lines = read('.assetsignore').split(/\r?\n/).map((l) => l.trim());
  assert(!lines.includes('_redirects') && !lines.includes('/_redirects'), '.assetsignore excludes _redirects');
  const n = read('paid-resources/index.html');
  assert(/<meta name="robots" content="noindex" \/>/.test(n) && /<link rel="canonical" href="https:\/\/www\.freerangetutors\.com\/made-by-frt\/" \/>/.test(n), 'notice metadata');
  assert(/href="\/made-by-frt\/"/.test(n) && !/http-equiv="refresh"|<script|gtag/i.test(n), 'notice must link to the catalogue and use no timed refresh, script or analytics');
});

console.log('\nnavigation, sitemap, homepage wording');
test('the sitemap lists the catalogue and the free item pages, and not /paid-resources/', () => {
  const sm = read('sitemap.xml');
  ['/', '/made-by-frt/', '/about', '/stop-the-slop/', '/resources/the-school-trip-that-should-have-been-cancelled/'].forEach((u) => assert(sm.includes('<loc>https://www.freerangetutors.com' + u + '</loc>'), 'missing ' + u));
  assert(!sm.includes('paid-resources'), 'retired URL listed');
});
test('the homepage promo says free and paid; the old "Everything made by" wording is gone; the directory intro is otherwise unchanged', () => {
  const idx = read('index.html');
  assert(idx.includes('<span class="intro-link-d">Free and paid resources made by Free Range Tutors &rarr;</span>'), 'new promo wording');
  assert(!idx.includes('Everything made by Free Range Tutors'), 'old wording');
  assert(idx.includes('<span class="intro-link-t">Made by Free Range Tutors</span>') && idx.includes('<span class="tag-new">New, free</span>'), 'neighbouring promo changed');
});
test('the catalogue title, lead and promo say what the page is, without claims', () => {
  assert(/free and paid teaching resources/.test(cat.TITLE), 'title');
  assert(/^Resources made by Free Range Tutors, from interactive stories and speaking activities to practical guides\. Some are free to download; others are paid, with prices shown on each product\. Looking for resources from other creators\? Visit the$/.test(cat.LEAD), 'lead');
  assert(!/best|amazing|guarantee|proven|#1|bestsell/i.test(cat.TITLE + cat.DESCRIPTION + cat.LEAD), 'promotional claim');
  assert(html.includes('<a href="/">main directory</a>'), 'the main directory link');
});

console.log('\nthe main directory is untouched');
function git(args) { return execFileSync('git', ['--no-optional-locks'].concat(args), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
/* The ONE approved change to existing directory records (homepage "Website of the Day", see data/SCHEMA.md). tools/approved-record-additions.js
   (shared with data/paid-resources.test.js) pins it exactly: `image_tags` on the 20 named curated_external records with exactly their approved
   values, and the approved wording of teacher_note on the 9 named records that had none. Every other field of every existing record, nested
   values, extra or missing fields, key order and record identity must still equal the last commit. directory.js, the CSS, resources.js and
   originals.json stay byte-identical. */
const approved = require(path.join(ROOT, 'tools', 'approved-record-additions.js'));
function recordProblem(rel, committedText) {
  if (!fs.existsSync(path.join(ROOT, rel))) return 'the record was deleted or moved';
  let now; try { now = JSON.parse(read(rel)); } catch (e) { return 'the record is not valid JSON'; }
  const was = JSON.parse(committedText);
  if (!approved.hasApprovedAdditions(was.id)) return 'changed (this record has no approved change, so any change at all, even formatting, is refused)';
  return approved.approvedRecordProblem(was, now);
}
test('directory.js, directory.css, originals.json and resources.js are identical to the last commit, and every existing directory record is too apart from the approved image_tags and teacher_note additions (new records are untracked, so they cannot hide a change to an old one)', () => {
  let out, recs;
  try {
    out = git(['diff', '--name-only', 'HEAD', '--', 'directory.js', 'directory.css', 'dispatch-tokens.css', 'data/originals.json', 'data/resources.js']).trim();
    recs = git(['diff', '--name-only', 'HEAD', '--', 'data/resources']).split('\n').map((s) => s.trim()).filter(Boolean);
  }
  catch (e) { console.log('        (skipped: git is not available here)'); return; }
  assert(out === '', 'changed: ' + out);
  const bad = recs.map((f) => [f, /^data\/resources\/[a-z0-9-]+\.json$/.test(f) ? recordProblem(f, git(['show', 'HEAD:' + f])) : 'not a record file']).filter((x) => x[1]);
  assert(bad.length === 0, 'existing records changed beyond the approved additions:\n        ' + bad.map((x) => x[0] + ': ' + x[1]).join('\n        '));
});
test('the approved additions are present exactly as approved: the 20 image_tags sets and the 9 teacher notes are pinned, whatever git says', () => {
  const ids = Object.keys(approved.APPROVED_IMAGE_TAGS);
  assert(ids.length === 20, 'expected 20 approved image_tags records');
  ids.forEach((id) => {
    const r = JSON.parse(read('data/resources/' + id + '.json'));
    assert(r.source_category === 'curated_external', id + ': image_tags approved only for curated_external');
    eq(r.image_tags, approved.APPROVED_IMAGE_TAGS[id], id + ': image_tags differ from the approved values');
    assert(approved.imageTagsProblem(r.image_tags) === null, id + ': ' + approved.imageTagsProblem(r.image_tags));
  });
  Object.keys(approved.APPROVED_TEACHER_NOTES).forEach((id) => {
    const r = JSON.parse(read('data/resources/' + id + '.json'));
    assert(r.teacher_note === approved.APPROVED_TEACHER_NOTES[id], id + ': teacher_note differs from the approved wording');
  });
});
test('no other record that existed when the additions were approved carries image_tags (paid products, FRT originals and the rest are out of scope)', () => {
  let existing;
  try { existing = git(['ls-tree', '--name-only', approved.APPROVAL_BASE_COMMIT, 'data/resources/']).split('\n').map((s) => s.trim()).filter(Boolean); }
  catch (e) { console.log('        (skipped: git or the approval commit is not available here)'); return; }
  const strays = existing.filter((f) => { const id = path.basename(f, '.json'); return !Object.prototype.hasOwnProperty.call(approved.APPROVED_IMAGE_TAGS, id) && exists(f) && 'image_tags' in JSON.parse(read(f)); });
  assert(strays.length === 0, 'image_tags on: ' + strays.join(', '));
});
console.log('\nthe guard itself: crafted cases that it must accept or refuse');
{
  let ok = true; try { git(['cat-file', '-e', approved.APPROVAL_BASE_COMMIT + '^{commit}']); } catch (e) { ok = false; }
  const HEAD_REC = (id) => JSON.parse(git(['show', approved.APPROVAL_BASE_COMMIT + ':data/resources/' + id + '.json']));
  const withApproved = (id) => { const r = HEAD_REC(id), o = {}; Object.keys(r).forEach((k) => { if (k === 'image_tags') return; o[k] = r[k]; if (k === 'teaching_use' && approved.APPROVED_IMAGE_TAGS[id]) o.image_tags = approved.APPROVED_IMAGE_TAGS[id]; }); if (approved.APPROVED_TEACHER_NOTES[id]) o.teacher_note = approved.APPROVED_TEACHER_NOTES[id]; return o; };
  const cases = (label, fn) => test(label, () => { if (!ok) { console.log('        (skipped: git or the approval commit is not available here)'); return; } fn(); });
  const refuses = (id, mutate, why) => { const was = HEAD_REC(id), now = withApproved(id); const m = mutate(now); assert(approved.approvedRecordProblem(was, m || now), 'NOT refused: ' + why); };
  cases('the guard accepts an unchanged record and a record with exactly the approved additions', () => {
    ['the-exploding-pudding', 'sold-as-seen'].forEach((id) => assert(approved.approvedRecordProblem(HEAD_REC(id), HEAD_REC(id)) === null, id + ': an unchanged unapproved record was rejected'));
    assert(approved.approvedRecordProblem(HEAD_REC('seterra'), HEAD_REC('seterra')), 'an approved record WITHOUT its pinned additions was accepted (the approved values must be present)');
    Object.keys(approved.APPROVED_IMAGE_TAGS).forEach((id) => assert(approved.approvedRecordProblem(HEAD_REC(id), withApproved(id)) === null, id + ': ' + approved.approvedRecordProblem(HEAD_REC(id), withApproved(id))));
    assert(approved.approvedRecordProblem(withApproved('wafflebrain'), withApproved('wafflebrain')) === null, 'committed-then-unchanged rejected');
  });
  cases('it refuses invalid image_tags: numbers, empty strings, upper case, spaces, duplicates, malformed slugs, wrong type, too many, none', () => {
    const bad = [[1, 'ok'], ['', 'ok'], ['Maps'], ['two words'], ['maps', 'maps'], ['-lead'], ['trail-'], ['dou--ble'], ['under_score'], 'maps', null, [], Array.from({ length: 9 }, (_, i) => 'tag' + i), ['maps', null], [['nested']]];
    bad.forEach((v) => refuses('seterra', (r) => { r.image_tags = v; }, 'image_tags ' + JSON.stringify(v)));
  });
  cases('it refuses valid-looking image_tags that differ from the approved values (pinned, not just format-checked)', () => {
    refuses('seterra', (r) => { r.image_tags = ['maps', 'geography']; }, 'changed tags');
    refuses('seterra', (r) => { r.image_tags = approved.APPROVED_IMAGE_TAGS.seterra.slice().reverse(); }, 'reordered tags');
    refuses('seterra', (r) => { r.image_tags = approved.APPROVED_IMAGE_TAGS.seterra.concat(['extra']); }, 'extra tag');
    refuses('seterra', (r) => { delete r.image_tags; }, 'approved image_tags removed');
  });
  cases('it refuses image_tags on paid products, FRT originals and any other unapproved record', () => {
    ['the-exploding-pudding', 'sold-as-seen', 'the-christmas-dinner-that-keeps-getting-bigger', 'one-resource-start-to-finish'].forEach((id) => refuses(id, (r) => { r.image_tags = ['maps']; }, 'image_tags on ' + id));
  });
  cases('it refuses any teacher_note other than the pinned wording on the nine records, and any note change elsewhere', () => {
    refuses('wafflebrain', (r) => { r.teacher_note = 'A completely different but long enough note.'; }, 'other wording');
    refuses('wafflebrain', (r) => { r.teacher_note = approved.APPROVED_TEACHER_NOTES.wafflebrain + ' '; }, 'one extra space');
    refuses('wafflebrain', (r) => { r.teacher_note = null; }, 'approved note removed');
    refuses('seterra', (r) => { r.teacher_note = 'A long enough note on a record that is not approved.'; }, 'note on non-approved null record');
    refuses('islcollective', (r) => { r.teacher_note = 'Edited existing teacher note text.'; }, 'edited existing note');
    refuses('youglish', (r) => { r.teacher_note = null; }, 'existing note removed');
  });
  cases('it refuses every other kind of change: a field, a nested value, an added field, a missing field, key order, a renamed or swapped record', () => {
    refuses('seterra', (r) => { r.cost = 'paid'; }, 'changed field');
    refuses('seterra', (r) => { r.cefr_level = { mode: 'specific', values: ['C1'] }; }, 'changed nested value');
    refuses('seterra', (r) => { r.group_fit.extra = 1; }, 'added nested field');
    refuses('seterra', (r) => { r.surprise = 1; }, 'added field');
    refuses('seterra', (r) => { delete r.domain; }, 'missing field');
    refuses('seterra', (r) => { r.description_short = ''; }, 'emptied field');
    refuses('seterra', (r) => { const { id, ...rest } = r; Object.keys(r).forEach((k) => delete r[k]); Object.assign(r, rest, { id }); }, 'reordered keys');
    refuses('seterra', (r) => { r.id = 'seterra-2'; }, 'renamed record');
    refuses('seterra', () => withApproved('wordwall'), 'another record swapped into the file');
    refuses('seterra', (r) => { r.internal_notes = r.internal_notes + '.'; }, 'one character in internal_notes');
    assert(approved.approvedRecordProblem(HEAD_REC('seterra'), null), 'null record not refused');
    assert(approved.approvedRecordProblem(HEAD_REC('seterra'), [HEAD_REC('seterra')]), 'array record not refused');
  });
}
/* The manifest is compared with the last commit too: every id in the committed manifest must still be there, in the same order,
   and the ONLY difference allowed is the ids named here, appended at the end, each with its own new record. Anything else fails. */
const MANIFEST_ADDITIONS_SINCE_HEAD = [GUIDE];
test('the manifest equals the last commit plus exactly the named new entries, appended in order, each with its own directory record', () => {
  let committed;
  try { committed = JSON.parse(git(['show', 'HEAD:data/manifest.json'])); }
  catch (e) { console.log('        (skipped: git is not available here)'); return; }
  const now = JSON.parse(read('data/manifest.json'));
  const fresh = MANIFEST_ADDITIONS_SINCE_HEAD.filter((id) => !committed.includes(id)); /* already committed: nothing left to account for */
  eq(now, committed.concat(fresh), 'manifest = last commit + named additions');
  assert(new Set(now).size === now.length, 'duplicate id in the manifest');
  fresh.forEach((id) => assert(exists('data/resources/' + id + '.json'), id + ': named in the manifest but has no directory record'));
});
test('the homepage has no link to the retired /paid-resources/ page, and still links to /made-by-frt/ from its header, promo and footer', () => {
  // State check, not a git diff. It was written against uncommitted edits (the removed Paid resources links), which no longer show as a diff.
  // Image paths under /paid-resources/images/ are assets, not the retired page, so only <a href> targets are checked.
  const idx = read('index.html');
  const links = [...idx.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
  const retired = links.filter((h) => /^\/paid-resources\/?(#.*)?$/.test(h));
  assert(retired.length === 0, 'links to the retired page: ' + retired.join(', '));
  assert(!idx.includes('>Paid resources</a>'), 'a "Paid resources" nav link is back');
  const catalogueLinks = links.filter((h) => h === '/made-by-frt/').length;
  assert(catalogueLinks >= 3, 'expected the header, promo and footer links to /made-by-frt/, found ' + catalogueLinks);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
