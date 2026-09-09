import {
    GAME_RULES_VERSION,
    INITIAL_LIVES,
    INITIAL_RECALL_FOCUS,
    INITIAL_REGION_SHUFFLE_CHARGES,
    INITIAL_SHUFFLE_CHARGES,
    type BoardState,
    type MutatorId,
    type RunState,
    type WeakerShuffleMode
} from './contracts';
import { filterMutatorsByContentLock } from './content-lock-state';
import { pickFloorScheduleEntry, usesEndlessFloorSchedule } from './floor-mutator-schedule';
import { pickFloorCurio, seatFloorCurio } from './floor-curio-rules';
import { countFindablePairs } from './board-tile-generation-rules';
import { boardHasGlassDecoy } from './board-inspection';
import { getMemorizeDurationForRun } from './scoring-rules';
import { createSessionStats } from './session-stats-rules';
import { createTimerState } from './run-timer-rules';
import { buildBoard } from './board-build-rules';
import { createPassAndPlayState } from './pass-and-play-rules';

export interface CreateRunOptions {
    runSeed?: number;
    gameMode?: RunState['gameMode'];
    activeMutators?: MutatorId[];
    practiceMode?: boolean;
    activeContract?: RunState['activeContract'];
    dailyDateKeyUtc?: string | null;
    puzzleId?: string | null;
    fixedBoard?: BoardState | null;
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
    /** First-run guidance: build floor 1 as ordinary real pairs so prompts never target specials. */
    onboardingSafeFirstFloor?: boolean;
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
            suppressFindables: useOnboardingSafeFirstFloor
        });

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
        shuffleNonce: 0,
        activeMutators,
        featuredObjectiveStreak: 0,
        activeContract: options.activeContract ?? null,
        practiceMode: options.practiceMode ?? false,
        dailyDateKeyUtc: options.dailyDateKeyUtc ?? null,
        puzzleId: options.puzzleId ?? null,
        stickyBlockIndex: null,
        parasiteFloors: 0,
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
        shuffleUsedThisFloor: false,
        destroyUsedThisFloor: false,
        decoyFlippedThisFloor: false,
        glassDecoyActiveThisFloor: boardHasGlassDecoy(board),
        cursedMatchedEarlyThisFloor: false,
        matchResolutionsThisFloor: 0,
        flashPairCharges:
            options.practiceMode || options.wildMenuRun ? 1 : 0,
        flashPairRevealedTileIds: [],
        regionShuffleCharges: INITIAL_REGION_SHUFFLE_CHARGES,
        pinsPlacedCountThisRun: 0,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: countFindablePairs(board.tiles),
        recallFocus: INITIAL_RECALL_FOCUS,
        recallMatchesThisFloor: 0,
        recallMistakesThisFloor: 0,
        recallBonusScoreThisFloor: 0,
        forgottenTileIdsThisFloor: [],
        chunkBreaksThisFloor: 0,
        chunkPairsBrokenThisFloor: 0,
        chunkScoreThisFloor: 0,
        chunkPairsThisChain: 0,
        feverBreaksThisFloor: 0,
        bestChainThisFloor: 0,
        feverBreaksThisRun: 0,
        biggestChunkPairs: 0,
        bestChainThisRun: 0,
        sharpFloorsThisRun: 0,
        feverFloorsThisRun: 0,
        chunkPairsDroppedThisFloor: 0,
        chunkDropsThisRun: 0,
        bestRippleThisFloor: 0,
        bestRippleThisRun: 0,
        magpieTheftsThisFloor: 0,
        magpieScaredOffThisFloor: 0,
        shiftingSpotlightNonce: 0
    };

    const memorizeMs = getMemorizeDurationForRun(run, 1) + run.pendingMemorizeBonusMs;

    /*
     * Floor one has a resident too — seated, not welcomed. If the opening floor had nobody, the
     * cast would be something a player only discovers on their second floor and the greet control
     * would open the run disabled, which reads as broken rather than as empty. It gets no arrival
     * gift for the reason `seatFloorCurio` gives: nothing announced them, so nothing can explain
     * the change. Say hello and they will tell you themselves.
     */
    return seatFloorCurio(
        { ...run, timerState: createTimerState({ memorizeRemainingMs: memorizeMs }) },
        pickFloorCurio(run.runSeed, 1, run.runRulesVersion)
    );
};

export const createWildRun = (bestScore: number, extra: Partial<CreateRunOptions> = {}): RunState =>
    createNewRun(bestScore, {
        enableWildJoker: true,
        initialStrayRemoveCharges: 1,
        wildMenuRun: true,
        activeMutators: ['sticky_fingers', 'short_memorize', 'findables_floor'],
        ...extra
    });
