import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    FloorArchetypeId,
    MutatorId,
    RunState,
    Tile
} from './contracts';
import {
    FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
    FINDABLE_MATCH_SCORE,
    FLIP_PAR_BONUS_SCORE,
    GAME_RULES_VERSION,
    MATCH_DELAY_MS,
    INITIAL_RECALL_FOCUS,
    RECALL_FOCUS_MAX,
    RECALL_FOCUS_MATCH_SCORE,
    SHIFTING_BOUNTY_MATCH_BONUS,
    SHIFTING_WARD_MATCH_PENALTY,
} from './contracts';
import {
    buildBoard,
    countFindablePairs,
    countFullyHiddenPairs,
    getWildTileIdFromBoard,
    isBoardComplete
} from './board-generation';
import {
    createNewRun,
    createWildRun,
    enableDebugPeek,
    finishMemorizePhase,
    getMemorizeDuration,
    getMemorizeDurationForRun,
    resumeRun,
    advanceToNextLevel
} from './game-core';
import {
    applyFlashPair,
    applyRegionShuffle,
    applyShuffle,
    canRegionShuffle,
    canShuffleBoard,
    collectPeekEligibleTileIds,
    tileIsPeekEligiblePreview,
    togglePinnedTile
} from './board-powers';
import {
    calculateMatchScore,
    flipTile,
    getMatchFloaterAnchorTileIds,
    getMismatchFloaterAnchorTileIds,
    getPresentationMutatorMatchPenalty,
    resolveBoardTurn,
    tilesArePairMatch
} from './turn-resolution';
import { WILD_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';
import { MIN_CURIO_MEMORIZE_MS, pickFloorCurio } from './floor-curio-rules';
import { pairsForFloor } from './pair-curve';
import { parTurnsForFloor } from './floor-par';
import { makeBoard as createBoard, makePair as createPair, makeRun as createRun, makeTile as createTile } from './test/game-fixtures';
import {
    DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS,
    getScheduledSoftlockFloorOptions
} from './softlock-generator-contract';

describe('tilesArePairMatch', () => {
    it('matches two normal tiles with the same pairKey', () => {
        expect(tilesArePairMatch(createTile('a', 'p1', 'x'), createTile('b', 'p1', 'y'))).toBe(true);
    });

    it('does not match different normal pairKeys', () => {
        expect(tilesArePairMatch(createTile('a', 'p1', 'x'), createTile('b', 'p2', 'y'))).toBe(false);
    });

    it('matches wild with any non-wild real pairKey', () => {
        expect(tilesArePairMatch(createTile('w', WILD_PAIR_KEY, 'x'), createTile('b', 'p9', 'y'))).toBe(true);
        expect(tilesArePairMatch(createTile('a', 'p9', 'x'), createTile('w', WILD_PAIR_KEY, 'y'))).toBe(true);
    });

    it('matches two wild tiles that share a pairKey', () => {
        expect(tilesArePairMatch(createTile('w1', WILD_PAIR_KEY, 'x'), createTile('w2', WILD_PAIR_KEY, 'y'))).toBe(
            true
        );
    });
});

describe('flipTile malformed board guards', () => {
    it('refuses to flip when the board flip id list is malformed', () => {
        const [a1, a2] = createPair('a', 'A');
        const run = createRun([a1, a2], {
            board: {
                ...createBoard([a1, a2]),
                flippedTileIds: Number.NaN as unknown as string[]
            }
        });

        expect(flipTile(run, a1.id)).toBe(run);
    });

    it('refuses to resolve when the board flip id list is malformed', () => {
        const [a1, a2] = createPair('a', 'A');
        const run = createRun([a1, a2], {
            status: 'resolving',
            board: {
                ...createBoard([
                    { ...a1, state: 'flipped' as const },
                    { ...a2, state: 'flipped' as const }
                ]),
                flippedTileIds: Number.NaN as unknown as string[]
            }
        });

        expect(resolveBoardTurn(run)).toBe(run);
    });
});

describe('getMatchFloaterAnchorTileIds', () => {
    it('returns null when run has no board', () => {
        expect(getMatchFloaterAnchorTileIds(null)).toBeNull();
        expect(getMatchFloaterAnchorTileIds({ board: null } as RunState)).toBeNull();
    });

    it('returns two flipped ids for a standard two-flip', () => {
        const run = createRun([createTile('a', 'p1', '1'), createTile('b', 'p1', '2')]);
        run.board!.flippedTileIds = ['a', 'b'];
        expect(getMatchFloaterAnchorTileIds(run)).toEqual({ tileIdA: 'a', tileIdB: 'b' });
    });

    it('returns first matching pair for gambit when first two tiles match', () => {
        const tiles = [createTile('a', 'p1', '1'), createTile('b', 'p1', '2'), createTile('c', 'p2', '3')];
        const run = createRun(tiles);
        run.board!.flippedTileIds = ['a', 'b', 'c'];
        expect(getMatchFloaterAnchorTileIds(run)).toEqual({ tileIdA: 'a', tileIdB: 'b' });
    });

    it('returns second+third pair when first pair does not match (CARD-008 order)', () => {
        const tiles = [createTile('a', 'p2', '1'), createTile('b', 'p1', '2'), createTile('c', 'p1', '3')];
        const run = createRun(tiles);
        run.board!.flippedTileIds = ['a', 'b', 'c'];
        expect(getMatchFloaterAnchorTileIds(run)).toEqual({ tileIdA: 'b', tileIdB: 'c' });
    });

    it('returns null when gambit has no matching pair', () => {
        const tiles = [createTile('a', 'p1', '1'), createTile('b', 'p2', '2'), createTile('c', 'p3', '3')];
        const run = createRun(tiles);
        run.board!.flippedTileIds = ['a', 'b', 'c'];
        expect(getMatchFloaterAnchorTileIds(run)).toBeNull();
    });

    it('returns null when floater flip ids are malformed', () => {
        const run = createRun([createTile('a', 'p1', '1'), createTile('b', 'p1', '2')]);
        run.board!.flippedTileIds = Number.NaN as unknown as string[];

        expect(getMatchFloaterAnchorTileIds(run)).toBeNull();
    });
});

describe('getMismatchFloaterAnchorTileIds', () => {
    it('returns flip order for two tiles', () => {
        const run = createRun([createTile('a', 'p1', '1'), createTile('b', 'p1', '2')]);
        run.board!.flippedTileIds = ['b', 'a'];
        expect(getMismatchFloaterAnchorTileIds(run)).toEqual({ tileIdA: 'b', tileIdB: 'a' });
    });

    it('returns three ids in flip order for gambit miss', () => {
        const tiles = [createTile('a', 'p1', '1'), createTile('b', 'p2', '2'), createTile('c', 'p3', '3')];
        const run = createRun(tiles);
        run.board!.flippedTileIds = ['a', 'b', 'c'];
        expect(getMismatchFloaterAnchorTileIds(run)).toEqual({
            tileIdA: 'a',
            tileIdB: 'b',
            tileIdC: 'c'
        });
    });

    it('returns null when mismatch floater flip ids are malformed', () => {
        const run = createRun([createTile('a', 'p1', '1'), createTile('b', 'p2', '2')]);
        run.board!.flippedTileIds = Number.NaN as unknown as string[];

        expect(getMismatchFloaterAnchorTileIds(run)).toBeNull();
    });
});

describe('Recall Focus memory loop', () => {
    const createMemorizeRunAfterRecall = (previous: NonNullable<RunState['lastLevelResult']>): RunState =>
        createRun(
            [
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ],
            {
                gameMode: 'endless',
                status: 'memorize',
                lastLevelResult: previous
            }
        );

    const previousRecallResult = (
        overrides: Partial<NonNullable<RunState['lastLevelResult']>> = {}
    ): NonNullable<RunState['lastLevelResult']> => ({
        level: 1,
        scoreGained: 100,
        rating: 'S',
        perfect: true,
        mistakes: 0,
        recallMatches: 2,
        recallBonusScore: RECALL_FOCUS_MATCH_SCORE * 2,
        ...overrides
    });

    it('adds recall score and builds focus on clean remembered matches', () => {
        const run = {
            ...createRun([
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ]),
            // The focus a real run opens with. The fixture zeroes it so score units measure one term.
            recallFocus: INITIAL_RECALL_FOCUS
        };
        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'a2'));

        expect(run.recallFocus).toBe(1);
        expect(resolved.recallFocus).toBe(2);
        expect(resolved.recallMatchesThisFloor).toBe(1);
        expect(resolved.recallBonusScoreThisFloor).toBe(RECALL_FOCUS_MATCH_SCORE);
        expect(resolved.stats.currentLevelScore).toBe(
            calculateMatchScore(1, 1, 1) + RECALL_FOCUS_MATCH_SCORE
        );
    });


    it('caps persisted recall focus before awarding match score', () => {
        const run = {
            ...createRun([
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ]),
            gameMode: 'endless' as const,
            recallFocus: RECALL_FOCUS_MAX + 10
        };
        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'a2'));

        expect(resolved.recallFocus).toBe(RECALL_FOCUS_MAX);
        expect(resolved.recallBonusScoreThisFloor).toBe(RECALL_FOCUS_MAX * RECALL_FOCUS_MATCH_SCORE);
        expect(resolved.stats.currentLevelScore).toBe(
            calculateMatchScore(1, 1, 1) + RECALL_FOCUS_MAX * RECALL_FOCUS_MATCH_SCORE
        );
    });

    it('normalizes malformed persisted counters when assembling a resolved match', () => {
        const base = createRun([
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ]);
        const run = {
            ...base,
            peekCharges: Number.NaN,
            shuffleCharges: 1.9,
            regionShuffleCharges: Number.POSITIVE_INFINITY,
            flashPairCharges: -2,
            wildMatchesRemaining: 1.9,
            stats: {
                ...base.stats,
                matchesFound: Number.NaN,
                bestStreak: Number.POSITIVE_INFINITY,
                highestLevel: Number.NaN
            }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'a2'));

        expect(resolved.peekCharges).toBe(0);
        expect(resolved.shuffleCharges).toBe(1);
        expect(resolved.regionShuffleCharges).toBe(0);
        expect(resolved.flashPairCharges).toBe(0);
        expect(resolved.wildMatchesRemaining).toBe(1);
        expect(resolved.stats.matchesFound).toBe(1);
        expect(resolved.stats.currentStreak).toBe(1);
        expect(resolved.stats.bestStreak).toBe(1);
        expect(resolved.stats.highestLevel).toBe(1);
    });

    it('degrades focus and records forgotten tiles on mismatch and shuffle', () => {
        const run = createRun([
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ]);

        const missed = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'b1'));
        expect(missed.recallFocus).toBe(0);
        expect(missed.recallMistakesThisFloor).toBe(1);
        expect(missed.forgottenTileIdsThisFloor).toEqual(['a1', 'b1']);

        const shuffled = applyShuffle({ ...run, shuffleCharges: 1 });
        expect(shuffled.recallFocus).toBe(0);
        expect(shuffled.forgottenTileIdsThisFloor).toEqual(
            expect.arrayContaining(['a1', 'a2', 'b1', 'b2'])
        );
    });

    it('settles forgotten tile markers when the player recalls and matches them later', () => {
        const run = createRun([
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ]);

        const missed = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'b1'));
        const recovered = resolveBoardTurn(flipTile(flipTile(missed, 'a1'), 'a2'));

        expect(missed.forgottenTileIdsThisFloor).toEqual(['a1', 'b1']);
        expect(recovered.forgottenTileIdsThisFloor).toEqual(['b1']);
        expect(recovered.recallMatchesThisFloor).toBe(1);
    });

    it('carries clean recall discipline into the next memorize phase', () => {
        const run = createMemorizeRunAfterRecall(previousRecallResult());

        expect(finishMemorizePhase(run).recallFocus).toBe(2);
    });

    it('starts the next room unfocused after prior recall mistakes', () => {
        const run = createMemorizeRunAfterRecall(
            previousRecallResult({
                perfect: false,
                mistakes: 1,
                recallMatches: 1,
                recallMistakes: 1
            })
        );

        expect(finishMemorizePhase(run).recallFocus).toBe(0);
    });
});

