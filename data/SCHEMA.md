# Resource schema — Free Range Tutors / The Dispatch

One JSON file per resource, in `data/resources/<id>.json`. The `<id>` is the
filename (no extension) and doubles as the resource's slug.

Adding a resource is exactly two steps:

1. Drop an image at `images/resources/<id>.jpg` (or `.png`/`.webp`) — or skip
   this step entirely if there's no image; the card renders without one.
2. Create `data/resources/<id>.json` with the fields below.

Nothing else needs to change. The homepage tiles, `/browse`, and Dispatch all
read this folder at build/load time — no page is hand-edited to "add" a
resource anywhere.

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must match the filename. Slug: lowercase, hyphens. |
| `name` | string | yes | Resource title. No length limit — the card handles long titles (tested in the stress test). |
| `url` | string | yes | Destination. External link, or an internal path for FRT originals (`/tools/lessontrak/`). |
| `image` | string \| null | no | Path under `images/resources/`. `null` or omitted = no image; the card lays out without one. |
| `description_short` | string | yes | One or two sentences. What it is, not marketing copy. |
| `teacher_note` | string \| null | no | Optional but strongly encouraged. First-person, specific, honest — including criticism where warranted (see `islcollective` example). Never filled with a generic placeholder just to have one. |
| `source_category` | enum | yes | `"own_original"` \| `"curated_external"` \| `"commercial"`. Drives brand treatment and the Dispatch mixing cap (see below). |
| `creator` | string | yes | `"Free Range Tutors"`, `"GapTheMind"`, or the external creator/site name. |
| `domain` | string \| null | no | Required when `source_category` is `curated_external` or `commercial` — shown as the small attribution chip (`↗ islcollective.com`). Omit for `own_original`. |
| `resource_type` | string | yes | Free text, but keep to a short controlled vocabulary as it grows: `worksheet`, `pdf_pack`, `web_app`, `game`, `video`, `listening`, `printable`, `system`, `reference`, `task_cards`, `roleplay`, `activity`, `article`, `external_site`. |
| `card_style` | enum | yes | `"activity"` (the default — a single, roughly time-boxed thing) or `"collection"` (a broad external site/archive that can't honestly be given one duration/level — see "Collection cards" below). |
| `age_group` | array of string | yes | Subset of `["young_learner","teen","adult"]`. Multiple values = genuinely suits both, not "unsure so list everything." |
| `cefr_level` | array of string | yes | Subset of `["A1","A2","B1","B2","C1"]`. `[]` only when level genuinely doesn't apply (e.g. a lesson-logging tool). A card with a *contiguous* range renders it collapsed (`B1–B2`), not as separate badges. |
| `skills` | array of string | no | e.g. `["speaking"]`, `["vocab"]`, `["grammar"]`, `["listening"]`. Used for pathway matching. |
| `activity_time_minutes` | number \| null | conditional | Required unless `card_style` is `"collection"` or the resource is genuinely not time-boxed (e.g. a reference sheet, a tracking template, a plain web app) — then `null`, and the card shows a plain-ink dash, never a fabricated number. |
| `duration_alt_minutes` | number \| null | no | An honest secondary duration (e.g. the 45-min pack that also works as a 10-min filler). Rendered alongside the primary figure, never as a second card. |
| `duration_alt_note` | string \| null | no | Short clause explaining the alt duration, e.g. `"first 10 min alone"`. |
| `prep_level` | enum | yes | `"none"` \| `"light"` \| `"moderate"` \| `"varies"`. `"varies"` is for `collection` cards only. |
| `group_fit` | array of string | no | Subset of `["individual","pair","group"]`. Omit = assume general classroom use; only set when a resource is specifically built for or restricted to one configuration (e.g. a 1:1 roleplay). |
| `setting` | enum | no | `"online"` \| `"classroom"` \| `"either"`. Defaults to `"either"` if omitted. |
| `cost` | enum | yes | `"free"` \| `"freemium"` \| `"paid"`. |
| `pathways` | array of string | yes | Explicit, author-controlled subset of the seven homepage tiles: `["talking","play","vocab","grammar","listen_watch","emergency","tools"]`. Not auto-derived from `skills` — curation judgment stays with the author, per the original brief. `[]` is valid (browse-only, no pathway promotion). |
| `gtmk_relationship` | string \| null | no | Only for GapTheMind resources — e.g. `"own_product"`. Drives the GapTheMind attribution chip instead of a domain chip. |
| `status` | enum \| null | no | `"live"` \| `"beta"` \| `"experimental"`. FRT-original tools only; omit for everything else. |
| `featured` | boolean | no | Defaults to `false`. Surfaces on the homepage "just added"/featured strip. |
| `date_added` | string | yes | `YYYY-MM-DD`. |
| `date_updated` | string \| null | no | `YYYY-MM-DD`, only when meaningfully revised. |
| `internal_notes` | string \| null | no | Never rendered anywhere on the site. Author's own scratch notes only. |

## Collection cards

Some entries — `iSLCollective`, in the stress test — are a whole external
site or archive, not one time-boxed activity. Forcing a single duration/level
onto those is the "stretched precision" the brief explicitly warned against.

Set `card_style: "collection"` for these. The renderer then:

- shows `varies` in the TIME and PREP metadata cells instead of a number,
  in plain ink rather than a signal colour (a signal colour on a fabricated
  value would be a lie the colour system can't afford — see the Dispatch
  brief's colour-binding rule)
- still shows `cefr_level` normally if a genuine range applies (iSLCollective
  really does span A1–C1), or `varies` if not
- is excluded from Dispatch's automatic matching entirely — a `collection`
  card can still appear on `/browse` and inside a pathway page, but Dispatch
  by definition needs a single resolvable time/level pair, so collection
  entries are out of scope for it, not stretched to fit it

## The pathway/Dispatch mixing rule

`source_category: "commercial"` (GapTheMind today) is capped at no more
than one in three results in any single Dispatch resolution or pathway
strip, enforced by the query, not by hoping the catalogue stays balanced.
This is the mechanism, named in the original brief, that keeps GapTheMind
from dominating a result set even when it's a genuinely strong match.

## Non-goals

This is a flat-file data layer, not a CMS: no admin UI, no database, no
draft/publish workflow. If that's ever needed later, it's a new decision —
not an assumption baked in now.
