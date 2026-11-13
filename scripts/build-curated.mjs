// Builds the feed's verse cards from the curated reference list.
//
//   data/topic-verses.json   { topicId: ["John 3:16", ...] }   (references only)
//   public/data/kjv.json     the verified KJV text
//
// writes
//   src/data/curated.json    [{ b, c, v, t: [topicIds], text }]  sorted by b, c, v
//   data/curated-review.md   every card grouped by topic, for a human to skim
//
// Verse text is never typed by hand: it is always looked up in kjv.json here.
// Usage: node scripts/build-curated.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
  'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy',
  '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John',
  '3 John', 'Jude', 'Revelation',
];

const TOPICS = [
  ['finances', 'Finances'], ['health', 'Health & Healing'], ['relationships', 'Relationships'],
  ['family', 'Marriage & Family'], ['forgiveness', 'Forgiveness'], ['grace', 'Grace'], ['love', 'Love'],
  ['fear', 'Fear'], ['anxiety', 'Anxiety & Worry'], ['career', 'Career & Work'], ['faith', 'Faith'],
  ['hope', 'Hope'], ['peace', 'Peace'], ['strength', 'Strength'], ['wisdom', 'Wisdom & Guidance'],
  ['gratitude', 'Gratitude'], ['grief', 'Grief & Comfort'], ['purpose', 'Purpose'], ['patience', 'Patience'],
  ['temptation', 'Temptation'], ['loneliness', 'Loneliness'], ['prayer', 'Prayer'], ['joy', 'Joy'],
  ['salvation', 'Salvation'],
];

const MIN_PER_TOPIC = 18;
const MAX_PER_TOPIC = 24;
const MAX_TOPICS_PER_VERSE = 3;
const WARN_WORDS = 75;

const kjv = JSON.parse(fs.readFileSync(path.join(root, 'public/data/kjv.json'), 'utf8')).books;
const topicVerses = JSON.parse(fs.readFileSync(path.join(root, 'data/topic-verses.json'), 'utf8'));

const errors = [];
const warnings = [];
const topicOrder = new Map(TOPICS.map(([id], i) => [id, i]));
const bookIndex = new Map(BOOKS.map((name, i) => [name, i]));

// Display text: the verified KJV wording without the paragraph mark and without
// the [ ] markers around translator-supplied words (the words themselves stay).
const displayText = (raw) => raw.replace(/^¶/, '').replace(/[\[\]]/g, '');

function resolve(ref, topic) {
  const m = typeof ref === 'string' && ref.match(/^(.+) (\d+):(\d+)$/);
  if (!m) { errors.push(`${topic}: cannot parse reference ${JSON.stringify(ref)} (expected "Book C:V")`); return null; }
  const b = bookIndex.get(m[1]);
  if (b === undefined) { errors.push(`${topic}: unknown book in "${ref}"`); return null; }
  const c = Number(m[2]), v = Number(m[3]);
  const raw = kjv[b]?.[c - 1]?.[v - 1];
  if (typeof raw !== 'string') { errors.push(`${topic}: "${ref}" does not exist in kjv.json`); return null; }
  return { b: b + 1, c, v, text: displayText(raw) };
}

for (const id of Object.keys(topicVerses)) {
  if (!topicOrder.has(id)) errors.push(`unknown topic id "${id}"`);
}

const cards = new Map();      // "b:c:v" -> card
const byTopic = new Map();    // topicId -> [card]
for (const [id] of TOPICS) {
  const refs = topicVerses[id];
  if (!Array.isArray(refs)) { errors.push(`${id}: topic is missing from data/topic-verses.json`); continue; }
  const seen = new Set();
  const list = [];
  for (const ref of refs) {
    const r = resolve(ref, id);
    if (!r) continue;
    const key = `${r.b}:${r.c}:${r.v}`;
    if (seen.has(key)) { errors.push(`${id}: duplicate reference "${ref}"`); continue; }
    seen.add(key);
    let card = cards.get(key);
    if (!card) { card = { b: r.b, c: r.c, v: r.v, t: [], text: r.text }; cards.set(key, card); }
    card.t.push(id);
    list.push(card);
    const words = r.text.split(/\s+/).length;
    if (words > WARN_WORDS) warnings.push(`${id}: "${ref}" is ${words} words (longer than ${WARN_WORDS})`);
  }
  byTopic.set(id, list);
  if (list.length < MIN_PER_TOPIC) errors.push(`${id}: only ${list.length} verses (minimum ${MIN_PER_TOPIC})`);
  if (list.length > MAX_PER_TOPIC) errors.push(`${id}: ${list.length} verses (maximum ${MAX_PER_TOPIC})`);
}

const refOf = (card) => `${BOOKS[card.b - 1]} ${card.c}:${card.v}`;
for (const card of cards.values()) {
  if (card.t.length > MAX_TOPICS_PER_VERSE)
    errors.push(`"${refOf(card)}" is tagged with ${card.t.length} topics (${card.t.join(', ')}); maximum ${MAX_TOPICS_PER_VERSE}`);
  card.t.sort((x, y) => topicOrder.get(x) - topicOrder.get(y));
}

if (errors.length) {
  for (const e of errors) console.error('ERROR: ' + e);
  console.error(`\nbuild-curated failed with ${errors.length} error(s); nothing written.`);
  process.exit(1);
}

const sorted = [...cards.values()].sort((x, y) => x.b - y.b || x.c - y.c || x.v - y.v);

fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'src/data/curated.json'),
  '[\n' + sorted.map((c) => JSON.stringify(c)).join(',\n') + '\n]\n',
);

const md = [
  '# Curated verses by topic',
  '',
  `${sorted.length} distinct verses across ${TOPICS.length} topics. All text is the King James Version, ` +
    'looked up from the verified Bible file by reference (never typed by hand). ' +
    'A verse can appear under up to three topics.',
  '',
];
for (const [id, label] of TOPICS) {
  const list = byTopic.get(id);
  md.push(`## ${label} (${list.length})`, '');
  for (const card of list) md.push(`- **${refOf(card)}** — ${card.text}`);
  md.push('');
}
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/curated-review.md'), md.join('\n'));

for (const [id, label] of TOPICS) console.log(`${label.padEnd(20)} ${String(byTopic.get(id).length).padStart(3)}`);
const multi = sorted.filter((c) => c.t.length > 1).length;
console.log(`\ntotal distinct verses: ${sorted.length}  (${multi} appear under more than one topic)`);
for (const w of warnings) console.warn('WARNING: ' + w);
console.log('wrote src/data/curated.json and data/curated-review.md');
