import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    DungeonRunNodeKind,
    EnemyHazardState,
    FloorArchetypeId,
    MutatorId,
    RouteNodeType,
    RunState,
    Tile
} from './contracts';
import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    ENDLESS_RISK_WAGER_MIN_STREAK,
    FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
    FINDABLE_MATCH_COMBO_SHARDS,
    FINDABLE_MATCH_SAFE_HAZARD_WARDS,
    FINDABLE_MATCH_SCORE,
    FLIP_PAR_BONUS_SCORE,
    FLOOR_CLEAR_GOLD_BASE,
    FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD,
    FUSE_CACHE_FRESH_RESOLUTION_LIMIT,
    FUSE_CACHE_FRESH_SCORE_REWARD,
    FUSE_CACHE_FRESH_SHOP_GOLD_REWARD,
    GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS,
    GAME_RULES_VERSION,
    MATCH_DELAY_MS,
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    MEMORIZE_BONUS_PER_LIFE_LOST_MS,
    RECALL_CLUE_MATCH_SCORE,
    RECALL_FOCUS_MAX,
    RECALL_FOCUS_MATCH_SCORE,
    SHIFTING_BOUNTY_MATCH_BONUS,
    SHIFTING_WARD_MATCH_PENALTY,
    TOLL_CACHE_MATCH_SCORE_TOLL,
    TOLL_CACHE_SHOP_GOLD_REWARD
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
    createDailyRun,
    createGauntletRun,
    createNewRun,
    createPuzzleRun,
    createWildRun,
    enableDebugPeek,
    finishMemorizePhase,
    getMemorizeDuration,
    getMemorizeDurationForRun,
    isGauntletExpired,
    pauseRun,
    resumeRun,
    advanceToNextLevel
} from './game-core';
import {
    applyDestroyPair,
    applyFlashPair,
    applyPeek,
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
    applyEnemyHazardClick,
    calculateMatchScore,
    cancelResolvingWithUndo,
    flipTile,
    getMatchFloaterAnchorTileIds,
    getMismatchFloaterAnchorTileIds,
    getPresentationMutatorMatchPenalty,
    resolveBoardTurn,
    tilesArePairMatch
} from './turn-resolution';
import {
    activateDungeonExit,
    createDungeonFloorBlueprint,
    DUNGEON_BOSS_DEFINITIONS,
    ENEMY_HAZARD_PATTERN_DEFINITIONS,
    EXIT_PAIR_KEY,
    getEnemyHazardMovementCandidateIds,
    getDungeonBoardPresentation,
    getDungeonBoardStatus,
    getDungeonBossDefinition,
    getDungeonBossReadModel,
    getDungeonCardCopy,
    getDungeonEliteEncounterRules,
    getDungeonEnemyLifecycleStatus,
    getDungeonExitStatus,
    getDungeonObjectiveStatus,
    DUNGEON_ROOM_EFFECT_DEFINITIONS,
    getDungeonRoomReadModel,
    getDungeonThreatStatus,
    DUNGEON_TREASURE_REWARD_DEFINITIONS,
    getDungeonTreasureReadModel,
    inspectDungeonEncounterBudget,
    revealDungeonExit,
    revealDungeonRoom,
    revealDungeonShop,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY
} from './dungeon-rules';
import {
    applyRouteChoiceOutcome,
    claimRouteSideRoomChoice,
    generateRouteChoices,
    getRouteChoiceAvailability,
    claimRouteSideRoomPrimary,
    openRouteSideRoom,
    skipRouteSideRoom
} from './route-rules';
import {
    createDungeonRunMapState,
    getSelectedDungeonNode,
    inspectDungeonRunMapProgression,
    revealDungeonChoices
} from './run-map';
import {
    canRerollShopOffers,
    createRunShopOffers,
    getShopGoldRewardForFloor,
    getRunShopReadModel,
    getRunShopStockPlan,
    getShopWalletPacing,
    purchaseShopOffer,
    rerollShopOffers
} from './shop-rules';
import { RUN_EVENT_TABLE, applyRunEventChoice, rollRunEventRoom } from './run-events';
import {
    acceptEndlessRiskWager,
    canOfferEndlessRiskWager,
    completeRelicPickAndAdvance,
    computeRelicOfferPickBudget,
    grantBonusRelicPickNextOffer,
    openRelicOffer
} from './objective-rules';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';
import { DAILY_MUTATOR_TABLE } from './mutators';
import { RELIC_POOL } from './relics';
import { makeBoard as createBoard, makePair as createPair, makeRun as createRun, makeTile as createTile } from './test/game-fixtures';
import {
    EXPECTED_GAMEPLAY_CARD_KINDS,
    EXPECTED_GAMEPLAY_NODE_KINDS,
    EXPECTED_MAJOR_EFFECT_FAMILIES,
    collectDungeonFeatureCoverage,
    formatDungeonCoverageFailure,
    missingCoverage
} from './test/dungeon-feature-coverage';
import {
    DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS,
    getScheduledSoftlockFloorOptions
} from './softlock-generator-contract';

const isSprungTrapForTest = (tile: Tile): boolean =>
    tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved' && tile.state === 'flipped';

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
    const createMemorizeRunAfterRecall = (
        previous: NonNullable<RunState['lastLevelResult']>,
        routeApproachType?: RouteNodeType
    ): RunState => {
        const base = createRun(
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

        return {
            ...base,
            dungeonRun: routeApproachType
                ? {
                      ...base.dungeonRun,
                      nodes: base.dungeonRun.nodes.map((node) =>
                          node.id === base.dungeonRun.currentNodeId ? { ...node, routeApproachType } : node
                      )
                  }
                : base.dungeonRun
        };
    };

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
            gameMode: 'endless' as const
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

    it('pays an extra clue recall bonus when the player matches remembered scouted information', () => {
        const run = {
            ...createRun([
                createTile('a1', 'A', 'A', { routeSpecialKind: 'mystery_veil', routeSpecialRevealed: true }),
                createTile('a2', 'A', 'A', { routeSpecialKind: 'mystery_veil', routeSpecialRevealed: true }),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ]),
            gameMode: 'endless' as const
        };
        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'a2'));

        expect(resolved.recallBonusScoreThisFloor).toBe(RECALL_FOCUS_MATCH_SCORE + RECALL_CLUE_MATCH_SCORE);
        expect(resolved.stats.currentLevelScore).toBe(
            calculateMatchScore(1, 1, 1) + RECALL_FOCUS_MATCH_SCORE + RECALL_CLUE_MATCH_SCORE
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
            shopGold: Number.NaN,
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
        expect(resolved.shopGold).toBe(0);
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

    it('lets remembered route approach modify next-room recall focus', () => {
        const safe = createMemorizeRunAfterRecall(previousRecallResult(), 'safe');
        const mystery = createMemorizeRunAfterRecall(
            previousRecallResult({ recallMatches: 1, recallBonusScore: RECALL_CLUE_MATCH_SCORE }),
            'mystery'
        );
        const greedAfterMistake = createMemorizeRunAfterRecall(
            previousRecallResult({
                perfect: false,
                mistakes: 1,
                recallMatches: 1,
                recallMistakes: 1
            }),
            'greed'
        );

        expect(finishMemorizePhase(safe).recallFocus).toBe(RECALL_FOCUS_MAX);
        expect(finishMemorizePhase(mystery).recallFocus).toBe(2);
        expect(finishMemorizePhase(greedAfterMistake).recallFocus).toBe(0);
    });

    it('advances and pays floor-local trait route objectives from real match interactions', () => {
        const traitRun = createRun([
            createTile('echo-a', 'echo', 'E', { tileTraitKind: 'echo' }),
            createTile('sealed-a', 'sealed', 'S', { tileTraitKind: 'sealed' }),
            createTile('echo-b', 'echo', 'E', { tileTraitKind: 'echo' }),
            createTile('sealed-b', 'sealed', 'S', { tileTraitKind: 'sealed' })
        ]);
        const run = {
            ...traitRun,
            board: {
                ...traitRun.board!,
                columns: 2,
                rows: 2
            },
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveRequiredThisFloor: 1,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveRewardClaimedThisFloor: false,
            traitRouteObjectiveRewardTextThisFloor: null,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'echo-a'), 'echo-b'));

        expect(resolved.traitRouteObjectiveProgressThisFloor).toBe(1);
        expect(resolved.traitRouteObjectiveCompletedThisFloor).toBe(true);
        expect(resolved.traitRouteObjectiveRewardClaimedThisFloor).toBe(true);
        expect(resolved.traitRouteObjectiveRewardTextThisFloor).toBe('+1 combo shard');
        expect(resolved.traitRouteObjectiveTriggeredTagsThisFloor).toContain('echo:sealed-combo');
        expect(resolved.stats.comboShards).toBeGreaterThan(run.stats.comboShards);
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
    return leaveThroughExit(current);
};

const withoutTileTraits = (run: RunState): RunState => ({
    ...run,
    board: run.board
        ? {
              ...run.board,
              tiles: run.board.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
          }
        : run.board
});

const leaveThroughExit = (run: RunState): RunState => {
    const exitTile = run.board?.dungeonExitTileId
        ? run.board.tiles.find((tile) => tile.id === run.board?.dungeonExitTileId)
        : run.board?.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY);
    if (!exitTile || run.status !== 'playing') {
        return run;
    }
    const current = revealDungeonExit(run, exitTile.id);
    return activateDungeonExit(current);
};

const SOLVER_IGNORED_PAIR_KEYS = new Set([EXIT_PAIR_KEY, SHOP_PAIR_KEY, ROOM_PAIR_KEY, WILD_PAIR_KEY, DECOY_PAIR_KEY]);

const solveBoardByExhaustingPairs = (board: BoardState, runSeed: number, activateExit = true): RunState => {
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

    if (!activateExit) {
        return run;
    }

    const exitId = run.board!.dungeonExitTileId;
    if (exitId) {
        run = activateDungeonExit(revealDungeonExit(run, exitId));
    }
    return run;
};

const solveGeneratedFloorByExhaustingPairs = (input: {
    level: number;
    runSeed: number;
    floorTag?: 'normal' | 'boss' | 'breather';
    floorArchetypeId?: FloorArchetypeId | null;
    activeMutators?: MutatorId[];
    dungeonNodeKind?: DungeonRunNodeKind | null;
    routeType?: RouteNodeType;
    activateExit?: boolean;
}): RunState => {
    const board = buildBoard(input.level, {
        runSeed: input.runSeed,
        runRulesVersion: GAME_RULES_VERSION,
        floorTag: input.floorTag ?? 'normal',
        floorArchetypeId: input.floorArchetypeId ?? null,
        gameMode: 'endless',
        activeMutators: input.activeMutators ?? [],
        dungeonNodeKind: input.dungeonNodeKind ?? null,
        routeCardPlan: input.routeType
            ? {
                  choiceId: `solver:${input.routeType}:${input.runSeed}:${input.level}`,
                  routeType: input.routeType,
                  sourceLevel: Math.max(1, input.level - 1),
                  targetLevel: input.level
            }
            : undefined
    });
    return solveBoardByExhaustingPairs(board, input.runSeed, input.activateExit !== false);
};

const makeEnemyHazard = (
    id: string,
    currentTileId: string,
    nextTileId: string = currentTileId,
    overrides: Partial<EnemyHazardState> = {}
): EnemyHazardState => ({
    id,
    kind: 'sentinel',
    label: 'Patrol Sentry',
    currentTileId,
    nextTileId,
    pattern: 'patrol',
    state: 'hidden',
    damage: 1,
    hp: 1,
    maxHp: 1,
    ...overrides
});

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

const routeBoard = (
    routeType: RouteNodeType,
    level: number,
    floorTag: BoardState['floorTag'] = 'normal',
    overrides: { activeMutators?: MutatorId[]; floorArchetypeId?: FloorArchetypeId } = {}
): BoardState =>
    buildBoard(level, {
        runSeed: 23_000 + level,
        runRulesVersion: GAME_RULES_VERSION,
        activeMutators: overrides.activeMutators ?? [],
        floorTag,
        ...(overrides.floorArchetypeId ? { floorArchetypeId: overrides.floorArchetypeId } : {}),
        routeCardPlan: {
            choiceId: `test:${level}:${routeType}`,
            routeType,
            sourceLevel: level - 1,
            targetLevel: level
        }
    });

describe('createDailyRun', () => {
    it('uses daily mode, one table mutator, and a UTC date key', () => {
        const run = createDailyRun(0);
        expect(run.gameMode).toBe('daily');
        expect(run.activeMutators).toHaveLength(1);
        expect(DAILY_MUTATOR_TABLE).toContain(run.activeMutators[0]);
        expect(run.dailyDateKeyUtc).toMatch(/^\d{8}$/);
    });
});

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

describe('final-pair enemy occupation cleanup', () => {
    it('defeats an enemy occupying one card when it becomes the final remaining pair', () => {
        const [clearA, clearB] = createPair('clear', 'C');
        const [finalA, finalB] = createPair('final', 'F');
        const run = createRun([clearA, clearB, finalA, finalB], {
            board: createBoard([clearA, clearB, finalA, finalB], {
                enemyHazards: [makeEnemyHazard('hazard-final-a', finalA.id)]
            })
        });

        const afterClear = resolveBoardTurn(flipTile(flipTile(run, clearA.id), clearB.id));
        const hazard = afterClear.board?.enemyHazards?.find((candidate) => candidate.id === 'hazard-final-a');
        const afterFinalFlip = flipTile(afterClear, finalA.id);

        expect(afterClear.status).toBe('playing');
        expect(hazard?.state).toBe('defeated');
        expect(hazard?.hp).toBe(0);
        expect(afterClear.board?.tiles.filter((tile) => tile.pairKey === 'final').every((tile) => tile.state === 'hidden')).toBe(true);
        expect(afterFinalFlip.board?.flippedTileIds).toEqual([finalA.id]);
    });

    it('defeats enemies occupying both cards when they become the final remaining pair', () => {
        const [clearA, clearB] = createPair('clear', 'C');
        const [finalA, finalB] = createPair('final', 'F');
        const run = createRun([clearA, clearB, finalA, finalB], {
            board: createBoard([clearA, clearB, finalA, finalB], {
                enemyHazards: [
                    makeEnemyHazard('hazard-final-a', finalA.id),
                    makeEnemyHazard('hazard-final-b', finalB.id)
                ]
            })
        });

        const afterClear = resolveBoardTurn(flipTile(flipTile(run, clearA.id), clearB.id));
        const activeHazards = afterClear.board?.enemyHazards?.filter((hazard) => hazard.state !== 'defeated') ?? [];
        const afterFinalFlip = flipTile(afterClear, finalB.id);

        expect(afterClear.status).toBe('playing');
        expect(activeHazards).toEqual([]);
        expect(afterClear.board?.enemyHazards?.map((hazard) => [hazard.id, hazard.hp, hazard.state])).toEqual([
            ['hazard-final-a', 0, 'defeated'],
            ['hazard-final-b', 0, 'defeated']
        ]);
        expect(afterFinalFlip.board?.flippedTileIds).toEqual([finalB.id]);
    });

    it('cleans an already occupied final pair before enemy-click damage resolves', () => {
        const [clearA, clearB] = createPair('clear', 'C');
        const [finalA, finalB] = createPair('final', 'F');
        const matchedClearA = { ...clearA, state: 'matched' as const };
        const matchedClearB = { ...clearB, state: 'matched' as const };
        const run = createRun([matchedClearA, matchedClearB, finalA, finalB], {
            lives: 1,
            board: createBoard([matchedClearA, matchedClearB, finalA, finalB], {
                matchedPairs: 1,
                enemyHazards: [makeEnemyHazard('hazard-final-a', finalA.id)]
            })
        });

        const afterClick = applyEnemyHazardClick(run, finalA.id);
        const afterFlip = flipTile(afterClick, finalA.id);

        expect(afterClick.status).toBe('playing');
        expect(afterClick.lives).toBe(1);
        expect(afterClick.board?.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
        expect(afterFlip.board?.flippedTileIds).toEqual([finalA.id]);
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

    it('refuses to advance completed puzzle runs into procedural floors', () => {
        const puzzleRun = finishMemorizePhase(
            createPuzzleRun(0, 'guard_test', [createTile('p1', 'P', 'P'), createTile('p2', 'P', 'P')])
        );
        const cleared = clearRealPairs(puzzleRun);

        expect(cleared.status).toBe('levelComplete');
        expect(advanceToNextLevel(cleared)).toBe(cleared);
    });

    it('refuses to bypass pending route side rooms and relic drafts', () => {
        const sideRoomClear = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_005 }), 1);
        const safeId = sideRoomClear.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;
        const sideRoomRun = openRouteSideRoom(applyRouteChoiceOutcome({ ...sideRoomClear, lives: 3 }, safeId).run);

        expect(sideRoomRun.sideRoom).not.toBeNull();
        expect(advanceToNextLevel(sideRoomRun)).toBe(sideRoomRun);

        const relicClear = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_006 }), 3);
        const relicRun = openRelicOffer(relicClear);

        expect(relicRun.relicOffer).not.toBeNull();
        expect(advanceToNextLevel(relicRun)).toBe(relicRun);
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
        const dead: RunState = { ...cleared, lives: 0, pendingRouteCardPlan: null };

        const next = advanceToNextLevel(dead);

        expect(next.status).toBe('gameOver');
        expect(next.lives).toBe(0);
        expect(next.board).toBe(dead.board);
        expect(next.timerState.memorizeRemainingMs).toBeNull();
    });

    it('lets death win over pending side rooms and relic drafts during floor transition', () => {
        const sideRoomClear = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_011 }), 1);
        const safeId = sideRoomClear.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;
        const sideRoomRun = openRouteSideRoom(applyRouteChoiceOutcome({ ...sideRoomClear, lives: 3 }, safeId).run);
        const deadSideRoom: RunState = { ...sideRoomRun, lives: 0 };

        const sideRoomNext = advanceToNextLevel(deadSideRoom);

        expect(sideRoomNext.status).toBe('gameOver');
        expect(sideRoomNext.lives).toBe(0);
        expect(sideRoomNext.sideRoom).toBeNull();
        expect(sideRoomNext.pendingRouteCardPlan).toBeNull();
        expect(sideRoomNext.lastLevelResult?.livesRemaining).toBe(0);
        expect(openRouteSideRoom({ ...sideRoomRun, sideRoom: null, lives: 0 })).toMatchObject({
            sideRoom: null,
            lives: 0
        });

        const relicClear = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_012 }), 3);
        const relicRun = openRelicOffer(relicClear);
        const deadRelic: RunState = { ...relicRun, lives: 0 };

        const relicNext = advanceToNextLevel(deadRelic);

        expect(relicNext.status).toBe('gameOver');
        expect(relicNext.lives).toBe(0);
        expect(relicNext.relicOffer).toBeNull();
        expect(relicNext.lastLevelResult?.livesRemaining).toBe(0);
    });

    it('does not let route choices resurrect a zero-health completed floor', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_007 }), 1);
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;
        const dead: RunState = { ...cleared, lives: 0, pendingRouteCardPlan: null };

        const routed = applyRouteChoiceOutcome(dead, safeId);

        expect(routed).toMatchObject({ applied: false, reason: 'invalid_status' });
        expect(routed.run).toBe(dead);
        expect(routed.run.lives).toBe(0);
        expect(routed.run.pendingRouteCardPlan).toBeNull();
    });

    it('does not open or accept relic drafts for a zero-health completed floor', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_010 }), 3);
        const dead: RunState = { ...cleared, lives: 0, pendingRouteCardPlan: null };
        const blockedOffer = openRelicOffer(dead);
        const staleOfferRun: RunState = {
            ...dead,
            relicOffer: {
                tier: 1,
                options: ['extra_shuffle_charge'],
                picksRemaining: 1,
                pickRound: 0
            }
        };

        expect(blockedOffer).toBe(dead);
        expect(completeRelicPickAndAdvance(staleOfferRun, 'extra_shuffle_charge')).toBe(staleOfferRun);
    });

    it('does not resume a paused zero-health run back into play', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_008 }));
        const paused = pauseRun(playing);
        const pausedDead: RunState = {
            ...paused,
            lives: 0,
            pendingRouteCardPlan: {
                choiceId: 'stale:route',
                routeType: 'safe',
                sourceLevel: 1,
                targetLevel: 2
            },
            relicOffer: {
                tier: 1,
                options: ['extra_shuffle_charge'],
                picksRemaining: 1,
                pickRound: 0
            },
            shopOffers: createRunShopOffers(paused)
        };

        const resumed = resumeRun(pausedDead);

        expect(resumed.status).toBe('gameOver');
        expect(resumed.lives).toBe(0);
        expect(resumed.pendingRouteCardPlan).toBeNull();
        expect(resumed.relicOffer).toBeNull();
        expect(resumed.shopOffers).toEqual([]);
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
        expect(resumed.pendingRouteCardPlan).toBeNull();
        expect(resumed.relicOffer).toBeNull();
        expect(resumed.shopOffers).toEqual([]);
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
        const doomed: RunState = { ...cleared, lives: 1, parasiteFloors: 3, parasiteWardRemaining: 0 };

        const next = advanceToNextLevel(doomed);

        expect(next.status).toBe('gameOver');
        expect(next.lives).toBe(0);
        expect(next.board).toBe(doomed.board);
        expect(next.parasiteFloors).toBe(0);
        expect(next.gameplayCommandJournal).toEqual(doomed.gameplayCommandJournal);
        expect(next.gameplayEventJournal).toEqual(doomed.gameplayEventJournal);
    });

    it('consumes a parasite ward without mutating journals in the pure floor transition', () => {
        const cleared = playPerfectFloors(
            createNewRun(0, {
                echoFeedbackEnabled: false,
                runSeed: 30_010,
                activeMutators: ['score_parasite']
            }),
            1
        );
        const warded: RunState = { ...cleared, lives: 1, parasiteFloors: 3, parasiteWardRemaining: 1 };

        const next = advanceToNextLevel(warded);

        expect(next.status).toBe('memorize');
        expect(next.lives).toBe(1);
        expect(next.parasiteFloors).toBe(0);
        expect(next.parasiteWardRemaining).toBe(0);
        expect(next.gameplayCommandJournal).toEqual(warded.gameplayCommandJournal);
        expect(next.gameplayEventJournal).toEqual(warded.gameplayEventJournal);
    });

    it('clears next-room progress state when score parasite kills during floor transition', () => {
        const cleared = playPerfectFloors(
            createNewRun(0, {
                echoFeedbackEnabled: false,
                runSeed: 30_009,
                activeMutators: ['score_parasite']
            }),
            1
        );
        const mysteryId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!.id;
        const routed = applyRouteChoiceOutcome(cleared, mysteryId);
        const doomed: RunState = {
            ...routed.run,
            lives: 1,
            parasiteFloors: 3,
            parasiteWardRemaining: 0
        };

        const next = advanceToNextLevel(doomed);

        expect(next.status).toBe('gameOver');
        expect(next.lives).toBe(0);
        expect(next.pendingRouteCardPlan).toBeNull();
        expect(next.sideRoom).toBeNull();
        expect(next.lastLevelResult?.livesRemaining).toBe(0);
    });
});

