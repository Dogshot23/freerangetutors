/* ============================================================
   FREE RANGE TUTORS — resources.js
   Loads every resource entry from data/resources/*.json and
   exposes a small, dependency-free query API on window.FRT.

   No build step: this fetches the manifest + each JSON file at
   runtime. Pages that need resource data include this script
   and call FRT.ready(), then FRT.all() / FRT.byTeachingUse(...) /
   FRT.byResourceType(...) etc.

   The directory homepage (directory.js) is the primary consumer
   of this data layer as of the Phase 1 directory-model rework.
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

  /* teaching_use is the open-ended, multi-valued "what can I use this
     for" tag array — see data/SCHEMA.md. Replaces the old skills field
     (renamed, unscoped from the retired intent/teach gate) as part of
     the Phase 1 directory-model migration. A resource matches if the
     requested use is anywhere in its teaching_use array. */
  function byTeachingUse(use) {
    return (_resources || []).filter(function (r) {
      return Array.isArray(r.teaching_use) && r.teaching_use.indexOf(use) !== -1;
    });
  }

  function byResourceType(type) {
    return (_resources || []).filter(function (r) { return r.resource_type === type; });
  }

  /* primary_category is the teacher-facing "what am I looking for"
     taxonomy — a different axis from resource_type ("what IS this").
     See data/SCHEMA.md. */
  function byPrimaryCategory(category) {
    return (_resources || []).filter(function (r) { return r.primary_category === category; });
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
    byTeachingUse: byTeachingUse,
    byResourceType: byResourceType,
    byPrimaryCategory: byPrimaryCategory,
    levelLabel: levelLabel
  };

})();
