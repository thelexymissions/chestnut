import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { topicById, topicLabel, TOPICS } from '../data/topics';
import { getVerse, useBible } from '../lib/bible';
import { chapterPath, formatRef, keyOf, refOf, type Ref, type VerseKey } from '../lib/books';
import { buildFeed, cardByKey, displayTopic, sessionSeed, type Card } from '../lib/feed';
import { navigate } from '../lib/router';
import { hash, nextScene, pickScene, sceneById, sceneUrl, type Mood, type Scene } from '../lib/scenes';
import { speak, speechSupported, useSpeaking } from '../lib/speech';
import { save, toggleSaved, update, useStore } from '../lib/store';
import {
  IconBookmark, IconGrid, IconMore, IconNote, IconShare, IconSpeaker, IconStop,
} from '../components/Icons';
import { NotesSheet, QuickActions, ShareSheet, type VerseLike } from '../components/VerseSheets';
import { buzz, TabBar, toast } from '../components/ui';

const ALL_MOODS: Mood[] = ['dawn', 'sky', 'deep', 'forest', 'ember', 'earth', 'dusk', 'light'];

function moodsFor(card: Card, topicId?: string): Mood[] {
  const t = topicId ? topicById(topicId) : undefined;
  if (t) return t.moods;
  return [ALL_MOODS[hash(card.key) % ALL_MOODS.length]];
}

export function sceneFor(card: Card, topicId: string | undefined, override?: string): Scene {
  return (override && sceneById(override)) || pickScene(card.key, moodsFor(card, topicId));
}

type Size = 'xl' | 'lg' | 'md' | 'sm' | 'xs' | 'xxs';
const sizeClass = (n: number): Size => (n <= 70 ? 'xl' : n <= 120 ? 'lg' : n <= 185 ? 'md' : n <= 260 ? 'sm' : n <= 340 ? 'xs' : 'xxs');
const BASE_SIZE: Record<Size, number> = { xl: 46, lg: 40, md: 34, sm: 29, xs: 25, xxs: 22 };

interface CardHandlers {
  onNote: (c: Card) => void;
  onShare: (c: Card, scene: Scene) => void;
  onMore: (c: Card, scene: Scene) => void;
  onTap: () => void;
  onSwipe: (c: Card, dir: 'left' | 'right') => void;
}

