# Resource schema — Free Range Tutors directory

**Revision 3 (directory-model migration).** Replaces the Dispatch-era schema
(`intent`, `tool_kind`, `card_style`, `skills` scoped to `intent: teach`) with
a model built for FRT's current mission: a simple discovery hub for useful
things for teaching English online — FRT-created resources and external
websites/apps/games/PDFs/generators/tools side by side, browsed via search
and filters, not routed through a decision tree. See the directory
architecture spec for the full reasoning; this file states the resulting
shapes.

One JSON file per resource, in `data/resources/<id>.json`. The `<id>` is the
filename (no extension) and doubles as the resource's slug.

Adding a resource is exactly two steps:

1. Drop an image at `images/resources/<id>.jpg` (or `.png`/`.webp`) — or skip
   this step entirely if there's no image; the card renders without one.
2. Create `data/resources/<id>.json` with the fields below, and add its id
   to `data/manifest.json`.

Nothing else needs to change. The directory homepage (`directory.js`) reads
this folder at load time — no page is hand-edited to "add" a resource
anywhere.

## The four-state semantic model

`age_group`, `cefr_level`, and `group_fit` are objects with a `mode`, because
an *empty* array is ambiguous — it could mean "works for absolutely anyone"
or "this dimension doesn't apply to this kind of thing at all." Unchanged
from the previous revision — this part of the schema was already correct.

| Mode | Shape | Meaning | Example |
|---|---|---|---|
| `universal` | `{ "mode": "universal" }` | Explicitly asserted: this genuinely works for anyone on this dimension. | A whiteboard's `age_group` — genuinely any age can use one. |
| `specific` | `{ "mode": "specific", "values": [...] }` | Restricted to the listed values. | A B2 roleplay's `cefr_level` — `{ "mode": "specific", "values": ["B2"] }`. |
| `unknown` | `{ "mode": "unknown" }` | Not yet determined. A real gap in the data, never guessed to fill the field. | A newly added external resource whose real audience fit hasn't been assessed yet. |
| `not_applicable` | `{ "mode": "not_applicable" }` | The dimension has no meaning for this kind of resource. | An admin tool's `cefr_level` — a lesson logger doesn't have a level. |

