import { useEffect, useState } from 'react';
import { BOOKS, type Ref } from './books';

// The whole verified KJV: books[b][c][v]. A leading "¶" marks a new paragraph
// and [ ] wraps words supplied by the translators (italic in a printed KJV).
type BibleData = string[][][];

let data: BibleData | null = null;
let loading: Promise<BibleData> | null = null;
const listeners = new Set<() => void>();

export function loadBible(): Promise<BibleData> {
  if (data) return Promise.resolve(data);
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/kjv.json`)
      .then((r) => {
        if (!r.ok) throw new Error('Bible download failed: ' + r.status);
        return r.json();
      })
      .then((j: { books: BibleData }) => {
        data = j.books;
        listeners.forEach((l) => l());
        return data;
      })
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

export const bibleLoaded = () => data !== null;

export function useBible(): { ready: boolean; error: string | null } {
  const [, tick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    loadBible().catch((e) => setError(String(e?.message || e)));
    return () => { listeners.delete(l); };
  }, []);
  return { ready: data !== null, error };
}

/** Plain reading text: no paragraph mark, no brackets. */
export const plain = (raw: string): string => raw.replace(/^¶/, '').replace(/[\[\]]/g, '');
export const startsParagraph = (raw: string): boolean => raw.startsWith('¶');

/** Splits a raw verse into runs so supplied words can be set in italics. */
export function segments(raw: string): { text: string; italic: boolean }[] {
  const s = raw.replace(/^¶/, '');
  const out: { text: string; italic: boolean }[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), italic: false });
    out.push({ text: m[1], italic: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), italic: false });
  return out;
}

export function getChapter(b: number, c: number): string[] | undefined {
  return data?.[b - 1]?.[c - 1];
}
export function getVerseRaw(r: Ref): string | undefined {
  return data?.[r.b - 1]?.[r.c - 1]?.[r.v - 1];
}
export function getVerse(r: Ref): string | undefined {
  const raw = getVerseRaw(r);
  return raw === undefined ? undefined : plain(raw);
}
export function verseCount(b: number, c: number): number {
  return data?.[b - 1]?.[c - 1]?.length ?? 0;
}

// ---- keyword search over all 31,102 verses ----
interface IndexEntry { b: number; c: number; v: number; text: string; lower: string }
let index: IndexEntry[] | null = null;

function buildIndex(): IndexEntry[] {
  if (index) return index;
  const out: IndexEntry[] = [];
  data!.forEach((book, bi) =>
    book.forEach((chapter, ci) =>
      chapter.forEach((raw, vi) => {
        const text = plain(raw);
        out.push({ b: bi + 1, c: ci + 1, v: vi + 1, text, lower: text.toLowerCase() });
      })));
  index = out;
  return out;
}

export interface SearchHit { b: number; c: number; v: number; text: string }
export interface SearchResult { hits: SearchHit[]; total: number; terms: string[]; perBook: Record<number, number> }
export type SearchScope = 'all' | 'OT' | 'NT' | number;

/**
 * Words are matched as whole words, all required, in any order.
 * Text inside double quotes is matched as an exact phrase.
 */
export function searchBible(query: string, scope: SearchScope = 'all', limit = 200): SearchResult {
  const empty: SearchResult = { hits: [], total: 0, terms: [], perBook: {} };
  if (!data) return empty;
  const q = query.toLowerCase().replace(/[“”]/g, '"').trim();
  const phrases: string[] = [];
  const rest = q.replace(/"([^"]+)"/g, (_, p: string) => {
    const t = p.trim().replace(/\s+/g, ' ');
    if (t) phrases.push(t);
    return ' ';
  });
  const words = rest.split(/[^a-z0-9']+/).filter((w) => w.length > 0);
  if (!phrases.length && !words.length) return empty;
  if (!phrases.length && words.every((w) => w.length < 2)) return empty;

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tests = [
    ...phrases.map((p) => new RegExp(`(?<![a-z0-9])${esc(p)}(?![a-z0-9])`)),
    ...words.map((w) => new RegExp(`(?<![a-z0-9])${esc(w)}(?![a-z0-9])`)),
  ];
  const quick = [...phrases, ...words];
  const idx = buildIndex();
  const hits: SearchHit[] = [];
  const perBook: Record<number, number> = {};
  let total = 0;
  for (const e of idx) {
    if (scope === 'OT' && e.b > 39) break;
    if (scope === 'NT' && e.b <= 39) continue;
    if (typeof scope === 'number' && e.b !== scope) continue;
    let ok = true;
    for (let i = 0; i < quick.length; i++) {
      if (!e.lower.includes(quick[i]) || !tests[i].test(e.lower)) { ok = false; break; }
    }
    if (!ok) continue;
    total++;
    perBook[e.b] = (perBook[e.b] || 0) + 1;
    if (hits.length < limit) hits.push({ b: e.b, c: e.c, v: e.v, text: e.text });
  }
  return { hits, total, terms: quick, perBook };
}

export const TOTAL_VERSES = 31102;
export const bookName = (b: number) => BOOKS[b - 1].name;
