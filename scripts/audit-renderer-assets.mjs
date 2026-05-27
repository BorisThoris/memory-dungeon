/**
 * Lists renderer asset files under `src/renderer/assets/` that have no obvious
 * reference by basename in `src/`, `scripts/`, `e2e/`, or `public/` (substring match).
 *
 * Dynamic barrels (e.g. generated URL maps) still reference files by basename in TS —
 * those count as referenced. Shelf stock named only in ASSET_SOURCES.md counts as referenced.
 *
 * Browser demo fallback contract:
 * - generated PNG/JPG/WebP background and mode poster art is an enhancement layer;
 *   missing files must resolve to visible inline fallback art, not broken image UI.
 * - generated OGG/WAV/MP3 audio is optional; missing files must resolve to silence
 *   or procedural SFX fallback without repeated console errors.
 * - renderer-only builds must use the local browser fallback client when Electron,
 *   Steam, and desktop save APIs are absent.
 *
 * Exit 1 for broken renderer audio manifests; orphaned assets are informational
 * (manual triage before delete).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ASSET_ROOT = path.join(root, 'src', 'renderer', 'assets');
const RENDERER_SFX_DIR = path.join(ASSET_ROOT, 'audio', 'sfx');
const RENDERER_SFX_MANIFEST = path.join(RENDERER_SFX_DIR, 'manifest.json');
const SEARCH_DIRS = ['src', 'scripts', 'e2e', 'public'];
const TEXT_EXTS = new Set([
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.js',
    '.mjs',
    '.cjs',
    '.css',
    '.scss',
    '.less',
    '.html',
    '.md',
    '.json',
    '.svg',
]);

const SKIP_DIR = new Set(['node_modules', 'dist', 'dist-electron', '.git', '.tsbuild']);

/** Recursive walk of text-ish sources for fallback search (no rg). */
const walkSearchFiles = (dir, acc = []) => {
    if (!fs.existsSync(dir)) {
        return acc;
    }
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (!SKIP_DIR.has(ent.name)) {
                walkSearchFiles(p, acc);
            }
            continue;
        }
        const ext = path.extname(ent.name).toLowerCase();
        if (TEXT_EXTS.has(ext)) {
            acc.push(p);
        }
    }
    return acc;
};

let corpus = null;
const fallbackFindsBasename = (basename) => {
    if (!corpus) {
        corpus = new Map();
        for (const top of SEARCH_DIRS) {
            const baseDir = path.join(root, top);
            for (const file of walkSearchFiles(baseDir)) {
                try {
                    corpus.set(file, fs.readFileSync(file, 'utf8'));
                } catch {
                    /* unreadable — skip */
                }
            }
        }
    }
    const hits = [];
    for (const [file, text] of corpus) {
        if (text.includes(basename)) {
            hits.push(path.relative(root, file).replace(/\\/g, '/'));
        }
    }
    return hits;
};

const rgFindsBasename = (basename) => {
    const r = spawnSync(
        'rg',
        ['-l', '--fixed-strings', '--glob', '!**/node_modules/**', basename, ...SEARCH_DIRS],
        { cwd: root, encoding: 'utf8', shell: false }
    );
    if (r.error && r.error.code === 'ENOENT') {
        return null;
    }
    if (r.status === 0 && r.stdout) {
        return r.stdout
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => line.replace(/\\/g, '/'));
    }
    if (r.status === 1) {
        return [];
    }
    return null;
};

const allAssetPaths = [];
/** @type {Map<string, string[]>} */
const basenamePaths = new Map();

const walkAllAssets = (dir) => {
    if (!fs.existsSync(dir)) {
        return;
    }
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!SKIP_DIR.has(e.name)) {
                walkAllAssets(p);
            }
            continue;
        }
        if (/\.(png|svg|jpe?g|webp|woff2|ogg|wav|mp3)$/i.test(e.name)) {
            allAssetPaths.push(p);
            const rel = path.relative(root, p).replace(/\\/g, '/');
            const arr = basenamePaths.get(e.name) ?? [];
            arr.push(rel);
            basenamePaths.set(e.name, arr);
        }
    }
};
walkAllAssets(ASSET_ROOT);

const duplicateGroups = [...basenamePaths.values()].filter((g) => g.length > 1);
const fatalAssetErrors = [];

const auditRendererSfxManifestFiles = () => {
    if (!fs.existsSync(RENDERER_SFX_MANIFEST)) {
        fatalAssetErrors.push('Renderer SFX manifest is missing: src/renderer/assets/audio/sfx/manifest.json');
        return;
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(RENDERER_SFX_MANIFEST, 'utf8'));
    } catch (error) {
        fatalAssetErrors.push(`Renderer SFX manifest is not valid JSON: ${error.message}`);
        return;
    }

    const entries = manifest?.entries;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
        fatalAssetErrors.push('Renderer SFX manifest must contain an object at entries.');
        return;
    }

    for (const [key, entry] of Object.entries(entries)) {
        const file = entry?.file;
        if (typeof file !== 'string' || file.length === 0) {
            fatalAssetErrors.push(`Renderer SFX manifest key "${key}" is missing a non-empty file field.`);
            continue;
        }
        if (file.includes('/') || file.includes('\\')) {
            fatalAssetErrors.push(`Renderer SFX manifest key "${key}" must use a basename, got "${file}".`);
            continue;
        }
        const abs = path.join(RENDERER_SFX_DIR, file);
        if (!fs.existsSync(abs)) {
            fatalAssetErrors.push(`Renderer SFX manifest key "${key}" points to missing file: ${file}`);
            continue;
        }
        if (!fs.statSync(abs).isFile()) {
            fatalAssetErrors.push(`Renderer SFX manifest key "${key}" does not point to a file: ${file}`);
        }
    }
};

auditRendererSfxManifestFiles();

const orphans = [];

for (const assetAbs of allAssetPaths) {
    const basename = path.basename(assetAbs);
    const selfRel = path.relative(root, assetAbs).replace(/\\/g, '/');

    let hits = rgFindsBasename(basename);
    if (hits === null) {
        hits = fallbackFindsBasename(basename);
    }

    const externalHits = hits.filter((h) => h !== selfRel);

    if (externalHits.length === 0) {
        orphans.push({ path: selfRel, basename });
    }
}

console.log(`Audited ${allAssetPaths.length} asset files under src/renderer/assets/`);
console.log(`Search roots: ${SEARCH_DIRS.join(', ')} (basename substring)\n`);
console.log(
    'Fallback expectations: optional generated art may be absent if UI code supplies visible inline fallbacks; renderer SFX manifest entries must point to existing files even though runtime playback has procedural fallbacks.\n'
);

if (fatalAssetErrors.length > 0) {
    console.error('Fatal renderer asset issues:\n');
    for (const issue of fatalAssetErrors) {
        console.error(`  ${issue}`);
    }
    console.error('');
}

if (duplicateGroups.length > 0) {
    console.log('Duplicate basenames (different paths; substring matches may collide):\n');
    for (const group of duplicateGroups) {
        console.log(`  ${group.join('\n  ')}\n`);
    }
}

if (orphans.length === 0) {
    console.log('No unreferenced candidates (every file basename appears elsewhere under src/scripts/e2e/public).');
    process.exit(fatalAssetErrors.length > 0 ? 1 : 0);
}

console.log(`Candidate orphans (${orphans.length}) — verify manually (docs-only / pipeline / intentional shelf stock):\n`);
for (const { path: p } of orphans.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`  ${p}`);
}

if (fatalAssetErrors.length > 0) {
    process.exit(1);
}
