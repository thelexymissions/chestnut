// Cross-checks three independent public-domain KJV copies verse by verse and
// writes the verified Bible used by the app.
//
// Usage: node scripts/verify-kjv.mjs <dir-with-sources> [--write]
//   sources expected in the directory:
//     thiago.json      github.com/thiagobodruk/bible            (json/en_kjv.json)
//     farskipper.json  github.com/farskipper/kjv                (json/verses-1769.json)
//     scroll.json      github.com/scrollmapper/bible_databases  (formats/json/KJV.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = process.argv[2];
const write = process.argv.includes('--write');
const verbose = process.argv.includes('--verbose');
if (!srcDir) {
  console.error('usage: node scripts/verify-kjv.mjs <dir-with-sources> [--write]');
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (f) =>
  JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8').replace(/^﻿/, ''));

export const BOOKS = [
  ['Genesis', 'Gen', 50], ['Exodus', 'Exod', 40], ['Leviticus', 'Lev', 27], ['Numbers', 'Num', 36],
  ['Deuteronomy', 'Deut', 34], ['Joshua', 'Josh', 24], ['Judges', 'Judg', 21], ['Ruth', 'Ruth', 4],
  ['1 Samuel', '1 Sam', 31], ['2 Samuel', '2 Sam', 24], ['1 Kings', '1 Kgs', 22], ['2 Kings', '2 Kgs', 25],
  ['1 Chronicles', '1 Chr', 29], ['2 Chronicles', '2 Chr', 36], ['Ezra', 'Ezra', 10], ['Nehemiah', 'Neh', 13],
  ['Esther', 'Esth', 10], ['Job', 'Job', 42], ['Psalms', 'Ps', 150], ['Proverbs', 'Prov', 31],
  ['Ecclesiastes', 'Eccl', 12], ['Song of Solomon', 'Song', 8], ['Isaiah', 'Isa', 66], ['Jeremiah', 'Jer', 52],
  ['Lamentations', 'Lam', 5], ['Ezekiel', 'Ezek', 48], ['Daniel', 'Dan', 12], ['Hosea', 'Hos', 14],
  ['Joel', 'Joel', 3], ['Amos', 'Amos', 9], ['Obadiah', 'Obad', 1], ['Jonah', 'Jonah', 4],
  ['Micah', 'Mic', 7], ['Nahum', 'Nah', 3], ['Habakkuk', 'Hab', 3], ['Zephaniah', 'Zeph', 3],
  ['Haggai', 'Hag', 2], ['Zechariah', 'Zech', 14], ['Malachi', 'Mal', 4],
  ['Matthew', 'Matt', 28], ['Mark', 'Mark', 16], ['Luke', 'Luke', 24], ['John', 'John', 21],
  ['Acts', 'Acts', 28], ['Romans', 'Rom', 16], ['1 Corinthians', '1 Cor', 16], ['2 Corinthians', '2 Cor', 13],
  ['Galatians', 'Gal', 6], ['Ephesians', 'Eph', 6], ['Philippians', 'Phil', 4], ['Colossians', 'Col', 4],
  ['1 Thessalonians', '1 Thess', 5], ['2 Thessalonians', '2 Thess', 3], ['1 Timothy', '1 Tim', 6],
  ['2 Timothy', '2 Tim', 4], ['Titus', 'Titus', 3], ['Philemon', 'Phlm', 1], ['Hebrews', 'Heb', 13],
  ['James', 'Jas', 5], ['1 Peter', '1 Pet', 5], ['2 Peter', '2 Pet', 3], ['1 John', '1 John', 5],
  ['2 John', '2 John', 1], ['3 John', '3 John', 1], ['Jude', 'Jude', 1], ['Revelation', 'Rev', 22],
];

// ---- load each source into books[b][c][v] = raw text ----
function loadThiago() {
  return readJson('thiago.json').map((b) => b.chapters.map((c) => c.slice()));
}
function loadFarskipper() {
  const data = readJson('farskipper.json');
  const out = [];
  let lastBook = null;
  for (const [key, text] of Object.entries(data)) {
    const m = key.match(/^(.*) (\d+):(\d+)$/);
    if (!m) throw new Error('farskipper: bad key ' + key);
    const [, book, c, v] = m;
    if (book !== lastBook) { out.push([]); lastBook = book; }
    const chapters = out[out.length - 1];
    const ci = Number(c) - 1, vi = Number(v) - 1;
    while (chapters.length <= ci) chapters.push([]);
    if (chapters[ci].length !== vi) throw new Error('farskipper: out of order at ' + key);
    chapters[ci].push(text);
  }
  return out;
}
function loadScroll() {
  return readJson('scroll.json').books.map((b) =>
    b.chapters.map((c) => c.verses.map((v) => v.text)));
}

// ---- normalisation ----
// Canonical display text: plain KJV wording, no editorial markers.
function clean(raw) {
  return raw
    .replace(/<<[^>]*>>/g, ' ')        // psalm titles in some copies
    .replace(/^\s*#\s*/, '')           // paragraph marks
    .replace(/[¶]/g, ' ')         // pilcrow paragraph marks
    .replace(/[\[\]{}]/g, '')          // markers around translator-supplied (italic) words
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, '--')
    .replace(/\s+/g, ' ')
    .trim();
}
// Words only: used to tell real wording differences from punctuation/case ones.
const words = (s) => clean(s).replace(/\u00E6/g, 'ae').replace(/\u00C6/g, 'Ae').toLowerCase()
  .replace(/[-\u2010-\u2015]/g, '')   // hyphenation of names differs between printings
  .replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();

const sources = { thiago: loadThiago(), farskipper: loadFarskipper(), scroll: loadScroll() };
const names = Object.keys(sources);

// ---- structure checks ----
let failed = false;
const fail = (msg) => { failed = true; console.error('FAIL: ' + msg); };
for (const n of names) {
  const s = sources[n];
  const chapters = s.reduce((a, b) => a + b.length, 0);
  const verses = s.reduce((a, b) => a + b.reduce((x, c) => x + c.length, 0), 0);
  console.log(`${n.padEnd(11)} books=${s.length} chapters=${chapters} verses=${verses}`);
  if (s.length !== 66) fail(`${n}: expected 66 books`);
  if (chapters !== 1189) fail(`${n}: expected 1189 chapters`);
  if (verses !== 31102) fail(`${n}: expected 31102 verses`);
  s.forEach((b, i) => {
    if (b.length !== BOOKS[i][2]) fail(`${n}: ${BOOKS[i][0]} has ${b.length} chapters, expected ${BOOKS[i][2]}`);
  });
}
for (let b = 0; b < 66; b++) {
  for (let c = 0; c < BOOKS[b][2]; c++) {
    const lens = names.map((n) => sources[n][b]?.[c]?.length);
    if (new Set(lens).size !== 1) fail(`${BOOKS[b][0]} ${c + 1}: verse counts differ ${names.map((n, i) => n + '=' + lens[i]).join(' ')}`);
  }
}
if (failed) process.exit(1);

// ---- verse-by-verse comparison ----
const stats = { identical: 0, punctuationOnly: 0, wordDiff: 0 };
const pairAgree = {};
const wordDiffs = [];
const punctDiffs = [];
for (let b = 0; b < 66; b++) {
  for (let c = 0; c < sources.thiago[b].length; c++) {
    for (let v = 0; v < sources.thiago[b][c].length; v++) {
      const ref = `${BOOKS[b][0]} ${c + 1}:${v + 1}`;
      const cl = names.map((n) => clean(sources[n][b][c][v]));
      const wd = names.map((n) => words(sources[n][b][c][v]));
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) {
          const k = names[i] + '=' + names[j];
          pairAgree[k] ??= { exact: 0, words: 0 };
          if (cl[i] === cl[j]) pairAgree[k].exact++;
          if (wd[i] === wd[j]) pairAgree[k].words++;
        }
      if (new Set(wd).size > 1) { stats.wordDiff++; wordDiffs.push({ ref, texts: Object.fromEntries(names.map((n, i) => [n, cl[i]])) }); }
      else if (new Set(cl).size > 1) { stats.punctuationOnly++; punctDiffs.push({ ref, texts: Object.fromEntries(names.map((n, i) => [n, cl[i]])) }); }
      else stats.identical++;
    }
  }
}
console.log('\nverse comparison across all three copies:', stats);
console.log('pairwise agreement (of 31102):', pairAgree);
if (verbose) {
  console.log('\n--- wording differences ---');
  for (const d of wordDiffs.slice(0, 400)) { console.log(d.ref); for (const n of names) console.log('   ' + n.padEnd(11) + d.texts[n]); }
  console.log('\n--- sample punctuation-only differences ---');
  for (const d of punctDiffs.slice(0, 25)) { console.log(d.ref); for (const n of names) console.log('   ' + n.padEnd(11) + d.texts[n]); }
}


