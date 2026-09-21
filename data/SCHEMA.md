# Resource schema — Free Range Tutors / The Dispatch

**Revision 2 (semantic/taxonomy migration).** Replaces the original ESL-library-shaped
schema (`pathways`, bare-array audience fields, a 14-value `resource_type`) with a
model built for FRT's actual mission: a utility and discovery hub for any teacher
teaching English online, to any learner age and level — app/tool-first, not
worksheet-first. See the Product Decisions document for the full reasoning; this
file states the resulting shapes.

One JSON file per resource, in `data/resources/<id>.json`. The `<id>` is the
filename (no extension) and doubles as the resource's slug.

Adding a resource is exactly two steps:

1. Drop an image at `images/resources/<id>.jpg` (or `.png`/`.webp`) — or skip
   this step entirely if there's no image; the card renders without one.
2. Create `data/resources/<id>.json` with the fields below.

Nothing else needs to change. Dispatch and Toolkit both read this folder at
load time — no page is hand-edited to "add" a resource anywhere.

## The four-state semantic model

`age_group`, `cefr_level`, and `group_fit` are no longer bare arrays. Each is
an object with a `mode`, because an *empty* array was ambiguous — it could
mean "works for absolutely anyone" or "this dimension doesn't apply to this
kind of thing at all," and the matching engine had no way to tell those apart
(this was a real bug: FRT's own tools scored as a perfect match for every
audience query, purely because their audience arrays were empty).

Four modes, and every resource must pick one per field:

| Mode | Shape | Meaning | Example |
|---|---|---|---|
| `universal` | `{ "mode": "universal" }` | Explicitly asserted: this genuinely works for anyone on this dimension. A deliberate claim, not a default. | A whiteboard's `age_group` — genuinely any age can use one. |
| `specific` | `{ "mode": "specific", "values": [...] }` | Restricted to the listed values. | A B2 roleplay's `cefr_level` — `{ "mode": "specific", "values": ["B2"] }`. |
| `unknown` | `{ "mode": "unknown" }` | Not yet determined. A real gap in the data, never guessed to fill the field. | A newly added resource whose real audience fit hasn't been assessed yet. |
| `not_applicable` | `{ "mode": "not_applicable" }` | The dimension has no meaning for this kind of resource — not "any audience," just not a property this thing has. | A lesson-logging tool's `cefr_level` — a logging tool doesn't have a level, the way a screwdriver doesn't have a color-blindness rating. |

**`unknown` and `not_applicable` are never treated as `universal`.** See "How
the matching engine treats each mode" below — this is the entire point of the
migration.

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must match the filename. Slug: lowercase, hyphens. |
| `name` | string | yes | Resource title. No length limit. |
| `url` | string | yes | Destination. External link, or an internal path for FRT originals. |
| `image` | string \| null | no | Path under `images/resources/`. `null`/omitted = no image. |
| `description_short` | string | yes | One or two sentences. What it is, not marketing copy. |
| `teacher_note` | string \| null | no | Optional but encouraged. First-person, specific, honest — including criticism where warranted. |
| `source_category` | enum | yes | `"own_original"` \| `"curated_external"` \| `"commercial"`. Unchanged. |
| `creator` | string | yes | `"Free Range Tutors"`, `"GapTheMind"`, or the external creator/site name. |
| `domain` | string \| null | conditional | Required when `source_category` is `curated_external` or `commercial`. |
| `resource_type` | enum | yes | **New 8-value set — what the thing IS.** See below. |
| `card_style` | enum | yes | `"activity"` \| `"collection"`. Unchanged — still the mechanism for a broad platform that can't honestly be given one duration/level. |
| `age_group` | semantic set | yes | Four-state object over `["young_learner","teen","adult"]`. |
| `cefr_level` | semantic set | yes | Four-state object over `["A1","A2","B1","B2","C1"]`. |
| `group_fit` | semantic set | yes | Four-state object over `["individual","pair","group"]`. |
| `skills` | array of string | no | Secondary, open-ended tag — `speaking`, `vocab`, `grammar`, `listening`, `writing`, `play`, etc. Meaningful mainly when `intent` includes `teach`. Not a controlled enum; can grow freely, unlike `intent`. |
| `activity_time_minutes` | number \| null | conditional | `null` when `card_style` is `collection`, or the resource is genuinely not time-boxed (a tool, a reference sheet). |
| `duration_alt_minutes` | number \| null | no | An honest secondary duration. |
| `duration_alt_note` | string \| null | no | Short clause explaining the alt duration. |
| `prep_level` | enum | yes | `"none"` \| `"light"` \| `"moderate"` \| `"varies"`. Unchanged. |
| `setting` | enum | no | `"online"` \| `"classroom"` \| `"either"`. Defaults to `"either"`. |
| `cost` | enum | yes | `"free"` \| `"freemium"` \| `"paid"`. Unchanged. |
| `intent` | array of enum | yes | **New — what the teacher wants to DO with it.** Subset of `["teach","find_tool","homework","manage"]`, **multi-valued where genuinely justified** (see below). Replaces `pathways`. |
| `tool_kind` | enum \| null | no | Only meaningful when `intent` includes `find_tool` or `manage`. Subset of `["live_lesson","planning","tracking","ai"]` — drives the Find-a-Tool flow's filter. `null` when `intent` doesn't include either. |
| `ai_powered` | boolean | no | Defaults to `false`. A property a tool/platform/media item can have — not a `resource_type` or `intent` value. |
| `gtmk_relationship` | string \| null | no | Only for GapTheMind resources. |
| `status` | enum \| null | no | `"live"` \| `"beta"` \| `"experimental"`. FRT-original tools only. |
| `featured` | boolean | no | Defaults to `false`. |
| `date_added` | string | yes | `YYYY-MM-DD`. |
| `date_updated` | string \| null | no | `YYYY-MM-DD`. |
| `internal_notes` | string \| null | no | Never rendered anywhere. |

