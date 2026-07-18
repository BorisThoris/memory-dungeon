import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type GateChangedPayload = {
    paths: string[];
    gates: { id: string; command: string }[];
    reasons: { gateId: string; file: string; reason: string }[];
};

type GateChangedModule = {
    selectGatesForChangedPaths: (paths: readonly string[]) => GateChangedPayload;
};

const scriptPath = path.join(process.cwd(), 'scripts', 'gate-changed.mjs');
const packageScripts = (
    JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
    }
).scripts;

const loadGateChanged = async (): Promise<GateChangedModule> => {
    // @ts-expect-error scripts are runtime ESM modules without generated TypeScript declarations.
    return (await import('../../scripts/gate-changed.mjs')) as GateChangedModule;
};

const referencedPackageScripts = (command: string): string[] =>
    [...command.matchAll(/(?:^|\s)yarn\s+([\w:-]+)/gu)].map((match) => match[1]);

const packageScriptClosure = (scriptName: string, visited = new Set<string>()): Set<string> => {
    if (visited.has(scriptName) || packageScripts[scriptName] == null) {
        return visited;
    }
    visited.add(scriptName);
    for (const referencedScript of referencedPackageScripts(packageScripts[scriptName])) {
        packageScriptClosure(referencedScript, visited);
    }
    return visited;
};

