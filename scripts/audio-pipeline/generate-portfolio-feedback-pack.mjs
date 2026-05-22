#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writePcmWavFile } from './proceduralBeatPrimitives.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../..');
const outDir = path.join(repoRoot, 'assets/audio/portfolio-feedback-pack');
const rendererSfxDir = path.join(repoRoot, 'src/renderer/assets/audio/sfx');
const SR = 22050;

function tone(durSec, partials) {
    const n = Math.floor(SR * durSec);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
        const phase = i / Math.max(1, n - 1);
        const attack = Math.min(1, phase / 0.12);
        const release = Math.min(1, (1 - phase) / 0.22);
        const env = Math.sin(Math.PI * phase) * attack * release;
        const t = i / SR;
        let sample = 0;
        for (const [freq, gain] of partials) {
            sample += gain * Math.sin(2 * Math.PI * freq * t);
        }
        out[i] = env * sample;
    }
    return out;
}

function noiseSample(seedRef) {
    seedRef.v = (seedRef.v * 1103515245 + 12345) >>> 0;
    return (seedRef.v / 0x7fffffff) * 2 - 1;
}

function renderDemoAmbienceLoop(durSec) {
    const n = Math.floor(SR * durSec);
    const out = new Float32Array(n);
    const seedRef = { v: 1606 };
    let roomTone = 0;
    const padFreqs = [55, 82.41, 110, 146.83, 220];

    for (let i = 0; i < n; i += 1) {
        const phase = i / n;
        const seam = Math.sin(Math.PI * phase) ** 0.18;
        const t = i / SR;
        roomTone = roomTone * 0.996 + noiseSample(seedRef) * 0.004;

        let pad = 0;
        for (let k = 0; k < padFreqs.length; k += 1) {
            const drift = 1 + Math.sin(2 * Math.PI * (phase + k * 0.17)) * 0.0015;
            pad += Math.sin(2 * Math.PI * padFreqs[k] * drift * t + k * 0.8) / padFreqs.length;
        }

        const shimmer =
            Math.sin(2 * Math.PI * 880 * t + Math.sin(2 * Math.PI * 0.08 * t) * 3) * 0.018 +
            Math.sin(2 * Math.PI * 1320 * t + Math.sin(2 * Math.PI * 0.06 * t) * 4) * 0.012;

        out[i] = seam * (roomTone * 0.055 + pad * 0.08 + shimmer);
    }

    return out;
}

const cues = {
    'match-success.wav': tone(0.16, [[612, 0.16], [820, 0.12], [1224, 0.05]]),
    'mistake.wav': tone(0.18, [[180, 0.16], [120, 0.12], [72, 0.04]]),
    'relic-offer-shimmer.wav': tone(0.22, [[620, 0.12], [960, 0.1], [1480, 0.06]]),
    'countdown-pressure.wav': tone(0.11, [[220, 0.13], [310, 0.1], [440, 0.04]]),
    'floor-clear.wav': tone(0.24, [[300, 0.12], [540, 0.1], [1080, 0.08]])
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(rendererSfxDir, { recursive: true });

for (const [name, samples] of Object.entries(cues)) {
    writePcmWavFile(path.join(outDir, name), samples, SR);
}

writePcmWavFile(path.join(outDir, 'demo-ambience-loop.wav'), renderDemoAmbienceLoop(16), SR);
writePcmWavFile(path.join(rendererSfxDir, 'countdown-pressure.wav'), cues['countdown-pressure.wav'], SR);

fs.writeFileSync(
    path.join(outDir, 'README.md'),
    [
        '# Portfolio Feedback Pack',
        '',
        'Tiny procedural WAV one-shots for the Memory Dungeon portfolio audio layer.',
        '',
        '- `match-success.wav`: successful pair resolve',
        '- `mistake.wav`: failed pair resolve',
        '- `relic-offer-shimmer.wav`: relic draft appears',
        '- `countdown-pressure.wav`: final gauntlet seconds',
        '- `floor-clear.wav`: floor complete sting',
        '- `demo-ambience-loop.wav`: subtle looped room tone for the featured browser demo',
        '',
        'Renderer playback uses the existing sampled SFX manifest with procedural Web Audio fallback.'
    ].join('\n')
);

console.log(`wrote ${Object.keys(cues).length} portfolio feedback cues to ${path.relative(repoRoot, outDir)}`);
