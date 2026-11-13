import { useEffect, useState } from 'react';
import { formatRef } from '../lib/books';
import { centreVerse } from '../lib/centre';
import { CrossScene } from './CrossScene';
import { Scripture } from './Scripture';

// The opening moment: each time the app is opened, the cross and the name of
// Jesus are shown for a few seconds before the app itself. A tap moves on.

/** How long the opening moment stays, fade included. */
export const OPENING_MS = 3600;

/** The name and the day's verse, set over the sky above the cross. */
export function CentreWords() {
  const v = centreVerse();
  return (
    <div className="centre-words">
      <h1 className="centre-name">Jesus</h1>
      <p className="centre-verse"><Scripture text={v.text} /></p>
      <p className="centre-ref">{formatRef(v)}</p>
    </div>
  );
}

const SEEN = 'chestnut.opening';
const GAP = 5 * 60 * 1000;

/** True when the opening moment should play: not again within a few minutes in the same tab, so a reload does not replay it. */
export function openingDue(): boolean {
  try {
    const last = Number(sessionStorage.getItem(SEEN) ?? 0);
    if (Date.now() - last < GAP) return false;
    sessionStorage.setItem(SEEN, String(Date.now()));
  } catch { /* private windows may refuse storage: play it */ }
  return true;
}

export function Opening() {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');
  useEffect(() => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const a = window.setTimeout(() => setPhase(calm ? 'gone' : 'out'), calm ? 2400 : OPENING_MS - 700);
    const b = window.setTimeout(() => setPhase('gone'), OPENING_MS);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);
  if (phase === 'gone') return null;
  const v = centreVerse();
  return (
    <div className={'opening ' + phase} role="img" aria-label={`A wooden cross on a hill at sunrise. Jesus. ${v.text} ${formatRef(v)}`} onClick={() => setPhase('gone')}>
      <CrossScene variant="tall" live />
      <CentreWords />
    </div>
  );
}
