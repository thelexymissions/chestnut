import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import { topicById, topicLabel } from '../data/topics';
import { getVerse, loadBible, stepRef, useBible } from '../lib/bible';
import { chapterPath, formatRef, formatRefShort, keyOf, refOf, type Ref, type VerseKey } from '../lib/books';
import { buildFeed, cardByKey, displayTopic, sessionSeed, type Card } from '../lib/feed';
import { navigate } from '../lib/router';
import { hash, nextScene, pickScene, sceneById, type Mood, type Scene } from '../lib/scenes';
import { speak, speechSupported, useSpeaking } from '../lib/speech';
import { save, toggleSaved, update, useStore } from '../lib/store';
import {
  IconBack, IconBook, IconBookmark, IconForward, IconGrid, IconMore, IconNote, IconReturn, IconShare, IconSpeaker, IconStop,
} from '../components/Icons';
import { SceneView } from '../components/Scene';
import { Scripture } from '../components/Scripture';
import { NotesSheet, QuickActions, ShareSheet, type VerseLike } from '../components/VerseSheets';
import { buzz, HAPTIC, TabBar, toast } from '../components/ui';

const ALL_MOODS: Mood[] = ['dawn', 'sky', 'deep', 'forest', 'ember', 'earth', 'dusk', 'light'];

function moodsFor(key: VerseKey, topicId?: string): Mood[] {
  const t = topicId ? topicById(topicId) : undefined;
  if (t) return t.moods;
  return [ALL_MOODS[hash(key) % ALL_MOODS.length]];
}

export function sceneFor(key: VerseKey, topicId: string | undefined, override?: string): Scene {
  return (override && sceneById(override)) || pickScene(key, moodsFor(key, topicId));
}

/** A verse as shown on a card: the card's own verse, or one reached by swiping sideways. */
interface Shown extends Ref { key: VerseKey; text: string; topics: string[] }

function verseAt(r: Ref | undefined): Shown | undefined {
  if (!r) return undefined;
  const key = keyOf(r);
  const card = cardByKey(key);
  if (card) return card;
  const text = getVerse(r);
  return text ? { ...r, key, text, topics: [] } : undefined;
}

type Size = 'xl' | 'lg' | 'md' | 'sm' | 'xs' | 'xxs';
const sizeClass = (n: number): Size => (n <= 70 ? 'xl' : n <= 120 ? 'lg' : n <= 185 ? 'md' : n <= 260 ? 'sm' : n <= 340 ? 'xs' : 'xxs');
const BASE_SIZE: Record<Size, number> = { xl: 46, lg: 40, md: 34, sm: 29, xs: 25, xxs: 22 };
const SCALES = [0.9, 1, 1.14];

let measurer: CanvasRenderingContext2D | null | undefined;
/** Width of the verse's widest word at a given size, so no word is ever broken across lines. */
function widestWord(text: string, size: number): number {
  if (measurer === undefined) measurer = document.createElement('canvas').getContext('2d');
  if (!measurer) return 0;
  measurer.font = `600 ${size}px "Cormorant Garamond", Georgia, serif`;
  let max = 0;
  for (const w of text.split(/\s+/)) max = Math.max(max, measurer.measureText(w + '\u201D').width);
  return max;
}

