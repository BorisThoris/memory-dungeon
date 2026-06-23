import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type BoardState, type MutatorId, type RouteNodeType, type RunState, type Tile } from './contracts';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import {
    buildBoard,
    countFullyHiddenPairs,
    inspectBoardFairness,
    inspectRunFairness,
    isBoardComplete,
    repairDungeonExitSoftlocks
} from './board-generation';
import {
    createDailyRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createWildRun,
    finishMemorizePhase
} from './game-core';
import { flipTile, resolveBoardTurn } from './game';
import { clearFinalPairEnemyHazardOccupationForRun } from './enemy-hazard-board-rules';
import {
    applyStrayRemove,
    applyRegionShuffle,
    applyShuffle,
    applyTileSwap,
    canRegionShuffleRow,
    canShuffleBoard,
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    tileIsStrayEligiblePreview
} from './board-powers';
import {
    WILD_PAIR_KEY
} from './tile-identity';
import { DAILY_MUTATOR_TABLE } from './mutators';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';

const DECOY_PAIR_KEY = '__decoy__';
const EXIT_PAIR_KEY = '__exit__';

const testSeeds = [1, 42_001, 867_5309] as const;

const issueCodes = (board: BoardState): string[] =>
    inspectBoardFairness(board).issues.map((issue) => issue.code);

const expectBoardFair = (board: BoardState): void => {
    const report = inspectBoardFairness(board);
    expect(report.issues, `${JSON.stringify(report.issues, null, 2)}`).toEqual([]);
    expect(report.hasCompletionRoute).toBe(true);
};

const expectRunFair = (run: RunState): void => {
    const report = inspectRunFairness(run);
    expect(report.issues, `${JSON.stringify(report.issues, null, 2)}`).toEqual([]);
    expect(report.hasCompletionRoute).toBe(true);
};

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    state,
    symbol: id,
    label: id
});

const boardFromTiles = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    level: 1,
    pairCount: new Set(tiles.map((t) => t.pairKey).filter((key) => key !== DECOY_PAIR_KEY && key !== WILD_PAIR_KEY)).size,
    columns: 2,
    rows: Math.ceil(tiles.length / 2),
    tiles,
    flippedTileIds: tiles.filter((t) => t.state === 'flipped').map((t) => t.id),
    matchedPairs: Math.floor(
        [...new Set(tiles.map((t) => t.pairKey))]
            .filter((key) => key !== DECOY_PAIR_KEY && key !== WILD_PAIR_KEY)
            .filter((key) => tiles.filter((t) => t.pairKey === key).every((t) => t.state === 'matched' || t.state === 'removed'))
            .length
    ),
    floorArchetypeId: null,
    featuredObjectiveId: null,
    ...overrides
});

const enemyHazard = (
    overrides: Partial<NonNullable<BoardState['enemyHazards']>[number]> = {}
): NonNullable<BoardState['enemyHazards']>[number] => ({
    id: 'hazard-1',
    kind: 'sentinel',
    label: 'Sentinel',
    currentTileId: 'b1',
    nextTileId: 'b2',
    pattern: 'patrol',
    state: 'hidden',
    damage: 1,
    hp: 1,
    maxHp: 1,
    ...overrides
});

const playableRun = (run: RunState): RunState => finishMemorizePhase(run);

