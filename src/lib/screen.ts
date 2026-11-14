// The size of the screen the app is given, as the phone reports it.
//
// On iOS 26 a home-screen app installed with a see-through status bar is given a window shorter than the
// screen by the height of the status bar (WebKit bug 301108). Anything drawn below that line is shown on
// some frames and not on others, so the app cannot simply be made taller: that made the tab bar flicker.
// The app now asks for a solid status bar, which places it below the status bar and lets it reach the
// bottom edge. A copy installed before that change keeps its old setting until it is added again, so
// `staleInstall` spots one and Home offers the steps.

const px = (css: string): number => {
  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:${css};visibility:hidden;pointer-events:none`;
  document.documentElement.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
};

export function measureScreen() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? window.innerHeight >= window.innerWidth;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  return {
    standalone, apple, portrait, full,
    inner: window.innerHeight,
    dvh: px('100dvh'), lvh: px('100lvh'), vh: px('100vh'),
    safeTop: px('env(safe-area-inset-top, 0px)'), safeBottom: px('env(safe-area-inset-bottom, 0px)'),
  };
}

/** A home-screen copy that still has the see-through status bar and so stops short of the bottom of the screen. */
export function staleInstall(): boolean {
  const m = measureScreen();
  const short = m.full - m.inner;
  return m.standalone && m.apple && m.portrait && m.safeTop > 0 && short >= 20 && short <= 140;
}
