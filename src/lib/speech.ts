import { useSyncExternalStore } from 'react';
import { getState } from './store';

// Read-aloud with the phone's own voice. Verses are queued one at a time:
// some browsers cut long utterances short.

let current: string | null = null;
let currentIndex = -1;
let token = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function voices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function chooseVoice(): SpeechSynthesisVoice | undefined {
  const list = voices();
  const wanted = getState().voice;
  return (
    list.find((v) => v.name === wanted) ||
    list.find((v) => /en[-_]GB/i.test(v.lang) && v.localService) ||
    list.find((v) => /en[-_]GB/i.test(v.lang)) ||
    list.find((v) => v.default) ||
    list[0]
  );
}

export function stopSpeaking() {
  token++;
  if (speechSupported()) window.speechSynthesis.cancel();
  current = null;
  currentIndex = -1;
  emit();
}

/** Speak a list of passages under an id; calling again with the same id stops. */
export function speak(id: string, parts: string[]) {
  if (!speechSupported()) return false;
  if (current === id) { stopSpeaking(); return true; }
  stopSpeaking();
  const mine = ++token;
  current = id;
  const voice = chooseVoice();
  const rate = getState().rate || 0.9;
  parts.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
    u.rate = rate;
    u.onstart = () => { if (mine === token) { currentIndex = i; emit(); } };
    u.onend = () => { if (mine === token && i === parts.length - 1) { current = null; currentIndex = -1; emit(); } };
    u.onerror = () => { if (mine === token) { current = null; currentIndex = -1; emit(); } };
    window.speechSynthesis.speak(u);
  });
  emit();
  return true;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Id currently being read, or null. */
export const useSpeaking = () => useSyncExternalStore(subscribe, () => current);
/** Index of the passage being read within the current queue. */
export const useSpeakingIndex = () => useSyncExternalStore(subscribe, () => currentIndex);

if (speechSupported()) {
  window.speechSynthesis.onvoiceschanged = () => emit();
  window.addEventListener('pagehide', () => window.speechSynthesis.cancel());
}
