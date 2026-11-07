// Tests for the homepage "Website of the Day" feature: weekday rotation, pool eligibility, tag-based photograph matching,
// fallbacks, rendering and homepage wiring. Run: node data/website-of-the-day.test.js
// (data/*.test.js is hidden from the public site by .assetsignore.) The rotation/matching code under test is the REAL
// website-of-the-day.js (it exports its pure functions), not a copy. See data/SCHEMA.md ("Website of the Day").
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const W = require(path.join(root, 'website-of-the-day.js'));
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : (extra ? '\n        ' + extra : ''))); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const DAY = 864e5;
const U = (y, m, d, h, mi, s, ms) => new Date(Date.UTC(y, m - 1, d, h || 0, mi || 0, s || 0, ms || 0));
const ids = list => list.map(r => r.id);

const manifest = JSON.parse(read('data/manifest.json'));
const catalogue = manifest.map(id => JSON.parse(read('data/resources/' + id + '.json')));
const libData = JSON.parse(read('data/editorial-library.json')).images;
const library = Object.keys(libData).map(id => ({ id, tags: libData[id].tags, status: libData[id].status }));
const site = (id, date, extra) => Object.assign({ id, name: id, url: 'https://example.org/' + id, source_category: 'curated_external', date_added: date || '2026-09-23', cost: 'free', resource_type: 'website' }, extra || {});

// ---------------------------------------------------------------------------------------------
console.log('weekday index (UTC, Monday to Friday)');
// Independent oracle: the number of Monday-to-Friday days in [anchor, day], minus one. Weekends add nothing.
const ANCHOR = Date.UTC(2026, 0, 5);
let oracleOk = true, oracleDays = 0, oracleBad = '';
{
  let count = 0;
  for (let ms = ANCHOR; ms <= Date.UTC(2031, 0, 1); ms += DAY) {
    const d = new Date(ms), dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) count++;
    oracleDays++;
    if (W.weekdayIndex(d) !== count - 1) { oracleOk = false; oracleBad = d.toISOString() + ' got ' + W.weekdayIndex(d) + ' want ' + (count - 1); break; }
  }
}
t('matches an independent weekday count for every day from 5 Jan 2026 to 1 Jan 2031 (' + oracleDays + ' days, includes month, year and leap-day boundaries)', oracleOk, oracleBad);
t('the anchor Monday 5 Jan 2026 is 0 and Tuesday to Friday are 1 to 4', [5, 6, 7, 8, 9].map(d => W.weekdayIndex(U(2026, 1, d))).join() === '0,1,2,3,4');
t('Saturday and Sunday show Friday: 10 and 11 Jan 2026 are 4, and the following Monday continues at 5 (the rotation does not restart on Monday)', W.weekdayIndex(U(2026, 1, 10)) === 4 && W.weekdayIndex(U(2026, 1, 11)) === 4 && W.weekdayIndex(U(2026, 1, 12)) === 5);
t('today in the project (Fri 6 Nov 2026, Sat 7, Sun 8) share one index and Monday 9 Nov is the next', W.weekdayIndex(U(2026, 11, 6)) === W.weekdayIndex(U(2026, 11, 7)) && W.weekdayIndex(U(2026, 11, 7)) === W.weekdayIndex(U(2026, 11, 8)) && W.weekdayIndex(U(2026, 11, 9)) === W.weekdayIndex(U(2026, 11, 6)) + 1);
t('time of day does not matter: 00:00:00.000 and 23:59:59.999 UTC give the same index', W.weekdayIndex(U(2026, 3, 4, 0, 0, 0, 0)) === W.weekdayIndex(U(2026, 3, 4, 23, 59, 59, 999)));
t('the UTC date decides, not the visitor\'s time zone: 23:30 on Friday in New York (04:30 UTC Saturday) is still Friday\'s number; 00:30 Monday in Tokyo (15:30 UTC Sunday) is too', W.weekdayIndex(new Date('2026-11-06T23:30:00-05:00')) === W.weekdayIndex(U(2026, 11, 6)) && W.weekdayIndex(new Date('2026-11-09T00:30:00+09:00')) === W.weekdayIndex(U(2026, 11, 6)));
t('month boundary: Fri 30 Jan 2026 is 19 and Mon 2 Feb is 20', W.weekdayIndex(U(2026, 1, 30)) === 19 && W.weekdayIndex(U(2026, 2, 2)) === 20);
t('year boundary: Thu 31 Dec 2026 and Fri 1 Jan 2027 are consecutive, and the weekend and Monday 4 Jan 2027 continue the sequence', W.weekdayIndex(U(2027, 1, 1)) === W.weekdayIndex(U(2026, 12, 31)) + 1 && W.weekdayIndex(U(2027, 1, 3)) === W.weekdayIndex(U(2027, 1, 1)) && W.weekdayIndex(U(2027, 1, 4)) === W.weekdayIndex(U(2027, 1, 1)) + 1);
t('leap day: Tue 29 Feb 2028 follows Mon 28 Feb and precedes Wed 1 Mar by exactly one', W.weekdayIndex(U(2028, 2, 29)) === W.weekdayIndex(U(2028, 2, 28)) + 1 && W.weekdayIndex(U(2028, 3, 1)) === W.weekdayIndex(U(2028, 2, 29)) + 1);
t('dates before the anchor still count down one per weekday (Mon 29 Dec 2025 is -5, Fri 2 Jan 2026 is -1, the weekend after it is -1)', W.weekdayIndex(U(2025, 12, 29)) === -5 && W.weekdayIndex(U(2026, 1, 2)) === -1 && W.weekdayIndex(U(2026, 1, 3)) === -1 && W.weekdayIndex(U(2026, 1, 4)) === -1);
t('accepts a timestamp as well as a Date', W.weekdayIndex(U(2026, 3, 4).getTime()) === W.weekdayIndex(U(2026, 3, 4)));
t('the day label names the weekday being shown: Saturday 7 Nov 2026 reads "Friday 6 November"; Monday 9 Nov reads "Monday 9 November"', W.formatDay(U(2026, 11, 7)) === 'Friday 6 November' && W.formatDay(U(2026, 11, 9)) === 'Monday 9 November');

