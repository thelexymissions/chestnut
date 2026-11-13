import { useEffect, useMemo, useRef, useState } from 'react';
import { getVerse, useBible } from '../lib/bible';
import { formatRef, keyOf, refOf, type Ref, type VerseKey } from '../lib/books';
import { cardByKey } from '../lib/feed';
import {
  applyResult, dueLabel, isDue, levelOf, MEMORISED_BOX, passes, pickBlanks, planFor, referenceChoices, rng,
  STEP_NAMES, tokenize, verseChoices, wordChoices, type Level, type Step, type StepKind,
} from '../lib/memory';
import { back, navigate, type Route } from '../lib/router';
import { speak, speechSupported, useSpeaking } from '../lib/speech';
import { dayNumber, getState, setMemory, toggleMemorise, useStore, type MemoryEntry } from '../lib/store';
import { IconCheck, IconClose, IconEye, IconForward, IconMemory, IconSpeaker, IconStop, IconTrash } from '../components/Icons';
import { Scripture, smallCaps } from '../components/Scripture';
import { buzz, celebrate, HAPTIC, Sheet, TabBar, toast } from '../components/ui';

interface Verse extends Ref { key: VerseKey; text: string }

function verseOf(key: VerseKey): Verse | undefined {
  const r = refOf(key);
  const text = cardByKey(key)?.text ?? getVerse(r);
  return text ? { ...r, key, text } : undefined;
}

const LEVELS: Level[] = ['New', 'Learning', 'Familiar', 'Memorised'];

// =====================================================================
// Exercises. Each reports how many prompts were answered right first time.
// =====================================================================
interface Outcome { firstTry: number; prompts: number; self: boolean | null }
interface ExerciseProps { verse: Verse; seed: string; onDone: (o: Outcome) => void }

