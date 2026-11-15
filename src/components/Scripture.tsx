import { Fragment, memo, type CSSProperties, type ReactNode } from 'react';

// Typesetting for verse text.
//  - Words the King James Bible prints in capitals (LORD, GOD, JEHOVAH) are set
//    as a capital followed by small capitals, as in a printed copy.
//  - With `reveal`, the verse is split at its punctuation so it can appear
//    phrase by phrase.
// The words themselves are never changed.

const CAPS = /[A-Z][A-Z]+/g;

export function smallCaps(text: string, keyBase = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  CAPS.lastIndex = 0;
  while ((m = CAPS.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<Fragment key={keyBase + m.index}>{m[0][0]}<span className="sc">{m[0].slice(1).toLowerCase()}</span></Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Splits after , ; : . ? ! so each phrase can be shown in turn. */
export function phrases(text: string): string[] {
  const parts = text.match(/[^,;:.?!]+[,;:.?!)]*\s*/g);
  return parts && parts.join('') === text ? parts : [text];
}

/**
 * A passage set as running text with a small number before each verse, as in a printed Bible;
 * a single verse is set as it is, with no number.
 */
export const PassageText = memo(function PassageText({ parts, text }: { parts?: { v: number; text: string }[]; text: string }) {
  if (!parts || parts.length < 2) return <Scripture text={text} />;
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={p.v}>{i > 0 && ' '}<sup className="pv">{p.v}</sup>{smallCaps(p.text, `${p.v}-`)}</Fragment>
      ))}
    </>
  );
});

export const Scripture = memo(function Scripture({ text, reveal }: { text: string; reveal?: boolean }) {
  if (!reveal) return <>{smallCaps(text)}</>;
  const list = phrases(text);
  return (
    <>
      {list.map((p, i) => (
        <span key={i} className="ph" style={{ '--i': Math.min(i, 9) } as CSSProperties}>{smallCaps(p, `${i}-`)}</span>
      ))}
    </>
  );
});
