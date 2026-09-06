import {
    GAME_RULES_VERSION,
    INITIAL_LIVES,
    INITIAL_RECALL_FOCUS,
    INITIAL_REGION_SHUFFLE_CHARGES,
    INITIAL_SHUFFLE_CHARGES,
    type BoardState,
    type MutatorId,
    type RelicId,
    type RunState,
    type StartingLoadoutId,
    type Tile,
    type WeakerShuffleMode
} from './contracts';
import { filterMutatorsByContentLock } from './content-lock-state';
import { createBonusRewardLedger, hasRewardPerk } from './bonus-rewards';
import { applyRelicImmediateThroughGameplayCore } from './gameplay-core-adapters';
import { getTraitRouteObjectiveSeed } from './trait-route-objectives';
import { pickFloorScheduleEntry, usesEndlessFloorSchedule } from './floor-mutator-schedule';
import { DAILY_MUTATOR_TABLE } from './mutators';
import { hasRunRelic } from './relics';
import { deriveDailyMutatorIndex, deriveDailyRunSeed, formatDailyDateKeyUtc } from './rng';
import { createDungeonRunMapState } from './run-map';
import { pickFloorCurio, seatFloorCurio } from './floor-curio-rules';
import { countFindablePairs } from './board-tile-generation-rules';
import { boardHasGlassDecoy } from './board-inspection';
import { DECOY_PAIR_KEY } from './tile-identity';
import { getMemorizeDurationForRun } from './scoring-rules';
import { createSessionStats } from './session-stats-rules';
import { createTimerState, normalizeTimerTimestampMs } from './run-timer-rules';
import { buildBoard } from './board-build-rules';
import { applyStartingLoadout } from './starting-loadouts';
import { createPassAndPlayState } from './pass-and-play-rules';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export interface CreateRunOptions {
    runSeed?: number;
    gameMode?: RunState['gameMode'];
    activeMutators?: MutatorId[];
    practiceMode?: boolean;
    activeContract?: RunState['activeContract'];
    dailyDateKeyUtc?: string | null;
    puzzleId?: string | null;
    gauntletDurationMs?: number | null;
    fixedBoard?: BoardState | null;
    initialRelicIds?: RelicId[];
    /** Import / debug: use historical rules version for same tile order. */
    runRulesVersionOverride?: number;
    /** H4: add wild tile to generated boards. */
    enableWildJoker?: boolean;
    weakerShuffleMode?: WeakerShuffleMode;
    shuffleScoreTaxActive?: boolean;
    /** Hook powers: defaults on if undefined. */
    enablePeek?: boolean;
    initialStrayRemoveCharges?: number;
    resolveDelayMultiplier?: number;
    echoFeedbackEnabled?: boolean;
    wildMenuRun?: boolean;
    dungeonShowcaseRun?: boolean;
    /** First-run guidance: build floor 1 as ordinary real pairs so prompts never target specials. */
    onboardingSafeFirstFloor?: boolean;
    /** Copied from save: +1 relic pick at each milestone when meta unlock is active. */
    metaRelicDraftExtraPerMilestone?: number;
    /** Optional starting archetype/loadout for early run identity. */
    startingLoadoutId?: StartingLoadoutId | null;
    /** Seats for a same-device multiplayer run; omitted for every solo run. */
    passAndPlaySeats?: number | null;
}

const randomRunSeed = (): number => Math.floor(Math.random() * 0x7fffffff);

