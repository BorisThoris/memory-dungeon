import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    analyzeEndlessSimulationHealth,
    buildEndlessSimulationCsv,
    buildEndlessSimulationSummary,
    endlessMechanicKeys,
    evaluateEndlessSimulationHealth,
    MIN_PLAYS_PER_MECHANIC,
    parseEndlessSimulationCliOptions
} from '../../scripts/sim-endless';
import { runSoftlockSeedGate } from '../../scripts/gate-softlock-seeds';
import { GAME_RULES_VERSION } from './contracts';
import { getFindableSpawnWeightRows } from './findables';

describe('sim-endless CSV output', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('parses CLI options with positive numeric guards and exact output paths', () => {
        expect(parseEndlessSimulationCliOptions(['--floors=12', '--seed=42001', '--summary', '--out=reports/a=b.csv'])).toEqual({
            floors: 12,
            runSeed: 42_001,
            summaryMode: true,
            checkMode: false,
            deepFloors: [210, 225, 240, 260, 300],
            out: 'reports/a=b.csv'
        });

        expect(parseEndlessSimulationCliOptions(['--floors=0', '--seed=', '--check', '--deep-floors='])).toEqual({
            floors: 1,
            runSeed: 42_001,
            summaryMode: false,
            checkMode: true,
            deepFloors: []
        });
        expect(parseEndlessSimulationCliOptions(['--deep-floors=210,x,300']).deepFloors).toEqual([210, 300]);
    });

    it('reports findable kind diagnostics and target weights', () => {
        const csv = buildEndlessSimulationCsv({
            floors: 24,
            runSeed: 42_001,
            rulesVersion: GAME_RULES_VERSION
        });
        const lines = csv.trim().split('\n');

        expect(lines[0]).toBe('kind,key,count');
        for (const row of getFindableSpawnWeightRows()) {
            expect(lines).toContain(`findableTargetWeight,${row.id},${row.weight}`);
            expect(lines.some((line) => line.startsWith(`findableKind,${row.id},`))).toBe(true);
        }
        expect(lines.some((line) => line.startsWith('traitMetric,traitFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitInteractionLines,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitMatchRouteFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitRewardFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitBoardPowerInteractionFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('traitMetric,traitSwapSetupFloors,'))).toBe(true);
        expect(lines).toContain('traitMetric,deadTraitFloors,0');
        expect(lines.some((line) => line.startsWith('fairnessIssue,'))).toBe(false);
        expect(lines.some((line) => line.startsWith('playableMetric,checkedFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('dungeon'))).toBe(false);
        expect(lines.some((line) => line.startsWith('playableIssue,'))).toBe(false);
        expect(lines.some((line) => line.startsWith('playableFailure,'))).toBe(false);
    });

    it('summarizes route, reward, and trait gates for human review', () => {
        const summary = buildEndlessSimulationSummary({
            floors: 24,
            runSeed: 42_001,
            rulesVersion: GAME_RULES_VERSION
        });

        expect(summary).toContain('# Endless Simulation Gate Summary');
        expect(summary).toContain('- Route gates:');
        expect(summary).toContain('- Fairness gates:');
        expect(summary).toContain('issue types (none).');
        expect(summary).toContain('- Playable gates:');
        expect(summary).toContain('issue floors (none).');
        expect(summary).toContain('- Reward gates:');
        expect(summary).toContain('- Trait gates:');
        expect(summary).toContain('- Trait mechanic gates:');
        expect(summary).not.toContain('Dungeon');
        expect(summary).toContain('dead trait floors.');
        expect(summary).toContain('one-swap setup floors.');
    });

    it('turns endless route, reward, and trait health into a gateable report', () => {
        // Two hundred floors, as the gate runs it: past that a board is thousands of pairs (the deep
        // sample below covers those sizes).
        const health = analyzeEndlessSimulationHealth({
            floors: 200,
            runSeed: 42_001,
            rulesVersion: GAME_RULES_VERSION
        });

        expect(health.ok).toBe(true);
        expect(health.issues).toEqual([]);
        expect(health.metrics).toMatchObject({
            deadTraitFloors: 0,
            fairnessIssueCodes: [],
            fairnessIssueFloors: 0,
            fairnessIssueTypes: 0,
            playableFailureDetails: [],
            playableIssueFloors: 0,
            playableIssueReasons: [],
            rewardKinds: getFindableSpawnWeightRows().length
        });
        expect(health.metrics.playableCheckedFloors).toBeGreaterThan(80);
        expect(health.metrics.mechanicsUnderPlayed).toEqual([]);
        expect(health.metrics.routeKinds).toBeGreaterThanOrEqual(8);
        expect(health.metrics.traitFloorShare).toBeGreaterThanOrEqual(0.8);
        expect(health.metrics.traitMatchRouteFloorShare).toBeGreaterThanOrEqual(0.95);
        expect(health.metrics.traitRewardFloorShare).toBeGreaterThanOrEqual(0.8);
        expect(health.metrics.traitBoardPowerInteractionFloorShare).toBeGreaterThanOrEqual(0.7);
        expect(health.metrics.traitSwapSetupFloorShare).toBeGreaterThanOrEqual(0.1);
    }, 300_000);


    it('plays every mechanic at least twice, topping up from later seeds when one run deals it once', () => {
        const lines = buildEndlessSimulationCsv({ floors: 24, runSeed: 42_001, rulesVersion: GAME_RULES_VERSION }).trim().split('\n');
        const plays = lines.filter((line) => line.startsWith('mechanicPlayed,'));
        expect(plays).toHaveLength(endlessMechanicKeys().length);
        for (const line of plays) expect(Number(line.split(',')[2]), line).toBeGreaterThanOrEqual(MIN_PLAYS_PER_MECHANIC);
        // Twenty-four floors of seed 42001 (rules 63) deal the Rush Recall archetype once: the second comes from seed 42002.
        expect(lines.some((line) => line.startsWith('mechanicTopUp,archetype:rush_recall@4200'))).toBe(true);
        expect(lines.some((line) => line.startsWith('playableFailure,'))).toBe(false);
    }, 120_000);

    it('cherry-picks a deep floor, builds it, inspects it and plays it to the clear', () => {
        const lines = buildEndlessSimulationCsv({ floors: 1, runSeed: 42_001, rulesVersion: GAME_RULES_VERSION, deepFloors: [210] }).trim().split('\n');
        const deep = lines.filter((line) => line.startsWith('deepFloor,'));
        expect(deep).toHaveLength(1);
        expect(deep[0]).toMatch(/^deepFloor,floor=210\|pairs=768\|mode=clear\|status=levelComplete\|.*\|replay=ok\|fairness=ok\|ok,1$/u);
    }, 180_000);

    it('reports actionable failures when endless health metrics regress', () => {
        const health = evaluateEndlessSimulationHealth(
            {
                deadTraitFloors: 2,
                fairnessIssueCodes: ['real_pair_incomplete', 'completion_route_missing'],
                fairnessIssueFloors: 3,
                fairnessIssueTypes: 2,
                    findableTotal: 2,
                playableCheckedFloors: 0,
                coreReplayCheckedFloors: 0,
                playableFailureDetails: [
                    'floor=7|reason=no_progress|status=playing|turns=12|lastPair=a|lastTiles=a1+a2|archetype=trap_hall'
                ],
                playableIssueFloors: 4,
                playableIssueReasons: ['no_progress'],
                mechanicsUnderPlayed: ['mutator:magpie_thief (1)'],
                mechanicTopUps: 0,
                deepFloorsChecked: 1,
                deepFloorFailures: ['floor=300|pairs=4096|mode=capped80|status=gameOver|FAIL'],
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
            getFindableSpawnWeightRows().length
        );

        expect(health.ok).toBe(false);
        expect(health.issues).toEqual(
            expect.arrayContaining([
                'Expected at least 8 floor archetypes, saw 2.',
                    'Expected generated boards to pass fairness inspection, saw 3 floor(s) with 2 issue type(s): real_pair_incomplete, completion_route_missing.',
                'Expected executable playable solver sampling to inspect at least one floor.',
                'Expected playable solver sample to clear every checked floor, saw 4 issue floor(s): no_progress. Details: floor=7|reason=no_progress|status=playing|turns=12|lastPair=a|lastTiles=a1+a2|archetype=trap_hall.',
                    'Expected match-triggerable trait routes on at least 95.0% of trait floors, saw 40.0%.',
                'Expected reward-producing trait interactions on at least 80.0% of trait floors, saw 30.0%.',
                'Expected board-power trait interactions on at least 70.0% of trait floors, saw 20.0%.',
                'Expected one-swap trait setup opportunities on at least 10.0% of trait floors, saw 0.0%.',
                'Expected 0 dead trait floors, saw 2.',
                'Expected every mechanic played at least 2 times across seeds, short: mutator:magpie_thief (1).',
                'Expected every cherry-picked deep floor to pass, failed: floor=300|pairs=4096|mode=capped80|status=gameOver|FAIL.'
            ])
        );
    });

    it('runs the multi-seed softlock gate and reports malformed seed lists with defaults', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runSoftlockSeedGate(['--floors=120', '--seeds=42001,42002'])).toBe(0);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('seed=42001,playable='))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('seed=42002,playable='))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('playableIssues=none'))).toBe(true);

        stdout.mockClear();
        stderr.mockClear();

        expect(runSoftlockSeedGate(['--floors=120', '--seeds=42001 42002'])).toBe(0);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('Seeds: 42001, 42002'))).toBe(true);

        stdout.mockClear();
        stderr.mockClear();

        expect(runSoftlockSeedGate(['--floors=25', '--stressSeeds=3', '--stressSeedBase=42001'])).toBe(0);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('Seeds: 432012, 425003, 878670'))).toBe(true);

        stdout.mockClear();
        stderr.mockClear();

        expect(runSoftlockSeedGate(['--floors=5', '--seeds=,'])).toBe(1);
        expect(
            stdout.mock.calls.some(([chunk]) =>
                String(chunk).includes(
                    'Seeds: 42001, 42002, 42077, 77707, 130011, 172707, 182009, 192012, 210008, 240017, 310021, 420113, 530017, 610019, 720031, 880037'
                )
            )
        ).toBe(true);
        expect(stderr.mock.calls.some(([chunk]) => String(chunk).includes('Softlock seed gate failed'))).toBe(true);
    }, 120_000);
});
