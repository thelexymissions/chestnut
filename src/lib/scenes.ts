import photos from '../data/photos.json';

// Card backgrounds. Painted scenes are generated as SVG so the same picture is
// used on screen and in a shared image, stays sharp at any size and works
// offline. Photos (when present in src/data/photos.json) join the same pools.

export type Mood = 'dawn' | 'sky' | 'deep' | 'forest' | 'ember' | 'earth' | 'dusk' | 'light';
type Layout = 'ridges' | 'horizon' | 'glow' | 'night';

interface Palette {
  sky: string[];      // top to bottom
  ridges: string[];   // far to near
  glow: string;
  sun: string;
  ink: 'light' | 'dark';
  layouts: Layout[];
}

const PALETTES: Record<Mood, Palette> = {
  dawn: { sky: ['#2a2350', '#8e4470', '#e98a63', '#fbd49a'], ridges: ['#c9788a', '#93507a', '#5d3466', '#2d1b47'], glow: '#ffd9a0', sun: '#fff1cf', ink: 'light', layouts: ['ridges', 'horizon', 'glow'] },
  sky: { sky: ['#0f3562', '#1f5c98', '#4d93c9', '#a9d3ea'], ridges: ['#7fb0d6', '#4f86b8', '#2c5f94', '#17406f'], glow: '#d7efff', sun: '#ffffff', ink: 'light', layouts: ['ridges', 'horizon', 'glow'] },
  deep: { sky: ['#03061a', '#0a1538', '#16306a', '#27508f'], ridges: ['#1b3668', '#12264f', '#0b1836', '#050c1f'], glow: '#5f8fe0', sun: '#e8f0ff', ink: 'light', layouts: ['night', 'ridges', 'glow'] },
  forest: { sky: ['#0b2420', '#1c4a3c', '#4f8562', '#c4d79a'], ridges: ['#4b8463', '#2f6149', '#1a4234', '#0b2620'], glow: '#e4f0b0', sun: '#fbffe0', ink: 'light', layouts: ['ridges', 'glow', 'horizon'] },
  ember: { sky: ['#2c0c26', '#7a1f45', '#cf5266', '#f6a886'], ridges: ['#a83d5f', '#782b50', '#4b1b3d', '#270e27'], glow: '#ffc2a0', sun: '#ffe8d2', ink: 'light', layouts: ['horizon', 'ridges', 'glow'] },
  earth: { sky: ['#21150f', '#5c3a26', '#a8744a', '#e6c38f'], ridges: ['#a9764c', '#7c5135', '#523423', '#2b1a12'], glow: '#ffdfa8', sun: '#fff3d6', ink: 'light', layouts: ['ridges', 'glow', 'horizon'] },
  dusk: { sky: ['#140f2e', '#3b2a66', '#7a4f95', '#d59ab3'], ridges: ['#6b4b8c', '#4b346e', '#2f2151', '#181033'], glow: '#f0b8d0', sun: '#ffe6ee', ink: 'light', layouts: ['ridges', 'night', 'horizon'] },
  light: { sky: ['#f7ecd2', '#f6dfaa', '#eec77a', '#d9a04e'], ridges: ['#e2b566', '#c8914a', '#a56f38', '#7c4f29'], glow: '#fffaf0', sun: '#ffffff', ink: 'dark', layouts: ['ridges', 'glow', 'horizon'] },
};

export interface Scene {
  id: string;
  mood: Mood;
  ink: 'light' | 'dark';
  kind: 'painted' | 'photo';
  /** photo only */
  file?: string;
  credit?: string;
}

interface PhotoEntry { file: string; mood: string; author?: string; ink?: string }

const painted: Scene[] = (Object.keys(PALETTES) as Mood[]).flatMap((mood) =>
  PALETTES[mood].layouts.map((layout) => ({ id: `${mood}-${layout}`, mood, ink: PALETTES[mood].ink, kind: 'painted' as const })));

