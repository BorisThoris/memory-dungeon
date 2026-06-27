import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const targets = [
    { dir: 'assets/audio/portfolio-feedback-pack', quality: '4' },
    { dir: 'src/renderer/assets/audio/sfx', quality: '4' },
    { dir: 'src/renderer/assets/audio/ui', quality: '4' },
    { dir: 'src/renderer/assets/audio/music', quality: '5' }
];

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

let converted = 0;
let beforeBytes = 0;
let afterBytes = 0;

for (const target of targets) {
    const absoluteDir = path.join(repoRoot, target.dir);
    if (!fs.existsSync(absoluteDir)) {
        continue;
    }

    const wavFiles = fs
        .readdirSync(absoluteDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.wav'))
        .map((entry) => entry.name)
        .sort();

    for (const wavFile of wavFiles) {
        const input = path.join(absoluteDir, wavFile);
        const output = path.join(absoluteDir, `${path.basename(wavFile, '.wav')}.ogg`);
        const result = spawnSync(
            'ffmpeg',
            ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-c:a', 'libvorbis', '-q:a', target.quality, output],
            { stdio: 'inherit' }
        );

        if (result.error) {
            console.error(`export-runtime-ogg: failed to run ffmpeg for ${target.dir}/${wavFile}: ${result.error.message}`);
            process.exit(1);
        }
        if (result.status !== 0) {
            console.error(`export-runtime-ogg: ffmpeg exited ${result.status} for ${target.dir}/${wavFile}`);
            process.exit(result.status ?? 1);
        }

        converted += 1;
        beforeBytes += fs.statSync(input).size;
        afterBytes += fs.statSync(output).size;
    }
}

console.log(
    `export-runtime-ogg: converted ${converted} WAV master(s) to OGG runtime assets (${formatBytes(beforeBytes)} -> ${formatBytes(afterBytes)})`
);
