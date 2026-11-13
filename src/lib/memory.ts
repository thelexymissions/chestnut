import { chapterCount, chapterWords, getVocab, stepRef, verseExists } from './bible';
import { keyOf, refOf, type Ref, type VerseKey } from './books';
import { hash } from './scenes';
import { dayNumber, type MemoryEntry } from './store';

// Memorising: a fixed review schedule and exercises that are marked by exact
// match against the verified text. Nothing here guesses or judges: every wrong
// choice offered is a real Bible word or reference picked by the rules below,
// with a seeded shuffle so a given review is repeatable.

// ---------- schedule ----------
/** Days until the next review once a verse reaches each box. */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 90];
export const MEMORISED_BOX = 5;

export type Level = 'New' | 'Learning' | 'Familiar' | 'Memorised';
export const levelOf = (box: number): Level => (box <= 0 ? 'New' : box <= 2 ? 'Learning' : box < MEMORISED_BOX ? 'Familiar' : 'Memorised');

export const isDue = (e: MemoryEntry, today = dayNumber()) => e.dueDay <= today;

export function dueLabel(e: MemoryEntry, today = dayNumber()): string {
  const d = e.dueDay - today;
  if (d <= 0) return e.box === 0 && e.reviews === 0 ? 'Ready to learn' : 'Due today';
  if (d === 1) return 'Tomorrow';
  if (d < 14) return `In ${d} days`;
  if (d < 60) return `In ${Math.round(d / 7)} weeks`;
  return `In ${Math.round(d / 30)} months`;
}

/** Pass: up one box and wait longer. Miss: down one box and come back tomorrow. */
export function applyResult(e: MemoryEntry, passed: boolean, today = dayNumber()): MemoryEntry {
  const box = passed ? e.box + 1 : Math.max(0, e.box - 1);
  const wait = passed ? INTERVALS[Math.min(box, INTERVALS.length - 1)] : 1;
  return { ...e, box, dueDay: today + wait, last: Date.now(), reviews: e.reviews + 1, lapses: e.lapses + (passed ? 0 : 1) };
}

/** A review passes when at least four in five prompts were right first time. */
export const passes = (firstTry: number, prompts: number, selfMark: boolean | null): boolean =>
  (prompts === 0 || firstTry / prompts >= 0.8) && selfMark !== false;

// ---------- what a review contains at each stage ----------
export type StepKind = 'learn' | 'blanks' | 'letters' | 'ref' | 'verse' | 'recite';
export interface Step { kind: StepKind; /** share of words hidden, for blanks */ ratio?: number }

export const STEP_NAMES: Record<StepKind, string> = {
  learn: 'Read it through',
  blanks: 'Fill in the blanks',
  letters: 'First letters',
  ref: 'Name the reference',
  verse: 'Find the verse',
  recite: 'Recite and reveal',
};

export function planFor(box: number): Step[] {
  if (box <= 0) return [{ kind: 'learn' }, { kind: 'blanks', ratio: 0.25 }, { kind: 'blanks', ratio: 0.45 }];
  if (box === 1) return [{ kind: 'blanks', ratio: 0.45 }, { kind: 'ref' }];
  if (box === 2) return [{ kind: 'blanks', ratio: 0.7 }, { kind: 'verse' }];
  if (box === 3) return [{ kind: 'letters' }, { kind: 'ref' }];
  return [{ kind: 'letters' }, { kind: 'recite' }];
}

