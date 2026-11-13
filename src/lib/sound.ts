import { getState, update } from './store';

// Background sound made by the app itself with the Web Audio API: a calm
// instrumental pad, rain, a forest and waves. Nothing is downloaded and no
// recording is played, so it works offline and belongs to no one else.

export type Layer = 'music' | 'rain' | 'forest' | 'waves';
export const LAYERS: Layer[] = ['music', 'rain', 'forest', 'waves'];

interface Built { out: GainNode; schedule: (until: number) => void; stop: (at: number) => void }
type Ctx = BaseAudioContext;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

// ---------- raw material ----------
const noiseCache = new WeakMap<Ctx, Record<string, AudioBuffer>>();
function noise(ctx: Ctx, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const cache = noiseCache.get(ctx) ?? {};
  noiseCache.set(ctx, cache);
  if (cache[kind]) return cache[kind];
  const len = Math.floor(ctx.sampleRate * (kind === 'white' ? 3.1 : kind === 'pink' ? 4.3 : 5.7));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  cache[kind] = buf;
  return buf;
}
function loop(ctx: Ctx, kind: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx, kind);
  s.loop = true;
  s.start(0, Math.random() * 2);
  return s;
}
function filter(ctx: Ctx, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}
function gain(ctx: Ctx, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}
/** A slow sine that nudges a parameter up and down around its set value. */
function sway(ctx: Ctx, target: AudioParam, hz: number, depth: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.frequency.value = hz;
  const g = gain(ctx, depth);
  o.connect(g).connect(target);
  o.start(0);
  return o;
}
/** A soft hall, made from decaying noise, for the pad and the birds. */
function hall(ctx: Ctx, seconds: number): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const c = ctx.createConvolver();
  c.buffer = ir;
  return c;
}

// ---------- the four sounds ----------
function buildRain(ctx: Ctx): Built {
  const out = gain(ctx, 1);
  const hiss = loop(ctx, 'white'), body = loop(ctx, 'pink'), low = loop(ctx, 'brown');
  const hissG = gain(ctx, 0.085), bodyG = gain(ctx, 0.5), lowG = gain(ctx, 0.16);
  hiss.connect(filter(ctx, 'highpass', 1500)).connect(filter(ctx, 'lowpass', 9000)).connect(hissG).connect(out);
  body.connect(filter(ctx, 'bandpass', 520, 0.5)).connect(bodyG).connect(out);
  low.connect(filter(ctx, 'lowpass', 190)).connect(lowG).connect(out);
  const lfos = [sway(ctx, bodyG.gain, 0.07, 0.1), sway(ctx, hissG.gain, 0.045, 0.02)];
  return { out, schedule: () => undefined, stop: (at) => [hiss, body, low, ...lfos].forEach((n) => n.stop(at)) };
}

function buildWaves(ctx: Ctx): Built {
  const out = gain(ctx, 1);
  const nodes: (AudioBufferSourceNode | OscillatorNode)[] = [];
  // two swells of different length, so the sea never quite repeats
  for (const [hz, level] of [[0.083, 0.85], [0.057, 0.5]] as const) {
    const src = loop(ctx, 'pink');
    const lp = filter(ctx, 'lowpass', 750, 0.4);
    const g = gain(ctx, 0.5 * level);
    src.connect(lp).connect(g).connect(out);
    nodes.push(src, sway(ctx, g.gain, hz, 0.42 * level), sway(ctx, lp.frequency, hz, 480));
    const foam = loop(ctx, 'white');
    const fg = gain(ctx, 0.012 * level);
    foam.connect(filter(ctx, 'highpass', 2600)).connect(fg).connect(out);
    nodes.push(foam, sway(ctx, fg.gain, hz, 0.011 * level));
  }
  const deep = loop(ctx, 'brown');
  deep.connect(filter(ctx, 'lowpass', 140)).connect(gain(ctx, 0.14)).connect(out);
  nodes.push(deep);
  return { out, schedule: () => undefined, stop: (at) => nodes.forEach((n) => n.stop(at)) };
}

