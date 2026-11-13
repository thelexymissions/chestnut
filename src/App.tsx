import { useEffect, useMemo, type CSSProperties } from 'react';
import { bookBySlug } from './lib/books';
import { loadBible } from './lib/bible';
import { useRoute } from './lib/router';
import { grainUrl } from './lib/scenes';
import { getState, touchStreak, update, useStore } from './lib/store';
import { celebrate, CelebrationHost, ToastHost } from './components/ui';
import { Bible } from './screens/Bible';
import { Feed } from './screens/Feed';
import { Home, NamePrompt } from './screens/Home';
import { Memorise } from './screens/Memorise';
import { Saved } from './screens/Saved';
import { Settings } from './screens/Settings';

const SCALES = [0.9, 1, 1.14];

export function App() {
  const route = useRoute();
  const onboarded = useStore((s) => s.onboarded);
  const theme = useStore((s) => s.theme);
  const textSize = useStore((s) => s.textSize);

  const grain = useMemo(() => grainUrl(), []);

  useEffect(() => {
    touchStreak();
    // a quiet marker for a week, a month, a hundred days and a year of opening the app
    const { streak, milestones } = getState();
    if ([7, 30, 100, 365].includes(streak.count) && !milestones.includes(streak.count)) {
      update((s) => ({ milestones: [...s.milestones, streak.count] }));
      window.setTimeout(() => celebrate(`${streak.count} days in a row`, 'A little each day.'), 900);
    }
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
  } else if (section === 'memorise') {
    screen = <Memorise route={route} />;
  } else if (section === 'settings') {
    screen = <Settings />;
  } else {
    screen = onboarded ? <Home /> : <NamePrompt />;
  }

  return (
    <div className="app" style={{ '--scale': SCALES[textSize] ?? 1, '--grain': grain ? `url("${grain}")` : 'none' } as CSSProperties}>
      {screen}
      <ToastHost />
      <CelebrationHost />
    </div>
  );
}
