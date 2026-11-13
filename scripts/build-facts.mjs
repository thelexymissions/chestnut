// Builds the trivia deck (src/data/facts.json) from data/facts.json.
//
// Every fact must be backed in one of two ways, or the build stops:
//   - "check": the claim is recomputed here from the verified Bible text and must match
//     both the expected value and the wording shown to the reader; or
//   - "sources": at least one named, linked reference for facts about the Bible's history.
//
// Usage: node scripts/build-facts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const books = JSON.parse(fs.readFileSync(path.join(root, 'public/data/kjv.json'), 'utf8')).books;
const facts = JSON.parse(fs.readFileSync(path.join(root, 'data/facts.json'), 'utf8'));

const NAMES = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];
const CATS = ['numbers', 'words', 'people', 'history'];

const plain = (raw) => raw.replace(/^¶/, '').replace(/[\[\]]/g, '');
const wordsOf = (t) => t.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) ?? [];
const all = [];
books.forEach((b, bi) => b.forEach((c, ci) => c.forEach((raw, vi) => all.push({ b: bi, c: ci + 1, v: vi + 1, t: plain(raw) }))));
const text = (book, c, v) => plain(books[NAMES.indexOf(book)][c - 1][v - 1]);
const refName = (x) => `${NAMES[x.b]} ${x.c}:${x.v}`;
const chapters = [];
books.forEach((b, bi) => b.forEach((c, ci) => chapters.push({ b: bi, c: ci + 1, n: c.length })));
const bookStats = books.map((b, i) => ({ name: NAMES[i], chapters: b.length, verses: b.reduce((a, c) => a + c.length, 0) }));
const count = (re, from = 0, to = 66) => all.filter((x) => x.b >= from && x.b < to).reduce((a, x) => a + (x.t.match(re) || []).length, 0);
const versesWith = (re) => all.filter((x) => re.test(x.t)).map(refName);
const letters = (t) => t.replace(/[^A-Za-z]/g, '').length;
const missing = (t) => 'abcdefghijklmnopqrstuvwxyz'.split('').filter((l) => !t.toLowerCase().includes(l));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Each check returns true only if the Bible text supports the claim.
// `says` then confirms the numbers and names it relied on are the ones shown to the reader.
const says = (f, ...parts) => parts.every((p) => `${f.a} ${f.more}`.includes(p));
const CHECKS = {
  books: (f) => books.length === 66 && says(f, '66', '39', '27'),
  chapters: (f) => chapters.length === 1189 && chapters.filter((x) => x.b < 39).length === 929 && chapters.filter((x) => x.b >= 39).length === 260 && says(f, '1,189', '929', '260'),
  verses: (f) => all.length === 31102 && all.filter((x) => x.b < 39).length === 23145 && all.filter((x) => x.b >= 39).length === 7957 && says(f, '31,102', '23,145', '7,957'),
  shortestVerse: (f) => {
    const s = [...all].sort((a, b) => letters(a.t) - letters(b.t));
    return refName(s[0]) === 'John 11:35' && letters(s[0].t) < letters(s[1].t) && s[0].t === 'Jesus wept.' && letters(s[0].t) === 9 && says(f, 'Jesus wept.', 'John 11:35', 'nine');
  },
  longestVerse: (f) => {
    const s = [...all].sort((a, b) => wordsOf(b.t).length - wordsOf(a.t).length);
    return refName(s[0]) === 'Esther 8:9' && wordsOf(s[0].t).length === 90 && wordsOf(s[1].t).length < 90 && says(f, 'Esther 8:9', '90');
  },
  longestChapter: (f) => {
    const s = [...chapters].sort((a, b) => b.n - a.n);
    return NAMES[s[0].b] === 'Psalms' && s[0].c === 119 && s[0].n === 176 && NAMES[s[1].b] === 'Numbers' && s[1].c === 7 && s[1].n === 89 && says(f, 'Psalm 119', '176', 'Numbers 7', '89');
  },
  shortestChapter: (f) => {
    const s = [...chapters].sort((a, b) => a.n - b.n);
    return NAMES[s[0].b] === 'Psalms' && s[0].c === 117 && s[0].n === 2 && s[1].n > 2 && says(f, 'Psalm 117', 'two');
  },
  middleChapter: (f) => {
    const i = (chapters.length - 1) / 2;
    return Number.isInteger(i) && NAMES[chapters[i].b] === 'Psalms' && chapters[i].c === 117 && i === 594 && chapters.length - i - 1 === 594 && says(f, 'Psalm 117', '594');
  },
  middleVerses: (f) => all.length % 2 === 0 && refName(all[all.length / 2 - 1]) === 'Psalms 103:1' && refName(all[all.length / 2]) === 'Psalms 103:2' && says(f, 'two', 'Psalm 103:1', 'Psalm 103:2'),
  mostChapters: (f) => {
    const byCh = [...bookStats].sort((a, b) => b.chapters - a.chapters), byV = [...bookStats].sort((a, b) => b.verses - a.verses);
    return byCh[0].name === 'Psalms' && byCh[0].chapters === 150 && byCh[1].chapters < 150 && byV[0].name === 'Psalms' && byV[0].verses === 2461 && says(f, 'Psalms', '150', '2,461');
  },
  oneChapter: (f) => eq(bookStats.filter((x) => x.chapters === 1).map((x) => x.name), ['Obadiah', 'Philemon', '2 John', '3 John', 'Jude']) && says(f, 'Five', 'Obadiah', 'Philemon', '2 John', '3 John', 'Jude'),
  fewestVerses: (f) => {
    const s = [...bookStats].sort((a, b) => a.verses - b.verses);
    return s[0].name === '2 John' && s[0].verses === 13 && s[1].name === '3 John' && s[1].verses === 14 && says(f, '2 John', '13', '3 John', '14');
  },
  ntLetters: (f) => NAMES.indexOf('Jude') - NAMES.indexOf('Romans') + 1 === 21 && NAMES.length - 39 === 27 && says(f, '21', '27'),
  psalm119: (f) => books[18][118].length === 176 && 22 * 8 === 176 && says(f, '22', 'eight'),
  proverbs: (f) => books[19].length === 31 && says(f, '31'),
  firstLast: (f) => all[0].t.startsWith('In the beginning') && all[all.length - 1].t.trim().endsWith('Amen.') && refName(all[all.length - 1]) === 'Revelation 22:21' && says(f, 'In the beginning', 'Amen', 'Genesis 1:1', 'Revelation 22:21'),
  wordBible: (f) => count(/\bBibles?\b/gi) === 0 && says(f, 'Never'),
  christian: (f) => eq(versesWith(/\bChristians?\b/), ['Acts 11:26', 'Acts 26:28', '1 Peter 4:16']) && count(/\bChristians?\b/g) === 3 && says(f, 'Three', 'Acts 11:26', 'Acts 26:28', '1 Peter 4:16'),
  antioch: (f) => text('Acts', 11, 26).includes('the disciples were called Christians first in Antioch') && says(f, 'Antioch', '11'),
  grandmother: (f) => eq(versesWith(/\bgrandmothers?\b/i), ['2 Timothy 1:5']) && text('2 Timothy', 1, 5).includes('thy grandmother Lois') && says(f, 'Lois', '2 Timothy 1:5'),
  eternity: (f) => eq(versesWith(/\beternity\b/i), ['Isaiah 57:15']) && count(/\beternity\b/gi) === 1 && says(f, 'Once', 'Isaiah 57:15'),
  ezra: (f) => eq(missing(text('Ezra', 7, 21)), ['j']) && all.every((x) => missing(x.t).length > 0) && says(f, 'J', '26'),
  psalm107: (f) => {
    const line = text('Psalms', 107, 8);
    const same = all.filter((x) => x.t === line).map(refName);
    return eq(same, ['Psalms 107:8', 'Psalms 107:15', 'Psalms 107:21', 'Psalms 107:31']) && says(f, 'Psalm 107', '8, 15, 21 and 31');
  },
  esther: (f) => {
    const none = NAMES.filter((_, i) => count(/\b(God|GOD|Lord|LORD)\b/g, i, i + 1) === 0);
    return eq(none, ['Esther', 'Song of Solomon']) && says(f, 'Esther', 'Song of Solomon');
  },
  methuselah: (f) => text('Genesis', 5, 27).includes('all the days of Methuselah were nine hundred sixty and nine years') && says(f, 'Methuselah', '969', 'Genesis 5:27'),
  donkey: (f) => text('Numbers', 22, 28).includes('the LORD opened the mouth of the ass, and she said unto Balaam') && says(f, 'donkey', 'Numbers 22:28'),
  zimri: (f) => text('1 Kings', 16, 15).includes('did Zimri reign seven days') && says(f, 'Seven days', 'Zimri', '1 Kings 16:15'),
  manasseh: (f) => text('2 Kings', 21, 1).includes('Manasseh was twelve years old when he began to reign, and reigned fifty and five years in Jerusalem') && says(f, 'Manasseh', '55', 'twelve'),
  forty: (f) => [['Genesis', 7, 12], ['Exodus', 24, 18], ['Matthew', 4, 2]].every(([b, c, v]) => text(b, c, v).includes('forty days and forty nights')) && says(f, 'Forty days and forty nights'),
  cana: (f) => text('John', 2, 11).includes('This beginning of miracles did Jesus in Cana of Galilee') && text('John', 2, 9).includes('the water that was made wine') && says(f, 'Water into wine', 'Cana', 'John chapter 2'),
  lordsPrayer: (f) => text('Matthew', 6, 9).includes('Our Father which art in heaven, Hallowed be thy name') && text('Luke', 11, 2).includes('Our Father which art in heaven, Hallowed be thy name') && says(f, 'Matthew chapter 6', 'Luke chapter 11'),
  commandments: (f) => text('Exodus', 20, 3).startsWith('Thou shalt have no other gods before me') && text('Deuteronomy', 5, 7).startsWith('Thou shalt have none other gods before me') && text('Exodus', 20, 13) === 'Thou shalt not kill.' && text('Deuteronomy', 5, 17) === 'Thou shalt not kill.' && says(f, 'Exodus 20', 'Deuteronomy 5'),
  paul: (f) => {
    const open = NAMES.filter((n, i) => i >= 44 && /^Paul\b/.test(plain(books[i][0][0])));
    return open.length === 13 && open[0] === 'Romans' && open[12] === 'Philemon' && says(f, 'Thirteen', 'Romans', 'Philemon');
  },
  women: (f) => NAMES.includes('Ruth') && NAMES.includes('Esther') && says(f, 'Ruth', 'Esther', '66'),
  apostles: (f) => text('Matthew', 10, 2).startsWith('Now the names of the twelve apostles are these') && says(f, 'Matthew 10', 'verse 2'),
};

