/* ============================================================
   THE DISPATCH — ticket interaction (UI layer only)
   Talks to DispatchMatch (matching) and FRT (data) but contains
   no scoring logic itself — see data/dispatch-match.js for that.

   Two-door fork (locked Product Decision A): the first screen
   presents TEACH SOMETHING and FIND A TOOL as two equal, first-
   class choices before any other question. Teach keeps the
   original validated TIME->NEED->LEVEL->AGE(->PREP->GROUP) flow
   unchanged. Find a Tool is a short, separate flow that only asks
   what's actually relevant to a tool lookup — never lesson
   duration, CEFR level, or student age.
   ============================================================ */

(function () {

  const TICKET_NO = String(Math.floor(1000 + Math.random() * 8999));

  /* ---- TEACH SOMETHING — unchanged from the original Dispatch flow ----
     Question order: TIME and NEED first, then LEVEL and AGE, with PREP
     and GROUP as skippable extras. Every question can be skipped, not
     just the last two — progressive disclosure, not a fixed wizard. */
  const TEACH_QUESTIONS = [
    {
      key: 'time',
      label: 'How long have you actually got?',
      options: [
        { value: 5, label: '5 min' },
        { value: 10, label: '10 min' },
        { value: 20, label: '20 min' },
        { value: 45, label: 'Full lesson' }
      ]
    },
    {
      key: 'need',
      label: 'What do you need it for?',
      options: [
        { value: 'talking', label: 'Speaking' },
        { value: 'vocab', label: 'Vocab' },
        { value: 'grammar', label: 'Grammar' },
        { value: 'listen_watch', label: 'Listen / watch' },
        { value: 'play', label: 'A game' },
        { value: 'filler', label: 'Just a filler' },
        { value: 'printable', label: 'Something printable' }
      ]
    },
    {
      key: 'level',
      label: 'Roughly what level?',
      options: [
        { value: 'A1', label: 'A1' }, { value: 'A2', label: 'A2' },
        { value: 'B1', label: 'B1' }, { value: 'B2', label: 'B2' },
        { value: 'C1', label: 'C1' }
      ]
    },
    {
      key: 'age',
      label: 'Who’s in the room?',
      options: [
        { value: 'young_learner', label: 'Young learners' },
        { value: 'teen', label: 'Teens' },
        { value: 'adult', label: 'Adults' }
      ]
    },
    {
      key: 'prep',
      label: 'Any time to prep, or walking in cold?',
      options: [
        { value: 'none', label: 'Walking in cold' },
        { value: 'light', label: 'A few minutes' },
        { value: 'moderate', label: 'I can prep' }
      ]
    },
    {
      key: 'group',
      label: 'One-to-one, pairs, or a group?',
      options: [
        { value: 'individual', label: '1:1' },
        { value: 'pair', label: 'Pairs' },
        { value: 'group', label: 'Group' }
      ]
    }
  ];
  const TEACH_CORE_QUESTIONS = 4; // time, need, level, age — always offered; prep/group are the two extra, more-skippable ones

  /* ---- FIND A TOOL — a genuinely separate, much shorter flow ----
     Only one required question (what kind of tool), plus an optional
     AI-only narrower. No time/level/age question exists here at all —
     those fields don't apply to a tool lookup, per the brief. */
  const TOOL_QUESTIONS = [
    {
      key: 'toolKind',
      label: 'What kind of tool?',
      options: [
        { value: 'live_lesson', label: 'Something to use live in a lesson' },
        { value: 'planning', label: 'Planning / prep' },
        { value: 'tracking', label: 'Tracking students' },
        { value: 'ai', label: 'An AI tool' }
      ]
    }
  ];
  const TOOL_CORE_QUESTIONS = 1; // just toolKind — genuinely a short flow, not a scaled-down teach flow

  function buildLabels(questions) {
    const labels = {};
    questions.forEach(function (q) {
      labels[q.key] = {};
      q.options.forEach(function (o) { labels[q.key][o.value] = o.label; });
    });
    return labels;
  }
  const TEACH_LABELS = buildLabels(TEACH_QUESTIONS);
  const TOOL_LABELS = buildLabels(TOOL_QUESTIONS);

  const state = {
    fork: null,       // null (door screen) | 'teach' | 'find_tool'
    answers: {},       // { time: 10, need: 'talking', ... } — only keys actually answered
    skipped: {},       // explicitly skipped keys, tracked separately from answered
    resolved: false
  };

  function activeQuestions() {
    return state.fork === 'find_tool' ? TOOL_QUESTIONS : TEACH_QUESTIONS;
  }
  function activeLabels() {
    return state.fork === 'find_tool' ? TOOL_LABELS : TEACH_LABELS;
  }
  function activeCoreCount() {
    return state.fork === 'find_tool' ? TOOL_CORE_QUESTIONS : TEACH_CORE_QUESTIONS;
  }

  function nextUnansweredIndex() {
    const questions = activeQuestions();
    for (let i = 0; i < questions.length; i++) {
      const k = questions[i].key;
      if (!(k in state.answers) && !(k in state.skipped)) return i;
    }
    return -1;
  }

  function buildRequest() {
    if (state.fork === 'find_tool') {
      // The Find-a-Tool door covers both the taxonomy's 'find_tool'
      // (live-lesson tech) and 'manage' (admin/planning) intents — see
      // the intentAny comment in data/dispatch-match.js for why.
      return {
        intentAny: ['find_tool', 'manage'],
        toolKind: state.answers.toolKind || null,
        aiOnly: state.answers.toolKind === 'ai'
      };
    }
    return {
      intent: 'teach',
      time: state.answers.time != null ? state.answers.time : null,
      age: state.answers.age || null,
      level: state.answers.level || null,
      need: state.answers.need || null,
      prep: state.answers.prep || null,
      group: state.answers.group || null
    };
  }

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

  /* ---- THE FIRST SCREEN: the two-door fork ----
     Two equal, first-class choices — neither is visually or
     structurally subordinate to the other. Selecting a door sets
     state.fork and moves straight into that flow's first question. */
  function renderFork(body) {
    const wrap = el('div', { class: 'fork-wrap' }, [
      el('div', { class: 'ticket-question-label', text: 'WHAT ARE YOU TRYING TO DO?' })
    ]);

    const doors = el('div', { class: 'fork-doors' }, []);

    const teachDoor = el('button', { type: 'button', class: 'fork-door fork-door--teach' }, [
      el('span', { class: 'fork-door-title', text: 'Teach Something' }),
      el('span', { class: 'fork-door-sub', text: 'A time-boxed activity for the next lesson' })
    ]);
    teachDoor.addEventListener('click', function () {
      state.fork = 'teach';
      render();
    });

    const toolDoor = el('button', { type: 'button', class: 'fork-door fork-door--tool' }, [
      el('span', { class: 'fork-door-title', text: 'Find a Tool' }),
      el('span', { class: 'fork-door-sub', text: 'A whiteboard, planner, tracker, or AI tool' })
    ]);
    toolDoor.addEventListener('click', function () {
      state.fork = 'find_tool';
      render();
    });

    doors.appendChild(teachDoor);
    doors.appendChild(toolDoor);
    wrap.appendChild(doors);
    body.appendChild(wrap);
  }

  function renderAnsweredChips(body) {
    const questions = activeQuestions();
    const labels = activeLabels();
    const answeredKeys = questions.map(function (q) { return q.key; })
      .filter(function (k) { return k in state.answers; });
    if (answeredKeys.length === 0) return;

    const wrap = el('div', { class: 'ticket-answered' }, []);
    answeredKeys.forEach(function (key) {
      const val = state.answers[key];
      const label = labels[key][val] || val;
      const chip = el('span', { class: 'ticket-answered-chip' }, [
        el('span', { class: 'chip-check', text: '✓' }),
        el('span', { text: label })
      ]);
      const editBtn = el('button', { type: 'button', 'aria-label': 'Change this answer', text: '×' }, []);
      editBtn.addEventListener('click', function () {
        delete state.answers[key];
        delete state.skipped[key];
        render();
      });
      chip.appendChild(editBtn);
      wrap.appendChild(chip);
    });
    body.appendChild(wrap);
  }

  function runDispatch() {
    FRT.ready().then(function (all) {
      const result = DispatchMatch.run(all, buildRequest());
      renderResults(result);
    });
  }

  function renderResults(result) {
    const ticket = document.getElementById('ticket');
    const body = document.getElementById('ticket-body');
    ticket.classList.add('ticket--resolved');
    body.innerHTML = '';

    renderAnsweredChips(body);

    if (result.status === 'none') {
      body.appendChild(el('div', { class: 'ticket-none' }, [
        el('div', { class: 'ticket-none-headline', text: 'Nothing useful here yet.' }),
        el('div', { class: 'ticket-none-sub', text: 'Try a broader request — drop a constraint and see what turns up.' })
      ]));
      body.appendChild(restartControl());
      return;
    }

    const statusText = result.status === 'match' ? Object.keys(state.answers).length + ' matches' : 'Closest useful option';
    body.appendChild(el('div', { class: 'results-status', text: statusText }));
    if (result.note) {
      body.appendChild(el('div', { class: 'results-note', text: result.note }));
    }

    const list = el('div', { class: 'results-list' }, []);
    result.results.forEach(function (r, i) {
      const slot = el('div', { class: 'result-slot ' + (i === 0 ? 'result-slot--primary' : 'result-slot--secondary') }, []);
      slot.appendChild(renderResourceCard(r.resource));

      const why = el('div', { class: 'result-why' + (r.compromises.length ? ' result-why--compromise' : '') }, []);
      if (r.compromises.length === 0) {
        why.appendChild(document.createTextNode(''));
        why.innerHTML = '<strong>WHY THIS ONE — </strong>' + whySummary(r.resource);
      } else {
        why.innerHTML = '<strong>CLOSEST FIT — </strong>' + r.compromises.join(' · ');
      }
      slot.appendChild(why);
      list.appendChild(slot);
    });
    body.appendChild(list);
    body.appendChild(restartControl());
  }

  function whySummary(resource) {
    if (state.fork === 'find_tool') {
      const parts = [];
      if (resource.tool_kind) parts.push(toolKindLabel(resource.tool_kind));
      if (resource.ai_powered) parts.push('AI-powered');
      parts.push(resource.cost);
      return parts.join(' · ');
    }
    const parts = [];
    if (resource.activity_time_minutes != null) parts.push(resource.activity_time_minutes + ' min');
    const levelSet = resource.cefr_level;
    if (levelSet && levelSet.mode === 'universal') {
      parts.push('any level');
    } else if (levelSet && levelSet.mode === 'specific' && levelSet.values && levelSet.values.length) {
      const values = levelSet.values;
      parts.push(values.length === 1 ? values[0] : values[0] + '–' + values[values.length - 1]);
    }
    parts.push(resource.prep_level + ' prep');
    if (resource.skills && resource.skills.length) parts.push(resource.skills[0]);
    return parts.join(' · ');
  }

  function toolKindLabel(k) {
    const map = { live_lesson: 'live lesson', planning: 'planning', tracking: 'tracking', ai: 'AI tool' };
    return map[k] || k;
  }

  function restartControl() {
    const wrap = el('div', { class: 'ticket-restart' }, []);
    const btn = el('button', { type: 'button', text: 'Start a new ticket' }, []);
    btn.addEventListener('click', function () {
      state.fork = null;
      state.answers = {};
      state.skipped = {};
      state.resolved = false;
      document.getElementById('ticket').classList.remove('ticket--resolved');
      render();
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function coreQuestionsDone() {
    return activeQuestions().slice(0, activeCoreCount()).every(function (q) {
      return (q.key in state.answers) || (q.key in state.skipped);
    });
  }

  function render() {
    document.getElementById('ticket-number').textContent = 'No. ' + TICKET_NO;

    const body = document.getElementById('ticket-body');

    // First screen: the fork itself, before any question.
    if (state.fork === null) {
      document.getElementById('ticket').classList.remove('ticket--resolved');
      body.innerHTML = '';
      renderFork(body);
      return;
    }

    if (state.resolved) {
      runDispatch();
      return;
    }

    const idx = nextUnansweredIndex();
    if (idx === -1) {
      state.resolved = true;
      runDispatch();
      return;
    }

    body.innerHTML = '';
    renderAnsweredChips(body);

    const questions = activeQuestions();
    const q = questions[idx];
    const qBlock = el('div', { class: 'ticket-question' }, [
      el('div', { class: 'ticket-question-label', text: q.label.toUpperCase() })
    ]);

    const optionsRow = el('div', { class: 'ticket-options' }, []);
    q.options.forEach(function (opt) {
      const btn = el('button', { type: 'button', class: 'ticket-option' }, []);
      btn.textContent = opt.label;
      btn.addEventListener('click', function () {
        state.answers[q.key] = opt.value;
        render();
      });
      optionsRow.appendChild(btn);
    });
    qBlock.appendChild(optionsRow);
    body.appendChild(qBlock);

    // Find-a-Tool's single question has no "any is fine" skip — skipping
    // the only question would mean no filter at all, which the flow
    // still handles gracefully (falls through to "show results now"
    // below), so a skip control is offered here too for consistency,
    // just worded plainly rather than implying indifference.
    const skipWrap = el('div', { class: 'ticket-skip' }, []);
    const skipBtn = el('button', { type: 'button', text: 'Skip — any is fine' }, []);
    skipBtn.addEventListener('click', function () {
      state.skipped[q.key] = true;
      render();
    });
    skipWrap.appendChild(skipBtn);
    body.appendChild(skipWrap);

    body.appendChild(el('div', { class: 'ticket-progress' }, []));

    // Once the core questions for this fork are answered/skipped, offer a
    // direct exit instead of forcing the remaining (Teach-only) extras too.
    if (idx >= activeCoreCount() && coreQuestionsDone()) {
      const showNowWrap = el('div', { class: 'ticket-skip' }, []);
      const showNowBtn = el('button', { type: 'button', text: 'Show results now →' }, []);
      showNowBtn.addEventListener('click', function () {
        state.resolved = true;
        render();
      });
      showNowWrap.appendChild(showNowBtn);
      body.appendChild(showNowWrap);
    }
  }

  render();

})();
