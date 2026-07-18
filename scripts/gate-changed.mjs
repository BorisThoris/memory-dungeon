import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GATES = {
    actionLoop: 'yarn gate:action-loop',
    rewardsEconomy: 'yarn gate:rewards-economy',
    navigation: 'yarn gate:navigation',
    systems: 'yarn gate:systems',
    gameplay: 'yarn gate:gameplay',
    longRun: 'yarn gate:long-run',
    readabilityLongRun: 'yarn gate:readability-long-run',
    longRunUiFeedback: 'yarn gate:long-run-ui-feedback',
    dungeonTopologyAudit: 'yarn audit:dungeon-topology:json',
    simHealth: 'yarn gate:sim-health',
    simSoftlockSeeds: 'yarn gate:sim-softlock-seeds',
    softlockFull: 'yarn gate:softlock-full',
    rendererInput: 'yarn gate:renderer-input',
    audioFeedback: 'yarn gate:audio-feedback',
    assetRendering: 'yarn gate:asset-rendering',
    persistence: 'yarn gate:persistence',
    packageHygiene: 'yarn gate:package-hygiene',
    security: 'yarn gate:security',
    buildOutput: 'yarn gate:build-output',
    desktopBuild: 'yarn gate:desktop-build',
    blueprintE2e: 'yarn test:e2e:blueprint',
    rendererQaLayout: 'yarn test:e2e:renderer-qa:layout',
    rendererQaNavigation: 'yarn test:e2e:renderer-qa:navigation',
    rendererQaInterludes: 'yarn test:e2e:renderer-qa:interludes',
    rendererQa3d: 'yarn test:e2e:renderer-qa:3d'
};

