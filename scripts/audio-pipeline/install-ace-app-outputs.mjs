#!/usr/bin/env node
/**
 * Copy ACE-Step batch outputs from tmp/audio/ace-step/<jobId>/ into src/renderer/assets/audio/*
 * using trim duration from jobs.memory-dungeon-app-audio.json (first N seconds; loops use full job duration).
 *
 * Requires ffmpeg on PATH for trim + PCM WAV export. Without ffmpeg, copies the newest render as-is (may be long).
 *
 * Usage:
 *   node scripts/audio-pipeline/install-ace-app-outputs.mjs
 *   node scripts/audio-pipeline/install-ace-app-outputs.mjs --ace-out tmp/audio/ace-step --dry-run
 *   node scripts/audio-pipeline/install-ace-app-outputs.mjs -- --variant 02
 *   node scripts/audio-pipeline/install-ace-app-outputs.mjs -- --loudness
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

/** job id -> path under repo root (must match manifests). */
const JOB_INSTALL_PATHS = {
    flip: 'src/renderer/assets/audio/sfx/flip.wav',
    'gambit-commit': 'src/renderer/assets/audio/sfx/gambit-commit.wav',
    'match-tier-low': 'src/renderer/assets/audio/sfx/match-tier-low.wav',
    'match-tier-mid': 'src/renderer/assets/audio/sfx/match-tier-mid.wav',
    'match-tier-high': 'src/renderer/assets/audio/sfx/match-tier-high.wav',
    mismatch: 'src/renderer/assets/audio/sfx/mismatch.wav',
    'power-arm': 'src/renderer/assets/audio/sfx/power-arm.wav',
    'destroy-pair': 'src/renderer/assets/audio/sfx/destroy-pair.wav',
    'peek-power': 'src/renderer/assets/audio/sfx/peek-power.wav',
    'stray-power': 'src/renderer/assets/audio/sfx/stray-power.wav',
    'shuffle-full': 'src/renderer/assets/audio/sfx/shuffle-full.wav',
    'shuffle-quick': 'src/renderer/assets/audio/sfx/shuffle-quick.wav',
    'floor-clear': 'src/renderer/assets/audio/sfx/floor-clear.wav',
    'ui-click': 'src/renderer/assets/audio/ui/ui-click.wav',
    'ui-confirm': 'src/renderer/assets/audio/ui/ui-confirm.wav',
    'ui-back': 'src/renderer/assets/audio/ui/ui-back.wav',
    'ui-counter': 'src/renderer/assets/audio/ui/ui-counter.wav',
    'menu-open': 'src/renderer/assets/audio/ui/menu-open.wav',
    'run-start': 'src/renderer/assets/audio/ui/run-start.wav',
    'intro-sting': 'src/renderer/assets/audio/ui/intro-sting.wav',
    'pause-open': 'src/renderer/assets/audio/ui/pause-open.wav',
    'pause-resume': 'src/renderer/assets/audio/ui/pause-resume.wav',
    'game-over-open': 'src/renderer/assets/audio/ui/game-over-open.wav',
    'ui-copy': 'src/renderer/assets/audio/ui/ui-copy.wav',
    'relic-offer-open': 'src/renderer/assets/audio/sfx/relic-offer-open.wav',
    'relic-pick': 'src/renderer/assets/audio/sfx/relic-pick.wav',
    'wager-arm': 'src/renderer/assets/audio/sfx/wager-arm.wav',
    'menu-loop': 'src/renderer/assets/audio/music/menu-loop.wav',
    'run-loop': 'src/renderer/assets/audio/music/run-loop.wav'
};

