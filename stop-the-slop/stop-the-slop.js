/* Stop the Slop page: copy-link / share buttons, and a GA4 event on download clicks.
   No dependencies. The GA4 event uses the page's existing gtag (see index.html / about.html);
   if gtag isn't available the downloads simply work without it. */
(function () {
  function track(name, a) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, { link_url: a.getAttribute('href'), page_path: location.pathname });
      }
    } catch (e) { /* never block a download */ }
  }
  document.querySelectorAll('a[data-gtag]').forEach(function (a) {
    a.addEventListener('click', function () { track(a.getAttribute('data-gtag'), a); });
  });

  var url = document.getElementById('sts-url');
  var copy = document.getElementById('sts-copy');
  var msg = document.getElementById('sts-copied');
  var nativeBtn = document.getElementById('sts-share-native');
  var pageUrl = url ? url.value : location.href;

  function say(t) { if (msg) { msg.textContent = t; setTimeout(function () { msg.textContent = ''; }, 3500); } }

  if (copy) {
    copy.addEventListener('click', function () {
      function fallback() { url.focus(); url.select(); say('Press Ctrl+C (or Cmd+C) to copy the selected address.'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pageUrl).then(function () { say('Link copied.'); }, fallback);
      } else { fallback(); }
    });
  }
  if (nativeBtn && navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', function () {
      navigator.share({ title: 'Stop the Slop: a free guide for teachers', url: pageUrl }).catch(function () {});
    });
  }
})();
