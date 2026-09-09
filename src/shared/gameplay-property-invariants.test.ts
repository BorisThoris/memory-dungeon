import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
    GAME_RULES_VERSION,
    type BoardState,
    type RunState,
    type Tile
} from './contracts';
import { inspectBoardFairness, inspectRunFairness } from './board-inspection';
import { canRegionShuffleRow, canShuffleBoard, canSwapHiddenTiles } from './board-power-availability';
import { applyFlashPair, applyPeek, applyRegionShuffle, applyShuffle, applyStrayRemove, applyTileSwap } from './board-power-actions';
import { buildBoard } from './board-build-rules';
import { createNewRun, finishMemorizePhase } from './game-core';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { solveRunByExhaustingPlayablePairs } from './playthrough-solver';
import { createGeneratedBoardSolverRun } from './softlock-generator-contract';
import { DECOY_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';
import { flipTile, resolveBoardTurn } from './turn-resolution';

const propertyRuns = Number(process.env.GAMEPLAY_PROPERTY_RUNS ?? 80);

const generatedRun = fc.record({
    level: fc.integer({ min: 1, max: 24 }),
    runSeed: fc.integer({ min: 1, max: 0x7fffffff }),
    rulesVersion: fc.integer({ min: 1, max: GAME_RULES_VERSION })
});

const sortedTileIds = (tiles: readonly Tile[]): string[] => tiles.map((tile) => tile.id).sort();

const expectStableTileIdentity = (before: BoardState, after: BoardState): void => {
    expect(sortedTileIds(after.tiles)).toEqual(sortedTileIds(before.tiles));
    expect(new Set(after.tiles.map((tile) => tile.id)).size).toBe(after.tiles.length);
};

const expectValidBoardPairShape = (board: BoardState): void => {
    const tileIds = new Set(board.tiles.map((tile) => tile.id));
    expect(tileIds.size).toBe(board.tiles.length);
    expect(board.flippedTileIds.every((id) => tileIds.has(id))).toBe(true);

    const realPairCounts = new Map<string, number>();
    for (const tile of board.tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey) || tile.pairKey === DECOY_PAIR_KEY) {
            continue;
        }
        realPairCounts.set(tile.pairKey, (realPairCounts.get(tile.pairKey) ?? 0) + 1);
    }
    for (const count of realPairCounts.values()) {
        expect(count).toBe(2);
    }
};

const expectRunResourceBounds = (run: RunState): void => {
    // The run's end reason is set exactly when the run is over, and never before.
    expect(run.runEndReason == null).toBe(run.status !== 'gameOver');
    expect(run.shuffleCharges).toBeGreaterThanOrEqual(0);
    expect(run.destroyPairCharges).toBeGreaterThanOrEqual(0);
    expect(run.regionShuffleCharges).toBeGreaterThanOrEqual(0);
    expect(run.peekCharges).toBeGreaterThanOrEqual(0);
    expect(run.flashPairCharges).toBeGreaterThanOrEqual(0);
    expect(run.strayRemoveCharges).toBeGreaterThanOrEqual(0);
};

const expectFlippedTileReferencesExist = (run: RunState): void => {
    if (!run.board) {
        return;
    }
    const tileIds = new Set(run.board.tiles.map((tile) => tile.id));
    expect(run.board.flippedTileIds.every((id) => tileIds.has(id))).toBe(true);
};

const hiddenRealPairGroups = (board: BoardState): Tile[][] => {
    const groups = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (tile.state !== 'hidden' || isSingletonUtilityPairKey(tile.pairKey) || tile.pairKey === DECOY_PAIR_KEY) {
            continue;
        }
        const group = groups.get(tile.pairKey) ?? [];
        group.push(tile);
        groups.set(tile.pairKey, group);
    }
    return [...groups.values()].filter((group) => group.length >= 2);
};

