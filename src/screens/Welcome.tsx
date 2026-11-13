import { useEffect, useMemo, useState } from 'react';
import { topicById } from '../data/topics';
import { loadBible, useBible } from '../lib/bible';
import { formatRef, type VerseKey } from '../lib/books';
import { CARDS, cardByKey, type Card } from '../lib/feed';
import { useInstall } from '../lib/install';
import { AREAS, MOODS, NEEDS, type Choice } from '../lib/journey';
import { navigate } from '../lib/router';
import { hash, pickPictorial } from '../lib/scenes';
import { dayNumber, getState, save, toggleMemorise, touchStreak, update } from '../lib/store';
import { AREA_ART, MOOD_ART, NEED_ART } from '../components/Glyphs';
import { IconBack, IconFlame, IconForward, IconMemory, IconRefresh, Logo } from '../components/Icons';
import { openInstall } from '../components/InstallPrompt';
import { SceneView } from '../components/Scene';
import { Scripture } from '../components/Scripture';
import { buzz, HAPTIC } from '../components/ui';
import { Session } from './Memorise';

// The welcome: three taps about how you are, then a verse for it straight
// away, a first go at learning it, and day one of a streak. Few words.

type Stage = 'hello' | 'mood' | 'area' | 'need' | 'verse' | 'learn' | 'done';

/**
 * Chooses the verse by counting matches with the three answers. What the person
 * says they need counts most. Shorter verses are favoured, since this one will
 * be learned by heart. Ties are settled by the date, so it is repeatable.
 */
