/* ============================================================
   FREE RANGE TUTORS — apps.js
   Filter functionality for the Web Apps page (tools/index.html).
   No frameworks. No dependencies.
   ============================================================ */

(function () {

  const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
  const cards      = document.querySelectorAll('.card--app[data-tags]');
  const emptyState = document.getElementById('apps-empty');

  if (!filterBtns.length || !cards.length) return;

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {

      /* Update active state on buttons */
      filterBtns.forEach(function (b) { b.classList.remove('filter-btn--active'); });
      btn.classList.add('filter-btn--active');

      const filter = btn.getAttribute('data-filter');
      let visibleCount = 0;

      cards.forEach(function (card) {
        const tags   = card.getAttribute('data-tags')   || '';
        const status = card.getAttribute('data-status') || '';
        let show = false;

        if (filter === 'all') {
          show = true;
        } else if (filter === 'live') {
          show = status === 'live';
        } else if (filter === 'experimental') {
          show = true; /* "include experimental" — show everything */
        } else {
          show = tags.indexOf(filter) !== -1;
        }

        card.hidden = !show;
        if (show) visibleCount++;
      });

      /* Show empty state if nothing matches */
      if (emptyState) emptyState.hidden = visibleCount > 0;

    });
  });

})();