// ---------- seeded randomness ----------
export function rng(seed: string): () => number {
  let a = hash(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled<T>(list: T[], rand: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- words ----------
export interface Token { pre: string; word: string; post: string }

/** Splits a verse into words, keeping the punctuation around each. */
export function tokenize(text: string): Token[] {
  return text.split(/\s+/).filter(Boolean).map((chunk) => {
    const m = chunk.match(/^([^A-Za-z]*)([A-Za-z]+(?:['-][A-Za-z]+)*)?(.*)$/)!;
    return { pre: m[1] ?? '', word: m[2] ?? '', post: m[3] ?? '' };
  });
}

const STOP = new Set(('the and of to in that unto for shall with is be his he a i not they him them all thou thy it was my which me their ye have will thee from as are when this out were by you up there hath then had into on also an at or but so if upon her she we our your us no do did am who what these those may let one o yea nor any than shalt art hast thine mine been should would even every because before after over against therefore wherefore neither both').split(' '));

/** Gives a wrong choice the same capitalisation as the right answer, so the shape gives nothing away. */
function matchCase(candidate: string, answer: string): string {
  const letters = answer.replace(/['-].*$/, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) return candidate.toUpperCase();
  if (answer[0] !== answer[0].toLowerCase()) return candidate[0].toUpperCase() + candidate.slice(1);
  return candidate;
}

/** Which words to hide: the weightier words first, spread by a seeded shuffle. */
export function pickBlanks(tokens: Token[], ratio: number, rand: () => number): number[] {
  const words = tokens.map((t, i) => ({ t, i })).filter((x) => x.t.word);
  const strong = words.filter((x) => x.t.word.length >= 3 && !STOP.has(x.t.word.toLowerCase()));
  const want = Math.max(1, Math.min(words.length, Math.round(words.length * ratio)));
  const picked = shuffled(strong, rand).slice(0, want);
  if (picked.length < want) {
    const rest = shuffled(words.filter((x) => !picked.includes(x)), rand);
    picked.push(...rest.slice(0, want - picked.length));
  }
  return picked.map((x) => x.i).sort((a, b) => a - b);
}

/**
 * Choices for one hidden word: the right word plus wrong ones of similar length,
 * taken first from the same chapter and then from common Bible words.
 */
export function wordChoices(answer: string, ref: Ref, count: number, rand: () => number, sameLetter = false): string[] {
  const lower = answer.toLowerCase();
  const vocab = getVocab();
  const near = (w: string) => Math.abs(w.length - lower.length) <= (sameLetter ? 3 : 2);
  // a lower-case answer is never set beside a name: "god" in lower case would look wrong
  const plainAnswer = answer === lower;
  const ok = (w: string) => w !== lower && !(plainAnswer && vocab.proper.has(w))
    && (!sameLetter || w[0] === lower[0]) && (sameLetter || (w.length >= 3 && !STOP.has(w)));
  const pools: string[][] = sameLetter
    ? [chapterWords(ref.b, ref.c).filter((w) => ok(w) && near(w)), (vocab.byLetter[lower[0]] ?? []).filter((w) => ok(w) && near(w)), (vocab.byLetter[lower[0]] ?? []).filter(ok)]
    : [chapterWords(ref.b, ref.c).filter((w) => ok(w) && near(w)), [lower.length - 1, lower.length, lower.length + 1, lower.length + 2].flatMap((n) => (vocab.byLength[n] ?? []).slice(0, 60)).filter(ok)];
  const wrong: string[] = [];
  for (const pool of pools) {
    for (const w of shuffled(pool, rand)) {
      if (wrong.length >= count - 1) break;
      if (!wrong.includes(w)) wrong.push(w);
    }
  }
  // a letter with too few common words (x, z): fall back to any common words
  for (const w of shuffled(Object.values(vocab.byLength).flat().slice(0, 400), rand)) {
    if (wrong.length >= count - 1) break;
    if (w !== lower && !wrong.includes(w) && !(plainAnswer && vocab.proper.has(w))) wrong.push(w);
  }
  return shuffled([answer, ...wrong.slice(0, count - 1).map((w) => matchCase(w, answer))], rand);
}

// ---------- references ----------
/**
 * Four references, one of them right. The wrong ones are: another verse being
 * memorised, a neighbouring verse in the same chapter, and the same chapter and
 * verse numbers in a different book; other chapters of the same book fill any gap.
 */
export function referenceChoices(ref: Ref, memoryKeys: VerseKey[], rand: () => number): Ref[] {
  const key = keyOf(ref);
  const out: Ref[] = [];
  const add = (r: Ref | undefined) => {
    if (r && verseExists(r) && keyOf(r) !== key && !out.some((x) => keyOf(x) === keyOf(r))) out.push(r);
  };
  const others = shuffled(memoryKeys.filter((k) => k !== key), rand);
  if (others[0]) add(refOf(others[0]));
  for (const d of shuffled([-3, -2, -1, 1, 2, 3], rand)) { if (out.length >= 2) break; add(stepRef(ref, d)); }
  for (const b of shuffled(Array.from({ length: 66 }, (_, i) => i + 1), rand)) { if (out.length >= 3) break; if (b !== ref.b) add({ b, c: ref.c, v: ref.v }); }
  for (const c of shuffled(Array.from({ length: chapterCount(ref.b) }, (_, i) => i + 1), rand)) { if (out.length >= 3) break; add({ b: ref.b, c, v: ref.v }); add({ b: ref.b, c, v: 1 }); }
  for (const d of [4, -4, 5, -5, 6, -6]) { if (out.length >= 3) break; add(stepRef(ref, d)); }
  return shuffled([ref, ...out.slice(0, 3)], rand);
}

/**
 * Four verses, one of them right. Wrong ones come from the memorising list
 * first, then from the verses next to the right one.
 */
export function verseChoices(ref: Ref, memoryKeys: VerseKey[], rand: () => number): Ref[] {
  const key = keyOf(ref);
  const out: Ref[] = [];
  const add = (r: Ref | undefined) => {
    if (r && verseExists(r) && keyOf(r) !== key && !out.some((x) => keyOf(x) === keyOf(r))) out.push(r);
  };
  for (const k of shuffled(memoryKeys.filter((x) => x !== key), rand).slice(0, 2)) add(refOf(k));
  for (const d of shuffled([-2, -1, 1, 2], rand)) { if (out.length >= 3) break; add(stepRef(ref, d)); }
  for (const d of [3, -3, 4, -4, 5, -5]) { if (out.length >= 3) break; add(stepRef(ref, d)); }
  return shuffled([ref, ...out.slice(0, 3)], rand);
}