// ---------------------------------------------------------------------------------------------
console.log('\nwhich resources are eligible (the pool)');
const mixed = [
  site('b-site', '2026-09-23'), site('a-site', '2026-09-23'), site('newest', '2026-11-01'), site('oldest', '2025-05-20'),
  site('paid-product', '2026-10-17', { source_category: 'commercial', cost: 'paid' }),
  site('our-own', '2026-10-17', { source_category: 'own_original' }),
  { id: 'no-url', source_category: 'curated_external', date_added: '2026-01-01' },
  site('paid-but-external', '2026-10-20', { cost: 'paid' })
];
t('only source_category "curated_external" is eligible: commercial (the paid GapTheMind products) and own_original are excluded, as are records without a url', ids(W.eligibleWebsites(mixed)).every(i => !['paid-product', 'our-own', 'no-url'].includes(i)) && ids(W.eligibleWebsites(mixed)).includes('b-site'));
t('stable order: date_added ascending, then id (oldest, a-site, b-site, newest, paid-but-external keeps its date)', ids(W.eligibleWebsites(mixed)).join() === 'oldest,a-site,b-site,paid-but-external,newest', ids(W.eligibleWebsites(mixed)).join());
t('input order does not matter and the input array is not mutated', (() => { const copy = mixed.slice(); const a = ids(W.eligibleWebsites(copy.slice().reverse())).join(); return a === ids(W.eligibleWebsites(mixed)).join() && copy.every((r, i) => r === mixed[i]); })());
t('real catalogue: every pool member is curated_external, none is a GapTheMind / commercial product, and the pool equals the curated_external records exactly', (() => {
  const pool = W.eligibleWebsites(catalogue), want = catalogue.filter(r => r.source_category === 'curated_external');
  return pool.length === want.length && pool.length > 0 && pool.every(r => r.source_category === 'curated_external') && !pool.some(r => r.source_category === 'commercial' || r.gtmk_relationship) && catalogue.filter(r => r.source_category === 'commercial').every(r => !ids(pool).includes(r.id));
})());

// ---------------------------------------------------------------------------------------------
console.log('\nwhich website on which day');
const POOL = W.eligibleWebsites(catalogue), N = POOL.length;   // the rotation cycles through EVERY eligible (curated_external) website: nothing is left out
const monday = U(2026, 11, 9);
t('a different website every weekday: any ' + N + ' consecutive weekdays show ' + N + ' distinct websites (no repeat until the list is exhausted)', (() => {
  for (let start = 0; start < 3 * N; start++) {
    const seen = new Set();
    for (let k = 0; k < N; k++) seen.add(W.pickWebsite(catalogue, new Date(Date.UTC(2026, 0, 5) + Math.floor((start + k) / 5) * 7 * DAY + ((start + k) % 5) * DAY)).website.id);
    if (seen.size !== N) return false;
  }
  return true;
})());
t('after N weekdays the cycle repeats from the start, and it continues across weeks without restarting on Monday', (() => {
  const a = W.pickWebsite(catalogue, U(2026, 11, 6)), b = W.pickWebsite(catalogue, U(2026, 11, 9));
  const c = W.pickWebsite(catalogue, new Date(U(2026, 11, 9).getTime() + (N / 5) * 7 * DAY * (N % 5 === 0 ? 1 : 0)));
  return b.position === (a.position + 1) % N && (N % 5 !== 0 || c.website.id === b.website.id);
})());
t('Friday\'s website stays through Saturday and Sunday and Monday moves on', (() => {
  const f = W.pickWebsite(catalogue, U(2026, 11, 6)).website.id, sa = W.pickWebsite(catalogue, U(2026, 11, 7, 12)).website.id, su = W.pickWebsite(catalogue, U(2026, 11, 8, 23, 59, 59)).website.id, mo = W.pickWebsite(catalogue, monday).website.id;
  return f === sa && sa === su && mo !== f;
})());
t('every visitor gets the same answer for the same UTC date (pure: repeated calls and different times of day agree)', W.pickWebsite(catalogue, U(2026, 11, 10, 1)).website.id === W.pickWebsite(catalogue, U(2026, 11, 10, 22)).website.id);
t('the real catalogue never rotates in a paid or commercial product, over two full years of weekdays', (() => {
  for (let k = 0; k < 520; k++) { const r = W.pickWebsite(catalogue, new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY)).website; if (r.source_category !== 'curated_external') return false; }
  return true;
})());
t('empty pool returns null; a pool of one always returns that site', W.pickWebsite([], monday) === null && W.pickWebsite([site('x')], monday).website.id === 'x' && W.pickWebsite([site('x')], U(2027, 3, 3)).website.id === 'x' && W.pickWebsite([site('p', '2026-01-01', { source_category: 'commercial' })], monday) === null);

console.log('\nadding a website');
const base3 = [site('a', '2026-01-01'), site('b', '2026-02-01'), site('c', '2026-03-01')];
const added = base3.concat([site('d-new', '2026-11-06')]);
t('a new curated_external record joins the pool automatically (there is no second list) and, being newest, goes to the end so existing order is untouched', ids(W.eligibleWebsites(added)).join() === 'a,b,c,d-new');
t('it is shown within the next cycle', (() => { const seen = new Set(); for (let k = 0; k < 4; k++) seen.add(W.pickWebsite(added, new Date(ANCHOR + k * DAY)).website.id); return seen.has('d-new'); })());
t('unavoidable trade-off, documented: adding a site changes the pool size, so the position (index mod N) shifts and today\'s website can change; nothing is stored, so nothing can be preserved', (() => {
  let changed = 0; for (let k = 0; k < 12; k++) { const d = new Date(ANCHOR + k * DAY); if (W.pickWebsite(base3, d).website.id !== W.pickWebsite(added, d).website.id) changed++; }
  return changed > 0;
})());
t('a paid or commercial record added to the catalogue changes nothing', (() => { const withPaid = base3.concat([site('gtmk-pack', '2026-11-06', { source_category: 'commercial', cost: 'paid' })]); for (let k = 0; k < 12; k++) { const d = new Date(ANCHOR + k * DAY); if (W.pickWebsite(base3, d).website.id !== W.pickWebsite(withPaid, d).website.id) return false; } return true; })());

