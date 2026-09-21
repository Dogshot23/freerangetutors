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

    // Audience: only excludes when the resource declares a specific
    // audience AND the teacher's age is outside it. An empty age_group
    // (own tools, reference sheets) is universal by omission — never excluded on age.
    if (req.age && resource.age_group && resource.age_group.length > 0) {
      if (resource.age_group.indexOf(req.age) === -1) return false;
    }

    // Need/activity type: the strongest hard-ish signal. A resource must
    // either be tagged with the requested skill, or (for 'filler'/'printable',
    // which aren't skills) satisfy that structural requirement directly.
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
        const printableTypes = ['worksheet', 'pdf_pack', 'printable', 'task_cards', 'reference'];
        if (printableTypes.indexOf(resource.resource_type) === -1) return false;
      } else {
        // talking / play / vocab / grammar / listen_watch: map to pathways+skills
        const inPathway = resource.pathways && resource.pathways.indexOf(req.need) !== -1;
        const inSkills = resource.skills && resource.skills.indexOf(needToSkill(req.need)) !== -1;
        if (!inPathway && !inSkills) return false;
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

    // LEVEL — exact match = 0. Adjacent level = small. Further = larger,
    // scaled so a 2-step gap (e.g. A2 vs C1) clearly outranks a 1-step one.
    if (req.level != null) {
      let levelPenalty;
      if (!resource.cefr_level || resource.cefr_level.length === 0) {
        levelPenalty = 3; // level-agnostic resource (an own tool): mild, never favoured over a real level match
      } else if (resource.cefr_level.indexOf(req.level) !== -1) {
        levelPenalty = 0;
      } else {
        const reqIdx = CEFR_ORDER.indexOf(req.level);
        const nearestIdx = Math.min.apply(null, resource.cefr_level.map(function (l) {
          return Math.abs(CEFR_ORDER.indexOf(l) - reqIdx);
        }));
        levelPenalty = nearestIdx * 4; // one full CEFR step = 4 — kept deliberately steep, see "don't pretend A2 and C1 are equivalent"
      }
      penalties.push({ field: 'level', cost: levelPenalty });
    }

    // PREP — teacher's stated tolerance vs resource's actual requirement.
    // Only penalises when the resource asks for MORE prep than the
    // teacher said they have; asking for less than offered costs nothing.
    if (req.prep != null) {
      const prepRank = { none: 0, light: 1, moderate: 2, varies: 1.5 };
      const resourcePrep = prepRank[resource.prep_level] != null ? prepRank[resource.prep_level] : 1;
      const teacherPrep = prepRank[req.prep] != null ? prepRank[req.prep] : 1;
      const prepPenalty = Math.max(0, resourcePrep - teacherPrep) * 2;
      penalties.push({ field: 'prep', cost: prepPenalty });
    }

    // AGE — an exact overlap costs nothing; a resource whose audience
    // is broader/adjacent (e.g. teen+adult, teacher asked adult) still
    // passed the hard filter, so this only fine-tunes ranking among survivors.
    if (req.age != null && resource.age_group && resource.age_group.length > 1) {
      penalties.push({ field: 'age', cost: 0.5 }); // very mild: a resource built for two audiences is a fine, not perfect, fit for one
    }

    // GROUP — only scored when the teacher specified one AND the
    // resource declares a restriction; unset on either side costs nothing.
    if (req.group != null && resource.group_fit && resource.group_fit.length > 0) {
      const groupPenalty = resource.group_fit.indexOf(req.group) !== -1 ? 0 : 3;
      penalties.push({ field: 'group', cost: groupPenalty });
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
      if (p.field === 'level' && req.level != null && resource.cefr_level && resource.cefr_level.length) {
        const label = resource.cefr_level.length === 1
          ? resource.cefr_level[0]
          : resource.cefr_level[0] + '–' + resource.cefr_level[resource.cefr_level.length - 1];
        if (resource.cefr_level.indexOf(req.level) === -1) {
          notes.push(label + ' (asked for ' + req.level + ')');
        }
      }
      if (p.field === 'prep' && req.prep != null) {
        notes.push(resource.prep_level + ' prep (you said ' + req.prep + ')');
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
    _internal: { passesHardFilter: passesHardFilter, scoreResource: scoreResource, bestUsableMinutes: bestUsableMinutes }
  };

})();