function parseArgs() {
    const argv = process.argv.slice(2);
    let aceOut = path.join(repoRoot, 'tmp', 'audio', 'ace-step');
    let jobsFile = path.join(repoRoot, 'scripts', 'audio-pipeline', 'jobs.memory-dungeon-app-audio.json');
    let dryRun = false;
    /** @type {string | undefined} */
    let variant = undefined;
    let picksFile = undefined;
    let loudness = false;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--ace-out' && argv[i + 1]) {
            aceOut = path.resolve(argv[i + 1]);
            i += 1;
        } else if (argv[i] === '--jobs' && argv[i + 1]) {
            jobsFile = path.resolve(argv[i + 1]);
            i += 1;
        } else if (argv[i] === '--dry-run') {
            dryRun = true;
        } else if (argv[i] === '--variant' && argv[i + 1]) {
            variant = argv[i + 1];
            i += 1;
        } else if (argv[i] === '--picks' && argv[i + 1]) {
            picksFile = argv[i + 1];
            i += 1;
        } else if (argv[i] === '--loudness' || argv[i] === '--normalize') {
            loudness = true;
        }
    }
    return { aceOut, jobsFile, dryRun, variant, loudness, picksFile };
}

function loadJobDurations(jobsPath) {
    const raw = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.jobs;
    if (!Array.isArray(list)) {
        throw new Error('jobs file must be an array or { jobs: [] }');
    }
    /** @type {Record<string, number>} */
    const out = {};
    for (const e of list) {
        if (e && typeof e.id === 'string' && typeof e.duration === 'number') {
            out[e.id] = e.duration;
        }
    }
    return out;
}

function newestMediaFile(jobDir) {
    if (!fs.existsSync(jobDir)) {
        return null;
    }
    const names = fs.readdirSync(jobDir);
    let best = null;
    let bestT = 0;
    for (const name of names) {
        if (!/\.(flac|wav|mp3|ogg)$/i.test(name)) {
            continue;
        }
        const p = path.join(jobDir, name);
        const st = fs.statSync(p);
        if (st.mtimeMs >= bestT) {
            bestT = st.mtimeMs;
            best = p;
        }
    }
    return best;
}

/** e.g. "1" | "01" | "v2" -> "v01" */
function parseVariantFolderName(s) {
    const m = String(s).trim().match(/^v?(\d+)$/i);
    if (!m) {
        return null;
    }
    return `v${m[1].padStart(2, '0')}`;
}

/**
 * Picks a directory to scan for media: flat <jobId>/ or a vXX/ subfolder.
 * @returns {{ sourceDir: string, picked: string | null, requestedExplicit: boolean, hasMultipleVariantDirs: boolean }}
 */