// ---------------------------------------------------------------------------------------------
console.log('\nthe rotation pool: every eligible website, with nothing left out');
const weekdaySeq = (resources, n) => { const out = []; for (let k = 0; k < n; k++) out.push(W.pickWebsite(resources, new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY)).website.id); return out; };
const weekdayDate = (k) => new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY);
const sitesDated = (spec) => spec.map(([id, d, x]) => site(id, d, x));
{ // the real catalogue
  const independent = catalogue.filter(r => r && r.source_category === 'curated_external' && r.id && r.url);   // counted without the module
  t('the pool is exactly the curated_external websites that have an id and a URL (counted independently of the module), with none left out', N === independent.length && ids(POOL).slice().sort().join() === ids(independent).slice().sort().join(), N + ' vs ' + independent.length);
  t('the pool is the expanded one: at least 20 websites. The old newest-date exclusion (which left the newest free resource out and made the pool 19) and its fallback are gone from the module', N >= 20 && !('rotationPool' in W) && !('recentlyAddedGroup' in W));
  t('the stable order is unchanged: date_added ascending, then id (plain string comparison), so the newest resource is last', POOL.every((r, i) => i === 0 || String(POOL[i - 1].date_added) < String(r.date_added) || (String(POOL[i - 1].date_added) === String(r.date_added) && POOL[i - 1].id < r.id)) && POOL[N - 1].date_added === independent.map(r => r.date_added).sort().pop());
  t('Gapminder is eligible: it is in the pool (it is the newest resource, so last in the order)', ids(POOL).includes('gapminder') && POOL[N - 1].id === 'gapminder');
  t('Gapminder appears in the rotation naturally: exactly once in any ' + N + ' consecutive weekdays, with no special treatment', (() => { for (let s = 0; s < 2 * N; s++) if (weekdaySeq(catalogue, s + N).slice(s).filter(i => i === 'gapminder').length !== 1) return false; return true; })());
  t('plain rule, nothing else: the website for weekday number k is simply pool[k mod N] of the (date_added, id)-ordered pool, for two years of weekdays', (() => { for (let k = 0; k < 520; k++) if (W.pickWebsite(catalogue, weekdayDate(k)).website.id !== POOL[k % N].id) return false; return true; })());
  t('a different website every weekday: any ' + N + ' consecutive weekdays show ' + N + ' distinct websites (a clean cycle through the whole pool)', (() => { for (let s = 0; s < 2 * N; s++) if (new Set(weekdaySeq(catalogue, s + N).slice(s)).size !== N) return false; return true; })());
  t('deterministic: the same catalogue and date always give the same website, whatever the time of day and however the records are ordered; the input is not mutated', (() => { const copy = catalogue.slice(); const a = weekdaySeq(catalogue, 40).join(), b = weekdaySeq(catalogue.slice().reverse(), 40).join(); return a === b && catalogue.every((r, i) => r === copy[i]) && W.pickWebsite(catalogue, U(2026, 12, 15, 1)).website.id === W.pickWebsite(catalogue, U(2026, 12, 15, 22)).website.id; })());
  t('adding one more website to the real catalogue makes the pool ' + (N + 1) + ', puts it last, and shows it once per cycle', (() => { const more = catalogue.concat([site('brand-new', '2026-12-01')]); const e = W.eligibleWebsites(more); return e.length === N + 1 && e[N].id === 'brand-new' && weekdaySeq(more, N + 1).filter(i => i === 'brand-new').length === 1; })());
}
{ // newest-date resources are ordinary members of the pool
  const single = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['d', '2026-11-05']]);
  t('a single newest-date resource is in the pool and is shown in its turn (a, b, c, d)', ids(W.eligibleWebsites(single)).join() === 'a,b,c,d' && weekdaySeq(single, 4).join() === 'a,b,c,d');
  const multi = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['e', '2026-11-01'], ['f', '2026-11-01']]);
  t('several resources sharing the newest date are all in the pool, ordered by id (a, b, e, f)', weekdaySeq(multi, 4).join() === 'a,b,e,f');
  const batch = sitesDated([['a', '2026-09-23'], ['b', '2026-09-23'], ['c', '2026-09-23'], ['d', '2026-09-23'], ['e', '2026-09-23']]);
  t('a whole batch added on one day rotates normally: 5 distinct sites in 5 weekdays, in id order', weekdaySeq(batch, 5).join() === 'a,b,c,d,e');
  const two = sitesDated([['a', '2026-01-01'], ['b', '2026-11-05']]), one = sitesDated([['only', '2026-11-05']]);
  t('small pools need no special case: two sites alternate, and a single site is shown every weekday', weekdaySeq(two, 4).join() === 'a,b,a,b' && weekdaySeq(one, 7).every(i => i === 'only') && W.pickForDate(one, library, monday).website.id === 'only');
  t('a record without a date_added is still eligible (it sorts first)', ids(W.eligibleWebsites([site('b', '2026-01-01'), { id: 'nodate', name: 'nodate', url: 'https://example.org/nodate', source_category: 'curated_external' }])).join() === 'nodate,b');
  t('paid and commercial products and FRT originals are still not eligible, however new they are', ids(W.eligibleWebsites(sitesDated([['a', '2026-01-01'], ['gtmk', '2026-12-01', { source_category: 'commercial', cost: 'paid' }], ['frt-tool', '2026-12-02', { source_category: 'own_original' }], ['nourl', '2026-12-03', { url: '' }]]))).join() === 'a');
  t('with nothing to rotate (no eligible websites) the result is null and nothing throws', W.pickWebsite([], monday) === null && W.pickWebsite(undefined, monday) === null && W.pickForDate([], library, monday) === null && W.pickWebsite([site('p', '2026-01-01', { source_category: 'commercial', cost: 'paid' })], monday) === null && W.eligibleWebsites(null).length === 0);
}
{ // weekends, determinism, photographs
  const fri = W.pickForDate(catalogue, library, U(2026, 11, 6)), sat = W.pickForDate(catalogue, library, U(2026, 11, 7)), sun = W.pickForDate(catalogue, library, U(2026, 11, 8, 23, 59)), mon = W.pickForDate(catalogue, library, monday);
  t('weekend retention: Friday\'s website and photograph stay through Saturday and Sunday and Monday moves on', fri.website.id === sat.website.id && sat.website.id === sun.website.id && fri.photoId === sat.photoId && sat.photoId === sun.photoId && mon.website.id !== fri.website.id);
  t('deterministic: the same date, catalogue and library always give the same website and photograph, whatever the time of day', (() => { const a = W.pickForDate(catalogue, library, U(2026, 12, 15, 1)), b = W.pickForDate(catalogue, library, U(2026, 12, 15, 22)); return a.website.id === b.website.id && a.photoId === b.photoId; })());
  t('photograph matching uses the same pool as the website choice, and pickForDate reports the pool size', (() => { for (let k = 0; k < 3 * N; k++) { const p = W.pickForDate(catalogue, library, weekdayDate(k)); if (p.photoId !== W.photoIdForIndex(POOL, library, p.index) || p.poolSize !== N) return false; } return true; })());
  t('the same photograph still never appears on two weekdays running, and the reserve microscope is still never used', (() => { let prev = null; for (let k = 0; k < 4 * N; k++) { const p = W.pickForDate(catalogue, library, weekdayDate(k)).photoId; if (p === 'microscope-antique' || (p && p === prev)) return false; prev = p; } return true; })());
  t('text-only fallback is unchanged: a website with no matching photograph is still picked, with no photograph', (() => { const s = sitesDated([['a', '2026-01-01', { image_tags: ['zzz'] }], ['b', '2026-02-01', { image_tags: ['zzz'] }], ['c', '2026-11-05']]); const p = W.pickForDate(s, library, weekdayDate(0)); return p.website.id === 'a' && p.photoId === null; })());
}
console.log('\ntags');
t('image_tags are used when present (trimmed, lower-cased, de-duplicated, non-strings ignored)', W.tagsFor({ image_tags: [' Maps ', 'maps', 'WORLD', 7, null, ''] }).join() === 'maps,world');
t('missing image_tags: tags are derived from existing fields, so a new website still gets a plausible photograph', (() => { const g = W.tagsFor({ resource_type: 'game', primary_category: 'games', teaching_use: ['vocabulary'] }); return g.includes('games') && g.includes('words'); })());
t('empty image_tags fall back to the derived tags; no usable fields gives an empty list, not an error', W.tagsFor({ image_tags: [], resource_type: 'video' }).includes('video') && W.tagsFor({}).length === 0 && W.tagsFor(null).length === 0 && W.tagsFor(undefined).length === 0);

