import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type BoardState, type MutatorId, type RunState, type Tile } from './contracts';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import {
    buildBoard,
    countFullyHiddenPairs,
    inspectBoardFairness,
    inspectRunFairness,
    isBoardComplete
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
import {
    applyStrayRemove,
    applyRegionShuffle,
    applyShuffle,
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

    it('preserves completion routes after full shuffle and row shuffle assists', () => {
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
    });
});