export const createNewRun = (bestScore: number, options: CreateRunOptions = {}): RunState => {
    const runSeed = options.runSeed ?? randomRunSeed();
    const gameMode = options.gameMode ?? 'endless';
    const rulesVersion = options.runRulesVersionOverride ?? GAME_RULES_VERSION;
    let activeMutators = options.activeMutators ?? [];
    let initialFloorTag: BoardState['floorTag'] = 'normal';
    let initialFloorArchetypeId: BoardState['floorArchetypeId'] = null;
    let initialFeaturedObjectiveId: BoardState['featuredObjectiveId'] = null;
    let initialCycleFloor: number | null = null;
    const useOnboardingSafeFirstFloor = options.onboardingSafeFirstFloor === true && gameMode === 'endless';
    if (
        gameMode === 'endless' &&
        usesEndlessFloorSchedule(gameMode, rulesVersion) &&
        !options.wildMenuRun &&
        !useOnboardingSafeFirstFloor &&
        activeMutators.length === 0
    ) {
        const entry = pickFloorScheduleEntry(runSeed, rulesVersion, 1, gameMode);
        activeMutators = filterMutatorsByContentLock(entry.mutators);
        initialFloorTag = entry.floorTag;
        initialFloorArchetypeId = entry.floorArchetypeId;
        initialFeaturedObjectiveId = entry.featuredObjectiveId;
        initialCycleFloor = entry.cycleFloor;
    }
    const weakerShuffleMode: WeakerShuffleMode = options.weakerShuffleMode ?? 'full';
    const shuffleScoreTaxActive = options.shuffleScoreTaxActive ?? false;
    const enableWildJoker = options.enableWildJoker ?? false;
    const peekCharges = options.enablePeek === false ? 0 : 1;
    const board =
        options.fixedBoard ??
        buildBoard(1, {
            runSeed,
            runRulesVersion: rulesVersion,
            activeMutators: useOnboardingSafeFirstFloor ? [] : activeMutators,
            includeWildTile: enableWildJoker,
            floorTag: initialFloorTag,
            floorArchetypeId: initialFloorArchetypeId,
            featuredObjectiveId: initialFeaturedObjectiveId,
            cycleFloor: initialCycleFloor,
            gameMode: useOnboardingSafeFirstFloor ? undefined : gameMode,
            suppressFindables: useOnboardingSafeFirstFloor,
            relicIds: options.initialRelicIds ?? [],
            startingLoadoutId: options.startingLoadoutId ?? null
        });
    const dungeonRun = createDungeonRunMapState(runSeed, rulesVersion, 1);

    const traitRouteObjective = getTraitRouteObjectiveSeed(board);
    const run: RunState = {
        status: 'memorize',
        lives: INITIAL_LIVES,
        passAndPlay:
            options.passAndPlaySeats != null ? createPassAndPlayState(options.passAndPlaySeats) : null,
        board,
        stats: createSessionStats(bestScore),
        achievementsEnabled: !options.practiceMode && options.passAndPlaySeats == null,
        debugUsed: false,
        debugPeekActive: false,
        pendingMemorizeBonusMs: 0,
        shuffleCharges: INITIAL_SHUFFLE_CHARGES,
        destroyPairCharges: 0,
        pinnedTileIds: [],
        powersUsedThisRun: false,
        timerState: createTimerState({ memorizeRemainingMs: null }),
        lastLevelResult: null,
        lastRunSummary: null,
        runSeed,
        runRulesVersion: rulesVersion,
        gameMode,
        startingLoadoutId: options.startingLoadoutId ?? null,
        shuffleNonce: 0,
        activeMutators,
        relicIds: [...(options.initialRelicIds ?? [])],
        rewardPerkIds: [],
        relicTiersClaimed: 0,
        bonusRelicPicksNextOffer: 0,
        favorBonusRelicPicksNextOffer: 0,
        relicFavorProgress: 0,
        shopGold: 0,
        shopOffers: [],
        shopRerolls: 0,
        featuredObjectiveStreak: 0,
        endlessRiskWager: null,
        pendingRouteCardPlan: null,
        sideRoom: null,
        dungeonRun,
        bonusRewardLedger: createBonusRewardLedger(),
        traitRouteObjectiveProgressThisFloor: 0,
        traitRouteObjectiveRequiredThisFloor: traitRouteObjective?.required ?? 0,
        traitRouteObjectiveCompletedThisFloor: false,
        traitRouteObjectiveRewardClaimedThisFloor: false,
        traitRouteObjectiveRewardTextThisFloor: null,
        traitRouteObjectiveTriggeredTagsThisFloor: [],
        metaRelicDraftExtraPerMilestone: options.metaRelicDraftExtraPerMilestone ?? 0,
        relicOffer: null,
        activeContract: options.activeContract ?? null,
        practiceMode: options.practiceMode ?? false,
        dailyDateKeyUtc: options.dailyDateKeyUtc ?? null,
        puzzleId: options.puzzleId ?? null,
        stickyBlockIndex: null,
        parasiteFloors: 0,
        freeShuffleThisFloor: false,
        gauntletDeadlineMs:
            options.gauntletDurationMs != null ? Date.now() + options.gauntletDurationMs : null,
        gauntletSessionDurationMs: options.gauntletDurationMs ?? null,
        flipHistory: [],
        peekCharges,
        peekRevealedTileIds: [],
        undoUsesThisFloor: 1,
        gambitAvailableThisFloor: true,
        gambitThirdFlipUsed: false,
        wildMatchesRemaining: enableWildJoker ? 1 : 0,
        strayRemoveCharges: options.initialStrayRemoveCharges ?? 0,
        matchScoreMultiplier: 1,
        nBackMatchCounter: 0,
        nBackAnchorPairKey: null,
        matchedPairKeysThisRun: [],
        weakerShuffleMode,
        shuffleScoreTaxActive,
        resolveDelayMultiplier: options.resolveDelayMultiplier ?? 1,
        echoFeedbackEnabled: options.echoFeedbackEnabled ?? true,
        wildMenuRun: options.wildMenuRun ?? false,
        dungeonShowcaseRun: options.dungeonShowcaseRun ?? false,
        shuffleUsedThisFloor: false,
        destroyUsedThisFloor: false,
        decoyFlippedThisFloor: false,
        glassDecoyActiveThisFloor: boardHasGlassDecoy(board),
        cursedMatchedEarlyThisFloor: false,
        matchResolutionsThisFloor: 0,
        parasiteWardRemaining: 0,
        flashPairCharges:
            options.practiceMode || options.wildMenuRun ? 1 : 0,
        flashPairRevealedTileIds: [],
        regionShuffleCharges: INITIAL_REGION_SHUFFLE_CHARGES,
        regionShuffleFreeThisFloor: false,
        pinsPlacedCountThisRun: 0,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: countFindablePairs(board.tiles),
        recallFocus: INITIAL_RECALL_FOCUS,
        recallMatchesThisFloor: 0,
        recallMistakesThisFloor: 0,
        recallBonusScoreThisFloor: 0,
        forgottenTileIdsThisFloor: [],
        hazardTileTriggersThisFloor: 0,
        chunkBreaksThisFloor: 0,
        chunkPairsBrokenThisFloor: 0,
        magpieTheftsThisFloor: 0,
        magpieScaredOffThisFloor: 0,
        hazardShuffleSnaresThisFloor: 0,
        hazardCascadeCachesThisFloor: 0,
        hazardMirrorDecoysThisFloor: 0,
        hazardFragileCacheClaimsThisFloor: 0,
        hazardFragileCacheBreaksThisFloor: 0,
        hazardTollCachesThisFloor: 0,
        hazardFuseCachesThisFloor: 0,
        hazardFuseCacheExpiredClaimsThisFloor: 0,
        lanternWardScoutsThisFloor: 0,
        omenSealScoutsThisFloor: 0,
        mimicCacheClaimsThisFloor: 0,
        mimicCacheBitesThisFloor: 0,
        mimicCacheGuardBitesThisFloor: 0,
        anchorSealChargesThisFloor: 0,
        anchorSealUsesThisFloor: 0,
        loadedGatewayPlansThisFloor: 0,
        catalystAltarUpgradesThisFloor: 0,
        parasiteVesselConversionsThisFloor: 0,
        pinLatticeRewardsThisFloor: 0,
        safeHazardWardChargesThisFloor: 0,
        safeHazardWardsUsedThisFloor: 0,
        shiftingSpotlightNonce: 0,
        dungeonEnemiesDefeated: 0,
        dungeonEnemiesDefeatedThisFloor: 0,
        dungeonTrapsTriggered: 0,
        dungeonTrapsResolvedThisFloor: 0,
        dungeonTreasuresOpened: 0,
        dungeonTreasuresOpenedThisFloor: 0,
        dungeonGatewaysUsed: 0,
        dungeonGatewaysUsedThisFloor: 0,
        dungeonKeys: {},
        dungeonMasterKeys: 0,
        enemyHazardHitsThisFloor: 0,
        enemyHazardsDefeatedThisFloor: 0
    };

    let runWithRelics = applyStartingLoadout(run, options.startingLoadoutId ?? null);
    for (const relicId of runWithRelics.relicIds) {
        runWithRelics = applyRelicImmediateThroughGameplayCore(
            runWithRelics,
            relicId,
            `starting-relic:${runWithRelics.runSeed}:${relicId}`
        ).run;
    }

    const memorizeMs = getMemorizeDurationForRun(runWithRelics, 1) + runWithRelics.pendingMemorizeBonusMs;

    /*
     * Floor one has a resident too — seated, not welcomed. If the opening floor had nobody, the
     * cast would be something a player only discovers on their second floor and the greet control
     * would open the run disabled, which reads as broken rather than as empty. It gets no arrival
     * gift for the reason `seatFloorCurio` gives: nothing announced them, so nothing can explain
     * the change. Say hello and they will tell you themselves.
     */
    return seatFloorCurio(
        {
            ...runWithRelics,
            freeShuffleThisFloor: hasRunRelic(runWithRelics, 'first_shuffle_free_per_floor'),
            regionShuffleFreeThisFloor:
                hasRunRelic(runWithRelics, 'region_shuffle_free_first') ||
                hasRewardPerk(runWithRelics, 'free_first_swap_per_floor'),
            timerState: createTimerState({ memorizeRemainingMs: memorizeMs })
        },
        pickFloorCurio(runWithRelics.runSeed, 1, runWithRelics.runRulesVersion)
    );
};

