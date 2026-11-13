import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { topicById, topicLabel } from '../data/topics';
import { getVerse, loadBible, stepRef, useBible, verseCount } from '../lib/bible';
import { chapterPath, formatRef, formatRefShort, keyOf, refOf, type Ref, type VerseKey } from '../lib/books';
import { buildFeed, cardByKey, displayTopic, sessionSeed, type Card } from '../lib/feed';
import { PROMPTS, type Prompt } from '../lib/journey';
import { arrivedFresh, navigate } from '../lib/router';
import { hash, nextScene, pickScene, sceneById, type Mood, type Scene } from '../lib/scenes';
import { speak, speechSupported, useSpeaking } from '../lib/speech';
import { countRead, dayNumber, getState, markJourney, save, toggleSaved, update, useStore } from '../lib/store';
import {
  IconBack, IconBook, IconBookmark, IconForward, IconGrid, IconMore, IconNote, IconReturn, IconShare, IconSpeaker, IconStop,
} from '../components/Icons';
import { SceneView } from '../components/Scene';
import { SoundButton } from '../components/Sound';
import { Scripture } from '../components/Scripture';
import { NotesSheet, QuickActions, ShareSheet, type VerseLike } from '../components/VerseSheets';
import { buzz, HAPTIC, ModeSwitch, TabBar, toast } from '../components/ui';

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

/** How far a finger travels before a card decides which way the swipe is going. */
const SLOP = 12;

/** After a long press some browsers still send a click when the finger lifts. It must not land on the menu that has just opened under it. */
function swallowNextClick() {
  const stop = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 350);
}

/** The verse number to show for a neighbour: just the number in the same chapter, more when it is further off. */
const nearLabel = (from: Ref, to: Ref): string =>
  to.b !== from.b ? formatRefShort(to) : to.c !== from.c ? `${to.c}:${to.v}` : String(to.v);

