// Checks for retiring Stop the Slop from the site and putting The Hollow King in the homepage "Made here" box.
// Run: node data/stop-the-slop-retired.test.js   (data/*.test.js is hidden from the public site by .assetsignore.)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const exists = f => fs.existsSync(path.join(root, f));
const home = read('index.html');

const TPT = 'https://www.teacherspayteachers.com/Product/Choose-Your-Path-Horror-Story-The-Hollow-King-ESL-B1-B2-Ages-12-14-18110927';

// ---- every file that could carry a link, outside the retired page's own folder ----
const SKIP_DIRS = new Set(['.git', 'node_modules', 'stop-the-slop', '_archived-activities', 'files3', 'files4', '.playwright-mcp']);
function walk(dir, out) {
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach(e => {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(rel, out); }
    else if (/\.(html|js|json|xml|css|txt)$/.test(e.name) && !/\.test\.js$/.test(e.name)) out.push(rel);
  });
  return out;
}
const files = walk('', []);

console.log('Stop the Slop is gone from everything the site shows');
const offenders = files.filter(f => f !== '_redirects' && /stop-the-slop|Stop the Slop/i.test(read(f)));
t('no public page, script, stylesheet, data file or generator mentions /stop-the-slop/ or "Stop the Slop" (the retired folder itself and the redirect rules aside)', offenders.length === 0, offenders.join(', '));
const pages = files.filter(f => /\.html$/.test(f));
t('every page with the site navigation has exactly the four links Resources, Rescue Cards, Made by FRT, About, and a footer without Stop the Slop', pages.every(p => { const m = read(p).match(/<nav class="site-nav" aria-label="Site">([\s\S]*?)<\/nav>/); if (!m) return true; return JSON.stringify([...m[1].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(x => x[2])) === JSON.stringify(['Resources', 'Rescue Cards', 'Made by FRT', 'About']); }));
t('the homepage footer keeps its other links (Made by FRT, About) and has no Stop the Slop', /<nav class="foot-nav" aria-label="Footer">[\s\S]*?href="\/made-by-frt\/"[\s\S]*?href="\/about"[\s\S]*?<\/nav>/.test(home) && !/foot-nav[\s\S]*stop-the-slop/i.test(home));
t('the sitemap has no Stop the Slop and still lists the other pages', !read('sitemap.xml').includes('stop-the-slop') && ['/', '/made-by-frt/', '/about', '/rescue/'].every(u => read('sitemap.xml').includes('<loc>https://www.freerangetutors.com' + u + '</loc>')));
t('the catalogue records are gone: not in data/originals.json or tools/catalogue.json, and no card or Read more link on the Made by FRT page', !JSON.parse(read('data/originals.json')).some(o => o.id === 'stop-the-slop') && !JSON.parse(read('tools/catalogue.json')).items.some(i => i.id === 'stop-the-slop') && !/id="stop-the-slop"|Slop Check Sheet/.test(read('made-by-frt/index.html')));
t('rebuilding does not bring it back: the catalogue, rescue, static and paid-resources builds all report the files up to date, and their sources do not mention it', ['build-catalogue', 'build-rescue', 'build-static', 'build-paid-resources'].every(b => cp.spawnSync(process.execPath, [path.join(root, 'tools', b + '.js'), '--check'], { encoding: 'utf8' }).status === 0) && !/stop-the-slop/i.test(read('tools/build-catalogue.js') + read('tools/build-rescue.js') + read('tools/build-static.js')));

console.log('\nthe old page, PDFs and artwork are kept');
t('the source page, its stylesheet and script, both PDFs and its images are still in the repository', ['stop-the-slop/index.html', 'stop-the-slop/stop-the-slop.css', 'stop-the-slop/stop-the-slop.js', 'pdfs/stop-the-slop-guide.pdf', 'pdfs/stop-the-slop-check-sheet.pdf', 'images/stop-the-slop/cover.jpg', 'images/social/stop-the-slop-og.png'].every(exists));
t('nothing hides them from a future reuse: none is listed in .assetsignore (the PDFs and images stay reachable by direct link)', !/stop-the-slop/.test(read('.assetsignore')));

console.log('\nthe old URL redirects permanently');
const rules = read('_redirects').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/\s+/));
const resolve = (u) => { const r = rules.find(x => x[0] === u || (x[0].endsWith('/*') && u.startsWith(x[0].slice(0, -1)))); return r ? r[1] + ' ' + r[2] : null; };
t('/stop-the-slop, /stop-the-slop/, /stop-the-slop/index.html and anything under the folder (its stylesheet, script, a deep link) redirect with 301 to /made-by-frt/', ['/stop-the-slop', '/stop-the-slop/', '/stop-the-slop/index.html', '/stop-the-slop/stop-the-slop.css', '/stop-the-slop/stop-the-slop.js', '/stop-the-slop/anything/else'].every(u => resolve(u) === '/made-by-frt/ 301'));
t('unrelated URLs do not redirect: the homepage, the catalogue, the PDFs, the images, the other pages and look-alike paths', ['/', '/made-by-frt/', '/about', '/rescue/', '/pdfs/stop-the-slop-guide.pdf', '/pdfs/stop-the-slop-check-sheet.pdf', '/images/stop-the-slop/cover.jpg', '/images/social/stop-the-slop-og.png', '/stop-the-sloppy/', '/resources/the-sixth-astronaut/', '/data/originals.json'].every(u => resolve(u) === null));
t('every rule is permanent (301) and points only at /made-by-frt/', rules.every(r => r.length === 3 && r[1] === '/made-by-frt/' && r[2] === '301'));

