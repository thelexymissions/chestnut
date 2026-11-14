// Builds the words shown with the cross and the name Jesus (src/data/cross.json) from the
// references in data/cross-verses.json. As everywhere else, the words come only from the
// verified Bible text; a reference that does not exist stops the build.
//
//   "opening": the opening moment and the welcome screen
//   "home":    the card at the top of Home
//
// Each is one verse ("Romans 8:1") or a run of verses in one chapter ("Romans 8:1-2").
//
// Usage: node scripts/build-centre.mjs [--show]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const books = JSON.parse(fs.readFileSync(path.join(root, 'public/data/kjv.json'), 'utf8')).books;
const wanted = JSON.parse(fs.readFileSync(path.join(root, 'data/cross-verses.json'), 'utf8'));
const NAMES = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];

const errors = [];
/** `parts` keeps the verses apart so each can be set as its own lines; `text` is the passage read straight through. */
function passage(place) {
  const ref = wanted[place];
  const m = String(ref ?? '').match(/^(.*) (\d+):(\d+)(?:-(\d+))?$/);
  const b = m ? NAMES.indexOf(m[1]) : -1;
  if (!m || b < 0) { errors.push(`${place}: "${ref}" is not a reference`); return undefined; }
  const c = Number(m[2]), v = Number(m[3]), to = Number(m[4] ?? m[3]);
  if (to < v) errors.push(`${place}: "${ref}" runs backwards`);
  const parts = [];
  for (let n = v; n <= to; n++) {
    const raw = books[b]?.[c - 1]?.[n - 1];
    if (raw === undefined) errors.push(`${place}: ${m[1]} ${c}:${n} is not in the Bible`);
    else parts.push(raw.replace(/^¶/, '').replace(/[\[\]]/g, '').trim());
  }
  return { b: b + 1, c, v, to, parts, text: parts.join(' ') };
}

const out = { opening: passage('opening'), home: passage('home') };
if (errors.length) { console.error(errors.map((e) => 'FAIL: ' + e).join('\n')); process.exit(1); }
fs.writeFileSync(path.join(root, 'src/data/cross.json'), JSON.stringify(out, null, 1));
const words = (p) => p.text.split(/\s+/).length;
console.log(`cross verses: opening ${wanted.opening} (${words(out.opening)} words), home ${wanted.home} (${words(out.home)} words)`);
if (process.argv.includes('--show')) for (const k of ['opening', 'home']) console.log(`${k}: ${out[k].parts.join('\n         ')}`);
