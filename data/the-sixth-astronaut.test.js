// Checks for the live "The Sixth Astronaut" page (its separate homepage feature band was removed; see the homepage check below) (Payhip product Jsj4h, US$4.99). Run: node data/the-sixth-astronaut.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const dir = 'resources/the-sixth-astronaut';
const page = read(dir + '/index.html'), home = read('index.html'), css = read(dir + '/the-sixth-astronaut.css');

function localRefs(html) {
  const out = []; html = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of html.matchAll(/(?:href|src)="([^"#]+)(#[^"]*)?"/g)) {
    const u = m[1]; if (/^(https?:|mailto:|data:)/.test(u)) continue; out.push([u, m[2] || '']);
  }
  return out;
}
function resolves(u, from) { const rel = u.startsWith('/') ? u.slice(1) : path.posix.join(from, u); const p = path.join(root, rel); return (fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, 'index.html')))) || fs.existsSync(p + '.html'); }  // '/about' is served from about.html

t('product page: every local link, image and stylesheet resolves', localRefs(page).every(([u]) => resolves(u, dir)), JSON.stringify(localRefs(page).filter(([u]) => !resolves(u, dir))));
t('homepage: every local link, image and stylesheet still resolves', localRefs(home).every(([u]) => resolves(u, '')), JSON.stringify(localRefs(home).filter(([u]) => !resolves(u, ''))));
const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
t('product page: every #anchor link points at an existing id', [...page.matchAll(/href="#([^"]+)"/g)].every(m => ids.has(m[1])), [...page.matchAll(/href="#([^"]+)"/g)].filter(m => !ids.has(m[1])).map(m => m[1]).join());
t('product page: has canonical URL on the real domain, a title, a description and exactly one h1', /rel="canonical" href="https:\/\/www\.freerangetutors\.com\/resources\/the-sixth-astronaut\/"/.test(page) && /<title>[^<]+<\/title>/.test(page) && /name="description"/.test(page) && (page.match(/<h1[ >]/g) || []).length === 1);
t('product page: every image has alt text, width and height', [...page.matchAll(/<img\b[^>]*>/g)].every(m => /\balt="[^"]{10,}"/.test(m[0]) && /\bwidth="\d+"/.test(m[0]) && /\bheight="\d+"/.test(m[0])));
t('product page: nav matches the site (Resources, Made by FRT, Stop the Slop, About)', ['/#all-resources', '/made-by-frt/', '/stop-the-slop/', '/about'].every(h => page.includes('href="' + h + '"')));
// links to Payhip: none while the product is hidden
const PAYHIP = 'https://payhip.com/b/Jsj4h';
const payLinks = [...page.matchAll(/<a[^>]*href="([^"]*payhip[^"]*)"[^>]*>/g)].map(m => m[1]);
t('both purchase buttons link to the verified Payhip product URL, and nothing else on the page links to Payhip', payLinks.length === 2 && payLinks.every(u => u === PAYHIP) && (page.match(/data-purchase-link/g) || []).length === 2, JSON.stringify(payLinks));
t('no draft leftovers: noindex, review banner, draft-price label, placeholder text, "link coming"', !/noindex|ts-review-only|ts-draft|ts-price-draft|PLACEHOLDER|link coming|ts-btn-pending/i.test(page) && !/ts-draft|ts-btn-pending|ts-price-draft/.test(css));
t('page is listed in sitemap.xml', read('sitemap.xml').includes('<loc>https://www.freerangetutors.com/resources/the-sixth-astronaut/</loc>'));
t('sample link points at the hosted copy and the file exists', page.includes('href="/resources/the-sixth-astronaut/THE_SIXTH_ASTRONAUT_interactive_sample.pdf" data-sample-link') && fs.existsSync(path.join(root, dir, 'THE_SIXTH_ASTRONAUT_interactive_sample.pdf')));
const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, dir, 'THE_SIXTH_ASTRONAUT_interactive_sample.pdf'))).digest('hex');
t('hosted sample is byte-identical to the approved interactive_sample_v2 (SHA-256 ff780a60...)', h.startsWith('ff780a60ca015642'), h);
t('hosted sample is a 13-page PDF', (fs.readFileSync(path.join(root, dir, 'THE_SIXTH_ASTRONAUT_interactive_sample.pdf')).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 13);
// claims the page must not make
const body = page.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
const claims = /(testimonials?|rated|stars?|customer reviews?|teacher reviews?|reviews|guarantee[ds]?|proven|improves?|boosts?|raises?|best[- ]selling|bestseller)/ig;
const bodyNoBanner = body;
t('no reviews, endorsements, outcome or guarantee wording (outside the review-only banner)', !claims.test(bodyNoBanner), (bodyNoBanner.match(claims) || []).join());
t('page states the checked facts (154 pages, 29 scenes, 19 decision pages, 10 endings, 74 routes, 13-page sample)', ['154', '29', '19, two choices each', '10 possible', '74', '13 pages and working buttons'].every(x => body.includes(x)));
t('AI illustration disclosure present', /illustrations in this story were generated with AI image tools/.test(body));
t('homepage: the separate Sixth Astronaut feature band and its stylesheet link are gone (the product page, its sitemap entry and its catalogue-independent checks above are unchanged), and the recent band and directory markup are intact', !/class="ts-feature"/.test(home) && !home.includes('the-sixth-astronaut.css') && home.includes('<section class="recent-band"') && home.includes('id="all-resources"') && home.includes('<script src="directory.js">'));
const cssN = css.replace(/\/\*[\s\S]*?\*\//g, '');
t('stylesheet: only .ts- selectors', [...cssN.matchAll(/^([^@\s}][^{]*)\{/gm)].every(m => m[1].split(',').every(sel => /\.ts-/.test(sel)  || /^\s*a:focus-visible\.ts-btn/.test(sel))), [...cssN.matchAll(/^([^@\s}][^{]*)\{/gm)].filter(m => !m[1].split(',').every(sel => /\.ts-/.test(sel))).map(m => m[1].trim()).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
