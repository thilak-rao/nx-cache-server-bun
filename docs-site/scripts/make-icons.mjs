/* eslint-disable no-console -- build/CLI script: stdout progress is intentional */
import sharp from 'sharp';

// Regenerates every derived icon from the transparent logo master at
// src/assets/logo.png (the Starlight header logo). Run with:
//   bun scripts/make-icons.mjs
// Outputs: public/favicon.png, public/apple-touch-icon.png, public/og.png.

const here = (p) => new URL(p, import.meta.url).pathname;
const MASTER = here('../src/assets/logo.png');

// Tight mark (master minus its transparent padding) so each icon controls its
// own margin instead of inheriting the master's.
const mark = await sharp(MASTER).trim({ threshold: 10 }).png().toBuffer();

// favicon — 48x48 with a hair of padding.
await sharp(mark)
  .resize(44, 44, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(here('../public/favicon.png'));
console.log('wrote public/favicon.png (48x48)');

// apple-touch-icon — iOS ignores transparency and masks corners, so flatten the
// mark onto a solid white tile with padding.
const appleMark = await sharp(mark)
  .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
  .composite([{ input: appleMark, gravity: 'center' }])
  .png()
  .toFile(here('../public/apple-touch-icon.png'));
console.log('wrote public/apple-touch-icon.png (180x180)');

// og.png — 1200x630 social card: logo left, headline + sub right, GitHub-dark bg.
const ogLogo = await sharp(mark)
  .resize(300, 300, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0d1117"/>
  <text x="400" y="300" font-family="sans-serif" font-size="52" font-weight="700" fill="#ffffff">Own your Nx remote cache.</text>
  <text x="400" y="358" font-family="sans-serif" font-size="30" fill="#9ca3af">Free, self-hosted, MIT-licensed. remotecache.dev</text>
</svg>`;
await sharp(Buffer.from(ogSvg))
  .composite([{ input: ogLogo, top: 165, left: 80 }])
  .png()
  .toFile(here('../public/og.png'));
console.log('wrote public/og.png (1200x630)');
