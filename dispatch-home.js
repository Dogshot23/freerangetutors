/* ============================================================
   THE DISPATCH — homepage renderer
   All counts and sublines below are computed from the real
   resource data at load time — nothing here is hand-typed.
   ============================================================ */

(function () {

  const PATHWAY_TILES = [
    {
      pathway: 'emergency',
      label: 'Lesson Emergency',
      headline: '10 minutes or less',
      variant: 'emergency',
      href: 'dispatch.html',
      subline: function (list) {
        return list.length > 0
          ? '→ answer 4 quick questions, get 1–3 matches'
          : '→ answer 4 quick questions, get 1–3 matches';
      }
    },
    {
      pathway: 'tools',
      label: null,
      headline: 'Your Own Tools',
      variant: 'own',
      href: 'tools/index.html',
      kicker: function (list) {
        const live = list.filter(function (r) { return r.status === 'live'; }).length;
        const beta = list.filter(function (r) { return r.status === 'beta'; }).length;
        const exp = list.filter(function (r) { return r.status === 'experimental'; }).length;
        const parts = [];
        if (live) parts.push('● ' + live + ' LIVE');
        if (beta) parts.push('◐ ' + beta + ' BETA');
        if (exp) parts.push('○ ' + exp + ' EXPERIMENTAL');
        return parts.join(' · ');
      },
      subline: function (list) { return list.length + ' tool' + (list.length === 1 ? '' : 's') + ' — free, run in your browser'; }
    },
    {
      pathway: 'talking',
      headline: 'Get Them Talking',
      variant: 'teal',
      href: 'pathways/talking.html',
      subline: function (list) { return countSubline(list); }
    },
    {
      pathway: 'play',
      headline: 'Play Something',
      variant: 'gold',
      href: 'pathways/play.html',
      subline: function (list) { return countSubline(list); }
    },
    {
      pathway: 'vocab',
      headline: 'Practise Vocab',
      variant: 'outline',
      href: 'pathways/vocab.html',
      subline: function (list) { return countSubline(list); }
    },
    {
      pathway: 'grammar',
      headline: 'Work On Grammar',
      variant: 'raspberry',
      href: 'pathways/grammar.html',
      subline: function (list) { return countSubline(list); }
    },
    {
      pathway: 'listen_watch',
      headline: 'Listen / Watch',
      variant: 'outline',
      href: 'pathways/listen-watch.html',
      subline: function (list) { return countSubline(list); }
    }
  ];

  function countSubline(list) {
    if (list.length === 0) return 'nothing here yet';
    return '→ ' + list.length + ' resource' + (list.length === 1 ? '' : 's');
  }

  function tileEl(tile, list) {
    const a = document.createElement('a');
    a.href = tile.href;
    a.className = 'dispatch-tile dispatch-tile--' + tile.variant;

    if (tile.label) {
      const kicker = document.createElement('span');
      kicker.className = 'dispatch-tile-kicker';
      kicker.textContent = tile.label;
      a.appendChild(kicker);
    } else if (tile.kicker) {
      const kicker = document.createElement('span');
      kicker.className = 'dispatch-tile-kicker';
      kicker.style.fontFamily = 'var(--font-mono)';
      kicker.style.fontSize = '11px';
      kicker.style.opacity = '.7';
      kicker.textContent = tile.kicker(list);
      a.appendChild(kicker);
    }

    const inner = document.createElement('div');
    const headline = document.createElement('div');
    headline.className = 'dispatch-tile-headline';
    headline.textContent = tile.headline;
    inner.appendChild(headline);

    const sub = document.createElement('div');
    const subText = tile.subline(list);
    sub.className = 'dispatch-tile-sub' + (list.length === 0 && tile.pathway !== 'emergency' && tile.pathway !== 'tools' ? ' dispatch-tile-sub--empty' : '');
    sub.textContent = subText;
    inner.appendChild(sub);

    a.appendChild(inner);
    return a;
  }

  function renderBoard(allResources) {
    const board = document.getElementById('dispatch-board');
    PATHWAY_TILES.forEach(function (tile) {
      const list = tile.pathway === 'emergency'
        ? allResources.filter(function (r) { return r.pathways.indexOf('emergency') !== -1; })
        : FRT.byPathway(tile.pathway);
      board.appendChild(tileEl(tile, list));
    });
  }

  function renderReadout(allResources) {
    const readout = document.getElementById('dispatch-readout');
    const dates = allResources.map(function (r) { return r.date_updated || r.date_added; }).sort();
    const latest = dates[dates.length - 1];
    readout.textContent = allResources.length + ' resources · updated ' + formatDate(latest);
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d + ' ' + months[parseInt(m, 10) - 1];
  }

  function renderJustAdded(allResources) {
    const wrap = document.getElementById('dispatch-just-added');
    const sorted = allResources.slice().sort(function (a, b) {
      return (b.date_added > a.date_added) ? 1 : -1;
    }).slice(0, 3);

    sorted.forEach(function (r) {
      const item = document.createElement('span');
      item.className = 'dispatch-just-added-item';
      const level = FRT.levelLabel(r.cefr_level);
      const detail = [typeShort(r.resource_type), level].filter(Boolean).join(', ');
      item.innerHTML = formatDate(r.date_added) + ' — ' + escapeHtml(r.name) +
        (detail ? ' <span>(' + escapeHtml(detail) + ')</span>' : '');
      wrap.appendChild(item);
    });
  }

  function typeShort(t) {
    const map = { worksheet: 'worksheet', pdf_pack: 'pack', web_app: 'app', game: 'game',
      video: 'video', listening: 'listening', printable: 'printable', system: 'system',
      reference: 'reference', task_cards: 'cards', roleplay: 'roleplay', activity: 'activity',
      article: 'article', external_site: 'site' };
    return map[t] || t;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderFeatured(allResources) {
    // Stage 2 verification set: every real resource, in manifest order, so the
    // card component is exercised against all 11 migrated entries at once —
    // long titles, no-image, multi-level, collection, GapTheMind, external,
    // and FRT-original tools all appear here. Not a "featured" editorial
    // selection; that's a separate, smaller set (see the `featured` flag) for
    // whichever future homepage section actually wants a curated few.
    const grid = document.getElementById('dispatch-featured-grid');
    allResources.forEach(function (r) {
      grid.appendChild(renderResourceCard(r));
    });
  }

  FRT.ready().then(function (allResources) {
    renderBoard(allResources);
    renderReadout(allResources);
    renderJustAdded(allResources);
    renderFeatured(allResources);
  }).catch(function (err) {
    console.error('Dispatch homepage failed to load resource data:', err);
    document.getElementById('dispatch-readout').textContent = 'data unavailable';
  });

})();
