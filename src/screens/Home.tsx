import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOPICS, topicLabel } from '../data/topics';
import { getVerse, loadBible, useBible } from '../lib/bible';
import { formatRef, refOf, versePath, type Ref, type VerseKey } from '../lib/books';
import { homePassage } from '../lib/centre';
import { cardByKey, countForTopic, countForTopics, verseOfTheDay } from '../lib/feed';
import { journeyState, STEPS } from '../lib/journey';
import { isDue, MEMORISED_BOX } from '../lib/memory';
import { navigate } from '../lib/router';
import { moodColor, pickPictorial, sceneUrl } from '../lib/scenes';
import { APP_NAME } from '../lib/share';
import { update, useStore } from '../lib/store';
import { CrossScene } from '../components/CrossScene';
import { STEP_ART } from '../components/Glyphs';
import { IconCheck, IconEdit, IconFlame, IconForward, IconMemory, IconSettings, IconSprout, IconStar, Logo } from '../components/Icons';
import { Scripture } from '../components/Scripture';
import { SoundButton } from '../components/Sound';
import { buzz, HAPTIC, Sheet, TabBar, toast } from '../components/ui';

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

/** The getting-started path: a row of steps, with the next one called out beneath. */
function Path() {
  const state = useStore((s) => s);
  const done = journeyState(state);
  const count = STEPS.filter((s) => done[s.id]).length;
  if (count === STEPS.length) return null;
  const next = STEPS.find((s) => !done[s.id] && s.to) ?? STEPS.find((s) => !done[s.id])!;
  const Art = STEP_ART[next.id];
  return (
    <section className="path" aria-label={`Getting started: ${count} of ${STEPS.length} steps done`}>
      <div className="path-track">
        <span className="path-line"><i style={{ transform: `scaleX(${Math.max(0, (count - 0.5) / (STEPS.length - 1))})` }} /></span>
        {STEPS.map((s) => {
          const A = STEP_ART[s.id];
          const cls = done[s.id] ? ' done' : s.id === next.id ? ' next' : '';
          return (
            <button key={s.id} className={'path-node' + cls} aria-label={`${s.label}${done[s.id] ? ', done' : ''}`}
              disabled={!s.to} onClick={() => s.to && navigate(s.to)}>
              {done[s.id] ? <IconCheck size={15} /> : <A size={18} />}
            </button>
          );
        })}
      </div>
      <button className="path-next" disabled={!next.to} onClick={() => next.to && navigate(next.to)}>
        <span className="path-art"><Art size={30} /></span>
        <span className="path-text"><small>Step {count + 1} of {STEPS.length}</small><strong>{next.cue}</strong></span>
        {next.to && <IconForward size={18} />}
      </button>
    </section>
  );
}

/** A saved verse's words: from the feed's list, or from the Bible itself once it is loaded. */
const textOf = (key: VerseKey): string | undefined => cardByKey(key)?.text ?? getVerse(refOf(key));

/**
 * The centrepiece: the cross, the name, and a passage beneath them. The passage is one of the
 * reader's own saved verses if they have chosen one, and Romans 8:1-2 otherwise. Opens the passage.
 */
function Centre() {
  const saved = useStore((s) => s.saved);
  const chosen = useStore((s) => s.homeVerse);
  const bible = useBible();
  const [picking, setPicking] = useState(false);
  // a verse taken off the saved list no longer stands on Home
  const key = chosen && saved[chosen] !== undefined ? chosen : null;
  const keys = Object.keys(saved).sort((a, b) => saved[b] - saved[a]);
  // verses saved from the Bible reader are read from the Bible itself
  const needsBible = (key !== null && !cardByKey(key)) || (picking && keys.some((k) => !cardByKey(k)));
  useEffect(() => { if (needsBible && !bible.ready) loadBible().catch(() => undefined); }, [needsBible, bible.ready]);

  const own = key ? textOf(key) : undefined;
  const p: { at: Ref; parts: string[]; ref: string } = key
    ? { at: refOf(key), parts: own ? [own] : [], ref: formatRef(refOf(key)) }
    : { at: homePassage, parts: homePassage.parts, ref: homePassage.ref };
  const long = p.parts.join(' ').length > 230;
  const choose = (k: VerseKey | null) => {
    update(() => ({ homeVerse: k }));
    buzz(HAPTIC.tap);
    setPicking(false);
    toast(k ? `${formatRef(refOf(k))} is on your Home screen` : 'Back to Romans 8:1\u20132');
  };
  return (
    <div className="centre-wrap">
      <button className="centre" onClick={() => navigate(versePath(p.at))} aria-label={`Jesus. ${p.parts.join(' ')} ${p.ref}. Open this passage`}>
        <CrossScene variant="wide" live />
        <span className="centre-sky"><strong className="centre-name">Jesus</strong></span>
        <span className="centre-foot">
          <span className={'centre-verse' + (long ? ' long' : '')}>{p.parts.map((part, i) => <span className="centre-part" key={i}><Scripture text={part} />{' '}</span>)}</span>
          <span className="centre-ref">{p.ref}</span>
        </span>
      </button>
      <button className="centre-change" onClick={() => setPicking(true)} aria-label="Choose the verse shown here"><IconEdit size={15} />Change</button>

      {/* the chooser covers the whole screen, not just this card */}
      {createPortal(
      <Sheet open={picking} onClose={() => setPicking(false)} title="Verse on your Home screen" tall>
        {keys.length === 0 ? (
          <div className="pick-empty">
            <p>Choose any verse you have saved. You have none saved yet.</p>
            <button className="btn" onClick={() => navigate('/feed')}>Browse verses</button>
          </div>
        ) : (
          <ul className="pick-list">
            {keys.map((k) => {
              const text = textOf(k);
              return (
                <li key={k}>
                  <button className={'pick' + (k === key ? ' on' : '')} aria-pressed={k === key} onClick={() => choose(k)}>
                    <span className="pick-mark" aria-hidden>{k === key && <IconCheck size={13} />}</span>
                    <span className="pick-body"><strong>{formatRef(refOf(k))}</strong><span>{text ? <Scripture text={text} /> : 'Opening the Bible…'}</span></span>
                  </button>
                </li>
              );
            })}
            <li>
              <button className={'pick' + (key === null ? ' on' : '')} aria-pressed={key === null} onClick={() => choose(null)}>
                <span className="pick-mark" aria-hidden>{key === null && <IconCheck size={13} />}</span>
                <span className="pick-body"><strong>{homePassage.ref}</strong><span>The app's own passage</span></span>
              </button>
            </li>
          </ul>
        )}
      </Sheet>, document.querySelector('.app') ?? document.body)}
    </div>
  );
}