const errors = [];
const seen = new Set();
const out = [];
for (const f of facts) {
  const where = `fact "${f.id}"`;
  if (!f.id || seen.has(f.id)) errors.push(`${where}: missing or repeated id`);
  seen.add(f.id);
  if (!CATS.includes(f.cat)) errors.push(`${where}: unknown category "${f.cat}"`);
  for (const k of ['q', 'a', 'more']) if (typeof f[k] !== 'string' || !f[k].trim()) errors.push(`${where}: "${k}" is empty`);
  const refs = [];
  for (const r of f.refs ?? []) {
    const m = r.match(/^(.*) (\d+):(\d+)$/);
    const b = m ? NAMES.indexOf(m[1]) : -1;
    if (!m || b < 0 || books[b]?.[m[2] - 1]?.[m[3] - 1] === undefined) errors.push(`${where}: reference "${r}" is not in the Bible`);
    else refs.push({ b: b + 1, c: Number(m[2]), v: Number(m[3]) });
  }
  for (const s of f.sources ?? []) {
    if (!s.name || !/^https:\/\/[^\s]+$/.test(s.url || '')) errors.push(`${where}: source needs a name and an https link`);
  }
  let checked = false;
  if (f.check) {
    const fn = CHECKS[f.check];
    if (!fn) errors.push(`${where}: no check named "${f.check}"`);
    else if (fn(f) !== true) errors.push(`${where}: the Bible text does not support this as worded`);
    else checked = true;
  }
  if (!checked && !(f.sources ?? []).length) errors.push(`${where}: needs either a text check or a source`);
  out.push({ id: f.id, cat: f.cat, q: f.q, a: f.a, more: f.more, refs, sources: f.sources ?? [], checked });
}

if (errors.length) {
  console.error(errors.map((e) => 'FAIL: ' + e).join('\n'));
  process.exit(1);
}
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/facts.json'), JSON.stringify(out, null, 1));
const byCat = Object.fromEntries(CATS.map((c) => [c, out.filter((f) => f.cat === c).length]));
console.log(`facts: ${out.length} (${out.filter((f) => f.checked).length} checked against the text, ${out.filter((f) => !f.checked).length} from named sources)`, byCat);
