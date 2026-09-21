/* ============================================================
   TOOLKIT (formerly Browse) — routing tests
   Plain Node, no framework/runner dependency. Run with:
     node data/toolkit-routing.test.js

   browse.js is DOM-coupled, so this file re-implements its data
   logic in isolation, kept in lockstep with the real source — see
   the "MUST MATCH" comments pointing at the exact functions being
   mirrored. If those functions change, this file's copies must
   change with them (same pattern as data/routing.test.js).
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

/* ---- MUST MATCH browse.js: teachResources(), resourcesForIntent(),
   resourcesForSkill(), resourcesForToolKind() ---- */
function teachResources(allRes) {
  return allRes.filter(function (r) { return r.intent && r.intent.indexOf('teach') !== -1; });
}
function resourcesForIntent(intentKey, allRes) {
  return allRes.filter(function (r) { return r.intent && r.intent.indexOf(intentKey) !== -1; });
}
function resourcesForSkill(skillKey, allRes) {
  const teach = teachResources(allRes);
  if (skillKey === 'play') {
    return teach.filter(function (r) { return r.resource_type === 'game'; });
  }
  return teach.filter(function (r) { return r.skills && r.skills.indexOf(skillKey) !== -1; });
}
function resourcesForToolKind(kindKey, allRes) {
  return resourcesForIntent('manage', allRes).filter(function (r) { return r.tool_kind === kindKey; });
}

/* ---- MUST MATCH browse.js: parseUrlState()'s legacy-param mapping ---- */
const LEGACY_SKILL_PARAMS = { talking: 'speaking', vocab: 'vocab', grammar: 'grammar', listen_watch: 'listening', play: 'play' };

function resolveLegacyParam(param, allRes) {
  const skill = LEGACY_SKILL_PARAMS[param];
  return resourcesForSkill(skill, allRes);
}

/* ============================================================
   1. Each of the 4 Toolkit intents resolves to the correct real subset
   ============================================================ */
console.log('The 4 Toolkit intents resolve correctly against the real catalogue');
{
  check('Teach Something = 7 real resources', teachResources(catalogue).length === 7);
  check('Find a Tool = 0 real resources (genuinely empty today)', resourcesForIntent('find_tool', catalogue).length === 0);
  check('Set Homework = 1 real resource', resourcesForIntent('homework', catalogue).length === 1);
  check('Manage My Teaching = 4 real resources', resourcesForIntent('manage', catalogue).length === 4);

  const total = teachResources(catalogue).length + resourcesForIntent('find_tool', catalogue).length; // homework overlaps teach (dual-intent), don't sum blindly
  check('Set Homework\'s one resource is Student Missions specifically', ids(resourcesForIntent('homework', catalogue))[0] === 'student-missions');
  check('Student Missions also still appears under Teach Something (dual intent, unchanged)', ids(teachResources(catalogue)).indexOf('student-missions') !== -1);
}

/* ============================================================
   2. Find a Tool cross-link target is real and populated
   ============================================================ */
console.log('\nFind a Tool\'s cross-link target (Manage My Teaching) is real and populated');
{
  const manage = resourcesForIntent('manage', catalogue);
  check('Manage My Teaching has real content to cross-link to (not itself empty)', manage.length > 0);
}

/* ============================================================
   3. Teaching pathways (skill filter) never leak manage/find_tool
   ============================================================ */
console.log('\nTeach Something\'s skill filters never leak manage/find_tool resources');
{
  const SKILLS = ['speaking', 'vocab', 'grammar', 'listening', 'play'];
  SKILLS.forEach(function (s) {
    const leaked = resourcesForSkill(s, catalogue).some(function (r) { return r.intent.indexOf('teach') === -1; });
    check('skill "' + s + '" never contains a non-teach resource', leaked === false);
  });
}

console.log('\nManage My Teaching\'s tool_kind filters never leak teach/find_tool/homework-only resources');
{
  const KINDS = ['planning', 'tracking'];
  KINDS.forEach(function (k) {
    const leaked = resourcesForToolKind(k, catalogue).some(function (r) { return r.intent.indexOf('manage') === -1; });
    check('tool_kind "' + k + '" never contains a non-manage resource', leaked === false);
  });
}

/* ============================================================
   4. Legacy skill-shaped query params still resolve to the same
      practical result as before this migration
   ============================================================ */
