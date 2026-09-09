import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type BoardState, type MutatorId, type RunState, type Tile } from './contracts';
import {
    buildBoard,
    countFullyHiddenPairs,
    inspectBoardFairness,
    inspectRunFairness,
    isBoardComplete
} from './board-generation';
import {
    createNewRun,
    createWildRun,
    finishMemorizePhase
} from './game-core';
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
import { pickFloorScheduleEntry } from './floor-mutator-schedule';

const DECOY_PAIR_KEY = '__decoy__';

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


    it('accepts scheduled endless boss floors across multiple cycles', () => {
        for (const runSeed of [101, 42_001, 90_123]) {
            for (const level of [1, 4, 7, 9, 12, 13, 16, 19, 21, 24]) {
                const entry = pickFloorScheduleEntry(runSeed, GAME_RULES_VERSION, level, 'endless');
                const board = buildBoard(level, {
                    runSeed,
                    runRulesVersion: GAME_RULES_VERSION,
                    activeMutators: entry.mutators,
                    floorTag: entry.floorTag,
                    floorArchetypeId: entry.floorArchetypeId,
                    featuredObjectiveId: entry.featuredObjectiveId,
                    cycleFloor: entry.cycleFloor,
                    gameMode: 'endless'
                });

                expectBoardFair(board);
            }
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























});

describe('REG-087 run-start fairness coverage', () => {
    it('accepts current local/offline run starts after memorize', () => {
        const runs = [
            createNewRun(0, { runSeed: 11 }),
            createNewRun(0, { practiceMode: true, runSeed: 12 }),
            createNewRun(0, { resolveDelayMultiplier: 1.35, runSeed: 13 })
        ];

        for (const run of runs) {
            expectRunFair(playableRun(run));
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
            strayRemoveCharges: 1
        };

        const after = applyStrayRemove(run, 'wild');

        expect(after).not.toBe(run);
        expect(after.board?.tiles.find((candidate) => candidate.id === 'wild')?.state).toBe('removed');
        expectRunFair(after);
    });

    it('accepts a leftover wild singleton once real board completion is already satisfied', () => {
        const board = boardFromTiles([tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), tile('wild', WILD_PAIR_KEY)], {
            matchedPairs: 1
        });

        expect(issueCodes(board)).not.toContain('wild_singleton_unmatched_without_route');
        expect(inspectBoardFairness(board).hasCompletionRoute).toBe(true);
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

        const tileSwapRun = playableRun(
            createNewRun(0, { runSeed: 80_872 })
        );
        const hiddenTiles = tileSwapRun.board?.tiles.filter((candidate) => candidate.state === 'hidden') ?? [];
        expect(hiddenTiles.length).toBeGreaterThanOrEqual(2);
        const afterTileSwap = applyTileSwap(tileSwapRun, hiddenTiles[0]!.id, hiddenTiles[1]!.id);

        expect(afterTileSwap).not.toBe(tileSwapRun);
        expectRunFair(afterTileSwap);
    });

    it('preserves completion routes across generated board-power permutations', () => {
        for (const runSeed of [90_870, 90_871, 90_872, 90_873]) {
            const baseRun = playableRun(
                createNewRun(0, { runSeed, initialStrayRemoveCharges: 1 })
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
                expectRunFair(applyStrayRemove(baseRun, strayTile.id));
            }
        }
    });
});