const normalize = (file) => file.replaceAll('\\', '/').replace(/^\.\//, '');
const isVitestTestFile = (file) => /^src\/.*\.test\.tsx?$/u.test(file);

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
    const changedTestFiles = normalized.filter(isVitestTestFile);
    const gateIds = new Set();
    const reasons = [];
    const reasonIds = new Set();
    const add = (gateId, file, reason) => {
        gateIds.add(gateId);
        const reasonId = `${gateId}:${file}:${reason}`;
        if (reasonIds.has(reasonId)) return;
        reasonIds.add(reasonId);
        reasons.push({ gateId, file, reason });
    };
    const isCoreGameRuleFile = (file) =>
        file === 'src/shared/game.ts' ||
        file === 'src/shared/game.test.ts' ||
        file.startsWith('src/shared/game-core') ||
        file.startsWith('src/shared/floor-completion');
    const isSeedSweepContractFile = (file) =>
        file === 'scripts/seed-sweep-options.ts' || file === 'src/shared/seed-sweep-options.test.ts';
    const isLongRunGateContractFile = (file) =>
        file === 'scripts/gate-long-run.ts' ||
        file === 'src/shared/gate-long-run-script.test.ts' ||
        file === 'src/shared/sim-endless-output.test.ts';
    const isFullSoftlockGateFile = (file) =>
        file === 'scripts/gate-softlock-seeds.ts' ||
        file === 'scripts/audit-dungeon-topology.ts' ||
        isSeedSweepContractFile(file) ||
        file.startsWith('src/shared/playthrough-solver') ||
        file.startsWith('src/shared/run-progression-repair') ||
        file.startsWith('src/shared/softlock') ||
        file.startsWith('src/shared/board-generation') ||
        file.startsWith('src/shared/board-build') ||
        file.startsWith('src/shared/board-inspection') ||
        file.startsWith('src/shared/dungeon-topology') ||
        file.startsWith('src/shared/dungeon-board-status') ||
        file.startsWith('src/shared/dungeon-exit') ||
        file.startsWith('src/shared/dungeon-enemy') ||
        file.startsWith('src/shared/enemy-hazard') ||
        file.startsWith('src/shared/floor-mutator-schedule') ||
        file.startsWith('src/shared/run-map') ||
        isCoreGameRuleFile(file);
    const isReadabilityLongRunFile = (file) =>
        file.startsWith('src/shared/long-run-feedback') ||
        file.startsWith('src/shared/findables') ||
        file.startsWith('src/shared/mechanic-feedback');
    const isLongRunUiFeedbackFile = (file) =>
        file.startsWith('src/shared/long-run-feedback') ||
        file.startsWith('src/shared/findables') ||
        file.startsWith('src/shared/mechanics-encyclopedia') ||
        file.startsWith('src/renderer/components/GameplayHudBar') ||
        file.startsWith('src/renderer/hooks/useHudPoliteLiveAnnouncement') ||
        file === 'e2e/long-run-feedback-hud.spec.ts';

    for (const file of normalized) {
        if (isVitestTestFile(file)) {
            add('changedTests', file, 'changed Vitest files should execute directly');
        }
        if (
            file === 'package.json' ||
            file === 'yarn.lock' ||
            file === 'scripts/audit-summary.mjs' ||
            file === 'src/shared/contracts.ts' ||
            file === 'docs/agent/GAMEPLAY_RULES_EDIT_MAP.md' ||
            file.startsWith('scripts/system-diagrams') ||
            file.startsWith('scripts/audit-dungeon-topology') ||
            file.startsWith('scripts/gate-changed') ||
            file.startsWith('docs/system-diagrams/')
        ) {
            add('systems', file, 'system diagram, audit registry, or package gate metadata changed');
        }
        if (
            file === 'package.json' ||
            file === 'vite.config.mts' ||
            file === 'e2e/blueprint-explorer.spec.ts' ||
            file === 'src/renderer/App.tsx' ||
            file.startsWith('src/renderer/dev/BlueprintExplorer') ||
            file.startsWith('scripts/system-diagrams') ||
            file.startsWith('scripts/vite-dev-blueprint-api') ||
            file.startsWith('docs/system-diagrams/')
        ) {
            add('blueprintE2e', file, 'dev blueprint explorer or system diagram browser route changed');
        }
        if (
            file === 'package.json' ||
            file === 'yarn.lock' ||
            file === 'scripts/audit-summary.mjs' ||
            file === 'src/shared/audit-summary-script.test.ts'
        ) {
            add('security', file, 'dependency, lockfile, or audit tooling changed');
        }
        if (
            file === 'package.json' ||
            file === 'yarn.lock' ||
            file === 'knip.json' ||
            file === '.depcheckrc.json' ||
            file === 'scripts/audit-summary.mjs' ||
            file === 'src/shared/check-depcheck-clean-script.test.ts' ||
            file.startsWith('scripts/audit-renderer-assets') ||
            file.startsWith('scripts/check-depcheck-clean') ||
            file.startsWith('scripts/check-test-file-extensions') ||
            file.startsWith('scripts/postinstall')
        ) {
            add('packageHygiene', file, 'dependency, export, unused-file, or package tooling hygiene can change');
        }
        if (
            file === 'package.json' ||
            file === 'tsup.config.ts' ||
            file.startsWith('src/main/') ||
            file.startsWith('src/preload/') ||
            file === 'src/renderer/desktop-client.ts' ||
            file === 'src/renderer/desktop.d.ts' ||
            file.startsWith('src/shared/desktop-api-boundary')
        ) {
            add('desktopBuild', file, 'Electron main, preload, desktop bridge, or package build metadata changed');
        }
        if (
            file === 'package.json' ||
            file === 'vite.config.mts' ||
            file === 'index.html' ||
            file === 'scripts/check-renderer-bundle-budget.mjs' ||
            file === 'src/shared/renderer-bundle-budget-script.test.ts' ||
            file.startsWith('src/renderer/assets/') ||
            file.startsWith('src/renderer/components/') ||
            file.startsWith('src/renderer/hooks/') ||
            file.startsWith('src/renderer/store/') ||
            file.startsWith('src/renderer/styles/') ||
            file.startsWith('src/renderer/cardFace/')
        ) {
            add('buildOutput', file, 'renderer build output, assets, or bundle budget can change');
        }
        if (
            file === 'scripts/sim-endless.ts' ||
            isLongRunGateContractFile(file) ||
            isSeedSweepContractFile(file) ||
            file.startsWith('src/shared/long-run-depth') ||
            file.startsWith('src/shared/boss-encounters') ||
            file.startsWith('src/shared/run-map') ||
            file.startsWith('src/shared/route') ||
            file.startsWith('src/shared/relic') ||
            file.startsWith('src/shared/balance-simulation') ||
            file.startsWith('src/shared/economy-ledger') ||
            file.startsWith('src/shared/floor-mutator-schedule') ||
            file === 'src/shared/contracts.ts'
        ) {
            add('longRun', file, 'long-run route pacing, relic, economy, or balance soak can change');
        }
        if (file === 'src/shared/p2-contracts.test.ts') {
            add('gameplay', file, 'broad gameplay contract coverage changed');
        }
        if (isReadabilityLongRunFile(file)) {
            add('readabilityLongRun', file, 'long-run readability or mechanic feedback can change');
        }
        if (isLongRunUiFeedbackFile(file)) {
            add('longRunUiFeedback', file, 'long-run HUD feedback or announcement coverage can change');
        }
        if (
            file === 'scripts/sim-endless.ts' ||
            file === 'scripts/gate-softlock-seeds.ts' ||
            file === 'scripts/audit-dungeon-topology.ts' ||
            isSeedSweepContractFile(file) ||
            file.startsWith('src/shared/floor-mutator-schedule') ||
            file.startsWith('src/shared/board-generation') ||
            file.startsWith('src/shared/board-build') ||
            file.startsWith('src/shared/board-inspection') ||
            file.startsWith('src/shared/dungeon-topology') ||
            file.startsWith('src/shared/board-tile-generation-rules') ||
            file.startsWith('src/shared/dungeon-board-status') ||
            file.startsWith('src/shared/tile-trait') ||
            file.startsWith('src/shared/bonus-rewards') ||
            file.startsWith('src/shared/findables') ||
            file.startsWith('src/shared/objective-rules') ||
            file.startsWith('src/shared/playthrough-solver') ||
            file.startsWith('src/shared/run-progression-repair') ||
            file === 'src/shared/contracts.ts'
        ) {
            add('simHealth', file, 'endless route, reward, trait, objective, or generation health can change');
        }
        if (
            file === 'scripts/audit-dungeon-topology.ts' ||
            isSeedSweepContractFile(file) ||
            file.startsWith('src/shared/dungeon-topology') ||
            file.startsWith('src/shared/board-generation') ||
            file.startsWith('src/shared/board-build') ||
            file.startsWith('src/shared/board-inspection') ||
            file.startsWith('src/shared/dungeon-board-status') ||
            file.startsWith('src/shared/dungeon-exit') ||
            file.startsWith('src/shared/dungeon-enemy') ||
            file.startsWith('src/shared/enemy-hazard') ||
            file.startsWith('src/shared/floor-mutator-schedule') ||
            file.startsWith('src/shared/run-map') ||
            isCoreGameRuleFile(file)
        ) {
            add('dungeonTopologyAudit', file, 'graph-backed board or route topology diagnostics can change');
        }
        if (isFullSoftlockGateFile(file)) {
            add('softlockFull', file, 'combined topology and executable softlock stress can expose rare progression interactions');
        }
        if (
            file === 'scripts/sim-endless.ts' ||
            file === 'scripts/gate-softlock-seeds.ts' ||
            file === 'scripts/audit-dungeon-topology.ts' ||
            isSeedSweepContractFile(file) ||
            file.startsWith('src/shared/playthrough-solver') ||
            file.startsWith('src/shared/run-progression-repair') ||
            file.startsWith('src/shared/softlock') ||
            file.startsWith('src/shared/board-generation') ||
            file.startsWith('src/shared/board-build') ||
            file.startsWith('src/shared/board-inspection') ||
            file.startsWith('src/shared/dungeon-topology') ||
            file.startsWith('src/shared/dungeon-board-status') ||
            file.startsWith('src/shared/dungeon-exit') ||
            file.startsWith('src/shared/dungeon-enemy') ||
            file.startsWith('src/shared/enemy-hazard') ||
            file.startsWith('src/shared/run-map') ||
            isCoreGameRuleFile(file)
        ) {
            add('simSoftlockSeeds', file, 'multi-seed executable softlock coverage can change');
        }
        if (file.startsWith('src/shared/tile-trait') || file.startsWith('src/shared/board-power') || isCoreGameRuleFile(file) || file.startsWith('src/shared/playthrough-solver') || file.startsWith('src/shared/run-progression-repair') || file.startsWith('src/shared/turn-resolution') || file.startsWith('src/shared/hazard') || file.startsWith('src/shared/enemy')) {
            add('actionLoop', file, 'core turn, trait, hazard, enemy, or board-power rules changed');
        }
        if (file.startsWith('src/shared/board-generation') || file.startsWith('src/shared/board-build') || file.startsWith('src/shared/board-inspection') || file.startsWith('src/shared/dungeon-topology') || file.startsWith('src/shared/dungeon-board-status') || file.startsWith('src/shared/softlock') || file.startsWith('src/shared/objective-rules')) {
            add('actionLoop', file, 'generation, objective, fairness, or softlock rules changed');
        }
        if (file.startsWith('src/shared/bonus-rewards') || file.startsWith('src/shared/shop') || file.startsWith('src/shared/relic') || file.startsWith('src/shared/economy') || file.startsWith('src/shared/run-economy') || file.startsWith('src/shared/balance-simulation')) {
            add('rewardsEconomy', file, 'reward, shop, relic, economy, or balance rules changed');
        }
        if (file.startsWith('src/shared/run-map') || file.startsWith('src/shared/route') || file.startsWith('src/renderer/store/navigationModel') || file.startsWith('src/renderer/components/ChooseYourPath') || file.startsWith('src/renderer/components/SideRoom') || file === 'src/renderer/App.tsx') {
            add('navigation', file, 'route, map, shell, or navigation UI changed');
        }
        if (
            file === 'e2e/mobile-layout.spec.ts' ||
            file === 'e2e/gameplay-readability.spec.ts' ||
            file === 'e2e/long-run-feedback-hud.spec.ts' ||
            file.startsWith('src/renderer/components/GameplayHud') ||
            file === 'src/renderer/components/GameScreen.tsx' ||
            file === 'src/renderer/components/GameScreen.module.css'
        ) {
            add('rendererQaLayout', file, 'live renderer layout, HUD bounds, or mobile viewport coverage can change');
        }
        if (
            file === 'e2e/navigation-flow.spec.ts' ||
            file === 'e2e/playable-path-navigation.spec.ts' ||
            file === 'e2e/playable-path-mode-matrix.spec.ts' ||
            file.startsWith('src/shared/run-map') ||
            file.startsWith('src/shared/route') ||
            file.startsWith('src/renderer/store/navigationModel') ||
            file.startsWith('src/renderer/components/ChooseYourPath') ||
            file === 'src/renderer/components/MainMenu.tsx' ||
            file === 'src/renderer/App.tsx'
        ) {
            add('rendererQaNavigation', file, 'live renderer shell navigation, playable-path navigation, or mode start coverage can change');
        }
        if (
            file === 'e2e/playable-path-interludes.spec.ts' ||
            file === 'e2e/scholar-contract.spec.ts' ||
            file === 'e2e/wild-run.spec.ts' ||
            file.startsWith('src/renderer/components/ShopScreen') ||
            file.startsWith('src/renderer/components/SideRoom') ||
            file.startsWith('src/renderer/components/RelicDraftOffer') ||
            file.startsWith('src/shared/shop') ||
            file.startsWith('src/shared/relic') ||
            file.startsWith('src/shared/route-side-room')
        ) {
            add('rendererQaInterludes', file, 'live renderer shop, route interlude, relic, Scholar, or Wild coverage can change');
        }
        if (
            file === 'e2e/dungeon-board-3d-value.spec.ts' ||
            file === 'e2e/tile-card-face-dom.spec.ts' ||
            file === 'e2e/tile-card-face-webgl.spec.ts' ||
            file === 'e2e/tile-board-raycast.spec.ts' ||
            file.startsWith('src/renderer/components/tileBoard') ||
            file === 'src/renderer/components/TileBoard.tsx' ||
            file === 'src/renderer/components/TileBoardScene.tsx' ||
            file.startsWith('src/renderer/cardFace/') ||
            file.startsWith('src/renderer/components/tileTextures')
        ) {
            add('rendererQa3d', file, 'live 3D board, WebGL recovery, tile face, or raycast coverage can change');
        }
        if (file.startsWith('src/renderer/components/tileBoard') || file === 'src/renderer/components/TileBoard.tsx' || file.startsWith('src/renderer/store/levelCompleteSurfaceState') || file.startsWith('src/renderer/store/runResolutionController') || file.startsWith('src/renderer/store/useAppStore')) {
            add('rendererInput', file, 'tile input, WebGL fallback, pointer, DOM, or store dispatch changed');
        }
        if (
            file.startsWith('src/renderer/audio/') ||
            file.startsWith('src/renderer/assets/audio/') ||
            file === 'scripts/audio-pipeline/export-runtime-ogg.mjs' ||
            file === 'scripts/audio-pipeline/generate-portfolio-feedback-pack.mjs' ||
            file.startsWith('src/renderer/hooks/useHudPoliteLiveAnnouncement') ||
            file.startsWith('src/renderer/components/gameScreenFeedback') ||
            file === 'src/renderer/components/GameScreen.tsx' ||
            file === 'src/renderer/components/GameScreen.test.tsx' ||
            file === 'docs/AUDIO_ASSET_INVENTORY.md' ||
            file === 'docs/AUDIO_INTEGRATION.md'
        ) {
            add('audioFeedback', file, 'audio, announcement, or feedback coverage changed');
        }
        if (file.startsWith('src/renderer/cardFace/') || file.startsWith('src/renderer/components/tileTextures') || file.startsWith('src/renderer/components/tileBoardReadability') || file.startsWith('src/renderer/components/tileBoardRows') || file === 'src/renderer/components/TileBezel.tsx' || file.startsWith('scripts/build-card-illustration-manifest') || file === 'scripts/card-pipeline/export-face-panel-webp.mjs' || file === 'scripts/card-pipeline/export-ui-background-webp.mjs' || file === 'scripts/card-pipeline/export-card-normal-webp.mjs' || file === 'scripts/audit-renderer-assets.mjs') {
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
        gates: [...gateIds].map((gateId) => ({
            id: gateId,
            command:
                gateId === 'changedTests'
                    ? `yarn vitest run ${changedTestFiles.map((file) => JSON.stringify(file)).join(' ')} --maxWorkers=2`
                    : GATES[gateId]
        })),
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
