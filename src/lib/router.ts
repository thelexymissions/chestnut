import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

// Hash routing: works on any static host and under any sub-path. Screen changes
// run inside a view transition where the browser supports it, so one screen
// flows into the next; where it does not, they simply switch.

export interface Route { path: string; parts: string[]; query: URLSearchParams }

const read = () => {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h.startsWith('/') ? h : '/' + h;
};

function parse(raw: string): Route {
  const [path, q = ''] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

// `current` is what is on screen; `targetRaw` is where we are heading. They differ
// for a moment while a transition is being prepared.
let currentRaw = read();
let targetRaw = currentRaw;
let current: Route = parse(currentRaw);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** How deep a screen sits: tabs are level 0, screens opened from them level 1. */
function depth(path: string): number {
  const p = path.split('?')[0];
  if (/^\/bible\/[^/]+\/\d+/.test(p)) return 1;
  if (p.startsWith('/settings')) return 1;
  if (/^\/memorise\/.+/.test(p)) return 1;
  return 0;
}

type Kind = 'push' | 'pop' | 'tab' | 'none';
interface Transition { finished: Promise<void>; ready?: Promise<void>; updateCallbackDone?: Promise<void> }
interface TransitionDoc { startViewTransition?: (cb: () => void) => Transition }

function run(kind: Kind, update: () => void) {
  const doc = document as Document & TransitionDoc;
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (kind === 'none' || !doc.startViewTransition || calm) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = kind;
  try {
    const t = doc.startViewTransition(() => flushSync(update));
    // a transition cut short by the next one is not an error
    t.ready?.catch(() => undefined);
    t.updateCallbackDone?.catch(() => undefined);
    t.finished.catch(() => undefined).finally(() => { if (root.dataset.nav === kind) delete root.dataset.nav; });
  } catch {
    delete root.dataset.nav;
    update();
  }
}

function sync(kind?: Kind) {
  const raw = read();
  if (raw === targetRaw) return;
  const from = depth(targetRaw), to = depth(raw);
  const samePage = raw.split('?')[0] === targetRaw.split('?')[0];
  targetRaw = raw;
  const k: Kind = kind ?? (samePage ? 'none' : to > from ? 'push' : to < from ? 'pop' : 'tab');
  run(k, () => {
    currentRaw = raw;
    current = parse(raw);
    emit();
  });
}

window.addEventListener('popstate', () => sync());
window.addEventListener('hashchange', () => sync());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useRoute = (): Route => useSyncExternalStore(subscribe, () => current);

export function navigate(to: string, opts: { replace?: boolean; plain?: boolean } = {}) {
  if (to === targetRaw) return;
  if (opts.replace) window.history.replaceState(null, '', '#' + to);
  else window.history.pushState(null, '', '#' + to);
  sync(opts.plain ? 'none' : undefined);
}

export const back = (fallback = '/') => {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, { replace: true });
};