console.log('\nphotograph matching');
const lib = [
  { id: 'zeta-map', tags: ['maps', 'world'] }, { id: 'alpha-map', tags: ['maps', 'world'] }, { id: 'one-tag', tags: ['maps'] },
  { id: 'books', tags: ['books'] }, { id: 'reserved', tags: ['maps', 'world', 'geography'], status: 'reserve' }, { id: 'no-tags' }, { id: 'null-tags', tags: null }
];
t('best match first (most shared tags), ties by id; zero-overlap photographs are not candidates', W.photoCandidates(['maps', 'world'], lib).join() === 'alpha-map,zeta-map,one-tag', W.photoCandidates(['maps', 'world'], lib).join());
t('reserve photographs are never matched, even for a perfect tag match', !W.photoCandidates(['maps', 'world', 'geography'], lib).includes('reserved'));
t('photographs with missing or null tags, and an empty or missing library, are tolerated', W.photoCandidates(['maps'], lib).length === 3 && W.photoCandidates(['maps'], []).length === 0 && W.photoCandidates(['maps'], undefined).length === 0 && W.photoCandidates([], lib).length === 0);
t('no match gives no photograph, but the website is still picked (text-only fallback)', (() => {
  const p = W.pickForDate([site('lonely', '2026-01-01', { image_tags: ['nothing-matches'] })], lib, monday);
  return p && p.website.id === 'lonely' && p.photoId === null;
})());
t('a missing or empty library gives no photograph and never throws', (() => { const a = W.pickForDate(catalogue, undefined, monday), b = W.pickForDate(catalogue, [], monday), c = W.pickForDate(catalogue, null, monday); return [a, b, c].every(p => p && p.website && p.photoId === null); })());
t('a site with no image_tags and no derivable tags still rotates in, with the text-only layout', (() => { const p = W.pickForDate([{ id: 'bare', name: 'Bare', url: 'https://example.org', source_category: 'curated_external', date_added: '2026-01-01' }], lib, monday); return p.website.id === 'bare' && p.photoId === null; })());
t('deterministic: the same date, catalogue and library always give the same website and photograph', (() => { const a = W.pickForDate(catalogue, library, U(2026, 12, 14, 3)), b = W.pickForDate(catalogue, library, U(2026, 12, 14, 21)); return a.website.id === b.website.id && a.photoId === b.photoId && a.index === b.index; })());
t('Saturday and Sunday keep Friday\'s photograph as well as Friday\'s website', (() => { const f = W.pickForDate(catalogue, library, U(2026, 11, 6)), s = W.pickForDate(catalogue, library, U(2026, 11, 7)), u = W.pickForDate(catalogue, library, U(2026, 11, 8)); return f.photoId === s.photoId && s.photoId === u.photoId && f.website.id === u.website.id; })());
t('the same photograph never appears on two weekdays running (' + 4 * N + ' weekdays from the anchor)', (() => {
  let prev = null; for (let k = 0; k < 4 * N; k++) { const p = W.pickForDate(catalogue, library, new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY)).photoId; if (p && p === prev) return false; prev = p; }
  return true;
})());
t('a website gets a different photograph in the next cycle when it has more than one candidate', (() => {
  const s = [site('only', '2026-01-01', { image_tags: ['maps'] })], l = [{ id: 'm1', tags: ['maps'] }, { id: 'm2', tags: ['maps'] }, { id: 'm3', tags: ['maps'] }];
  const seen = new Set(); for (let k = 0; k < 6; k++) seen.add(W.pickForDate(s, l, new Date(ANCHOR + k * DAY)).photoId);
  return seen.size >= 2;
})());
t('real data: every eligible website has at least one matching photograph in the active library', POOL.every(r => W.photoCandidates(W.tagsFor(r), library).length > 0), POOL.filter(r => !W.photoCandidates(W.tagsFor(r), library).length).map(r => r.id).join());
t('real data: the reserve microscope is never selected, and the photographs are spread over many images', (() => {
  const used = {}; for (let k = 0; k < 4 * N; k++) { const p = W.pickForDate(catalogue, library, new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY)).photoId; used[p] = (used[p] || 0) + 1; }
  return !used['microscope-antique'] && Object.keys(used).length >= 10 && !used['null'];
})());
t('real data: still works far in the future and stays fast (index in 2035)', (() => { const t0 = Date.now(); const p = W.pickForDate(catalogue, library, U(2035, 6, 15)); return !!p.website && (Date.now() - t0) < 500; })());
t('a library of only reserve photographs gives the text-only layout', W.pickForDate(catalogue, [{ id: 'r', tags: ['books', 'world', 'maps'], status: 'reserve' }], monday).photoId === null);