describe('REG-087 board fairness inspection', () => {
    it('accepts generated low floors across deterministic seeds', () => {
        for (const runSeed of testSeeds) {
            for (const level of [1, 2, 3, 5, 8]) {
                expectBoardFair(buildBoard(level, { runSeed, runRulesVersion: GAME_RULES_VERSION }));
            }
        }
    });

    it('accepts scheduled endless chapter floors including trap hall and boss rows', () => {
        for (const runSeed of testSeeds) {
            for (const level of [1, 3, 7, 9, 12]) {
                const run = createNewRun(0, { runSeed });
                const advancedBoard = buildBoard(level, {
                    runSeed: run.runSeed,
                    runRulesVersion: run.runRulesVersion,
                    activeMutators:
                        level === 7
                            ? ['glass_floor', 'sticky_fingers']
                            : level === 9
                              ? ['short_memorize', 'wide_recall']
                              : [],
                    floorTag: level === 7 || level === 9 ? 'boss' : 'normal',
                    floorArchetypeId: level === 7 ? 'trap_hall' : null,
                    featuredObjectiveId: level === 7 ? 'glass_witness' : null
                });
                expectBoardFair(advancedBoard);
            }
        }
    });

    it('accepts dungeon-layout endless floors across the first cycle', () => {
        for (const runSeed of testSeeds) {
            for (let level = 1; level <= 12; level += 1) {
                const advancedBoard = buildBoard(level, {
                    runSeed,
                    runRulesVersion: GAME_RULES_VERSION,
                    activeMutators:
                        level === 7
                            ? ['glass_floor', 'sticky_fingers']
                            : level === 9
                              ? ['short_memorize', 'wide_recall']
                              : [],
                    floorTag: level === 7 || level === 9 ? 'boss' : level === 10 ? 'breather' : 'normal',
                    floorArchetypeId:
                        level === 4
                            ? 'shadow_read'
                            : level === 7
                              ? 'trap_hall'
                              : level === 9
                                ? 'rush_recall'
                                : level === 10
                                  ? 'treasure_gallery'
                                  : null,
                    gameMode: 'endless'
                });
                expectBoardFair(advancedBoard);
            }
        }
    });

    it('accepts scheduled endless boss and route floors across multiple cycles', () => {
        const routeTypes: readonly RouteNodeType[] = ['safe', 'greed', 'mystery'];
        for (const runSeed of [101, 42_001, 90_123]) {
            for (const level of [1, 4, 7, 9, 12, 13, 16, 19, 21, 24]) {
                const entry = pickFloorScheduleEntry(runSeed, GAME_RULES_VERSION, level, 'endless');
                for (const routeType of routeTypes) {
                    const board = buildBoard(level, {
                        runSeed,
                        runRulesVersion: GAME_RULES_VERSION,
                        activeMutators: entry.mutators,
                        floorTag: entry.floorTag,
                        floorArchetypeId: entry.floorArchetypeId,
                        featuredObjectiveId: entry.featuredObjectiveId,
                        cycleFloor: entry.cycleFloor,
                        gameMode: 'endless',
                        routeCardPlan: {
                            choiceId: `fixture:${routeType}:${level}`,
                            routeType,
                            sourceLevel: Math.max(1, level - 1),
                            targetLevel: level
                        }
                    });

                    expectBoardFair(board);
                }
            }
        }
    });

    it('accepts every daily mutator as structurally completeable', () => {
        for (const mutator of DAILY_MUTATOR_TABLE) {
            expectBoardFair(
                buildBoard(4, {
                    runSeed: 20260425,
                    runRulesVersion: GAME_RULES_VERSION,
                    activeMutators: [mutator]
                })
            );
        }
    });

    it('accepts important mutator combinations without orphaning real pairs', () => {
        const rows: MutatorId[][] = [
            ['category_letters', 'findables_floor'],
            ['wide_recall', 'silhouette_twist'],
            ['glass_floor', 'sticky_fingers'],
            ['shifting_spotlight'],
            ['short_memorize', 'wide_recall']
        ];

        for (const activeMutators of rows) {
            const board = buildBoard(6, {
                runSeed: 70_087,
                runRulesVersion: GAME_RULES_VERSION,
                activeMutators
            });
            expectBoardFair(board);
            expect(board.tiles.filter((t) => t.findableKind).every((t) => t.pairKey !== DECOY_PAIR_KEY && t.pairKey !== WILD_PAIR_KEY)).toBe(
                true
            );
        }
    });

    it('flags orphaned real pairs and stale flipped ids', () => {
        const board = boardFromTiles([tile('a1', 'a'), tile('b1', 'b'), tile('b2', 'b')], {
            flippedTileIds: ['missing']
        });

        expect(issueCodes(board)).toEqual(
            expect.arrayContaining(['real_pair_incomplete', 'flipped_tile_reference_missing'])
        );
        expect(inspectBoardFairness(board).hasCompletionRoute).toBe(false);
    });

    it('treats hidden glass decoys as allowed traps but flags flipped decoys before completion', () => {
        const hiddenDecoy = boardFromTiles([tile('a1', 'a'), tile('a2', 'a'), tile('decoy', DECOY_PAIR_KEY)]);
        expectBoardFair(hiddenDecoy);

        const flippedDecoy = boardFromTiles([
            tile('a1', 'a'),
            tile('a2', 'a'),
            tile('decoy', DECOY_PAIR_KEY, 'flipped')
        ]);
        expect(issueCodes(flippedDecoy)).toContain('decoy_flipped_or_cleared_before_completion');
    });

    it('keeps complete glass-decoy boards complete when the trap stayed hidden', () => {
        const board = boardFromTiles(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), tile('decoy', DECOY_PAIR_KEY)],
            { matchedPairs: 1 }
        );
        expect(isBoardComplete(board)).toBe(true);
        expect(inspectBoardFairness(board).complete).toBe(true);
        expect(inspectBoardFairness(board).issues).toEqual([]);
    });

    it('keeps a late hidden decoy from blocking completion after the last real pair clears', () => {
        const board = boardFromTiles(
            [
                tile('a1', 'a', 'matched'),
                tile('a2', 'a', 'matched'),
                tile('b1', 'b', 'matched'),
                tile('b2', 'b', 'matched'),
                tile('decoy', DECOY_PAIR_KEY)
            ],
            { matchedPairs: 2 }
        );
        const report = inspectBoardFairness(board);

        expect(isBoardComplete(board)).toBe(true);
        expect(report.complete).toBe(true);
        expect(report.hasCompletionRoute).toBe(true);
        expect(report.issues).toEqual([]);
    });

    it('keeps a trap pair actionable when it is the final unmatched pair', () => {
        const trapA: Tile = {
            ...tile('trap-a', 'trap'),
            dungeonCardKind: 'trap',
            dungeonCardEffectId: 'trap_alarm'
        };
        const trapB: Tile = { ...trapA, id: 'trap-b' };
        const board = boardFromTiles(
            [
                tile('a1', 'a', 'matched'),
                tile('a2', 'a', 'matched'),
                trapA,
                trapB,
                tile('decoy', DECOY_PAIR_KEY)
            ],
            { matchedPairs: 1 }
        );
        const report = inspectBoardFairness(board);

        expect(report.complete).toBe(false);
        expect(report.actionableRealPairKeys).toEqual(['trap']);
        expect(report.hasCompletionRoute).toBe(true);
        expect(report.issues).toEqual([]);
    });

    it('keeps route-card special states from blocking the completion route', () => {
        const board = buildBoard(2, {
            runSeed: 87_504,
            runRulesVersion: GAME_RULES_VERSION,
            routeCardPlan: {
                choiceId: 'fixture:mystery-route',
                routeType: 'mystery',
                sourceLevel: 1,
                targetLevel: 2
            }
        });
        const report = inspectBoardFairness(board);

        expect(board.routeWorldProfile?.choiceId).toBe('fixture:mystery-route');
        expect(board.tiles.some((candidate) => candidate.routeSpecialKind != null)).toBe(true);
        expect(report.issues).toEqual([]);
        expect(report.hasCompletionRoute).toBe(true);
    });

    it('flags declared exits that point at missing or non-exit cards', () => {
        const missingExit = boardFromTiles([tile('a1', 'a'), tile('a2', 'a')], {
            dungeonExitTileId: 'missing-exit'
        });
        expect(issueCodes(missingExit)).toEqual(
            expect.arrayContaining(['exit_card_missing', 'exit_tile_reference_missing'])
        );

        const mismatchedExit = boardFromTiles([tile('a1', 'a'), tile('a2', 'a')], {
            dungeonExitTileId: 'a1'
        });
        expect(issueCodes(mismatchedExit)).toEqual(
            expect.arrayContaining(['exit_card_missing', 'exit_card_mismatch'])
        );
    });

    it('flags lever-locked exits when the required levers cannot be reached', () => {
        const board = boardFromTiles(
            [
                tile('a1', 'a'),
                tile('a2', 'a'),
                {
                    ...tile('exit', EXIT_PAIR_KEY),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'lever',
                    dungeonExitRequiredLeverCount: 2
                }
            ],
            {
                pairCount: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'lever',
                dungeonExitRequiredLeverCount: 2,
                dungeonLeverCount: 0
            }
        );

        expect(issueCodes(board)).toContain('exit_lock_unreachable');
        expect(inspectBoardFairness(board).hasCompletionRoute).toBe(false);
    });

    it('flags key-locked exits when no matching key route exists', () => {
        const board = boardFromTiles(
            [
                tile('a1', 'a'),
                tile('a2', 'a'),
                {
                    ...tile('exit', EXIT_PAIR_KEY),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }
            ],
            {
                pairCount: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron'
            }
        );

        expect(issueCodes(board)).toContain('exit_lock_unreachable');
        expect(inspectBoardFairness(board).hasCompletionRoute).toBe(false);
    });

    it('repairs impossible generated primary exit locks instead of trusting shop access', () => {
        const board = boardFromTiles(
            [
                tile('a1', 'a'),
                tile('a2', 'a'),
                {
                    ...tile('exit', EXIT_PAIR_KEY),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                },
                {
                    ...tile('shop', '__shop__'),
                    dungeonCardKind: 'shop',
                    dungeonCardEffectId: 'shop_vendor'
                }
            ],
            {
                pairCount: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron',
                dungeonShopTileId: 'shop'
            }
        );

        const repaired = repairDungeonExitSoftlocks(board);

        expect(repaired.dungeonExitLockKind).toBe('none');
        expect(repaired.tiles.find((candidate) => candidate.id === 'exit')?.dungeonExitLockKind).toBe('none');
        expect(inspectBoardFairness(repaired).issues).toEqual([]);
    });

    it('preserves key-locked exits when a guaranteed key source exists', () => {
        const withKeyPair = boardFromTiles(
            [
                tile('key-a', 'key', 'hidden'),
                tile('key-b', 'key', 'hidden'),
                {
                    ...tile('exit', EXIT_PAIR_KEY),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }
            ],
            {
                pairCount: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron'
            }
        );
        withKeyPair.tiles[0] = { ...withKeyPair.tiles[0]!, dungeonCardKind: 'key', dungeonKeyKind: 'iron' };
        withKeyPair.tiles[1] = { ...withKeyPair.tiles[1]!, dungeonCardKind: 'key', dungeonKeyKind: 'iron' };

        const withKeyCacheRoom = boardFromTiles(
            [
                tile('a1', 'a'),
                tile('a2', 'a'),
                {
                    ...tile('exit', EXIT_PAIR_KEY),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                },
                {
                    ...tile('room', '__room__'),
                    dungeonCardKind: 'room',
                    dungeonCardEffectId: 'room_key_cache'
                }
            ],
            {
                pairCount: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron'
            }
        );

        expect(repairDungeonExitSoftlocks(withKeyPair).dungeonExitLockKind).toBe('iron');
        expect(inspectBoardFairness(withKeyPair).issues).toEqual([]);
        expect(repairDungeonExitSoftlocks(withKeyCacheRoom).dungeonExitLockKind).toBe('iron');
        expect(inspectBoardFairness(withKeyCacheRoom).issues).toEqual([]);
    });

    it('caps impossible lever requirements to reachable lever count', () => {
        const board = boardFromTiles(
            [
                tile('lever-a', 'lever'),
                tile('lever-b', 'lever'),
                {
                    ...tile('exit', EXIT_PAIR_KEY),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'lever',
                    dungeonExitRequiredLeverCount: 2
                }
            ],
            {
                pairCount: 1,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'lever',
                dungeonExitRequiredLeverCount: 2,
                dungeonLeverCount: 0
            }
        );
        board.tiles[0] = { ...board.tiles[0]!, dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' };
        board.tiles[1] = { ...board.tiles[1]!, dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' };

        const repaired = repairDungeonExitSoftlocks(board);

        expect(repaired.dungeonExitLockKind).toBe('lever');
        expect(repaired.dungeonExitRequiredLeverCount).toBe(1);
        expect(repaired.tiles.find((candidate) => candidate.id === 'exit')?.dungeonExitRequiredLeverCount).toBe(1);
        expect(inspectBoardFairness(repaired).issues).toEqual([]);
    });

    it('flags inconsistent dungeon pair metadata and enemy HP mirrors', () => {
        const kindMismatch = boardFromTiles([
            { ...tile('e1', 'enemy'), dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardHp: 2, dungeonCardMaxHp: 2 },
            { ...tile('e2', 'enemy'), dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_alarm' }
        ]);
        expect(issueCodes(kindMismatch)).toContain('dungeon_card_pair_mismatch');

        const hpMismatch = boardFromTiles([
            { ...tile('e1', 'enemy'), dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardHp: 2, dungeonCardMaxHp: 2 },
            { ...tile('e2', 'enemy'), dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry', dungeonCardHp: 1, dungeonCardMaxHp: 2 }
        ]);
        expect(issueCodes(hpMismatch)).toContain('dungeon_card_hp_mismatch');
    });

    it('flags active enemy hazards with stale or cleared tile references', () => {
        const missingRef = boardFromTiles([tile('a1', 'a'), tile('a2', 'a')], {
            enemyHazards: [
                {
                    id: 'hazard-1',
                    kind: 'sentinel',
                    label: 'Sentinel',
                    currentTileId: 'missing',
                    nextTileId: 'a1',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ]
        });
        expect(issueCodes(missingRef)).toContain('enemy_hazard_tile_reference_missing');

        const clearedRef = boardFromTiles([tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched')], {
            matchedPairs: 1,
            enemyHazards: [
                {
                    id: 'hazard-2',
                    kind: 'sentinel',
                    label: 'Sentinel',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    pattern: 'patrol',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ]
        });
        expect(issueCodes(clearedRef)).toContain('enemy_hazard_on_cleared_tile');
    });

    it('defeats normal enemy hazards occupying the last unmatched pair before the flip resolves', () => {
        const board = boardFromTiles(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), tile('b1', 'b'), tile('b2', 'b')],
            {
                matchedPairs: 1,
                enemyHazards: [enemyHazard()]
            }
        );
        const run: RunState = { ...playableRun(createNewRun(0, { runSeed: 87_501 })), board };

        const afterFirstFlip = flipTile(run, 'b1');
        const afterSecondFlip = flipTile(afterFirstFlip, 'b2');
        const afterResolve = resolveBoardTurn(afterSecondFlip);

        expect(afterFirstFlip.board?.enemyHazards?.[0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(afterFirstFlip.enemyHazardsDefeatedThisFloor).toBe((run.enemyHazardsDefeatedThisFloor ?? 0) + 1);
        expect(afterResolve.board ? isBoardComplete(afterResolve.board) : false).toBe(true);
        expect(afterResolve.board?.enemyHazards?.filter((hazard) => hazard.state !== 'defeated')).toEqual([]);
    });

    it('defeats boss-linked hazards that telegraph blocking the last unmatched pair', () => {
        const board = boardFromTiles(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), tile('b1', 'b'), tile('b2', 'b')],
            {
                level: 7,
                floorTag: 'boss',
                dungeonBossId: 'rush_sentinel',
                matchedPairs: 1,
                enemyHazards: [
                    enemyHazard({
                        id: '7:boss:rush_sentinel',
                        kind: 'sentinel',
                        label: 'Rush Sentinel',
                        currentTileId: 'a1',
                        nextTileId: 'b2',
                        bossId: 'rush_sentinel',
                        hp: 2,
                        maxHp: 2
                    })
                ]
            }
        );
        const run: RunState = { ...playableRun(createNewRun(0, { runSeed: 87_502 })), board };

        const afterFlip = flipTile(run, 'b1');

        expect(afterFlip.board?.enemyHazards?.[0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(afterFlip.dungeonEnemiesDefeated).toBe(run.dungeonEnemiesDefeated + 1);
        expect(issueCodes(afterFlip.board!)).not.toContain('enemy_hazard_on_cleared_tile');
    });

    it('defeats stale boss hazards that only reference already matched cards', () => {
        const board = boardFromTiles(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched')],
            {
                level: 7,
                floorTag: 'boss',
                dungeonObjectiveId: 'defeat_boss',
                dungeonBossId: 'trap_warden',
                matchedPairs: 1,
                enemyHazards: [
                    enemyHazard({
                        id: '7:boss:trap_warden',
                        kind: 'warden',
                        label: 'Latch Warden',
                        currentTileId: 'a1',
                        nextTileId: 'a2',
                        bossId: 'trap_warden',
                        hp: 1,
                        maxHp: 3
                    })
                ]
            }
        );
        const run: RunState = { ...playableRun(createNewRun(0, { runSeed: 87_504 })), board };

        const cleaned = clearFinalPairEnemyHazardOccupationForRun(run);

        expect(cleaned.board?.enemyHazards?.[0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(cleaned.dungeonEnemiesDefeated).toBe(run.dungeonEnemiesDefeated + 1);
        expect(cleaned.enemyHazardsDefeatedThisFloor).toBe((run.enemyHazardsDefeatedThisFloor ?? 0) + 1);
        expect(cleaned.board ? isBoardComplete(cleaned.board) : false).toBe(true);
    });

    it('keeps a trap final pair solvable when an enemy hazard occupies it', () => {
        const trapA: Tile = {
            ...tile('trap-a', 'trap'),
            dungeonCardKind: 'trap',
            dungeonCardEffectId: 'trap_alarm',
            dungeonCardState: 'revealed'
        };
        const trapB: Tile = { ...trapA, id: 'trap-b' };
        const board = boardFromTiles(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), trapA, trapB],
            {
                matchedPairs: 1,
                enemyHazards: [enemyHazard({ currentTileId: 'trap-a', nextTileId: 'trap-b', pattern: 'stalk' })]
            }
        );
        const run: RunState = { ...playableRun(createNewRun(0, { runSeed: 87_503 })), board };

        const afterFlip = flipTile(run, 'trap-a');

        expect(afterFlip.board?.enemyHazards?.[0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(afterFlip.board?.tiles.find((candidate) => candidate.id === 'trap-a')?.state).toBe('flipped');
        expect(inspectRunFairness(afterFlip).hasCompletionRoute).toBe(true);
    });

    it('flags defeat-boss objectives without any boss card or hazard route', () => {
        const board = boardFromTiles([tile('a1', 'a'), tile('a2', 'a')], {
            dungeonObjectiveId: 'defeat_boss',
            dungeonBossId: null,
            enemyHazards: []
        });

        expect(issueCodes(board)).toContain('dungeon_objective_unreachable');
        expect(inspectBoardFairness(board).hasCompletionRoute).toBe(false);
    });
});

describe('REG-087 run-start fairness coverage', () => {
    it('accepts current local/offline run starts after memorize', () => {
        const runs = [
            createNewRun(0, { runSeed: 11 }),
            createDailyRun(0),
            createGauntletRun(0, 5 * 60 * 1000, { runSeed: 12 }),
            createMeditationRun(0, undefined, { runSeed: 13 })
        ];

        for (const run of runs) {
            expectRunFair(playableRun(run));
        }
    });

    it('accepts every built-in puzzle start', () => {
        for (const puzzle of Object.values(BUILTIN_PUZZLES)) {
            expectRunFair(playableRun(createPuzzleRun(0, puzzle.id, puzzle.tiles)));
        }
    });

    it('accepts wild/joker starts while a real actionable tile route remains', () => {
        const run = playableRun(createWildRun(0, { runSeed: 14 }));
        const report = inspectRunFairness(run);

        expect(report.wildTileIds).toHaveLength(1);
        expect(report.actionableRealPairKeys.length).toBeGreaterThan(0);
        expect(report.issues).toEqual([]);
        expect(report.hasCompletionRoute).toBe(true);
    });

    it('classifies memorize as an intentional blocker, not a softlock', () => {
        const report = inspectRunFairness(createNewRun(0, { runSeed: 15 }));

        expect(report.issues).toEqual([]);
        expect(report.intentionalBlockers).toContain('memorize_window');
        expect(report.hasCompletionRoute).toBe(true);
    });

    it('flags terminal incomplete runs', () => {
        const run = {
            ...playableRun(createNewRun(0, { runSeed: 16 })),
            status: 'gameOver' as const
        };

        expect(inspectRunFairness(run).issues.map((issue) => issue.code)).toContain('run_terminal_incomplete_board');
    });
});

describe('REG-087 action eligibility edge cases', () => {
    it('destroy, peek, and stray previews expose only legal completion routes around decoys and wilds', () => {
        const board = boardFromTiles([
            tile('a1', 'a'),
            tile('a2', 'a'),
            tile('decoy', DECOY_PAIR_KEY),
            tile('wild', WILD_PAIR_KEY)
        ]);

        expect(countFullyHiddenPairs(board)).toBe(1);
        expect(collectDestroyEligibleTileIds(board)).toEqual(new Set(['a1', 'a2']));
        expect(collectPeekEligibleTileIds(board, [])).toEqual(new Set(['a1', 'a2', 'decoy', 'wild']));
        expect(tileIsStrayEligiblePreview(board, 'a1')).toBe(false);
        expect(tileIsStrayEligiblePreview(board, 'decoy')).toBe(false);
        expect(tileIsStrayEligiblePreview(board, 'wild')).toBe(true);
    });

    it('preserves completion routes after legal stray use', () => {
        const board = boardFromTiles([
            tile('a1', 'a'),
            tile('a2', 'a'),
            tile('wild', WILD_PAIR_KEY)
        ]);
        const run: RunState = {
            ...playableRun(createNewRun(0, { initialStrayRemoveCharges: 1 })),
            board,
            strayRemoveArmed: true,
            strayRemoveCharges: 1
        };

        const after = applyStrayRemove(run, 'wild');

        expect(after).not.toBe(run);
        expect(after.board?.tiles.find((candidate) => candidate.id === 'wild')?.state).toBe('removed');
        expectRunFair(after);
    });

    it('flags a stranded wild singleton once no real or removal route remains', () => {
        const board = boardFromTiles([tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), tile('wild', WILD_PAIR_KEY)], {
            matchedPairs: 1
        });

        expect(issueCodes(board)).toContain('wild_singleton_unmatched_without_route');
        expect(inspectBoardFairness(board).hasCompletionRoute).toBe(false);
    });

    it('preserves completion routes after full shuffle, row shuffle, and tile swap assists', () => {
        const fullShuffleRun = playableRun(createNewRun(0, { runSeed: 80_870 }));
        expect(canShuffleBoard(fullShuffleRun)).toBe(true);
        const afterFullShuffle = applyShuffle(fullShuffleRun);

        expect(afterFullShuffle).not.toBe(fullShuffleRun);
        expectRunFair(afterFullShuffle);

        const rowShuffleRun = playableRun(
            createNewRun(0, {
                runSeed: 80_871,
                initialRelicIds: ['region_shuffle_free_first'],
                weakerShuffleMode: 'rows_only'
            })
        );
        const shuffledRow = Array.from({ length: rowShuffleRun.board?.rows ?? 0 }, (_, row) => row).find((row) =>
            canRegionShuffleRow(rowShuffleRun, row)
        );

        expect(shuffledRow).toBeTypeOf('number');
        const afterRowShuffle = applyRegionShuffle(rowShuffleRun, shuffledRow!);

        expect(afterRowShuffle).not.toBe(rowShuffleRun);
        expectRunFair(afterRowShuffle);
        expect(afterRowShuffle.regionShuffleRowArmed).toBeNull();

        const tileSwapRun = playableRun(
            createNewRun(0, {
                runSeed: 80_872,
                initialRelicIds: ['region_shuffle_free_first']
            })
        );
        const hiddenTiles = tileSwapRun.board?.tiles.filter((candidate) => candidate.state === 'hidden') ?? [];
        expect(hiddenTiles.length).toBeGreaterThanOrEqual(2);
        const afterTileSwap = applyTileSwap(tileSwapRun, hiddenTiles[0]!.id, hiddenTiles[1]!.id);

        expect(afterTileSwap).not.toBe(tileSwapRun);
        expectRunFair(afterTileSwap);
        expect(afterTileSwap.regionShuffleRowArmed).toBeNull();
    });

    it('preserves completion routes across generated board-power permutations', () => {
        for (const runSeed of [90_870, 90_871, 90_872, 90_873]) {
            const baseRun = playableRun(
                createNewRun(0, {
                    runSeed,
                    initialRelicIds: ['region_shuffle_free_first'],
                    initialStrayRemoveCharges: 1
                })
            );
            expectRunFair(baseRun);

            if (canShuffleBoard(baseRun)) {
                expectRunFair(applyShuffle(baseRun));
            }

            const row = Array.from({ length: baseRun.board?.rows ?? 0 }, (_, index) => index).find((candidate) =>
                canRegionShuffleRow(baseRun, candidate)
            );
            if (row != null) {
                expectRunFair(applyRegionShuffle(baseRun, row));
            }

            const hiddenTiles = baseRun.board?.tiles.filter((candidate) => candidate.state === 'hidden') ?? [];
            if (hiddenTiles.length >= 2) {
                expectRunFair(applyTileSwap(baseRun, hiddenTiles[0]!.id, hiddenTiles[1]!.id));
            }

            const strayTile = hiddenTiles.find((candidate) => tileIsStrayEligiblePreview(baseRun.board!, candidate.id));
            if (strayTile) {
                expectRunFair(applyStrayRemove({ ...baseRun, strayRemoveArmed: true }, strayTile.id));
            }
        }
    });
});