const VerseCard = memo(function VerseCard({ card, topicId, active, handlers }: {
  card: Card;
  topicId?: string;
  active: boolean;
  handlers: CardHandlers;
}) {
  const saved = useStore((s) => s.saved[card.key] !== undefined);
  const noteCount = useStore((s) => s.notes[card.key]?.length ?? 0);
  const override = useStore((s) => s.bg[card.key]);
  const speaking = useSpeaking() === card.key;
  const scene = sceneFor(card, topicId, override);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const textEl = useRef<HTMLParagraphElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const textSize = useStore((s) => s.textSize);

  // largest type at which the whole verse fits this card
  useLayoutEffect(() => {
    const box = content.current, el = textEl.current;
    if (!box || !el) return;
    const fit = () => {
      const w = box.clientWidth;
      if (!w) return;
      const widthFactor = Math.min(1.15, Math.max(0.8, w / 400));
      let size = Math.round(BASE_SIZE[sizeClass(card.text.length)] * widthFactor * [0.9, 1, 1.14][textSize]);
      el.style.fontSize = size + 'px';
      let guard = 0;
      while (box.scrollHeight > box.clientHeight + 1 && size > 15 && guard++ < 60) {
        size -= 1;
        el.style.fontSize = size + 'px';
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    document.fonts?.ready.then(fit).catch(() => undefined);
    return () => ro.disconnect();
  }, [card.key, card.text, textSize, topicId]);
  const g = useRef({ x: 0, y: 0, t: 0, down: false, moved: false, horizontal: false, long: false, lastTap: 0, timer: 0, tapTimer: 0 });

  const setDrag = (dx: number) => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty('--drag', `${dx}px`);
    el.dataset.drag = dx < -24 ? 'left' : dx > 24 ? 'right' : '';
  };

  const doSave = (x: number, y: number) => {
    save(card.key);
    buzz(14);
    setBurst({ x, y, id: Date.now() });
    window.setTimeout(() => setBurst(null), 900);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button,a,input,textarea,[data-nogesture]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s = g.current;
    s.x = e.clientX; s.y = e.clientY; s.t = Date.now();
    s.down = true; s.moved = false; s.horizontal = false; s.long = false;
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => {
      if (s.down && !s.moved) {
        // the menu covers the card, so the gesture ends here
        s.long = true;
        s.down = false;
        buzz(18);
        handlers.onMore(card, scene);
      }
    }, 480);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.down) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { s.down = false; setDrag(0); return; }
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) > 10) { s.moved = true; window.clearTimeout(s.timer); }
    if (!s.horizontal && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      s.horizontal = true;
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (s.horizontal) setDrag(dx);
  };
  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const s = g.current;
    if (!s.down) return;
    s.down = false;
    window.clearTimeout(s.timer);
    const dx = e.clientX - s.x;
    if (s.horizontal) {
      setDrag(0);
      if (!cancelled && Math.abs(dx) > 72) handlers.onSwipe(card, dx < 0 ? 'left' : 'right');
      return;
    }
    if (cancelled || s.long || s.moved) return;
    const now = Date.now();
    if (now - s.lastTap < 300) {
      window.clearTimeout(s.tapTimer);
      s.lastTap = 0;
      const r = root.current!.getBoundingClientRect();
      doSave(e.clientX - r.left, e.clientY - r.top);
    } else {
      s.lastTap = now;
      s.tapTimer = window.setTimeout(() => handlers.onTap(), 300);
    }
  };

  useEffect(() => () => { window.clearTimeout(g.current.timer); window.clearTimeout(g.current.tapTimer); }, []);

  const ref = formatRef(card);
  return (
    <div
      ref={root}
      className={`card ink-${scene.ink}${active ? ' active' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onContextMenu={(e) => { e.preventDefault(); if (!g.current.long) handlers.onMore(card, scene); }}
    >
      <div className={'card-bg' + (scene.kind === 'photo' ? ' photo' : '')} style={{ backgroundImage: `url("${sceneUrl(scene)}")` }} />
      <div className="swipe-hint left" aria-hidden>Read chapter</div>
      <div className="swipe-hint right" aria-hidden>Topics</div>

      <article className="card-content" ref={content} aria-label={`${ref}. ${card.text}`}>
        {topicId && <div className="card-topic">{topicLabel(topicId)}</div>}
        <span className="card-mark" aria-hidden>{'“'}</span>
        <p className={'card-text ' + sizeClass(card.text.length)} ref={textEl}>{card.text}</p>
        <span className="card-rule" aria-hidden />
        <div className="card-ref">{ref} <span>KJV</span></div>
      </article>

      <div className="rail">
        <button className={'rail-btn' + (saved ? ' on' : '')} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save verse'}
          onClick={() => { const now = toggleSaved(card.key); buzz(10); if (now) toast('Saved'); }}>
          <IconBookmark size={27} filled={saved} /><span>{saved ? 'Saved' : 'Save'}</span>
        </button>
        <button className="rail-btn" aria-label={noteCount ? `Your notes (${noteCount})` : 'Add a note'} onClick={() => handlers.onNote(card)}>
          <IconNote size={27} /><span>{noteCount || 'Note'}</span>
        </button>
        <button className="rail-btn" aria-label="Share" onClick={() => handlers.onShare(card, scene)}>
          <IconShare size={26} /><span>Share</span>
        </button>
        {speechSupported() && (
          <button className={'rail-btn' + (speaking ? ' on' : '')} aria-label={speaking ? 'Stop reading' : 'Listen'}
            onClick={() => speak(card.key, [`${card.text} ${ref}.`])}>
            {speaking ? <IconStop size={26} /> : <IconSpeaker size={27} />}<span>{speaking ? 'Stop' : 'Listen'}</span>
          </button>
        )}
        <button className="rail-btn" aria-label="More actions" onClick={() => handlers.onMore(card, scene)}>
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
    ['Swipe up', 'Next verse'],
    ['Double-tap', 'Save it'],
    ['Press and hold', 'Copy, share, notes and more'],
    ['Swipe left', 'Read the whole chapter'],
    ['Swipe right', 'Back to topics'],
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
  const [index, setIndex] = useState(() => positions.get(sig) ?? 0);
  const [clean, setClean] = useState(false);
  const [noteFor, setNoteFor] = useState<VerseLike | null>(null);
  const [shareFor, setShareFor] = useState<{ verse: VerseLike; scene: Scene } | null>(null);
  const [moreFor, setMoreFor] = useState<{ card: Card; topicId?: string } | null>(null);
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
    onNote: (c) => setNoteFor(c),
    onShare: (c, scene) => setShareFor({ verse: c, scene }),
    onMore: (c) => setMoreFor({ card: c, topicId: topicOf(c) }),
    onTap: () => setClean((v) => !v),
    onSwipe: (c, dir) => {
      if (dir === 'left') navigate(chapterPath(c.b, c.c, c.v));
      else navigate(mode === 'saved' ? '/saved' : '/');
    },
  }), [mode, topicOf]);

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
      else if (e.key === 's') { const now = toggleSaved(c.key); toast(now ? 'Saved' : 'Removed from saved'); }
      else if (e.key === 'n') setNoteFor(c);
      else if (e.key === 'ArrowRight') navigate(chapterPath(c.b, c.c, c.v));
      else if (e.key === 'ArrowLeft') navigate(mode === 'saved' ? '/saved' : '/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cards, index, go, overlayOpen, mode]);

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
    const waiting = waitingForBible;
    return (
      <div className="feed empty-feed">
        <div className="empty">
          {waiting ? <p>Opening the Bible…</p> : mode === 'saved' ? (
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
            {Math.abs(i - index) <= 2 && <VerseCard card={c} topicId={topicOf(c)} active={i === index} handlers={handlers} />}
          </section>
        ))}
        <section className="slide end-slide">
          <div className="end">
            <span className="card-mark" aria-hidden>{'❦'}</span>
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
        verse={more?.card ?? null}
        onClose={() => setMoreFor(null)}
        onNote={() => more && setNoteFor(more.card)}
        onShare={() => more && setShareFor({ verse: more.card, scene: sceneFor(more.card, more.topicId, bgOverrides[more.card.key]) })}
        onChangeBackground={() => {
          if (!more) return;
          const current = sceneFor(more.card, more.topicId, bgOverrides[more.card.key]);
          const next = nextScene(current.id, moodsFor(more.card, more.topicId));
          update((s) => ({ bg: { ...s.bg, [more.card.key]: next.id } }));
        }}
      />
    </div>
  );
}

export { TOPICS };