// ---------- one verse, typeset to fit ----------
const Panel = memo(function Panel({ verse, topic, origin, reveal, onReturn, onStep, ready }: {
  verse: Shown;
  topic?: string;
  /** set when this is not the card's own verse: offers the way back */
  origin?: Ref;
  reveal: boolean;
  onReturn?: () => void;
  onStep?: (dir: -1 | 1) => void;
  /** the Bible is loaded, so the verses either side are known */
  ready: boolean;
}) {
  const box = useRef<HTMLElement>(null);
  const mainEl = useRef<HTMLDivElement>(null);
  const textEl = useRef<HTMLParagraphElement>(null);
  const refEl = useRef<HTMLButtonElement>(null);
  const textSize = useStore((s) => s.textSize);

  // largest type at which the whole verse fits
  useLayoutEffect(() => {
    const b = box.current, el = textEl.current, main = mainEl.current;
    if (!b || !el || !main) return;
    const fit = () => {
      const w = b.clientWidth;
      if (!w) return;
      // the book's full name where it fits in the bar, its short form where it does not
      const r = refEl.current;
      if (r) {
        r.classList.remove('tight', 'tighter');
        if (r.scrollWidth > r.clientWidth + 1) r.classList.add('tight');
        if (r.scrollWidth > r.clientWidth + 1) r.classList.add('tighter');
      }
      const widthFactor = Math.min(1.15, Math.max(0.8, w / 400));
      let size = Math.round(BASE_SIZE[sizeClass(verse.text.length)] * widthFactor * SCALES[textSize]);
      const room = el.clientWidth || w - 108;
      const widest = widestWord(verse.text, size);
      if (widest > room) size = Math.max(15, Math.floor(size * (room / widest)));
      el.style.fontSize = size + 'px';
      let guard = 0;
      while (main.scrollHeight > main.clientHeight + 1 && size > 15 && guard++ < 60) {
        size -= 1;
        el.style.fontSize = size + 'px';
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    document.fonts?.ready.then(fit).catch(() => undefined);
    return () => ro.disconnect();
  }, [verse.key, verse.text, textSize, topic, origin, ready]);

  const ref = formatRef(verse);
  const before = ready ? stepRef(verse, -1) : undefined;
  const after = ready ? stepRef(verse, 1) : undefined;
  const total = ready ? verseCount(verse.b, verse.c) : 0;
  return (
    <article className="panel" ref={box} aria-label={`${ref}. ${verse.text}`}>
      <div className="panel-main" ref={mainEl}>
        {origin ? (
          <button className="card-return" onClick={onReturn} aria-label={`Back to ${formatRef(origin)}`}>
            <IconReturn size={14} />{formatRef(origin)}
          </button>
        ) : topic ? <div className="card-topic">{topicLabel(topic)}</div> : <span className="card-topic ghost" aria-hidden />}
        <p className="card-text" ref={textEl}><Scripture text={verse.text} reveal={reveal} /></p>
      </div>
      {/* The bar for reading on: the verse before, where you are, the verse after. It keeps its place at the foot of
          the card whatever the length of the verse, so a thumb reading on never has to hunt for it; and a swipe
          that starts on it is always sideways. */}
      <div className="ribbon-zone" data-sideways role="group" aria-label="The verse before and the verse after">
        <div className="ribbon">
          <button className="refstep" aria-label={before ? `Previous verse: ${formatRef(before)}` : 'Previous verse'} disabled={ready && !before} onClick={() => onStep?.(-1)}>
            <IconBack size={17} />{before && <span>{nearLabel(verse, before)}</span>}
          </button>
          <button className="card-ref" ref={refEl} onClick={() => { markJourney('around'); navigate(chapterPath(verse.b, verse.c, verse.v)); }} aria-label={`${ref}. Read the chapter`}>
            <b className="full">{ref}</b><b className="short">{formatRefShort(verse)}</b><span>KJV</span><IconBook size={14} />
          </button>
          <button className="refstep" aria-label={after ? `Next verse: ${formatRef(after)}` : 'Next verse'} disabled={ready && !after} onClick={() => onStep?.(1)}>
            {after && <span>{nearLabel(verse, after)}</span>}<IconForward size={17} />
          </button>
        </div>
        {/* where this verse sits in its chapter */}
        <div className="ribbon-pos" aria-hidden>{total > 0 && <i style={{ left: `${total > 1 ? ((verse.v - 1) / (total - 1)) * 100 : 50}%` }} />}</div>
      </div>
    </article>
  );
});

/**
 * Moves the feed up and down under the finger. The cards steer it themselves instead of leaving it to
 * the phone's own scrolling, so that a swipe which has started sideways can never turn into a change of card.
 */
interface Pager {
  begin: () => void;
  /** dy: how far the finger is from where the drag began; negative is upward */
  move: (dy: number) => void;
  /** vy: the finger's speed in px/ms when it lifted */
  end: (dy: number, vy: number, cancelled: boolean) => void;
  stop: () => void;
}

function usePager(scroller: RefObject<HTMLDivElement | null>, onActive: (on: boolean) => void): Pager {
  return useMemo(() => {
    let base = 0, startTop = 0, raf = 0, target = 0;
    const rest = (el: HTMLDivElement, top: number) => { el.scrollTop = top; el.style.scrollSnapType = ''; raf = 0; onActive(false); };
    return {
      begin() {
        const el = scroller.current;
        if (!el) return;
        // a card caught while still moving counts from where it was heading
        base = raf ? target : Math.round(el.scrollTop / el.clientHeight);
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        el.style.scrollSnapType = 'none';
        startTop = el.scrollTop;
        onActive(true);
      },
      move(dy) {
        const el = scroller.current;
        if (el) el.scrollTop = startTop - dy;
      },
      end(dy, vy, cancelled) {
        const el = scroller.current;
        if (!el) return;
        const h = el.clientHeight, last = Math.round((el.scrollHeight - h) / h);
        const gone = el.scrollTop / h - base;
        const flick = Math.abs(dy) > 28 && Math.abs(vy) > 0.3 && Math.sign(vy) === Math.sign(dy);
        // one card at a time: a clear flick, or a drag of a quarter of the screen; anything less springs back
        let to = base;
        if (!cancelled) {
          if (flick) to = base + (dy < 0 ? 1 : -1);
          else if (Math.abs(gone) > 0.25 && Math.sign(gone) === -Math.sign(dy)) to = base + Math.sign(gone);
        }
        to = Math.max(0, Math.min(last, to));
        target = to;
        const from = el.scrollTop, dest = to * h, dist = Math.abs(dest - from);
        if (dist < 1 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { rest(el, dest); return; }
        const dur = Math.max(220, Math.min(420, 160 + dist * 0.45));
        const t0 = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / dur);
          el.scrollTop = from + (dest - from) * (1 - Math.pow(1 - t, 3));
          if (t < 1) raf = requestAnimationFrame(tick);
          else rest(el, dest);
        };
        raf = requestAnimationFrame(tick);
      },
      stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
    };
  }, [scroller, onActive]);
}

/** Up-and-down paging for the slides that have nothing to read sideways. */
function usePageDrag(pager: Pager) {
  const g = useRef({ x: 0, y: 0, oy: 0, ly: 0, lt: 0, vy: 0, down: false, on: false });
  return useMemo(() => {
    const end = (e: React.PointerEvent, cancelled: boolean) => {
      const s = g.current;
      if (!s.down) return;
      s.down = false;
      if (!s.on) return;
      if (e.timeStamp - s.lt > 90) s.vy = 0;
      pager.end(e.clientY - s.oy, s.vy, cancelled);
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && (e.button !== 0 || (e.target as Element).closest('button,a'))) return;
        const s = g.current;
        s.x = e.clientX; s.y = e.clientY; s.ly = e.clientY; s.lt = e.timeStamp; s.vy = 0; s.down = true; s.on = false;
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = g.current;
        if (!s.down) return;
        if (e.pointerType === 'mouse' && e.buttons === 0) { end(e, true); return; }
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (!s.on) {
          if (Math.hypot(dx, dy) < SLOP) return;
          if (Math.abs(dy) < Math.abs(dx)) { s.down = false; return; }
          s.on = true;
          s.oy = e.clientY;
          try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
          pager.begin();
        }
        const dt = e.timeStamp - s.lt;
        if (dt > 0) s.vy = 0.7 * ((e.clientY - s.ly) / dt) + 0.3 * s.vy;
        s.ly = e.clientY; s.lt = e.timeStamp;
        pager.move(e.clientY - s.oy);
      },
      onPointerUp: (e: React.PointerEvent) => end(e, false),
      onPointerCancel: (e: React.PointerEvent) => end(e, true),
    };
  }, [pager]);
}

