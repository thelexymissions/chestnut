// Book table and reference handling. Verse text itself never lives in code:
// it is always read from the verified Bible data.

export interface Book {
  n: number; // 1..66
  name: string;
  abbr: string;
  slug: string;
  chapters: number;
  testament: 'OT' | 'NT';
}

const RAW: [string, string, number][] = [
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

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const BOOKS: Book[] = RAW.map(([name, abbr, chapters], i) => ({
  n: i + 1,
  name,
  abbr,
  slug: slugify(name),
  chapters,
  testament: i < 39 ? 'OT' : 'NT',
}));

export const bookByN = (n: number): Book | undefined => BOOKS[n - 1];
export const bookBySlug = (slug: string): Book | undefined => BOOKS.find((b) => b.slug === slug);

/** "43.3.16" */
export type VerseKey = string;
export interface Ref { b: number; c: number; v: number }

export const keyOf = (r: Ref): VerseKey => `${r.b}.${r.c}.${r.v}`;
export const refOf = (k: VerseKey): Ref => {
  const [b, c, v] = k.split('.').map(Number);
  return { b, c, v };
};
/** Psalms reads better in the singular for a single chapter or verse. */
const displayName = (b: Book) => (b.n === 19 ? 'Psalm' : b.name);
export const formatRef = (r: Ref): string => `${displayName(BOOKS[r.b - 1])} ${r.c}:${r.v}`;
export const formatChapter = (b: number, c: number): string => `${displayName(BOOKS[b - 1])} ${c}`;
export const versePath = (r: Ref): string => `/v/${BOOKS[r.b - 1].slug}/${r.c}/${r.v}`;
export const chapterPath = (b: number, c: number, v?: number): string =>
  `/bible/${BOOKS[b - 1].slug}/${c}${v ? '/' + v : ''}`;

// ---- parsing what people type: "John 3:16", "jn 3 16", "1 cor 13:4-7", "Ps 23", "Song 2" ----
const ALIASES: Record<string, number> = {};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const addAlias = (alias: string, n: number) => { ALIASES[norm(alias)] = n; };

BOOKS.forEach((b) => {
  addAlias(b.name, b.n);
  addAlias(b.abbr, b.n);
});
const EXTRA: Record<string, string[]> = {
  Genesis: ['ge', 'gn'], Exodus: ['ex', 'exo'], Leviticus: ['le', 'lv'], Numbers: ['nu', 'nm', 'nb'],
  Deuteronomy: ['dt', 'de'], Joshua: ['jos', 'jsh'], Judges: ['jdg', 'jg', 'jdgs'], Ruth: ['ru', 'rth'],
  '1 Samuel': ['1sa', '1s', 'isam', 'isamuel', 'firstsamuel', '1sm'], '2 Samuel': ['2sa', '2s', 'iisam', 'iisamuel', 'secondsamuel', '2sm'],
  '1 Kings': ['1ki', '1k', 'ikings', 'firstkings', '1kin'], '2 Kings': ['2ki', '2k', 'iikings', 'secondkings', '2kin'],
  '1 Chronicles': ['1ch', '1chron', 'ichronicles', 'firstchronicles'], '2 Chronicles': ['2ch', '2chron', 'iichronicles', 'secondchronicles'],
  Ezra: ['ezr'], Nehemiah: ['ne'], Esther: ['est', 'es'], Job: ['jb'],
  Psalms: ['psalm', 'psa', 'pss', 'psm', 'pslm'], Proverbs: ['pr', 'prv', 'pro'],
  Ecclesiastes: ['ecc', 'ec', 'eccles', 'qoh'], 'Song of Solomon': ['songofsongs', 'sos', 'so', 'canticles', 'songs'],
  Isaiah: ['is'], Jeremiah: ['je', 'jr'], Lamentations: ['la'], Ezekiel: ['eze', 'ezk'], Daniel: ['da', 'dn'],
  Hosea: ['ho'], Joel: ['jl'], Amos: ['am'], Obadiah: ['ob'], Jonah: ['jon', 'jnh'], Micah: ['mi'],
  Nahum: ['na'], Habakkuk: ['hb'], Zephaniah: ['zep', 'zp'], Haggai: ['hg'], Zechariah: ['zec', 'zc'], Malachi: ['ml'],
  Matthew: ['mt', 'mat'], Mark: ['mk', 'mr', 'mrk'], Luke: ['lk', 'luk'], John: ['jn', 'jhn', 'joh'],
  Acts: ['ac', 'act'], Romans: ['ro', 'rm'],
  '1 Corinthians': ['1co', 'icor', 'icorinthians', 'firstcorinthians', '1corinthian'], '2 Corinthians': ['2co', 'iicor', 'iicorinthians', 'secondcorinthians', '2corinthian'],
  Galatians: ['ga'], Ephesians: ['ephes'], Philippians: ['php', 'pp', 'philip'], Colossians: ['co'],
  '1 Thessalonians': ['1th', '1thes', 'ithessalonians', 'firstthessalonians'], '2 Thessalonians': ['2th', '2thes', 'iithessalonians', 'secondthessalonians'],
  '1 Timothy': ['1ti', 'itimothy', 'firsttimothy', '1tm'], '2 Timothy': ['2ti', 'iitimothy', 'secondtimothy', '2tm'],
  Titus: ['tit', 'ti'], Philemon: ['philem', 'phm', 'pm'], Hebrews: ['he'], James: ['jm', 'jam'],
  '1 Peter': ['1pe', '1p', 'ipeter', 'firstpeter', '1pt'], '2 Peter': ['2pe', '2p', 'iipeter', 'secondpeter', '2pt'],
  '1 John': ['1jn', '1jo', 'ijohn', 'firstjohn', '1j'], '2 John': ['2jn', '2jo', 'iijohn', 'secondjohn', '2j'],
  '3 John': ['3jn', '3jo', 'iiijohn', 'thirdjohn', '3j'], Jude: ['jud', 'jd'],
  Revelation: ['re', 'revelations', 'apocalypse', 'rv'],
};
BOOKS.forEach((b) => (EXTRA[b.name] || []).forEach((a) => addAlias(a, b.n)));

function findBook(text: string): number | undefined {
  const k = norm(text);
  if (!k) return undefined;
  if (ALIASES[k]) return ALIASES[k];
  // unique prefix of a full book name, at least three letters ("philip" etc.)
  if (k.length >= 3) {
    const hits = BOOKS.filter((b) => norm(b.name).startsWith(k));
    if (hits.length === 1) return hits[0].n;
  }
  return undefined;
}

export interface ParsedRef { b: number; c?: number; v?: number; vEnd?: number }

export function parseReference(input: string): ParsedRef | undefined {
  const s = input.trim().replace(/\s+/g, ' ');
  if (!s) return undefined;
  const m = s.match(/^((?:[1-3]|i{1,3}|first|second|third)?\s*[a-z][a-z .]*?)\.?\s*(\d{1,3})?(?:\s*[:.,\s]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?$/i);
  if (!m) return undefined;
  const b = findBook(m[1]);
  if (!b) return undefined;
  const book = BOOKS[b - 1];
  if (!m[2]) return { b };
  let c = Number(m[2]);
  let v = m[3] ? Number(m[3]) : undefined;
  let vEnd = m[4] ? Number(m[4]) : undefined;
  // single-chapter books: "Jude 5" means verse 5
  if (book.chapters === 1 && v === undefined && c > 1) { v = c; c = 1; }
  if (c < 1 || c > book.chapters) return undefined;
  if (vEnd !== undefined && v !== undefined && vEnd < v) vEnd = undefined;
  return { b, c, v, vEnd };
}
