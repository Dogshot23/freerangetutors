# Payhip paid-resources catalogue (GapTheMind on FreeRangeTutors)

Free Range Tutors stays a mostly free directory. Resources sold under the **GapTheMind** name are listed here and on the
`/paid-resources/` page; Payhip handles checkout and delivery.

**Three separate things are easy to confuse. Changing one does not change the others.**

| System | What it is | Where it is controlled |
|---|---|---|
| **Website data** | What this folder, `paid-resources/`, the directory entry and the nav/sitemap say. A product's `status: "live"` in `paid-resources.json` only means "the website may link to it". | This repository |
| **Payhip's own state** | The product's visibility (Invisible / Unlisted / Visible), the store name and About text, tax settings. | The Payhip dashboard, by the owner |
| **Website deployment** | Whether any of the above is actually served at freerangetutors.com. | Git + Cloudflare, with the owner's explicit permission; `.assetsignore` decides which files are published |

Nothing on this branch has been committed, pushed or deployed. `tools/` is kept off the public *website* by `.assetsignore`. The GitHub
repository itself is **public**, so anything committed (including notes in these data files) is readable there: never put credentials,
keys or private business details in them.

## Unified catalogue (2026-10-25, local branch feature/unified-frt-catalogue, not deployed)

The paid products are no longer shown on `/paid-resources/`. They are cards on `/made-by-frt/`, beside the two free items, built by `node tools/build-catalogue.js` from `data/originals.json` (free), this folder's `paid-resources.json` (paid) and `tools/catalogue.json` (page order, category, temporary Halloween tag). `/paid-resources/` redirects with the root `_redirects` file (301); `paid-resources/index.html` is only a fallback "moved" notice written by `node tools/build-paid-resources.js`, and the cover images stay in `paid-resources/images/`. To add a product: add it to `paid-resources.json`, add a line to `tools/catalogue.json`, run both builders and `node tools/build-static.js`, then the tests. `paid-resources/paid-resources.css` is now unused and can be deleted when the owner approves.

## Second release: ten more GapTheMind products (2026-10-17)

Ten more finished Partner Speaking Mysteries were created on Payhip (all $1.99 USD, 4-page PDF, CEFR B1-B2, Grades 5-8, pairs, about 25 minutes) and added
to the paid-resources page, the directory (`data/resources/<id>.json` + manifest) and the homepage no-JavaScript list. Each Payhip file was downloaded from
Payhip and its SHA-256 compared with the local source PDF: all ten are byte-identical. The first release's product (The Exploding Pudding) is unchanged.

| Title | Site id | Payhip URL | Source PDF (in the AI_Resource_Quality_Lab project) |
|---|---|---|---|
| The Clocks That Lie | `the-clocks-that-lie` | https://payhip.com/b/x86vs | `partner_series/unlikely_science_2026/_packages/the_clocks_that_lie_01/package/The_Clocks_That_Lie_Partner_Speaking_Mystery.pdf` |
| The Escaped Specimen | `the-escaped-specimen` | https://payhip.com/b/dRZco | `partner_series/unlikely_science_2026/_packages/the_escaped_specimen_01/package/The_Escaped_Specimen_Partner_Speaking_Mystery.pdf` |
| The Too-Helpful Robot | `the-too-helpful-robot` | https://payhip.com/b/FWrHk | `partner_series/unlikely_science_2026/_packages/the_too_helpful_robot_01/package/The_Too_Helpful_Robot_Partner_Speaking_Mystery.pdf` |
| The Dog Translator | `the-dog-translator` | https://payhip.com/b/FYKHe | `partner_series/unlikely_science_2026/_packages/the_dog_translator_01/package/The_Dog_Translator_Partner_Speaking_Mystery.pdf` |
| The Sixth Ghost | `the-sixth-ghost` | https://payhip.com/b/ZkCOX | `partner_series/halloween_2026/_packages/the_sixth_ghost_01/package/The_Sixth_Ghost_Partner_Speaking_Mystery.pdf` |
| The 9:47 Scream | `the-947-scream` | https://payhip.com/b/MnhYO | `partner_series/halloween_2026/_packages/the_947_scream_01/package/The_947_Scream_Partner_Speaking_Mystery.pdf` |
| Grandpa's Teeth | `grandpas-teeth` | https://payhip.com/b/x5Npe | `partner_series/halloween_2026/_packages/grandpas_teeth_01/package/Grandpas_Teeth_Partner_Speaking_Mystery.pdf` |
| Mr Bones Quits | `mr-bones-quits` | https://payhip.com/b/ZpK4L | `partner_series/halloween_2026/_packages/mr_bones_quits_01/package/Mr_Bones_Quits_Partner_Speaking_Mystery.pdf` |
| Too Much Money | `too-much-money` | https://payhip.com/b/RN0GB | `partner_series/halloween_2026/_packages/too_much_money_01/package/Too_Much_Money_Partner_Speaking_Mystery.pdf` |
| The Queue Jumper | `the-queue-jumper` | https://payhip.com/b/oxk9I | `partner_series/ministry_2026/_packages/the_queue_jumper_01/package/The_Queue_Jumper_Partner_Speaking_Mystery.pdf` |