describe('REG-017 route choices', () => {
    it('adds deterministic local route options to eligible endless floor clears', () => {
        const finished = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_001 }), 1);

        expect(finished.lastLevelResult?.routeChoices).toMatchObject([
            {
                id: `${GAME_RULES_VERSION}:17001:2:safe`,
                routeType: 'safe',
                label: 'Safe passage'
            },
            {
                id: `${GAME_RULES_VERSION}:17001:2:greed`,
                routeType: 'greed',
                label: 'Greedy route'
            },
            {
                id: `${GAME_RULES_VERSION}:17001:2:mystery`,
                routeType: 'mystery',
                label: 'Mystery route'
            }
        ]);
        expect(finished.lastLevelResult?.routeChoices?.[0]?.detail).toContain('Keep the run curve predictable.');
        expect(finished.lastLevelResult?.routeChoices?.[1]?.detail).toContain('Trait pressure: more Volatile/Cursed pairs');
        expect(finished.lastLevelResult?.routeChoices?.[2]?.detail).toContain('Trait pressure: Mirror/Sealed unknowns');
        expect(playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_001 }), 1).lastLevelResult?.routeChoices).toEqual(
            finished.lastLevelResult?.routeChoices
        );
    });

    it('applies safe route recovery, then guard when already full', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_002 }), 1);
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;

        const healed = applyRouteChoiceOutcome({ ...cleared, lives: 3, shopGold: 2 }, safeId);
        expect(healed.applied).toBe(true);
        expect(healed.run.lives).toBe(4);
        expect(healed.run.shopGold).toBe(1);
        expect(healed.run.lastLevelResult?.livesRemaining).toBe(4);
        expect(healed.summaryText).toContain('Spent 1 shop gold');

        const freeHeal = applyRouteChoiceOutcome({ ...cleared, lives: 3, shopGold: 0 }, safeId);
        expect(freeHeal.applied).toBe(true);
        expect(freeHeal.run.lives).toBe(4);
        expect(freeHeal.run.shopGold).toBe(0);

        const guarded = applyRouteChoiceOutcome({ ...cleared, lives: MAX_LIVES, shopGold: 2 }, safeId);
        expect(guarded.applied).toBe(true);
        expect(guarded.run.stats.guardTokens).toBe(cleared.stats.guardTokens + 1);
        expect(guarded.run.shopGold).toBe(1);

        const capped = applyRouteChoiceOutcome(
            { ...cleared, lives: MAX_LIVES, shopGold: 2, stats: { ...cleared.stats, guardTokens: MAX_GUARD_TOKENS } },
            safeId
        );
        expect(capped.applied).toBe(true);
        expect(capped.run.stats.guardTokens).toBe(MAX_GUARD_TOKENS);
        expect(capped.run.shopGold).toBe(2);
        expect(capped.summaryText).toBe('Safe route: guard tokens already full.');
    });

    it('lets safe route stabilize recall lapses into next-floor memorize time', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_012 }), 1);
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;

        const stabilized = applyRouteChoiceOutcome(
            {
                ...cleared,
                lastLevelResult: {
                    ...cleared.lastLevelResult!,
                    recallMistakes: 1
                }
            },
            safeId
        );

        expect(stabilized.applied).toBe(true);
        expect(stabilized.run.pendingMemorizeBonusMs).toBe(MEMORIZE_BONUS_PER_LIFE_LOST_MS);
        expect(stabilized.summaryText).toContain('Recall stabilized');
    });

    it('applies greedy route payout and refuses greed at one life', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_003 }), 1);
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const beforeScore = cleared.stats.totalScore;
        const beforeGold = cleared.shopGold;

        const greedy = applyRouteChoiceOutcome(cleared, greedId);
        expect(greedy.applied).toBe(true);
        expect(greedy.run.shopGold).toBe(beforeGold + 3);
        expect(greedy.run.stats.totalScore).toBe(beforeScore + 35);
        expect(greedy.run.lastLevelResult?.scoreGained).toBe(cleared.lastLevelResult!.scoreGained + 35);
        expect(greedy.run.lives).toBe(cleared.lives - 1);

        const refused = applyRouteChoiceOutcome({ ...cleared, lives: 1 }, greedId);
        expect(refused.applied).toBe(false);
        expect(refused.reason).toBe('unavailable');
        expect(refused.run.lives).toBe(1);
        expect(
            getRouteChoiceAvailability(
                { ...cleared, lives: 1 },
                cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!
            )
        ).toEqual({
            available: false,
            reason: 'needs_more_lives',
            label: 'Unavailable at 1 life'
        });
    });

    it('applies a route choice only once when the choice button is double-clicked', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_013 }), 1);
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;

        const first = applyRouteChoiceOutcome(cleared, greedId);
        const second = applyRouteChoiceOutcome(first.run, greedId);
        const changed = applyRouteChoiceOutcome(first.run, safeId);

        expect(first.applied).toBe(true);
        expect(second).toMatchObject({ applied: false, reason: 'unavailable' });
        expect(second.run).toBe(first.run);
        expect(changed).toMatchObject({ applied: false, reason: 'unavailable' });
        expect(changed.run).toBe(first.run);
        expect(second.run.shopGold).toBe(cleared.shopGold + 3);
        expect(second.run.lives).toBe(cleared.lives - 1);
        expect(second.run.stats.totalScore).toBe(cleared.stats.totalScore + 35);
    });

    it('does not let a route button overwrite an already planned gateway route', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_113 }), 1);
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;
        const gatewayPlanned: RunState = {
            ...cleared,
            pendingRouteCardPlan: {
                choiceId: `gateway:${cleared.runRulesVersion}:${cleared.runSeed}:1:greed`,
                routeType: 'greed',
                sourceLevel: cleared.board!.level,
                targetLevel: cleared.board!.level + 1
            }
        };

        const result = applyRouteChoiceOutcome(gatewayPlanned, safeId);

        expect(result).toMatchObject({ applied: false, routeType: 'safe', reason: 'unavailable' });
        expect(result.run).toBe(gatewayPlanned);
    });

    it('opens route side rooms and clears them through claim or skip', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_303 }), 1);
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const mysteryId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!.id;

        const safeRoom = openRouteSideRoom(applyRouteChoiceOutcome({ ...cleared, lives: 3 }, safeId).run);
        const safeClaimed = claimRouteSideRoomPrimary(safeRoom);
        const greedRoom = openRouteSideRoom(applyRouteChoiceOutcome(cleared, greedId).run);
        const greedSkipped = skipRouteSideRoom(greedRoom);
        const mysteryRoom = openRouteSideRoom(applyRouteChoiceOutcome(cleared, mysteryId).run);

        expect(safeRoom.sideRoom).toMatchObject({ kind: 'rest_shrine', routeType: 'safe' });
        expect(safeClaimed.sideRoom).toBeNull();
        expect(safeClaimed.lives).toBe(5);
        expect(safeClaimed.lastLevelResult?.livesRemaining).toBe(5);
        expect(safeClaimed.shopGold).toBe(Math.max(0, safeRoom.shopGold - 1));
        expect(claimRouteSideRoomPrimary({ ...safeRoom, lives: 0 })).toMatchObject({
            sideRoom: safeRoom.sideRoom,
            lives: 0
        });
        expect(greedRoom.sideRoom).toMatchObject({ kind: 'bonus_reward', routeType: 'greed' });
        expect(greedSkipped.sideRoom).toBeNull();
        expect(greedSkipped.shopGold).toBe(greedRoom.shopGold);
        const greedPrimaryRewardInstanceId =
            greedRoom.sideRoom!.choices?.find((choice) => choice.primary)?.id ??
            (greedRoom.sideRoom!.payload as { kind: 'bonus_reward'; instanceId: string }).instanceId;
        const duplicateRewardRoom = {
            ...greedRoom,
            bonusRewardLedger: {
                claimedInstanceIds: [
                    greedPrimaryRewardInstanceId,
                    greedPrimaryRewardInstanceId,
                    42
                ],
                claimedRewardIds: { supply_cache: Number.NaN },
                discoveredSecretRooms: Number.NaN,
                openedTreasureRooms: -1
            } as unknown as RunState['bonusRewardLedger']
        };
        const duplicateRewardClaim = claimRouteSideRoomPrimary(duplicateRewardRoom);
        expect(duplicateRewardClaim.sideRoom).toBeNull();
        expect(duplicateRewardClaim.bonusRewardLedger).toMatchObject({
            claimedInstanceIds: [greedPrimaryRewardInstanceId],
            claimedRewardIds: {},
            discoveredSecretRooms: 0,
            openedTreasureRooms: 0
        });
        expect(mysteryRoom.sideRoom?.routeType).toBe('mystery');
        expect(mysteryRoom.sideRoom?.kind).toMatch(/run_event|bonus_reward/);
    });

    it('supports explicit event side-room choices', () => {
        const base = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_004 }), 1);
        const event = rollRunEventRoom({ runSeed: base.runSeed, rulesVersion: base.runRulesVersion, floor: 2 });
        const choice = event.options.find((item) => item.effect === 'gain_iron_key') ?? event.options[0]!;
        const eventRun: RunState = {
            ...base,
            sideRoom: {
                id: `${event.eventKey}:side`,
                kind: 'run_event',
                routeType: 'mystery',
                nodeKind: 'event',
                floor: 2,
                title: event.title,
                body: event.body,
                primaryLabel: event.options[0]!.label,
                primaryDetail: event.options[0]!.detail,
                skipLabel: 'Decline',
                choices: event.options.map((option, index) => ({
                    id: option.id,
                    label: option.label,
                    detail: option.detail,
                    primary: index === 0
                })),
                payload: { kind: 'event_choice', eventKey: event.eventKey, choiceId: event.options[0]!.id }
            }
        };

        const invalid = claimRouteSideRoomChoice(eventRun, 'missing-choice');
        expect(invalid).toBe(eventRun);
        expect(invalid.sideRoom).toBe(eventRun.sideRoom);

        const claimed = claimRouteSideRoomChoice(eventRun, choice.id);
        const expected = applyRunEventChoice({ ...eventRun, sideRoom: null }, event, choice.id).run;

        expect(claimed.sideRoom).toBeNull();
        expect(claimed.dungeonKeys.iron ?? 0).toBe(expected.dungeonKeys.iron ?? 0);
        expect(claimed.destroyPairCharges).toBe(expected.destroyPairCharges);
        expect(claimed.shopGold).toBe(expected.shopGold);
        expect(claimed.relicFavorProgress).toBe(expected.relicFavorProgress);
        expect(claimed.stats.totalScore).toBe(expected.stats.totalScore);
        expect(claimRouteSideRoomChoice(claimed, choice.id)).toBe(claimed);
    });

    it('keeps expanded run events in the deterministic offline event table', () => {
        expect(RUN_EVENT_TABLE.map((event) => event.id)).toEqual(
            expect.arrayContaining(['sealed_keyring', 'cracked_altar', 'trap_survey'])
        );
        expect(RUN_EVENT_TABLE.flatMap((event) => event.choices.map((choice) => choice.effect))).toEqual(
            expect.arrayContaining(['gain_iron_key', 'gain_destroy_charge', 'gain_score'])
        );
    });

    it('stamps the chosen route onto the next board and consumes the pending route plan', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_013 }), 1);
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const greedy = applyRouteChoiceOutcome(cleared, greedId);

        expect(greedy.run.pendingRouteCardPlan).toMatchObject({
            choiceId: greedId,
            routeType: 'greed',
            sourceLevel: 1,
            targetLevel: 2
        });

        const next = advanceToNextLevel(greedy.run);
        expect(next.pendingRouteCardPlan).toBeNull();
        expect(next.board!.routeWorldProfile).toMatchObject({ routeType: 'greed', rewardBudget: 3 });
        const routeTiles = next.board!.tiles.filter((tile) => tile.routeCardKind === 'greed_cache');
        expect(routeTiles).toHaveLength(8);
        expect(new Set(routeTiles.map((tile) => tile.pairKey))).toHaveLength(4);
        expect(next.board!.tiles.filter((tile) => tile.routeSpecialKind === 'greed_toll')).toHaveLength(2);
        expect(next.board!.tiles.filter((tile) => tile.routeSpecialKind === 'elite_cache')).toHaveLength(2);
        expect(next.board!.tiles.filter((tile) => tile.routeSpecialKind === 'catalyst_altar')).toHaveLength(2);
        expect(routeTiles[0]!.pairKey).not.toBe(DECOY_PAIR_KEY);
        expect(routeTiles[0]!.pairKey).not.toBe(WILD_PAIR_KEY);
    });

    it('turns route selection into persistent dungeon-node entry', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_213 }), 1);
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const chosen = applyRouteChoiceOutcome(cleared, greedId).run;

        expect(cleared.dungeonRun.nodes.find((node) => node.id === cleared.dungeonRun.currentNodeId)?.status).toBe('cleared');
        expect(chosen.dungeonRun.selectedNodeId).toBe(greedId);
        expect(chosen.dungeonRun.nodes.find((node) => node.id === greedId)).toMatchObject({
            kind: 'elite',
            status: 'revealed'
        });

        const next = advanceToNextLevel(chosen);
        expect(next.dungeonRun.currentNodeId).toBe(greedId);
        expect(next.dungeonRun.selectedNodeId).toBeNull();
        expect(next.dungeonRun.nodes.find((node) => node.id === greedId)?.status).toBe('current');
        expect(next.dungeonRun.nodes.filter((node) => node.status === 'skipped')).toHaveLength(2);
        expect(next.board!.floorArchetypeId).toBe('rush_recall');
        expect(next.board!.dungeonObjectiveId).toBe('pacify_floor');
    });

    it('does not let stale selected route nodes shape the next generated board', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_214 }), 1);
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const chosen = applyRouteChoiceOutcome(cleared, greedId).run;
        const staleSibling = chosen.dungeonRun.nodes.find(
            (node) => node.floor === 2 && node.id !== greedId && node.status === 'skipped'
        )!;
        const staleSelected = {
            ...chosen,
            dungeonRun: {
                ...chosen.dungeonRun,
                selectedNodeId: staleSibling.id,
                nodes: chosen.dungeonRun.nodes.map((node) =>
                    node.id === staleSibling.id ? { ...node, kind: 'boss' as const } : node
                )
            }
        };

        const next = advanceToNextLevel(staleSelected);

        expect(next.dungeonRun.currentNodeId).not.toBe(staleSibling.id);
        expect(next.dungeonRun.selectedNodeId).toBeNull();
        expect(next.board!.floorTag).not.toBe('boss');
        expect(next.board!.dungeonObjectiveId).not.toBe('defeat_boss');
    });

    it('does not enter selected route nodes that skip beyond the next board floor', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_215 }), 1);
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const chosen = applyRouteChoiceOutcome(cleared, greedId).run;
        const futureGreed = {
            ...chosen,
            dungeonRun: {
                ...chosen.dungeonRun,
                nodes: chosen.dungeonRun.nodes.map((node) =>
                    node.id === greedId ? { ...node, floor: 3, depth: 3, kind: 'boss' as const } : node
                )
            }
        };

        const next = advanceToNextLevel(futureGreed);

        expect(next.board!.level).toBe(2);
        expect(next.dungeonRun.currentFloor).toBe(next.board!.level);
        expect(next.dungeonRun.currentNodeId).not.toBe(greedId);
        expect(next.board!.floorTag).not.toBe('boss');
        expect(next.board!.dungeonObjectiveId).not.toBe('defeat_boss');
    });

    it('makes dungeon node kinds visibly alter encounter board shape', () => {
        const common = {
            runSeed: 17_414,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless' as const
        };
        const combat = buildBoard(5, { ...common, dungeonNodeKind: 'combat' });
        const elite = buildBoard(5, { ...common, dungeonNodeKind: 'elite' });
        const rest = buildBoard(5, { ...common, dungeonNodeKind: 'rest' });
        const shop = buildBoard(5, { ...common, dungeonNodeKind: 'shop' });
        const treasure = buildBoard(5, { ...common, dungeonNodeKind: 'treasure' });

        expect(elite.pairCount).toBeGreaterThan(combat.pairCount);
        expect(rest.pairCount).toBeLessThan(combat.pairCount);
        expect(elite.floorArchetypeId).toBe('rush_recall');
        expect(treasure.floorArchetypeId).toBe('treasure_gallery');
        expect(shop.tiles.some((tile) => tile.pairKey === SHOP_PAIR_KEY)).toBe(true);
        expect(rest.tiles.some((tile) => tile.pairKey === SHOP_PAIR_KEY)).toBe(false);
        expect(treasure.tiles.filter((tile) => tile.dungeonCardKind === 'treasure').length).toBeGreaterThan(
            combat.tiles.filter((tile) => tile.dungeonCardKind === 'treasure').length
        );
    });

    it('covers every dungeon card family through generated gameplay boards', () => {
        const coverage = collectDungeonFeatureCoverage();
        const failure = formatDungeonCoverageFailure(coverage);

        expect(missingCoverage(EXPECTED_GAMEPLAY_NODE_KINDS, coverage.nodeKinds), failure).toEqual([]);
        expect(missingCoverage(EXPECTED_GAMEPLAY_CARD_KINDS, coverage.cardKinds), failure).toEqual([]);
        expect(missingCoverage(EXPECTED_MAJOR_EFFECT_FAMILIES, coverage.effectFamilies), failure).toEqual([]);
        expect(coverage.hasBoss, failure).toBe(true);
        expect(coverage.hasExit, failure).toBe(true);
        expect(coverage.hasShopTile, failure).toBe(true);
        expect(coverage.hasRoomTile, failure).toBe(true);
        expect(coverage.hasLockedExit, failure).toBe(true);
        expect(coverage.hasRouteGateway, failure).toBe(true);
        expect(coverage.objectives.size).toBeGreaterThan(4);
        expect([...coverage.objectives]).toEqual(
            expect.arrayContaining(['find_exit', 'pacify_floor', 'disarm_traps', 'loot_cache', 'reveal_unknowns'])
        );
    });

    it('plays generated enemy cards through reveal, active damage, attack, and defeat', () => {
        const board = buildBoard(5, {
            runSeed: 172_501,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'trap',
            gameMode: 'endless'
        });
        const groups = new Map<string, Tile[]>();
        for (const tile of board.tiles) {
            const group = groups.get(tile.pairKey) ?? [];
            group.push(tile);
            groups.set(tile.pairKey, group);
        }
        const enemyPair = [...groups.values()].find((group) =>
            group.every((tile) => tile.dungeonCardKind === 'enemy' && tile.dungeonCardHp === 2)
        )!;
        const supportPair = [...groups.values()].find((group) =>
            group.length === 2 &&
            group.every(
                (tile) =>
                    tile.dungeonCardKind !== 'enemy' &&
                    tile.dungeonCardKind !== 'trap' &&
                    tile.pairKey !== DECOY_PAIR_KEY &&
                    tile.pairKey !== WILD_PAIR_KEY &&
                    tile.pairKey !== EXIT_PAIR_KEY &&
                    tile.pairKey !== SHOP_PAIR_KEY &&
                    tile.pairKey !== ROOM_PAIR_KEY
            )
        )!;
        expect(enemyPair).toBeDefined();
        expect(supportPair).toBeDefined();

        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 172_501 }));
        const run: RunState = {
            ...base,
            board,
            status: 'playing',
            stats: { ...base.stats, tries: 1 },
            findablesTotalThisFloor: countFindablePairs(board.tiles)
        };
        const revealed = flipTile(run, enemyPair[0]!.id);
        expect(
            revealed.board!.tiles
                .filter((tile) => tile.pairKey === enemyPair[0]!.pairKey)
                .every((tile) => tile.dungeonCardState === 'revealed')
        ).toBe(true);

        const afterEnemyMiss = resolveBoardTurn(flipTile(revealed, supportPair[0]!.id));
        expect(afterEnemyMiss.lives).toBeLessThan(run.lives);
        expect(afterEnemyMiss.pendingMemorizeBonusMs).toBe(MEMORIZE_BONUS_PER_LIFE_LOST_MS * 2);
        expect(afterEnemyMiss.board!.tiles.find((tile) => tile.id === enemyPair[0]!.id)!.dungeonCardState).toBe(
            'revealed'
        );

        const damaged = resolveBoardTurn(flipTile(flipTile(afterEnemyMiss, supportPair[0]!.id), supportPair[1]!.id));
        const damagedEnemy = damaged.board!.tiles.find((tile) => tile.id === enemyPair[0]!.id)!;
        expect(damagedEnemy.dungeonCardHp).toBe(1);
        expect(damagedEnemy.dungeonCardState).toBe('revealed');
        expect(damaged.dungeonEnemiesDefeatedThisFloor).toBe(0);

        const defeated = resolveBoardTurn(flipTile(flipTile(damaged, enemyPair[0]!.id), enemyPair[1]!.id));
        expect(defeated.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(defeated.board!.tiles.find((tile) => tile.id === enemyPair[0]!.id)!.state).toBe('matched');
        expect(defeated.stats.totalScore).toBeGreaterThan(damaged.stats.totalScore);
        const lifecycle = getDungeonEnemyLifecycleStatus(defeated);
        expect(lifecycle.enemyCardPairCount).toBeGreaterThanOrEqual(1);
        expect(lifecycle.defeatedEnemyCardPairCount).toBeGreaterThanOrEqual(1);
        expect(lifecycle).toMatchObject({
            enemyCardVocabulary: 'enemy_card_pair',
            movingEnemyVocabulary: 'moving_enemy_patrol'
        });
    });

    it('springs trap cards on first reveal and clears selection for the next action', () => {
        const board = buildBoard(5, {
            runSeed: 172_601,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'trap',
            gameMode: 'endless'
        });
        const groups = new Map<string, Tile[]>();
        for (const tile of board.tiles) {
            const group = groups.get(tile.pairKey) ?? [];
            group.push(tile);
            groups.set(tile.pairKey, group);
        }
        const trapPair = [...groups.values()].find((group) =>
            group.every((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'hidden')
        )!;
        const supportPair = [...groups.values()].find((group) =>
            group.length === 2 &&
            group.every(
                (tile) =>
                    tile.dungeonCardKind !== 'enemy' &&
                    tile.dungeonCardKind !== 'trap' &&
                    tile.pairKey !== DECOY_PAIR_KEY &&
                    tile.pairKey !== WILD_PAIR_KEY &&
                    tile.pairKey !== EXIT_PAIR_KEY &&
                    tile.pairKey !== SHOP_PAIR_KEY &&
                    tile.pairKey !== ROOM_PAIR_KEY
            )
        )!;
        expect(trapPair).toBeDefined();
        expect(supportPair).toBeDefined();

        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 172_601 }));
        const run: RunState = {
            ...base,
            board,
            status: 'playing',
            stats: { ...base.stats, tries: 1 },
            findablesTotalThisFloor: countFindablePairs(board.tiles)
        };

        const sprung = flipTile(run, trapPair[0]!.id);
        const sprungTrap = sprung.board!.tiles.find((tile) => tile.id === trapPair[0]!.id)!;

        expect(sprung.status).toBe('playing');
        expect(sprung.board!.flippedTileIds).toEqual([]);
        expect(sprung.dungeonTrapsTriggered).toBe(run.dungeonTrapsTriggered + 1);
        expect(sprung.dungeonTrapsResolvedThisFloor).toBe((run.dungeonTrapsResolvedThisFloor ?? 0) + 1);
        expect(sprungTrap.dungeonCardState).toBe('resolved');
        expect(getDungeonCardCopy(sprungTrap)).toContain('Resolved trap');

        const next = flipTile(sprung, supportPair[0]!.id);
        expect(next.board!.flippedTileIds).toEqual([supportPair[0]!.id]);
    });

    it('clears the floor when a self-resolving trap is the final unmatched pair', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            { ...createTile('a1', 'A', 'A'), state: 'matched' },
            { ...createTile('a2', 'A', 'A'), state: 'matched' }
        ];
        const base = createRun(tiles);
        const run: RunState = {
            ...base,
            status: 'playing',
            board: {
                ...base.board!,
                matchedPairs: 1
            }
        };

        const cleared = flipTile(run, 't1');

        expect(cleared.status).toBe('levelComplete');
        expect(cleared.board!.flippedTileIds).toEqual([]);
        expect(cleared.dungeonTrapsTriggered).toBe(run.dungeonTrapsTriggered + 1);
        expect(cleared.board!.tiles.filter((tile) => tile.pairKey === 'T').every(isSprungTrapForTest)).toBe(true);
        expect(isBoardComplete(cleared.board!)).toBe(true);
    });

    it('generates deterministic rotating enemy hazards with telegraphed next targets', () => {
        const options = {
            runSeed: 182_001,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'trap' as const,
            gameMode: 'endless' as const
        };
        const board = buildBoard(5, options);
        const repeat = buildBoard(5, options);

        expect(board.enemyHazards?.length).toBeGreaterThan(0);
        expect(repeat.enemyHazards).toEqual(board.enemyHazards);
        for (const hazard of board.enemyHazards ?? []) {
            expect(board.tiles.some((tile) => tile.id === hazard.currentTileId)).toBe(true);
            expect(board.tiles.some((tile) => tile.id === hazard.nextTileId)).toBe(true);
            expect(hazard.currentTileId).not.toBe(hazard.nextTileId);
        }
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 182_001 })),
            board,
            status: 'playing' as const
        };
        expect(getDungeonBoardPresentation(run).chips).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'enemy-hazards', label: 'Patrols' })])
        );
        expect(getDungeonBoardPresentation(run).alertText).toMatch(/moving after each action/i);
        expect(getDungeonEnemyLifecycleStatus(run)).toMatchObject({
            movingEnemyHazardCount: board.enemyHazards!.length,
            revealedMovingEnemyHazardCount: 0,
            defeatedMovingEnemyHazardCount: 0
        });
    });

    it('documents and applies enemy movement pattern candidate priorities', () => {
        expect(Object.keys(ENEMY_HAZARD_PATTERN_DEFINITIONS).sort()).toEqual(
            ['guard', 'observe', 'patrol', 'stalk'].sort()
        );

        const board = createBoard([
            { ...createTile('plain-hidden', 'P', 'P'), state: 'hidden' },
            { ...createTile('plain-flipped', 'Q', 'Q'), state: 'flipped' },
            {
                ...createTile('treasure', 'T', '$'),
                dungeonCardKind: 'treasure',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'treasure_cache'
            },
            {
                ...createTile('key', 'K', 'K'),
                dungeonCardKind: 'key',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'key_iron'
            },
            {
                ...createTile('trap', 'X', '!'),
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_alarm'
            },
            {
                ...createTile('enemy', 'E', 'e'),
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry'
            },
            { ...createTile('matched', 'M', 'M'), state: 'matched' },
            { ...createTile('exit', EXIT_PAIR_KEY, '^'), dungeonCardKind: 'exit', dungeonCardEffectId: 'exit_safe' }
        ]);

        expect(getEnemyHazardMovementCandidateIds(board, 'patrol')).toEqual([
            'plain-hidden',
            'plain-flipped',
            'treasure',
            'key',
            'trap',
            'enemy'
        ]);
        expect(getEnemyHazardMovementCandidateIds(board, 'stalk')).toEqual([
            'plain-hidden',
            'treasure',
            'key',
            'trap',
            'enemy'
        ]);
        expect(getEnemyHazardMovementCandidateIds(board, 'guard')).toEqual(['treasure', 'key']);
        expect(getEnemyHazardMovementCandidateIds(board, 'observe')).toEqual(['trap', 'enemy']);
    });

    it('clicking an enemy-occupied card deals hazard damage without flipping the card', () => {
        const board = buildBoard(5, {
            runSeed: 182_002,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'trap',
            gameMode: 'endless'
        });
        const hazard = board.enemyHazards![0]!;
        const targetTile = board.tiles.find((tile) => tile.id === hazard.currentTileId)!;
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 182_002 }));
        const run: RunState = {
            ...base,
            board,
            status: 'playing',
            stats: { ...base.stats, guardTokens: 0 }
        };

        const hit = applyEnemyHazardClick(run, hazard.currentTileId);

        expect(hit.lives).toBe(run.lives - hazard.damage);
        expect(hit.pendingMemorizeBonusMs).toBe(MEMORIZE_BONUS_PER_LIFE_LOST_MS * hazard.damage);
        expect(hit.enemyHazardHitsThisFloor).toBe(1);
        expect(hit.board!.tiles.find((tile) => tile.id === targetTile.id)!.state).toBe('hidden');
        expect(hit.board!.flippedTileIds).toEqual([]);
        expect(hit.board!.enemyHazards!.find((item) => item.id === hazard.id)!.state).toBe('revealed');
        expect(hit.board!.enemyHazards!.find((item) => item.id === hazard.id)!.currentTileId).toBe(hazard.nextTileId);
        expect(getDungeonEnemyLifecycleStatus(hit)).toMatchObject({
            movingEnemyHazardCount: board.enemyHazards!.length,
            revealedMovingEnemyHazardCount: 1
        });
        expect(getDungeonBoardPresentation(hit).alertText).toMatch(/safe matches damage revealed patrols/i);
    });

    it('spends guard tokens before life on enemy contact', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const board = createBoard([a1, a2], {
            enemyHazards: [
                {
                    id: 'guarded-hit',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a1.id,
                    nextTileId: a2.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 2,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const base = createRun([a1, a2], { board, status: 'playing' });
        const guardedRun = { ...base, stats: { ...base.stats, guardTokens: 1 } };
        const hit = applyEnemyHazardClick(guardedRun, a1.id, { advanceHazards: false });

        expect(hit.lives).toBe(guardedRun.lives);
        expect(hit.pendingMemorizeBonusMs).toBe(guardedRun.pendingMemorizeBonusMs);
        expect(hit.stats.guardTokens).toBe(0);
        expect(hit.enemyHazardHitsThisFloor).toBe(1);
        expect(hit.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: a1.id });
    });

    it('stops the card action when enemy contact causes game over', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const board = createBoard([a1, a2], {
            enemyHazards: [
                {
                    id: 'fatal-hit',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a1.id,
                    nextTileId: a2.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 2,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const run = { ...createRun([a1, a2], { board, status: 'playing' }), lives: 1 };
        const hit = applyEnemyHazardClick(run, a1.id, { advanceHazards: false });
        const attemptedFlip = flipTile(hit, a1.id);

        expect(hit.status).toBe('gameOver');
        expect(attemptedFlip).toBe(hit);
        expect(attemptedFlip.board!.tiles.find((tile) => tile.id === a1.id)!.state).toBe('hidden');
    });

    it('does not advance enemy movement after fatal direct contact', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const [b1, b2] = createPair('p2', 'B', 'b');
        const board = createBoard([a1, a2, b1, b2], {
            enemyHazards: [
                {
                    id: 'fatal-default-hit',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a1.id,
                    nextTileId: b1.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 2,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const run = { ...createRun([a1, a2, b1, b2], { board, status: 'playing' }), lives: 1 };

        const hit = applyEnemyHazardClick(run, a1.id);

        expect(hit.status).toBe('gameOver');
        expect(hit.board!.enemyHazardTurn).toBe(0);
        expect(hit.board!.enemyHazards![0]).toMatchObject({
            state: 'revealed',
            currentTileId: a1.id,
            nextTileId: b1.id
        });
    });

    it('ends a resolving turn immediately when enemy contact is fatal', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const [b1, b2] = createPair('p2', 'B', 'b');
        const [c1, c2] = createPair('p3', 'C', 'c');
        const board = createBoard([a1, a2, b1, b2, c1, c2], {
            flippedTileIds: [a1.id, b1.id],
            enemyHazards: [
                {
                    id: 'fatal-gambit-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: c1.id,
                    nextTileId: c2.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const run: RunState = {
            ...createRun([a1, a2, b1, b2, c1, c2], { board, status: 'resolving' }),
            lives: 1,
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            stats: { ...createRun([a1, a2, b1, b2, c1, c2]).stats, guardTokens: 0 }
        };

        const hit = applyEnemyHazardClick(run, c1.id, { advanceHazards: false });
        const attemptedGambit = flipTile(hit, c1.id);
        const attemptedResolve = resolveBoardTurn(hit);

        expect(hit.status).toBe('gameOver');
        expect(hit.lives).toBe(0);
        expect(hit.board!.flippedTileIds).toEqual([a1.id, b1.id]);
        expect(hit.board!.tiles.find((tile) => tile.id === c1.id)!.state).toBe('hidden');
        expect(hit.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: c1.id });
        expect(attemptedGambit).toBe(hit);
        expect(attemptedResolve).toBe(hit);
    });

    it('can apply enemy contact and then flip the occupied card', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const board = createBoard([a1, a2], {
            enemyHazards: [
                {
                    id: 'single-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a1.id,
                    nextTileId: a2.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const hazard = board.enemyHazards![0]!;
        const base = createRun([a1, a2], { board, status: 'playing' });
        const run: RunState = {
            ...base,
            board,
            status: 'playing',
            stats: { ...base.stats, guardTokens: 0 }
        };

        const hit = applyEnemyHazardClick(run, hazard.currentTileId, { advanceHazards: false });
        const flipped = flipTile(hit, hazard.currentTileId);

        expect(hit.lives).toBe(run.lives - hazard.damage);
        expect(flipped.lives).toBe(hit.lives);
        expect(flipped.board!.tiles.find((tile) => tile.id === hazard.currentTileId)!.state).toBe('flipped');
        expect(flipped.board!.enemyHazards!.find((item) => item.id === hazard.id)!.state).toBe('revealed');
    });

    it('does not apply repeat enemy contact damage once the occupied card is flipped', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const board = createBoard([a1, a2], {
            enemyHazards: [
                {
                    id: 'single-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a1.id,
                    nextTileId: a2.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const run = createRun([a1, a2], { board, status: 'playing' });

        const hit = applyEnemyHazardClick(run, a1.id, { advanceHazards: false });
        const flipped = flipTile(hit, a1.id);
        const repeated = applyEnemyHazardClick(flipped, a1.id, { advanceHazards: false });

        expect(flipped.lives).toBe(run.lives - 1);
        expect(repeated).toBe(flipped);
        expect(repeated.lives).toBe(flipped.lives);
        expect(repeated.enemyHazardHitsThisFloor).toBe(1);
    });

    it('can defer enemy movement to the match resolution on an occupied second flip', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const [b1, b2] = createPair('p2', 'B', 'b');
        const [c1, c2] = createPair('p3', 'C', 'c');
        const board = createBoard([a1, a2, b1, b2, c1, c2], {
            enemyHazards: [
                {
                    id: 'h1',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a2.id,
                    nextTileId: b1.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 2,
                    maxHp: 2
                }
            ],
            enemyHazardTurn: 0
        });
        const base = createRun([a1, a2, b1, b2, c1, c2], { board, status: 'playing' });
        const first = flipTile(base, a1.id);
        const hit = applyEnemyHazardClick(first, a2.id, { advanceHazards: false });
        const resolved = resolveBoardTurn(flipTile(hit, a2.id));

        expect(hit.board!.enemyHazards![0]!.currentTileId).toBe(a2.id);
        expect(resolved.board!.enemyHazards![0]!.currentTileId).toBe(b1.id);
        expect(resolved.board!.enemyHazardTurn).toBe(1);
    });

    it('clears one enemy occupation from the final remaining pair after contact', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const board = createBoard([a1, a2], {
            enemyHazards: [
                {
                    id: 'final-single',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a1.id,
                    nextTileId: a1.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const run = createRun([a1, a2], { board, status: 'playing' });

        const hit = applyEnemyHazardClick(run, a1.id, { advanceHazards: false });
        const flipped = flipTile(hit, a1.id);

        expect(hit.board!.enemyHazards![0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(flipped.board!.tiles.find((tile) => tile.id === a1.id)!.state).toBe('flipped');
        expect(flipped.status).toBe('playing');
    });

    it('clears two enemy occupations from the final remaining pair after the penultimate match', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const [b1, b2] = createPair('p2', 'B', 'b');
        const board = createBoard([a1, a2, b1, b2], {
            enemyHazards: [
                {
                    id: 'final-double',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: a1.id,
                    nextTileId: a2.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        });
        const run = createRun([a1, a2, b1, b2], { board, status: 'playing' });

        const afterPenultimateMatch = resolveBoardTurn(flipTile(flipTile(run, b1.id), b2.id));
        const flipped = flipTile(afterPenultimateMatch, a1.id);

        expect(afterPenultimateMatch.status).toBe('playing');
        expect(afterPenultimateMatch.board!.matchedPairs).toBe(1);
        expect(afterPenultimateMatch.board!.enemyHazards![0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(flipped.board!.tiles.find((tile) => tile.id === a1.id)!.state).toBe('flipped');
    });

    it('defeats remaining enemy hazards when the floor is cleared', () => {
        const [a1, a2] = createPair('p1', 'A', 'a');
        const [b1, b2] = createPair('p2', 'B', 'b');
        const board = createBoard([a1, a2, b1, b2], {
            dungeonObjectiveId: 'defeat_boss',
            enemyHazards: [
                {
                    id: 'boss',
                    kind: 'sentinel',
                    label: 'Rush Sentinel',
                    currentTileId: b1.id,
                    nextTileId: b2.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 3,
                    maxHp: 3,
                    bossId: 'rush_sentinel'
                }
            ],
            enemyHazardTurn: 0
        });
        let run = createRun([a1, a2, b1, b2], { board, status: 'playing' });

        run = resolveBoardTurn(flipTile(flipTile(run, a1.id), a2.id));
        run = resolveBoardTurn(flipTile(flipTile(run, b1.id), b2.id));

        expect(run.status).toBe('levelComplete');
        expect(run.board!.enemyHazards![0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(getDungeonObjectiveStatus(run)).toMatchObject({ completed: true });
    });

    it('damages revealed enemy hazards on safe matches and defeats boss overlays', () => {
        const board = buildBoard(6, {
            runSeed: 182_006,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'boss',
            gameMode: 'endless'
        });
        const boss = board.enemyHazards!.find((hazard) => hazard.bossId)!;
        const groups = new Map<string, Tile[]>();
        for (const tile of board.tiles) {
            if (tile.id === boss.currentTileId || tile.id === boss.nextTileId || tile.state !== 'hidden') {
                continue;
            }
            const group = groups.get(tile.pairKey) ?? [];
            group.push(tile);
            groups.set(tile.pairKey, group);
        }
        const matchPairs = [...groups.values()].filter(
            (group) => group.length === 2 && !group.some((tile) => tile.pairKey === EXIT_PAIR_KEY)
        );
        expect(matchPairs.length).toBeGreaterThanOrEqual(3);

        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 182_006 }));
        let run: RunState = {
            ...base,
            board: {
                ...board,
                enemyHazards: board.enemyHazards!.map((hazard) =>
                    hazard.id === boss.id ? { ...hazard, state: 'revealed' as const } : hazard
                )
            },
            status: 'playing',
            findablesTotalThisFloor: countFindablePairs(board.tiles)
        };

        for (let index = 0; index < boss.maxHp; index += 1) {
            const pair = matchPairs[index]!;
            run = resolveBoardTurn(flipTile(flipTile(run, pair[0]!.id), pair[1]!.id));
        }

        const defeatedBoss = run.board!.enemyHazards!.find((hazard) => hazard.id === boss.id)!;
        expect(defeatedBoss.state).toBe('defeated');
        expect(run.enemyHazardsDefeatedThisFloor).toBe(1);
        expect(getDungeonObjectiveStatus(run)).toMatchObject({ completed: true, progress: boss.maxHp, required: boss.maxHp });
    });

    it('solves generated scheduled floors after exhausting legal pair matches and activating the exit', () => {
        const seeds = [42_001, 172_707, 182_009, 192_012] as const;

        for (const runSeed of seeds) {
            for (let level = 1; level <= 12; level += 1) {
                const run = solveGeneratedFloorByExhaustingPairs({
                    level,
                    runSeed,
                    ...getScheduledSoftlockFloorOptions(level)
                });

                expect(run.status, `seed ${runSeed} level ${level}`).toBe('levelComplete');
                expect(
                    run.board!.enemyHazards?.filter((hazard) => hazard.bossId != null && hazard.state !== 'defeated') ?? [],
                    `seed ${runSeed} level ${level}`
                ).toEqual([]);
            }
        }
    });

    it('solves generated route-pressure floors after exhausting legal pair matches and activating the exit', () => {
        const seeds = [70_101, 70_202] as const;
        const routeTypes: RouteNodeType[] = ['safe', 'greed', 'mystery'];

        for (const runSeed of seeds) {
            for (const level of [2, 4, 6, 8] as const) {
                for (const routeType of routeTypes) {
                    const run = solveGeneratedFloorByExhaustingPairs({ level, runSeed, routeType });

                    expect(run.status, `seed ${runSeed} level ${level} route ${routeType}`).toBe('levelComplete');
                    expect(
                        run.board!.enemyHazards?.filter((hazard) => hazard.bossId != null && hazard.state !== 'defeated') ?? [],
                        `seed ${runSeed} level ${level} route ${routeType}`
                    ).toEqual([]);
                }
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
                    expect(
                        run.board!.enemyHazards?.filter((hazard) => hazard.bossId != null && hazard.state !== 'defeated') ?? [],
                        `${scenario.id} seed ${runSeed} level ${level}`
                    ).toEqual([]);
                }
            }
        }
    });

    it('solves generated boss floors without leaving stale boss locks or undefeated overlays', () => {
        const scenarios = [
            { level: 7, runSeed: 172_707, floorArchetypeId: 'trap_hall' as FloorArchetypeId, activeMutators: ['glass_floor', 'sticky_fingers'] as MutatorId[] },
            { level: 9, runSeed: 182_009, floorArchetypeId: 'rush_recall' as FloorArchetypeId, activeMutators: ['short_memorize', 'wide_recall'] as MutatorId[] },
            { level: 12, runSeed: 192_012, floorArchetypeId: null, activeMutators: [] as MutatorId[] }
        ];

        for (const scenario of scenarios) {
            const exhausted = solveGeneratedFloorByExhaustingPairs({
                ...scenario,
                floorTag: 'boss',
                dungeonNodeKind: 'boss',
                activateExit: false
            });

            expect(exhausted.status, `seed ${scenario.runSeed} level ${scenario.level}`).toBe('playing');
            expect(getDungeonObjectiveStatus(exhausted), `seed ${scenario.runSeed} level ${scenario.level}`).toMatchObject({
                objectiveId: 'defeat_boss',
                completed: true
            });
            expect(getDungeonBossReadModel(exhausted), `seed ${scenario.runSeed} level ${scenario.level}`).toMatchObject({
                phase: 'defeated',
                activeMovingPatrolCount: 0
            });
            expect(
                exhausted.board!.enemyHazards?.filter((hazard) => hazard.bossId != null && hazard.state !== 'defeated') ?? [],
                `seed ${scenario.runSeed} level ${scenario.level}`
            ).toEqual([]);
            expect(getDungeonExitStatus(exhausted).lockedReason, `seed ${scenario.runSeed} level ${scenario.level}`).not.toMatch(
                /defeat/i
            );

            const exitId = exhausted.board!.dungeonExitTileId!;
            const exited = activateDungeonExit(revealDungeonExit(exhausted, exitId));
            expect(exited.status, `seed ${scenario.runSeed} level ${scenario.level}`).toBe('levelComplete');
        }
    });

    it('removes generated enemies defeated by active chip damage from the board', () => {
        const board = buildBoard(5, {
            runSeed: 172_700,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'combat',
            gameMode: 'endless'
        });
        const groups = new Map<string, Tile[]>();
        for (const tile of board.tiles) {
            const group = groups.get(tile.pairKey) ?? [];
            group.push(tile);
            groups.set(tile.pairKey, group);
        }
        const enemyPair = [...groups.values()].find((group) =>
            group.every((tile) => tile.dungeonCardKind === 'enemy' && tile.dungeonCardHp === 1)
        )!;
        const supportPair = [...groups.values()].find((group) =>
            group.length === 2 &&
            group.every(
                (tile) =>
                    tile.dungeonCardKind !== 'enemy' &&
                    tile.dungeonCardKind !== 'trap' &&
                    tile.pairKey !== EXIT_PAIR_KEY &&
                    tile.pairKey !== SHOP_PAIR_KEY &&
                    tile.pairKey !== ROOM_PAIR_KEY
            )
        )!;
        expect(enemyPair).toBeDefined();
        expect(supportPair).toBeDefined();

        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 172_700 }));
        const run: RunState = {
            ...base,
            board,
            status: 'playing',
            findablesTotalThisFloor: countFindablePairs(board.tiles)
        };
        const revealed = {
            ...run,
            board: {
                ...run.board!,
                tiles: run.board!.tiles.map((tile) =>
                    tile.pairKey === enemyPair[0]!.pairKey ? { ...tile, dungeonCardState: 'revealed' as const } : tile
                )
            }
        };
        const resolved = resolveBoardTurn(flipTile(flipTile(revealed, supportPair[0]!.id), supportPair[1]!.id));

        expect(resolved.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(
            resolved.board!.tiles
                .filter((tile) => tile.pairKey === enemyPair[0]!.pairKey)
                .every((tile) => tile.state === 'removed' && tile.dungeonCardKind == null)
        ).toBe(true);
        expect(resolved.board!.matchedPairs).toBe(run.board!.matchedPairs + 2);
        expect(inspectBoardFairness(resolved.board!).issues.map((issue) => issue.code)).not.toContain(
            'matched_pairs_counter_mismatch'
        );
        expect(getDungeonObjectiveStatus({ ...resolved, board: { ...resolved.board!, dungeonObjectiveId: 'pacify_floor' } })).toMatchObject({
            completed: true,
            progress: 1,
            required: 1
        });
    });

    it('defeats a generated boss pair and completes legacy pacify progress', () => {
        const board = buildBoard(6, {
            runSeed: 172_601,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'boss',
            gameMode: 'endless'
        });
        const enemyGroups = new Map<string, Tile[]>();
        for (const tile of board.tiles.filter((candidate) => candidate.dungeonCardKind === 'enemy')) {
            const group = enemyGroups.get(tile.pairKey) ?? [];
            group.push(tile);
            enemyGroups.set(tile.pairKey, group);
        }
        const bossPair = board.tiles.filter((tile) => tile.dungeonBossId != null);
        expect(bossPair).toHaveLength(2);
        expect(board.dungeonObjectiveId).toBe('defeat_boss');

        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 172_601 }));
        const run: RunState = {
            ...base,
            board: { ...board, dungeonObjectiveId: 'pacify_floor', enemyHazards: [] },
            status: 'playing',
            findablesTotalThisFloor: countFindablePairs(board.tiles)
        };
        let defeated = resolveBoardTurn(flipTile(flipTile(run, bossPair[0]!.id), bossPair[1]!.id));

        expect(defeated.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(defeated.dungeonEnemiesDefeated).toBe(run.dungeonEnemiesDefeated + 1);
        expect(defeated.relicFavorProgress).toBeGreaterThan(run.relicFavorProgress);

        for (const pair of [...enemyGroups.values()].filter((group) => group.every((tile) => tile.dungeonBossId == null))) {
            defeated = resolveBoardTurn(flipTile(flipTile(defeated, pair[0]!.id), pair[1]!.id));
        }
        expect(getDungeonObjectiveStatus(defeated)).toMatchObject({ completed: true, progress: 2, required: 2 });
    });

    it('can route into every major dungeon node family during the first act', () => {
        const cases: { nextLevel: number; routeType: RouteNodeType; expectedKind: DungeonRunNodeKind }[] = [
            { nextLevel: 2, routeType: 'safe', expectedKind: 'combat' },
            { nextLevel: 2, routeType: 'greed', expectedKind: 'elite' },
            { nextLevel: 3, routeType: 'greed', expectedKind: 'shop' },
            { nextLevel: 4, routeType: 'safe', expectedKind: 'rest' },
            { nextLevel: 4, routeType: 'mystery', expectedKind: 'treasure' },
            { nextLevel: 5, routeType: 'greed', expectedKind: 'trap' },
            { nextLevel: 5, routeType: 'mystery', expectedKind: 'event' },
            { nextLevel: 6, routeType: 'safe', expectedKind: 'boss' }
        ];
        const enteredKinds = new Set<DungeonRunNodeKind>();

        for (const item of cases) {
            const runSeed = 171_000 + item.nextLevel;
            const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
            const currentLevel = item.nextLevel - 1;
            const board = buildBoard(currentLevel, {
                runSeed,
                runRulesVersion: GAME_RULES_VERSION,
                gameMode: 'endless'
            });
            const routeChoices = generateRouteChoices(base, item.nextLevel);
            const dungeonRun = revealDungeonChoices(
                createDungeonRunMapState(runSeed, GAME_RULES_VERSION, currentLevel),
                currentLevel,
                routeChoices
            );
            const completed: RunState = {
                ...base,
                status: 'levelComplete',
                board,
                dungeonRun,
                lastLevelResult: {
                    level: currentLevel,
                    scoreGained: 0,
                    rating: 'S',
                    livesRemaining: base.lives,
                    perfect: true,
                    mistakes: 0,
                    clearLifeReason: 'none',
                    clearLifeGained: 0,
                    routeChoices
                }
            };
            const choice = routeChoices.find((candidate) => candidate.routeType === item.routeType)!;
            const selected = applyRouteChoiceOutcome(completed, choice.id).run;
            const selectedNode = getSelectedDungeonNode(selected.dungeonRun);

            expect(selectedNode?.kind).toBe(item.expectedKind);
            const next = advanceToNextLevel(selected);

            enteredKinds.add(next.dungeonRun.nodes.find((node) => node.id === next.dungeonRun.currentNodeId)!.kind);
            expect(next.board!.level).toBe(item.nextLevel);
            expect(next.board!.routeWorldProfile).toMatchObject({ routeType: item.routeType });
        }

        expect([...enteredKinds].sort()).toEqual([...EXPECTED_GAMEPLAY_NODE_KINDS].sort());
    });

    it('repairs missing persistent map choices before applying a route reward', () => {
        const runSeed = 171_091;
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(1, {
            runSeed,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless'
        });
        const routeChoices = generateRouteChoices(base, 2);
        const completed: RunState = {
            ...base,
            status: 'levelComplete',
            board,
            dungeonRun: createDungeonRunMapState(runSeed, GAME_RULES_VERSION, 1),
            lastLevelResult: {
                level: 1,
                scoreGained: 0,
                rating: 'S',
                livesRemaining: base.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                routeChoices
            }
        };
        const greedChoice = routeChoices.find((candidate) => candidate.routeType === 'greed')!;

        const selected = applyRouteChoiceOutcome(completed, greedChoice.id).run;

        expect(getSelectedDungeonNode(selected.dungeonRun)).toMatchObject({
            id: greedChoice.id,
            kind: 'elite'
        });
        expect(inspectDungeonRunMapProgression(selected.dungeonRun).issues).toEqual([]);

        const next = advanceToNextLevel(selected);
        const currentNode = next.dungeonRun.nodes.find((node) => node.id === next.dungeonRun.currentNodeId);

        expect(next.board!.level).toBe(2);
        expect(currentNode).toMatchObject({
            id: greedChoice.id,
            kind: 'elite',
            status: 'current'
        });
        expect(inspectDungeonRunMapProgression(next.dungeonRun).issues).toEqual([]);
    });

    it('gives Safe and Mystery distinct route-world profiles on next board', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_113 }), 1);
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;
        const mysteryId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!.id;

        const safeNext = advanceToNextLevel(applyRouteChoiceOutcome(cleared, safeId).run);
        const mysteryNext = advanceToNextLevel(applyRouteChoiceOutcome(cleared, mysteryId).run);

        expect(safeNext.board!.routeWorldProfile).toMatchObject({ routeType: 'safe', hazardBudget: 0 });
        expect(safeNext.board!.tiles.filter((tile) => tile.routeSpecialKind === 'guard_cache')).toHaveLength(2);
        expect(safeNext.board!.tiles.filter((tile) => tile.routeSpecialKind === 'lantern_ward')).toHaveLength(2);
        expect(mysteryNext.board!.routeWorldProfile).toMatchObject({ routeType: 'mystery' });
        expect(mysteryNext.board!.tiles.filter((tile) => tile.routeSpecialKind === 'mystery_veil')).toHaveLength(2);
    });

    it('adds non-hard route card families into the board rendering metadata', () => {
        const greedBoard = routeBoard('greed', 3);
        const mysteryBoard = routeBoard('mystery', 3);

        expect(greedBoard.routeWorldProfile).toMatchObject({
            routeType: 'greed',
            routeSpecialKinds: ['greed_cache', 'greed_toll', 'fragile_cache', 'catalyst_altar']
        });
        expect(greedBoard.tiles.filter((tile) => tile.routeSpecialKind === 'fragile_cache')).toHaveLength(2);
        expect(greedBoard.tiles.filter((tile) => tile.routeSpecialKind === 'fragile_cache')[0]!.routeCardKind).toBe(
            'greed_cache'
        );
        expect(mysteryBoard.routeWorldProfile).toMatchObject({
            routeType: 'mystery',
            routeSpecialKinds: ['mystery_veil', 'secret_door', 'mimic_cache', 'loaded_gateway']
        });
        expect(mysteryBoard.tiles.filter((tile) => tile.routeSpecialKind === 'secret_door')).toHaveLength(2);
        expect(mysteryBoard.tiles.filter((tile) => tile.routeSpecialKind === 'secret_door')[0]!.routeCardKind).toBe(
            'mystery_veil'
        );
        expect(mysteryBoard.tiles.filter((tile) => tile.routeSpecialKind === 'mimic_cache')).toHaveLength(2);
        expect(mysteryBoard.tiles.filter((tile) => tile.routeSpecialKind === 'mimic_cache')[0]!.routeCardKind).toBe(
            'mystery_veil'
        );
    });

    it('adds keystone pairs as boss-floor route anchors', () => {
        const safeBoss = routeBoard('safe', 7, 'boss');
        const greedBoss = routeBoard('greed', 7, 'boss');
        const mysteryBoss = routeBoard('mystery', 7, 'boss');

        expect(safeBoss.tiles.filter((tile) => tile.routeSpecialKind === 'keystone_pair')).toHaveLength(2);
        expect(safeBoss.tiles.find((tile) => tile.routeSpecialKind === 'keystone_pair')!.routeCardKind).toBe(
            'safe_ward'
        );
        expect(greedBoss.tiles.find((tile) => tile.routeSpecialKind === 'keystone_pair')!.routeCardKind).toBe(
            'greed_cache'
        );
        expect(mysteryBoss.tiles.find((tile) => tile.routeSpecialKind === 'keystone_pair')!.routeCardKind).toBe(
            'mystery_veil'
        );
        expect(safeBoss.tiles.some((tile) => tile.routeSpecialKind === 'final_ward')).toBe(false);
        expect(greedBoss.tiles.some((tile) => tile.routeSpecialKind === 'elite_cache')).toBe(false);
        expect(mysteryBoss.tiles.some((tile) => tile.routeSpecialKind === 'omen_seal')).toBe(false);
    });

    it('adds elite route anchors to hard non-boss floors', () => {
        const safeHard = routeBoard('safe', 4, 'normal', { floorArchetypeId: 'trap_hall' });
        const greedHard = routeBoard('greed', 4, 'normal', { floorArchetypeId: 'rush_recall' });
        const mysteryHard = routeBoard('mystery', 4, 'normal', { activeMutators: ['glass_floor'] });

        expect(safeHard.routeWorldProfile).toMatchObject({
            routeType: 'safe',
            routeSpecialKinds: ['guard_cache', 'lantern_ward', 'final_ward', 'anchor_seal']
        });
        expect(greedHard.routeWorldProfile).toMatchObject({
            routeType: 'greed',
            routeSpecialKinds: ['greed_cache', 'greed_toll', 'elite_cache', 'catalyst_altar']
        });
        expect(mysteryHard.routeWorldProfile).toMatchObject({
            routeType: 'mystery',
            routeSpecialKinds: ['mystery_veil', 'omen_seal', 'loaded_gateway']
        });
        expect(safeHard.tiles.filter((tile) => tile.routeSpecialKind === 'final_ward')).toHaveLength(2);
        expect(safeHard.tiles.find((tile) => tile.routeSpecialKind === 'final_ward')!.routeCardKind).toBe(
            'safe_ward'
        );
        expect(greedHard.tiles.filter((tile) => tile.routeSpecialKind === 'elite_cache')).toHaveLength(2);
        expect(greedHard.tiles.find((tile) => tile.routeSpecialKind === 'elite_cache')!.routeCardKind).toBe(
            'greed_cache'
        );
        expect(mysteryHard.tiles.filter((tile) => tile.routeSpecialKind === 'omen_seal')).toHaveLength(2);
        expect(mysteryHard.tiles.find((tile) => tile.routeSpecialKind === 'omen_seal')!.routeCardKind).toBe(
            'mystery_veil'
        );
        expect(mysteryHard.tiles.find((tile) => tile.routeSpecialKind === 'omen_seal')!.routeSpecialRevealed).toBe(
            undefined
        );
    });

    it('applies elite encounter rules without boss scoring identity', () => {
        const rules = getDungeonEliteEncounterRules('elite')!;
        const combat = inspectDungeonEncounterBudget({
            runSeed: 35_001,
            rulesVersion: GAME_RULES_VERSION,
            level: 5,
            floorTag: 'normal',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'combat'
        });
        const elite = inspectDungeonEncounterBudget({
            runSeed: 35_001,
            rulesVersion: GAME_RULES_VERSION,
            level: 5,
            floorTag: 'normal',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'elite'
        });
        const eliteBoard = buildBoard(5, {
            runSeed: 35_001,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'normal',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'elite'
        });

        expect(rules).toMatchObject({
            label: 'Mnemonic Sentinel',
            objectiveId: 'pacify_floor',
            threatBudgetFloor: 2,
            rewardBudgetFloor: 1,
            scoreRule: 'Uses normal floor scoring; no boss multiplier.'
        });
        expect(rules.completionCopy).toMatch(/Elite pacified/);
        expect(rules.rewardHook).not.toMatch(/boss multiplier/i);
        expect(elite.floorArchetypeId).toBe('rush_recall');
        expect(elite.objectiveId).toBe('pacify_floor');
        expect(elite.threatPairCount).toBeGreaterThan(combat.threatPairCount);
        expect(elite.rewardPairCount).toBeGreaterThanOrEqual(1);
        expect(elite.bossPairCount).toBe(0);
        expect(eliteBoard.enemyHazards?.length).toBeGreaterThanOrEqual(rules.movingPatrolFloor);
        expect(eliteBoard.tiles.some((tile) => tile.dungeonCardEffectId === 'enemy_elite')).toBe(true);
    });

    it('pays route card rewards once when the stamped pair is matched', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_014 }), 1);
        const greedId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!.id;
        const greedy = applyRouteChoiceOutcome(cleared, greedId);
        const next = finishMemorizePhase(advanceToNextLevel(greedy.run));
        const routeTiles = next.board!.tiles.filter((tile) => tile.routeSpecialKind === 'greed_cache');
        const beforeGold = next.shopGold;
        const beforeScore = next.stats.totalScore;

        const resolved = resolveBoardTurn(flipTile(flipTile(next, routeTiles[0]!.id), routeTiles[1]!.id));

        expect(resolved.shopGold).toBe(beforeGold + 2);
        expect(resolved.stats.totalScore).toBeGreaterThanOrEqual(
            beforeScore + calculateMatchScore(next.board!.level, 1) + 25
        );
        expect(resolved.board!.tiles.filter((tile) => tile.pairKey === routeTiles[0]!.pairKey)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ routeCardKind: undefined, routeSpecialKind: undefined, state: 'matched' })
            ])
        );
    });

    it('peek reveals mystery veil families without claiming them', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_114 }), 1);
        const mysteryId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!.id;
        const next = finishMemorizePhase(advanceToNextLevel(applyRouteChoiceOutcome(cleared, mysteryId).run));
        const veil = next.board!.tiles.find((tile) => tile.routeSpecialKind === 'mystery_veil')!;

        const peeked = applyPeek(next, veil.id);

        expect(peeked.peekCharges).toBe(next.peekCharges - 1);
        expect(peeked.shopGold).toBe(next.shopGold);
        expect(peeked.board!.tiles.filter((tile) => tile.pairKey === veil.pairKey)).toEqual(
            expect.arrayContaining([expect.objectContaining({ routeSpecialRevealed: true })])
        );
    });

    it('secret doors reveal on peek and pay relic Favor when matched', () => {
        const board = routeBoard('mystery', 3);
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_214 }));
        const run: RunState = { ...base, board, status: 'playing', relicFavorProgress: 0, peekCharges: 1 };
        const secret = run.board!.tiles.find((tile) => tile.routeSpecialKind === 'secret_door')!;

        const peeked = applyPeek(run, secret.id);
        const pair = peeked.board!.tiles.filter((tile) => tile.pairKey === secret.pairKey);
        const resolved = resolveBoardTurn(flipTile(flipTile(peeked, pair[0]!.id), pair[1]!.id));

        expect(peeked.board!.tiles.filter((tile) => tile.pairKey === secret.pairKey)).toEqual(
            expect.arrayContaining([expect.objectContaining({ routeSpecialRevealed: true })])
        );
        expect(resolved.relicFavorProgress).toBe(1);
    });

    it('elite route anchors pay their route-specific rewards', () => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_217 }));
        const greedBoard = routeBoard('greed', 4, 'normal', { floorArchetypeId: 'rush_recall' });
        const safeBoard = routeBoard('safe', 4, 'normal', { floorArchetypeId: 'trap_hall' });
        const mysteryBoard = routeBoard('mystery', 4, 'normal', { activeMutators: ['short_memorize'] });

        const eliteRun: RunState = { ...base, board: greedBoard, status: 'playing' };
        const elite = eliteRun.board!.tiles.filter((tile) => tile.routeSpecialKind === 'elite_cache');
        const eliteResolved = resolveBoardTurn(flipTile(flipTile(eliteRun, elite[0]!.id), elite[1]!.id));

        const finalWardRun: RunState = {
            ...base,
            board: safeBoard,
            status: 'playing',
            stats: { ...base.stats, guardTokens: 0, comboShards: 0 }
        };
        const finalWard = finalWardRun.board!.tiles.filter((tile) => tile.routeSpecialKind === 'final_ward');
        const finalWardResolved = resolveBoardTurn(
            flipTile(flipTile(finalWardRun, finalWard[0]!.id), finalWard[1]!.id)
        );

        const omenRun: RunState = {
            ...base,
            board: mysteryBoard,
            status: 'playing',
            stats: { ...base.stats, comboShards: 0 },
            relicFavorProgress: 0,
            peekCharges: 1
        };
        const omen = omenRun.board!.tiles.filter((tile) => tile.routeSpecialKind === 'omen_seal');
        const peeked = applyPeek(omenRun, omen[0]!.id);
        const omenResolved = resolveBoardTurn(flipTile(flipTile(peeked, omen[0]!.id), omen[1]!.id));

        expect(eliteResolved.shopGold).toBe(eliteRun.shopGold + 4);
        expect(eliteResolved.stats.totalScore).toBeGreaterThanOrEqual(eliteRun.stats.totalScore + 55);
        expect(finalWardResolved.stats.guardTokens).toBe(1);
        expect(finalWardResolved.stats.comboShards).toBeGreaterThanOrEqual(1);
        expect(peeked.board!.tiles.filter((tile) => tile.pairKey === omen[0]!.pairKey)).toEqual(
            expect.arrayContaining([expect.objectContaining({ routeSpecialRevealed: true })])
        );
        expect(omenResolved.relicFavorProgress).toBe(1);
        expect(omenResolved.stats.comboShards).toBe(1);
    });

    it('guard cache, fragile cache, and lantern ward pay distinct rewards when matched', () => {
        const greedBoard = routeBoard('greed', 3);
        const safeBoard = routeBoard('safe', 3);
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_215 }));
        const guardRun: RunState = {
            ...base,
            board: safeBoard,
            status: 'playing',
            stats: { ...base.stats, guardTokens: 0 }
        };
        const guard = guardRun.board!.tiles.filter((tile) => tile.routeSpecialKind === 'guard_cache');
        const guardResolved = resolveBoardTurn(flipTile(flipTile(guardRun, guard[0]!.id), guard[1]!.id));
        const cappedGuardRun: RunState = {
            ...base,
            board: safeBoard,
            status: 'playing',
            stats: { ...base.stats, guardTokens: MAX_GUARD_TOKENS },
            safeHazardWardChargesThisFloor: 0
        };
        const cappedGuard = cappedGuardRun.board!.tiles.filter((tile) => tile.routeSpecialKind === 'guard_cache');
        const cappedGuardResolved = resolveBoardTurn(
            flipTile(flipTile(cappedGuardRun, cappedGuard[0]!.id), cappedGuard[1]!.id)
        );
        const fragileRun: RunState = { ...base, board: greedBoard, status: 'playing' };
        const fragile = fragileRun.board!.tiles.filter((tile) => tile.routeSpecialKind === 'fragile_cache');
        const fragileResolved = resolveBoardTurn(flipTile(flipTile(fragileRun, fragile[0]!.id), fragile[1]!.id));
        const lanternRun: RunState = {
            ...base,
            board: safeBoard,
            status: 'playing',
            stats: { ...base.stats, guardTokens: 0 }
        };
        const lantern = lanternRun.board!.tiles.filter((tile) => tile.routeSpecialKind === 'lantern_ward');
        const lanternResolved = resolveBoardTurn(flipTile(flipTile(lanternRun, lantern[0]!.id), lantern[1]!.id));

        expect(guardResolved.stats.guardTokens).toBe(1);
        expect(guardResolved.safeHazardWardChargesThisFloor).toBe(0);
        expect(cappedGuardResolved.stats.guardTokens).toBe(MAX_GUARD_TOKENS);
        expect(cappedGuardResolved.safeHazardWardChargesThisFloor).toBe(1);
        expect(fragileResolved.shopGold).toBe(fragileRun.shopGold + 1);
        expect(fragileResolved.stats.totalScore).toBeGreaterThanOrEqual(fragileRun.stats.totalScore + 20);
        expect(lanternResolved.stats.guardTokens).toBe(1);
        expect(lanternResolved.stats.totalScore).toBeGreaterThanOrEqual(lanternRun.stats.totalScore + 10);
    });

    it('destroying guard cache denies guard tokens and banked wards', () => {
        const safeBoard = routeBoard('safe', 3);
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_218 }));
        const run: RunState = {
            ...base,
            board: safeBoard,
            status: 'playing',
            destroyPairCharges: 1,
            stats: { ...base.stats, guardTokens: MAX_GUARD_TOKENS },
            safeHazardWardChargesThisFloor: 0
        };
        const guard = run.board!.tiles.find((tile) => tile.routeSpecialKind === 'guard_cache')!;

        const destroyed = applyDestroyPair(run, guard.id);

        expect(destroyed.stats.guardTokens).toBe(MAX_GUARD_TOKENS);
        expect(destroyed.safeHazardWardChargesThisFloor).toBe(0);
        expect(destroyed.board!.tiles.filter((tile) => tile.pairKey === guard.pairKey)).toEqual(
            expect.arrayContaining([expect.objectContaining({ routeSpecialKind: undefined })])
        );
    });

    it('lantern ward scouts a hidden dungeon threat without springing it', () => {
        const run = createRun([
            createTile('lantern-a', 'A', 'A', { routeSpecialKind: 'lantern_ward', routeCardKind: 'safe_ward' }),
            createTile('lantern-b', 'A', 'A', { routeSpecialKind: 'lantern_ward', routeCardKind: 'safe_ward' }),
            createTile('trap-a', 'B', 'B', {
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            }),
            createTile('trap-b', 'B', 'B', {
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            })
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'lantern-a'), 'lantern-b'));
        const trapTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'B');

        expect(resolved.lanternWardScoutsThisFloor).toBe(1);
        expect(resolved.lives).toBe(run.lives);
        expect(resolved.dungeonTrapsTriggered).toBe(run.dungeonTrapsTriggered);
        expect(resolved.stats.guardTokens).toBe(1);
        expect(trapTiles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    dungeonCardState: 'revealed',
                    lanternScouted: true,
                    scoutRevealSource: 'lantern_ward'
                })
            ])
        );
    });

    it('omen seal scouts a hidden hazard before dungeon or route information', () => {
        const run = createRun([
            createTile('omen-a', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('omen-b', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('hazard-a', 'B', 'B', { tileHazardKind: 'shuffle_snare' }),
            createTile('hazard-b', 'B', 'B', { tileHazardKind: 'shuffle_snare' }),
            createTile('trap-a', 'C', 'C', {
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            }),
            createTile('trap-b', 'C', 'C', {
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            }),
            createTile('veil-a', 'D', 'D', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' }),
            createTile('veil-b', 'D', 'D', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' })
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'omen-a'), 'omen-b'));
        const hazardTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'B');
        const trapTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'C');
        const veilTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'D');

        expect(resolved.omenSealScoutsThisFloor).toBe(1);
        expect(resolved.hazardTileTriggersThisFloor).toBe(0);
        expect(resolved.dungeonTrapsTriggered).toBe(run.dungeonTrapsTriggered);
        expect(resolved.lives).toBe(run.lives);
        expect(resolved.relicFavorProgress).toBe(1);
        expect(resolved.stats.comboShards).toBe(1);
        expect(hazardTiles).toEqual(
            expect.arrayContaining([expect.objectContaining({ scoutRevealSource: 'omen_seal' })])
        );
        expect(trapTiles).toEqual(expect.arrayContaining([expect.objectContaining({ dungeonCardState: 'hidden' })]));
        expect(trapTiles.some((tile) => tile.scoutRevealSource != null)).toBe(false);
        expect(veilTiles.some((tile) => tile.routeSpecialRevealed === true)).toBe(false);
    });

    it('omen seal scouts hidden dungeon threats when no hazard target exists', () => {
        const run = createRun([
            createTile('omen-a', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('omen-b', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('trap-a', 'B', 'B', {
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            }),
            createTile('trap-b', 'B', 'B', {
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            }),
            createTile('veil-a', 'C', 'C', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' }),
            createTile('veil-b', 'C', 'C', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' })
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'omen-a'), 'omen-b'));
        const trapTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'B');

        expect(resolved.omenSealScoutsThisFloor).toBe(1);
        expect(resolved.dungeonTrapsTriggered).toBe(run.dungeonTrapsTriggered);
        expect(trapTiles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ dungeonCardState: 'revealed', scoutRevealSource: 'omen_seal' })
            ])
        );
    });

    it('omen seal scouts mystery route information when no hazard or dungeon target exists', () => {
        const run = createRun([
            createTile('omen-a', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('omen-b', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('veil-a', 'B', 'B', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' }),
            createTile('veil-b', 'B', 'B', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' })
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'omen-a'), 'omen-b'));
        const veilTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'B');

        expect(resolved.omenSealScoutsThisFloor).toBe(1);
        expect(veilTiles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ routeSpecialRevealed: true, routeSpecialRevealSource: 'omen_seal' })
            ])
        );
    });

    it('omen seal keeps reward when there is nothing to scout', () => {
        const run = createRun([
            createTile('omen-a', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('omen-b', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'omen-a'), 'omen-b'));

        expect(resolved.omenSealScoutsThisFloor).toBe(0);
        expect(resolved.relicFavorProgress).toBe(1);
        expect(resolved.stats.comboShards).toBe(1);
    });

    it('mimic cache pays full loot when revealed before matching', () => {
        const run = {
            ...createRun([
                createTile('mimic-a', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                }),
                createTile('mimic-b', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                }),
                createTile('safe-a', 'B', 'B'),
                createTile('safe-b', 'B', 'B')
            ]),
            peekCharges: 1,
            stats: { ...createRun([]).stats, comboShards: 0 }
        };

        const peeked = applyPeek(run, 'mimic-a');
        const resolved = resolveBoardTurn(flipTile(flipTile(peeked, 'mimic-a'), 'mimic-b'));

        expect(resolved.mimicCacheClaimsThisFloor).toBe(1);
        expect(resolved.mimicCacheBitesThisFloor).toBe(0);
        expect(resolved.lives).toBe(run.lives);
        expect(resolved.shopGold).toBe(run.shopGold + 2);
        expect(resolved.stats.comboShards).toBe(1);
        expect(resolved.stats.totalScore).toBeGreaterThanOrEqual(run.stats.totalScore + 20);
    });

    it('mimic cache blind match bites guard first and pays reduced loot', () => {
        const run = {
            ...createRun([
                createTile('mimic-a', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                }),
                createTile('mimic-b', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                }),
                createTile('safe-a', 'B', 'B'),
                createTile('safe-b', 'B', 'B')
            ]),
            stats: { ...createRun([]).stats, guardTokens: 1, comboShards: 0 }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'mimic-a'), 'mimic-b'));

        expect(resolved.mimicCacheClaimsThisFloor).toBe(1);
        expect(resolved.mimicCacheBitesThisFloor).toBe(1);
        expect(resolved.mimicCacheGuardBitesThisFloor).toBe(1);
        expect(resolved.stats.guardTokens).toBe(0);
        expect(resolved.lives).toBe(run.lives);
        expect(resolved.shopGold).toBe(run.shopGold + 1);
        expect(resolved.stats.comboShards).toBe(0);
    });

    it('mimic cache blind match can take life and become fatal without finalizing the floor', () => {
        const run = {
            ...createRun([
                createTile('mimic-a', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                }),
                createTile('mimic-b', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                })
            ]),
            lives: 1,
            stats: { ...createRun([]).stats, guardTokens: 0 }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'mimic-a'), 'mimic-b'));

        expect(resolved.status).toBe('gameOver');
        expect(resolved.lives).toBe(0);
        expect(resolved.lastLevelResult).toBeNull();
        expect(resolved.mimicCacheClaimsThisFloor).toBe(1);
        expect(resolved.mimicCacheBitesThisFloor).toBe(1);
    });

    it('destroying mimic cache denies reward and bite', () => {
        const run = {
            ...createRun([
                createTile('mimic-a', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                }),
                createTile('mimic-b', 'A', 'A', {
                    routeSpecialKind: 'mimic_cache',
                    routeCardKind: 'mystery_veil'
                }),
                createTile('safe-a', 'B', 'B'),
                createTile('safe-b', 'B', 'B')
            ]),
            destroyPairCharges: 1,
            stats: { ...createRun([]).stats, comboShards: 0 }
        };

        const destroyed = applyDestroyPair(run, 'mimic-a');

        expect(destroyed.mimicCacheClaimsThisFloor).toBe(0);
        expect(destroyed.mimicCacheBitesThisFloor).toBe(0);
        expect(destroyed.lives).toBe(run.lives);
        expect(destroyed.shopGold).toBe(run.shopGold);
        expect(destroyed.stats.comboShards).toBe(0);
    });

    it('destroying omen seal denies its reward and scout', () => {
        const run = {
            ...createRun([
                createTile('omen-a', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
                createTile('omen-b', 'A', 'A', { routeSpecialKind: 'omen_seal', routeCardKind: 'mystery_veil' }),
                createTile('hazard-a', 'B', 'B', { tileHazardKind: 'shuffle_snare' }),
                createTile('hazard-b', 'B', 'B', { tileHazardKind: 'shuffle_snare' })
            ]),
            destroyPairCharges: 1,
            relicFavorProgress: 0
        };

        const destroyed = applyDestroyPair(run, 'omen-a');

        expect(destroyed.omenSealScoutsThisFloor).toBe(0);
        expect(destroyed.relicFavorProgress).toBe(0);
        expect(destroyed.stats.comboShards).toBe(0);
        expect(destroyed.board!.tiles.filter((tile) => tile.pairKey === 'B').some((tile) => tile.scoutRevealSource != null)).toBe(false);
    });

    it('lantern ward scouts mystery route information when no dungeon threat is hidden', () => {
        const run = createRun([
            createTile('lantern-a', 'A', 'A', { routeSpecialKind: 'lantern_ward', routeCardKind: 'safe_ward' }),
            createTile('lantern-b', 'A', 'A', { routeSpecialKind: 'lantern_ward', routeCardKind: 'safe_ward' }),
            createTile('veil-a', 'B', 'B', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' }),
            createTile('veil-b', 'B', 'B', { routeSpecialKind: 'mystery_veil', routeCardKind: 'mystery_veil' })
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'lantern-a'), 'lantern-b'));
        const veilTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'B');

        expect(resolved.lanternWardScoutsThisFloor).toBe(1);
        expect(veilTiles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ routeSpecialRevealed: true, routeSpecialRevealSource: 'lantern_ward' })
            ])
        );
    });

    it('lantern ward keeps its reward when there is nothing to scout', () => {
        const run = createRun([
            createTile('lantern-a', 'A', 'A', { routeSpecialKind: 'lantern_ward', routeCardKind: 'safe_ward' }),
            createTile('lantern-b', 'A', 'A', { routeSpecialKind: 'lantern_ward', routeCardKind: 'safe_ward' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'lantern-a'), 'lantern-b'));

        expect(resolved.lanternWardScoutsThisFloor).toBe(0);
        expect(resolved.stats.guardTokens).toBe(1);
        expect(resolved.stats.totalScore).toBeGreaterThanOrEqual(run.stats.totalScore + 10);
    });

    it('stray remove refuses keystone route anchors', () => {
        const board = routeBoard('greed', 7, 'boss');
        const base = finishMemorizePhase(
            createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_216, initialStrayRemoveCharges: 1 })
        );
        const run: RunState = { ...base, board, status: 'playing', strayRemoveArmed: true };
        const keystone = run.board!.tiles.find((tile) => tile.routeSpecialKind === 'keystone_pair')!;

        expect(tileIsStrayEligiblePreview(board, keystone.id)).toBe(false);
        expect(applyStrayRemove(run, keystone.id)).toBe(run);
    });

    it('stray remove refuses protected hard-route elite anchors', () => {
        const base = finishMemorizePhase(
            createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_218, initialStrayRemoveCharges: 1 })
        );
        const finalWardBoard = routeBoard('safe', 4, 'normal', { floorArchetypeId: 'trap_hall' });
        const omenBoard = routeBoard('mystery', 4, 'normal', { activeMutators: ['glass_floor'] });
        const finalWard = finalWardBoard.tiles.find((tile) => tile.routeSpecialKind === 'final_ward')!;
        const omen = omenBoard.tiles.find((tile) => tile.routeSpecialKind === 'omen_seal')!;
        const finalWardRun: RunState = { ...base, board: finalWardBoard, status: 'playing', strayRemoveArmed: true };
        const omenRun: RunState = { ...base, board: omenBoard, status: 'playing', strayRemoveArmed: true };

        expect(tileIsStrayEligiblePreview(finalWardBoard, finalWard.id)).toBe(false);
        expect(applyStrayRemove(finalWardRun, finalWard.id)).toBe(finalWardRun);
        expect(tileIsStrayEligiblePreview(omenBoard, omen.id)).toBe(false);
        expect(applyStrayRemove(omenRun, omen.id)).toBe(omenRun);
    });

    it('covers route synergy matrix fixtures without soft-locking board completion', () => {
        const base = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_219 })),
            destroyPairCharges: 1
        };
        const greedTreasure = routeBoard('greed', 5, 'breather', {
            activeMutators: ['findables_floor'],
            floorArchetypeId: 'treasure_gallery'
        });
        const greedTrap = routeBoard('greed', 7, 'normal', {
            activeMutators: ['glass_floor', 'sticky_fingers'],
            floorArchetypeId: 'trap_hall'
        });
        const safeRush = routeBoard('safe', 9, 'normal', {
            activeMutators: ['short_memorize', 'wide_recall'],
            floorArchetypeId: 'rush_recall'
        });
        const mysterySurvey = routeBoard('mystery', 1, 'normal', {
            activeMutators: ['wide_recall'],
            floorArchetypeId: 'survey_hall'
        });

        expect(greedTreasure.routeWorldProfile).toMatchObject({
            routeType: 'greed',
            routeSpecialKinds: ['greed_cache', 'greed_toll', 'fragile_cache', 'catalyst_altar']
        });
        const treasureFindablePairKeys = new Set(
            greedTreasure.tiles.filter((tile) => tile.findableKind).map((tile) => tile.pairKey)
        );
        expect(treasureFindablePairKeys.size).toBeGreaterThanOrEqual(1);
        expect(
            [...treasureFindablePairKeys].every(
                (pairKey) => greedTreasure.tiles.filter((tile) => tile.pairKey === pairKey).length === 2
            )
        ).toBe(true);
        const treasureToll = greedTreasure.tiles.find((tile) => tile.routeSpecialKind === 'greed_toll')!;
        const treasureRun: RunState = {
            ...base,
            board: greedTreasure,
            status: 'playing',
            destroyPairCharges: 1,
            shopGold: 0
        };
        const treasureDestroyed = applyDestroyPair(treasureRun, treasureToll.id);
        expect(treasureDestroyed.shopGold).toBe(0);
        expect(
            treasureDestroyed.board!.tiles.filter((tile) => tile.pairKey === treasureToll.pairKey)
        ).toEqual(expect.arrayContaining([expect.objectContaining({ routeSpecialKind: undefined })]));

        expect(greedTrap.routeWorldProfile).toMatchObject({
            routeType: 'greed',
            routeSpecialKinds: ['greed_cache', 'greed_toll', 'elite_cache', 'catalyst_altar']
        });
        expect(greedTrap.tiles.filter((tile) => tile.pairKey === DECOY_PAIR_KEY)).toHaveLength(1);
        expect(greedTrap.tiles.filter((tile) => tile.routeSpecialKind === 'elite_cache')).toHaveLength(2);

        expect(safeRush.routeWorldProfile).toMatchObject({
            routeType: 'safe',
            routeSpecialKinds: ['guard_cache', 'lantern_ward', 'final_ward', 'anchor_seal']
        });
        expect(safeRush.tiles.filter((tile) => tile.routeSpecialKind === 'final_ward')).toHaveLength(2);

        expect(mysterySurvey.routeWorldProfile).toMatchObject({
            routeType: 'mystery',
            routeSpecialKinds: ['mystery_veil', 'secret_door', 'mimic_cache', 'loaded_gateway']
        });
        const secret = mysterySurvey.tiles.find((tile) => tile.routeSpecialKind === 'secret_door')!;
        const mysteryRun: RunState = { ...base, board: mysterySurvey, status: 'playing', peekCharges: 1 };
        const mysteryPeeked = applyPeek(mysteryRun, secret.id);
        expect(mysteryPeeked.board!.tiles.filter((tile) => tile.pairKey === secret.pairKey)).toEqual(
            expect.arrayContaining([expect.objectContaining({ routeSpecialRevealed: true })])
        );
        expect(mysteryPeeked.relicFavorProgress).toBe(mysteryRun.relicFavorProgress);

        for (const board of [greedTreasure, greedTrap, safeRush, mysterySurvey]) {
            const cleared = clearRealPairs({ ...base, board, status: 'playing' });
            expect(cleared.status).toBe('levelComplete');
            expect(isBoardComplete(cleared.board!)).toBe(true);
        }
    });

    it('applies deterministic mystery route rewards and can convert Favor into a relic pick', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_004 }), 1);
        const mysteryId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!.id;
        const first = applyRouteChoiceOutcome(cleared, mysteryId);
        const second = applyRouteChoiceOutcome(cleared, mysteryId);

        expect(first.applied).toBe(true);
        expect(second.run).toEqual(first.run);

        let favorCase: RunState | null = null;
        for (let seed = 17_100; seed < 17_180; seed += 1) {
            const candidate = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: seed }), 1);
            const choice = candidate.lastLevelResult!.routeChoices!.find((route) => route.routeType === 'mystery')!;
            const result = applyRouteChoiceOutcome({ ...candidate, relicFavorProgress: 2 }, choice.id);
            if (result.summaryText?.includes('relic Favor')) {
                favorCase = result.run;
                break;
            }
        }

        expect(favorCase).not.toBeNull();
        expect(favorCase!.relicFavorProgress).toBe(0);
        expect(favorCase!.bonusRelicPicksNextOffer).toBeGreaterThan(0);
        expect(favorCase!.favorBonusRelicPicksNextOffer).toBeGreaterThan(0);

        let cappedShardCase: ReturnType<typeof applyRouteChoiceOutcome> | null = null;
        for (let seed = 17_180; seed < 17_260; seed += 1) {
            const candidate = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: seed }), 1);
            const choice = candidate.lastLevelResult!.routeChoices!.find((route) => route.routeType === 'mystery')!;
            const result = applyRouteChoiceOutcome(
                { ...candidate, stats: { ...candidate.stats, comboShards: MAX_COMBO_SHARDS } },
                choice.id
            );
            if (result.summaryText?.includes('combo shards')) {
                cappedShardCase = result;
                break;
            }
        }

        expect(cappedShardCase).not.toBeNull();
        expect(cappedShardCase!.run.stats.comboShards).toBe(MAX_COMBO_SHARDS);
        expect(cappedShardCase!.summaryText).toBe('Mystery route: combo shards already full.');
    });

    it('does not apply route choices outside level complete state or with missing ids', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 17_005 }), 1);
        const safeId = cleared.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!.id;

        expect(applyRouteChoiceOutcome({ ...cleared, status: 'playing' }, safeId).reason).toBe('invalid_status');
        expect(applyRouteChoiceOutcome(cleared, 'missing').reason).toBe('missing_choice');
    });
});

