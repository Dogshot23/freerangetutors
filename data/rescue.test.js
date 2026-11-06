#!/usr/bin/env node
/* Checks for the Rescue Cards page (/rescue/). Run: node data/rescue.test.js
   (data/*.test.js is hidden from the public site by .assetsignore.)

   data/rescue-cards.json is the authoritative content. These tests read only files inside this repository.

   What this file protects, in plain terms:
     - exactly 33 cards in the 6 approved categories (5, 6, 7, 4, 5, 6), with every field present and 1 to 3 steps
     - rescue/index.html is the output of tools/build-rescue.js, and every card's text is on the page without JavaScript
     - the search box and category buttons are hidden until the script runs, labelled, and the script behaves as designed
     - the navigation link, sitemap entry and page metadata are in place on every public page
     - the page, script and stylesheet are not hidden from the public site, and only .rc- styles are added */
'use strict';
const fs = require('fs');
const path = require('path');
const build = require('../tools/build-rescue.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  PASS  ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), (m || 'differs') + '\n        got:      ' + JSON.stringify(a) + '\n        expected: ' + JSON.stringify(b));

const data = JSON.parse(read('data/rescue-cards.json'));
const cards = data.cards;
const page = read('rescue/index.html');
const lf = (s) => s.replace(/\r\n/g, '\n');
const TEXT_FIELDS = ['title', 'time', 'time_short', 'prep', 'problem', 'say', 'fallback'];
const OPTIONAL_FIELDS = ['level', 'age', 'adapt', 'note'];
const EXPECTED_IDS = [].concat(
  [1, 2, 3, 4, 5].map((n) => '1.' + n),
  [1, 2, 3, 4, 5, 6].map((n) => '2.' + n),
  [1, 2, 3, 4, 5, 6, 7].map((n) => '3.' + n),
  [1, 2, 3, 4].map((n) => '4.' + n),
  [1, 2, 3, 4, 5].map((n) => '5.' + n),
  [1, 2, 3, 4, 5, 6].map((n) => '6.' + n));
const CATEGORY_LABELS = [
  'Out of material, or time to fill',
  'Silent, flat or low-energy',
  'Level and challenge',
  'Technology failing',
  'Attention and behaviour, mostly children',
  'Managing students, parents and expectations'];

console.log('content');
test('six approved categories, numbered 1 to 6, with unique ids', () => {
  eq(data.categories.map((c) => c.number), [1, 2, 3, 4, 5, 6]);
  eq(data.categories.map((c) => c.label), CATEGORY_LABELS);
  eq(new Set(data.categories.map((c) => c.id)).size, 6, 'category ids not unique');
});
test('33 cards with exactly the expected ids, in order, no duplicates', () => {
  eq(cards.length, 33);
  eq(cards.map((c) => c.id), EXPECTED_IDS);
});
test('category sizes are 5, 6, 7, 4, 5 and 6, and each card id starts with its category number', () => {
  eq(data.categories.map((k) => cards.filter((c) => c.category === k.id).length), [5, 6, 7, 4, 5, 6]);
  cards.forEach((c) => {
    const k = data.categories.find((x) => x.id === c.category);
    assert(k, c.id + ': unknown category ' + c.category);
    assert(c.id.split('.')[0] === String(k.number), c.id + ': id does not match its category');
  });
});
cards.forEach((c) => {
  test(c.id + ' ' + c.title + ': every required field is present, with 1 to 3 steps', () => {
    TEXT_FIELDS.forEach((f) => assert(typeof c[f] === 'string' && c[f].trim().length > 0, 'missing ' + f));
    OPTIONAL_FIELDS.forEach((f) => assert(c[f] === null || (typeof c[f] === 'string' && c[f].trim().length > 0), f + ' must be null or text'));
    assert(Array.isArray(c.steps) && c.steps.length >= 1 && c.steps.length <= 3, 'steps: ' + (c.steps && c.steps.length));
    c.steps.forEach((s) => assert(typeof s === 'string' && s.trim().length > 0, 'empty step'));
    const known = ['id', 'category', 'title', 'time', 'time_short', 'prep', 'level', 'age', 'problem', 'steps', 'say', 'fallback', 'adapt', 'note'];
    eq(Object.keys(c).filter((k) => known.indexOf(k) === -1), [], 'unexpected keys');
    assert(c.time.indexOf(c.time_short) === 0, 'time_short must be the start of time');
  });
});
test('level and age are null only where the editorial draft said n/a (6.4)', () => {
  eq(cards.filter((c) => c.level === null || c.age === null).map((c) => c.id), ['6.4']);
});
test('presentation typography: no range hyphens, straight quotes or three dots left in the text', () => {
  const texts = [];
  cards.forEach((c) => { Object.keys(c).forEach((k) => { if (typeof c[k] === 'string') texts.push(c[k]); }); c.steps.forEach((s) => texts.push(s)); });
  const bad = texts.filter((t) => /\d-\d|\b[ABC][12]-[ABC][12]\b|\.\.\.|["']| - /.test(t));
  eq(bad, [], 'untreated typography');
});
test('card cross-references such as "card 1.5" point at cards that exist', () => {
  const ids = new Set(cards.map((c) => c.id));
  let n = 0;
  cards.forEach((c) => {
    [c.problem, c.say, c.fallback, c.adapt, c.note].concat(c.steps).filter(Boolean).forEach((t) => {
      (t.match(/\bcard (\d\.\d)(?: or (\d\.\d))?/g) || []).forEach((m) => { (m.match(/\d\.\d/g) || []).forEach((r) => { n++; assert(ids.has(r), c.id + ' refers to missing card ' + r); }); });
    });
  });
  assert(n >= 4, 'expected the known cross-references');
});

console.log('page');
test('rescue/index.html is up to date with data/rescue-cards.json (fix: node tools/build-rescue.js)', () => {
  eq(build.run(true), [], 'page is stale');
  assert(lf(page) === lf(build.build()), 'page differs from builder output');
});
test('all 33 cards are on the page exactly once, as closed native <details> elements with unique anchors', () => {
  eq((page.match(/<li class="rc-card"/g) || []).length, 33);
  eq((page.match(/<details /g) || []).length, 33);
  const ids = [...page.matchAll(/<details id="(card-\d-\d)"/g)].map((m) => m[1]);
  eq(ids, EXPECTED_IDS.map((i) => build.cardAnchor(i)));
  assert(!/<details[^>]*\bopen\b/.test(page), 'a card is open by default');
  eq((page.match(/<summary>/g) || []).length, 33);
});
test('every card shows all of its text without JavaScript: problem, numbered steps, say, fallback, and adapt/note when present', () => {
  cards.forEach((c) => {
    [c.title, c.time, c.prep, c.problem, c.say, c.fallback].concat(c.steps, [c.level, c.age, c.adapt, c.note].filter(Boolean)).forEach((t) => {
      assert(page.indexOf(build.html(t)) !== -1, c.id + ': text missing from page: ' + t.slice(0, 50));
    });
    assert(page.indexOf('<summary><span class="rc-sum-title">' + c.title) !== -1, c.id + ': title not in its summary');
  });
  eq((page.match(/<ol class="rc-steps">/g) || []).length, 33);
  eq((page.match(/<h3 class="rc-h">Problem<\/h3>/g) || []).length, 33);
  eq((page.match(/<h3 class="rc-h">Say<\/h3>/g) || []).length, 33);
  eq((page.match(/<h3 class="rc-h">Fallback<\/h3>/g) || []).length, 33);
  eq((page.match(/<h3 class="rc-h">Adapt<\/h3>/g) || []).length, cards.filter((c) => c.adapt).length);
  eq((page.match(/<h3 class="rc-h">Note<\/h3>/g) || []).length, cards.filter((c) => c.note).length);
});
test('without JavaScript nothing is hidden: only the search/filter controls and the empty message carry hidden', () => {
  const hidden = [...page.matchAll(/<[^>]*\shidden[\s>\/][^>]*>/g)].map((m) => (m[0].match(/id="([^"]+)"/) || [])[1]);
  eq(hidden.sort(), ['rc-controls', 'rc-empty']);
  assert(!/<noscript/.test(page), 'no noscript block should be needed');
});
test('links in card text go to cards that exist on the page', () => {
  const targets = [...page.matchAll(/<a href="#(card-\d-\d)"/g)].map((m) => m[1]);
  assert(targets.length >= 4, 'cross-reference links missing');
  targets.forEach((t) => assert(page.indexOf('id="' + t + '"') !== -1, 'dead link #' + t));
});
test('metadata: canonical URL, title, description, one h1, English (UK), indexable', () => {
  assert(page.indexOf('<link rel="canonical" href="https://www.freerangetutors.com/rescue/" />') !== -1, 'canonical');
  assert(/<html lang="en-GB">/.test(page), 'lang');
  assert(/<title>[^<]{20,}<\/title>/.test(page), 'title');
  assert(/<meta name="description" content="[^"]{60,}"/.test(page), 'description');
  eq((page.match(/<h1[ >]/g) || []).length, 1, 'h1 count');
  assert(!/noindex/i.test(page), 'page must be indexable');
  assert(page.indexOf('og:image') !== -1, 'og:image');
});
test('landmarks and headings: skip link target exists, one main, a labelled section and h2 per category, h3 only inside cards', () => {
  assert(page.indexOf('<a class="skip-link" href="#main">') !== -1 && page.indexOf('<main id="main">') !== -1, 'skip link / main');
  eq((page.match(/<main[ >]/g) || []).length, 1);
  data.categories.forEach((k) => {
    assert(page.indexOf('<section class="rc-group" data-cat="' + k.id + '" aria-labelledby="rc-h-' + k.id + '">') !== -1, k.id + ': section');
    assert(page.indexOf('<h2 class="rc-group-h" id="rc-h-' + k.id + '">') !== -1, k.id + ': h2');
  });
  eq((page.match(/<h2[ >]/g) || []).length, 6);
  /* Problem, Steps, Say and Fallback on every card, plus Adapt and Note where a card has them */
  eq((page.match(/<h3[ >]/g) || []).length, cards.length * 4 + cards.filter((c) => c.adapt).length + cards.filter((c) => c.note).length);
  const outside = page.replace(/<details[\s\S]*?<\/details>/g, '');
  assert(!/<h3[ >]/.test(outside), 'an h3 sits outside a card');
});
test('controls are labelled: search input has a label, buttons have aria-pressed, one starts pressed, the count is a live status', () => {
  assert(/<label class="visually-hidden" for="rc-search">Search the cards<\/label>\s*<input type="search" id="rc-search"/.test(page), 'search label');
  const chips = [...page.matchAll(/<button type="button" class="rc-chip" data-cat="([^"]*)" aria-pressed="(true|false)">([^<]+)<\/button>/g)];
  eq(chips.length, 7, 'All + six categories');
  eq(chips.map((m) => m[2]), ['true', 'false', 'false', 'false', 'false', 'false', 'false']);
  eq(chips.slice(1).map((m) => m[3]), CATEGORY_LABELS);
  assert(/role="group" aria-label="Filter by situation"/.test(page), 'chip group label');
  assert(/<p class="rc-count" id="rc-count" role="status">33 cards in 6 situations<\/p>/.test(page), 'count');
});
test('the script and stylesheet are loaded from the page and exist', () => {
  assert(page.indexOf('<link rel="stylesheet" href="/rescue/rescue.css" />') !== -1, 'css link');
  assert(/<script src="\/rescue\/rescue\.js"><\/script>\s*<\/body>/.test(page), 'script at end of body');
  assert(exists('rescue/rescue.css') && exists('rescue/rescue.js'), 'files exist');
});

console.log('navigation, sitemap and public site');
const NAV_PAGES = ['index.html', 'about.html', 'made-by-frt/index.html', 'stop-the-slop/index.html', 'rescue/index.html',
  'resources/the-school-trip-that-should-have-been-cancelled/index.html', 'resources/the-sixth-astronaut/index.html'];
NAV_PAGES.forEach((p) => {
  test(p + ': header navigation has five links in order, with Rescue Cards second', () => {
    const nav = read(p).match(/<nav class="site-nav" aria-label="Site">([\s\S]*?)<\/nav>/);
    assert(nav, 'no site nav');
    const links = [...nav[1].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => m[2]);
    eq(links, ['Resources', 'Rescue Cards', 'Made by FRT', 'Stop the Slop', 'About']);
    assert(nav[1].indexOf('<a href="/rescue/"') !== -1, 'rescue link target');
    eq(/aria-current="page"/.test(nav[1].match(/<a href="\/rescue\/"[^>]*>/)[0]), p === 'rescue/index.html', 'aria-current only on the Rescue Cards page');
  });
  test(p + ': footer navigation is unchanged (no Rescue Cards link added)', () => {
    const f = read(p).match(/<nav class="foot-nav" aria-label="Footer">([\s\S]*?)<\/nav>/);
    assert(f, 'no footer nav');
    assert(f[1].indexOf('/rescue/') === -1, 'footer has the rescue link');
  });
});
test('sitemap.xml lists /rescue/ and is up to date (fix: node tools/build-static.js)', () => {
  assert(read('sitemap.xml').indexOf('<loc>https://www.freerangetutors.com/rescue/</loc>') !== -1, 'missing from sitemap');
  const r = require('../tools/build-static.js').run(true);
  eq(r, [], 'static files are stale');
});
test('Made by FRT page is still exactly what its builder produces with the new nav link', () => {
  eq(require('../tools/build-catalogue.js').run(true), []);
});
test('.assetsignore does not hide the page, script, stylesheet or data (the test file itself is hidden by data/*.test.js)', () => {
  const lines = read('.assetsignore').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l[0] !== '#');
  assert(!lines.some((l) => /rescue/.test(l)), 'a rescue path is ignored');
  assert(!lines.some((l) => l === '*.css' || l === '*.js' || l === '*.json' || l === 'data'), 'a broad rule hides rescue files');
  assert(lines.indexOf('tools') !== -1, 'tools/ (the builder) stays hidden');
});

console.log('script behaviour');
const rc = require('../rescue/rescue.js');
const hay = (c) => rc.normalise([c.title, c.time, c.prep, c.level, c.age, c.problem, c.say, c.fallback, c.adapt, c.note].concat(c.steps).filter(Boolean).join(' '));
const find = (q) => cards.filter((c) => rc.matches(hay(c), q)).map((c) => c.id);
test('normalise treats curly quotes, en dashes and ellipses as plain characters and ignores case', () => {
  eq(rc.normalise('It\u2019s \u201CA2\u2013C1\u201D\u2026  OK'), 'it\'s "a2-c1"... ok');
});
test('search finds cards by title, problem and content, and ignores quote style', () => {
  assert(find('homework').indexOf('6.5') !== -1, 'homework -> 6.5');
  assert(find('audio').indexOf('4.1') !== -1, 'audio -> 4.1');
  assert(find('pronunciation').indexOf('3.6') !== -1, 'pronunciation -> 3.6');
  assert(find('parent').indexOf('6.1') !== -1, 'parent -> 6.1');
  assert(find('wasn\'t').indexOf('1.1') !== -1, 'straight apostrophe finds a curly one');
  assert(find('I don\u2019t know').indexOf('2.2') !== -1, 'curly apostrophe query');
  assert(find('A2-C1').length > 0, 'level range typed with a hyphen finds the en-dash text');
});
test('search needs every word, and an unmatched query matches nothing', () => {
  assert(find('homework voice').indexOf('6.5') !== -1, 'two words in one card');
  assert(find('homework dentist').length === 0, 'second word must also match');
  eq(find('zzzzqx'), []);
  eq(find('').length, 33, 'an empty query shows every card');
});
const js = read('rescue/rescue.js');
test('script uses no network, eval or innerHTML, only toggles hidden/aria-pressed/open, and opens #card-N-N from the address', () => {
  assert(!/\b(fetch|XMLHttpRequest|eval|innerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie)\b/.test(js), 'forbidden API in rescue.js');
  assert(/\^card-\\d\+-\\d\+\$/.test(js), 'hash pattern');
  assert(/aria-pressed/.test(js) && /\.hidden =/.test(js), 'hidden / aria-pressed');
  assert(!/addEventListener\('toggle'[\s\S]*\.open = false/.test(js), 'cards must open independently (no one-at-a-time closing)');
  assert(!/\.open\s*=\s*false/.test(js), 'script must never close a card');
});
const css = read('rescue/rescue.css').replace(/\/\*[\s\S]*?\*\//g, '');
test('stylesheet: only .rc- selectors', () => {
  /* a selector is the text between a closing brace (or the start) and the next opening brace; at-rules are skipped */
  const sels = [...css.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => s && s[0] !== '@');
  assert(sels.length >= 30, 'selector parse found too few rules: ' + sels.length);
  const bad = sels.filter((s) => !s.split(',').every((x) => /\.rc-/.test(x)));
  eq(bad, [], 'selectors outside .rc-');
});
test('stylesheet: summary has a visible focus style, touch targets of at least 44px, reduced motion is not overridden', () => {
  assert(/\.rc-card summary:focus-visible\s*\{[^}]*outline/.test(css), 'summary focus');
  assert(/\.rc-chip\s*\{[^}]*min-height:\s*44px/.test(css), 'chip height');
  assert(/\.rc-card summary\s*\{[^}]*min-height:\s*5\d+px/.test(css), 'summary height');
  assert(!/transition|animation/.test(css), 'no animation');
});
test('this test file reads nothing outside the repository (the editorial draft is not a dependency)', () => {
  /* every file this test and the builder read goes through ROOT-relative helpers; no drive-letter or home-folder path is read */
  const drive = String.fromCharCode(92) + String.fromCharCode(92);
  [fs.readFileSync(__filename, 'utf8'), fs.readFileSync(path.join(ROOT, 'tools/build-rescue.js'), 'utf8')].forEach((src) => {
    assert(!new RegExp('(readFileSync|existsSync)\\(\\s*[\'"`][A-Za-z]:').test(src), 'reads a drive-letter path');
    assert(src.indexOf(['os', 'homedir'].join('.')) === -1 && src.indexOf(['USER', 'PROFILE'].join('')) === -1, 'reads the home folder');
  });
  assert(drive.length === 2, 'sanity');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