const testFilesRunByPackageScript = (scriptName: string): string[] =>
    [...packageScriptClosure(scriptName)].flatMap(
        (referencedScript) => packageScripts[referencedScript]?.match(/src\/[^\s"']+\.test\.tsx?/gu) ?? []
    );

const runGateChanged = (...paths: string[]): GateChangedPayload =>
    JSON.parse(
        execFileSync(process.execPath, [scriptPath, '--json', ...paths], {
            cwd: process.cwd(),
            encoding: 'utf8'
        })
    ) as GateChangedPayload;

describe('gate:changed selector', () => {
    it('selects focused gameplay, reward, navigation, and system gates for changed files', () => {
        const payload = runGateChanged(
            'src/shared/tile-trait-rules.ts',
            'src/shared/shop-rules.ts',
            'src/shared/run-map.ts',
            'docs/system-diagrams/actions.json'
        );

        expect(payload.gates.map((gate) => gate.id)).toEqual(
            expect.arrayContaining([
                'actionLoop',
                'rewardsEconomy',
                'navigation',
                'systems',
                'simHealth',
                'simSoftlockSeeds',
                'softlockFull',
                'longRun'
            ])
        );
        expect(payload.gates.find((gate) => gate.id === 'actionLoop')?.command).toBe('yarn gate:action-loop');
        expect(payload.gates.find((gate) => gate.id === 'simHealth')?.command).toBe('yarn gate:sim-health');
        expect(payload.gates.find((gate) => gate.id === 'longRun')?.command).toBe('yarn gate:long-run');
        expect(payload.reasons.some((reason) => reason.file === 'docs/system-diagrams/actions.json')).toBe(true);
    });

    it('selects the long-run soak gate for pacing, relic, and balance changes', () => {
        const payload = runGateChanged(
            'scripts/gate-long-run.ts',
            'src/shared/long-run-depth.ts',
            'src/shared/boss-encounters.ts',
            'src/shared/relics.ts',
            'src/shared/balance-simulation.ts'
        );

        expect(payload.gates).toEqual(expect.arrayContaining([{ id: 'longRun', command: 'yarn gate:long-run' }]));
        expect(payload.reasons.filter((reason) => reason.gateId === 'longRun')).toHaveLength(5);
    });

    it('routes long-run CLI contract tests back through the long-run gate', () => {
        const payload = runGateChanged(
            'src/shared/gate-long-run-script.test.ts',
            'src/shared/sim-endless-output.test.ts'
        );

        expect(payload.gates).toEqual([{ id: 'longRun', command: 'yarn gate:long-run' }]);
        expect(payload.reasons.filter((reason) => reason.gateId === 'longRun')).toHaveLength(2);
    });

    it('keeps selector and simulation contract tests wired into their selected gates', () => {
        expect(packageScripts['gate:systems']).toContain('src/shared/gate-changed.test.ts');
        expect(packageScripts['gate:long-run']).toContain('src/shared/gate-long-run-script.test.ts');
        expect(packageScripts['gate:long-run']).toContain('src/shared/seed-sweep-options.test.ts');
        expect(packageScripts['gate:long-run']).toContain('src/shared/sim-endless-output.test.ts');
        expect(packageScripts['gate:gameplay']).toContain('yarn test --maxWorkers=2');
        expect(packageScripts['gate:long-run']).toContain('--maxWorkers=1');
        expect(packageScripts['gate:readability-long-run']).toContain('--maxWorkers=2');
        expect(packageScripts['gate:long-run-ui-feedback']).toContain('--maxWorkers=2');
    });

    it('routes every explicitly gated test to a selected gate that executes it', async () => {
        const { selectGatesForChangedPaths } = await loadGateChanged();
        const gateScriptNames = Object.keys(packageScripts).filter((scriptName) => scriptName.startsWith('gate:'));
        const explicitlyGatedTests = [...new Set(gateScriptNames.flatMap(testFilesRunByPackageScript))].sort();
        const uncovered = explicitlyGatedTests.flatMap((file) => {
            const selectedGates = selectGatesForChangedPaths([file]).gates;
            const reachesTest = selectedGates.some(({ command }) => {
                const selectedScript = command.match(/^yarn\s+([\w:-]+)$/u)?.[1];
                return selectedScript != null && testFilesRunByPackageScript(selectedScript).includes(file);
            });
            return reachesTest ? [] : [{ file, selectedGateIds: selectedGates.map(({ id }) => id) }];
        });

        expect(explicitlyGatedTests.length).toBeGreaterThan(60);
        expect(uncovered).toEqual([]);
    });

    it('selects every dependent simulation gate for the shared seed sweep contract', () => {
        const payload = runGateChanged('scripts/seed-sweep-options.ts');

        expect(payload.gates.map((gate) => gate.id)).toEqual(
            expect.arrayContaining([
                'longRun',
                'dungeonTopologyAudit',
                'simHealth',
                'simSoftlockSeeds',
                'softlockFull'
            ])
        );
        expect(payload.reasons.every((reason) => reason.file === 'scripts/seed-sweep-options.ts')).toBe(true);
    });

    it('selects the blueprint browser smoke for system diagram explorer changes', () => {
        const payload = runGateChanged(
            'scripts/system-diagrams.mjs',
            'scripts/vite-dev-blueprint-api.mjs',
            'src/renderer/dev/BlueprintExplorer.tsx',
            'e2e/blueprint-explorer.spec.ts'
        );

        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'blueprintE2e', command: 'yarn test:e2e:blueprint' }])
        );
        expect(payload.reasons.filter((reason) => reason.gateId === 'blueprintE2e')).toHaveLength(4);
    });

    it('selects the security gate for dependency and audit tooling changes', () => {
        const payload = runGateChanged('package.json', 'yarn.lock', 'scripts/audit-summary.mjs');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(
            expect.arrayContaining(['security', 'packageHygiene', 'systems', 'buildOutput', 'desktopBuild', 'blueprintE2e'])
        );
        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'security', command: 'yarn gate:security' }])
        );
        expect(payload.reasons.filter((reason) => reason.gateId === 'security')).toHaveLength(3);
    });

    it('selects package hygiene for dependency and unused-export tooling changes', () => {
        const payload = runGateChanged(
            'package.json',
            'knip.json',
            '.depcheckrc.json',
            'scripts/check-depcheck-clean.mjs',
            'src/shared/check-depcheck-clean-script.test.ts'
        );

        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'packageHygiene', command: 'yarn gate:package-hygiene' }])
        );
        expect(payload.reasons.filter((reason) => reason.gateId === 'packageHygiene')).toHaveLength(5);
    });

    it('selects the desktop build gate for Electron shell and bridge changes', () => {
        const payload = runGateChanged(
            'tsup.config.ts',
            'src/main/index.ts',
            'src/preload/index.ts',
            'src/renderer/desktop-client.ts',
            'src/shared/desktop-api-boundary.ts'
        );

        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'desktopBuild', command: 'yarn gate:desktop-build' }])
        );
        expect(payload.reasons.filter((reason) => reason.gateId === 'desktopBuild')).toHaveLength(5);
    });

    it('selects the build output gate for renderer build and bundle budget changes', () => {
        const payload = runGateChanged(
            'vite.config.mts',
            'scripts/check-renderer-bundle-budget.mjs',
            'src/shared/renderer-bundle-budget-script.test.ts',
            'src/renderer/assets/bg-main-menu-cathedral-v1.png'
        );

        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'buildOutput', command: 'yarn gate:build-output' }])
        );
        expect(payload.reasons.filter((reason) => reason.gateId === 'buildOutput')).toHaveLength(4);
    });

    it('selects sim health for endless schedule, generation, trait, reward, and contract changes', () => {
        const payload = runGateChanged(
            'scripts/sim-endless.ts',
            'src/shared/floor-mutator-schedule.ts',
            'src/shared/board-generation.ts',
            'src/shared/bonus-rewards.ts',
            'src/shared/playthrough-solver.ts',
            'src/shared/contracts.ts'
        );

        expect(payload.gates.map((gate) => gate.id)).toContain('simHealth');
        expect(payload.gates.map((gate) => gate.id)).toContain('simSoftlockSeeds');
        expect(payload.gates.map((gate) => gate.id)).toContain('dungeonTopologyAudit');
        expect(payload.gates.map((gate) => gate.id)).toContain('softlockFull');
        expect(payload.gates.map((gate) => gate.id)).toContain('actionLoop');
        expect(payload.gates.map((gate) => gate.id)).toContain('systems');
        expect(payload.gates.find((gate) => gate.id === 'simSoftlockSeeds')?.command).toBe(
            'yarn gate:sim-softlock-seeds'
        );
        expect(payload.reasons.filter((reason) => reason.gateId === 'simHealth')).toHaveLength(6);
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'actionLoop' && reason.file === 'src/shared/playthrough-solver.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/playthrough-solver.ts'
            )
        ).toBe(true);
    });

    it('selects the multi-seed softlock gate for dungeon exit rule changes', () => {
        const payload = runGateChanged('src/shared/dungeon-exit-rules.ts');

        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'simSoftlockSeeds', command: 'yarn gate:sim-softlock-seeds' }])
        );
        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'softlockFull', command: 'yarn gate:softlock-full' }])
        );
        expect(payload.gates).toEqual(
            expect.arrayContaining([{ id: 'dungeonTopologyAudit', command: 'yarn audit:dungeon-topology:json' }])
        );
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/dungeon-exit-rules.ts'
            )
        ).toBe(true);
    });

    it('selects route softlock stress for run map changes', () => {
        const payload = runGateChanged('src/shared/run-map.ts');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(
            expect.arrayContaining([
                'longRun',
                'navigation',
                'dungeonTopologyAudit',
                'simSoftlockSeeds',
                'softlockFull'
            ])
        );
        expect(payload.gates).toEqual(
            expect.arrayContaining([
                { id: 'longRun', command: 'yarn gate:long-run' },
                { id: 'softlockFull', command: 'yarn gate:softlock-full' }
            ])
        );
    });

    it('selects expensive softlock gates for fairness inspector and dungeon status changes', () => {
        const payload = runGateChanged('src/shared/board-inspection.ts', 'src/shared/dungeon-board-status.ts');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(
            expect.arrayContaining([
                'actionLoop',
                'simHealth',
                'simSoftlockSeeds',
                'dungeonTopologyAudit',
                'softlockFull'
            ])
        );
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/board-inspection.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/dungeon-board-status.ts'
            )
        ).toBe(true);
    });

    it('selects full softlock stress for every boundary path in isolation', async () => {
        const { selectGatesForChangedPaths } = await loadGateChanged();
        const boundaryPaths = [
            'scripts/gate-softlock-seeds.ts',
            'scripts/audit-dungeon-topology.ts',
            'scripts/seed-sweep-options.ts',
            'src/shared/playthrough-solver.ts',
            'src/shared/run-progression-repair.ts',
            'src/shared/softlock-fairness.ts',
            'src/shared/board-generation.ts',
            'src/shared/board-build-rules.ts',
            'src/shared/board-inspection.ts',
            'src/shared/dungeon-topology.ts',
            'src/shared/dungeon-board-status.ts',
            'src/shared/dungeon-exit-rules.ts',
            'src/shared/dungeon-enemy-hazard-rules.ts',
            'src/shared/enemy-hazard-board-rules.ts',
            'src/shared/floor-mutator-schedule.ts',
            'src/shared/run-map.ts',
            'src/shared/game.ts'
        ];

        for (const file of boundaryPaths) {
            const payload = selectGatesForChangedPaths([file]);
            expect(payload.gates.map((gate) => gate.id), file).toContain('softlockFull');
            expect(
                payload.reasons.some((reason) => reason.gateId === 'softlockFull' && reason.file === file),
                file
            ).toBe(true);
        }
    });

    it('selects expensive softlock gates for dungeon topology graph changes', () => {
        const payload = runGateChanged('src/shared/dungeon-topology.ts');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(
            expect.arrayContaining([
                'actionLoop',
                'simHealth',
                'simSoftlockSeeds',
                'dungeonTopologyAudit',
                'softlockFull'
            ])
        );
        expect(payload.gates).toEqual(
            expect.arrayContaining([
                { id: 'dungeonTopologyAudit', command: 'yarn audit:dungeon-topology:json' },
                { id: 'softlockFull', command: 'yarn gate:softlock-full' }
            ])
        );
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/dungeon-topology.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'softlockFull' && reason.file === 'src/shared/dungeon-topology.ts'
            )
        ).toBe(true);
    });

    it('selects expensive softlock gates for dungeon topology audit script changes', () => {
        const payload = runGateChanged('scripts/audit-dungeon-topology.ts');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(
            expect.arrayContaining([
                'systems',
                'simHealth',
                'simSoftlockSeeds',
                'dungeonTopologyAudit',
                'softlockFull'
            ])
        );
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'scripts/audit-dungeon-topology.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'dungeonTopologyAudit' && reason.file === 'scripts/audit-dungeon-topology.ts'
            )
        ).toBe(true);
    });

    it('selects expensive softlock gates for runtime progression repair changes', () => {
        const payload = runGateChanged('src/shared/run-progression-repair.ts');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(expect.arrayContaining(['actionLoop', 'simHealth', 'simSoftlockSeeds', 'softlockFull']));
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/run-progression-repair.ts'
            )
        ).toBe(true);
    });

    it('keeps core game rules on expensive gates without matching gameplay support files', () => {
        const corePayload = runGateChanged('src/shared/game.ts');
        expect(corePayload.gates.map((gate) => gate.id)).toEqual(
            expect.arrayContaining(['actionLoop', 'simSoftlockSeeds', 'softlockFull'])
        );

        const supportPayload = runGateChanged('src/shared/gameplay-rules-edit-map.test.ts');
        expect(supportPayload.gates.map((gate) => gate.id)).not.toContain('actionLoop');
        expect(supportPayload.gates.map((gate) => gate.id)).not.toContain('simSoftlockSeeds');
        expect(supportPayload.gates).toEqual([{ id: 'systems', command: 'yarn gate:systems' }]);
    });

    it('selects renderer, audio, asset, and persistence focused gates', () => {
        const payload = runGateChanged(
            'src/renderer/components/tileBoardPointerPick.ts',
            'src/renderer/store/levelCompleteSurfaceState.ts',
            'src/renderer/store/runResolutionController.ts',
            'src/renderer/audio/uiSfx.ts',
            'src/renderer/assets/audio/music/menu-loop.ogg',
            'scripts/audio-pipeline/export-runtime-ogg.mjs',
            'scripts/audio-pipeline/generate-portfolio-feedback-pack.mjs',
            'src/renderer/cardFace/cardIllustrationDraw.ts',
            'scripts/card-pipeline/export-face-panel-webp.mjs',
            'scripts/card-pipeline/export-ui-background-webp.mjs',
            'scripts/card-pipeline/export-card-normal-webp.mjs',
            'scripts/audit-renderer-assets.mjs',
            'docs/AUDIO_INTEGRATION.md',
            'src/main/persistence.ts'
        );

        expect(payload.gates.map((gate) => gate.id)).toEqual(
            expect.arrayContaining(['rendererInput', 'audioFeedback', 'assetRendering', 'persistence', 'buildOutput'])
        );
        expect(payload.gates).toEqual(
            expect.arrayContaining([
                { id: 'rendererInput', command: 'yarn gate:renderer-input' },
                { id: 'audioFeedback', command: 'yarn gate:audio-feedback' },
                { id: 'assetRendering', command: 'yarn gate:asset-rendering' },
                { id: 'persistence', command: 'yarn gate:persistence' },
                { id: 'buildOutput', command: 'yarn gate:build-output' }
            ])
        );
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'rendererInput' &&
                    reason.file === 'src/renderer/store/levelCompleteSurfaceState.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'assetRendering' &&
                    reason.file === 'scripts/audit-renderer-assets.mjs'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'assetRendering' &&
                    reason.file === 'scripts/card-pipeline/export-face-panel-webp.mjs'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'assetRendering' &&
                    reason.file === 'scripts/card-pipeline/export-ui-background-webp.mjs'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'assetRendering' &&
                    reason.file === 'scripts/card-pipeline/export-card-normal-webp.mjs'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'audioFeedback' &&
                    reason.file === 'src/renderer/assets/audio/music/menu-loop.ogg'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'audioFeedback' &&
                    reason.file === 'scripts/audio-pipeline/export-runtime-ogg.mjs'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'audioFeedback' &&
                    reason.file === 'scripts/audio-pipeline/generate-portfolio-feedback-pack.mjs'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'audioFeedback' && reason.file === 'docs/AUDIO_INTEGRATION.md'
            )
        ).toBe(true);
    });

    it('selects renderer QA shards for live browser layout, navigation, interlude, and 3D changes', () => {
        const payload = runGateChanged(
            'e2e/mobile-layout.spec.ts',
            'e2e/playable-path-mode-matrix.spec.ts',
            'e2e/playable-path-interludes.spec.ts',
            'e2e/tile-card-face-webgl.spec.ts',
            'src/renderer/components/GameScreen.tsx',
            'src/renderer/components/ChooseYourPathScreen.tsx',
            'src/renderer/components/ShopScreen.tsx',
            'src/renderer/components/TileBoard.tsx'
        );

        expect(payload.gates).toEqual(
            expect.arrayContaining([
                { id: 'rendererQaLayout', command: 'yarn test:e2e:renderer-qa:layout' },
                { id: 'rendererQaNavigation', command: 'yarn test:e2e:renderer-qa:navigation' },
                { id: 'rendererQaInterludes', command: 'yarn test:e2e:renderer-qa:interludes' },
                { id: 'rendererQa3d', command: 'yarn test:e2e:renderer-qa:3d' }
            ])
        );
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'rendererQaLayout' && reason.file === 'e2e/mobile-layout.spec.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'rendererQaNavigation' &&
                    reason.file === 'e2e/playable-path-mode-matrix.spec.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'rendererQaInterludes' &&
                    reason.file === 'e2e/playable-path-interludes.spec.ts'
            )
        ).toBe(true);
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'rendererQa3d' && reason.file === 'e2e/tile-card-face-webgl.spec.ts'
            )
        ).toBe(true);
    });

    it('normalizes Windows paths and falls back to systems for unmapped files', () => {
        const payload = runGateChanged('docs\\notes\\new-idea.md');

        expect(payload.paths).toEqual(['docs/notes/new-idea.md']);
        expect(payload.gates).toEqual([{ id: 'systems', command: 'yarn gate:systems' }]);
    });

    it('keeps gameplay edit-map doc changes on the systems gate even with code changes', () => {
        const payload = runGateChanged(
            'docs/agent/GAMEPLAY_RULES_EDIT_MAP.md',
            'src/renderer/store/useAppStore.test.ts'
        );

        expect(payload.gates).toEqual(
            expect.arrayContaining([
                { id: 'systems', command: 'yarn gate:systems' },
                { id: 'rendererInput', command: 'yarn gate:renderer-input' }
            ])
        );
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'systems' && reason.file === 'docs/agent/GAMEPLAY_RULES_EDIT_MAP.md'
            )
        ).toBe(true);
    });
});
