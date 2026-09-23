/* ============================================================
   FREE RANGE TUTORS — directory search/filter tests
   Plain Node, no framework/runner dependency. Run with:
     node data/directory.test.js

   directory.js is DOM-coupled (renders directly into the page),
   so this file re-implements its search/filter logic in
   isolation, kept in lockstep with the real source — see the
   "MUST MATCH" comments below pointing at the exact functions
   being mirrored. If those functions change, this file's copies
   must change with them (same pattern the old routing tests used).

   Loads the real resources from data/resources/ and tests against
   them directly — no synthetic catalogue for the core assertions,
   per this project's existing test discipline.

   As of the external-links-only catalogue change (2026-09-23), the
   8 FRT-original activities were removed from the live catalogue —
   Free Range Tutors is now a curated list of 5 external ESL
   resources, each linking directly to its real destination. The 8
   removed activities' data/HTML were moved (not deleted) to
   _archived-activities/ outside the served catalogue. This file's
   assertions were rewritten to match the real 5-resource catalogue
   rather than patched piecemeal, since most of the old assertions
   tested resources that no longer exist here.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const RESOURCES_DIR = path.join(__dirname, 'resources');
const catalogue = fs.readdirSync(RESOURCES_DIR)
  .filter(function (f) { return f.endsWith('.json'); })
  .map(function (f) { return JSON.parse(fs.readFileSync(path.join(RESOURCES_DIR, f), 'utf8')); });

let passed = 0, failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log('  PASS  ' + label);
  } else {
    failed++;
    console.log('  FAIL  ' + label + (detail ? '  (' + detail + ')' : ''));
  }
}

function ids(list) {
  return list.map(function (r) { return r.id; }).sort();
}

console.log('Catalogue loaded: ' + catalogue.length + ' resources\n');

/* ---- MUST MATCH directory.js: matchesSearch/matchesType/matchesUse/matchesLevel/matchesCost ---- */
function matchesSearch(resource, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    resource.name,
    resource.description_short,
    (resource.teaching_use || []).join(' ')
  ].join(' ').toLowerCase();
  return haystack.indexOf(q) !== -1;
}
function matchesCategory(resource, category) {
  return !category || resource.primary_category === category;
}
function matchesType(resource, type) {
  return !type || resource.resource_type === type;
}
function matchesUse(resource, use) {
  return !use || (resource.teaching_use || []).indexOf(use) !== -1;
}
function matchesLevel(resource, level) {
  if (!level) return true;
  const set = resource.cefr_level;
  if (!set) return false;
  if (set.mode === 'universal') return true;
  if (set.mode === 'specific') return (set.values || []).indexOf(level) !== -1;
  return false;
}
function matchesCost(resource, cost) {
  return !cost || resource.cost === cost;
}
function filterCatalogue(state, allRes) {
  return allRes.filter(function (r) {
    return matchesSearch(r, state.query)
      && matchesCategory(r, state.category)
      && matchesType(r, state.type)
      && matchesUse(r, state.use)
      && matchesLevel(r, state.level)
      && matchesCost(r, state.cost);
  });
}
function emptyState() {
  return { query: '', category: '', type: '', use: '', level: '', cost: '' };
}

/* ============================================================
   0. Every remaining resource is a genuine direct external link —
      the core rule of the new catalogue model. No resource should
      point at an internal /resources/... page any more.
   ============================================================ */
