import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import './styles.css';
import { App } from './App';

registerSW({ immediate: true });

// On an iPhone, an app opened from the home screen can be told its window is shorter than the
// screen by the height of the status bar. Everything then sits that much too high and a dark
// band is left under the tab bar. When the reported height falls short of the screen by about
// a status bar, the app is given the screen's own height instead.
function fitScreen() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const root = document.documentElement;
  const portrait = window.innerHeight >= window.innerWidth;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const short = full - window.innerHeight;
  if (standalone && apple && short > 1 && short < 90) root.style.setProperty('--app-h', `${full}px`);
  else root.style.removeProperty('--app-h');
}
fitScreen();
window.addEventListener('resize', fitScreen);
window.addEventListener('orientationchange', () => window.setTimeout(fitScreen, 300));
window.addEventListener('pageshow', fitScreen);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
