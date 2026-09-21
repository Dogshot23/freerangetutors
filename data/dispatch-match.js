/* ============================================================
   THE DISPATCH — matching engine
   Pure, deterministic, client-side. No network, no AI, no state.

   Pipeline: resource data -> normalisation -> scoring -> ranking
   -> DispatchMatch.run(catalogue, request) -> { status, results, note }

   This file has NO knowledge of the DOM. dispatch.js (the UI layer)
   is the only thing that imports this and renders its output.
   ============================================================ */

(function () {

  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const AGE_ORDER = ['young_learner', 'teen', 'adult']; // not a scale, just a fixed enum used for set logic

  /* ---- FOUR-STATE SEMANTIC SET HELPERS (Stage 4.5 migration) ----
     age_group, cefr_level, and group_fit are no longer bare arrays —
     each is { mode: 'universal'|'specific'|'unknown'|'not_applicable',
     values?: [...] }. An empty array used to be silently read as
     "matches everyone," which was the bug this migration fixes: an
     FRT tool with no stated audience scored as a PERFECT match for
     every age/group query. See data/SCHEMA.md for the full table.

     UNKNOWN must never behave as UNIVERSAL: it never hard-excludes,
     but it always carries a real penalty and is flagged, so it can
     only ever surface as a nearest-fit result, never a confident
     exact match, and never outranks a genuine UNIVERSAL or SPECIFIC
     hit. NOT_APPLICABLE never hard-excludes and is never scored at
     all — the dimension is simply absent from that resource's total,
     the same way level scoring already skips a level-less tool. */
  const UNKNOWN_PENALTY = 3.5; // moderate: worse than any real match, never zero, never disqualifying

  function setMode(field) {
    return field && field.mode ? field.mode : 'not_applicable'; // a missing field is treated as N/A, never as universal
  }
  function setValues(field) {
    return (field && field.values) || [];
  }
  /* Hard-filter test: does this semantic set exclude the given query value?
     Only 'specific' can ever exclude. */
  function setExcludes(field, queryValue) {
    if (queryValue == null) return false;
    const mode = setMode(field);
    if (mode !== 'specific') return false; // universal/unknown/not_applicable never hard-exclude
    return setValues(field).indexOf(queryValue) === -1;
  }

  /* ============================================================
     REQUEST SHAPE
     {
       time: number | null,            // minutes the teacher actually has
       age: 'young_learner'|'teen'|'adult'|null,
       level: 'A1'..'C1'|null,
       need: 'talking'|'play'|'vocab'|'grammar'|'listen_watch'|'filler'|'printable'|null,
       prep: 'none'|'light'|'moderate'|null,   // teacher's prep tolerance, not the resource's prep_level
       group: 'individual'|'pair'|'group'|null
     }
     Every field is optional — "any" / not asked is null. Progressive
     disclosure in the UI means most real requests will have 2-4 fields
     set, not all 6.

     Stage 4.5 migration note: 'need' still uses these same request-side
     values (this is the UI's question vocabulary, unchanged by the data
     migration) but now maps onto resource.skills/resource_type directly —
     the old resource.pathways field it used to also check no longer
     exists. resource.age_group/cefr_level/group_fit are now four-state
     semantic-set objects, not bare arrays — see the helpers immediately
     below and data/SCHEMA.md.
     ============================================================ */

  /* ---- HARD-ISH FILTER ----
     A resource that fails any of these is dropped before scoring,
     not merely down-ranked. These are the constraints where a "soft"
     failure would produce an actively unhelpful or embarrassing
     result (an adult roleplay handed to a 12-year-old; a grammar
     worksheet handed back for a speaking request when speaking
     activities exist; a 45-minute system for a 5-minute request).
     Grossly incompatible = more than roughly 3x the requested time
     with no usable alternative duration, not merely "longer than
     asked." */
  function passesHardFilter(resource, req) {
    if (resource.card_style === 'collection') return false; // Dispatch needs one resolvable time/level pair — see data/SCHEMA.md

    // Audience: only a 'specific' age_group can exclude — 'universal' is a
    // deliberate assertion (never excludes), 'unknown'/'not_applicable' also
    // never hard-exclude (see the UNKNOWN != UNIVERSAL note above; unknown's
    // cost is a soft penalty applied later, not a hard cut).
    if (setExcludes(resource.age_group, req.age)) return false;

    // Need/activity type: the strongest hard-ish signal. A resource must
    // either be tagged with the requested skill, or (for 'filler'/'printable',
    // which aren't skills) satisfy that structural requirement directly.
    // (Post-taxonomy-migration: 'pathways' no longer exists — this now
    // reads 'skills' plus 'resource_type' directly, and 'need' values map
    // onto skill tags via needToSkill(), same job the old pathways+skills
    // OR used to do.)
    if (req.need) {
      if (req.need === 'filler') {
        // A filler request cares about speed, not skill. Gate on the
        // resource's PRIMARY duration, not its best-usable (alt) one —
        // a 45-min pack with a 10-min alt is honestly a 45-min resource
        // that happens to have a shortcut, not a filler in its own right,
        // and showing it for "I've got 5 minutes" reads as an absurd
        // match even though the alt duration itself would fit.
        const primary = resource.activity_time_minutes;
        if (primary == null) return false;
        if (primary > 15) return false; // a "filler" whose main form runs past 15 min isn't a filler
      } else if (req.need === 'printable') {
        if (resource.resource_type !== 'printable') return false;
      } else if (req.need === 'play') {
        if (resource.resource_type !== 'game') return false;
      } else {
        // talking / vocab / grammar / listen_watch -> skill tag
        const skill = needToSkill(req.need);
        const inSkills = skill && resource.skills && resource.skills.indexOf(skill) !== -1;
        if (!inSkills) return false;
      }
    }

    // Grossly incompatible duration: only a hard exclusion at extreme
    // mismatch (>3x requested, and no alt duration brings it in range).
    if (req.time != null) {
      const best = bestUsableMinutes(resource);
      if (best != null && best > req.time * 3 && req.time <= 15) {
        // small requested windows (a filler, an end-of-lesson gap) are the
        // case where "casually returning a 45-minute lesson" (the brief's
        // explicit example) would actually happen — guard specifically there.
        return false;
      }
    }

    return true;
  }

  function needToSkill(need) {
    const map = { talking: 'speaking', play: null, vocab: 'vocab', grammar: 'grammar', listen_watch: 'listening' };
    return map[need] || null;
  }

  function bestUsableMinutes(resource) {
    if (resource.activity_time_minutes == null && resource.duration_alt_minutes == null) return null;
    if (resource.activity_time_minutes == null) return resource.duration_alt_minutes;
    if (resource.duration_alt_minutes == null) return resource.activity_time_minutes;
    return Math.min(resource.activity_time_minutes, resource.duration_alt_minutes);
  }

  /* ---- SOFT SCORING ----
     Lower is better (it's a distance/penalty score, not a fitness score
     — makes "closest fit" language in the UI a direct read of the
     winning result's own penalty breakdown, not a separate calculation).
     Every component is documented so the ranking is auditable, per the
     brief's "transparent, deterministic scoring function" requirement. */
  function scoreResource(resource, req) {
    const penalties = [];

    // TIME — exact duration first, alt duration second (smaller penalty
    // multiplier since using the alt is a designed, honest use of the
    // resource, not a workaround), modest differences cost little,
    // large ones cost more.
    if (req.time != null) {
      const primary = resource.activity_time_minutes;
      const alt = resource.duration_alt_minutes;
      let timePenalty;
      let usedAlt = false;

      if (primary != null && alt != null) {
        const primaryDiff = Math.abs(primary - req.time);
        const altDiff = Math.abs(alt - req.time);
        if (altDiff < primaryDiff) {
          timePenalty = altDiff * 1.2; // alt duration is honest but still a step away from "designed for this"
          usedAlt = true;
        } else {
          timePenalty = primaryDiff;
        }
      } else if (primary != null) {
        timePenalty = Math.abs(primary - req.time);
      } else {
        timePenalty = 6; // no fixed time at all (a reference tool, an own-app): mild, not zero, not disqualifying
      }
      penalties.push({ field: 'time', cost: timePenalty, usedAlt: usedAlt });
    }

    // LEVEL — four-state aware. universal: 0 (a deliberate, genuine claim
    // of "any level"). specific + exact match: 0; specific + miss: distance-
    // scaled, steep enough that a 2-step gap clearly outranks a 1-step one.
    // unknown: fixed UNKNOWN_PENALTY, never favoured over a real match, and
    // never confused with universal's free ride. not_applicable: unscored.
    if (req.level != null) {
      const levelMode = setMode(resource.cefr_level);
      let levelPenalty = null;
      if (levelMode === 'universal') {
        levelPenalty = 0;
      } else if (levelMode === 'unknown') {
        levelPenalty = UNKNOWN_PENALTY;
      } else if (levelMode === 'specific') {
        const values = setValues(resource.cefr_level);
        if (values.indexOf(req.level) !== -1) {
          levelPenalty = 0;
        } else {
          const reqIdx = CEFR_ORDER.indexOf(req.level);
          const nearestIdx = Math.min.apply(null, values.map(function (l) {
            return Math.abs(CEFR_ORDER.indexOf(l) - reqIdx);
          }));
          levelPenalty = nearestIdx * 4; // one full CEFR step = 4 — kept deliberately steep, see "don't pretend A2 and C1 are equivalent"
        }
      }
      // not_applicable: levelPenalty stays null -> not pushed, dimension unscored
      if (levelPenalty != null) penalties.push({ field: 'level', cost: levelPenalty });
    }

    // PREP — teacher's stated tolerance vs resource's actual requirement.
    // Only penalises when the resource asks for MORE prep than the
    // teacher said they have; asking for less than offered costs nothing.
    // (prep_level is a plain enum, not a semantic set — unaffected by the migration.)
    if (req.prep != null) {
      const prepRank = { none: 0, light: 1, moderate: 2, varies: 1.5 };
      const resourcePrep = prepRank[resource.prep_level] != null ? prepRank[resource.prep_level] : 1;
      const teacherPrep = prepRank[req.prep] != null ? prepRank[req.prep] : 1;
      const prepPenalty = Math.max(0, resourcePrep - teacherPrep) * 2;
      penalties.push({ field: 'prep', cost: prepPenalty });
    }

    // AGE — four-state aware, mirrors LEVEL's shape. universal: 0 (genuine
    // "any age" claim — this is the exact case the migration exists to keep
    // working correctly, distinct from an unasserted empty array). specific
    // + broader-than-one-value: a very mild fine-tuning penalty (unchanged
    // reasoning from before migration). unknown: UNKNOWN_PENALTY, flagged.
    // not_applicable: unscored.
    if (req.age != null) {
      const ageMode = setMode(resource.age_group);
      let agePenalty = null;
      if (ageMode === 'universal') {
        agePenalty = 0;
      } else if (ageMode === 'unknown') {
        agePenalty = UNKNOWN_PENALTY;
      } else if (ageMode === 'specific' && setValues(resource.age_group).length > 1) {
        agePenalty = 0.5; // a resource built for two audiences is a fine, not perfect, fit for one
      }
      if (agePenalty != null) penalties.push({ field: 'age', cost: agePenalty });
    }

    // GROUP — same four-state shape again. universal: 0. specific: excludes
    // via the hard filter already if genuinely incompatible, so here it's
    // 0 if included; unknown: UNKNOWN_PENALTY. not_applicable: unscored.
    if (req.group != null) {
      const groupMode = setMode(resource.group_fit);
      let groupPenalty = null;
      if (groupMode === 'universal') {
        groupPenalty = 0;
      } else if (groupMode === 'unknown') {
        groupPenalty = UNKNOWN_PENALTY;
      } else if (groupMode === 'specific') {
        groupPenalty = setValues(resource.group_fit).indexOf(req.group) !== -1 ? 0 : 3;
      }
      if (groupPenalty != null) penalties.push({ field: 'group', cost: groupPenalty });
    }

    const total = penalties.reduce(function (sum, p) { return sum + p.cost; }, 0);
    return { total: total, breakdown: penalties };
  }

  /* ---- RESULT SHAPE ----
     {
       status: 'match' | 'nearest' | 'none',
       results: [{ resource, score, breakdown, compromises: [...] }],
       note: string | null
     }
     'compromises' is a short list of human-readable strings for the
     UI's "closest fit" line — derived directly from the same
     breakdown used for ranking, never a separate explanation. */
  function describeCompromises(resource, req, breakdown) {
    const notes = [];
    breakdown.forEach(function (p) {
      if (p.cost <= 0) return;
      if (p.field === 'time' && req.time != null) {
        const used = p.usedAlt ? resource.duration_alt_minutes : resource.activity_time_minutes;
        if (used != null && used !== req.time) {
          notes.push(used + ' min instead of ' + req.time + (p.usedAlt ? ' (alt duration)' : ''));
        }
      }
      if (p.field === 'level' && req.level != null) {
        const levelMode = setMode(resource.cefr_level);
        if (levelMode === 'unknown') {
          notes.push('level not confirmed');
        } else if (levelMode === 'specific') {
          const values = setValues(resource.cefr_level);
          if (values.indexOf(req.level) === -1) {
            const label = values.length === 1 ? values[0] : values[0] + '–' + values[values.length - 1];
            notes.push(label + ' (asked for ' + req.level + ')');
          }
        }
      }
      if (p.field === 'prep' && req.prep != null) {
        notes.push(resource.prep_level + ' prep (you said ' + req.prep + ')');
      }
      if (p.field === 'age' && req.age != null && setMode(resource.age_group) === 'unknown') {
        notes.push('audience fit not confirmed');
      }
      if (p.field === 'group' && req.group != null && setMode(resource.group_fit) === 'unknown') {
        notes.push('group fit not confirmed');
      }
    });
    return notes;
  }

  function run(catalogue, request) {
    const req = request || {};

    const survivors = catalogue.filter(function (r) { return passesHardFilter(r, req); });

    if (survivors.length === 0) {
      return { status: 'none', results: [], note: 'Nothing useful here yet. Try a broader request.' };
    }

    const scored = survivors.map(function (r) {
      const s = scoreResource(r, req);
      return { resource: r, score: s.total, breakdown: s.breakdown };
    });

    scored.sort(function (a, b) { return a.score - b.score; });

    const EXACT_THRESHOLD = 1.5; // small enough that only near-perfect fits count as "exact," not a rounding trick
    const best = scored[0];
    const isExact = best.score <= EXACT_THRESHOLD;

    const top = scored.slice(0, 3).map(function (s) {
      return {
        resource: s.resource,
        score: s.score,
        breakdown: s.breakdown,
        compromises: isExact ? [] : describeCompromises(s.resource, req, s.breakdown)
      };
    });

    return {
      status: isExact ? 'match' : 'nearest',
      results: top,
      note: isExact ? null : 'No exact match — closest useful option shown.'
    };
  }

  window.DispatchMatch = {
    run: run,
    // exposed for the matching test file only — not part of the UI-facing API
    _internal: {
      passesHardFilter: passesHardFilter,
      scoreResource: scoreResource,
      bestUsableMinutes: bestUsableMinutes,
      setMode: setMode,
      setValues: setValues,
      setExcludes: setExcludes,
      UNKNOWN_PENALTY: UNKNOWN_PENALTY
    }
  };

})();