function buildForest(ctx: Ctx): Built {
  const out = gain(ctx, 1);
  const wind = loop(ctx, 'pink'), leaves = loop(ctx, 'white');
  const windF = filter(ctx, 'bandpass', 480, 0.45), windG = gain(ctx, 0.34), leafG = gain(ctx, 0.01);
  wind.connect(windF).connect(windG).connect(out);
  leaves.connect(filter(ctx, 'highpass', 3200)).connect(leafG).connect(out);
  const lfos = [sway(ctx, windG.gain, 0.09, 0.14), sway(ctx, windF.frequency, 0.05, 170), sway(ctx, leafG.gain, 0.13, 0.007)];
  const room = hall(ctx, 1.6);
  const wet = gain(ctx, 0.35);
  room.connect(wet).connect(out);
  let next = ctx.currentTime + rnd(0.8, 2.5);

  // one bird call: a few short whistled notes from somewhere to the left or right
  const call = (t: number) => {
    const soften = filter(ctx, 'lowpass', 6500);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = rnd(-0.75, 0.75); soften.connect(pan); pan.connect(out); pan.connect(room); }
    else { soften.connect(out); soften.connect(room); }
    const far = rnd(0.35, 1);
    const note = (at: number, from: number, to: number, len: number, level: number) => {
      const o = ctx.createOscillator();
      const g = gain(ctx, 0);
      o.frequency.setValueAtTime(from, at);
      o.frequency.exponentialRampToValueAtTime(to, at + len);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level * far, at + Math.min(0.02, len * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(soften);
      o.start(at); o.stop(at + len + 0.03);
    };
    const kind = Math.random();
    if (kind < 0.45) {            // quick rising chirps
      const f = rnd(2500, 3500); let at = t;
      for (let i = 0, n = Math.floor(rnd(3, 6)); i < n; i++) { note(at, f, f * rnd(1.18, 1.32), 0.07, 0.05); at += rnd(0.11, 0.16); }
    } else if (kind < 0.8) {      // a falling two-note whistle
      const f = rnd(1900, 2400);
      note(t, f, f * 0.97, 0.17, 0.045); note(t + 0.24, f * 0.8, f * 0.76, 0.24, 0.04);
    } else {                      // a fast trill
      const f = rnd(3800, 4600); let at = t;
      for (let i = 0, n = Math.floor(rnd(7, 12)); i < n; i++) { note(at, f, f * 1.06, 0.035, 0.028); at += 0.05; }
    }
  };
  return {
    out,
    schedule: (until) => { while (next < until) { call(next); next += rnd(2.2, 6.5); } },
    stop: (at) => [wind, leaves, ...lfos].forEach((n) => n.stop(at)),
  };
}

// The pad sits on a held D and moves slowly through four chords above it:
// D, G, B minor and A. Soft bell notes fall in now and then.
const DRONE = [73.42, 146.83, 220.0];
const CHORDS = [
  [369.99, 440.0, 587.33],
  [392.0, 493.88, 587.33],
  [369.99, 440.0, 493.88],
  [329.63, 440.0, 554.37],
];
const BELLS = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66];
const CHORD_SECONDS = 13;

function buildMusic(ctx: Ctx): Built {
  const out = gain(ctx, 1);
  const tone = filter(ctx, 'lowpass', 1500, 0.4);
  const dry = gain(ctx, 0.6), wet = gain(ctx, 0.75);
  const room = hall(ctx, 3.4);
  tone.connect(dry).connect(out);
  tone.connect(room); room.connect(wet).connect(out);
  const held: OscillatorNode[] = [sway(ctx, tone.frequency, 0.04, 320)];

  DRONE.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = f;
    const g = gain(ctx, 0);
    g.gain.linearRampToValueAtTime([0.085, 0.05, 0.036][i], ctx.currentTime + 4);
    o.connect(g).connect(tone);
    o.start();
    held.push(o);
  });

  let chordAt = ctx.currentTime + 0.2, chord = 0;
  let bellAt = ctx.currentTime + rnd(5, 8);
  const playChord = (t: number, notes: number[]) => {
    const end = t + CHORD_SECONDS;
    notes.forEach((f, n) => {
      for (const cents of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = n === 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = cents;
        const g = gain(ctx, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + 4.5);
        g.gain.setValueAtTime(0.03, end - 1);
        g.gain.linearRampToValueAtTime(0, end + 5);
        o.connect(g).connect(tone);
        o.start(t); o.stop(end + 5.2);
      }
    });
  };
  const playBell = (t: number) => {
    const f = pick(BELLS);
    const g = gain(ctx, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    for (const [mult, level] of [[1, 1], [2, 0.16], [3, 0.05]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mult;
      o.connect(gain(ctx, level)).connect(g);
      o.start(t); o.stop(t + 3.3);
    }
    g.connect(room);
    g.connect(gain(ctx, 0.5)).connect(out);
  };
  return {
    out,
    schedule: (until) => {
      while (chordAt < until) { playChord(chordAt, CHORDS[chord % CHORDS.length]); chord++; chordAt += CHORD_SECONDS; }
      while (bellAt < until) { playBell(bellAt); bellAt += rnd(3.5, 8.5); }
    },
    stop: (at) => held.forEach((n) => n.stop(at)),
  };
}

const BUILD: Record<Layer, (ctx: Ctx) => Built> = { music: buildMusic, rain: buildRain, forest: buildForest, waves: buildWaves };
/** How loud each sound sits in the mix. */
const LEVEL: Record<Layer, number> = { music: 0.9, rain: 0.55, forest: 0.7, waves: 0.6 };

// ---------- the player ----------
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const playing: Partial<Record<Layer, Built>> = {};
let ticker: number | undefined;
let ducked = false;
let silent: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const onSoundChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const soundSupported = () => typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
export const anyOn = () => LAYERS.some((l) => getState().sound[l]);
const level = () => getState().sound.volume * (ducked ? 0.3 : 1);

function open(): AudioContext | null {
  if (ctx) return ctx;
  if (!soundSupported()) return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = level();
  // a gentle limiter, so turning everything on at once cannot distort
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -14; limit.ratio.value = 6; limit.attack.value = 0.01; limit.release.value = 0.3;
  master.connect(limit).connect(ctx.destination);
  // iPhones mute web audio when the ringer switch is off; ask to be treated as music instead
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    else {
      silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      silent.loop = true;
      silent.play().catch(() => undefined);
    }
  } catch { /* not needed here */ }
  return ctx;
}

