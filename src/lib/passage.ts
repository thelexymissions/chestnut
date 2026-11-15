import { getVerse } from './bible';
import { firstOf, isPassage, keyOf, lastVerse, refOf, type Ref, type VerseKey } from './books';
import { cardByKey } from './feed';

// The words of a saved item, verse or passage. As everywhere in the app, the words come only
// from the verified Bible text (or the feed's list, itself built from it); nothing is typed.

export interface Part { v: number; text: string }

/** Each verse of a reference with its number. Undefined until the Bible is loaded, or if a verse does not exist. */
export function partsOf(r: Ref): Part[] | undefined {
  const out: Part[] = [];
  for (let v = r.v; v <= lastVerse(r); v++) {
    const text = v === r.v && !isPassage(r) ? cardByKey(keyOf(r))?.text ?? getVerse(r) : getVerse({ b: r.b, c: r.c, v });
    if (text === undefined) return undefined;
    out.push({ v, text });
  }
  return out;
}

/** The words of a reference read straight through: one verse, or a passage joined with spaces. */
export function textOf(r: Ref): string | undefined {
  if (!isPassage(r)) return cardByKey(keyOf(r))?.text ?? getVerse(firstOf(r));
  return partsOf(r)?.map((p) => p.text).join(' ');
}

export const textOfKey = (k: VerseKey): string | undefined => textOf(refOf(k));

/** True when a stored key needs the Bible itself (anything but a single verse from the feed's list). */
export const needsBibleFor = (k: VerseKey): boolean => isPassage(refOf(k)) || !cardByKey(k);

const SUP = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
/** A verse number in superscript digits, for plain text such as a WhatsApp message: "\u00b9\u2074". */
export const supNumber = (n: number): string => String(n).split('').map((d) => SUP[Number(d)]).join('');
