/* The School Trip That Should Have Been Cancelled: online player.

   - Exactly one screen exists in the page at a time. Every navigation clears #stage and builds the
     next screen, so later sections are not in the page and cannot be reached by scrolling.
   - The story text and choices come from story.json (exported from the story project).
   - Back is a real history: each step is a browser history entry holding the list of pages visited,
     so the Back button, the browser's Back button and Alt+Left all do the same thing.
   - No libraries, no network calls except story.json and the pictures, nothing stored or tracked.
   - Keyboard: everything is a real <button>; use Tab, Enter or Space. Focus moves to the new heading
     after each step so screen readers announce where you are. (No single-key shortcuts on purpose.) */
(function () {
  'use strict';

  var PDF_URL = '/pdfs/the-school-trip-that-should-have-been-cancelled.pdf';
  var CONTENT_NOTE = 'Contains toilet humour, sewage and gross-out comedy. Best suited to younger teenagers who enjoy deliberately disgusting humour.';
  var HOW_TO = [
    'Read each page. Every page is one part of the story.',
    'Choose button A or button B.',
    'Your choice decides what happens next. Different choices make different stories.',
    'Changed your mind? Press Back to return to the page you just came from.',
    'Every story ends. Press Start again and find another ending. There are 8!'
  ];

  var stage = document.getElementById('stage');
  var story = null;
  var byId = {};
  var trail = ['cover'];   // pages visited, last = current. 'cover' or a section id.

  /* ---------- small helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* **bold** markers in the story text become <strong>. Everything else is plain text. */
  function rich(text) {
    var frag = document.createDocumentFragment();
    text.split('**').forEach(function (part, i) {
      if (!part) return;
      frag.appendChild(i % 2 ? el('strong', { text: part }) : document.createTextNode(part));
    });
    return frag;
  }

  function validTrail(t) {
    if (!Array.isArray(t) || t.length < 1 || t[0] !== 'cover') return false;
    return t.every(function (id, i) { return (i === 0 && id === 'cover') || byId[id]; });
  }

  function picture(imageId) {
    var info = imageId && story.images[imageId];
    if (!info) return null;
    return el('figure', { class: 'pic' }, [
      el('img', { src: info.file, alt: info.alt, width: info.width, height: info.height, decoding: 'async' })
    ]);
  }

  function choiceButton(letter, label, onClick, secondary) {
    var b = el('button', { type: 'button', class: 'choice' + (secondary ? ' secondary' : '') }, [
      el('span', { class: 'letter', 'aria-hidden': 'true', text: letter }),
      el('span', { text: label })
    ]);
    b.addEventListener('click', onClick);
    return b;
  }

  var ARROW = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M9 1v10L2 6z"/></svg>';

  /* ---------- navigation ---------- */
  function navigate(newTrail) {
    trail = newTrail;
    history.pushState({ frt: 1, trail: trail.slice() }, '');
    render(true);
  }

  function goBack() {
    if (trail.length > 1) history.back();   // popstate does the rendering
  }

  /* ---------- screens ---------- */
  function renderCover() {
    var h = el('h1', { class: 'banner', tabindex: '-1', text: story.title });
    var chips = el('ul', { class: 'chips', 'aria-label': 'About this story' },
      (story.chips || []).map(function (c) { return el('li', { class: 'badge', text: c }); }));
    var howto = el('ol', { class: 'howto' }, HOW_TO.map(function (t) { return el('li', { text: t }); }));
    var start = choiceButton('', 'Start the story', function () { navigate(['cover', story.start]); }, false);
    start.className += ' start';
    start.removeChild(start.firstChild);   // no A/B letter on the start button

    var left = el('div', null, [
      el('p', { class: 'subtitle', text: story.subtitle }),
      chips,
      el('p', { class: 'note', role: 'note' }, [el('strong', { text: 'Content note: ' }), document.createTextNode(CONTENT_NOTE)]),
      el('div', { class: 'card', style: 'margin-top:1.2rem' }, [
        el('h2', { class: 'howto-title', text: 'How to play' }),
        howto
      ])
    ]);
    var pic = picture(story.cover_image);
    var grid = el('div', { class: 'grid' + (pic ? ' has-pic' : '') }, [left, pic]);
    var actions = el('div', { class: 'cover-actions' }, [start]);
    stage.appendChild(el('section', { class: 'screen cover', 'data-screen': 'cover' }, [h, grid, actions]));
    document.title = story.title + ': play online';
    return h;
  }

  function renderSection(id) {
    var s = byId[id];
    var isEnd = !!s.ending;
    var h = el('h1', { class: 'banner', tabindex: '-1', text: s.title });
    var top = el('div', { class: 'topbar' }, [h, isEnd ? el('span', { class: 'badge', text: 'The end' }) : null]);

    var card = el('div', { class: 'card' }, s.body.split('\n\n').map(function (p) {
      return el('p', null, [rich(p)]);
    }));
    var pic = picture(s.image);
    var grid = el('div', { class: 'grid' + (pic ? ' has-pic' : '') }, [card, pic]);

    var prompt = el('p', { class: 'prompt', id: 'prompt', text: isEnd ? 'The end. What next?' : 'What do you do? Choose A or B.' });
    var choices = el('div', { class: 'choices', role: 'group', 'aria-labelledby': 'prompt' });
    if (isEnd) {
      choices.appendChild(choiceButton('A', s.choices[0].label, function () { navigate(['cover', story.start]); }, false));
      choices.appendChild(choiceButton('B', 'Go back to the cover and read how to play.', function () { navigate(['cover']); }, true));
    } else {
      s.choices.forEach(function (c, i) {
        choices.appendChild(choiceButton('AB'.charAt(i), c.label, function () { navigate(trail.concat(c.target)); }, false));
      });
    }

    var back = el('button', { type: 'button', class: 'back' });
    back.innerHTML = ARROW + '<span>Back</span>';
    back.addEventListener('click', goBack);
    var navrow = el('div', { class: 'navrow' }, [back, el('span', { class: 'navhint', text: 'Goes back to the page you just came from.' })]);

    stage.appendChild(el('section', { class: 'screen story', 'data-section': id }, [top, grid, prompt, choices, navrow]));
    document.title = s.title + ' · ' + story.short_title;
    return h;
  }

  function render(moveFocus) {
    var current = trail[trail.length - 1];
    while (stage.firstChild) stage.removeChild(stage.firstChild);   // only ever one screen in the page
    var heading = current === 'cover' ? renderCover() : renderSection(current);
    window.scrollTo(0, 0);
    if (moveFocus) heading.focus({ preventScroll: true });
  }

  /* ---------- start up ---------- */
  window.addEventListener('popstate', function (e) {
    var st = e.state;
    trail = (st && st.frt && validTrail(st.trail)) ? st.trail.slice() : ['cover'];
    render(true);
  });

  function failed() {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    stage.appendChild(el('div', { class: 'card' }, [
      el('p', null, [el('strong', { text: 'The story could not load.' })]),
      el('p', null, [
        document.createTextNode('Check your connection and reload the page, or '),
        el('a', { href: PDF_URL, text: 'download the PDF version' }),
        document.createTextNode('.')
      ])
    ]));
  }

  fetch('story.json')
    .then(function (r) { if (!r.ok) throw new Error('story.json ' + r.status); return r.json(); })
    .then(function (data) {
      story = data;
      story.sections.forEach(function (s) { byId[s.id] = s; });
      var st = history.state;
      if (st && st.frt && validTrail(st.trail)) {
        trail = st.trail.slice();
      } else {
        trail = ['cover'];
        history.replaceState({ frt: 1, trail: ['cover'] }, '');
      }
      render(false);
    })
    .catch(failed);
})();
