import { describe, expect, it } from 'vitest';
import { buildEndlessSimulationCsv } from '../../scripts/sim-endless';
import { FINDABLE_KIND_SPAWN_WEIGHTS, GAME_RULES_VERSION, type FindableKind } from './contracts';

describe('sim-endless CSV output', () => {
    it('reports findable kind diagnostics and target weights', () => {
        const csv = buildEndlessSimulationCsv({
            floors: 24,
            runSeed: 42_001,
            rulesVersion: GAME_RULES_VERSION
        });
        const lines = csv.trim().split('\n');

        expect(lines[0]).toBe('kind,key,count');
        for (const kind of Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS) as FindableKind[]) {
            expect(lines).toContain(`findableTargetWeight,${kind},${FINDABLE_KIND_SPAWN_WEIGHTS[kind]}`);
            expect(lines.some((line) => line.startsWith(`findableKind,${kind},`))).toBe(true);
        }
        expect(lines.some((line) => line.startsWith('traitMetric,traitFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitInteractionLines,'))).toBe(true);
        expect(lines).toContain('traitMetric,deadTraitFloors,0');
    });
});
