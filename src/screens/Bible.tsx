import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getChapter, searchBible, segments, startsParagraph, plain, useBible, type SearchScope,
} from '../lib/bible';
import {
  BOOKS, bookBySlug, chapterPath, formatChapter, formatRef, keyOf, lastVerse, parseReference, parseVerses, refOf, spanOf, verseSpan, type Ref,
} from '../lib/books';
import { textOf } from '../lib/passage';
import { back, navigate, type Route } from '../lib/router';
import { pickScene } from '../lib/scenes';
import { speak, speechSupported, useSpeaking, useSpeakingIndex } from '../lib/speech';
import { toggleMemorise, toggleSaved, update, useStore } from '../lib/store';
import {
  IconBack, IconBookmark, IconClose, IconForward, IconMemory, IconMore, IconNote, IconSearch, IconShare, IconSpeaker, IconStop,
} from '../components/Icons';
import { smallCaps } from '../components/Scripture';
import { NotesSheet, QuickActions, ShareSheet, type VerseLike } from '../components/VerseSheets';
import { buzz, HAPTIC, Segmented, TabBar, toast } from '../components/ui';

function Loading({ error }: { error: string | null }) {
  return (
    <div className="empty">
      {error ? (
        <>
          <h2>The Bible could not be loaded</h2>
          <p>Check your connection and try again. After the first visit it works offline.</p>
          <button className="btn" onClick={() => window.location.reload()}>Try again</button>
        </>
      ) : <p>Opening the Bible…</p>}
    </div>
  );
}

