# Adding something to "Made by Free Range Tutors"

The page at `/made-by-frt/` is built from `data/originals.json`. One entry per item.

1. Put the file(s) in `pdfs/` and a cover image in `images/` (JPG or PNG).
2. Make the item's own page (copy `stop-the-slop/index.html` as a starting point) at `/<name>/index.html`.
3. Add an entry to `data/originals.json`. Copy the existing one and change every field:
   `kind` is `guide`, `printable` or `tool`; `page` is the item's page; `downloads` lists each file,
   with `format` and a short `detail` (pages, size). Write only what is true of the actual file.
4. Run `node tools/build-static.js` (refreshes the no-JavaScript list and `sitemap.xml`).
5. Run `node data/site.test.js`. It checks the files exist and are real PDFs, the page links to them,
   and nothing is out of date. Do not publish if it fails.

External resources from other people still go in `data/resources/` (see SCHEMA.md); after adding one,
run step 4 as well so the homepage's no-JavaScript list includes it.