export function chooseVerse(mood: Choice, area: Choice, need: Choice, skip: Set<VerseKey>): Card {
  const day = dayNumber();
  let best = CARDS[0], bestScore = -Infinity;
  for (const c of CARDS) {
    if (skip.has(c.key)) continue;
    let score = 0;
    need.topics.forEach((t, i) => { if (c.topics.includes(t)) score += i === 0 ? 4 : 3; });
    mood.topics.forEach((t) => { if (c.topics.includes(t)) score += 2; });
    area.topics.forEach((t) => { if (c.topics.includes(t)) score += 2; });
    if (c.text.length <= 130) score += 1.5;
    else if (c.text.length > 220) score -= 2;
    score += (hash(`${c.key}:${day}`) % 1000) / 2000;
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}

function Ask({ step, title, choices, art, onPick, onBack }: {
  step: number;
  title: string;
  choices: Choice[];
  art: Record<string, (p: { size?: number }) => React.ReactElement>;
  onPick: (c: Choice) => void;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="ask-step" key={step}>
      <header className="ask-top">
        <button className="icon-btn" aria-label="Back" onClick={onBack}><IconBack /></button>
        <span className="ask-dots" aria-label={`Question ${step} of 3`}>{[1, 2, 3].map((n) => <i key={n} className={n <= step ? 'on' : ''} />)}</span>
        <span className="icon-btn" />
      </header>
      <h1 className="ask-title">{title}</h1>
      <div className="ask-grid">
        {choices.map((c, i) => {
          const Art = art[c.id];
          return (
            <button key={c.id} className={'ask-tile' + (picked === c.id ? ' picked' : '')} style={{ animationDelay: `${0.05 + i * 0.05}s` }}
              onClick={() => { if (picked) return; buzz(HAPTIC.tap); setPicked(c.id); window.setTimeout(() => onPick(c), 380); }}>
              <Art size={46} />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Welcome() {
  const [stage, setStage] = useState<Stage>('hello');
  const [mood, setMood] = useState<Choice | null>(null);
  const [area, setArea] = useState<Choice | null>(null);
  const [need, setNeed] = useState<Choice | null>(null);
  const [skip, setSkip] = useState<Set<VerseKey>>(new Set());
  const bible = useBible();
  const { ios, standalone } = useInstall();

  // have the Bible ready by the time the learning step needs it
  useEffect(() => { loadBible().catch(() => undefined); }, []);

  const verse = useMemo(() => (mood && area && need ? chooseVerse(mood, area, need, skip) : null), [mood, area, need, skip]);
  const topic = verse ? verse.topics.find((t) => need?.topics.includes(t)) ?? verse.topics[0] : undefined;
  const scene = useMemo(
    () => pickPictorial(verse?.key ?? 'welcome', verse && topic ? topicById(topic)?.moods ?? ['dawn'] : ['dawn']),
    [verse, topic],
  );

  const finish = () => {
    touchStreak();
    update(() => ({ onboarded: true }));
    navigate('/', { replace: true });
  };
  const remember = (v: Card) => {
    const topics = [...new Set([...(need?.topics ?? []), ...(mood?.topics ?? [])])].slice(0, 3);
    update(() => ({ intro: { mood: mood!.id, area: area!.id, need: need!.id, verse: v.key }, topics }));
  };

  if (stage === 'learn' && verse) {
    if (!bible.ready) return <div className="welcome"><SceneView scene={scene} live /><p className="welcome-wait" role="status">One moment…</p></div>;
    return (
      <Session
        keys={[verse.key]}
        plan={[{ kind: 'blanks', ratio: 0.3 }]}
        onFinish={() => setStage('done')}
        onStop={finish}
      />
    );
  }

  const streak = getState().streak.count || 1;
  return (
    <div className={'welcome stage-' + stage}>
      <SceneView scene={scene} live />
      <div className="welcome-shade" />

      {stage === 'hello' && (
        <div className="welcome-body intro">
          <Logo size={64} />
          <h1>Chestnut</h1>
          <p className="lead">A verse for what's on your mind.</p>
          <button className="btn light wide big" onClick={() => setStage('mood')}>Begin <IconForward size={18} /></button>
          <button className="link" onClick={finish}>Skip</button>
          {ios && !standalone && (
            <button className="welcome-install" onClick={openInstall}>On iPhone? Add to your home screen first <IconForward size={14} /></button>
          )}
        </div>
      )}

      {stage === 'mood' && <Ask step={1} title="How are you today?" choices={MOODS} art={MOOD_ART} onBack={() => setStage('hello')} onPick={(c) => { setMood(c); setStage('area'); }} />}
      {stage === 'area' && <Ask step={2} title="What is it about?" choices={AREAS} art={AREA_ART} onBack={() => setStage('mood')} onPick={(c) => { setArea(c); setStage('need'); }} />}
      {stage === 'need' && <Ask step={3} title="What would help most?" choices={NEEDS} art={NEED_ART} onBack={() => setStage('area')} onPick={(c) => { setNeed(c); setSkip(new Set()); setStage('verse'); }} />}

      {stage === 'verse' && verse && (
        <div className="welcome-body gift" key={verse.key}>
          <span className="card-topic">For you</span>
          <p className="gift-text"><Scripture text={verse.text} reveal /></p>
          <span className="card-rule" aria-hidden />
          <p className="gift-ref">{formatRef(verse)}</p>
          <div className="gift-actions">
            <button className="btn light wide big" onClick={() => {
              remember(verse);
              save(verse.key);
              if (!getState().memory[verse.key]) toggleMemorise(verse.key);
              buzz(HAPTIC.save);
              setStage('learn');
            }}>
              <IconMemory size={19} /> Learn this verse
            </button>
            <div className="row gap center">
              <button className="btn ghost-light small" onClick={() => setSkip((s) => new Set(s).add(verse.key))}><IconRefresh size={15} /> Another</button>
              <button className="btn ghost-light small" onClick={() => { remember(verse); finish(); }}>Not now</button>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && verse && (
        <div className="welcome-body day-one">
          <span className="flame" aria-hidden><IconFlame size={64} /><b>{streak}</b></span>
          <h1>Day {streak}</h1>
          <div className="week" aria-label="This week">
            {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < streak ? 'on' : ''} style={{ animationDelay: `${0.25 + i * 0.07}s` }} />)}
          </div>
          <p className="day-verse"><IconMemory size={18} /> {formatRef(cardByKey(verse.key) ?? verse)}</p>
          <p className="lead small">It comes back tomorrow.</p>
          <button className="btn light wide big" onClick={finish}>Continue <IconForward size={18} /></button>
        </div>
      )}
    </div>
  );
}
