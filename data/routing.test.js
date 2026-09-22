/* ============================================================
   HOMEPAGE / BROWSE TAXONOMY ROUTING — tests
   Plain Node, no framework/runner dependency. Run with:
     node data/routing.test.js

   dispatch-home.js and browse.js are DOM-coupled (they render
   directly into the page), so this file re-implements their
   routing logic in isolation, kept in lockstep with the real
   source — see the "MUST MATCH" comments below pointing at the
   exact functions being mirrored. If those functions change,
   this file's copies must change with them.
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

/* ---- MUST MATCH dispatch-home.js: teachResources(), resourcesForTile() ---- */
function teachResources(allResources) {
  return allResources.filter(function (r) { return r.intent && r.intent.indexOf('teach') !== -1; });
}

const HOME_PATHWAY_TO_SKILL = { talking: 'speaking', vocab: 'vocab', grammar: 'grammar', listen_watch: 'listening' };

function homeResourcesForTile(pathway, allResources) {
  if (pathway === 'emergency') {
    return teachResources(allResources).filter(function (r) {
      return r.activity_time_minutes != null && r.activity_time_minutes <= 10;
    });
  }
  if (pathway === 'tools') {
    return allResources.filter(function (r) { return r.intent && r.intent.indexOf('manage') !== -1; });
  }
  const teach = teachResources(allResources);
  if (pathway === 'play') {
    return teach.filter(function (r) { return r.resource_type === 'game'; });
  }
  const skill = HOME_PATHWAY_TO_SKILL[pathway];
  return teach.filter(function (r) { return skill && r.skills && r.skills.indexOf(skill) !== -1; });
}

/* ---- MUST MATCH browse.js: teachResources(), resourcesForSkillGroup() ---- */
function browseResourcesForSkillGroup(skill, allRes) {
  const teach = teachResources(allRes);
  if (skill === 'play') {
    return teach.filter(function (r) { return r.resource_type === 'game'; });
  }
  return teach.filter(function (r) { return r.skills && r.skills.indexOf(skill) !== -1; });
}

/* ============================================================
   1. Each homepage tile resolves through the new taxonomy
   ============================================================ */
console.log('Homepage tiles — each resolves via intent/skills/resource_type, not fabricated');
{
  const PATHWAYS = ['emergency', 'tools', 'talking', 'play', 'vocab', 'grammar', 'listen_watch'];
  PATHWAYS.forEach(function (p) {
    const list = homeResourcesForTile(p, catalogue);
    check('tile "' + p + '" returns an array (possibly empty, never throws)', Array.isArray(list));
  });

  check('"talking" tile returns the real speaking-tagged teach resources',
    ids(homeResourcesForTile('talking', catalogue)).join(',') ===
    ids(catalogue.filter(function (r) { return r.intent.indexOf('teach') !== -1 && r.skills.indexOf('speaking') !== -1; })).join(','));

  check('"tools" tile returns exactly the 4 real manage resources',
    homeResourcesForTile('tools', catalogue).length === 4);

  check('"emergency" tile grows to include the Sep 2026 quick-resource batch (5 of the 6 are 10 min or under)',
    homeResourcesForTile('emergency', catalogue).length === 6);

  check('"emergency" tile only returns teach resources under 10 minutes',
    homeResourcesForTile('emergency', catalogue).every(function (r) {
      return r.intent.indexOf('teach') !== -1 && r.activity_time_minutes <= 10;
    }));
}

/* ============================================================
   2. Browse sections resolve through the new taxonomy
   ============================================================ */
console.log('\nBrowse "By purpose" groups — each resolves via intent/skills/resource_type');
{
  const SKILLS = ['speaking', 'play', 'vocab', 'grammar', 'listening'];
  SKILLS.forEach(function (s) {
    const list = browseResourcesForSkillGroup(s, catalogue);
    check('group "' + s + '" returns an array (possibly empty, never throws)', Array.isArray(list));
  });

  check('"speaking" group matches the homepage "talking" tile exactly (same underlying data, same routing)',
    ids(browseResourcesForSkillGroup('speaking', catalogue)).join(',') === ids(homeResourcesForTile('talking', catalogue)).join(','));
}

/* ============================================================
   3. Teaching pathways cannot leak find_tool/manage resources
   ============================================================ */
