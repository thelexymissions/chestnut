import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chapterPath, formatRef } from '../lib/books';
import { buildDeck, CAT_LABEL, CAT_MOODS, type Fact } from '../lib/facts';
import { sessionSeed } from '../lib/feed';
import { navigate } from '../lib/router';
import { pickScene } from '../lib/scenes';
import { copyText } from '../lib/share';
import { getState, markJourney, useStore, voteFact } from '../lib/store';
import { IconBook, IconCheck, IconLink, IconShare, IconThumbDown, IconThumbUp } from '../components/Icons';
import { SceneView } from '../components/Scene';
import { SoundButton } from '../components/Sound';
import { buzz, HAPTIC, ModeSwitch, TabBar, toast } from '../components/ui';

// Bible trivia: a second deck of cards, kept apart from the verses. Each card
// asks a question; a tap shows the answer with where it comes from.

const factUrl = (id: string) => `${location.origin}${location.pathname}#/trivia/${id}`;

async function shareFact(f: Fact) {
  const text = `${f.q}\n${f.a}. ${f.more}`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Bible trivia · Chestnut', text, url: factUrl(f.id) });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  toast((await copyText(`${text}\n\n${factUrl(f.id)}`)) ? 'Copied' : 'Could not copy');
}

const FactCard = memo(function FactCard({ fact, active, open, onReveal }: {
  fact: Fact;
  active: boolean;
  open: boolean;
  onReveal: (id: string) => void;
}) {
  const vote = useStore((s) => s.factVotes[fact.id]);
  const scene = pickScene(fact.id, CAT_MOODS[fact.cat]);
  return (
    <div
      className={`card fact ink-${scene.ink}${active ? ' active' : ''}${open ? ' open' : ''}`}
      onClick={(e) => { if (!open && !(e.target as Element).closest('button,a')) onReveal(fact.id); }}
    >
      <SceneView scene={scene} live={active} />
      <div className="fact-body">
        <div className="card-topic">{CAT_LABEL[fact.cat]}</div>
        <h2 className="fact-q">{fact.q}</h2>
        {open ? (
          <div className="fact-answer" role="status">
            <strong>{fact.a}</strong>
            <p>{fact.more}</p>
            <div className="fact-src" aria-label="Sources">
              {fact.checked && <span className="src-chip plain"><IconCheck size={13} />Checked against the Bible text</span>}
              {fact.refs.map((r) => (
                <button key={formatRef(r)} className="src-chip" onClick={() => navigate(chapterPath(r.b, r.c, r.v))}>
                  <IconBook size={13} />{formatRef(r)}
                </button>
              ))}
              {fact.sources.map((s) => (
                <a key={s.url} className="src-chip" href={s.url} target="_blank" rel="noopener noreferrer"><IconLink size={13} />{s.name}</a>
              ))}
            </div>
          </div>
        ) : (
          <button className="fact-reveal" onClick={() => onReveal(fact.id)}>Tap to reveal</button>
        )}
      </div>

      <div className="rail">
        <button className={'rail-btn' + (vote === 1 ? ' on' : '')} aria-pressed={vote === 1} aria-label="Good one"
          onClick={() => { voteFact(fact.id, 1); buzz(HAPTIC.tap); }}>
          <IconThumbUp size={26} filled={vote === 1} /><span>Good</span>
        </button>
        <button className={'rail-btn' + (vote === -1 ? ' on' : '')} aria-pressed={vote === -1} aria-label="Show this less"
          onClick={() => { const now = voteFact(fact.id, -1); buzz(HAPTIC.tap); if (now === -1) toast('You will see this one less'); }}>
          <IconThumbDown size={26} filled={vote === -1} /><span>Less</span>
        </button>
        <button className="rail-btn" aria-label="Share" onClick={() => shareFact(fact)}>
          <IconShare size={25} /><span>Share</span>
        </button>
      </div>
    </div>
  );
});

let lastIndex = 0;

export function Trivia({ first }: { first?: string }) {
  // the order is fixed when the deck opens, so voting does not shuffle cards under your thumb
  const [deck] = useState(() => buildDeck(getState().factVotes, sessionSeed, first));
  const [index, setIndex] = useState(first ? 0 : lastIndex);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const scroller = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = index * el.clientHeight;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    lastIndex = Math.min(i, deck.length - 1);
    setIndex(i);
  }, [deck.length]);

  const reveal = useCallback((id: string) => {
    buzz(HAPTIC.right);
    markJourney('trivia');
    setOpen((o) => ({ ...o, [id]: true }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scroller.current;
      if (!el) return;
      const go = (d: number) => el.scrollTo({ top: (Math.round(el.scrollTop / el.clientHeight) + d) * el.clientHeight, behavior: 'smooth' });
      if (['ArrowDown', 'PageDown', 'j'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if ((e.key === 'Enter' || e.key === ' ') && deck[index] && !(e.target as Element)?.closest?.('button,a')) { e.preventDefault(); reveal(deck[index].id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deck, index, reveal]);

  return (
    <div className="feed trivia">
      <div className="feed-scroll" ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="Bible trivia">
        {deck.map((f, i) => (
          <section className="slide" key={f.id} inert={i !== index}>
            {Math.abs(i - index) <= 2 && <FactCard fact={f} active={i === index} open={!!open[f.id]} onReveal={reveal} />}
          </section>
        ))}
        <section className="slide end-slide">
          <div className="end">
            <span className="end-mark" aria-hidden>{'❦'}</span>
            <h2>That is all {deck.length} cards</h2>
            <p>More will be added over time.</p>
            <div className="row gap center">
              <button className="btn light" onClick={() => navigate('/feed')}>Read verses</button>
              <button className="btn ghost-light" onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })}>Back to the start</button>
            </div>
          </div>
        </section>
      </div>

      <header className="feed-top" data-nogesture>
        <span className="pill still">Bible trivia</span>
        <span className="feed-tools"><SoundButton /><ModeSwitch mode="trivia" /></span>
      </header>
      <TabBar overlay />
    </div>
  );
}