export const createMeditationRun = (
    bestScore: number,
    focusMutators?: MutatorId[],
    extra: Partial<CreateRunOptions> = {}
): RunState =>
    createNewRun(bestScore, {
        gameMode: 'meditation',
        activeMutators: focusMutators && focusMutators.length > 0 ? focusMutators : undefined,
        ...extra
    });

export const createWildRun = (bestScore: number, extra: Partial<CreateRunOptions> = {}): RunState =>
    createNewRun(bestScore, {
        enableWildJoker: true,
        initialStrayRemoveCharges: 1,
        wildMenuRun: true,
        activeMutators: ['sticky_fingers', 'short_memorize', 'findables_floor'],
        ...extra
    });

export const createDailyRun = (bestScore: number, extra: Partial<CreateRunOptions> = {}): RunState => {
    const runSeed = deriveDailyRunSeed(GAME_RULES_VERSION);
    const mutIndex = deriveDailyMutatorIndex(runSeed, DAILY_MUTATOR_TABLE.length);
    const dailyMutator = DAILY_MUTATOR_TABLE[mutIndex] ?? DAILY_MUTATOR_TABLE[0];
    const activeMutators = dailyMutator ? [dailyMutator] : [];

    return createNewRun(bestScore, {
        runSeed,
        gameMode: 'daily',
        activeMutators,
        dailyDateKeyUtc: formatDailyDateKeyUtc(),
        ...extra
    });
};