interface CardHandlers {
  onNote: (v: Shown) => void;
  onShare: (v: Shown, scene: Scene) => void;
  onMore: (v: Shown, originKey: VerseKey, topicId?: string) => void;
  onTap: () => void;
  pager: Pager;
}
export interface CardApi { step: (dir: -1 | 1) => void }

/** How far sideways the reader had got on each card, so that leaving a card does not lose the place. */
const places = new Map<VerseKey, number>();

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
  const [offset, setOffsetState] = useState(() => places.get(card.key) ?? 0);
  const setOffset = useCallback((to: number | ((o: number) => number)) => {
    setOffsetState((o) => {
      const n = typeof to === 'function' ? to(o) : to;
      if (n) places.set(card.key, n); else places.delete(card.key);
      return n;
    });
  }, [card.key]);
  const shown: Shown = (offset !== 0 && verseAt(stepRef(card, offset))) || card;
  const prev = active && bibleReady ? verseAt(stepRef(shown, -1)) : undefined;
  const next = active && bibleReady ? verseAt(stepRef(shown, 1)) : undefined;
  // the handlers below outlive a render, so they read the neighbours from here
  const nb = useRef({ prev, next });
  nb.current = { prev, next };
  // which way the row of verses is sliding, for the label of where it is going
  const [slide, setSlide] = useState<-1 | 0 | 1>(0);

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
  /** finishes the slide that is still settling, at once */
  const pending = useRef<(() => void) | null>(null);
  const g = useRef({
    x: 0, y: 0, ox: 0, oy: 0, lx: 0, ly: 0, lt: 0, vx: 0, vy: 0, dir: 0,
    down: false, moved: false, axis: '' as '' | 'x' | 'y', control: false, zone: false, long: false, swallow: false, lastTap: 0, timer: 0, tapTimer: 0,
  });

  // the verses either side come from the Bible itself
  useEffect(() => { if (active && !bibleReady) loadBible().catch(() => undefined); }, [active, bibleReady]);

  // a verse counts as read once it has been on screen for a moment
  useEffect(() => {
    if (!active || readThisVisit.has(card.key)) return;
    const t = window.setTimeout(() => { readThisVisit.add(card.key); countRead(); }, 1400);
    return () => window.clearTimeout(t);
  }, [active, card.key]);

  const setDrag = (px: number) => track.current?.style.setProperty('--drag', `${px}px`);

  /** Slides the row of verses to rest: on the neighbour (dir) or back where it was (0). */
  const settle = useCallback((dir: -1 | 0 | 1) => {
    const el = track.current, w = root.current?.clientWidth ?? 0;
    if (!el) return;
    el.classList.add('settling');
    setDrag(-dir * w);
    if (dir === 0) {
      window.setTimeout(() => { if (!busy.current) el.classList.remove('settling'); }, 440);
      return;
    }
    busy.current = true;
    let finished = false;
    const done = (e?: Event) => {
      // transitions of the buttons inside the row bubble up here; only the row's own counts
      if (finished || (e && e.target !== el)) return;
      finished = true;
      pending.current = null;
      el.removeEventListener('transitionend', done);
      flushSync(() => { setOffset((o) => o + dir); setSlide(0); });
      markJourney('around');
      el.classList.remove('settling');
      setDrag(0);
      void el.offsetWidth; // so the next slide starts from rest, not from the end of this one
      busy.current = false;
    };
    pending.current = () => done();
    el.addEventListener('transitionend', done);
    window.setTimeout(() => done(), 480);
  }, [setOffset]);

  const step = useCallback((dir: -1 | 1) => {
    // tapping quickly through a passage: the slide still finishing counts as done
    if (busy.current) pending.current?.();
    const { prev, next } = nb.current;
    if (!(dir < 0 ? prev : next)) {
      if (!bibleReady) loadBible().catch(() => undefined);
      return;
    }
    buzz(HAPTIC.tap);
    setSlide(dir);
    settle(dir);
  }, [bibleReady, settle]);

  useEffect(() => {
    if (!active) return;
    api.current = { step };
    return () => { if (api.current?.step === step) api.current = null; };
  }, [active, step, api]);

  const onReturn = useCallback(() => { buzz(HAPTIC.tap); setOffset(0); }, [setOffset]);

  const celebrateSave = (x?: number, y?: number) => {
    buzz(HAPTIC.save);
    setShine(Date.now());
    if (x !== undefined && y !== undefined) {
      setBurst({ x, y, id: Date.now() });
      window.setTimeout(() => setBurst(null), 900);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    if (target.closest('[data-nogesture]')) return;
    const control = !!target.closest('button,a,input,textarea');
    // a mouse on a button only ever clicks it; a finger may also begin a swipe there
    if (e.pointerType === 'mouse' && (control || e.button !== 0)) return;
    // reading on quickly: the slide still finishing counts as done
    if (busy.current) pending.current?.();
    const s = g.current;
    s.x = e.clientX; s.y = e.clientY; s.lx = e.clientX; s.ly = e.clientY; s.lt = e.timeStamp; s.vx = 0; s.vy = 0; s.dir = 0;
    s.down = true; s.moved = false; s.axis = ''; s.long = false; s.swallow = false; s.control = control; s.zone = !!target.closest('[data-sideways]');
    window.clearTimeout(s.timer);
    if (control) return;
    s.timer = window.setTimeout(() => {
      if (s.down && !s.moved) {
        // the menu covers the card, so the gesture ends here
        s.long = true;
        s.swallow = true;
        s.down = false;
        buzz(HAPTIC.hold);
        handlers.onMore(shown, card.key, topicId);
      }
    }, 480);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.down) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { finish(e, true); return; }
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) > 10) { s.moved = true; window.clearTimeout(s.timer); }
    if (!s.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      // The direction is chosen once and kept until the finger lifts: a swipe that has begun sideways
      // cannot change the card, and one that has begun up or down cannot change the verse. Sideways
      // gets the benefit of the doubt, because a thumb swipes in an arc; on the bar under the verse
      // almost any swipe is sideways.
      s.axis = Math.abs(dx) > Math.abs(dy) * (s.zone ? 0.4 : 0.8) ? 'x' : 'y';
      s.ox = e.clientX; s.oy = e.clientY;
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (s.axis === 'x') {
        track.current?.classList.remove('settling');
        if (!bibleReady) loadBible().catch(() => undefined);
      } else handlers.pager.begin();
    }
    const dt = e.timeStamp - s.lt;
    if (dt > 0) {
      s.vx = 0.7 * ((e.clientX - s.lx) / dt) + 0.3 * s.vx;
      s.vy = 0.7 * ((e.clientY - s.ly) / dt) + 0.3 * s.vy;
    }
    s.lx = e.clientX; s.ly = e.clientY; s.lt = e.timeStamp;
    if (s.axis === 'y') { handlers.pager.move(e.clientY - s.oy); return; }
    const dir = dx < 0 ? 1 : -1;
    if (s.dir !== dir) { s.dir = dir; setSlide(dir); }
    // nothing that way (or not loaded yet): the row resists
    const blocked = dx > 0 ? !nb.current.prev : !nb.current.next;
    setDrag(blocked ? dx * 0.22 : dx);
  };
  const finish = (e: React.PointerEvent, cancelled: boolean) => {
    const s = g.current;
    if (s.swallow) { s.swallow = false; swallowNextClick(); }
    if (!s.down) return;
    s.down = false;
    window.clearTimeout(s.timer);
    // a finger that stopped before lifting is placing the card, not flicking it
    if (e.timeStamp - s.lt > 90) { s.vx = 0; s.vy = 0; }
    if (s.axis === 'y') { handlers.pager.end(e.clientY - s.oy, s.vy, cancelled); return; }
    if (s.axis === 'x') {
      const dx = e.clientX - s.x;
      const w = root.current?.clientWidth ?? 360;
      const dir: -1 | 1 = dx < 0 ? 1 : -1;
      // on the bar the intent is not in doubt, so less of a swipe is asked for
      const far = Math.abs(dx) > w * (s.zone ? 0.14 : 0.22) || (Math.abs(dx) > 24 && Math.abs(s.vx) > (s.zone ? 0.3 : 0.45) && Math.sign(s.vx) === Math.sign(dx));
      const can = dir > 0 ? !!nb.current.next : !!nb.current.prev;
      if (!cancelled && far && can) { buzz(HAPTIC.tap); settle(dir); }
      else { setSlide(0); settle(0); }
      return;
    }
    if (cancelled || s.long || s.moved || s.control) return;
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
      className={`card ink-${scene.ink}${active ? ' active' : ''}${slide ? ' sliding' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onContextMenu={(e) => {
        e.preventDefault();
        // holding a button is not a request for the menu
        if ((e.target as Element).closest('button,a')) return;
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
        <div className="slot" inert>{prev && <Panel verse={prev} reveal={false} topic={offset === 1 ? topicId : undefined} origin={offset === 1 ? undefined : card} ready={bibleReady} />}</div>
        <div className="slot">
          <Panel verse={shown} topic={away ? undefined : topicId} origin={away ? card : undefined} reveal={!away}
            onReturn={onReturn} onStep={step} ready={bibleReady} />
        </div>
        <div className="slot" inert>{next && <Panel verse={next} reveal={false} topic={offset === -1 ? topicId : undefined} origin={offset === -1 ? undefined : card} ready={bibleReady} />}</div>
      </div>

      {/* while the row slides: where it is going */}
      {slide !== 0 && (slide > 0 ? next : prev) && (
        <div className="side-label" aria-hidden>
          {slide < 0 && <IconBack size={14} />}{formatRef((slide > 0 ? next : prev)!)}{slide > 0 && <IconForward size={14} />}
        </div>
      )}

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

const readThisVisit = new Set<VerseKey>();

/** The gestures, drawn: four small moving pictures with a word or two each. */
function GestureTips({ onClose }: { onClose: () => void }) {
  const tips: [string, string][] = [['up', 'Next verse'], ['side', 'Before and after'], ['double', 'Save'], ['hold', 'More']];
  return (
    <div className="tips" data-nogesture role="dialog" aria-label="How to use the verse feed">
      <div className="tips-box">
        <div className="tips-grid">
          {tips.map(([kind, label]) => (
            <figure key={kind} className={'tip tip-' + kind}>
              <span className="tip-card" aria-hidden><i className="tip-dot" /></span>
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
        <button className="btn wide" onClick={onClose}>Start reading</button>
      </div>
    </div>
  );
}

// ---------- a pause to reflect ----------
/** One open question after every five verses. It never suggests an answer. */
const ReflectCard = memo(function ReflectCard({ prompt, about, active, pager }: { prompt: Prompt; about?: Card; active: boolean; pager: Pager }) {
  const on = useStore((s) => s.reflect);
  const drag = usePageDrag(pager);
  const scene = pickScene('reflect:' + prompt.text, ['dusk', 'deep', 'forest']);
  return (
    <div className={`card reflect ink-${scene.ink}${active ? ' active' : ''}`} {...drag}>
      <SceneView scene={scene} live={active} />
      <div className="reflect-body">
        <span className="breath" aria-hidden><i /><i /><i /></span>
        <div className="card-topic">Pause and reflect</div>
        <h2 className="reflect-q">{prompt.text}</h2>
        {prompt.about === 'last' && about && <p className="reflect-ref">{formatRef(about)}</p>}
      </div>
      <button className="reflect-off" data-nogesture onClick={() => {
        update((s) => ({ reflect: !s.reflect }));
        toast(on ? 'Reflection questions are off. Turn them back on in Settings.' : 'Reflection questions are back on.');
      }}>
        {on ? 'Stop showing these' : 'Show these again'}
      </button>
    </div>
  );
});

type Item = { kind: 'verse'; key: string; card: Card } | { kind: 'reflect'; key: string; prompt: Prompt; about: Card };
const EVERY = 5;

/** A small pointer for someone who arrived from a step on the home path. */
const COACH: Record<string, string> = {
  explore: 'Swipe up for the next verse',
  around: 'Swipe left or right',
  save: 'Double-tap to save',
  share: 'Tap Share',
};

export function Feed({ mode, first, coach }: { mode: 'topics' | 'saved'; first?: Ref; coach?: string }) {
  const topics = useStore((s) => s.topics);
  // fixed when the feed opens, so switching the questions off does not shift the cards mid-scroll
  const [reflectOn] = useState(() => getState().reflect);
  const [coachOn, setCoachOn] = useState(!!coach && !!COACH[coach]);
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

  // the verses, with a question to reflect on after every fifth one
  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    const day = dayNumber();
    cards.forEach((card, i) => {
      out.push({ kind: 'verse', key: card.key, card });
      if (reflectOn && mode === 'topics' && (i + 1) % EVERY === 0 && i < cards.length - 1) {
        out.push({ kind: 'reflect', key: 'reflect-' + i, prompt: PROMPTS[(Math.floor(i / EVERY) + day) % PROMPTS.length], about: card });
      }
    });
    return out;
  }, [cards, reflectOn, mode]);

  const sig = `${mode}|${topics.join(',')}|${firstKey ?? ''}`;
  // A verse opened by name shows that verse, wherever its card and this feed were left earlier.
  // Coming back with Back is different: then the place is kept.
  useState(() => { if (firstKey && arrivedFresh()) { places.delete(firstKey); positions.delete(sig); } });
  const scroller = useRef<HTMLDivElement>(null);
  const cardApi = useRef<CardApi | null>(null);
  const [index, setIndex] = useState(() => positions.get(sig) ?? 0);
  // while a finger is moving the feed, the card leaving the screen must stay touchable
  const [paging, setPaging] = useState(false);
  const pager = usePager(scroller, setPaging);
  const endDrag = usePageDrag(pager);
  useEffect(() => () => pager.stop(), [pager]);
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
    pager,
  }), [pager]);

  // someone opening a shared link sees the verse first; the tips wait for a normal visit
  const showTips = !hintsSeen && !first;
  const overlayOpen = !!(noteFor || shareFor || moreFor) || showTips;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlayOpen || (e.target as Element)?.closest?.('input,textarea')) return;
      const c = items[index];
      if (['ArrowDown', 'PageDown', 'j', ' '].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (!c || c.kind !== 'verse') return;
      else if (e.key === 'ArrowRight') cardApi.current?.step(1);
      else if (e.key === 'ArrowLeft') cardApi.current?.step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, index, go, overlayOpen]);

  // the pointer from the home path leaves once the person has moved or after a few seconds
  useEffect(() => {
    if (!coachOn) return;
    const t = window.setTimeout(() => setCoachOn(false), 7000);
    return () => window.clearTimeout(t);
  }, [coachOn]);
  useEffect(() => { if (index > 0) setCoachOn(false); }, [index]);

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
    <div className={'feed paged' + (clean ? ' clean' : '')}>
      <div className="feed-scroll" ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="Verses">
        {items.map((it, i) => (
          <section className="slide" key={it.key} inert={i !== index && !paging}>
            {Math.abs(i - index) <= 2 && (it.kind === 'verse' ? (
              <VerseCard card={it.card} topicId={topicOf(it.card)} active={i === index} hero={!!first && i === index} bibleReady={bibleReady} handlers={handlers} api={cardApi} />
            ) : (
              <ReflectCard prompt={it.prompt} about={it.about} active={i === index} pager={pager} />
            ))}
          </section>
        ))}
        <section className="slide end-slide" {...endDrag}>
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
        <span className="feed-tools"><SoundButton />{mode === 'topics' && <ModeSwitch mode="verses" />}</span>
      </header>

      {coachOn && coach && <div className={'coach coach-' + coach} role="status" onClick={() => setCoachOn(false)}>{COACH[coach]}</div>}

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
