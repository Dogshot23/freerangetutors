'use strict';
/* The ONE approved set of changes to directory records that already existed (homepage "Website of the Day", see data/SCHEMA.md),
   shared by data/catalogue.test.js and data/paid-resources.test.js so both apply exactly the same rule. Test helper only: this
   folder (tools/) is not published (.assetsignore).

   Approved: (1) an `image_tags` array on exactly the 20 curated_external records below, with exactly these values;
             (2) a `teacher_note` on exactly the 9 records below that had none (null), with exactly this wording.
   Everything else about every existing record must be identical to its baseline: every other field, nested values, added or
   missing fields, key order and the record's id. Changing an approved value later is detected too (the values are pinned, not
   just format-checked); to change one deliberately, change it here in the same edit. */

const APPROVED_IMAGE_TAGS = {
  "islcollective": ["writing","notebooks","paper","learning","stationery"],
  "wafflebrain": ["speaking","conversation","people"],
  "baamboozle": ["games","play","classroom","school"],
  "learnenglish-teens": ["classroom","learning","school"],
  "voa-learning-english": ["news","newspaper","radio","media"],
  "youglish": ["speaking","audio","video","media","words"],
  "oxford-learners-dictionaries": ["dictionary","books","words","library"],
  "cambridge-dictionary": ["dictionary","books","words","library"],
  "elllo": ["listening","radio","audio","conversation","reading","people"],
  "breaking-news-english": ["news","newspaper","reading","street"],
  "randalls-esl-cyber-listening-lab": ["listening","radio","audio","learning"],
  "games-to-learn-english": ["games","play","puzzle","words"],
  "digital-dialects": ["food","everyday","vocabulary","animals"],
  "seterra": ["maps","geography","world"],
  "wordwall": ["games","classroom","play","school"],
  "freerice": ["food","everyday","world","games"],
  "bbc-learning-english": ["video","media","listening","words","people"],
  "englishclub-esl-games": ["games","play","puzzle","words"],
  "google-arts-culture": ["art","museum","culture"],
  "gapminder": ["world","everyday","food","maps"]
};

const APPROVED_TEACHER_NOTES = {
  "wafflebrain": "Put it on a shared screen, pick the level and situation that suit your student, and press space for a prompt. Let them talk for a minute before you correct anything.",
  "baamboozle": "Share one screen, split the class into teams and play a ready-made quiz. Students do not need devices of their own.",
  "learnenglish-teens": "Pick a skill and level for your teenage student and set a task from it as homework, then use the lesson to talk about what they found hard.",
  "voa-learning-english": "Play a short item once without the transcript and ask what they caught, then use the transcript and vocabulary support to check the details.",
  "oxford-learners-dictionaries": "Look a word up together, listen to the British and American audio and read the example sentences. A topic word list can then become a vocabulary set.",
  "cambridge-dictionary": "Check a word in the Learner's Dictionary at B1–B2 level, play both accents, and have the student write their own sentence from the examples.",
  "randalls-esl-cyber-listening-lab": "Choose the Easy, Intermediate or Difficult tier to match your student, play the audio, then do the comprehension quiz and discuss the answers aloud.",
  "digital-dialects": "For a beginner, pick a topic such as food or jobs and play the picture game together. Ask the student to say each word before they click.",
  "englishclub-esl-games": "Choose a game that matches the grammar point or word set you just taught and use it as a quick review at the end of the lesson."
};

/* The commit at which these additions were approved. Records that existed then and are not listed above must not have image_tags.
   (Records added after it may carry image_tags freely: it is an optional field for new websites.) */
const APPROVAL_BASE_COMMIT = '1905b275de00e7c16574636a0addc21dbec2b88e';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* Why an image_tags value is malformed, or null if it is fine: an array of 1 to 8 unique lowercase slugs. */
function imageTagsProblem(tags) {
  if (!Array.isArray(tags)) return 'image_tags is not an array';
  if (tags.length < 1 || tags.length > 8) return 'image_tags must have 1 to 8 entries (has ' + tags.length + ')';
  for (let i = 0; i < tags.length; i++) {
    if (typeof tags[i] !== 'string') return 'image_tags[' + i + '] is not a string';
    if (!SLUG.test(tags[i])) return 'image_tags[' + i + '] is not a lowercase slug: ' + JSON.stringify(tags[i]);
  }
  if (new Set(tags).size !== tags.length) return 'image_tags has duplicate entries';
  return null;
}

/* Compare a record with its baseline version. `was` and `now` are parsed JSON objects. Returns null when `now` is the baseline
   plus only the approved additions (or identical to it), otherwise a short reason. */
function approvedRecordProblem(was, now) {
  if (!was || typeof was !== 'object' || !now || typeof now !== 'object' || Array.isArray(was) || Array.isArray(now)) return 'record is not an object';
  const id = was.id;
  if (now.id !== id) return 'record identity changed (id ' + JSON.stringify(id) + ' -> ' + JSON.stringify(now.id) + ')';
  const isApprovedTags = Object.prototype.hasOwnProperty.call(APPROVED_IMAGE_TAGS, id);
  const isApprovedNote = Object.prototype.hasOwnProperty.call(APPROVED_TEACHER_NOTES, id);
  if ('image_tags' in now) {
    const bad = imageTagsProblem(now.image_tags);
    if (bad) return bad;
    if (!isApprovedTags) return 'image_tags is not permitted on this record (' + id + ')';
  }
  if (isApprovedTags && was.source_category !== 'curated_external') return 'approved image_tags are only for curated_external records';
  // Build exactly what the record must look like: the baseline, plus the pinned approved values, in the established key order
  // (image_tags directly after teaching_use).
  const expected = {};
  Object.keys(was).forEach((k) => {
    if (k === 'image_tags') return;
    expected[k] = was[k];
    if (k === 'teaching_use' && isApprovedTags) expected.image_tags = APPROVED_IMAGE_TAGS[id];
  });
  if (isApprovedTags && !('image_tags' in expected)) expected.image_tags = APPROVED_IMAGE_TAGS[id];   // no teaching_use key to anchor to
  if (isApprovedTags && 'image_tags' in was && JSON.stringify(was.image_tags) !== JSON.stringify(APPROVED_IMAGE_TAGS[id])) return 'baseline image_tags differ from the approved values';
  if (isApprovedNote) {
    if (was.teacher_note !== null && was.teacher_note !== APPROVED_TEACHER_NOTES[id]) return 'teacher_note had other text in the baseline and may not be replaced';
    expected.teacher_note = APPROVED_TEACHER_NOTES[id];
  }
  if (JSON.stringify(now) === JSON.stringify(expected)) return null;
  const keys = Array.from(new Set(Object.keys(expected).concat(Object.keys(now))));
  const differing = keys.filter((k) => JSON.stringify(now[k]) !== JSON.stringify(expected[k]));
  if (!differing.length) return 'keys are in a different order or the record was re-ordered';
  return 'changed beyond the approved additions: ' + differing.join(', ');
}

/* True when the record has any approved addition. A record with none must stay byte-identical to its baseline: if git reports it as
   changed at all (even whitespace or formatting), the tests refuse it. Records with approved additions are compared field by field. */
function hasApprovedAdditions(id) {
  return Object.prototype.hasOwnProperty.call(APPROVED_IMAGE_TAGS, id) || Object.prototype.hasOwnProperty.call(APPROVED_TEACHER_NOTES, id);
}

module.exports = { APPROVED_IMAGE_TAGS, APPROVED_TEACHER_NOTES, APPROVAL_BASE_COMMIT, imageTagsProblem, approvedRecordProblem, hasApprovedAdditions };
