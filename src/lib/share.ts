import { formatRef, isPassage, versePath, type Ref } from './books';
import { partsOf, supNumber } from './passage';
import { sceneUrl, type Scene } from './scenes';

export const APP_NAME = 'Chestnut';
export const TAGLINE = "A verse for what's on your mind";

export interface Shareable extends Ref { text: string }

/** Link that opens the app on this verse or passage. */
export function verseUrl(r: Ref): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#${versePath(r)}`;
}

export function shareText(s: Shareable, withLink = true): string {
  // a passage keeps its verse numbers, in small figures: "\u00b9There is… \u00b2For the law…"
  const parts = isPassage(s) ? partsOf(s) : undefined;
  const words = parts ? parts.map((p) => supNumber(p.v) + p.text).join(' ') : s.text;
  const body = `“${words}”\n— ${formatRef(s)} (KJV)`;
  return withLink ? `${body}\n\n${verseUrl(s)}` : body;
}

export const whatsappUrl = (s: Shareable) => `https://wa.me/?text=${encodeURIComponent(shareText(s))}`;
export const telegramUrl = (s: Shareable) =>
  `https://t.me/share/url?url=${encodeURIComponent(verseUrl(s))}&text=${encodeURIComponent(shareText(s, false))}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Returns false when the person cancelled or sharing is unavailable. */
export async function nativeShare(s: Shareable): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({ title: `${formatRef(s)} · ${APP_NAME}`, text: shareText(s, false), url: verseUrl(s) });
    return true;
  } catch {
    return false;
  }
}

export type ImageFormat = 'story' | 'square';
const SIZES: Record<ImageFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the background'));
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"DM Sans Variable", "DM Sans", system-ui, sans-serif';

/** Paints the verse on its background, ready for a story or a square post. */
export async function renderShareImage(s: Shareable, scene: Scene, format: ImageFormat): Promise<HTMLCanvasElement> {
  const [W, H] = SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  await Promise.all([
    document.fonts?.load(`600 64px ${SERIF}`),
    document.fonts?.load(`500 30px ${SANS}`),
  ]).catch(() => undefined);

  // background, cover-fit; painted scenes keep their horizon (bottom-aligned)
  try {
    const img = await loadImage(sceneUrl(scene));
    const iw = img.naturalWidth || 900, ih = img.naturalHeight || 1600;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    const dy = scene.kind === 'photo' ? (H - dh) / 2 : H - dh;
    ctx.drawImage(img, (W - dw) / 2, dy, dw, dh);
  } catch {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3b2416');
    g.addColorStop(1, '#8a4b2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const light = scene.ink === 'light';
  if (scene.kind === 'photo') {
    ctx.fillStyle = light ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 0, W, H);
  }

  const ink = light ? '#ffffff' : '#2b1a10';
  const soft = light ? 'rgba(255,255,255,0.82)' : 'rgba(43,26,16,0.78)';
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (light) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 2;
  }

  // largest size at which the verse fits its box
  const maxW = W - 2 * 112;
  const boxH = format === 'story' ? H * 0.5 : H * 0.56;
  let size = format === 'story' ? 92 : 78;
  // a long passage may go smaller than a single verse ever needs to
  const smallest = 24;
  let lines: string[] = [];
  let lh = 0;
  for (; ; size -= 2) {
    ctx.font = `600 ${size}px ${SERIF}`;
    lines = wrap(ctx, s.text, maxW);
    lh = size * 1.22;
    if (lines.length * lh <= boxH || size <= smallest) break;
  }
  // still too long at the smallest size: show the beginning and end it with "…" (the reference gives the whole range)
  const room = Math.max(1, Math.floor(boxH / lh));
  const cut = lines.length > room;
  if (cut) {
    lines = lines.slice(0, room);
    let last = lines[room - 1];
    while (last.includes(' ') && ctx.measureText(last + ' \u2026').width > maxW) last = last.slice(0, last.lastIndexOf(' '));
    lines[room - 1] = last.replace(/[,;:.]$/, '') + ' \u2026';
  }
  // even out the lines so the last one is not a single stray word
  const count = lines.length;
  for (let w = maxW * 0.96; !cut && count > 1 && w > maxW * 0.55; w -= maxW * 0.03) {
    const tighter = wrap(ctx, s.text, w);
    if (tighter.length !== count) break;
    lines = tighter;
  }
  const blockH = lines.length * lh;
  const centre = format === 'story' ? H * 0.44 : H * 0.44;
  let y = centre - blockH / 2 + size * 0.85;

  // opening mark
  ctx.font = `600 ${Math.round(size * 2.2)}px ${SERIF}`;
  ctx.globalAlpha = 0.55;
  ctx.fillText('“', W / 2, y - size * 0.75);
  ctx.globalAlpha = 1;

  ctx.font = `600 ${size}px ${SERIF}`;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += lh;
  }

  // rule and reference
  y += size * 0.1;
  ctx.shadowBlur = light ? 12 : 0;
  ctx.fillStyle = soft;
  ctx.fillRect(W / 2 - 34, y - size * 0.35, 68, 2);
  y += Math.max(44, size * 0.75);
  ctx.fillStyle = ink;
  ctx.font = `600 34px ${SANS}`;
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in spaced) spaced.letterSpacing = '5px';
  ctx.fillText(`${formatRef(s).toUpperCase()}  ·  KJV`, W / 2, y);

  // a small cross, then the wordmark
  const foot = H - (format === 'story' ? 150 : 64);
  ctx.save();
  ctx.shadowBlur = light ? 10 : 0;
  ctx.strokeStyle = soft;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2, foot - 96); ctx.lineTo(W / 2, foot - 50);
  ctx.moveTo(W / 2 - 14, foot - 82); ctx.lineTo(W / 2 + 14, foot - 82);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = soft;
  ctx.font = `600 30px ${SERIF}`;
  if ('letterSpacing' in spaced) spaced.letterSpacing = '8px';
  ctx.fillText(APP_NAME.toUpperCase(), W / 2, foot);
  if ('letterSpacing' in spaced) spaced.letterSpacing = '0px';
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'));
}

export const imageFileName = (s: Ref) => `chestnut-${formatRef(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;

/** Hands the picture to the phone's share sheet; falls back to a download. */
export async function shareImage(s: Shareable, blob: Blob): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], imageFileName(s), { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: shareText(s, true) });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, imageFileName(s));
  return 'downloaded';
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
