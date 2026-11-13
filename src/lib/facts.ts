import facts from '../data/facts.json';
import type { Ref } from './books';
import type { Mood } from './scenes';

// Bible trivia. The list is built by scripts/build-facts.mjs, which refuses any
// fact that is neither recomputed from the Bible text nor given a named source.

export interface Fact {
  id: string;
  cat: 'numbers' | 'words' | 'people' | 'history';
  q: string;
  a: string;
  more: string;
  refs: Ref[];
  sources: { name: string; url: string }[];
  /** recomputed from the verified Bible text when the app was built */
  checked: boolean;
}

export const FACTS = facts as Fact[];
export const factById = (id: string): Fact | undefined => FACTS.find((f) => f.id === id);

export const CAT_LABEL: Record<Fact['cat'], string> = {
  numbers: 'By the numbers',
  words: 'Words',
  people: 'People and events',
  history: 'The book itself',
};
export const CAT_MOODS: Record<Fact['cat'], Mood[]> = {
  numbers: ['earth', 'dawn'],
  words: ['forest', 'sky'],
  people: ['ember', 'dusk'],
  history: ['dusk', 'deep'],
};

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

/**
 * The order for one sitting: shuffled, with anything thumbed down moved to the
 * very end so it is met far less often. `first` (from a shared link) leads.
 */
export function buildDeck(votes: Record<string, 1 | -1>, seed: number, first?: string): Fact[] {
  const mixed = shuffle(FACTS, seed);
  const deck = [...mixed.filter((f) => votes[f.id] !== -1), ...mixed.filter((f) => votes[f.id] === -1)];
  if (first) {
    const i = deck.findIndex((f) => f.id === first);
    if (i > 0) deck.unshift(...deck.splice(i, 1));
  }
  return deck;
}
