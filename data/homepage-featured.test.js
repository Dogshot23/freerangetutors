// Checks for the homepage's two featured areas: the red feature block (the Website of the Day, which replaced the old "Recently added" band)
// and the featured PRODUCT (the Christmas Dinner band), plus the Gapminder assets, which are kept unchanged (and are now what the Website of the Day shows when Gapminder is selected). Run: node data/homepage-featured.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const home = read('index.html'), dirSrc = read('directory.js');
const manifest = JSON.parse(read('data/manifest.json'));
const rec = id => JSON.parse(read('data/resources/' + id + '.json'));
const catalogue = manifest.map(rec);

console.log('featured website: Gapminder');
const g = rec('gapminder');
t('Gapminder is in the manifest exactly once and Google Arts & Culture is still in the directory', manifest.filter(i => i === 'gapminder').length === 1 && manifest.includes('google-arts-culture'));
t('record links to the Gapminder teaching materials page on the official domain, is free, and credits Gapminder', g.url === 'https://www.gapminder.org/teaching/materials/' && g.domain === 'gapminder.org' && g.cost === 'free' && g.creator === 'Gapminder' && g.source_category === 'curated_external');
t('thumbnail is a real 480x480 PNG under images/resources/', (() => { const p = path.join(root, g.image); if (!fs.existsSync(p)) return false; const b = fs.readFileSync(p); return b[0] === 0x89 && b.readUInt32BE(16) === 480 && b.readUInt32BE(20) === 480 && g.image === 'images/resources/gapminder.png'; })());
t('description only makes claims checked on gapminder.org (no lesson plans, worksheets, age ranges, CEFR levels or counts)', !/lesson plan|worksheet|ages? \d|CEFR|A1|A2|B1|B2|\d+ (countries|homes|families|photos)/i.test(g.description_short + ' ' + (g.teacher_note || '')) && /Dollar Street/.test(g.description_short) && /free/i.test(g.description_short));
t('age, CEFR and group fit are left unknown (Gapminder does not state them)', g.age_group.mode === 'unknown' && g.cefr_level.mode === 'unknown' && g.group_fit.mode === 'unknown');
// The red feature block used to be the "Recently added" band (featuring the newest free resource, Gapminder). It is now the Website of the Day.
const wotdCss = read('website-of-the-day.css');
t('the homepage\'s red feature block is the Website of the Day: one <section class="wotd"> with a flat red field, paper text, and the 440px halftone column that rises over the field', (home.match(/<section class="wotd"/g) || []).length === 1 && /\.wotd \{[^}]*background: var\(--fz-red\);[^}]*color: var\(--fz-paper\);/.test(wotdCss) && /--wotd-photo-w: 440px;/.test(wotdCss) && /--wotd-rise: 72px;/.test(wotdCss) && /margin-top: 112px;/.test(wotdCss));
t('the old Recently added band is gone from the homepage and its code is gone from directory.js, so nothing competes with the Website of the Day', !/recent-band|recent-photo|Recently added/i.test(home) && !/renderFeatured|FEATURED_ID|recentPool|pickFeatured/.test(dirSrc));
const WOTD = require('../website-of-the-day.js');
const pinnedImages = JSON.parse(read('data/featured-images.json')).images;
t('Gapminder is in the Website of the Day rotation (no newest-resource exclusion), and when it is selected the red block shows its own pinned photograph, not a generic library one', (() => { const pool = WOTD.eligibleWebsites(catalogue); const k = pool.findIndex(r => r.id === 'gapminder'); if (k < 0 || WOTD.rotationPool !== undefined) return false; const d = new Date(Date.UTC(2026, 0, 5 + 7 * Math.floor(k / 5) + (k % 5))); const pick = WOTD.pickForDate(catalogue, [], d); return pick.website.id === 'gapminder' && WOTD.choosePhoto(pick, {}, pinnedImages) === pinnedImages.gapminder && pinnedImages.gapminder.file === 'images/editorial/feature-gapminder.png'; })());
t('the homepage still hard-codes no photograph or credit: the red block is filled by website-of-the-day.js from data/featured-images.json and data/editorial-library.json', !/feature-gapminder|Zoriah|Dollar Street \(Gapminder\)/.test(home) && /featured-images\.json/.test(read('website-of-the-day.js')) && /editorial-library\.json/.test(read('website-of-the-day.js')));
t('the homepage no-script list links to Gapminder exactly once, at the teaching materials page', (home.match(/href="https:\/\/www\.gapminder\.org\/teaching\/materials\/"/g) || []).length === 1);
t('the homepage no-script list count matches the manifest (it lists every resource, paid included: 33 before, 34 with Gapminder)', (() => { const m = home.match(/here are all (\d+) resources/); return !!m && Number(m[1]) === manifest.length; })());

