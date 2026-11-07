// Checks for the homepage hierarchy: the compact red Website of the Day (with its halftone bleed intact), All resources close to the top, and the
// compact Christmas Dinner card placed inside the list after the first few resources. Run: node data/homepage-layout.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.) The placement tests run the REAL directory.js against a tiny DOM stub.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), cp = require('child_process');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const home = read('index.html'), wotdCss = read('website-of-the-day.css'), cdCss = read('christmas-feature.css'), dirSrc = read('directory.js'), dirCss = read('directory.css');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const manifest = JSON.parse(read('data/manifest.json'));
const catalogue = manifest.map(id => JSON.parse(read('data/resources/' + id + '.json')));

console.log('homepage order');
const at = (needle) => home.indexOf(needle);
t('hierarchy in the page: header and introduction, search and filters, then the compact Website of the Day, then All resources, with the Christmas Dinner card inside the list (after the list container opens)',
  at('class="intro"') > 0 && at('class="intro"') < at('class="index-strip"') && at('class="index-strip"') < at('<section class="wotd"') && at('<section class="wotd"') < at('id="all-resources"') && at('id="all-resources"') < at('id="entries"') && at('id="entries"') < at('<section class="cd-feature"'));
t('the Christmas Dinner card is no longer between the red block and All resources', !/<\/section>\s*<section class="cd-feature"/.test(home) && home.slice(at('</section>', at('<section class="wotd"')), at('id="all-resources"')).indexOf('cd-feature') === -1);
t('each feature appears exactly once: one Website of the Day section, one Christmas card (id cd-promo), no Recently added band, no Sixth Astronaut band', (home.match(/<section class="wotd"/g) || []).length === 1 && (home.match(/<section class="cd-feature"/g) || []).length === 1 && (home.match(/id="cd-promo"/g) || []).length === 1 && !/recent-band|Recently added|ts-feature/.test(home));
t('the card is hidden by CSS until directory.js has placed it (no flash above the list), and the <noscript> rule shows it when JavaScript is off', /\.cd-feature \{[^}]*display: none;/.test(cdCss) && /\.cd-feature\.cd-placed \{ display: block; \}/.test(cdCss) && /<noscript><style>[^<]*#cd-promo \{ display: block; \}/.test(home));

console.log('\nthe Christmas Dinner card keeps its content, links, price and artwork');
const cdStart = home.indexOf('<section class="cd-feature"'), cdHtml = home.slice(cdStart, home.indexOf('</section>', cdStart) + '</section>'.length);
const norm = s => s.replace(/\s+/g, ' ').replace(/> </g, '><').replace(' id="cd-promo"', '').trim();
// Pinned: the card's copy, links, price and image markup exactly as before the layout change (whitespace and the placement id aside).
t('the card markup is the same content as before the redesign (pinned, ignoring indentation and the placement id)', sha(norm(cdHtml)) === 'b3be1f3d07d6898117539be24a3f246bbac4b12a0d022db9f3b9a3ee92c087d0', sha(norm(cdHtml)));
t('its links are the catalogue anchor (twice) and the Payhip URL once, with the US$4.99 price on the Payhip button and the cover image present', (cdHtml.match(/href="\/made-by-frt\/#the-christmas-dinner-that-keeps-getting-bigger"/g) || []).length === 2 && (cdHtml.match(/href="https:\/\/payhip\.com\/b\/MWIoz"/g) || []).length === 1 && />Buy on Payhip &middot; US\$4\.99</.test(cdHtml) && /paid-resources\/images\/the-christmas-dinner-that-keeps-getting-bigger\.png/.test(cdHtml));

console.log('\ncompact Website of the Day: the halftone still bleeds out of the red block');
const wc = strip(wotdCss);
const rule = (css, sel) => { const m = css.match(new RegExp('(?:^|\\})\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? m[1] : ''; };
t('it is still the red field with paper text', /background: var\(--fz-red\)/.test(rule(wc, '.wotd')) && /color: var\(--fz-paper\)/.test(rule(wc, '.wotd')));
t('it is compact: the photograph column is 176px (was 440px), the top padding 18px (was 44px) and the rise 44px (was 72px); no 440px column, no 112px lead-in', /--wotd-photo-w: 176px/.test(rule(wc, '.wotd')) && /--wotd-pad-top: 18px/.test(rule(wc, '.wotd')) && /--wotd-rise: 44px/.test(rule(wc, '.wotd')) && !/440px|margin-top: 112px/.test(wc));
t('the bleed is kept: the photograph is pulled up by (top padding + rise) so it extends above the red block, over the cream', /margin: calc\(-1 \* \(var\(--wotd-pad-top\) \+ var\(--wotd-rise\)\)\) 0 0/.test(rule(wc, '.wotd-photo')));
t('the bleed is not clipped: no overflow rule on .wotd, .wotd-main or .wotd-photo (only the description text clamps), and the picture is not a clipped thumbnail (cover, anchored at the top)', !/overflow/.test(rule(wc, '.wotd')) && !/overflow/.test(rule(wc, '.wotd-main')) && !/overflow/.test(rule(wc, '.wotd-photo')) && /object-fit: cover; object-position: 50% 0/.test(rule(wc, '.wotd-photo img')));
t('the picture stays the transparent halftone: no opacity, blend mode, filter, border or background on the photograph or its image', !/opacity|mix-blend|filter|border|background/.test(rule(wc, '.wotd-photo') + rule(wc, '.wotd-photo img')));
t('the rise never reaches the content above: the block\'s top margin is the rise plus a gap (desktop 28px, phone 22px), and the no-photo layout drops the lead-in', /margin-top: calc\(var\(--wotd-rise\) \+ 28px\)/.test(rule(wc, '.wotd')) && /margin-top: calc\(var\(--wotd-rise\) \+ 22px\)/.test(wc) && /\.wotd\.wotd-no-photo \{ margin-top: 28px; \}/.test(wc));
const phone = (wc.match(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}\n/) || [])[1] || '';
t('on phones the rise (30px) and a 108px photograph on the right are kept, so the bleed survives at narrow widths; at 400px and under the photograph is 92px', /--wotd-photo-w: 108px; --wotd-rise: 30px;/.test(phone) && /grid-column: 2; grid-row: 1 \/ span 4;/.test(phone) && /--wotd-photo-w: 92px/.test(wc));
t('the attribution and licence stay visible: the credit row is kept at every width (never display:none), at 11.5px or more', !/\.wotd-credit \{[^}]*display: none/.test(wc) && /\.wotd-credit \{[^}]*font-size: 12px/.test(wc) && /\.wotd-credit \{[^}]*font-size: 11\.5px/.test(phone));
t('the visit link is kept (a paper button, at least 44px tall) and the name link is unchanged', /\.wotd \.wotd-btn \{[^}]*min-height: 44px/.test(wc) && !/\.wotd-btn \{[^}]*display: none/.test(wc) && !/\.wotd-title-link \{[^}]*display: none/.test(wc));

console.log('\ncompact Christmas Dinner card (CSS)');
const cc = strip(cdCss);
t('it keeps the green and gold identity (holly background, gold borders and buttons) and is a compact horizontal grid: 148px cover on the left', /--cd-holly: #1f3b2e/.test(cc) && /background: var\(--cd-holly\)/.test(cc) && /--cd-gold-deep: #c08a1c/.test(cc) && /\.cd-feature-inner \{[^}]*grid-template-columns: 148px minmax\(0, 1fr\)/.test(cc) && /\.cd-feature-pic \{[^}]*order: -1/.test(cc));
t('it is not the old tall band (no 440px cover, no 56px heading, no 40px band padding)', !/440px|clamp\(32px, 4\.6vw, 56px\)|padding: 40px/.test(cc));
t('on phones the cover sits beside the title (92px, 72px under 380px) and the card stays one block, with the links still shown', /grid-template-columns: 92px minmax\(0, 1fr\)/.test(cc) && /grid-template-columns: 72px minmax\(0, 1fr\)/.test(cc) && !/\.cd-feature-actions \{[^}]*display: none/.test(cc));

console.log('\nintroduction and navigation');
t('the introduction keeps its editorial character: the italic serif lede and the "Made here" box is unchanged apart from The Hollow King replacing Stop the Slop (see data/stop-the-slop-retired.test.js), and the four navigation links remain', /class="intro-lede">A working collection of things worth using for teaching English online/.test(home) && /<a class="intro-link intro-link-img" href="https:\/\/payhip\.com\/b\/ib5Tw"/.test(home) && ['#all-resources', '/rescue/', '/made-by-frt/', '/about'].every(h => (home.match(new RegExp('<nav class="site-nav"[\\s\\S]*?</nav>'))[0]).includes('href="' + h + '"')));
t('the phone adjustments are scoped to the homepage (body.directory) or to homepage-only classes, so other pages sharing directory.css keep their navigation', /body\.directory \.masthead \.site-nav \{ display: flex; flex-wrap: wrap; gap: 0 16px; \}/.test(dirCss));

// ---------------------------------------------------------------------------------------------------------------------------------
console.log('\nplacement of the Christmas card in the list: the real directory.js against a small DOM stub');
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.parentNode = null; this.attrs = {}; this.hidden = false; this.value = ''; this.className = ''; this.listeners = {}; this._text = ''; this.nodeType = 1;
    const self = this; this.classList = { add(c) { if (!self.className.split(' ').includes(c)) self.className = (self.className + ' ' + c).trim(); }, remove(c) { self.className = self.className.split(' ').filter(x => x && x !== c).join(' '); }, toggle(c, on) { on ? this.add(c) : this.remove(c); }, contains(c) { return self.className.split(' ').includes(c); } }; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  set innerHTML(v) { this.children.forEach(c => { c.parentNode = null; }); this.children = []; }
  get innerHTML() { return ''; }
  set textContent(v) { this._text = String(v); } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k]; }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  fire(ev) { (this.listeners[ev] || []).forEach(fn => fn({ type: ev, preventDefault() { }, button: 0 })); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) { const cls = sel.replace('.', ''), out = []; const walk = n => n.children.forEach(c => { if (c.classList.contains(cls)) out.push(c); walk(c); }); walk(this); return out; }
  focus() { }
}
function load() {
  const ids = {};
  ['directory-search', 'filter-category', 'filter-type', 'filter-use', 'filter-level', 'filter-cost', 'quick-picks', 'clear-filters', 'filters-toggle', 'filter-panel', 'filters-count', 'entries', 'directory-empty', 'index-count', 'masthead-home', 'cd-promo'].forEach(id => { ids[id] = new Node('div'); });
  ids['quick-picks'].appendChild((() => { const n = new Node('span'); n.className = 'quick-chips'; return n; })());
  ids['cd-promo'].className = 'cd-feature';
  const document = { getElementById: id => ids[id] || null, createElement: tag => new Node(tag), createTextNode: s => { const n = new Node('#text'); n._text = s; return n; } };
  const FRT = { ready: () => Promise.resolve(catalogue) };
  vm.runInNewContext(dirSrc, { document, window: { scrollTo() { } }, history: { pushState() { } }, FRT, console, Array, Set, Object, String });
  return { ids, entries: ids['entries'] };
}
const kinds = (entries) => entries.children.map(c => c.classList.contains('cd-feature') ? 'CARD' : 'entry');
const names = (entries) => entries.children.filter(c => !c.classList.contains('cd-feature')).map(c => c.querySelector('.entry-title').textContent);
const tick = () => new Promise(r => setImmediate(r));
(async () => {
  const f = load(); await tick();
  const k = kinds(f.entries);
  t('unfiltered: the card is in the list after exactly the first four resources (position 5 of ' + (catalogue.length + 1) + ' children)', k[4] === 'CARD' && k.slice(0, 4).every(x => x === 'entry') && k.filter(x => x === 'CARD').length === 1 && k.length === catalogue.length + 1);
  t('the card is placed, not copied: it is the same node as the page\'s #cd-promo, shown (cd-placed)', f.entries.children[4] === f.ids['cd-promo'] && f.ids['cd-promo'].classList.contains('cd-placed'));
  t('the resource count and the entries are unaffected: "' + catalogue.length + ' total", every resource listed exactly once', f.ids['index-count'].textContent === catalogue.length + ' total' && names(f.entries).length === catalogue.length && new Set(names(f.entries)).size === catalogue.length);
  const baseline = names(f.entries);
  const free = catalogue.filter(r => r.cost !== 'paid').map(r => r.name).sort((a, b) => a.localeCompare(b)), paid = catalogue.filter(r => r.cost === 'paid').map(r => r.name).sort((a, b) => a.localeCompare(b));
  t('sorting is unchanged: free and freemium first, then paid, each alphabetical', JSON.stringify(baseline) === JSON.stringify(free.concat(paid)));

  f.ids['directory-search'].value = 'game'; f.ids['directory-search'].fire('input');
  const matching = catalogue.filter(r => [r.name, r.description_short, (r.teaching_use || []).join(' ')].join(' ').toLowerCase().includes('game'));
  t('with a search active the card is taken out of the list and only the matching resources are shown; the count reads "N matches"', !f.entries.children.includes(f.ids['cd-promo']) && !f.ids['cd-promo'].classList.contains('cd-placed') && names(f.entries).length === matching.length && f.ids['index-count'].textContent === matching.length + (matching.length === 1 ? ' match' : ' matches'));
  f.ids['directory-search'].value = ''; f.ids['directory-search'].fire('input');
  t('clearing the search puts the card back in the same place and restores the full list and count', kinds(f.entries)[4] === 'CARD' && JSON.stringify(names(f.entries)) === JSON.stringify(baseline) && f.ids['index-count'].textContent === catalogue.length + ' total');
  f.ids['filter-cost'].value = 'paid'; f.ids['filter-cost'].fire('change');
  t('with a filter active (cost: paid) the card is not in the list either, and every shown entry is a paid resource', !f.entries.children.includes(f.ids['cd-promo']) && names(f.entries).length === paid.length && JSON.stringify(names(f.entries)) === JSON.stringify(paid));
  f.ids['filter-cost'].value = ''; f.ids['filter-cost'].fire('change');
  t('removing the filter restores the card after the fourth resource', kinds(f.entries)[4] === 'CARD' && names(f.entries).length === catalogue.length);
  f.ids['directory-search'].value = 'zzzz-no-such-resource'; f.ids['directory-search'].fire('input');
  t('no results: the list is empty and the "nothing matches" message shows, with no card', f.entries.children.length === 0 && f.ids['directory-empty'].hidden === false && f.ids['index-count'].textContent === '0 matches');
  f.ids['directory-search'].value = ''; f.ids['directory-search'].fire('input');
  t('and recovers: the list, the card and the message state are all back', kinds(f.entries)[4] === 'CARD' && f.ids['directory-empty'].hidden === true);
  t('the card is shown for a failed data load too (it is not lost): directory.js adds cd-placed in its error path, and the list is never rebuilt around it', /classList\.add\('cd-placed'\)/.test(dirSrc) && /PROMO_AFTER = 4/.test(dirSrc));
  t('placement is in one place only: there is no second renderer of resources, and the card HTML is not duplicated in directory.js', (dirSrc.match(/function renderEntry\b/g) || []).length === 1 && !/MWIoz|payhip\.com\/b|Keeps Getting Bigger|booking book/i.test(dirSrc));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
