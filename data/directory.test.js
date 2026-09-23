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
   1. Default state (no query, no filters) shows every resource
   ============================================================ */
console.log('Default state — no search, no filters — shows the full catalogue');
{
  const result = filterCatalogue(emptyState(), catalogue);
  check('empty state returns all resources', result.length === catalogue.length, 'got ' + result.length);
}

/* ============================================================
   2. Search matches name, description_short, and teaching_use
   ============================================================ */
console.log('\nSearch — matches name, description_short, and teaching_use');
{
  const byName = filterCatalogue(Object.assign(emptyState(), { query: 'Grammar Detective' }), catalogue);
  check('search by exact name finds Grammar Detective', byName.length === 1 && byName[0].id === 'grammar-detective');

  const byDesc = filterCatalogue(Object.assign(emptyState(), { query: 'lesson logger' }), catalogue);
  check('search by description_short substring finds LessonTrak', byDesc.some(function (r) { return r.id === 'lessontrak'; }));

  const byUse = filterCatalogue(Object.assign(emptyState(), { query: 'grammar' }), catalogue);
  const realGrammarResources = catalogue.filter(function (r) {
    return (r.teaching_use || []).indexOf('grammar') !== -1
      || r.name.toLowerCase().indexOf('grammar') !== -1
      || r.description_short.toLowerCase().indexOf('grammar') !== -1;
  });
  check('search "grammar" finds every resource with grammar in name/description/teaching_use, nothing else',
    ids(byUse).join(',') === ids(realGrammarResources).join(','));

  const caseInsensitive = filterCatalogue(Object.assign(emptyState(), { query: 'GRAMMAR' }), catalogue);
  check('search is case-insensitive', caseInsensitive.length === byUse.length);

  const noMatch = filterCatalogue(Object.assign(emptyState(), { query: 'zzzznonexistentzzzz' }), catalogue);
  check('a genuinely nonexistent query returns an honest empty array, not a fabricated result', noMatch.length === 0);
}

/* ============================================================
   3. Resource Type filter
   ============================================================ */
console.log('\nResource Type filter — matches the real resource_type distribution');
{
  const tools = filterCatalogue(Object.assign(emptyState(), { type: 'tool' }), catalogue);
  check('type=tool returns exactly the 4 real FRT admin tools',
    tools.length === 4 && ids(tools).join(',') === ['lesson-plan-viewer', 'lessontrak', 'report-writer', 'zard'].sort().join(','));

  const games = filterCatalogue(Object.assign(emptyState(), { type: 'game' }), catalogue);
  check('type=game returns exactly the 4 real game-type resources',
    games.length === 4 && ids(games).join(',') === ['baamboozle', 'category-chain', 'grammar-auction', 'gtmk-wonderland'].sort().join(','));

  const websites = filterCatalogue(Object.assign(emptyState(), { type: 'website' }), catalogue);
  check('type=website returns exactly the 2 real website-type resources',
    websites.length === 2 && ids(websites).join(',') === ['islcollective', 'learnenglish-teens'].sort().join(','));

  const videos = filterCatalogue(Object.assign(emptyState(), { type: 'video' }), catalogue);
  check('type=video returns exactly VOA Learning English (the one real video-type resource)',
    videos.length === 1 && videos[0].id === 'voa-learning-english');

  const activities = filterCatalogue(Object.assign(emptyState(), { type: 'activity' }), catalogue);
  const realActivityIds = catalogue.filter(function (r) { return r.resource_type === 'activity'; });
  check('type=activity returns every real activity-type resource, no more no less', activities.length === realActivityIds.length);
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
  check('category=teaching_materials returns exactly the 6 ready-to-use activity resources',
    teachingMaterials.length === 6 && ids(teachingMaterials).join(',') === [
      'backstory-objects', 'escalation-chain', 'grammar-detective',
      'listening-for-the-lie', 'speaking-experiments', 'student-missions'
    ].sort().join(','));

  const webAppsTools = filterCatalogue(Object.assign(emptyState(), { category: 'web_apps_tools' }), catalogue);
  check('category=web_apps_tools returns exactly the 5 tools/generators',
    webAppsTools.length === 5 && ids(webAppsTools).join(',') === [
      'lesson-plan-viewer', 'lessontrak', 'report-writer', 'wafflebrain', 'zard'
    ].sort().join(','));

  const games = filterCatalogue(Object.assign(emptyState(), { category: 'games' }), catalogue);
  check('category=games returns exactly the 4 real games',
    games.length === 4 && ids(games).join(',') === ['baamboozle', 'category-chain', 'grammar-auction', 'gtmk-wonderland'].sort().join(','));

  const hubs = filterCatalogue(Object.assign(emptyState(), { category: 'websites_resource_hubs' }), catalogue);
  check('category=websites_resource_hubs returns exactly iSLCollective and LearnEnglish Teens',
    hubs.length === 2 && ids(hubs).join(',') === ['islcollective', 'learnenglish-teens'].sort().join(','));

  const media = filterCatalogue(Object.assign(emptyState(), { category: 'media' }), catalogue);
  check('category=media returns exactly VOA Learning English (the one real media resource)',
    media.length === 1 && media[0].id === 'voa-learning-english');

  const combo = filterCatalogue(Object.assign(emptyState(), { category: 'web_apps_tools', type: 'generator' }), catalogue);
  check('category=web_apps_tools AND type=generator returns exactly WaffleBrain (the only resource_type:generator entry)',
    combo.length === 1 && combo[0].id === 'wafflebrain');
}