console.log('\nfeatured product: The Christmas Dinner');
const i = home.indexOf('<section class="cd-feature"');
const seg = i < 0 ? '' : home.slice(i, home.indexOf('</section>', i));
t('the Christmas Dinner band appears exactly once, with its stylesheet link exactly once', (home.match(/<section class="cd-feature"/g) || []).length === 1 && (home.match(/christmas-feature\.css/g) || []).length === 1);
t('its Payhip link is https://payhip.com/b/MWIoz (once), and the other link goes to the catalogue card', (seg.match(/href="https:\/\/payhip\.com\/b\/MWIoz"/g) || []).length === 1 && seg.includes('href="/made-by-frt/#the-christmas-dinner-that-keeps-getting-bigger"'));
t('the catalogue card is still present on /made-by-frt/ with the same Payhip link', read('made-by-frt/index.html').includes('id="the-christmas-dinner-that-keeps-getting-bigger"') && read('made-by-frt/index.html').includes('https://payhip.com/b/MWIoz'));

console.log('\nthe homepage has exactly these two featured areas (the red Website of the Day block, then the Christmas Dinner band)');
t('the Sixth Astronaut band and its stylesheet link are gone from the homepage', !home.includes('class="ts-feature"') && !home.includes('the-sixth-astronaut.css') && !/ts-feature-h/.test(home));
t('the Sixth Astronaut product page, its stylesheet and its sitemap entry are intact', fs.existsSync(path.join(root, 'resources/the-sixth-astronaut/index.html')) && fs.existsSync(path.join(root, 'resources/the-sixth-astronaut/the-sixth-astronaut.css')) && read('sitemap.xml').includes('<loc>https://www.freerangetutors.com/resources/the-sixth-astronaut/</loc>'));
const order = [...home.matchAll(/<section class="(recent-band|wotd|cd-feature|ts-feature)"/g)].map(m => m[1]);
t('section order is: the red Website of the Day block, then the Christmas Dinner band, with nothing else featured (no Recently added band)', JSON.stringify(order) === JSON.stringify(['wotd', 'cd-feature']), JSON.stringify(order));
t('navigation, All resources and the directory script are intact', ['#all-resources', '/made-by-frt/', '/stop-the-slop/', '/about'].every(h => home.includes('href="' + h + '"')) && home.includes('id="all-resources"') && home.includes('<script src="directory.js">'));

console.log('\nthe Christmas Dinner feature and the Gapminder assets are unchanged by the homepage change');
const sha = (txt) => crypto.createHash('sha256').update(txt).digest('hex');
const lf = (f) => read(f).replace(/\r\n/g, '\n');
const cdStart = lf('index.html').indexOf('<section class="cd-feature"'), cdHtml = lf('index.html').slice(cdStart, lf('index.html').indexOf('</section>', cdStart) + '</section>'.length);
t('the Christmas Dinner band markup and its stylesheet are byte-for-byte what they were (pinned)', sha(cdHtml) === 'd3d0fe8ab2498341dff5ac65b6fb53618c9f5ebcfeb58d38f673a8c41b997b95' && sha(lf('christmas-feature.css')) === '116eca0ede1d7b461378d412a5c5050df0a8f3126fb16dd34753efdd914099e5');
t('the Gapminder feature assets are unchanged (pinned): the halftone photograph and its licence/metadata file are byte-for-byte as before, and the Gapminder resource is still in the catalogue', sha(fs.readFileSync(path.join(root, 'images/editorial/feature-gapminder.png'))) === '63b766087940bdfc33516a8b029ad9240fb98df129683224a722e1c6858634da' && sha(lf('data/featured-images.json')) === '8c7efd28f38e2e4fa99dfd39a4951e6fe2e426c4be2b164eea1658f844fa5050' && manifest.includes('gapminder'));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
