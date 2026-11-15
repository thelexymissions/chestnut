import { useSyncExternalStore } from 'react';
import { isKey, type VerseKey } from './books';

// Everything a person creates lives on their own device, in localStorage.
// Nothing is sent anywhere.

export interface Note { id: string; text: string; at: number; edited?: number }

/** One verse on the memorising list. Days are local calendar day numbers. */
export interface MemoryEntry {
  added: number;
  /** 0 = new; rises by one with each successful review */
  box: number;
  dueDay: number;
  last: number;
  reviews: number;
  lapses: number;
}

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
  memory: Record<VerseKey, MemoryEntry>;
  haptics: boolean;
  milestones: number[];
  /** answers given in the welcome journey, and the verse it led to */
  intro: { mood: string; area: string; need: string; verse: VerseKey } | null;
  /** steps of the getting-started path that were completed by doing them: id → when */
  journey: Record<string, number>;
  /** verse cards read, for the path and the home screen */
  reads: number;
  factVotes: Record<string, 1 | -1>;
  /** show a question to reflect on after every five verses */
  reflect: boolean;
  /** background sound: which layers are on, and how loud */
  sound: { music: boolean; rain: boolean; forest: boolean; waves: boolean; volume: number };
  /** the add-to-home-screen prompt: when it was last put aside, and how often */
  install: { later: number; times: number; never: boolean };
  /** the saved verse chosen for the card at the top of Home; null shows the app's own passage */
  homeVerse: VerseKey | null;
  /** the note on Home about adding an older home-screen copy again has been put aside */
  refitSeen: boolean;
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
  memory: {},
  haptics: true,
  milestones: [],
  intro: null,
  journey: {},
  reads: 0,
  factVotes: {},
  reflect: true,
  sound: { music: false, rain: false, forest: false, waves: false, volume: 0.6 },
  install: { later: 0, times: 0, never: false },
  homeVerse: null,
  refitSeen: false,
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

/** Whole local days since 1 Jan 1970, so "due today" follows the person's own calendar. */
export const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

// ---- memorising list ----
export const isMemorising = (k: VerseKey) => state.memory[k] !== undefined;

export function toggleMemorise(k: VerseKey): boolean {
  const now = !isMemorising(k);
  update((s) => {
    const memory = { ...s.memory };
    if (now) memory[k] = { added: Date.now(), box: 0, dueDay: dayNumber(), last: 0, reviews: 0, lapses: 0 };
    else delete memory[k];
    return { memory };
  });
  return now;
}

export function setMemory(k: VerseKey, entry: MemoryEntry) {
  update((s) => ({ memory: { ...s.memory, [k]: entry } }));
}

// ---- getting-started path, reading count, trivia votes ----
export function markJourney(id: string) {
  if (state.journey[id]) return;
  update((s) => ({ journey: { ...s.journey, [id]: Date.now() } }));
}

export function countRead() {
  update((s) => ({ reads: s.reads + 1 }));
}

/** Thumbs up (1) or down (-1) on a fact; the same thumb again takes the vote back. */
export function voteFact(id: string, vote: 1 | -1): 1 | -1 | 0 {
  const now = state.factVotes[id] === vote ? 0 : vote;
  update((s) => {
    const factVotes = { ...s.factVotes };
    if (now === 0) delete factVotes[id];
    else factVotes[id] = now;
    return { factVotes };
  });
  return now;
}

// ---- backup ----
export function exportBackup(): string {
  const { name, saved, notes, bg, topics, streak, textSize, theme, rate, voice, memory } = state;
  return JSON.stringify({ app: 'chestnut', version: 1, exported: new Date().toISOString(), name, saved, notes, bg, topics, streak, textSize, theme, rate, voice, memory }, null, 2);
}

export function importBackup(json: string): { saved: number; notes: number } {
  const d = JSON.parse(json);
  if (!d || d.app !== 'chestnut' || typeof d.saved !== 'object' || typeof d.notes !== 'object') {
    throw new Error('This is not a Chestnut backup file.');
  }
  // a single verse ("43.3.16") or a passage ("45.8.1-4")
  const keyOk = isKey;
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
  // memorising progress: keep whichever copy is further along
  const memory: Record<string, MemoryEntry> = { ...state.memory };
  if (d.memory && typeof d.memory === 'object') {
    for (const [k, e] of Object.entries(d.memory as Record<string, MemoryEntry>)) {
      if (!keyOk(k) || !e || typeof e.box !== 'number' || typeof e.dueDay !== 'number') continue;
      const mine = memory[k];
      if (!mine || e.box > mine.box) {
        memory[k] = { added: Number(e.added) || Date.now(), box: Math.max(0, Math.floor(e.box)), dueDay: Math.floor(e.dueDay), last: Number(e.last) || 0, reviews: Number(e.reviews) || 0, lapses: Number(e.lapses) || 0 };
      }
    }
  }
  update((s) => ({ saved, notes, memory, name: s.name || (typeof d.name === 'string' ? d.name : '') }));
  return { saved: Object.keys(saved).length, notes: noteCount };
}

export function resetAll() {
  state = defaults();
  persist();
  listeners.forEach((l) => l());
}