const pairTileIds = (board: BoardState): string[][] => {
    const groups = new Map<string, string[]>();
    for (const tile of board.tiles) {
        if (!groups.has(tile.pairKey)) {
            groups.set(tile.pairKey, []);
        }
        groups.get(tile.pairKey)!.push(tile.id);
    }
    return [...groups.values()];
};

const clearRealPairs = (run: RunState): RunState => {
    let current = run;
    for (const ids of pairTileIds(current.board!).filter((group) => group.length === 2)) {
        current = resolveBoardTurn(flipTile(flipTile(current, ids[0]!), ids[1]!));
    }
    return current;
};

const SOLVER_IGNORED_PAIR_KEYS = new Set([WILD_PAIR_KEY]);

const solveBoardByExhaustingPairs = (board: BoardState, runSeed: number): RunState => {
    const base = finishMemorizePhase(
        createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed })
    );
    let run: RunState = {
        ...base,
        board,
        status: 'playing',
        findablesTotalThisFloor: countFindablePairs(board.tiles)
    };

    for (let pass = 0; pass < board.pairCount + 4 && run.status === 'playing'; pass += 1) {
        const nextPair = [...new Set(run.board!.tiles.map((tile) => tile.pairKey))]
            .filter((pairKey) => !SOLVER_IGNORED_PAIR_KEYS.has(pairKey))
            .map((pairKey) => run.board!.tiles.filter((tile) => tile.pairKey === pairKey && tile.state === 'hidden'))
            .find((tiles) => tiles.length === 2);
        if (!nextPair) {
            break;
        }
        run = resolveBoardTurn(flipTile(flipTile(run, nextPair[0]!.id), nextPair[1]!.id));
    }
    return run;
};

const solveGeneratedFloorByExhaustingPairs = (input: {
    level: number;
    runSeed: number;
    floorTag?: 'normal' | 'boss' | 'breather';
    floorArchetypeId?: FloorArchetypeId | null;
    activeMutators?: MutatorId[];
}): RunState => {
    const board = buildBoard(input.level, {
        runSeed: input.runSeed,
        runRulesVersion: GAME_RULES_VERSION,
        floorTag: input.floorTag ?? 'normal',
        floorArchetypeId: input.floorArchetypeId ?? null,
        gameMode: 'endless',
        activeMutators: input.activeMutators ?? []
    });
    return solveBoardByExhaustingPairs(board, input.runSeed);
};