const photoScenes: Scene[] = (photos as PhotoEntry[])
  .filter((p) => p && p.file && p.mood in PALETTES)
  .map((p) => ({ id: `photo:${p.file}`, mood: p.mood as Mood, ink: p.ink === 'dark' ? 'dark' as const : 'light' as const, kind: 'photo' as const, file: p.file, credit: p.author }));

export const SCENES: Scene[] = [...painted, ...photoScenes];
const byId = new Map(SCENES.map((s) => [s.id, s]));
export const sceneById = (id: string): Scene | undefined => byId.get(id);

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scenes that suit a list of moods; the first mood contributes most. */
export function poolFor(moods: Mood[]): Scene[] {
  const out: Scene[] = [];
  moods.forEach((m, i) => {
    const list = SCENES.filter((s) => s.mood === m);
    out.push(...(i === 0 ? list : list.slice(0, 2)));
  });
  return out.length ? out : SCENES;
}

/** Stable default scene for a verse within a topic. */
export function pickScene(key: string, moods: Mood[]): Scene {
  const pool = poolFor(moods);
  return pool[hash(key) % pool.length];
}

export function nextScene(current: string, moods: Mood[]): Scene {
  const pool = [...poolFor(moods), ...SCENES.filter((s) => !poolFor(moods).includes(s))];
  const i = pool.findIndex((s) => s.id === current);
  return pool[(i + 1) % pool.length];
}

// ---- SVG painting ----
const W = 900;
const H = 1600;
const svgCache = new Map<string, string>();

function ridgePath(r: () => number, base: number, amp: number): string {
  const f1 = 0.004 + r() * 0.004, f2 = 0.011 + r() * 0.008, f3 = 0.026 + r() * 0.014;
  const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
  let d = `M0 ${H} `;
  for (let x = 0; x <= W; x += 6) {
    const y = base - amp * (0.58 * Math.sin(x * f1 + p1) + 0.3 * Math.sin(x * f2 + p2) + 0.1 * Math.sin(x * f3 + p3) + 0.5);
    d += `L${x} ${y.toFixed(1)} `;
  }
  return d + `L${W} ${H} Z`;
}

