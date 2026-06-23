import { describe, expect, it } from 'vitest';
import {
    analyzeEndlessSimulationHealth,
    buildEndlessSimulationCsv,
    buildEndlessSimulationSummary,
    evaluateEndlessSimulationHealth
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
        expect(lines.some((line) => line.startsWith('traitMetric,traitMatchRouteFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitRewardFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitBoardPowerInteractionFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitSwapSetupFloors,'))).toBe(true);
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
        expect(summary).toContain('- Trait mechanic gates:');
        expect(summary).toContain('exitless floors.');
        expect(summary).toContain('dead trait floors.');
        expect(summary).toContain('one-swap setup floors.');
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
        expect(health.metrics.traitMatchRouteFloorShare).toBeGreaterThanOrEqual(0.95);
        expect(health.metrics.traitRewardFloorShare).toBeGreaterThanOrEqual(0.8);
        expect(health.metrics.traitBoardPowerInteractionFloorShare).toBeGreaterThanOrEqual(0.7);
        expect(health.metrics.traitSwapSetupFloorShare).toBeGreaterThanOrEqual(0.1);
    }, 45_000);

    it('reports actionable failures when endless health metrics regress', () => {
        const health = evaluateEndlessSimulationHealth(
            {
                deadTraitFloors: 2,
                exitlessFloors: 1,
                exitLockTypes: 0,
                findableTotal: 2,
                objectiveKinds: 1,
                rewardKinds: 1,
                traitBoardPowerInteractionFloorShare: 0.2,
                traitMatchRouteFloorShare: 0.4,
                routeKinds: 2,
                traitFloorShare: 0.25,
                traitInteractionLines: 3,
                traitRewardFloorShare: 0.3,
                traitSwapSetupFloorShare: 0
            },
            20,
            Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS).length
        );

        expect(health.ok).toBe(false);
        expect(health.issues).toEqual(
            expect.arrayContaining([
                'Expected at least 8 floor archetypes, saw 2.',
                'Expected every sampled floor to have an exit, saw 1 exitless floors.',
                'Expected match-triggerable trait routes on at least 95.0% of trait floors, saw 40.0%.',
                'Expected reward-producing trait interactions on at least 80.0% of trait floors, saw 30.0%.',
                'Expected board-power trait interactions on at least 70.0% of trait floors, saw 20.0%.',
                'Expected one-swap trait setup opportunities on at least 10.0% of trait floors, saw 0.0%.',
                'Expected 0 dead trait floors, saw 2.'
            ])
        );
    });
});
