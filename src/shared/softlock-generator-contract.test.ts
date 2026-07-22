import { describe, expect, it } from 'vitest';

import { buildBoard } from './board-build-rules';
import { inspectRunFairness } from './board-inspection';
import { GAME_RULES_VERSION, type BoardState, type EnemyHazardState, type Tile } from './contracts';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { inspectDungeonRunMapProgression } from './run-map';
import { getRunShopStockPlan } from './shop-rules';
import { isSingletonUtilityPairKey } from './tile-identity';
import {
    createClearedBoardFairnessProjection,
    createFinalPairFairnessProjection,
    createGeneratedBoardSolverRun,
    createShopStockInspectionRun,
    DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS,
    formatSoftlockGeneratorFailure,
    runSoftlockGeneratorContract,
    solveGeneratedBoardByExhaustingPairs
} from './softlock-generator-contract';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    state,
    symbol: id,
    label: id
});

const hazard = (id: string, currentTileId: string, nextTileId: string): EnemyHazardState => ({
    id,
    kind: 'sentinel',
    label: id,
    currentTileId,
    nextTileId,
    pattern: 'patrol',
    state: 'revealed',
    damage: 1,
    hp: 1,
    maxHp: 1
});

const projectionBoard = (overrides: Partial<BoardState> = {}): BoardState => ({
    level: 6,
    pairCount: 2,
    columns: 3,
    rows: 2,
    tiles: [
        tile('a1', 'a', 'matched'),
        tile('a2', 'a', 'matched'),
        tile('key-a', 'key'),
        tile('key-b', 'key'),
        {
            ...tile('exit', '__exit__', 'flipped'),
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'iron'
        }
    ],
    flippedTileIds: ['exit'],
    matchedPairs: 1,
    floorArchetypeId: null,
    featuredObjectiveId: null,
    dungeonExitTileId: 'exit',
    dungeonExitLockKind: 'none',
    dungeonKeysHeld: 0,
    ...overrides
});