describe('normal-run hazard tiles', () => {
    it('keeps floor 1 generated runs hazard-free before introducing hazard tiles', () => {
        const floorOne = buildBoard(1, {
            gameMode: 'endless',
            runSeed: 91_001,
            runRulesVersion: GAME_RULES_VERSION
        });
        const floorTwo = buildBoard(2, {
            gameMode: 'endless',
            runSeed: 91_001,
            runRulesVersion: GAME_RULES_VERSION
        });

        expect(floorOne.tiles.some((tile) => tile.tileHazardKind != null)).toBe(false);
        expect(floorTwo.tiles.some((tile) => tile.tileHazardKind != null)).toBe(true);
        expect(inspectBoardFairness(floorOne).issues).toEqual([]);
        expect(inspectBoardFairness(floorTwo).issues).toEqual([]);
    });

    it('generates hazard tiles deterministically across generated modes but not fixed boards', () => {
        const modes = ['endless', 'daily', 'gauntlet', 'meditation', 'puzzle'] as const;

        for (const gameMode of modes) {
            const board = buildBoard(6, {
                gameMode,
                runSeed: 91_001,
                runRulesVersion: GAME_RULES_VERSION,
                includeWildTile: gameMode === 'puzzle'
            });
            const repeat = buildBoard(6, {
                gameMode,
                runSeed: 91_001,
                runRulesVersion: GAME_RULES_VERSION,
                includeWildTile: gameMode === 'puzzle'
            });

            expect(board.tiles.map((tile) => tile.tileHazardKind ?? null)).toEqual(
                repeat.tiles.map((tile) => tile.tileHazardKind ?? null)
            );
            expect(board.tiles.some((tile) => tile.tileHazardKind != null)).toBe(true);
            expect(
                board.tiles
                    .filter((tile) => tile.tileHazardKind != null && tile.tileHazardKind !== 'mirror_decoy')
                    .every(
                        (tile) =>
                            tile.dungeonCardKind == null &&
                            tile.routeCardKind == null &&
                            tile.routeSpecialKind == null &&
                            tile.findableKind == null &&
                            tile.pairKey !== DECOY_PAIR_KEY
                    )
            ).toBe(true);
            expect(inspectBoardFairness(board).issues).toEqual([]);
        }

        const fixed = buildBoard(6, {
            gameMode: 'puzzle',
            runSeed: 91_001,
            runRulesVersion: GAME_RULES_VERSION,
            fixedTiles: [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')]
        });
        expect(fixed.tiles.some((tile) => tile.tileHazardKind != null)).toBe(false);
    });

    it('removes a full safe pair when cascade cache is matched', () => {
        const run = createRun([
            createTile('cache-a', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('cache-b', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'cache-a'), 'cache-b'));

        expect(resolved.board!.tiles.filter((tile) => tile.pairKey === 'B').every((tile) => tile.state === 'removed')).toBe(true);
        expect(resolved.hazardCascadeCachesThisFloor).toBe(1);
        expect(resolved.hazardTileTriggersThisFloor).toBe(1);
        expect(isBoardComplete(resolved.board!)).toBe(true);
    });

    it('claims fragile cache bonus on a clean match without changing hazard density rules', () => {
        const fragileRun = createRun([
            createTile('fragile-a', 'A', 'A', { tileHazardKind: 'fragile_cache' }),
            createTile('fragile-b', 'A', 'A', { tileHazardKind: 'fragile_cache' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);
        const normalRun = createRun([
            createTile('plain-a', 'A', 'A'),
            createTile('plain-b', 'A', 'A'),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);

        const fragileResolved = resolveBoardTurn(flipTile(flipTile(fragileRun, 'fragile-a'), 'fragile-b'));
        const normalResolved = resolveBoardTurn(flipTile(flipTile(normalRun, 'plain-a'), 'plain-b'));

        expect(fragileResolved.stats.currentLevelScore - normalResolved.stats.currentLevelScore).toBe(25);
        expect(fragileResolved.hazardFragileCacheClaimsThisFloor).toBe(1);
        expect(fragileResolved.hazardTileTriggersThisFloor).toBe(1);
        expect(inspectBoardFairness(fragileResolved.board!).issues).toEqual([]);
    });

    it('breaks fragile cache on mismatch but keeps the pair matchable and completion-safe', () => {
        const run = createRun([
            createTile('fragile-a', 'A', 'A', { tileHazardKind: 'fragile_cache' }),
            createTile('fragile-b', 'A', 'A', { tileHazardKind: 'fragile_cache' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);

        const broken = resolveBoardTurn(flipTile(flipTile(run, 'fragile-a'), 'safe-a'));

        expect(broken.hazardFragileCacheBreaksThisFloor).toBe(1);
        expect(broken.hazardFragileCacheClaimsThisFloor).toBe(0);
        expect(broken.hazardTileTriggersThisFloor).toBe(1);
        expect(broken.board!.tiles.filter((tile) => tile.pairKey === 'A').every((tile) => tile.tileHazardKind == null)).toBe(true);
        expect(inspectBoardFairness(broken.board!).hasCompletionRoute).toBe(true);

        const matchedAfterBreak = resolveBoardTurn(flipTile(flipTile(broken, 'fragile-a'), 'fragile-b'));
        expect(matchedAfterBreak.hazardFragileCacheClaimsThisFloor).toBe(0);
        expect(matchedAfterBreak.board!.tiles.filter((tile) => tile.pairKey === 'A').every((tile) => tile.state === 'matched')).toBe(true);
    });

    it('claims toll cache by trading match score for shop gold', () => {
        const tollRun = createRun([
            createTile('toll-a', 'A', 'A', { tileHazardKind: 'toll_cache' }),
            createTile('toll-b', 'A', 'A', { tileHazardKind: 'toll_cache' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);
        const normalRun = createRun([
            createTile('plain-a', 'A', 'A'),
            createTile('plain-b', 'A', 'A'),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);

        const tollResolved = resolveBoardTurn(flipTile(flipTile(tollRun, 'toll-a'), 'toll-b'));
        const normalResolved = resolveBoardTurn(flipTile(flipTile(normalRun, 'plain-a'), 'plain-b'));

        expect(tollResolved.shopGold).toBe(tollRun.shopGold + TOLL_CACHE_SHOP_GOLD_REWARD);
        expect(normalResolved.shopGold).toBe(normalRun.shopGold);
        expect(normalResolved.stats.currentLevelScore - tollResolved.stats.currentLevelScore).toBe(TOLL_CACHE_MATCH_SCORE_TOLL);
        expect(tollResolved.hazardTollCachesThisFloor).toBe(1);
        expect(tollResolved.hazardTileTriggersThisFloor).toBe(1);
        expect(inspectBoardFairness(tollResolved.board!).issues).toEqual([]);
    });

    it('claims fuse cache early for full payout and late for consolation gold', () => {
        const fuseRun = createRun([
            createTile('fuse-a', 'A', 'A', { tileHazardKind: 'fuse_cache' }),
            createTile('fuse-b', 'A', 'A', { tileHazardKind: 'fuse_cache' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B')
        ]);
        const earlyResolved = resolveBoardTurn(flipTile(flipTile(fuseRun, 'fuse-a'), 'fuse-b'));
        const lateRun: RunState = {
            ...fuseRun,
            matchResolutionsThisFloor: FUSE_CACHE_FRESH_RESOLUTION_LIMIT
        };
        const lateResolved = resolveBoardTurn(flipTile(flipTile(lateRun, 'fuse-a'), 'fuse-b'));

        expect(earlyResolved.shopGold).toBe(fuseRun.shopGold + FUSE_CACHE_FRESH_SHOP_GOLD_REWARD);
        expect(earlyResolved.stats.currentLevelScore).toBeGreaterThanOrEqual(
            fuseRun.stats.currentLevelScore + FUSE_CACHE_FRESH_SCORE_REWARD
        );
        expect(earlyResolved.hazardFuseCachesThisFloor).toBe(1);
        expect(earlyResolved.hazardFuseCacheExpiredClaimsThisFloor).toBe(0);
        expect(earlyResolved.hazardTileTriggersThisFloor).toBe(1);
        expect(lateResolved.shopGold).toBe(lateRun.shopGold + FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD);
        expect(lateResolved.stats.currentLevelScore).toBeLessThan(earlyResolved.stats.currentLevelScore);
        expect(lateResolved.hazardFuseCachesThisFloor).toBe(1);
        expect(lateResolved.hazardFuseCacheExpiredClaimsThisFloor).toBe(1);
        expect(inspectBoardFairness(earlyResolved.board!).issues).toEqual([]);
    });

    it('keeps cascade cache from removing utility, pickup, route, dungeon, and hazard pairs', () => {
        const run = createRun([
            createTile('cache-a', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('cache-b', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('route-a', 'B', 'B', { routeCardKind: 'greed_cache' }),
            createTile('route-b', 'B', 'B', { routeCardKind: 'greed_cache' }),
            createTile('pickup-a', 'C', 'C', { findableKind: 'shard_spark' }),
            createTile('pickup-b', 'C', 'C', { findableKind: 'shard_spark' }),
            createTile('enemy-a', 'D', 'D', { dungeonCardKind: 'enemy' }),
            createTile('enemy-b', 'D', 'D', { dungeonCardKind: 'enemy' }),
            createTile('other-hazard-a', 'E', 'E', { tileHazardKind: 'shuffle_snare' }),
            createTile('other-hazard-b', 'E', 'E', { tileHazardKind: 'shuffle_snare' }),
            createTile('safe-a', 'F', 'F'),
            createTile('safe-b', 'F', 'F')
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'cache-a'), 'cache-b'));

        expect(resolved.hazardCascadeCachesThisFloor).toBe(1);
        expect(resolved.board!.tiles.filter((tile) => tile.pairKey === 'F').every((tile) => tile.state === 'removed')).toBe(true);
        for (const pairKey of ['B', 'C', 'D', 'E']) {
            expect(resolved.board!.tiles.filter((tile) => tile.pairKey === pairKey).every((tile) => tile.state !== 'removed')).toBe(true);
        }
    });

    it('keeps cascade cache from removing the cursed pair', () => {
        const run = createRun([
            createTile('cache-a', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('cache-b', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('cursed-a', 'B', 'B'),
            createTile('cursed-b', 'B', 'B'),
            createTile('safe-a', 'C', 'C'),
            createTile('safe-b', 'C', 'C')
        ]);
        const cursedRun = {
            ...run,
            board: {
                ...run.board!,
                cursedPairKey: 'B'
            }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(cursedRun, 'cache-a'), 'cache-b'));

        expect(resolved.hazardCascadeCachesThisFloor).toBe(1);
        expect(resolved.board!.tiles.filter((tile) => tile.pairKey === 'B').every((tile) => tile.state !== 'removed')).toBe(true);
        expect(resolved.board!.tiles.filter((tile) => tile.pairKey === 'C').every((tile) => tile.state === 'removed')).toBe(true);
    });

    it('does not trigger cascade cache when only the cursed pair is eligible', () => {
        const run = createRun([
            createTile('cache-a', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('cache-b', 'A', 'A', { tileHazardKind: 'cascade_cache' }),
            createTile('cursed-a', 'B', 'B'),
            createTile('cursed-b', 'B', 'B')
        ]);
        const cursedRun = {
            ...run,
            board: {
                ...run.board!,
                cursedPairKey: 'B'
            }
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(cursedRun, 'cache-a'), 'cache-b'));

        expect(resolved.hazardCascadeCachesThisFloor).toBe(0);
        expect(resolved.hazardTileTriggersThisFloor).toBe(0);
        expect(resolved.board!.tiles.filter((tile) => tile.pairKey === 'B').every((tile) => tile.state !== 'removed')).toBe(true);
    });

    it('triggers shuffle snare on mismatch without spending player shuffle powers', () => {
        const run = {
            ...createRun([
                createTile('snare-a', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('snare-b', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('safe-a', 'B', 'B'),
                createTile('safe-b', 'B', 'B'),
                createTile('other-a', 'C', 'C'),
                createTile('other-b', 'C', 'C')
            ]),
            pinnedTileIds: ['safe-a']
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'snare-a'), 'safe-a'));

        expect(resolved.hazardShuffleSnaresThisFloor).toBe(1);
        expect(resolved.hazardTileTriggersThisFloor).toBe(1);
        expect(resolved.shuffleUsedThisFloor).toBe(false);
        expect(resolved.stats.shufflesUsed).toBe(0);
        expect(resolved.pinnedTileIds).toEqual([]);
        expect(inspectBoardFairness(resolved.board!).hasCompletionRoute).toBe(true);
    });

    it('keeps cursed pairs fixed when shuffle snare resolves a mismatch', () => {
        const run = {
            ...createRun([
                createTile('snare-a', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('snare-b', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('safe-a', 'B', 'B'),
                createTile('safe-b', 'B', 'B'),
                createTile('other-a', 'C', 'C'),
                createTile('other-b', 'C', 'C'),
                createTile('cursed-a', 'D', 'D'),
                createTile('cursed-b', 'D', 'D')
            ]),
            board: {
                ...createRun([
                    createTile('snare-a', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                    createTile('snare-b', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                    createTile('safe-a', 'B', 'B'),
                    createTile('safe-b', 'B', 'B'),
                    createTile('other-a', 'C', 'C'),
                    createTile('other-b', 'C', 'C'),
                    createTile('cursed-a', 'D', 'D'),
                    createTile('cursed-b', 'D', 'D')
                ]).board!,
                cursedPairKey: 'D'
            }
        };
        const cursedSlotsBefore = run.board!.tiles
            .map((tile, index) => ({ tile, index }))
            .filter(({ tile }) => tile.pairKey === 'D')
            .map(({ tile, index }) => `${index}:${tile.id}`);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'snare-a'), 'safe-a'));
        const cursedSlotsAfter = resolved.board!.tiles
            .map((tile, index) => ({ tile, index }))
            .filter(({ tile }) => tile.pairKey === 'D')
            .map(({ tile, index }) => `${index}:${tile.id}`);

        expect(resolved.hazardShuffleSnaresThisFloor).toBe(1);
        expect(cursedSlotsAfter).toEqual(cursedSlotsBefore);
        expect(inspectBoardFairness(resolved.board!).hasCompletionRoute).toBe(true);
    });

    it('allows repeated shuffle snare triggers only when each mismatch actually shuffles', () => {
        const run = createRun([
            createTile('snare-a', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
            createTile('snare-b', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
            createTile('safe-a', 'B', 'B'),
            createTile('safe-b', 'B', 'B'),
            createTile('other-a', 'C', 'C'),
            createTile('other-b', 'C', 'C'),
            createTile('extra-a', 'D', 'D'),
            createTile('extra-b', 'D', 'D')
        ]);

        const first = resolveBoardTurn(flipTile(flipTile(run, 'snare-a'), 'safe-a'));
        const second = resolveBoardTurn(flipTile(flipTile(first, 'snare-b'), 'safe-b'));

        expect(first.hazardShuffleSnaresThisFloor).toBe(1);
        expect(first.hazardTileTriggersThisFloor).toBe(1);
        expect(second.hazardShuffleSnaresThisFloor).toBe(2);
        expect(second.hazardTileTriggersThisFloor).toBe(2);
        expect(inspectBoardFairness(second.board!).hasCompletionRoute).toBe(true);
    });

    it('spends a Guard Cache ward to block shuffle snare and preserve pins', () => {
        const run = {
            ...createRun([
                createTile('snare-a', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('snare-b', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('safe-a', 'B', 'B'),
                createTile('safe-b', 'B', 'B'),
                createTile('other-a', 'C', 'C'),
                createTile('other-b', 'C', 'C')
            ]),
            pinnedTileIds: ['safe-a'],
            safeHazardWardChargesThisFloor: 1
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'snare-a'), 'safe-a'));

        expect(resolved.safeHazardWardChargesThisFloor).toBe(0);
        expect(resolved.safeHazardWardsUsedThisFloor).toBe(1);
        expect(resolved.hazardShuffleSnaresThisFloor).toBe(0);
        expect(resolved.hazardTileTriggersThisFloor).toBe(0);
        expect(resolved.pinnedTileIds).toEqual(['safe-a']);
        expect(inspectBoardFairness(resolved.board!).hasCompletionRoute).toBe(true);
    });

    it('does not clear pins or count a snare trigger when no safe shuffle targets exist', () => {
        const run = {
            ...createRun([
                createTile('snare-a', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('snare-b', 'A', 'A', { tileHazardKind: 'shuffle_snare' }),
                createTile('route-a', 'B', 'B', { routeCardKind: 'greed_cache' }),
                createTile('route-b', 'B', 'B', { routeCardKind: 'greed_cache' })
            ]),
            pinnedTileIds: ['route-a']
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'snare-a'), 'route-a'));

        expect(resolved.hazardShuffleSnaresThisFloor).toBe(0);
        expect(resolved.hazardTileTriggersThisFloor).toBe(0);
        expect(resolved.pinnedTileIds).toEqual(['route-a']);
    });

    it('spends a Guard Cache ward to block one fragile cache break', () => {
        const run = {
            ...createRun([
                createTile('fragile-a', 'A', 'A', { tileHazardKind: 'fragile_cache' }),
                createTile('fragile-b', 'A', 'A', { tileHazardKind: 'fragile_cache' }),
                createTile('safe-a', 'B', 'B'),
                createTile('safe-b', 'B', 'B')
            ]),
            safeHazardWardChargesThisFloor: 1
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'fragile-a'), 'safe-a'));

        expect(resolved.safeHazardWardChargesThisFloor).toBe(0);
        expect(resolved.safeHazardWardsUsedThisFloor).toBe(1);
        expect(resolved.hazardFragileCacheBreaksThisFloor).toBe(0);
        expect(resolved.hazardTileTriggersThisFloor).toBe(0);
        expect(resolved.board!.tiles.filter((tile) => tile.pairKey === 'A')).toEqual(
            expect.arrayContaining([expect.objectContaining({ tileHazardKind: 'fragile_cache' })])
        );
    });

    it('does not spend Guard Cache ward charges on mirror decoys', () => {
        const run = {
            ...createRun([
                createTile('safe-a', 'A', 'A'),
                createTile('safe-b', 'A', 'A'),
                createTile('other-a', 'B', 'B'),
                createTile('mirror', DECOY_PAIR_KEY, '?', { tileHazardKind: 'mirror_decoy' })
            ]),
            safeHazardWardChargesThisFloor: 1
        };

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'mirror'), 'safe-a'));

        expect(resolved.safeHazardWardChargesThisFloor).toBe(1);
        expect(resolved.safeHazardWardsUsedThisFloor).toBe(0);
        expect(resolved.hazardMirrorDecoysThisFloor).toBe(1);
        expect(resolved.hazardTileTriggersThisFloor).toBe(1);
    });

    it('does not trigger mirror decoy counters on first reveal alone', () => {
        const run = createRun([
            createTile('safe-a', 'A', 'A'),
            createTile('safe-b', 'A', 'A'),
            createTile('mirror', DECOY_PAIR_KEY, '?', { tileHazardKind: 'mirror_decoy' })
        ]);

        const revealed = flipTile(run, 'mirror');

        expect(revealed.board?.tiles.find((tile) => tile.id === 'mirror')?.state).toBe('flipped');
        expect(revealed.hazardMirrorDecoysThisFloor).toBe(0);
        expect(revealed.hazardTileTriggersThisFloor).toBe(0);
    });

    it('lets mirror decoys remain face-up without blocking completion', () => {
        const board: BoardState = {
            level: 1,
            pairCount: 1,
            columns: 2,
            rows: 2,
            tiles: [
                createTile('a1', 'A', 'A', { state: 'matched' }),
                createTile('a2', 'A', 'A', { state: 'matched' }),
                createTile('mirror', DECOY_PAIR_KEY, 'A', { state: 'flipped', tileHazardKind: 'mirror_decoy' })
            ],
            flippedTileIds: [],
            matchedPairs: 1,
            floorArchetypeId: null,
            featuredObjectiveId: null
        };

        expect(isBoardComplete(board)).toBe(true);
        expect(inspectBoardFairness(board).issues).toEqual([]);
    });
});

describe('dungeon cards', () => {
    it('creates deterministic dungeon blueprints with valid exits and floor identity', () => {
        const blueprint = createDungeonFloorBlueprint({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless'
        });
        const repeat = createDungeonFloorBlueprint({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless'
        });

        expect(repeat).toEqual(blueprint);
        expect(blueprint.exitSpecs.length).toBeGreaterThanOrEqual(1);
        expect(blueprint.exitSpecs.some((exit) => exit.lockKind === 'none' || exit.lockKind === 'lever')).toBe(true);
        expect(blueprint.bossId).toBe('trap_warden');
        expect(blueprint.objectiveId).toBe('defeat_boss');
        expect(blueprint.threatBudget).toBeGreaterThan(blueprint.rewardBudget);
        expect(blueprint.pairedCardSpecs).toEqual(
            expect.arrayContaining([expect.objectContaining({ bossId: 'trap_warden', label: 'Latch Warden', hp: 3 })])
        );
    });

    it('summarizes encounter budgets with readable density warnings', () => {
        const trapBudget = inspectDungeonEncounterBudget({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'normal',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless',
            dungeonNodeKind: 'trap'
        });
        const restBudget = inspectDungeonEncounterBudget({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'breather',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'rest'
        });
        const treasureBudget = inspectDungeonEncounterBudget({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'normal',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'treasure'
        });

        expect(trapBudget.floorArchetypeId).toBe('trap_hall');
        expect(trapBudget.threatPairCount).toBeGreaterThan(restBudget.threatPairCount);
        expect(restBudget.floorTag).toBe('breather');
        expect(restBudget.rewardPairCount).toBeGreaterThanOrEqual(2);
        expect(treasureBudget.floorArchetypeId).toBe('treasure_gallery');
        expect(treasureBudget.rewardPairCount).toBeGreaterThan(trapBudget.rewardPairCount);
        expect(trapBudget.warnings, trapBudget.warnings.join('\n')).toEqual([]);
    });

    it('guarantees safe-card suite anchors in representative generated encounters', () => {
        const trapBlueprint = createDungeonFloorBlueprint({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'normal',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless',
            dungeonNodeKind: 'trap'
        });
        const restBlueprint = createDungeonFloorBlueprint({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'breather',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'rest'
        });
        const treasureBlueprint = createDungeonFloorBlueprint({
            runSeed: 42_010,
            rulesVersion: GAME_RULES_VERSION,
            level: 10,
            floorTag: 'breather',
            floorArchetypeId: 'treasure_gallery',
            gameMode: 'endless',
            dungeonNodeKind: 'treasure'
        });

        expect(trapBlueprint.pairedCardSpecs).toEqual(
            expect.arrayContaining([expect.objectContaining({ effectId: 'trap_mimic' })])
        );
        expect(trapBlueprint.roomEffectIds).toContain('room_trap_workshop');
        expect(restBlueprint.pairedCardSpecs).toEqual(
            expect.arrayContaining([expect.objectContaining({ effectId: 'shrine_guard' })])
        );
        expect(restBlueprint.roomEffectIds).toEqual(
            expect.arrayContaining([expect.stringMatching(/^room_(map|scrying_lens|campfire|fountain|shrine|armory)$/)])
        );
        expect(treasureBlueprint.pairedCardSpecs).toEqual(
            expect.arrayContaining([expect.objectContaining({ effectId: 'lock_cache' })])
        );
        expect(treasureBlueprint.roomEffectIds).toEqual(
            expect.arrayContaining([expect.stringMatching(/^room_(locked_cache|key_cache|armory|scrying_lens)$/)])
        );
    });

    it('keeps generated encounter budgets within pair capacity across representative floors', () => {
        const rows: Array<{
            level: number;
            floorTag: 'normal' | 'breather' | 'boss';
            floorArchetypeId: FloorArchetypeId | null;
            dungeonNodeKind?: DungeonRunNodeKind | null;
        }> = [
            { level: 1, floorTag: 'normal', floorArchetypeId: null },
            { level: 4, floorTag: 'normal', floorArchetypeId: 'shadow_read' },
            { level: 5, floorTag: 'normal', floorArchetypeId: null },
            { level: 7, floorTag: 'boss', floorArchetypeId: 'trap_hall' },
            { level: 8, floorTag: 'normal', floorArchetypeId: null, dungeonNodeKind: 'trap' },
            { level: 9, floorTag: 'boss', floorArchetypeId: 'rush_recall' },
            { level: 10, floorTag: 'breather', floorArchetypeId: 'treasure_gallery' },
            { level: 12, floorTag: 'boss', floorArchetypeId: null, dungeonNodeKind: 'boss' }
        ];

        for (const row of rows) {
            const budget = inspectDungeonEncounterBudget({
                runSeed: 91_021,
                rulesVersion: GAME_RULES_VERSION,
                gameMode: 'endless',
                ...row
            });

            expect(
                budget.pairedCardCount,
                `${JSON.stringify({ row, budget }, null, 2)}`
            ).toBeLessThanOrEqual(budget.pairCapacity);
            expect(budget.warnings, `${JSON.stringify({ row, warnings: budget.warnings }, null, 2)}`).toEqual([]);
        }
    });

    it('stamps board dungeon metadata from the floor blueprint', () => {
        const trapBoard = buildBoard(7, {
            runSeed: 42_011,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless'
        });
        const treasureBoard = buildBoard(10, {
            runSeed: 42_011,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'breather',
            floorArchetypeId: 'treasure_gallery',
            gameMode: 'endless'
        });

        expect(trapBoard.dungeonBossId).toBe('trap_warden');
        expect(trapBoard.dungeonObjectiveId).toBe('defeat_boss');
        expect(trapBoard.tiles.filter((tile) => tile.dungeonBossId === 'trap_warden')).toHaveLength(2);
        expect(trapBoard.tiles.find((tile) => tile.dungeonBossId === 'trap_warden')).toMatchObject({
            label: 'Latch Warden',
            dungeonCardHp: 3
        });
        expect(trapBoard.tiles.some((tile) => tile.dungeonCardEffectId === 'rune_seal')).toBe(true);
        expect(treasureBoard.dungeonObjectiveId).toBe('loot_cache');
        expect(treasureBoard.tiles.some((tile) => tile.dungeonCardEffectId === 'treasure_cache')).toBe(true);
    });

    it('assigns expanded dungeon objectives by floor shape', () => {
        const trapBlueprint = createDungeonFloorBlueprint({
            runSeed: 42_014,
            rulesVersion: GAME_RULES_VERSION,
            level: 7,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless'
        });
        const bossBlueprint = createDungeonFloorBlueprint({
            runSeed: 42_014,
            rulesVersion: GAME_RULES_VERSION,
            level: 9,
            floorTag: 'boss',
            floorArchetypeId: 'rush_recall',
            gameMode: 'endless'
        });
        const gatewayBlueprint = createDungeonFloorBlueprint({
            runSeed: 42_014,
            rulesVersion: GAME_RULES_VERSION,
            level: 5,
            floorTag: 'normal',
            floorArchetypeId: null,
            gameMode: 'endless'
        });

        expect(trapBlueprint.objectiveId).toBe('defeat_boss');
        expect(bossBlueprint.objectiveId).toBe('defeat_boss');
        expect(gatewayBlueprint.objectiveId).toBe('claim_route');
    });

    it('generates expanded hazards on eligible dungeon archetypes', () => {
        const trapBoard = buildBoard(7, {
            runSeed: 42_099,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless'
        });
        const shadowBoard = buildBoard(4, {
            runSeed: 42_099,
            runRulesVersion: GAME_RULES_VERSION,
            floorArchetypeId: 'shadow_read',
            gameMode: 'endless'
        });

        expect(trapBoard.tiles.some((tile) => tile.dungeonCardEffectId === 'enemy_stalker')).toBe(true);
        expect(trapBoard.tiles.some((tile) => tile.dungeonCardEffectId === 'trap_snare')).toBe(true);
        expect(trapBoard.tiles.some((tile) => tile.dungeonCardEffectId === 'trap_hex')).toBe(true);
        expect(shadowBoard.tiles.some((tile) => tile.dungeonCardEffectId === 'trap_hex')).toBe(true);
    });

    it('summarizes dungeon board state and centralizes dungeon card copy', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_012, gameMode: 'endless' }));
        const exitTile = run.board!.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const trapTile = run.board!.tiles.find((tile) => tile.dungeonCardKind === 'trap') ?? {
            ...createTile('manual-trap', 'T', '!'),
            label: 'Alarm Trap',
            dungeonCardKind: 'trap' as const,
            dungeonCardState: 'revealed' as const,
            dungeonCardEffectId: 'trap_alarm' as const
        };
        const status = getDungeonBoardStatus(revealDungeonExit(run, exitTile.id));

        expect(status.exitCount).toBeGreaterThanOrEqual(1);
        expect(status.revealedExitCount).toBe(1);
        expect(status.objectiveId).toBe(run.board!.dungeonObjectiveId);
        expect(status.objectiveLabel).toBeTruthy();
        expect(status.objectiveRequired).toBeGreaterThanOrEqual(1);
        expect(getDungeonCardCopy(trapTile)).toMatch(/trap/i);
    });

    it('builds a renderer-facing dungeon status presentation', () => {
        const plain = createRun(createPair('A', 'A'));
        expect(getDungeonBoardPresentation(plain)).toMatchObject({ visible: false, chips: [] });

        const exitTile: Tile = {
            ...createTile('exit', EXIT_PAIR_KEY, '^'),
            label: 'Primary Safe Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_safe',
            dungeonRouteType: 'safe',
            dungeonExitLockKind: 'lever',
            dungeonExitRequiredLeverCount: 1,
            state: 'flipped'
        };
        const dungeonRun: RunState = {
            ...createRun([
                exitTile,
                {
                    ...createTile('t1', 'trap', '!'),
                    label: 'Snare Trap',
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'revealed',
                    dungeonCardEffectId: 'trap_snare'
                },
                {
                    ...createTile('t2', 'trap', '!'),
                    label: 'Snare Trap',
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'revealed',
                    dungeonCardEffectId: 'trap_snare'
                },
                {
                    ...createTile('r1', ROOM_PAIR_KEY, 'R'),
                    label: 'Campfire',
                    dungeonCardKind: 'room',
                    dungeonCardState: 'hidden',
                    dungeonCardEffectId: 'room_campfire'
                }
            ]),
            board: {
                ...createBoard([
                    exitTile,
                    {
                        ...createTile('t1', 'trap', '!'),
                        label: 'Snare Trap',
                        dungeonCardKind: 'trap',
                        dungeonCardState: 'revealed',
                        dungeonCardEffectId: 'trap_snare'
                    },
                    {
                        ...createTile('t2', 'trap', '!'),
                        label: 'Snare Trap',
                        dungeonCardKind: 'trap',
                        dungeonCardState: 'revealed',
                        dungeonCardEffectId: 'trap_snare'
                    },
                    {
                        ...createTile('r1', ROOM_PAIR_KEY, 'R'),
                        label: 'Campfire',
                        dungeonCardKind: 'room',
                        dungeonCardState: 'hidden',
                        dungeonCardEffectId: 'room_campfire'
                    }
                ]),
                dungeonObjectiveId: 'disarm_traps',
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'lever',
                dungeonExitRequiredLeverCount: 1,
                dungeonLeverCount: 0
            }
        };
        const presentation = getDungeonBoardPresentation(dungeonRun);

        expect(presentation.visible).toBe(true);
        expect(presentation.objectiveText).toMatch(/Disarm the traps 0\/1/);
        expect(presentation.exitText).toBe('Levers 0/1');
        expect(presentation.alertText).toMatch(/armed trap/i);
        expect(presentation.combatForecastText).toBeNull();
        expect(presentation.chips).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'exit', value: 'Levers 0/1' }),
                expect.objectContaining({ id: 'traps', value: '1', tone: 'danger' }),
                expect.objectContaining({ id: 'room', value: 'available' })
            ])
        );
    });

    it('prioritizes crowded dungeon HUD chips and keeps one alert line', () => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 60_001 }));
        const exitTile: Tile = {
            ...createTile('exit', EXIT_PAIR_KEY, '^'),
            state: 'flipped',
            label: 'Locked Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_safe',
            dungeonExitLockKind: 'iron'
        };
        const bossTileA: Tile = {
            ...createTile('boss-a', 'boss', 'B'),
            label: 'Trap Warden',
            dungeonCardKind: 'enemy',
            dungeonCardState: 'revealed',
            dungeonBossId: 'trap_warden',
            dungeonCardHp: 2,
            dungeonCardMaxHp: 4
        };
        const bossTileB: Tile = { ...bossTileA, id: 'boss-b' };
        const trapA: Tile = {
            ...createTile('trap-a', 'trap', '!'),
            label: 'Alarm Trap',
            dungeonCardKind: 'trap',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'trap_alarm'
        };
        const trapB: Tile = { ...trapA, id: 'trap-b' };
        const enemyA: Tile = {
            ...createTile('enemy-a', 'enemy', 'E'),
            label: 'Awake Sentry',
            dungeonCardKind: 'enemy',
            dungeonCardState: 'revealed'
        };
        const enemyB: Tile = { ...enemyA, id: 'enemy-b' };
        const shopTile: Tile = {
            ...createTile('shop', SHOP_PAIR_KEY, 'S'),
            label: 'Vendor',
            dungeonCardKind: 'shop',
            dungeonCardState: 'hidden'
        };
        const roomTile: Tile = {
            ...createTile('room', ROOM_PAIR_KEY, 'R'),
            label: 'Campfire',
            dungeonCardKind: 'room',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'room_campfire'
        };
        const run: RunState = {
            ...base,
            dungeonKeys: {},
            dungeonMasterKeys: 0,
            board: {
                ...base.board!,
                tiles: [exitTile, bossTileA, bossTileB, trapA, trapB, enemyA, enemyB, shopTile, roomTile],
                dungeonBossId: 'trap_warden',
                dungeonObjectiveId: 'defeat_boss',
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron',
                enemyHazards: [
                    {
                        id: 'patrol',
                        kind: 'sentinel',
                        label: 'Moving Patrol',
                        currentTileId: 'room',
                        nextTileId: 'shop',
                        pattern: 'patrol',
                        state: 'revealed',
                        damage: 1,
                        hp: 1,
                        maxHp: 1
                    }
                ]
            }
        };

        const presentation = getDungeonBoardPresentation(run);

        expect(presentation.alertText).toMatch(/armed trap/i);
        expect(presentation.alertText).not.toMatch(/moving enemy|Needs iron key|hidden dungeon/i);
        expect(presentation.chips).toHaveLength(6);
        expect(presentation.chips.map((chip) => chip.id)).toEqual([
            'traps',
            'enemy-hazards',
            'boss',
            'enemies',
            'exit',
            'keys'
        ]);
        expect(presentation.chips.map((chip) => chip.priority)).toEqual([10, 15, 20, 25, 30, 50]);
        expect(presentation.chips.some((chip) => chip.id === 'room')).toBe(false);
        expect(presentation.chips.some((chip) => chip.id === 'shop')).toBe(false);
        expect(presentation.chips.some((chip) => chip.id === 'hidden')).toBe(false);
    });

    it('forecasts guard and life exposure for enemy combat pressure', () => {
        const enemyA: Tile = {
            ...createTile('enemy-a', 'enemy', 'E'),
            label: 'Awake Sentry',
            dungeonCardKind: 'enemy',
            dungeonCardState: 'revealed',
            dungeonCardHp: 2,
            dungeonCardMaxHp: 2
        };
        const enemyB: Tile = { ...enemyA, id: 'enemy-b' };
        const patrolTile = createTile('patrol-target', 'P', 'P');
        const spareTile = createTile('spare', 'S', 'S');
        const base = createRun([enemyA, enemyB, patrolTile, spareTile], { status: 'playing' });
        const pressured: RunState = {
            ...base,
            stats: { ...base.stats, guardTokens: 0 },
            board: {
                ...base.board!,
                tiles: [enemyA, enemyB, patrolTile, spareTile],
                enemyHazards: [
                    {
                        id: 'heavy-patrol',
                        kind: 'warden',
                        label: 'Cache Warden',
                        currentTileId: patrolTile.id,
                        nextTileId: spareTile.id,
                        pattern: 'guard',
                        state: 'revealed',
                        damage: 2,
                        hp: 2,
                        maxHp: 2
                    }
                ]
            }
        };

        expect(getDungeonBoardPresentation(pressured).combatForecastText).toBe(
            'No guard: patrol contact costs up to 2 lives; awake enemies cost 1 life on mismatch.'
        );

        expect(
            getDungeonBoardPresentation({
                ...pressured,
                stats: { ...pressured.stats, guardTokens: 1 }
            }).combatForecastText
        ).toBe('1 guard ready: the next enemy hit spends guard before life.');
    });

    it('tracks dungeon objective progress and awards objective rewards on exit activation', () => {
        const bossBoard = buildBoard(9, {
            runSeed: 42_013,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'rush_recall',
            gameMode: 'endless'
        });
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_013, gameMode: 'endless' }));
        const bossRun: RunState = { ...baseRun, board: bossBoard, status: 'playing' };
        const bossStatus = getDungeonObjectiveStatus(bossRun);
        expect(bossStatus.objectiveId).toBe('defeat_boss');
        expect(bossStatus.required).toBeGreaterThan(0);
        expect(bossStatus.completed).toBe(false);

        const exitTile: Tile = {
            ...createTile('exit', EXIT_PAIR_KEY, '^'),
            label: 'Primary Safe Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'exit_safe',
            dungeonRouteType: 'safe',
            dungeonExitLockKind: 'none',
            dungeonExitActivated: false
        };
        const rewardRun: RunState = {
            ...createRun([
                {
                    ...createTile('c1', 'C', '$'),
                    label: 'Treasure Cache',
                    dungeonCardKind: 'treasure',
                    dungeonCardState: 'resolved',
                    dungeonCardEffectId: 'treasure_cache'
                },
                {
                    ...createTile('c2', 'C', '$'),
                    label: 'Treasure Cache',
                    dungeonCardKind: 'treasure',
                    dungeonCardState: 'resolved',
                    dungeonCardEffectId: 'treasure_cache'
                },
                exitTile
            ]),
            board: {
                ...createBoard([
                    {
                        ...createTile('c1', 'C', '$'),
                        label: 'Treasure Cache',
                        dungeonCardKind: 'treasure',
                        dungeonCardState: 'resolved',
                        dungeonCardEffectId: 'treasure_cache',
                        state: 'matched'
                    },
                    {
                        ...createTile('c2', 'C', '$'),
                        label: 'Treasure Cache',
                        dungeonCardKind: 'treasure',
                        dungeonCardState: 'resolved',
                        dungeonCardEffectId: 'treasure_cache',
                        state: 'matched'
                    },
                    exitTile
                ]),
                dungeonExitTileId: 'exit',
                dungeonObjectiveId: 'loot_cache',
                dungeonExitLockKind: 'none'
            },
            dungeonTreasuresOpened: 1
        };
        const opened = activateDungeonExit(revealDungeonExit(rewardRun, 'exit'));
        expect(opened.lastLevelResult?.scoreGained).toBeGreaterThan(50);
        expect(opened.stats.totalScore).toBeGreaterThanOrEqual(35);
        expect(opened.relicFavorProgress).toBe(1);
    });

    it('completes pacify and disarm objectives as dungeon pairs resolve', () => {
        const enemyRun = createRun([
            {
                ...createTile('e1', 'enemy', 'e'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 1,
                dungeonCardMaxHp: 1
            },
            {
                ...createTile('e2', 'enemy', 'e'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 1,
                dungeonCardMaxHp: 1
            }
        ]);
        const pacifyRun: RunState = {
            ...enemyRun,
            board: { ...enemyRun.board!, dungeonObjectiveId: 'pacify_floor' }
        };
        expect(getDungeonObjectiveStatus(pacifyRun)).toMatchObject({ completed: false, progress: 0, required: 1 });

        const pacified = resolveBoardTurn(flipTile(flipTile(pacifyRun, 'e1'), 'e2'));
        expect(getDungeonObjectiveStatus(pacified)).toMatchObject({ completed: true, progress: 1, required: 1 });

        const movingThreatRun = createRun([createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')]);
        const movingThreatBoard = {
            ...movingThreatRun.board!,
            dungeonObjectiveId: 'pacify_floor' as const,
            enemyHazards: [
                {
                    id: 'moving-threat',
                    kind: 'sentinel' as const,
                    label: 'Patrol Sentry',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    pattern: 'patrol' as const,
                    state: 'hidden' as const,
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ]
        };
        expect(getDungeonObjectiveStatus({ ...movingThreatRun, board: movingThreatBoard })).toMatchObject({
            completed: false,
            progress: 0,
            required: 1
        });
        expect(
            getDungeonObjectiveStatus({
                ...movingThreatRun,
                board: {
                    ...movingThreatBoard,
                    enemyHazards: movingThreatBoard.enemyHazards.map((hazard) => ({
                        ...hazard,
                        hp: 0,
                        state: 'defeated' as const
                    }))
                },
                enemyHazardsDefeatedThisFloor: 1
            })
        ).toMatchObject({ completed: true, progress: 1, required: 1 });

        const trapRun = createRun([
            {
                ...createTile('t1', 'trap', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'trap', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            }
        ]);
        const disarmRun: RunState = {
            ...trapRun,
            board: { ...trapRun.board!, dungeonObjectiveId: 'disarm_traps' }
        };
        expect(getDungeonObjectiveStatus(disarmRun)).toMatchObject({ completed: false, progress: 0, required: 1 });

        const disarmed = resolveBoardTurn(flipTile(flipTile(disarmRun, 't1'), 't2'));
        expect(disarmed.dungeonTrapsTriggered).toBe(1);
        expect(disarmed.dungeonTrapsResolvedThisFloor).toBe(1);
        expect(getDungeonObjectiveStatus(disarmed)).toMatchObject({ completed: true, progress: 1, required: 1 });
    });

    it('keeps objective progress board-derived when counters and resolved state overlap', () => {
        const trapRun = createRun([
            {
                ...createTile('t1', 'trap', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'resolved',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'trap', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'resolved',
                dungeonCardEffectId: 'trap_spikes'
            }
        ]);
        expect(
            getDungeonObjectiveStatus({
                ...trapRun,
                board: { ...trapRun.board!, dungeonObjectiveId: 'disarm_traps' },
                dungeonTrapsResolvedThisFloor: 1
            })
        ).toMatchObject({ completed: true, progress: 1, required: 1 });

        const enemyRun = createRun([
            {
                ...createTile('e1', 'enemy', 'e'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'resolved',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 0,
                dungeonCardMaxHp: 1
            },
            {
                ...createTile('e2', 'enemy', 'e'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'resolved',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 0,
                dungeonCardMaxHp: 1
            }
        ]);
        expect(
            getDungeonObjectiveStatus({
                ...enemyRun,
                board: { ...enemyRun.board!, dungeonObjectiveId: 'pacify_floor' },
                dungeonEnemiesDefeatedThisFloor: 1
            })
        ).toMatchObject({ completed: true, progress: 1, required: 1 });
    });

    it('covers find, bonus-exit, loot, reveal, and blocked boss objective semantics', () => {
        const primaryExit: Tile = {
            ...createTile('primary-exit', EXIT_PAIR_KEY, '^'),
            label: 'Primary Safe Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'exit_safe',
            dungeonRouteType: 'safe',
            dungeonExitLockKind: 'none',
            dungeonExitActivated: false
        };
        const bonusExit: Tile = {
            ...createTile('bonus-exit', EXIT_PAIR_KEY, '>'),
            label: 'Bonus Greed Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_greed',
            dungeonRouteType: 'greed',
            dungeonExitLockKind: 'none',
            dungeonExitActivated: false,
            state: 'flipped'
        };
        const exitRun = createRun([primaryExit, bonusExit]);
        const exitBoard = { ...exitRun.board!, dungeonExitTileId: primaryExit.id };

        expect(getDungeonObjectiveStatus({ ...exitRun, board: { ...exitBoard, dungeonObjectiveId: 'find_exit' } })).toMatchObject({
            completed: true,
            progress: 1,
            required: 1
        });
        expect(getDungeonObjectiveStatus({ ...exitRun, board: { ...exitBoard, dungeonObjectiveId: 'open_bonus_exit' } })).toMatchObject({
            completed: true,
            progress: 1,
            required: 1
        });

        const revealRun = createRun([
            {
                ...createTile('room', ROOM_PAIR_KEY, 'R'),
                label: 'Map Room',
                dungeonCardKind: 'room',
                dungeonCardState: 'revealed',
                dungeonCardEffectId: 'room_map'
            },
            {
                ...createTile('enemy-a', 'enemy', 'e'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry'
            },
            {
                ...createTile('enemy-b', 'enemy', 'e'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry'
            }
        ]);
        expect(getDungeonObjectiveStatus({ ...revealRun, board: { ...revealRun.board!, dungeonObjectiveId: 'reveal_unknowns' } })).toMatchObject({
            completed: false,
            progress: 1,
            required: 2
        });

        const lootRun = createRun([
            {
                ...createTile('cache-a', 'cache', '$'),
                label: 'Treasure Cache',
                dungeonCardKind: 'treasure',
                dungeonCardState: 'resolved',
                dungeonCardEffectId: 'treasure_cache',
                state: 'removed'
            },
            {
                ...createTile('cache-b', 'cache', '$'),
                label: 'Treasure Cache',
                dungeonCardKind: 'treasure',
                dungeonCardState: 'resolved',
                dungeonCardEffectId: 'treasure_cache',
                state: 'removed'
            }
        ]);
        expect(getDungeonObjectiveStatus({ ...lootRun, board: { ...lootRun.board!, dungeonObjectiveId: 'loot_cache' } })).toMatchObject({
            completed: true,
            progress: 1,
            required: 1
        });
        expect(
            getDungeonObjectiveStatus({
                ...lootRun,
                board: { ...lootRun.board!, dungeonObjectiveId: 'loot_cache' },
                dungeonTreasuresOpened: 1,
                dungeonTreasuresOpenedThisFloor: 0
            })
        ).toMatchObject({
            completed: true,
            progress: 1,
            required: 1
        });

        const staleLootRun = createRun([createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')]);
        expect(
            getDungeonObjectiveStatus({
                ...staleLootRun,
                board: { ...staleLootRun.board!, dungeonObjectiveId: 'loot_cache' },
                dungeonTreasuresOpened: 1,
                dungeonTreasuresOpenedThisFloor: 0
            })
        ).toMatchObject({
            completed: false,
            progress: 0,
            required: 1
        });

        const bossExit: Tile = {
            ...createTile('boss-exit', EXIT_PAIR_KEY, '^'),
            label: 'Boss Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_boss',
            dungeonRouteType: 'greed',
            dungeonExitLockKind: 'none',
            dungeonExitActivated: false,
            state: 'flipped'
        };
        const bossRun = createRun([createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A'), bossExit]);
        const blockedBoss = {
            ...bossRun,
            board: {
                ...bossRun.board!,
                dungeonObjectiveId: 'defeat_boss' as const,
                dungeonBossId: 'rush_sentinel' as const,
                dungeonExitTileId: 'boss-exit',
                enemyHazards: [
                    {
                        id: 'boss',
                        kind: 'sentinel' as const,
                        label: 'Rush Sentinel',
                        currentTileId: 'a1',
                        nextTileId: 'a2',
                        pattern: 'patrol' as const,
                        state: 'revealed' as const,
                        damage: 1,
                        hp: 2,
                        maxHp: 3,
                        bossId: 'rush_sentinel' as const
                    }
                ]
            }
        };
        expect(getDungeonObjectiveStatus(blockedBoss)).toMatchObject({
            completed: false,
            progress: 1,
            required: 3
        });
        expect(getDungeonExitStatus(blockedBoss).lockedReason).toMatch(/Defeat Rush Sentinel/);
    });

    it('completes claim route objectives through gateways or route exits', () => {
        const gatewayRun = createRun([
            {
                ...createTile('g1', 'gateway', '>'),
                label: 'Depth Gateway',
                dungeonCardKind: 'gateway',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'gateway_depth',
                dungeonRouteType: 'greed'
            },
            {
                ...createTile('g2', 'gateway', '>'),
                label: 'Depth Gateway',
                dungeonCardKind: 'gateway',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'gateway_depth',
                dungeonRouteType: 'greed'
            }
        ]);
        const routeRun: RunState = {
            ...gatewayRun,
            board: { ...gatewayRun.board!, dungeonObjectiveId: 'claim_route' }
        };
        expect(getDungeonObjectiveStatus(routeRun)).toMatchObject({ completed: false, progress: 0, required: 1 });
        expect(
            getDungeonObjectiveStatus({
                ...routeRun,
                dungeonGatewaysUsed: 1,
                dungeonGatewaysUsedThisFloor: 0
            })
        ).toMatchObject({ completed: false, progress: 0, required: 1 });

        const claimedGateway = resolveBoardTurn(flipTile(flipTile(routeRun, 'g1'), 'g2'));
        expect(getDungeonObjectiveStatus(claimedGateway)).toMatchObject({ completed: true, progress: 1, required: 1 });

        const exitTile: Tile = {
            ...createTile('route-exit', EXIT_PAIR_KEY, '>'),
            label: 'Primary Greed Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'exit_greed',
            dungeonRouteType: 'greed',
            dungeonExitLockKind: 'none',
            dungeonExitActivated: false
        };
        const exitRun: RunState = {
            ...createRun([exitTile]),
            board: {
                ...createBoard([exitTile]),
                dungeonExitTileId: 'route-exit',
                dungeonObjectiveId: 'claim_route',
                dungeonExitLockKind: 'none'
            }
        };
        const opened = activateDungeonExit(revealDungeonExit(exitRun, 'route-exit'));
        expect(opened.stats.totalScore).toBeGreaterThanOrEqual(35);
        expect(opened.relicFavorProgress).toBe(1);
    });

    it('gives each dungeon boss a distinct match payoff and copy read', () => {
        const bossPair = (
            bossId: NonNullable<Tile['dungeonBossId']>,
            label: string
        ): [Tile, Tile] => [
            {
                ...createTile(`${bossId}-a`, bossId, label.charAt(0)),
                label,
                dungeonCardKind: 'enemy',
                dungeonBossId: bossId,
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_elite',
                dungeonCardHp: 3,
                dungeonCardMaxHp: 3
            },
            {
                ...createTile(`${bossId}-b`, bossId, label.charAt(0)),
                label,
                dungeonCardKind: 'enemy',
                dungeonBossId: bossId,
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_elite',
                dungeonCardHp: 3,
                dungeonCardMaxHp: 3
            }
        ];

        const trapWarden = resolveBoardTurn(flipTile(flipTile(createRun(bossPair('trap_warden', 'Trap Warden')), 'trap_warden-a'), 'trap_warden-b'));
        expect(trapWarden.stats.guardTokens).toBe(1);
        expect(trapWarden.relicFavorProgress).toBe(1);
        expect(getDungeonCardCopy(bossPair('trap_warden', 'Trap Warden')[0])).toMatch(/guard/i);

        const rushSentinel = resolveBoardTurn(
            flipTile(flipTile(createRun(bossPair('rush_sentinel', 'Rush Sentinel')), 'rush_sentinel-a'), 'rush_sentinel-b')
        );
        expect(rushSentinel.stats.comboShards).toBe(1);
        expect(rushSentinel.stats.totalScore).toBeGreaterThan(trapWarden.stats.totalScore);
        expect(getDungeonCardCopy(bossPair('rush_sentinel', 'Rush Sentinel')[0])).toMatch(/combo shard/i);

        const meditationRushSentinel = resolveBoardTurn(
            flipTile(
                flipTile(
                    {
                        ...createRun(bossPair('rush_sentinel', 'Rush Sentinel')),
                        gameMode: 'meditation'
                    },
                    'rush_sentinel-a'
                ),
                'rush_sentinel-b'
            )
        );
        expect(meditationRushSentinel.stats.comboShards).toBe(1);

        const treasureKeeper = resolveBoardTurn(
            flipTile(
                flipTile(createRun(bossPair('treasure_keeper', 'Treasure Keeper')), 'treasure_keeper-a'),
                'treasure_keeper-b'
            )
        );
        expect(treasureKeeper.shopGold).toBeGreaterThanOrEqual(4);
        expect(treasureKeeper.dungeonTreasuresOpened).toBe(1);
        expect(getDungeonCardCopy(bossPair('treasure_keeper', 'Treasure Keeper')[0])).toMatch(/shop gold/i);

        const spireObserver = resolveBoardTurn(
            flipTile(flipTile(createRun(bossPair('spire_observer', 'Spire Observer')), 'spire_observer-a'), 'spire_observer-b')
        );
        expect(spireObserver.relicFavorProgress).toBe(2);
        expect(getDungeonCardCopy(bossPair('spire_observer', 'Spire Observer')[0])).toMatch(/extra Favor/i);
    });

    it('defines a shared identity, card, patrol, and read model for every dungeon boss', () => {
        const cases: Array<{
            bossId: NonNullable<Tile['dungeonBossId']>;
            floorArchetypeId: FloorArchetypeId | null;
            expectedPattern: string;
            rewardNeedle: RegExp;
        }> = [
            { bossId: 'trap_warden', floorArchetypeId: 'trap_hall', expectedPattern: 'guard', rewardNeedle: /guard/i },
            { bossId: 'rush_sentinel', floorArchetypeId: 'rush_recall', expectedPattern: 'patrol', rewardNeedle: /combo shard/i },
            { bossId: 'treasure_keeper', floorArchetypeId: 'treasure_gallery', expectedPattern: 'guard', rewardNeedle: /shop gold/i },
            { bossId: 'spire_observer', floorArchetypeId: 'spotlight_hunt', expectedPattern: 'observe', rewardNeedle: /extra Favor/i }
        ];

        for (const row of cases) {
            const definition = getDungeonBossDefinition(row.bossId)!;
            const board = buildBoard(12, {
                runSeed: 42_340,
                runRulesVersion: GAME_RULES_VERSION,
                floorTag: 'boss',
                floorArchetypeId: row.floorArchetypeId,
                gameMode: 'endless'
            });
            const bossTiles = board.tiles.filter((tile) => tile.dungeonBossId === row.bossId);
            const bossHazards = board.enemyHazards?.filter((hazard) => hazard.bossId === row.bossId) ?? [];
            const read = getDungeonBossReadModel(board, row.bossId)!;

            expect(definition).toMatchObject({
                id: row.bossId,
                label: bossTiles[0]!.label,
                hazardPattern: row.expectedPattern
            });
            expect(Object.keys(DUNGEON_BOSS_DEFINITIONS)).toContain(row.bossId);
            expect(bossTiles).toHaveLength(2);
            expect(bossTiles[0]).toMatchObject({ dungeonCardKind: 'enemy', dungeonCardHp: definition.hp });
            expect(getDungeonCardCopy(bossTiles[0]!)).toMatch(row.rewardNeedle);
            expect(bossHazards).toHaveLength(1);
            expect(bossHazards[0]).toMatchObject({
                label: definition.label,
                pattern: row.expectedPattern,
                maxHp: definition.hp
            });
            expect(read).toMatchObject({
                id: row.bossId,
                label: definition.label,
                bossCardPairCount: 1,
                activeBossCardPairCount: 1,
                movingPatrolCount: 1,
                activeMovingPatrolCount: 1,
                lifecycleSource: 'boss_card_pair',
                hazardPattern: row.expectedPattern,
                hp: definition.hp,
                phase: 'opening'
            });
            expect(read.signatureModifier.length).toBeGreaterThan(0);
            expect(read.rewardHook).toMatch(row.rewardNeedle);
            expect(read.visualAudioPlaceholders.length).toBeGreaterThanOrEqual(3);
            expect(getDungeonEnemyLifecycleStatus(board).activeBossEnemyCount).toBe(1);
        }
    });

    it('derives dungeon boss phases from existing HP without mixing card pairs and patrol overlays', () => {
        const definition = getDungeonBossDefinition('spire_observer')!;
        const bossTile = (id: string, hp: number): Tile => ({
            ...createTile(id, 'spire_observer', definition.symbol),
            label: definition.label,
            dungeonCardKind: 'enemy',
            dungeonBossId: 'spire_observer',
            dungeonCardState: hp > 0 ? 'revealed' : 'resolved',
            dungeonCardEffectId: 'enemy_elite',
            dungeonCardHp: hp,
            dungeonCardMaxHp: definition.hp,
            state: hp > 0 ? 'flipped' : 'matched'
        });
        const board: BoardState = {
            ...createBoard([bossTile('boss-a', 1), bossTile('boss-b', 1)]),
            dungeonBossId: 'spire_observer',
            enemyHazards: [
                {
                    id: 'spire-patrol',
                    kind: definition.hazardKind,
                    label: definition.label,
                    currentTileId: 'boss-a',
                    nextTileId: 'boss-b',
                    pattern: definition.hazardPattern,
                    state: 'revealed',
                    damage: 1,
                    hp: definition.hp,
                    maxHp: definition.hp,
                    bossId: 'spire_observer'
                }
            ]
        };

        const bloodied = getDungeonBossReadModel(board)!;
        expect(bloodied).toMatchObject({
            lifecycleSource: 'boss_card_pair',
            bossCardPairCount: 1,
            movingPatrolCount: 1,
            hp: 1,
            maxHp: definition.hp,
            phase: 'bloodied'
        });

        const patrolOnlyBoard: BoardState = {
            ...createBoard([
                ...board.tiles.map((tile) => ({
                    ...tile,
                    state: 'matched' as const,
                    dungeonCardState: 'resolved' as const,
                    dungeonCardHp: 0
                })),
                createTile('open-a', 'open-pair', 'O'),
                createTile('open-b', 'open-pair', 'O')
            ]),
            dungeonBossId: 'spire_observer',
            enemyHazards: board.enemyHazards?.map((hazard) => ({
                ...hazard,
                currentTileId: 'open-a',
                nextTileId: 'open-b'
            }))
        };
        const patrolOnly = getDungeonBossReadModel(patrolOnlyBoard)!;
        expect(patrolOnly).toMatchObject({
            lifecycleSource: 'moving_patrol',
            activeBossCardPairCount: 0,
            activeMovingPatrolCount: 1,
            hp: definition.hp,
            phase: 'opening'
        });
    });

    it('adds at least one exit and can add alternate exits during generation', () => {
        const board = buildBoard(5, {
            runSeed: 123,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless'
        });

        const exits = board.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY);
        expect(exits.length).toBeGreaterThanOrEqual(1);
        expect(exits.length).toBeGreaterThan(1);
        expect(exits.every((exit) => exit.dungeonCardKind === 'exit')).toBe(true);
        expect(exits.some((exit) => exit.id === board.dungeonExitTileId)).toBe(true);
        expect(board.tiles.some((tile) => tile.dungeonCardKind === 'enemy')).toBe(true);
        expect(board.tiles.some((tile) => tile.dungeonCardKind === 'trap')).toBe(true);
    });

    it('interposes dungeon utility cards instead of appending exits and rooms at the tail', () => {
        const board = buildBoard(7, {
            runSeed: 123_707,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            gameMode: 'endless'
        });
        const exitIndices = board.tiles
            .map((tile, index) => (tile.pairKey === EXIT_PAIR_KEY ? index : -1))
            .filter((index) => index >= 0);
        const lastRowStart = Math.floor((board.tiles.length - 1) / board.columns) * board.columns;

        expect(exitIndices.length).toBeGreaterThan(1);
        expect(exitIndices.some((index) => index < board.tiles.length - 3)).toBe(true);
        expect(board.tiles.findIndex((tile) => tile.id === board.dungeonExitTileId)).toBeLessThan(lastRowStart);
        for (let i = 1; i < exitIndices.length; i += 1) {
            expect(Math.abs(exitIndices[i]! - exitIndices[i - 1]!)).toBeGreaterThan(1);
        }

        const roomBoard = Array.from({ length: 20 }, (_, index) =>
            buildBoard(2, {
                runSeed: 124_000 + index,
                runRulesVersion: GAME_RULES_VERSION,
                floorTag: 'breather',
                gameMode: 'endless'
            })
        ).find((candidate) => candidate.tiles.some((tile) => tile.pairKey === ROOM_PAIR_KEY))!;
        const roomIndex = roomBoard.tiles.findIndex((tile) => tile.pairKey === ROOM_PAIR_KEY);
        expect(roomIndex).toBeGreaterThanOrEqual(0);
        expect(roomIndex).toBeLessThan(roomBoard.tiles.length - 1);

        const shopBoard = buildBoard(3, {
            runSeed: 123,
            runRulesVersion: GAME_RULES_VERSION,
            floorArchetypeId: 'treasure_gallery',
            gameMode: 'endless'
        });
        const shopIndex = shopBoard.tiles.findIndex((tile) => tile.pairKey === SHOP_PAIR_KEY);
        expect(shopIndex).toBeGreaterThanOrEqual(0);
        expect(shopIndex).toBeLessThan(shopBoard.tiles.length - 1);
    });

    it('varies dungeon utility placement by seed while preserving deterministic boards', () => {
        const options = {
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss' as const,
            floorArchetypeId: 'trap_hall' as const,
            gameMode: 'endless' as const
        };
        const a = buildBoard(7, { ...options, runSeed: 151_001 });
        const repeat = buildBoard(7, { ...options, runSeed: 151_001 });
        const b = buildBoard(7, { ...options, runSeed: 151_002 });
        const positions = (board: BoardState): number[] =>
            board.tiles
                .map((tile, index) =>
                    tile.pairKey === EXIT_PAIR_KEY || tile.pairKey === SHOP_PAIR_KEY || tile.pairKey === ROOM_PAIR_KEY
                        ? index
                        : -1
                )
                .filter((index) => index >= 0);

        expect(positions(repeat)).toEqual(positions(a));
        expect(positions(b)).not.toEqual(positions(a));
    });

    it('adds minor supply filler rewards without satisfying loot-cache objectives', () => {
        const board = buildBoard(5, {
            runSeed: 161_001,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless'
        });
        const supplyTiles = board.tiles.filter((tile) => tile.dungeonCardEffectId === 'treasure_shard');
        expect(supplyTiles).toHaveLength(2);

        const run = { ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })), board, status: 'playing' as const };
        const resolved = resolveBoardTurn(flipTile(flipTile(run, supplyTiles[0]!.id), supplyTiles[1]!.id));
        expect(resolved.shopGold).toBe(run.shopGold + 1);
        expect(resolved.stats.totalScore).toBeGreaterThan(run.stats.totalScore);

        const lootRun: RunState = {
            ...resolved,
            board: { ...resolved.board!, dungeonObjectiveId: 'loot_cache' },
            dungeonTreasuresOpened: 0
        };
        expect(getDungeonObjectiveStatus(lootRun)).toMatchObject({ completed: false, progress: 0, required: 1 });
    });

    it('uses the revealed exit when multiple exits are present', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_004 }));
        const exits = run.board!.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY);
        const board = {
            ...run.board!,
            tiles: [
                ...run.board!.tiles,
                {
                    ...exits[0]!,
                    id: 'manual-safe-exit',
                    label: 'Manual Safe Exit',
                    dungeonRouteType: 'safe' as const,
                    dungeonExitLockKind: 'none' as const
                }
            ]
        };
        const revealed = revealDungeonExit({ ...run, board }, 'manual-safe-exit');
        const status = getDungeonExitStatus(revealed);

        expect(status.exitTile?.id).toBe('manual-safe-exit');
        expect(status.canActivateWithoutSpend).toBe(true);
    });

    it('spawns shop cards on some floors and opens them without granting floor-clear gold', () => {
        const floorOne = buildBoard(1, {
            runSeed: 123,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless'
        });
        const treasureFloor = buildBoard(3, {
            runSeed: 123,
            runRulesVersion: GAME_RULES_VERSION,
            floorArchetypeId: 'treasure_gallery',
            gameMode: 'endless'
        });

        expect(floorOne.tiles.some((tile) => tile.pairKey === SHOP_PAIR_KEY)).toBe(false);
        expect(treasureFloor.tiles.filter((tile) => tile.pairKey === SHOP_PAIR_KEY)).toHaveLength(1);

        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_005 }));
        const board = {
            ...run.board!,
            dungeonShopTileId: 'manual-shop',
            tiles: [
                ...run.board!.tiles,
                {
                    ...createTile('manual-shop', SHOP_PAIR_KEY, 'S'),
                    label: 'Vendor Alcove',
                    dungeonCardKind: 'shop' as const,
                    dungeonCardState: 'hidden' as const,
                    dungeonCardEffectId: 'shop_vendor' as const
                }
            ]
        };
        const opened = revealDungeonShop({ ...run, board, shopGold: 3 }, 'manual-shop');

        expect(opened.status).toBe('playing');
        expect(opened.shopGold).toBe(3);
        expect(opened.shopOffers.length).toBeGreaterThan(0);
        expect(opened.dungeonShopVisitedThisFloor).toBe(true);
        expect(opened.board!.dungeonShopVisited).toBe(true);
        const rerolled = rerollShopOffers({ ...opened, shopGold: 10 });
        const reopened = revealDungeonShop(rerolled, 'manual-shop');
        expect(reopened.shopRerolls).toBe(1);
        expect(reopened.shopOffers.map((offer) => offer.id)).toEqual(rerolled.shopOffers.map((offer) => offer.id));
    });

    it('defines deterministic shop stock and read models for floor-clear and board vendors', () => {
        const floorRun = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_041 })),
            status: 'levelComplete' as const,
            shopGold: 5
        };
        const floorOffers = createRunShopOffers(floorRun);
        const floorShopRun = { ...floorRun, shopOffers: floorOffers };
        const board = buildBoard(3, {
            runSeed: 81_041,
            runRulesVersion: GAME_RULES_VERSION,
            dungeonNodeKind: 'shop',
            gameMode: 'endless'
        });
        const boardRun = {
            ...floorRun,
            status: 'playing' as const,
            board,
            shopGold: 5,
            shopOffers: createRunShopOffers({ ...floorRun, status: 'playing' as const, board })
        };

        expect(getRunShopStockPlan(floorShopRun)).toMatchObject({
            source: 'floor_clear_shop',
            itemIds: ['heal_life', 'peek_charge', 'region_shuffle_charge', 'destroy_charge', 'iron_key']
        });
        expect(getRunShopStockPlan(boardRun)).toMatchObject({
            source: 'board_shop',
            itemIds: ['trait_routing_kit', 'heal_life', 'peek_charge', 'region_shuffle_charge', 'destroy_charge', 'master_key']
        });
        expect(getRunShopReadModel(floorShopRun)).toMatchObject({
            source: 'floor_clear_shop',
            offerCount: floorOffers.length,
            wallet: 5,
            canReroll: true
        });
        expect(getRunShopReadModel(boardRun).previewCopy).toMatch(/Board vendor/);
        expect(boardRun.board!.tiles.find((tile) => tile.pairKey === SHOP_PAIR_KEY)).toBeDefined();
    });

    it('does not spend shop gold on incompatible or already purchased offers', () => {
        const fullLifeRun = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_042 })),
            lives: MAX_LIVES,
            shopGold: 10
        };
        const run = { ...fullLifeRun, shopOffers: createRunShopOffers(fullLifeRun) };
        const heal = run.shopOffers.find((offer) => offer.itemId === 'heal_life')!;
        const peek = run.shopOffers.find((offer) => offer.itemId === 'peek_charge')!;

        expect(heal.compatible).toBe(false);
        expect(purchaseShopOffer(run, heal.id)).toBe(run);

        const purchased = purchaseShopOffer(run, peek.id);
        const repurchased = purchaseShopOffer(purchased, peek.id);
        expect(purchased.shopGold).toBe(run.shopGold - peek.cost);
        expect(repurchased.shopGold).toBe(purchased.shopGold);
        expect(repurchased.peekCharges).toBe(purchased.peekCharges);
    });

    it('rechecks shop compatibility when the run becomes full after offers were generated', () => {
        const damagedRun = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_043 })),
            lives: MAX_LIVES - 1,
            shopGold: 10
        };
        const staleShopRun = {
            ...damagedRun,
            lives: MAX_LIVES,
            shopOffers: createRunShopOffers(damagedRun)
        };
        const heal = staleShopRun.shopOffers.find((offer) => offer.itemId === 'heal_life')!;

        expect(heal.compatible).toBe(true);
        expect(getRunShopReadModel(staleShopRun).availableOfferCount).toBe(
            staleShopRun.shopOffers.filter(
                (offer) => offer.itemId !== 'heal_life' && staleShopRun.shopGold >= offer.cost
            ).length
        );
        expect(purchaseShopOffer(staleShopRun, heal.id)).toBe(staleShopRun);
    });

    it('spawns room cards on some dungeon floors', () => {
        const boards = Array.from({ length: 20 }, (_, index) =>
            buildBoard(2, {
                runSeed: 90_000 + index,
                runRulesVersion: GAME_RULES_VERSION,
                floorTag: 'breather',
                gameMode: 'endless'
            })
        );

        expect(boards.some((board) => board.tiles.some((tile) => tile.pairKey === ROOM_PAIR_KEY))).toBe(true);
        for (const board of boards) {
            expect(board.tiles.filter((tile) => tile.pairKey === ROOM_PAIR_KEY).length).toBeLessThanOrEqual(1);
        }
    });

    it('defines trigger, cost, reward, and resolution copy for each room effect', () => {
        const roomEffects = [
            'room_campfire',
            'room_fountain',
            'room_map',
            'room_forge',
            'room_shrine',
            'room_scrying_lens',
            'room_armory',
            'room_locked_cache',
            'room_key_cache',
            'room_trap_workshop',
            'room_omen_archive'
        ] as const satisfies ReadonlyArray<keyof typeof DUNGEON_ROOM_EFFECT_DEFINITIONS>;

        expect(Object.keys(DUNGEON_ROOM_EFFECT_DEFINITIONS).sort()).toEqual([...roomEffects].sort());
        for (const effectId of roomEffects) {
            const tile: Tile = {
                ...createTile(effectId, ROOM_PAIR_KEY, 'R'),
                label: DUNGEON_ROOM_EFFECT_DEFINITIONS[effectId].label,
                dungeonCardKind: 'room',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: effectId
            };
            const read = getDungeonRoomReadModel(tile)!;

            expect(read.effectId).toBe(effectId);
            expect(read.costText.length).toBeGreaterThan(0);
            expect(read.rewardText.length).toBeGreaterThan(0);
            expect(['reveal', 'reveal_or_reuse']).toContain(read.trigger);
            expect(['one_shot_resolved', 'reusable_revealed', 'key_gated_until_paid']).toContain(read.resolvedState);
            expect(getDungeonCardCopy(tile)).toContain(read.rewardText);
        }
    });

    it('reports blocked and used room state without paying rewards twice', () => {
        const lockedCache: Tile = {
            ...createTile('cache', ROOM_PAIR_KEY, 'C'),
            label: 'Locked Cache',
            dungeonCardKind: 'room',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'room_locked_cache',
            dungeonRoomUsed: false
        };
        const forge: Tile = {
            ...createTile('forge', ROOM_PAIR_KEY, 'F'),
            label: 'Forge',
            dungeonCardKind: 'room',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'room_forge',
            dungeonRoomUsed: false
        };
        const usedCampfire: Tile = {
            ...createTile('campfire', ROOM_PAIR_KEY, 'C'),
            label: 'Campfire',
            dungeonCardKind: 'room',
            dungeonCardState: 'resolved',
            dungeonCardEffectId: 'room_campfire',
            dungeonRoomUsed: true
        };

        expect(getDungeonRoomReadModel(lockedCache, createRun([lockedCache]))).toMatchObject({
            canUse: false,
            blockedText: 'Needs an iron key or master key.'
        });
        expect(getDungeonRoomReadModel(forge, { ...createRun([forge]), shopGold: 1 })).toMatchObject({
            canUse: false,
            blockedText: 'Needs 2 shop gold.'
        });
        expect(getDungeonRoomReadModel(usedCampfire, createRun([usedCampfire]))).toMatchObject({
            used: true,
            canUse: false,
            blockedText: 'Room already used.'
        });

        const first = revealDungeonRoom({ ...createRun([usedCampfire]), lives: MAX_LIVES - 1 }, 'campfire');
        const second = revealDungeonRoom(first, 'campfire');
        expect(second.lives).toBe(first.lives);
        expect(second.stats.totalScore).toBe(first.stats.totalScore);
    });

    it('resolves one-shot room cards and lets the forge be reused when paid', () => {
        const campfire = {
            ...createTile('campfire', ROOM_PAIR_KEY, 'C'),
            label: 'Campfire',
            dungeonCardKind: 'room' as const,
            dungeonCardState: 'hidden' as const,
            dungeonCardEffectId: 'room_campfire' as const
        };
        const fountain = {
            ...createTile('fountain', ROOM_PAIR_KEY, 'F'),
            label: 'Fountain',
            dungeonCardKind: 'room' as const,
            dungeonCardState: 'hidden' as const,
            dungeonCardEffectId: 'room_fountain' as const
        };
        const forge = {
            ...createTile('forge', ROOM_PAIR_KEY, 'G'),
            label: 'Forge',
            dungeonCardKind: 'room' as const,
            dungeonCardState: 'hidden' as const,
            dungeonCardEffectId: 'room_forge' as const
        };

        const campfireRun = revealDungeonRoom({ ...createRun([campfire]), lives: MAX_LIVES - 1 }, 'campfire');
        expect(campfireRun.lives).toBe(MAX_LIVES);
        expect(campfireRun.board!.tiles.find((tile) => tile.id === 'campfire')!.dungeonRoomUsed).toBe(true);

        const fountainRun = revealDungeonRoom({ ...createRun([fountain]), stats: { ...createRun([fountain]).stats, guardTokens: 0 } }, 'fountain');
        expect(fountainRun.stats.guardTokens).toBe(1);

        const paidForge = revealDungeonRoom(
            { ...createRun([forge]), shopGold: 4, destroyPairCharges: 2 },
            'forge'
        );
        const repaidForge = revealDungeonRoom(paidForge, 'forge');
        expect(repaidForge.shopGold).toBe(0);
        expect(repaidForge.destroyPairCharges).toBe(4);
        expect(repaidForge.board!.tiles.find((tile) => tile.id === 'forge')!.dungeonCardState).toBe('revealed');
    });

    it('uses map rooms to reveal hidden utility cards on the floor', () => {
        const tiles: Tile[] = [
            {
                ...createTile('map', ROOM_PAIR_KEY, 'M'),
                label: 'Map Room',
                dungeonCardKind: 'room',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'room_map'
            },
            {
                ...createTile('exit', EXIT_PAIR_KEY, 'X'),
                label: 'Exit',
                dungeonCardKind: 'exit',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'exit_safe',
                dungeonExitLockKind: 'none'
            },
            {
                ...createTile('shop', SHOP_PAIR_KEY, 'S'),
                label: 'Vendor Alcove',
                dungeonCardKind: 'shop',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'shop_vendor'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const mapped = revealDungeonRoom(createRun(tiles), 'map');

        expect(mapped.board!.tiles.find((tile) => tile.id === 'exit')!.dungeonCardState).toBe('revealed');
        expect(mapped.board!.tiles.find((tile) => tile.id === 'shop')!.dungeonCardState).toBe('revealed');
        expect(mapped.board!.tiles.find((tile) => tile.id === 'map')!.dungeonCardState).toBe('resolved');
    });

    it('keeps key-locked exits optional so generated floors always have a non-key way out', () => {
        for (let level = 1; level <= 12; level += 1) {
            const board = buildBoard(level, {
                runSeed: 88_100,
                runRulesVersion: GAME_RULES_VERSION,
                floorTag: level % 5 === 0 ? 'boss' : 'normal',
                floorArchetypeId: level % 4 === 0 ? 'treasure_gallery' : level % 3 === 0 ? 'script_room' : null,
                gameMode: 'endless'
            });
            const exits = board.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY);
            expect(exits.length).toBeGreaterThanOrEqual(1);
            expect(exits.some((tile) => tile.dungeonExitLockKind === 'none' || tile.dungeonExitLockKind === 'lever')).toBe(true);
            for (const exit of exits.filter((tile) => tile.dungeonExitLockKind === 'lever')) {
                const leverPairs = new Set(
                    board.tiles.filter((tile) => tile.dungeonCardKind === 'lever').map((tile) => tile.pairKey)
                );
                expect(leverPairs.size).toBeGreaterThanOrEqual(exit.dungeonExitRequiredLeverCount ?? 0);
            }
        }
    });

    it('lets players ignore a key-locked bonus exit and leave through the primary exit', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_006 }));
        const primaryExit = run.board!.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const board = {
            ...run.board!,
            tiles: [
                ...run.board!.tiles.map((tile) =>
                    tile.id === primaryExit.id ? { ...tile, dungeonExitLockKind: 'none' as const } : tile
                ),
                {
                    ...primaryExit,
                    id: 'bonus-key-exit',
                    label: 'Bonus Key Exit',
                    dungeonExitLockKind: 'iron' as const,
                    dungeonRouteType: 'greed' as const
                }
            ]
        };
        const bonusRevealed = revealDungeonExit({ ...run, board, dungeonKeys: {}, dungeonMasterKeys: 0 }, 'bonus-key-exit');
        expect(getDungeonExitStatus(bonusRevealed).canActivate).toBe(false);

        const primaryRevealed = revealDungeonExit(bonusRevealed, primaryExit.id);
        const cleared = activateDungeonExit(primaryRevealed, 'none');

        expect(cleared.status).toBe('levelComplete');
    });

    it('cleans transient floor state and defeats active hazards on floor clear', () => {
        const exitTile: Tile = {
            ...createTile('exit', EXIT_PAIR_KEY, '^'),
            label: 'Primary Safe Exit',
            state: 'flipped',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_safe',
            dungeonRouteType: 'safe',
            dungeonExitLockKind: 'none',
            dungeonExitActivated: false
        };
        const a1 = createTile('a1', 'A', 'A');
        const a2 = createTile('a2', 'A', 'A');
        const baseRun = createRun([a1, a2, exitTile]);
        const run: RunState = {
            ...baseRun,
            status: 'playing',
            pinnedTileIds: ['a1'],
            peekRevealedTileIds: ['a2'],
            flashPairRevealedTileIds: ['a1'],
            strayRemoveArmed: true,
            regionShuffleRowArmed: 0,
            stickyBlockIndex: 1,
            board: {
                ...baseRun.board!,
                flippedTileIds: ['a1', 'missing'],
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'none',
                enemyHazards: [
                    {
                        id: 'hazard-1',
                        kind: 'sentinel',
                        label: 'Patrol',
                        currentTileId: 'a1',
                        nextTileId: 'a2',
                        pattern: 'patrol',
                        state: 'revealed',
                        damage: 1,
                        hp: 1,
                        maxHp: 1
                    }
                ]
            }
        };

        const cleared = activateDungeonExit(run, 'none');

        expect(cleared.status).toBe('levelComplete');
        expect(cleared.board!.flippedTileIds).toEqual([]);
        expect(cleared.pinnedTileIds).toEqual([]);
        expect(cleared.peekRevealedTileIds).toEqual([]);
        expect(cleared.flashPairRevealedTileIds).toEqual([]);
        expect(cleared.strayRemoveArmed).toBe(false);
        expect(cleared.regionShuffleRowArmed).toBeNull();
        expect(cleared.stickyBlockIndex).toBeNull();
        expect(cleared.board!.enemyHazards![0]).toMatchObject({ state: 'defeated', hp: 0 });
        expect(cleared.enemyHazardsDefeatedThisFloor).toBe(1);
        expect(getDungeonThreatStatus(cleared.board).movingEnemyHazardCount).toBe(0);
        expect(getDungeonEnemyLifecycleStatus(cleared)).toMatchObject({
            movingEnemyHazardCount: 0,
            defeatedMovingEnemyHazardCount: 1
        });
        expect(activateDungeonExit(cleared, 'none')).toBe(cleared);
    });

    it('reveals an exit without resolving a pair or costing life', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_001 }));
        const exitTile = run.board!.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const revealed = revealDungeonExit(run, exitTile.id);

        expect(revealed.lives).toBe(run.lives);
        expect(revealed.status).toBe('playing');
        expect(revealed.board!.flippedTileIds).toEqual([]);
        expect(getDungeonExitStatus(revealed).revealed).toBe(true);
    });

    it('requires lever pairs before a lever-sealed exit can be activated', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_002 }));
        const board = {
            ...run.board!,
            dungeonExitLockKind: 'lever' as const,
            dungeonExitRequiredLeverCount: 1,
            dungeonLeverCount: 0,
            tiles: run.board!.tiles.map((tile) =>
                tile.pairKey === EXIT_PAIR_KEY
                    ? { ...tile, dungeonExitLockKind: 'lever' as const, dungeonExitRequiredLeverCount: 1 }
                    : tile
            )
        };
        const exitTile = board.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const revealed = revealDungeonExit({ ...run, board }, exitTile.id);

        expect(getDungeonExitStatus(revealed).canActivate).toBe(false);

        const leverReady = {
            ...revealed,
            board: { ...revealed.board!, dungeonLeverCount: 1 }
        };
        const cleared = activateDungeonExit(leverReady, 'none');

        expect(cleared.status).toBe('levelComplete');
        expect(cleared.board!.dungeonExitActivated).toBe(true);
    });

    it('spends run-local keys or master keys on locked exits', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_003 }));
        const board = {
            ...run.board!,
            dungeonExitLockKind: 'iron' as const,
            tiles: run.board!.tiles.map((tile) =>
                tile.pairKey === EXIT_PAIR_KEY ? { ...tile, dungeonExitLockKind: 'iron' as const } : tile
            )
        };
        const exitTile = board.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const revealed = revealDungeonExit({ ...run, board, dungeonKeys: { iron: 1 } }, exitTile.id);
        const cleared = activateDungeonExit(revealed, 'key');

        expect(cleared.status).toBe('levelComplete');
        expect(cleared.dungeonKeys.iron).toBe(0);

        const masterRun = revealDungeonExit(
            { ...run, board, dungeonKeys: {}, dungeonMasterKeys: 1 },
            exitTile.id
        );
        const masterCleared = activateDungeonExit(masterRun, 'master_key');

        expect(masterCleared.status).toBe('levelComplete');
        expect(masterCleared.dungeonMasterKeys).toBe(0);
    });

    it('activates a terminal primary key lock fallback without spending keys', () => {
        const exit: Tile = {
            ...createTile('exit', EXIT_PAIR_KEY, '^'),
            label: 'Iron Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonExitLockKind: 'iron',
            state: 'flipped'
        };
        const matchedA = createTile('a1', 'a', 'A', { state: 'matched' });
        const matchedB = createTile('a2', 'a', 'A', { state: 'matched' });
        const board = createBoard([matchedA, matchedB, exit], {
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            matchedPairs: 1,
            pairCount: 1
        });
        const run: RunState = {
            ...createRun([matchedA, matchedB, exit]),
            board,
            dungeonKeys: {},
            dungeonMasterKeys: 0,
            status: 'playing'
        };

        expect(getDungeonExitStatus(run)).toMatchObject({
            lockKind: 'none',
            canActivate: true,
            canActivateWithoutSpend: true
        });

        const cleared = activateDungeonExit(run, 'none');

        expect(cleared.status).toBe('levelComplete');
        expect(cleared.dungeonKeys.iron ?? 0).toBe(0);
        expect(cleared.dungeonMasterKeys).toBe(0);
        expect(cleared.board!.dungeonExitActivated).toBe(true);
    });

    it('blocks defeat-boss exits while a boss card pair is still active', () => {
        const bossA: Tile = {
            ...createTile('boss-a', 'boss', 'B'),
            label: 'Rush Sentinel',
            dungeonCardKind: 'enemy',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'enemy_elite',
            dungeonBossId: 'rush_sentinel',
            dungeonCardHp: 3,
            dungeonCardMaxHp: 3,
            state: 'flipped'
        };
        const bossB: Tile = { ...bossA, id: 'boss-b', state: 'hidden' };
        const exit: Tile = {
            ...createTile('boss-exit', EXIT_PAIR_KEY, '^'),
            label: 'Boss Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_boss',
            dungeonExitLockKind: 'none',
            dungeonExitActivated: false,
            state: 'flipped'
        };
        const run: RunState = {
            ...createRun([bossA, bossB, exit]),
            board: {
                ...createBoard([bossA, bossB, exit]),
                dungeonObjectiveId: 'defeat_boss',
                dungeonBossId: 'rush_sentinel',
                dungeonExitTileId: exit.id
            },
            status: 'playing'
        };

        expect(getDungeonExitStatus(run)).toMatchObject({
            canActivate: false,
            lockedReason: 'Defeat Rush Sentinel before using the exit.'
        });
        expect(activateDungeonExit(run, 'none')).toBe(run);

        const defeated = {
            ...run,
            dungeonEnemiesDefeatedThisFloor: 1,
            board: {
                ...run.board!,
                tiles: run.board!.tiles.map((tile) =>
                    tile.dungeonBossId ? { ...tile, state: 'matched' as const, dungeonCardState: 'resolved' as const } : tile
                )
            }
        };
        expect(getDungeonExitStatus(defeated).canActivate).toBe(true);
    });

    it('opens terminal boss exits when only a stale boss hazard and raw key lock remain', () => {
        const matchedA: Tile = { ...createTile('a1', 'a', 'A'), state: 'matched' };
        const matchedB: Tile = { ...createTile('a2', 'a', 'A'), state: 'matched' };
        const exit: Tile = {
            ...createTile('boss-exit', EXIT_PAIR_KEY, '^'),
            label: 'Boss Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_boss',
            dungeonExitLockKind: 'iron',
            dungeonExitActivated: false,
            state: 'flipped'
        };
        const board = {
            ...createBoard([matchedA, matchedB, exit]),
            matchedPairs: 1,
            pairCount: 1,
            floorTag: 'boss' as const,
            dungeonObjectiveId: 'defeat_boss' as const,
            dungeonBossId: 'trap_warden' as const,
            dungeonExitTileId: exit.id,
            dungeonExitLockKind: 'iron' as const,
            enemyHazards: [
                {
                    id: 'stale-warden',
                    label: 'Trap Warden',
                    kind: 'warden' as const,
                    pattern: 'guard' as const,
                    state: 'revealed' as const,
                    currentTileId: exit.id,
                    nextTileId: exit.id,
                    hp: 2,
                    maxHp: 2,
                    damage: 1,
                    bossId: 'trap_warden' as const
                }
            ]
        };
        const run: RunState = {
            ...createRun([matchedA, matchedB, exit]),
            board,
            relicIds: ['chapter_compass'],
            dungeonKeys: {},
            dungeonMasterKeys: 0,
            status: 'playing'
        };

        expect(getDungeonExitStatus(run)).toMatchObject({
            lockKind: 'none',
            terminalKeySoftlockFallback: true,
            canActivate: true,
            lockedReason: null
        });

        const cleared = activateDungeonExit(run, 'none');

        expect(cleared.status).toBe('levelComplete');
        expect(cleared.board!.dungeonExitActivated).toBe(true);
        expect(cleared.board!.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
        expect(cleared.lastLevelResult?.bossTrophyCacheOutcome).toBe('claimed');
        expect(cleared.lastLevelResult?.bossTrophyCacheScore).toBe(120);
        expect(cleared.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'dungeon.exit_activate', spend: 'none' })
        ]);
        expect(cleared.gameplayCommandJournal?.map((command) => command.type)).not.toContain('effects.apply');
        expect(cleared.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'dungeon.exit_activated', commandId: expect.any(String) }),
            expect.objectContaining({ type: 'score.requested', reason: 'boss_trophy', amount: 30 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.chapter_compass.boss_trophy' })
        ]));
    });

    it('selects the next route by matching a gateway pair on the board', () => {
        const tiles: Tile[] = [
            {
                ...createTile('g1', 'G', 'G'),
                label: 'Greed Gateway',
                dungeonCardKind: 'gateway',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'gateway_greed',
                dungeonRouteType: 'greed'
            },
            {
                ...createTile('g2', 'G', 'G'),
                label: 'Greed Gateway',
                dungeonCardKind: 'gateway',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'gateway_greed',
                dungeonRouteType: 'greed'
            }
        ];
        const resolved = resolveBoardTurn(flipTile(flipTile(createRun(tiles), 'g1'), 'g2'));

        expect(resolved.pendingRouteCardPlan?.routeType).toBe('greed');
        expect(resolved.dungeonGatewaysUsed).toBe(1);
    });

    it('springs trap cards immediately when revealed', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const run = createRun(tiles);
        const afterReveal = flipTile(run, 't1');

        expect(afterReveal.dungeonTrapsTriggered).toBe(1);
        expect(afterReveal.lives).toBe(run.lives - 1);
        expect(
            afterReveal.board!.tiles
                .filter((tile) => tile.pairKey === 'T')
                .every((tile) => tile.dungeonCardState === 'resolved' && tile.state === 'flipped')
        ).toBe(true);
        expect(afterReveal.board!.tiles.find((tile) => tile.id === 't1')!.state).toBe('flipped');
    });

    it('keeps sprung traps permanently face-up without making them a second-card selection', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const run = createRun(tiles);
        const afterTrapReveal = flipTile(run, 't1');

        expect(afterTrapReveal.dungeonTrapsTriggered).toBe(1);
        expect(
            afterTrapReveal.board!.tiles
                .filter((tile) => tile.pairKey === 'T')
                .every((tile) => tile.dungeonCardState === 'resolved' && tile.state === 'flipped')
        ).toBe(true);

        const selectedFirstTrap = flipTile(afterTrapReveal, 't1');
        expect(selectedFirstTrap).toBe(afterTrapReveal);

        const selectedSupport = flipTile(afterTrapReveal, 'a1');
        expect(selectedSupport.board!.flippedTileIds).toEqual(['a1']);
        expect(selectedSupport.board!.tiles.filter((tile) => tile.pairKey === 'T').every(isSprungTrapForTest)).toBe(true);
        expect(isBoardComplete(selectedSupport.board!)).toBe(false);
    });

    it('does not pay a disarm reward or require a trap pair match after springing', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const run = createRun(tiles);
        const afterReveal = flipTile(run, 't1');
        const trapClick = flipTile(afterReveal, 't1');

        expect(trapClick).toBe(afterReveal);
        expect(afterReveal.dungeonTrapsTriggered).toBe(1);
        expect(afterReveal.lives).toBe(run.lives - 1);
        expect(afterReveal.shopGold).toBe(run.shopGold);
        expect(afterReveal.stats.totalScore).toBeGreaterThanOrEqual(run.stats.totalScore);
        expect(
            afterReveal.board!.tiles.filter((tile) => tile.pairKey === 'T').every(isSprungTrapForTest)
        ).toBe(true);
    });

    it('does not spring already-resolved trap cards again on mismatches', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const run = createRun(tiles);
        const afterTrapReveal = flipTile(run, 't1');
        const resolvedMiss = resolveBoardTurn(flipTile(afterTrapReveal, 'a1'));

        expect(afterTrapReveal.dungeonTrapsTriggered).toBe(1);
        expect(resolvedMiss.dungeonTrapsTriggered).toBe(1);
        expect(resolvedMiss.lives).toBeLessThan(run.lives);
        expect(
            resolvedMiss.board!.tiles
                .filter((tile) => tile.pairKey === 'T')
                .every((tile) => tile.dungeonCardState === 'resolved' && tile.state === 'flipped')
        ).toBe(true);
        expect(getDungeonThreatStatus(resolvedMiss.board)).toMatchObject({
            trapCardPairCount: 1,
            armedTrapCardPairCount: 0,
            resolvedTrapCardPairCount: 1,
            movingEnemyHazardCount: 0,
            trapVocabulary: 'trap_card',
            movingHazardVocabulary: 'moving_enemy_hazard'
        });
        expect(inspectBoardFairness(resolvedMiss.board!).issues).toEqual([]);
    });

    it('keeps sprung traps face-up through undo and gambit failures', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const run = { ...createRun(tiles), undoUsesThisFloor: 1, gambitAvailableThisFloor: true };
        const resolving = flipTile(flipTile(run, 't1'), 'a1');
        const undone = cancelResolvingWithUndo(resolving);
        const trapTilesAfterUndo = undone.board!.tiles.filter((tile) => tile.pairKey === 'T');

        expect(trapTilesAfterUndo.every((tile) => tile.dungeonCardState === 'resolved' && tile.state === 'flipped')).toBe(true);

        const selectedTrap = flipTile(undone, 't1');
        expect(selectedTrap).toBe(undone);

        const selectedMismatch = flipTile(undone, 'a2');
        const gambitFail = resolveBoardTurn(flipTile(selectedMismatch, 'b1'));
        const trapTilesAfterGambit = gambitFail.board!.tiles.filter((tile) => tile.pairKey === 'T');

        expect(trapTilesAfterGambit.every((tile) => tile.dungeonCardState === 'resolved' && tile.state === 'flipped')).toBe(true);
    });

    it('separates trap card status from moving enemy hazards', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Alarm Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'revealed',
                dungeonCardEffectId: 'trap_alarm'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Alarm Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'revealed',
                dungeonCardEffectId: 'trap_alarm'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const run = createRun(tiles);
        const board: BoardState = {
            ...run.board!,
            enemyHazards: [
                {
                    id: 'hazard-1',
                    kind: 'sentinel',
                    label: 'Patrol',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    pattern: 'patrol',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ]
        };

        expect(getDungeonThreatStatus(board)).toMatchObject({
            trapCardPairCount: 1,
            armedTrapCardPairCount: 1,
            resolvedTrapCardPairCount: 0,
            movingEnemyHazardCount: 1,
            revealedMovingEnemyHazardCount: 1
        });
        expect(getDungeonBoardStatus({ ...run, board }).threatStatus).toMatchObject({
            armedTrapCardPairCount: 1,
            movingEnemyHazardCount: 1
        });
    });

    it('handles mimic and alarm traps with distinct mismatch outcomes', () => {
        const mimicTiles: Tile[] = [
            {
                ...createTile('m1', 'M', '!'),
                label: 'Mimic Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_mimic'
            },
            {
                ...createTile('m2', 'M', '!'),
                label: 'Mimic Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_mimic'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const baseMimicRun = createRun(mimicTiles);
        const mimicRun = { ...baseMimicRun, shopGold: 2, stats: { ...baseMimicRun.stats, tries: 1 } };
        const mimicMiss = flipTile(mimicRun, 'm1');

        expect(mimicMiss.dungeonTrapsTriggered).toBe(1);
        expect(mimicMiss.lives).toBeLessThan(mimicRun.lives);
        expect(mimicMiss.shopGold).toBe(1);

        const alarmTiles: Tile[] = [
            {
                ...createTile('x1', 'X', '!'),
                label: 'Alarm Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_alarm'
            },
            {
                ...createTile('x2', 'X', '!'),
                label: 'Alarm Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_alarm'
            },
            {
                ...createTile('e1', 'E', 'E'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 1,
                dungeonCardMaxHp: 1
            },
            {
                ...createTile('e2', 'E', 'E'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 1,
                dungeonCardMaxHp: 1
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const baseAlarmRun = createRun(alarmTiles);
        const alarmRun = { ...baseAlarmRun, stats: { ...baseAlarmRun.stats, tries: 1 } };
        const alarmMiss = flipTile(alarmRun, 'x1');

        expect(alarmMiss.dungeonTrapsTriggered).toBe(1);
        expect(alarmMiss.lives).toBe(alarmRun.lives);
        expect(
            alarmMiss.board!.tiles
                .filter((tile) => tile.pairKey === 'E')
            .every((tile) => tile.dungeonCardState === 'revealed')
        ).toBe(true);
    });

    it('handles snare traps by spending guard before disabling free shuffles', () => {
        const snareTiles: Tile[] = [
            {
                ...createTile('s1', 'S', '!'),
                label: 'Snare Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_snare'
            },
            {
                ...createTile('s2', 'S', '!'),
                label: 'Snare Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_snare'
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const guardedBase = createRun(snareTiles);
        const guardedRun = {
            ...guardedBase,
            freeShuffleThisFloor: true,
            regionShuffleFreeThisFloor: true,
            stats: { ...guardedBase.stats, guardTokens: 1, tries: 0 }
        };
        const guardedMiss = flipTile(guardedRun, 's1');

        expect(guardedMiss.stats.guardTokens).toBe(0);
        expect(guardedMiss.freeShuffleThisFloor).toBe(true);
        expect(guardedMiss.regionShuffleFreeThisFloor).toBe(true);
        expect(getDungeonCardCopy({ ...snareTiles[0]!, dungeonCardState: 'revealed' })).toMatch(/free shuffles/i);

        const unguardedBase = createRun(snareTiles);
        const unguardedRun = {
            ...unguardedBase,
            freeShuffleThisFloor: true,
            regionShuffleFreeThisFloor: true,
            stats: { ...unguardedBase.stats, guardTokens: 0, tries: 0 }
        };
        const unguardedMiss = flipTile(unguardedRun, 's1');

        expect(unguardedMiss.lives).toBe(unguardedRun.lives);
        expect(unguardedMiss.freeShuffleThisFloor).toBe(false);
        expect(unguardedMiss.regionShuffleFreeThisFloor).toBe(false);
    });

    it('handles hex traps by cutting score and revealing one hidden hazard', () => {
        const tiles: Tile[] = [
            {
                ...createTile('h1', 'H', '!'),
                label: 'Hex Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_hex'
            },
            {
                ...createTile('h2', 'H', '!'),
                label: 'Hex Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_hex'
            },
            {
                ...createTile('e1', 'E', 's'),
                label: 'Stalker',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_stalker',
                dungeonCardHp: 2,
                dungeonCardMaxHp: 2
            },
            {
                ...createTile('e2', 'E', 's'),
                label: 'Stalker',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_stalker',
                dungeonCardHp: 2,
                dungeonCardMaxHp: 2
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const baseRun = createRun(tiles);
        const run = {
            ...baseRun,
            stats: { ...baseRun.stats, totalScore: 80, currentLevelScore: 80, tries: 1 }
        };
        const hexMiss = flipTile(run, 'h1');

        expect(hexMiss.stats.totalScore).toBeLessThan(run.stats.totalScore);
        expect(
            hexMiss.board!.tiles
                .filter((tile) => tile.pairKey === 'E')
                .every((tile) => tile.dungeonCardState === 'revealed')
        ).toBe(true);
        expect(hexMiss.lives).toBe(run.lives);
        expect(getDungeonCardCopy({ ...tiles[0]!, dungeonCardState: 'revealed' })).toMatch(/hidden hazard/i);
    });

    it('wakes stalkers when traps spring and attacks on a later mismatch', () => {
        const tiles: Tile[] = [
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('e1', 'E', 's'),
                label: 'Stalker',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_stalker',
                dungeonCardHp: 2,
                dungeonCardMaxHp: 2
            },
            {
                ...createTile('e2', 'E', 's'),
                label: 'Stalker',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_stalker',
                dungeonCardHp: 2,
                dungeonCardMaxHp: 2
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A'),
            createTile('b1', 'B', 'B'),
            createTile('b2', 'B', 'B')
        ];
        const run = { ...createRun(tiles), stats: { ...createRun(tiles).stats, tries: 1 } };
        const trapMiss = flipTile(run, 't1');

        expect(trapMiss.lives).toBe(run.lives - 1);
        expect(
            trapMiss.board!.tiles
                .filter((tile) => tile.pairKey === 'E')
                .every((tile) => tile.dungeonCardState === 'revealed')
        ).toBe(true);
        expect(getDungeonCardCopy(trapMiss.board!.tiles.find((tile) => tile.id === 'e1')!)).toMatch(/attacks on mismatches/i);

        const laterMiss = resolveBoardTurn(flipTile(flipTile(trapMiss, 'a2'), 'b1'));
        expect(laterMiss.lives).toBeLessThan(trapMiss.lives);
    });

    it('rewards treasure caches, rune seals, and depth gateways', () => {
        const tiles: Tile[] = [
            {
                ...createTile('c1', 'C', '$'),
                label: 'Treasure Cache',
                dungeonCardKind: 'treasure',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'treasure_cache'
            },
            {
                ...createTile('c2', 'C', '$'),
                label: 'Treasure Cache',
                dungeonCardKind: 'treasure',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'treasure_cache'
            },
            {
                ...createTile('t1', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'revealed',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('t2', 'T', '!'),
                label: 'Spike Trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'revealed',
                dungeonCardEffectId: 'trap_spikes'
            },
            {
                ...createTile('r1', 'R', 'R'),
                label: 'Rune Seal',
                dungeonCardKind: 'lever',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'rune_seal'
            },
            {
                ...createTile('r2', 'R', 'R'),
                label: 'Rune Seal',
                dungeonCardKind: 'lever',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'rune_seal'
            },
            {
                ...createTile('g1', 'G', '>'),
                label: 'Depth Gateway',
                dungeonCardKind: 'gateway',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'gateway_depth',
                dungeonRouteType: 'greed'
            },
            {
                ...createTile('g2', 'G', '>'),
                label: 'Depth Gateway',
                dungeonCardKind: 'gateway',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'gateway_depth',
                dungeonRouteType: 'greed'
            }
        ];

        const baseRun = createRun(tiles);
        const treasureRun = resolveBoardTurn(flipTile(flipTile(baseRun, 'c1'), 'c2'));
        expect(treasureRun.shopGold).toBeGreaterThan(baseRun.shopGold + 1);
        expect(treasureRun.dungeonTreasuresOpened).toBe(1);

        const runeRun = resolveBoardTurn(flipTile(flipTile(createRun(tiles), 'r1'), 'r2'));
        expect(
            runeRun.board!.tiles
                .filter((tile) => tile.pairKey === 'T')
                .every((tile) => tile.dungeonCardState === 'resolved')
        ).toBe(true);

        const gatewayRun = resolveBoardTurn(flipTile(flipTile(createRun(tiles), 'g1'), 'g2'));
        expect(gatewayRun.pendingRouteCardPlan?.routeType).toBe('greed');
        expect(gatewayRun.dungeonGatewaysUsed).toBe(1);
    });

    it('defines treasure tiers, gates, payouts, and claim conditions for reward sources', () => {
        const treasureTiles: Tile[] = [
            {
                ...createTile('gold', 'G', '$'),
                label: 'Treasure',
                dungeonCardKind: 'treasure',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'treasure_gold'
            },
            {
                ...createTile('cache', 'C', '$'),
                label: 'Treasure Cache',
                dungeonCardKind: 'treasure',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'treasure_cache'
            },
            {
                ...createTile('shard', 'S', '.'),
                label: 'Supply Cache',
                dungeonCardKind: 'treasure',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'treasure_shard'
            },
            {
                ...createTile('lock', 'L', 'L'),
                label: 'Locked Cache',
                dungeonCardKind: 'lock',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'lock_cache'
            },
            {
                ...createTile('room-cache', ROOM_PAIR_KEY, 'R'),
                label: 'Locked Cache Room',
                dungeonCardKind: 'room',
                dungeonCardState: 'revealed',
                dungeonCardEffectId: 'room_locked_cache'
            },
            {
                ...createTile('secret', 'secret', '?'),
                label: 'Secret Door',
                routeSpecialKind: 'secret_door',
                routeSpecialRevealed: true
            }
        ];

        expect(Object.keys(DUNGEON_TREASURE_REWARD_DEFINITIONS).sort()).toEqual(
            ['treasure_gold', 'treasure_cache', 'treasure_shard', 'lock_cache', 'room_locked_cache', 'secret_door'].sort()
        );
        for (const tile of treasureTiles) {
            const read = getDungeonTreasureReadModel(tile)!;
            expect(read.label.length).toBeGreaterThan(0);
            expect(read.gateText.length).toBeGreaterThan(0);
            expect(read.payoutText.length).toBeGreaterThan(0);
            expect(read.claimCondition.length).toBeGreaterThan(0);
            expect(['minor', 'standard', 'cache', 'secret']).toContain(read.tier);
        }
        expect(getDungeonTreasureReadModel(treasureTiles[5]!)!).toMatchObject({
            rewardId: 'secret_door',
            source: 'route_special',
            tier: 'secret'
        });
        expect(getDungeonCardCopy(treasureTiles[1]!)).toMatch(/increased shop gold/i);
        expect(getDungeonCardCopy(treasureTiles[3]!)).toMatch(/key/i);
    });

    it('spends the matching run key when a typed locked cache pair is claimed', () => {
        const lockTiles: Tile[] = [
            {
                ...createTile('lock-a', 'L', 'L'),
                label: 'Treasure Lock',
                dungeonCardKind: 'lock',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'lock_cache',
                dungeonKeyKind: 'treasure'
            },
            {
                ...createTile('lock-b', 'L', 'L'),
                label: 'Treasure Lock',
                dungeonCardKind: 'lock',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'lock_cache',
                dungeonKeyKind: 'treasure'
            }
        ];
        const run = {
            ...createRun(lockTiles),
            dungeonKeys: { iron: 1, treasure: 1 }
        };

        const claimed = resolveBoardTurn(flipTile(flipTile(run, 'lock-a'), 'lock-b'));

        expect(claimed.dungeonKeys).toEqual({ iron: 1, treasure: 0 });
        expect(claimed.dungeonTreasuresOpened).toBe(1);

        const masterRun = {
            ...createRun(lockTiles),
            dungeonKeys: { iron: 1 },
            dungeonMasterKeys: 1
        };
        const masterClaimed = resolveBoardTurn(flipTile(flipTile(masterRun, 'lock-a'), 'lock-b'));
        expect(masterClaimed.dungeonKeys).toEqual({ iron: 1 });
        expect(masterClaimed.dungeonMasterKeys).toBe(0);
        expect(masterClaimed.dungeonTreasuresOpened).toBe(1);
    });

    it('runs new singleton room cards and lets locked caches be reopened after finding keys', () => {
        const roomTile = (id: string, effectId: NonNullable<Tile['dungeonCardEffectId']>, label: string): Tile => ({
            ...createTile(id, ROOM_PAIR_KEY, label.charAt(0)),
            label,
            dungeonCardKind: 'room',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: effectId,
            dungeonRoomUsed: false
        });
        const shrineRun = revealDungeonRoom({ ...createRun([roomTile('shrine', 'room_shrine', 'Shrine')]), shopGold: 1 }, 'shrine');
        expect(shrineRun.shopGold).toBe(0);
        expect(shrineRun.stats.guardTokens).toBe(1);

        const armoryRun = revealDungeonRoom(
            { ...createRun([roomTile('armory', 'room_armory', 'Armory')]), destroyPairCharges: 0 },
            'armory'
        );
        expect(armoryRun.destroyPairCharges).toBe(1);

        const scryTiles: Tile[] = [
            roomTile('lens', 'room_scrying_lens', 'Scrying Lens'),
            {
                ...createTile('e1', 'E', 'E'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry'
            },
            {
                ...createTile('e2', 'E', 'E'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry'
            }
        ];
        const scried = revealDungeonRoom(createRun(scryTiles), 'lens');
        expect(
            scried.board!.tiles
                .filter((tile) => tile.pairKey === 'E')
                .every((tile) => tile.dungeonCardState === 'revealed')
        ).toBe(true);

        const lockedCache = roomTile('cache', 'room_locked_cache', 'Locked Cache');
        const unpaid = revealDungeonRoom(createRun([lockedCache]), 'cache');
        expect(unpaid.board!.tiles.find((tile) => tile.id === 'cache')!.dungeonCardState).toBe('revealed');
        expect(unpaid.board!.tiles.find((tile) => tile.id === 'cache')!.dungeonRoomUsed).toBe(false);

        const paid = revealDungeonRoom({ ...unpaid, dungeonKeys: { iron: 1 } }, 'cache');
        expect(paid.dungeonKeys.iron).toBe(0);
        expect(paid.shopGold).toBe(4);
        expect(paid.board!.tiles.find((tile) => tile.id === 'cache')!.dungeonRoomUsed).toBe(true);
    });

    it('runs expanded dungeon rooms for keys, traps, and omen reveals', () => {
        const roomTile = (id: string, effectId: NonNullable<Tile['dungeonCardEffectId']>, label: string): Tile => ({
            ...createTile(id, ROOM_PAIR_KEY, label.charAt(0)),
            label,
            dungeonCardKind: 'room',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: effectId,
            dungeonRoomUsed: false
        });
        const trapA = {
            ...createTile('trap-a', 'T', '!'),
            label: 'Spike Trap',
            dungeonCardKind: 'trap' as const,
            dungeonCardState: 'revealed' as const,
            dungeonCardEffectId: 'trap_spikes' as const
        };
        const trapB = { ...trapA, id: 'trap-b' };
        const hiddenEnemyA = {
            ...createTile('enemy-a', 'E', 'E'),
            label: 'Sentry',
            dungeonCardKind: 'enemy' as const,
            dungeonCardState: 'hidden' as const,
            dungeonCardEffectId: 'enemy_sentry' as const
        };
        const hiddenEnemyB = { ...hiddenEnemyA, id: 'enemy-b' };

        const keyRun = revealDungeonRoom(createRun([roomTile('key-room', 'room_key_cache', 'Key Cache')]), 'key-room');
        expect(keyRun.dungeonKeys.iron).toBe(1);
        expect(keyRun.stats.totalScore).toBeGreaterThan(0);
        expect(keyRun.board!.tiles.find((tile) => tile.id === 'key-room')!.dungeonRoomUsed).toBe(true);

        const workshopRun = revealDungeonRoom(
            createRun([roomTile('workshop', 'room_trap_workshop', 'Trap Workshop'), trapA, trapB]),
            'workshop'
        );
        expect(
            workshopRun.board!.tiles
                .filter((tile) => tile.pairKey === 'T')
                .every((tile) => tile.dungeonCardState === 'resolved')
        ).toBe(true);

        const hiddenTrapA = { ...trapA, id: 'hidden-trap-a', dungeonCardState: 'hidden' as const };
        const hiddenTrapB = { ...hiddenTrapA, id: 'hidden-trap-b' };
        const scoutWorkshopRun = revealDungeonRoom(
            createRun([roomTile('scout-workshop', 'room_trap_workshop', 'Trap Workshop'), hiddenTrapA, hiddenTrapB]),
            'scout-workshop'
        );
        expect(
            scoutWorkshopRun.board!.tiles
                .filter((tile) => tile.pairKey === 'T')
                .every((tile) => tile.dungeonCardState === 'revealed')
        ).toBe(true);

        const archiveRun = revealDungeonRoom(
            createRun([roomTile('archive', 'room_omen_archive', 'Omen Archive'), hiddenEnemyA, hiddenEnemyB]),
            'archive'
        );
        expect(archiveRun.relicFavorProgress).toBe(1);
        expect(
            archiveRun.board!.tiles
                .filter((tile) => tile.pairKey === 'E')
                .every((tile) => tile.dungeonCardState === 'revealed')
        ).toBe(true);
        expect(getDungeonCardCopy(roomTile('archive-copy', 'room_omen_archive', 'Omen Archive'))).toMatch(/Favor/i);
    });

    it('lets awake enemies attack on mismatches', () => {
        const tiles: Tile[] = [
            {
                ...createTile('e1', 'E', 'E'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 1,
                dungeonCardMaxHp: 1
            },
            {
                ...createTile('e2', 'E', 'E'),
                label: 'Sentry',
                dungeonCardKind: 'enemy',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'enemy_sentry',
                dungeonCardHp: 1,
                dungeonCardMaxHp: 1
            },
            createTile('a1', 'A', 'A'),
            createTile('a2', 'A', 'A')
        ];
        const run = createRun(tiles);
        const afterEnemyReveal = flipTile(run, 'e1');
        const resolvedMiss = resolveBoardTurn(flipTile(afterEnemyReveal, 'a1'));

        expect(resolvedMiss.board!.tiles.find((tile) => tile.id === 'e1')!.dungeonCardState).toBe('revealed');
        expect(resolvedMiss.lives).toBe(run.lives - 1);
    });
});

describe('REG-015 run shop wallet', () => {
    it('earns temporary shop gold on floor clear and can buy one-shot services', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 15_001 }), 1);
        const shopRun = { ...cleared, shopOffers: createRunShopOffers(cleared) };

        expect(cleared.shopGold).toBeGreaterThanOrEqual(FLOOR_CLEAR_GOLD_BASE);
        expect(cleared.shopOffers).toEqual([]);
        expect(shopRun.shopOffers.map((offer) => offer.itemId).sort()).toEqual([
            'destroy_charge',
            'heal_life',
            'iron_key',
            'peek_charge',
            'region_shuffle_charge',
            'trait_cleanse'
        ]);

        const peekOffer = shopRun.shopOffers.find((offer) => offer.itemId === 'peek_charge')!;
        const boughtPeek = purchaseShopOffer(shopRun, peekOffer.id);
        expect(boughtPeek.peekCharges).toBe(shopRun.peekCharges + 1);
        expect(boughtPeek.shopGold).toBe(shopRun.shopGold - peekOffer.cost);
        expect(boughtPeek.shopOffers.find((offer) => offer.id === peekOffer.id)?.purchased).toBe(true);

        const rebuy = purchaseShopOffer(boughtPeek, peekOffer.id);
        expect(rebuy).toBe(boughtPeek);

        const rerolled = rerollShopOffers({ ...shopRun, shopGold: 6 });
        expect(rerolled.shopRerolls).toBe(1);
        expect(rerolled.shopGold).toBeLessThan(6);
        expect(rerolled.shopOffers.map((offer) => offer.id)).not.toEqual(shopRun.shopOffers.map((offer) => offer.id));
        expect(rerollShopOffers(rerolled)).toBe(rerolled);

        const broke = purchaseShopOffer({ ...shopRun, shopGold: 0 }, shopRun.shopOffers[1]!.id);
        expect(broke.shopGold).toBe(0);
        expect(broke.shopOffers[1]!.purchased).toBe(false);
    });

    it('REG-070 rerolls shop stock once with deterministic pricing', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 70_001 }), 1);
        const shopRun = { ...cleared, shopOffers: createRunShopOffers(cleared) };
        const idsBefore = shopRun.shopOffers.map((offer) => offer.id);
        const rerolled = rerollShopOffers(shopRun);

        expect(rerolled.shopRerolls).toBe(1);
        expect(rerolled.shopGold).toBe(shopRun.shopGold - 1);
        expect(rerolled.shopOffers.map((offer) => offer.id)).not.toEqual(idsBefore);
        expect(rerollShopOffers(rerolled)).toBe(rerolled);
        expect(canRerollShopOffers({ ...shopRun, shopGold: 0 })).toBe(false);
    });

    it('REG-071 exposes item catalog compatibility and uncapped destroy charges', () => {
        const fullLifeBase = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 71_001 }), 1);
        const fullLife = {
            ...fullLifeBase,
            lives: MAX_LIVES,
            shopOffers: createRunShopOffers({ ...fullLifeBase, lives: MAX_LIVES })
        };
        const heal = fullLife.shopOffers.find((offer) => offer.itemId === 'heal_life')!;
        expect(heal.compatible).toBe(false);
        expect(heal.unavailableReason).toBe('Life already full.');

        const damaged = { ...fullLife, lives: 3 };
        const healAvailable = createRunShopOffers(damaged).find((offer) => offer.itemId === 'heal_life')!;
        expect(healAvailable.compatible).toBe(true);
        expect(purchaseShopOffer({ ...damaged, shopOffers: [healAvailable], shopGold: 99 }, healAvailable.id).lives).toBe(4);

        const stockedDestroy = { ...fullLife, destroyPairCharges: 7 };
        const destroyOffer = createRunShopOffers(stockedDestroy).find((offer) => offer.itemId === 'destroy_charge')!;
        expect(destroyOffer.compatible).toBe(true);
        expect(destroyOffer.unavailableReason).toBeNull();
        expect(destroyOffer.stackLimit).toBeNull();
        expect(purchaseShopOffer({ ...stockedDestroy, shopOffers: [destroyOffer], shopGold: 99 }, destroyOffer.id).destroyPairCharges).toBe(8);

        const noDestroyRun = {
            ...stockedDestroy,
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
        };
        const lockedDestroy = createRunShopOffers(noDestroyRun).find((offer) => offer.itemId === 'destroy_charge')!;
        expect(lockedDestroy.compatible).toBe(false);
        expect(lockedDestroy.unavailableReason).toBe('No-destroy contract locks this item.');
        expect(purchaseShopOffer({ ...noDestroyRun, shopOffers: [destroyOffer], shopGold: 99 }, destroyOffer.id).destroyPairCharges).toBe(
            stockedDestroy.destroyPairCharges
        );
    });

    it('sells run-local dungeon keys', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 71_101 }), 1);
        const shopRun = { ...cleared, shopOffers: createRunShopOffers(cleared) };
        const keyOffer = shopRun.shopOffers.find((offer) => offer.itemId === 'iron_key')!;
        const boughtKey = purchaseShopOffer({ ...shopRun, shopGold: 99 }, keyOffer.id);

        expect(boughtKey.dungeonKeys.iron).toBe(1);
        expect(boughtKey.shopOffers.find((offer) => offer.id === keyOffer.id)?.purchased).toBe(true);
    });

    it('REG-072 exposes wallet pacing and sink totals for QA', () => {
        const cleared = playPerfectFloors(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 72_001 }), 2);
        const pacing = getShopWalletPacing(cleared);

        expect(pacing.earnedThisFloor).toBe(FLOOR_CLEAR_GOLD_BASE + 1);
        expect(pacing.totalWallet).toBe(cleared.shopGold);
        expect(pacing.sinkCostTotal).toBe(cleared.shopOffers.reduce((sum, offer) => sum + offer.cost, 0));
        expect(pacing.conversionAtRunEnd).toBe('unspent_shop_gold_expires');
    });
});

