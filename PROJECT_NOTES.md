# Project notes — Free Range Tutors

Private development notes. Not part of the public site, not linked from
anywhere, not read by any page or script. A place to keep project
information that doesn't belong in the public catalogue schema.

## On the bench (preserved from the retired tools/index.html "On the bench" section)

Carried over as-is during the tools/index.html content migration — real,
dated project information worth keeping, but not public-facing product
content (no working URL, not ready for a teacher to discover and open).
See the Tools Content Migration Map for the reasoning.

### In progress (WIP)

- **Vocabulary Gap-Fill Tool** — Already live in a basic form. Currently
  reworking the mobile layout — the current version breaks on small
  screens. Not updating to v2 until it works well on all devices.
- **Lesson Timing Tool** — A simple session clock with labelled activity
  slots. Set durations for each phase, start the clock, and it tells you
  where you should be. First prototype is rough but usable. Needs proper
  mobile support before it goes on the shelf.

### Ideas (not committed, not scheduled)

- **Error Correction Card Generator** — Type in student errors from a
  lesson, get a printable or digital set of correction prompts. The
  concept is clear — haven't decided yet if this is a web tool or a PDF
  generator.
- **Student Progress Snapshot** — A lightweight one-page summary of where
  a student is — built from a few quick inputs. Not a database, not a
  tracker. Just a snapshot to share with the student or keep for your
  records. Still thinking about the right format.
- **Lesson Pace Checker** — A companion to ZARD — simpler, faster.
  Describe the rough pace of a lesson and get a suggestion for
  redistribution. Might merge this into ZARD instead of making it a
  separate tool.

## Removed placeholder resources (formerly live catalogue entries)