console.log('\nTeaching pathways never leak manage/find_tool resources');
{
  const PATHWAYS = ['talking', 'play', 'vocab', 'grammar', 'listen_watch', 'emergency'];
  PATHWAYS.forEach(function (p) {
    const leaked = homeResourcesForTile(p, catalogue).some(function (r) {
      return r.intent.indexOf('teach') === -1;
    });
    check('homepage tile "' + p + '" never contains a non-teach resource', leaked === false);
  });

  const SKILLS = ['speaking', 'play', 'vocab', 'grammar', 'listening'];
  SKILLS.forEach(function (s) {
    const leaked = browseResourcesForSkillGroup(s, catalogue).some(function (r) {
      return r.intent.indexOf('teach') === -1;
    });
    check('Browse group "' + s + '" never contains a non-teach resource', leaked === false);
  });

  // The specific regression case: before this migration, the 4 FRT admin
  // tools had empty `skills` arrays, so `skills.indexOf(x) !== -1` was
  // always false for them anyway — but confirm explicitly, since a
  // future tool with an incidental skill tag must still be excluded by
  // the intent gate, not rely on skills happening to be empty.
  const toolIds = ['lessontrak', 'report-writer', 'zard', 'lesson-plan-viewer'];
  PATHWAYS.forEach(function (p) {
    const present = homeResourcesForTile(p, catalogue).some(function (r) { return toolIds.indexOf(r.id) !== -1; });
    check('none of the 4 real FRT tools appear under homepage tile "' + p + '"', present === false);
  });
}

/* ============================================================
   4. Tool pathways cannot surface teaching activities
   ============================================================ */
console.log('\n"Your Own Tools" tile never surfaces a teaching-only resource');
{
  const list = homeResourcesForTile('tools', catalogue);
  const teachOnlyLeaked = list.some(function (r) { return r.intent.indexOf('manage') === -1; });
  check('every resource under "Your Own Tools" has manage in its intent', teachOnlyLeaked === false);

  const teachActivityIds = ['speaking-experiments', 'gtmk-wonderland', 'islcollective'];
  const present = list.some(function (r) { return teachActivityIds.indexOf(r.id) !== -1; });
  check('none of the real teaching activities appear under "Your Own Tools"', present === false);
}

/* ============================================================
   5. Existing valid results remain available after migration
   ============================================================ */
console.log('\nExisting valid results still resolve correctly (no regressions from the routing change)');
{
  const talking = homeResourcesForTile('talking', catalogue);
  check('"Get Them Talking" still finds Speaking Experiments', talking.some(function (r) { return r.id === 'speaking-experiments'; }));
  check('"Get Them Talking" still finds GapTheMind Wonderland (speaking-tagged, commercial, still a teach resource)',
    talking.some(function (r) { return r.id === 'gtmk-wonderland'; }));

  const play = homeResourcesForTile('play', catalogue);
  check('"Play Something" still finds GapTheMind Wonderland, plus the two new game-type resources from the Sep 2026 batch',
    play.length === 3 && ids(play).join(',') === ['category-chain', 'grammar-auction', 'gtmk-wonderland'].sort().join(','));

  const tools = homeResourcesForTile('tools', catalogue);
  check('"Your Own Tools" still finds all 4 real FRT tools', ids(tools).join(',') === ['lesson-plan-viewer', 'lessontrak', 'report-writer', 'zard'].sort().join(','));
}

/* ============================================================
   6. No old skill-based fallback is silently still in use
   ============================================================ */
console.log('\nNo stale reference to the removed "pathways" field remains in the live source files');
{
  const dispatchHomeSrc = fs.readFileSync(path.join(__dirname, '..', 'dispatch-home.js'), 'utf8');
  const browseSrc = fs.readFileSync(path.join(__dirname, '..', 'browse.js'), 'utf8');
  check('dispatch-home.js has no live reference to resource.pathways', !/[a-zA-Z_]\.pathways\b/.test(dispatchHomeSrc));
  check('browse.js has no live reference to resource.pathways', !/[a-zA-Z_]\.pathways\b/.test(browseSrc));
  check('dispatch-home.js routing is intent-gated (references teachResources)', dispatchHomeSrc.indexOf('teachResources') !== -1);
  check('browse.js routing is intent-gated (references teachResources)', browseSrc.indexOf('teachResources') !== -1);
}

/* ============================================================
   7. Intentionally empty categories are handled honestly
   ============================================================ */
console.log('\nEmpty categories return an honest empty array, never fabricated results');
{
  const vocab = homeResourcesForTile('vocab', catalogue);
  const grammar = homeResourcesForTile('grammar', catalogue);
  const listen = homeResourcesForTile('listen_watch', catalogue);
  // These are genuinely empty in the current real catalogue (confirmed by
  // the Stage 4 content audit) — asserting the exact expected state, not
  // just "some might be empty," so a future content addition that fills
  // one of these will make this specific assertion fail and need updating
  // deliberately, rather than silently drifting.
  // Both of these were genuine content gaps until the Sep 2026 quick-resource
  // batch (Grammar Detective + Grammar Auction; Listening for the Lie +
  // Escalation Chain) deliberately filled them. Updated here explicitly,
  // not silently, per this file's own stated convention above.
  check('"grammar" tile now has 2 real resources (Grammar Detective, Grammar Auction) after the Sep 2026 batch', grammar.length === 2);
  check('"listen_watch" tile now has 2 real resources (Listening for the Lie, Escalation Chain) after the Sep 2026 batch', listen.length === 2);
  check('vocab-tagged resources now include Category Chain alongside Wonderland (2, after the Sep 2026 batch)', vocab.length === 2);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
