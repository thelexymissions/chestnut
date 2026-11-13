import { useState } from 'react';
import { TOPICS, topicLabel } from '../data/topics';
import { formatRef, versePath } from '../lib/books';
import { CARDS, countForTopic, countForTopics, verseOfTheDay } from '../lib/feed';
import { navigate } from '../lib/router';
import { moodColor, pickScene, sceneUrl } from '../lib/scenes';
import { update, useStore } from '../lib/store';
import { IconCheck, IconFlame, IconForward, IconSettings, Logo } from '../components/Icons';
import { TabBar } from '../components/ui';
import { APP_NAME } from '../lib/share';

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export function NamePrompt() {
  const [name, setName] = useState('');
  const done = (n: string) => update(() => ({ name: n.trim().slice(0, 40), onboarded: true }));
  return (
    <div className="onboard">
      <div className="onboard-art" style={{ backgroundImage: `url("${sceneUrl(pickScene('welcome', ['dawn']))}")` }} />
      <form className="onboard-box" onSubmit={(e) => { e.preventDefault(); done(name); }}>
        <Logo size={56} />
        <h1>{APP_NAME}</h1>
        <p className="lead">A verse for what's on your mind.</p>
        <label htmlFor="name">What should we call you?</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" maxLength={40} enterKeyHint="go" />
        <button className="btn wide" type="submit">Continue</button>
        <button className="link" type="button" onClick={() => done('')}>Skip for now</button>
        <p className="hint">No account, no password. Your name, saved verses and notes stay on this device.</p>
      </form>
    </div>
  );
}

export function Home() {
  const name = useStore((s) => s.name);
  const streak = useStore((s) => s.streak);
  const stored = useStore((s) => s.topics);
  const [picked, setPicked] = useState<string[]>(stored);
  const votd = verseOfTheDay();
  const votdTopic = votd?.topics[0];
  const votdScene = votd ? pickScene(votd.key, TOPICS.find((t) => t.id === votdTopic)?.moods ?? ['dawn']) : null;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const start = (topics: string[]) => {
    update(() => ({ topics }));
    navigate('/feed');
  };
  const n = countForTopics(picked);

  return (
    <div className="screen home">
      <div className="scroll">
        <header className="home-head">
          <div className="brand"><Logo size={30} /><span>{APP_NAME}</span></div>
          <button className="icon-btn" aria-label="Settings" onClick={() => navigate('/settings')}><IconSettings size={22} /></button>
        </header>

        <div className="hello">
          <h1>{greeting(name)}</h1>
          {streak.count > 1 && (
            <span className="streak" title={`Best: ${streak.best} days`}><IconFlame size={16} />{streak.count}-day streak</span>
          )}
        </div>

        {votd && votdScene && (
          <button className={`votd ink-${votdScene.ink}`} onClick={() => navigate(versePath(votd))} aria-label={`Verse of the day: ${formatRef(votd)}. Open`}>
            <span className={'votd-bg' + (votdScene.kind === 'photo' ? ' photo' : '')} style={{ backgroundImage: `url("${sceneUrl(votdScene)}")` }} />
            <span className="votd-label">Verse of the day</span>
            <span className="votd-text">{votd.text}</span>
            <span className="votd-ref">{formatRef(votd)}{votdTopic ? ` · ${topicLabel(votdTopic)}` : ''}</span>
          </button>
        )}

        <section aria-labelledby="mind">
          <h2 id="mind" className="ask">What's on your mind?</h2>
          <p className="sub">Tap everything that fits.</p>
          <div className="topics" role="group" aria-labelledby="mind">
            {TOPICS.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button key={t.id} className={'topic' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(t.id)}
                  style={{ ['--dot' as string]: moodColor(t.moods[0]) }}>
                  <span className="dot" aria-hidden>{on && <IconCheck size={12} />}</span>
                  <span className="topic-label">{t.label}</span>
                  <span className="topic-n" aria-hidden>{countForTopic(t.id)}</span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="home-pad" />
      </div>

      <div className="cta" data-nogesture>
        {picked.length > 0 ? (
          <>
            <button className="btn wide big" onClick={() => start(picked)}>
              Show me {n} {n === 1 ? 'verse' : 'verses'} <IconForward size={18} />
            </button>
            <button className="link" onClick={() => setPicked([])}>Clear</button>
          </>
        ) : (
          <button className="btn wide big soft" onClick={() => start([])}>
            Surprise me with all {CARDS.length} verses <IconForward size={18} />
          </button>
        )}
      </div>
      <TabBar />
    </div>
  );
}