function Choices({ options, wrong, onPick, columns, render }: {
  options: string[];
  wrong: Set<string>;
  onPick: (o: string) => void;
  columns: number;
  render?: (o: string) => React.ReactNode;
}) {
  return (
    <div className={'choices cols-' + columns}>
      {options.map((o) => (
        <button key={o} className={'choice' + (wrong.has(o) ? ' wrong' : '')} disabled={wrong.has(o)} onClick={() => onPick(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

/** Fill in the blanks, and its harder form where every word is reduced to its first letter. */
function WordsExercise({ verse, seed, onDone, ratio, letters }: ExerciseProps & { ratio: number; letters?: boolean }) {
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);
  const hidden = useMemo(
    () => (letters ? tokens.map((t, i) => (t.word ? i : -1)).filter((i) => i >= 0) : pickBlanks(tokens, ratio, rng(seed + ':pick'))),
    [tokens, ratio, letters, seed],
  );
  const [pos, setPos] = useState(0);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [firstTry, setFirstTry] = useState(0);
  const current = useRef<HTMLSpanElement>(null);
  const done = pos >= hidden.length;
  const answer = done ? '' : tokens[hidden[pos]].word;
  const options = useMemo(
    () => (done ? [] : wordChoices(answer, verse, letters ? 3 : 4, rng(`${seed}:${pos}`), letters)),
    [answer, done, letters, pos, seed, verse],
  );

  useEffect(() => { current.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [pos]);

  const pick = (o: string) => {
    if (o === answer) {
      buzz(HAPTIC.right);
      if (wrong.size === 0) setFirstTry((n) => n + 1);
      setWrong(new Set());
      setPos((p) => p + 1);
    } else {
      buzz(HAPTIC.wrong);
      setWrong((w) => new Set(w).add(o));
    }
  };

  const order = new Map(hidden.map((ti, n) => [ti, n]));
  return (
    <div className="ex">
      <div className="ex-body">
        <p className="ex-ref">{formatRef(verse)}</p>
        <p className={'ex-verse' + (letters ? ' letters' : '')}>
          {tokens.map((t, i) => {
            const n = order.get(i);
            const open = n !== undefined && n >= pos;
            return (
              <span key={i} className="tok">
                {t.pre}
                {open ? (
                  <span ref={n === pos ? current : undefined} className={'blank' + (n === pos ? ' current' : '')} style={{ minWidth: letters ? undefined : `${Math.max(2.2, t.word.length * 0.52)}em` }}>
                    {letters ? t.word[0] : ' '}
                  </span>
                ) : (
                  <span className={n !== undefined ? 'filled' : undefined}>{smallCaps(t.word, `${i}-`)}</span>
                )}
                {t.post}{' '}
              </span>
            );
          })}
        </p>
      </div>
      <div className="ex-foot">
        {done ? (
          <>
            <p className="ex-score" role="status">{firstTry} of {hidden.length} right first time</p>
            <button className="btn wide big" onClick={() => onDone({ firstTry, prompts: hidden.length, self: null })}>Continue <IconForward size={18} /></button>
          </>
        ) : (
          <>
            <p className="ex-hint">{letters ? 'Which word comes next?' : 'Tap the missing word'} <span>{pos + 1} / {hidden.length}</span></p>
            <Choices options={options} wrong={wrong} onPick={pick} columns={letters ? 3 : 2} />
          </>
        )}
      </div>
    </div>
  );
}

/** See the verse, pick its reference. Exactly one of the four is right. */
function RefExercise({ verse, seed, onDone, memoryKeys }: ExerciseProps & { memoryKeys: VerseKey[] }) {
  const options = useMemo(() => referenceChoices(verse, memoryKeys, rng(seed)).map(formatRef), [verse, memoryKeys, seed]);
  const answer = formatRef(verse);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const pick = (o: string) => {
    if (o === answer) { buzz(HAPTIC.right); setDone(true); }
    else { buzz(HAPTIC.wrong); setWrong((w) => new Set(w).add(o)); }
  };
  return (
    <div className="ex">
      <div className="ex-body centred">
        <p className="ex-verse"><Scripture text={verse.text} /></p>
        {done && <p className="ex-ref reveal">{answer}</p>}
      </div>
      <div className="ex-foot">
        {done ? (
          <>
            <p className="ex-score" role="status">{wrong.size === 0 ? 'Right first time' : 'Got there'}</p>
            <button className="btn wide big" onClick={() => onDone({ firstTry: wrong.size === 0 ? 1 : 0, prompts: 1, self: null })}>Continue <IconForward size={18} /></button>
          </>
        ) : (
          <>
            <p className="ex-hint">Where is this verse found?</p>
            <Choices options={options} wrong={wrong} onPick={pick} columns={2} />
          </>
        )}
      </div>
    </div>
  );
}

/** See the reference, pick its verse. Exactly one of the four is right. */
function VerseExercise({ verse, seed, onDone, memoryKeys }: ExerciseProps & { memoryKeys: VerseKey[] }) {
  const options = useMemo(
    () => verseChoices(verse, memoryKeys, rng(seed)).map((r) => ({ key: keyOf(r), text: getVerse(r) ?? '' })),
    [verse, memoryKeys, seed],
  );
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const pick = (k: string) => {
    if (k === verse.key) { buzz(HAPTIC.right); setDone(true); }
    else { buzz(HAPTIC.wrong); setWrong((w) => new Set(w).add(k)); }
  };
  return (
    <div className="ex">
      <div className="ex-body">
        <p className="ex-bigref">{formatRef(verse)}</p>
        <p className="ex-hint left">{done ? (wrong.size === 0 ? 'Right first time' : 'Got there') : 'Which of these is it?'}</p>
        <div className="opts">
          {options.map((o) => (
            <button key={o.key} className={'opt' + (wrong.has(o.key) ? ' wrong' : '') + (done && o.key === verse.key ? ' right' : '')}
              disabled={done || wrong.has(o.key)} onClick={() => pick(o.key)}>
              <Scripture text={o.text} />
            </button>
          ))}
        </div>
      </div>
      {done && (
        <div className="ex-foot">
          <button className="btn wide big" onClick={() => onDone({ firstTry: wrong.size === 0 ? 1 : 0, prompts: 1, self: null })}>Continue <IconForward size={18} /></button>
        </div>
      )}
    </div>
  );
}

/** Say it from memory, then check. The only exercise the reader marks for themselves. */
function ReciteExercise({ verse, onDone }: ExerciseProps) {
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(false);
  const letters = useMemo(() => tokenize(verse.text).map((t) => t.pre + (t.word ? t.word[0] : '') + t.post).join(' '), [verse.text]);
  return (
    <div className="ex">
      <div className="ex-body centred">
        <p className="ex-bigref">{formatRef(verse)}</p>
        {shown ? <p className="ex-verse reveal"><Scripture text={verse.text} /></p>
          : hint ? <p className="ex-verse letters muted">{letters}</p>
          : <p className="ex-prompt">Say the verse aloud or in your head, then check it.</p>}
      </div>
      <div className="ex-foot">
        {shown ? (
          <>
            <p className="ex-hint">You mark this one yourself. Did you have it word for word?</p>
            <div className="row gap">
              <button className="btn ghost wide big" onClick={() => onDone({ firstTry: 0, prompts: 0, self: false })}>Not yet</button>
              <button className="btn wide big" onClick={() => { buzz(HAPTIC.right); onDone({ firstTry: 0, prompts: 0, self: true }); }}>I had it</button>
            </div>
          </>
        ) : (
          <div className="row gap">
            {!hint && <button className="btn ghost wide big" onClick={() => setHint(true)}>First letters</button>}
            <button className="btn wide big" onClick={() => setShown(true)}><IconEye size={19} /> Reveal</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** First meeting with a verse: read it, hear it, then start. */
function LearnStep({ verse, onDone }: ExerciseProps) {
  const speaking = useSpeaking() === 'learn:' + verse.key;
  return (
    <div className="ex">
      <div className="ex-body centred">
        <p className="ex-ref">{formatRef(verse)}</p>
        <p className="ex-verse large"><Scripture text={verse.text} /></p>
        {speechSupported() && (
          <button className="btn ghost small" onClick={() => speak('learn:' + verse.key, [verse.text])}>
            {speaking ? <IconStop size={16} /> : <IconSpeaker size={16} />} {speaking ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>
      <div className="ex-foot">
        <p className="ex-hint">Read it slowly, twice. Then the practice begins.</p>
        <button className="btn wide big" onClick={() => onDone({ firstTry: 0, prompts: 0, self: null })}>I have read it <IconForward size={18} /></button>
      </div>
    </div>
  );
}

function StepView({ step, verse, seed, memoryKeys, onDone }: { step: Step; verse: Verse; seed: string; memoryKeys: VerseKey[]; onDone: (o: Outcome) => void }) {
  const props = { verse, seed, onDone };
  switch (step.kind) {
    case 'learn': return <LearnStep {...props} />;
    case 'blanks': return <WordsExercise {...props} ratio={step.ratio ?? 0.45} />;
    case 'letters': return <WordsExercise {...props} ratio={1} letters />;
    case 'ref': return <RefExercise {...props} memoryKeys={memoryKeys} />;
    case 'verse': return <VerseExercise {...props} memoryKeys={memoryKeys} />;
    case 'recite': return <ReciteExercise {...props} />;
  }
}

// =====================================================================
// A sitting: either the verses due today, or extra practice on one verse.
// =====================================================================
interface VerseResult { key: VerseKey; passed: boolean; firstTry: number; prompts: number; next: string; level: Level }

function Session({ keys, free }: { keys: VerseKey[]; free?: Step }) {
  // the list is fixed when the sitting starts, so finishing a verse does not reshuffle it
  const [queue] = useState(keys);
  const [nonce] = useState(() => Date.now().toString(36));
  const [vi, setVi] = useState(0);
  const [si, setSi] = useState(0);
  const [tally, setTally] = useState<Outcome>({ firstTry: 0, prompts: 0, self: null });
  const [results, setResults] = useState<VerseResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const memoryKeys = useMemo(() => Object.keys(getState().memory), []);

  const key = queue[vi];
  const verse = key ? verseOf(key) : undefined;
  const entry: MemoryEntry | undefined = key ? getState().memory[key] : undefined;
  // the plan is fixed from the level the verse had when its turn began
  const plan = useMemo(() => (free ? [free] : planFor(entry?.box ?? 0)), [key, free]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalSteps = queue.length * plan.length;
  const doneSteps = vi * plan.length + si + (showResult ? plan.length - si : 0);

  if (vi >= queue.length || !verse) {
    const passed = results.filter((r) => r.passed).length;
    return (
      <div className="screen session">
        <div className="scroll session-end">
          <span className="end-mark" aria-hidden>{'❦'}</span>
          <h1>{free ? 'Practice complete' : 'Review complete'}</h1>
          <p className="sub">{free ? 'Extra practice does not change your review schedule.' : `${passed} of ${results.length} ${results.length === 1 ? 'verse' : 'verses'} moved forward.`}</p>
          <ul className="result-list">
            {results.map((r) => (
              <li key={r.key}>
                <span className={'badge ' + (r.passed ? 'ok' : 'again')}>{r.passed ? <IconCheck size={14} /> : '↻'}</span>
                <span><strong>{formatRef(refOf(r.key))}</strong>{r.prompts > 0 && <small>{r.firstTry} of {r.prompts} right first time</small>}</span>
                {!free && <em>{r.next}</em>}
              </li>
            ))}
          </ul>
          <button className="btn wide big" onClick={() => navigate('/memorise', { replace: true })}>Done</button>
        </div>
      </div>
    );
  }

  const finishVerse = (total: Outcome) => {
    const passed = passes(total.firstTry, total.prompts, total.self);
    let next = '';
    let level: Level = levelOf(entry?.box ?? 0);
    if (!free && entry) {
      const updated = applyResult(entry, passed, dayNumber());
      setMemory(key, updated);
      next = dueLabel(updated);
      level = levelOf(updated.box);
      if (passed && updated.box === MEMORISED_BOX) celebrate('Memorised', formatRef(verse));
    }
    buzz(passed ? HAPTIC.done : HAPTIC.tap);
    setResults((r) => [...r, { key, passed, firstTry: total.firstTry, prompts: total.prompts, next, level }]);
    setShowResult(true);
  };

  const onStepDone = (o: Outcome) => {
    const total: Outcome = { firstTry: tally.firstTry + o.firstTry, prompts: tally.prompts + o.prompts, self: o.self ?? tally.self };
    if (si + 1 < plan.length) {
      setTally(total);
      setSi(si + 1);
    } else finishVerse(total);
  };

  const nextVerse = () => {
    setShowResult(false);
    setTally({ firstTry: 0, prompts: 0, self: null });
    setSi(0);
    setVi(vi + 1);
  };

  const last = results[results.length - 1];
  const step = plan[si];
  return (
    <div className="screen session">
      <header className="session-bar">
        <button className="icon-btn" aria-label="Stop" onClick={() => { if (results.length === 0 && si === 0 || window.confirm('Stop here? Verses you have finished stay counted.')) back('/memorise'); }}><IconClose /></button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={doneSteps} aria-label="Progress">
          <i style={{ transform: `scaleX(${totalSteps ? doneSteps / totalSteps : 0})` }} />
        </div>
        <span className="session-count">{vi + 1}/{queue.length}</span>
      </header>
      {showResult && last ? (
        <div className="ex verse-result" key={'r' + vi}>
          <div className="ex-body centred">
            <span className={'big-badge ' + (last.passed ? 'ok' : 'again')}>{last.passed ? <IconCheck size={34} /> : '↻'}</span>
            <h2>{free ? 'Practice done' : last.passed ? 'Well done' : 'Not quite yet'}</h2>
            <p className="ex-ref">{formatRef(verse)}</p>
            {last.prompts > 0 && <p className="sub">{last.firstTry} of {last.prompts} right first time</p>}
            {!free && (
              <p className="sub">
                {last.passed ? <>Now <strong>{last.level}</strong>. Next review: {last.next.toLowerCase()}.</> : <>It comes back <strong>tomorrow</strong> for another go.</>}
              </p>
            )}
            {free && <p className="sub">Extra practice does not change your review schedule.</p>}
          </div>
          <div className="ex-foot">
            <button className="btn wide big" onClick={nextVerse}>{vi + 1 < queue.length ? 'Next verse' : 'Finish'} <IconForward size={18} /></button>
          </div>
        </div>
      ) : (
        <div className="step" key={`${vi}-${si}`}>
          <p className="step-name">{STEP_NAMES[step.kind]}</p>
          <StepView step={step} verse={verse} seed={`${key}:${free ? nonce : entry?.reviews ?? 0}:${si}:${step.kind}`} memoryKeys={memoryKeys} onDone={onStepDone} />
        </div>
      )}
    </div>
  );
}

// =====================================================================
// The list
// =====================================================================
const PRACTICE: { kind: StepKind; note: string }[] = [
  { kind: 'blanks', note: 'Tap the missing words' },
  { kind: 'letters', note: 'Only first letters shown' },
  { kind: 'ref', note: 'Pick where it is found' },
  { kind: 'verse', note: 'Pick it out from four' },
  { kind: 'recite', note: 'Say it, then check' },
];

function MemoriseHome() {
  const memory = useStore((s) => s.memory);
  const saved = useStore((s) => s.saved);
  const [detail, setDetail] = useState<VerseKey | null>(null);
  const [adding, setAdding] = useState(false);
  const today = dayNumber();

  const keys = useMemo(
    () => Object.keys(memory).sort((a, b) => memory[a].dueDay - memory[b].dueDay || memory[a].added - memory[b].added),
    [memory],
  );
  const due = keys.filter((k) => isDue(memory[k], today));
  const counts = LEVELS.map((l) => keys.filter((k) => levelOf(memory[k].box) === l).length);
  const candidates = Object.keys(saved).filter((k) => !memory[k]).sort((a, b) => saved[b] - saved[a]);
  const nextDue = keys.length ? Math.min(...keys.map((k) => memory[k].dueDay)) : today;
  const dv = detail ? verseOf(detail) : undefined;
  const de = detail ? memory[detail] : undefined;

  return (
    <div className="screen memorise">
      <div className="scroll">
        <header className="page-head">
          <h1>Memorise</h1>
          <p className="sub">Short reviews, spaced further apart each time, so the verses stay with you.</p>
        </header>

        {keys.length === 0 ? (
          <div className="empty">
            <IconMemory size={40} />
            <h2>Choose verses to memorise</h2>
            <p>On any verse, open More and choose Memorise. It appears here, ready to learn.</p>
            {candidates.length > 0
              ? <button className="btn" onClick={() => setAdding(true)}>Choose from your saved verses</button>
              : <button className="btn" onClick={() => navigate('/feed')}>Browse verses</button>}
          </div>
        ) : (
          <>
            <div className={'due-card' + (due.length ? '' : ' calm')}>
              {due.length ? (
                <>
                  <div><strong>{due.length}</strong><span>{due.length === 1 ? 'verse to review today' : 'verses to review today'}</span></div>
                  <button className="btn light" onClick={() => navigate('/memorise/review')}>Start <IconForward size={18} /></button>
                </>
              ) : (
                <div><strong className="word">All caught up</strong><span>Next review: {dueLabel({ ...memory[keys[0]], dueDay: nextDue }, today).toLowerCase()}</span></div>
              )}
            </div>

            <div className="levels" aria-label="Your verses by stage">
              {LEVELS.map((l, i) => (
                <div key={l} className={'level l' + i}><strong>{counts[i]}</strong><span>{l}</span></div>
              ))}
            </div>

            <ul className="mem-list">
              {keys.map((k) => {
                const v = verseOf(k);
                const e = memory[k];
                if (!v) return null;
                const lvl = levelOf(e.box);
                return (
                  <li key={k}>
                    <button className="mem-row" onClick={() => setDetail(k)}>
                      <span className={'stage-dot l' + LEVELS.indexOf(lvl)} aria-hidden />
                      <span className="mem-main"><strong>{formatRef(v)}</strong><span>{v.text}</span></span>
                      <span className={'mem-due' + (isDue(e, today) ? ' now' : '')}><em>{lvl}</em>{dueLabel(e, today)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {candidates.length > 0 && <button className="btn ghost wide" onClick={() => setAdding(true)}>Add from your saved verses</button>}
            <p className="hint centre">Blanks, first letters and references are marked by exact match with the Bible text. Only Recite and reveal is marked by you.</p>
          </>
        )}
      </div>
      <TabBar />

      <Sheet open={!!detail && !!dv} onClose={() => setDetail(null)} title={dv ? formatRef(dv) : ''} tall>
        {dv && de && (
          <>
            <blockquote className="sheet-quote"><Scripture text={dv.text} /><cite>{levelOf(de.box)} · {dueLabel(de, today)}</cite></blockquote>
            <p className="label">Extra practice</p>
            <div className="practice-grid">
              {PRACTICE.map((p) => (
                <button key={p.kind} onClick={() => { setDetail(null); navigate(`/memorise/practice/${dv.key}/${p.kind}`); }}>
                  <strong>{STEP_NAMES[p.kind]}</strong><span>{p.note}</span>
                </button>
              ))}
            </div>
            <p className="hint">Extra practice does not change the review schedule; only the due reviews do.</p>
            <button className="btn danger small" onClick={() => { if (window.confirm('Remove this verse from Memorise? Its progress will be lost.')) { toggleMemorise(dv.key); setDetail(null); toast('Removed from Memorise'); } }}>
              <IconTrash size={15} /> Remove from Memorise
            </button>
          </>
        )}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add from saved" tall>
        {candidates.length === 0 ? <p className="hint">Every saved verse is already on your list.</p> : (
          <ul className="add-list">
            {candidates.map((k) => {
              const v = verseOf(k);
              if (!v) return null;
              return (
                <li key={k}>
                  <span><strong>{formatRef(v)}</strong><span>{v.text}</span></span>
                  <button className="btn small" onClick={() => { toggleMemorise(k); buzz(HAPTIC.save); }}>Add</button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

const KINDS: StepKind[] = ['blanks', 'letters', 'ref', 'verse', 'recite'];

export function Memorise({ route }: { route: Route }) {
  const { ready, error } = useBible();
  const [, mode, key, kind] = route.parts;
  // the verses due when the review was opened
  const dueKeys = useMemo(() => {
    const m = getState().memory;
    const today = dayNumber();
    return Object.keys(m).filter((k) => isDue(m[k], today)).sort((a, b) => m[a].dueDay - m[b].dueDay || m[a].added - m[b].added);
  }, [mode]);

  if (!ready) {
    return (
      <div className="screen memorise">
        <div className="empty">
          {error ? (<><h2>The Bible could not be loaded</h2><p>Check your connection and try again.</p><button className="btn" onClick={() => window.location.reload()}>Try again</button></>) : <p>Opening the Bible…</p>}
        </div>
        <TabBar />
      </div>
    );
  }
  if (mode === 'review' && dueKeys.length) return <Session key="review" keys={dueKeys} />;
  if (mode === 'practice' && key && KINDS.includes(kind as StepKind) && verseOf(key)) {
    return <Session key={`${key}-${kind}`} keys={[key]} free={{ kind: kind as StepKind, ratio: 0.5 }} />;
  }
  return <MemoriseHome />;
}
