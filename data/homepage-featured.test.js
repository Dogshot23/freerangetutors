// Checks for the two homepage features: the featured WEBSITE (the red slot in the "Recently added" band, now Gapminder) and the featured PRODUCT
// (the Christmas Dinner band). Run: node data/homepage-featured.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.)
const fs = require('fs'), path = require('path');
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
// Same rule as directory.js: newest free entry wins the red featured slot when FEATURED_ID is null.
const newestFirst = catalogue.slice().sort((a, b) => (b.date_added > a.date_added) ? 1 : -1);
const featured = newestFirst.filter(r => r.cost !== 'paid').find(r => r.cost !== 'paid');
t('directory.js still lets the newest free entry take the featured slot (FEATURED_ID is null), and that entry is Gapminder, not Google Arts & Culture', /const FEATURED_ID = null;/.test(dirSrc) && featured.id === 'gapminder' && featured.id !== 'google-arts-culture', featured.id);
t('the homepage no-script list links to Gapminder exactly once, at the teaching materials page', (home.match(/href="https:\/\/www\.gapminder\.org\/teaching\/materials\/"/g) || []).length === 1);
t('the homepage no-script list count matches the manifest (it lists every resource, paid included: 33 before, 34 with Gapminder)', (() => { const m = home.match(/here are all (\d+) resources/); return !!m && Number(m[1]) === manifest.length; })());

console.log('\nfeatured product: The Christmas Dinner');
const i = home.indexOf('<section class="cd-feature"');
const seg = i < 0 ? '' : home.slice(i, home.indexOf('</section>', i));
t('the Christmas Dinner band appears exactly once, with its stylesheet link exactly once', (home.match(/<section class="cd-feature"/g) || []).length === 1 && (home.match(/christmas-feature\.css/g) || []).length === 1);
t('its Payhip link is https://payhip.com/b/MWIoz (once), and the other link goes to the catalogue card', (seg.match(/href="https:\/\/payhip\.com\/b\/MWIoz"/g) || []).length === 1 && seg.includes('href="/made-by-frt/#the-christmas-dinner-that-keeps-getting-bigger"'));
t('the catalogue card is still present on /made-by-frt/ with the same Payhip link', read('made-by-frt/index.html').includes('id="the-christmas-dinner-that-keeps-getting-bigger"') && read('made-by-frt/index.html').includes('https://payhip.com/b/MWIoz'));

console.log('\nthe homepage has exactly these two featured areas');
t('the Sixth Astronaut band and its stylesheet link are gone from the homepage', !home.includes('class="ts-feature"') && !home.includes('the-sixth-astronaut.css') && !/ts-feature-h/.test(home));
t('the Sixth Astronaut product page, its stylesheet and its sitemap entry are intact', fs.existsSync(path.join(root, 'resources/the-sixth-astronaut/index.html')) && fs.existsSync(path.join(root, 'resources/the-sixth-astronaut/the-sixth-astronaut.css')) && read('sitemap.xml').includes('<loc>https://www.freerangetutors.com/resources/the-sixth-astronaut/</loc>'));
const order = [...home.matchAll(/<section class="(recent-band|cd-feature|ts-feature)"/g)].map(m => m[1]);
t('section order is: recent band (featured website), then the Christmas Dinner band, with nothing else featured in between', JSON.stringify(order) === JSON.stringify(['recent-band', 'cd-feature']), JSON.stringify(order));
t('navigation, All resources and the directory script are intact', ['#all-resources', '/made-by-frt/', '/stop-the-slop/', '/about'].every(h => home.includes('href="' + h + '"')) && home.includes('id="all-resources"') && home.includes('<script src="directory.js">'));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
