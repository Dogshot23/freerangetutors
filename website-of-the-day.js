/* ============================================================
   FREE RANGE TUTORS: website-of-the-day.js

   The homepage "Website of the Day" feature.

   PART 1 (pure, no DOM, no network): which external website is featured on a
   given UTC date, and which photograph goes with it. This part is a plain
   function of (catalogue, photo library, pinned photographs, date), so every
   visitor sees the same thing on the same UTC date, and
   data/website-of-the-day.test.js tests the real code by require()-ing this
   file. See data/SCHEMA.md ("Website of the Day").

   PART 2 (browser only): fills the <section class="wotd"> in index.html. The
   section stays hidden unless everything needed is available, and a missing
   photograph just gives the text-only layout.

   Rules (all Monday-to-Friday, all UTC):
     - Pool = resources with source_category === 'curated_external', sorted by
       date_added (ascending) then id. FRT's own products and paid/commercial
       entries are never included. Adding an external resource to the catalogue
       adds it to the pool automatically (there is no second list).
     - One website per weekday, advancing Monday to Friday only. Saturday and
       Sunday show Friday's website. The sequence continues across weeks, so
       with N sites in the pool no site repeats until all N have been shown.
     - Adding or removing a site changes N, so the position in the cycle shifts
       (today's website may change, and a site may repeat or be skipped once
       around that change). That is unavoidable for a stateless rule.
     - Photograph: a website that has its OWN entry in data/featured-images.json (a "pinned" photograph, with its licence and
       credit) shows that photograph; every other website gets the best tag match from data/editorial-library.json, or the
       text-only layout. A pinned entry that is incomplete or malformed is ignored, never shown without its credit.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FRTWebsiteOfTheDay = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined') api.start(window, document);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 86400000;
  /* Monday 5 January 2026, 00:00 UTC. Fixed once; changing it reshuffles the whole sequence. */
  var ANCHOR_UTC = Date.UTC(2026, 0, 5);
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------------- PART 1: pure functions ---------------- */

  function toUtcMidnight(date) {
    var d = date instanceof Date ? date : new Date(date);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  /* 0 for the anchor Monday, +1 for each following weekday. Saturday and Sunday return Friday's
     number. Works for dates before the anchor too (negative numbers). */
  function weekdayIndex(date) {
    var days = Math.round((toUtcMidnight(date) - ANCHOR_UTC) / DAY_MS);
    var week = Math.floor(days / 7);
    var dow = days - week * 7;            // 0 = Monday ... 6 = Sunday
    if (dow > 4) dow = 4;                 // Saturday, Sunday -> Friday
    return week * 5 + dow;
  }

  /* The calendar date (UTC midnight, as a Date) of the weekday being shown: the date itself on
     Monday to Friday, the preceding Friday on Saturday and Sunday. */
  function effectiveDate(date) {
    var ms = toUtcMidnight(date);
    var days = Math.round((ms - ANCHOR_UTC) / DAY_MS);
    var dow = days - Math.floor(days / 7) * 7;
    return new Date(ms - Math.max(0, dow - 4) * DAY_MS);
  }

  function formatDay(date) {
    var d = effectiveDate(date);
    return WEEKDAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }

  /* The rotation pool: every eligible website, with nothing else left out. Strictly curated_external: own_original and commercial
     (the paid GapTheMind products) are excluded. Stable order: date_added ascending, then id (plain string comparison). */
  function eligibleWebsites(resources) {
    return (resources || []).filter(function (r) {
      return r && r.source_category === 'curated_external' && r.id && r.url;
    }).sort(function (a, b) {
      var da = String(a.date_added || ''), db = String(b.date_added || '');
      if (da !== db) return da < db ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  function mod(n, m) { return ((n % m) + m) % m; }

  /* Which website for a date. Returns null when there is nothing to rotate. */
  function pickWebsite(resources, date) {
    var pool = eligibleWebsites(resources);
    if (!pool.length) return null;
    var index = weekdayIndex(date);
    return { website: pool[mod(index, pool.length)], index: index, poolSize: pool.length, position: mod(index, pool.length), cycle: Math.floor(index / pool.length) };
  }

  /* ---- photograph matching ---- */

  /* When a resource has no image_tags, tags are derived from fields it already has, so a newly added
     website still gets a plausible photograph. Loose by design. */
  var DERIVED_TAGS = {
    resource_type: { video: ['video', 'media'], game: ['games', 'play'], app: ['technology'] },
    primary_category: { games: ['games', 'play'], media: ['media'], websites_resource_hubs: ['learning'], teaching_materials: ['learning'], web_apps_tools: ['learning'] },
    teaching_use: {
      speaking: ['speaking', 'conversation'], listening: ['listening', 'audio'], reading: ['reading', 'books'], writing: ['writing', 'notebooks'],
      vocabulary: ['words', 'vocabulary'], grammar: ['words', 'learning'], pronunciation: ['speaking', 'audio'], 'warm-up': ['play'], review: ['learning']
    }
  };

  function normTags(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (t) {
      if (typeof t !== 'string') return;
      t = t.trim().toLowerCase();
      if (t && out.indexOf(t) === -1) out.push(t);
    });
    return out;
  }

  function tagsFor(resource) {
    var own = normTags(resource && resource.image_tags);
    if (own.length) return own;
    var derived = [];
    function add(list) { (list || []).forEach(function (t) { if (derived.indexOf(t) === -1) derived.push(t); }); }
    if (resource) {
      add(DERIVED_TAGS.resource_type[resource.resource_type]);
      add(DERIVED_TAGS.primary_category[resource.primary_category]);
      (resource.teaching_use || []).forEach(function (u) { add(DERIVED_TAGS.teaching_use[u]); });
    }
    return derived;
  }

  /* library: array of { id, tags, status }. Entries with status 'reserve' are kept in the library but never
     matched (promote one by setting its status to 'active' in data/editorial-library.json). Best match first:
     most shared tags, then id. Photos sharing no tag are not candidates. */
  function photoCandidates(tags, library) {
    var want = normTags(tags);
    return (library || []).filter(function (p) {
      return p && p.id && p.status !== 'reserve';
    }).map(function (p) {
      var have = normTags(p.tags), score = 0;
      want.forEach(function (t) { if (have.indexOf(t) !== -1) score++; });
      return { id: p.id, score: score };
    }).filter(function (c) { return c.score > 0; }).sort(function (a, b) {
      return b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    }).map(function (c) { return c.id; });
  }

  /* The photograph id for weekday number `index`, or null. For site k in cycle c the choice is
     candidates[(c + k) mod count], which spreads neighbouring sites over different photos and gives a site a
     different photo each cycle. The walk starts at index 0 and skips the previous weekday's photograph when
     another candidate exists, so the same photograph never appears two weekdays running. It is a pure
     function of (pool, library, index), so every visitor gets the same answer. */
  function photoIdForIndex(pool, library, index) {
    if (!pool.length || !library || !library.length) return null;
    var N = pool.length, cands = pool.map(function (r) { return photoCandidates(tagsFor(r), library); });
    var prev = null, current = null;
    for (var i = 0; i <= Math.max(index, 0); i++) {
      var c = cands[i % N];
      if (!c.length) { current = null; }
      else {
        var at = (Math.floor(i / N) + (i % N)) % c.length;
        if (c[at] === prev && c.length > 1) at = (at + 1) % c.length;
        current = c[at];
      }
      prev = current;
      if (i >= index) break;
    }
    if (index < 0) {                       // before the anchor: plain rule, no history
      var cc = cands[mod(index, N)];
      return cc.length ? cc[mod(Math.floor(index / N) + mod(index, N), cc.length)] : null;
    }
    return current;
  }

  /* Everything the page needs for a date: { website, photoId, index, poolSize, dayLabel } or null. */
  function pickForDate(resources, library, date) {
    var pool = eligibleWebsites(resources);      // the same pool for the website and for photograph matching
    var w = pickWebsite(resources, date);
    if (!w) return null;
    return { website: w.website, photoId: photoIdForIndex(pool, library, w.index), index: w.index, poolSize: w.poolSize, dayLabel: formatDay(date) };
  }

  /* ---- resource-specific ("pinned") photographs, from data/featured-images.json ---- */

  /* Everything the credit line needs. A pinned entry missing any of these is not used (a photograph is never shown without its credit
     and licence). `year` is optional. */
  var PINNED_REQUIRED = ['file', 'title', 'creator', 'source_site', 'source_page', 'licence', 'licence_url', 'change_note'];
  var SAFE_IMAGE_PATH = /^images\/[A-Za-z0-9._\-\/]+\.(png|jpe?g|webp)$/i;

  /* The entry itself if it is complete and safe to show, otherwise null. */
  function usablePinnedPhoto(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    for (var i = 0; i < PINNED_REQUIRED.length; i++) {
      var v = entry[PINNED_REQUIRED[i]];
      if (typeof v !== 'string' || !v.trim()) return null;
    }
    if (!SAFE_IMAGE_PATH.test(entry.file) || entry.file.indexOf('..') !== -1) return null;
    if (!/^https:\/\//.test(entry.source_page) || !/^https:\/\//.test(entry.licence_url)) return null;
    if (entry.year != null && typeof entry.year !== 'string' && typeof entry.year !== 'number') return null;
    return entry;
  }

  /* The photograph to show for a pick: the website's own pinned photograph if it has a usable one (it takes precedence over any
     generic match), else the library photograph matched for that day, else null (text-only). libraryImages and pinnedImages are
     the `images` objects of data/editorial-library.json and data/featured-images.json, each keyed by id; either may be missing. */
  function choosePhoto(pick, libraryImages, pinnedImages) {
    if (!pick || !pick.website) return null;
    var id = pick.website.id;
    if (pinnedImages && typeof pinnedImages === 'object' && Object.prototype.hasOwnProperty.call(pinnedImages, id)) {
      var pinned = usablePinnedPhoto(pinnedImages[id]);
      if (pinned) return pinned;
    }
    if (pick.photoId && libraryImages && Object.prototype.hasOwnProperty.call(libraryImages, pick.photoId)) return libraryImages[pick.photoId];
    return null;
  }

  /* ---------------- PART 2: browser rendering ---------------- */

  var TYPE_LABELS = { website: 'Website', app: 'App', game: 'Game', pdf: 'PDF', generator: 'Generator', tool: 'Tool', video: 'Video', activity: 'Activity' };
  var COST_LABELS = { free: 'Free', freemium: 'Free with paid options', paid: 'Paid' };

  function el(doc, tag, attrs, text) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  /* Credit line, always shown with a photograph. CC BY needs it; for CC0 and public-domain photographs it is a courtesy. */
  function buildCredit(doc, p) {
    var line = doc.createDocumentFragment();
    line.appendChild(doc.createTextNode('Photograph: '));
    line.appendChild(el(doc, 'a', { href: p.source_page, target: '_blank', rel: 'noopener' }, p.title));
    line.appendChild(doc.createTextNode(', ' + p.creator + (p.year ? ', ' + p.year : '') + ', ' + p.source_site + '. '));
    line.appendChild(el(doc, 'a', { href: p.licence_url, target: '_blank', rel: 'noopener' }, p.licence));
    line.appendChild(doc.createTextNode('. ' + p.change_note));
    return line;
  }

  function render(doc, pick, photo) {
    var section = doc.getElementById('website-of-the-day');
    if (!section || !pick) return false;
    var r = pick.website;
    var q = function (sel) { return section.querySelector(sel); };
    q('.wotd-day').textContent = pick.dayLabel;
    var title = q('.wotd-title-link');
    title.setAttribute('href', r.url); title.setAttribute('target', '_blank'); title.setAttribute('rel', 'noopener noreferrer');
    q('.wotd-title').textContent = r.name;
    q('.wotd-meta').textContent = [TYPE_LABELS[r.resource_type] || r.resource_type, r.domain, COST_LABELS[r.cost]].filter(Boolean).join(' · ');
    q('.wotd-desc').textContent = r.description_short;
    var use = q('.wotd-use');
    if (r.teacher_note) { use.textContent = ''; use.appendChild(el(doc, 'strong', {}, 'How to use it: ')); use.appendChild(doc.createTextNode(r.teacher_note)); use.hidden = false; }
    else { use.textContent = ''; use.hidden = true; }
    var btn = q('.wotd-btn');
    btn.setAttribute('href', r.url); btn.setAttribute('target', '_blank'); btn.setAttribute('rel', 'noopener noreferrer');
    btn.textContent = 'Visit ' + r.name + ' ↗';

    var fig = q('.wotd-photo'), img = fig.querySelector('img'), credit = q('.wotd-credit');
    credit.textContent = '';
    if (photo && photo.file) {
      img.setAttribute('src', '/' + photo.file);
      fig.hidden = false;
      credit.appendChild(buildCredit(doc, photo));
      credit.hidden = false;
      section.classList.remove('wotd-no-photo');
    } else {
      img.removeAttribute('src');
      fig.hidden = true; credit.hidden = true;
      section.classList.add('wotd-no-photo');
    }
    section.hidden = false;
    return true;
  }

  function start(win, doc) {
    var section = doc.getElementById('website-of-the-day');
    if (!section || !win.FRT || typeof win.fetch !== 'function') return;
    var libraryPromise = win.fetch('/data/editorial-library.json').then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) { return (data && data.images) || {}; }).catch(function (err) {
      if (win.console) win.console.warn('Website of the Day photographs unavailable:', err);
      return {};
    });
    // Resource-specific photographs: if the file cannot be read the page just uses the library photograph for that day.
    var pinnedPromise = win.fetch('/data/featured-images.json').then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) { return (data && data.images && typeof data.images === 'object') ? data.images : {}; }).catch(function (err) {
      if (win.console) win.console.warn('Website of the Day pinned photographs unavailable:', err);
      return {};
    });
    Promise.all([win.FRT.ready(), libraryPromise, pinnedPromise]).then(function (parts) {
      var images = parts[1], pinned = parts[2];
      var library = Object.keys(images).map(function (id) { return { id: id, tags: images[id].tags, status: images[id].status }; });
      var pick = pickForDate(win.FRT.all(), library, new Date());
      if (!pick) return;
      render(doc, pick, choosePhoto(pick, images, pinned));
    }).catch(function (err) {
      if (win.console) win.console.warn('Website of the Day unavailable:', err);   // the section simply stays hidden
    });
  }

  return {
    ANCHOR_UTC: ANCHOR_UTC,
    weekdayIndex: weekdayIndex, effectiveDate: effectiveDate, formatDay: formatDay,
    eligibleWebsites: eligibleWebsites, pickWebsite: pickWebsite,
    tagsFor: tagsFor, photoCandidates: photoCandidates, photoIdForIndex: photoIdForIndex,
    usablePinnedPhoto: usablePinnedPhoto, choosePhoto: choosePhoto,
    pickForDate: pickForDate, render: render, start: start
  };
});