/* ============================================================
   4. Teaching Use filter
   ============================================================ */
console.log('\nTeaching Use filter — matches the real teaching_use tags, never leaks admin tools');
{
  const grammar = filterCatalogue(Object.assign(emptyState(), { use: 'grammar' }), catalogue);
  check('use=grammar returns exactly Grammar Detective and Grammar Auction',
    grammar.length === 2 && ids(grammar).join(',') === ['grammar-auction', 'grammar-detective'].sort().join(','));

  const listening = filterCatalogue(Object.assign(emptyState(), { use: 'listening' }), catalogue);
  check('use=listening returns exactly Listening for the Lie and Escalation Chain',
    listening.length === 2 && ids(listening).join(',') === ['escalation-chain', 'listening-for-the-lie'].sort().join(','));

  const speaking = filterCatalogue(Object.assign(emptyState(), { use: 'speaking' }), catalogue);
  check('use=speaking never includes an admin tool (empty teaching_use resources are correctly excluded)',
    speaking.every(function (r) { return (r.teaching_use || []).indexOf('speaking') !== -1; }));

  const toolIds = ['lessontrak', 'report-writer', 'zard', 'lesson-plan-viewer'];
  ['speaking', 'listening', 'grammar', 'vocabulary', 'writing'].forEach(function (use) {
    const list = filterCatalogue(Object.assign(emptyState(), { use: use }), catalogue);
    const leaked = list.some(function (r) { return toolIds.indexOf(r.id) !== -1; });
    check('use=' + use + ' never surfaces one of the 4 admin tools (their teaching_use is honestly empty)', leaked === false);
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

  const c1 = filterCatalogue(Object.assign(emptyState(), { level: 'C1' }), catalogue);
  check('level=C1 excludes resources whose level range does not include C1 (e.g. Category Chain, A2-B2)',
    c1.every(function (r) { return r.id !== 'category-chain'; }));

  const notApplicableToolsExcluded = filterCatalogue(Object.assign(emptyState(), { level: 'B1' }), catalogue);
  check('a not_applicable cefr_level (the 4 admin tools) never matches a specific level filter',
    notApplicableToolsExcluded.every(function (r) { return r.id !== 'lessontrak'; }));
}

/* ============================================================
   6. Cost filter
   ============================================================ */
console.log('\nCost filter');
{
  const free = filterCatalogue(Object.assign(emptyState(), { cost: 'free' }), catalogue);
  const paid = filterCatalogue(Object.assign(emptyState(), { cost: 'paid' }), catalogue);
  check('cost=free matches every free resource', free.every(function (r) { return r.cost === 'free'; }));
  check('cost=paid returns exactly GapTheMind Wonderland (the one real paid resource)',
    paid.length === 1 && paid[0].id === 'gtmk-wonderland');
}

/* ============================================================
   7. Combined filters — AND logic, not OR
   ============================================================ */
console.log('\nCombined filters — every active filter narrows further (AND), never widens (OR)');
{
  const combo = filterCatalogue(Object.assign(emptyState(), { type: 'game', use: 'grammar' }), catalogue);
  check('type=game AND use=grammar returns exactly Grammar Auction (the only game that is also grammar-tagged)',
    combo.length === 1 && combo[0].id === 'grammar-auction');

  const comboNone = filterCatalogue(Object.assign(emptyState(), { type: 'tool', use: 'speaking' }), catalogue);
  check('type=tool AND use=speaking is an honest empty result (no admin tool has a teaching_use)', comboNone.length === 0);

  const searchPlusFilter = filterCatalogue(Object.assign(emptyState(), { query: 'grammar', type: 'game' }), catalogue);
  check('search "grammar" AND type=game returns exactly Grammar Auction',
    searchPlusFilter.length === 1 && searchPlusFilter[0].id === 'grammar-auction');
}

/* ============================================================
   8. No stale reference to the retired intent/tool_kind/card_style
      fields remains in the live source files
   ============================================================ */
console.log('\nNo stale reference to the retired intent/tool_kind/card_style fields remains in the live source');
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

  check('directory.js references primary_category (the new taxonomy filter is wired up)',
    directorySrc.indexOf('primary_category') !== -1);
  check('resources.js exposes byPrimaryCategory', resourcesJsSrc.indexOf('byPrimaryCategory') !== -1);
}

/* ============================================================
   9. Recently Added and All Resources are two views over the SAME
      complete catalogue — All Resources must never exclude the
      items shown in Recently Added (this was an explicit
      correction to an earlier draft of this phase).
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

  const namesMatchNewestOrder = recent.map(function (r) { return r.id; }).join(',')
    === allResourcesDefault.slice(0, 4).map(function (r) { return r.id; }).join(',');
  check('All Resources default order is NOT the same 4 items in the same order as Recently Added (the repetition this phase fixes)',
    namesMatchNewestOrder === false);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
