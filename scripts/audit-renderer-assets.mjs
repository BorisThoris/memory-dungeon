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
 * Reports two kinds of stranded art: files no search hit at all, and files every hit of which is a
 * comment or a doc — the second kind is how finished art ships unseen, because a substring search
 * counts the comment that describes a plate as a reference to it.
 *
 * Exit 1 for broken renderer audio manifests; stranded art is informational
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
const RENDERER_UI_AUDIO_DIR = path.join(ASSET_ROOT, 'audio', 'ui');
const RENDERER_UI_AUDIO_MANIFEST = path.join(RENDERER_UI_AUDIO_DIR, 'manifest.json');
const SEARCH_DIRS = ['src', 'scripts', 'e2e', 'public'];
const SHELF_STOCK_DIRS = new Set([
    'src/renderer/assets/audio/dont_modify'
]);
const isRuntimeSourceMasterAsset = (rel) =>
    (rel.startsWith('src/renderer/assets/ui/backgrounds/') && rel.toLowerCase().endsWith('.png')) ||
    (rel.startsWith('src/renderer/assets/ui/sprites/') && rel.toLowerCase().endsWith('.png')) ||
    rel === 'src/renderer/assets/textures/cards/back-normal.png' ||
    rel === 'src/renderer/assets/textures/cards/front-normal.png' ||
    // The painted card plates: the WebP beside each one is what the game loads.
    rel === 'src/renderer/assets/textures/cards/front-face.png' ||
    rel === 'src/renderer/assets/textures/cards/reference-back.png';
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
            const rel = path.relative(root, p).replace(/\\/g, '/');
            if ([...SHELF_STOCK_DIRS].some((prefix) => rel.startsWith(`${prefix}/`)) || isRuntimeSourceMasterAsset(rel)) {
                continue;
            }
            allAssetPaths.push(p);
            const arr = basenamePaths.get(e.name) ?? [];
            arr.push(rel);
            basenamePaths.set(e.name, arr);
        }
    }
};
walkAllAssets(ASSET_ROOT);

const duplicateGroups = [...basenamePaths.values()].filter((g) => g.length > 1);
const fatalAssetErrors = [];

const auditRendererAudioManifestFiles = ({ label, manifestPath, assetDir, requireOgg }) => {
    const manifestRel = path.relative(root, manifestPath).replace(/\\/g, '/');
    if (!fs.existsSync(manifestPath)) {
        fatalAssetErrors.push(`${label} manifest is missing: ${manifestRel}`);
        return;
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (error) {
        fatalAssetErrors.push(`${label} manifest is not valid JSON: ${error.message}`);
        return;
    }

    const entries = manifest?.entries;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
        fatalAssetErrors.push(`${label} manifest must contain an object at entries.`);
        return;
    }

    for (const [key, entry] of Object.entries(entries)) {
        const file = entry?.file;
        if (typeof file !== 'string' || file.length === 0) {
            fatalAssetErrors.push(`${label} manifest key "${key}" is missing a non-empty file field.`);
            continue;
        }
        if (file.includes('/') || file.includes('\\')) {
            fatalAssetErrors.push(`${label} manifest key "${key}" must use a basename, got "${file}".`);
            continue;
        }
        if (requireOgg && !file.toLowerCase().endsWith('.ogg')) {
            fatalAssetErrors.push(`${label} manifest key "${key}" must point at a runtime OGG file, got "${file}".`);
            continue;
        }
        const abs = path.join(assetDir, file);
        if (!fs.existsSync(abs)) {
            fatalAssetErrors.push(`${label} manifest key "${key}" points to missing file: ${file}`);
            continue;
        }
        if (!fs.statSync(abs).isFile()) {
            fatalAssetErrors.push(`${label} manifest key "${key}" does not point to a file: ${file}`);
        }
    }
};

auditRendererAudioManifestFiles({
    label: 'Renderer SFX',
    manifestPath: RENDERER_SFX_MANIFEST,
    assetDir: RENDERER_SFX_DIR,
    requireOgg: true
});
auditRendererAudioManifestFiles({
    label: 'Renderer UI audio',
    manifestPath: RENDERER_UI_AUDIO_MANIFEST,
    assetDir: RENDERER_UI_AUDIO_DIR,
    requireOgg: true
});

const orphans = [];
const talkedAboutOnly = [];

/**
 * Whether a file reaches this asset at runtime, rather than only mentioning it.
 *
 * A basename in a comment, a doc or a pipeline script is a *mention*: it explains the art, it does
 * not load it. Three pieces of finished art shipped in this repo unseen behind exactly that —
 * eighty painted card panels and both painted card plates were named in comments while the code
 * loaded placeholders — and a substring search called every one of them referenced.
 *
 * A reference is an import, a URL string or a manifest entry: the basename inside quotes, or on an
 * import line. Anything else is a mention, and a file that is only ever mentioned is art nobody
 * can see.
 */
const referencesAsset = (text, basename) => {
    const escaped = basename.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const quoted = new RegExp(`['\`"][^'\`"\n]*${escaped}`, 'u');
    for (const rawLine of text.split('\n')) {
        if (!rawLine.includes(basename)) {
            continue;
        }
        const line = rawLine.trim();
        // A line that is only a comment can never load anything.
        if (line.startsWith('*') || line.startsWith('//') || line.startsWith('<!--')) {
            continue;
        }
        if (quoted.test(rawLine) || /^\s*import\s/u.test(rawLine)) {
            return true;
        }
    }
    return false;
};

const readSearchFile = (rel) => {
    try {
        return fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
        return '';
    }
};

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
        continue;
    }

    // Markdown is documentation by definition; a `.md` hit is always a mention.
    const loaders = externalHits.filter(
        (hit) => !hit.toLowerCase().endsWith('.md') && referencesAsset(readSearchFile(hit), basename)
    );
    if (loaders.length === 0) {
        talkedAboutOnly.push({ path: selfRel, mentionedBy: externalHits.slice(0, 3) });
    }
}

console.log(`Audited ${allAssetPaths.length} asset files under src/renderer/assets/`);
console.log(`Search roots: ${SEARCH_DIRS.join(', ')} (basename substring)\n`);
console.log(
    `Fallback expectations: optional generated art may be absent if UI code supplies visible inline fallbacks; renderer audio manifest entries must point to existing OGG files even though runtime playback has procedural fallbacks. Intentional pipeline reference packs and runtime source masters are skipped: ${[...SHELF_STOCK_DIRS].join(', ')}, src/renderer/assets/ui/backgrounds/*.png, src/renderer/assets/ui/sprites/*.png, card normal-map PNG masters.\n`
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

if (talkedAboutOnly.length > 0) {
    console.log(
        `Art that is only talked about (${talkedAboutOnly.length}) — every hit is a comment or a doc, so nothing loads it:\n`
    );
    for (const { path: p, mentionedBy } of talkedAboutOnly.sort((a, b) => a.path.localeCompare(b.path))) {
        console.log(`  ${p}\n      mentioned by: ${mentionedBy.join(', ')}`);
    }
    console.log('');
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