// ---------------------------------------------------------------------------------------------
console.log('\nresource-specific ("pinned") photographs from data/featured-images.json');
const pinnedData = JSON.parse(read('data/featured-images.json')).images;
const goodPin = (x) => Object.assign({ file: 'images/editorial/feature-gapminder.png', title: 'A pinned title', creator: 'Pat Pinner', year: '2014', source_site: 'Pin Source', source_page: 'https://example.org/pin', licence: 'CC BY 4.0', licence_url: 'https://creativecommons.org/licenses/by/4.0/', change_note: 'Adapted by Free Range Tutors: cropped and printed as a black halftone on a transparent background.' }, x || {});
// The first weekday on which the real rotation shows Gapminder (found from the rotation itself, not assumed).
const gapK = (() => { for (let k = 0; k < 4 * N; k++) if (W.pickWebsite(catalogue, weekdayDate(k)).website.id === 'gapminder') return k; return -1; })();
const gapDate = weekdayDate(gapK);
const gapPick = W.pickForDate(catalogue, library, gapDate);
{
  t('every entry in the real featured-images.json is usable (complete, safe path, https links), so none is silently ignored, and each is keyed by a real directory resource', Object.keys(pinnedData).length >= 1 && Object.keys(pinnedData).every(id => !!W.usablePinnedPhoto(pinnedData[id]) && catalogue.some(r => r.id === id)), Object.keys(pinnedData).filter(id => !W.usablePinnedPhoto(pinnedData[id])).join());
  t('Gapminder has a pinned photograph: the Dollar Street photograph, credited to Zoriah Miller under CC BY 4.0', !!pinnedData.gapminder && pinnedData.gapminder.creator === 'Zoriah Miller' && pinnedData.gapminder.licence === 'CC BY 4.0' && pinnedData.gapminder.file === 'images/editorial/feature-gapminder.png');
  t('on the Gapminder day the generic matcher WOULD pick a library photograph (' + gapPick.photoId + '), and the pinned photograph takes precedence over it', !!gapPick.photoId && gapPick.website.id === 'gapminder' && W.choosePhoto(gapPick, libData, pinnedData) === pinnedData.gapminder && W.choosePhoto(gapPick, libData, pinnedData) !== libData[gapPick.photoId]);
  t('precedence is not Gapminder-specific: any resource with a usable pinned entry shows it instead of the matched library photograph', (() => { const p = W.pickForDate(catalogue, library, weekdayDate(0)); const pins = { [p.website.id]: goodPin({ file: 'images/editorial/library/chess-set.png', creator: 'Someone Else' }) }; const c = W.choosePhoto(p, libData, pins); return p.website.id !== 'gapminder' && c === pins[p.website.id] && c.creator === 'Someone Else'; })());
  t('existing behaviour is unchanged when there is no pinned entry: every other website, on every day of a full cycle, still gets exactly the library photograph the matcher chose', (() => { let seen = 0; for (let k = 0; k < N; k++) { const p = W.pickForDate(catalogue, library, weekdayDate(k)); if (p.website.id === 'gapminder') continue; seen++; if (W.choosePhoto(p, libData, pinnedData) !== (p.photoId ? libData[p.photoId] : null)) return false; } return seen === N - 1; })());
  t('and when there is neither a pinned entry nor a library match the result is null (text-only)', (() => { const s = sitesDated([['a', '2026-01-01', { image_tags: ['zzz'] }]]); const p = W.pickForDate(s, library, monday); return W.choosePhoto(p, libData, {}) === null && W.choosePhoto(p, libData, pinnedData) === null && W.choosePhoto(p, {}, {}) === null; })());
}
{ // missing or invalid pinned metadata falls back safely: never shown without its credit and licence, never a broken page
  const base = { website: { id: 'gapminder' }, photoId: 'chess-set' };
  const generic = libData['chess-set'];
  const bad = [
    ['no file', { file: undefined }], ['empty file', { file: '' }], ['file outside images/', { file: '/etc/passwd' }], ['path traversal', { file: 'images/../secrets/x.png' }], ['not an image extension', { file: 'images/editorial/x.html' }], ['absolute URL as file', { file: 'https://evil.example/x.png' }],
    ['no title', { title: undefined }], ['no creator', { creator: '' }], ['no source site', { source_site: undefined }], ['no source page', { source_page: undefined }], ['http source page', { source_page: 'http://example.org/p' }],
    ['no licence', { licence: undefined }], ['blank licence', { licence: '   ' }], ['no licence link', { licence_url: undefined }], ['http licence link', { licence_url: 'http://creativecommons.org/licenses/by/4.0/' }], ['javascript licence link', { licence_url: 'javascript:alert(1)' }],
    ['no change note', { change_note: undefined }], ['numeric title', { title: 7 }], ['object creator', { creator: { name: 'x' } }], ['object year', { year: { y: 1 } }]
  ];
  bad.forEach(([label, patch]) => {
    const entry = goodPin(patch);
    t('pinned entry with ' + label + ' is ignored and the generic library photograph is used instead', W.usablePinnedPhoto(entry) === null && W.choosePhoto(base, libData, { gapminder: entry }) === generic);
  });
  t('a pinned entry with no year, or a numeric year, is still fine (year is optional)', (() => { const e1 = goodPin(); delete e1.year; return !!W.usablePinnedPhoto(e1) && !!W.usablePinnedPhoto(goodPin({ year: 2014 })) && W.choosePhoto(base, libData, { gapminder: e1 }) === e1; })());
  t('entries that are not objects (null, a string, a number, an array, undefined) are ignored', [null, 'images/x.png', 7, [], undefined, true].every(v => W.usablePinnedPhoto(v) === null && W.choosePhoto(base, libData, { gapminder: v }) === generic));
  t('a missing, null or malformed pinned map is ignored (undefined, null, a string, a number, an array)', [undefined, null, 'x', 7, [], true].every(m => W.choosePhoto(base, libData, m) === generic));
  t('an entry under a different id is never used, and inherited keys cannot match (constructor, __proto__, toString)', ['constructor', '__proto__', 'toString', 'hasOwnProperty'].every(id => W.choosePhoto({ website: { id }, photoId: 'chess-set' }, libData, { gapminder: goodPin() }) === generic) && W.choosePhoto({ website: { id: 'seterra' }, photoId: 'chess-set' }, libData, { gapminder: goodPin() }) === generic);
  t('no pick, or a pick with no website, gives no photograph and does not throw', W.choosePhoto(null, libData, pinnedData) === null && W.choosePhoto({}, libData, pinnedData) === null && W.choosePhoto(undefined, undefined, undefined) === null);
  t('the retired Holyoke photograph (under "retired") is never offered as a pinned photograph: only "images" is read', !!JSON.parse(read('data/featured-images.json')).retired && !Object.prototype.hasOwnProperty.call(pinnedData, 'holyoke-1941'));
}