const playPerfectFloors = (run: RunState, count: number): RunState => {
    let current = finishMemorizePhase(run);
    for (let floor = 0; floor < count; floor += 1) {
        current = clearRealPairs(current);
        if (floor < count - 1) {
            current = finishMemorizePhase(advanceToNextLevel(current));
        }
    }
    return current;
};


describe('REG-088 first-run to first-win rules path', () => {
    it('clears the first two classic floors with local progress and achievements enabled', () => {
        const finished = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 88_001 }), 2);

        expect(finished.status).toBe('levelComplete');
        expect(finished.gameMode).toBe('endless');
        expect(finished.practiceMode).toBe(false);
        expect(finished.achievementsEnabled).toBe(true);
        expect(finished.stats.levelsCleared).toBe(2);
        expect(finished.stats.highestLevel).toBe(2);
        expect(finished.lastLevelResult?.perfect).toBe(true);
        expect(finished.stats.totalScore).toBeGreaterThan(0);
    });
});


describe('GLD-P0-003 lifecycle advance guards', () => {
    it('refuses to advance runs that are not levelComplete', () => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_003 }));
        const statuses: RunState['status'][] = ['memorize', 'playing', 'resolving', 'paused', 'gameOver'];

        for (const status of statuses) {
            const run: RunState = { ...base, status };

            expect(advanceToNextLevel(run)).toBe(run);
        }
    });



    it('still advances a non-puzzle levelComplete run', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_004 }), 1);

        const next = advanceToNextLevel(cleared);

        expect(next).not.toBe(cleared);
        expect(next.board?.level).toBe((cleared.board?.level ?? 0) + 1);
        expect(next.status).toBe('memorize');
    });

    it('normalizes malformed active mutators before advancing to the next board', () => {
        const cleared = {
            ...playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_004 }), 1),
            activeMutators: Number.NaN as unknown as RunState['activeMutators'],
            wildMenuRun: true
        };

        const next = advanceToNextLevel(cleared);

        expect(next.status).toBe('memorize');
        expect(next.activeMutators).toEqual([]);
    });

    it('normalizes malformed matched-pair history before appending encore keys', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, fixedBoard: null }));
        const [first, second] = [...new Set(run.board!.tiles.map((tile) => tile.pairKey))]
            .filter((pairKey) => !SOLVER_IGNORED_PAIR_KEYS.has(pairKey))
            .map((pairKey) => run.board!.tiles.filter((tile) => tile.pairKey === pairKey && tile.state === 'hidden'))
            .find((tiles) => tiles.length === 2)!;
        const resolved = resolveBoardTurn(
            flipTile(
                flipTile({
                    ...run,
                    matchedPairKeysThisRun: Number.NaN as unknown as string[]
                }, first.id),
                second.id
            )
        );

        expect(resolved.matchedPairKeysThisRun).toEqual([first.pairKey]);
    });

    it('normalizes malformed stats before resolving matched pairs', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, fixedBoard: null }));
        const [first, second] = [...new Set(run.board!.tiles.map((tile) => tile.pairKey))]
            .filter((pairKey) => !SOLVER_IGNORED_PAIR_KEYS.has(pairKey))
            .map((pairKey) => run.board!.tiles.filter((tile) => tile.pairKey === pairKey && tile.state === 'hidden'))
            .find((tiles) => tiles.length === 2)!;

        const resolved = resolveBoardTurn(
            flipTile(
                flipTile({
                    ...run,
                    stats: Number.NaN as unknown as RunState['stats']
                }, first.id),
                second.id
            )
        );

        expect(resolved.stats.matchesFound).toBe(1);
        expect(resolved.stats.highestLevel).toBeGreaterThanOrEqual(1);
    });

    it('recovers a save-loaded paused resolving run with no pending flips', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_013 }));
        const corruptedResolvingPause: RunState = {
            ...playing,
            status: 'paused',
            timerState: {
                ...playing.timerState,
                resolveRemainingMs: 120,
                pausedFromStatus: 'resolving'
            },
            board: playing.board
                ? {
                      ...playing.board,
                      flippedTileIds: []
                  }
                : playing.board
        };

        const resumed = resumeRun(corruptedResolvingPause);

        expect(resumed.status).toBe('playing');
        expect(resumed.timerState.resolveRemainingMs).toBeNull();
        expect(resumed.timerState.pausedFromStatus).toBeNull();
    });

    it('does not resume a paused resolving run that has lost its board', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_014 }));
        const missingBoardPause: RunState = {
            ...playing,
            status: 'paused',
            board: null,
            timerState: {
                ...playing.timerState,
                resolveRemainingMs: 120,
                pausedFromStatus: 'resolving'
            }
        };

        const resumed = resumeRun(missingBoardPause);

        expect(resumed.status).toBe('gameOver');
        expect(resumed.runEndReason).toBe('quit');
        expect(resumed.timerState.resolveRemainingMs).toBeNull();
        expect(resumed.timerState.pausedFromStatus).toBeNull();
    });

});

describe('floor-clear edge cases', () => {















    it('solves generated scheduled floors after exhausting legal pair matches', () => {
        const seeds = [42_001, 172_707, 182_009, 192_012] as const;

        for (const runSeed of seeds) {
            for (let level = 1; level <= 12; level += 1) {
                const run = solveGeneratedFloorByExhaustingPairs({
                    level,
                    runSeed,
                    ...getScheduledSoftlockFloorOptions(level)
                });

                expect(run.status, `seed ${runSeed} level ${level}`).toBe('levelComplete');
            }
        }
    });


    it('solves the default softlock contract scenario matrix through dynamic pair play', () => {
        for (const scenario of DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS) {
            for (const runSeed of scenario.seeds) {
                for (const level of scenario.floors) {
                    const board = buildBoard(level, scenario.optionsForFloor({ seed: runSeed, floor: level }));
                    const run = solveBoardByExhaustingPairs(board, runSeed);

                    expect(
                        run.status,
                        `${scenario.id} seed ${runSeed} level ${level} ${run.board?.floorArchetypeId ?? 'none'}`
                    ).toBe('levelComplete');
                }
            }
        }
    });

































});



