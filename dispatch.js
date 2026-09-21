/* ============================================================
   THE DISPATCH — ticket interaction (UI layer only)
   Talks to DispatchMatch (matching) and FRT (data) but contains
   no scoring logic itself — see data/dispatch-match.js for that.
   ============================================================ */

(function () {

  const TICKET_NO = String(Math.floor(1000 + Math.random() * 8999));

  /* Question order: TIME and NEED first — the two fields the brief
     calls out as having the strongest influence on a useful result.
     LEVEL and AGE follow. PREP and GROUP are offered but explicitly
     skippable-by-default framing, since most requests won't need them
     to land a good result (progressive disclosure, not a fixed wizard —
     every question can be skipped, not just the last two). */
  const QUESTIONS = [
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

  const LABELS = {}; // key -> value -> display label, built once for the answered-chips
  QUESTIONS.forEach(function (q) {
    LABELS[q.key] = {};
    q.options.forEach(function (o) { LABELS[q.key][o.value] = o.label; });
  });

  const state = {
    answers: {}, // { time: 10, need: 'talking', ... } — only keys the teacher actually answered (or explicitly skipped, tracked separately)
    skipped: {},
    step: 0,
    resolved: false
  };

  function answeredCount() {
    return Object.keys(state.answers).length + Object.keys(state.skipped).length;
  }

  function nextUnansweredIndex() {
    for (let i = 0; i < QUESTIONS.length; i++) {
      const k = QUESTIONS[i].key;
      if (!(k in state.answers) && !(k in state.skipped)) return i;
    }
    return -1;
  }

  function buildRequest() {
    return {
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

  function renderAnsweredChips(body) {
    const answeredKeys = QUESTIONS.map(function (q) { return q.key; })
      .filter(function (k) { return k in state.answers; });
    if (answeredKeys.length === 0) return;

    const wrap = el('div', { class: 'ticket-answered' }, []);
    answeredKeys.forEach(function (key) {
      const val = state.answers[key];
      const label = LABELS[key][val] || val;
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

  function restartControl() {
    const wrap = el('div', { class: 'ticket-restart' }, []);
    const btn = el('button', { type: 'button', text: 'Start a new ticket' }, []);
    btn.addEventListener('click', function () {
      state.answers = {};
      state.skipped = {};
      state.resolved = false;
      document.getElementById('ticket').classList.remove('ticket--resolved');
      render();
    });
    wrap.appendChild(btn);
    return wrap;
  }

  const CORE_QUESTIONS = 4; // time, need, level, age — always offered; prep/group are the two extra, more-skippable ones

  function coreQuestionsDone() {
    return QUESTIONS.slice(0, CORE_QUESTIONS).every(function (q) {
      return (q.key in state.answers) || (q.key in state.skipped);
    });
  }

  function render() {
    document.getElementById('ticket-number').textContent = 'No. ' + TICKET_NO;

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

    const body = document.getElementById('ticket-body');
    body.innerHTML = '';
    renderAnsweredChips(body);

    const q = QUESTIONS[idx];
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

    const skipWrap = el('div', { class: 'ticket-skip' }, []);
    const skipBtn = el('button', { type: 'button', text: 'Skip — any is fine' }, []);
    skipBtn.addEventListener('click', function () {
      state.skipped[q.key] = true;
      render();
    });
    skipWrap.appendChild(skipBtn);
    body.appendChild(skipWrap);

    body.appendChild(el('div', { class: 'ticket-progress' }, []));

    // Once the 4 core questions are answered/skipped, offer a direct exit
    // instead of forcing prep/group too — the progressive-disclosure path
    // the brief asks for. Only shown once we're past the core set.
    if (idx >= CORE_QUESTIONS && coreQuestionsDone()) {
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