function paint(id: string): string {
  const [mood, layout] = id.split('-') as [Mood, Layout];
  const p = PALETTES[mood];
  const r = rng(hash(id));
  const stops = p.sky.map((c, i) => `<stop offset="${(i / (p.sky.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('');
  let defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
  let body = '';
  const halo = (name: string, color: string, inner = 0.9) =>
    `<radialGradient id="${name}"><stop offset="0" stop-color="${color}" stop-opacity="${inner}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

  if (layout === 'glow') {
    // soft colour field
    const base = p.ink === 'dark' ? p.sky[0] : p.sky[0];
    body += `<rect width="${W}" height="${H}" fill="${base}"/>`;
    const colors = [p.sky[1], p.sky[2], p.sky[3], p.glow, p.ridges[0]];
    colors.forEach((c, i) => {
      defs += halo(`b${i}`, c, 0.85);
      const cx = r() * W, cy = (0.1 + 0.8 * r()) * H, rad = 420 + r() * 420;
      body += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="url(#b${i})"/>`;
    });
  } else {
    body += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
    const horizonY = layout === 'horizon' ? H * 0.64 : H * 0.7;
    const sunX = W * (0.28 + r() * 0.44);

    if (layout === 'night' || mood === 'deep') {
      for (let i = 0; i < 130; i++) {
        const x = r() * W, y = r() * H * 0.62, s = 0.6 + r() * 1.9, o = 0.25 + r() * 0.7;
        body += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${s.toFixed(1)}" fill="#fff" opacity="${o.toFixed(2)}"/>`;
      }
    }
    // sun or moon with a wide halo
    defs += halo('halo', p.glow, layout === 'night' ? 0.45 : 0.8);
    // night: a small moon high on the right; horizon: the sun just above the water;
    // ridges: only the glow of a sun that is still behind the hills
    const moonX = W * (0.62 + r() * 0.2);
    const cx = layout === 'night' ? moonX : sunX;
    const sunY = layout === 'night' ? H * (0.17 + r() * 0.06) : layout === 'horizon' ? horizonY - 96 - r() * 70 : horizonY + 40;
    body += `<circle cx="${cx.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${layout === 'night' ? 300 : 560}" fill="url(#halo)"/>`;
    if (layout === 'night') body += `<circle cx="${cx.toFixed(0)}" cy="${sunY.toFixed(0)}" r="40" fill="${p.sun}" opacity="0.92"/>`;
    if (layout === 'horizon') body += `<circle cx="${cx.toFixed(0)}" cy="${sunY.toFixed(0)}" r="62" fill="${p.sun}" opacity="0.95"/>`;

    if (layout === 'horizon') {
      // far shore, then water with a light path
      body += `<path d="${ridgePath(r, horizonY + 6, 46)}" fill="${p.ridges[1]}" opacity="0.9"/>`;
      defs += `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[p.sky.length - 2]}"/><stop offset="0.5" stop-color="${p.ridges[2]}"/><stop offset="1" stop-color="${p.ridges[3]}"/></linearGradient>`;
      body += `<rect y="${horizonY}" width="${W}" height="${H - horizonY}" fill="url(#water)"/>`;
      defs += `<linearGradient id="path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sun}" stop-opacity="0.75"/><stop offset="1" stop-color="${p.sun}" stop-opacity="0"/></linearGradient>`;
      for (let i = 0; i < 26; i++) {
        const y = horizonY + 8 + i * i * 0.85 + i * 6;
        if (y > H) break;
        const w = 40 + i * 13 + r() * 60, x = sunX - w / 2 + (r() - 0.5) * 30;
        body += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(2 + i * 0.35).toFixed(1)}" rx="2" fill="${p.sun}" opacity="${(0.5 - i * 0.017).toFixed(2)}"/>`;
      }
    } else {
      // layered ridgelines fading into haze
      const n = p.ridges.length;
      p.ridges.forEach((c, i) => {
        const base = H * (0.7 + i * 0.075) + r() * 20;
        const amp = 150 - i * 22 + r() * 40;
        body += `<path d="${ridgePath(r, base, amp)}" fill="${c}"/>`;
        if (i < n - 1) {
          defs += `<linearGradient id="mist${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.glow}" stop-opacity="0"/><stop offset="1" stop-color="${p.glow}" stop-opacity="${(0.16 - i * 0.04).toFixed(2)}"/></linearGradient>`;
          body += `<rect y="${(base - 60).toFixed(0)}" width="${W}" height="150" fill="url(#mist${i})"/>`;
        }
      });
    }
  }

  // keep the words readable whatever is behind them
  if (p.ink === 'light') {
    defs += `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.34"/><stop offset="0.22" stop-color="#000" stop-opacity="0.1"/><stop offset="0.62" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></linearGradient>`;
    defs += `<radialGradient id="mid" cx="0.5" cy="0.44" r="0.6"><stop offset="0" stop-color="#000" stop-opacity="0.26"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  } else {
    defs += `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    defs += `<radialGradient id="mid" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#fff8e6" stop-opacity="0.5"/><stop offset="1" stop-color="#fff8e6" stop-opacity="0"/></radialGradient>`;
  }
  body += `<rect width="${W}" height="${H}" fill="url(#shade)"/><rect width="${W}" height="${H}" fill="url(#mid)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><defs>${defs}</defs>${body}</svg>`;
}

export function sceneSvg(id: string): string {
  let s = svgCache.get(id);
  if (!s) { s = paint(id); svgCache.set(id, s); }
  return s;
}

const urlCache = new Map<string, string>();
/** URL usable in CSS background-image or as an <img> source. */
export function sceneUrl(scene: Scene): string {
  if (scene.kind === 'photo') return `${import.meta.env.BASE_URL}bg/${scene.file}`;
  let u = urlCache.get(scene.id);
  if (!u) {
    u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneSvg(scene.id))}`;
    urlCache.set(scene.id, u);
  }
  return u;
}

/** A representative colour per mood, for chips and dots. */
export const moodColor = (m: Mood): string => PALETTES[m].sky[2];
export const moodDeep = (m: Mood): string => PALETTES[m].sky[1];