function resolveSourceDir(aceOut, jobId, explicitVariant) {
    const jobDir = path.join(aceOut, jobId);
    if (!fs.existsSync(jobDir)) {
        return {
            sourceDir: jobDir,
            picked: null,
            requestedExplicit: Boolean(explicitVariant),
            hasMultipleVariantDirs: false
        };
    }

    const entries = fs.readdirSync(jobDir, { withFileTypes: true });
    const asNorm = (name) => {
        const m = name.match(/^v(\d+)$/i);
        return m ? `v${m[1].padStart(2, '0')}` : name;
    };
    const haveSet = new Set(
        entries.filter((d) => d.isDirectory() && /^v\d+$/i.test(d.name)).map((d) => asNorm(d.name))
    );
    const unique = [...haveSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (explicitVariant) {
        const want = parseVariantFolderName(explicitVariant);
        if (want && haveSet.has(want)) {
            return {
                sourceDir: path.join(jobDir, want),
                picked: want,
                requestedExplicit: true,
                hasMultipleVariantDirs: false
            };
        }
        return { sourceDir: jobDir, picked: null, requestedExplicit: true, hasMultipleVariantDirs: false };
    }

    if (unique.length > 0) {
        const pick = unique.includes('v01') ? 'v01' : unique[0];
        return {
            sourceDir: path.join(jobDir, pick),
            picked: pick,
            requestedExplicit: false,
            hasMultipleVariantDirs: unique.length > 1
        };
    }
    return { sourceDir: jobDir, picked: null, requestedExplicit: false, hasMultipleVariantDirs: false };
}

function hasFfmpeg() {
    const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    return r.status === 0;
}

function ffmpegHasLoudnormFilter() {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-h', 'filter=loudnorm'], { encoding: 'utf8' });
    if (r.status === 0) {
        return true;
    }
    const r2 = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
    return /loudnorm/.test(`${r2.stdout || ''}${r2.stderr || ''}`);
}

/**
 * @param {number} dur
 * @param {boolean} loudness
 */
function ffmpegEncodeArgs(dur, loudness) {
    const base = ['-t', String(dur)];
    if (loudness) {
        base.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
    }
    base.push('-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le');
    return base;
}

function main() {
    const { aceOut, jobsFile, dryRun, variant, loudness, picksFile } = parseArgs();
    const durations = loadJobDurations(jobsFile);
    /** Per-job take overrides from pick-ace-takes.py: { picks: { jobId: 'v02' } } or { jobId: 'v02' }. */
    let picks = {};
    if (picksFile) {
        const rawPicks = JSON.parse(fs.readFileSync(path.resolve(repoRoot, picksFile), 'utf8'));
        picks = rawPicks && typeof rawPicks.picks === 'object' ? rawPicks.picks : rawPicks;
    }
    const ffmpegOk = hasFfmpeg();

    if (loudness) {
        if (!ffmpegOk) {
            console.error('install-ace-app-outputs: --loudness requires ffmpeg on PATH.');
            process.exit(1);
        }
        if (!ffmpegHasLoudnormFilter()) {
            console.error(
                'install-ace-app-outputs: this ffmpeg build has no loudnorm filter; build or install full ffmpeg, or run without --loudness.'
            );
            process.exit(1);
        }
    } else if (!ffmpegOk) {
        console.warn('install-ace-app-outputs: ffmpeg not found on PATH; will copy files without trim.');
    }

    let ok = 0;
    let skip = 0;
    let multiVariantNoted = false;

    for (const [jobId, relDest] of Object.entries(JOB_INSTALL_PATHS)) {
        const jobVariant = picks[jobId] ?? variant;
        const { sourceDir, picked, hasMultipleVariantDirs } = resolveSourceDir(aceOut, jobId, jobVariant);
        if (!jobVariant && hasMultipleVariantDirs && !multiVariantNoted) {
            console.warn(
                'install-ace-app-outputs: ACE job folders include multiple v## takes; defaulting to v01. Use --variant <n> to install a different take (e.g. --variant 2 for v02).'
            );
            multiVariantNoted = true;
        }
        const src = newestMediaFile(sourceDir);
        const dest = path.join(repoRoot, relDest);
        const dur = durations[jobId];
        if (!src) {
            const hint = path.relative(repoRoot, sourceDir);
            console.warn(
                `skip ${jobId}: no render in ${hint}${variant ? ` (variant ${variant})` : ''}`
            );
            skip += 1;
            continue;
        }
        if (dur === undefined) {
            console.warn(`skip ${jobId}: no duration in jobs file`);
            skip += 1;
            continue;
        }

        if (dryRun) {
            const vtag = picked ? ` [${picked}]` : '';
            const ltag = loudness ? ' loudnorm' : '';
            console.log(`[dry-run] ${jobId}: ${src} -> ${relDest} (trim ${dur}s)${vtag}${ltag}`);
            ok += 1;
            continue;
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });

        if (ffmpegOk) {
            const r = spawnSync(
                'ffmpeg',
                ['-y', '-i', src, ...ffmpegEncodeArgs(dur, loudness), dest],
                { encoding: 'utf8' }
            );
            if (r.status !== 0) {
                const errText = (r.stderr || r.stdout || '').toLowerCase();
                if (loudness && /loudnorm|no such filter|option not found/.test(errText)) {
                    console.error(
                        `ffmpeg loudnorm failed for ${jobId} (try running without --loudness or upgrade ffmpeg):\n${r.stderr || r.stdout || ''}`
                    );
                } else {
                    console.error(`ffmpeg failed for ${jobId}:\n${r.stderr || r.stdout || ''}`);
                }
                skip += 1;
                continue;
            }
        } else {
            fs.copyFileSync(src, dest);
        }

        console.log('installed', jobId, '->', path.relative(repoRoot, dest));
        ok += 1;
    }

    console.log(`install-ace-app-outputs: ${ok} ok, ${skip} skipped`);
    if (skip > 0) {
        process.exitCode = 1;
    }
}

main();
