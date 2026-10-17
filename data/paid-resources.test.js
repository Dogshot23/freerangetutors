#!/usr/bin/env node
/* Checks for the paid-resources page, the first reviewed paid directory entry, and the Payhip groundwork.
   Run:  node data/paid-resources.test.js
   Strict go-live gate:  GO_LIVE=1 node data/paid-resources.test.js   (turns the GO-LIVE BLOCKERS below into failures)

   Separate from directory.test.js and site.test.js on purpose.

   What this file protects, in plain terms:
     - the catalogue page is complete, canonical, and links ONLY to the verified Payhip product URL
     - the directory entry and the catalogue page agree on price, level, time and link
     - exactly one paid entry exists (the reviewed one) and every other directory resource is unchanged
     - a paid entry can never take the homepage's red featured slot or enter "Recently added"
     - navigation and sitemap link to the page consistently on every page
     - the About and footer wording stays honest
     - .assetsignore publishes the page while keeping internal files, the Stripe prototype and tools off the site, and the remaining
       go-live blockers are listed */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const paid = require('../tools/build-paid-resources.js');
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

const PAGE = 'paid-resources/index.html';
const html = read(PAGE);
const data = paid.load();
const product = data.products.find((x) => x.id === 'the-exploding-pudding');
const entry = JSON.parse(read('data/resources/the-exploding-pudding.json'));
const VERIFIED_URL = 'https://payhip.com/b/cFa7v';
const BASE = '366b6b064f4af07ebb024c0af3429e4111d7fb19'; /* the redesign baseline commit this branch started from */