export function Home() {
  const name = useStore((s) => s.name);
  const streak = useStore((s) => s.streak);
  const stored = useStore((s) => s.topics);
  const memory = useStore((s) => s.memory);
  const [picked, setPicked] = useState<string[]>(stored);
  // the button to open the verses appears only once the choice has been changed here
  const [changed, setChanged] = useState(false);
  const [all, setAll] = useState(false);
  const votd = verseOfTheDay();
  const votdTopic = votd?.topics[0];
  const votdScene = votd ? pickPictorial(votd.key, TOPICS.find((t) => t.id === votdTopic)?.moods ?? ['dawn']) : null;

  const entries = Object.values(memory);
  const due = entries.filter((e) => isDue(e)).length;
  const learning = entries.filter((e) => e.reviews > 0 && e.box < MEMORISED_BOX).length;
  const memorised = entries.filter((e) => e.box >= MEMORISED_BOX).length;

  // the topics someone chose last come first; the rest wait behind "All topics"
  const ordered = [...TOPICS.filter((t) => stored.includes(t.id)), ...TOPICS.filter((t) => !stored.includes(t.id))];
  const shown = all ? ordered : ordered.slice(0, 8);

  const toggle = (id: string) => { setChanged(true); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
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
          <span className="row"><SoundButton plain /><button className="icon-btn" aria-label="Settings" onClick={() => navigate('/settings')}><IconSettings size={22} /></button></span>
        </header>

        <Centre />

        <h1 className="hello">{greeting(name)}</h1>

        <div className="stats" role="group" aria-label="Your progress">
          <div className={'stat flame' + (streak.count > 0 ? ' lit' : '')}><IconFlame size={22} /><strong>{Math.max(streak.count, 1)}</strong><span>{streak.count === 1 ? 'day' : 'days'}</span></div>
          <button className="stat" onClick={() => navigate('/memorise')}><IconSprout size={22} /><strong>{learning}</strong><span>learning</span></button>
          <button className="stat" onClick={() => navigate('/memorise')}><IconStar size={22} /><strong>{memorised}</strong><span>by heart</span></button>
        </div>

        {due > 0 && (
          <button className="due-strip" onClick={() => navigate('/memorise/review')}>
            <IconMemory size={20} />
            <span><strong>{due} to review</strong><small>A few minutes</small></span>
            <IconForward size={18} />
          </button>
        )}

        <Path />

        {votd && votdScene && (
          <button className={`votd ink-${votdScene.ink}`} onClick={() => navigate(versePath(votd))} aria-label={`Verse of the day: ${formatRef(votd)}. Open`}>
            <span className={'votd-bg' + (votdScene.kind === 'photo' ? ' photo' : '')} style={{ backgroundImage: `url("${sceneUrl(votdScene)}")` }} />
            <span className="votd-label">Verse of the day</span>
            <span className="votd-text"><Scripture text={votd.text} /></span>
            <i className="sheen" aria-hidden />
            <span className="votd-ref">{formatRef(votd)}{votdTopic ? ` · ${topicLabel(votdTopic)}` : ''}</span>
          </button>
        )}


        <section aria-labelledby="mind">
          <h2 id="mind" className="ask">What's on your mind?</h2>
          <div className="topics" role="group" aria-labelledby="mind">
            {shown.map((t) => {
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
          <button className="btn ghost wide more-topics" aria-expanded={all} onClick={() => setAll((a) => !a)}>
            {all ? 'Fewer topics' : `All ${TOPICS.length} topics`}
          </button>
        </section>
      </div>

      {changed && (
        <div className="cta" data-nogesture>
          <button className="btn wide big" onClick={() => start(picked)}>
            {picked.length ? <>Show {n} {n === 1 ? 'verse' : 'verses'}</> : <>Show all {n} verses</>} <IconForward size={18} />
          </button>
          {picked.length > 0 && <button className="link" onClick={() => setPicked([])}>Clear</button>}
        </div>
      )}
      <TabBar />
    </div>
  );
}
