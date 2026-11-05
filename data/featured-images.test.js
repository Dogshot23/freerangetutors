// Checks for the featured-website halftone photograph system. Run: node data/featured-images.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.) See tools/FEATURED_IMAGE_WORKFLOW.md.
// Needs python with Pillow + numpy for the pixel checks; if they are missing those checks print SKIP (not PASS).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0, skip = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const sk = (name, why) => { skip++; console.log('  SKIP  ' + name + ' (' + why + ')'); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const exists = f => fs.existsSync(path.join(root, f));
const data = JSON.parse(read('data/featured-images.json'));
const manifest = JSON.parse(read('data/manifest.json'));
const recs = manifest.map(id => JSON.parse(read('data/resources/' + id + '.json')));
const py = (args, opts) => cp.spawnSync('python', args, Object.assign({ encoding: 'utf8', cwd: root }, opts));
const pyOk = (() => { const r = py(['-c', 'import PIL, numpy']); return r.status === 0; })();

console.log('data/featured-images.json');
const entries = Object.entries(data.images);
const REQUIRED = ['file', 'master', 'master_sha256', 'title', 'creator', 'year', 'source_site', 'source_page', 'source_file_url', 'licence', 'licence_url', 'commercial_use', 'licence_evidence', 'attribution_requirements', 'change_note', 'retrieved'];
t('every entry records source, creator, licence, licence evidence, attribution, change note and retrieval date', entries.length > 0 && entries.every(([, e]) => REQUIRED.every(k => e[k] !== undefined && e[k] !== '' && e[k] !== null)), JSON.stringify(entries.map(([id, e]) => [id, REQUIRED.filter(k => !e[k])])));
t('every licence allows commercial use and adaptation (CC0, CC BY, CC BY-SA or public domain; no NC or ND) and commercial_use is "yes"', entries.every(([, e]) => e.commercial_use === 'yes' && /^(CC0|CC BY( 4\.0| 3\.0)?|CC BY-SA( 4\.0| 3\.0)?|Public domain)/i.test(e.licence) && !/-(NC|ND)|NonCommercial|NoDerivatives/i.test(e.licence)));
t('every source URL, licence URL and evidence URL is https, and the evidence quotes are non-empty', entries.every(([, e]) => [e.source_page, e.source_file_url, e.licence_url].concat(e.licence_evidence.map(x => x.url)).every(u => /^https:\/\//.test(u)) && e.licence_evidence.length > 0 && e.licence_evidence.every(x => x.text && x.text.length > 20)));
t('retrieval dates are real ISO dates', entries.every(([, e]) => /^\d{4}-\d{2}-\d{2}$/.test(e.retrieved) && !isNaN(Date.parse(e.retrieved))));
t('every key is a real directory resource id', entries.every(([id]) => manifest.includes(id)), JSON.stringify(entries.map(([id]) => id).filter(id => !manifest.includes(id))));
t('files: halftone under images/editorial/, master under images/resources/_masters/ (not published), both exist, master hash matches', entries.every(([, e]) => /^images\/editorial\/feature-[a-z0-9-]+\.png$/.test(e.file) && /^images\/resources\/_masters\//.test(e.master) && exists(e.file) && exists(e.master) && crypto.createHash('sha256').update(fs.readFileSync(path.join(root, e.master))).digest('hex') === e.master_sha256));
t('no two websites share a photograph (file or master): each featured website has its own', new Set(entries.map(([, e]) => e.file)).size === entries.length && new Set(entries.map(([, e]) => e.master)).size === entries.length && new Set(entries.map(([, e]) => e.master_sha256)).size === entries.length);
t('the retired Holyoke photograph is not attached to any current website', !entries.some(([, e]) => /holyoke/i.test(e.file + e.master)) && !!data.retired['holyoke-1941']);
t('masters are excluded from the public site (.assetsignore lists images/resources/_masters/)', /^images\/resources\/_masters\/$/m.test(read('.assetsignore')));

console.log('\nthe currently featured website');
// Same rule as directory.js: newest FREE entry wins the red slot while FEATURED_ID is null.
const dirSrc = read('directory.js');
const newest = recs.slice().sort((a, b) => (b.date_added > a.date_added) ? 1 : -1).filter(r => r.cost !== 'paid');
const featured = newest[0];
t('directory.js still lets the newest free entry take the featured slot (FEATURED_ID is null)', /const FEATURED_ID = null;/.test(dirSrc));
t('the featured website (' + featured.id + ') has its own photograph entry, so adding a free website without one fails here', !!data.images[featured.id], 'add an entry by following tools/FEATURED_IMAGE_WORKFLOW.md');
const fe = data.images[featured.id];
if (fe) {
  t('its credit names the creator, the licence and the change, and the creator is Zoriah Miller for Gapminder', featured.id !== 'gapminder' || (fe.creator === 'Zoriah Miller' && fe.licence === 'CC BY 4.0' && /halftone/i.test(fe.change_note)));
  if (pyOk) {
    const code = [
      'import sys, json, numpy as np', 'from PIL import Image',
      'im = Image.open(sys.argv[1]); a = np.asarray(im.convert("RGBA"))',
      'al = a[..., 3]; ink = a[al > 0][:, :3]',
      'print(json.dumps({"size": list(im.size), "mode": im.mode, "transparent": float((al == 0).mean()), "opaque": float((al == 255).mean()), "partial": float(((al > 0) & (al < 255)).mean()), "ink_unique": [list(map(int, u)) for u in np.unique(ink, axis=0)[:3]]}))'
    ].join('\n');
    const r = py(['-c', code, path.join(root, fe.file)]);
    let m = null; try { m = JSON.parse(r.stdout); } catch (e) { }
    t('its halftone is a 1100 x 1364 RGBA PNG with a transparent background (same size and format as the Holyoke original)', !!m && m.size[0] === 1100 && m.size[1] === 1364 && m.mode === 'RGBA', r.stderr || r.stdout);
    t('it is printed in the same near-black ink (#17140F), with anti-aliased dot edges, and has real see-through areas', !!m && m.ink_unique.length === 1 && JSON.stringify(m.ink_unique[0]) === '[23,20,15]' && m.partial > 0.01 && m.transparent > 0.15 && m.transparent < 0.85, JSON.stringify(m));
  } else { sk('halftone pixel checks', 'python Pillow/numpy not available'); }
}

console.log('\nREGRESSION: the reusable script reproduces the Holyoke halftone');
const hol = data.retired['holyoke-1941'];
if (!pyOk) sk('Holyoke regression', 'python Pillow/numpy not available');
else if (!exists(hol.master)) sk('Holyoke regression', hol.master + ' is not in this checkout');
else {
  const tmp = path.join(os.tmpdir(), 'frt-holyoke-regress-' + process.pid + '.png');
  const run = py([path.join(root, 'tools', 'make_feature_halftone.py'), 'holyoke-1941', path.join(root, hol.master), '--crop', hol.regression_crop, '--out', tmp]);
  const cmp = py(['-c', 'import sys, numpy as np\nfrom PIL import Image\na = np.asarray(Image.open(sys.argv[1]).convert("RGBA")).astype(int); b = np.asarray(Image.open(sys.argv[2]).convert("RGBA")).astype(int)\nprint(a.shape == b.shape and int(np.abs(a - b).max()))', path.join(root, hol.file), tmp]);
  try { fs.unlinkSync(tmp); } catch (e) { }
  t('running tools/make_feature_halftone.py on the Holyoke source with its original crop gives back the committed PNG (max pixel difference 0)', run.status === 0 && cmp.stdout.trim() === '0', (run.stderr || '') + ' diff=' + cmp.stdout.trim());
}
const script = read('tools/make_feature_halftone.py');
t('the script locks the look: width 1100, height 1364, pitch 9, 45 degrees, supersample 3, ink #17140F, and takes no look settings', /^W = 1100\b/m.test(script) && /^H_OUT = 1364\b/m.test(script) && /^PITCH = 9\b/m.test(script) && /^ANGLE = math\.radians\(45\)/m.test(script) && /^SS = 3\b/m.test(script) && /^INK = \(0x17, 0x14, 0x0F\)/m.test(script) && !/add_argument\('--(pitch|angle|width|ink|opacity|contrast|gamma|blur)/.test(script));

console.log('\nhomepage wiring');
const home = read('index.html'), css = read('directory.css');
t('index.html no longer hard-codes any photograph or credit: the img has no src and the credit is an empty placeholder', !/halftone-holyoke|images\/editorial/.test(home) && !/Collier/.test(home) && /<figure class="recent-photo" aria-hidden="true">\s*<img width="1100" height="1364" alt="" decoding="async" \/>/.test(home) && /<p class="foot-credit" id="foot-credit" hidden><\/p>/.test(home));
t('directory.js looks the photograph up by the featured id, has no fallback to another site, and builds the credit from the entry (creator, licence link, change note)', /fetch\('\/data\/featured-images\.json'\)/.test(dirSrc) && /renderFeaturePhoto\(featured\.id\)/.test(dirSrc) && /data\.images\[id\]/.test(dirSrc) && !/holyoke/i.test(dirSrc) && /p\.creator/.test(dirSrc) && /p\.licence_url/.test(dirSrc) && /p\.change_note/.test(dirSrc));
t('the CSS that places the photograph is untouched: 440px column, 72px rise, 50% 0 crop, negative top margin, 700px mobile layout, no opacity or blend mode', /--photo-w: 440px;/.test(css) && /--photo-rise: 72px;/.test(css) && /object-fit: cover; object-position: 50% 0;/.test(css) && /margin: calc\(-44px - var\(--photo-rise\)\) 0 0;/.test(css) && /\.recent-photo \{ order: -1; width: 78%; height: 250px;/.test(css) && !/\.recent-photo[^{]*\{[^}]*(opacity|mix-blend-mode)/.test(css));
t('the Christmas Dinner band is still present once and the Sixth Astronaut band is still absent', (home.match(/<section class="cd-feature"/g) || []).length === 1 && !/class="ts-feature"/.test(home) && home.includes('https://payhip.com/b/MWIoz'));
console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skip ? ', ' + skip + ' skipped' : '')); process.exit(fail ? 1 : 0);
