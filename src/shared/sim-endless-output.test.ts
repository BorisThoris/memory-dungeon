import { describe, expect, it } from 'vitest';
import {
    analyzeEndlessSimulationHealth,
    buildEndlessSimulationCsv,
    buildEndlessSimulationSummary
} from '../../scripts/sim-endless';
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

    it('summarizes route, reward, and trait gates for human review', () => {
        const summary = buildEndlessSimulationSummary({
            floors: 24,
            runSeed: 42_001,
            rulesVersion: GAME_RULES_VERSION
        });

        expect(summary).toContain('# Endless Simulation Gate Summary');
        expect(summary).toContain('- Route gates:');
        expect(summary).toContain('- Reward gates:');
        expect(summary).toContain('- Trait gates:');
        expect(summary).toContain('exitless floors.');
        expect(summary).toContain('dead trait floors.');
    });

    it('turns endless route, reward, and trait health into a gateable report', () => {
        const health = analyzeEndlessSimulationHealth({
            floors: 1000,
            runSeed: 42_001,
            rulesVersion: GAME_RULES_VERSION
        });

        expect(health.ok).toBe(true);
        expect(health.issues).toEqual([]);
        expect(health.metrics).toMatchObject({
            deadTraitFloors: 0,
            exitlessFloors: 0,
            rewardKinds: Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS).length
        });
        expect(health.metrics.routeKinds).toBeGreaterThanOrEqual(8);
        expect(health.metrics.objectiveKinds).toBeGreaterThanOrEqual(4);
        expect(health.metrics.traitFloorShare).toBeGreaterThanOrEqual(0.8);
    });
});
