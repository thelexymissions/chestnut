import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isDue } from '../lib/memory';
import { navigate, useRoute } from '../lib/router';
import { getState, useStore } from '../lib/store';
import { IconBook, IconBookmark, IconClose, IconHome, IconMemory, IconVerses } from './Icons';

// ---- toast ----
let toastMsg: { text: string; id: number } | null = null;
const toastListeners = new Set<() => void>();
let toastTimer: number | undefined;

export function toast(text: string) {
  toastMsg = { text, id: Date.now() };
  toastListeners.forEach((l) => l());
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMsg = null;
    toastListeners.forEach((l) => l());
  }, 2200);
}

export function ToastHost() {
  const msg = useSyncExternalStore(
    (l) => { toastListeners.add(l); return () => { toastListeners.delete(l); }; },
    () => toastMsg,
  );
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {msg && <div className="toast" key={msg.id}>{msg.text}</div>}
    </div>
  );
}

// ---- touch feedback (phones that allow web pages to vibrate) ----
export const HAPTIC = {
  tap: 10,
  save: 14,
  hold: 18,
  right: 12,
  wrong: [26, 50, 26],
  done: [12, 70, 12, 70, 26],
} as const;

export function buzz(pattern: number | readonly number[] = HAPTIC.tap) {
  if (!getState().haptics) return;
  try { navigator.vibrate?.(pattern as number | number[]); } catch { /* not supported */ }
}

// ---- a quiet full-screen moment for milestones ----
let moment: { title: string; sub: string; id: number } | null = null;
const momentListeners = new Set<() => void>();
let momentTimer: number | undefined;
const setMoment = (m: typeof moment) => { moment = m; momentListeners.forEach((l) => l()); };

export function celebrate(title: string, sub: string) {
  setMoment({ title, sub, id: Date.now() });
  buzz(HAPTIC.done);
  window.clearTimeout(momentTimer);
  momentTimer = window.setTimeout(() => setMoment(null), 3600);
}

export function CelebrationHost() {
  const m = useSyncExternalStore(
    (l) => { momentListeners.add(l); return () => { momentListeners.delete(l); }; },
    () => moment,
  );
  if (!m) return null;
  return (
    <div className="moment" key={m.id} role="status" onClick={() => setMoment(null)}>
      <div className="moment-sparks" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, animationDelay: `${(i % 7) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.35}s`, width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2 }} />
        ))}
      </div>
      <div className="moment-box">
        <span className="moment-rule" aria-hidden />
        <h2>{m.title}</h2>
        <p>{m.sub}</p>
      </div>
    </div>
  );
}

// ---- bottom sheet ----
export function Sheet({ open, onClose, title, children, tall }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  tall?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const g = useRef<{ y: number; t: number; lastY: number; lastT: number } | null>(null);
  // while the sheet slides away, keep showing what it last held
  const held = useRef<{ title?: string; children: ReactNode }>({ title, children });
  if (open) held.current = { title, children };

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDrag(0);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => { setMounted(false); setClosing(false); setDrag(0); }, 260);
    return () => window.clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted) return null;
  const shown = held.current;

  // the handle and title follow the finger; a quick flick or a long pull closes
  const down = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    g.current = { y: e.clientY, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    setDrag(dy > 0 ? dy : dy / 5);
    s.lastY = e.clientY; s.lastT = e.timeStamp;
  };
  const up = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    const dy = e.clientY - s.y;
    const speed = dy / Math.max(1, e.timeStamp - s.t);
    if (dy > 110 || (dy > 30 && speed > 0.55)) onClose();
    else setDrag(0);
  };

  return (
    <div className={'sheet-layer' + (closing ? ' closing' : '')} data-nogesture>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={ref}
        className={'sheet' + (tall ? ' sheet-tall' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={shown.title}
        tabIndex={-1}
        style={drag && !closing ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div className="sheet-drag" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { g.current = null; setDrag(0); }}>
          <div className="sheet-grab"><span /></div>
          {shown.title && (
            <div className="sheet-head">
              <h2>{shown.title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={20} /></button>
            </div>
          )}
        </div>
        <div className="sheet-body">{shown.children}</div>
      </div>
    </div>
  );
}

// ---- bottom tab bar ----
const TABS = [
  { to: '/', label: 'Home', icon: IconHome, match: (p: string) => p === '/' },
  { to: '/feed', label: 'Verses', icon: IconVerses, match: (p: string) => p.startsWith('/feed') || p.startsWith('/v/') },
  { to: '/bible', label: 'Bible', icon: IconBook, match: (p: string) => p.startsWith('/bible') },
  { to: '/saved', label: 'Saved', icon: IconBookmark, match: (p: string) => p.startsWith('/saved') },
  { to: '/memorise', label: 'Memorise', icon: IconMemory, match: (p: string) => p.startsWith('/memorise') },
];

export function TabBar({ overlay }: { overlay?: boolean }) {
  const route = useRoute();
  const due = useStore((s) => Object.values(s.memory).filter((e) => isDue(e)).length);
  return (
    <nav className={'tabbar' + (overlay ? ' tabbar-overlay' : '')} aria-label="Main" data-nogesture>
      <div className="tabbar-in">
      {TABS.map((t) => {
        const active = t.match(route.path);
        const Icon = t.icon;
        return (
          <button key={t.to} className={'tab' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined} onClick={() => navigate(t.to)}
            aria-label={t.to === '/memorise' && due ? `Memorise, ${due} due` : undefined}>
            {active && <span className="tab-ind" aria-hidden />}
            <span className="tab-icon">
              <Icon size={23} filled={active && t.to === '/saved'} />
              {t.to === '/memorise' && due > 0 && <i className="tab-dot" aria-hidden />}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
      </div>
    </nav>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const timeAgo = (t: number): string => {
  const d = new Date(t);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const opts: Intl.DateTimeFormatOptions = same
    ? { hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' };
  return (same ? 'Today, ' : '') + d.toLocaleString(undefined, opts);
};
