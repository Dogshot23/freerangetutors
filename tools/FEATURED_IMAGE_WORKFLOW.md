# Featured-website photograph: workflow

The red "Recently added" band on the homepage shows ONE black halftone photograph (dots on a transparent background) that
hangs from the cream area above into the red band. Every featured website gets its **own** photograph, prepared with the
same locked treatment. Claude: follow this whenever a free resource is added or the featured website changes.

## When this applies
The featured website is the **newest free/freemium entry by `date_added`** (`FEATURED_ID` is `null` in `directory.js`).
So adding a new free resource, or giving one a newer `date_added`, changes the featured website. `data/featured-images.test.js`
then FAILS until `data/featured-images.json` has an entry for the new featured id. That failure is the trigger: do not
silence it, and never point the new site at the previous site's photograph (the page hides the photo rather than reuse one).

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
   Leave the previous featured website's entry in `images` (its photo is simply not shown while it is not featured); only
   move an entry to `retired` if its website is removed from the directory. Keep all files; do not delete masters.
8. **Verify.** `node data/featured-images.test.js` (includes the Holyoke regression: the script must reproduce the committed
   Holyoke PNG exactly), plus `directory.test.js`, `site.test.js`. Then check the homepage in a browser at 1280 px and
   390 px: photo loads, overlaps the red band and rises into the cream, no horizontal scroll, no console errors, credit
   line correct. No CSS change should be needed.
9. **Do not commit, push or deploy** unless the owner says so.

## What the page does with the entry
`directory.js` (`renderFeaturePhoto`) fetches `/data/featured-images.json`, sets the photo `src` from `images[<featured id>].file`
and fills the footer credit (`#foot-credit`) from the same entry: title (link to source page), creator, year, source site,
licence (link) and change note. No entry or a failed fetch hides the photo and the credit.

## Placement (all in `directory.css`, unchanged by this workflow)
`.recent-photo` sits in a 440 px column (300 px under 1000 px; full width, 78 %, 250 px tall above the text under 700 px),
pulled up by `-(44px + --photo-rise)` so it rises into the cream area; `object-fit: cover; object-position: 50% 0`.
There is no opacity or blend mode: the see-through look comes only from the transparent gaps between dots.

## Reference / history
- The original photograph was John Collier Jr., *Men talk, street scene at High Street, Holyoke, Massachusetts* (1941), Library
  of Congress, public domain. Its recipe was `tools/make_halftone.py` (kept for history). It is the regression fixture for
  the new script (`retired.holyoke-1941` in the JSON) and is no longer shown.
- `PROJECT_NOTES.md` (section "Editorial redesign") still describes the Holyoke photo as the homepage photo; this file is the
  current process.