describe('endless chapters and featured objectives', () => {
    it('awards only the featured objective bonus on endless floors', () => {
        const started = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        // Floor 1 is two suits of two pairs, and a match pops its own suit's other pair, so the
        // floor takes one match per suit. `clearRealPairs` walks whatever is still standing.
        const finished = clearRealPairs(started);

        expect(finished.status).toBe('levelComplete');
        expect(finished.lastLevelResult?.featuredObjectiveId).toBe('flip_par');
        expect(finished.lastLevelResult?.featuredObjectiveCompleted).toBe(true);
        expect(finished.lastLevelResult?.objectiveBonusScore).toBe(FLIP_PAR_BONUS_SCORE);
        expect(finished.lastLevelResult?.bonusTags).toContain('flip_par');
        expect(finished.lastLevelResult?.bonusTags).not.toContain('scholar_style');
        expect(finished.lastLevelResult?.bonusTags).not.toContain('cursed_last');
    });


    it('builds a featured-objective streak and awards a score kicker after the first clear', () => {
        const started = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));

        const firstFinished = clearRealPairs(started);
        expect(firstFinished.lastLevelResult?.featuredObjectiveStreak).toBe(1);
        expect(firstFinished.lastLevelResult?.featuredObjectiveStreakBonus).toBeUndefined();

        const secondStarted = finishMemorizePhase(advanceToNextLevel(firstFinished));
        const secondFinished = clearRealPairs(secondStarted);

        expect(secondFinished.status).toBe('levelComplete');
        expect(secondFinished.featuredObjectiveStreak).toBe(2);
        expect(secondFinished.lastLevelResult?.featuredObjectiveStreak).toBe(2);
        expect(secondFinished.lastLevelResult?.featuredObjectiveStreakBonus).toBe(
            FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP
        );
        expect(secondFinished.lastLevelResult?.bonusTags).toContain('objective_streak');
    });

    it('decays the featured-objective streak when a non-wager objective is missed', () => {
        const started = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        // Over par, so the objective is missed, but under the floor's turn ceiling, so the run
        // does not end before the floor does.
        const primed: RunState = {
            ...started,
            featuredObjectiveStreak: 3,
            turnsThisFloor: parTurnsForFloor(started.board!.pairCount) + 1
        };

        const finished = clearRealPairs(primed);

        expect(finished.status).toBe('levelComplete');
        expect(finished.lastLevelResult?.featuredObjectiveCompleted).toBe(false);
        expect(finished.featuredObjectiveStreak).toBe(1);
        expect(finished.lastLevelResult?.featuredObjectiveStreak).toBe(1);
        expect(finished.lastLevelResult?.featuredObjectiveStreakBonus).toBeUndefined();
    });









    it('only generates cursedPairKey on cursed-last featured-objective floors', () => {
        const flipParBoard = buildBoard(1, {
            runSeed: 1234,
            runRulesVersion: GAME_RULES_VERSION,
            activeMutators: ['wide_recall'],
            floorTag: 'normal',
            floorArchetypeId: 'survey_hall',
            featuredObjectiveId: 'flip_par'
        });
        const cursedBoard = buildBoard(4, {
            runSeed: 1234,
            runRulesVersion: GAME_RULES_VERSION,
            activeMutators: ['silhouette_twist'],
            floorTag: 'normal',
            floorArchetypeId: 'shadow_read',
            featuredObjectiveId: 'cursed_last'
        });

        expect(flipParBoard.cursedPairKey).toBeNull();
        expect(cursedBoard.cursedPairKey).not.toBeNull();
    });
});

