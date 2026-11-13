import { useEffect, useState, useSyncExternalStore } from 'react';
import { askBrowser, neverAsk, putAside, shouldOffer, useInstall } from '../lib/install';
import { useStore } from '../lib/store';
import { IconAddBox, IconCheck, IconForward, IconIosShare, IconMore, Logo } from './Icons';
import { Sheet, toast } from './ui';

// The add-to-home-screen prompt. Shown on phones, in the browser, once the
// person has read a few verses; at most three times, a week apart.

let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => { open = v; listeners.forEach((l) => l()); };
export const openInstall = () => set(true);

/** The three taps, drawn rather than described. */
export function InstallSteps() {
  const { ios, canAsk, standalone } = useInstall();
  if (standalone) return <p className="install-done"><IconCheck size={18} /> Chestnut is on this home screen.</p>;
  if (canAsk) return null;
  return (
    <ol className="install-steps">
      {ios ? (
        <>
          <li><span className="step-art"><IconIosShare size={26} /></span><span>Tap <b>Share</b></span></li>
          <li><span className="step-art"><IconAddBox size={26} /></span><span><b>Add to Home Screen</b></span></li>
          <li><span className="step-art"><Logo size={28} /></span><span>Tap <b>Add</b></span></li>
        </>
      ) : (
        <>
          <li><span className="step-art"><IconMore size={26} /></span><span>Open the <b>menu</b></span></li>
          <li><span className="step-art"><IconAddBox size={26} /></span><span><b>Add to Home screen</b></span></li>
          <li><span className="step-art"><Logo size={28} /></span><span>Tap <b>Add</b></span></li>
        </>
      )}
    </ol>
  );
}

export function InstallHost() {
  const isOpen = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => open);
  const { ios, canAsk, standalone } = useInstall();
  const reads = useStore((s) => s.reads);
  const onboarded = useStore((s) => s.onboarded);
  const [offered, setOffered] = useState(false);

  // offer it once someone has read a little, and never in the middle of the welcome
  useEffect(() => {
    if (offered || !onboarded || reads < 3 || !shouldOffer()) return;
    const t = window.setTimeout(() => { setOffered(true); set(true); }, 1600);
    return () => window.clearTimeout(t);
  }, [reads, onboarded, offered]);

  const close = (aside = true) => { if (aside && !standalone) putAside(); set(false); };

  return (
    <Sheet open={isOpen} onClose={() => close()} title="Keep Chestnut close">
      <div className="install">
        <div className="install-hero" aria-hidden>
          <span className="phone"><span className="phone-icon"><Logo size={30} /></span><i /><i /><i /><i /><i /></span>
        </div>
        <p className="install-lead">Add it to your home screen. It opens like an app and works without internet.</p>
        {canAsk ? (
          <button className="btn wide big" onClick={async () => { const ok = await askBrowser(); if (ok) toast('Added to your home screen'); close(!ok); }}>
            Add to Home Screen <IconForward size={18} />
          </button>
        ) : <InstallSteps />}
        {ios && !standalone && (
          <p className="hint">On iPhone the home-screen app keeps its own saved verses. Add it early, or carry yours over with Settings, Backup.</p>
        )}
        {!standalone && (
          <div className="row gap center">
            <button className="link" onClick={() => close()}>Not now</button>
            <button className="link" onClick={() => { neverAsk(); set(false); }}>Don't ask again</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
