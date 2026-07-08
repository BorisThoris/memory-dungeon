import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    analyzeEndlessSimulationHealth,
    buildEndlessSimulationCsv,
    buildEndlessSimulationSummary,
    countUndefeatedEnemyHazardsForPlayableGate,
    evaluateEndlessSimulationHealth
} from '../../scripts/sim-endless';
import { runSoftlockSeedGate } from '../../scripts/gate-softlock-seeds';
import { FINDABLE_KIND_SPAWN_WEIGHTS, GAME_RULES_VERSION, type FindableKind } from './contracts';

describe('sim-endless CSV output', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

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
        expect(lines.some((line) => line.startsWith('fairnessIssue,'))).toBe(false);
        expect(lines.some((line) => line.startsWith('topologyIssue,'))).toBe(false);
        expect(lines.some((line) => line.startsWith('playableMetric,checkedFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('playableMetric,lockedExitFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('dungeonMetric,lockedCacheRoomFloors,'))).toBe(true);
        expect(lines.some((line) => line.startsWith('dungeonMetric,typedLockedCacheRoomFloors,'))).toBe(true);
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
        expect(summary).toContain('- Topology gates:');
        expect(summary).toContain('issue types (none).');
        expect(summary).toContain('- Playable gates:');
        expect(summary).toContain('locked-exit floors');
        expect(summary).toContain('issue floors (none).');
        expect(summary).toContain('- Dungeon room gates:');
        expect(summary).toContain('typed locked cache room floors.');
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
            fairnessIssueCodes: [],
            fairnessIssueFloors: 0,
            fairnessIssueTypes: 0,
            topologyIssueCodes: [],
            topologyIssueFloors: 0,
            topologyIssueTypes: 0,
            lockedCacheRoomFloors: expect.any(Number),
            playableFailureDetails: [],
            playableIssueFloors: 0,
            playableIssueReasons: [],
            playableLockedExitFloors: expect.any(Number),
            rewardKinds: Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS).length,
            typedLockedCacheRoomFloors: expect.any(Number)
        });
        expect(health.metrics.lockedCacheRoomFloors).toBeGreaterThan(0);
        expect(health.metrics.typedLockedCacheRoomFloors).toBeGreaterThan(0);
        expect(health.metrics.playableCheckedFloors).toBeGreaterThan(500);
        expect(health.metrics.playableLockedExitFloors).toBeGreaterThan(0);
        expect(health.metrics.routeKinds).toBeGreaterThanOrEqual(8);
        expect(health.metrics.objectiveKinds).toBeGreaterThanOrEqual(4);
        expect(health.metrics.traitFloorShare).toBeGreaterThanOrEqual(0.8);
        expect(health.metrics.traitMatchRouteFloorShare).toBeGreaterThanOrEqual(0.95);
        expect(health.metrics.traitRewardFloorShare).toBeGreaterThanOrEqual(0.8);
        expect(health.metrics.traitBoardPowerInteractionFloorShare).toBeGreaterThanOrEqual(0.7);
        expect(health.metrics.traitSwapSetupFloorShare).toBeGreaterThanOrEqual(0.1);
    }, 45_000);

    it('counts raw undefeated hazard state for playable gates even when the hazard is no longer active', () => {
        expect(
            countUndefeatedEnemyHazardsForPlayableGate({
                enemyHazards: [
                    {
                        currentTileId: 'matched-a',
                        damage: 1,
                        hp: 1,
                        id: 'raw-leftover',
                        kind: 'warden',
                        label: 'Raw Leftover',
                        maxHp: 1,
                        nextTileId: 'matched-b',
                        pattern: 'guard',
                        state: 'revealed'
                    },
                    {
                        currentTileId: 'done-a',
                        damage: 1,
                        hp: 0,
                        id: 'done',
                        kind: 'sentinel',
                        label: 'Done',
                        maxHp: 1,
                        nextTileId: 'done-b',
                        pattern: 'patrol',
                        state: 'defeated'
                    }
                ]
            } as Parameters<typeof countUndefeatedEnemyHazardsForPlayableGate>[0])
        ).toBe(1);
    });

    it('reports actionable failures when endless health metrics regress', () => {
        const health = evaluateEndlessSimulationHealth(
            {
                deadTraitFloors: 2,
                exitlessFloors: 1,
                fairnessIssueCodes: ['exit_lock_unreachable', 'completion_route_missing'],
                fairnessIssueFloors: 3,
                fairnessIssueTypes: 2,
                topologyIssueCodes: ['topology_exit_lock_source_missing'],
                topologyIssueFloors: 5,
                topologyIssueTypes: 1,
                exitLockTypes: 0,
                findableTotal: 2,
                lockedCacheRoomFloors: 0,
                objectiveKinds: 1,
                playableCheckedFloors: 0,
                playableFailureDetails: [
                    'floor=7|reason=exit_attempted|status=playing|turns=12|lastPair=__exit__|lastTiles=exit|activeStaleHazards=0|undefeatedStaleHazards=0|archetype=trap_hall|objective=defeat_boss'
                ],
                playableIssueFloors: 4,
                playableIssueReasons: ['exit_attempted'],
                playableLockedExitFloors: 0,
                rewardKinds: 1,
                typedLockedCacheRoomFloors: 0,
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
                'Expected generated boards to pass fairness inspection, saw 3 floor(s) with 2 issue type(s): exit_lock_unreachable, completion_route_missing.',
                'Expected generated boards to pass topology inspection, saw 5 floor(s) with 1 issue type(s): topology_exit_lock_source_missing.',
                'Expected executable playable solver sampling to inspect at least one floor.',
                'Expected playable solver sample to clear every checked floor, saw 4 issue floor(s): exit_attempted. Details: floor=7|reason=exit_attempted|status=playing|turns=12|lastPair=__exit__|lastTiles=exit|activeStaleHazards=0|undefeatedStaleHazards=0|archetype=trap_hall|objective=defeat_boss.',
                'Expected executable playable solver sampling to include at least one live locked-exit floor.',
                'Expected match-triggerable trait routes on at least 95.0% of trait floors, saw 40.0%.',
                'Expected reward-producing trait interactions on at least 80.0% of trait floors, saw 30.0%.',
                'Expected board-power trait interactions on at least 70.0% of trait floors, saw 20.0%.',
                'Expected one-swap trait setup opportunities on at least 10.0% of trait floors, saw 0.0%.',
                'Expected 0 dead trait floors, saw 2.'
            ])
        );
    });

    it('runs the multi-seed softlock gate and reports malformed seed lists with defaults', () => {
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        expect(runSoftlockSeedGate(['--floors=120', '--seeds=42001,42002'])).toBe(0);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('seed=42001,playable='))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('seed=42002,playable='))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('lockedExits='))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('playableIssues=none'))).toBe(true);
        expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('topologyIssues=0'))).toBe(true);

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
    }, 90_000);
});
