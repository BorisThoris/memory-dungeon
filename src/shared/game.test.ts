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
    FINDABLE_MATCH_COMBO_SHARDS,
    FINDABLE_MATCH_SCORE,
    FLIP_PAR_BONUS_SCORE,
    GAME_RULES_VERSION,
    MATCH_DELAY_MS,
    INITIAL_RECALL_FOCUS,
    MEMORIZE_BONUS_PER_LIFE_LOST_MS,
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
    inspectBoardFairness,
    isBoardComplete
} from './board-generation';
import {
    createNewRun,
    createWildRun,
    enableDebugPeek,
    finishMemorizePhase,
    getMemorizeDuration,
    getMemorizeDurationForRun,
    pauseRun,
    resumeRun,
    advanceToNextLevel
} from './game-core';
import {
    applyDestroyPair,
    applyFlashPair,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard,
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    tileIsDestroyEligiblePreview,
    tileIsPeekEligiblePreview,
    tileIsStrayEligiblePreview,
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
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';
import { MIN_CURIO_MEMORIZE_MS, pickFloorCurio } from './floor-curio-rules';
import { pairsForFloor } from './pair-curve';
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

    it('never matches when a decoy is involved', () => {
        expect(tilesArePairMatch(createTile('a', DECOY_PAIR_KEY, 'x'), createTile('b', 'p1', 'y'))).toBe(false);
        expect(tilesArePairMatch(createTile('a', 'p1', 'x'), createTile('b', DECOY_PAIR_KEY, 'y'))).toBe(false);
    });

    it('matches wild with any non-wild real pairKey', () => {
        expect(tilesArePairMatch(createTile('w', WILD_PAIR_KEY, 'x'), createTile('b', 'p9', 'y'))).toBe(true);
        expect(tilesArePairMatch(createTile('a', 'p9', 'x'), createTile('w', WILD_PAIR_KEY, 'y'))).toBe(true);
    });

    it('matches two wild tiles (same pairKey, not decoy)', () => {
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
        livesRemaining: 5,
        perfect: true,
        mistakes: 0,
        clearLifeReason: 'perfect',
        clearLifeGained: 0,
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
                highestLevel: Number.NaN,
                guardTokens: Number.NaN,
                comboShards: Number.POSITIVE_INFINITY
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
        expect(resolved.stats.guardTokens).toBe(0);
        expect(resolved.stats.comboShards).toBe(0);
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

const SOLVER_IGNORED_PAIR_KEYS = new Set([WILD_PAIR_KEY, DECOY_PAIR_KEY]);

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

    it('does not build the next board when a levelComplete run is already dead', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_005 }), 1);
        const dead: RunState = { ...cleared, lives: 0 };

        const next = advanceToNextLevel(dead);

        expect(next.status).toBe('gameOver');
        expect(next.lives).toBe(0);
        expect(next.board).toBe(dead.board);
        expect(next.timerState.memorizeRemainingMs).toBeNull();
    });




    it('does not resume a paused zero-health run back into play', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_008 }));
        const paused = pauseRun(playing);
        const pausedDead: RunState = { ...paused, lives: 0 };

        const resumed = resumeRun(pausedDead);

        expect(resumed.status).toBe('gameOver');
        expect(resumed.lives).toBe(0);
        expect(resumed.timerState.pausedFromStatus).toBeNull();
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
        expect(resumed.lives).toBe(0);
        expect(resumed.timerState.resolveRemainingMs).toBeNull();
        expect(resumed.timerState.pausedFromStatus).toBeNull();
    });

    it('stops on the cleared board when score parasite kills during the pure floor transition', () => {
        const cleared = playPerfectFloors(
            createNewRun(0, {
                echoFeedbackEnabled: false,
                runSeed: 30_006,
                activeMutators: ['score_parasite']
            }),
            1
        );
        const doomed: RunState = { ...cleared, lives: 1, parasiteFloors: 3 };

        const next = advanceToNextLevel(doomed);

        expect(next.status).toBe('gameOver');
        expect(next.lives).toBe(0);
        expect(next.board).toBe(doomed.board);
        expect(next.parasiteFloors).toBe(0);
        expect(next.gameplayCommandJournal).toEqual(doomed.gameplayCommandJournal);
        expect(next.gameplayEventJournal).toEqual(doomed.gameplayEventJournal);
    });


    it('zeroes the recorded lives when score parasite kills during floor transition', () => {
        const cleared = playPerfectFloors(
            createNewRun(0, {
                echoFeedbackEnabled: false,
                runSeed: 30_009,
                activeMutators: ['score_parasite']
            }),
            1
        );
        const doomed: RunState = { ...cleared, lives: 1, parasiteFloors: 3 };

        const next = advanceToNextLevel(doomed);

        expect(next.status).toBe('gameOver');
        expect(next.lives).toBe(0);
        expect(next.lastLevelResult?.livesRemaining).toBe(0);
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
        const [firstPair, secondPair] = pairTileIds(started.board!);

        const afterFirstMatch = resolveBoardTurn(flipTile(flipTile(started, firstPair![0]!), firstPair![1]!));
        const finished = resolveBoardTurn(flipTile(flipTile(afterFirstMatch, secondPair![0]!), secondPair![1]!));

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
        const primed: RunState = {
            ...started,
            featuredObjectiveStreak: 3,
            turnsThisFloor: 99
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
        expect(board.pairCount).toBe(8);
        expect(board.tiles).toHaveLength(16);
        expect(board.columns).toBeGreaterThanOrEqual(2);
        // Per-tile budget over the curve's board: 6 tiles at floor 1, 12 at floor 2, 14 at floor 3,
        // 28 at floor 20 on the floor of the per-tile budget, 34 at floor 29 - under the cap now
        // that the curve is tempered.
        expect(getMemorizeDuration(1)).toBe(1950);
        expect(getMemorizeDuration(2)).toBe(3756);
        expect(getMemorizeDuration(3)).toBe(4214);
        expect(getMemorizeDuration(20)).toBe(3080);
        expect(getMemorizeDuration(29)).toBe(3740);
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

    it('forgives the first mismatch on a floor without spending a life or guard', () => {
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
                currentStreak: 2,
                guardTokens: 1
            }
        };
        const flippedOnce = flipTile(started, 'a1');
        const flippedTwice = flipTile(flippedOnce, 'b1');
        const resolved = resolveBoardTurn(flippedTwice);

        expect(resolved.status).toBe('playing');
        expect(resolved.lives).toBe(4);
        expect(resolved.stats.tries).toBe(1);
        expect(resolved.stats.mismatches).toBe(1);
        expect(resolved.stats.currentStreak).toBe(1);
        expect(resolved.stats.guardTokens).toBe(1);
        expect(resolved.stats.totalScore).toBe(0);
        expect(resolved.board?.tiles.every((tile) => tile.state === 'hidden')).toBe(true);
    });

    it('spends a life on the second mismatch of a floor when no guard is available', () => {
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
                tries: 1
            }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'b1'));

        expect(resolved.status).toBe('playing');
        expect(resolved.lives).toBe(3);
        expect(resolved.stats.tries).toBe(2);
        expect(resolved.stats.mismatches).toBe(1);
        expect(resolved.stats.currentStreak).toBe(0);
    });

    it('spends guard or life on the first mismatch after floor 1 instead of granting broad grace', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const floorTwoBoard = { ...createBoard(tiles), level: 2 };
        const guarded = {
            ...createRun(tiles),
            board: floorTwoBoard,
            stats: { ...createRun(tiles).stats, guardTokens: 1 }
        };
        const guardedResolved = resolveBoardTurn(flipTile(flipTile(guarded, 'a1'), 'b1'));
        expect(guardedResolved.lives).toBe(4);
        expect(guardedResolved.stats.guardTokens).toBe(0);

        const lastLife = {
            ...createRun(tiles),
            board: floorTwoBoard,
            lives: 1
        };
        const lastLifeResolved = resolveBoardTurn(flipTile(flipTile(lastLife, 'a1'), 'b1'));
        expect(lastLifeResolved.status).toBe('gameOver');
        expect(lastLifeResolved.lives).toBe(0);
    });

    it('banks memorize bonus when a life is lost and applies it on the next level', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const started = {
            ...createRun(tiles),
            stats: { ...createRun(tiles).stats, tries: 1 }
        };
        const afterLifeLoss = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'b1'));
        expect(afterLifeLoss.lives).toBe(3);
        expect(afterLifeLoss.pendingMemorizeBonusMs).toBe(MEMORIZE_BONUS_PER_LIFE_LOST_MS);

        const finishedLevel = {
            ...afterLifeLoss,
            status: 'levelComplete' as const,
            board: afterLifeLoss.board
                ? {
                      ...afterLifeLoss.board,
                      matchedPairs: afterLifeLoss.board.pairCount,
                      flippedTileIds: [],
                      tiles: afterLifeLoss.board.tiles.map((t) => ({ ...t, state: 'matched' as const }))
                  }
                : null
        };
        const bankedMs = afterLifeLoss.pendingMemorizeBonusMs;
        const nextRun = advanceToNextLevel(finishedLevel);
        // The floor's resident also touches this window, so the banked bonus is one of two terms.
        const resident = pickFloorCurio(
            finishedLevel.runSeed,
            nextRun.board!.level,
            finishedLevel.runRulesVersion
        );

        expect(nextRun.pendingMemorizeBonusMs).toBe(0);
        expect(nextRun.timerState.memorizeRemainingMs).toBe(
            Math.max(
                MIN_CURIO_MEMORIZE_MS,
                getMemorizeDurationForRun(
                    { ...finishedLevel, activeMutators: nextRun.activeMutators, board: nextRun.board },
                    nextRun.board!.level
                ) +
                    bankedMs +
                    resident.effect.memorizeBonusMs
            )
        );
    });

    it('carries the current life total into the next level instead of resetting it', () => {
        const started = createRun([createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')]);
        const finishedLevel = resolveBoardTurn(flipTile(flipTile({ ...started, lives: 2 }, 'a1'), 'a2'));

        expect(finishedLevel.status).toBe('levelComplete');
        expect(finishedLevel.lives).toBe(3);

        const nextRun = advanceToNextLevel(finishedLevel);

        expect(nextRun.status).toBe('memorize');
        expect(nextRun.lives).toBe(finishedLevel.lives);
        expect(nextRun.lives).toBe(3);
    });

    it('consumes a guard token on mismatch and prevents life loss', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const started = {
            ...createRun(tiles),
            lives: 1,
            stats: {
                ...createRun(tiles).stats,
                tries: 1,
                currentStreak: 5,
                guardTokens: 1
            }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'b1'));

        expect(resolved.status).toBe('playing');
        expect(resolved.lives).toBe(1);
        expect(resolved.stats.guardTokens).toBe(0);
        expect(resolved.stats.currentStreak).toBe(2);
        expect(resolved.stats.tries).toBe(2);
        expect(resolved.stats.mismatches).toBe(1);
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
        expect(resolved.lives).toBe(5);
        // 30 for the match, 100 for the floor cleared cold at par, 50 in floor objectives.
        expect(resolved.stats.totalScore).toBe(180);
        expect(resolved.stats.currentLevelScore).toBe(180);
        expect(resolved.lastLevelResult).toMatchObject({ parTurns: 1, turnsTaken: 1, playScore: 30, floorBonus: 100, floorBonusTierMult: 1 });
        expect(resolved.stats.bestStreak).toBe(1);
        expect(resolved.stats.perfectClears).toBe(1);
        expect(resolved.lastLevelResult?.perfect).toBe(true);
        expect(resolved.lastLevelResult?.mistakes).toBe(0);
        expect(resolved.lastLevelResult?.clearLifeReason).toBe('perfect');
        expect(resolved.lastLevelResult?.clearLifeGained).toBe(1);
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
            lives: 3.8,
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
        expect(resolved.lives).toBe(4);
        expect(resolved.stats.totalScore).toBe(180);
        expect(resolved.stats.currentLevelScore).toBe(180);
        expect(resolved.stats.bestScore).toBe(180);
        expect(resolved.stats.levelsCleared).toBe(1);
        expect(resolved.stats.highestLevel).toBe(1);
        expect(resolved.stats.perfectClears).toBe(1);
        expect(resolved.lastLevelResult?.mistakes).toBe(0);
        expect(resolved.lastLevelResult?.livesRemaining).toBe(4);
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
        // Two turns on a two-pair floor whose par is one: the clear pays its base and no efficiency, and the within-par objective is missed.
        expect(secondMatch.stats.totalScore).toBe(70 + RECALL_FOCUS_MATCH_SCORE + 100 + 50);
        expect(secondMatch.lastLevelResult).toMatchObject({ parTurns: 1, turnsTaken: 2, floorEfficiencyBonus: undefined });
        expect(secondMatch.stats.bestStreak).toBe(2);
    });

    it('grants a clean-clear life bonus for floors finished with one mistake', () => {
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
        expect(resolved.lives).toBe(5);
        // A miss is a turn too: three turns against a par of one, and the floor pays the same as the flawless one.
        expect(resolved.stats.totalScore).toBe(70 + RECALL_FOCUS_MATCH_SCORE + 100 + 50);
        expect(resolved.lastLevelResult?.turnsTaken).toBe(3);
        expect(resolved.lastLevelResult?.perfect).toBe(false);
        expect(resolved.lastLevelResult?.mistakes).toBe(1);
        expect(resolved.lastLevelResult?.clearLifeReason).toBe('clean');
        expect(resolved.lastLevelResult?.clearLifeGained).toBe(1);
    });

    it('grants combo shards on every second streak and guards on every fourth streak', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];

        const atStreakTwo = {
            ...createRun(tiles),
            lives: 3,
            stats: {
                ...createRun(tiles).stats,
                tries: 1,
                currentStreak: 1,
                comboShards: 0
            }
        };
        const resolvedAtTwo = resolveBoardTurn(flipTile(flipTile(atStreakTwo, 'a1'), 'a2'));

        expect(resolvedAtTwo.status).toBe('playing');
        expect(resolvedAtTwo.lives).toBe(3);
        expect(resolvedAtTwo.stats.currentStreak).toBe(2);
        expect(resolvedAtTwo.stats.comboShards).toBe(1);
        expect(resolvedAtTwo.stats.guardTokens).toBe(0);

        const atStreakFour = {
            ...createRun(tiles),
            lives: 3,
            stats: {
                ...createRun(tiles).stats,
                tries: 1,
                currentStreak: 3,
                guardTokens: 0,
                comboShards: 1
            }
        };
        const resolvedAtFour = resolveBoardTurn(flipTile(flipTile(atStreakFour, 'a1'), 'a2'));

        expect(resolvedAtFour.status).toBe('playing');
        expect(resolvedAtFour.lives).toBe(3);
        expect(resolvedAtFour.stats.currentStreak).toBe(4);
        expect(resolvedAtFour.stats.guardTokens).toBe(1);
        expect(resolvedAtFour.stats.comboShards).toBe(2);
    });

    it('converts the third combo shard into a life and keeps the old 8-streak heal', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];

        const atThirdShard = {
            ...createRun(tiles),
            lives: 3,
            stats: {
                ...createRun(tiles).stats,
                tries: 1,
                currentStreak: 5,
                comboShards: 2
            }
        };
        const resolvedAtThirdShard = resolveBoardTurn(flipTile(flipTile(atThirdShard, 'a1'), 'a2'));

        expect(resolvedAtThirdShard.status).toBe('playing');
        expect(resolvedAtThirdShard.lives).toBe(4);
        expect(resolvedAtThirdShard.stats.currentStreak).toBe(6);
        expect(resolvedAtThirdShard.stats.comboShards).toBe(0);

        const atStreakEight = {
            ...createRun(tiles),
            lives: 4,
            stats: {
                ...createRun(tiles).stats,
                tries: 1,
                currentStreak: 7,
                guardTokens: 1,
                comboShards: 2
            }
        };
        const resolvedAtEight = resolveBoardTurn(flipTile(flipTile(atStreakEight, 'a1'), 'a2'));

        expect(resolvedAtEight.status).toBe('playing');
        expect(resolvedAtEight.lives).toBe(5);
        expect(resolvedAtEight.stats.currentStreak).toBe(8);
        expect(resolvedAtEight.stats.guardTokens).toBe(2);
        expect(resolvedAtEight.stats.comboShards).toBe(0);
    });

    it('caps stored shards and other sustain rewards at their max values', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const shardCapped = {
            ...createRun(tiles),
            lives: 5,
            stats: {
                ...createRun(tiles).stats,
                tries: 1,
                currentStreak: 1,
                comboShards: 2
            }
        };
        const resolvedShardCap = resolveBoardTurn(flipTile(flipTile(shardCapped, 'a1'), 'a2'));

        expect(resolvedShardCap.status).toBe('playing');
        expect(resolvedShardCap.lives).toBe(5);
        expect(resolvedShardCap.stats.currentStreak).toBe(2);
        expect(resolvedShardCap.stats.comboShards).toBe(2);

        const started = {
            ...createRun(tiles),
            lives: 5,
            stats: {
                ...createRun(tiles).stats,
                tries: 1,
                currentStreak: 15,
                guardTokens: 2,
                comboShards: 2
            }
        };
        const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));

        expect(resolved.status).toBe('playing');
        expect(resolved.lives).toBe(5);
        expect(resolved.stats.currentStreak).toBe(16);
        expect(resolved.stats.guardTokens).toBe(2);
        expect(resolved.stats.comboShards).toBe(2);
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
                highestLevel: 1,
                guardTokens: 2,
                comboShards: 2
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
        // Arriving on a floor also seats its resident, and some of them hand over a token, a
        // shuffle or a longer look. Read the resident's contribution from the same seed the
        // advance used, so this stays an assertion about what carries over rather than a bet on
        // who happened to be downstairs.
        const resident = pickFloorCurio(finishedLevel.runSeed, 2, finishedLevel.runRulesVersion);

        expect(nextRun.floorCurioId).toBe(resident.id);
        expect(nextRun.stats.guardTokens).toBe(2 + resident.effect.guardTokens);
        expect(nextRun.stats.comboShards).toBe(2);
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

    it('does not grant destroy charges from clean clears when advancing floors', () => {
        const base = {
            ...createNewRun(0),
            status: 'levelComplete' as const,
            board: buildBoard(1),
            destroyPairCharges: 0,
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S' as const,
                livesRemaining: 4,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 0
            }
        };
        expect(advanceToNextLevel(base).destroyPairCharges).toBe(0);

        const clean = {
            ...base,
            lastLevelResult: { ...base.lastLevelResult!, perfect: false, mistakes: 1, clearLifeReason: 'clean' as const }
        };
        expect(advanceToNextLevel(clean).destroyPairCharges).toBe(0);

        const dirty = { ...base, lastLevelResult: { ...base.lastLevelResult!, mistakes: 2 } };
        expect(advanceToNextLevel(dirty).destroyPairCharges).toBe(0);

        const stocked = {
            ...base,
            destroyPairCharges: 7,
            lastLevelResult: { ...base.lastLevelResult!, mistakes: 0 }
        };
        expect(advanceToNextLevel(stocked).destroyPairCharges).toBe(7);
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

    it('destroy pair does not add score or streak and can clear the floor', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const run = {
            ...createRun(tiles),
            destroyPairCharges: 1,
            stats: {
                ...createRun(tiles).stats,
                currentStreak: 4,
                totalScore: 100,
                currentLevelScore: 50
            }
        };
        const after = applyDestroyPair(run, 'a1');
        expect(after.stats.totalScore).toBe(100);
        expect(after.stats.currentLevelScore).toBe(50);
        expect(after.stats.currentStreak).toBe(4);
        expect(after.stats.matchesFound).toBe(1);
        expect(after.stats.pairsDestroyed).toBe(1);
        expect(after.destroyPairCharges).toBe(0);
        expect(after.powersUsedThisRun).toBe(true);
        expect(after.status).toBe('playing');
        expect(after.gameplayCommandJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.destroy_pair', targetTileId: 'a1' })
        ]));
        expect(after.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.pair_destroyed', boardComplete: false }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.destroy_pair.used' })
        ]));

        const lastPairRun = {
            ...createRun(tiles),
            board: {
                ...createRun(tiles).board!,
                matchedPairs: 1,
                tiles: tiles.map((t) => (t.pairKey === 'A' ? { ...t, state: 'matched' as const } : t))
            },
            destroyPairCharges: 1
        };
        const cleared = applyDestroyPair(lastPairRun, 'b1');
        expect(cleared.status).toBe('levelComplete');
        expect(cleared.lastLevelResult?.level).toBe(1);
        expect(cleared.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'board.destroy_pair', targetTileId: 'b1' })
        ]);
        expect(cleared.gameplayCommandJournal?.map((command) => command.type)).not.toContain('effects.apply');
        expect(cleared.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.pair_destroyed', boardComplete: true })
        ]));
    });

    describe('board power preview helpers', () => {
        it('destroy preview collects fully hidden non-decoy pairs only', () => {
            const tiles: Tile[] = [
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('d1', DECOY_PAIR_KEY, '?'),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ];
            const board = createRun(tiles).board!;
            expect(tileIsDestroyEligiblePreview(board, 'a1')).toBe(true);
            expect(tileIsDestroyEligiblePreview(board, 'd1')).toBe(false);
            const eligible = collectDestroyEligibleTileIds(board);
            expect(eligible).toEqual(new Set(['a1', 'a2', 'b1', 'b2']));
        });

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

        it('stray preview matches completion-safe hidden singleton tiles', () => {
            const tiles: Tile[] = [
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('d1', DECOY_PAIR_KEY, '?'),
                createTile('w1', WILD_PAIR_KEY, '*')
            ];
            const board = createRun(tiles).board!;
            expect(tileIsStrayEligiblePreview(board, 'a1')).toBe(false);
            expect(tileIsStrayEligiblePreview(board, 'd1')).toBe(false);
            expect(tileIsStrayEligiblePreview(board, 'w1')).toBe(true);
        });

        it('stray remove refuses normal pair tiles without spending a charge', () => {
            const run = {
                ...createRun([createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')]),
                status: 'playing' as const,
                strayRemoveCharges: 1
            };

            const after = applyStrayRemove(run, 'a1');

            expect(after).toBe(run);
            expect(after.strayRemoveCharges).toBe(1);
        });

        it('stray remove can remove a completion-safe singleton', () => {
            const tiles = [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A'), createTile('w1', WILD_PAIR_KEY, '*')];
            const board = createBoard(tiles, { pairCount: 1 });
            const run = {
                ...createRun(tiles, { board }),
                status: 'playing' as const,
                strayRemoveCharges: 1
            };

            const after = applyStrayRemove(run, 'w1');

            expect(after).not.toBe(run);
            expect(after.board!.tiles.find((tile) => tile.id === 'w1')?.state).toBe('removed');
            expect(after.strayRemoveCharges).toBe(0);
            expect(after.powersUsedThisRun).toBe(true);
            expect(inspectBoardFairness(after.board!).issues).toEqual([]);
        });
    });

    it('resets parasite floor counter on destroy when score_parasite is active', () => {
        const tiles: Tile[] = [
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const run = {
            ...createRun(tiles),
            activeMutators: ['score_parasite'] as MutatorId[],
            destroyPairCharges: 1,
            parasiteFloors: 3
        };
        const after = applyDestroyPair(run, 'a1');
        expect(after.parasiteFloors).toBe(0);
    });

    describe('glass_floor decoy and board completion', () => {
        it('isBoardComplete when all real tiles are matched and the decoy trap stays hidden', () => {
            const board = buildBoard(2, {
                activeMutators: ['glass_floor'],
                runSeed: 90210,
                runRulesVersion: GAME_RULES_VERSION
            });
            const decoy = board.tiles.find((t) => t.pairKey === '__decoy__');
            expect(decoy).toBeDefined();
            const cleared: BoardState = {
                ...board,
                tiles: board.tiles.map((t) =>
                    t.pairKey === '__decoy__' ? t : { ...t, state: 'matched' as const }
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
            expect(tagged.every((t) => t.pairKey !== '__decoy__' && t.pairKey !== '__wild__')).toBe(true);
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

        it('tags only whole real pairs and never the decoy or wild singleton', () => {
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
            expect(tagged.every((t) => t.pairKey !== '__decoy__' && t.pairKey !== '__wild__')).toBe(true);
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

        it('claims shard spark, converts through the shard-to-life path, and clears carrier flags', () => {
            const tiles: Tile[] = [
                { ...createTile('a1', 'A', 'A'), findableKind: 'shard_spark' },
                { ...createTile('a2', 'A', 'A'), findableKind: 'shard_spark' },
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ];
            const started = {
                ...createRun(tiles),
                lives: 3,
                findablesClaimedThisFloor: 0,
                findablesTotalThisFloor: 1,
                stats: {
                    ...createRun(tiles).stats,
                    comboShards: 2
                }
            };
            const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));
            const base = calculateMatchScore(1, 1, 1);
            expect(FINDABLE_MATCH_COMBO_SHARDS.shard_spark).toBe(1);
            expect(resolved.stats.totalScore).toBe(base + FINDABLE_MATCH_SCORE.shard_spark);
            expect(resolved.lives).toBe(4);
            expect(resolved.stats.comboShards).toBe(0);
            expect(resolved.findablesClaimedThisFloor).toBe(1);
            expect(resolved.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.turn_resolve' })
            ]);
            expect(resolved.gameplayEventJournal).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'combo_shard.requested', amount: 1 }),
                    expect.objectContaining({ type: 'feedback.requested', cue: 'build.shard_spark.matched' })
                ])
            );
            expect(
                resolved.board?.tiles.filter((t) => t.pairKey === 'A').every((t) => t.findableKind === undefined)
            ).toBe(true);
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



        it('forfeits findable on destroy without score or claim counter', () => {
            const tiles: Tile[] = [
                { ...createTile('a1', 'A', 'A'), findableKind: 'shard_spark' },
                { ...createTile('a2', 'A', 'A'), findableKind: 'shard_spark' },
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ];
            const run = {
                ...createRun(tiles),
                destroyPairCharges: 1,
                findablesClaimedThisFloor: 0,
                findablesTotalThisFloor: 1
            };
            const after = applyDestroyPair(run, 'a1');
            expect(after.findablesClaimedThisFloor).toBe(0);
            expect(after.stats.totalScore).toBe(0);
            expect(after.board?.tiles.filter((t) => t.pairKey === 'A').every((t) => t.findableKind === undefined)).toBe(
                true
            );
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
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: 1 },
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
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: 0 },
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
                livesRemaining: start.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 0
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
    it('noDestroy blocks destroy on a real wild board', () => {
        const wild = finishMemorizePhase(createWildRun(0));
        expect(wild.board).not.toBeNull();
        const target = wild.board!.tiles.find(
            (t) => t.state === 'hidden' && t.pairKey !== WILD_PAIR_KEY && t.pairKey !== '__decoy__'
        );
        expect(target).toBeDefined();
        const run: RunState = {
            ...wild,
            status: 'playing',
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null },
            destroyPairCharges: 1
        };
        expect(applyDestroyPair(run, target!.id)).toBe(run);
    });

    it('noShuffle blocks full-board shuffle on a real wild run', () => {
        let wild = finishMemorizePhase(createWildRun(0));
        wild = {
            ...wild,
            status: 'playing',
            shuffleCharges: 1,
            activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null }
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
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: 0 }
        };
        const mismatching = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'b1'));
        expect(mismatching.status).toBe('gameOver');
    });

    it('blocks shuffle when contract sets noShuffle', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            shuffleCharges: 1,
            activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(applyShuffle(run)).toBe(run);
    });

    it('blocks destroy when contract sets noDestroy', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            destroyPairCharges: 1,
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
        };
        expect(applyDestroyPair(run, 'a1')).toBe(run);
    });

    it('respects maxPinsTotalRun when adding new pins', () => {
        let run: RunState = {
            ...createRun(fourPairTiles),
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: null, maxPinsTotalRun: 1 }
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
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: null, maxPinsTotalRun: 1 }
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
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: 1 }
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
            activeContract: { noShuffle: true, noDestroy: true, maxMismatches: null }
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
            activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(applyShuffle(run)).toBe(run);
    });

    it('blocks destroy under noDestroy with presentation mutators active', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            destroyPairCharges: 1,
            activeMutators: ['wide_recall', 'distraction_channel'] as MutatorId[],
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
        };
        expect(applyDestroyPair(run, 'a1')).toBe(run);
    });

    it('allows shuffle when contract only blocks destroy with presentation mutators active', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            shuffleCharges: 1,
            activeMutators: ['silhouette_twist'] as MutatorId[],
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(true);
        const shuffled = applyShuffle(run);
        expect(shuffled).not.toBe(run);
        expect(shuffled.shuffleNonce).toBe(run.shuffleNonce + 1);
    });

    it('blocks region shuffle under noShuffle with presentation mutators active', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            activeMutators: ['wide_recall'] as MutatorId[],
            activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null }
        };
        expect(canRegionShuffle(run)).toBe(false);
        expect(applyRegionShuffle(run, 0)).toBe(run);
    });

    it('allows region shuffle when contract only blocks destroy with presentation mutators active', () => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            activeMutators: ['distraction_channel'] as MutatorId[],
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
        };
        expect(canRegionShuffle(run)).toBe(true);
        expect(canRegionShuffleRow(run, 0)).toBe(true);
        const shuffled = applyRegionShuffle(run, 0);
        expect(shuffled).not.toBe(run);
        expect(shuffled.shuffleNonce).toBe(run.shuffleNonce + 1);
    });






    it.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true]
    ])('contract matrix noShuffle=%s noDestroy=%s gates shuffle and destroy', (noShuffle, noDestroy) => {
        const run: RunState = {
            ...createRun(fourPairTiles),
            shuffleCharges: 1,
            destroyPairCharges: 1,
            activeContract: { noShuffle, noDestroy, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(!noShuffle);
        if (noDestroy) {
            expect(applyDestroyPair(run, 'a1')).toBe(run);
        } else {
            expect(applyDestroyPair(run, 'a1')).not.toBe(run);
        }
    });
});