describe('gameplay property invariants', () => {
    it('generated boards keep valid tile identity and fairness shape', () => {
        fc.assert(
            fc.property(generatedRun, ({ level, runSeed, rulesVersion }) => {
                const board = buildBoard(level, { runSeed, runRulesVersion: rulesVersion });
                const report = inspectBoardFairness(board);

                expectValidBoardPairShape(board);
                expect(report.issues).toEqual([]);
                expect(report.hasCompletionRoute).toBe(true);
            }),
            { numRuns: propertyRuns }
        );
    });

    it('fresh runs have fair boards and non-negative gameplay resources', () => {
        fc.assert(
            fc.property(generatedRun, ({ runSeed, rulesVersion }) => {
                const run = createNewRun(0, {
                    echoFeedbackEnabled: false,
                    runRulesVersionOverride: rulesVersion,
                    runSeed
                });
                const report = inspectRunFairness(run);

                expect(report.issues).toEqual([]);
                expect(run.status).toBe('memorize');
                expect(run.runEndReason).toBeNull();
                expect(run.shuffleCharges).toBeGreaterThanOrEqual(0);
                expect(run.destroyPairCharges).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: propertyRuns }
        );
    });

    it('shuffle and swap powers preserve board identity and non-negative resources', () => {
        fc.assert(
            fc.property(
                generatedRun,
                fc.integer({ min: 0, max: 7 }),
                fc.integer({ min: 0, max: 63 }),
                ({ runSeed, rulesVersion }, row, pick) => {
                const run = finishMemorizePhase(createNewRun(0, {
                    echoFeedbackEnabled: false,
                    runRulesVersionOverride: rulesVersion,
                    runSeed
                }));
                const beforeBoard = run.board!;
                const shuffled = applyShuffle(run);

                if (canShuffleBoard(run)) {
                    expectStableTileIdentity(beforeBoard, shuffled.board!);
                    expect(shuffled.shuffleCharges).toBeGreaterThanOrEqual(0);
                    expect(inspectRunFairness(shuffled).issues).toEqual([]);
                } else {
                    expect(shuffled).toBe(run);
                }

                const rowIndex = row % beforeBoard.rows;
                const regionShuffled = applyRegionShuffle(run, rowIndex);
                if (canRegionShuffleRow(run, rowIndex)) {
                    expectStableTileIdentity(beforeBoard, regionShuffled.board!);
                    expect(regionShuffled.regionShuffleCharges).toBeGreaterThanOrEqual(0);
                    expect(inspectRunFairness(regionShuffled).issues).toEqual([]);
                } else {
                    expect(regionShuffled).toBe(run);
                }

                const hiddenTiles = beforeBoard.tiles.filter((tile) => tile.state === 'hidden');
                if (hiddenTiles.length < 2) {
                    return;
                }
                const first = hiddenTiles[pick % hiddenTiles.length]!;
                const second = hiddenTiles[(pick + 1) % hiddenTiles.length]!;
                const swapped = applyTileSwap(run, first.id, second.id);
                if (canSwapHiddenTiles(run, first.id, second.id)) {
                    expectStableTileIdentity(beforeBoard, swapped.board!);
                    expect(swapped.regionShuffleCharges).toBeGreaterThanOrEqual(0);
                    expect(inspectRunFairness(swapped).issues).toEqual([]);
                } else {
                    expect(swapped).toBe(run);
                }
            }),
            { numRuns: propertyRuns }
        );
    });

    it('peek, flash, and stray powers preserve valid run shape when they apply', () => {
        fc.assert(
            fc.property(generatedRun, fc.integer({ min: 0, max: 63 }), ({ runSeed, rulesVersion }, pick) => {
                const run = finishMemorizePhase(createNewRun(0, {
                    echoFeedbackEnabled: false,
                    practiceMode: true,
                    runRulesVersionOverride: rulesVersion,
                    runSeed
                }));
                const hiddenTiles = run.board?.tiles.filter((tile) => tile.state === 'hidden') ?? [];
                const tile = hiddenTiles[pick % Math.max(1, hiddenTiles.length)];

                const peeked = tile ? applyPeek(run, tile.id) : run;
                expectRunResourceBounds(peeked);
                expectFlippedTileReferencesExist(peeked);
                if (peeked !== run && peeked.status !== 'gameOver') {
                    expect(inspectRunFairness(peeked).issues).toEqual([]);
                }

                const flashed = applyFlashPair(run);
                expectRunResourceBounds(flashed);
                expectFlippedTileReferencesExist(flashed);
                if (flashed !== run && flashed.status !== 'gameOver') {
                    expect(inspectRunFairness(flashed).issues).toEqual([]);
                }

                const strayTarget = hiddenTiles.find((candidate) => candidate.pairKey === DECOY_PAIR_KEY) ?? tile;
                const strayRemoved = strayTarget
                    ? applyStrayRemove(run, strayTarget.id)
                    : run;
                expectRunResourceBounds(strayRemoved);
                expectFlippedTileReferencesExist(strayRemoved);
                if (strayRemoved !== run && strayRemoved.status !== 'gameOver') {
                    expect(inspectRunFairness(strayRemoved).issues).toEqual([]);
                }
            }),
            { numRuns: propertyRuns }
        );
    });

    it('flip and resolve preserve legal run shape for matches and misses', () => {
        fc.assert(
            fc.property(generatedRun, fc.boolean(), ({ runSeed, rulesVersion }, preferMismatch) => {
                const run = finishMemorizePhase(createNewRun(0, {
                    echoFeedbackEnabled: false,
                    runRulesVersionOverride: rulesVersion,
                    runSeed
                }));
                const board = run.board!;
                const groups = hiddenRealPairGroups(board);
                if (groups.length === 0) {
                    return;
                }

                const firstGroup = groups[0]!;
                const secondGroup = preferMismatch && groups.length > 1 ? groups[1]! : firstGroup;
                const firstTile = firstGroup[0]!;
                const secondTile = secondGroup === firstGroup ? firstGroup[1]! : secondGroup[0]!;

                const firstFlip = flipTile(run, firstTile.id);
                const secondFlip = flipTile(firstFlip, secondTile.id);
                const resolved = resolveBoardTurn(secondFlip);

                for (const candidate of [firstFlip, secondFlip, resolved]) {
                    expectRunResourceBounds(candidate);
                    expectFlippedTileReferencesExist(candidate);
                    expect(['memorize', 'playing', 'resolving', 'paused', 'levelComplete', 'gameOver']).toContain(candidate.status);
                }

                if (resolved.status !== 'gameOver') {
                    expect(inspectRunFairness(resolved).issues).toEqual([]);
                }
            }),
            { numRuns: propertyRuns }
        );
    });

    it('generated playable floors can be exhausted through pair play', () => {
        fc.assert(
            fc.property(generatedRun, ({ level, runSeed, rulesVersion }) => {
                const board = buildBoard(level, {
                    gameMode: 'endless',
                    runSeed,
                    runRulesVersion: rulesVersion
                });
                const run = createGeneratedBoardSolverRun(board, runSeed, rulesVersion);
                const solved = solveRunByExhaustingPlayablePairs(run);

                expect(run.board?.level).toBe(level);
                expectRunResourceBounds(solved);
                expectFlippedTileReferencesExist(solved);
                expect(solved.status).not.toBe('gameOver');
                expect(inspectRunFairness(solved).issues).toEqual([]);
                expect(solved.status).toBe('levelComplete');
            }),
            { numRuns: propertyRuns }
        );
    });





    it('next-floor advancement either stays guarded or returns a valid terminal/memorize run', () => {
        fc.assert(
            fc.property(generatedRun, ({ runSeed, rulesVersion }) => {
                const playing = finishMemorizePhase(createNewRun(0, {
                    echoFeedbackEnabled: false,
                    runRulesVersionOverride: rulesVersion,
                    runSeed
                }));
                const run: RunState = {
                    ...playing,
                    status: 'levelComplete',
                    board: playing.board
                        ? {
                              ...playing.board,
                              tiles: playing.board.tiles.map((tile) => ({ ...tile, state: 'matched' as const })),
                              flippedTileIds: []
                          }
                        : playing.board
                };

                const next = advanceToNextLevel(run);
                expect(next.runEndReason).toBeNull();
                expect(next.shuffleCharges).toBeGreaterThanOrEqual(0);
                expect(next.destroyPairCharges).toBeGreaterThanOrEqual(0);

                if (next.status === 'memorize') {
                    expect(next.board?.level).toBe((run.board?.level ?? 0) + 1);
                    expect(next.timerState.memorizeRemainingMs).toBeGreaterThan(0);
                    expect(inspectRunFairness(next).issues).toEqual([]);
                } else {
                    expect(['levelComplete', 'gameOver']).toContain(next.status);
                }
            }),
            { numRuns: propertyRuns }
        );
    });




});
