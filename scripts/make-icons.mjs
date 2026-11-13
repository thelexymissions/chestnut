// Renders the PNG icons from public/icon.svg. Run: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'));
const render = (size, file) => sharp(svg, { density: 300 }).resize(size, size).png().toFile(path.join(pub, file));

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(180, 'apple-touch-icon.png');
// maskable: same art with extra padding so launchers can crop it to any shape
const inner = await sharp(svg, { density: 300 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#3a2014' } })
  .composite([{ input: inner, gravity: 'centre' }]).png().toFile(path.join(pub, 'icon-maskable-512.png'));
// link preview picture
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2350"/><stop offset="0.45" stop-color="#8e4470"/><stop offset="0.8" stop-color="#e98a63"/><stop offset="1" stop-color="#fbd49a"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect width="1200" height="630" fill="#000" opacity="0.22"/>
  <text x="600" y="300" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="700" fill="#fff">Chestnut</text>
  <text x="600" y="390" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-style="italic" fill="#fff" opacity="0.92">A verse for what's on your mind</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(path.join(pub, 'og.png'));
console.log('icons written');
