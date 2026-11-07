#!/usr/bin/env node
/* Checks for the paid-resources page, the first reviewed paid directory entry, and the Payhip groundwork.
   Run:  node data/paid-resources.test.js
   Strict go-live gate:  GO_LIVE=1 node data/paid-resources.test.js   (turns the GO-LIVE BLOCKERS below into failures)

   Separate from directory.test.js and site.test.js on purpose.

   What this file protects, in plain terms:
     - the catalogue page is complete, canonical, and links ONLY to the verified Payhip product URL
     - the directory entry and the catalogue page agree on price, level, time and link
     - exactly one paid entry exists (the reviewed one) and every other directory resource is unchanged
     - a paid entry can never take the homepage's red feature block (the Website of the Day, which replaced the old "Recently added" band)
     - navigation and sitemap link to the page consistently on every page
     - the About and footer wording stays honest
     - .assetsignore publishes the page while keeping internal files, the Stripe prototype and tools off the site, and the remaining
       go-live blockers are listed */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const paid = require('../tools/build-paid-resources.js');
const cat = require('../tools/build-catalogue.js');
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
function throws(fn, re, m) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  assert(err, (m || 'expected an error') + ' (nothing was thrown)');
  assert(re.test(err.message), (m || 'wrong error') + ': ' + err.message);
}
const clone = (o) => JSON.parse(JSON.stringify(o));

const PAGE = 'made-by-frt/index.html'; /* the unified catalogue; /paid-resources/ is now only a redirect plus a "moved" notice (see data/catalogue.test.js) */
const html = read(PAGE);
const data = paid.load();
const product = data.products.find((x) => x.id === 'the-exploding-pudding');
const entry = JSON.parse(read('data/resources/the-exploding-pudding.json'));
const VERIFIED_URL = 'https://payhip.com/b/cFa7v';
/* The reviewed paid catalogue. Every id here has a Payhip product that was opened in a logged-out browser, and its URL is written out
   once more here on purpose: a typo in the data file cannot pass by agreeing with itself. Add an entry only with the owner's approval. */
const VERIFIED = {
  'the-exploding-pudding': 'https://payhip.com/b/cFa7v',
  'the-clocks-that-lie': 'https://payhip.com/b/x86vs',
  'the-escaped-specimen': 'https://payhip.com/b/dRZco',
  'the-too-helpful-robot': 'https://payhip.com/b/FWrHk',
  'the-dog-translator': 'https://payhip.com/b/FYKHe',
  'the-sixth-ghost': 'https://payhip.com/b/ZkCOX',
  'the-947-scream': 'https://payhip.com/b/MnhYO',
  'grandpas-teeth': 'https://payhip.com/b/x5Npe',
  'mr-bones-quits': 'https://payhip.com/b/ZpK4L',
  'too-much-money': 'https://payhip.com/b/RN0GB',
  'the-queue-jumper': 'https://payhip.com/b/oxk9I',
  'a-day-at-the-park': 'https://payhip.com/b/Ek2gX',
  'sold-as-seen': 'https://payhip.com/b/72Ecu',
  'the-christmas-dinner-that-keeps-getting-bigger': 'https://payhip.com/b/MWIoz',
  'one-resource-start-to-finish': 'https://payhip.com/b/zkyw0'
};
const PAID_IDS = Object.keys(VERIFIED);
const entries = {};
PAID_IDS.forEach((id) => { entries[id] = JSON.parse(read('data/resources/' + id + '.json')); });
const products = {};
PAID_IDS.forEach((id) => { products[id] = data.products.find((x) => x.id === id); });
const BASE = '366b6b064f4af07ebb024c0af3429e4111d7fb19'; /* the redesign baseline commit this branch started from */
/* Free directory entries added after the baseline on purpose (each is a deliberate, reviewed addition, not a paid product). Any other new or changed free entry still fails the checks below. */
const FREE_ADDITIONS = ['gapminder'];

/* Pages that carry the site navigation today. */
const NAV_PAGES = ['index.html', 'about.html', 'made-by-frt/index.html',
  'resources/the-school-trip-that-should-have-been-cancelled/index.html'];

