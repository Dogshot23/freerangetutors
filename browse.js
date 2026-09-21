/* ============================================================
   THE DISPATCH — Toolkit (formerly Browse)
   Consumes data/resources.js (FRT.all / FRT.byIntent) and the
   existing renderResourceCard component. No second source of
   truth for categories or resources — every grouping below reads
   directly from each resource's own intent/skills/resource_type/
   tool_kind fields, the same fields Dispatch already uses.

   Toolkit IA (approved): four peer intents, same as Dispatch's own
   Teach/Find-a-Tool split plus the two intents Dispatch doesn't
   expose (Set Homework, Manage My Teaching). intent is the only
   primary axis; skills/resource_type/prep_level/tool_kind are
   secondary, and only ever shown inside the one or two intents
   where they're actually meaningful — never a global filter panel.
   See the Toolkit IA Proposal and Implementation Spec documents
   for the full reasoning.
   ============================================================ */

(function () {

  /* ---- THE FOUR INTENTS ----
     Real catalogue counts (confirmed against data/resources/*.json
     at the time of this build): teach 10, find_tool 0, homework 1,
     manage 4. Counts are computed live below, never hard-coded —
     this list only fixes the id/label/description, matching the
     landing screen to the homepage tile language already in use. */
  const TOOLKIT_INTENTS = [
    { key: 'teach', label: 'Teach Something', sub: 'A time-boxed activity for the next lesson' },
    { key: 'find_tool', label: 'Find a Tool', sub: 'A whiteboard, planner, tracker, or AI tool' },
    { key: 'homework', label: 'Set Homework', sub: 'Something a student uses on their own' },
    { key: 'manage', label: 'Manage My Teaching', sub: "Free Range Tutors' own admin tools" }
  ];

  /* Skill filter row, Teach Something only — same 5 labels as the
     homepage's skill tiles, so a teacher who's already used those
     doesn't have to learn new language here. Grammar and Listening
     stay in this list even though they resolve empty today (see
     resourcesForSkill below) — a structural gap is shown honestly,
     never hidden, per the approved IA. */
  const TEACH_SKILLS = [
    { key: 'speaking', label: 'Talking' },
    { key: 'play', label: 'Games' },
    { key: 'vocab', label: 'Vocabulary' },
    { key: 'grammar', label: 'Grammar' },
    { key: 'listening', label: 'Listening / Watching' }
  ];

  /* tool_kind filter row, Manage My Teaching only. Only the values
     genuinely present in the catalogue today are offered — Live
     Lesson and AI are real schema values but have zero resources
     right now, so per "do not add filters for values that currently
     have zero resources," they are not shown as options here. */
  const MANAGE_TOOL_KINDS = [
    { key: 'planning', label: 'Planning' },
    { key: 'tracking', label: 'Tracking' }
  ];

  /* Legacy skill-shaped query values, preserved exactly — these are
     the 5 homepage tile hrefs from before this change, and their
     practical destination (Teach Something, with this skill/type
     pre-selected) must not change. */
  const LEGACY_SKILL_PARAMS = { talking: 'speaking', vocab: 'vocab', grammar: 'grammar', listen_watch: 'listening', play: 'play' };

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

  /* ---- URL STATE ----
     ?intent= accepts: the 4 new intent keys (teach/find_tool/
     homework/manage), the 5 legacy skill-shaped values (talking/
     vocab/grammar/listen_watch/play, still resolving into Teach
     Something exactly as before), or 'all'/absent (the Toolkit
     landing screen — 'all' is kept as a legacy alias per the
     approved spec, not a distinct third state). */
  function parseUrlState() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('intent');

    if (raw == null || raw === 'all') {
      return { screen: 'landing' };
    }
    if (TOOLKIT_INTENTS.some(function (i) { return i.key === raw; })) {
      return { screen: raw, skill: null };
    }
    if (LEGACY_SKILL_PARAMS.hasOwnProperty(raw)) {
      return { screen: 'teach', skill: LEGACY_SKILL_PARAMS[raw] };
    }
    return { screen: 'landing' };
  }

  let state = parseUrlState();
  let allResources = [];

  function navigate(screen, skill) {
    state = { screen: screen, skill: skill || null };
    render();
  }

  /* ---- DATA HELPERS ---- */
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

  /* ---- SHARED PIECES ---- */
  function grid(resources) {
    const g = el('div', { class: 'rc-grid' }, []);
    resources.forEach(function (r) { g.appendChild(renderResourceCard(r)); });
    return g;
  }

  function emptyBlock(title, sub) {
    return el('div', { class: 'browse-empty' }, [
      el('div', { class: 'browse-empty-title', text: title }),
      el('div', { class: 'browse-empty-sub', text: sub })
    ]);
  }

  function backToToolkitLink() {
    const a = el('a', { href: 'browse.html', class: 'toolkit-back' }, []);
    a.textContent = '← All of Toolkit';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      history.pushState(null, '', 'browse.html');
      navigate('landing');
    });
    return a;
  }

  /* ---- LANDING SCREEN: the four intents as equal peer entries ---- */
  function renderLanding(container) {
    const section = el('section', { class: 'browse-section' }, [
      el('div', { class: 'browse-section-heading', text: 'Toolkit' }),
      el('div', { class: 'browse-section-title', text: 'What are you looking for?' })
    ]);

    const list = el('div', { class: 'toolkit-intent-list' }, []);
    TOOLKIT_INTENTS.forEach(function (intent) {
      const count = resourcesForIntent(intent.key, allResources).length;
      const a = el('a', { href: 'browse.html?intent=' + intent.key, class: 'toolkit-intent-card' }, [
        el('div', { class: 'toolkit-intent-card-title', text: intent.label }),
        el('div', { class: 'toolkit-intent-card-sub', text: intent.sub }),
        el('div', { class: 'toolkit-intent-card-count', text: count === 0 ? 'Nothing here yet' : count + (count === 1 ? ' resource' : ' resources') })
      ]);
      a.addEventListener('click', function (e) {
        e.preventDefault();
        history.pushState(null, '', 'browse.html?intent=' + intent.key);
        navigate(intent.key);
      });
      list.appendChild(a);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  /* ---- TEACH SOMETHING ---- */
  function renderTeach(container, activeSkill) {
    const section = el('section', { class: 'browse-section' }, [
      backToToolkitLink(),
      el('div', { class: 'browse-section-heading', text: 'Toolkit · Teach Something' }),
      el('div', { class: 'browse-section-title', text: 'Teach Something' })
    ]);

    const filterRow = el('div', { class: 'browse-intent', id: 'toolkit-skill-filter' }, []);
    const allBtn = el('button', {
      type: 'button',
      class: 'browse-intent-btn' + (activeSkill ? '' : ' browse-intent-btn--active')
    }, []);
    allBtn.textContent = 'ALL';
    allBtn.addEventListener('click', function () {
      history.pushState(null, '', 'browse.html?intent=teach');
      navigate('teach', null);
    });
    filterRow.appendChild(allBtn);

    TEACH_SKILLS.forEach(function (s) {
      const btn = el('button', {
        type: 'button',
        class: 'browse-intent-btn' + (activeSkill === s.key ? ' browse-intent-btn--active' : '')
      }, []);
      btn.textContent = s.label.toUpperCase();
      btn.addEventListener('click', function () {
        history.pushState(null, '', 'browse.html?intent=teach&skill=' + s.key);
        navigate('teach', s.key);
      });
      filterRow.appendChild(btn);
    });
    section.appendChild(filterRow);

    const list = activeSkill ? resourcesForSkill(activeSkill, allResources) : teachResources(allResources);

    if (list.length === 0) {
      section.appendChild(emptyBlock('Nothing here yet.', 'This shelf is still being built — not padded out, just honestly empty for now.'));
    } else {
      section.appendChild(grid(list));
    }
    container.appendChild(section);
  }

  /* ---- FIND A TOOL: honest empty state + cross-link ---- */
  function renderFindTool(container) {
    const section = el('section', { class: 'browse-section' }, [
      backToToolkitLink(),
      el('div', { class: 'browse-section-heading', text: 'Toolkit · Find a Tool' }),
      el('div', { class: 'browse-section-title', text: 'Find a Tool' })
    ]);

    section.appendChild(emptyBlock('Nothing here yet.', 'This shelf is still being built — not padded out, just honestly empty for now.'));

    const cross = el('p', { class: 'toolkit-cross-link' }, []);
    cross.innerHTML = 'Looking for one of Free Range Tutors’ own tools instead? <a href="browse.html?intent=manage" id="toolkit-cross-to-manage">Manage My Teaching →</a>';
    section.appendChild(cross);
    container.appendChild(section);

    const crossLink = document.getElementById('toolkit-cross-to-manage');
    if (crossLink) {
      crossLink.addEventListener('click', function (e) {
        e.preventDefault();
        history.pushState(null, '', 'browse.html?intent=manage');
        navigate('manage');
      });
    }
  }

  /* ---- SET HOMEWORK: deliberately lightweight, no filter row ---- */
  function renderHomework(container) {
    const section = el('section', { class: 'browse-section' }, [
      backToToolkitLink(),
      el('div', { class: 'browse-section-heading', text: 'Toolkit · Set Homework' }),
      el('div', { class: 'browse-section-title', text: 'Set Homework' })
    ]);

    const list = resourcesForIntent('homework', allResources);

    if (list.length === 0) {
      section.appendChild(emptyBlock('Nothing here yet.', 'This shelf is still being built — not padded out, just honestly empty for now.'));
    } else {
      section.appendChild(el('p', { class: 'toolkit-sparse-note', text: list.length === 1
        ? 'Just one so far — more homework-specific picks are coming.'
        : list.length + ' so far — more homework-specific picks are coming.' }, []));
      section.appendChild(grid(list));
    }
    container.appendChild(section);
  }

  /* ---- MANAGE MY TEACHING: the canonical home for the FRT tools ---- */
  function renderManage(container, activeKind) {
    const section = el('section', { class: 'browse-section' }, [
      backToToolkitLink(),
      el('div', { class: 'browse-section-heading', text: 'Toolkit · Manage My Teaching' }),
      el('div', { class: 'browse-section-title', text: 'Manage My Teaching' })
    ]);

    const all = resourcesForIntent('manage', allResources);

    const filterRow = el('div', { class: 'browse-intent' }, []);
    const allBtn = el('button', {
      type: 'button',
      class: 'browse-intent-btn' + (activeKind ? '' : ' browse-intent-btn--active')
    }, []);
    allBtn.textContent = 'ALL';
    allBtn.addEventListener('click', function () {
      history.pushState(null, '', 'browse.html?intent=manage');
      navigate('manage', null);
    });
    filterRow.appendChild(allBtn);

    MANAGE_TOOL_KINDS.forEach(function (k) {
      const btn = el('button', {
        type: 'button',
        class: 'browse-intent-btn' + (activeKind === k.key ? ' browse-intent-btn--active' : '')
      }, []);
      btn.textContent = k.label.toUpperCase();
      btn.addEventListener('click', function () {
        history.pushState(null, '', 'browse.html?intent=manage&kind=' + k.key);
        navigate('manage', k.key);
      });
      filterRow.appendChild(btn);
    });
    section.appendChild(filterRow);

    const list = activeKind ? resourcesForToolKind(activeKind, allResources) : all;

    if (list.length === 0) {
      section.appendChild(emptyBlock('Nothing here yet.', 'This shelf is still being built — not padded out, just honestly empty for now.'));
    } else {
      section.appendChild(grid(list));
    }
    container.appendChild(section);
  }

  function render() {
    const container = document.getElementById('browse-sections');
    container.innerHTML = '';

    if (state.screen === 'landing') {
      renderLanding(container);
    } else if (state.screen === 'teach') {
      renderTeach(container, state.skill);
    } else if (state.screen === 'find_tool') {
      renderFindTool(container);
    } else if (state.screen === 'homework') {
      renderHomework(container);
    } else if (state.screen === 'manage') {
      renderManage(container, state.skill);
    }
  }

  // A ?skill= (Teach Something) or &kind= (Manage My Teaching) param
  // alongside a known screen pre-selects that sub-filter on load, so a
  // shared/bookmarked deep link into a specific skill or tool_kind still
  // lands correctly. state.skill is reused as the "active sub-filter"
  // slot for both screens — they're mutually exclusive (only one screen
  // is ever active at a time), so one field is enough; it just means
  // different things depending on state.screen.
  function applyDeepSubFilterFromCurrentUrl() {
    const params = new URLSearchParams(window.location.search);
    if (state.screen === 'teach' && params.get('skill')) state.skill = params.get('skill');
    if (state.screen === 'manage' && params.get('kind')) state.skill = params.get('kind');
  }
  applyDeepSubFilterFromCurrentUrl();

  window.addEventListener('popstate', function () {
    state = parseUrlState();
    applyDeepSubFilterFromCurrentUrl();
    render();
  });

  FRT.ready().then(function (all) {
    allResources = all;
    render();
  }).catch(function (err) {
    console.error('Toolkit failed to load resource data:', err);
  });

})();
