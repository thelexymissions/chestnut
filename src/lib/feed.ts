import curated from '../data/curated.json';
import { keyOf, type Ref, type VerseKey } from './books';
import { hash } from './scenes';

// The feed is built from the curated list: references chosen per topic, with
// the text copied from the verified Bible when the list is built.

export interface Card extends Ref {
  key: VerseKey;
  text: string;
  topics: string[];
}

interface CuratedEntry { b: number; c: number; v: number; t: string[]; text: string }

export const CARDS: Card[] = (curated as CuratedEntry[]).map((e) => ({
  b: e.b, c: e.c, v: e.v, key: keyOf(e), text: e.text, topics: e.t,
}));
const byKey = new Map(CARDS.map((c) => [c.key, c]));
export const cardByKey = (k: VerseKey): Card | undefined => byKey.get(k);

export function countForTopics(topics: string[]): number {
  if (!topics.length) return CARDS.length;
  return CARDS.filter((c) => c.topics.some((t) => topics.includes(t))).length;
}
export const countForTopic = (id: string): number => CARDS.filter((c) => c.topics.includes(id)).length;

function shuffle<T>(list: T[], seed: number): T[] {
  const a = list.slice();
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cards for the chosen topics in a shuffled order; `first` is moved to the front. */
export function buildFeed(topics: string[], seed: number, first?: VerseKey): Card[] {
  const pool = topics.length ? CARDS.filter((c) => c.topics.some((t) => topics.includes(t))) : CARDS;
  const out = shuffle(pool, seed);
  if (first) {
    const i = out.findIndex((c) => c.key === first);
    if (i > 0) out.unshift(...out.splice(i, 1));
    else if (i < 0) {
      const c = cardByKey(first);
      if (c) out.unshift(c);
    }
  }
  return out;
}

/** Which of a card's topics to show, preferring one the person picked. */
export function displayTopic(card: { topics: string[] }, selected: string[]): string | undefined {
  return card.topics.find((t) => selected.includes(t)) ?? card.topics[0];
}

/** Same verse for everyone on the same calendar day. */
export function verseOfTheDay(d = new Date()): Card | undefined {
  if (!CARDS.length) return undefined;
  const order = shuffle(CARDS, hash('chestnut-verse-of-the-day'));
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return order[day % order.length];
}

export const sessionSeed = Math.floor(Math.random() * 2 ** 31);
