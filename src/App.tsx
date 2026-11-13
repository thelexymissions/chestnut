import { useEffect, type CSSProperties } from 'react';
import { bookBySlug } from './lib/books';
import { loadBible } from './lib/bible';
import { useRoute } from './lib/router';
import { touchStreak, useStore } from './lib/store';
import { ToastHost } from './components/ui';
import { Bible } from './screens/Bible';
import { Feed } from './screens/Feed';
import { Home, NamePrompt } from './screens/Home';
import { Saved } from './screens/Saved';
import { Settings } from './screens/Settings';

const SCALES = [0.9, 1, 1.14];

export function App() {
  const route = useRoute();
  const onboarded = useStore((s) => s.onboarded);
  const theme = useStore((s) => s.theme);
  const textSize = useStore((s) => s.textSize);

  useEffect(() => {
    touchStreak();
    // fetch the Bible in the background so the reader and search open instantly, also offline
    const t = window.setTimeout(() => { loadBible().catch(() => undefined); }, 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const [section, a, b, c] = route.parts;
  let screen;
  if (section === 'feed') {
    const mode = a === 'saved' ? 'saved' : 'topics';
    screen = <Feed key={mode} mode={mode} />;
  } else if (section === 'v' && bookBySlug(a ?? '') && Number(b) > 0 && Number(c) > 0) {
    // a shared link: show the verse straight away, no questions first
    const first = { b: bookBySlug(a)!.n, c: Number(b), v: Number(c) };
    screen = <Feed key={`v-${a}-${b}-${c}`} mode="topics" first={first} />;
  } else if (section === 'bible') {
    screen = <Bible route={route} />;
  } else if (section === 'saved') {
    screen = <Saved />;
  } else if (section === 'settings') {
    screen = <Settings />;
  } else {
    screen = onboarded ? <Home /> : <NamePrompt />;
  }

  return (
    <div className="app" style={{ '--scale': SCALES[textSize] ?? 1 } as CSSProperties}>
      {screen}
      <ToastHost />
    </div>
  );
}
