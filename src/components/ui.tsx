import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { navigate, useRoute } from '../lib/router';
import { IconBook, IconBookmark, IconClose, IconHome, IconVerses } from './Icons';

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

export function buzz(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
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
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => { if (!open) setDrag(0); }, [open]);

  if (!open) return null;
  return (
    <div className="sheet-layer" data-nogesture>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={ref}
        className={'sheet' + (tall ? ' sheet-tall' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div
          className="sheet-grab"
          onPointerDown={(e) => { start.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); }}
          onPointerUp={() => { if (drag > 90) onClose(); else setDrag(0); start.current = null; }}
          onPointerCancel={() => { setDrag(0); start.current = null; }}
        >
          <span />
        </div>
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={20} /></button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
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
];

export function TabBar({ overlay }: { overlay?: boolean }) {
  const route = useRoute();
  return (
    <nav className={'tabbar' + (overlay ? ' tabbar-overlay' : '')} aria-label="Main" data-nogesture>
      {TABS.map((t) => {
        const active = t.match(route.path);
        const Icon = t.icon;
        return (
          <button key={t.to} className={'tab' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined} onClick={() => navigate(t.to)}>
            <Icon size={23} filled={active && t.to === '/saved'} />
            <span>{t.label}</span>
          </button>
        );
      })}
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
