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
            'src/shared/contracts.ts'
        );

        expect(payload.gates.map((gate) => gate.id)).toContain('simHealth');
        expect(payload.gates.map((gate) => gate.id)).toContain('systems');
        expect(payload.reasons.filter((reason) => reason.gateId === 'simHealth')).toHaveLength(5);
    });

    it('selects renderer, audio, asset, and persistence focused gates', () => {
        const payload = runGateChanged(
            'src/renderer/components/tileBoardPointerPick.ts',
            'src/renderer/audio/uiSfx.ts',
            'src/renderer/cardFace/cardIllustrationDraw.ts',
            'src/main/persistence.ts'
        );

        expect(payload.gates.map((gate) => gate.id)).toEqual(
            expect.arrayContaining(['rendererInput', 'audioFeedback', 'assetRendering', 'persistence'])
        );
    });

    it('normalizes Windows paths and falls back to systems for unmapped files', () => {
        const payload = runGateChanged('docs\\notes\\new-idea.md');

        expect(payload.paths).toEqual(['docs/notes/new-idea.md']);
        expect(payload.gates).toEqual([{ id: 'systems', command: 'yarn gate:systems' }]);
    });
});