describe('game rules', () => {
    it('builds a progressively larger board and memorize duration falls on a gentler step than pair growth', () => {
        const board = buildBoard(4);

        // Floor 4 is the first procedural floor, and the pair curve (`pair-curve.ts`) deals it.
        expect(board.level).toBe(4);
        expect(board.pairCount).toBe(pairsForFloor(4));
        expect(board.pairCount).toBe(9);
        expect(board.tiles).toHaveLength(18);
        expect(board.columns).toBeGreaterThanOrEqual(2);
        // Per-tile budget over the curve's board: 8 tiles at floor 1, 12 at floor 2, 14 at floor 3,
        // 34 at floor 20 on the floor of the per-tile budget, 38 at floor 29 - under the cap now
        // that the curve is tempered.
        expect(getMemorizeDuration(1)).toBe(2600);
        expect(getMemorizeDuration(2)).toBe(3756);
        expect(getMemorizeDuration(3)).toBe(4214);
        expect(getMemorizeDuration(20)).toBe(3740);
        expect(getMemorizeDuration(29)).toBe(4180);
    });

    it('uses staged symbol bands by level when category_letters is off', () => {
        const numericBand = buildBoard(4, { runSeed: 11_022, runRulesVersion: GAME_RULES_VERSION });
        expect(numericBand.tiles.some((t) => /^\d{2}$/.test(t.symbol))).toBe(true);
        const letterBand = buildBoard(10, { runSeed: 11_022, runRulesVersion: GAME_RULES_VERSION });
        expect(letterBand.tiles.some((t) => /^[A-Z1-4]$/.test(t.symbol))).toBe(true);
    });

    it('applies flat presentation mutator penalties to each match score', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const started = {
            ...createRun(tiles),
            activeMutators: ['wide_recall', 'silhouette_twist', 'distraction_channel'] as MutatorId[]
        };
        const penalty = getPresentationMutatorMatchPenalty(started);
        expect(penalty).toBe(14);
        const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));
        const base = calculateMatchScore(1, 1, 1);
        expect(resolved.stats.totalScore).toBe(Math.max(0, base - penalty));
    });

    it('costs a miss a try, a turn and half the streak, and nothing else', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const started = {
            ...createRun(tiles),
            stats: {
                ...createRun(tiles).stats,
                currentStreak: 2
            }
        };
        const flippedOnce = flipTile(started, 'a1');
        const flippedTwice = flipTile(flippedOnce, 'b1');
        const resolved = resolveBoardTurn(flippedTwice);

        expect(resolved.status).toBe('playing');
        expect(resolved.runEndReason).toBeNull();
        expect(resolved.turnsThisFloor).toBe(1);
        expect(resolved.stats.tries).toBe(1);
        expect(resolved.stats.mismatches).toBe(1);
        expect(resolved.stats.currentStreak).toBe(1);
        expect(resolved.stats.totalScore).toBe(0);
        expect(resolved.board?.tiles.every((tile) => tile.state === 'hidden')).toBe(true);
    });

    it('treats the second miss of a floor exactly like the first, on any floor', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const started = {
            ...createRun(tiles),
            board: { ...createBoard(tiles), level: 2 },
            stats: {
                ...createRun(tiles).stats,
                tries: 1
            }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'b1'));

        expect(resolved.status).toBe('playing');
        expect(resolved.runEndReason).toBeNull();
        expect(resolved.stats.tries).toBe(2);
        expect(resolved.stats.mismatches).toBe(1);
        expect(resolved.stats.currentStreak).toBe(0);
    });

    it('keeps mismatch resolve delay but resolves matching flips immediately', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const started = createRun(tiles);

        const mismatchPending = flipTile(flipTile(started, 'a1'), 'b1');
        expect(mismatchPending.status).toBe('resolving');
        expect(mismatchPending.timerState.resolveRemainingMs).toBe(MATCH_DELAY_MS);

        const matchPending = flipTile(flipTile(started, 'a1'), 'a2');
        expect(matchPending.status).toBe('resolving');
        expect(matchPending.timerState.resolveRemainingMs).toBe(0);
    });

    it('awards immediate match score and the floor-end bonus on a flawless level', () => {
        const tiles: Tile[] = [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')];
        const started = createRun(tiles);
        const flippedOnce = flipTile(started, 'a1');
        const flippedTwice = flipTile(flippedOnce, 'a2');
        const resolved = resolveBoardTurn(flippedTwice);

        expect(resolved.status).toBe('levelComplete');
        expect(resolved.runEndReason).toBeNull();
        /*
         * 30 for the match and 150 for the floor - 100 for the clear plus the 50 under-par
         * efficiency - plus 50 in floor objectives. The efficiency half is new since Gen 210: par on
         * a one-pair floor was one turn and clearing it takes one, so this fixture was level with
         * par rather than under it. Par on a small floor gets a turn back now.
         */
        expect(resolved.stats.totalScore).toBe(230);
        expect(resolved.stats.currentLevelScore).toBe(230);
        expect(resolved.lastLevelResult).toMatchObject({ turnsTaken: 1, playScore: 30, floorBonus: 150, floorBonusTierMult: 1 });
        expect(resolved.lastLevelResult?.parTurns).toBe(parTurnsForFloor(resolved.board?.pairCount ?? 0));
        expect(resolved.stats.bestStreak).toBe(1);
        expect(resolved.stats.perfectClears).toBe(1);
        expect(resolved.lastLevelResult?.perfect).toBe(true);
        expect(resolved.lastLevelResult?.mistakes).toBe(0);
        expect(resolved.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'board.turn_resolve' })
        ]);
        expect(resolved.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'board.turn_resolved',
                outcome: 'match',
                boardComplete: true,
                statusAfter: 'levelComplete'
            })
        ]));
    });

    it('normalizes malformed persisted counters when finalizing a cleared floor', () => {
        const tiles: Tile[] = [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')];
        const started = {
            ...createRun(tiles),
            stats: {
                ...createRun(tiles).stats,
                tries: Number.NaN,
                totalScore: Number.NaN,
                currentLevelScore: -12,
                bestScore: Number.POSITIVE_INFINITY,
                levelsCleared: Number.NaN,
                highestLevel: Number.NaN,
                perfectClears: Number.NaN
            }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));

        expect(resolved.status).toBe('levelComplete');
        // 230 rather than 180 since Gen 210: a one-pair floor's par is two turns, so a clear in one
        // is under par and earns the efficiency bonus it always should have.
        expect(resolved.stats.totalScore).toBe(230);
        expect(resolved.stats.currentLevelScore).toBe(230);
        expect(resolved.stats.bestScore).toBe(230);
        expect(resolved.stats.levelsCleared).toBe(1);
        expect(resolved.stats.highestLevel).toBe(1);
        expect(resolved.stats.perfectClears).toBe(1);
        expect(resolved.lastLevelResult?.mistakes).toBe(0);
    });

    it('scales streak score within a level before the clear bonus lands', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const started = createRun(tiles);
        const firstMatch = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));
        const secondMatch = resolveBoardTurn(flipTile(flipTile(firstMatch, 'b1'), 'b2'));

        expect(firstMatch.stats.totalScore).toBe(30);
        expect(firstMatch.stats.currentStreak).toBe(1);
        expect(secondMatch.status).toBe('levelComplete');
        // Two turns on a two-pair floor whose par is two since Gen 210: the clear now comes in ON
        // par rather than over it, so the efficiency bonus lands and the within-par objective holds.
        expect(secondMatch.stats.totalScore).toBe(70 + RECALL_FOCUS_MATCH_SCORE + 100 + 50 + 45);
        expect(secondMatch.lastLevelResult).toMatchObject({ parTurns: 2, turnsTaken: 2 });
        /*
         * Two turns on a two-pair floor is ON par since Gen 210 rather than over it, so the
         * within-par objective pays its 45 and the total above carries it. The assertion here used
         * to read `floorEfficiencyBonus: undefined` - a field this result never carries, so a
         * condition nothing could fail either way.
         */
        expect(secondMatch.lastLevelResult?.floorBonus).toBe(100);
        expect(secondMatch.stats.totalScore - (70 + RECALL_FOCUS_MATCH_SCORE + 100 + 50)).toBe(45);
        expect(secondMatch.stats.bestStreak).toBe(2);
    });

    it('pays a floor finished with one mistake the same as a flawless one', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const mismatched = resolveBoardTurn(flipTile(flipTile(createRun(tiles), 'a1'), 'b1'));
        const firstMatch = resolveBoardTurn(flipTile(flipTile(mismatched, 'a1'), 'a2'));
        const resolved = resolveBoardTurn(flipTile(flipTile(firstMatch, 'b1'), 'b2'));

        expect(resolved.status).toBe('levelComplete');
        expect(resolved.runEndReason).toBeNull();
        // A miss is a turn too: three turns against a par of one, and the floor pays the same as the flawless one.
        expect(resolved.stats.totalScore).toBe(70 + RECALL_FOCUS_MATCH_SCORE + 100 + 50);
        expect(resolved.lastLevelResult?.turnsTaken).toBe(3);
        expect(resolved.lastLevelResult?.perfect).toBe(false);
        expect(resolved.lastLevelResult?.mistakes).toBe(1);
    });



    it('advances to the next level in memorize phase, resets floor state, and preserves banked sustain', () => {
        const finishedLevel = {
            ...createNewRun(250),
            status: 'levelComplete' as const,
            stats: {
                ...createNewRun(250).stats,
                tries: 4,
                totalScore: 300,
                currentLevelScore: 145,
                currentStreak: 3,
                bestStreak: 3,
                perfectClears: 1,
                highestLevel: 1
            },
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            }
        };
        const nextRun = advanceToNextLevel(finishedLevel);

        expect(nextRun.status).toBe('memorize');
        expect(nextRun.board?.level).toBe(2);
        expect(nextRun.stats.tries).toBe(0);
        expect(nextRun.stats.currentLevelScore).toBe(0);
        expect(nextRun.stats.currentStreak).toBe(0);
        // Arriving on a floor also seats its resident, and some of them hand over a peek, a
        // shuffle or a longer look. Read the resident's contribution from the same seed the
        // advance used, so this stays an assertion about what carries over rather than a bet on
        // who happened to be downstairs.
        const resident = pickFloorCurio(finishedLevel.runSeed, 2, finishedLevel.runRulesVersion);

        expect(nextRun.floorCurioId).toBe(resident.id);
        expect(nextRun.stats.totalScore).toBe(300);
        expect(nextRun.timerState.memorizeRemainingMs).toBe(
            Math.max(
                MIN_CURIO_MEMORIZE_MS,
                getMemorizeDurationForRun(
                    { ...finishedLevel, activeMutators: nextRun.activeMutators, board: nextRun.board },
                    nextRun.board!.level
                ) + resident.effect.memorizeBonusMs
            )
        );
        expect(nextRun.shuffleCharges).toBe(1 + resident.effect.shuffleCharges);
        expect(nextRun.pinnedTileIds).toEqual([]);
    });


    it('can disable achievements when debug reveal is used', () => {
        const run = enableDebugPeek(finishMemorizePhase(createNewRun(0)), true);

        expect(run.debugPeekActive).toBe(true);
        expect(run.debugUsed).toBe(true);
        expect(run.achievementsEnabled).toBe(false);
        expect(run.timerState.debugRevealRemainingMs).toBeGreaterThan(0);
    });
});

