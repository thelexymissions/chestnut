import { measureScreen } from '../lib/screen';
import { useEffect, useRef, useState } from 'react';
import verification from '../../data/kjv-verification.json';
import photos from '../data/photos.json';
import { CARDS } from '../lib/feed';
import { askBrowser, useInstall } from '../lib/install';
import { back, navigate } from '../lib/router';
import { APP_NAME, downloadBlob } from '../lib/share';
import { speak, speechSupported, stopSpeaking, voices } from '../lib/speech';
import { exportBackup, importBackup, localDay, resetAll, update, useStore } from '../lib/store';
import { IconBack } from '../components/Icons';
import { InstallSteps } from '../components/InstallPrompt';
import { openSound } from '../components/Sound';
import { Segmented, toast } from '../components/ui';

/** The sizes this phone reports, shown small at the foot of the page: useful when a layout looks wrong on one device. */
function screenFacts(): string {
  const m = measureScreen();
  const app = document.querySelector('.app')?.getBoundingClientRect();
  const r = Math.round;
  return `Screen ${screen.width}\u00d7${screen.height} · window ${r(m.inner)} · dvh ${r(m.dvh)} · lvh ${r(m.lvh)} · app ${app ? r(app.height) : '?'} · app ends ${app ? r(app.bottom) : '?'} · safe ${r(m.safeTop)}/${r(m.safeBottom)} · ${m.standalone ? 'home-screen app' : 'browser'}`;
}

function ScreenFacts() {
  const [facts, setFacts] = useState('');
  // measured once the page is on screen, so the app's own size is included
  useEffect(() => { const t = window.setTimeout(() => setFacts(screenFacts()), 600); return () => window.clearTimeout(t); }, []);
  return <p className="hint" data-screen-facts>{facts}</p>;
}

