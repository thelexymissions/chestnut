import cross from '../data/cross.json';
import { formatRef, type Ref } from './books';

// The words shown with the cross and the name Jesus. They are copied from the verified
// Bible text by scripts/build-centre.mjs, from the references in data/cross-verses.json.

/** A verse, or a run of verses in one chapter, with its reference written out ("Romans 8:1–2"). */
export interface Passage extends Ref { to: number; parts: string[]; text: string; ref: string }

// the reference names the whole range by itself ("Romans 8:1–2"), since a reference with `to` is a passage
const named = (p: Omit<Passage, 'ref'>): Passage => ({ ...p, ref: formatRef(p) });

/** On the opening moment and the welcome screen. */
export const openingPassage: Passage = named(cross.opening);
/** On the card at the top of Home. */
export const homePassage: Passage = named(cross.home);