describe('board powers', () => {
    it('counts fully hidden pairs', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        expect(countFullyHiddenPairs(createBoard(tiles))).toBe(2);

        const oneFlipped = createBoard(
            tiles.map((t) => (t.id === 'a1' ? { ...t, state: 'flipped' as const } : t))
        );
        expect(countFullyHiddenPairs(oneFlipped)).toBe(1);
    });

    it('shuffles only hidden tiles, spends charge, clears pins, and flags powers used', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B'),
            createTile('c1', 'C', 'C'),
            createTile('c2', 'C', 'C')
        ];
        const matchedBoard: BoardState = {
            ...createBoard(tiles),
            matchedPairs: 1,
            tiles: tiles.map((t) => (t.pairKey === 'A' ? { ...t, state: 'matched' as const } : t))
        };
        const run = {
            ...createRun(tiles),
            board: matchedBoard,
            pinnedTileIds: ['b1']
        };
        const beforeHidden = run.board.tiles.filter((t) => t.state === 'hidden').map((t) => t.id);
        const shuffled = applyShuffle(run);
        expect(shuffled.shuffleCharges).toBe(0);
        expect(shuffled.powersUsedThisRun).toBe(true);
        expect(shuffled.pinnedTileIds).toEqual([]);
        expect(shuffled.stats.shufflesUsed).toBe(1);
        const afterHidden = shuffled.board!.tiles.filter((t) => t.state === 'hidden').map((t) => t.id);
        expect(new Set(afterHidden)).toEqual(new Set(beforeHidden));
        const matchedIds = shuffled.board!.tiles.filter((t) => t.state === 'matched').map((t) => t.id);
        expect(matchedIds.sort()).toEqual(['a1', 'a2'].sort());
    });

    it('does not shuffle with one fully hidden pair or zero charges', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const run = createRun(tiles);
        expect(applyShuffle(run)).toBe(run);
        expect(canShuffleBoard({ ...run, shuffleCharges: 0 })).toBe(false);
    });

    it('toggles pins up to cap', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        let run = createRun(tiles);
        run = togglePinnedTile(run, 'a1');
        expect(run.pinnedTileIds).toEqual(['a1']);
        run = togglePinnedTile(run, 'b1');
        run = togglePinnedTile(run, 'a2');
        expect(run.pinnedTileIds).toHaveLength(3);
        const before = run.pinnedTileIds;
        run = togglePinnedTile(run, 'b2');
        expect(run.pinnedTileIds).toEqual(before);
        run = togglePinnedTile(run, 'a1');
        expect(run.pinnedTileIds).not.toContain('a1');
    });


    describe('board power preview helpers', () => {

        it('peek preview excludes tiles already peek-revealed', () => {
            const tiles: Tile[] = [
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A')
            ];
            const board = createRun(tiles).board!;
            expect(tileIsPeekEligiblePreview(board, [], 'a1')).toBe(true);
            expect(tileIsPeekEligiblePreview(board, ['a1'], 'a1')).toBe(false);
            expect(collectPeekEligibleTileIds(board, ['a1'])).toEqual(new Set(['a2']));
        });



    });

    describe('board completion', () => {
        it('isBoardComplete once every real pair is matched, whatever a singleton is doing', () => {
            const board = buildBoard(2, {
                activeMutators: [],
                runSeed: 90210,
                runRulesVersion: GAME_RULES_VERSION
            });
            const cleared: BoardState = {
                ...board,
                tiles: board.tiles.map((t) =>
                    isSingletonUtilityPairKey(t.pairKey) ? t : { ...t, state: 'matched' as const }
                )
            };
            expect(isBoardComplete(cleared)).toBe(true);
        });
    });

    describe('findables_floor', () => {
        it('spawns exactly one pickup pair on early procedural floors', () => {
            const board = buildBoard(2, {
                activeMutators: [],
                runSeed: 90210,
                runRulesVersion: GAME_RULES_VERSION
            });
            const tagged = board.tiles.filter((t) => t.findableKind != null);
            expect(tagged).toHaveLength(2);
            expect(new Set(tagged.map((t) => t.pairKey)).size).toBe(1);
        });

        it('spawns one or two pickup pairs on later procedural floors', () => {
            const board = buildBoard(5, {
                activeMutators: [],
                runSeed: 1337,
                runRulesVersion: GAME_RULES_VERSION
            });
            const tagged = board.tiles.filter((t) => t.findableKind != null);
            expect([2, 4]).toContain(tagged.length);
            expect(tagged.every((t) => t.pairKey !== '__wild__')).toBe(true);
        });

        it('dense-pickup mutator guarantees two pickup pairs on new rules', () => {
            const board = buildBoard(5, {
                activeMutators: ['findables_floor'],
                runSeed: 90210,
                runRulesVersion: GAME_RULES_VERSION
            });
            const tagged = board.tiles.filter((t) => t.findableKind != null);
            expect(tagged).toHaveLength(4);
            expect(new Set(tagged.map((t) => t.pairKey)).size).toBe(2);
        });

        it('keeps legacy mutator-gated pickup generation for older rules', () => {
            /** Rules before v8 use legacy findable assignment (`legacyFindables` in `assignFindableKindsToTiles`). */
            const legacyRulesVersion = 7;
            let seededBoardWithMutator: BoardState | null = null;
            let seededBoardWithoutMutator: BoardState | null = null;
            for (let seed = 1; seed < 512; seed += 1) {
                const withMutator = buildBoard(3, {
                    activeMutators: ['findables_floor'],
                    runSeed: seed,
                    runRulesVersion: legacyRulesVersion
                });
                if (withMutator.tiles.some((tile) => tile.findableKind != null)) {
                    seededBoardWithMutator = withMutator;
                    seededBoardWithoutMutator = buildBoard(3, {
                        activeMutators: [],
                        runSeed: seed,
                        runRulesVersion: legacyRulesVersion
                    });
                    break;
                }
            }

            expect(seededBoardWithMutator).not.toBeNull();
            expect(seededBoardWithMutator!.tiles.some((tile) => tile.findableKind != null)).toBe(true);
            expect(seededBoardWithoutMutator!.tiles.some((tile) => tile.findableKind != null)).toBe(false);
        });

        it('tags only whole real pairs and never the wild singleton', () => {
            const board = buildBoard(2, {
                activeMutators: ['findables_floor'],
                runSeed: 90210,
                runRulesVersion: GAME_RULES_VERSION
            });
            const tagged = board.tiles.filter((t) => t.findableKind != null);
            expect(tagged.length % 2).toBe(0);
            expect(tagged.length).toBeLessThanOrEqual(4);
            const keys = new Set(tagged.map((t) => t.pairKey));
            expect(keys.size * 2).toBe(tagged.length);
            expect(tagged.every((t) => t.pairKey !== '__wild__')).toBe(true);
        });


        it('produces identical findable placement for the same seed and rules', () => {
            const opts = {
                activeMutators: ['findables_floor'] as MutatorId[],
                runSeed: 4242,
                runRulesVersion: GAME_RULES_VERSION
            };
            const a = buildBoard(3, opts);
            const b = buildBoard(3, opts);
            expect(a.tiles.map((t) => [t.id, t.findableKind])).toEqual(b.tiles.map((t) => [t.id, t.findableKind]));
        });

        it('claims score glint for flat score immediately', () => {
            const tiles: Tile[] = [
                { ...createTile('a1', 'A', 'A'), findableKind: 'score_glint' },
                { ...createTile('a2', 'A', 'A'), findableKind: 'score_glint' },
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ];
            const started = { ...createRun(tiles), findablesClaimedThisFloor: 0, findablesTotalThisFloor: 1 };
            const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));
            const base = calculateMatchScore(1, 1, 1);
            expect(resolved.stats.totalScore).toBe(base + FINDABLE_MATCH_SCORE.score_glint);
            expect(resolved.findablesClaimedThisFloor).toBe(1);
            expect(resolved.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.turn_resolve' })
            ]);
            expect(resolved.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'score.requested', reason: 'findable_match', amount: 25 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.score_glint.matched' })
            ]));
        });




        it('preserves findableKind on tile ids through shuffle', () => {
            const tiles: Tile[] = [
                { ...createTile('a1', 'A', 'A'), findableKind: 'score_glint' },
                { ...createTile('a2', 'A', 'A'), findableKind: 'score_glint' },
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ];
            const run = { ...createRun(tiles), shuffleCharges: 1, shuffleNonce: 0 };
            const carrierId = run.board!.tiles.find((t) => t.findableKind != null)!.id;
            const before = run.board!.tiles.find((t) => t.id === carrierId)!.findableKind;
            const shuffled = applyShuffle(run);
            expect(shuffled.board!.tiles.find((t) => t.id === carrierId)!.findableKind).toBe(before);
        });

        it('resets findablesClaimedThisFloor on advanceToNextLevel', () => {
            const tiles: Tile[] = [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')];
            const finishedLevel = {
                ...createRun(tiles),
                gameMode: 'endless' as const,
                findablesClaimedThisFloor: 2,
                findablesTotalThisFloor: 2,
                status: 'levelComplete' as const,
                board: {
                    ...createRun(tiles).board!,
                    matchedPairs: 1,
                    flippedTileIds: [],
                    tiles: tiles.map((t) => ({ ...t, state: 'matched' as const }))
                }
            };
            const next = advanceToNextLevel(finishedLevel);
            expect(next.findablesClaimedThisFloor).toBe(0);
            expect(next.findablesTotalThisFloor).toBeGreaterThan(0);
        });
    });

    describe('shifting_spotlight', () => {
        const twoPairTiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];

        it('seeds ward and bounty keys on buildBoard when mutator is active', () => {
            const board = buildBoard(2, {
                activeMutators: ['shifting_spotlight'] as MutatorId[],
                runSeed: 31415,
                runRulesVersion: GAME_RULES_VERSION
            });
            expect(board.bountyPairKey != null || board.wardPairKey != null).toBe(true);
            if (board.wardPairKey && board.bountyPairKey) {
                expect(board.wardPairKey).not.toBe(board.bountyPairKey);
            }
        });

        it('adds bounty bonus when the matched pair is the current bounty', () => {
            const brd = {
                ...createBoard(twoPairTiles),
                wardPairKey: 'B' as const,
                bountyPairKey: 'A' as const
            };
            const started: RunState = {
                ...createRun(twoPairTiles),
                board: brd,
                activeMutators: ['shifting_spotlight'] as MutatorId[],
                shiftingSpotlightNonce: 0
            };
            const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));
            const base = calculateMatchScore(1, 1, 1);
            expect(resolved.stats.totalScore).toBe(base + SHIFTING_BOUNTY_MATCH_BONUS);
            expect(resolved.shiftingSpotlightNonce).toBe(1);
        });

        it('applies ward penalty when the matched pair is the current ward', () => {
            const brd = {
                ...createBoard(twoPairTiles),
                wardPairKey: 'A' as const,
                bountyPairKey: 'B' as const
            };
            const started: RunState = {
                ...createRun(twoPairTiles),
                board: brd,
                activeMutators: ['shifting_spotlight'] as MutatorId[],
                shiftingSpotlightNonce: 0
            };
            const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));
            expect(resolved.stats.totalScore).toBe(
                Math.max(0, calculateMatchScore(1, 1, 1) - SHIFTING_WARD_MATCH_PENALTY)
            );
        });

        it('rotates and bumps nonce on mismatch', () => {
            const brd = {
                ...createBoard(twoPairTiles),
                wardPairKey: 'A' as const,
                bountyPairKey: 'B' as const
            };
            const started: RunState = {
                ...createRun(twoPairTiles),
                board: brd,
                activeMutators: ['shifting_spotlight'] as MutatorId[],
                shiftingSpotlightNonce: 0
            };
            const out = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'b1'));
            expect(out.shiftingSpotlightNonce).toBe(1);
        });

        it('resets shiftingSpotlightNonce on advanceToNextLevel', () => {
            const tiles = [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')];
            const finishedLevel: RunState = {
                ...createRun(tiles),
                gameMode: 'endless',
                shiftingSpotlightNonce: 12,
                status: 'levelComplete',
                board: {
                    ...createRun(tiles).board!,
                    matchedPairs: 1,
                    flippedTileIds: [],
                    tiles: tiles.map((t) => ({ ...t, state: 'matched' as const }))
                }
            };
            expect(advanceToNextLevel(finishedLevel).shiftingSpotlightNonce).toBe(0);
        });
    });
});