// ---------- book and chapter picker ----------
function Library({ openBook }: { openBook?: number }) {
  const lastRead = useStore((s) => s.lastRead);
  const [testament, setTestament] = useState<'OT' | 'NT'>(openBook ? BOOKS[openBook - 1].testament : lastRead && lastRead.b > 39 ? 'NT' : 'OT');
  const [open, setOpen] = useState<number | null>(openBook ?? null);
  const openRef = useRef<HTMLDivElement>(null);
  useEffect(() => { openRef.current?.scrollIntoView({ block: 'nearest' }); }, [open]);
  return (
    <>
      {lastRead && (
        <button className="continue" onClick={() => navigate(chapterPath(lastRead.b, lastRead.c))}>
          <span><small>Continue reading</small>{formatChapter(lastRead.b, lastRead.c)}</span>
          <IconForward size={18} />
        </button>
      )}
      <Segmented
        label="Testament"
        value={testament}
        onChange={(v) => { setTestament(v); setOpen(null); }}
        options={[{ value: 'OT', label: 'Old Testament' }, { value: 'NT', label: 'New Testament' }]}
      />
      <div className="books">
        {BOOKS.filter((b) => b.testament === testament).map((b) => (
          <div key={b.n} className={'book' + (open === b.n ? ' open' : '')} ref={open === b.n ? openRef : undefined}>
            <button className="book-row" aria-expanded={open === b.n}
              onClick={() => (b.chapters === 1 ? navigate(chapterPath(b.n, 1)) : setOpen(open === b.n ? null : b.n))}>
              <span>{b.name}</span><small>{b.chapters} {b.chapters === 1 ? 'chapter' : 'chapters'}</small>
            </button>
            {open === b.n && (
              <div className="chapters" role="group" aria-label={`${b.name} chapters`}>
                {Array.from({ length: b.chapters }, (_, i) => (
                  <button key={i} onClick={() => navigate(chapterPath(b.n, i + 1))}>{i + 1}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- search ----------
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const esc = terms.slice().sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<![A-Za-z0-9])(${esc.join('|')})(?![A-Za-z0-9])`, 'gi');
  const parts = text.split(re);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

function SearchResults({ query }: { query: string }) {
  const [scope, setScope] = useState<SearchScope>('all');
  const [limit, setLimit] = useState(60);
  useEffect(() => { setLimit(60); }, [query, scope]);
  const ref = useMemo(() => parseReference(query), [query]);
  const result = useMemo(() => searchBible(query, scope, limit), [query, scope, limit]);

  const refVerses: (Ref & { text: string })[] = [];
  if (ref?.c && ref.v) {
    const ch = getChapter(ref.b, ref.c) || [];
    for (let v = ref.v; v <= Math.min(ref.vEnd ?? ref.v, ch.length); v++) {
      if (ch[v - 1]) refVerses.push({ b: ref.b, c: ref.c, v, text: plain(ch[v - 1]) });
    }
  }
  const book = ref ? BOOKS[ref.b - 1] : null;
  const topBooks = Object.entries(result.perBook).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="results">
      {ref && book && (
        <div className="goto">
          {!ref.c ? (
            <button className="goto-row" onClick={() => navigate(`/bible/${book.slug}`)}>
              <span><small>Book</small>{book.name}</span><IconForward size={18} />
            </button>
          ) : (
            <button className="goto-row" onClick={() => navigate(chapterPath(ref.b, ref.c!, ref.v, ref.vEnd))}>
              <span><small>Go to</small>{ref.v ? `${formatRef({ b: ref.b, c: ref.c, v: ref.v })}${ref.vEnd ? '–' + ref.vEnd : ''}` : formatChapter(ref.b, ref.c)}</span>
              <IconForward size={18} />
            </button>
          )}
          {refVerses.map((v) => (
            <button key={v.v} className="hit" onClick={() => navigate(chapterPath(v.b, v.c, v.v))}>
              <strong>{formatRef(v)}</strong><span>{v.text}</span>
            </button>
          ))}
        </div>
      )}

      {result.terms.length > 0 && (
        <>
          <div className="chips" role="group" aria-label="Limit the search">
            {([['all', 'Whole Bible'], ['OT', 'Old Testament'], ['NT', 'New Testament']] as [SearchScope, string][]).map(([v, l]) => (
              <button key={String(v)} className={'chip' + (scope === v ? ' on' : '')} aria-pressed={scope === v} onClick={() => setScope(v)}>{l}</button>
            ))}
            {typeof scope === 'number' && <button className="chip on" onClick={() => setScope('all')}>{BOOKS[scope - 1].name} <IconClose size={12} /></button>}
          </div>
          <p className="count" aria-live="polite">
            {result.total === 0 ? 'No verses contain ' : `${result.total.toLocaleString()} ${result.total === 1 ? 'verse' : 'verses'} with `}
            {result.terms.map((t, i) => <span key={t}>{i > 0 && ' and '}<q>{t}</q></span>)}
          </p>
          {scope === 'all' && topBooks.length > 1 && (
            <div className="chips small" role="group" aria-label="Books with the most matches">
              {topBooks.map(([b, n]) => (
                <button key={b} className="chip" onClick={() => setScope(Number(b))}>{BOOKS[Number(b) - 1].name} <b>{n}</b></button>
              ))}
            </div>
          )}
          {result.hits.map((h) => (
            <button key={keyOf(h)} className="hit" onClick={() => navigate(chapterPath(h.b, h.c, h.v))}>
              <strong>{formatRef(h)}</strong>
              <span><Highlight text={h.text} terms={result.terms} /></span>
            </button>
          ))}
          {result.total > result.hits.length && (
            <button className="btn ghost wide" onClick={() => setLimit((l) => l + 120)}>Show more ({(result.total - result.hits.length).toLocaleString()} left)</button>
          )}
          {result.total === 0 && !ref && (
            <p className="hint">Search matches whole words, as the King James Version spells them: try <q>thee</q>, <q>loveth</q> or <q>saith</q>. Put a phrase in quotes to match it exactly.</p>
          )}
        </>
      )}
      {!ref && result.terms.length === 0 && (
        <p className="hint">Type a reference (John 3:16, Ps 23, 1 Cor 13:4-7) or any words (shepherd, "be still").</p>
      )}
    </div>
  );
}

// ---------- chapter reader ----------
/**
 * What tapping verse `n` does to the selection: tap one verse to select it, tap another in the chapter to select
 * everything between, tap an end of a passage to shorten it, tap inside it to start again from that verse.
 */
function tapRange(r: { a: number; z: number } | null, n: number): { a: number; z: number } | null {
  if (!r) return { a: n, z: n };
  if (n < r.a) return { a: n, z: r.z };
  if (n > r.z) return { a: r.a, z: n };
  if (r.a === r.z) return null;
  if (n === r.a) return { a: n + 1, z: r.z };
  if (n === r.z) return { a: r.a, z: n - 1 };
  return { a: n, z: n };
}

function Reader({ b, c, v, to }: { b: number; c: number; v?: number; to?: number }) {
  const verses = getChapter(b, c);
  const book = BOOKS[b - 1];
  const saved = useStore((s) => s.saved);
  const notes = useStore((s) => s.notes);
  const memory = useStore((s) => s.memory);
  const [range, setRange] = useState<{ a: number; z: number } | null>(v ? { a: v, z: to ?? v } : null);
  const tap = (n: number) => setRange((r) => tapRange(r, n));
  const [noteFor, setNoteFor] = useState<VerseLike | null>(null);
  const [shareFor, setShareFor] = useState<VerseLike | null>(null);
  const [moreFor, setMoreFor] = useState<VerseLike | null>(null);
  const bar = useRef<HTMLElement>(null);
  const speakId = `chapter:${b}.${c}`;
  const speaking = useSpeaking() === speakId;
  const speakingIndex = useSpeakingIndex();
  const scroller = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { update(() => ({ lastRead: { b, c } })); }, [b, c]);
  useEffect(() => {
    setRange(v ? { a: v, z: to ?? v } : null);
    const el = scroller.current;
    if (!el) return;
    if (v) {
      requestAnimationFrame(() => el.querySelector(`[data-v="${v}"]`)?.scrollIntoView({ block: to ? 'start' : 'center' }));
    } else el.scrollTop = 0;
  }, [b, c, v, to]);
  useEffect(() => {
    if (speaking && speakingIndex >= 0) {
      scroller.current?.querySelector(`[data-v="${speakingIndex + 1}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [speaking, speakingIndex]);

  if (!verses) return <div className="empty"><h2>That chapter does not exist</h2><button className="btn" onClick={() => navigate('/bible')}>All books</button></div>;

  const prev = c > 1 ? chapterPath(b, c - 1) : b > 1 ? chapterPath(b - 1, BOOKS[b - 2].chapters) : null;
  const next = c < book.chapters ? chapterPath(b, c + 1) : b < 66 ? chapterPath(b + 1, 1) : null;
  // the selection, one verse or a passage, with its words read from the Bible
  const span = range && verses[range.a - 1] && verses[range.z - 1] ? spanOf(b, c, range.a, range.z) : null;
  const sel: VerseLike | null = span ? { ...span, text: textOf(span) ?? '' } : null;
  const selKey = sel ? keyOf(sel) : '';
  const inRange = (n: number) => !!range && n >= range.a && n <= range.z;

  // verses in this chapter that are saved, alone or as part of a saved passage; and where notes end
  const savedHere = new Set<number>();
  for (const k of Object.keys(saved)) {
    const r = refOf(k);
    if (r.b === b && r.c === c) for (let n = r.v; n <= lastVerse(r); n++) savedHere.add(n);
  }
  const notedHere = new Set<number>();
  for (const k of Object.keys(notes)) {
    const r = refOf(k);
    if (r.b === b && r.c === c && notes[k]?.length) notedHere.add(lastVerse(r));
  }

  // group verses into paragraphs using the KJV's own paragraph marks
  const paragraphs: number[][] = [];
  verses.forEach((raw, i) => {
    if (i === 0 || startsParagraph(raw)) paragraphs.push([]);
    paragraphs[paragraphs.length - 1].push(i);
  });

  return (
    <div className="reader-wrap">
      <header className="bar reading">
        <button className="icon-btn" aria-label="Back" onClick={() => back('/bible')}><IconBack /></button>
        <button className="bar-title" onClick={() => navigate(`/bible/${book.slug}`)} aria-label={`${formatChapter(b, c)}. Choose another chapter`}>
          {formatChapter(b, c)}<small>King James Version</small>
        </button>
        {speechSupported() ? (
          <button className={'icon-btn' + (speaking ? ' on' : '')} aria-label={speaking ? 'Stop reading aloud' : 'Read this chapter aloud'}
            onClick={() => speak(speakId, verses.map(plain))}>
            {speaking ? <IconStop /> : <IconSpeaker />}
          </button>
        ) : <span className="icon-btn" />}
        <span className="read-progress" aria-hidden><i ref={bar} /></span>
      </header>

      <div
        className="scroll reader"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          const max = el.scrollHeight - el.clientHeight;
          if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, el.scrollTop / max) : 0})`;
        }}
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2.2) {
            if (dx < 0 && next) navigate(next);
            if (dx > 0 && prev) navigate(prev);
          }
        }}
        onPointerCancel={() => { swipe.current = null; }}
      >
        <h1 className="chapter-title"><span>{book.name}</span>{book.chapters > 1 && <b>{c}</b>}</h1>
        {paragraphs.map((p, pi) => (
          <p key={pi} className="para">
            {p.map((i) => {
              const n = i + 1;
              const cls = ['verse'];
              if (inRange(n)) cls.push('sel');
              if (savedHere.has(n)) cls.push('saved');
              if (speaking && speakingIndex === i) cls.push('speaking');
              return (
                <span key={i} data-v={n} className={cls.join(' ')} role="button" tabIndex={0}
                  aria-pressed={inRange(n)}
                  onClick={() => tap(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(n); } }}>
                  {i > 0 && <sup>{i + 1}</sup>}
                  {segments(verses[i]).map((s, si) => (s.italic ? <i key={si}>{smallCaps(s.text, `${si}-`)}</i> : <span key={si}>{smallCaps(s.text, `${si}-`)}</span>))}
                  {notedHere.has(n) ? <span className="note-dot" aria-label="You have a note here" /> : null}{' '}
                </span>
              );
            })}
          </p>
        ))}
        <nav className="chapter-nav" aria-label="Chapters">
          {prev ? <button className="btn ghost" onClick={() => navigate(prev)}><IconBack size={16} /> Previous</button> : <span />}
          {next ? <button className="btn ghost" onClick={() => navigate(next)}>Next <IconForward size={16} /></button> : <span />}
        </nav>
        <p className="hint centre">Words in italics were added by the translators, as in a printed King James Bible.</p>
        <div className="reader-pad" />
      </div>

      {sel && (
        <div className="verse-bar" role="toolbar" aria-label={`Actions for ${formatRef(sel)}`}>
          <div className="verse-bar-title">
            <span><strong>{formatRef(sel)}</strong>
              <small aria-live="polite">{verseSpan(sel) > 1 ? `${verseSpan(sel)} verses` : 'Tap another verse to select a passage'}</small>
            </span>
            <button className="icon-btn tiny" aria-label="Close" onClick={() => setRange(null)}><IconClose size={18} /></button>
          </div>
          <div className="verse-bar-row">
            <button onClick={() => { const now = toggleSaved(selKey); toast(now ? 'Saved' : 'Removed from saved'); }}>
              <IconBookmark filled={saved[selKey] !== undefined} /><span>{saved[selKey] !== undefined ? 'Saved' : 'Save'}</span>
            </button>
            <button onClick={() => setNoteFor(sel)}><IconNote /><span>Note</span></button>
            <button onClick={() => setShareFor(sel)}><IconShare /><span>Share</span></button>
            <button onClick={() => { const now = toggleMemorise(selKey); buzz(HAPTIC.save); toast(now ? 'Added to Memorise' : 'Removed from Memorise'); }}>
              <IconMemory /><span>{memory[selKey] ? 'Memorising' : 'Memorise'}</span>
            </button>
            <button onClick={() => setMoreFor(sel)}><IconMore /><span>More</span></button>
          </div>
        </div>
      )}
      <QuickActions verse={moreFor} onClose={() => setMoreFor(null)} onNote={() => moreFor && setNoteFor(moreFor)} onShare={() => moreFor && setShareFor(moreFor)} asCard />
      <NotesSheet verse={noteFor} onClose={() => setNoteFor(null)} />
      <ShareSheet verse={shareFor} scene={shareFor ? pickScene(keyOf(shareFor), ['earth', 'dawn', 'sky', 'dusk']) : null} onClose={() => setShareFor(null)} />
    </div>
  );
}

// ---------- screen ----------
export function Bible({ route }: { route: Route }) {
  const { ready, error } = useBible();
  const [, slug, cStr, vStr] = route.parts;
  const book = slug ? bookBySlug(slug) : undefined;
  const c = cStr ? Number(cStr) : undefined;
  const picked = parseVerses(vStr);
  const v = picked?.v, to = picked?.to;
  const q = route.query.get('q') ?? '';
  const [query, setQuery] = useState(q);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setQuery(q); }, [q]);

  // keep the address in step with the search box so Back returns to the results
  useEffect(() => {
    if (book && c) return;
    const t = window.setTimeout(() => {
      const target = query.trim() ? `/bible?q=${encodeURIComponent(query.trim())}` : book ? `/bible/${book.slug}` : '/bible';
      if (target !== route.path + (q ? `?q=${encodeURIComponent(q)}` : '')) navigate(target, { replace: true });
    }, 350);
    return () => window.clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  if (book && c) {
    return (
      <div className="screen bible">
        {ready ? <Reader b={book.n} c={c} v={v} to={to} /> : <Loading error={error} />}
        <TabBar />
      </div>
    );
  }

  const searching = query.trim().length > 0;
  return (
    <div className="screen bible">
      <div className="scroll">
        <header className="page-head">
          <h1>Bible</h1>
          <p className="sub">King James Version</p>
        </header>
        <div className="search" role="search">
          <IconSearch size={19} />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="John 3:16, shepherd, &quot;be still&quot;"
            aria-label="Search the Bible by reference or words"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          {query && <button className="icon-btn tiny" aria-label="Clear search" onClick={() => { setQuery(''); input.current?.focus(); }}><IconClose size={18} /></button>}
        </div>
        {!ready ? <Loading error={error} /> : searching ? <SearchResults query={query.trim()} /> : <Library openBook={book?.n} />}
        <div className="home-pad" />
      </div>
      <TabBar />
    </div>
  );
}
