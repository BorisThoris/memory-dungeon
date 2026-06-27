import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const illustrationsDir = path.join(repoRoot, 'src', 'renderer', 'assets', 'cards', 'illustrations');

const quality = process.env.FACE_PANEL_WEBP_QUALITY ?? '82';
const pngFiles = fs
    .readdirSync(illustrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^face-panel-\d{2}\.png$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

let beforeBytes = 0;
let afterBytes = 0;

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;

for (const pngFile of pngFiles) {
    const input = path.join(illustrationsDir, pngFile);
    const output = path.join(illustrationsDir, pngFile.replace(/\.png$/i, '.webp'));
    const result = spawnSync(
        'ffmpeg',
        ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-c:v', 'libwebp', '-quality', quality, '-compression_level', '6', output],
        { stdio: 'inherit' }
    );

    if (result.error) {
        console.error(`export-face-panel-webp: failed to run ffmpeg for ${pngFile}: ${result.error.message}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`export-face-panel-webp: ffmpeg exited ${result.status} for ${pngFile}`);
        process.exit(result.status ?? 1);
    }

    beforeBytes += fs.statSync(input).size;
    afterBytes += fs.statSync(output).size;
}

console.log(
    `export-face-panel-webp: converted ${pngFiles.length} PNG master(s) to WebP runtime panels (${formatBytes(beforeBytes)} -> ${formatBytes(afterBytes)}, quality ${quality})`
);
