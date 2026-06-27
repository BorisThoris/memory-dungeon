import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const backgroundsDir = path.join(repoRoot, 'src', 'renderer', 'assets', 'ui', 'backgrounds');
const quality = process.env.UI_BACKGROUND_WEBP_QUALITY ?? '84';

const pngFiles = fs
    .readdirSync(backgroundsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name)
    .sort();

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
let beforeBytes = 0;
let afterBytes = 0;

for (const pngFile of pngFiles) {
    const input = path.join(backgroundsDir, pngFile);
    const output = path.join(backgroundsDir, pngFile.replace(/\.png$/i, '.webp'));
    const result = spawnSync(
        'ffmpeg',
        ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-c:v', 'libwebp', '-quality', quality, '-compression_level', '6', output],
        { stdio: 'inherit' }
    );

    if (result.error) {
        console.error(`export-ui-background-webp: failed to run ffmpeg for ${pngFile}: ${result.error.message}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`export-ui-background-webp: ffmpeg exited ${result.status} for ${pngFile}`);
        process.exit(result.status ?? 1);
    }

    beforeBytes += fs.statSync(input).size;
    afterBytes += fs.statSync(output).size;
}

console.log(
    `export-ui-background-webp: converted ${pngFiles.length} PNG master(s) to WebP runtime backgrounds (${formatBytes(beforeBytes)} -> ${formatBytes(afterBytes)}, quality ${quality})`
);
