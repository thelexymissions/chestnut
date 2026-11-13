import { useEffect, useState } from 'react';
import { getState, update } from './store';

// Adding Chestnut to the home screen. Android browsers can show their own
// install dialog when asked; iPhones need three taps that only the person can do.

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let installEvent: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    update((s) => ({ install: { ...s.install, never: true } }));
    emit();
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isMobile = () => isIOS() || /android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.matchMedia?.('(max-width: 820px)').matches);
export const canAskBrowser = () => installEvent !== null;

/** Shows the browser's own install dialog. True if the person accepted. */
export async function askBrowser(): Promise<boolean> {
  const e = installEvent;
  if (!e) return false;
  await e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  installEvent = null;
  emit();
  return choice.outcome === 'accepted';
}

const WEEK = 7 * 86400000;
/** Offer it on phones, in the browser, at most three times and a week apart. */
export function shouldOffer(): boolean {
  if (typeof window === 'undefined' || isStandalone() || !isMobile()) return false;
  const { later, times, never } = getState().install;
  return !never && times < 3 && Date.now() - later > WEEK;
}
export const putAside = () => update((s) => ({ install: { ...s.install, later: Date.now(), times: s.install.times + 1 } }));
export const neverAsk = () => update((s) => ({ install: { ...s.install, never: true } }));

export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { standalone: isStandalone(), ios: isIOS(), mobile: isMobile(), canAsk: canAskBrowser() };
}
