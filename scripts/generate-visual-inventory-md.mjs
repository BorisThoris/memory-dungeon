/**
 * Walks the configured capture root (<device>/{portrait,landscape}/) for PNGs and writes AUDIT.md + INVENTORY.md.
 * Despite the legacy filename, this indexes the full UI screenshot audit across all screens and devices.
 */
/* eslint-env node */
import process from 'node:process';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const captureRootOverride = process.env.VISUAL_CAPTURE_ROOT?.trim();
const CAPTURE_ROOT = captureRootOverride
    ? resolve(REPO_ROOT, captureRootOverride)
    : join(REPO_ROOT, 'docs', 'visual-capture');
const CAPTURE_ROOT_LABEL = relative(REPO_ROOT, CAPTURE_ROOT).replace(/\\/g, '/') || '.';

const SCENARIO_LABELS = {
    '00-startup-intro': 'Startup relic intro',
    '01-main-menu': 'Main menu',
    '01a-choose-your-path': 'Choose Your Path',
    '01b-collection': 'Collection',
    '01c-inventory-empty': 'Inventory (no active run)',
    '01d-inventory-active': 'Inventory (active run)',
    '01e-codex': 'Codex',
    '02-main-menu-howto': 'Main menu with How To Play',
    '03-settings-page': 'Settings (full page)',
    '04-game-playing': 'Level 1 play (board visible)',
    '05-pause-modal': 'Pause modal',
    '06-run-settings-modal': 'Run settings (in-game modal)',
    '07-floor-cleared-modal': 'Floor cleared modal',
    '08-game-over': 'Game over / Expedition Over'
};

const SEED_IMPROVEMENTS = {
    '00-startup-intro': [
        'Confirm intro is dismissible and focus order makes sense with keyboard.',
        'Check contrast of relic frame and primary CTA against background.'
    ],
    '01-main-menu': [
        'Balance vertical spacing so primary actions stay above the fold on short phones.',
        'Verify stats / last run summary do not crowd touch targets.',
        'Pixi backdrop grid should read as atmosphere, not a literal wire grid (compare `ENDPRODUCTIMAGE2` left panel).'
    ],
    '01a-choose-your-path': [
        'Poster frames vs reference: gradient panels should stay legible behind labels; bump contrast if headlines wash out.',
        'Featured mode glow — ensure selected state stays obvious in bright environments.'
    ],
    '02-main-menu-howto': [
        'Ensure How To Play panel scrolls cleanly and close control is obvious on small widths.'
    ],
    '03-settings-page': [
        'Validate slider hit areas and label alignment in compact density.'
    ],
    '04-game-playing': [
        'Confirm tile board uses playable height; HUD and board should not overlap awkwardly.',
        'Check WebGL vs DOM fallback if `reduceMotion` or WebGL loss differs from this capture.'
    ],
    '05-pause-modal': [
        'Verify focus trap, backdrop click behavior, and resume path.',
        'Modal width and padding on ultra-narrow and landscape phones.'
    ],
    '06-run-settings-modal': [
        'Match typography scale to full Settings where possible; check scroll in modal body.'
    ],
    '07-floor-cleared-modal': [
        'CTA hierarchy (continue vs menu) and safe-area padding on notched devices.'
    ],
    '08-game-over': [
        'Readability of score summary; avoid horizontal scroll; retry/menu balance.'
    ]
};

const RUBRIC = [
    'No unintended horizontal overflow on the document root.',
    'Touch targets ≥ 44px where applicable (coarse pointer layouts).',
    'Text remains legible at this viewport; check line length and heading scale.',
    'Interactive elements have visible focus states (keyboard).',
    'WebGL tile board: silhouette/SMAA acceptable; fallback path if WebGL unavailable.'
];