describe('softlock generator contract', () => {
    it('keeps route-pressure scenarios cycling through authored route types', () => {
        const routePressure = DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS.find((scenario) => scenario.id === 'route_pressure');

        expect(routePressure).toBeTruthy();
        expect(
            routePressure?.seeds.flatMap((seed) =>
                routePressure.floors.map((floor) => routePressure.optionsForFloor({ seed, floor }).routeCardPlan?.routeType)
            )
        ).toEqual(expect.arrayContaining(['safe', 'greed', 'mystery']));
    });

    it('checks seeded floors across locks, shops, traits, hazards, bosses, and final-pair projections', () => {
        const result = runSoftlockGeneratorContract();

        expect(result.failures.map(formatSoftlockGeneratorFailure)).toEqual([]);
        expect(result.checkedBoards).toBeGreaterThan(100);
        expect(result.checkedPlayableBoards).toBeGreaterThan(30);
        expect(result.checkedNextFloorTransitions).toBe(result.checkedPlayableBoards);
        expect(Number.isInteger(result.checkedShopPlans)).toBe(true);
        expect(result.coverage).toMatchObject({
            locks: expect.any(Number),
            shops: expect.any(Number),
            keys: expect.any(Number),
            levers: expect.any(Number),
            traits: expect.any(Number),
            exits: expect.any(Number),
            hazards: expect.any(Number),
            enemies: expect.any(Number),
            bosses: expect.any(Number),
            traitInteractions: expect.any(Number),
            traitRouteObjectives: expect.any(Number),
            topology: expect.any(Number),
            finalPairStates: expect.any(Number)
        });
        for (const [key, count] of Object.entries(result.coverage)) {
            expect(count, `${key} coverage`).toBeGreaterThan(0);
        }
    }, 15_000);

    it('uses generated-board run context when checking locked-exit shop stock', () => {
        const board = projectionBoard({
            level: 6,
            matchedPairs: 0,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonShopTileId: 'shop',
            tiles: [
                tile('a1', 'a'),
                tile('a2', 'a'),
                {
                    ...tile('exit', '__exit__'),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                },
                {
                    ...tile('shop', '__shop__'),
                    dungeonCardKind: 'shop',
                    dungeonCardEffectId: 'shop_vendor'
                }
            ]
        });

        const run = createGeneratedBoardSolverRun(board, 130_111);
        const plan = getRunShopStockPlan({ ...run, shopRerolls: 0 });

        expect(run.board?.level).toBe(6);
        expect(run.dungeonRun.currentFloor).toBe(6);
        expect(plan.itemIds[0]).toBe('iron_key');

        const malformedStatsRun = createShopStockInspectionRun(
            {
                ...run,
                stats: Number.NaN as unknown as typeof run.stats
            },
            board
        );
        expect(malformedStatsRun.stats.highestLevel).toBe(6);
        expect(malformedStatsRun.stats.totalScore).toBe(0);
        expect(getRunShopStockPlan(malformedStatsRun).itemIds[0]).toBe('iron_key');
    });

    it('executes generated boards through pair exhaustion and primary exit activation', () => {
        const board = buildBoard(5, {
            gameMode: 'endless',
            runSeed: 438154985,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'normal',
            floorArchetypeId: null,
            dungeonNodeKind: 'elite',
            activeMutators: [],
            routeCardPlan: {
                choiceId: 'contract:mystery:438154985:5',
                routeType: 'mystery',
                sourceLevel: 4,
                targetLevel: 5
            }
        });

        const solverRun = createGeneratedBoardSolverRun(board, 438154985);
        const solved = solveGeneratedBoardByExhaustingPairs(board, 438154985);
        const next = advanceToNextLevel(solved);

        expect(solverRun.gameMode).toBe('endless');
        expect(solverRun.board?.level).toBe(5);
        expect(solverRun.dungeonRun.currentFloor).toBe(5);
        expect(solverRun.findablesTotalThisFloor).toBeGreaterThanOrEqual(0);
        expect(solved.status).toBe('levelComplete');
        expect(solved.board?.dungeonExitActivated).toBe(true);
        expect(next.status).toBe('memorize');
        expect(next.board?.level).toBe(6);
        expect(next.dungeonRun.currentFloor).toBe(6);
        expect(inspectRunFairness(next).issues).toEqual([]);
        expect(inspectDungeonRunMapProgression(next.dungeonRun)).toMatchObject({
            hasLegalProgressionPath: true,
            issues: []
        });
    });

    it('creates legal final-pair projections from generated dungeon boards', () => {
        const board = buildBoard(7, {
            gameMode: 'endless',
            runSeed: 77_707,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            dungeonNodeKind: 'boss'
        });
        const projected = createFinalPairFairnessProjection(board);

        expect(projected).toBeTruthy();
        expect(projected?.flippedTileIds).toEqual([]);
        expect(
            projected?.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey)).length
        ).toBeGreaterThan(0);
        expect(runSoftlockGeneratorContract([
            {
                id: 'single_boss_projection',
                label: 'Single boss projection',
                seeds: [77_707],
                floors: [7],
                optionsForFloor: () => ({
                    gameMode: 'endless',
                    runSeed: 77_707,
                    runRulesVersion: GAME_RULES_VERSION,
                    floorTag: 'boss',
                    floorArchetypeId: 'trap_hall',
                    dungeonNodeKind: 'boss'
                })
            }
        ]).failures.map(formatSoftlockGeneratorFailure)).toEqual([]);
    });

    it('creates cleared-board projections for boss and hazard stale-overlay coverage', () => {
        const board = buildBoard(7, {
            gameMode: 'endless',
            runSeed: 77_708,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            dungeonNodeKind: 'boss'
        });
        const projected = createClearedBoardFairnessProjection(board);

        expect(projected.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey))).toHaveLength(0);
        expect(projected.matchedPairs).toBe(projected.pairCount);
        expect(projected.enemyHazards?.filter((hazard) => hazard.state !== 'defeated')).toEqual([]);
        expect(runSoftlockGeneratorContract([
            {
                id: 'single_boss_cleared_projection',
                label: 'Single boss cleared projection',
                seeds: [77_708],
                floors: [7],
                optionsForFloor: () => ({
                    gameMode: 'endless',
                    runSeed: 77_708,
                    runRulesVersion: GAME_RULES_VERSION,
                    floorTag: 'boss',
                    floorArchetypeId: 'trap_hall',
                    dungeonNodeKind: 'boss'
                })
            }
        ]).failures.map(formatSoftlockGeneratorFailure)).toEqual([]);
    });

    it('normalizes malformed projection enemy hazards before contract checks', () => {
        const board = projectionBoard({
            enemyHazards: Number.NaN as unknown as BoardState['enemyHazards']
        });

        const finalPairProjection = createFinalPairFairnessProjection(board);
        const clearedProjection = createClearedBoardFairnessProjection(board);

        expect(finalPairProjection?.enemyHazards).toEqual([]);
        expect(clearedProjection.enemyHazards).toEqual([]);
        expect(createGeneratedBoardSolverRun(finalPairProjection!, 130_112).board?.enemyHazards).toEqual([]);
    });

    it('keeps only final-pair enemy hazards active in final-pair projections', () => {
        const board = projectionBoard({
            tiles: projectionBoard().tiles.map((candidate) =>
                candidate.pairKey === 'key'
                    ? { ...candidate, dungeonCardKind: 'key' as const, dungeonKeyKind: 'iron' as const }
                    : candidate
            ),
            enemyHazards: [
                hazard('on-final', 'key-a', 'key-b'),
                hazard('off-final', 'a1', 'a2')
            ]
        });

        const projected = createFinalPairFairnessProjection(board);

        expect(projected?.enemyHazards).toMatchObject([
            { id: 'on-final', state: 'revealed', hp: 1 },
            { id: 'off-final', state: 'defeated', hp: 0 }
        ]);
    });

    it('uses the primary exit tile lock when granting final-pair projection resources', () => {
        const board = projectionBoard({
            tiles: projectionBoard().tiles.map((candidate) =>
                candidate.pairKey === 'key'
                    ? { ...candidate, dungeonCardKind: 'key' as const, dungeonKeyKind: 'iron' as const }
                    : candidate
            )
        });

        const projected = createFinalPairFairnessProjection(board);

        expect(board.dungeonExitLockKind).toBe('none');
        expect(projected?.dungeonKeysHeld).toBe(1);
    });

    it('preserves key kind when granting final-pair projection resources', () => {
        const board = projectionBoard({
            tiles: projectionBoard().tiles.map((candidate) => {
                if (candidate.pairKey === 'key') {
                    return { ...candidate, dungeonCardKind: 'key' as const, dungeonKeyKind: 'treasure' as const };
                }
                if (candidate.pairKey === '__exit__') {
                    return { ...candidate, dungeonExitLockKind: 'treasure' as const };
                }
                return candidate;
            })
        });

        const projected = createFinalPairFairnessProjection(board);

        expect(projected?.dungeonKeysHeld).toBe(1);
        expect(projected?.dungeonKeysHeldByKind).toEqual({ treasure: 1 });
    });

    it('normalizes malformed projection resource counters before granting fallbacks', () => {
        const board = projectionBoard({
            dungeonKeysHeld: Number.POSITIVE_INFINITY,
            dungeonKeysHeldByKind: { treasure: Number.NaN },
            dungeonLeverCount: Number.POSITIVE_INFINITY,
            tiles: projectionBoard().tiles.map((candidate) => {
                if (candidate.pairKey === 'key') {
                    return { ...candidate, dungeonCardKind: 'key' as const, dungeonKeyKind: 'treasure' as const };
                }
                if (candidate.pairKey === '__exit__') {
                    return { ...candidate, dungeonExitLockKind: 'treasure' as const };
                }
                return candidate;
            })
        });

        const projected = createFinalPairFairnessProjection(board);

        expect(projected?.dungeonKeysHeld).toBe(1);
        expect(projected?.dungeonKeysHeldByKind).toEqual({ treasure: 1 });
    });

    it('does not grant fake projection keys for terminal primary exit lock fallbacks', () => {
        const board = projectionBoard({
            pairCount: 1,
            tiles: [
                tile('a1', 'a', 'matched'),
                tile('a2', 'a', 'matched'),
                {
                    ...tile('exit', '__exit__', 'flipped'),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }
            ],
            matchedPairs: 1
        });

        const projected = createClearedBoardFairnessProjection(board);

        expect(board.dungeonExitLockKind).toBe('none');
        expect(projected.dungeonKeysHeld).toBe(0);
    });

    it('does not grant fake projection keys while pending fallback pairs remain', () => {
        const board = projectionBoard();

        const projected = createFinalPairFairnessProjection(board);

        expect(projected).not.toBeNull();
        expect(projected?.dungeonKeysHeld).toBe(0);
    });

    it('formats diagnostics with scenario, seed, floor, projection, and issue codes', () => {
        const result = runSoftlockGeneratorContract([
            {
                id: 'broken_exit_fixture',
                label: 'Broken exit fixture',
                seeds: [1],
                floors: [1],
                optionsForFloor: () => ({
                    fixedTilesMode: 'exact',
                    fixedTiles: [
                        { id: 'a', pairKey: 'a', state: 'hidden', symbol: 'A', label: 'A' },
                        { id: 'b', pairKey: 'b', state: 'hidden', symbol: 'B', label: 'B' }
                    ],
                    runSeed: 1,
                    runRulesVersion: GAME_RULES_VERSION
                })
            }
        ]);

        expect(result.failures.length).toBeGreaterThan(0);
        expect(result.failures.flatMap((failure) => failure.issueCodes)).toContain('completion_route_missing');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('[broken_exit_fixture]');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('seed=1');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('floor=1');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('projection=');
        const playableFailure = result.failures.find((failure) => failure.projection === 'playable_clear');
        expect(playableFailure?.issueDetails.some((detail) => detail.startsWith('solver_trace: reason='))).toBe(true);
        expect(formatSoftlockGeneratorFailure(playableFailure!)).toContain('solver_trace: reason=');
    });

    it('includes blocked resource and tile context in failure diagnostics', () => {
        const diagnostic = formatSoftlockGeneratorFailure({
            scenarioId: 'missing_key_lock_fixture',
            scenarioLabel: 'Missing key lock fixture',
            seed: 23,
            floor: 6,
            projection: 'generated',
            issueCodes: ['exit_lock_unreachable'],
            issueDetails: [
                'exit_lock_unreachable: iron-locked exit requires a matching key, but no reachable key route exists. tiles=exit'
            ],
            issues: [
                {
                    code: 'exit_lock_unreachable',
                    message: 'iron-locked exit requires a matching key, but no reachable key route exists.',
                    tileIds: ['exit']
                }
            ],
            boardSummary: 'level=6 pairs=1 floorTag=normal archetype=none objective=find_exit exitLock=iron boss=none hazards=0'
        });

        expect(diagnostic).toContain('exitLock=iron');
        expect(diagnostic).toContain('exit_lock_unreachable');
        expect(diagnostic).toContain('no reachable key route');
        expect(diagnostic).toContain('tiles=exit');
    });

    it('preserves topology graph diagnostics in formatted locked-exit failures', () => {
        const diagnostic = formatSoftlockGeneratorFailure({
            scenarioId: 'topology_missing_key_fixture',
            scenarioLabel: 'Topology missing key fixture',
            seed: 7,
            floor: 1,
            projection: 'generated',
            issueCodes: ['exit_lock_unreachable'],
            issueDetails: [
                'exit_lock_unreachable: Topology validation: topology_exit_lock_source_missing: Exit needs an iron key. nodes=2 edges=1 reachable=1 keys=none levers=0 bossRoute=false exitRoute=false exits=exit:exit[lock=iron levers=0] bosses=none'
            ],
            issues: [
                {
                    code: 'exit_lock_unreachable',
                    message: 'Topology validation: topology_exit_lock_source_missing: Exit needs an iron key.'
                }
            ],
            boardSummary: 'level=1 pairs=0 floorTag=normal archetype=none objective=find_exit exitLock=iron boss=none hazards=0'
        });

        expect(diagnostic).toContain('Topology validation: topology_exit_lock_source_missing');
        expect(diagnostic).toContain('nodes=');
        expect(diagnostic).toContain('keys=none');
        expect(diagnostic).toContain('exitRoute=false');
    });
});
