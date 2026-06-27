import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const texturesDir = path.join(repoRoot, 'src', 'renderer', 'assets', 'textures', 'cards');
const quality = process.env.CARD_NORMAL_WEBP_QUALITY ?? '94';
const normalMapFiles = ['back-normal.png', 'front-normal.png'];

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;

let beforeBytes = 0;
let afterBytes = 0;

for (const normalMapFile of normalMapFiles) {
    const input = path.join(texturesDir, normalMapFile);
    const output = path.join(texturesDir, normalMapFile.replace(/\.png$/i, '.webp'));

    if (!fs.existsSync(input)) {
        console.error(`export-card-normal-webp: missing source normal map ${normalMapFile}`);
        process.exit(1);
    }

    const result = spawnSync(
        'ffmpeg',
        [
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            input,
            '-c:v',
            'libwebp',
            '-quality',
            quality,
            '-compression_level',
            '6',
            output
        ],
        { stdio: 'inherit' }
    );

    if (result.error) {
        console.error(`export-card-normal-webp: failed to run ffmpeg for ${normalMapFile}: ${result.error.message}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`export-card-normal-webp: ffmpeg exited ${result.status} for ${normalMapFile}`);
        process.exit(result.status ?? 1);
    }

    beforeBytes += fs.statSync(input).size;
    afterBytes += fs.statSync(output).size;
}

console.log(
    `export-card-normal-webp: converted ${normalMapFiles.length} PNG master(s) to WebP runtime normal maps (${formatBytes(beforeBytes)} -> ${formatBytes(afterBytes)}, quality ${quality})`
);
