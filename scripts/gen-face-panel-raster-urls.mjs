import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '../src/renderer/cardFace/facePanelRasterUrls.ts');
const illustrationsDir = path.join(__dirname, '../src/renderer/assets/cards/illustrations');
const ext = fs.existsSync(path.join(illustrationsDir, 'face-panel-01.webp')) ? 'webp' : 'png';
let s = `// Auto-generated: 80 face panel runtime rasters (regenerate with \`node scripts/gen-face-panel-raster-urls.mjs\` if count changes)\n\n`;
for (let i = 1; i <= 80; i += 1) {
  const n = String(i).padStart(2, '0');
  s += `import facePanel${n} from '../assets/cards/illustrations/face-panel-${n}.${ext}';\n`;
}
s += '\nexport const ALL_FACE_PANEL_URLS_ORDERED = [\n';
for (let i = 1; i <= 80; i += 1) {
  const n = String(i).padStart(2, '0');
  s += `  facePanel${n}${i < 80 ? ',\n' : '\n'}`;
}
s += '] as const;\n';
fs.writeFileSync(out, s, 'utf8');
console.log('Wrote', out);
