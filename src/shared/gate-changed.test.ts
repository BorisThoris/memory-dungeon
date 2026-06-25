import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type GateChangedPayload = {
    paths: string[];
    gates: { id: string; command: string }[];
    reasons: { gateId: string; file: string; reason: string }[];
};

const scriptPath = path.join(process.cwd(), 'scripts', 'gate-changed.mjs');

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
            expect.arrayContaining(['actionLoop', 'rewardsEconomy', 'navigation', 'systems', 'simHealth'])
        );
        expect(payload.gates.find((gate) => gate.id === 'actionLoop')?.command).toBe('yarn gate:action-loop');
        expect(payload.gates.find((gate) => gate.id === 'simHealth')?.command).toBe('yarn gate:sim-health');
        expect(payload.reasons.some((reason) => reason.file === 'docs/system-diagrams/actions.json')).toBe(true);
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
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/dungeon-exit-rules.ts'
            )
        ).toBe(true);
    });

    it('selects expensive softlock gates for fairness inspector and dungeon status changes', () => {
        const payload = runGateChanged('src/shared/board-inspection.ts', 'src/shared/dungeon-board-status.ts');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(expect.arrayContaining(['actionLoop', 'simHealth', 'simSoftlockSeeds']));
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

    it('selects expensive softlock gates for runtime progression repair changes', () => {
        const payload = runGateChanged('src/shared/run-progression-repair.ts');
        const gateIds = payload.gates.map((gate) => gate.id);

        expect(gateIds).toEqual(expect.arrayContaining(['actionLoop', 'simHealth', 'simSoftlockSeeds']));
        expect(
            payload.reasons.some(
                (reason) => reason.gateId === 'simSoftlockSeeds' && reason.file === 'src/shared/run-progression-repair.ts'
            )
        ).toBe(true);
    });

    it('keeps core game rules on expensive gates without matching gameplay support files', () => {
        const corePayload = runGateChanged('src/shared/game.ts');
        expect(corePayload.gates.map((gate) => gate.id)).toEqual(
            expect.arrayContaining(['actionLoop', 'simSoftlockSeeds'])
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
            'src/renderer/cardFace/cardIllustrationDraw.ts',
            'src/main/persistence.ts'
        );

        expect(payload.gates.map((gate) => gate.id)).toEqual(
            expect.arrayContaining(['rendererInput', 'audioFeedback', 'assetRendering', 'persistence'])
        );
        expect(payload.gates).toEqual(
            expect.arrayContaining([
                { id: 'rendererInput', command: 'yarn gate:renderer-input' },
                { id: 'audioFeedback', command: 'yarn gate:audio-feedback' },
                { id: 'assetRendering', command: 'yarn gate:asset-rendering' },
                { id: 'persistence', command: 'yarn gate:persistence' }
            ])
        );
        expect(
            payload.reasons.some(
                (reason) =>
                    reason.gateId === 'rendererInput' &&
                    reason.file === 'src/renderer/store/levelCompleteSurfaceState.ts'
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
