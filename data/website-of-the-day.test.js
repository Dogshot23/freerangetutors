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
const pool20 = W.eligibleWebsites(catalogue);                 // every eligible (curated_external) website
const POOL = W.rotationPool(catalogue), N = POOL.length;      // the sites the rotation actually cycles through (eligible minus the Recently added group)
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
// RECENT stands in for the newest free resource of the catalogue (an FRT original, never in the pool), so these small fixtures
// test plain rotation behaviour without the Recently added exclusion taking away their newest site. The exclusion has its own section below.
const RECENT = site('recent-feature', '2099-01-01', { source_category: 'own_original' });
const base3 = [site('a', '2026-01-01'), site('b', '2026-02-01'), site('c', '2026-03-01'), RECENT];
const added = base3.concat([site('d-new', '2026-11-06')]);
t('a new curated_external record joins the pool automatically (there is no second list) and, being newest, goes to the end so existing order is untouched', ids(W.eligibleWebsites(added)).join() === 'a,b,c,d-new');
t('it is shown within the next cycle', (() => { const seen = new Set(); for (let k = 0; k < 4; k++) seen.add(W.pickWebsite(added, new Date(ANCHOR + k * DAY)).website.id); return seen.has('d-new'); })());
t('unavoidable trade-off, documented: adding a site changes the pool size, so the position (index mod N) shifts and today\'s website can change; nothing is stored, so nothing can be preserved', (() => {
  let changed = 0; for (let k = 0; k < 12; k++) { const d = new Date(ANCHOR + k * DAY); if (W.pickWebsite(base3, d).website.id !== W.pickWebsite(added, d).website.id) changed++; }
  return changed > 0;
})());
t('a paid or commercial record added to the catalogue changes nothing', (() => { const withPaid = base3.concat([site('gtmk-pack', '2026-11-06', { source_category: 'commercial', cost: 'paid' })]); for (let k = 0; k < 12; k++) { const d = new Date(ANCHOR + k * DAY); if (W.pickWebsite(base3, d).website.id !== W.pickWebsite(withPaid, d).website.id) return false; } return true; })());

// ---------------------------------------------------------------------------------------------
console.log('\nnever the same website twice on the homepage (Recently added exclusion)');
const weekdaySeq = (resources, n) => { const out = []; for (let k = 0; k < n; k++) out.push(W.pickWebsite(resources, new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY)).website.id); return out; };
const sitesDated = (spec) => spec.map(([id, d, x]) => site(id, d, x));
// An independent copy of what directory.js does to choose the featured item (recentPool -> sortNewestFirst -> pickFeatured), run with the two
// kinds of sort an engine may use. directory.js's comparator returns -1 for equal dates, so which of several tied resources a browser features varies.
const mergeStable = (arr, cmp) => { if (arr.length < 2) return arr; const m = arr.length >> 1, L = mergeStable(arr.slice(0, m), cmp), R = mergeStable(arr.slice(m), cmp), out = []; while (L.length && R.length) out.push(cmp(L[0], R[0]) <= 0 ? L.shift() : R.shift()); return out.concat(L, R); };
const dirFeatured = (resources, sorter) => { const free = resources.filter(r => r.cost !== 'paid'); const pool = free.length ? free : resources; const newest = sorter(pool.slice(), (a, b) => (b.date_added > a.date_added) ? 1 : -1); return newest.find(r => r.cost !== 'paid') || newest[0]; };
const nativeSort = (arr, cmp) => arr.sort(cmp);