**`unknown` and `not_applicable` are never treated as `universal`.**

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must match the filename. Slug: lowercase, hyphens. |
| `name` | string | yes | Resource title. |
| `url` | string | yes | Destination. External link, or an internal path for FRT originals. |
| `image` | string \| null | no | Path under `images/resources/`. `null`/omitted = no image. |
| `description_short` | string | yes | One or two sentences. What it is, not marketing copy. |
| `teacher_note` | string \| null | no | Optional but encouraged. First-person, specific, honest. May be used for curated external resources too, not just FRT originals. |
| `source_category` | enum | yes | `"own_original"` \| `"curated_external"` \| `"commercial"`. |
| `creator` | string | yes | `"Free Range Tutors"`, or the external creator/site name. |
| `domain` | string \| null | conditional | Required when `source_category` is `curated_external` or `commercial`. |
| `resource_type` | enum | yes | **What the thing IS.** See below — 8 directory-model values. |
| `age_group` | semantic set | yes | Four-state object over `["young_learner","teen","adult"]`. |
| `cefr_level` | semantic set | yes | Four-state object over `["A1","A2","B1","B2","C1"]`. |
| `group_fit` | semantic set | no | Four-state object over `["individual","pair","group"]`. Meaningful mainly for FRT-original activities — external tools/websites often leave this `not_applicable` or `unknown`. |
| `teaching_use` | array of string | no | **What the teacher can USE it for.** Open-ended, multi-valued. See below. Empty array is honest for admin tools and unassessed external resources — never guessed to fill it. |
| `activity_time_minutes` | number \| null | conditional | `null` for a tool, website, or genuinely non-time-boxed resource. |
| `duration_alt_minutes` | number \| null | no | An honest secondary duration. |
| `duration_alt_note` | string \| null | no | Short clause explaining the alt duration. |
| `prep_level` | enum | yes | `"none"` \| `"light"` \| `"moderate"` \| `"varies"`. Meaningful mainly for FRT-original activities. |
| `setting` | enum | no | `"online"` \| `"classroom"` \| `"either"`. Defaults to `"either"`. |
| `cost` | enum | yes | `"free"` \| `"freemium"` \| `"paid"`. |
| `ai_powered` | boolean | no | Defaults to `false`. A property a tool/platform/media item can have. |
| `gtmk_relationship` | string \| null | no | FRT-only. Only for GapTheMind resources. |
| `status` | enum \| null | no | `"live"` \| `"beta"` \| `"experimental"`. **FRT-original tools only** — meaningless for an external resource. |
| `featured` | boolean | no | Defaults to `false`. Not currently used by the directory homepage (Phase 1 uses "Recently added" only, computed from `date_added` — see the architecture spec's curation section) — reserved for a possible future lightweight curation pass, not a workflow to maintain now. |
| `date_added` | string | yes | `YYYY-MM-DD`. Drives "Recently added." |
| `date_updated` | string \| null | no | `YYYY-MM-DD`. |
| `internal_notes` | string \| null | no | Never rendered anywhere. |

## `resource_type` — the 8 directory-model values

What the thing **is**, in plain, teacher-facing language:

| Value | Covers |
|---|---|
| `website` | A general external site/archive (replaces the old `platform` value) |
| `app` | An external interactive app/tool a teacher uses in-browser |
| `game` | A game, FRT-original or external |
| `pdf` | A downloadable/printable PDF resource |
| `generator` | A tool that generates content on demand (worksheets, prompts, etc.) |
| `tool` | An FRT-original or external utility/app for a specific task |
| `video` | A video resource |
| `activity` | A single teaching activity, digital or not (FRT-original or external instructions) |

Retired from the previous 8-value set: `platform` (folded into `website`),
`lesson`/`printable`/`media`/`article` (not currently represented in the
live catalogue — `printable`/`media`/`video` map onto `pdf`/`video` above
when that content type is added; `lesson` and `article` fold into
`activity`/`website` case by case, since format wasn't the distinction that
mattered).

## `teaching_use` — what the teacher can USE it for

Open-ended, multi-valued, no longer scoped to any particular resource kind
(the old `skills` field was described as "meaningful mainly when `intent`
includes `teach`" — that scoping is gone; every resource, FRT-original or
external, gets this field). Approved starting vocabulary:

`speaking`, `listening`, `reading`, `writing`, `grammar`, `vocabulary`,
`pronunciation`, `warm-up`, `review`.

**`games` is deliberately not a `teaching_use` value** — a resource being a
game is captured by `resource_type: "game"`. Keeping "games" out of
`teaching_use` avoids the same concept appearing in two filter axes with
different meanings, which would confuse the directory's two-question
filter model ("what is this" vs. "what can I use it for").

An admin tool (LessonTrak, Report Writer, ZARD, Lesson Plan Viewer) honestly
has an empty `teaching_use: []` — it doesn't teach anything, and forcing a
value onto it would misrepresent what it does.

## What was retired, and why

- **`intent`** (`teach`/`find_tool`/`homework`/`manage`) — this was FRT's own
  internal product-job classification, not a question a teacher browsing a
  directory of external and original resources naturally asks. Its job
  (distinguishing FRT's own admin tools from teaching content) is now done
  by combining `source_category: own_original` + `resource_type: tool` —
  no dedicated field needed.
- **`tool_kind`** (`live_lesson`/`planning`/`tracking`/`ai`) — FRT-tool-
  specific taxonomy with no meaning for a third-party resource like
  Wordwall. Retired outright; if a future admin tool genuinely needs a
  descriptive tag, it's just a `teaching_use`-style value, not a separate
  controlled vocabulary.
- **`card_style`** (`activity`/`collection`) — existed only to make the old
  Dispatch scored-matching engine's hard filter behave (excluding "collection"
  cards from a request that needs one resolvable time/level pair). The
  directory model doesn't run a scored-matching engine, so this distinction
  has nowhere left to matter; a broad archive like iSLCollective is already
  handled honestly by `activity_time_minutes: null` rendering as "Varies."

## Non-goals

Still a flat-file data layer, not a CMS: no admin UI, no database, no
draft/publish workflow.
