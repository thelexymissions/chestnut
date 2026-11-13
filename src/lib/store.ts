import { useSyncExternalStore } from 'react';
import type { VerseKey } from './books';

// Everything a person creates lives on their own device, in localStorage.
// Nothing is sent anywhere.

export interface Note { id: string; text: string; at: number; edited?: number }

export interface AppState {
  version: 1;
  name: string;
  onboarded: boolean;
  topics: string[];
  saved: Record<VerseKey, number>;
  notes: Record<VerseKey, Note[]>;
  bg: Record<VerseKey, string>;
  streak: { last: string; count: number; best: number };
  hintsSeen: boolean;
  textSize: 0 | 1 | 2;
  theme: 'auto' | 'light' | 'dark';
  voice: string;
  rate: number;
  lastRead: { b: number; c: number } | null;
}

const KEY = 'chestnut.state.v1';

const defaults = (): AppState => ({
  version: 1,
  name: '',
  onboarded: false,
  topics: [],
  saved: {},
  notes: {},
  bg: {},
  streak: { last: '', count: 0, best: 0 },
  hintsSeen: false,
  textSize: 1,
  theme: 'auto',
  voice: '',
  rate: 0.9,
  lastRead: null,
});

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw), version: 1 };
  } catch {
    /* private mode or corrupted data: start fresh in memory */
  }
  return defaults();
}

let state: AppState = read();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export function getState(): AppState { return state; }

export function update(fn: (s: AppState) => Partial<AppState>) {
  state = { ...state, ...fn(state) };
  persist();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// keep several open tabs in step
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = read();
      listeners.forEach((l) => l());
    }
  });
}

// ---- actions ----
export const isSaved = (k: VerseKey) => state.saved[k] !== undefined;

export function toggleSaved(k: VerseKey): boolean {
  const now = !isSaved(k);
  update((s) => {
    const saved = { ...s.saved };
    if (now) saved[k] = Date.now();
    else delete saved[k];
    return { saved };
  });
  return now;
}
export function save(k: VerseKey) { if (!isSaved(k)) toggleSaved(k); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function addNote(k: VerseKey, text: string) {
  const t = text.trim();
  if (!t) return;
  update((s) => ({ notes: { ...s.notes, [k]: [{ id: uid(), text: t, at: Date.now() }, ...(s.notes[k] || [])] } }));
}
export function editNote(k: VerseKey, id: string, text: string) {
  const t = text.trim();
  if (!t) return deleteNote(k, id);
  update((s) => ({
    notes: { ...s.notes, [k]: (s.notes[k] || []).map((n) => (n.id === id ? { ...n, text: t, edited: Date.now() } : n)) },
  }));
}
export function deleteNote(k: VerseKey, id: string) {
  update((s) => {
    const notes = { ...s.notes };
    const left = (notes[k] || []).filter((n) => n.id !== id);
    if (left.length) notes[k] = left;
    else delete notes[k];
    return { notes };
  });
}

export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Call once per app open. Counts consecutive days the app was opened. */
export function touchStreak() {
  const today = localDay();
  const s = state.streak;
  if (s.last === today) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const count = s.last === localDay(y) ? s.count + 1 : 1;
  update(() => ({ streak: { last: today, count, best: Math.max(s.best, count) } }));
}

// ---- backup ----
export function exportBackup(): string {
  const { name, saved, notes, bg, topics, streak, textSize, theme, rate, voice } = state;
  return JSON.stringify({ app: 'chestnut', version: 1, exported: new Date().toISOString(), name, saved, notes, bg, topics, streak, textSize, theme, rate, voice }, null, 2);
}

export function importBackup(json: string): { saved: number; notes: number } {
  const d = JSON.parse(json);
  if (!d || d.app !== 'chestnut' || typeof d.saved !== 'object' || typeof d.notes !== 'object') {
    throw new Error('This is not a Chestnut backup file.');
  }
  const keyOk = (k: string) => /^\d{1,2}\.\d{1,3}\.\d{1,3}$/.test(k);
  const saved: Record<string, number> = { ...state.saved };
  for (const [k, t] of Object.entries(d.saved)) if (keyOk(k) && typeof t === 'number' && saved[k] === undefined) saved[k] = t;
  const notes: Record<string, Note[]> = { ...state.notes };
  let noteCount = 0;
  for (const [k, list] of Object.entries(d.notes)) {
    if (!keyOk(k) || !Array.isArray(list)) continue;
    const have = new Set((notes[k] || []).map((n) => n.id));
    const add = (list as Note[]).filter((n) => n && typeof n.text === 'string' && typeof n.id === 'string' && !have.has(n.id))
      .map((n) => ({ id: n.id, text: n.text, at: Number(n.at) || Date.now(), edited: n.edited }));
    if (add.length) {
      notes[k] = [...(notes[k] || []), ...add].sort((a, b) => b.at - a.at);
      noteCount += add.length;
    }
  }
  update((s) => ({ saved, notes, name: s.name || (typeof d.name === 'string' ? d.name : '') }));
  return { saved: Object.keys(saved).length, notes: noteCount };
}

export function resetAll() {
  state = defaults();
  persist();
  listeners.forEach((l) => l());
}