function resolveLocal(href) {
  if (/^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(href)) return null;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  let t = clean.startsWith('/') ? clean.slice(1) : clean;
  if (t === '' || t.endsWith('/')) t += 'index.html';
  return t;
}
const cleanUrlOk = (p) => exists(p) || exists(p + '.html');
function git(args) {
  return execFileSync('git', ['--no-optional-locks'].concat(args), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}
function gitAvailable() {
  try { git(['cat-file', '-e', BASE + '^{commit}']); return true; } catch (e) { return false; }
}

console.log('catalogue page (free and paid): complete, canonical, indexable');
test('made-by-frt/index.html exists and is up to date with the data files (fix: node tools/build-catalogue.js); the moved notice is too', () => {
  assert(exists(PAGE), PAGE + ' is missing');
  const stale = cat.run(true).concat(paid.run(true));
  assert(stale.length === 0, 'out of date: ' + stale.join(', '));
});
test('the up-to-date check ignores CRLF versus LF but still catches real content differences', () => {
  const html = cat.build()[0].html;
  const crlf = html.replace(/\n/g, '\r\n');
  assert(paid.sameContent(html, html), 'identical text must match');
  assert(paid.sameContent(crlf, html), 'a CRLF copy (Windows checkout) must match');
  assert(paid.sameContent(html, crlf), 'comparison must be symmetric');
  assert(!paid.sameContent(html.replace('$1.99', '$2.99'), html), 'a changed price must not match');
  assert(!paid.sameContent(crlf.replace('$1.99', '$2.99'), html), 'CRLF plus a changed price must not match');
  assert(!paid.sameContent(html + ' ', html), 'trailing whitespace must not match');
  assert(!paid.sameContent(html.replace('\n', '\r'), html), 'a lone CR is not a CRLF pair and must not match');
  assert(!paid.sameContent(null, html), 'a missing file must not match');
});
test('data file is in the reviewed live state', () => {
  assert(data.page.status === 'live', 'page.status');
  assert(product && product.status === 'live', 'product status');
  assert(product.payhip_url === VERIFIED_URL, 'product URL is not the verified Payhip URL');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(product.link_verified), 'link_verified date missing');
  assert(data.page.store_url === null, 'store_url must stay null while the Payhip storefront would show "No products found"');
});
test('has the catalogue title, a description, one h1, a canonical URL on the real domain and social tags', () => {
  assert(html.includes('<title>' + cat.TITLE + '</title>'), 'title');
  assert(html.includes('<meta name="description" content="' + cat.DESCRIPTION + '" />'), 'description');
  assert((html.match(/<h1\b/g) || []).length === 1 && /<h1 class="mbf-title">Made by Free Range Tutors<\/h1>/.test(html), 'h1');
  assert(/<link rel="canonical" href="https:\/\/www\.freerangetutors\.com\/made-by-frt\/" \/>/.test(html), 'canonical');
  assert(/property="og:url" content="https:\/\/www\.freerangetutors\.com\/made-by-frt\/"/.test(html), 'og:url');
  assert(/property="og:description" content="Teaching resources made by Free Range Tutors, some free/.test(html), 'og:description');
  assert(!/Everything on this page is free/.test(html), 'the old free-only claim remains');
});
test('is indexable (no noindex), carries analytics like the other pages, and the footer says so', () => {
  assert(!/noindex/i.test(html), 'noindex present');
  assert(/googletagmanager\.com\/gtag\/js\?id=G-KKHTF8PMYV/.test(html), 'analytics snippet');
  assert(/Basic visit statistics are collected with Google Analytics\./.test(html), 'footer analytics sentence');
  assert(!/Draft preview/.test(html), 'draft banner on a live page');
});
test('every local link, stylesheet and image resolves', () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const bad = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(clean))) { const t = resolveLocal(m[1]); if (t && !cleanUrlOk(t)) bad.push(m[1]); }
  assert(bad.length === 0, 'unresolved: ' + bad.join(', '));
});
test('uses the shared design system (tokens + directory.css) and only .mbf- and .cat- selectors of its own', () => {
  assert(html.includes('href="/dispatch-tokens.css"') && html.includes('href="/directory.css"'), 'shared stylesheets');
  const css = read('made-by-frt/made-by-frt.css');
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').match(/[^{}]+(?=\{)/g) || [];
  const stray = selectors.map((s) => s.trim()).filter((s) => s && !/^(\.mbf-|\.cat-|img\.cat-)/.test(s));
  assert(stray.length === 0, 'selectors outside the .mbf-/.cat- namespace: ' + stray.join(' | '));
});
test('the GapTheMind / Free Range Tutors relationship is stated plainly and factually', () => {
  assert(/<p class="cat-kind">GapTheMind · Partner speaking mystery<\/p>/.test(html), 'card brand label');
  assert(!/guarantee|proven|best-selling|tested in class/i.test(html), 'unverified claim wording');
});
console.log('\npurchase link: only the verified Payhip product URL');
test('the only outbound links are the verified product URLs, one per product, each opened in a new tab safely', () => {
  const hrefs = (html.match(/href="[^"]+"/g) || []).map((h) => h.slice(6, -1));
  const external = hrefs.filter((h) => /^https?:/i.test(h) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(h) && !/^https:\/\/www\.freerangetutors\.com\//.test(h));
  assert(JSON.stringify(external.slice().sort()) === JSON.stringify(Object.values(VERIFIED).sort()), 'external links: ' + external.join(', '));
  PAID_IDS.forEach((id) => assert(html.includes('href="' + VERIFIED[id] + '" target="_blank" rel="noopener noreferrer"'), id + ': link attributes'));
  assert(!/payhip\.com\/FreeRangeTutors/i.test(html), 'the (currently empty) storefront must not be linked');
});
test('no fake checkout: no form, input, iframe or Stripe markup; the only buttons are the filter buttons', () => {
  assert(!/<form|<input|<iframe|stripe/i.test(html), 'checkout-like markup found');
  (html.match(/<button\b[^>]*>/g) || []).forEach((b) => assert(/class="cat-(chip|link)"/.test(b) && /type="button"/.test(b), 'unexpected button: ' + b));
});
test('each card shows the price, the level and the time that its directory entry also states', () => {
  PAID_IDS.forEach((id) => {
    const card = (html.match(new RegExp('<article class="cat-item[^"]*" id="' + id + '"[^>]*>[\\s\\S]*?</article>')) || [''])[0];
    const prod = products[id], ent = entries[id];
    assert(card, id + ': no card on the page');
    if (id === 'one-resource-start-to-finish') { /* a $4.99 guide for teachers, not a classroom activity: no CEFR level, activity time or group size, so those checks do not apply; price, format, VAT wording, URL and image still do */
      assert(/<span class="cat-price">\$4\.99 <small>USD<\/small><\/span>/.test(card) && /Plus VAT where applicable/.test(card), id + ': price and VAT wording on the card');
      assert(/60 pages/.test(card) && prod.price.amount === 4.99 && /US\$4\.99/.test(ent.description_short) && /60 pages/.test(ent.description_short), id + ': price or page count differs between the card and the directory entry');
      assert(!/<dt>[^<]*(Level|Time|Groups)[^<]*<\/dt>/.test(card), id + ': a level, time or group fact on a guide');
      assert(ent.url === prod.payhip_url && prod.payhip_url === VERIFIED[id], id + ': directory entry URL differs from the catalogue page URL');
      assert(card.includes('src="' + prod.image + '"') && prod.image === '/paid-resources/images/' + id + '.png', id + ': cover image');
      return;
    }
    const sas = id === 'sold-as-seen'; /* the one $4.99 interactive story for the whole class, pairs or individuals: its own price, time and groups, stated in its PDF and listing */
    const xmas = id === 'the-christmas-dinner-that-keeps-getting-bigger'; /* the $4.99 A2-B1 interactive Christmas mystery for individuals and pairs: its own price, level, time and groups, stated in its PDF and listing */
    assert(((sas || xmas) ? /<span class="cat-price">\$4\.99 <small>USD<\/small><\/span>/ : /<span class="cat-price">\$1\.99 <small>USD<\/small><\/span>/).test(card), id + ': price on the card');
    assert(/<span class="cat-badge cat-badge-paid">Paid<\/span>/.test(card), id + ': no Paid label');
    const a2 = id === 'a-day-at-the-park'; /* the one A2 picture activity: its own level and time, stated in its PDF */
    assert(((a2 || xmas) ? (xmas ? /CEFR A2–B1/ : /CEFR A2/) : /CEFR B1–B2/).test(card) && (a2 ? /About 15–20 minutes/ : sas ? /About 45 minutes, with discussion/ : xmas ? /About 10–15 minutes to read, plus about 30 minutes of activities/ : /About 25 minutes/).test(card) && (sas ? /<dd>Whole class, pairs or individual<\/dd>/ : xmas ? /<dd>Individual reading and pair discussion<\/dd>/ : /<dd>Pairs<\/dd>/).test(card), id + ': level/time/groups on the card');
    assert(prod.price.amount === ((sas || xmas) ? 4.99 : 1.99) && ((sas || xmas) ? /\$4\.99/ : /\$1\.99/).test(ent.description_short), id + ': price differs between the page data and the directory entry');
    assert(xmas ? (/A2–B1/.test(ent.description_short) && JSON.stringify(ent.cefr_level.values) === '["A2","B1"]') : a2 ? (/CEFR A2/.test(ent.description_short) && JSON.stringify(ent.cefr_level.values) === '["A2"]') : (/B1–B2/.test(ent.description_short) && JSON.stringify(ent.cefr_level.values) === '["B1","B2"]'), id + ': level differs');
    assert(a2 ? (/15–20 minutes/.test(ent.description_short) && ent.activity_time_minutes === 20) : (sas || xmas) ? (/About 45 minutes/.test(ent.description_short) && ent.activity_time_minutes === 45) : (/about 25 minutes/.test(ent.description_short) && ent.activity_time_minutes === 25), id + ': time differs');
    assert(ent.group_fit.values.join() === (sas ? 'individual,pair,group' : xmas ? 'individual,pair' : 'pair'), id + ': group differs');
    assert(ent.url === prod.payhip_url && prod.payhip_url === VERIFIED[id], id + ': directory entry URL differs from the catalogue page URL');
    assert(card.includes('src="' + prod.image + '"') && prod.image === '/paid-resources/images/' + id + '.png', id + ': cover image');
  });
});
test('the VAT note matches what Payhip checkout showed (tax may be added)', () => {
  assert(/Tax, such as EU VAT, may be added at checkout\./.test(html), 'tax note missing');
});

console.log('\ndirectory entry: exactly one reviewed paid entry, nothing else changed');
test('every entry follows the schema conventions for a paid, GapTheMind-published resource', () => PAID_IDS.forEach((id) => {
  const entry = entries[id];
  assert(entry.cost === 'paid' && entry.source_category === 'commercial' && entry.creator === 'GapTheMind' && entry.domain === 'payhip.com', 'paid/commercial/creator/domain');
  assert(/^https:\/\/payhip\.com\/b\/[A-Za-z0-9]+$/.test(entry.url), 'URL shape');
  assert(entry.resource_type === 'pdf' && entry.primary_category === 'teaching_materials', 'type/category');
  /* only SOLD AS SEEN prints an age range (ages 12-14 on its cover and back cover): it alone is 'teen'; every other product states none */
  assert(id === 'sold-as-seen' ? (entry.age_group.mode === 'specific' && entry.age_group.values.join() === 'teen') : entry.age_group.mode === 'unknown', 'age_group must stay unknown unless the product states an age range');
  assert(entry.featured === false && entry.status === null, 'featured/status');
  assert(entry.internal_notes && !/payhip\.com\/b\//.test(JSON.stringify(Object.assign({}, entry, { internal_notes: '', url: '' }))), 'no stray product URL in visible fields');
  assert(entry.id === id && entry.image === 'images/resources/' + id + '.png' && entry.date_added === (id === 'sold-as-seen' ? '2026-10-25' : (id === 'the-christmas-dinner-that-keeps-getting-bigger' || id === 'one-resource-start-to-finish') ? '2026-11-05' : '2026-10-17'), id + ': id/image/date');
}));
test('manifest lists every paid entry exactly once and lists nothing else new', () => {
  const manifest = JSON.parse(read('data/manifest.json'));
  PAID_IDS.forEach((id) => assert(manifest.filter((i) => i === id).length === 1, id + ': not exactly once'));
  assert(manifest.length === 19 + FREE_ADDITIONS.length + PAID_IDS.length, 'manifest length ' + manifest.length);
  FREE_ADDITIONS.forEach((id) => assert(manifest.filter((i) => i === id).length === 1, id + ': not exactly once'));
  if (!gitAvailable()) { console.log('        (baseline comparison skipped: git or the baseline commit is not available here)'); return; }
  const base = JSON.parse(git(['show', BASE + ':data/manifest.json']));
  assert(JSON.stringify(manifest.filter((i) => PAID_IDS.indexOf(i) === -1 && FREE_ADDITIONS.indexOf(i) === -1)) === JSON.stringify(base), 'the 19 existing ids changed or were reordered');
});
/* The ONE approved change to existing resource files (homepage "Website of the Day", see data/SCHEMA.md), pinned exactly by
   tools/approved-record-additions.js (shared with data/catalogue.test.js): image_tags on the 20 named curated_external records with exactly
   their approved values, and the approved wording of teacher_note on the 9 named records that had none. Every other field, nested value,
   added or missing field, key order and the record's id must still equal the baseline. */
const approved = require(path.join(ROOT, 'tools', 'approved-record-additions.js'));
function baselineProblem(rel) {
  /* data/originals.json: the one approved change since the baseline is the removal of the retired Stop the Slop entry (every other entry identical). */
  if (rel === 'data/originals.json') {
    const was = JSON.parse(git(['show', BASE + ':' + rel])).filter((o) => o.id !== 'stop-the-slop'), now = JSON.parse(read(rel));
    return JSON.stringify(was) === JSON.stringify(now) ? null : 'changed beyond removing the retired Stop the Slop entry';
  }
  if (!/^data\/resources\/[a-z0-9-]+\.json$/.test(rel)) return 'not a record file';
  if (!fs.existsSync(path.join(ROOT, rel))) return 'the record was deleted or moved';
  let now; try { now = JSON.parse(read(rel)); } catch (e) { return 'the record is not valid JSON'; }
  const was = JSON.parse(git(['show', BASE + ':' + rel]));
  if (!approved.hasApprovedAdditions(was.id)) return 'changed (this record has no approved change, so any change at all, even formatting, is refused)';
  return approved.approvedRecordProblem(was, now);
}
test('all 19 existing resource files and originals.json are identical to the baseline commit apart from the approved image_tags and teacher_note additions; only the paid entry files and the named free additions were added', () => {
  if (!gitAvailable()) { console.log('        (skipped: git or the baseline commit is not available here)'); return; }
  const changedFiles = git(['diff', '--name-only', '--diff-filter=MDRTU', BASE, '--', 'data/resources', 'data/originals.json']).split('\n').map((s) => s.trim()).filter(Boolean);
  const changed = changedFiles.map((f) => [f, baselineProblem(f)]).filter((x) => x[1]).map((x) => x[0] + ' (' + x[1] + ')').join(', ');
  assert(changed === '', 'changed since baseline: ' + changed);
  const added = git(['diff', '--name-only', '--diff-filter=A', BASE, '--', 'data/resources']).split('\n')
    .concat(git(['ls-files', '--others', '--exclude-standard', '--', 'data/resources']).split('\n'))
    .map((s) => s.trim()).filter(Boolean).filter((f, i, a) => a.indexOf(f) === i);
  assert(JSON.stringify(added.slice().sort()) === JSON.stringify(PAID_IDS.concat(FREE_ADDITIONS).map((id) => 'data/resources/' + id + '.json').sort()), 'unexpected new catalogue files: ' + added.join(', '));
});
test('exactly the reviewed resources in the catalogue are paid, and no others', () => {
  const manifest = JSON.parse(read('data/manifest.json'));
  const paidIds = manifest.filter((id) => JSON.parse(read('data/resources/' + id + '.json')).cost === 'paid');
  assert(paidIds.slice().sort().join() === PAID_IDS.slice().sort().join(), 'paid ids: ' + paidIds.join(', '));
});

console.log('\nhomepage: a paid entry cannot take the red feature block (the Website of the Day)');
const dirSrc = read('directory.js');
function extractFn(name) {
  const start = dirSrc.indexOf('function ' + name + '(');
  assert(start !== -1, name + ' not found in directory.js');
  let depth = 0, i = dirSrc.indexOf('{', start);
  for (; i < dirSrc.length; i++) { if (dirSrc[i] === '{') depth++; else if (dirSrc[i] === '}') { depth--; if (!depth) break; } }
  return dirSrc.slice(start, i + 1);
}
const catalogue = JSON.parse(read('data/manifest.json')).map((id) => JSON.parse(read('data/resources/' + id + '.json')));
const WOTD = require(path.join(ROOT, 'website-of-the-day.js'));
const DAY_MS = 864e5, ANCHOR_MS = Date.UTC(2026, 0, 5);
const weekdayDate = (k) => new Date(ANCHOR_MS + Math.floor(k / 5) * 7 * DAY_MS + (k % 5) * DAY_MS);
test('the red feature block is the Website of the Day: the old featured-slot code (FEATURED_ID, recentPool, pickFeatured, renderFeatured) is gone from directory.js and the homepage has no Recently added band', () => {
  assert(!/FEATURED_ID|recentPool|pickFeatured|renderFeatured/.test(dirSrc), 'directory.js still has the old featured-slot code');
  const home = read('index.html');
  assert(/<section class="wotd"/.test(home) && !/recent-band|Recently added/i.test(home), 'homepage structure');
});
test('with the real catalogue only curated_external websites can be featured: no paid or commercial entry is eligible, in the rotation, or ever shown on any weekday for two years', () => {
  const eligible = WOTD.eligibleWebsites(catalogue);
  assert(eligible.length > 0 && eligible.every((r) => r.source_category === 'curated_external'), 'a non-external entry is eligible');
  assert(!eligible.some((r) => PAID_IDS.includes(r.id) || r.source_category === 'commercial' || r.cost === 'paid' && r.source_category !== 'curated_external'), 'a paid entry is eligible');
  for (let k = 0; k < 520; k++) {
    const w = WOTD.pickWebsite(catalogue, weekdayDate(k)).website;
    assert(w.source_category === 'curated_external' && !PAID_IDS.includes(w.id), 'a paid entry was shown on weekday ' + k + ': ' + w.id);
  }
});
test('a newer paid entry cannot take the feature block or displace a free website (synthetic cases)', () => {
  const site = (id, d, x) => Object.assign({ id, name: id, url: 'https://e.org/' + id, source_category: 'curated_external', cost: 'free', date_added: d }, x || {});
  const all = [site('a', '2026-01-01'), site('b', '2026-02-01'), site('c', '2026-03-01'), site('pay', '2026-12-31', { source_category: 'commercial', cost: 'paid' })];
  const ids = (rs) => rs.map((r) => r.id).join();
  assert(ids(WOTD.eligibleWebsites(all)) === 'a,b,c', 'paid entry is eligible: ' + ids(WOTD.eligibleWebsites(all)));
  assert(WOTD.rotationPool === undefined, 'the old newest-date exclusion (rotationPool) must be gone: every eligible free website rotates');
  for (let k = 0; k < 3; k++) assert(WOTD.pickWebsite(all, weekdayDate(k)).website.id === 'abc'[k], 'the paid entry must not displace any free website: weekday ' + k);
  for (let k = 0; k < 40; k++) assert(WOTD.pickWebsite(all, weekdayDate(k)).website.id !== 'pay', 'paid entry shown');
});
test('a paid entry is ignored even when every other resource is paid or absent: the rotation shows nothing rather than a paid product', () => {
  const pay = [{ id: 'p1', name: 'p1', url: 'https://payhip.com/b/x', source_category: 'commercial', cost: 'paid', date_added: '2026-01-01' }];
  assert(WOTD.pickWebsite(pay, weekdayDate(0)) === null && WOTD.pickForDate(pay, [], weekdayDate(0)) === null, 'a paid-only catalogue must feature nothing');
});

console.log('\ncreator: the directory card and the no-JavaScript list name GapTheMind');
const sourceTextFn = () => new Function(extractFn('sourceText') + '\nreturn sourceText;')();
test('a commercial entry\'s card source line reads "GapTheMind · payhip.com"; every free entry still shows just its domain', () => {
  const f = sourceTextFn();
  PAID_IDS.forEach((id) => assert(f(entries[id]) === 'GapTheMind · payhip.com', id + ' got: ' + f(entries[id])));
  catalogue.filter((r) => r.cost !== 'paid').forEach((r) => assert(f(r) === r.domain, r.id + ' changed: ' + f(r)));
  assert(/text: sourceText\(r\)/.test(dirSrc), 'the card does not use sourceText');
});
test('the no-JavaScript list names the creator for the paid entries only', () => {
  const items = (read('index.html').match(/<li><a href="https?:[^]*?<\/li>/g) || []);
  const paidLines = items.filter((l) => /href="https:\/\/payhip\.com\/b\//.test(l));
  assert(paidLines.length === PAID_IDS.length, 'paid lines in the noscript list: ' + paidLines.length);
  paidLines.forEach((l) => assert(/<\/a> \(GapTheMind\) &mdash; /.test(l), 'creator missing in the noscript line'));
  items.filter((l) => paidLines.indexOf(l) === -1).forEach((l) => assert(!/<\/a> \([^)]*\) &mdash; /.test(l), 'a free entry gained a creator suffix: ' + l.slice(0, 80)));
});

console.log('\nnavigation and sitemap');
test('no page links to /paid-resources/ any more: the masthead and footer lead to Made by FRT and end with About', () => {
  NAV_PAGES.forEach((p) => {
    const s = read(p);
    assert(!/href="\/paid-resources\/?"/.test(s), p + ' still links to the retired page');
    ['site-nav', 'foot-nav'].forEach((cls) => {
      const m = s.match(new RegExp('<nav class="' + cls + '"[^>]*>([^]*?)</nav>'));
      assert(m, p + ': no ' + cls);
      const links = (m[1].match(/<a [^>]*href="[^"]*"/g) || []).map((a) => a.match(/href="([^"]*)"/)[1]);
      assert(links.includes('/made-by-frt/'), p + ': ' + cls + ' lacks Made by FRT');
      assert(links[links.length - 1] === '/about', p + ': ' + cls + ' does not end with About');
    });
  });
});
test('only the catalogue marks Made by FRT as the current page in its own navigation', () => {
  assert(/<a href="\/made-by-frt\/" aria-current="page">Made by FRT<\/a>/.test(html), 'catalogue lacks aria-current');
  ['index.html', 'about.html'].forEach((p) => assert(!/<a href="\/made-by-frt\/" aria-current/.test(read(p)), p + ' marks it current'));
});
test('sitemap.xml lists the catalogue, no longer lists /paid-resources/, and build-static reports nothing stale', () => {
  const sm = read('sitemap.xml');
  assert(sm.includes('<loc>https://www.freerangetutors.com/made-by-frt/</loc>'), 'catalogue not in sitemap.xml');
  assert(!sm.includes('/paid-resources/'), 'the retired URL is still in sitemap.xml');
  const stale = staticRun(true);
  assert(stale.length === 0, 'build-static would change: ' + stale.join(', '));
});
test('the homepage no-JavaScript list includes every paid entry with its Payhip link', () => {
  PAID_IDS.forEach((id) => assert(read('index.html').includes('<li><a href="' + VERIFIED[id] + '" rel="noopener noreferrer">' + entries[id].name.replace(/&/g, '&amp;') + '</a>'), id + ': noscript entry'));
});

console.log('\nAbout and footer wording');
test('About acknowledges paid resources and keeps its free-first emphasis', () => {
  const about = read('about.html');
  assert(!/not angled toward monetisation/.test(about) && !/Everything here is free to use/.test(about), 'old claims remain');
  assert(/Some linked resources may be paid\./.test(about) && /Most of what is listed here is free to use/.test(about), 'approved wording missing');
  assert(/name="description" content="About Free Range Tutors: a mostly free, no-login collection/.test(about), 'meta description');
});
test('all five pages use the approved footer wording', () => {
  NAV_PAGES.forEach((p) => {
    const s = read(p);
    assert(/Built by one teacher\. Mostly free to use; a few resources are paid\. No login and no ads\./.test(s), p + ': footer wording');
    assert(!/shared freely/.test(s), p + ': old wording remains');
  });
});

console.log('\nthe builder refuses unsafe states (in memory; nothing is written)');
const fakeLive = () => {
  const d = clone(data);
  d.page.status = 'live'; d.page.store_url = 'https://payhip.com/ExampleStore';
  d.products[0].status = 'live'; d.products[0].payhip_url = 'https://payhip.com/b/AbC12'; d.products[0].link_verified = '2026-01-02';
  return d;
};
test('the catalogue refuses a draft paid file (no unverified purchase link can be written)', () => {
  const src = Object.assign(cat.load(), { paid: fakeLive() }); src.paid.page.status = 'draft';
  throws(() => cat.render(src), /must be "live"/, 'draft paid data');
});
test('the catalogue shows only live products', () => {
  const d = fakeLive(); const extra = clone(d.products[0]); extra.id = 'second-draft'; extra.status = 'draft'; d.products.push(extra);
  const src = cat.load(); src.paid = d;
  const out = cat.render(src);
  assert(out.includes('id="the-exploding-pudding"') && !out.includes('id="second-draft"'), 'draft product shown on a live page');
});
test('live mode refuses: no verification date / bad link / no live products / duplicate ids / missing image', () => {
  let d = fakeLive(); d.products[0].link_verified = null;
  throws(() => paid.render(d), /link_verified/, 'unverified link');
  d = fakeLive(); d.products[0].payhip_url = 'https://example.com/b/AbC12';
  throws(() => paid.render(d), /payhip_url/, 'non-Payhip link');
  d = fakeLive(); d.products.forEach((x) => { x.status = 'draft'; });
  throws(() => paid.render(d), /no live products/, 'empty shop');
  d = clone(data); d.products.push(clone(d.products[0]));
  throws(() => paid.render(d), /duplicate id/, 'duplicate id');
  d = clone(data); d.products[0].image = '/paid-resources/images/missing.png';
  throws(() => paid.render(d), /image file is missing/, 'missing image');
});

console.log('\ndeployment safeguard and go-live blockers');
const assetsIgnore = read('.assetsignore').split(/\r?\n/).map((l) => l.trim());
test('.assetsignore no longer excludes paid-resources (the page is publishable) and still hides tools', () => {
  assert(!assetsIgnore.includes('paid-resources'), 'paid-resources is excluded again: the nav, footer and sitemap link to a page that would not be published');
  assert(assetsIgnore.includes('tools'), 'tools was removed from .assetsignore');
});
/* Regression guard for the publish-time safeguards. Cloudflare publishes the whole repo root minus .assetsignore, and the repo has no
   .gitignore, so these lines are what keep internal and prototype files off the website. This uses Git's pattern engine as a cheap guard;
   Wrangler's own matcher (ignore@5.3.1, patterns split on "\n") was checked separately with a one-off simulation (see the README). */
const os = require('os');
function gitIgnored(ignoreText, paths) {
  const tmp = path.join(os.tmpdir(), 'frt-assetsignore-test-' + process.pid + '.txt');
  fs.writeFileSync(tmp, ignoreText);
  try {
    const out = execFileSync('git', ['--no-optional-locks', '-c', 'core.excludesFile=' + tmp.replace(/\\/g, '/'), 'check-ignore', '--no-index', '--stdin'],
      { cwd: ROOT, input: paths.join('\n'), stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    return new Set(out.split(/\r?\n/).filter(Boolean));
  } catch (e) {
    if (e.status === 1) return new Set();           /* check-ignore exits 1 when nothing matched */
    throw e;
  } finally { try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ } }
}
const ignoreText = read('.assetsignore');
const ignoreLinesNow = ignoreText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const REQUIRED_IGNORE_LINES = ['.git', '.gitattributes', '.assetsignore', 'node_modules', '.dev.vars*', '.env*', 'wrangler.jsonc', 'PROJECT_NOTES.md', '*.zip',
  'data/*.md', 'data/*.test.js', 'data/resource.schema.json', 'tools', '/shop/', 'data/products.json',
  '/_archived-activities/', '/files3/', '/files4/', 'data/dispatch-match.js', 'images/resources/_masters/'];
/* Legacy files that nothing on the site links to or loads (checked 2026-10-17): retired activities, old page/template mock-ups, the retired
   Dispatch matching engine, and the 900px thumbnail masters (only tools/generate_thumbnail.py writes them). Deliberately not published. */
const LEGACY_RE = /^(_archived-activities\/|files3\/|files4\/|data\/dispatch-match\.js$|images\/resources\/_masters\/)/;
const gitLines = (args) => git(args).split(/\r?\n/).filter(Boolean);
const PROTOTYPE_AND_INTERNAL = () => gitLines(['ls-files', '-o']).concat(gitLines(['ls-files'])).filter((f) =>
  /^(shop\/|tools\/|data\/products\.json$|data\/PRODUCTS\.md$|PROJECT_NOTES\.md$|data\/[^/]+\.test\.js$|data\/[^/]+\.md$|data\/resource\.schema\.json$|.*\.zip$)/.test(f));
const PUBLIC_MUST_PUBLISH = ['index.html', 'about.html', 'made-by-frt/index.html', 'sitemap.xml', 'robots.txt', 'favicon.ico',
  'directory.js', 'directory.css', 'dispatch-tokens.css', 'data/resources.js', 'data/manifest.json', 'data/originals.json', 'data/resources/the-exploding-pudding.json',
  'images/resources/the-exploding-pudding.png', 'pdfs/stop-the-slop-guide.pdf', 'resources/the-school-trip-that-should-have-been-cancelled/index.html'];
test('.assetsignore still contains every safeguard line, exactly (including the new prototype lines)', () => {
  const missing = REQUIRED_IGNORE_LINES.filter((l) => !ignoreLinesNow.includes(l));
  assert(missing.length === 0, 'missing from .assetsignore: ' + missing.join(', '));
});
test('every prototype and internal file (shop/, tools/, products.json, notes, tests, zips) is excluded, whether or not Git tracks it', () => {
  if (!gitAvailable()) { console.log('        (skipped: git is not available here)'); return; }
  const files = PROTOTYPE_AND_INTERNAL();
  assert(files.length > 20, 'expected a real file list, got ' + files.length);
  const ignored = gitIgnored(ignoreText, files);
  const leaks = files.filter((f) => !ignored.has(f));
  assert(leaks.length === 0, 'would be published: ' + leaks.join(', '));
});
/* Draft products (not yet in the catalogue) already have their cover here, so the folder check below counts them too. */
const DRAFT_IDS = data.products.filter((p) => p.status === 'draft').map((p) => p.id);
const PAID_PAGE_FILES = ['paid-resources/index.html', 'paid-resources/paid-resources.css'].concat(PAID_IDS.concat(DRAFT_IDS).map((id) => 'paid-resources/images/' + id + '.png'));
test('the intended public files AND the three paid-resources page files are published (not excluded), while internal and prototype files stay excluded', () => {
  if (!gitAvailable()) { console.log('        (skipped: git is not available here)'); return; }
  const internal = PROTOTYPE_AND_INTERNAL();
  const ignored = gitIgnored(ignoreText, PUBLIC_MUST_PUBLISH.concat(PAID_PAGE_FILES, internal));
  const hiddenPublic = PUBLIC_MUST_PUBLISH.concat(PAID_PAGE_FILES).filter((f) => ignored.has(f));
  assert(hiddenPublic.length === 0, 'public files that would be hidden: ' + hiddenPublic.join(', '));
  const leaks = internal.filter((f) => !ignored.has(f));
  assert(leaks.length === 0, 'internal/prototype files that would be published: ' + leaks.join(', '));
});
test('the paid-resources folder contains exactly the page, its stylesheet and one cover per product, so nothing stray is published with the page', () => {
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
  const found = walk('paid-resources').sort();
  assert(JSON.stringify(found) === JSON.stringify(PAID_PAGE_FILES.slice().sort()), 'paid-resources/ holds: ' + found.join(', '));
});
test('no ignore line is broad enough to hide a legitimate public path by accident (tracked files that are not internal are all published)', () => {
  if (!gitAvailable()) { console.log('        (skipped: git is not available here)'); return; }
  const publicFiles = gitLines(['ls-files']).filter((f) => !/^(tools\/|PROJECT_NOTES\.md$|data\/[^/]+\.(md|test\.js)$|data\/resource\.schema\.json$|.*\.zip$|\.gitignore$|\.gitattributes$|\.assetsignore$|wrangler\.jsonc$|desktop\.ini$)/.test(f) && !LEGACY_RE.test(f));
  const ignored = gitIgnored(ignoreText, publicFiles.concat(PAID_PAGE_FILES));
  const hidden = publicFiles.concat(PAID_PAGE_FILES).filter((f) => ignored.has(f));
  assert(hidden.length === 0, 'public files that an ignore line hides: ' + hidden.join(', '));
});
test('the legacy archives, templates, Dispatch engine and 900px masters are excluded, tracked or not (every file, none left over)', () => {
  if (!gitAvailable()) { console.log('        (skipped: git is not available here)'); return; }
  const legacy = gitLines(['ls-files']).concat(gitLines(['ls-files', '-o'])).filter((f) => LEGACY_RE.test(f));
  assert(legacy.length >= 36, 'expected at least the 36 known legacy files, found ' + legacy.length);
  const ignored = gitIgnored(ignoreText, legacy);
  const leaks = legacy.filter((f) => !ignored.has(f));
  assert(leaks.length === 0, 'legacy files that would be published: ' + leaks.join(', '));
});
test('nothing the site links to or loads is excluded: every page link, thumbnail, original, PDF and data file is published', () => {
  if (!gitAvailable()) { console.log('        (skipped: git is not available here)'); return; }
  const refs = new Set(['data/manifest.json', 'data/originals.json', 'data/resources.js', 'directory.js', 'directory.css', 'dispatch-tokens.css', 'robots.txt', 'sitemap.xml', 'favicon.ico']);
  JSON.parse(read('data/manifest.json')).forEach((id) => {
    refs.add('data/resources/' + id + '.json');
    const j = JSON.parse(read('data/resources/' + id + '.json'));
    if (j.image) refs.add(j.image.replace(/^\//, ''));
  });
  JSON.parse(read('data/originals.json')).forEach((o) => {
    [o.page, o.image].concat((o.downloads || []).map((d) => d.file)).forEach((p) => {
      if (!p) return; let q = p.replace(/^\//, ''); if (q.endsWith('/')) q += 'index.html'; refs.add(q);
    });
  });
  NAV_PAGES.concat([PAGE, 'resources/the-school-trip-that-should-have-been-cancelled/play/index.html']).forEach((p) => {
    refs.add(p);
    const h = read(p).replace(/<!--[\s\S]*?-->/g, '');
    for (const m of h.matchAll(/(?:href|src)="([^"#?]+)/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(u)) continue;
      let q = u.startsWith('/') ? u.slice(1) : path.posix.join(path.posix.dirname(p), u);
      if (q === '' || q.endsWith('/')) q += 'index.html';
      if (!exists(q) && exists(q + '.html')) q += '.html';
      refs.add(path.posix.normalize(q));
    }
  });
  const real = [...refs].filter((f) => exists(f));
  assert(real.length > 60, 'expected a real reference list, got ' + real.length);
  const ignored = gitIgnored(ignoreText, real);
  const hidden = real.filter((f) => ignored.has(f));
  assert(hidden.length === 0, 'referenced files that would NOT be published: ' + hidden.join(', '));
});

const blockers = [];
if (assetsIgnore.includes('paid-resources')) {
  blockers.push('.assetsignore excludes /paid-resources/ again, but the nav, footer and sitemap link to it: those links would 404 if deployed.');
}
blockers.push('Ten of the eleven Payhip products were set to Unlisted when created (the direct links work; The Exploding Pudding is Visible). Making them Visible lists them in the Payhip storefront: a Payhip change the owner still has to make or approve.');
blockers.push('The owner is to confirm their own VAT and tax position with Payhip support or an accountant (Payhip says it handles EU/UK VAT as reseller; no tax setting was touched).');
if (blockers.length) {
  console.log('\n  GO-LIVE BLOCKERS (not test failures; set GO_LIVE=1 to make them fail):');
  blockers.forEach((b, i) => console.log('   ' + (i + 1) + '. ' + b));
  if (process.env.GO_LIVE) { fail++; console.log('  FAIL  GO_LIVE=1 and blockers remain'); }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