// ---------------------------------------------------------------------------------------------
console.log('\nrendering (small DOM stub) and fallbacks');
class N_ {
  constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.hidden = false; this._text = ''; this.cls = new Set(); this.classList = { add: c => this.cls.add(c), remove: c => this.cls.delete(c), contains: c => this.cls.has(c) }; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.cls = new Set(String(v).split(/\s+/)); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { if (c.isFragment) { c.children.forEach(x => this.children.push(x)); c.children = []; } else this.children.push(c); return c; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  querySelector(sel) { const hit = n => (sel[0] === '.' ? n.cls.has(sel.slice(1)) : n.tagName === sel); const walk = n => { for (const c of n.children) { if (c.children && (hit(c))) return c; const d = c.children && walk(c); if (d) return d; } return null; }; return walk(this); }
}
const mkTextNode = s => { const n = new N_('#text'); n._text = s; return n; };
function mkDoc() {
  const sec = new N_('section'); sec.hidden = true; sec.cls.add('wotd');
  const add = (parent, tag, cls) => { const n = new N_(tag); (cls || '').split(' ').filter(Boolean).forEach(c => n.cls.add(c)); parent.children.push(n); return n; };
  const text = add(sec, 'div', 'wotd-text'); add(text, 'span', 'wotd-day'); add(text, 'a', 'wotd-title-link'); add(text, 'h3', 'wotd-title'); add(text, 'p', 'wotd-meta'); add(text, 'p', 'wotd-desc'); const use = add(text, 'p', 'wotd-use'); use.hidden = true; add(text, 'a', 'wotd-btn');
  const fig = add(sec, 'figure', 'wotd-photo'); fig.hidden = true; add(fig, 'img'); const cr = add(sec, 'p', 'wotd-credit'); cr.hidden = true;
  return { sec, doc: { getElementById: id => (id === 'website-of-the-day' ? sec : null), createElement: tag => new N_(tag), createTextNode: mkTextNode, createDocumentFragment: () => { const f = new N_('#fragment'); f.isFragment = true; return f; } } };
}
{
  const nasty = site('nasty', '2026-01-01', { name: 'Name <b>bold</b> & co', url: 'https://example.org/x', description_short: 'Desc <script>x</script>', teacher_note: 'Use it well.', resource_type: 'website', domain: 'example.org', cost: 'freemium' });
  const entry = { file: 'images/editorial/library/chess-set.png', title: 'A <i>title</i>', creator: 'C. Reator', year: '2024', source_site: 'Wikimedia Commons', source_page: 'https://commons.wikimedia.org/wiki/File:X.jpg', licence: 'CC BY 4.0', licence_url: 'https://creativecommons.org/licenses/by/4.0/', change_note: 'Adapted by Free Range Tutors: cropped and printed as a black halftone on a transparent background.' };
  let m = mkDoc(); const ok = W.render(m.doc, W.pickForDate([nasty], library, monday), entry);
  const sec = m.sec, q = s => sec.querySelector(s);
  t('render fills the section, shows it, and sets the photograph from the library entry (no hard-coded path)', ok && sec.hidden === false && q('img').getAttribute('src') === '/images/editorial/library/chess-set.png' && q('.wotd-photo').hidden === false && !sec.cls.has('wotd-no-photo'));
  t('name, description and credit are set as text, never as HTML', q('.wotd-title').textContent === 'Name <b>bold</b> & co' && q('.wotd-desc').textContent.includes('<script>') && q('.wotd-credit').textContent.includes('A <i>title</i>'));
  t('the website link opens the existing external URL in a new tab with rel noopener; the prominent button does the same', q('.wotd-title-link').getAttribute('href') === 'https://example.org/x' && q('.wotd-title-link').getAttribute('target') === '_blank' && /noopener/.test(q('.wotd-title-link').getAttribute('rel')) && q('.wotd-btn').getAttribute('href') === 'https://example.org/x' && /^Visit /.test(q('.wotd-btn').textContent));
  t('the credit line names the title, creator, year, source, licence and the halftone change, and links the licence (needed for CC BY)', /Photograph: A <i>title<\/i>, C\. Reator, 2024, Wikimedia Commons\. CC BY 4\.0\. Adapted by Free Range Tutors/.test(q('.wotd-credit').textContent) && q('.wotd-credit').hidden === false);
  t('the teacher note is shown as "How to use it"', q('.wotd-use').hidden === false && /^How to use it: Use it well\./.test(q('.wotd-use').textContent));
  m = mkDoc(); W.render(m.doc, W.pickForDate([Object.assign({}, nasty, { teacher_note: null })], library, monday), null);
  t('no photograph: the picture and credit stay hidden and the section gets the text-only layout (but is still shown)', m.sec.hidden === false && m.sec.querySelector('.wotd-photo').hidden === true && m.sec.querySelector('.wotd-credit').hidden === true && m.sec.cls.has('wotd-no-photo') && m.sec.querySelector('img').getAttribute('src') === null);
  t('no teacher note: that line is hidden, the rest still renders', m.sec.querySelector('.wotd-use').hidden === true && m.sec.querySelector('.wotd-desc').textContent.length > 0);
  t('render with no section on the page, or no pick, does nothing and does not throw', W.render({ getElementById: () => null }, W.pickForDate([nasty], library, monday), null) === false && W.render(mkDoc().doc, null, null) === false);
}

const flush = () => new Promise(r => setTimeout(r, 20));
// start() reads the clock with `new Date()`, so these tests pin the clock to a fixed instant while it runs.
const RealDate = Date;
const withClock = async (when, fn) => { const ms = when.getTime(); global.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(ms); else super(...a); } static now() { return ms; } }; try { return await fn(); } finally { global.Date = RealDate; } };
// A fetch that answers per URL: an object = JSON body, an Error = network failure, a number = that HTTP status, undefined/missing = 404.
const LIB_URL = '/data/editorial-library.json', PIN_URL = '/data/featured-images.json';
const route = (map) => (url) => { const v = map[url]; if (v instanceof Error) return Promise.reject(v); if (typeof v === 'number') return Promise.resolve({ ok: false, status: v }); if (v === undefined) return Promise.resolve({ ok: false, status: 404 }); return Promise.resolve({ ok: true, json: () => (v && v.__badJson ? Promise.reject(new SyntaxError('bad json')) : Promise.resolve(v)) }); };
const frt = { ready: () => Promise.resolve(), all: () => catalogue };
const startOn = async (when, map, warned) => { const m = mkDoc(); await withClock(when, async () => { W.start({ FRT: frt, fetch: route(map), console: { warn() { if (warned) warned.n++; } } }, m.doc); await flush(); }); return m; };
const fullData = { [LIB_URL]: { images: libData }, [PIN_URL]: JSON.parse(read('data/featured-images.json')) };
const shownSrc = (m) => m.sec.querySelector('img').getAttribute('src');
const creditText = (m) => m.sec.querySelector('.wotd-credit').textContent;
const creditLinks = (m) => { const out = []; const walk = n => { (n.children || []).forEach(c => { if (c.tagName === 'a') out.push(c.getAttribute('href')); walk(c); }); }; walk(m.sec.querySelector('.wotd-credit')); return out; };
(async () => {
  // ---- render with a pinned entry (the same credit builder as for library photographs) ----
  {
    const m = mkDoc(); W.render(m.doc, gapPick, pinnedData.gapminder);
    const c = m.sec.querySelector('.wotd-credit').textContent;
    t('render with the Gapminder pinned photograph: the picture is the Dollar Street halftone and the credit names the photograph, Zoriah Miller, 2014, Dollar Street (Gapminder), CC BY 4.0 and the halftone change', m.sec.querySelector('img').getAttribute('src') === '/images/editorial/feature-gapminder.png' && /^Photograph: Cooking pots and bowls in a family's home in Haiti, Zoriah Miller, 2014, Dollar Street \(Gapminder\)\. CC BY 4\.0\. Adapted by Free Range Tutors: cropped and printed as a black halftone/.test(c) && m.sec.querySelector('.wotd-credit').hidden === false && m.sec.querySelector('.wotd-photo').hidden === false);
    const links = (() => { const out = []; const walk = n => (n.children || []).forEach(x => { if (x.tagName === 'a') out.push(x.getAttribute('href')); walk(x); }); walk(m.sec.querySelector('.wotd-credit')); return out; })();
    t('and the credit links to the photograph\'s source page and to the CC BY 4.0 licence', links.includes(pinnedData.gapminder.source_page) && links.includes('https://creativecommons.org/licenses/by/4.0/'));
  }

  // ---- start(): the real flow, on fixed dates ----
  const mondayNoon = U(2026, 11, 9, 12);                      // islcollective: no pinned entry
  let m = await startOn(mondayNoon, fullData);
  t('start: with the catalogue, library and pinned photographs available, a website WITHOUT a pinned entry shows a photograph from the library, credited from the library entry', m.sec.hidden === false && m.sec.querySelector('.wotd-title').textContent === 'iSLCollective' && /^\/images\/editorial\/library\/[a-z0-9-]+\.png$/.test(shownSrc(m) || '') && !/Zoriah Miller/.test(creditText(m)) && /^Photograph: /.test(creditText(m)));
  m = await startOn(gapDate, fullData);
  t('start: on the day Gapminder is selected, the section shows Gapminder with its OWN pinned photograph (not the generic match) and its proper attribution and licence', m.sec.hidden === false && m.sec.querySelector('.wotd-title').textContent === 'Gapminder' && shownSrc(m) === '/images/editorial/feature-gapminder.png' && /Zoriah Miller/.test(creditText(m)) && /CC BY 4\.0/.test(creditText(m)) && /halftone/.test(creditText(m)) && creditLinks(m).includes('https://creativecommons.org/licenses/by/4.0/') && !m.sec.cls.has('wotd-no-photo'));
  t('start: Gapminder\'s weekend keeps Friday\'s selection, photograph and credit', await (async () => { const sat = new Date(gapDate.getTime() + (((5 - ((gapDate.getUTCDay() + 6) % 7)) + 1) % 7 || 1) * DAY); const wk = new Date(Date.UTC(gapDate.getUTCFullYear(), gapDate.getUTCMonth(), gapDate.getUTCDate())); const dow = (wk.getUTCDay() + 6) % 7; const satDate = new Date(wk.getTime() + (5 - dow) * DAY), sunDate = new Date(wk.getTime() + (6 - dow) * DAY); if (dow !== 4) return true; const a = await startOn(satDate, fullData), b = await startOn(sunDate, fullData); return a.sec.querySelector('.wotd-title').textContent === 'Gapminder' && shownSrc(a) === shownSrc(b) && creditText(a) === creditText(b) && shownSrc(a) === '/images/editorial/feature-gapminder.png'; })());
  {
    const islPin = goodPin({ file: 'images/editorial/library/chess-set.png', title: 'ISL pinned photo', creator: 'Ina Pinner' });
    m = await startOn(mondayNoon, { [LIB_URL]: { images: libData }, [PIN_URL]: { images: Object.assign({}, fullData[PIN_URL].images, { islcollective: islPin }) } });
    t('start: any other resource shows its pinned photograph when it has one (precedence over the generic match, no Gapminder-specific code), with that entry\'s own credit', m.sec.querySelector('.wotd-title').textContent === 'iSLCollective' && shownSrc(m) === '/images/editorial/library/chess-set.png' && /Ina Pinner/.test(creditText(m)) && /ISL pinned photo/.test(creditText(m)) && !/Zoriah Miller/.test(creditText(m)));
  }

  // ---- failures: the page never breaks, and falls back safely ----
  let warn = { n: 0 };
  m = await startOn(gapDate, { [LIB_URL]: { images: libData }, [PIN_URL]: 404 }, warn);
  t('start: if the pinned photographs cannot be loaded (404), Gapminder is still shown with the generic library photograph and its credit (not text-only), and a warning is logged', m.sec.hidden === false && m.sec.querySelector('.wotd-title').textContent === 'Gapminder' && /^\/images\/editorial\/library\//.test(shownSrc(m) || '') && !/Zoriah Miller/.test(creditText(m)) && warn.n > 0);
  m = await startOn(gapDate, { [LIB_URL]: { images: libData }, [PIN_URL]: new Error('offline') });
  t('start: a network failure for the pinned photographs is handled the same way', m.sec.hidden === false && /^\/images\/editorial\/library\//.test(shownSrc(m) || ''));
  m = await startOn(gapDate, { [LIB_URL]: { images: libData }, [PIN_URL]: { __badJson: true } });
  t('start: malformed JSON for the pinned photographs is handled the same way', m.sec.hidden === false && /^\/images\/editorial\/library\//.test(shownSrc(m) || ''));
  t('start: a pinned file with no "images", with "images" of the wrong type, or empty, is ignored (generic library photograph)', await (async () => { for (const body of [{}, { images: 5 }, { images: null }, { images: 'x' }, null, [], { images: [] }]) { const x = await startOn(gapDate, { [LIB_URL]: { images: libData }, [PIN_URL]: body }); if (x.sec.hidden !== false || !/^\/images\/editorial\/library\//.test(shownSrc(x) || '')) return false; } return true; })());
  {
    const broken = JSON.parse(JSON.stringify(fullData[PIN_URL])); delete broken.images.gapminder.licence;
    m = await startOn(gapDate, { [LIB_URL]: { images: libData }, [PIN_URL]: broken });
    t('start: Gapminder\'s pinned entry with its licence missing is NOT shown (a photograph never appears without its licence); the generic library photograph is used', m.sec.querySelector('.wotd-title').textContent === 'Gapminder' && /^\/images\/editorial\/library\//.test(shownSrc(m) || '') && !/feature-gapminder/.test(shownSrc(m)));
    const traversal = JSON.parse(JSON.stringify(fullData[PIN_URL])); traversal.images.gapminder.file = 'images/../data/manifest.json';
    m = await startOn(gapDate, { [LIB_URL]: { images: libData }, [PIN_URL]: traversal });
    t('start: a pinned entry whose file path is unsafe is ignored', /^\/images\/editorial\/library\//.test(shownSrc(m) || ''));
  }
  m = await startOn(gapDate, { [LIB_URL]: 404, [PIN_URL]: fullData[PIN_URL] });
  t('start: the pinned photograph does not depend on the library: with the library unavailable, Gapminder still shows its pinned photograph and credit', m.sec.hidden === false && shownSrc(m) === '/images/editorial/feature-gapminder.png' && /Zoriah Miller/.test(creditText(m)));
  m = await startOn(gapDate, { [LIB_URL]: 404, [PIN_URL]: 404 });
  t('start: with neither the library nor the pinned photographs available, the website is still shown, text-only (the homepage never breaks)', m.sec.hidden === false && m.sec.querySelector('.wotd-title').textContent === 'Gapminder' && m.sec.cls.has('wotd-no-photo') && m.sec.querySelector('.wotd-photo').hidden === true && m.sec.querySelector('.wotd-credit').hidden === true);
  m = await startOn(mondayNoon, { [LIB_URL]: new Error('offline'), [PIN_URL]: fullData[PIN_URL] }, warn = { n: 0 });
  t('start: if the photograph library cannot be loaded, a website with no pinned entry is still shown, text-only, and a warning is logged', m.sec.hidden === false && m.sec.cls.has('wotd-no-photo') && warn.n > 0);
  m = await startOn(mondayNoon, { [LIB_URL]: 404, [PIN_URL]: 404 });
  t('start: a 404 for the library is handled the same way', m.sec.hidden === false && m.sec.cls.has('wotd-no-photo'));
  m = mkDoc();
  await withClock(mondayNoon, async () => { W.start({ FRT: { ready: () => Promise.reject(new Error('no catalogue')), all: () => [] }, fetch: route(fullData), console: { warn() { } } }, m.doc); await flush(); });
  t('start: if the catalogue cannot be loaded the section simply stays hidden', m.sec.hidden === true);
  t('start: without FRT, fetch or the section it returns quietly', (() => { try { W.start({}, mkDoc().doc); W.start({ FRT: frt, fetch() { } }, { getElementById: () => null }); return true; } catch (e) { return false; } })());

  // -------------------------------------------------------------------------------------------
  console.log('\nhomepage wiring (index.html, website-of-the-day.css)');
  const home = read('index.html'), css = read('website-of-the-day.css');
  const i = home.indexOf('<section class="wotd" id="website-of-the-day"');
  const seg = i < 0 ? '' : home.slice(i, home.indexOf('</section>', i));
  t('the section exists exactly once, hidden until filled in, labelled "Website of the Day"', (home.match(/<section class="wotd"/g) || []).length === 1 && /\bhidden>/.test(home.slice(i, home.indexOf('>', i) + 1)) && />Website of the Day<\/h2>/.test(seg));
  const order = [...home.matchAll(/<section class="(recent-band|wotd|cd-feature|ts-feature)"/g)].map(x => x[1]);
  t('order: the compact red Website of the Day block comes after the search and before All resources; the Christmas Dinner card is no longer between them (it sits inside the list, see data/homepage-layout.test.js); no Recently added band', JSON.stringify(order) === JSON.stringify(['wotd', 'cd-feature']) && home.indexOf('class="index-strip"') < home.indexOf('class="wotd"') && home.indexOf('class="wotd"') < home.indexOf('id="all-resources"') && home.indexOf('id="all-resources"') < home.indexOf('class="cd-feature"'), JSON.stringify(order));
  t('no photograph or credit is hard-coded in index.html: the img has no src and the credit is an empty placeholder', !/images\/editorial/.test(seg) && /<img width="1100" height="1364" alt="" decoding="async" \/>/.test(seg) && /<p class="wotd-credit" hidden><\/p>/.test(seg));
  t('the stylesheet and script are each linked once, the script after data/resources.js', (home.match(/<link rel="stylesheet" href="\/website-of-the-day\.css" \/>/g) || []).length === 1 && (home.match(/<script src="website-of-the-day\.js"><\/script>/g) || []).length === 1 && home.indexOf('<script src="data/resources.js">') < home.indexOf('<script src="website-of-the-day.js">'));
  t('the Recently added band is gone from the page: no band section, none of its ids, no photograph figure or footer-credit placeholder, no "Recently added" text', !/recent-band|recent-featured|recent-support|directory-recent-section|recent-photo|recent-heading|foot-credit|Recently added/i.test(home));
  t('the markup has one block with no duplicate wrapper: the section holds a single .wotd-main grid (text + photograph) and the credit row, and no leftover .wotd-panel', (seg.match(/class="wotd-main"/g) || []).length === 1 && !/wotd-panel/.test(home) && !/wotd-panel/.test(css));
  t('the stylesheet only styles .wotd classes (nothing existing is overridden)', [...css.matchAll(/^([^\s@\/}][^{]*)\{/gm)].every(x => x[1].split(',').every(s => /\.wotd/.test(s))));
  t('the section is the flat red feature field with paper text and the compact geometry: red background, 18px top padding, 176px photograph column, 44px rise, 50% 0 crop, negative top margin that lifts the photograph above the red field', /\.wotd \{[^}]*background: var\(--fz-red\);[^}]*color: var\(--fz-paper\);[^}]*padding: var\(--wotd-pad-top\) 0 18px;[^}]*margin-top: calc\(var\(--wotd-rise\) \+ 28px\);/.test(css) && /--wotd-photo-w: 176px;/.test(css) && /--wotd-rise: 44px;/.test(css) && /--wotd-pad-top: 18px;/.test(css) && /object-fit: cover; object-position: 50% 0;/.test(css) && /margin: calc\(-1 \* \(var\(--wotd-pad-top\) \+ var\(--wotd-rise\)\)\) 0 0;/.test(css));
  t('the responsive and fallback layouts exist: 150px column under 1000px, the 700px layout (108px photograph on the right with a 30px rise, text on the left, link and credit full width), and the text-only layout', /@media \(max-width: 1000px\)[\s\S]*--wotd-photo-w: 150px;/.test(css) && /@media \(max-width: 700px\)[\s\S]*--wotd-photo-w: 108px; --wotd-rise: 30px;/.test(css) && /\.wotd-photo \{ grid-column: 2; grid-row: 1 \/ span 4; \}/.test(css) && /\.wotd-no-photo \.wotd-main \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(css));
  t('legibility on red: all text is full-strength paper (no semi-transparent text colour, no opacity, no blend mode), the button is a paper button with red text, and the focus ring is paper (specific enough to beat the site-wide cobalt ring)', !/(^|[;{\s])color:\s*rgba/m.test(css) && !/mix-blend-mode|opacity/.test(css) && /\.wotd \.wotd-btn \{[^}]*background: var\(--fz-paper\); color: var\(--fz-red\);/.test(css) && /body\.directory \.wotd a:focus-visible \{ outline-color: var\(--fz-paper\); \}/.test(css));
  t('the module and the styles are public files (not hidden by .assetsignore), the library data is public, and the masters stay hidden', (() => { const ig = read('.assetsignore'); return !/website-of-the-day/.test(ig) && !/editorial-library\.json/.test(ig) && /^images\/resources\/_masters\/$/m.test(ig); })());
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
