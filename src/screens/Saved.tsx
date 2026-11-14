import { useMemo, useState } from 'react';
import { topicById, topicLabel } from '../data/topics';
import { getVerse, useBible } from '../lib/bible';
import { formatRef, refOf, versePath, type VerseKey } from '../lib/books';
import { cardByKey, type Card } from '../lib/feed';
import { navigate } from '../lib/router';
import { pickScene, sceneById, sceneUrl, type Scene } from '../lib/scenes';
import { toggleMemorise, toggleSaved, update, useStore } from '../lib/store';
import { IconBookmark, IconCheck, IconHome, IconMemory, IconNote, IconPlay, IconShare } from '../components/Icons';
import { Scripture } from '../components/Scripture';
import { NoteComposer, NotesList, ShareSheet, type VerseLike } from '../components/VerseSheets';
import { buzz, HAPTIC, Segmented, TabBar, toast } from '../components/ui';

function sceneOf(card: Card, override?: string): Scene {
  return (override && sceneById(override)) || pickScene(card.key, topicById(card.topics[0])?.moods ?? ['earth', 'dawn', 'sky', 'dusk']);
}

function Item({ card, onShare }: { card: Card; onShare: (c: Card, s: Scene) => void }) {
  const saved = useStore((s) => s.saved[card.key] !== undefined);
  const count = useStore((s) => s.notes[card.key]?.length ?? 0);
  const override = useStore((s) => s.bg[card.key]);
  const memorising = useStore((s) => s.memory[card.key] !== undefined);
  const onHome = useStore((s) => s.homeVerse === card.key);
  const [writing, setWriting] = useState(false);
  const scene = sceneOf(card, override);
  return (
    <li className="saved-item">
      <button className={`saved-card ink-${scene.ink}`} onClick={() => navigate(versePath(card))} aria-label={`Open ${formatRef(card)} as a card`}>
        <span className={'votd-bg' + (scene.kind === 'photo' ? ' photo' : '')} style={{ backgroundImage: `url("${sceneUrl(scene)}")` }} />
        <span className="saved-text"><Scripture text={card.text} /></span>
        <span className="saved-ref">{formatRef(card)}{card.topics.length ? ` · ${card.topics.slice(0, 2).map(topicLabel).join(', ')}` : ''}</span>
      </button>
      {/* one saved verse can stand on the Home screen, under the cross */}
      {saved && (
        <button className={'saved-home' + (onHome ? ' on' : '')} aria-pressed={onHome}
          onClick={() => { update(() => ({ homeVerse: onHome ? null : card.key })); buzz(HAPTIC.tap); toast(onHome ? 'Taken off your Home screen' : `${formatRef(card)} is on your Home screen`); }}>
          {onHome ? <IconCheck size={14} /> : <IconHome size={14} />}{onHome ? 'On Home' : 'Show on Home'}
        </button>
      )}
      <div className="saved-actions">
        <button onClick={() => setWriting((w) => !w)} aria-expanded={writing}><IconNote size={18} />{count ? `Notes (${count})` : 'Note'}</button>
        <button onClick={() => onShare(card, scene)}><IconShare size={18} />Share</button>
        <button aria-pressed={memorising} onClick={() => { const now = toggleMemorise(card.key); buzz(HAPTIC.save); toast(now ? 'Added to Memorise' : 'Removed from Memorise'); }}>
          {memorising ? <IconCheck size={18} /> : <IconMemory size={18} />}{memorising ? 'Memorising' : 'Memorise'}
        </button>
        <button onClick={() => { const now = toggleSaved(card.key); toast(now ? 'Saved' : 'Removed from saved'); }} aria-pressed={saved}>
          <IconBookmark size={18} filled={saved} />{saved ? 'Saved' : 'Save'}
        </button>
      </div>
      <NotesList verse={card} compact />
      {writing && <NoteComposer verse={card} autoFocus onAdded={() => setWriting(false)} />}
    </li>
  );
}

export function Saved() {
  const saved = useStore((s) => s.saved);
  const notes = useStore((s) => s.notes);
  const [tab, setTab] = useState<'saved' | 'notes'>('saved');
  const [topic, setTopic] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<{ verse: VerseLike; scene: Scene } | null>(null);

  const keys: VerseKey[] = useMemo(() => {
    if (tab === 'saved') return Object.keys(saved).sort((a, b) => saved[b] - saved[a]);
    return Object.keys(notes).sort((a, b) => (notes[b][0]?.at ?? 0) - (notes[a][0]?.at ?? 0));
  }, [tab, saved, notes]);

  const needsBible = keys.some((k) => !cardByKey(k));
  const bible = useBible();
  const cards: Card[] = keys.map((k) => {
    const c = cardByKey(k);
    if (c) return c;
    const r = refOf(k);
    const text = getVerse(r);
    return text ? { ...r, key: k, text, topics: [] } : undefined;
  }).filter((c): c is Card => !!c);

  const topicsPresent = useMemo(() => {
    const m = new Map<string, number>();
    cards.forEach((c) => c.topics.forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards.length, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = topic ? cards.filter((c) => c.topics.includes(topic)) : cards;
  const savedCount = Object.keys(saved).length;
  const noteCount = Object.keys(notes).length;

  return (
    <div className="screen saved">
      <div className="scroll">
        <header className="page-head">
          <h1>Saved</h1>
          <p className="sub">Your verses and notes, kept on this device.</p>
        </header>
        <Segmented
          label="Show"
          value={tab}
          onChange={(v) => { setTab(v); setTopic(null); }}
          options={[{ value: 'saved', label: `Saved (${savedCount})` }, { value: 'notes', label: `With notes (${noteCount})` }]}
        />

        {cards.length === 0 ? (
          <div className="empty">
            {needsBible && !bible.ready && !bible.error ? <p>Opening the Bible…</p> : tab === 'saved' ? (
              <>
                <h2>Nothing saved yet</h2>
                <p>Double-tap a verse in the feed, or tap a verse in the Bible and choose Save.</p>
                <button className="btn" onClick={() => navigate('/feed')}>Browse verses</button>
              </>
            ) : (
              <>
                <h2>No notes yet</h2>
                <p>Tap Note on any verse to write down what it means to you.</p>
                <button className="btn" onClick={() => navigate('/feed')}>Browse verses</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="saved-tools">
              {tab === 'saved' && (
                <button className="btn small" onClick={() => navigate('/feed/saved')}><IconPlay size={14} /> Scroll through saved</button>
              )}
              {topicsPresent.length > 1 && (
                <div className="chips small" role="group" aria-label="Filter by topic">
                  <button className={'chip' + (topic === null ? ' on' : '')} aria-pressed={topic === null} onClick={() => setTopic(null)}>All</button>
                  {topicsPresent.map(([t, n]) => (
                    <button key={t} className={'chip' + (topic === t ? ' on' : '')} aria-pressed={topic === t} onClick={() => setTopic(topic === t ? null : t)}>
                      {topicLabel(t)} <b>{n}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ul className="saved-list">
              {shown.map((c) => <Item key={c.key} card={c} onShare={(verse, scene) => setShareFor({ verse, scene })} />)}
            </ul>
          </>
        )}
        <div className="home-pad" />
      </div>
      <TabBar />
      <ShareSheet verse={shareFor?.verse ?? null} scene={shareFor?.scene ?? null} onClose={() => setShareFor(null)} />
    </div>
  );
}
