import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0d1117"/>
  <text x="80" y="300" font-family="sans-serif" font-size="72" font-weight="700" fill="#ffffff">Own your Nx remote cache.</text>
  <text x="80" y="380" font-family="sans-serif" font-size="36" fill="#9ca3af">Free, self-hosted, MIT-licensed. remotecache.dev</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(new URL('../public/og.png', import.meta.url).pathname);
console.log('wrote public/og.png');