/* Pages that carry the site navigation today. */
const NAV_PAGES = ['index.html', 'about.html', 'made-by-frt/index.html', 'stop-the-slop/index.html',
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

console.log('paid-resources page: complete, canonical, indexable');
test('paid-resources/index.html exists and is up to date with the data file (fix: node tools/build-paid-resources.js)', () => {
  assert(exists(PAGE), PAGE + ' is missing');
  const stale = paid.run(true);
  assert(stale.length === 0, 'out of date: ' + stale.join(', '));
});
test('the up-to-date check ignores CRLF versus LF but still catches real content differences', () => {
  const html = paid.build()[0].html;
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
test('has the GapTheMind title, a description, one h1, a canonical URL on the real domain and social tags', () => {
  assert(/<title>Paid resources by GapTheMind — Free Range Tutors<\/title>/.test(html), 'title');
  assert(/<meta name="description" content="[^"]{30,}"/.test(html), 'description');
  assert((html.match(/<h1\b/g) || []).length === 1 && /<h1 class="pr-title">Paid resources<\/h1>/.test(html), 'h1');
  assert(/<link rel="canonical" href="https:\/\/www\.freerangetutors\.com\/paid-resources\/" \/>/.test(html), 'canonical');
  assert(/property="og:url" content="https:\/\/www\.freerangetutors\.com\/paid-resources\/"/.test(html), 'og:url');
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
test('uses the shared design system (tokens + directory.css) and only .pr- selectors of its own', () => {
  assert(html.includes('href="/dispatch-tokens.css"') && html.includes('href="/directory.css"'), 'shared stylesheets');
  const css = read('paid-resources/paid-resources.css');
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').match(/[^{}]+(?=\{)/g) || [];
  const stray = selectors.map((s) => s.trim()).filter((s) => s && !/^\.pr[-\s.:{,]|^\.pr-/.test(s));
  assert(stray.length === 0, 'selectors outside the .pr- namespace: ' + stray.join(' | '));
});
test('the GapTheMind / Free Range Tutors relationship is stated plainly and factually', () => {
  assert(/published under the GapTheMind name/.test(html), 'relationship sentence');
  assert(/<p class="pr-kind">GapTheMind · Partner speaking mystery<\/p>/.test(html), 'card brand label');
  assert(!/guarantee|proven|best-selling|tested in class/i.test(html), 'unverified claim wording');
});

console.log('\npurchase link: only the verified Payhip product URL');
test('the page has exactly one outbound link, the verified product URL, opened in a new tab safely', () => {
  const hrefs = (html.match(/href="[^"]+"/g) || []).map((h) => h.slice(6, -1));
  const external = hrefs.filter((h) => /^https?:/i.test(h) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(h) && !/^https:\/\/www\.freerangetutors\.com\//.test(h));
  assert(external.length === 1 && external[0] === VERIFIED_URL, 'external links: ' + external.join(', '));
  assert(html.includes('href="' + VERIFIED_URL + '" target="_blank" rel="noopener noreferrer"'), 'link attributes');
  assert(!/payhip\.com\/FreeRangeTutors/i.test(html), 'the (currently empty) storefront must not be linked');
});
test('no fake checkout: no form, button, input, iframe or Stripe markup on the page', () => {
  assert(!/<form|<button|<input|<iframe|stripe/i.test(html), 'checkout-like markup found');
});
test('the card shows the price, the level and the time that the directory entry also states', () => {
  const card = (html.match(/<article class="pr-item"[\s\S]*?<\/article>/) || [''])[0];
  assert(/<p class="pr-price">\$1\.99 <small>USD<\/small><\/p>/.test(card), 'price on the card');
  assert(/CEFR B1–B2/.test(card) && /About 25 minutes/.test(card) && /<dd>Pairs<\/dd>/.test(card), 'level/time/groups on the card');
  assert(product.price.amount === 1.99 && /\$1\.99/.test(entry.description_short), 'price differs between the page data and the directory entry');
  assert(/B1–B2/.test(entry.description_short) && JSON.stringify(entry.cefr_level.values) === '["B1","B2"]', 'level differs');
  assert(/about 25 minutes/.test(entry.description_short) && entry.activity_time_minutes === 25, 'time differs');
  assert(entry.group_fit.values.join() === 'pair', 'group differs');
  assert(entry.url === product.payhip_url, 'directory entry URL differs from the catalogue page URL');
});
test('the VAT note matches what Payhip checkout showed (tax may be added)', () => {
  assert(/Tax, such as EU VAT, may be added at checkout\./.test(html), 'tax note missing');
});

console.log('\ndirectory entry: exactly one reviewed paid entry, nothing else changed');
test('entry follows the schema conventions for a paid, GapTheMind-published resource', () => {
  assert(entry.cost === 'paid' && entry.source_category === 'commercial' && entry.creator === 'GapTheMind' && entry.domain === 'payhip.com', 'paid/commercial/creator/domain');
  assert(/^https:\/\/payhip\.com\/b\/[A-Za-z0-9]+$/.test(entry.url), 'URL shape');
  assert(entry.resource_type === 'pdf' && entry.primary_category === 'teaching_materials', 'type/category');
  assert(entry.age_group.mode === 'unknown', 'age_group must stay unknown (no age range is stated in the product)');
  assert(entry.featured === false && entry.status === null, 'featured/status');
  assert(entry.internal_notes && !/payhip\.com\/b\//.test(JSON.stringify(Object.assign({}, entry, { internal_notes: '', url: '' }))), 'no stray product URL in visible fields');
});
test('manifest lists the entry exactly once and lists nothing else new', () => {
  const manifest = JSON.parse(read('data/manifest.json'));
  assert(manifest.filter((i) => i === 'the-exploding-pudding').length === 1, 'not exactly once');
  assert(manifest.length === 20, 'manifest length ' + manifest.length);
  if (!gitAvailable()) { console.log('        (baseline comparison skipped: git or the baseline commit is not available here)'); return; }
  const base = JSON.parse(git(['show', BASE + ':data/manifest.json']));
  assert(JSON.stringify(manifest.filter((i) => i !== 'the-exploding-pudding')) === JSON.stringify(base), 'the 19 existing ids changed or were reordered');
});
test('all 19 existing resource files and originals.json are identical to the baseline commit; only the new entry file was added', () => {
  if (!gitAvailable()) { console.log('        (skipped: git or the baseline commit is not available here)'); return; }
  const changed = git(['diff', '--name-only', '--diff-filter=MDRTU', BASE, '--', 'data/resources', 'data/originals.json']).trim();
  assert(changed === '', 'changed since baseline: ' + changed);
  const added = git(['diff', '--name-only', '--diff-filter=A', BASE, '--', 'data/resources']).split('\n')
    .concat(git(['ls-files', '--others', '--exclude-standard', '--', 'data/resources']).split('\n'))
    .map((s) => s.trim()).filter(Boolean).filter((f, i, a) => a.indexOf(f) === i);
  assert(added.length === 1 && added[0] === 'data/resources/the-exploding-pudding.json', 'unexpected new catalogue files: ' + added.join(', '));
});
test('exactly one resource in the catalogue is paid', () => {
  const manifest = JSON.parse(read('data/manifest.json'));
  const paidIds = manifest.filter((id) => JSON.parse(read('data/resources/' + id + '.json')).cost === 'paid');
  assert(paidIds.join() === 'the-exploding-pudding', 'paid ids: ' + paidIds.join(', '));
});

console.log('\nhomepage: a paid entry cannot take the featured slot or enter "Recently added"');
const dirSrc = read('directory.js');
function extractFn(name) {
  const start = dirSrc.indexOf('function ' + name + '(');
  assert(start !== -1, name + ' not found in directory.js');
  let depth = 0, i = dirSrc.indexOf('{', start);
  for (; i < dirSrc.length; i++) { if (dirSrc[i] === '{') depth++; else if (dirSrc[i] === '}') { depth--; if (!depth) break; } }
  return dirSrc.slice(start, i + 1);
}
function load() {
  return new Function('allResources', 'FEATURED_ID', extractFn('recentPool') + '\n' + extractFn('pickFeatured') + '\nreturn { recentPool: recentPool, pickFeatured: pickFeatured };');
}
const newestFirst = (rs) => rs.slice().sort((a, b) => (b.date_added > a.date_added) ? 1 : -1);
const R = (id, cost, date) => ({ id, cost, date_added: date });
const catalogue = JSON.parse(read('data/manifest.json')).map((id) => JSON.parse(read('data/resources/' + id + '.json')));
function band(resources, featuredId) {
  const fns = load()(resources, featuredId);
  const newest = newestFirst(fns.recentPool(resources));
  const featured = fns.pickFeatured(newest);
  return { featured: featured.id, support: newest.filter((r) => r.id !== featured.id).slice(0, 3).map((r) => r.id) };
}
test('directory.js still ships FEATURED_ID = null and renderFeatured uses the free-only pool and pickFeatured', () => {
  assert(/const FEATURED_ID = null;/.test(dirSrc), 'FEATURED_ID changed');
  assert(/const newest = sortNewestFirst\(recentPool\(allResources\)\);/.test(dirSrc), 'renderFeatured does not use recentPool');
  assert(/const featured = pickFeatured\(newest\);/.test(dirSrc), 'renderFeatured does not use pickFeatured');
});
test('with the real catalogue the featured entry and the 3 supporting items are exactly what they are without the paid entry', () => {
  const withPaid = band(catalogue, null);
  const withoutPaid = band(catalogue.filter((r) => r.cost !== 'paid'), null);
  assert(JSON.stringify(withPaid) === JSON.stringify(withoutPaid), 'band differs: ' + JSON.stringify(withPaid) + ' vs ' + JSON.stringify(withoutPaid));
  assert(withPaid.featured === 'google-arts-culture', 'featured is no longer the pre-existing free resource: ' + withPaid.featured);
  assert(![withPaid.featured].concat(withPaid.support).includes('the-exploding-pudding'), 'the paid entry is in the band');
});
test('a newer paid entry cannot take the featured slot or displace a supporting free item (synthetic cases)', () => {
  const all = [R('a', 'free', '2026-01-01'), R('b', 'freemium', '2026-03-01'), R('c', 'free', '2026-02-01'), R('d', 'free', '2026-01-15'), R('pay', 'paid', '2026-12-31')];
  const b = band(all, null);
  assert(b.featured === 'b' && b.support.join() === 'c,d,a', JSON.stringify(b));
});
test('FEATURED_ID can still deliberately choose a paid entry; an all-paid catalogue falls back to the whole catalogue', () => {
  const all = [R('a', 'free', '2026-01-01'), R('pay', 'paid', '2026-09-09')];
  assert(band(all, 'pay').featured === 'pay', 'explicit choice ignored');
  const onlyPaid = [R('p1', 'paid', '2026-01-01'), R('p2', 'paid', '2026-02-01')];
  assert(band(onlyPaid, null).featured === 'p2', 'fallback');
});

console.log('\ncreator: the directory card and the no-JavaScript list name GapTheMind');
const sourceTextFn = () => new Function(extractFn('sourceText') + '\nreturn sourceText;')();
test('a commercial entry\'s card source line reads "GapTheMind · payhip.com"; every free entry still shows just its domain', () => {
  const f = sourceTextFn();
  assert(f(entry) === 'GapTheMind · payhip.com', 'got: ' + f(entry));
  catalogue.filter((r) => r.cost !== 'paid').forEach((r) => assert(f(r) === r.domain, r.id + ' changed: ' + f(r)));
  assert(/text: sourceText\(r\)/.test(dirSrc), 'the card does not use sourceText');
});
test('the no-JavaScript list names the creator for the paid entry only', () => {
  const items = (read('index.html').match(/<li><a href="https?:[^]*?<\/li>/g) || []);
  const paidLine = items.find((l) => l.includes('payhip.com/b/cFa7v'));
  assert(paidLine && /<\/a> \(GapTheMind\) &mdash; /.test(paidLine), 'creator missing in the noscript line');
  items.filter((l) => l !== paidLine).forEach((l) => assert(!/<\/a> \([^)]*\) &mdash; /.test(l), 'a free entry gained a creator suffix: ' + l.slice(0, 80)));
});

console.log('\nnavigation and sitemap');
test('every page with the site navigation links to /paid-resources/ in both the masthead and the footer, just before About', () => {
  NAV_PAGES.concat([PAGE]).forEach((p) => {
    const s = read(p);
    ['site-nav', 'foot-nav'].forEach((cls) => {
      const m = s.match(new RegExp('<nav class="' + cls + '"[^>]*>([^]*?)</nav>'));
      assert(m, p + ': no ' + cls);
      const links = (m[1].match(/<a [^>]*href="[^"]*"/g) || []).map((a) => a.match(/href="([^"]*)"/)[1]);
      const i = links.indexOf('/paid-resources/');
      assert(i !== -1, p + ': ' + cls + ' lacks the link');
      assert(links[i + 1] === '/about', p + ': ' + cls + ' link is not directly before About');
    });
  });
});
test('only the paid page marks itself aria-current; no other page marks the paid link as current', () => {
  assert(/<a href="\/paid-resources\/" aria-current="page">Paid resources<\/a>/.test(html), 'paid page lacks aria-current');
  NAV_PAGES.forEach((p) => assert(!/<a href="\/paid-resources\/" aria-current/.test(read(p)), p + ' marks it current'));
});
test('sitemap.xml lists /paid-resources/ and build-static reports nothing stale', () => {
  assert(read('sitemap.xml').includes('<loc>https://www.freerangetutors.com/paid-resources/</loc>'), 'not in sitemap.xml');
  const stale = staticRun(true);
  assert(stale.length === 0, 'build-static would change: ' + stale.join(', '));
});
test('the homepage no-JavaScript list includes the paid entry with its Payhip link', () => {
  assert(/<li><a href="https:\/\/payhip\.com\/b\/cFa7v" rel="noopener noreferrer">The Exploding Pudding: Partner Speaking Mystery<\/a>/.test(read('index.html')), 'noscript entry');
});

console.log('\nAbout and footer wording');
test('About acknowledges paid resources and keeps its free-first emphasis', () => {
  const about = read('about.html');
  assert(!/not angled toward monetisation/.test(about) && !/Everything here is free to use/.test(about), 'old claims remain');
  assert(/Some linked resources may be paid\./.test(about) && /Most of what is listed here is free to use/.test(about), 'approved wording missing');
  assert(/name="description" content="About Free Range Tutors: a mostly free, no-login collection/.test(about), 'meta description');
});
test('all five pages and the paid page use the approved footer wording', () => {
  NAV_PAGES.concat([PAGE]).forEach((p) => {
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
test('draft mode never writes a purchase link, even if a product says "live" and has a URL', () => {
  const d = fakeLive(); d.page.status = 'draft';
  const out = paid.render(d);
  assert(!/payhip\.com/i.test(out) && /noindex/.test(out) && !/<script/i.test(out), 'a draft build leaked a link, lost noindex, or loaded a script');
});
test('live mode shows only live products', () => {
  const d = fakeLive(); const extra = clone(d.products[0]); extra.id = 'second-draft'; extra.status = 'draft'; d.products.push(extra);
  const out = paid.render(d);
  assert(out.includes('id="the-exploding-pudding"') && !out.includes('id="second-draft"'), 'draft product shown on a live page');
});
test('live mode refuses: no verification date / bad link / no live products / duplicate ids / missing image', () => {
  let d = fakeLive(); d.products[0].link_verified = null;
  throws(() => paid.render(d), /link_verified/, 'unverified link');
  d = fakeLive(); d.products[0].payhip_url = 'https://example.com/b/AbC12';
  throws(() => paid.render(d), /payhip_url/, 'non-Payhip link');
  d = fakeLive(); d.products[0].status = 'draft';
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
const PUBLIC_MUST_PUBLISH = ['index.html', 'about.html', 'made-by-frt/index.html', 'stop-the-slop/index.html', 'sitemap.xml', 'robots.txt', 'favicon.ico',
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
const PAID_PAGE_FILES = ['paid-resources/index.html', 'paid-resources/paid-resources.css', 'paid-resources/images/the-exploding-pudding.png'];
test('the intended public files AND the three paid-resources page files are published (not excluded), while internal and prototype files stay excluded', () => {
  if (!gitAvailable()) { console.log('        (skipped: git is not available here)'); return; }
  const internal = PROTOTYPE_AND_INTERNAL();
  const ignored = gitIgnored(ignoreText, PUBLIC_MUST_PUBLISH.concat(PAID_PAGE_FILES, internal));
  const hiddenPublic = PUBLIC_MUST_PUBLISH.concat(PAID_PAGE_FILES).filter((f) => ignored.has(f));
  assert(hiddenPublic.length === 0, 'public files that would be hidden: ' + hiddenPublic.join(', '));
  const leaks = internal.filter((f) => !ignored.has(f));
  assert(leaks.length === 0, 'internal/prototype files that would be published: ' + leaks.join(', '));
});
test('the paid-resources folder contains exactly the three expected files, so nothing stray is published with the page', () => {
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
  const found = walk('paid-resources').sort();
  assert(JSON.stringify(found) === JSON.stringify(PAID_PAGE_FILES.slice().sort()), 'paid-resources/ holds: ' + found.join(', '));
});
test('no ignore line is broad enough to hide a legitimate public path by accident (tracked files that are not internal are all published)', () => {
  if (!gitAvailable()) { console.log('        (skipped: git is not available here)'); return; }
  const publicFiles = gitLines(['ls-files']).filter((f) => !/^(tools\/|PROJECT_NOTES\.md$|data\/[^/]+\.(md|test\.js)$|data\/resource\.schema\.json$|.*\.zip$|\.gitattributes$|\.assetsignore$|wrangler\.jsonc$|desktop\.ini$)/.test(f) && !LEGACY_RE.test(f));
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
blockers.push('Cloudflare dashboard settings are unverified (Enable Preview Builds, Version URLs / workers.dev, Root directory, deploy and preview commands, and the cause of the failed 12 Oct build); see the README for the read-only checklist.');
blockers.push('Nothing has been committed, pushed or deployed (needs the owner\'s explicit permission). Any push, even of a branch, starts a Cloudflare build and, as the 11 Oct test branch showed, a PUBLIC workers.dev preview of whatever is committed.');
blockers.push('The Payhip storefront About text is saved as a draft but NOT published (needs the owner to publish it in Payhip).');
blockers.push('The product is Unlisted in Payhip; the owner has decided it should become Visible (a Payhip change, not made).');
blockers.push('EU VAT was added at checkout ($0.42 on $1.99); the owner is to review the VAT arrangements before launch (no tax setting was touched).');
if (blockers.length) {
  console.log('\n  GO-LIVE BLOCKERS (not test failures; set GO_LIVE=1 to make them fail):');
  blockers.forEach((b, i) => console.log('   ' + (i + 1) + '. ' + b));
  if (process.env.GO_LIVE) { fail++; console.log('  FAIL  GO_LIVE=1 and blockers remain'); }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