{ // a single newest-date resource
  const group = W.recentlyAddedGroup(catalogue), newestDate = catalogue.filter(r => r.cost !== 'paid').map(r => r.date_added).sort().pop();
  t('real catalogue: the Recently added group is exactly the free resources sharing the newest date_added', group.length >= 1 && group.every(r => r.date_added === newestDate && r.cost !== 'paid') && group.length === catalogue.filter(r => r.cost !== 'paid' && r.date_added === newestDate).length, ids(group).join());
  t('real catalogue: the group is left out of the rotation, and every other eligible website stays in it', W.rotationPool(catalogue).every(r => !ids(group).includes(r.id)) && pool20.filter(r => !ids(group).includes(r.id)).every(r => ids(W.rotationPool(catalogue)).includes(r.id)) && W.rotationPool(catalogue).length === pool20.filter(r => !ids(group).includes(r.id)).length);
  t('real catalogue: the Recently added featured website is never picked, over four full cycles of weekdays, but every other eligible website is', (() => { const seen = new Set(weekdaySeq(catalogue, 4 * N)); return !ids(group).some(i => seen.has(i)) && W.rotationPool(catalogue).every(r => seen.has(r.id)); })());
  const single = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['d', '2026-11-05']]);
  t('a single newest-date resource: it is excluded and the others rotate (a, b, c)', ids(W.recentlyAddedGroup(single)).join() === 'd' && ids(W.rotationPool(single)).join() === 'a,b,c' && !weekdaySeq(single, 30).includes('d') && new Set(weekdaySeq(single, 3)).size === 3);
}
{ // several share the newest date
  const multi = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['d', '2026-04-01'], ['e', '2026-11-01'], ['f', '2026-11-01']]);
  t('several resources sharing the newest date: the whole group is excluded (whichever of them directory.js features), the rest rotate', ids(W.recentlyAddedGroup(multi)).sort().join() === 'e,f' && ids(W.rotationPool(multi)).join() === 'a,b,c,d' && !weekdaySeq(multi, 40).some(i => i === 'e' || i === 'f') && new Set(weekdaySeq(multi, 4)).size === 4);
}
{ // a newly added newest resource
  const before = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['d', '2026-11-05']]);
  const after = before.concat(sitesDated([['fresh', '2026-11-07']]));
  t('a newly added resource with the newest date joins the catalogue, takes the Recently added slot and is excluded; the previously featured one re-enters the rotation', ids(W.rotationPool(before)).join() === 'a,b,c' && ids(W.rotationPool(after)).join() === 'a,b,c,d' && ids(W.recentlyAddedGroup(after)).join() === 'fresh');
  t('it enters the rotation on its own (no list to edit) once it is no longer the newest', (() => { const later = after.concat(sitesDated([['fresher', '2026-11-09']])); return ids(W.rotationPool(later)).includes('fresh') && !ids(W.rotationPool(later)).includes('fresher'); })());
}
{ // small pools
  const two = sitesDated([['a', '2026-01-01'], ['b', '2026-11-05']]), three = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-11-05']]), one = sitesDated([['only', '2026-11-05']]);
  t('small pool, two sites: excluding the newest would leave one (no rotation), so nothing is excluded and both rotate', ids(W.rotationPool(two)).join() === 'a,b' && new Set(weekdaySeq(two, 6)).size === 2);
  t('small pool, three sites: the newest is excluded and the remaining two alternate', ids(W.rotationPool(three)).join() === 'a,b' && weekdaySeq(three, 4).join() === 'a,b,a,b');
  t('small pool, one site: it is still shown every weekday', weekdaySeq(one, 7).every(i => i === 'only') && W.pickForDate(one, library, monday).website.id === 'only');
}
{ // the filtered pool would be empty or too small
  const batch = sitesDated([['a', '2026-09-23'], ['b', '2026-09-23'], ['c', '2026-09-23'], ['d', '2026-09-23'], ['e', '2026-09-23']]);
  t('a whole batch added on the newest date would empty the pool: the exclusion is skipped and the rotation still works (5 distinct sites in 5 weekdays)', ids(W.recentlyAddedGroup(batch)).length === 5 && ids(W.rotationPool(batch)).join() === 'a,b,c,d,e' && new Set(weekdaySeq(batch, 5)).size === 5);
  const nearly = sitesDated([['a', '2026-01-01'], ['b', '2026-11-05'], ['c', '2026-11-05'], ['d', '2026-11-05']]);
  t('a newest group that would leave only one site is also skipped, so there is always a rotation of at least two', ids(W.rotationPool(nearly)).join() === 'a,b,c,d');
  t('with nothing to rotate (no eligible websites) the result is null and nothing throws', W.pickWebsite([RECENT], monday) === null && W.pickForDate([RECENT], library, monday) === null && W.rotationPool([]).length === 0 && W.rotationPool(undefined).length === 0);
}
{ // what counts as "Recently added"
  const paidNewest = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['gtmk', '2026-12-01', { source_category: 'commercial', cost: 'paid' }]]);
  t('a newer paid product is not part of the Recently added group (directory.js only features free resources), so the newest free website is the one excluded', ids(W.recentlyAddedGroup(paidNewest)).join() === 'c' && ids(W.rotationPool(paidNewest)).join() === 'a,b' && !ids(W.rotationPool(paidNewest)).includes('gtmk'));
  const ownNewest = sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['frt-tool', '2026-12-01', { source_category: 'own_original' }]]);
  t('when the newest free resource is not an external website, no website is left out', ids(W.recentlyAddedGroup(ownNewest)).join() === 'frt-tool' && ids(W.rotationPool(ownNewest)).join() === 'a,b,c');
  const allPaid = sitesDated([['a', '2026-01-01', { cost: 'paid' }], ['b', '2026-02-01', { cost: 'paid' }], ['c', '2026-03-01', { cost: 'paid' }]]);
  t('if nothing is free, directory.js falls back to the whole catalogue and so does the group', ids(W.recentlyAddedGroup(allPaid)).join() === 'c' && ids(W.rotationPool(allPaid)).join() === 'a,b');
  t('records without a date_added contribute no group (nothing is excluded), and malformed input is tolerated', W.recentlyAddedGroup([{ id: 'x', cost: 'free' }, { id: 'y' }]).length === 0 && W.recentlyAddedGroup([null, undefined, {}]).length === 0 && W.recentlyAddedGroup(undefined).length === 0);
  t('the exclusion comes from the catalogue itself: an unchanged catalogue gives the same pool however the records are ordered, and the input is not mutated', (() => { const copy = single_(); const a = ids(W.rotationPool(copy)).join(), b = ids(W.rotationPool(copy.slice().reverse())).join(); return a === b && copy[0].id === 'a'; function single_() { return sitesDated([['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['d', '2026-11-05']]); } })());
}
{ // weekends, determinism, photographs
  const fri = W.pickForDate(catalogue, library, U(2026, 11, 6)), sat = W.pickForDate(catalogue, library, U(2026, 11, 7)), sun = W.pickForDate(catalogue, library, U(2026, 11, 8, 23, 59)), mon = W.pickForDate(catalogue, library, monday);
  t('weekend retention still holds with the exclusion: Friday\'s website and photograph stay through Saturday and Sunday and Monday moves on', fri.website.id === sat.website.id && sat.website.id === sun.website.id && fri.photoId === sat.photoId && sat.photoId === sun.photoId && mon.website.id !== fri.website.id);
  t('deterministic: the same date, catalogue and library always give the same website and photograph, whatever the time of day', (() => { const a = W.pickForDate(catalogue, library, U(2026, 12, 15, 1)), b = W.pickForDate(catalogue, library, U(2026, 12, 15, 22)); return a.website.id === b.website.id && a.photoId === b.photoId; })());
  t('any ' + N + ' consecutive weekdays still show ' + N + ' distinct websites (a clean cycle, just one shorter)', (() => { for (let s = 0; s < 2 * N; s++) { const seq = weekdaySeq(catalogue, s + N).slice(s); if (new Set(seq).size !== N) return false; } return true; })());
  t('photograph matching uses the same filtered pool as the website choice', (() => { for (let k = 0; k < 3 * N; k++) { const d = new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY), p = W.pickForDate(catalogue, library, d); if (p.photoId !== W.photoIdForIndex(W.rotationPool(catalogue), library, p.index) || p.poolSize !== N) return false; } return true; })());
  t('the same photograph still never appears on two weekdays running, and the reserve microscope is still never used', (() => { let prev = null; for (let k = 0; k < 4 * N; k++) { const p = W.pickForDate(catalogue, library, new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY)).photoId; if (p === 'microscope-antique' || (p && p === prev)) return false; prev = p; } return true; })());
  t('text-only fallback is unchanged: a website with no matching photograph is still picked, with no photograph', (() => { const s = sitesDated([['a', '2026-01-01', { image_tags: ['zzz'] }], ['b', '2026-02-01', { image_tags: ['zzz'] }], ['c', '2026-11-05']]); const p = W.pickForDate(s, library, monday); return p.website.id === 'a' && p.photoId === null; })());
}
{ // agreement with directory.js
  const dir = read('directory.js');
  t('directory.js still has the rules the exclusion mirrors: FEATURED_ID is null, recentPool keeps cost !== "paid", newest by date_added, three supporting items', /const FEATURED_ID = null;/.test(dir) && /function recentPool\(resources\) \{\s*const free = resources\.filter\(function \(r\) \{ return r\.cost !== 'paid'; \}\);\s*return free\.length \? free : resources;/.test(dir) && /return \(b\.date_added > a\.date_added\) \? 1 : -1;/.test(dir) && /\.slice\(0, 3\)/.test(dir) && /newest\.find\(function \(r\) \{ return r\.cost !== 'paid'; \}\) \|\| newest\[0\]/.test(dir));
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const baseGroup = ids(W.recentlyAddedGroup(catalogue)).sort().join();
  let ok = true, why = '';
  for (let k = 0; k < 40 && ok; k++) {
    const cat = k === 0 ? catalogue : shuffle(catalogue), g = ids(W.recentlyAddedGroup(cat)).sort().join();
    const f1 = dirFeatured(cat, nativeSort), f2 = dirFeatured(cat, mergeStable);
    if (g !== baseGroup || !g.split(',').includes(f1.id) || !g.split(',').includes(f2.id)) { ok = false; why = 'order ' + k + ': group ' + g + ' featured ' + f1.id + '/' + f2.id; }
  }
  t('whichever resource directory.js features (under either tie ordering and 40 shuffled catalogue orders), it is inside the excluded group, and the group does not depend on record order', ok, why);
  t('the real band\'s featured resource is not what Website of the Day shows on any weekday', (() => { const f = dirFeatured(catalogue, nativeSort); return !weekdaySeq(catalogue, 5 * N).includes(f.id); })());
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
t('real data: every eligible website has at least one matching photograph in the active library', pool20.every(r => W.photoCandidates(W.tagsFor(r), library).length > 0), pool20.filter(r => !W.photoCandidates(W.tagsFor(r), library).length).map(r => r.id).join());
t('real data: the reserve microscope is never selected, and the photographs are spread over many images', (() => {
  const used = {}; for (let k = 0; k < 4 * N; k++) { const p = W.pickForDate(catalogue, library, new Date(ANCHOR + Math.floor(k / 5) * 7 * DAY + (k % 5) * DAY)).photoId; used[p] = (used[p] || 0) + 1; }
  return !used['microscope-antique'] && Object.keys(used).length >= 10 && !used['null'];
})());
t('real data: still works far in the future and stays fast (index in 2035)', (() => { const t0 = Date.now(); const p = W.pickForDate(catalogue, library, U(2035, 6, 15)); return !!p.website && (Date.now() - t0) < 500; })());
t('a library of only reserve photographs gives the text-only layout', W.pickForDate(catalogue, [{ id: 'r', tags: ['books', 'world', 'maps'], status: 'reserve' }], monday).photoId === null);

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
(async () => {
  let m = mkDoc();
  const frt = { ready: () => Promise.resolve(), all: () => catalogue };
  const okLib = { ok: true, json: () => Promise.resolve({ images: libData }) };
  W.start({ FRT: frt, fetch: () => Promise.resolve(okLib), console: { warn() { } } }, m.doc); await flush();
  t('start: with the catalogue and library available the section is filled in and shown, with a photograph from the library', m.sec.hidden === false && /^\/images\/editorial\/library\/[a-z0-9-]+\.png$/.test(m.sec.querySelector('img').getAttribute('src') || ''));
  m = mkDoc(); let warned = 0;
  W.start({ FRT: frt, fetch: () => Promise.reject(new Error('offline')), console: { warn() { warned++; } } }, m.doc); await flush();
  t('start: if the photograph library cannot be loaded, the website is still shown, text-only (the homepage never breaks)', m.sec.hidden === false && m.sec.cls.has('wotd-no-photo') && warned > 0);
  m = mkDoc();
  W.start({ FRT: frt, fetch: () => Promise.resolve({ ok: false, status: 404 }), console: { warn() { } } }, m.doc); await flush();
  t('start: a 404 for the library is handled the same way', m.sec.hidden === false && m.sec.cls.has('wotd-no-photo'));
  m = mkDoc();
  W.start({ FRT: { ready: () => Promise.reject(new Error('no catalogue')), all: () => [] }, fetch: () => Promise.resolve(okLib), console: { warn() { } } }, m.doc); await flush();
  t('start: if the catalogue cannot be loaded the section simply stays hidden', m.sec.hidden === true);
  t('start: without FRT, fetch or the section it returns quietly', (() => { try { W.start({}, mkDoc().doc); W.start({ FRT: frt, fetch() { } }, { getElementById: () => null }); return true; } catch (e) { return false; } })());

  // -------------------------------------------------------------------------------------------
  console.log('\nhomepage wiring (index.html, website-of-the-day.css)');
  const home = read('index.html'), css = read('website-of-the-day.css');
  const i = home.indexOf('<section class="wotd" id="website-of-the-day"');
  const seg = i < 0 ? '' : home.slice(i, home.indexOf('</section>', i));
  t('the section exists exactly once, hidden until filled in, labelled "Website of the Day"', (home.match(/<section class="wotd"/g) || []).length === 1 && /\bhidden>/.test(home.slice(i, home.indexOf('>', i) + 1)) && />Website of the Day<\/h2>/.test(seg));
  const order = [...home.matchAll(/<section class="(recent-band|wotd|cd-feature|ts-feature)"/g)].map(x => x[1]);
  t('order: Recently added band, then Website of the Day, then the Christmas Dinner band, then All resources', JSON.stringify(order) === JSON.stringify(['recent-band', 'wotd', 'cd-feature']) && home.indexOf('class="wotd"') < home.indexOf('class="cd-feature"') && home.indexOf('class="cd-feature"') < home.indexOf('id="all-resources"'), JSON.stringify(order));
  t('no photograph or credit is hard-coded in index.html: the img has no src and the credit is an empty placeholder', !/images\/editorial/.test(seg) && /<img width="1100" height="1364" alt="" decoding="async" \/>/.test(seg) && /<p class="wotd-credit" hidden><\/p>/.test(seg));
  t('the stylesheet and script are each linked once, the script after data/resources.js', (home.match(/<link rel="stylesheet" href="\/website-of-the-day\.css" \/>/g) || []).length === 1 && (home.match(/<script src="website-of-the-day\.js"><\/script>/g) || []).length === 1 && home.indexOf('<script src="data/resources.js">') < home.indexOf('<script src="website-of-the-day.js">'));
  t('the existing Recently added band is untouched in the page: same markup, its own photograph figure and credit placeholder', /<figure class="recent-photo" aria-hidden="true">\s*<img width="1100" height="1364" alt="" decoding="async" \/>\s*<\/figure>/.test(home) && /<p class="foot-credit" id="foot-credit" hidden><\/p>/.test(home) && (home.match(/class="recent-photo"/g) || []).length === 1);
  t('the new stylesheet only styles .wotd classes (nothing existing is overridden) and has the red border, the overhanging photograph, the 700px layout, the text-only layout and no blend mode', [...css.matchAll(/^([^\s@\/}][^{]*)\{/gm)].every(x => x[1].split(',').every(s => /\.wotd/.test(s))) && /border: 3px solid var\(--fz-red\)/.test(css) && /@media \(max-width: 700px\)/.test(css) && /\.wotd-no-photo/.test(css) && /overflow-x: clip/.test(css) && !/mix-blend-mode|opacity/.test(css));
  t('the module and the styles are public files (not hidden by .assetsignore), the library data is public, and the masters stay hidden', (() => { const ig = read('.assetsignore'); return !/website-of-the-day/.test(ig) && !/editorial-library\.json/.test(ig) && /^images\/resources\/_masters\/$/m.test(ig); })());
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
