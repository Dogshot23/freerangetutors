// Checks for the homepage "new product" feature band for The Christmas Dinner That Keeps Getting Bigger. Run: node data/christmas-feature.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const home = read('index.html'), css = read('christmas-feature.css'), cat = read('made-by-frt/index.html');
const ID = 'the-christmas-dinner-that-keeps-getting-bigger';
const i = home.indexOf('<section class="cd-feature"');
const seg = i < 0 ? '' : home.slice(i, home.indexOf('</section>', i));
const hrefs = [...seg.matchAll(/href="([^"]+)"/g)].map(m => m[1]);

t('feature section exists exactly once, with its stylesheet link exactly once', (home.match(/<section class="cd-feature"/g) || []).length === 1 && (home.match(/christmas-feature\.css/g) || []).length === 1);
t('it is labelled NEW and has the complete product title as the heading', /class="cd-new">New resource</.test(seg) && /<h2[^>]*>The Christmas Dinner That Keeps Getting Bigger<\/h2>/.test(seg));
t('description says interactive Christmas mystery PDF for English learners; key points: 9 decisions, 5 endings, follow-up activities', /interactive Christmas mystery PDF for English learners/.test(seg) && /9 decisions/.test(seg) && /5 possible endings/.test(seg) && /follow-up activities/.test(seg));
t('links are only the catalogue card anchor and the verified Payhip URL', hrefs.length === 3 && hrefs.every(h => h === '/made-by-frt/#' + ID || h === 'https://payhip.com/b/MWIoz'), JSON.stringify(hrefs));
t('the catalogue anchor exists on /made-by-frt/ and that card still links to the same Payhip URL', cat.includes('id="' + ID + '"') && cat.includes('href="https://payhip.com/b/MWIoz"'));
const img = (seg.match(/<img\b[^>]*>/) || [''])[0];
const src = (img.match(/src="([^"]+)"/) || [])[1];
t('cover image exists on disk and has alt text, width and height', !!src && fs.existsSync(path.join(root, src.slice(1))) && /\balt="[^"]{20,}"/.test(img) && /\bwidth="\d+"/.test(img) && /\bheight="\d+"/.test(img), src);
t('feature is static (no script) and contains no workers.dev address', !/<script/.test(seg) && !/workers\.dev/.test(seg));
t('feature sits directly after the red Website of the Day block and before All resources; the Sixth Astronaut band is gone; the directory markup is intact', home.indexOf('<section class="wotd"') !== -1 && i > home.indexOf('<section class="wotd"') && i < home.indexOf('id="all-resources"') && !home.includes('class="ts-feature"') && home.includes('<script src="directory.js">'));
const cssN = css.replace(/\/\*[\s\S]*?\*\//g, '');
t('stylesheet: only .cd- selectors', [...cssN.matchAll(/^\s*([^@\s}][^{]*)\{/gm)].every(m => m[1].split(',').every(sel => /\.cd-/.test(sel))), [...cssN.matchAll(/^\s*([^@\s}][^{]*)\{/gm)].filter(m => !m[1].split(',').every(sel => /\.cd-/.test(sel))).map(m => m[1].trim()).join(' | '));
t('stylesheet is not excluded from the public site by .assetsignore', !/christmas-feature|^\*\.css/m.test(read('.assetsignore')));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
