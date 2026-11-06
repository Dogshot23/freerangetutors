# Editorial photograph library: workflow

The homepage "Website of the Day" feature (`website-of-the-day.js`) shows a black halftone photograph beside each featured
website. These are NOT one photograph per website: they are a small shared library (`data/editorial-library.json`) matched to
websites by tags. Adding a website never requires adding a photograph (it just gets the best match, or the text-only layout).
This file is for adding or replacing a photograph. It follows the same licence rules as `tools/FEATURED_IMAGE_WORKFLOW.md`.

## Rules
- **Licences allowed:** public domain, CC0, CC BY, CC BY-SA, or a licence that explicitly permits commercial use and modification.
  NOT allowed: NC, ND, "editorial use only", unclear or missing licence, or an image taken from a website just because it is
  publicly visible. If the rights cannot be established, do not use the image.
- **Verify at the original source, not only a Commons template.** For Library of Congress, NARA, NIH, USFWS, Met and similar
  items read the institution's own record and quote its rights statement. (loc.gov blocks automated clients; the Internet Archive's
  copy of the record page is an acceptable way to read it. Do not try to bypass a bot challenge.) For a creator's own upload on
  Wikimedia Commons, the file page's licence is the evidence.
- **Genuine photography** with strong shapes that survive halftoning. No stock-style business shots, no AI-looking images, no
  obvious advertising. Prefer no identifiable faces. Check the halftone by eye over cream and red before adding it: reject
  images that go near-black, near-blank or too busy.
- **Credit:** every photograph shows a visible credit line on the homepage, built from the library entry. CC BY needs it; for
  CC0 and public domain it is a courtesy.

## Steps
1. Find the photograph and read its source record and licence. Download the highest-resolution original and check its hash
   against the source's published checksum where one exists (Commons shows a SHA-1).
2. Save the original as `images/resources/_masters/library/<id>.<ext>` (`_masters` is excluded from the public site by `.assetsignore`).
   Choose a short lowercase-hyphen `<id>` that describes the subject. Record the file's SHA-256.
3. Make the halftone with the unchanged script (never hand-tune the look):
   `python tools/make_feature_halftone.py <id> images/resources/_masters/library/<id>.jpg --out images/editorial/library/<id>.png`
   Optional per-image choice of crop only: `--focus FX,FY` or `--crop x0,y0,x1,y1` (record it in the entry as `halftone_focus`).
4. Add an entry to `data/editorial-library.json` under `images.<id>`: file, master, master_sha256, subject, tags, status
   (`active`, or `reserve` to keep it without using it), title, creator, year, source_site, source_page, source_file_url,
   licence, licence_url, commercial_use ("yes"), licence_evidence (URL + text, at least one), attribution_requirements,
   change_note, retrieved (ISO date), notes. `tags` are lowercase words that match sites' `image_tags` (see `data/SCHEMA.md`).
5. Run `node data/editorial-library.test.js` and `node data/website-of-the-day.test.js`, then check the homepage at 1280 px and
   390 px: photograph loads, crosses the red border, credit line correct, no horizontal scroll, no console errors.
6. Do not commit, push or deploy unless the owner says so.

## Changing the rotation or matching
Both live in `website-of-the-day.js` as pure functions and are covered by `data/website-of-the-day.test.js`. The anchor date is
fixed on purpose: changing it reshuffles the whole sequence.
