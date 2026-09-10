import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type BoardState, type MutatorId, type RunState, type Tile } from './contracts';
import {
    buildBoard,
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
    applyRegionShuffle,
    applyShuffle,
    applyTileSwap,
    canRegionShuffleRow,
    canShuffleBoard,
} from './board-powers';
import {
    WILD_PAIR_KEY
} from './tile-identity';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';

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
    pairCount: new Set(tiles.map((t) => t.pairKey).filter((key) => key !== WILD_PAIR_KEY)).size,
    columns: 2,
    rows: Math.ceil(tiles.length / 2),
    tiles,
    flippedTileIds: tiles.filter((t) => t.state === 'flipped').map((t) => t.id),
    matchedPairs: Math.floor(
        [...new Set(tiles.map((t) => t.pairKey))]
            .filter((key) => key !== WILD_PAIR_KEY)
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
                            ? ['sticky_fingers', 'distraction_channel']
                            : level === 9
                              ? ['short_memorize', 'wide_recall']
                              : [],
                    floorTag: level === 7 || level === 9 ? 'boss' : 'normal',
                    floorArchetypeId: level === 7 ? 'trap_hall' : null,
                    featuredObjectiveId: level === 7 ? 'scholar_style' : null
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
            ['sticky_fingers', 'distraction_channel'],
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
            expect(board.tiles.filter((t) => t.findableKind).every((t) => t.pairKey !== WILD_PAIR_KEY)).toBe(true);
        }
    });

    it('reports a board complete once every real pair is cleared, hidden wild or not', () => {
        const withWild = boardFromTiles(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), tile('wild', WILD_PAIR_KEY)],
            { matchedPairs: 1 }
        );
        expect(isBoardComplete(withWild)).toBe(true);
        expect(inspectBoardFairness(withWild).complete).toBe(true);
        expect(inspectBoardFairness(withWild).issues).toEqual([]);

        const halfCleared = boardFromTiles([tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), tile('b1', 'b'), tile('b2', 'b')], {
            matchedPairs: 1
        });
        expect(isBoardComplete(halfCleared)).toBe(false);
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

});
