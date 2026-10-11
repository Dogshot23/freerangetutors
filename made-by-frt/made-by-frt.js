/* "Made by Free Range Tutors": renders data/originals.json. To add an item, edit that
   file (see data/ORIGINALS.md), then run `node tools/build-static.js`. No dependencies. */
(function () {
  var KIND_LABELS = { guide: 'Free guide', printable: 'Free printable', tool: 'Browser tool' };

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  }

  function render(items) {
    var list = document.getElementById('mbf-list');
    list.innerHTML = '';
    items.slice().sort(function (a, b) { return a.date_added < b.date_added ? 1 : -1; }).forEach(function (o) {
      var item = el('article', { 'class': 'mbf-item' });
      var link = el('a', { href: o.page });
      link.appendChild(el('img', { src: o.image, alt: o.image_alt || '', width: '180', loading: 'lazy' }));
      item.appendChild(link);

      var body = el('div');
      body.appendChild(el('p', { 'class': 'mbf-kind' }, KIND_LABELS[o.kind] || o.kind));
      var h2 = el('h2'); h2.appendChild(el('a', { href: o.page }, o.title)); body.appendChild(h2);
      if (o.tagline) body.appendChild(el('p', { 'class': 'mbf-tagline' }, o.tagline));
      body.appendChild(el('p', { 'class': 'mbf-summary' }, o.summary));
      body.appendChild(el('p', { 'class': 'mbf-audience' }, 'For: ' + o.audience));

      var actions = el('div', { 'class': 'mbf-actions' });
      o.downloads.forEach(function (d, i) {
        var a = el('a', { 'class': 'mbf-btn' + (i ? ' secondary' : ''), href: d.file, download: '' }, 'Download: ' + d.label);
        a.appendChild(el('small', {}, d.format + ' · ' + d.detail));
        actions.appendChild(a);
      });
      actions.appendChild(el('a', { 'class': 'mbf-more', href: o.page }, 'Read more →'));
      body.appendChild(actions);
      item.appendChild(body);
      list.appendChild(item);
    });
  }

  fetch('/data/originals.json')
    .then(function (r) { if (!r.ok) throw new Error('originals.json ' + r.status); return r.json(); })
    .then(render)
    .catch(function (err) {
      console.error('Could not load originals:', err);
      document.getElementById('mbf-error').hidden = false;
    });
})();