describe('gambit third flip', () => {
    const twoPairTiles: Tile[] = [
        createTile('a1', 'p1', 'A'),
        createTile('a2', 'p1', 'A'),
        createTile('b1', 'p2', 'B'),
        createTile('b2', 'p2', 'B')
    ];

    it('resolves a match when the third flip completes a pair after a mismatch', () => {
        let run = createRun(twoPairTiles);
        run = flipTile(run, 'a1');
        run = flipTile(run, 'b1');
        expect(run.board!.flippedTileIds).toHaveLength(2);
        run = flipTile(run, 'a2');
        expect(run.status).toBe('resolving');
        expect(run.board!.flippedTileIds).toHaveLength(3);
        const resolved = resolveBoardTurn(run);
        expect(resolved.gambitThirdFlipUsed).toBe(true);
        expect(resolved.gambitAvailableThisFloor).toBe(false);
        expect(resolved.board!.matchedPairs).toBe(1);
        expect(resolved.board!.tiles.find((t) => t.id === 'b1')?.state).toBe('hidden');
        expect(resolved.status).toBe('playing');
    });

    it('refuses gambit resolution when a flipped tile id is stale', () => {
        const run = createRun(twoPairTiles, {
            status: 'resolving',
            board: {
                ...createBoard([
                    { ...twoPairTiles[0], state: 'flipped' as const },
                    { ...twoPairTiles[2], state: 'flipped' as const },
                    twoPairTiles[1],
                    twoPairTiles[3]
                ]),
                flippedTileIds: ['a1', 'b1', 'missing']
            },
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false
        });

        expect(resolveBoardTurn(run)).toBe(run);
    });

    it('gambit miss forces game over when maxMismatches would be exceeded', () => {
        const threePairTiles: Tile[] = [
            createTile('a1', 'p1', 'A'),
            createTile('a2', 'p1', 'A'),
            createTile('b1', 'p2', 'B'),
            createTile('b2', 'p2', 'B'),
            createTile('c1', 'p3', 'C'),
            createTile('c2', 'p3', 'C')
        ];
        const base = createRun(threePairTiles);
        let run: RunState = {
            ...base,
            activeContract: { noShuffle: false, maxMismatches: 1 },
            stats: { ...base.stats, tries: 1 }
        };
        run = flipTile(run, 'a1');
        run = flipTile(run, 'b1');
        run = flipTile(run, 'c1');
        expect(run.board!.flippedTileIds).toHaveLength(3);
        const resolved = resolveBoardTurn(run);
        expect(resolved.gambitThirdFlipUsed).toBe(true);
        expect(resolved.status).toBe('gameOver');
        expect(resolved.stats.tries).toBe(2);
    });

    it('gambit miss forces game over when maxMismatches is 0 and floor tries are still zero', () => {
        const threePairTiles: Tile[] = [
            createTile('a1', 'p1', 'A'),
            createTile('a2', 'p1', 'A'),
            createTile('b1', 'p2', 'B'),
            createTile('b2', 'p2', 'B'),
            createTile('c1', 'p3', 'C'),
            createTile('c2', 'p3', 'C')
        ];
        const base = createRun(threePairTiles);
        let run: RunState = {
            ...base,
            activeContract: { noShuffle: false, maxMismatches: 0 },
            stats: { ...base.stats, tries: 0 }
        };
        run = flipTile(run, 'a1');
        run = flipTile(run, 'b1');
        run = flipTile(run, 'c1');
        const resolved = resolveBoardTurn(run);
        expect(resolved.gambitThirdFlipUsed).toBe(true);
        expect(resolved.status).toBe('gameOver');
        expect(resolved.stats.tries).toBe(1);
    });
});

