import { useEffect, useRef, useState } from 'react';
import { chapterPath, formatRef, keyOf, versePath, type Ref } from '../lib/books';
import { navigate } from '../lib/router';
import {
  canNativeShare, canvasToBlob, copyText, downloadBlob, imageFileName, nativeShare, renderShareImage,
  shareImage, shareText, telegramUrl, whatsappUrl, type ImageFormat,
} from '../lib/share';
import type { Scene } from '../lib/scenes';
import { speak, speechSupported, useSpeaking } from '../lib/speech';
import { addNote, deleteNote, editNote, toggleMemorise, toggleSaved, useStore } from '../lib/store';
import {
  IconBook, IconBookmark, IconCheck, IconCopy, IconDownload, IconEdit, IconImage, IconMemory, IconNote, IconPalette,
  IconShare, IconSpeaker, IconStop, IconTrash, IconVerses, IconWhatsApp,
} from './Icons';
import { Scripture } from './Scripture';
import { buzz, HAPTIC, Segmented, Sheet, timeAgo, toast } from './ui';

export interface VerseLike extends Ref { text: string }

// ---------- notes ----------
export function NotesList({ verse, compact }: { verse: Ref; compact?: boolean }) {
  const key = keyOf(verse);
  const notes = useStore((s) => s.notes[key]) || [];
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  if (!notes.length) return null;
  return (
    <ul className={'notes' + (compact ? ' notes-compact' : '')}>
      {notes.map((n) => (
        <li key={n.id} className="note">
          {editing === n.id ? (
            <div className="note-edit">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus aria-label="Edit note" />
              <div className="row gap">
                <button className="btn small" onClick={() => { editNote(key, n.id, draft); setEditing(null); }}>Save</button>
                <button className="btn small ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p>{n.text}</p>
              <div className="note-meta">
                <span>{timeAgo(n.at)}{n.edited ? ' · edited' : ''}</span>
                <span className="row">
                  <button className="icon-btn tiny" aria-label="Edit note" onClick={() => { setEditing(n.id); setDraft(n.text); }}><IconEdit size={16} /></button>
                  <button className="icon-btn tiny" aria-label="Delete note" onClick={() => { if (window.confirm('Delete this note?')) deleteNote(key, n.id); }}><IconTrash size={16} /></button>
                </span>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NoteComposer({ verse, autoFocus, onAdded }: { verse: Ref; autoFocus?: boolean; onAdded?: () => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const submit = () => {
    if (!text.trim()) return;
    addNote(keyOf(verse), text);
    setText('');
    toast('Note saved');
    onAdded?.();
  };
  return (
    <div className="composer">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What is this verse saying to you?"
        rows={2}
        aria-label="Write a note"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
      />
      <button className="btn" onClick={submit} disabled={!text.trim()}>Save note</button>
    </div>
  );
}

export function NotesSheet({ verse, onClose }: { verse: VerseLike | null; onClose: () => void }) {
  return (
    <Sheet open={!!verse} onClose={onClose} title="Your notes" tall>
      {verse && (
        <>
          <blockquote className="sheet-quote">
            <Scripture text={verse.text} />
            <cite>{formatRef(verse)}</cite>
          </blockquote>
          <NoteComposer verse={verse} />
          <NotesList verse={verse} />
          <p className="hint">Only you can see your notes. They stay on this device.</p>
        </>
      )}
    </Sheet>
  );
}

// ---------- share ----------
export function ShareSheet({ verse, scene, onClose }: { verse: VerseLike | null; scene: Scene | null; onClose: () => void }) {
  const [format, setFormat] = useState<ImageFormat>('story');
  const [busy, setBusy] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!verse || !scene) return;
    let cancelled = false;
    canvasRef.current = null;
    renderShareImage(verse, scene, format).then((c) => {
      if (cancelled) return;
      canvasRef.current = c;
      c.className = 'share-canvas';
      const h = holder.current;
      if (h) { h.innerHTML = ''; h.appendChild(c); }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [verse, scene, format]);

  if (!verse || !scene) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const withImage = async (fn: (b: Blob) => Promise<void> | void) => {
    if (busy) return;
    setBusy(true);
    try {
      const c = canvasRef.current ?? (await renderShareImage(verse, scene, format));
      await fn(await canvasToBlob(c));
    } catch {
      toast('Could not create the image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Share this verse" tall>
      <div className="share-preview-wrap">
        <div className={'share-preview ' + format} ref={holder} aria-label="Preview of the picture that will be shared" />
      </div>
      <Segmented
        label="Picture shape"
        value={format}
        onChange={setFormat}
        options={[{ value: 'story', label: 'Story (tall)' }, { value: 'square', label: 'Square' }]}
      />
      <div className="share-grid">
        <a className="share-btn wa" href={whatsappUrl(verse)} target="_blank" rel="noopener noreferrer">
          <IconWhatsApp size={24} /><span>WhatsApp</span>
        </a>
        <button className="share-btn" disabled={busy} onClick={() => withImage(async (b) => {
          const r = await shareImage(verse, b);
          if (r === 'downloaded') toast('Picture saved to your downloads');
        })}>
          <IconImage /><span>Share picture</span>
        </button>
        <button className="share-btn" disabled={busy} onClick={() => withImage((b) => { downloadBlob(b, imageFileName(verse)); toast('Picture saved'); })}>
          <IconDownload /><span>Save picture</span>
        </button>
        <button className="share-btn" onClick={async () => { toast((await copyText(shareText(verse))) ? 'Verse copied' : 'Could not copy'); }}>
          <IconCopy /><span>Copy text</span>
        </button>
        {canNativeShare() && (
          <button className="share-btn" onClick={() => nativeShare(verse)}>
            <IconShare /><span>More apps</span>
          </button>
        )}
        <a className="share-btn" href={telegramUrl(verse)} target="_blank" rel="noopener noreferrer">
          <IconShare /><span>Telegram</span>
        </a>
      </div>
      <p className="hint">The link opens Chestnut on this verse. To send the picture on WhatsApp, tap Share picture and pick WhatsApp.</p>
    </Sheet>
  );
}

// ---------- long-press quick actions ----------
export function QuickActions({ verse, onClose, onNote, onShare, onChangeBackground, asCard }: {
  verse: VerseLike | null;
  onClose: () => void;
  onNote: () => void;
  onShare: () => void;
  onChangeBackground?: () => void;
  /** offer to open the verse as a full-screen card (from the Bible) */
  asCard?: boolean;
}) {
  const key = verse ? keyOf(verse) : '';
  const saved = useStore((s) => (key ? s.saved[key] !== undefined : false));
  const memorising = useStore((s) => (key ? s.memory[key] !== undefined : false));
  const speaking = useSpeaking();
  if (!verse) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const act = (fn: () => void, close = true) => () => { fn(); if (close) onClose(); };
  return (
    <Sheet open onClose={onClose} title={formatRef(verse)}>
      <div className="actions">
        <button onClick={act(() => { const now = toggleSaved(key); toast(now ? 'Saved' : 'Removed from saved'); })}>
          {saved ? <IconCheck /> : <IconBookmark />}<span>{saved ? 'Saved (tap to remove)' : 'Save verse'}</span>
        </button>
        <button onClick={act(() => { const now = toggleMemorise(key); buzz(HAPTIC.save); toast(now ? 'Added to Memorise' : 'Removed from Memorise'); })}>
          {memorising ? <IconCheck /> : <IconMemory />}<span>{memorising ? 'Memorising (tap to remove)' : 'Memorise this verse'}</span>
        </button>
        <button onClick={act(async () => { toast((await copyText(shareText(verse, false))) ? 'Verse copied' : 'Could not copy'); })}>
          <IconCopy /><span>Copy verse</span>
        </button>
        <button onClick={act(onShare)}><IconShare /><span>Share as text or picture</span></button>
        <a href={whatsappUrl(verse)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
          <IconWhatsApp /><span>Send on WhatsApp</span>
        </a>
        <button onClick={act(onNote)}><IconNote /><span>Add a note</span></button>
        {speechSupported() && (
          <button onClick={act(() => speak(key, [`${verse.text} ${formatRef(verse)}.`]))}>
            {speaking === key ? <IconStop /> : <IconSpeaker />}<span>{speaking === key ? 'Stop reading' : 'Listen'}</span>
          </button>
        )}
        {onChangeBackground && (
          <button onClick={act(onChangeBackground, false)}><IconPalette /><span>Change background</span></button>
        )}
        {asCard ? (
          <button onClick={act(() => navigate(versePath(verse)))}><IconVerses /><span>Show as a card</span></button>
        ) : (
          <button onClick={act(() => navigate(chapterPath(verse.b, verse.c, verse.v)))}><IconBook /><span>Read the full chapter</span></button>
        )}
      </div>
    </Sheet>
  );
}