export const createGauntletRun = (
    bestScore: number,
    gauntletDurationMs: number = 10 * 60 * 1000,
    extra: Partial<CreateRunOptions> = {}
): RunState =>
    createNewRun(bestScore, {
        gameMode: 'gauntlet',
        gauntletDurationMs,
        ...extra
    });

export const createPuzzleRun = (
    bestScore: number,
    puzzleId: string,
    tiles: Tile[],
    level = 1,
    extra: Partial<CreateRunOptions> = {}
): RunState => {
    const columns = clamp(Math.ceil(Math.sqrt(tiles.length)), 2, 8);
    const rows = Math.ceil(tiles.length / columns);
    const pairCount = new Set(tiles.map((t) => t.pairKey).filter((k) => k !== DECOY_PAIR_KEY)).size;

    return createNewRun(bestScore, {
        gameMode: 'puzzle',
        puzzleId,
        fixedBoard: {
            level,
            pairCount,
            columns,
            rows,
            tiles: tiles.map((t) => ({ ...t })),
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null
        },
        ...extra
    });
};

export const isGauntletExpired = (run: RunState): boolean => {
    const gauntletDeadlineMs = normalizeTimerTimestampMs(run.gauntletDeadlineMs);
    const nowMs = normalizeTimerTimestampMs(Date.now());
    return run.status !== 'paused' && gauntletDeadlineMs !== null && nowMs !== null && nowMs > gauntletDeadlineMs;
};
