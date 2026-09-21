/* ============================================================
   FREE RANGE TUTORS — resources.js
   Loads every resource entry from data/resources/*.json and
   exposes a small, dependency-free query API on window.FRT.

   No build step: this fetches the manifest + each JSON file at
   runtime. Pages that need resource data include this script
   and call FRT.ready(), then FRT.all() / FRT.byIntent(...) etc.

   Real Dispatch matching lives in data/dispatch-match.js
   (DispatchMatch.run) — this file is the data layer only.
   ============================================================ */

(function () {

  const DATA_BASE = '/data/resources/';
  const MANIFEST  = '/data/manifest.json';

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

  /* intent is now the multi-valued teacher-job field (replaces the old
     single-valued 'pathway' concept) — see data/SCHEMA.md. A resource
     matches if the requested intent is anywhere in its intent array. */
  function byIntent(intent) {
    return (_resources || []).filter(function (r) {
      return Array.isArray(r.intent) && r.intent.indexOf(intent) !== -1;
    });
  }

  /* Contiguous CEFR range collapse, e.g. {mode:"specific",values:["B1","B2"]}
     -> "B1–B2". Returns null for universal/unknown/not_applicable — callers
     decide how to render those states (never silently as a blank range). */
  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];
  function levelLabel(levelSet) {
    if (!levelSet || levelSet.mode !== 'specific') return null;
    const values = levelSet.values || [];
    if (values.length === 0) return null;
    const sorted = values
      .slice()
      .sort(function (a, b) { return CEFR_ORDER.indexOf(a) - CEFR_ORDER.indexOf(b); });
    if (sorted.length === 1) return sorted[0];
    return sorted[0] + '–' + sorted[sorted.length - 1];
  }

  window.FRT = {
    ready: load,
    all: all,
    byId: byId,
    byIntent: byIntent,
    levelLabel: levelLabel
  };

})();
