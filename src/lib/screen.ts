// The app must reach the bottom edge of the screen. `100dvh` is meant to give that, but on an
// iPhone it can come out short: opened from the home screen, by about the height of the status
// bar, which leaves a dark band under the tab bar. So the height is measured rather than trusted:
// what `100dvh` really gives is compared with the window's height and, in a home-screen app, with
// the screen's own height, and the app is given the tallest of them.
export function measureScreen() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100dvh;visibility:hidden;pointer-events:none';
  document.documentElement.appendChild(probe);
  const dvh = probe.getBoundingClientRect().height;
  probe.remove();
  const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? window.innerHeight >= window.innerWidth;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const inner = window.innerHeight;
  // a home-screen app on an iPhone has the whole screen; anywhere else the window is the limit
  const want = Math.max(inner, standalone && apple && full - inner < 140 ? full : 0);
  return { standalone, apple, dvh, inner, full, want };
}
function fitScreen() {
  const m = measureScreen();
  const root = document.documentElement;
  const tall = m.want - m.dvh > 1;
  if (tall) root.style.setProperty('--app-h', `${m.want}px`);
  else root.style.removeProperty('--app-h');
  root.classList.toggle('tall', tall);
}
/** Keeps the app's height right from the first moment and whenever the window changes. */
export function watchScreen() {
  fitScreen();
  window.addEventListener('resize', fitScreen);
  window.visualViewport?.addEventListener('resize', fitScreen);
  window.addEventListener('orientationchange', () => window.setTimeout(fitScreen, 300));
  window.addEventListener('pageshow', fitScreen);
  // the first measurements on a cold start can be taken before the window has settled
  [100, 400, 1200].forEach((ms) => window.setTimeout(fitScreen, ms));
}
