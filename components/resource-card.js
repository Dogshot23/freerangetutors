/* ============================================================
   FREE RANGE TUTORS — resource-card component
   One renderer, reused everywhere a resource shows as a card:
   the directory grid, the "Recently added" strip, resource
   detail-page cross-links.

   renderResourceCard(resource) -> HTMLElement

   Driven entirely by data/resources/*.json entries (see
   data/SCHEMA.md). Never hard-codes a specific resource.

   "Xerox Zine Dispatch" visual system: a compact card face —
   type badge, source mark, title, description, teaching-use
   chips, dashed divider, metadata line, OPEN corner tab. See
   resource-card.css for the four reusable visual devices this
   markup drives. teacher_note still exists in the data and still
   renders on each resource's own detail page — it's not shown on
   the card face, which needs to stay compact and scannable.
   ============================================================ */

(function () {

  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];

  const TYPE_LABELS = {
    website: 'Website', app: 'App', game: 'Game', pdf: 'PDF',
    generator: 'Generator', tool: 'Tool', video: 'Video', activity: 'Activity'
  };

  const USE_LABELS = {
    speaking: 'Speaking', listening: 'Listening', reading: 'Reading', writing: 'Writing',
    grammar: 'Grammar', vocabulary: 'Vocabulary', pronunciation: 'Pronunciation',
    'warm-up': 'Warm-up', review: 'Review'
  };

  const COST_LABELS = { free: 'Free', freemium: 'Freemium', paid: 'Paid' };

  /* levels: a four-state semantic-set object ({mode, values?}), not a bare
     array — see data/SCHEMA.md. Returns a display string, or null when the
     caller should fall back to its own dim/placeholder treatment. */
  function levelLabel(levelSet) {
    if (!levelSet) return null;
    if (levelSet.mode === 'universal') return 'Any level';
    if (levelSet.mode === 'unknown') return null;
    if (levelSet.mode === 'not_applicable') return null;
    const values = levelSet.values || [];
    if (values.length === 0) return null;
    const sorted = values.slice().sort(function (a, b) {
      return CEFR_ORDER.indexOf(a) - CEFR_ORDER.indexOf(b);
    });
    return sorted.length === 1 ? sorted[0] : sorted[0] + '–' + sorted[sorted.length - 1];
  }

  function typeLabel(resourceType) {
    return TYPE_LABELS[resourceType] || resourceType;
  }

  function useLabel(use) {
    return USE_LABELS[use] || use;
  }

  function isExternal(resource) {
    return resource.source_category === 'curated_external' || resource.source_category === 'commercial';
  }

  /* Source mark text: identical shape/weight/position regardless of
     which branch fires (see resource-card.css .rc-source) — FRT
     originals and every external resource (curated or commercial,
     including GapTheMind) use the same "↗ domain" treatment, per
     the directory design spec's "equal members of the directory"
     requirement. No separate GapTheMind-specific visual tier. */
  function sourceMarkText(resource) {
    if (resource.source_category === 'own_original') return 'FRT ORIGINAL';
    if (resource.domain) return '↗ ' + resource.domain;
    return '↗ ' + resource.creator;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function renderResourceCard(resource) {
    /* ---- top row: type badge + source mark (device 1 lives in CSS
       as the card's top border; devices 2 is the badge below) ---- */
    const topRow = el('div', { class: 'rc-top' }, [
      el('span', { class: 'rc-type-badge', text: typeLabel(resource.resource_type) }),
      el('span', { class: 'rc-source', text: sourceMarkText(resource) })
    ]);

    /* ---- title + description ---- */
    const titleBlock = el('div', { class: 'rc-title-block' }, [
      el('h3', { class: 'rc-title', text: resource.name }),
      el('p', { class: 'rc-desc', text: resource.description_short })
    ]);

    /* ---- teaching-use chips (max 3 shown, matches the filter vocabulary) ---- */
    const uses = (resource.teaching_use || []).slice(0, 3);
    const chipRow = uses.length
      ? el('div', { class: 'rc-chips' }, uses.map(function (u) {
          return el('span', { class: 'rc-chip', text: useLabel(u) });
        }))
      : null;

    /* ---- bottom meta line: level · cost · time (compact, single line) ---- */
    const levelSet = resource.cefr_level || {};
    const levelVal = levelSet.mode === 'unknown' ? null : levelLabel(levelSet);
    const metaParts = [];
    if (levelVal) metaParts.push(levelVal);
    if (resource.cost) metaParts.push(COST_LABELS[resource.cost] || resource.cost);
    if (resource.activity_time_minutes != null) metaParts.push(resource.activity_time_minutes + ' min');
    const metaLine = metaParts.length
      ? el('div', { class: 'rc-meta-line', text: metaParts.join(' · ') })
      : null;

    /* ---- footer: open action only ---- */
    const footer = el('div', { class: 'rc-footer' }, [
      el('span', { class: 'rc-open', text: isExternal(resource) ? 'OPEN ↗' : 'OPEN →' })
    ]);

    /* Device 3: dashed divider always precedes the metadata line,
       giving every card the same quiet structural break regardless
       of which metadata fields happen to be populated. */
    const divider = el('hr', { class: 'rc-divider' }, []);

    const children = [topRow, titleBlock];
    if (chipRow) children.push(chipRow);
    children.push(divider);
    if (metaLine) children.push(metaLine);
    children.push(footer);

    const link = el('a', {
      class: 'rc-card',
      href: resource.url,
      'data-resource-id': resource.id
    }, children);

    if (isExternal(resource)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }

    return link;
  }

  window.renderResourceCard = renderResourceCard;

})();
