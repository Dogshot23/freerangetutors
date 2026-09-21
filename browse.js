/* ============================================================
   THE DISPATCH — Browse / Discovery
   Consumes data/resources.js (FRT.all / FRT.byIntent) and the
   existing renderResourceCard component. No second source of
   truth for categories or resources — every grouping below reads
   directly from each resource's own skills/resource_type/
   source_category fields, the same fields Dispatch and the
   homepage already use.

   Schema migration note (Stage 4.5): this page's section names
   ("By purpose" etc.) predate the intent/resource_type taxonomy
   change and are repointed here only enough to keep working
   against the new data shape — the real Toolkit redesign (per
   the Product Decisions doc) is a separate, later stage.
   ============================================================ */

(function () {

  /* ---- BY PURPOSE ----
     Schema migration note (Stage 4.5): the old single-valued 'pathways'
     field no longer exists — replaced by 'intent' (teach/find_tool/
     homework/manage) plus the unchanged, still-open-ended 'skills' tag
     list. These groups now read 'skills' so the page keeps working;
     the groups themselves are unchanged pending the real Toolkit
     redesign (explicitly a later stage, not this one). */
  const PURPOSE_GROUPS = [
    { skill: 'speaking', label: 'Talking' },
    { skill: 'play', label: 'Playing' },
    { skill: 'vocab', label: 'Vocabulary' },
    { skill: 'grammar', label: 'Grammar' },
    { skill: 'listening', label: 'Listening / Watching' }
  ];

  /* ---- BY SITUATION ----
     Only the two cuts the real catalogue actually supports with
     more than a token result (see Stage 4 report). 'Filler' and
     '1:1' were considered and dropped — each has ~1 clean fit today,
     and Dispatch already owns the time/group questions directly. */
  function isLowPrep(r) { return r.prep_level === 'none'; }
  function isPrintable(r) {
    return r.resource_type === 'printable';
  }

  /* ---- BY ORIGIN ---- */
  const ORIGIN_GROUPS = [
    { key: 'own', label: 'Free Range Tutors', test: function (r) { return r.source_category === 'own_original'; } },
    { key: 'gtmk', label: 'GapTheMind', test: function (r) { return r.gtmk_relationship != null; } },
    { key: 'external', label: 'Curated External', test: function (r) { return r.source_category === 'curated_external' && r.gtmk_relationship == null; } }
  ];

  const INTENTS = [
    { key: 'all', label: 'ALL' },
    { key: 'speaking', label: 'TALKING' },
    { key: 'play', label: 'PLAY' },
    { key: 'vocab', label: 'VOCAB' },
    { key: 'grammar', label: 'GRAMMAR' },
    { key: 'listening', label: 'LISTEN / WATCH' }
  ];

  function initialIntentFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('intent');
    const valid = INTENTS.some(function (i) { return i.key === requested; });
    return valid ? requested : 'all';
  }

  let currentIntent = initialIntentFromUrl();
  let allResources = [];

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

  function filteredByIntent(list) {
    if (currentIntent === 'all') return list;
    return resourcesForSkillGroup(currentIntent, list);
  }

  function renderIntentStrip() {
    const strip = document.getElementById('browse-intent');
    strip.innerHTML = '';
    INTENTS.forEach(function (intent) {
      const btn = el('button', {
        type: 'button',
        class: 'browse-intent-btn' + (intent.key === currentIntent ? ' browse-intent-btn--active' : ''),
        text: intent.label
      }, []);
      btn.addEventListener('click', function () {
        currentIntent = intent.key;
        renderIntentStrip();
        renderSections();
      });
      strip.appendChild(btn);
    });
  }

  function groupBlock(name, count, resources) {
    const block = el('div', { class: 'browse-group' }, [
      el('div', { class: 'browse-group-header' }, [
        el('span', { class: 'browse-group-name', text: name }),
        el('span', { class: 'browse-group-count', text: count === 0 ? '' : (count + (count === 1 ? ' resource' : ' resources')) })
      ])
    ]);

    if (resources.length === 0) {
      block.appendChild(el('div', { class: 'browse-empty' }, [
        el('div', { class: 'browse-empty-title', text: 'Nothing here yet.' }),
        el('div', { class: 'browse-empty-sub', text: 'This shelf is still being built — not padded out, just honestly empty for now.' })
      ]));
    } else {
      const grid = el('div', { class: 'rc-grid' }, []);
      resources.forEach(function (r) { grid.appendChild(renderResourceCard(r)); });
      block.appendChild(grid);
    }
    return block;
  }

  function resourcesForSkillGroup(skill, allRes) {
    if (skill === 'play') {
      return allRes.filter(function (r) { return r.resource_type === 'game'; });
    }
    return allRes.filter(function (r) { return r.skills && r.skills.indexOf(skill) !== -1; });
  }

  function renderPurposeSection(container) {
    const section = el('section', { class: 'browse-section' }, [
      el('div', { class: 'browse-section-heading', text: 'Discover' }),
      el('div', { class: 'browse-section-title', text: 'By purpose' })
    ]);
    PURPOSE_GROUPS.forEach(function (g) {
      const list = filteredByIntent(resourcesForSkillGroup(g.skill, allResources));
      // When a specific intent filter is active and this group isn't it,
      // skip rendering it entirely rather than showing an irrelevant empty shelf.
      if (currentIntent !== 'all' && currentIntent !== g.skill) return;
      section.appendChild(groupBlock(g.label, list.length, list));
    });
    container.appendChild(section);
  }

  function renderSituationSection(container) {
    if (currentIntent !== 'all') return; // situational cuts are orthogonal to the purpose filter — hide while a purpose filter is active to avoid a confusing double-filter feeling
    const base = allResources.filter(function (r) { return r.card_style === 'activity'; });
    const lowPrep = base.filter(isLowPrep);
    const printable = base.filter(isPrintable);

    const section = el('section', { class: 'browse-section' }, [
      el('div', { class: 'browse-section-heading', text: 'Discover' }),
      el('div', { class: 'browse-section-title', text: 'By situation' })
    ]);
    section.appendChild(groupBlock('Low prep', lowPrep.length, lowPrep));
    section.appendChild(groupBlock('Printable', printable.length, printable));
    container.appendChild(section);
  }

  function renderOriginSection(container) {
    if (currentIntent !== 'all') return; // same reasoning as situation: don't stack two filter axes
    const section = el('section', { class: 'browse-section' }, [
      el('div', { class: 'browse-section-heading', text: 'Discover' }),
      el('div', { class: 'browse-section-title', text: 'By origin' })
    ]);
    ORIGIN_GROUPS.forEach(function (g) {
      const list = allResources.filter(g.test);
      section.appendChild(groupBlock(g.label, list.length, list));
    });
    container.appendChild(section);
  }

  function renderSections() {
    const container = document.getElementById('browse-sections');
    container.innerHTML = '';
    renderPurposeSection(container);
    renderSituationSection(container);
    renderOriginSection(container);
  }

  renderIntentStrip();
  FRT.ready().then(function (all) {
    allResources = all;
    renderSections();
  }).catch(function (err) {
    console.error('Browse failed to load resource data:', err);
  });

})();
