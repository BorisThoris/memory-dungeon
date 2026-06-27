import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const outDirArg = process.argv[2] ?? 'dist-build';
const outDir = path.resolve(repoRoot, outDirArg);

const kib = 1024;
const mib = 1024 * kib;

const budgets = {
    totalBytes: 16 * mib,
    totalJsBytes: 3450 * kib,
    totalCssBytes: 360 * kib,
    maxAssetBytes: 2000 * kib,
    maxJsChunkBytes: {
        main: 1300 * kib,
        GameScreen: 340 * kib,
        'vendor-three': 780 * kib,
        'vendor-pixi': 880 * kib,
        'vendor-r3f': 190 * kib,
        default: 500 * kib
    }
};

const walkFiles = (dir, acc = []) => {
    if (!fs.existsSync(dir)) {
        return acc;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(absolute, acc);
        } else if (entry.isFile()) {
            acc.push(absolute);
        }
    }
    return acc;
};

const formatBytes = (bytes) => {
    if (bytes >= mib) {
        return `${(bytes / mib).toFixed(2)} MiB`;
    }
    return `${(bytes / kib).toFixed(1)} KiB`;
};

const chunkBudgetFor = (fileName) => {
    for (const [prefix, budget] of Object.entries(budgets.maxJsChunkBytes)) {
        if (prefix !== 'default' && fileName.startsWith(prefix)) {
            return budget;
        }
    }
    return budgets.maxJsChunkBytes.default;
};

if (!fs.existsSync(outDir)) {
    console.error(`Renderer build output not found: ${path.relative(repoRoot, outDir).replace(/\\/g, '/')}`);
    console.error('Run `yarn build:renderer:alt-out` before `yarn audit:bundle`, or pass a build output directory.');
    process.exit(1);
}

const files = walkFiles(outDir).map((absolute) => {
    const rel = path.relative(outDir, absolute).replace(/\\/g, '/');
    const size = fs.statSync(absolute).size;
    return {
        absolute,
        rel,
        name: path.basename(absolute),
        ext: path.extname(absolute).toLowerCase(),
        size
    };
});

const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
const jsFiles = files.filter((file) => file.ext === '.js');
const cssFiles = files.filter((file) => file.ext === '.css');
const totalJsBytes = jsFiles.reduce((sum, file) => sum + file.size, 0);
const totalCssBytes = cssFiles.reduce((sum, file) => sum + file.size, 0);

const issues = [];

if (totalBytes > budgets.totalBytes) {
    issues.push(`total output ${formatBytes(totalBytes)} exceeds ${formatBytes(budgets.totalBytes)}`);
}
if (totalJsBytes > budgets.totalJsBytes) {
    issues.push(`total JS ${formatBytes(totalJsBytes)} exceeds ${formatBytes(budgets.totalJsBytes)}`);
}
if (totalCssBytes > budgets.totalCssBytes) {
    issues.push(`total CSS ${formatBytes(totalCssBytes)} exceeds ${formatBytes(budgets.totalCssBytes)}`);
}

for (const file of jsFiles) {
    const budget = chunkBudgetFor(file.name);
    if (file.size > budget) {
        issues.push(`${file.rel} ${formatBytes(file.size)} exceeds JS chunk budget ${formatBytes(budget)}`);
    }
}

for (const file of files) {
    if (file.rel.startsWith('wip-assets/')) {
        issues.push(`${file.rel} is a design-reference WIP asset and must not ship in renderer output`);
    }
}

for (const file of files) {
    if (file.size > budgets.maxAssetBytes) {
        issues.push(`${file.rel} ${formatBytes(file.size)} exceeds individual asset budget ${formatBytes(budgets.maxAssetBytes)}`);
    }
}

const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 15);

console.log('# Renderer Bundle Budget');
console.log(`output: ${path.relative(repoRoot, outDir).replace(/\\/g, '/')}`);
console.log(`files: ${files.length}`);
console.log(`total: ${formatBytes(totalBytes)} / ${formatBytes(budgets.totalBytes)}`);
console.log(`js: ${formatBytes(totalJsBytes)} / ${formatBytes(budgets.totalJsBytes)}`);
console.log(`css: ${formatBytes(totalCssBytes)} / ${formatBytes(budgets.totalCssBytes)}`);
console.log('');
console.log('Largest files:');
for (const file of largest) {
    console.log(`- ${file.rel}: ${formatBytes(file.size)}`);
}

if (issues.length > 0) {
    console.error('');
    console.error('Bundle budget failed:');
    for (const issue of issues) {
        console.error(`- ${issue}`);
    }
    process.exit(1);
}

console.log('');
console.log('Renderer bundle budget passed.');