Notes: the product page text was built from each product's own listing files (`tpt_listing/TPT_PRODUCT_DESCRIPTION.md`) with the TPT terms-of-use text replaced by the
approved Payhip licence wording. Covers are the existing GapTheMind covers (not redesigned); the 480 px directory thumbnails were made with
`python tools/generate_thumbnail.py --source <cover> --category teaching_materials --id <id> --fit crop` (this reproduces The Exploding Pudding's thumbnail
byte for byte). The directory's "All resources" list now shows free and freemium entries first and paid entries last (each group alphabetical), so ten paid cards
never bury the free toolkit; "Recently added" and the featured slot already ignored paid entries. The publication set is now **148 files** (118 + 10 covers
+ 10 thumbnails + 10 directory records); the 10 new 900 px masters are excluded with the other masters. `Category & Tags` (Marketplace) were not set on the new
Payhip products.

## Current state (last updated 2026-10-17; the first release's state, before the second release above)

- **Product:** The Exploding Pudding (creator: GapTheMind), $1.99 USD, PDF, 4 pages.
- **Verified direct URL:** `https://payhip.com/b/cFa7v` (taken from Payhip's own Share dialog).
- **Payhip visibility: Unlisted.** The owner has decided it should eventually be **Visible**. That change has not been made.
- **Verification (2026-10-17):** opened in a fresh, logged-out browser: product page loaded, $1.99, Buy Now present; Buy Now opened
  Payhip checkout (Stripe payment fields). Nothing was entered or bought. The checkout added **EU VAT** ($0.42 on $1.99, total $2.41)
  for an EU visitor. The VAT arrangements are to be reviewed by the owner before launch; no tax setting has been touched.
- **Payhip store name:** "GapTheMind on FreeRangeTutors" (live). **Store About text:** rewritten but only a **draft**; it has **not
  been published**, so the public store still shows Payhip's placeholder text and a stock photo until the owner publishes it.
- **Payhip storefront** (`https://payhip.com/FreeRangeTutors`) shows "No products found" while the product is Unlisted, so
  `page.store_url` stays `null` and the site never links to it. It can be linked once the product is Visible and the store text is published.
- **Website (local, uncommitted):** `paid-resources.json` is in `live` mode, so `paid-resources/index.html` is indexable with a canonical
  URL, and the nav, footer and sitemap link to it. The directory entry is `data/resources/the-exploding-pudding.json` (cost `paid`,
  source `commercial`, creator GapTheMind); its card shows "GapTheMind · payhip.com". The age range is left `unknown` on purpose:
  the PDF says "Grades 5-8" but states no ages.
- **`.assetsignore` (local, uncommitted):** the `paid-resources` exclusion has been **removed** so the page can be published; the
  prototype protection (`/shop/`, `data/products.json`) and the exclusion of five legacy paths (`/_archived-activities/`, `/files3/`,
  `/files4/`, `data/dispatch-match.js`, `images/resources/_masters/`) have been **added**. Against the committed file the diff is
  13 added lines and no removed lines. Nothing is published until the owner approves a commit, push and merge.

## Publish-time rules and safeguards (verified 2026-10-17)

**How publishing works** (read from Wrangler 4.151.0's own source, from a local install outside this repo, and checked against the live
site): Cloudflare Workers Builds clones the repository and Wrangler uploads **every file under the asset directory** except those matched
by `.assetsignore`. This branch adds a root `wrangler.jsonc` (name `freerangetutors`, `assets.directory` `"."`, nothing else; see "Why `wrangler.jsonc` is needed" below), uncommitted for now. Without a config, the production `wrangler deploy` auto-configures itself; for a static site
with an `index.html` at the root it picks the repo root (`"."`) as the asset directory (Wrangler's `findAssetsDir`; the 11 Oct "TEST
ONLY" commit message says the same). Confirm the Root directory in the dashboard (below). When auto-configuration runs it also appends
`!.dev.vars.example` and `!.env.example` to `.assetsignore` in the build copy; that cannot expose anything here (neither file exists at
the repo root, `.dev.vars` and `.env` stay excluded, and the prototype's example file stays hidden because `tools` is excluded).
Wrangler adds only `/.assetsignore`, `/_redirects` and `/_headers` itself, so **`.git` and everything
else internal stays out only because `.assetsignore` lists it**. It matches with the `ignore@5.3.1` library (gitignore syntax) and splits
the file on `\n` (the CRLF line endings are harmless: the library trims them). A file over 25 MiB fails the build. The repository has
**no `.gitignore`**, so Git protects nothing.

**What `.assetsignore` hides:** `.git`, `.gitattributes`, the ignore file itself, `node_modules`, `.dev.vars*`, `.env*`, `wrangler.*`,
`PROJECT_NOTES.md`, `*.zip`, `data/*.md`, `data/*.test.js`, `data/resource.schema.json`, `tools` (build scripts, this folder, the Stripe
prototype's Worker), `/shop/` and `data/products.json` (the unfinished Stripe shop prototype, which is otherwise protected only by being
untracked: one `git add -A` would have published 9 prototype files), and five legacy paths that nothing on the site uses (see below).
**Still do not use `git add -A`**: stage named files only.

**Why the change is safe** (all done before the file was edited):
- *Wrangler's own matcher, not Git's:* the `ignore` library was extracted verbatim from the installed Wrangler bundle and run through a
  line-for-line port of its asset walker. Git's engine gave the same answer as Wrangler's for all 213 files in the repo (the only
  differences were the built-in `_headers`/`_redirects` names, which do not exist here), so the in-repo test that uses Git's engine is a
  fair guard. Wrangler's matcher stays the authority.
- *Prediction versus production:* from commit `366b6b0` and its committed `.assetsignore` I predicted what the live site serves, then fetched
  28 paths spread across every rule: 13 predicted-excluded all returned 404, 10 predicted-published all served content, and 5 files not in
  the deployed commit returned 404. 28 of 28 matched. (This also proves leading-slash patterns work in production.)
- *Release set:* production serves 148 files today; the current file publishes **118** whether only the Payhip work is committed or
  everything is (`git add -A`), with 0 internal files, 0 prototype files, no file the site links to excluded or missing (82 referenced
  files checked, all 20 directory thumbnails published), nothing near the 25 MiB limit (largest 17.4 MiB), and a clean scan for key
  shapes, personal emails, local paths and account ids.
- *The 5 new public files:* `paid-resources/index.html`, `paid-resources/paid-resources.css`, `paid-resources/images/the-exploding-pudding.png`,
  `data/resources/the-exploding-pudding.json` and `images/resources/the-exploding-pudding.png`. (The new 900px master,
  `images/resources/_masters/the-exploding-pudding-900.png`, stays local with every other master.) 8 existing public files change:
  5 pages (`index.html`, `about.html`, `made-by-frt/index.html`, `stop-the-slop/index.html` and the story page: nav, footer, About
  wording, no-JavaScript list) plus `data/manifest.json`, `directory.js` and `sitemap.xml`.
- *35 files leave the live site on release* (148 - 35 + 5 = 118): the legacy paths below. Anyone who bookmarked or linked one of them
  will get a 404 afterwards; the site itself links to none, and the sitemap lists none.
- *Every dependency of the paid page is published:* its two stylesheets, cover image, favicons, social image and the pages it links to.
- Public `data/resources/*.json` files carry an `internal_notes` field (all 19 existing entries do; it is never rendered but anyone can
  fetch it), so keep nothing private in it.

**Previews:** a branch build that succeeds publishes a **public** `workers.dev` preview of what is committed (verified from the 11 Oct
"TEST ONLY" branch: its check run lists a `https://<alias>-freerangetutors.<account>.workers.dev` URL, plus one for the version id; both
loaded with no login, and seven internal paths on it, including `PROJECT_NOTES.md`, tests, `tools/`, the zip, `.assetsignore`,
`.git/config` and `wrangler.jsonc`, returned 404). The check run text is readable by anyone because the repo is public. A preview only ever contains the same files production
would publish, so it cannot show more than the 118-file set, but it would show the new page before the owner has reviewed it.

**The failed 12 Oct build** (Stop-the-Slop release branch, build `8b5964e4-152f-4963-afca-f3294da238c9`) is explained by the Cloudflare log:
`Executing user deploy command: npx wrangler versions upload` followed by `[ERROR] Missing entry-point to Worker script or to assets directory`.
That branch's tree is byte-identical to the `main` merge commit built about 18 minutes later and has no `wrangler.*` file; only the 11 Oct
TEST branch had one, and it built. So it was not the content (no file over 25 MiB, `.assetsignore` identical).

**Why `wrangler.jsonc` is needed:** non-production branch builds run `npx wrangler versions upload`, which, unlike `wrangler deploy`, does not
auto-generate a configuration, so a repo with no config fails with the error above and never produces a preview. The file is
`{name: "freerangetutors", compatibility_date: "2026-09-21", observability: {enabled: true}, assets: {directory: "."}}`: the same as the
11 Oct TEST branch's file (which mirrors what autoconfig generates for production) minus its `$schema` line, which points at a `node_modules`
folder this repo does not have. No routes, bindings, secrets or variables. `.assetsignore` already lists `wrangler.jsonc`, so the file itself is never
published (the publication set stays at 118 files). Effect: production, after merge, would read this file instead of auto-configuring,
with the same asset directory; branch pushes would then build instead of failing, and each gets a public workers.dev preview of the same 118 files.
Not yet verified: that production's Deploy command and Root directory behave the same with an explicit config (dashboard unread), so verify the
live checks after the first merge. Do not add the file to a commit by accident: it is part of the 22-file release set only if the owner approves.

**Uncertainties that remain:** the Cloudflare dashboard settings (below); which Wrangler version production uses (the live results
match 4.151.0's behaviour); and `/shop/` (directory-only, root-anchored) has been verified in the matcher but not on the live site,
because the prototype is not deployed.

**Legacy paths now excluded** (owner's request, 2026-10-17; each was checked: no page, script, data file, test or build step uses it).
These were public before; `_archived-activities/`, `files3/` and `data/dispatch-match.js` were fetched live and returned content.

| Path | Files | Why it is not needed on the site |
|---|---|---|
| `/_archived-activities/` | 16 | The 8 retired activities, "moved (not deleted)... outside the served catalogue" (see the `data/directory.test.js` header). |
| `/files3/`, `/files4/` | 2 + 2 | Old page and tool-template mock-ups; nothing links to them (`files4` loads a `lessontrak.js` that does not exist). |
| `data/dispatch-match.js` | 1 | The retired Dispatch matching engine (`window.DispatchMatch`). No page loads it or `dispatch.js`; the retired stubs contain no scripts. |
| `images/resources/_masters/` | 14 + 1 new | 900px masters that only `tools/generate_thumbnail.py` writes ("kept for re-export, not referenced by any page"). The 480px thumbnails in `images/resources/` stay public. |

All files remain on disk; only publication changes. **Left alone (owner's decision):** 7 thumbnails of the archived activities in
`images/resources/` (`backstory-objects.png` and six more, referenced only by the archived data), and the retired root files
(`browse.*`, `dispatch*.{html,css,js}`, `style.css`, `tool.css`, `about-nav.css`, `main.js`, `components/`, `resources/resources.css`),
which `PROJECT_NOTES.md` says were deliberately left in place. Root `style.css`, `main.js`, `tool.css` and `about-nav.css` were loaded
only by the pages now excluded (`files3/`, `files4/`, `_archived-activities/`) and by local `tools/` templates, so nothing on the
published site loads them any more; they remain published and are another candidate for a later clean-up.

## Files

| File | What it is |
|---|---|
| `tools/payhip-drafts/paid-resources.json` | Source of truth for the catalogue page: page status plus one entry per paid resource. |
| `tools/build-paid-resources.js` | Builds `paid-resources/index.html` from that file. `--check` changes nothing. |
| `paid-resources/` | Generated page, stylesheet (`paid-resources.css`) and cover image. Must hold exactly the page, the stylesheet and one cover per product (a test checks). |
| `data/resources/<id>.json` + `data/manifest.json` | The directory entry. A separate source: keep price, level, time and URL in step by hand (a test checks they agree). |
| `images/resources/<id>.png` | 480x480 directory thumbnail made with `tools/generate_thumbnail.py` (do not hand-edit). |
| `tools/build-static.js` | Regenerates the homepage no-JavaScript list and `sitemap.xml` (the sitemap list of pages is hard-coded in it). |
| `data/paid-resources.test.js` | Tests for all of the above, including the `.assetsignore` safeguards (Git engine; see above). |

## Outstanding actions for the owner (none has been done)

1. **Publish the Payhip store About text** (Payhip dashboard: Store, Store Builder, Publish).
2. **Change the product from Unlisted to Visible** in Payhip (product edit page, Visibility).
3. **Review the VAT arrangements** before launch. What Payhip's help center says (article "Digital EU VAT & UK VAT", last updated
   9 July 2026; this is documentation, not tax advice): by default Payhip handles digital UK and EU VAT automatically (Settings, Taxes
   tab; the first two checkboxes turn it off); VAT can be added **on top of** the price or **included in** it; customers outside the EU
   and UK pay the plain price. Today's checkout adds it on top ($1.99 + $0.42 = $2.41 for an EU visitor), which is what the
   site's note "Tax, such as EU VAT, may be added at checkout" says. If you switch to "included", change that note. The article does not
   say who remits the VAT or what happens for business customers with a VAT number, so ask Payhip support or an accountant. The
   product's Advanced options also have "This product is tax exempt in EU/UK" and "Product is an ebook" (both currently unticked).
4. **Explicitly approve** committing, pushing and deploying the website. The `.assetsignore` change is already made locally but is uncommitted.
5. Do the read-only Cloudflare check below, and decide whether previews should be restricted before anything is pushed.
6. The owner's own checks, outside this repository: Payhip's and TPT's platform rules for the resource.

## Checking Cloudflare without building or deploying anything (read only)

In the Cloudflare dashboard: Workers & Pages, then the `freerangetutors` Worker. Do not press Save, Retry, Deploy or Rollback anywhere.

1. **Settings, Build, Branch control:** note the production branch (expected `main`) and whether **Enable Preview Builds** is ticked.
2. **Settings, Build:** read the Build command, Deploy command (default `npx wrangler deploy`), Preview command (default
   `npx wrangler preview`; older setups used `npx wrangler versions upload`) and **Root directory** (blank or `/`, so the asset directory is the repo root).
3. **Settings, Domains & Routes:** note whether `workers.dev` and **Version URLs** are Enabled (then previews are public) and whether a
   Cloudflare Access policy protects them.
4. **Deployments / Build history:** open the failed 12 Oct build `8b5964e4-152f-4963-afca-f3294da238c9` and read its log (does it say
   "Missing entry-point to Worker script or to assets directory"?), and the 11 Oct test build. Read only.

If the owner wants no public previews of unfinished work, unticking Enable Preview Builds or disabling Version URLs are dashboard
changes for the owner to make deliberately; this repository cannot do it.

## Go-live checklist, in order

1. Items 1 to 3 above, in Payhip.
2. The read-only Cloudflare check above; decide about previews.
3. Open `https://payhip.com/b/cFa7v` in a private window again and confirm it still shows the product and a Buy button. If the product
   is ever set back to **Invisible**, that link stops working (visitors are sent to the store page): set the product's `status` to
   `"draft"` in `paid-resources.json`, rebuild, and remove the directory entry until it is fixed.
4. Once the product is Visible and the store text is published, `page.store_url` may be set to `https://payhip.com/FreeRangeTutors`.
5. Run `node tools/build-paid-resources.js --check`, `node tools/build-static.js --check`, `node tools/build-shop.js --check` (this one
   only exists in the working copy; the prototype is not committed) and all three test files. Check `git diff -- .assetsignore` still
   shows only the 13 added lines (the prototype protection and the legacy-path exclusions) and no removed ones.
6. Update the `blockers` list in `data/paid-resources.test.js` to match reality (it is hard-coded text, so
   `GO_LIVE=1 node data/paid-resources.test.js` fails until that list is edited; it never deploys anything).
7. With permission: stage **named files only** (never `git add -A`; leave the prototype, `PROJECT_NOTES.md` and `data/site.test.js`
   alone unless the owner says otherwise), commit, push. Expect a Cloudflare build and a public preview of that branch; open the
   preview and confirm the catalogue page, nav links, directory card, and that `PROJECT_NOTES.md`, `tools/` and `.git/config` return 404.
8. With permission: merge to `main` (the production build), then re-check the live pages, the same 404s, and that `/shop/` and
   `/data/products.json` are 404.

## Add or change a product

1. Put a square cover in `paid-resources/images/` and make the 480x480 directory thumbnail with `tools/generate_thumbnail.py`.
   (If you add a cover, update `PAID_IDS`/`VERIFIED` in `data/paid-resources.test.js` deliberately: the folder test lists every expected file.)
2. Add an entry to `paid-resources.json` (copy The Exploding Pudding) and a `data/resources/<id>.json` entry plus its manifest id.
   Write only facts you have checked against the real file.
3. Keep `status: "draft"` until the product is Unlisted or Visible in Payhip AND its link has been opened in a private window and shows
   a Buy button; then set `status: "live"` and `link_verified` to that day's date. The builder refuses to build otherwise.
4. Add the new id to `REVIEWED_PAID_IDS` in `data/directory.test.js` and `data/paid-resources.test.js` (deliberate, owner-approved).
5. Run `node tools/build-paid-resources.js`, `node tools/build-static.js`, then the three test files.