These three were carried into the current resource schema during the tools
migration with real metadata but no actual content behind them — never
built, in any era of the site. Removed from the live catalogue (data/
manifest.json and their data/resources/*.json records deleted) once that
was confirmed. Concepts preserved here in case any of them gets built later;
none is scheduled.

- **Information Gap Files** — Classic ESL information-gap pairs (Student A /
  Student B sheets, communicate to fill in what the other has) rebuilt for
  adult learners, with topics chosen for genuine interest rather than
  textbook blandness. A2–B2, pairs, ~15 min, light prep. Teacher note: "Built
  these because I couldn't find good adult-appropriate ones anywhere."
- **Printable Field Pack 5 — The Neighbourhood** — Self-contained, no-prep
  printable lesson pack on local-area observation, covering a full lesson
  arc (45 min) with a genuinely usable 10-minute subset for filler use. B1–
  B2, pair/group. Teacher note: "Runs long, but the first 10 minutes alone
  hold up as a filler if you're short on time." The "5" in the name implies
  a series (packs 1–4) that was never otherwise referenced or built.
- **Conversation Systems** — Structured facilitation approaches for running
  conversation classes without falling into the question-answer loop —
  guides plus printable prompt sets. B2–C1, group, 40 min, moderate prep.
  Teacher note: "Took me a few years of trial and error to develop these.
  Still evolving." Of the three, this one reads as the least finished at
  the source — the practice itself, not just the write-up, was still being
  developed.

## Historical/retired placeholder resources (from the legacy resources.html catalogue)

Found during the legacy-page retirement audit (2026-09-23), in the
pre-Dispatch baseline `resources.html` / `resources/index.html` (identical
duplicate pages, both retired). All seven "Download →" links pointed to
`/resources/*` routes that return 404, and `pdfs/` (the directory implied by
each card's "worksheet · PDF" label) is empty — never built, same as the
three above, just not yet transcribed into this file before the legacy
pages were removed. Preserved here for the same reason: no working URL, not
scheduled to be built, kept in case a concept is worth reviving later.

- **Past Simple Gap-Fill** — Controlled practice for past simple regular and
  irregular verbs, using context sentences with enough substance that
  students have something to think about while they drill. A2, 2 pages.
- **Present Perfect Worksheet** — Focuses on the "relevance now" function of
  the present perfect — the aspect that consistently confuses B1 students
  and tends to get bypassed in standard coursebook treatment. B1, 3 pages.
- **Phrasal Verbs: Movement & Direction** — One focused group of movement
  and direction phrasal verbs — organised semantically, with gap-fill
  practice and a short writing task to help consolidate the set. B1–B2,
  2 pages.
- **Job Interview Role-Play** — A structured role-play pack for job
  interviews using real question types rather than textbook ones. Includes
  separate interviewer and candidate role cards. B2, 1 pack.
- **Error Correction Drill Sheet** — Twenty common B1–B2 written errors for
  students to identify and correct — covering article use, word order, verb
  forms, and prepositions, the usual suspects. B1–B2, 20 sentences.
- **Conditionals Reference & Practice** — Two separate pages: a single
  reference sheet covering all main conditional forms with example
  sentences, plus a practice exercise page that students can use
  independently. B1–B2, 2 pages.
- **Reading Strategies Pocket Guide** — A single-page guide to approaching
  unfamiliar texts — skimming, scanning, inferring from context — designed
  to be kept by students as a reference they actually reach for. B1+, 1 page.

## Retired placeholder tools (from tools/lessontrak, tools/report-writer, tools/zard, tools/lesson-plan-viewer)

These four are RETIRED / DELETED — not current products, not functioning
site tools. Each had a real page at `/tools/<id>/` with genuine teacher-
facing guidance and version history, but the interactive area was never
built (placeholder text like "[ ... UI goes here ]" instead of a working
tool), so they were removed from the live site during the link-only
cleanup. Preserved here because the guidance/concept text itself is real
and worth keeping, even though the pages and their obsolete placeholder
UI, shared header/footer scaffolding, and Dispatch-era nav are gone.

- **LessonTrak** — Post-lesson logging tool: a searchable log of what was
  covered, what worked, and what to revisit, meant to replace a notebook
  or spreadsheet. Key guidance: fill it in immediately after the lesson to
  capture what actually happened, not what was planned. Teacher note: "I
  use it on my phone immediately after the lesson ends, before I lose the
  thread. Filling it in the next morning is better than nothing but you
  lose the honest detail." Technical history: plain HTML/CSS/JS,
  localStorage-only, works offline, no external dependencies. Version
  history: initial release Nov 2024 (v1.0), mobile layout rework Jan 2025,
  plain-text export added Mar 2025 — reached v1.4, marked stable.

- **Report Writer** — Generated varied, human-sounding student report
  comments from simple teacher-provided input, to reduce report-season
  writing overhead. Important guidance: always read and review the
  generated output before using it in an actual report — the tool reduces
  writing overhead, not professional judgement. Teacher note: "Works best
  for students you know well enough to give it real input. Vague input
  produces generic output — the tool is only as good as what you feed
  it." Technical note: no server involved, output always needs human
  review. Version history: initial beta Dec 2024, tone-adjustment slider
  added Feb 2025, a comment-repetition bug fixed Apr 2025 — reached v0.8,
  marked beta (never reached a stable release).

- **ZARD (Zone-based Activity and Resource Designer)** — The most
  distinctive original concept of the four: a lesson-planning thinking
  tool, not a lesson-plan generator. The idea was to map a lesson's
  activities to energy zones and read the resulting arc to notice whether
  the pacing builds appropriately, crashes too early, or stays flat
  throughout — used during planning, before the lesson, not during it.
  Teacher use case: most useful for a lesson that previously felt "off" in
  a way the teacher couldn't pinpoint — the act of mapping activities to
  zones could reveal the problem immediately. Status was explicitly
  experimental/provisional throughout: the zone model itself was still
  being refined, and there was no save or export capability at any point.
  Development history: first working prototype Feb 2025, a visual arc view
  added Apr 2025 — reached v0.3, never left "early experiment" status.
  Note: PROJECT_NOTES.md already records a related but distinct idea,
  "Lesson Pace Checker" (see "On the bench" above), described there as "a
  companion to ZARD — simpler, faster." That idea and ZARD itself are not
  the same thing and should not be conflated — ZARD was the actual
  built-and-shipped (if unfinished) tool; Lesson Pace Checker was only ever
  a separate, unbuilt idea that referenced ZARD as a companion.

- **Lesson Plan Viewer** — A clean, distraction-free reading view for
  lesson plans: paste or load a plan before class, save it locally, then
  view it in a calm, scannable layout during the lesson itself, with no
  editing mode or menus to get in the way. Teacher workflow: designed for
  laptop or tablet use during teaching. Teacher note: "Works well on a
  tablet propped at the side of the whiteboard. The text is sized to be
  readable from arm's length without squinting." Technical history:
  localStorage for saved plans, no network required. Version history: a
  major rebuild Oct 2024 (v2.0), tablet layout improved Jan 2025, local
  save added May 2025 — reached v2.1, marked stable. Of the four, this one
  had the most mature version history.
