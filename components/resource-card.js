/* ============================================================
   THE DISPATCH — resource-card component
   One renderer, reused everywhere a resource shows as a card:
   homepage strips, pathway pages, browse, Dispatch results.

   renderResourceCard(resource) -> HTMLElement

   Driven entirely by data/resources/*.json entries (see
   data/SCHEMA.md). Never hard-codes a specific resource.
   ============================================================ */

(function () {

  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];

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

  function prepLabel(prep) {
    switch (prep) {
      case 'none': return 'None';
      case 'light': return 'Light';
      case 'moderate': return 'Moderate';
      case 'varies': return 'Varies';
      default: return '—';
    }
  }

  function typeLabel(resourceType) {
    // Short, human labels for the TYPE metadata cell — keep tight, this cell has the least room.
    // Eight values per data/SCHEMA.md's resource_type taxonomy.
    const map = {
      tool: 'Tool', platform: 'Platform', activity: 'Activity', game: 'Game',
      lesson: 'Lesson', printable: 'Printable', media: 'Media', article: 'Article'
    };
    return map[resourceType] || resourceType;
  }

  function isExternal(resource) {
    return resource.source_category === 'curated_external' || resource.source_category === 'commercial';
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

  function metaCell(label, value, colorVar, opts) {
    opts = opts || {};
    const isLong = String(value).length > 5; // "8 min", "B1–B2" fit at full size; "Varies", "Moderate" etc. don't
    const cls = 'rc-meta-val' + (opts.dim ? ' rc-meta-val--dim' : '') + (isLong ? ' rc-meta-val--long' : '');
    const valEl = el('div', { class: cls }, []);
    valEl.textContent = value;
    if (!opts.dim && colorVar) valEl.style.color = 'var(' + colorVar + ')';
    return el('div', { class: 'rc-meta-cell' }, [
      el('div', { class: 'rc-meta-label', text: label }),
      valEl
    ]);
  }

  function renderResourceCard(resource) {
    const isCollection = resource.card_style === 'collection';
    const isTool = resource.resource_type === 'tool' && resource.source_category === 'own_original';

    /* ---- metadata strip ---- */
    const timeVal = resource.activity_time_minutes != null
      ? resource.activity_time_minutes + ' min' + (resource.duration_alt_minutes != null
          ? ' (' + resource.duration_alt_minutes + ' alt)' : '')
      : (isCollection ? 'Varies' : '—');

    const levelSet = resource.cefr_level || {};
    const levelVal = levelSet.mode === 'unknown' ? 'Not confirmed'
      : levelLabel(levelSet) || (isCollection ? 'Varies' : '—');
    const prepVal = prepLabel(resource.prep_level);
    const typeVal = typeLabel(resource.resource_type);

    const timeDim = resource.activity_time_minutes == null;
    const levelDim = levelSet.mode === 'unknown' || levelSet.mode === 'not_applicable'
      || (levelSet.mode === 'specific' && (!levelSet.values || levelSet.values.length === 0));
    const prepDim = resource.prep_level === 'varies';

    const metaStrip = el('div', { class: 'rc-meta' }, [
      metaCell('TIME', timeVal, '--signal-time', { dim: timeDim }),
      metaCell('LEVEL', levelVal, '--signal-level', { dim: levelDim }),
      metaCell('PREP', prepVal, '--signal-type', { dim: prepDim }),
      metaCell('TYPE', typeVal, null, { dim: true })
    ]);

    /* ---- title + description + optional image ---- */
    const titleBlock = el('div', { class: 'rc-title-block' }, [
      el('h3', { class: 'rc-title', text: resource.name }),
      el('p', { class: 'rc-desc', text: resource.description_short })
    ]);

    const bodyChildren = [titleBlock];

    if (resource.image) {
      bodyChildren.push(
        el('div', { class: 'rc-thumb' }, [
          el('img', { src: resource.image, alt: '', loading: 'lazy' })
        ])
      );
    } else if (isExternal(resource)) {
      // No image, but still external: keep a deliberate placeholder block, not a blank gap.
      bodyChildren.push(
        el('div', { class: 'rc-thumb rc-thumb--placeholder' }, [])
      );
    }

    const body = el('div', { class: 'rc-body' }, bodyChildren);

    /* ---- teacher's note (structurally graceful when absent) ---- */
    const children = [metaStrip, body];

    if (resource.teacher_note) {
      children.push(
        el('div', { class: 'rc-note' }, [
          el('p', { text: '“' + resource.teacher_note + '”' })
        ])
      );
    }

    /* ---- footer: attribution chip + status + open link ---- */
    const footerLeft = [];

    if (resource.gtmk_relationship) {
      footerLeft.push(el('span', { class: 'rc-chip rc-chip--gtmk', text: 'GapTheMind' }));
    } else if (isExternal(resource) && resource.domain) {
      footerLeft.push(el('span', { class: 'rc-chip', text: '↗ ' + resource.domain }));
    } else if (isTool && resource.status) {
      const dot = resource.status === 'live' ? '●' : resource.status === 'beta' ? '◐' : '○';
      footerLeft.push(el('span', { class: 'rc-chip rc-chip--status', text: dot + ' ' + resource.status.toUpperCase() }));
    }

    const footer = el('div', { class: 'rc-footer' }, [
      el('div', { class: 'rc-footer-left' }, footerLeft),
      el('span', { class: 'rc-open', text: isExternal(resource) ? 'OPEN ↗' : 'OPEN →' })
    ]);
    children.push(footer);

    const cardClass = 'rc-card' + (isTool ? ' rc-card--own' : '') + (isCollection ? ' rc-card--collection' : '');

    const link = el('a', {
      class: cardClass,
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
