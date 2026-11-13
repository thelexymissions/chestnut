// Builds the verses shown with the cross and the name Jesus (src/data/centre.json)
// from the references in data/centre-verses.json. As everywhere else, the words
// come only from the verified Bible text; a reference that does not exist stops the build.
//
// Usage: node scripts/build-centre.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const books = JSON.parse(fs.readFileSync(path.join(root, 'public/data/kjv.json'), 'utf8')).books;
const refs = JSON.parse(fs.readFileSync(path.join(root, 'data/centre-verses.json'), 'utf8'));
const NAMES = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];

const errors = [];
const out = [];
const seen = new Set();
for (const r of refs) {
  const m = String(r).match(/^(.*) (\d+):(\d+)$/);
  const b = m ? NAMES.indexOf(m[1]) : -1;
  const raw = m && b >= 0 ? books[b]?.[m[2] - 1]?.[m[3] - 1] : undefined;
  if (raw === undefined) { errors.push(`"${r}" is not in the Bible`); continue; }
  if (seen.has(r)) { errors.push(`"${r}" is listed twice`); continue; }
  seen.add(r);
  out.push({ b: b + 1, c: Number(m[2]), v: Number(m[3]), text: raw.replace(/^¶/, '').replace(/[\[\]]/g, '') });
}
if (!out.length) errors.push('no verses listed');
if (errors.length) { console.error(errors.map((e) => 'FAIL: ' + e).join('\n')); process.exit(1); }
fs.writeFileSync(path.join(root, 'src/data/centre.json'), JSON.stringify(out, null, 1));
console.log(`centre verses: ${out.length}`);
if (process.argv.includes('--show')) for (const [i, v] of out.entries()) console.log(`${refs[i]} (${v.text.split(/\s+/).length} words): ${v.text}`);
