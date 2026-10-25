/* "Made by Free Range Tutors": filter buttons for the catalogue. Every card is already in the page (tools/build-catalogue.js),
   so without this script, or if it fails, the whole catalogue is simply visible. This only shows and hides cards.
   The two groups combine: Free or Paid, AND one category. "All resources" clears both. No dependencies. */
(function () {
  var filters = document.getElementById('cat-filters');
  var list = document.getElementById('mbf-list');
  var count = document.getElementById('cat-count');
  var empty = document.getElementById('cat-empty');
  if (!filters || !list || !count) return;

  var cards = Array.prototype.slice.call(list.querySelectorAll('.cat-item'));
  var chips = Array.prototype.slice.call(filters.querySelectorAll('.cat-chip'));
  var resetChip = filters.querySelector('[data-reset]');
  var state = { access: '', category: '' };

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var ok = (!state.access || card.getAttribute('data-access') === state.access) &&
               (!state.category || card.getAttribute('data-category') === state.category);
      card.hidden = !ok;
      if (ok) shown++;
    });
    var total = cards.length;
    var filtered = state.access || state.category;
    count.textContent = filtered ? 'Showing ' + shown + ' of ' + total + ' resources' : total + ' resources';
    if (empty) empty.hidden = shown !== 0;
    chips.forEach(function (chip) {
      var group = chip.getAttribute('data-group');
      var on = group ? state[group] === chip.getAttribute('data-value') : !filtered;
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function reset() { state.access = ''; state.category = ''; apply(); }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var group = chip.getAttribute('data-group');
      if (!group) { reset(); return; }
      var value = chip.getAttribute('data-value');
      state[group] = state[group] === value ? '' : value; /* pressing the active button turns it off */
      apply();
    });
  });
  if (empty) {
    Array.prototype.forEach.call(empty.querySelectorAll('[data-reset]'), function (b) {
      b.addEventListener('click', function () { reset(); if (resetChip) resetChip.focus(); });
    });
  }

  filters.hidden = false;
  apply();
})();
