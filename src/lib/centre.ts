import verses from '../data/centre.json';
import { keyOf, type Ref, type VerseKey } from './books';
import { dayNumber } from './store';

// The verses shown with the cross and the name Jesus: about the cross, and
// about His name. One a day, the same for everyone. The words are copied from
// the verified Bible text by scripts/build-centre.mjs.

export interface CentreVerse extends Ref { key: VerseKey; text: string }

const LIST: CentreVerse[] = (verses as (Ref & { text: string })[]).map((v) => ({ ...v, key: keyOf(v) }));

export const centreVerse = (day = dayNumber()): CentreVerse => LIST[((day % LIST.length) + LIST.length) % LIST.length];