## `resource_type` — the new 8 values

What the thing **is**, independent of who made it or why a teacher wants it
(that's `intent`, below). Down from the old 14-value list — several old values
collapsed because they distinguished *format* where *format* wasn't the
distinction that mattered:

| Value | Covers | Replaces |
|---|---|---|
| `tool` | A working app/utility for a task | — |
| `platform` | A broad site/service with many features, not one time-boxed thing | old `external_site`; pairs with `card_style: "collection"` |
| `activity` | A single teaching activity, digital or not | old `roleplay`, old `activity`, most of old `task_cards` |
| `game` | Unchanged | — |
| `lesson` | A structured, more complete unit than a single activity | old `system` (where it meant a live-teaching technique, not a handout) |
| `printable` | Format-defined: printed/handout material | old `worksheet`, `pdf_pack`, `printable`, `reference` |
| `media` | A passive audio/video piece | old `video`, `listening` (skill is carried by `skills`, not the type) |
| `article` | Read online, not printed or used live in a lesson | — |

Distinctions that do **not** get their own `resource_type` value, because a
different field already represents them without duplicating one:

- **FRT-original vs. external app vs. external website** → `source_category`.
- **AI-powered** → the `ai_powered` boolean. A property a tool can have, not a
  different kind of thing.
- **Student-facing vs. teacher-facing** → `intent` (`homework` vs. the other
  three).
- **Interactive vs. static** → already implied by `setting: "online"`.

## `intent` — what the teacher wants to DO with it

Closed, small, **multi-valued where a resource genuinely serves more than one
teacher job** — do not force an artificial single value if that would
misrepresent what the resource does, and do not add values here to solve a
case that composition already covers.

| Value | Teacher's job |
|---|---|
| `teach` | A time-boxed classroom activity, used live with students |
| `find_tool` | Live-lesson technology used *during* a session (whiteboard, screen-share platform, timer) |
| `homework` | Something the student uses alone, outside the lesson |
| `manage` | Admin, planning, tracking — not classroom-facing |

Example of genuine multi-valuedness: a resource built to be both a classroom
activity and something a teacher can assign afterward for independent
practice is `"intent": ["teach", "homework"]` — two real jobs, not one
job described two ways. A resource that's *only* ever used one way keeps a
single-item array, e.g. `"intent": ["manage"]`.

`skills` (open-ended: `speaking`, `vocab`, `grammar`, `listening`, `writing`,
`play`, …) remains the secondary tag layer, meaningful mainly within
`intent: teach`. `tool_kind` is the filter layer, meaningful mainly within
`find_tool`/`manage`. Three dimensions, three different jobs — never
collapsed back into one flat list, which is what broke the old `pathways`
field when "find a tool" and "manage students" had nowhere to live in it.

## How the matching engine treats each mode

| Mode | Hard filter | Soft score |
|---|---|---|
| `universal` | Never excludes | 0 penalty — a genuine, deliberate perfect fit |
| `specific` | Excludes if the query value isn't in `values` | 0 if included, distance-scaled otherwise |
| `unknown` | Never hard-excludes | Fixed moderate penalty — high enough to never outrank a genuine `universal` or matching `specific` result; only ever surfaces as a flagged nearest-fit, never presented as an exact match |
| `not_applicable` | Never excludes | Not scored at all — the dimension is removed from that resource's total, the same way level scoring is already skipped for a resource with no CEFR relevance |

## Collection cards

Unchanged in mechanism, now paired with `resource_type: "platform"` rather
than `external_site`. A broad external site/archive that can't honestly be
given one duration/level sets `card_style: "collection"` — the renderer
shows `varies` instead of a fabricated value, and Dispatch's automatic
matching excludes `collection` entries entirely (they can still appear in
Toolkit/browse contexts).

## The pathway/Dispatch mixing rule

Unchanged: `source_category: "commercial"` is capped at no more than one in
three results in any single Dispatch resolution, enforced by the query.

## Non-goals

Still a flat-file data layer, not a CMS: no admin UI, no database, no
draft/publish workflow.
