import verses from '../data/centre.json';
import opening from '../data/opening.json';
import { formatRef, keyOf, type Ref, type VerseKey } from './books';
import { dayNumber } from './store';

// The words shown with the cross and the name Jesus. All of them are copied from
// the verified Bible text by scripts/build-centre.mjs.
//  - openingPassage: always the same, on the opening moment and the welcome screen.
//  - centreVerse: on the Home card, about the cross or His name; one a day, the same for everyone.

/** A verse, or a run of verses in one chapter, with its reference written out ("Romans 8:1–2"). */
export interface Passage extends Ref { to: number; parts: string[]; text: string; ref: string }

export const openingPassage: Passage = {
  ...opening,
  ref: opening.to > opening.v ? `${formatRef(opening)}\u2013${opening.to}` : formatRef(opening),
};

export interface CentreVerse extends Ref { key: VerseKey; text: string }

const LIST: CentreVerse[] = (verses as (Ref & { text: string })[]).map((v) => ({ ...v, key: keyOf(v) }));

export const centreVerse = (day = dayNumber()): CentreVerse => LIST[((day % LIST.length) + LIST.length) % LIST.length];