console.log('Every catalogue entry links directly to a real external destination');
{
  check('catalogue has exactly 5 resources', catalogue.length === 5, 'got ' + catalogue.length);

  check('every resource URL is an absolute https:// external link, never an internal /resources/... path',
    catalogue.every(function (r) { return /^https:\/\//.test(r.url); }));

  check('no resource has source_category own_original (all FRT-original activities were removed)',
    catalogue.every(function (r) { return r.source_category !== 'own_original'; }));

  check('every resource is source_category curated_external',
    catalogue.every(function (r) { return r.source_category === 'curated_external'; }));

  const expectedIds = ['baamboozle', 'islcollective', 'learnenglish-teens', 'voa-learning-english', 'wafflebrain'];
  check('the catalogue contains exactly the 5 expected resources, no more no less',
    ids(catalogue).join(',') === expectedIds.sort().join(','));
}

/* ============================================================
   1. Default state (no query, no filters) shows every resource
   ============================================================ */
console.log('\nDefault state — no search, no filters — shows the full catalogue');
{
  const result = filterCatalogue(emptyState(), catalogue);
  check('empty state returns all resources', result.length === catalogue.length, 'got ' + result.length);
}

/* ============================================================
   2. Search matches name, description_short, and teaching_use
   ============================================================ */
console.log('\nSearch — matches name, description_short, and teaching_use');
{
  const byName = filterCatalogue(Object.assign(emptyState(), { query: 'Baamboozle' }), catalogue);
  check('search by exact name finds Baamboozle', byName.length === 1 && byName[0].id === 'baamboozle');

  const byDesc = filterCatalogue(Object.assign(emptyState(), { query: 'worksheet archive' }), catalogue);
  check('search by description_short substring finds iSLCollective', byDesc.some(function (r) { return r.id === 'islcollective'; }));

  const bySpeaking = filterCatalogue(Object.assign(emptyState(), { query: 'speaking' }), catalogue);
  const realSpeakingResources = catalogue.filter(function (r) {
    return (r.teaching_use || []).indexOf('speaking') !== -1
      || r.name.toLowerCase().indexOf('speaking') !== -1
      || r.description_short.toLowerCase().indexOf('speaking') !== -1;
  });
  check('search "speaking" finds every resource with speaking in name/description/teaching_use, nothing else',
    ids(bySpeaking).join(',') === ids(realSpeakingResources).join(','));

  const caseInsensitive = filterCatalogue(Object.assign(emptyState(), { query: 'SPEAKING' }), catalogue);
  check('search is case-insensitive', caseInsensitive.length === bySpeaking.length);

  const noMatch = filterCatalogue(Object.assign(emptyState(), { query: 'zzzznonexistentzzzz' }), catalogue);
  check('a genuinely nonexistent query returns an honest empty array, not a fabricated result', noMatch.length === 0);
}

/* ============================================================
   3. Resource Type filter
   ============================================================ */
console.log('\nResource Type filter — matches the real resource_type distribution');
{
  const games = filterCatalogue(Object.assign(emptyState(), { type: 'game' }), catalogue);
  check('type=game returns exactly Baamboozle (the one real game-type resource)',
    games.length === 1 && games[0].id === 'baamboozle');

  const websites = filterCatalogue(Object.assign(emptyState(), { type: 'website' }), catalogue);
  check('type=website returns exactly iSLCollective and LearnEnglish Teens',
    websites.length === 2 && ids(websites).join(',') === ['islcollective', 'learnenglish-teens'].sort().join(','));

  const videos = filterCatalogue(Object.assign(emptyState(), { type: 'video' }), catalogue);
  check('type=video returns exactly VOA Learning English (the one real video-type resource)',
    videos.length === 1 && videos[0].id === 'voa-learning-english');

  const generators = filterCatalogue(Object.assign(emptyState(), { type: 'generator' }), catalogue);
  check('type=generator returns exactly WaffleBrain (the one real generator-type resource)',
    generators.length === 1 && generators[0].id === 'wafflebrain');

  const activities = filterCatalogue(Object.assign(emptyState(), { type: 'activity' }), catalogue);
  check('type=activity is an honest empty result (all FRT-original activities were removed from the live catalogue)',
    activities.length === 0);

  const tools = filterCatalogue(Object.assign(emptyState(), { type: 'tool' }), catalogue);
  check('type=tool is an honest empty result (no resource_type:tool entries remain)',
    tools.length === 0);
}

/* ============================================================
   3b. Primary Category filter — the teacher-facing taxonomy,
   a different axis from resource_type (see data/SCHEMA.md)
   ============================================================ */
console.log('\nPrimary Category filter — matches the real primary_category distribution');
{
  const validCategories = ['teaching_materials', 'web_apps_tools', 'games', 'websites_resource_hubs', 'media'];
  check('every resource has a primary_category value from the 5-value taxonomy',
    catalogue.every(function (r) { return validCategories.indexOf(r.primary_category) !== -1; }));

  const teachingMaterials = filterCatalogue(Object.assign(emptyState(), { category: 'teaching_materials' }), catalogue);
  check('category=teaching_materials is an honest empty result (every teaching_materials entry was an FRT-original activity, now removed)',
    teachingMaterials.length === 0);

  const webAppsTools = filterCatalogue(Object.assign(emptyState(), { category: 'web_apps_tools' }), catalogue);
  check('category=web_apps_tools returns exactly WaffleBrain',
    webAppsTools.length === 1 && webAppsTools[0].id === 'wafflebrain');

  const games = filterCatalogue(Object.assign(emptyState(), { category: 'games' }), catalogue);
  check('category=games returns exactly Baamboozle',
    games.length === 1 && games[0].id === 'baamboozle');

  const hubs = filterCatalogue(Object.assign(emptyState(), { category: 'websites_resource_hubs' }), catalogue);
  check('category=websites_resource_hubs returns exactly iSLCollective and LearnEnglish Teens',
    hubs.length === 2 && ids(hubs).join(',') === ['islcollective', 'learnenglish-teens'].sort().join(','));

  const media = filterCatalogue(Object.assign(emptyState(), { category: 'media' }), catalogue);
  check('category=media returns exactly VOA Learning English',
    media.length === 1 && media[0].id === 'voa-learning-english');

  const combo = filterCatalogue(Object.assign(emptyState(), { category: 'web_apps_tools', type: 'generator' }), catalogue);
  check('category=web_apps_tools AND type=generator returns exactly WaffleBrain',
    combo.length === 1 && combo[0].id === 'wafflebrain');
}

/* ============================================================
   4. Teaching Use filter
   ============================================================ */
console.log('\nTeaching Use filter — matches the real teaching_use tags, never leaks empty-teaching_use resources');
{
  const speaking = filterCatalogue(Object.assign(emptyState(), { use: 'speaking' }), catalogue);
  check('use=speaking returns exactly WaffleBrain (the only resource with a non-empty teaching_use)',
    speaking.length === 1 && speaking[0].id === 'wafflebrain');

  /* Baamboozle, iSLCollective, LearnEnglish Teens, and VOA Learning
     English are all broad external destinations with an honestly
     empty teaching_use — see data/SCHEMA.md — so no other
     teaching_use filter should ever surface them. */
  const emptyUseIds = ['baamboozle', 'islcollective', 'learnenglish-teens', 'voa-learning-english'];
  ['listening', 'grammar', 'vocabulary', 'writing'].forEach(function (use) {
    const list = filterCatalogue(Object.assign(emptyState(), { use: use }), catalogue);
    check('use=' + use + ' is an honest empty result (no remaining resource has that teaching_use)', list.length === 0);
  });
}

/* ============================================================
   5. Level filter — four-state aware
   ============================================================ */
console.log('\nLevel filter — four-state aware, matches the real semantic-set model');
{
  const b1 = filterCatalogue(Object.assign(emptyState(), { level: 'B1' }), catalogue);
  const realB1 = catalogue.filter(function (r) {
    return r.cefr_level && r.cefr_level.mode === 'specific' && (r.cefr_level.values || []).indexOf('B1') !== -1;
  });
  check('level=B1 matches every resource whose cefr_level.values includes B1', ids(b1).join(',') === ids(realB1).join(','));
  check('level=B1 returns exactly iSLCollective and WaffleBrain',
    b1.length === 2 && ids(b1).join(',') === ['islcollective', 'wafflebrain'].sort().join(','));

  const c1 = filterCatalogue(Object.assign(emptyState(), { level: 'C1' }), catalogue);
  check('level=C1 returns exactly iSLCollective (the only resource whose range extends to C1)',
    c1.length === 1 && c1[0].id === 'islcollective');

  check('no remaining resource has a not_applicable cefr_level',
    catalogue.every(function (r) { return !r.cefr_level || r.cefr_level.mode !== 'not_applicable'; }));
}

/* ============================================================
   6. Cost filter
   ============================================================ */
console.log('\nCost filter');
{
  const free = filterCatalogue(Object.assign(emptyState(), { cost: 'free' }), catalogue);
  const paid = filterCatalogue(Object.assign(emptyState(), { cost: 'paid' }), catalogue);
  check('cost=free matches every resource in the catalogue (all 5 are free)', free.length === catalogue.length);
  check('cost=paid is an honest empty result (no paid resource remains — GapTheMind Wonderland was removed)',
    paid.length === 0);
}

/* ============================================================
   7. Combined filters — AND logic, not OR
   ============================================================ */
console.log('\nCombined filters — every active filter narrows further (AND), never widens (OR)');
{
  const combo = filterCatalogue(Object.assign(emptyState(), { type: 'game', use: 'speaking' }), catalogue);
  check('type=game AND use=speaking is an honest empty result (Baamboozle has an empty teaching_use)', combo.length === 0);

  const comboMatch = filterCatalogue(Object.assign(emptyState(), { type: 'generator', use: 'speaking' }), catalogue);
  check('type=generator AND use=speaking returns exactly WaffleBrain',
    comboMatch.length === 1 && comboMatch[0].id === 'wafflebrain');

  const searchPlusFilter = filterCatalogue(Object.assign(emptyState(), { query: 'speaking', type: 'generator' }), catalogue);
  check('search "speaking" AND type=generator returns exactly WaffleBrain',
    searchPlusFilter.length === 1 && searchPlusFilter[0].id === 'wafflebrain');
}

/* ============================================================
   8. No stale reference to retired fields, and no stale reference
      to the removed FRT-original activities, remains in the live
      source files
   ============================================================ */
console.log('\nNo stale references remain in the live source');
{
  const directorySrc = fs.readFileSync(path.join(__dirname, '..', 'directory.js'), 'utf8');
  const cardSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'resource-card.js'), 'utf8');
  const resourcesJsSrc = fs.readFileSync(path.join(__dirname, 'resources.js'), 'utf8');

  check('directory.js has no reference to resource.intent', !/[a-zA-Z_]\.intent\b/.test(directorySrc));
  check('directory.js has no reference to tool_kind', directorySrc.indexOf('tool_kind') === -1);
  check('directory.js has no reference to card_style', directorySrc.indexOf('card_style') === -1);
  check('resource-card.js has no reference to card_style', cardSrc.indexOf('card_style') === -1);
  check('resource-card.js has no reference to resource.intent', !/[a-zA-Z_]\.intent\b/.test(cardSrc));
  check('resources.js no longer exposes byIntent (retired with the intent field)', resourcesJsSrc.indexOf('byIntent') === -1);

  check('every one of the real resources has no leftover intent/tool_kind/card_style field',
    catalogue.every(function (r) {
      return !('intent' in r) && !('tool_kind' in r) && !('card_style' in r);
    }));

  check('every one of the real resources has a teaching_use array (renamed from skills)',
    catalogue.every(function (r) { return Array.isArray(r.teaching_use); }));

  const validTypes = ['website', 'app', 'game', 'pdf', 'generator', 'tool', 'video', 'activity'];
  check('every resource_type value is one of the 8 tightened directory-model values',
    catalogue.every(function (r) { return validTypes.indexOf(r.resource_type) !== -1; }));

  check('directory.js references primary_category (the taxonomy filter is wired up)',
    directorySrc.indexOf('primary_category') !== -1);
  check('resources.js exposes byPrimaryCategory', resourcesJsSrc.indexOf('byPrimaryCategory') !== -1);

  const removedIds = ['backstory-objects', 'category-chain', 'escalation-chain', 'grammar-auction',
    'grammar-detective', 'listening-for-the-lie', 'speaking-experiments', 'student-missions'];
  check('directory.js\'s presentation-rule ID lists (FEATURED_ID/accent lists) reference none of the removed activities',
    removedIds.every(function (id) { return directorySrc.indexOf("'" + id + "'") === -1; }));

  check('the manifest lists none of the 8 removed FRT-original activities',
    removedIds.every(function (id) { return catalogue.every(function (r) { return r.id !== id; }); }));
}

/* ============================================================
   9. Recently Added and All Resources are two views over the SAME
      complete catalogue — All Resources must never exclude the
      items shown in Recently Added.
   ============================================================ */
console.log('\nRecently Added and All Resources — two views, one complete catalogue');
{
  /* ---- MUST MATCH directory.js: sortNewestFirst/sortAlphabetical ---- */
  function sortNewestFirst(resources) {
    return resources.slice().sort(function (a, b) { return (b.date_added > a.date_added) ? 1 : -1; });
  }
  function sortAlphabetical(resources) {
    return resources.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  const recent = sortNewestFirst(catalogue).slice(0, 4);
  const allResourcesDefault = sortAlphabetical(filterCatalogue(emptyState(), catalogue));

  check('All Resources (default, unfiltered) contains all ' + catalogue.length + ' resources', allResourcesDefault.length === catalogue.length);

  check('Every Recently Added item is also present in All Resources (never excluded)',
    recent.every(function (r) { return allResourcesDefault.some(function (a) { return a.id === r.id; }); }));

  check('All Resources default order is alphabetical by name, not newest-first',
    allResourcesDefault.every(function (r, i) {
      return i === 0 || allResourcesDefault[i - 1].name.localeCompare(r.name) <= 0;
    }));
}

/* ============================================================
   10. Every catalogue resource must have a real, usable image.
   No resource may silently ship without one — see data/SCHEMA.md
   and tools/generate_thumbnail.py. A missing `image` field, a
   dangling path, or a malformed/wrong-size PNG must fail here
   rather than rendering broken or blank on the live site.
   ============================================================ */
console.log('\nEvery resource has a real, correctly-sized image');
{
  const IMAGES_DIR = path.join(__dirname, '..', 'images', 'resources');
  const EXPECTED_SIZE = 480;

  catalogue.forEach(function (r) {
    check(r.id + ': has a non-empty image field',
      typeof r.image === 'string' && r.image.length > 0);

    if (typeof r.image !== 'string' || !r.image.length) return;

    const imagePath = path.join(__dirname, '..', r.image);
    const exists = fs.existsSync(imagePath);
    check(r.id + ': image file exists on disk (' + r.image + ')', exists);
    if (!exists) return;

    check(r.id + ': image lives under images/resources/',
      path.resolve(imagePath).startsWith(path.resolve(IMAGES_DIR) + path.sep));

    const buf = fs.readFileSync(imagePath);
    const isPng = buf.length > 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    check(r.id + ': image is a valid PNG', isPng);
    if (!isPng) return;

    /* PNG IHDR: width and height are the two 4-byte big-endian
       integers starting at byte 16, per the PNG spec's fixed
       chunk layout — no image library needed to read this. */
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    check(r.id + ': image is ' + EXPECTED_SIZE + 'x' + EXPECTED_SIZE + ' (found ' + width + 'x' + height + ')',
      width === EXPECTED_SIZE && height === EXPECTED_SIZE);
  });
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