console.log('\nThe Hollow King in "Made here"');
const box = (home.match(/<div class="intro-aside">([\s\S]*?)<\/div>/) || [])[1] || '';
const cards = [...box.matchAll(/<a class="intro-link[^"]*"[\s\S]*?<\/a>/g)].map(m => m[0]);
t('the box holds exactly two cards: The Hollow King first (where Stop the Slop was), then Made by Free Range Tutors', cards.length === 2 && /The Hollow King/.test(cards[0]) && /Made by Free Range Tutors/.test(cards[1]));
const hk = cards[0] || '';
t('The Hollow King links to the published TPT listing (and nowhere else), opening in a new tab with noopener noreferrer', (hk.match(/href="([^"]+)"/g) || []).length === 1 && hk.includes('href="' + TPT + '"') && /target="_blank"/.test(hk) && /rel="noopener noreferrer"/.test(hk));
t('the tag reads "Interactive story" in the same tag style as before (.tag-new), and the description is the approved wording', /<span class="tag-new">Interactive story<\/span>/.test(hk) && />Reading that feels like a video game\. An interactive horror adventure where every decision changes what happens next &nearr;<\/span>/.test(hk) && /<span class="intro-link-t">The Hollow King</.test(hk));
t('the old "New, free" tag and the old wording are gone from the page', !/New, free|checking AI-assisted teaching resources/.test(home));
const imgSrc = (hk.match(/<img[^>]*src="([^"]+)"/) || [])[1];
const jpg = imgSrc && exists(imgSrc.slice(1)) ? fs.readFileSync(path.join(root, imgSrc.slice(1))) : null;
const jpgSize = (b) => { let i = 2; while (i < b.length) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1]; if (m >= 0xC0 && m <= 0xC3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } return null; };
t('the thumbnail exists on disk at /images/made-here/the-hollow-king.jpg, is a real JPEG 192px wide (160 to 240px), under 30KB, and is the approved RC3 cover (pinned by checksum)', imgSrc === '/images/made-here/the-hollow-king.jpg' && !!jpg && jpg[0] === 0xFF && jpg[1] === 0xD8 && (() => { const s = jpgSize(jpg); return !!s && s[0] >= 160 && s[0] <= 240 && s[0] === s[1]; })() && jpg.length < 30000 && crypto.createHash('sha256').update(jpg).digest('hex') === '8a86ef3fcd429db0bb9f515852adfa560b9ca4a8ae2d929b75f18bb605840909');
t('the image is displayed small (72px, 56px on phones), is decorative (empty alt, the card text names the product) and lazy-loaded, with its size set to avoid layout shift', /width="72" height="72"/.test(hk) && /alt=""/.test(hk) && /loading="lazy"/.test(hk) && /\.intro-thumb \{[^}]*width: 72px; height: 72px;/.test(read('directory.css')) && /\.intro-thumb \{ width: 56px; height: 56px; \}/.test(read('directory.css')));
t('the Made by Free Range Tutors card is exactly as before', box.includes('<a class="intro-link" href="/made-by-frt/"><span class="intro-link-t">Made by Free Range Tutors</span><span class="intro-link-d">Free and paid resources made by Free Range Tutors &rarr;</span></a>'));
t('no duplicate product was created: no Hollow King resource record, manifest entry, catalogue card or paid-resource draft, and the TPT link appears once on the homepage and nowhere else in the site', !fs.readdirSync(path.join(root, 'data/resources')).some(f => /hollow/i.test(f)) && !/hollow/i.test(read('data/manifest.json') + read('data/originals.json') + read('tools/catalogue.json') + read('tools/payhip-drafts/paid-resources.json')) && !exists('pdfs/the-hollow-king.pdf') && (home.match(/teacherspayteachers\.com/g) || []).length === 1 && files.filter(f => f !== 'index.html' && f !== 'directory.css' && /Hollow King|18110927/i.test(read(f))).length === 0);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