// ---------- one verse, typeset to fit ----------
const Panel = memo(function Panel({ verse, topic, origin, reveal, onReturn, onStep, canPrev, canNext }: {
  verse: Shown;
  topic?: string;
  /** set when this is not the card's own verse: offers the way back */
  origin?: Ref;
  reveal: boolean;
  onReturn?: () => void;
  onStep?: (dir: -1 | 1) => void;
  canPrev?: boolean;
  canNext?: boolean;
}) {
  const box = useRef<HTMLElement>(null);
  const textEl = useRef<HTMLParagraphElement>(null);
  const textSize = useStore((s) => s.textSize);

  // largest type at which the whole verse fits
  useLayoutEffect(() => {
    const b = box.current, el = textEl.current;
    if (!b || !el) return;
    const fit = () => {
      const w = b.clientWidth;
      if (!w) return;
      const widthFactor = Math.min(1.15, Math.max(0.8, w / 400));
      let size = Math.round(BASE_SIZE[sizeClass(verse.text.length)] * widthFactor * SCALES[textSize]);
      const room = el.clientWidth || w - 108;
      const widest = widestWord(verse.text, size);
      if (widest > room) size = Math.max(15, Math.floor(size * (room / widest)));
      el.style.fontSize = size + 'px';
      let guard = 0;
      while (b.scrollHeight > b.clientHeight + 1 && size > 15 && guard++ < 60) {
        size -= 1;
        el.style.fontSize = size + 'px';
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    document.fonts?.ready.then(fit).catch(() => undefined);
    return () => ro.disconnect();
  }, [verse.key, verse.text, textSize, topic, origin]);

  const ref = formatRef(verse);
  return (
    <article className="panel" ref={box} aria-label={`${ref}. ${verse.text}`}>
      {origin ? (
        <button className="card-return" onClick={onReturn} aria-label={`Back to ${formatRef(origin)}`}>
          <IconReturn size={14} />{formatRef(origin)}
        </button>
      ) : topic ? <div className="card-topic">{topicLabel(topic)}</div> : <span className="card-topic ghost" aria-hidden />}
      <p className="card-text" ref={textEl}><Scripture text={verse.text} reveal={reveal} /></p>
      <span className="card-rule" aria-hidden />
      <div className="card-refrow">
        <button className="refstep" aria-label="Previous verse" disabled={!canPrev} onClick={() => onStep?.(-1)}><IconBack size={17} /></button>
        <button className="card-ref" onClick={() => navigate(chapterPath(verse.b, verse.c, verse.v))} aria-label={`${ref}. Read the chapter`}>
          <b className="full">{ref.length > 17 ? formatRefShort(verse) : ref}</b><b className="short">{formatRefShort(verse)}</b><span>KJV</span><IconBook size={14} />
        </button>
        <button className="refstep" aria-label="Next verse" disabled={!canNext} onClick={() => onStep?.(1)}><IconForward size={17} /></button>
      </div>
    </article>
  );
});

interface CardHandlers {
  onNote: (v: Shown) => void;
  onShare: (v: Shown, scene: Scene) => void;
  onMore: (v: Shown, originKey: VerseKey, topicId?: string) => void;
  onTap: () => void;
}
export interface CardApi { step: (dir: -1 | 1) => void }

const VerseCard = memo(function VerseCard({ card, topicId, active, hero, bibleReady, handlers, api }: {
  card: Card;
  topicId?: string;
  active: boolean;
  hero: boolean;
  bibleReady: boolean;
  handlers: CardHandlers;
  api: MutableRefObject<CardApi | null>;
}) {
  // how many verses the reader has moved sideways from the card's own verse
  const [offset, setOffset] = useState(0);
  const shown: Shown = (offset !== 0 && verseAt(stepRef(card, offset))) || card;
  const prev = active && bibleReady ? verseAt(stepRef(shown, -1)) : undefined;
  const next = active && bibleReady ? verseAt(stepRef(shown, 1)) : undefined;

  const saved = useStore((s) => s.saved[shown.key] !== undefined);
  const noteCount = useStore((s) => s.notes[shown.key]?.length ?? 0);
  const override = useStore((s) => s.bg[card.key]);
  const speaking = useSpeaking() === shown.key;
  const scene = sceneFor(card.key, topicId, override);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [shine, setShine] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const g = useRef({ x: 0, y: 0, t: 0, lx: 0, lt: 0, vx: 0, down: false, moved: false, horizontal: false, long: false, lastTap: 0, timer: 0, tapTimer: 0 });

  useEffect(() => { if (!active) setOffset(0); }, [active]);

  const setDrag = (px: number) => track.current?.style.setProperty('--drag', `${px}px`);

  /** Slides the row of verses to rest: on the neighbour (dir) or back where it was (0). */
  const settle = useCallback((dir: -1 | 0 | 1) => {
    const el = track.current, w = root.current?.clientWidth ?? 0;
    if (!el) return;
    el.classList.add('settling');
    setDrag(-dir * w);
    if (dir === 0) {
      window.setTimeout(() => el.classList.remove('settling'), 440);
      return;
    }
    busy.current = true;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      el.removeEventListener('transitionend', done);
      flushSync(() => setOffset((o) => o + dir));
      el.classList.remove('settling');
      setDrag(0);
      busy.current = false;
    };
    el.addEventListener('transitionend', done);
    window.setTimeout(done, 480);
  }, []);

  const step = useCallback((dir: -1 | 1) => {
    if (busy.current) return;
    if (!(dir < 0 ? prev : next)) {
      if (!bibleReady) loadBible().catch(() => undefined);
      return;
    }
    buzz(HAPTIC.tap);
    settle(dir);
  }, [prev, next, bibleReady, settle]);

  useEffect(() => {
    if (!active) return;
    api.current = { step };
    return () => { if (api.current?.step === step) api.current = null; };
  }, [active, step, api]);

  const onReturn = useCallback(() => { buzz(HAPTIC.tap); setOffset(0); }, []);

  const celebrateSave = (x?: number, y?: number) => {
    buzz(HAPTIC.save);
    setShine(Date.now());
    if (x !== undefined && y !== undefined) {
      setBurst({ x, y, id: Date.now() });
      window.setTimeout(() => setBurst(null), 900);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button,a,input,textarea,[data-nogesture]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s = g.current;
    s.x = e.clientX; s.y = e.clientY; s.t = e.timeStamp; s.lx = e.clientX; s.lt = e.timeStamp; s.vx = 0;
    s.down = true; s.moved = false; s.horizontal = false; s.long = false;
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => {
      if (s.down && !s.moved) {
        // the menu covers the card, so the gesture ends here
        s.long = true;
        s.down = false;
        buzz(HAPTIC.hold);
        handlers.onMore(shown, card.key, topicId);
      }
    }, 480);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.down) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { s.down = false; if (s.horizontal) settle(0); return; }
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) > 10) { s.moved = true; window.clearTimeout(s.timer); }
    if (!s.horizontal && !busy.current && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      s.horizontal = true;
      track.current?.classList.remove('settling');
      if (!bibleReady) loadBible().catch(() => undefined);
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (s.horizontal) {
      const dt = e.timeStamp - s.lt;
      if (dt > 0) s.vx = 0.7 * ((e.clientX - s.lx) / dt) + 0.3 * s.vx;
      s.lx = e.clientX; s.lt = e.timeStamp;
      // nothing that way (or not loaded yet): the row resists
      const blocked = dx > 0 ? !prev : !next;
      setDrag(blocked ? dx * 0.22 : dx);
    }
  };
  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const s = g.current;
    if (!s.down) return;
    s.down = false;
    window.clearTimeout(s.timer);
    const dx = e.clientX - s.x;
    if (s.horizontal) {
      const w = root.current?.clientWidth ?? 360;
      // a finger that stopped before lifting is placing the card, not flicking it
      if (e.timeStamp - s.lt > 90) s.vx = 0;
      const dir: -1 | 1 = dx < 0 ? 1 : -1;
      const far = Math.abs(dx) > w * 0.22 || (Math.abs(dx) > 24 && Math.abs(s.vx) > 0.45 && Math.sign(s.vx) === Math.sign(dx));
      const can = dir > 0 ? !!next : !!prev;
      if (!cancelled && far && can) { buzz(HAPTIC.tap); settle(dir); }
      else settle(0);
      return;
    }
    if (cancelled || s.long || s.moved) return;
    const now = Date.now();
    if (now - s.lastTap < 300) {
      window.clearTimeout(s.tapTimer);
      s.lastTap = 0;
      const r = root.current!.getBoundingClientRect();
      save(shown.key);
      celebrateSave(e.clientX - r.left, e.clientY - r.top);
    } else {
      s.lastTap = now;
      s.tapTimer = window.setTimeout(() => handlers.onTap(), 300);
    }
  };

  useEffect(() => () => { window.clearTimeout(g.current.timer); window.clearTimeout(g.current.tapTimer); }, []);

  const ref = formatRef(shown);
  const away = offset !== 0;
  return (
    <div
      ref={root}
      className={`card ink-${scene.ink}${active ? ' active' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onContextMenu={(e) => {
        e.preventDefault();
        const s = g.current;
        if (s.long) return;
        // The phone's own long-press can arrive before our timer. End the gesture here,
        // or lifting the finger would be read as a tap and hide the buttons behind the menu.
        window.clearTimeout(s.timer);
        window.clearTimeout(s.tapTimer);
        s.long = true;
        s.down = false;
        handlers.onMore(shown, card.key, topicId);
      }}
    >
      <SceneView scene={scene} live={active} hero={hero} />
      {shine > 0 && <i className="shine" key={shine} aria-hidden />}

      <div className="card-track" ref={track}>
        <div className="slot" inert>{prev && <Panel verse={prev} reveal={false} topic={offset === 1 ? topicId : undefined} origin={offset === 1 ? undefined : card} canPrev canNext />}</div>
        <div className="slot">
          <Panel verse={shown} topic={away ? undefined : topicId} origin={away ? card : undefined} reveal={!away}
            onReturn={onReturn} onStep={step} canPrev={!!prev} canNext={!!next} />
        </div>
        <div className="slot" inert>{next && <Panel verse={next} reveal={false} topic={offset === -1 ? topicId : undefined} origin={offset === -1 ? undefined : card} canPrev canNext />}</div>
      </div>

      <div className="rail">
        <button className={'rail-btn' + (saved ? ' on' : '')} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save verse'}
          onClick={() => { const now = toggleSaved(shown.key); if (now) { celebrateSave(); toast('Saved'); } else buzz(HAPTIC.tap); }}>
          <IconBookmark size={27} filled={saved} /><span>{saved ? 'Saved' : 'Save'}</span>
        </button>
        <button className="rail-btn" aria-label={noteCount ? `Your notes (${noteCount})` : 'Add a note'} onClick={() => handlers.onNote(shown)}>
          <IconNote size={27} /><span>{noteCount || 'Note'}</span>
        </button>
        <button className="rail-btn" aria-label="Share" onClick={() => handlers.onShare(shown, scene)}>
          <IconShare size={26} /><span>Share</span>
        </button>
        {speechSupported() && (
          <button className={'rail-btn' + (speaking ? ' on' : '')} aria-label={speaking ? 'Stop reading' : 'Listen'}
            onClick={() => speak(shown.key, [`${shown.text} ${ref}.`])}>
            {speaking ? <IconStop size={26} /> : <IconSpeaker size={27} />}<span>{speaking ? 'Stop' : 'Listen'}</span>
          </button>
        )}
        <button className="rail-btn" aria-label="More actions" onClick={() => handlers.onMore(shown, card.key, topicId)}>
          <IconMore size={27} /><span>More</span>
        </button>
      </div>

      {burst && (
        <div className="burst" key={burst.id} style={{ left: burst.x, top: burst.y }} aria-hidden>
          <IconBookmark size={96} filled />
        </div>
      )}
    </div>
  );
});

const positions = new Map<string, number>();

function GestureTips({ onClose }: { onClose: () => void }) {
  const tips: [string, string][] = [
    ['Swipe up', 'Next verse on your topics'],
    ['Swipe left or right', 'The verse after or before it'],
    ['Double-tap', 'Save it'],
    ['Press and hold', 'Copy, share, memorise and more'],
    ['Tap the reference', 'Read the whole chapter'],
    ['Tap', 'Hide the buttons'],
  ];
  return (
    <div className="tips" data-nogesture role="dialog" aria-label="How to use the verse feed">
      <div className="tips-box">
        <h2>How it works</h2>
        <ul>{tips.map(([a, b]) => <li key={a}><strong>{a}</strong><span>{b}</span></li>)}</ul>
        <button className="btn wide" onClick={onClose}>Start reading</button>
      </div>
    </div>
  );
}

export function Feed({ mode, first }: { mode: 'topics' | 'saved'; first?: Ref }) {
  const topics = useStore((s) => s.topics);
  const savedMap = useStore((s) => s.saved);
  const hintsSeen = useStore((s) => s.hintsSeen);
  const firstKey = first ? keyOf(first) : undefined;

  // verses not on the curated list (saved from the Bible, or opened by link) need the Bible itself
  const needsBible = useMemo(() => {
    if (firstKey && !cardByKey(firstKey)) return true;
    return mode === 'saved' && Object.keys(savedMap).some((k) => !cardByKey(k));
  }, [firstKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const bible = useBible();
  const bibleReady = bible.ready;

  // the saved list is frozen when the feed opens so un-saving does not make cards jump
  const savedKeys = useMemo(() => Object.keys(savedMap).sort((a, b) => savedMap[b] - savedMap[a]), [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards: Card[] = useMemo(() => {
    const fromBible = (k: VerseKey): Card | undefined => {
      const r = refOf(k);
      const text = getVerse(r);
      return text ? { ...r, key: k, text, topics: [] } : undefined;
    };
    if (mode === 'saved') {
      return savedKeys.map((k) => cardByKey(k) ?? fromBible(k)).filter((c): c is Card => !!c);
    }
    const list = buildFeed(topics, sessionSeed, firstKey);
    if (firstKey && !cardByKey(firstKey)) {
      const c = fromBible(firstKey);
      if (c) list.unshift(c);
    }
    return list;
  }, [mode, topics, firstKey, savedKeys, bibleReady]);

  const sig = `${mode}|${topics.join(',')}|${firstKey ?? ''}`;
  const scroller = useRef<HTMLDivElement>(null);
  const cardApi = useRef<CardApi | null>(null);
  const [index, setIndex] = useState(() => positions.get(sig) ?? 0);
  const [clean, setClean] = useState(false);
  const [noteFor, setNoteFor] = useState<VerseLike | null>(null);
  const [shareFor, setShareFor] = useState<{ verse: VerseLike; scene: Scene } | null>(null);
  const [moreFor, setMoreFor] = useState<{ verse: Shown; originKey: VerseKey; topicId?: string } | null>(null);
  const bgOverrides = useStore((s) => s.bg);

  useLayoutEffect(() => {
    const el = scroller.current;
    const i = positions.get(sig) ?? 0;
    if (el) el.scrollTop = i * el.clientHeight;
    setIndex(i);
  }, [sig, cards.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    setIndex((old) => {
      if (old !== i) positions.set(sig, i);
      return i;
    });
  }, [sig]);

  const go = useCallback((delta: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: (Math.round(el.scrollTop / el.clientHeight) + delta) * el.clientHeight, behavior: 'smooth' });
  }, []);

  const topicOf = useCallback((c: Card) => (mode === 'saved' ? c.topics[0] : displayTopic(c, topics)), [mode, topics]);

  const handlers: CardHandlers = useMemo(() => ({
    // opening anything brings the buttons back, so nothing is left hidden behind a sheet
    onNote: (v) => { setClean(false); setNoteFor(v); },
    onShare: (v, scene) => { setClean(false); setShareFor({ verse: v, scene }); },
    onMore: (v, originKey, topicId) => { setClean(false); setMoreFor({ verse: v, originKey, topicId }); },
    onTap: () => setClean((v) => !v),
  }), []);

  // someone opening a shared link sees the verse first; the tips wait for a normal visit
  const showTips = !hintsSeen && !first;
  const overlayOpen = !!(noteFor || shareFor || moreFor) || showTips;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlayOpen || (e.target as Element)?.closest?.('input,textarea')) return;
      const c = cards[index];
      if (['ArrowDown', 'PageDown', 'j', ' '].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (!c) return;
      else if (e.key === 'ArrowRight') cardApi.current?.step(1);
      else if (e.key === 'ArrowLeft') cardApi.current?.step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cards, index, go, overlayOpen]);

  const label = mode === 'saved'
    ? 'Saved verses'
    : topics.length === 0 ? 'All topics'
    : topics.length <= 2 ? topics.map(topicLabel).join(' · ')
    : `${topicLabel(topics[0])} +${topics.length - 1}`;

  // a verse that is not on the curated list is read from the Bible itself: wait for it
  // rather than flash a different verse first
  const waitingForBible = needsBible && !bible.ready && !bible.error;
  if (waitingForBible && firstKey && !cardByKey(firstKey)) {
    return (
      <div className="feed">
        <div className="feed-wait" role="status">Opening the Bible…</div>
        <TabBar overlay />
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="feed empty-feed">
        <div className="empty">
          {waitingForBible ? <p>Opening the Bible…</p> : mode === 'saved' ? (
            <>
              <h2>No saved verses yet</h2>
              <p>Double-tap any verse to save it, and it will appear here.</p>
              <button className="btn" onClick={() => navigate('/feed')}>Browse verses</button>
            </>
          ) : (
            <>
              <h2>No verses for these topics</h2>
              <button className="btn" onClick={() => { update(() => ({ topics: [] })); }}>Show all topics</button>
            </>
          )}
        </div>
        <TabBar />
      </div>
    );
  }

  const more = moreFor;
  return (
    <div className={'feed' + (clean ? ' clean' : '')}>
      <div className="feed-scroll" ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="Verses">
        {cards.map((c, i) => (
          <section className="slide" key={c.key} inert={i !== index}>
            {Math.abs(i - index) <= 2 && (
              <VerseCard card={c} topicId={topicOf(c)} active={i === index} hero={!!first && i === index} bibleReady={bibleReady} handlers={handlers} api={cardApi} />
            )}
          </section>
        ))}
        <section className="slide end-slide">
          <div className="end">
            <span className="end-mark" aria-hidden>{'❦'}</span>
            <h2>{mode === 'saved' ? 'That is everything you have saved' : `You have read all ${cards.length} verses here`}</h2>
            <p>{mode === 'saved' ? 'Find more in the feed.' : 'Choose another topic, or open the Bible and keep reading.'}</p>
            <div className="row gap center">
              <button className="btn light" onClick={() => navigate(mode === 'saved' ? '/feed' : '/')}>{mode === 'saved' ? 'Browse verses' : 'Choose topics'}</button>
              <button className="btn ghost-light" onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })}>Back to the start</button>
            </div>
          </div>
        </section>
      </div>

      <header className="feed-top" data-nogesture>
        <button className="pill" onClick={() => navigate(mode === 'saved' ? '/saved' : '/')} aria-label={`${label}. Change topics`}>
          <IconGrid size={16} /><span>{label}</span>
        </button>
        <span className="feed-count" aria-hidden>{Math.min(index + 1, cards.length)} / {cards.length}</span>
      </header>

      <TabBar overlay />

      {showTips && <GestureTips onClose={() => update(() => ({ hintsSeen: true }))} />}

      <NotesSheet verse={noteFor} onClose={() => setNoteFor(null)} />
      <ShareSheet verse={shareFor?.verse ?? null} scene={shareFor?.scene ?? null} onClose={() => setShareFor(null)} />
      <QuickActions
        verse={more?.verse ?? null}
        onClose={() => setMoreFor(null)}
        onNote={() => more && setNoteFor(more.verse)}
        onShare={() => more && setShareFor({ verse: more.verse, scene: sceneFor(more.originKey, more.topicId, bgOverrides[more.originKey]) })}
        onChangeBackground={() => {
          if (!more) return;
          const current = sceneFor(more.originKey, more.topicId, bgOverrides[more.originKey]);
          const next = nextScene(current.id, moodsFor(more.originKey, more.topicId));
          update((s) => ({ bg: { ...s.bg, [more.originKey]: next.id } }));
        }}
      />
    </div>
  );
}
