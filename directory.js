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
  // large/accent treatment; the underlying data/resources/*.json
  // records are untouched.
  const FEATURED_ID = 'backstory-objects';
  const LARGE_IDS = ['backstory-objects', 'grammar-auction'];
  const RED_ACCENT_IDS = ['category-chain'];
  const COBALT_ACCENT_IDS = ['gtmk-wonderland'];
  const SUPPORT_ACCENT_IDS = ['escalation-chain'];

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
    const types = uniqueSorted(resources.map(function (r) { return r.resource_type; }));
    const uses = uniqueSorted(flatten(resources.map(function (r) { return r.teaching_use || []; })));
    const levels = CEFR_ORDER.filter(function (lvl) {
      return resources.some(function (r) { return levelValues(r).indexOf(lvl) !== -1; });
    });
    const costs = uniqueSorted(resources.map(function (r) { return r.cost; }).filter(Boolean));

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

  function typeLabelFor(v) { return TYPE_LABELS[v] || v; }
  function useLabelFor(v) { return USE_LABELS[v] || v; }
  function costLabelFor(v) { return COST_LABELS[v] || v; }
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
    const rest = newest.filter(function (r) { return r.id !== featured.id; }).slice(0, 2);

    const wrap = document.getElementById('recent-featured');
    wrap.innerHTML = '';

    wrap.appendChild(el('div', {
      class: 'featured-label',
      text: typeLabelFor(featured.resource_type) + ' — ' + (featured.source_category === 'own_original' ? 'FRT Original' : featured.creator)
    }));
    wrap.appendChild(el('h3', { class: 'featured-title', text: featured.name }));

    const metaWrap = el('div', { class: 'featured-meta' }, [
      document.createTextNode(metaLine(featured) + ' ')
    ]);
    metaWrap.appendChild(el('a', Object.assign({}, linkAttrs(featured), { text: isExternal(featured) ? 'Open ↗' : 'Open →' })));

    const body = el('div', { class: 'featured-body' }, [
      el('div', {}, [
        el('p', { class: 'featured-desc', text: featured.description_short }),
        metaWrap
      ]),
      renderSupportList(rest)
    ]);
    wrap.appendChild(body);
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
     LARGE_IDS/RED_ACCENT_IDS/COBALT_ACCENT_IDS are deterministic
     presentation rules (see top of file), applied identically
     regardless of search/filter state. ---- */
  function entryLabelText(r) {
    let label = typeLabelFor(r.resource_type);
    if (isExternal(r)) label += ' · External ↗';
    return label;
  }
  function accentClass(r) {
    if (RED_ACCENT_IDS.indexOf(r.id) !== -1) return ' accent';
    if (COBALT_ACCENT_IDS.indexOf(r.id) !== -1) return ' accent-cobalt';
    return '';
  }
  function renderEntry(r) {
    const isLarge = LARGE_IDS.indexOf(r.id) !== -1;
    const cls = 'entry' + (isLarge ? ' large' : '') + accentClass(r);
    const useText = (r.teaching_use || []).map(useLabelFor).join(' · ');
    return el('a', Object.assign({ class: cls }, linkAttrs(r)), [
      el('div', {}, [
        el('div', { class: 'entry-label-row' }, [el('span', { class: 'entry-label', text: entryLabelText(r) })]),
        el('h3', { class: 'entry-title', text: r.name }),
        el('p', { class: 'entry-desc', text: r.description_short })
      ]),
      el('div', { class: 'entry-side' }, [
        el('span', { class: 'entry-meta', text: metaLine(r) }),
        el('span', { class: 'entry-use', text: useText || ' ' }),
        el('span', { class: 'entry-open', text: isExternal(r) ? 'Open ↗' : 'Open →' })
      ])
    ]);
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
  }

  function wireControls() {
    document.getElementById('directory-search').addEventListener('input', renderEntries);
    ['filter-type', 'filter-use', 'filter-level', 'filter-cost'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', renderEntries);
    });
  }

  FRT.ready().then(function (resources) {
    allResources = resources;
    populateFilters(resources);
    renderFeatured();
    renderEntries();
    wireControls();
  }).catch(function (err) {
    console.error('Directory failed to load resource data:', err);
    document.getElementById('index-count').textContent = 'Data unavailable';
  });

})();
