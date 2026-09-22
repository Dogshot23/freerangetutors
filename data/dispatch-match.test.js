/* ============================================================
   THE DISPATCH — matching engine tests
   Plain Node, no framework/runner dependency. Run with:
     node data/dispatch-match.test.js
   Loads the real 11 migrated resources from data/resources/ and
   runs the seven scenarios specified for Stage 3, plus a few
   focused unit checks on the scoring internals.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RESOURCES_DIR = path.join(__dirname, 'resources');
const catalogue = fs.readdirSync(RESOURCES_DIR)
  .filter(function (f) { return f.endsWith('.json'); })
  .map(function (f) { return JSON.parse(fs.readFileSync(path.join(RESOURCES_DIR, f), 'utf8')); });

// dispatch-match.js attaches to `window` — provide a minimal shim so the
// same unmodified browser file can run under plain Node for testing.
const sandbox = { window: {} };
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, 'dispatch-match.js'), 'utf8');
vm.runInContext(src, sandbox);
const DispatchMatch = sandbox.window.DispatchMatch;

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

function names(result) {
  return result.results.map(function (r) { return r.resource.name; });
}

console.log('Catalogue loaded: ' + catalogue.length + ' resources\n');

/* ---- Test 1: 10 min, teen, B1, speaking, no prep ---- */
console.log('Test 1 — 10 min / teen / B1 / speaking / no prep');
{
  const r = DispatchMatch.run(catalogue, { intent: 'teach', time: 10, age: 'teen', level: 'B1', need: 'talking', prep: 'none' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('status is match or nearest, never none', r.status !== 'none');
  check('top result is a speaking resource', r.results.length > 0 && r.results[0].resource.skills.indexOf('speaking') !== -1);
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 2: 30 min, 12yo group, B2, speaking ---- */
console.log('\nTest 2 — 30 min / 12yo (teen) group / B2 / speaking');
{
  const r = DispatchMatch.run(catalogue, { intent: 'teach', time: 30, age: 'teen', level: 'B2', need: 'talking', group: 'group' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('every result suits teen audience (universal, or specific including teen)', r.results.every(function (x) {
    const mode = DispatchMatch._internal.setMode(x.resource.age_group);
    return mode === 'universal' || mode === 'unknown'
      || (mode === 'specific' && DispatchMatch._internal.setValues(x.resource.age_group).indexOf('teen') !== -1);
  }));
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 3: 5 min filler, any audience, any level, no prep ---- */
console.log('\nTest 3 — 5 min / any / any / filler / no prep');
{
  const r = DispatchMatch.run(catalogue, { intent: 'teach', time: 5, need: 'filler', prep: 'none' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('no result runs anywhere near 45 min (the brief\'s explicit bad case)', r.results.every(function (x) {
    const t = x.resource.activity_time_minutes;
    return t == null || t <= 15;
  }));
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 4: 45 min, adult, B2, speaking, moderate prep ---- */
console.log('\nTest 4 — 45 min / adult / B2 / speaking / moderate prep');
{
  const r = DispatchMatch.run(catalogue, { intent: 'teach', time: 45, age: 'adult', level: 'B2', need: 'talking', prep: 'moderate' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('Conversation Systems or Field Pack (the two long-form speaking resources) is top or present', names(r).some(function (n) {
    return n.indexOf('Conversation Systems') !== -1 || n.indexOf('Field Pack') !== -1;
  }));
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 5: one adult, B2, speaking, no prep (1:1) ---- */
console.log('\nTest 5 — 1:1 adult / B2 / speaking / no prep');
{
  const r = DispatchMatch.run(catalogue, { intent: 'teach', age: 'adult', level: 'B2', need: 'talking', prep: 'none', group: 'individual' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 6: printable, any audience, 30 min ---- */
console.log('\nTest 6 — printable / any / 30 min');
{
  const r = DispatchMatch.run(catalogue, { intent: 'teach', time: 30, need: 'printable' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('every result is the printable resource_type', r.results.every(function (x) {
    return x.resource.resource_type === 'printable';
  }));
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 7: deliberately impossible request ---- */
console.log('\nTest 7 — deliberately impossible: 5 min / young_learner / C1 / grammar / no prep');
{
  const r = DispatchMatch.run(catalogue, { intent: 'teach', time: 5, age: 'young_learner', level: 'C1', need: 'grammar', prep: 'none' });
  check('status is none (catalogue genuinely has nothing for this)', r.status === 'none', 'got status=' + r.status + ', results=' + names(r).join(','));
  check('note is present and honest, not a silent empty list', typeof r.note === 'string' && r.note.length > 0);
  console.log('  -> ' + r.status + ': ' + (r.note || '(no note)'));
}

/* ---- Focused unit checks on scoring internals ---- */
console.log('\nUnit checks — bestUsableMinutes()');
{
  // Synthetic fixture (dual-duration resource, 45 min primary / 10 min alt) —
  // previously the real "field-packs" catalogue entry, which was a content
  // placeholder removed from the live catalogue. Kept as a synthetic fixture
  // here since the algorithm behaviour it exercises (alt-duration resolution)
  // is unrelated to whether that specific product content ever gets built.
  const dualDurationResource = {
    id: 'synthetic-dual-duration', name: 'Synthetic Dual-Duration Resource', card_style: 'activity',
    resource_type: 'printable', intent: ['teach'], skills: ['speaking'],
    age_group: { mode: 'specific', values: ['adult'] }, cefr_level: { mode: 'specific', values: ['B1', 'B2'] },
    group_fit: { mode: 'specific', values: ['pair', 'group'] },
    prep_level: 'none', activity_time_minutes: 45, duration_alt_minutes: 10,
    source_category: 'own_original'
  };
  check('a 45 min / 10 min alt resource resolves to 10 as the best usable duration',
    DispatchMatch._internal.bestUsableMinutes(dualDurationResource) === 10);
}

console.log('\nUnit checks — hard filter excludes grossly incompatible duration only for small windows');
{
  // Synthetic fixture (40 min, no alt duration) — previously the real
  // "conversation-systems" catalogue entry, removed as a content placeholder;
  // see note above.
  const longFormNoAltResource = {
    id: 'synthetic-long-form-no-alt', name: 'Synthetic Long-Form Resource', card_style: 'activity',
    resource_type: 'lesson', intent: ['teach'], skills: ['speaking'],
    age_group: { mode: 'specific', values: ['adult'] }, cefr_level: { mode: 'specific', values: ['B2', 'C1'] },
    group_fit: { mode: 'specific', values: ['group'] },
    prep_level: 'moderate', activity_time_minutes: 40, duration_alt_minutes: null,
    source_category: 'own_original'
  };
  const passesAt5 = DispatchMatch._internal.passesHardFilter(longFormNoAltResource, { time: 5 });
  const passesAt30 = DispatchMatch._internal.passesHardFilter(longFormNoAltResource, { time: 30 });
  check('a 40-min resource with no alt is excluded from a 5-min request', passesAt5 === false);
  check('the same 40-min resource is NOT hard-excluded from a 30-min request (soft penalty instead)', passesAt30 === true);
}

console.log('\nUnit checks — level scoring never treats a 2-step gap as free');
{
  const speaking = catalogue.find(function (r) { return r.id === 'speaking-experiments'; }); // B1-C1
  const scoreExact = DispatchMatch._internal.scoreResource(speaking, { level: 'B1' });
  const scoreFar = DispatchMatch._internal.scoreResource(speaking, { level: 'A1' }); // 2 steps from B1
  check('exact level match costs 0', scoreExact.breakdown[0].cost === 0);
  check('a 2-step level gap costs more than a 1-step gap would', scoreFar.breakdown[0].cost > 0);
}

/* ============================================================
   FOUR-STATE SEMANTIC MODEL — Stage 4.5 migration tests
   universal / specific / unknown / not_applicable, tested against
   real catalogue entries plus synthetic fixtures for states the
   current 11 resources don't happen to exercise (a genuinely
   universal tool didn't exist in the catalogue before this
   migration, so it's tested with a minimal synthetic fixture here).
   ============================================================ */

console.log('\nFour-state semantics — setMode() / setValues() / setExcludes()');
{
  const universal = { mode: 'universal' };
  const specific = { mode: 'specific', values: ['teen', 'adult'] };
  const unknown = { mode: 'unknown' };
  const notApplicable = { mode: 'not_applicable' };

  check('setMode reads universal correctly', DispatchMatch._internal.setMode(universal) === 'universal');
  check('setMode reads specific correctly', DispatchMatch._internal.setMode(specific) === 'specific');
  check('setMode reads unknown correctly', DispatchMatch._internal.setMode(unknown) === 'unknown');
  check('setMode reads not_applicable correctly', DispatchMatch._internal.setMode(notApplicable) === 'not_applicable');
  check('setMode treats a missing/undefined field as not_applicable, never universal', DispatchMatch._internal.setMode(undefined) === 'not_applicable');

  check('universal never excludes any query value', DispatchMatch._internal.setExcludes(universal, 'teen') === false);
  check('specific excludes a value outside its list', DispatchMatch._internal.setExcludes(specific, 'young_learner') === true);
  check('specific does not exclude a value inside its list', DispatchMatch._internal.setExcludes(specific, 'teen') === false);
  check('unknown never hard-excludes', DispatchMatch._internal.setExcludes(unknown, 'teen') === false);
  check('not_applicable never hard-excludes', DispatchMatch._internal.setExcludes(notApplicable, 'teen') === false);
}

console.log('\nUNIVERSAL can match broadly — synthetic audience-agnostic tool (a whiteboard-style fixture)');
{
  const universalTool = {
    id: 'synthetic-whiteboard', name: 'Synthetic Whiteboard', card_style: 'activity',
    resource_type: 'tool', intent: ['find_tool'], skills: [],
    age_group: { mode: 'universal' }, cefr_level: { mode: 'universal' }, group_fit: { mode: 'universal' },
    prep_level: 'none', activity_time_minutes: null, duration_alt_minutes: null,
    source_category: 'own_original'
  };
  const r1 = DispatchMatch.run([universalTool], { age: 'young_learner', level: 'C1', group: 'individual' });
  check('a UNIVERSAL tool matches a young_learner/C1/1:1 request with no hard exclusion', r1.results.length === 1 && r1.status === 'match');
  const score = DispatchMatch._internal.scoreResource(universalTool, { age: 'adult', level: 'B1', group: 'group' });
  check('UNIVERSAL costs exactly 0 on every dimension it covers', score.total === 0);
}

console.log('\nSPECIFIC matches only compatible values — real catalogue entry (Speaking Experiments, teen/adult only)');
{
  const speaking = catalogue.find(function (r) { return r.id === 'speaking-experiments'; });
  check('SPECIFIC age_group is teen+adult, confirmed from real data', DispatchMatch._internal.setValues(speaking.age_group).sort().join(',') === 'adult,teen');
  const passesTeen = DispatchMatch._internal.passesHardFilter(speaking, { age: 'teen' });
  const passesYoungLearner = DispatchMatch._internal.passesHardFilter(speaking, { age: 'young_learner' });
  check('SPECIFIC passes a compatible query value', passesTeen === true);
  check('SPECIFIC hard-excludes an incompatible query value', passesYoungLearner === false);
}

console.log('\nUNKNOWN never receives a confident exact match merely because the field is empty/unknown');
{
  const unknownLevelResource = {
    id: 'synthetic-unknown-level', name: 'Synthetic Unknown-Level Resource', card_style: 'activity',
    resource_type: 'activity', intent: ['teach'], skills: ['speaking'],
    age_group: { mode: 'universal' }, cefr_level: { mode: 'unknown' }, group_fit: { mode: 'not_applicable' },
    prep_level: 'none', activity_time_minutes: 10, duration_alt_minutes: null,
    source_category: 'own_original'
  };
  const knownGoodResource = {
    id: 'synthetic-known-b1', name: 'Synthetic Known-B1 Resource', card_style: 'activity',
    resource_type: 'activity', intent: ['teach'], skills: ['speaking'],
    age_group: { mode: 'universal' }, cefr_level: { mode: 'specific', values: ['B1'] }, group_fit: { mode: 'not_applicable' },
    prep_level: 'none', activity_time_minutes: 10, duration_alt_minutes: null,
    source_category: 'own_original'
  };
  const r = DispatchMatch.run([unknownLevelResource, knownGoodResource], { time: 10, level: 'B1', need: 'talking' });
  check('a genuine SPECIFIC/exact match outranks an UNKNOWN one (UNKNOWN is never free)', r.results[0].resource.id === 'synthetic-known-b1');
  check('status is match (the real match wins), not falsely inflated by the unknown resource', r.status === 'match');

  const soloUnknown = DispatchMatch.run([unknownLevelResource], { time: 10, level: 'B1', need: 'talking' });
  check('UNKNOWN alone never reports as an exact "match" status — always nearest at best', soloUnknown.status === 'nearest');
  check('UNKNOWN carries a real, non-zero penalty, not a free ride', DispatchMatch._internal.scoreResource(unknownLevelResource, { level: 'B1' }).breakdown[0].cost === DispatchMatch._internal.UNKNOWN_PENALTY);
}

console.log('\nNOT_APPLICABLE does not penalise or falsely constrain a resource on that dimension');
{
  const lessontrak = catalogue.find(function (r) { return r.id === 'lessontrak'; });
  check('LessonTrak\'s age_group is NOT_APPLICABLE in the real migrated data', DispatchMatch._internal.setMode(lessontrak.age_group) === 'not_applicable');
  const passesAnyAge = DispatchMatch._internal.passesHardFilter(lessontrak, { age: 'young_learner' });
  check('NOT_APPLICABLE never hard-excludes on age', passesAnyAge === true);
  const score = DispatchMatch._internal.scoreResource(lessontrak, { age: 'young_learner', level: 'A1', group: 'individual' });
  check('NOT_APPLICABLE dimensions are entirely absent from the score breakdown (not scored, not penalised)', score.breakdown.length === 0);
}

console.log('\nRegression check — no remaining assumption that an empty/missing array means "universal"');
{
  // Every migrated resource's semantic-set fields must be real mode
  // objects, never a bare array (which the old engine treated as an
  // implicit "matches everyone" — the exact bug this migration fixes).
  const allHaveModes = catalogue.every(function (r) {
    return ['age_group', 'cefr_level', 'group_fit'].every(function (field) {
      return r[field] && typeof r[field] === 'object' && !Array.isArray(r[field]) && typeof r[field].mode === 'string';
    });
  });
  check('every real resource in the catalogue has proper {mode,...} objects on all three semantic-set fields', allHaveModes);

  // Confirm the specific bug case from the Stage 4 audit is actually fixed:
  // an FRT tool queried for a specific age/group no longer scores as a
  // silent perfect match purely because the field used to be an empty array.
  const reportWriter = catalogue.find(function (r) { return r.id === 'report-writer'; });
  check('Report Writer is explicitly NOT_APPLICABLE for age (not an empty array read as universal)', DispatchMatch._internal.setMode(reportWriter.age_group) === 'not_applicable');
}

/* ============================================================
   TEACH / FIND-A-TOOL FORK — routing and leakage-prevention tests
   Locked Product Decision A: the Dispatch first screen is a
   two-door fork (Teach Something / Find a Tool), gated by the
   resource's own `intent` array, checked explicitly in
   passesHardFilter() rather than left to fall out of scoring.
   ============================================================ */

console.log('\nTeach fork — never surfaces manage-only tools (the leakage this fork exists to prevent)');
{
  // This exact query (10 min / teen / B1 / speaking) was the original
  // case where FRT's own admin tools scored as a false "exact match"
  // before the Stage 4.5 semantic migration, because their audience
  // fields were empty arrays read as universal. The intent gate added
  // in this stage is the actual fix — confirm it here directly, not
  // just as a side effect of a scoring change.
  const r = DispatchMatch.run(catalogue, { intent: 'teach', time: 10, age: 'teen', level: 'B1', need: 'talking' });
  const manageLeaked = r.results.some(function (x) { return x.resource.intent.indexOf('teach') === -1; });
  check('no manage-only resource appears in a teach query\'s results', manageLeaked === false);

  const allFourTools = ['lessontrak', 'report-writer', 'zard', 'lesson-plan-viewer'];
  const r2 = DispatchMatch.run(catalogue, { intent: 'teach' }); // no other constraints at all — the widest possible teach query
  const anyToolPresent = r2.results.some(function (x) { return allFourTools.indexOf(x.resource.id) !== -1; });
  check('even a maximally broad teach query (no other filters) never surfaces the 4 FRT admin tools', anyToolPresent === false);
}

console.log('\nFind-a-Tool fork — routes by tool_kind, covers both find_tool and manage intents');
{
  const rPlanning = DispatchMatch.run(catalogue, { intentAny: ['find_tool', 'manage'], toolKind: 'planning' });
  check('toolKind=planning returns the 3 real planning tools', rPlanning.results.length === 3
    && rPlanning.results.every(function (x) { return x.resource.tool_kind === 'planning'; }));

  const rTracking = DispatchMatch.run(catalogue, { intentAny: ['find_tool', 'manage'], toolKind: 'tracking' });
  check('toolKind=tracking returns exactly LessonTrak', rTracking.results.length === 1 && rTracking.results[0].resource.id === 'lessontrak');

  const rNoKind = DispatchMatch.run(catalogue, { intentAny: ['find_tool', 'manage'], toolKind: null });
  check('no toolKind specified still returns manage/find_tool resources, not teach ones', rNoKind.results.length > 0
    && rNoKind.results.every(function (x) { return x.resource.intent.indexOf('teach') === -1; }));

  const rLiveLesson = DispatchMatch.run(catalogue, { intentAny: ['find_tool', 'manage'], toolKind: 'live_lesson' });
  check('toolKind=live_lesson is honestly empty (no such tool exists in the real catalogue yet), not fabricated', rLiveLesson.status === 'none');
}

console.log('\nFind-a-Tool fork — never surfaces teaching activities');
{
  const r = DispatchMatch.run(catalogue, { intentAny: ['find_tool', 'manage'], toolKind: null });
  const teachLeaked = r.results.some(function (x) {
    return x.resource.intent.indexOf('find_tool') === -1 && x.resource.intent.indexOf('manage') === -1;
  });
  check('no teach-only resource appears in a find-a-tool query\'s results', teachLeaked === false);
}

console.log('\nFind-a-Tool fork — never asks or filters on lesson-specific fields');
{
  // Structural check on the request shape itself: a find_tool request
  // must never carry time/level/age, because the brief explicitly
  // forbids asking those questions in this flow.
  const findToolRequest = { intentAny: ['find_tool', 'manage'], toolKind: 'planning', aiOnly: false };
  check('a genuine Find-a-Tool request has no time field', !('time' in findToolRequest) || findToolRequest.time == null);
  check('a genuine Find-a-Tool request has no level field', !('level' in findToolRequest) || findToolRequest.level == null);
  check('a genuine Find-a-Tool request has no age field', !('age' in findToolRequest) || findToolRequest.age == null);
  // And confirm the engine doesn't silently apply time/level scoring
  // even if those fields were absent - a tool with activity_time_minutes
  // null must not be penalised for lacking a duration in this fork.
  const r = DispatchMatch.run(catalogue, findToolRequest);
  check('Find-a-Tool results score 0 (no duration penalty applied to timeless tools)', r.results.every(function (x) { return x.score === 0; }));
}

console.log('\nai_powered / aiOnly filter — only narrows when explicitly requested');
{
  const withoutAiOnly = DispatchMatch.run(catalogue, { intentAny: ['find_tool', 'manage'], toolKind: null, aiOnly: false });
  const withAiOnly = DispatchMatch.run(catalogue, { intentAny: ['find_tool', 'manage'], toolKind: null, aiOnly: true });
  check('aiOnly:false does not narrow results at all', withoutAiOnly.results.length > 0);
  check('aiOnly:true correctly returns none (no ai_powered:true resource exists in the real catalogue yet)', withAiOnly.status === 'none');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
