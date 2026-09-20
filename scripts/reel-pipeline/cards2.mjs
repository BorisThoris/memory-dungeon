// Reel v2 typographic layers: four centred line overlays (transparent) and the end-card foreground.
// node cards2.mjs <repo> <outDir> <lines.json>   lines.json = {hook, study, chain, close}
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [REPO, OUT, LINES] = process.argv.slice(2);
const lines = JSON.parse(fs.readFileSync(LINES, 'utf8'));
const f = (p) => pathToFileURL(path.join(REPO, p)).href;
const fonts = `
@font-face { font-family: 'Cinzel'; font-weight: 700; src: url('${f('node_modules/@fontsource/cinzel/files/cinzel-latin-700-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Cinzel'; font-weight: 600; src: url('${f('node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Cormorant Garamond'; font-weight: 500; src: url('${f('node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Cormorant Garamond'; font-weight: 400; font-style: italic; src: url('${f('node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2')}') format('woff2'); }
@font-face { font-family: 'Lora'; font-weight: 400; src: url('${f('node_modules/@fontsource/lora/files/lora-latin-400-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Lora'; font-weight: 400; font-style: italic; src: url('${f('node_modules/@fontsource/lora/files/lora-latin-400-italic.woff2')}') format('woff2'); }
`;
const base = `
* { margin: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; background: transparent; overflow: hidden; }
body { font-family: 'Lora', serif; color: #f8f4f4; }
`;

// A line set low in the frame (the top two thirds belong to the picture), with a hairline under it.
const line = (text, { y = 1390, size = 132 } = {}) => `<!doctype html><html><head><style>${fonts}${base}
.wrap { position: absolute; left: 60px; right: 60px; top: ${y}px; display: flex; flex-direction: column; align-items: center; gap: 26px; text-align: center; }
.line { font-family: 'Cormorant Garamond'; font-weight: 500; font-size: ${size}px; line-height: 1.02; letter-spacing: -.005em; text-wrap: balance;
  text-shadow: 0 6px 60px rgba(0,0,0,.95), 0 2px 12px rgba(0,0,0,.9); }
.rule { width: 140px; height: 2px; background: #e1ad66; box-shadow: 0 0 18px rgba(225,173,102,.7); }
</style></head><body><div class="wrap"><span class="line">${text}</span><span class="rule"></span></div></body></html>`;

const endFg = `<!doctype html><html><head><style>${fonts}${base}
.tint { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11,10,13,.35) 0%, rgba(11,10,13,.1) 30%, rgba(11,10,13,.55) 62%, #0b0a0d 100%); }
.stack { position: absolute; left: 0; right: 0; top: 520px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.crest { width: 210px; height: 210px; margin-bottom: 24px; filter: drop-shadow(0 0 40px rgba(201,161,99,.4)); }
.eyebrow { font-family: 'Lora'; font-size: 26px; letter-spacing: .34em; text-transform: uppercase; color: #e1ad66; margin-bottom: 24px; }
.title { font-family: 'Cinzel'; font-weight: 700; font-size: 150px; line-height: .98; letter-spacing: .02em; color: #f5ead6;
  text-shadow: 0 6px 50px rgba(0,0,0,.9), 0 0 60px rgba(242,211,157,.18); }
.close { font-family: 'Cormorant Garamond'; font-style: italic; font-weight: 400; font-size: 60px; color: #f8f4f4; margin-top: 46px; text-shadow: 0 4px 30px rgba(0,0,0,.9); }
.cta { position: absolute; left: 0; right: 0; bottom: 230px; display: flex; flex-direction: column; align-items: center; gap: 22px; }
.free { font-family: 'Lora'; font-size: 30px; letter-spacing: .2em; text-transform: uppercase; color: #bab6b6; }
.play { font-family: 'Cinzel'; font-weight: 600; font-size: 44px; letter-spacing: .12em; text-transform: uppercase; color: #e1ad66;
  padding: 30px 64px; border: 2px solid rgba(225,173,102,.85); border-radius: 8px; background: rgba(19,17,17,.7); }
.url { font-family: 'Lora'; font-size: 34px; letter-spacing: .06em; color: #f8f4f4; opacity: .92; }
</style></head><body>
<div class="tint"></div>
<div class="stack">
  <img class="crest" src="${f('src/renderer/assets/ui/brand-crest.svg')}" alt="">
  <span class="eyebrow">Seeker of Shards</span>
  <span class="title">MEMORY<br>DUNGEON</span>
  <span class="close">${lines.close}</span>
</div>
<div class="cta">
  <span class="free">Free · no download</span>
  <span class="play">Play in your browser</span>
  <span class="url">memory-dungeon-git.pages.dev</span>
</div>
</body></html>`;

const pages = {
    'l-hook': line(lines.hook, { y: 1330, size: 150 }),
    'l-study': line(lines.study),
    'l-chain': line(lines.chain),
    'end-fg': endFg
};
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
const page = await ctx.newPage();
for (const [name, html] of Object.entries(pages)) {
    const file = path.join(OUT, name + '.html');
    fs.writeFileSync(file, html);
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: true });
}
await browser.close();
console.log('cards2 rendered');
