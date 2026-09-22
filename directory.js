/* ============================================================
   FREE RANGE TUTORS — directory homepage
   Grid + search + filters, no questionnaire before the resources
   are visible (Phase 1 of the directory-model rework — see the
   architecture spec for the full reasoning).

   Recently Added and All Resources are deliberately two different
   views over the SAME complete catalogue, not two different data
   sets: Recently Added is a compact editorial strip (newest 4,
   own distinct markup — see renderRecentStrip), while All
   Resources always contains every resource, sorted alphabetically
   by default so the same four items aren't visually repeated
   immediately beneath the strip. Search and filters operate
   against the complete set regardless of Recently Added's content.
   ============================================================ */

(function () {

  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];

  let allResources = [];

  function levelValues(resource) {
    const set = resource.cefr_level;
    if (!set || set.mode !== 'specific') return [];
    return set.values || [];
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
     resource, per the directory design spec's explicit
     correction to the earlier Phase 1 draft. */
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

  /* ---- RENDER: main grid (uses the standard resource card) ---- */
  function renderGrid(gridEl, resources) {
    gridEl.innerHTML = '';
    resources.forEach(function (r) {
      gridEl.appendChild(renderResourceCard(r));
    });
  }

  /* ---- RENDER: Recently Added — a compact editorial strip, not
     a card grid. Deliberately different markup from renderGrid so
     it can never be mistaken for "four smaller cards" — see
     directory.css .directory-recent-list for the visual treatment. */
  function formatDate(iso) {
    const parts = iso.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1];
  }

  function renderRecentStrip() {
    const list = document.getElementById('directory-recent-list');
    list.innerHTML = '';

    const recent = sortNewestFirst(allResources).slice(0, 4);

    recent.forEach(function (r) {
      const item = document.createElement('a');
      item.className = 'directory-recent-item';
      item.href = r.url;
      if (r.source_category !== 'own_original') {
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
      }

      const badge = document.createElement('span');
      badge.className = 'directory-recent-badge';
      badge.textContent = typeLabelFor(r.resource_type);

      const title = document.createElement('span');
      title.className = 'directory-recent-title';
      title.textContent = r.name;

      const hook = document.createElement('span');
      hook.className = 'directory-recent-hook';
      hook.textContent = '— ' + r.description_short;

      const date = document.createElement('span');
      date.className = 'directory-recent-date';
      date.textContent = formatDate(r.date_added);

      item.appendChild(badge);
      item.appendChild(title);
      item.appendChild(hook);
      item.appendChild(date);
      list.appendChild(item);
    });
  }

  function renderMain() {
    const list = sortAlphabetical(filteredResources());
    const grid = document.getElementById('directory-grid');
    const empty = document.getElementById('directory-empty');
    const count = document.getElementById('directory-count');

    renderGrid(grid, list);

    grid.hidden = list.length === 0;
    empty.hidden = list.length !== 0;

    count.textContent = list.length === allResources.length
      ? 'All resources (' + list.length + ')'
      : list.length + ' resource' + (list.length === 1 ? '' : 's');
  }

  function wireControls() {
    ['directory-search'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', renderMain);
    });
    ['filter-type', 'filter-use', 'filter-level', 'filter-cost'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', renderMain);
    });
  }

  FRT.ready().then(function (resources) {
    allResources = resources;
    populateFilters(resources);
    renderRecentStrip();
    renderMain();
    wireControls();
  }).catch(function (err) {
    console.error('Directory failed to load resource data:', err);
    document.getElementById('directory-count').textContent = 'Data unavailable';
  });

})();