describe('applyFlashPair', () => {
    it('is a no-op outside practice and wild menu runs even if charges are present', () => {
        let run = finishMemorizePhase(createNewRun(0, { gameMode: 'endless' }));
        run = { ...run, status: 'playing', flashPairCharges: 1 };
        expect(applyFlashPair(run)).toBe(run);
    });
});

describe('wildTileId bookkeeping', () => {
    it('sets wildTileId to the wild tile id in createWildRun', () => {
        const run = createWildRun(0);
        expect(run.board).not.toBeNull();
        const board = run.board!;
        const wild = board.tiles.find((t) => t.pairKey === WILD_PAIR_KEY);
        expect(wild).toBeDefined();
        expect(getWildTileIdFromBoard(board)).toBe(wild!.id);
    });

    it('leaves wildTileId null when no wild tile is on the board', () => {
        const run = createNewRun(0, { gameMode: 'endless' });
        expect(run.board).not.toBeNull();
        expect(getWildTileIdFromBoard(run.board!)).toBeNull();
    });

    it('consumes one token per wild match and journals the wildcard bridge', () => {
        const wild = createTile('wild', WILD_PAIR_KEY, 'Wild');
        const target = createTile('a1', 'A', 'A');
        const withTwoTokens = {
            ...createRun([wild, target, createTile('a2', 'A', 'A')]),
            status: 'playing' as const,
            wildMatchesRemaining: 2,
            wildTileId: wild.id
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(withTwoTokens, wild.id), target.id));

        expect(resolved.wildMatchesRemaining).toBe(1);
        expect(resolved.powersUsedThisRun).toBe(true);
        expect(resolved.gameplayCommandJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'board.turn_resolve'
            })
        ]));
        expect(resolved.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'wild_match.consumed',
                tokensBefore: 2,
                tokensAfter: 1
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'wild_joker.match_consumed' })
        ]));
    });

    it('keeps wildTileId aligned with the board after advanceToNextLevel', () => {
        const start = finishMemorizePhase(createWildRun(0));
        expect(getWildTileIdFromBoard(start.board!)).not.toBeNull();
        const b = start.board!;
        const cleared = {
            ...start,
            status: 'levelComplete' as const,
            lastLevelResult: {
                level: b.level,
                scoreGained: 100,
                rating: 'S' as const,
                perfect: true,
                mistakes: 0
            },
            board: {
                ...b,
                matchedPairs: b.pairCount,
                flippedTileIds: [],
                tiles: b.tiles.map((t) => ({ ...t, state: 'matched' as const }))
            }
        };
        const next = advanceToNextLevel(cleared);
        expect(next.board).not.toBeNull();
        expect(next.wildMatchesRemaining).toBe(1);
        expect(getWildTileIdFromBoard(next.board!)).not.toBeNull();
    });
});

describe('wild run with scholar-style contracts', () => {

    it('noShuffle blocks full-board shuffle on a real wild run', () => {
        let wild = finishMemorizePhase(createWildRun(0));
        wild = {
            ...wild,
            status: 'playing',
            shuffleCharges: 1,
            activeContract: { noShuffle: true, maxMismatches: null }
        };
        expect(canShuffleBoard(wild)).toBe(false);
        expect(applyShuffle(wild)).toBe(wild);
    });
});

describe('active contract limits', () => {
    const fourPairTiles: Tile[] = [
        createTile('a1', 'A', 'A'),
        createTile('a2', 'A', 'A'),
        createTile('b1', 'B', 'B'),
        createTile('b2', 'B', 'B')
    ];

    it('ends the run when mismatches exceed maxMismatches', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            activeContract: { noShuffle: false, maxMismatches: 0 }
        };
        const mismatching = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'b1'));
        expect(mismatching.status).toBe('gameOver');
    });

    it('blocks shuffle when contract sets noShuffle', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            shuffleCharges: 1,
            activeContract: { noShuffle: true, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(applyShuffle(run)).toBe(run);
    });


    it('respects maxPinsTotalRun when adding new pins', () => {
        let run: RunState = {
            ...createRun(fourPairTiles),
            activeContract: { noShuffle: false, maxMismatches: null, maxPinsTotalRun: 1 }
        };
        run = togglePinnedTile(run, 'a1');
        expect(run.pinnedTileIds).toEqual(['a1']);
        expect(run.pinsPlacedCountThisRun).toBe(1);
        const capped = togglePinnedTile(run, 'b1');
        expect(capped.pinnedTileIds).toEqual(['a1']);
        expect(capped.pinsPlacedCountThisRun).toBe(1);
    });

    it('respects maxPinsTotalRun when adding new pins with presentation mutators active', () => {
        let run: RunState = {
            ...createRun(fourPairTiles),
            activeMutators: ['wide_recall'] as MutatorId[],
            activeContract: { noShuffle: false, maxMismatches: null, maxPinsTotalRun: 1 }
        };
        run = togglePinnedTile(run, 'a1');
        expect(run.pinnedTileIds).toEqual(['a1']);
        expect(run.pinsPlacedCountThisRun).toBe(1);
        const capped = togglePinnedTile(run, 'b1');
        expect(capped.pinnedTileIds).toEqual(['a1']);
        expect(capped.pinsPlacedCountThisRun).toBe(1);
    });

    it('ends the run on the second mismatch when maxMismatches is 1 while presentation mutators are active', () => {
        const sixTiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B'),
            createTile('c1', 'C', 'C'),
            createTile('c2', 'C', 'C')
        ];
        const run: RunState = {
            ...createRun(sixTiles),
            activeMutators: ['wide_recall', 'silhouette_twist'] as MutatorId[],
            activeContract: { noShuffle: false, maxMismatches: 1 }
        };
        const afterFirstMiss = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'b1'));
        expect(afterFirstMiss.status).toBe('playing');
        expect(afterFirstMiss.stats.tries).toBe(1);
        const afterSecondMiss = resolveBoardTurn(flipTile(flipTile(afterFirstMiss, 'a2'), 'c1'));
        expect(afterSecondMiss.status).toBe('gameOver');
    });

    it('still applies presentation match penalty when a contract is active', () => {
        const run: RunState = {
            ...createRun([
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ]),
            activeMutators: ['distraction_channel'] as MutatorId[],
            activeContract: { noShuffle: true, maxMismatches: null }
        };
        const penalty = getPresentationMutatorMatchPenalty(run);
        expect(penalty).toBe(4);
        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'a2'));
        const base = calculateMatchScore(1, 1, 1);
        expect(resolved.stats.totalScore).toBe(Math.max(0, base - penalty));
    });

    it('blocks shuffle under noShuffle with presentation mutators active', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            shuffleCharges: 1,
            activeMutators: ['wide_recall', 'distraction_channel'] as MutatorId[],
            activeContract: { noShuffle: true, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(applyShuffle(run)).toBe(run);
    });



    it('blocks region shuffle under noShuffle with presentation mutators active', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            activeMutators: ['wide_recall'] as MutatorId[],
            activeContract: { noShuffle: true, maxMismatches: null }
        };
        expect(canRegionShuffle(run)).toBe(false);
        expect(applyRegionShuffle(run, 0)).toBe(run);
    });







});