// ---- final check of the copy the app uses (farskipper: the standard 1769 text,
// keeps "LORD" in capitals and marks translator-supplied words) ----
// Every verse must match another copy word for word. The only tolerated
// difference is the spelling of single words (Caesar/Cesar, sope/soap ...).
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const spellingOnly = (x, y) => {
  const a = x.split(' '), b = y.split(' ');
  if (a.length !== b.length) return null;
  const pairs = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
    if (editDistance(a[i], b[i]) > 2) return null;
    pairs.push(a[i] + '/' + b[i]);
  }
  return pairs;
};
const report = { confirmedByBoth: 0, confirmedByOne: 0, spellingVariantOnly: [], unconfirmed: [] };
for (let b = 0; b < 66; b++) for (let c = 0; c < sources.farskipper[b].length; c++) for (let v = 0; v < sources.farskipper[b][c].length; v++) {
  const ref = `${BOOKS[b][0]} ${c + 1}:${v + 1}`;
  const f = words(sources.farskipper[b][c][v]), s = words(sources.scroll[b][c][v]), t = words(sources.thiago[b][c][v]);
  if (f === s && f === t) report.confirmedByBoth++;
  else if (f === s || f === t) report.confirmedByOne++;
  else {
    const sp = spellingOnly(f, s) ?? spellingOnly(f, t);
    if (sp) report.spellingVariantOnly.push({ ref, words: sp });
    else report.unconfirmed.push({ ref, farskipper: f, scroll: s, thiago: t });
  }
}
console.log('\nchosen copy vs the other two:', {
  confirmedByBoth: report.confirmedByBoth, confirmedByOne: report.confirmedByOne,
  spellingVariantOnly: report.spellingVariantOnly.length, unconfirmed: report.unconfirmed.length,
});
console.log('spelling variants seen:', [...new Set(report.spellingVariantOnly.flatMap((x) => x.words))].sort().join(', '));
if (report.unconfirmed.length) {
  for (const u of report.unconfirmed) console.error('UNCONFIRMED', u);
  console.error('FAIL: verses whose wording no second copy confirms');
  process.exit(1);
}

