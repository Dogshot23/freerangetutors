/* ============================================================
   FREE RANGE TUTORS — resources.js
   Loads every resource entry from data/resources/*.json and
   exposes a small, dependency-free query API on window.FRT.

   No build step: this fetches the manifest + each JSON file at
   runtime. Pages that need resource data include this script
   and call FRT.ready(), then FRT.all() / FRT.dispatch(...) etc.
   ============================================================ */

(function () {

  const DATA_BASE = '/data/resources/';
  const MANIFEST  = '/data/manifest.json';

  const COMMERCIAL_CAP_RATIO = 1 / 3; // no more than 1 in 3 results may be source_category "commercial"

  let _resources = null;
  let _readyPromise = null;

  function load() {
    if (_readyPromise) return _readyPromise;

    _readyPromise = fetch(MANIFEST)
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load resource manifest');
        return r.json();
      })
      .then(function (ids) {
        return Promise.all(
          ids.map(function (id) {
            return fetch(DATA_BASE + id + '.json').then(function (r) {
              if (!r.ok) throw new Error('Could not load resource: ' + id);
              return r.json();
            });
          })
        );
      })
      .then(function (list) {
        _resources = list;
        return _resources;
      });

    return _readyPromise;
  }

  function all() {
    return _resources ? _resources.slice() : [];
  }

  function byId(id) {
    return (_resources || []).find(function (r) { return r.id === id; }) || null;
  }

  function byPathway(pathway) {
    return (_resources || []).filter(function (r) {
      return Array.isArray(r.pathways) && r.pathways.indexOf(pathway) !== -1;
    });
  }

  /* Contiguous CEFR range collapse, e.g. ["B1","B2"] -> "B1–B2" */
  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];
  function levelLabel(levels) {
    if (!levels || levels.length === 0) return null;
    const sorted = levels
      .slice()
      .sort(function (a, b) { return CEFR_ORDER.indexOf(a) - CEFR_ORDER.indexOf(b); });
    if (sorted.length === 1) return sorted[0];
    return sorted[0] + '–' + sorted[sorted.length - 1];
  }

  /* Dispatch: time, age, level, activity type (skills), prep -> 1-3 results.
     Loosens constraints in a fixed order when nothing matches exactly, and
     always reports whether the result is exact or nearest-fit. Never
     silently fabricates an exact match. */
  function dispatch(constraints) {
    const pool = (_resources || []).filter(function (r) {
      return r.card_style === 'activity'; // collection cards are out of Dispatch's scope by design
    });

    function scoreExact(r) {
      let ok = true;
      if (constraints.time != null && r.activity_time_minutes != null) {
        ok = ok && r.activity_time_minutes <= constraints.time;
      }
      if (constraints.age && r.age_group.length) {
        ok = ok && r.age_group.indexOf(constraints.age) !== -1;
      }
      if (constraints.level && r.cefr_level.length) {
        ok = ok && r.cefr_level.indexOf(constraints.level) !== -1;
      }
      if (constraints.skill && r.skills && r.skills.length) {
        ok = ok && r.skills.indexOf(constraints.skill) !== -1;
      }
      if (constraints.prep) {
        ok = ok && (r.prep_level === constraints.prep || r.prep_level === 'none');
      }
      return ok;
    }

    function distance(r) {
      let d = 0;
      if (constraints.time != null && r.activity_time_minutes != null) {
        d += Math.abs(r.activity_time_minutes - constraints.time);
      }
      if (constraints.level && r.cefr_level.length) {
        const idx = CEFR_ORDER.indexOf(constraints.level);
        const nearest = Math.min.apply(
          null,
          r.cefr_level.map(function (l) { return Math.abs(CEFR_ORDER.indexOf(l) - idx); })
        );
        d += nearest * 5;
      }
      return d;
    }

    function applyCommercialCap(list) {
      const maxCommercial = Math.max(1, Math.floor(list.length * COMMERCIAL_CAP_RATIO));
      let commercialCount = 0;
      return list.filter(function (r) {
        if (r.source_category !== 'commercial') return true;
        commercialCount++;
        return commercialCount <= maxCommercial;
      });
    }

    let exact = pool.filter(scoreExact);
    exact = applyCommercialCap(exact).slice(0, 3);

    if (exact.length > 0) {
      return { exact: true, results: exact, note: null };
    }

    const nearest = pool
      .slice()
      .sort(function (a, b) { return distance(a) - distance(b); })
      .slice(0, 2);

    return {
      exact: false,
      results: nearest,
      note: 'No exact match — nearest by time and level shown.'
    };
  }

  window.FRT = {
    ready: load,
    all: all,
    byId: byId,
    byPathway: byPathway,
    levelLabel: levelLabel,
    dispatch: dispatch
  };

})();
