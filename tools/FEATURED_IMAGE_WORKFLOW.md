# Featured-website photograph (pinned photograph): workflow

A website can have its **own** photograph on the homepage. When that website is the **Website of the Day**, the red feature block
shows its pinned photograph, with the proper credit and licence, instead of a photograph matched from the shared editorial library.
Websites without a pinned photograph keep using the library (`tools/EDITORIAL_LIBRARY_WORKFLOW.md`). Both use the same locked halftone
look, produced by `tools/make_feature_halftone.py`, and the same licence rules.

This is **optional, per website**. Nothing requires a pinned photograph when a free resource is added, and no test fails for the lack
of one. (The old rule that the newest free resource had to have one belonged to the removed "Recently added" band.) Today only
Gapminder has one.

The photograph is a black halftone (dots on a transparent background) that hangs from the cream area above into the red block.

## When to add one
Add one when a website has a subject worth a photograph of its own (Gapminder: Dollar Street). Otherwise let the library match it.
## Steps
1. **Understand the site.** What does it show or do? Pick a subject that represents it: one clear object or scene, strong
   shape, readable at small size. Prefer a photo with no identifiable faces.
2. **Find an image.** Prefer the site's own image library, then reputable open sources (Wikimedia Commons, Library of Congress,
   NASA, museum open-access programmes, Unsplash/Pexels only if their licence is checked). Never use a screenshot or logo.
3. **Check the licence for commercial use and adaptation.** Allowed: public domain, CC0, CC BY, CC BY-SA, or a licence that
   explicitly permits commercial use and modification. NOT allowed: NC, ND, "editorial use only", unclear or missing licence.
   Quote the licence wording from the site's own page. **If the licence is unclear, stop and report; do not use the image.**
   For CC BY: credit the creator, link the licence, state the change.
4. **Save the master.** Download the highest-resolution original to `images/resources/_masters/<id>-feature-source.<ext>`
   (that folder is excluded from the published site by `.assetsignore`). Record its SHA-256.
5. **Run the script** (never hand-tune the look):
   `python tools/make_feature_halftone.py <resource-id> images/resources/_masters/<id>-feature-source.jpg`
   It writes `images/editorial/feature-<resource-id>.png` (1100 x 1364 RGBA). The look is locked: 1100 px wide, 9 px dot pitch,
   45 degrees, 3x supersampling, ink #17140F, transparent background. Only the choice of crop may vary: `--focus FX,FY`
   (0..1, default centre) to move a cover-crop, or `--crop x0,y0,x1,y1` (fractions). The script refuses to overwrite an
   existing output.
6. **Look at it.** Preview over cream and red. If the subject is lost (very dark or flat image), try `--focus`, or choose another
   photograph. Do not change the look constants.
7. **Add the entry** to `data/featured-images.json` under `images.<resource-id>`: file, master, master_sha256, title,
   creator, year, source_site, source_page, source_file_url, licence, licence_url, commercial_use ("yes"),
   licence_evidence (URL + exact quote, at least one), attribution_requirements, change_note, retrieved (ISO date), notes.
   The key must be the resource's `id`: the homepage matches the Website of the Day to this key, so no code change is needed.
   `file` must be a path under `images/` ending in .png, .jpg or .webp; `source_page` and `licence_url` must be `https` links.
   The homepage shows the photograph only if `file`, `title`, `creator`, `source_site`, `source_page`, `licence`, `licence_url`
   and `change_note` are all present (`year` is optional); an incomplete entry is ignored and the library photograph is used.
   Leave other websites' entries in `images` (a photograph is shown only while its website is the Website of the Day); only
   move an entry to `retired` if its website is removed from the directory. Keep all files; do not delete masters.
8. **Verify.** `node data/featured-images.test.js` (includes the Holyoke regression: the script must reproduce the committed
   Holyoke PNG exactly, and checks that every entry is usable by the homepage), plus `data/website-of-the-day.test.js` and
   `data/homepage-featured.test.js`. Then check the homepage in a browser at 1280 px and 390 px on a day the website is
   selected: photo loads, overlaps the red block and rises into the cream, no horizontal scroll, no console errors, credit
   line correct (creator, licence link, change note). No CSS change should be needed.
9. **Do not commit, push or deploy** unless the owner says so.

## What the page does with the entry
`website-of-the-day.js` fetches `/data/featured-images.json` along with the library. If the selected website's `id` has a usable entry
in `images`, the photograph `src` is `images[<id>].file` and the credit line is built from the same entry by the same credit builder
used for library photographs: title (link to the source page), creator, year, source site, licence (link to the licence page) and the
change note. No entry, an incomplete entry, or a failed fetch means the library photograph for that day is used (or the text-only
layout if the library is also unavailable). Only `images` is read, never `retired`.

## Placement
The photograph sits in the `.wotd-photo` column of the red block (geometry in `website-of-the-day.css`, shared with library photographs):
a 440 px column (300 px under 1000 px; full width, 78 %, 250 px tall above the text under 700 px), pulled up so it rises into the
cream area; `object-fit: cover; object-position: 50% 0`. There is no opacity or blend mode: the see-through look comes only from
the transparent gaps between dots.

## Reference / history
- The original photograph was John Collier Jr., *Men talk, street scene at High Street, Holyoke, Massachusetts* (1941), Library
  of Congress, public domain. Its recipe was `tools/make_halftone.py` (kept for history). It is the regression fixture for
  the new script (`retired.holyoke-1941` in the JSON) and is never shown.
- `PROJECT_NOTES.md` (section "Editorial redesign") still describes the Holyoke photo as the homepage photo; this file is the
  current process.