console.log('\nLegacy query-param values still resolve to their pre-migration practical destinations');
{
  check('?intent=talking still resolves to the speaking-tagged teach resources (6)', resolveLegacyParam('talking', catalogue).length === 6);
  check('?intent=vocab still resolves to the vocab-tagged teach resources (2)', resolveLegacyParam('vocab', catalogue).length === 2);
  check('?intent=grammar still resolves empty (genuine, unchanged content gap)', resolveLegacyParam('grammar', catalogue).length === 0);
  check('?intent=listen_watch still resolves empty (genuine, unchanged content gap)', resolveLegacyParam('listen_watch', catalogue).length === 0);
  check('?intent=play still resolves to the one real game', resolveLegacyParam('play', catalogue).length === 1
    && resolveLegacyParam('play', catalogue)[0].id === 'gtmk-wonderland');
}

/* ============================================================
   5. Manage My Teaching tool_kind breakdown matches real data
   ============================================================ */
console.log('\ntool_kind breakdown inside Manage My Teaching matches real data exactly');
{
  check('"planning" = 3 real tools (Report Writer, ZARD, Lesson Plan Viewer)', resourcesForToolKind('planning', catalogue).length === 3);
  check('"tracking" = 1 real tool (LessonTrak)', resourcesForToolKind('tracking', catalogue).length === 1
    && resourcesForToolKind('tracking', catalogue)[0].id === 'lessontrak');
  check('"live_lesson" and "ai" tool_kinds are genuinely empty (not offered as filter options, per spec)',
    resourcesForToolKind('live_lesson', catalogue).length === 0 && resourcesForToolKind('ai', catalogue).length === 0);
}

/* ============================================================
   6. No stale reference to the retired "By Situation"/"By Origin"
      sections or the removed static #browse-intent markup remains
   ============================================================ */
console.log('\nNo stale reference to retired Browse sections or markup remains in the live source');
{
  const browseJsSrc = fs.readFileSync(path.join(__dirname, '..', 'browse.js'), 'utf8');
  const browseHtmlSrc = fs.readFileSync(path.join(__dirname, '..', 'browse.html'), 'utf8');
  check('browse.js has no reference to the retired "By situation" section', browseJsSrc.indexOf('By situation') === -1);
  check('browse.js has no reference to the retired "By origin" section', browseJsSrc.indexOf('By origin') === -1);
  check('browse.js has no reference to the retired isLowPrep/isPrintable helpers', browseJsSrc.indexOf('isLowPrep') === -1 && browseJsSrc.indexOf('isPrintable') === -1);
  check('browse.html has no static #browse-intent markup (now rendered per-screen inside #browse-sections)', browseHtmlSrc.indexOf('id="browse-intent"') === -1);
  check('browse.html nav has no "Tools" link (removed per approved spec)', browseHtmlSrc.indexOf('tools/index.html') === -1);
  check('browse.html nav reads "Toolkit", not "Browse"', browseHtmlSrc.indexOf('>Toolkit<') !== -1);

  const dispatchHomeSrc = fs.readFileSync(path.join(__dirname, '..', 'dispatch-home.html'), 'utf8');
  const dispatchSrc = fs.readFileSync(path.join(__dirname, '..', 'dispatch.html'), 'utf8');
  check('dispatch-home.html nav has no "Tools" link', dispatchHomeSrc.indexOf('tools/index.html') === -1);
  check('dispatch.html nav has no "Tools" link', dispatchSrc.indexOf('tools/index.html') === -1);

  const dispatchHomeJsSrc = fs.readFileSync(path.join(__dirname, '..', 'dispatch-home.js'), 'utf8');
  check('"Your Own Tools" tile no longer points at the legacy tools/index.html page', dispatchHomeJsSrc.indexOf("href: 'tools/index.html'") === -1);
  check('"Your Own Tools" tile now points at Toolkit\'s Manage My Teaching screen', dispatchHomeJsSrc.indexOf("href: 'browse.html?intent=manage'") !== -1);
}

/* ============================================================
   7. Genuinely empty intents/filters report honestly
   ============================================================ */
console.log('\nGenuinely empty states report honestly, never fabricated');
{
  check('Find a Tool is exactly 0 — an honest empty state, not padded', resourcesForIntent('find_tool', catalogue).length === 0);
  check('Grammar skill filter is exactly 0 — an honest empty state, not padded', resourcesForSkill('grammar', catalogue).length === 0);
  check('Listening skill filter is exactly 0 — an honest empty state, not padded', resourcesForSkill('listening', catalogue).length === 0);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
