/* Rescue Cards: search box and category buttons. Every card is already in the page (tools/build-rescue.js), so without
   this script, or if it fails, the whole collection is simply visible and each card still opens and closes natively.
   This only shows and hides cards, and opens a card named in the address (#card-3-6). No dependencies, no network. */
(function (root) {
  'use strict';

  /* Lower-case, and treat curly quotes, en dashes and ellipses as their plain forms, so "wasn't" matches "wasn’t". */
  function normalise(s) {
    return String(s)
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/–/g, '-')
      .replace(/…/g, '...')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Every space-separated word of the query must appear somewhere in the card's text. */
  function matches(haystack, query) {
    var words = normalise(query).split(' ').filter(Boolean);
    return words.every(function (w) { return haystack.indexOf(w) !== -1; });
  }

  if (root && typeof module !== 'undefined' && module.exports) { module.exports = { normalise: normalise, matches: matches }; }
  if (typeof document === 'undefined') return;

  var controls = document.getElementById('rc-controls');
  var groupsBox = document.getElementById('rc-groups');
  var count = document.getElementById('rc-count');
  var empty = document.getElementById('rc-empty');
  var search = document.getElementById('rc-search');
  var chipsBox = document.getElementById('rc-chips');
  if (!controls || !groupsBox || !count || !search || !chipsBox) return;

  var cards = Array.prototype.slice.call(groupsBox.querySelectorAll('.rc-card'));
  var groups = Array.prototype.slice.call(groupsBox.querySelectorAll('.rc-group'));
  var chips = Array.prototype.slice.call(chipsBox.querySelectorAll('.rc-chip'));
  var total = cards.length;
  var originalCount = count.textContent;
  var text = cards.map(function (li) { return normalise(li.textContent); });
  var state = { cat: '', query: '' };

  function apply() {
    var shown = 0;
    cards.forEach(function (li, i) {
      var ok = (!state.cat || li.getAttribute('data-cat') === state.cat) && (!state.query || matches(text[i], state.query));
      li.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(function (g) {
      g.hidden = !g.querySelector('.rc-card:not([hidden])');
    });
    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', chip.getAttribute('data-cat') === state.cat ? 'true' : 'false');
    });
    var filtered = state.cat || state.query;
    count.textContent = filtered ? 'Showing ' + shown + ' of ' + total + ' cards' : originalCount;
    if (empty) empty.hidden = shown !== 0;
  }

  function reset() { state.cat = ''; state.query = ''; search.value = ''; apply(); }

  search.addEventListener('input', function () { state.query = search.value; apply(); });
  search.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && search.value) { search.value = ''; state.query = ''; apply(); }
  });
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { state.cat = chip.getAttribute('data-cat'); apply(); });
  });
  var resetBtn = document.getElementById('rc-reset');
  if (resetBtn) resetBtn.addEventListener('click', function () { reset(); search.focus(); });

  /* A card named in the address opens, and opening or closing a card keeps the address in step so it can be bookmarked. */
  function openFromHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (!/^card-\d+-\d+$/.test(id)) return;
    var d = document.getElementById(id);
    if (d && d.tagName === 'DETAILS') { d.open = true; d.scrollIntoView(); }
  }
  groupsBox.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS' || !d.id || !window.history || !history.replaceState) return;
    if (d.open) { history.replaceState(null, '', '#' + d.id); }
    else if (location.hash === '#' + d.id) { history.replaceState(null, '', location.pathname + location.search); }
  }, true);
  window.addEventListener('hashchange', openFromHash);

  controls.hidden = false;
  apply();
  openFromHash();
})(typeof window === 'undefined' ? {} : window);
