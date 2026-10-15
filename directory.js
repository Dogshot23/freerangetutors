/* ============================================================
   FREE RANGE TUTORS — directory homepage
   Search + filters + Recently Added + resource index, no
   questionnaire before the resources are visible.

   Visual system: "Contemporary Editorial Fanzine" (Mockup 10,
   approved) — a full-bleed featured section plus a typeset
   resource index, rather than a card grid. Search/filter/sort
   logic below is unchanged from the previous card-grid-era
   implementation (already correct, already covered by
   data/directory.test.js); only the render functions differ,
   to produce Mockup 10's approved markup instead of resource
   cards. See data/SCHEMA.md for the underlying data model.
   ============================================================ */

(function () {

  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];

  // Deterministic presentation rules (Mockup 10, approved) — not
  // data. These IDs decide which real resources get the featured/
  // accent treatment; the underlying data/resources/*.json records
  // are untouched. The large-entry treatment (LARGE_IDS) has been
  // removed — every All Resources entry now uses uniform sizing;
  // this does not affect the separate Recently Added/FEATURED_ID
  // treatment below, which never referenced LARGE_IDS.
  //
  // As of the external-links-only catalogue change, all FRT-original
  // activities (the only resources these IDs ever referenced) were
  // removed from the live catalogue, so all four lists below are
  // empty — FEATURED_ID falls back to the genuinely newest resource
  // (see renderFeatured()), and the accent lists simply never match.
  const FEATURED_ID = null;
  const RED_ACCENT_IDS = [];
  const COBALT_ACCENT_IDS = [];
  const SUPPORT_ACCENT_IDS = [];

  let allResources = [];

  function levelValues(resource) {
    const set = resource.cefr_level;
    if (!set || set.mode !== 'specific') return [];
    return set.values || [];
  }
  function levelLabel(resource) {
    const set = resource.cefr_level;
    if (!set) return null;
    if (set.mode === 'universal') return 'Any level';
    if (set.mode !== 'specific') return null;
    const values = levelValues(resource).slice().sort(function (a, b) {
      return CEFR_ORDER.indexOf(a) - CEFR_ORDER.indexOf(b);
    });
    if (!values.length) return null;
    return values.length === 1 ? values[0] : values[0] + '–' + values[values.length - 1];
  }

  /* ---- POPULATE FILTER OPTIONS FROM REAL DATA (never hand-typed) ---- */
  function populateFilters(resources) {
    const categories = CATEGORY_ORDER.filter(function (c) {
      return resources.some(function (r) { return r.primary_category === c; });
    });
    const types = uniqueSorted(resources.map(function (r) { return r.resource_type; }));
    const uses = uniqueSorted(flatten(resources.map(function (r) { return r.teaching_use || []; })));
    const levels = CEFR_ORDER.filter(function (lvl) {
      return resources.some(function (r) { return levelValues(r).indexOf(lvl) !== -1; });
    });
    const costs = uniqueSorted(resources.map(function (r) { return r.cost; }).filter(Boolean));

    fillSelect('filter-category', categories, categoryLabelFor);
    fillSelect('filter-type', types, typeLabelFor);
    fillSelect('filter-use', uses, useLabelFor);
    fillSelect('filter-level', levels, function (l) { return l; });
    fillSelect('filter-cost', costs, costLabelFor);
  }

  function uniqueSorted(arr) {
    return Array.from(new Set(arr)).sort();
  }
  function flatten(arrOfArr) {
    return arrOfArr.reduce(function (acc, a) { return acc.concat(a); }, []);
  }

  const TYPE_LABELS = {
    website: 'Website', app: 'App', game: 'Game', pdf: 'PDF',
    generator: 'Generator', tool: 'Tool', video: 'Video', activity: 'Activity'
  };
  const USE_LABELS = {
    speaking: 'Speaking', listening: 'Listening', reading: 'Reading', writing: 'Writing',
    grammar: 'Grammar', vocabulary: 'Vocabulary', pronunciation: 'Pronunciation',
    'warm-up': 'Warm-up', review: 'Review'
  };
  const COST_LABELS = { free: 'Free', freemium: 'Freemium', paid: 'Paid' };

  /* primary_category — the teacher-facing "what am I looking for"
     taxonomy, a different axis from resource_type. See data/SCHEMA.md. */
  const CATEGORY_ORDER = ['teaching_materials', 'web_apps_tools', 'games', 'websites_resource_hubs', 'media'];
  const CATEGORY_LABELS = {
    teaching_materials: 'Teaching Materials',
    web_apps_tools: 'Web Apps & Tools',
    games: 'Games',
    websites_resource_hubs: 'Websites & Resource Hubs',
    media: 'Media'
  };

  function typeLabelFor(v) { return TYPE_LABELS[v] || v; }
  function useLabelFor(v) { return USE_LABELS[v] || v; }
  function costLabelFor(v) { return COST_LABELS[v] || v; }
  function categoryLabelFor(v) { return CATEGORY_LABELS[v] || v; }
  function isExternal(r) { return r.source_category === 'curated_external' || r.source_category === 'commercial'; }

  function fillSelect(id, values, labelFn) {
    const select = document.getElementById(id);
    values.forEach(function (v) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = labelFn(v);
      select.appendChild(opt);
    });
  }

  /* ---- SEARCH: name + description_short + teaching_use ---- */
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

  /* ---- FILTERS ---- */
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
    return false; // unknown/not_applicable never match a specific level request
  }
  function matchesCost(resource, cost) {
    return !cost || resource.cost === cost;
  }

  function currentState() {
    return {
      query: document.getElementById('directory-search').value.trim(),
      category: document.getElementById('filter-category').value,
      type: document.getElementById('filter-type').value,
      use: document.getElementById('filter-use').value,
      level: document.getElementById('filter-level').value,
      cost: document.getElementById('filter-cost').value
    };
  }

  /* Runs against the COMPLETE catalogue every time — Recently
     Added's contents have no bearing on what this returns, so
     "All Resources" (filtered or not) always covers every
     resource. */
  function filteredResources() {
    const state = currentState();
    return allResources.filter(function (r) {
      return matchesSearch(r, state.query)
        && matchesCategory(r, state.category)
        && matchesType(r, state.type)
        && matchesUse(r, state.use)
        && matchesLevel(r, state.level)
        && matchesCost(r, state.cost);
    });
  }

  /* ---- SORTING ---- */
  function sortNewestFirst(resources) {
    return resources.slice().sort(function (a, b) {
      return (b.date_added > a.date_added) ? 1 : -1;
    });
  }
  function sortAlphabetical(resources) {
    return resources.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  }

  /* ---- RENDER HELPERS ---- */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function metaLine(r) {
    const parts = [];
    const lvl = levelLabel(r);
    if (lvl) parts.push(lvl);
    if (r.cost) parts.push(costLabelFor(r.cost));
    if (r.activity_time_minutes != null) parts.push(r.activity_time_minutes + ' min');
    return parts.join(' · ');
  }
  function linkAttrs(r) {
    const attrs = { href: r.url };
    if (isExternal(r)) { attrs.target = '_blank'; attrs.rel = 'noopener noreferrer'; }
    return attrs;
  }

  /* ---- RENDER: Recently Added — full-bleed featured entry +
     a short supporting list. Deliberately NOT a card grid; see
     directory.css .recent-band for the visual treatment. The
     featured resource is fixed by FEATURED_ID when present in the
     catalogue (a presentation choice, not a data fact), falling
     back to the genuinely newest resource otherwise so this never
     breaks if that resource is ever removed. ---- */
  function renderFeatured() {
    const newest = sortNewestFirst(allResources);
    const featured = allResources.find(function (r) { return r.id === FEATURED_ID; }) || newest[0];
    const rest = newest.filter(function (r) { return r.id !== featured.id; }).slice(0, 3); // featured + 3 = the "4 newest" the heading promises

    const wrap = document.getElementById('recent-featured');
    wrap.innerHTML = '';

    wrap.appendChild(el('div', {
      class: 'featured-label',
      text: typeLabelFor(featured.resource_type) + ' — ' + (featured.source_category === 'own_original' ? 'FRT Original' : featured.creator)
    }));
    const titleLink = el('a', Object.assign({ class: 'featured-title-link' }, linkAttrs(featured)), [
      el('h3', { class: 'featured-title', text: featured.name })
    ]);
    wrap.appendChild(titleLink);

    const metaWrap = el('div', { class: 'featured-meta' }, [
      document.createTextNode(metaLine(featured) + ' ')
    ]);
    metaWrap.appendChild(el('a', Object.assign({}, linkAttrs(featured), { text: isExternal(featured) ? 'Open ↗' : 'Open →' })));

    wrap.appendChild(el('div', { class: 'featured-body' }, [
      el('p', { class: 'featured-desc', text: featured.description_short }),
      metaWrap
    ]));
    // The supporting items sit in their own full-width row under the photo (see index.html).
    const support = document.getElementById('recent-support') || wrap;
    support.innerHTML = '';
    support.appendChild(renderSupportList(rest));
  }

  function renderSupportList(resources) {
    const list = el('div', { class: 'support-list' }, []);
    resources.forEach(function (r) {
      const cls = 'support-item' + (SUPPORT_ACCENT_IDS.indexOf(r.id) !== -1 ? ' accent' : '');
      const item = el('a', Object.assign({ class: cls }, linkAttrs(r)), [
        el('div', { class: 'support-label', text: typeLabelFor(r.resource_type) }),
        el('h4', { class: 'support-title', text: r.name }),
        el('p', { class: 'support-desc', text: r.description_short }),
        el('div', { class: 'support-meta', text: metaLine(r) })
      ]);
      list.appendChild(item);
    });
    return list;
  }

  /* ---- RENDER: All Resources — typeset entries, not cards.
     RED_ACCENT_IDS/COBALT_ACCENT_IDS are deterministic presentation
     rules (see top of file), applied identically regardless of
     search/filter state. Every entry uses uniform sizing — no
     large-entry treatment. ---- */
  function entryLabelText(r) {
    let label = typeLabelFor(r.resource_type);
    if (r.primary_category) label += ' · ' + categoryLabelFor(r.primary_category);
    return label;
  }
  function accentClass(r) {
    if (RED_ACCENT_IDS.indexOf(r.id) !== -1) return ' accent';
    if (COBALT_ACCENT_IDS.indexOf(r.id) !== -1) return ' accent-cobalt';
    return '';
  }
  /* Thumbnail: only rendered when a resource has an image (see
     data/SCHEMA.md — image is optional, null = no thumbnail). The
     colour is baked into the PNG at generation time (duotone, keyed
     to primary_category) — nothing here decides colour, this just
     decides whether an <img> is shown at all. Entries without an
     image keep the original two-column layout unchanged, see
     .entry vs .entry.has-image in directory.css. */
  function renderEntry(r) {
    const hasImage = !!r.image;
    const cls = 'entry' + (hasImage ? ' has-image' : '') + accentClass(r);
    const useText = (r.teaching_use || []).map(useLabelFor).join(' · ');
    const children = [];
    if (hasImage) {
      children.push(el('img', { class: 'entry-thumb', src: r.image, alt: '', loading: 'lazy' }));
    }
    children.push(
      el('div', {}, [
        el('div', { class: 'entry-label-row' }, [el('span', { class: 'entry-label', text: entryLabelText(r) })]),
        el('h3', { class: 'entry-title', text: r.name }),
        el('p', { class: 'entry-desc', text: r.description_short })
      ]),
      el('div', { class: 'entry-side' }, [
        el('span', { class: 'entry-meta', text: metaLine(r) }),
        el('span', { class: 'entry-use', text: useText || ' ' }),
        r.domain ? el('span', { class: 'entry-source', text: r.domain }) : null,
        el('span', { class: 'entry-open', text: isExternal(r) ? 'Open ↗' : 'Open →' })
      ])
    );
    return el('a', Object.assign({ class: cls }, linkAttrs(r)), children);
  }

  /* ---- QUICK PICKS + CLEAR BUTTON ----
     Chips are built from the real teaching_use tags (most common first), so nothing is
     hand-typed. A chip simply sets the existing "Use" filter; the select stays the source of truth. */
  const FILTER_IDS = ['filter-category', 'filter-type', 'filter-use', 'filter-level', 'filter-cost'];

  function buildQuickPicks(resources) {
    const box = document.getElementById('quick-picks');
    if (!box) return;
    const counts = {};
    resources.forEach(function (r) { (r.teaching_use || []).forEach(function (u) { counts[u] = (counts[u] || 0) + 1; }); });
    const top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).slice(0, 6);
    if (!top.length) return;
    const wrap = box.querySelector('.quick-chips');
    top.forEach(function (u) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('data-use', u);
      b.setAttribute('aria-pressed', 'false');
      b.appendChild(document.createTextNode(useLabelFor(u)));
      const n = document.createElement('small');
      n.textContent = String(counts[u]);
      n.setAttribute('aria-label', counts[u] + ' resources');
      b.appendChild(n);
      b.addEventListener('click', function () {
        const sel = document.getElementById('filter-use');
        sel.value = sel.value === u ? '' : u;
        renderEntries();
      });
      wrap.appendChild(b);
    });
    box.hidden = false;
  }

  /* ---- CLEAR BUTTON ---- */
  function wireClear() {
    document.getElementById('clear-filters').addEventListener('click', function () {
      document.getElementById('directory-search').value = '';
      FILTER_IDS.forEach(function (id) { document.getElementById(id).value = ''; });
      renderEntries();
      document.getElementById('directory-search').focus();
    });
  }

  /* ---- FILTERS PANEL ----
     The five filters and the popular uses live in a panel that starts collapsed.
     The toggle only appears once JavaScript is running (without JS there is
     nothing to filter anyway; the <noscript> list covers that case). Escape
     closes the panel and returns focus to the toggle. */
  function wireFiltersPanel() {
    const btn = document.getElementById('filters-toggle');
    const panel = document.getElementById('filter-panel');
    if (!btn || !panel) return;
    btn.hidden = false;
    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { setOpen(panel.hidden); });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); }
    });
  }

  function syncQuickPicks() {
    const box = document.getElementById('quick-picks');
    if (!box) return;
    const use = document.getElementById('filter-use').value;
    Array.prototype.forEach.call(box.querySelectorAll('.chip'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-use') === use ? 'true' : 'false');
    });
    const active = !!document.getElementById('directory-search').value ||
      FILTER_IDS.some(function (id) { return document.getElementById(id).value; });
    document.getElementById('clear-filters').hidden = !active;
    let setCount = 0;
    FILTER_IDS.forEach(function (id) {
      const isSet = !!document.getElementById(id).value;
      if (isSet) setCount++;
      document.getElementById(id).classList.toggle('is-set', isSet);
    });
    const badge = document.getElementById('filters-count');
    if (badge) {
      badge.hidden = !setCount;
      badge.textContent = String(setCount);
      badge.setAttribute('aria-label', setCount + ' filter' + (setCount === 1 ? '' : 's') + ' applied');
    }
  }

  function renderEntries() {
    const list = sortAlphabetical(filteredResources());
    const container = document.getElementById('entries');
    const empty = document.getElementById('directory-empty');
    const count = document.getElementById('index-count');

    container.innerHTML = '';
    list.forEach(function (r) { container.appendChild(renderEntry(r)); });

    container.hidden = list.length === 0;
    empty.hidden = list.length !== 0;

    count.textContent = list.length === allResources.length
      ? allResources.length + ' total'
      : list.length + ' match' + (list.length === 1 ? '' : 'es');
    syncQuickPicks();
  }

  function wireControls() {
    document.getElementById('directory-search').addEventListener('input', renderEntries);
    ['filter-category', 'filter-type', 'filter-use', 'filter-level', 'filter-cost'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', renderEntries);
    });
    wireMastheadHome();
  }

  /* ---- MASTHEAD HOME LINK ----
     A real <a href="/"> (see index.html) so it navigates, works
     without JS, and is reachable/operable via keyboard and screen
     readers like any other link — not a JS-only click handler.
     When already on the homepage, a plain anchor to the same URL
     does not reset <input>/<select> values a script has already
     set, so this listener clears search + all filters and re-
     renders in place, giving the same clean default state a fresh
     navigation would produce, without forcing a full reload. If
     the link is ever opened in a new tab, middle-clicked, etc.,
     the browser's normal navigation still applies — this handler
     only runs on a plain in-page left click. */
  function wireMastheadHome() {
    const home = document.getElementById('masthead-home');
    if (!home) return;
    home.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      document.getElementById('directory-search').value = '';
      ['filter-category', 'filter-type', 'filter-use', 'filter-level', 'filter-cost'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      renderEntries();
      window.scrollTo(0, 0);
      history.pushState(null, '', '/');
    });
  }

  FRT.ready().then(function (resources) {
    allResources = resources;
    populateFilters(resources);
    renderFeatured();
    buildQuickPicks(resources);
    renderEntries();
    wireControls();
    wireClear();
    wireFiltersPanel();
  }).catch(function (err) {
    console.error('Directory failed to load resource data:', err);
    document.getElementById('index-count').textContent = 'Data unavailable';
  });

})();
