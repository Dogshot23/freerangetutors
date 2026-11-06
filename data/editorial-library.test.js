// Checks for the editorial photograph library behind "Website of the Day": metadata, licences, attribution, checksums and the
// processed halftone PNGs. Run: node data/editorial-library.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.) See tools/EDITORIAL_LIBRARY_WORKFLOW.md.
// Needs python with Pillow + numpy for the pixel checks; if they are missing those checks print SKIP (not PASS).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0, skip = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const sk = (name, why) => { skip++; console.log('  SKIP  ' + name + ' (' + why + ')'); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const exists = f => fs.existsSync(path.join(root, f));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
const py = (args, opts) => cp.spawnSync('python', args, Object.assign({ encoding: 'utf8', cwd: root }, opts));
const pyOk = py(['-c', 'import PIL, numpy']).status === 0;

const lib = JSON.parse(read('data/editorial-library.json'));
const entries = Object.entries(lib.images);
const manifest = JSON.parse(read('data/manifest.json'));

console.log('data/editorial-library.json');
const REQUIRED = ['file', 'master', 'master_sha256', 'subject', 'tags', 'status', 'title', 'creator', 'year', 'source_site', 'source_page', 'source_file_url', 'licence', 'licence_url', 'commercial_use', 'licence_evidence', 'attribution_requirements', 'change_note', 'retrieved'];
t('the library has the approved 16 photographs', entries.length === 16, String(entries.length));
t('every key is a lowercase-hyphen id', entries.every(([id]) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)));
t('every entry records image, master, checksum, subject, tags, source, creator, licence, licence evidence, attribution, change note and retrieval date', entries.every(([, e]) => REQUIRED.every(k => e[k] !== undefined && e[k] !== '' && e[k] !== null)), JSON.stringify(entries.map(([id, e]) => [id, REQUIRED.filter(k => !e[k])]).filter(x => x[1].length)));
t('every licence allows commercial use and adaptation (CC0, CC BY or public domain; no NC or ND) and commercial_use is "yes"', entries.every(([, e]) => e.commercial_use === 'yes' && /^(CC0|CC BY( 4\.0| 3\.0)?|CC BY-SA( 4\.0| 3\.0)?|Public domain)/i.test(e.licence) && !/-(NC|ND)|NonCommercial|NoDerivatives/i.test(e.licence)));
t('every source page, source file, licence and evidence URL is https, and the evidence has real text', entries.every(([, e]) => [e.source_page, e.source_file_url, e.licence_url].concat(e.licence_evidence.map(x => x.url)).every(u => /^https:\/\//.test(u)) && e.licence_evidence.length > 0 && e.licence_evidence.every(x => x.text && x.text.length > 40)));
t('retrieval dates are real ISO dates; years are present', entries.every(([, e]) => /^\d{4}-\d{2}-\d{2}$/.test(e.retrieved) && !isNaN(Date.parse(e.retrieved)) && /\d{4}/.test(e.year)));
t('tags are non-empty arrays of lowercase single words, with no duplicates', entries.every(([, e]) => Array.isArray(e.tags) && e.tags.length > 0 && e.tags.every(x => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(x)) && new Set(e.tags).size === e.tags.length));
t('status is "active" or "reserve", and the antique microscope is the one reserve photograph (kept, never matched)', entries.every(([, e]) => ['active', 'reserve'].includes(e.status)) && entries.filter(([, e]) => e.status === 'reserve').map(([id]) => id).join() === 'microscope-antique');
t('no library id clashes with a directory resource id (these are photographs, not websites)', entries.every(([id]) => !manifest.includes(id)));

console.log('\nattribution');
const by = entries.filter(([, e]) => /^CC BY/i.test(e.licence));
t('exactly the three CC BY photographs need credit: the mountain, the classroom and the museum hall', by.map(([id]) => id).sort().join() === 'classroom-empty,mountain-peak,museum-hall', by.map(([id]) => id).join());
t('each CC BY entry has credit_required true, names the creator and the licence, links the licence, says the image was changed, and the change note says halftone', by.every(([, e]) => e.credit_required === true && e.attribution_requirements.includes(e.creator) && /^https:\/\/creativecommons\.org\/licenses\/by\//.test(e.licence_url) && /changed/i.test(e.attribution_requirements) && /halftone/i.test(e.change_note) && e.creator.length > 3));
t('every entry has a change note describing the halftone adaptation, so the credit line on the homepage always states the change', entries.every(([, e]) => /halftone/i.test(e.change_note) && /Free Range Tutors/.test(e.change_note)));
t('the homepage credit is built from every entry: title, creator, source site, licence and its link are all present as plain text fields', entries.every(([, e]) => [e.title, e.creator, e.source_site, e.licence].every(v => typeof v === 'string' && v.length > 2)));
t('public-domain items from archives point at the institution\'s own record (Library of Congress, Met, USFWS), not only at Wikimedia Commons', ['world-map-1719', 'newspaper-window', 'radio-boardinghouse'].every(id => /^https:\/\/www\.loc\.gov\//.test(lib.images[id].source_page)) && /metmuseum\.org/.test(lib.images['microscope-antique'].source_page) && /flickr\.com\/photos\/usfwsmtnprairie/.test(lib.images['great-blue-heron'].source_page));
t('the Library of Congress entries carry the record\'s own rights statement as evidence', ['world-map-1719', 'newspaper-window', 'radio-boardinghouse'].every(id => lib.images[id].licence_evidence.some(x => /no known restrictions|free to use and reuse/i.test(x.text))));

console.log('\nfiles and checksums');
// The full-resolution masters are LOCAL-ONLY (.gitignore excludes them and .assetsignore keeps them off the site), so a fresh clone does not
// have them. None present: the checks that need them print SKIP (never PASS) and everything else still runs. All present: they run.
// Only some present: something was deleted or damaged, which is a failure, not a skip.
const mastersPresent = entries.filter(([, e]) => exists(e.master)).length;
const MASTERS = mastersPresent === 0 ? 'none' : mastersPresent === entries.length ? 'all' : 'partial';
const NO_MASTERS = 'masters absent: they are local-only, see .gitignore';
console.log('  (masters on disk: ' + mastersPresent + ' of ' + entries.length + (MASTERS === 'none' ? '; master-dependent checks will SKIP' : '') + ')');
t('processed PNGs are under images/editorial/library/ and all exist; each master path is under images/resources/_masters/library/', entries.every(([id, e]) => e.file === 'images/editorial/library/' + id + '.png' && /^images\/resources\/_masters\/library\/[a-z0-9-]+\.(jpg|png|tif|tiff)$/.test(e.master) && exists(e.file)));
if (MASTERS === 'none') sk('every master file exists', NO_MASTERS);
else t('every master file exists (all 16 or none: a partial set means a master was deleted)', MASTERS === 'all', entries.filter(([, e]) => !exists(e.master)).map(([id]) => id).join());
if (MASTERS === 'none') sk('each master\'s SHA-256 matches the recorded checksum', NO_MASTERS);
else t('each master\'s SHA-256 matches the recorded checksum', entries.filter(([, e]) => exists(e.master)).every(([, e]) => sha(e.master) === e.master_sha256), entries.filter(([, e]) => exists(e.master) && sha(e.master) !== e.master_sha256).map(([id]) => id).join());
t('no two entries share a processed image, a master or a checksum', new Set(entries.map(([, e]) => e.file)).size === entries.length && new Set(entries.map(([, e]) => e.master)).size === entries.length && new Set(entries.map(([, e]) => e.master_sha256)).size === entries.length);
t('masters are excluded from the public site (.assetsignore lists images/resources/_masters/)', /^images\/resources\/_masters\/$/m.test(read('.assetsignore')));
if (MASTERS === 'none') sk('masters are real full-resolution originals, not previews (minimum size)', NO_MASTERS);
else if (!pyOk) sk('masters are real full-resolution originals (minimum size)', 'python Pillow not available');
else t('masters are real full-resolution originals, not previews (each at least 2000 px on its long side)', (() => {
  const r = py(['-c', 'import sys, json\nfrom PIL import Image\nImage.MAX_IMAGE_PIXELS = None\nprint(json.dumps({p: max(Image.open(p).size) for p in sys.argv[1:]}))'].concat(entries.filter(([, e]) => exists(e.master)).map(([, e]) => path.join(root, e.master))));
  try { const d = JSON.parse(r.stdout); return Object.values(d).every(v => v >= 2000); } catch (e) { return false; }
})());

console.log('\nthe masters are kept out of Git and out of the site');
t('.gitignore excludes images/resources/_masters/library/ (and only that: the older tracked masters are not ignored)', /^images\/resources\/_masters\/library\/$/m.test(read('.gitignore')) && !/^images\/resources\/_masters\/?$/m.test(read('.gitignore')));
{
  const probe = (p) => cp.spawnSync('git', ['--no-optional-locks', 'check-ignore', '-q', p], { cwd: root });
  const a = probe('images/resources/_masters/library/world-map-1719.jpg');
  if (a.error || a.status === 128) sk('git check-ignore on the masters', 'not a git checkout, or git not available');
  else {
    t('git itself ignores every master path in the library', entries.every(([, e]) => probe(e.master).status === 0));
    t('git does not ignore the processed PNGs, the library metadata or the older tracked masters', probe('images/editorial/library/chess-set.png').status === 1 && probe('data/editorial-library.json').status === 1 && probe('images/resources/_masters/gapminder-900.png').status === 1);
  }
}

console.log('\nprocessed halftone PNGs');
if (!pyOk) sk('halftone pixel checks', 'python Pillow/numpy not available');
else {
  const code = [
    'import sys, json, numpy as np', 'from PIL import Image', 'res = {}',
    'for p in sys.argv[1:]:', '    im = Image.open(p); a = np.asarray(im.convert("RGBA")); al = a[..., 3]; ink = a[al > 0][:, :3]',
    '    res[p] = {"size": list(im.size), "mode": im.mode, "transparent": float((al == 0).mean()), "partial": float(((al > 0) & (al < 255)).mean()), "ink_unique": [list(map(int, u)) for u in np.unique(ink, axis=0)[:3]]}',
    'print(json.dumps(res))'
  ].join('\n');
  const r = py(['-c', code].concat(entries.map(([, e]) => path.join(root, e.file))));
  let m = null; try { m = JSON.parse(r.stdout); } catch (e) { }
  const all = m ? Object.values(m) : [];
  t('every halftone is a 1100 x 1364 RGBA PNG (same size and format as the Gapminder and Holyoke photographs)', all.length === entries.length && all.every(x => x.size[0] === 1100 && x.size[1] === 1364 && x.mode === 'RGBA'), r.stderr || r.stdout.slice(0, 200));
  t('every halftone is printed in the same near-black ink (#17140F) with anti-aliased dot edges and real see-through areas (not near-black, not near-blank)', all.length === entries.length && all.every(x => x.ink_unique.length === 1 && JSON.stringify(x.ink_unique[0]) === '[23,20,15]' && x.partial > 0.01 && x.transparent > 0.12 && x.transparent < 0.9), JSON.stringify(m && Object.entries(m).filter(([, x]) => !(x.transparent > 0.12 && x.transparent < 0.9)).map(([p, x]) => [path.basename(p), x.transparent])));
}
t('the Recently added photograph is untouched: images/editorial/feature-gapminder.png still has its original checksum and its metadata entry still exists', sha('images/editorial/feature-gapminder.png') === '63b766087940bdfc33516a8b029ad9240fb98df129683224a722e1c6858634da' && !!JSON.parse(read('data/featured-images.json')).images.gapminder);

console.log('\nREPRODUCIBLE: the unchanged script turns a master into the committed PNG');
const script = read('tools/make_feature_halftone.py');
t('tools/make_feature_halftone.py is unchanged in look: width 1100, height 1364, pitch 9, 45 degrees, supersample 3, ink #17140F, no look settings', /^W = 1100\b/m.test(script) && /^H_OUT = 1364\b/m.test(script) && /^PITCH = 9\b/m.test(script) && /^ANGLE = math\.radians\(45\)/m.test(script) && /^SS = 3\b/m.test(script) && /^INK = \(0x17, 0x14, 0x0F\)/m.test(script) && !/add_argument\('--(pitch|angle|width|ink|opacity|contrast|gamma|blur)/.test(script));
if (!pyOk) sk('reproducibility', 'python Pillow/numpy not available');
else {
  // Three representative entries (a plain one, one with a custom crop focus, one from an archive): the pipeline regenerates the committed PNG exactly.
  ['hove-library-shelves', 'mountain-peak', 'newspaper-window'].forEach(id => {
    const e = lib.images[id], tmp = path.join(os.tmpdir(), 'frt-lib-' + id + '-' + process.pid + '.png');
    if (!exists(e.master)) { sk(id + ': reproducible from its master', NO_MASTERS); return; }
    const args = [path.join(root, 'tools', 'make_feature_halftone.py'), id, path.join(root, e.master), '--out', tmp].concat(e.halftone_focus ? ['--focus', e.halftone_focus] : []);
    const run = py(args);
    const cmp = py(['-c', 'import sys, numpy as np\nfrom PIL import Image\na = np.asarray(Image.open(sys.argv[1]).convert("RGBA")).astype(int); b = np.asarray(Image.open(sys.argv[2]).convert("RGBA")).astype(int)\nprint(a.shape == b.shape and int(np.abs(a - b).max()))', path.join(root, e.file), tmp]);
    try { fs.unlinkSync(tmp); } catch (x) { }
    t(id + ': running the script on its master (' + (e.halftone_focus ? '--focus ' + e.halftone_focus : 'default crop') + ') gives back the committed PNG (max pixel difference 0)', run.status === 0 && cmp.stdout.trim() === '0', (run.stderr || '') + ' diff=' + cmp.stdout.trim());
  });
}
console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skip ? ', ' + skip + ' skipped' : '')); process.exit(fail ? 1 : 0);