if (write) {
  // App format: books[b][c][v]. A leading "¶" marks a new paragraph; [ ] marks
  // words the KJV translators supplied (printed in italics in a paper KJV).
  const books = sources.farskipper.map((b) => b.map((c) => c.map((raw) => {
    const para = /^\s*#/.test(raw);
    const text = raw.replace(/^\s*#\s*/, '').replace(/\s+/g, ' ').trim();
    return (para ? '¶' : '') + text;
  })));
  fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/data/kjv.json'), JSON.stringify({ id: 'kjv', name: 'King James Version', books }));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/kjv-verification.json'), JSON.stringify({
    checked: '31,102 verses in 1,189 chapters of 66 books',
    sources: {
      used: 'github.com/farskipper/kjv json/verses-1769.json',
      crossChecked: ['github.com/scrollmapper/bible_databases formats/json/KJV.json', 'github.com/thiagobodruk/bible json/en_kjv.json'],
    },
    confirmedWordForWordByBothOtherCopies: report.confirmedByBoth,
    confirmedWordForWordByOneOtherCopy: report.confirmedByOne,
    spellingVariantOnly: report.spellingVariantOnly,
    unconfirmed: report.unconfirmed.length,
  }, null, 1));
  console.log('\nwrote public/data/kjv.json and data/kjv-verification.json');
}