describe('endless chapters and featured objectives', () => {
    it('awards only the featured objective bonus on endless floors', () => {
        const started = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const [firstPair, secondPair] = pairTileIds(started.board!);

        const afterFirstMatch = resolveBoardTurn(flipTile(flipTile(started, firstPair![0]!), firstPair![1]!));
        const finished = leaveThroughExit(
            resolveBoardTurn(flipTile(flipTile(afterFirstMatch, secondPair![0]!), secondPair![1]!))
        );

        expect(finished.status).toBe('levelComplete');
        expect(finished.lastLevelResult?.featuredObjectiveId).toBe('flip_par');
        expect(finished.lastLevelResult?.featuredObjectiveCompleted).toBe(true);
        expect(finished.lastLevelResult?.objectiveBonusScore).toBe(FLIP_PAR_BONUS_SCORE);
        expect(finished.lastLevelResult?.bonusTags).toContain('flip_par');
        expect(finished.lastLevelResult?.bonusTags).not.toContain('scholar_style');
        expect(finished.lastLevelResult?.bonusTags).not.toContain('cursed_last');
    });

    it('banks an extra relic pick when favor reaches three', () => {
        const started = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const [firstPair, secondPair] = pairTileIds(started.board!);
        const primed = {
            ...started,
            relicFavorProgress: 2
        };

        const afterFirstMatch = resolveBoardTurn(flipTile(flipTile(primed, firstPair![0]!), firstPair![1]!));
        const finished = leaveThroughExit(
            resolveBoardTurn(flipTile(flipTile(afterFirstMatch, secondPair![0]!), secondPair![1]!))
        );

        expect(finished.status).toBe('levelComplete');
        expect(finished.lastLevelResult?.relicFavorGained).toBe(1);
        expect(finished.relicFavorProgress).toBe(0);
        expect(finished.bonusRelicPicksNextOffer).toBe(1);
        expect(finished.favorBonusRelicPicksNextOffer).toBe(1);
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
            matchResolutionsThisFloor: 99
        };

        const finished = clearRealPairs(primed);

        expect(finished.status).toBe('levelComplete');
        expect(finished.lastLevelResult?.featuredObjectiveCompleted).toBe(false);
        expect(finished.featuredObjectiveStreak).toBe(1);
        expect(finished.lastLevelResult?.featuredObjectiveStreak).toBe(1);
        expect(finished.lastLevelResult?.featuredObjectiveStreakBonus).toBeUndefined();
    });

    it('offers and accepts an endless risk wager after a completed streak of two', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const cleared: RunState = {
            ...base,
            status: 'levelComplete',
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S++',
                livesRemaining: base.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
                relicFavorGained: 1
            }
        };

        expect(canOfferEndlessRiskWager(cleared)).toBe(true);
        const accepted = acceptEndlessRiskWager(cleared);
        expect(accepted.endlessRiskWager).toEqual({
            acceptedOnLevel: 1,
            targetLevel: 2,
            streakAtRisk: ENDLESS_RISK_WAGER_MIN_STREAK,
            bonusFavorOnSuccess: ENDLESS_RISK_WAGER_BONUS_FAVOR
        });
        expect(canOfferEndlessRiskWager(accepted)).toBe(false);
    });

    it('does not offer risk wagers outside scheduled endless runs', () => {
        const daily = createDailyRun(0, { echoFeedbackEnabled: false });
        const clearedDaily: RunState = {
            ...daily,
            status: 'levelComplete',
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S++',
                livesRemaining: daily.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
                relicFavorGained: 1
            }
        };

        expect(canOfferEndlessRiskWager(clearedDaily)).toBe(false);
        expect(acceptEndlessRiskWager(clearedDaily)).toBe(clearedDaily);
    });

    it('keeps an accepted risk wager through relic offer flow', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const clearedMilestone: RunState = {
            ...base,
            status: 'levelComplete',
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 3,
                scoreGained: 100,
                rating: 'S++',
                livesRemaining: base.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'scholar_style',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
                relicFavorGained: 1
            }
        };

        const accepted = acceptEndlessRiskWager(clearedMilestone);
        const offerRun = openRelicOffer(accepted);

        expect(offerRun.relicOffer).not.toBeNull();
        expect(offerRun.endlessRiskWager?.targetLevel).toBe(4);
    });

    it('wins a risk wager by completing the next featured objective and converts bonus favor', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const cleared: RunState = {
            ...base,
            status: 'levelComplete',
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S++',
                livesRemaining: base.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
                relicFavorGained: 1
            }
        };
        const wagered = acceptEndlessRiskWager(cleared);
        const next = withoutTileTraits(finishMemorizePhase(advanceToNextLevel(wagered)));

        const finished = clearRealPairs(next);

        expect(finished.status).toBe('levelComplete');
        expect(finished.endlessRiskWager).toBeNull();
        expect(finished.lastLevelResult?.endlessRiskWagerOutcome).toBe('won');
        expect(finished.lastLevelResult?.endlessRiskWagerFavorGained).toBe(ENDLESS_RISK_WAGER_BONUS_FAVOR);
        expect(finished.lastLevelResult?.relicFavorGained).toBe(1 + ENDLESS_RISK_WAGER_BONUS_FAVOR);
        expect(finished.bonusRelicPicksNextOffer).toBe(1);
        expect(finished.favorBonusRelicPicksNextOffer).toBe(1);
        expect(finished.relicFavorProgress).toBe(0);
    });

    it('wager_surety adds favor on won wagers and leaves x1 streak on wager failure', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, initialRelicIds: ['wager_surety'] });
        const cleared: RunState = {
            ...base,
            status: 'levelComplete',
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S++',
                livesRemaining: base.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
                relicFavorGained: 1
            }
        };
        const wagered = acceptEndlessRiskWager(cleared);
        const won = clearRealPairs(finishMemorizePhase(advanceToNextLevel(wagered)));
        const lostStart: RunState = {
            ...finishMemorizePhase(advanceToNextLevel(wagered)),
            matchResolutionsThisFloor: 99
        };
        const lost = clearRealPairs(lostStart);

        expect(won.lastLevelResult?.endlessRiskWagerOutcome).toBe('won');
        expect(won.lastLevelResult?.endlessRiskWagerFavorGained).toBe(ENDLESS_RISK_WAGER_BONUS_FAVOR + 1);
        expect(won.lastLevelResult?.relicFavorGained).toBe(1 + ENDLESS_RISK_WAGER_BONUS_FAVOR + 1);
        expect(won.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'relic_favor.requested', reason: 'risk_wager_win', amount: 1 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.wager_surety.wager_won' })
        ]));
        expect(lost.lastLevelResult?.endlessRiskWagerOutcome).toBe('lost');
        expect(lost.featuredObjectiveStreak).toBe(1);
        expect(lost.lastLevelResult?.endlessRiskWagerStreakLost).toBe(ENDLESS_RISK_WAGER_MIN_STREAK - 1);
        expect(lost.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'featured_streak_floor.requested', reason: 'risk_wager_loss', amount: 1 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.wager_surety.wager_lost' })
        ]));
    });

    it('loses a risk wager by missing the next featured objective and resets the streak', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const cleared: RunState = {
            ...base,
            status: 'levelComplete',
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S++',
                livesRemaining: base.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
                relicFavorGained: 1
            }
        };
        const wagered = acceptEndlessRiskWager(cleared);
        const next: RunState = {
            ...finishMemorizePhase(advanceToNextLevel(wagered)),
            matchResolutionsThisFloor: 99
        };

        const finished = clearRealPairs(next);

        expect(finished.status).toBe('levelComplete');
        expect(finished.endlessRiskWager).toBeNull();
        expect(finished.featuredObjectiveStreak).toBe(0);
        expect(finished.lastLevelResult?.featuredObjectiveCompleted).toBe(false);
        expect(finished.lastLevelResult?.endlessRiskWagerOutcome).toBe('lost');
        expect(finished.lastLevelResult?.endlessRiskWagerStreakLost).toBe(ENDLESS_RISK_WAGER_MIN_STREAK);
        expect(finished.lastLevelResult?.endlessRiskWagerFavorGained).toBeUndefined();
        expect(finished.lastLevelResult?.relicFavorGained).toBe(0);
    });

    it('parasite_ledger reduces parasite progress only on featured-objective success', () => {
        const base = finishMemorizePhase(
            createNewRun(0, { echoFeedbackEnabled: false, initialRelicIds: ['parasite_ledger'] })
        );
        const board: BoardState = {
            level: 11,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles: [
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ],
            flippedTileIds: [],
            matchedPairs: 0,
            floorTag: 'normal',
            cursedPairKey: null,
            wardPairKey: null,
            bountyPairKey: null,
            floorArchetypeId: 'parasite_tithe',
            featuredObjectiveId: 'scholar_style'
        };
        const parasiteRun: RunState = {
            ...base,
            board,
            activeMutators: ['score_parasite'],
            parasiteFloors: 3
        };
        const success = clearRealPairs(parasiteRun);
        const missed = clearRealPairs({
            ...parasiteRun,
            shuffleUsedThisFloor: true
        });

        expect(success.lastLevelResult?.featuredObjectiveCompleted).toBe(true);
        expect(success.parasiteFloors).toBe(2);
        expect(success.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'parasite_relief.requested', reason: 'featured_objective_clear', amount: 1 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.parasite_ledger.objective_clear' })
        ]));
        expect(missed.lastLevelResult?.featuredObjectiveCompleted).toBe(false);
        expect(missed.parasiteFloors).toBe(3);
        expect(missed.gameplayEventJournal).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'parasite_relief.requested' })
        ]));
    });

    it('grants +2 favor on boss floors when the featured objective succeeds', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const board: BoardState = {
            level: 7,
            pairCount: 2,
            columns: 2,
            rows: 3,
            tiles: [
                createTile('a1', 'A', 'A'),
                createTile('a2', 'A', 'A'),
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B'),
                createTile('decoy', DECOY_PAIR_KEY, 'X')
            ],
            flippedTileIds: [],
            matchedPairs: 0,
            floorTag: 'boss',
            cursedPairKey: null,
            wardPairKey: null,
            bountyPairKey: null,
            floorArchetypeId: 'trap_hall',
            featuredObjectiveId: 'glass_witness'
        };
        const bossRun: RunState = {
            ...run,
            board,
            activeMutators: ['glass_floor', 'sticky_fingers'],
            glassDecoyActiveThisFloor: true
        };

        const afterFirstMatch = resolveBoardTurn(flipTile(flipTile(bossRun, 'a1'), 'a2'));
        const finished = resolveBoardTurn(flipTile(flipTile(afterFirstMatch, 'b1'), 'b2'));

        expect(finished.status).toBe('levelComplete');
        expect(finished.lastLevelResult?.featuredObjectiveId).toBe('glass_witness');
        expect(finished.lastLevelResult?.featuredObjectiveCompleted).toBe(true);
        expect(finished.lastLevelResult?.relicFavorGained).toBe(2);
        expect(finished.relicFavorProgress).toBe(2);
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

        expect(board.level).toBe(4);
        expect(board.pairCount).toBe(5);
        expect(board.tiles).toHaveLength(10);
        expect(board.columns).toBeGreaterThanOrEqual(2);
        expect(getMemorizeDuration(1)).toBe(1300);
        expect(getMemorizeDuration(2)).toBe(1300);
        expect(getMemorizeDuration(3)).toBe(1250);
        expect(getMemorizeDuration(20)).toBe(850);
        expect(getMemorizeDuration(29)).toBe(600);
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
            gameMode: 'meditation' as const,
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
        expect(nextRun.pendingMemorizeBonusMs).toBe(0);
        expect(nextRun.timerState.memorizeRemainingMs).toBe(
            getMemorizeDurationForRun({ ...finishedLevel, activeMutators: nextRun.activeMutators }, nextRun.board!.level) +
                bankedMs
        );
    });

    it('carries the current life total into the next level instead of resetting it', () => {
        const started = createRun([createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')]);
        const finishedLevel = resolveBoardTurn(flipTile(flipTile({ ...started, lives: 2 }, 'a1'), 'a2'));

        expect(finishedLevel.status).toBe('levelComplete');
        expect(finishedLevel.lives).toBe(3);

        const nextRun = advanceToNextLevel({ ...finishedLevel, gameMode: 'meditation' });

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

    it('awards immediate match score and perfect clear bonuses on a flawless level', () => {
        const tiles: Tile[] = [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A')];
        const started = createRun(tiles);
        const flippedOnce = flipTile(started, 'a1');
        const flippedTwice = flipTile(flippedOnce, 'a2');
        const resolved = resolveBoardTurn(flippedTwice);

        expect(resolved.status).toBe('levelComplete');
        expect(resolved.lives).toBe(5);
        expect(resolved.stats.totalScore).toBe(155);
        expect(resolved.stats.currentLevelScore).toBe(155);
        expect(resolved.stats.bestStreak).toBe(1);
        expect(resolved.stats.perfectClears).toBe(1);
        expect(resolved.lastLevelResult?.perfect).toBe(true);
        expect(resolved.lastLevelResult?.mistakes).toBe(0);
        expect(resolved.lastLevelResult?.clearLifeReason).toBe('perfect');
        expect(resolved.lastLevelResult?.clearLifeGained).toBe(1);
        expect(resolved.gameplayCommandJournal?.map((command) => command.type)).toEqual([
            'board.tile_flip',
            'board.tile_flip',
            'board.turn_resolve'
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
            shopGold: Number.NaN,
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
        expect(resolved.shopGold).toBe(getShopGoldRewardForFloor(1));
        expect(resolved.stats.totalScore).toBe(155);
        expect(resolved.stats.currentLevelScore).toBe(155);
        expect(resolved.stats.bestScore).toBe(155);
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
        expect(secondMatch.stats.totalScore).toBe(240);
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
        expect(resolved.stats.totalScore).toBe(215);
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
            ...createNewRun(250, { gameMode: 'meditation' }),
            status: 'levelComplete' as const,
            stats: {
                ...createNewRun(250, { gameMode: 'meditation' }).stats,
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
        expect(nextRun.stats.guardTokens).toBe(2);
        expect(nextRun.stats.comboShards).toBe(2);
        expect(nextRun.stats.totalScore).toBe(300);
        expect(nextRun.timerState.memorizeRemainingMs).toBe(
            getMemorizeDurationForRun({ ...finishedLevel, activeMutators: nextRun.activeMutators }, nextRun.board!.level)
        );
        expect(nextRun.shuffleCharges).toBe(1);
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
                strayRemoveArmed: true,
                strayRemoveCharges: 1
            };

            const after = applyStrayRemove(run, 'a1');

            expect(after).toBe(run);
            expect(after.strayRemoveArmed).toBe(true);
            expect(after.strayRemoveCharges).toBe(1);
        });

        it('stray remove can remove a completion-safe singleton', () => {
            const tiles = [createTile('a1', 'A', 'A'), createTile('a2', 'A', 'A'), createTile('w1', WILD_PAIR_KEY, '*')];
            const board = createBoard(tiles, { pairCount: 1 });
            const run = {
                ...createRun(tiles, { board }),
                status: 'playing' as const,
                strayRemoveArmed: true,
                strayRemoveCharges: 1
            };

            const after = applyStrayRemove(run, 'w1');

            expect(after).not.toBe(run);
            expect(after.board!.tiles.find((tile) => tile.id === 'w1')?.state).toBe('removed');
            expect(after.strayRemoveArmed).toBe(false);
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

        it('does not emit deferred ward_cache candidates as runtime hazard tiles', () => {
            const observedHazards = new Set<string>();
            for (let level = 1; level <= 24; level += 1) {
                const board = buildBoard(level, {
                    activeMutators: ['findables_floor'],
                    runSeed: 90210 + level,
                    runRulesVersion: GAME_RULES_VERSION
                });
                for (const tile of board.tiles) {
                    if (tile.tileHazardKind != null) {
                        observedHazards.add(tile.tileHazardKind);
                    }
                }
            }

            expect(observedHazards).not.toContain('ward_cache');
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
            expect(resolved.gameplayCommandJournal?.map((command) => command.type)).toEqual([
                'board.tile_flip',
                'board.tile_flip',
                'board.turn_resolve'
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
            expect(resolved.gameplayCommandJournal?.map((command) => command.type)).toEqual([
                'board.tile_flip',
                'board.tile_flip',
                'board.turn_resolve'
            ]);
            expect(resolved.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'score.requested', reason: 'findable_match', amount: 25 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.score_glint.matched' })
            ]));
        });

        it('claims ward spark as a capped safe hazard ward charge', () => {
            const tiles: Tile[] = [
                { ...createTile('a1', 'A', 'A'), findableKind: 'ward_spark' },
                { ...createTile('a2', 'A', 'A'), findableKind: 'ward_spark' },
                createTile('b1', 'B', 'B'),
                createTile('b2', 'B', 'B')
            ];
            const started = { ...createRun(tiles), findablesClaimedThisFloor: 0, findablesTotalThisFloor: 1 };
            const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));

            expect(FINDABLE_MATCH_SAFE_HAZARD_WARDS.ward_spark).toBe(1);
            expect(resolved.safeHazardWardChargesThisFloor).toBe(1);
            expect(resolved.findablesClaimedThisFloor).toBe(1);
            expect(resolved.stats.totalScore).toBe(calculateMatchScore(1, 1, 1));
            expect(resolved.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'safe_hazard_ward.requested', amount: 1 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.ward_spark.matched' })
            ]));
        });

        it('claims scout glint through the existing omen scout reveal path', () => {
            const tiles: Tile[] = [
                { ...createTile('a1', 'A', 'A'), findableKind: 'scout_glint' },
                { ...createTile('a2', 'A', 'A'), findableKind: 'scout_glint' },
                {
                    ...createTile('b1', 'B', 'B'),
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'hidden',
                    dungeonCardEffectId: 'trap_snare'
                },
                {
                    ...createTile('b2', 'B', 'B'),
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'hidden',
                    dungeonCardEffectId: 'trap_snare'
                }
            ];
            const started = { ...createRun(tiles), findablesClaimedThisFloor: 0, findablesTotalThisFloor: 1 };
            const resolved = resolveBoardTurn(flipTile(flipTile(started, 'a1'), 'a2'));
            const trapTiles = resolved.board!.tiles.filter((tile) => tile.pairKey === 'B');

            expect(resolved.omenSealScoutsThisFloor).toBe(1);
            expect(trapTiles.every((tile) => tile.dungeonCardState === 'revealed')).toBe(true);
            expect(trapTiles.every((tile) => tile.scoutRevealSource === 'omen_seal')).toBe(true);
            expect(resolved.gameplayCommandJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.turn_resolve' })
            ]));
            expect(resolved.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'scout_reveal.requested', amount: 1 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.scout_glint.matched' })
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
        expect(run.wildTileId).toBe(wild!.id);
        expect(getWildTileIdFromBoard(board)).toBe(wild!.id);
    });

    it('leaves wildTileId null when no wild tile is on the board', () => {
        const run = createNewRun(0, { gameMode: 'endless' });
        expect(run.board).not.toBeNull();
        expect(run.wildTileId).toBeNull();
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
        expect(start.wildTileId).not.toBeNull();
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
        expect(next.wildTileId).toBe(getWildTileIdFromBoard(next.board!));
        expect(next.wildMatchesRemaining).toBe(1);
        expect(next.wildTileId).not.toBeNull();
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

    it('noShuffle overrides extra_shuffle_charge with presentation mutators active', () => {
        const memorized = finishMemorizePhase(
            createNewRun(0, {
                gameMode: 'puzzle',
                initialRelicIds: ['extra_shuffle_charge'],
                activeMutators: ['silhouette_twist'] as MutatorId[]
            })
        );
        expect(memorized.shuffleCharges).toBe(2);
        const run: RunState = {
            ...memorized,
            board: createBoard(fourPairTiles),
            activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(canRegionShuffle(run)).toBe(false);
        expect(applyShuffle(run)).toBe(run);
        expect(applyRegionShuffle(run, 0)).toBe(run);
    });

    it('noShuffle overrides first_shuffle_free_per_floor with presentation mutators active', () => {
        const memorized = finishMemorizePhase(
            createNewRun(0, {
                gameMode: 'puzzle',
                initialRelicIds: ['first_shuffle_free_per_floor'],
                activeMutators: ['wide_recall'] as MutatorId[]
            })
        );
        expect(memorized.freeShuffleThisFloor).toBe(true);
        const run: RunState = {
            ...memorized,
            board: createBoard(fourPairTiles),
            shuffleCharges: 0,
            activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(canRegionShuffle(run)).toBe(false);
        expect(applyShuffle(run)).toBe(run);
        expect(applyRegionShuffle(run, 0)).toBe(run);
    });

    it('noShuffle overrides region_shuffle_free_first with presentation mutators active', () => {
        const memorized = finishMemorizePhase(
            createNewRun(0, {
                gameMode: 'puzzle',
                initialRelicIds: ['region_shuffle_free_first'],
                activeMutators: ['distraction_channel'] as MutatorId[]
            })
        );
        expect(memorized.regionShuffleFreeThisFloor).toBe(true);
        expect(memorized.relicIds).toContain('region_shuffle_free_first');
        const run: RunState = {
            ...memorized,
            board: createBoard(fourPairTiles),
            regionShuffleCharges: 0,
            activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(canRegionShuffle(run)).toBe(false);
        expect(applyRegionShuffle(run, 0)).toBe(run);
    });

    it('noDestroy overrides destroy_bank_plus_one with presentation mutators active', () => {
        const memorized = finishMemorizePhase(
            createNewRun(0, {
                gameMode: 'puzzle',
                initialRelicIds: ['destroy_bank_plus_one'],
                activeMutators: ['wide_recall'] as MutatorId[]
            })
        );
        expect(memorized.destroyPairCharges).toBeGreaterThanOrEqual(1);
        const run: RunState = {
            ...memorized,
            board: createBoard(fourPairTiles),
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
        };
        expect(applyDestroyPair(run, 'a1')).toBe(run);
    });

    it('noShuffle and noDestroy block shuffle region destroy with relic economy and presentation mutators active', () => {
        const memorized = finishMemorizePhase(
            createNewRun(0, {
                gameMode: 'puzzle',
                initialRelicIds: ['extra_shuffle_charge', 'destroy_bank_plus_one'],
                activeMutators: ['wide_recall', 'distraction_channel'] as MutatorId[]
            })
        );
        expect(memorized.shuffleCharges).toBeGreaterThanOrEqual(2);
        expect(memorized.destroyPairCharges).toBeGreaterThanOrEqual(1);
        const run: RunState = {
            ...memorized,
            board: createBoard(fourPairTiles),
            activeContract: { noShuffle: true, noDestroy: true, maxMismatches: null }
        };
        expect(canShuffleBoard(run)).toBe(false);
        expect(canRegionShuffle(run)).toBe(false);
        expect(applyShuffle(run)).toBe(run);
        expect(applyRegionShuffle(run, 0)).toBe(run);
        expect(applyDestroyPair(run, 'a1')).toBe(run);
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

describe('relic and mutator stacking', () => {
    it('extends memorize under short_memorize when memorize_under_short_memorize relic is owned', () => {
        const withRelic = createNewRun(0, {
            gameMode: 'puzzle',
            activeMutators: ['short_memorize'],
            initialRelicIds: ['memorize_under_short_memorize']
        });
        const withoutRelic = createNewRun(0, {
            gameMode: 'puzzle',
            activeMutators: ['short_memorize']
        });
        expect(getMemorizeDurationForRun(withRelic, 1)).toBe(getMemorizeDurationForRun(withoutRelic, 1) + 220);
        expect(getMemorizeDurationForRun(withoutRelic, 1)).toBe(getMemorizeDuration(1) - 350);
    });

    it('stacks memorize_bonus_ms with short_memorize', () => {
        const run = createNewRun(0, {
            gameMode: 'puzzle',
            activeMutators: ['short_memorize'],
            initialRelicIds: ['memorize_bonus_ms']
        });
        expect(getMemorizeDurationForRun(run, 1)).toBe(getMemorizeDuration(1) - 350 + 280);
    });
});

describe('computeRelicOfferPickBudget', () => {
    it('is 1 for vanilla endless', () => {
        const run = createNewRun(0, { gameMode: 'endless' });
        expect(computeRelicOfferPickBudget(run)).toBe(1);
    });

    it('stacks daily mode and generous_shrine mutator', () => {
        const run = createNewRun(0, { gameMode: 'daily', activeMutators: ['generous_shrine'] });
        expect(computeRelicOfferPickBudget(run)).toBe(3);
    });

    it('stacks meta relic draft flag and scholar contract', () => {
        const run = createNewRun(0, {
            metaRelicDraftExtraPerMilestone: 1,
            activeContract: {
                noShuffle: true,
                noDestroy: true,
                maxMismatches: null,
                bonusRelicDraftPick: true
            }
        });
        expect(computeRelicOfferPickBudget(run)).toBe(3);
    });

    it('clamps malformed bonus-pick counters before draft budgeting', () => {
        const run: RunState = {
            ...createNewRun(0),
            bonusRelicPicksNextOffer: Number.NaN,
            metaRelicDraftExtraPerMilestone: Number.POSITIVE_INFINITY
        };

        expect(computeRelicOfferPickBudget(run)).toBe(1);
        expect(grantBonusRelicPickNextOffer(run, Number.NaN).bonusRelicPicksNextOffer).toBe(0);
        expect(grantBonusRelicPickNextOffer({ ...run, bonusRelicPicksNextOffer: -2 }, 2.9).bonusRelicPicksNextOffer).toBe(2);
    });
});

describe('relic draft multi-pick', () => {
    it('rejects a stale offer option for a relic the run already owns', () => {
        const run: RunState = {
            ...createNewRun(999, { gameMode: 'endless', initialRelicIds: ['extra_shuffle_charge'] }),
            status: 'levelComplete',
            relicOffer: {
                tier: 1,
                options: ['extra_shuffle_charge'],
                picksRemaining: 1,
                pickRound: 0
            },
            lastLevelResult: {
                level: 3,
                scoreGained: 1,
                rating: 'S',
                livesRemaining: 3,
                perfect: false,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0
            }
        };

        expect(completeRelicPickAndAdvance(run, 'extra_shuffle_charge')).toBe(run);
    });

    it('skips an exhausted initial relic offer instead of opening an empty draft', () => {
        let run = createNewRun(999, { gameMode: 'daily' });
        run = {
            ...run,
            status: 'levelComplete',
            relicIds: [...RELIC_POOL],
            relicTiersClaimed: 0,
            relicOffer: null,
            bonusRelicPicksNextOffer: 3,
            favorBonusRelicPicksNextOffer: 1,
            lastLevelResult: {
                level: 3,
                scoreGained: 1,
                rating: 'S',
                livesRemaining: 3,
                perfect: false,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0
            }
        };

        const opened = openRelicOffer(run);

        expect(opened.relicOffer).toBeNull();
        expect(opened.relicTiersClaimed).toBe(1);
        expect(opened.bonusRelicPicksNextOffer).toBe(0);
        expect(opened.favorBonusRelicPicksNextOffer).toBe(0);
    });

    it('consumes bonus and completes one milestone tier after two picks', () => {
        let run = createNewRun(999, { gameMode: 'endless' });
        run = {
            ...run,
            status: 'levelComplete',
            relicTiersClaimed: 0,
            relicOffer: null,
            lastLevelResult: {
                level: 3,
                scoreGained: 1,
                rating: 'S',
                livesRemaining: 3,
                perfect: false,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0
            }
        };
        run = grantBonusRelicPickNextOffer(run, 1);
        run = openRelicOffer(run);
        expect(run.relicOffer?.picksRemaining).toBe(2);
        expect(run.bonusRelicPicksNextOffer).toBe(0);

        const first = run.relicOffer!.options[0]!;
        run = completeRelicPickAndAdvance(run, first);
        expect(run.relicOffer).not.toBeNull();
        expect(run.relicOffer!.picksRemaining).toBe(1);

        const second = run.relicOffer!.options[0]!;
        run = completeRelicPickAndAdvance(run, second);
        expect(run.relicOffer).toBeNull();
        expect(run.relicTiersClaimed).toBe(1);
        expect(run.relicIds).toEqual(expect.arrayContaining([first, second]));
    });
});

describe('gauntlet deadline', () => {
    it('reports expired when deadline is in the past', () => {
        const run: RunState = {
            ...createNewRun(0, { gameMode: 'puzzle' }),
            gameMode: 'gauntlet',
            gauntletDeadlineMs: Date.now() - 1
        };
        expect(isGauntletExpired(run)).toBe(true);
    });

    it('reports not expired when deadline is in the future', () => {
        const run: RunState = {
            ...createNewRun(0, { gameMode: 'puzzle' }),
            gameMode: 'gauntlet',
            gauntletDeadlineMs: Date.now() + 86_400_000
        };
        expect(isGauntletExpired(run)).toBe(false);
    });

    it('ignores malformed gauntlet deadlines for expiry checks', () => {
        const run: RunState = {
            ...createNewRun(0, { gameMode: 'puzzle' }),
            gameMode: 'gauntlet',
            gauntletDeadlineMs: Number.NaN
        };
        expect(isGauntletExpired(run)).toBe(false);
    });

    it('extends the deadline on each gauntlet floor clear', () => {
        const started = finishMemorizePhase(createGauntletRun(0, 60_000));
        const deadline = 1_900_000;
        const finished = clearRealPairs({ ...started, gauntletDeadlineMs: deadline });

        expect(finished.status).toBe('levelComplete');
        expect(finished.gauntletDeadlineMs).toBe(deadline + GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS);
    });

    it('drops malformed gauntlet deadlines on floor clear instead of extending them', () => {
        const started = finishMemorizePhase(createGauntletRun(0, 60_000));
        const finished = clearRealPairs({ ...started, gauntletDeadlineMs: Number.POSITIVE_INFINITY });

        expect(finished.status).toBe('levelComplete');
        expect(finished.gauntletDeadlineMs).toBeNull();
    });

    it('does not expire while paused and extends the deadline by paused wall-clock time on resume', () => {
        const pausedAtMs = Date.now() - 5_000;
        const run = {
            ...pauseRun(finishMemorizePhase(createGauntletRun(0, 60_000))),
            gauntletDeadlineMs: Date.now() - 1,
            timerState: {
                ...pauseRun(finishMemorizePhase(createGauntletRun(0, 60_000))).timerState,
                gauntletPausedAtMs: pausedAtMs
            }
        };

        expect(run.status).toBe('paused');
        expect(isGauntletExpired(run)).toBe(false);

        const resumed = resumeRun(run);

        expect(resumed.status).toBe('playing');
        expect(resumed.timerState.gauntletPausedAtMs).toBeNull();
        expect(resumed.gauntletDeadlineMs).toBeGreaterThan(Date.now());
    });
});