export function Settings() {
  const name = useStore((s) => s.name);
  const textSize = useStore((s) => s.textSize);
  const theme = useStore((s) => s.theme);
  const rate = useStore((s) => s.rate);
  const voice = useStore((s) => s.voice);
  const haptics = useStore((s) => s.haptics);
  const reflect = useStore((s) => s.reflect);
  const install = useInstall();
  const memCount = useStore((s) => Object.keys(s.memory).length);
  const savedCount = useStore((s) => Object.keys(s.saved).length);
  const noteCount = useStore((s) => Object.values(s.notes).reduce((a, n) => a + n.length, 0));
  const file = useRef<HTMLInputElement>(null);
  const [voiceList, setVoiceList] = useState(voices());
  useEffect(() => {
    const t = window.setInterval(() => setVoiceList(voices()), 800);
    return () => { window.clearInterval(t); stopSpeaking(); };
  }, []);

  const credits = [...new Set((photos as { author?: string }[]).map((p) => p.author).filter(Boolean))];

  return (
    <div className="screen settings">
      <header className="bar">
        <button className="icon-btn" aria-label="Back" onClick={() => back('/')}><IconBack /></button>
        <span className="bar-title plain">Settings</span>
        <span className="icon-btn" />
      </header>
      <div className="scroll">
        <section className="group">
          <h2>You</h2>
          <label htmlFor="set-name">Your name</label>
          <input id="set-name" value={name} maxLength={40} placeholder="Your first name" onChange={(e) => update(() => ({ name: e.target.value.slice(0, 40) }))} />
        </section>

        <section className="group">
          <h2>Reading</h2>
          <span className="label">Text size</span>
          <Segmented label="Text size" value={String(textSize) as '0' | '1' | '2'} onChange={(v) => update(() => ({ textSize: Number(v) as 0 | 1 | 2 }))}
            options={[{ value: '0', label: 'Smaller' }, { value: '1', label: 'Standard' }, { value: '2', label: 'Larger' }]} />
          <span className="label">Appearance</span>
          <Segmented label="Appearance" value={theme} onChange={(v) => update(() => ({ theme: v }))}
            options={[{ value: 'auto', label: 'Match phone' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          <span className="label">A question to reflect on, every five verses</span>
          <Segmented label="Reflection questions" value={reflect ? 'on' : 'off'} onChange={(v) => update(() => ({ reflect: v === 'on' }))}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
          <span className="label">Vibration on taps</span>
          <Segmented label="Vibration" value={haptics ? 'on' : 'off'} onChange={(v) => update(() => ({ haptics: v === 'on' }))}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
          <p className="hint">Works on phones that let web apps vibrate. iPhones do not.</p>
          <div className="row gap wrap">
            <button className="btn ghost" onClick={openSound}>Background sound</button>
            <button className="btn ghost" onClick={() => { update(() => ({ hintsSeen: false })); toast('Tips will show next time you open the feed'); }}>Show the gesture tips</button>
            <button className="btn ghost" onClick={() => navigate('/welcome')}>Replay the welcome</button>
          </div>
        </section>

        {speechSupported() && (
          <section className="group">
            <h2>Listening</h2>
            <label htmlFor="voice">Voice</label>
            <select id="voice" value={voice} onChange={(e) => update(() => ({ voice: e.target.value }))}>
              <option value="">Automatic</option>
              {voiceList.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
            <label htmlFor="rate">Speed: {rate.toFixed(2).replace(/0$/, '')}x</label>
            <input id="rate" type="range" min={0.6} max={1.3} step={0.05} value={rate} onChange={(e) => update(() => ({ rate: Number(e.target.value) }))} />
            <button className="btn ghost" onClick={() => speak('settings-sample', ['The Lord is my shepherd; I shall not want.'])}>Play a sample</button>
            <p className="hint">Voices come from your phone, so they differ between devices.</p>
          </section>
        )}

        <section className="group">
          <h2>Add to your home screen</h2>
          {install.canAsk && <button className="btn" onClick={async () => { if (await askBrowser()) toast('Added to your home screen'); }}>Add to Home Screen</button>}
          <InstallSteps />
          <p className="hint">Once opened, {APP_NAME} works without internet, including the whole Bible.</p>
        </section>

        <section className="group">
          <h2>Backup</h2>
          <p className="hint">You have {savedCount} saved {savedCount === 1 ? 'verse' : 'verses'}, {noteCount} {noteCount === 1 ? 'note' : 'notes'} and {memCount} {memCount === 1 ? 'verse' : 'verses'} in Memorise. They live only on this device, so save a backup before changing phones or clearing your browser.</p>
          <div className="row gap wrap">
            <button className="btn" onClick={() => { downloadBlob(new Blob([exportBackup()], { type: 'application/json' }), `chestnut-backup-${localDay()}.json`); toast('Backup saved to your downloads'); }}>Save a backup</button>
            <button className="btn ghost" onClick={() => file.current?.click()}>Restore from backup</button>
          </div>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const r = importBackup(await f.text());
              toast(`Restored. ${r.saved} saved verses, ${r.notes} notes added`);
            } catch (err) {
              toast((err as Error).message || 'That file could not be read');
            }
          }} />
        </section>

        <section className="group">
          <h2>About the text</h2>
          <p>The Bible text is the King James Version (1769 standard text), which is in the public domain in most of the world.</p>
          <p>Every one of the {verification.checked.split(' ')[0]} verses was compared word for word against two other independent copies before being included: {verification.confirmedWordForWordByBothOtherCopies.toLocaleString()} matched both, {verification.confirmedWordForWordByOneOtherCopy.toLocaleString()} matched one, and {verification.spellingVariantOnly.length} differ only in an old spelling such as <q>sope</q> for <q>soap</q>.</p>
          <p>The {CARDS.length} verses in the feed are grouped by topic by hand. The grouping is a reading aid, not part of scripture.</p>
          <p>Trivia cards about the Bible's text are recomputed from this text when the app is built; cards about its history name their sources.</p>
          <p>Memorise exercises are marked by exact match with this text. The wrong choices offered are real Bible words and references picked by fixed rules; nothing is generated.</p>
          {credits.length > 0 && <p className="hint">Photographs from Unsplash by {credits.join(', ')}.</p>}
          <ScreenFacts />
        </section>

        <section className="group">
          <h2>Start over</h2>
          <button className="btn danger" onClick={() => { if (window.confirm('Delete your name, saved verses and notes from this device? This cannot be undone.')) { resetAll(); toast('Everything was cleared'); back('/'); } }}>
            Delete everything on this device
          </button>
        </section>
        <div className="home-pad" />
      </div>
    </div>
  );
}