function startLayer(l: Layer) {
  const c = open();
  if (!c || !master || playing[l]) return;
  const built = BUILD[l](c);
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(LEVEL[l], c.currentTime + 1.8);
  built.out.connect(g).connect(master);
  // remember the fader so the sound can be eased out later
  (built as Built & { fader: GainNode }).fader = g;
  built.schedule(c.currentTime + 8);
  playing[l] = built;
}

function stopLayer(l: Layer) {
  const built = playing[l] as (Built & { fader?: GainNode }) | undefined;
  if (!built || !ctx) return;
  delete playing[l];
  const t = ctx.currentTime;
  built.fader?.gain.cancelScheduledValues(t);
  built.fader?.gain.setValueAtTime(built.fader.gain.value, t);
  built.fader?.gain.linearRampToValueAtTime(0, t + 1.2);
  built.stop(t + 1.4);
  window.setTimeout(() => { try { built.fader?.disconnect(); } catch { /* gone */ } }, 9000);
}

/** Bring what is playing in line with what is switched on. Call from a tap. */
export function syncSound() {
  const want = getState().sound;
  const on = LAYERS.filter((l) => want[l]);
  if (on.length) {
    const c = open();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => undefined);
    silent?.play().catch(() => undefined);
  }
  for (const l of LAYERS) (want[l] ? startLayer : stopLayer)(l);
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.2);
  window.clearInterval(ticker);
  if (on.length) {
    ticker = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      for (const l of LAYERS) playing[l]?.schedule(ctx.currentTime + 8);
    }, 1500);
  } else {
    silent?.pause();
    window.setTimeout(() => { if (!anyOn() && ctx?.state === 'running') ctx.suspend().catch(() => undefined); }, 2500);
  }
  emit();
}

export function toggleLayer(l: Layer) {
  update((s) => ({ sound: { ...s.sound, [l]: !s.sound[l] } }));
  syncSound();
}
export function setVolume(v: number) {
  update((s) => ({ sound: { ...s.sound, volume: Math.max(0, Math.min(1, v)) } }));
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.08);
}
export function allOff() {
  update((s) => ({ sound: { ...s.sound, music: false, rain: false, forest: false, waves: false } }));
  syncSound();
}
/** Lower the sound while a verse is being read aloud. */
export function duck(on: boolean) {
  ducked = on;
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.25);
}

/** Browsers only allow sound after a tap, so sound left on resumes at the first touch. */
export function initSound() {
  if (!soundSupported()) return;
  const wake = () => {
    if (anyOn()) syncSound();
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };
  if (anyOn()) {
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => undefined);
    else if (anyOn()) ctx.resume().catch(() => undefined);
  });
}

/** Renders a sound without playing it and reports its loudness: used by the tests. */
export async function measure(l: Layer, seconds = 12): Promise<{ peak: number; rms: number; silentShare: number }> {
  const rate = 22050;
  const off = new OfflineAudioContext(2, rate * seconds, rate);
  const built = BUILD[l](off);
  built.out.connect(gain(off, LEVEL[l])).connect(off.destination);
  built.schedule(seconds);
  const buf = await off.startRendering();
  let peak = 0, sum = 0, quiet = 0, n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = rate * 5; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (!Number.isFinite(a)) return { peak: NaN, rms: NaN, silentShare: 1 };
      if (a > peak) peak = a;
      sum += a * a; n++;
      if (a < 0.0005) quiet++;
    }
  }
  return { peak, rms: Math.sqrt(sum / n), silentShare: quiet / n };
}
if (typeof window !== 'undefined') (window as unknown as { chestnutMeasureSound?: typeof measure }).chestnutMeasureSound = measure;
