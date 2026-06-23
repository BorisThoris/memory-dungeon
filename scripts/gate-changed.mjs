import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GATES = {
    actionLoop: 'yarn gate:action-loop',
    rewardsEconomy: 'yarn gate:rewards-economy',
    navigation: 'yarn gate:navigation',
    systems: 'yarn gate:systems',
    rendererInput:
        'yarn vitest run src/renderer/components/tileBoardDomAccessibility.test.ts src/renderer/components/tileBoardPointerPick.test.ts src/renderer/components/tileBoardWebglBoundary.test.tsx src/renderer/store/useAppStore.test.ts',
    audioFeedback:
        'yarn vitest run src/renderer/audio/audioInteractionCoverage.test.ts src/renderer/hooks/useHudPoliteLiveAnnouncement.test.ts src/renderer/components/GameScreen.test.tsx',
    assetRendering:
        'yarn vitest run src/renderer/cardFace/cardIllustrationDraw.test.ts src/renderer/components/tileTextures.test.ts src/renderer/components/tileBoardReadability.test.ts src/renderer/components/tileBoardRows.test.ts',
    persistence: 'yarn vitest run src/main/persistence.test.ts src/main/persistence-write-error.test.ts && yarn typecheck'
};

const normalize = (file) => file.replaceAll('\\', '/').replace(/^\.\//, '');

const parseArgs = (argv) => {
    const explicitPaths = [];
    let base = null;
    let json = false;
    for (const arg of argv) {
        if (arg === '--json') {
            json = true;
        } else if (arg.startsWith('--base=')) {
            base = arg.slice('--base='.length);
        } else if (arg.trim()) {
            explicitPaths.push(normalize(arg));
        }
    }
    return { base, explicitPaths, json };
};

const changedPathsFromGit = (base) => {
    const args = base ? ['diff', '--name-only', `${base}...HEAD`] : ['diff', '--name-only', 'HEAD'];
    const tracked = execFileSync('git', args, { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);
    return [...tracked, ...untracked].map(normalize);
};

export const selectGatesForChangedPaths = (paths) => {
    const normalized = [...new Set(paths.map(normalize).filter(Boolean))];
    const gateIds = new Set();
    const reasons = [];
    const add = (gateId, file, reason) => {
        gateIds.add(gateId);
        reasons.push({ gateId, file, reason });
    };

    for (const file of normalized) {
        if (file === 'package.json' || file.startsWith('scripts/system-diagrams') || file.startsWith('docs/system-diagrams/')) {
            add('systems', file, 'system diagram, audit registry, or package gate metadata changed');
        }
        if (file.startsWith('src/shared/tile-trait') || file.startsWith('src/shared/board-power') || file.startsWith('src/shared/game') || file.startsWith('src/shared/turn-resolution') || file.startsWith('src/shared/hazard') || file.startsWith('src/shared/enemy')) {
            add('actionLoop', file, 'core turn, trait, hazard, enemy, or board-power rules changed');
        }
        if (file.startsWith('src/shared/board-generation') || file.startsWith('src/shared/board-build') || file.startsWith('src/shared/softlock') || file.startsWith('src/shared/objective-rules')) {
            add('actionLoop', file, 'generation, objective, or softlock rules changed');
        }
        if (file.startsWith('src/shared/bonus-rewards') || file.startsWith('src/shared/shop') || file.startsWith('src/shared/relic') || file.startsWith('src/shared/economy') || file.startsWith('src/shared/run-economy') || file.startsWith('src/shared/balance-simulation')) {
            add('rewardsEconomy', file, 'reward, shop, relic, economy, or balance rules changed');
        }
        if (file.startsWith('src/shared/run-map') || file.startsWith('src/shared/route') || file.startsWith('src/renderer/store/navigationModel') || file.startsWith('src/renderer/components/ChooseYourPath') || file.startsWith('src/renderer/components/SideRoom') || file === 'src/renderer/App.tsx') {
            add('navigation', file, 'route, map, shell, or navigation UI changed');
        }
        if (file.startsWith('src/renderer/components/tileBoard') || file === 'src/renderer/components/TileBoard.tsx' || file.startsWith('src/renderer/store/useAppStore')) {
            add('rendererInput', file, 'tile input, WebGL fallback, pointer, DOM, or store dispatch changed');
        }
        if (file.startsWith('src/renderer/audio/') || file.startsWith('src/renderer/hooks/useHudPoliteLiveAnnouncement') || file.startsWith('src/renderer/components/gameScreenFeedback') || file === 'docs/AUDIO_ASSET_INVENTORY.md') {
            add('audioFeedback', file, 'audio, announcement, or feedback coverage changed');
        }
        if (file.startsWith('src/renderer/cardFace/') || file.startsWith('src/renderer/components/tileTextures') || file === 'src/renderer/components/TileBezel.tsx' || file.startsWith('scripts/build-card-illustration-manifest')) {
            add('assetRendering', file, 'card face, texture, bezel, or asset manifest changed');
        }
        if (file.startsWith('src/main/persistence') || file.startsWith('src/preload/') || file === 'src/shared/contracts.ts') {
            add('persistence', file, 'persistence, preload, or shared contract changed');
        }
    }

    if (gateIds.size === 0 && normalized.length > 0) {
        gateIds.add('systems');
        reasons.push({ gateId: 'systems', file: normalized[0], reason: 'fallback gate for changed files without a narrower mapping' });
    }

    return {
        paths: normalized,
        gates: [...gateIds].map((gateId) => ({ id: gateId, command: GATES[gateId] })),
        reasons
    };
};

const main = () => {
    const { base, explicitPaths, json } = parseArgs(process.argv.slice(2));
    const paths = explicitPaths.length > 0 ? explicitPaths : changedPathsFromGit(base);
    const selection = selectGatesForChangedPaths(paths);
    if (json) {
        process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`);
        return;
    }
    if (selection.paths.length === 0) {
        process.stdout.write('No changed files detected.\n');
        return;
    }
    process.stdout.write(`Changed files: ${selection.paths.length}\n`);
    for (const gate of selection.gates) {
        process.stdout.write(`- ${gate.id}: ${gate.command}\n`);
    }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main();
}