function isDir(p) {
    try {
        return statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function pngDimensions(filePath) {
    const buf = readFileSync(filePath);
    const png = PNG.sync.read(buf);
    return { height: png.height, width: png.width };
}

function fileBaseFromName(name) {
    return basename(name, '.png');
}

function humanTitle(base) {
    return SCENARIO_LABELS[base] ?? base;
}

function buildAuditMarkdown({ deviceId, orientation, pngFiles, relDir }) {
    const rows = [];
    for (const file of pngFiles) {
        const fp = join(CAPTURE_ROOT, deviceId, orientation, file);
        const base = fileBaseFromName(file);
        let dims = '?×?';
        try {
            const { width, height } = pngDimensions(fp);
            dims = `${width}×${height}`;
        } catch {
            dims = '(unreadable)';
        }
        rows.push(`| \`${file}\` | ${dims} | ${humanTitle(base)} | \`${base}\` |`);
    }

    const sections = [];
    sections.push(`# Visual audit: ${deviceId} / ${orientation}`);
    sections.push('');
    sections.push(`- **Device folder:** \`${deviceId}\``);
    sections.push(`- **Orientation:** ${orientation}`);
    sections.push(`- **Relative path:** \`${relDir}\``);
    sections.push('');
    sections.push('## Screenshots');
    sections.push('');
    if (rows.length === 0) {
        sections.push(
            '_No PNGs yet. Run `yarn capture:ui-audit` or set `VISUAL_CAPTURE_ROOT` to the capture folder you want to index._'
        );
    } else {
        sections.push('| File | Dimensions | Screen | Slug |');
        sections.push('| --- | --- | --- | --- |');
        sections.push(...rows);
    }
    sections.push('');

    for (const file of pngFiles) {
        const base = fileBaseFromName(file);
        const relPng = join(relDir, file).replace(/\\/g, '/');
        sections.push(`### ${humanTitle(base)}`);
        sections.push('');
        sections.push(`![${humanTitle(base)}](${basename(relPng)})`);
        sections.push('');
        sections.push('#### Review checklist');
        sections.push('');
        for (const line of RUBRIC) {
            sections.push(`- [ ] ${line}`);
        }
        sections.push('');
        sections.push('#### Improvement tasks');
        sections.push('');
        sections.push('- [ ] Review this screenshot for visual regressions (spacing, color, clipping).');
        const seeds = SEED_IMPROVEMENTS[base] ?? [];
        for (const s of seeds) {
            sections.push(`- [ ] ${s}`);
        }
        sections.push('');
    }

    if (pngFiles.length === 0) {
        sections.push('## Placeholder checklist');
        sections.push('');
        for (const line of RUBRIC) {
            sections.push(`- [ ] ${line}`);
        }
        sections.push('');
    }

    return sections.join('\n');
}

function listDeviceDirs() {
    if (!isDir(CAPTURE_ROOT)) {
        return [];
    }
    return readdirSync(CAPTURE_ROOT).filter((name) => {
        if (name.startsWith('.') || name === 'README.md' || name === 'INVENTORY.md') {
            return false;
        }
        return isDir(join(CAPTURE_ROOT, name));
    });
}

function main() {
    mkdirSync(CAPTURE_ROOT, { recursive: true });

    const inventoryLinks = [];
    const orientations = ['portrait', 'landscape'];

    for (const deviceId of listDeviceDirs()) {
        for (const orientation of orientations) {
            const dir = join(CAPTURE_ROOT, deviceId, orientation);
            if (!isDir(dir)) {
                continue;
            }
            const pngFiles = readdirSync(dir)
                .filter((f) => f.endsWith('.png'))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const relDir = join(CAPTURE_ROOT_LABEL, deviceId, orientation).replace(/\\/g, '/');
            const md = buildAuditMarkdown({
                deviceId,
                orientation,
                pngFiles,
                relDir
            });
            const auditPath = join(dir, 'AUDIT.md');
            writeFileSync(auditPath, md, 'utf8');
            const linkPath = `./${deviceId}/${orientation}/AUDIT.md`;
            inventoryLinks.push(`- [${deviceId} — ${orientation}](${linkPath})`);
        }
    }

    const inventoryBody = [
        '# Visual capture audit index',
        '',
        `Generated by \`yarn docs:ui-audit\`. Capture PNGs first with \`yarn capture:ui-audit\` or point \`VISUAL_CAPTURE_ROOT\` at an existing capture folder (current root: \`${CAPTURE_ROOT_LABEL}\`).`,
        '',
        '## Audit workbooks',
        '',
        ...(inventoryLinks.length
            ? inventoryLinks
            : [`_No device/orientation folders found under \`${CAPTURE_ROOT_LABEL}/\` yet._`]),
        ''
    ].join('\n');

    writeFileSync(join(CAPTURE_ROOT, 'INVENTORY.md'), inventoryBody, 'utf8');
    process.stdout.write(`Wrote ${join(CAPTURE_ROOT_LABEL, 'INVENTORY.md').replace(/\\/g, '/')}\n`);
    process.stdout.write(`Processed ${inventoryLinks.length} orientation folder(s).\n`);
}

main();
