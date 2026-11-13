import { useSyncExternalStore } from 'react';

// Hash routing: works on any static host and under any sub-path.

const read = () => {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h.startsWith('/') ? h : '/' + h;
};

const subscribe = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};

export interface Route { path: string; parts: string[]; query: URLSearchParams }

let cachedRaw = '';
let cached: Route = { path: '/', parts: [], query: new URLSearchParams() };

function parse(): Route {
  const raw = read();
  if (raw !== cachedRaw) {
    const [path, q = ''] = raw.split('?');
    cachedRaw = raw;
    cached = { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
  }
  return cached;
}

export const useRoute = (): Route => useSyncExternalStore(subscribe, parse);

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = '#' + to;
  if (opts.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== target) {
    window.location.hash = to;
  }
}

export const back = (fallback = '/') => {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, { replace: true });
};
