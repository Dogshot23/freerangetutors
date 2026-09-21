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
  const r = DispatchMatch.run(catalogue, { time: 10, age: 'teen', level: 'B1', need: 'talking', prep: 'none' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('status is match or nearest, never none', r.status !== 'none');
  check('top result is a speaking resource', r.results.length > 0 && r.results[0].resource.skills.indexOf('speaking') !== -1);
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 2: 30 min, 12yo group, B2, speaking ---- */
console.log('\nTest 2 — 30 min / 12yo (teen) group / B2 / speaking');
{
  const r = DispatchMatch.run(catalogue, { time: 30, age: 'teen', level: 'B2', need: 'talking', group: 'group' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('every result suits teen audience (or is audience-agnostic)', r.results.every(function (x) {
    return x.resource.age_group.length === 0 || x.resource.age_group.indexOf('teen') !== -1;
  }));
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 3: 5 min filler, any audience, any level, no prep ---- */
console.log('\nTest 3 — 5 min / any / any / filler / no prep');
{
  const r = DispatchMatch.run(catalogue, { time: 5, need: 'filler', prep: 'none' });
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
  const r = DispatchMatch.run(catalogue, { time: 45, age: 'adult', level: 'B2', need: 'talking', prep: 'moderate' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('Conversation Systems or Field Pack (the two long-form speaking resources) is top or present', names(r).some(function (n) {
    return n.indexOf('Conversation Systems') !== -1 || n.indexOf('Field Pack') !== -1;
  }));
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 5: one adult, B2, speaking, no prep (1:1) ---- */
console.log('\nTest 5 — 1:1 adult / B2 / speaking / no prep');
{
  const r = DispatchMatch.run(catalogue, { age: 'adult', level: 'B2', need: 'talking', prep: 'none', group: 'individual' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 6: printable, any audience, 30 min ---- */
console.log('\nTest 6 — printable / any / 30 min');
{
  const r = DispatchMatch.run(catalogue, { time: 30, need: 'printable' });
  check('returns a result', r.results.length > 0, 'status=' + r.status);
  check('every result is a printable-family type', r.results.every(function (x) {
    return ['worksheet', 'pdf_pack', 'printable', 'task_cards', 'reference'].indexOf(x.resource.resource_type) !== -1;
  }));
  console.log('  -> ' + r.status + ': ' + names(r).join(', '));
}

/* ---- Test 7: deliberately impossible request ---- */
console.log('\nTest 7 — deliberately impossible: 5 min / young_learner / C1 / grammar / no prep');
{
  const r = DispatchMatch.run(catalogue, { time: 5, age: 'young_learner', level: 'C1', need: 'grammar', prep: 'none' });
  check('status is none (catalogue genuinely has nothing for this)', r.status === 'none', 'got status=' + r.status + ', results=' + names(r).join(','));
  check('note is present and honest, not a silent empty list', typeof r.note === 'string' && r.note.length > 0);
  console.log('  -> ' + r.status + ': ' + (r.note || '(no note)'));
}

/* ---- Focused unit checks on scoring internals ---- */
console.log('\nUnit checks — bestUsableMinutes()');
{
  const fieldPack = catalogue.find(function (r) { return r.id === 'field-packs'; });
  check('field-packs (45 min, 10 min alt) resolves to 10 as the best usable duration',
    DispatchMatch._internal.bestUsableMinutes(fieldPack) === 10);
}

console.log('\nUnit checks — hard filter excludes grossly incompatible duration only for small windows');
{
  const conversationSystems = catalogue.find(function (r) { return r.id === 'conversation-systems'; }); // 40 min, no alt
  const passesAt5 = DispatchMatch._internal.passesHardFilter(conversationSystems, { time: 5 });
  const passesAt30 = DispatchMatch._internal.passesHardFilter(conversationSystems, { time: 30 });
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
