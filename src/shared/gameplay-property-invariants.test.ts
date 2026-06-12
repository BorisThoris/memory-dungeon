import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BoardState, LevelResult, RunState, Tile } from './contracts';
import { inspectBoardFairness, inspectRunFairness } from './board-inspection';
import { canRegionShuffleRow, canShuffleBoard } from './board-power-availability';
import { applyFlashPair, applyPeek, applyRegionShuffle, applyShuffle, applyStrayRemove } from './board-power-actions';
import { buildBoard } from './board-build-rules';
import { createNewRun, finishMemorizePhase } from './game-core';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { grantBonusRelicPickNextOffer } from './relic-immediate-rules';
import { computeRelicOfferPickBudget, openRelicOffer } from './relic-offer-rules';
import { completeRelicPickAndAdvance } from './relic-pick-advance-rules';
import { applyRouteChoiceOutcome, generateRouteChoices } from './route-rules';
import { DECOY_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';
import { flipTile, resolveBoardTurn } from './turn-resolution';

const propertyRuns = Number(process.env.GAMEPLAY_PROPERTY_RUNS ?? 80);

const generatedRun = fc.record({
    level: fc.integer({ min: 1, max: 24 }),
    runSeed: fc.integer({ min: 1, max: 0x7fffffff }),
    rulesVersion: fc.integer({ min: 1, max: 29 })
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
    expect(run.lives).toBeGreaterThanOrEqual(0);
    expect(run.shuffleCharges).toBeGreaterThanOrEqual(0);
    expect(run.destroyPairCharges).toBeGreaterThanOrEqual(0);
    expect(run.regionShuffleCharges).toBeGreaterThanOrEqual(0);
    expect(run.peekCharges).toBeGreaterThanOrEqual(0);
    expect(run.flashPairCharges).toBeGreaterThanOrEqual(0);
    expect(run.strayRemoveCharges).toBeGreaterThanOrEqual(0);
    expect(run.shopGold).toBeGreaterThanOrEqual(0);
    expect(run.relicFavorProgress).toBeGreaterThanOrEqual(0);
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

const createLevelCompleteResult = (run: RunState, routeChoices: LevelResult['routeChoices']): LevelResult => ({
    clearLifeGained: 0,
    clearLifeReason: 'none',
    level: run.board?.level ?? 1,
    livesRemaining: run.lives,
    mistakes: 0,
    perfect: false,
    rating: 'S',
    recallMistakes: 0,
    routeChoices,
    scoreGained: 0
});

const createRelicMilestoneRun = (
    runSeed: number,
    rulesVersion: number,
    bonusPicks: number
): RunState => {
    const playing = finishMemorizePhase(createNewRun(0, {
        echoFeedbackEnabled: false,
        runRulesVersionOverride: rulesVersion,
        runSeed
    }));
    const routeChoices = generateRouteChoices(playing, 4);
    const levelComplete: RunState = {
        ...playing,
        status: 'levelComplete',
        lives: Math.max(1, playing.lives),
        lastLevelResult: {
            ...createLevelCompleteResult(playing, routeChoices),
            level: 3
        },
        relicOffer: null,
        relicTiersClaimed: 0
    };
    return grantBonusRelicPickNextOffer(levelComplete, bonusPicks);
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
                expect(run.lives).toBeGreaterThan(0);
                expect(run.shuffleCharges).toBeGreaterThanOrEqual(0);
                expect(run.destroyPairCharges).toBeGreaterThanOrEqual(0);
                expect(run.shopGold).toBeGreaterThanOrEqual(0);
                expect(run.relicFavorProgress).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: propertyRuns }
        );
    });

    it('shuffle powers preserve board identity and non-negative resources', () => {
        fc.assert(
            fc.property(generatedRun, fc.integer({ min: 0, max: 7 }), ({ runSeed, rulesVersion }, row) => {
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
                    ? applyStrayRemove({ ...run, strayRemoveArmed: true }, strayTarget.id)
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
                expect(next.lives).toBeGreaterThanOrEqual(0);
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

    it('route choices apply only when available and preserve resource bounds', () => {
        fc.assert(
            fc.property(
                generatedRun,
                fc.integer({ min: 0, max: 2 }),
                fc.integer({ min: 1, max: 5 }),
                ({ runSeed, rulesVersion }, choiceIndex, lives) => {
                    const playing = finishMemorizePhase(createNewRun(0, {
                        echoFeedbackEnabled: false,
                        runRulesVersionOverride: rulesVersion,
                        runSeed
                    }));
                    const nextLevel = (playing.board?.level ?? 1) + 1;
                    const routeChoices = generateRouteChoices(playing, nextLevel);
                    const choice = routeChoices[choiceIndex % routeChoices.length]!;
                    const run: RunState = {
                        ...playing,
                        status: 'levelComplete',
                        lives,
                        lastLevelResult: createLevelCompleteResult(playing, routeChoices),
                        pendingRouteCardPlan: null
                    };

                    const result = applyRouteChoiceOutcome(run, choice.id);
                    expectRunResourceBounds(result.run);
                    expectFlippedTileReferencesExist(result.run);

                    if (choice.routeType === 'greed' && lives <= 1) {
                        expect(result.applied).toBe(false);
                        expect(result.reason).toBe('unavailable');
                        expect(result.run).toBe(run);
                        return;
                    }

                    expect(result.applied).toBe(true);
                    expect(result.routeType).toBe(choice.routeType);
                    expect(result.run.pendingRouteCardPlan?.choiceId).toBe(choice.id);
                    expect(result.run.lives).toBeGreaterThanOrEqual(0);
                }
            ),
            { numRuns: propertyRuns }
        );
    });

    it('invalid route choices are stable no-ops', () => {
        fc.assert(
            fc.property(generatedRun, ({ runSeed, rulesVersion }) => {
                const playing = finishMemorizePhase(createNewRun(0, {
                    echoFeedbackEnabled: false,
                    runRulesVersionOverride: rulesVersion,
                    runSeed
                }));
                const routeChoices = generateRouteChoices(playing, (playing.board?.level ?? 1) + 1);
                const run: RunState = {
                    ...playing,
                    status: 'levelComplete',
                    lastLevelResult: createLevelCompleteResult(playing, routeChoices),
                    pendingRouteCardPlan: null
                };

                const result = applyRouteChoiceOutcome(run, 'missing-choice');

                expect(result.applied).toBe(false);
                expect(result.reason).toBe('missing_choice');
                expect(result.run).toBe(run);
            }),
            { numRuns: propertyRuns }
        );
    });

    it('relic offers keep pick budgets positive and invalid picks unchanged', () => {
        fc.assert(
            fc.property(generatedRun, fc.integer({ min: 0, max: 4 }), ({ runSeed, rulesVersion }, bonusPicks) => {
                const run = createRelicMilestoneRun(runSeed, rulesVersion, bonusPicks);
                expect(computeRelicOfferPickBudget(run)).toBeGreaterThanOrEqual(1);

                const opened = openRelicOffer(run);
                expectRunResourceBounds(opened);

                if (!opened.relicOffer) {
                    return;
                }

                const invalid = completeRelicPickAndAdvance(opened, opened.relicOffer.options[0] ?? 'extra_shuffle_charge');
                if (opened.relicIds.includes(opened.relicOffer.options[0]!)) {
                    expect(invalid).toBe(opened);
                }

                const stale = completeRelicPickAndAdvance({
                    ...opened,
                    relicOffer: {
                        ...opened.relicOffer,
                        options: ['extra_shuffle_charge']
                    },
                    relicIds: ['extra_shuffle_charge']
                }, 'extra_shuffle_charge');
                expect(stale.relicOffer?.options).toEqual(['extra_shuffle_charge']);
            }),
            { numRuns: propertyRuns }
        );
    });

    it('valid relic picks preserve run shape while continuing or advancing', () => {
        fc.assert(
            fc.property(generatedRun, fc.integer({ min: 0, max: 2 }), ({ runSeed, rulesVersion }, bonusPicks) => {
                const opened = openRelicOffer(createRelicMilestoneRun(runSeed, rulesVersion, bonusPicks));
                if (!opened.relicOffer || opened.relicOffer.options.length === 0) {
                    return;
                }

                const relicId = opened.relicOffer.options[0]!;
                const picked = completeRelicPickAndAdvance(opened, relicId);

                expectRunResourceBounds(picked);
                expectFlippedTileReferencesExist(picked);
                expect(picked.relicIds).toEqual(expect.arrayContaining([relicId]));

                if (picked.status === 'memorize') {
                    expect(picked.relicOffer).toBeNull();
                    expect(picked.timerState.memorizeRemainingMs).toBeGreaterThan(0);
                    expect(inspectRunFairness(picked).issues).toEqual([]);
                    return;
                }

                expect(picked.status).toBe('levelComplete');
                expect(picked.relicOffer?.picksRemaining).toBeLessThan(opened.relicOffer!.picksRemaining);
            }),
            { numRuns: propertyRuns }
        );
    });
});
