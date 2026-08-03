import {
    applyDestroyPairTransition,
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    applyTileSwap,
    cancelResolvingWithUndo
} from './board-power-actions';
import { maxPinnedTilesForRun, togglePinnedTile } from './board-power-state';
import {
    DEBUG_REVEAL_MS,
    MAX_LIVES,
    RECALL_FOCUS_MAX,
    type BonusRewardId,
    type FindableKind,
    type RunState
} from './contracts';
import {
    GAMEPLAY_BONUS_REWARD_IDS,
    GAMEPLAY_BONUS_REWARD_RULES,
    GAMEPLAY_CORE_SCHEMA_VERSION,
    createGameplayDefinitionCommand,
    gameplayCommandSchema,
    gameplayEventSchema,
    getGameplayContentDefinition,
    type GameplayCommand,
    type GameplayContentDefinition,
    type GameplayEvent,
    type GameplayFacts,
    type GameplaySource
} from './gameplay-core-contracts';
import {
    getRunInventoryItemQuantity,
    useRunInventoryItem as consumeRunInventoryItem
} from './run-inventory';
import {
    applyGameplayDefinitionTransition,
    hasGameplayRewardPerk,
    makeGameplayEventWriter as makeEventWriter,
    normalizeGameplayRewardPerkIds
} from './gameplay-effect-transition';
import { runNonNegativeInteger } from './run-number-guards';
import { runStringArray } from './run-array-guards';
import { acceptEndlessRiskWager } from './risk-wager-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { purchaseShopOffer, rerollShopOffers, runShopOffers } from './shop-rules';
import { applyEnemyHazardClick } from './dungeon-enemy-hazard-rules';
import { createDungeonExitActivationTransition } from './dungeon-exit-rules';
import { getDungeonExitStatus } from './dungeon-board-status';
import { advanceScoreParasiteFloor } from './score-parasite-rules';
import { hasMutator } from './mutators';
import { tilesArePairMatch } from './scoring-rules';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';
import { isBoardComplete } from './board-inspection';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';
import { resolveHazardBanisherFloorStart } from './hazard-banisher-rules';
import { applyRouteChoiceOutcome } from './route-rules';
import { openRouteSideRoom } from './route-side-room-rules';
import { openRelicOffer } from './relic-offer-open-rules';
import { createRelicPickTransitionResult } from './relic-pick-transition-rules';
import {
    createRunProgressionRepairTransition,
    repairRunProgressionSoftlocks
} from './run-progression-repair';
import {
    applyRelicOfferService,
    hasRunRelic,
    needsRelicPick,
    relicMilestoneIndexForFloor,
    RELIC_OFFER_SERVICE_CATALOG
} from './relics';
import { applyRunEventChoice, rollRunEventRoom, type RunEventChoiceEffect } from './run-events';
import { advanceToNextLevel } from './next-floor-transition-rules';
import {
    createResolveBoardTurnTransition,
    type BoardTurnExecutionContext,
    type BoardTurnFindableRewardResult,
    type BoardTurnWildMatchResult
} from './board-turn-transition';
import { getBoardTurnAnnouncementFacts } from './board-turn-event-facts';
import { getGameplayFeedbackObjectiveSnapshot } from './gameplay-feedback-facts';
import { createFinalizeLevelTransition } from './floor-clear-transition';
import { resolveSlayerFloorClearEffects } from './slayer-floor-clear-transition';
import { createFlipTileTransition } from './flip-tile-transition';
import { finishMemorizePhase } from './memorize-phase-rules';
import {
    disableDebugPeek,
    enableDebugPeek,
    normalizeTimerTimestampMs,
    pauseRunAt,
    resumeRunAt
} from './run-timer-rules';

export interface GameplayCommandResult {
    run: RunState;
    command: GameplayCommand | null;
    events: GameplayEvent[];
    accepted: boolean;
}

export interface GameplayReplayResult {
    run: RunState;
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
}

const SYSTEM_SOURCE: GameplaySource = { kind: 'system', id: 'gameplay-core' };
const MEMORIZE_PHASE_SOURCE: GameplaySource = { kind: 'system', id: 'memorize_phase' };
const GAUNTLET_CLOCK_SOURCE: GameplaySource = { kind: 'system', id: 'gauntlet_clock' };
const RUN_LIFECYCLE_SOURCE: GameplaySource = { kind: 'system', id: 'run_lifecycle' };
const DEBUG_REVEAL_SOURCE: GameplaySource = { kind: 'system', id: 'debug_reveal' };
const PROGRESSION_SAFETY_SOURCE: GameplaySource = { kind: 'system', id: 'progression_safety' };
const TILE_FLIP_SOURCE: GameplaySource = { kind: 'system', id: 'board_tile' };
const ENEMY_HAZARD_CONTACT_SOURCE: GameplaySource = { kind: 'system', id: 'enemy_hazard_contact' };
const PEEK_SOURCE: GameplaySource = { kind: 'power', id: 'peek' };
const PIN_SOURCE: GameplaySource = { kind: 'power', id: 'pin' };
const STRAY_REMOVE_SOURCE: GameplaySource = { kind: 'power', id: 'stray_remove' };
const DESTROY_PAIR_SOURCE: GameplaySource = { kind: 'power', id: 'destroy_pair' };
const RISK_WAGER_SOURCE: GameplaySource = { kind: 'system', id: 'risk_wager' };
const GAMBIT_SOURCE: GameplaySource = { kind: 'power', id: 'gambit' };
const SHUFFLE_SOURCE: GameplaySource = { kind: 'power', id: 'shuffle' };
const REGION_SHUFFLE_SOURCE: GameplaySource = { kind: 'power', id: 'region_shuffle' };
const TILE_SWAP_SOURCE: GameplaySource = { kind: 'power', id: 'tile_swap' };
const FLASH_PAIR_SOURCE: GameplaySource = { kind: 'power', id: 'flash_pair' };
const UNDO_RESOLVE_SOURCE: GameplaySource = { kind: 'power', id: 'undo_resolve' };
const SHOP_SOURCE: GameplaySource = { kind: 'shop', id: 'run_shop' };
const DUNGEON_EXIT_SOURCE: GameplaySource = { kind: 'system', id: 'dungeon_exit' };
const SCORE_PARASITE_SOURCE: GameplaySource = { kind: 'system', id: 'score_parasite' };
const HAZARD_BANISH_SOURCE: GameplaySource = { kind: 'reward_perk', id: 'hazard_banish_per_floor' };
const FLOOR_ADVANCE_SOURCE: GameplaySource = { kind: 'system', id: 'floor_advance' };
const ROUTE_CHOICE_SOURCE: GameplaySource = { kind: 'system', id: 'route_choice' };
const SIDE_ROOM_SOURCE: GameplaySource = { kind: 'system', id: 'route_side_room' };
const RELIC_OFFER_SOURCE: GameplaySource = { kind: 'system', id: 'relic_offer' };
const WILD_JOKER_SOURCE: GameplaySource = { kind: 'system', id: 'wild_joker' };
const BOARD_TURN_SOURCE: GameplaySource = { kind: 'system', id: 'board_turn' };
const finalizeLevelThroughCore = createFinalizeLevelTransition({
    resolveSlayerFloorClear: (run, input, _legacyCommandId, execution) => {
        if (!execution) {
            throw new Error('Core-owned floor clear requires an outer execution context.');
        }
        return resolveSlayerFloorClearEffects(run, input, execution.commandId, execution.events);
    },
    appendGameplayJournal: (run) => run
});
const hasLiveShopInterlude = (run: RunState): boolean =>
    runNonNegativeInteger(run.lives) > 0 &&
    ((run.status === 'levelComplete' && !run.sideRoom && !run.relicOffer) ||
        (run.status === 'paused' &&
            run.timerState?.pausedFromStatus != null &&
            run.board?.dungeonShopVisited === true));
const memoryAidEventFacts = (before: RunState, after: RunState) => ({
    recallFocusBefore: runNonNegativeInteger(before.recallFocus),
    recallFocusAfter: runNonNegativeInteger(after.recallFocus),
    forgottenTileCountBefore: runStringArray(before.forgottenTileIdsThisFloor).length,
    forgottenTileCountAfter: runStringArray(after.forgottenTileIdsThisFloor).length
});
const memoryAidFeedbackSuffix = (before: RunState, after: RunState): string => {
    const facts = memoryAidEventFacts(before, after);
    if (
        facts.recallFocusBefore === facts.recallFocusAfter &&
        facts.forgottenTileCountBefore === facts.forgottenTileCountAfter
    ) {
        return '';
    }
    const memoryLine = facts.forgottenTileCountAfter > 0
        ? `; ${facts.forgottenTileCountAfter} ${
              facts.forgottenTileCountAfter === 1 ? 'tile memory is' : 'tile memories are'
          } unstable`
        : '';
    return ` Recall focus ${facts.recallFocusAfter}/${RECALL_FOCUS_MAX}${memoryLine}.`;
};
const appendReindexedEvents = (
    commandId: string,
    sourceEvents: readonly GameplayEvent[],
    targetEvents: GameplayEvent[]
): void => {
    for (const event of sourceEvents) {
        const sequence = targetEvents.length;
        targetEvents.push(gameplayEventSchema.parse({
            ...event,
            commandId,
            eventId: `${commandId}:${sequence}`,
            sequence
        }));
    }
};

const rejectedResult = (
    run: RunState,
    commandId: string,
    reason: string,
    command: GameplayCommand | null
): GameplayCommandResult => {
    const events: GameplayEvent[] = [];
    makeEventWriter(commandId, SYSTEM_SOURCE, events)({ type: 'command.rejected', reason });
    return { run, command, events, accepted: false };
};

const applyMemorizeCompleteCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'phase.memorize_complete' }>
): GameplayCommandResult => {
    const nextRun = finishMemorizePhase(run);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Memorize completion requires an active study phase.', command);
    }
    const rawRemainingMs = run.timerState?.memorizeRemainingMs;
    const memorizeRemainingMsBefore =
        typeof rawRemainingMs === 'number' && Number.isFinite(rawRemainingMs)
            ? Math.max(0, Math.floor(rawRemainingMs))
            : null;
    const recallFocusBefore = runNonNegativeInteger(run.recallFocus);
    const recallFocusAfter = runNonNegativeInteger(nextRun.recallFocus);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, MEMORIZE_PHASE_SOURCE, events);
    writeEvent({
        type: 'phase.memorize_completed',
        floor: Math.max(1, runNonNegativeInteger(run.board?.level ?? normalizeSessionStats(run.stats).highestLevel)),
        memorizeRemainingMsBefore,
        recallFocusBefore,
        recallFocusAfter,
        pendingMemorizeBonusMs: runNonNegativeInteger(run.pendingMemorizeBonusMs)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'phase.memorize.completed',
        message: `Study complete; ${recallFocusAfter} Focus ${recallFocusAfter === 1 ? 'charge is' : 'charges are'} ready.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyGauntletExpireCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'run.gauntlet_expire' }>
): GameplayCommandResult => {
    const deadlineMs = normalizeTimerTimestampMs(run.gauntletDeadlineMs);
    if (
        run.gameMode !== 'gauntlet' ||
        (run.status !== 'memorize' && run.status !== 'playing' && run.status !== 'resolving') ||
        runNonNegativeInteger(run.lives) <= 0 ||
        deadlineMs === null ||
        !Number.isSafeInteger(deadlineMs) ||
        deadlineMs < 0 ||
        command.observedAtMs <= deadlineMs
    ) {
        return rejectedResult(run, command.commandId, 'Gauntlet expiry requires an active run observed after its deadline.', command);
    }
    const nextRun: RunState = { ...run, status: 'gameOver', lives: 0 };
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, GAUNTLET_CLOCK_SOURCE, events);
    writeEvent({
        type: 'run.gauntlet_expired',
        observedAtMs: command.observedAtMs,
        deadlineMs,
        overdueMs: command.observedAtMs - deadlineMs,
        statusBefore: run.status,
        livesBefore: runNonNegativeInteger(run.lives),
        livesAfter: 0
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'mode.gauntlet.expired',
        message: `Gauntlet time expired ${command.observedAtMs - deadlineMs} ms past the deadline.`,
        tone: 'warning'
    });
    return { run: nextRun, command, events, accepted: true };
};

const eventTimestampMs = (value: unknown): number | null => {
    const normalized = normalizeTimerTimestampMs(value);
    return normalized !== null && Number.isSafeInteger(normalized) && normalized >= 0
        ? normalized
        : null;
};

const applyPauseCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'run.pause' }>
): GameplayCommandResult => {
    if (run.status !== 'memorize' && run.status !== 'playing' && run.status !== 'resolving') {
        return rejectedResult(run, command.commandId, 'Pause requires an active memorize, playing, or resolving run.', command);
    }
    const pausedRun = pauseRunAt(run, command.observedAtMs);
    if (pausedRun === run) {
        return rejectedResult(run, command.commandId, 'Pause requires an active memorize, playing, or resolving run.', command);
    }
    const nextRun: RunState = {
        ...pausedRun,
        timerState: {
            ...pausedRun.timerState,
            ...command.timerSnapshot
        }
    };
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, RUN_LIFECYCLE_SOURCE, events);
    writeEvent({
        type: 'run.paused',
        observedAtMs: command.observedAtMs,
        statusBefore: run.status,
        statusAfter: 'paused',
        gauntletDeadlineMs: eventTimestampMs(nextRun.gauntletDeadlineMs),
        gauntletPausedAtMs: eventTimestampMs(nextRun.timerState.gauntletPausedAtMs),
        timerSnapshot: command.timerSnapshot
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'run.paused',
        message: `Run paused from ${run.status}.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyResumeCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'run.resume' }>
): GameplayCommandResult => {
    const pausedFromStatus = run.timerState?.pausedFromStatus;
    const nextRun = resumeRunAt(run, command.observedAtMs);
    if (
        nextRun === run ||
        (pausedFromStatus !== 'memorize' && pausedFromStatus !== 'playing' && pausedFromStatus !== 'resolving')
    ) {
        return rejectedResult(run, command.commandId, 'Resume requires a paused run with a valid prior gameplay phase.', command);
    }
    if (
        nextRun.status !== 'memorize' &&
        nextRun.status !== 'playing' &&
        nextRun.status !== 'resolving' &&
        nextRun.status !== 'gameOver'
    ) {
        return rejectedResult(run, command.commandId, 'Resume produced an invalid gameplay phase.', command);
    }
    const deadlineBefore = eventTimestampMs(run.gauntletDeadlineMs);
    const deadlineAfter = eventTimestampMs(nextRun.gauntletDeadlineMs);
    const pausedAtMs = eventTimestampMs(run.timerState?.gauntletPausedAtMs);
    const gauntletPauseDurationMs =
        run.gameMode === 'gauntlet' && deadlineBefore !== null && pausedAtMs !== null
            ? Math.max(0, command.observedAtMs - pausedAtMs)
            : 0;
    const outcome = nextRun.status === 'gameOver'
        ? 'game_over'
        : pausedFromStatus === 'resolving' && nextRun.status === 'playing'
            ? 'recovered_to_playing'
            : 'resumed';
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, RUN_LIFECYCLE_SOURCE, events);
    writeEvent({
        type: 'run.resumed',
        observedAtMs: command.observedAtMs,
        pausedFromStatus,
        statusAfter: nextRun.status,
        outcome,
        gauntletDeadlineMsBefore: deadlineBefore,
        gauntletDeadlineMsAfter: deadlineAfter,
        gauntletPauseDurationMs
    });
    writeEvent({
        type: 'feedback.requested',
        cue: outcome === 'game_over' ? 'run.resume.game_over' : 'run.resumed',
        message: outcome === 'game_over'
            ? 'Paused run could not resume safely and ended.'
            : `Run resumed into ${nextRun.status}.`,
        tone: outcome === 'game_over' ? 'warning' : 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyDebugRevealActivateCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'debug.reveal_activate' }>
): GameplayCommandResult => {
    if (run.status !== 'playing') {
        return rejectedResult(run, command.commandId, 'Debug reveal activation requires an active playing phase.', command);
    }
    const outcome = run.debugPeekActive ? 'refreshed' : 'activated';
    const nextRun = enableDebugPeek(run, command.disableAchievementsOnDebug);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, DEBUG_REVEAL_SOURCE, events);
    writeEvent({
        type: 'debug.reveal_activated',
        outcome,
        revealDurationMs: DEBUG_REVEAL_MS,
        debugUsedBefore: Boolean(run.debugUsed),
        debugUsedAfter: true,
        achievementsEnabledBefore: Boolean(run.achievementsEnabled),
        achievementsEnabledAfter: nextRun.achievementsEnabled
    });
    writeEvent({
        type: 'feedback.requested',
        cue: outcome === 'refreshed' ? 'debug.reveal.refreshed' : 'debug.reveal.activated',
        message: command.disableAchievementsOnDebug
            ? `Debug reveal active for ${DEBUG_REVEAL_MS} ms; achievements are disabled for this run.`
            : `Debug reveal active for ${DEBUG_REVEAL_MS} ms.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyDebugRevealDeactivateCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'debug.reveal_deactivate' }>
): GameplayCommandResult => {
    if (!run.debugPeekActive) {
        return rejectedResult(run, command.commandId, 'Debug reveal deactivation requires an active debug reveal.', command);
    }
    const remainingMs = run.timerState?.debugRevealRemainingMs;
    const nextRun = disableDebugPeek(run);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, DEBUG_REVEAL_SOURCE, events);
    writeEvent({
        type: 'debug.reveal_deactivated',
        reason: command.reason,
        debugRevealRemainingMsBefore:
            typeof remainingMs === 'number' && Number.isSafeInteger(remainingMs) && remainingMs >= 0
                ? remainingMs
                : null,
        debugPeekActiveAfter: false
    });
    writeEvent({
        type: 'feedback.requested',
        cue: `debug.reveal.${command.reason}`,
        message: command.reason === 'phase_ended'
            ? 'Debug reveal ended with the gameplay phase.'
            : 'Debug reveal expired; hidden tiles are concealed again.',
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyProgressionRepairCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'run.progression_repair' }>
): GameplayCommandResult => {
    const transition = createRunProgressionRepairTransition(run);
    if (!transition.repaired || transition.summary.repairKinds.length === 0) {
        return rejectedResult(run, command.commandId, 'Progression repair requires a stale exit or enemy-hazard softlock.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, PROGRESSION_SAFETY_SOURCE, events);
    writeEvent({
        type: 'run.progression_repaired',
        ...transition.summary
    });
    const repairLabels = [
        transition.summary.repairKinds.includes('exit_lock') ? 'exit lock' : null,
        transition.summary.repairKinds.includes('exit_lever_count') ? 'lever requirement' : null,
        transition.summary.repairKinds.includes('enemy_hazard')
            ? `${transition.summary.enemyHazardIdsDefeated.length} stale enemy hazard${transition.summary.enemyHazardIdsDefeated.length === 1 ? '' : 's'}`
            : null,
        transition.summary.repairKinds.includes('exit_metadata') &&
        !transition.summary.repairKinds.includes('exit_lock') &&
        !transition.summary.repairKinds.includes('exit_lever_count')
            ? 'exit metadata'
            : null
    ].filter((label): label is string => label !== null);
    writeEvent({
        type: 'feedback.requested',
        cue: 'safety.progression.repaired',
        message: `Progression safety repaired ${repairLabels.join(' and ')}.`,
        tone: 'information'
    });
    return { run: transition.run, command, events, accepted: true };
};

const applyDefinition = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'effects.apply' }>,
    definition: GameplayContentDefinition,
    events: GameplayEvent[] = []
): GameplayCommandResult => {
    const transition = applyGameplayDefinitionTransition(
        run,
        command.commandId,
        definition,
        command.facts,
        events
    );
    return {
        run: transition.run,
        command,
        events: transition.events,
        accepted: transition.accepted
    };
};

const applyTileFlipCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.tile_flip' }>
): GameplayCommandResult => {
    const targetBefore = run.board?.tiles.find((tile) => tile.id === command.targetTileId);
    if (!targetBefore) {
        return rejectedResult(run, command.commandId, 'Tile flip requires a current board target.', command);
    }
    const floorEvents: GameplayEvent[] = [];
    const flipTile = createFlipTileTransition({
        finalizeLevel: (candidateRun, board) => finalizeLevelThroughCore(candidateRun, board, {
            commandId: command.commandId,
            events: floorEvents
        })
    });
    const nextRun = flipTile(run, command.targetTileId);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Tile cannot be flipped in the current board state.', command);
    }
    const targetAfter = nextRun.board?.tiles.find((tile) => tile.id === command.targetTileId) ?? targetBefore;
    const lockedCacheKeyKind = targetBefore.dungeonKeyKind ?? 'iron';
    const lockedCacheKeyCountBefore = runNonNegativeInteger(run.dungeonKeys?.[lockedCacheKeyKind]);
    const lockedCacheKeyCountAfter = runNonNegativeInteger(nextRun.dungeonKeys?.[lockedCacheKeyKind]);
    const lockedCacheMasterKeysBefore = runNonNegativeInteger(run.dungeonMasterKeys);
    const lockedCacheMasterKeysAfter = runNonNegativeInteger(nextRun.dungeonMasterKeys);
    const lockedCacheOpened =
        targetBefore.dungeonCardEffectId === 'room_locked_cache' &&
        targetBefore.dungeonRoomUsed !== true &&
        targetAfter.dungeonRoomUsed === true;
    const trapsTriggeredBefore = runNonNegativeInteger(run.dungeonTrapsTriggered);
    const trapsTriggeredAfter = runNonNegativeInteger(nextRun.dungeonTrapsTriggered);
    const outcome = trapsTriggeredAfter > trapsTriggeredBefore
        ? 'trap_triggered'
        : targetBefore.pairKey === EXIT_PAIR_KEY
          ? 'exit_revealed'
          : targetBefore.pairKey === SHOP_PAIR_KEY
            ? 'shop_revealed'
            : targetBefore.pairKey === ROOM_PAIR_KEY
              ? 'room_resolved'
              : targetBefore.state === 'hidden' && targetAfter.state === 'flipped'
                ? 'flipped'
                : 'cleanup';
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, TILE_FLIP_SOURCE, events);
    const objectiveBefore = getGameplayFeedbackObjectiveSnapshot(run);
    const objectiveAfter = getGameplayFeedbackObjectiveSnapshot(nextRun);
    const hazardsAfter = new Map(
        (Array.isArray(nextRun.board?.enemyHazards) ? nextRun.board.enemyHazards : [])
            .map((hazard) => [hazard.id, hazard] as const)
    );
    const enemyHazardIdsDefeated = (Array.isArray(run.board?.enemyHazards) ? run.board.enemyHazards : [])
        .filter((hazard) =>
            hazard.state !== 'defeated' &&
            runNonNegativeInteger(hazard.hp) > 0 &&
            hazardsAfter.get(hazard.id)?.state === 'defeated'
        )
        .map((hazard) => hazard.id)
        .sort((left, right) => left.localeCompare(right));
    writeEvent({
        type: 'board.tile_flipped',
        targetTileId: command.targetTileId,
        outcome,
        tileStateBefore: targetBefore.state,
        tileStateAfter: targetAfter.state,
        flippedTileIdsBefore: runStringArray(run.board?.flippedTileIds),
        flippedTileIdsAfter: runStringArray(nextRun.board?.flippedTileIds),
        statusBefore: run.status,
        statusAfter: nextRun.status,
        resolveDelayMs:
            nextRun.status === 'resolving'
                ? Math.max(0, Math.floor(nextRun.timerState.resolveRemainingMs ?? 0))
                : null,
        trapsTriggeredBefore,
        trapsTriggeredAfter,
        livesBefore: runNonNegativeInteger(run.lives),
        livesAfter: runNonNegativeInteger(nextRun.lives),
        enemyHazardIdsDefeated,
        dungeonEnemiesDefeatedBefore: runNonNegativeInteger(run.dungeonEnemiesDefeated),
        dungeonEnemiesDefeatedAfter: runNonNegativeInteger(nextRun.dungeonEnemiesDefeated),
        dungeonEnemiesDefeatedThisFloorBefore: runNonNegativeInteger(run.dungeonEnemiesDefeatedThisFloor),
        dungeonEnemiesDefeatedThisFloorAfter: runNonNegativeInteger(nextRun.dungeonEnemiesDefeatedThisFloor),
        enemyHazardsDefeatedThisFloorBefore: runNonNegativeInteger(run.enemyHazardsDefeatedThisFloor),
        enemyHazardsDefeatedThisFloorAfter: runNonNegativeInteger(nextRun.enemyHazardsDefeatedThisFloor),
        boardComplete: nextRun.board ? isBoardComplete(nextRun.board) : false
    });
    if (lockedCacheOpened) {
        const spend = lockedCacheKeyCountAfter < lockedCacheKeyCountBefore ? 'key' : 'master_key';
        writeEvent({
            type: 'dungeon.locked_cache_opened',
            tileId: command.targetTileId,
            spend,
            keyKind: lockedCacheKeyKind,
            keyCountBefore: lockedCacheKeyCountBefore,
            keyCountAfter: lockedCacheKeyCountAfter,
            masterKeysBefore: lockedCacheMasterKeysBefore,
            masterKeysAfter: lockedCacheMasterKeysAfter,
            shopGoldBefore: runNonNegativeInteger(run.shopGold),
            shopGoldAfter: runNonNegativeInteger(nextRun.shopGold),
            scoreBefore: runNonNegativeInteger(normalizeSessionStats(run.stats).totalScore),
            scoreAfter: runNonNegativeInteger(normalizeSessionStats(nextRun.stats).totalScore)
        });
        writeEvent({
            type: 'feedback.requested',
            cue: 'dungeon.locked_cache.opened',
            message: `${spend === 'key' ? `${lockedCacheKeyKind} key` : 'Master Key'} opened ${targetBefore.label}; ${runNonNegativeInteger(nextRun.shopGold) - runNonNegativeInteger(run.shopGold)} shop gold recovered.`,
            tone: 'reward'
        });
    }
    if (outcome === 'trap_triggered') {
        writeEvent({
            type: 'feedback.requested',
            cue: 'board.tile.trap_triggered',
            message: `${targetBefore.label} sprung a trap; ${runNonNegativeInteger(nextRun.lives)} lives remain.`,
            tone: 'warning'
        });
    } else if (
        outcome === 'exit_revealed' ||
        outcome === 'shop_revealed' ||
        (outcome === 'room_resolved' && !lockedCacheOpened)
    ) {
        writeEvent({
            type: 'feedback.requested',
            cue: `board.tile.${outcome}`,
            message: `${targetBefore.label} ${outcome === 'room_resolved' ? 'resolved' : 'revealed'}.`,
            tone: 'information'
        });
    }
    if (enemyHazardIdsDefeated.length > 0) {
        writeEvent({
            type: 'feedback.requested',
            cue: 'hazard.enemy_blocker.cleared',
            message: `${enemyHazardIdsDefeated.length} enemy blocker${enemyHazardIdsDefeated.length === 1 ? '' : 's'} cleared from the final pair.`,
            tone: 'information'
        });
    }
    if (JSON.stringify(objectiveBefore) !== JSON.stringify(objectiveAfter) && objectiveAfter) {
        writeEvent({
            type: 'feedback.requested',
            cue: 'objective.progress.changed',
            message: `${objectiveAfter.label}: ${objectiveAfter.progress}/${objectiveAfter.required}.`,
            tone: 'information'
        });
    }
    appendReindexedEvents(command.commandId, floorEvents, events);
    return { run: nextRun, command, events, accepted: true };
};

const applyEnemyHazardContactCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'enemy_hazard.contact' }>
): GameplayCommandResult => {
    const hazard = (Array.isArray(run.board?.enemyHazards) ? run.board.enemyHazards : []).find(
        (candidate) =>
            candidate.currentTileId === command.targetTileId &&
            candidate.state !== 'defeated' &&
            runNonNegativeInteger(candidate.hp) > 0
    );
    if (!hazard) {
        return rejectedResult(run, command.commandId, 'No active enemy hazard occupies the selected tile.', command);
    }
    const nextRun = applyEnemyHazardClick(run, command.targetTileId, {
        advanceHazards: command.advanceHazards
    });
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Enemy hazard contact is not legal for the current run.', command);
    }
    const guardTokensBefore = runNonNegativeInteger(run.stats.guardTokens);
    const guardTokensAfter = runNonNegativeInteger(nextRun.stats.guardTokens);
    const livesBefore = runNonNegativeInteger(run.lives);
    const livesAfter = runNonNegativeInteger(nextRun.lives);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, ENEMY_HAZARD_CONTACT_SOURCE, events);
    writeEvent({
        type: 'enemy_hazard.contacted',
        hazardId: hazard.id,
        targetTileId: command.targetTileId,
        advanceHazards: command.advanceHazards,
        damage: runNonNegativeInteger(hazard.damage),
        guardTokensBefore,
        guardTokensAfter,
        livesBefore,
        livesAfter,
        pendingMemorizeBonusBefore: runNonNegativeInteger(run.pendingMemorizeBonusMs),
        pendingMemorizeBonusAfter: runNonNegativeInteger(nextRun.pendingMemorizeBonusMs),
        hazardTurnBefore: runNonNegativeInteger(run.board?.enemyHazardTurn),
        hazardTurnAfter: runNonNegativeInteger(nextRun.board?.enemyHazardTurn),
        enemyHazardHitsBefore: runNonNegativeInteger(run.enemyHazardHitsThisFloor),
        enemyHazardHitsAfter: runNonNegativeInteger(nextRun.enemyHazardHitsThisFloor),
        gameOver: nextRun.status === 'gameOver'
    });
    writeEvent({
        type: 'feedback.requested',
        cue: guardTokensAfter < guardTokensBefore
            ? 'hazard.enemy_contact.guard_absorbed'
            : 'hazard.enemy_contact.life_lost',
        message: guardTokensAfter < guardTokensBefore
            ? `${hazard.label} struck; Guard absorbed the hit.`
            : `${hazard.label} struck for ${livesBefore - livesAfter} life; ${livesAfter} remain.`,
        tone: guardTokensAfter < guardTokensBefore ? 'information' : 'warning'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyPinToggleCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.pin_toggle' }>
): GameplayCommandResult => {
    const nextRun = togglePinnedTile(run, command.targetTileId);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Pin toggle is not legal for the current run and target.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, PIN_SOURCE, events);
    const before = runStringArray(run.pinnedTileIds);
    const after = runStringArray(nextRun.pinnedTileIds);
    const pinned = after.includes(command.targetTileId);
    writeEvent({
        type: 'board.pin_changed',
        targetTileId: command.targetTileId,
        pinned,
        pinnedCountBefore: before.length,
        pinnedCountAfter: after.length,
        pinCapacity: maxPinnedTilesForRun(nextRun)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.pin.toggled',
        message: `${command.targetTileId} was ${pinned ? 'pinned' : 'unpinned'}; ${after.length}/${maxPinnedTilesForRun(nextRun)} pins active.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyStrayRemoveCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.stray_remove' }>
): GameplayCommandResult => {
    const nextRun = applyStrayRemove(run, command.targetTileId);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Stray Remove is not legal for the current run and target.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, STRAY_REMOVE_SOURCE, events);
    const before = runNonNegativeInteger(run.strayRemoveCharges);
    const after = runNonNegativeInteger(nextRun.strayRemoveCharges);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'stray_remove_charge',
        operation: 'consume',
        requested: 1,
        applied: after - before,
        before,
        after
    });
    writeEvent({
        type: 'board.stray_removed',
        targetTileId: command.targetTileId,
        strayChargesBefore: before,
        strayChargesAfter: after,
        ...memoryAidEventFacts(run, nextRun)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.stray_remove.used',
        message: `Stray Remove cleared ${command.targetTileId}; ${after} charge${after === 1 ? '' : 's'} remain.${memoryAidFeedbackSuffix(run, nextRun)}`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyDestroyPairCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.destroy_pair' }>
): GameplayCommandResult => {
    const target = run.board?.tiles.find((tile) => tile.id === command.targetTileId);
    const destroyedTileIds = target
        ? (run.board?.tiles ?? []).filter((tile) => tile.pairKey === target.pairKey).map((tile) => tile.id)
        : [];
    const transition = applyDestroyPairTransition(run, command.targetTileId, {
        isBoardComplete,
        rotateShiftingSpotlight: rotateRunShiftingSpotlight
    });
    if (!transition.changed || !target || destroyedTileIds.length !== 2) {
        return rejectedResult(run, command.commandId, 'Destroy Pair is not legal for this target.', command);
    }

    const nextRun = transition.run;
    const destroyChargesBefore = runNonNegativeInteger(run.destroyPairCharges);
    const destroyChargesAfter = runNonNegativeInteger(nextRun.destroyPairCharges);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, DESTROY_PAIR_SOURCE, events);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'destroy_charge',
        operation: 'consume',
        requested: 1,
        applied: destroyChargesAfter - destroyChargesBefore,
        before: destroyChargesBefore,
        after: destroyChargesAfter
    });
    writeEvent({
        type: 'board.pair_destroyed',
        targetTileId: command.targetTileId,
        pairKey: target.pairKey,
        destroyedTileIds: [destroyedTileIds[0]!, destroyedTileIds[1]!],
        destroyChargesBefore,
        destroyChargesAfter,
        matchedPairsBefore: runNonNegativeInteger(run.board?.matchedPairs),
        matchedPairsAfter: runNonNegativeInteger(nextRun.board?.matchedPairs),
        ...memoryAidEventFacts(run, nextRun),
        parasitePressureBefore: runNonNegativeInteger(run.parasiteFloors),
        parasitePressureAfter: runNonNegativeInteger(nextRun.parasiteFloors),
        shiftingSpotlightNonceBefore: runNonNegativeInteger(run.shiftingSpotlightNonce),
        shiftingSpotlightNonceAfter: runNonNegativeInteger(nextRun.shiftingSpotlightNonce),
        boardComplete: transition.boardComplete
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.destroy_pair.used',
        message: `${target.label} pair removed; ${destroyChargesAfter} Destroy charge${destroyChargesAfter === 1 ? '' : 's'} remain${transition.boardComplete ? ' and the floor route is clear' : ''}.${memoryAidFeedbackSuffix(run, nextRun)}`,
        tone: 'information'
    });
    const resolvedRun = transition.boardComplete && nextRun.board
        ? finalizeLevelThroughCore(nextRun, nextRun.board, { commandId: command.commandId, events })
        : nextRun;
    return { run: resolvedRun, command, events, accepted: true };
};

const applyPeekCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.peek' }>
): GameplayCommandResult => {
    const nextRun = applyPeek(run, command.targetTileId);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Peek is not legal for the current run and target.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, PEEK_SOURCE, events);
    const before = runNonNegativeInteger(run.peekCharges);
    const after = runNonNegativeInteger(nextRun.peekCharges);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'peek_charge',
        operation: 'consume',
        requested: 1,
        applied: after - before,
        before,
        after
    });
    const beforeTile = run.board?.tiles.find((tile) => tile.id === command.targetTileId);
    const afterTile = nextRun.board?.tiles.find((tile) => tile.id === command.targetTileId);
    writeEvent({
        type: 'board.peeked',
        targetTileId: command.targetTileId,
        peekChargesBefore: before,
        peekChargesAfter: after,
        ...memoryAidEventFacts(run, nextRun),
        routeSpecialRevealed:
            beforeTile?.routeSpecialRevealed !== true && afterTile?.routeSpecialRevealed === true
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.peek.used',
        message: `Peek revealed ${command.targetTileId}; ${after} charge${after === 1 ? '' : 's'} remain.${memoryAidFeedbackSuffix(run, nextRun)}`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyRiskWagerAcceptCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'risk_wager.accept' }>
): GameplayCommandResult => {
    const nextRun = acceptEndlessRiskWager(run);
    if (nextRun === run || nextRun.endlessRiskWager === null) {
        return rejectedResult(run, command.commandId, 'The Endless risk wager is not available.', command);
    }
    const wager = nextRun.endlessRiskWager;
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, RISK_WAGER_SOURCE, events);
    writeEvent({
        type: 'risk_wager.accepted',
        acceptedOnLevel: wager.acceptedOnLevel,
        targetLevel: wager.targetLevel,
        streakAtRisk: wager.streakAtRisk,
        bonusFavorOnSuccess: wager.bonusFavorOnSuccess
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'build.route_gambler.wager_accepted',
        message: `Wager accepted for floor ${wager.targetLevel}: ${wager.streakAtRisk} objective streak is at risk for ${wager.bonusFavorOnSuccess} Favor.`,
        tone: 'warning'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyGambitCommitCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.gambit_commit' }>
): GameplayCommandResult => {
    const flippedTileIds = run.board?.flippedTileIds;
    const target = run.board?.tiles.find((tile) => tile.id === command.targetTileId);
    if (
        run.status !== 'resolving' ||
        !run.gambitAvailableThisFloor ||
        run.gambitThirdFlipUsed ||
        !Array.isArray(flippedTileIds) ||
        flippedTileIds.length !== 2 ||
        flippedTileIds.some((tileId) => typeof tileId !== 'string') ||
        !target ||
        target.state !== 'hidden' ||
        flippedTileIds.includes(command.targetTileId)
    ) {
        return rejectedResult(run, command.commandId, 'Gambit cannot commit this third tile.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, GAMBIT_SOURCE, events);
    const committedTileIds: [string, string, string] = [
        flippedTileIds[0]!,
        flippedTileIds[1]!,
        command.targetTileId
    ];
    writeEvent({
        type: 'board.gambit_commit.requested',
        targetTileId: command.targetTileId,
        committedTileIds
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.gambit.committed',
        message: `Gambit committed ${committedTileIds.join(', ')} as a three-tile rescue.`,
        tone: 'warning'
    });
    return { run, command, events, accepted: true };
};

const applyShuffleCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.shuffle' }>
): GameplayCommandResult => {
    const nextRun = applyShuffle(run);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Full-board shuffle is not legal for the current run.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, SHUFFLE_SOURCE, events);
    const beforeCharges = runNonNegativeInteger(run.shuffleCharges);
    const afterCharges = runNonNegativeInteger(nextRun.shuffleCharges);
    const usedFreeCharge = run.freeShuffleThisFloor === true && nextRun.freeShuffleThisFloor === false;
    writeEvent({
        type: 'inventory.changed',
        itemId: 'shuffle_charge',
        operation: 'consume',
        requested: 1,
        applied: afterCharges - beforeCharges,
        before: beforeCharges,
        after: afterCharges
    });
    writeEvent({
        type: 'board.shuffled',
        affectedTileIds: (run.board?.tiles ?? [])
            .filter((tile) => tile.state === 'hidden')
            .map((tile) => tile.id),
        shuffleNonceBefore: runNonNegativeInteger(run.shuffleNonce),
        shuffleNonceAfter: runNonNegativeInteger(nextRun.shuffleNonce),
        ...memoryAidEventFacts(run, nextRun),
        usedFreeCharge
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.shuffle.used',
        message: `Full-board shuffle committed${usedFreeCharge ? ' its free use' : `; ${afterCharges} charge${afterCharges === 1 ? '' : 's'} remain`}.${memoryAidFeedbackSuffix(run, nextRun)}`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyRegionShuffleCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.region_shuffle' }>
): GameplayCommandResult => {
    const nextRun = applyRegionShuffle(run, command.rowIndex);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Row shuffle is not legal for the current run and row.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, REGION_SHUFFLE_SOURCE, events);
    const beforeCharges = runNonNegativeInteger(run.regionShuffleCharges);
    const afterCharges = runNonNegativeInteger(nextRun.regionShuffleCharges);
    const usedFreeCharge = run.regionShuffleFreeThisFloor === true && nextRun.regionShuffleFreeThisFloor === false;
    const columns = runNonNegativeInteger(run.board?.columns);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'region_shuffle_charge',
        operation: 'consume',
        requested: 1,
        applied: afterCharges - beforeCharges,
        before: beforeCharges,
        after: afterCharges
    });
    writeEvent({
        type: 'board.region_shuffled',
        rowIndex: command.rowIndex,
        affectedTileIds: (run.board?.tiles ?? [])
            .filter((tile, index) => tile.state === 'hidden' && columns > 0 && Math.floor(index / columns) === command.rowIndex)
            .map((tile) => tile.id),
        shuffleNonceBefore: runNonNegativeInteger(run.shuffleNonce),
        shuffleNonceAfter: runNonNegativeInteger(nextRun.shuffleNonce),
        ...memoryAidEventFacts(run, nextRun),
        usedFreeCharge
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.region_shuffle.used',
        message: `Row ${command.rowIndex + 1} shuffled${usedFreeCharge ? ' for free' : `; ${afterCharges} row/swap charge${afterCharges === 1 ? '' : 's'} remain`}.${memoryAidFeedbackSuffix(run, nextRun)}`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyTileSwapCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.tile_swap' }>
): GameplayCommandResult => {
    const nextRun = applyTileSwap(run, command.firstTileId, command.secondTileId);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Tile swap is not legal for the current run and targets.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, TILE_SWAP_SOURCE, events);
    const beforeCharges = runNonNegativeInteger(run.regionShuffleCharges);
    const afterCharges = runNonNegativeInteger(nextRun.regionShuffleCharges);
    const usedFreeCharge = run.regionShuffleFreeThisFloor === true && nextRun.regionShuffleFreeThisFloor === false;
    writeEvent({
        type: 'inventory.changed',
        itemId: 'region_shuffle_charge',
        operation: 'consume',
        requested: 1,
        applied: afterCharges - beforeCharges,
        before: beforeCharges,
        after: afterCharges
    });
    writeEvent({
        type: 'board.tiles_swapped',
        firstTileId: command.firstTileId,
        secondTileId: command.secondTileId,
        shuffleNonceBefore: runNonNegativeInteger(run.shuffleNonce),
        shuffleNonceAfter: runNonNegativeInteger(nextRun.shuffleNonce),
        ...memoryAidEventFacts(run, nextRun),
        usedFreeCharge
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.tile_swap.used',
        message: `${command.firstTileId} swapped with ${command.secondTileId}${usedFreeCharge ? ' for free' : `; ${afterCharges} row/swap charge${afterCharges === 1 ? '' : 's'} remain`}.${memoryAidFeedbackSuffix(run, nextRun)}`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyFlashPairCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.flash_pair' }>
): GameplayCommandResult => {
    const nextRun = applyFlashPair(run);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Flash Pair is not legal for the current run.', command);
    }
    const revealedTileIds = runStringArray(nextRun.flashPairRevealedTileIds);
    if (revealedTileIds.length !== 2) {
        return rejectedResult(run, command.commandId, 'Flash Pair did not reveal exactly one pair.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, FLASH_PAIR_SOURCE, events);
    const beforeCharges = runNonNegativeInteger(run.flashPairCharges);
    const afterCharges = runNonNegativeInteger(nextRun.flashPairCharges);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'flash_pair_charge',
        operation: 'consume',
        requested: 1,
        applied: afterCharges - beforeCharges,
        before: beforeCharges,
        after: afterCharges
    });
    writeEvent({
        type: 'board.flash_pair_revealed',
        revealedTileIds: [revealedTileIds[0]!, revealedTileIds[1]!],
        flashChargesBefore: beforeCharges,
        flashChargesAfter: afterCharges,
        shuffleNonceBefore: runNonNegativeInteger(run.shuffleNonce),
        shuffleNonceAfter: runNonNegativeInteger(nextRun.shuffleNonce)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.flash_pair.used',
        message: `Flash Pair revealed ${revealedTileIds.join(' and ')}; ${afterCharges} charge${afterCharges === 1 ? '' : 's'} remain.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyUndoResolveCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.undo_resolve' }>
): GameplayCommandResult => {
    const restoredTileIds = runStringArray(run.board?.flippedTileIds);
    const nextRun = cancelResolvingWithUndo(run);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Undo is not legal for the current resolving turn.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, UNDO_RESOLVE_SOURCE, events);
    const beforeUses = runNonNegativeInteger(run.undoUsesThisFloor);
    const afterUses = runNonNegativeInteger(nextRun.undoUsesThisFloor);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'undo_charge',
        operation: 'consume',
        requested: 1,
        applied: afterUses - beforeUses,
        before: beforeUses,
        after: afterUses
    });
    writeEvent({
        type: 'board.resolve_undone',
        restoredTileIds,
        undoUsesBefore: beforeUses,
        undoUsesAfter: afterUses,
        ...memoryAidEventFacts(run, nextRun)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.undo_resolve.used',
        message: `Pending flip cancelled; ${afterUses} undo use${afterUses === 1 ? '' : 's'} remain this floor.${memoryAidFeedbackSuffix(run, nextRun)}`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyShopPurchaseCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'shop.purchase' }>
): GameplayCommandResult => {
    if (!hasLiveShopInterlude(run)) {
        return rejectedResult(run, command.commandId, 'Shop purchase requires a live shop interlude.', command);
    }
    const offer = (Array.isArray(run.shopOffers) ? run.shopOffers : []).find(
        (candidate) => candidate.id === command.offerId
    );
    const nextRun = purchaseShopOffer(run, command.offerId);
    if (nextRun === run || !offer) {
        return rejectedResult(run, command.commandId, 'Shop offer cannot be purchased.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, SHOP_SOURCE, events);
    const shopGoldBefore = runNonNegativeInteger(run.shopGold);
    const shopGoldAfter = runNonNegativeInteger(nextRun.shopGold);
    const masterKeysBefore = runNonNegativeInteger(run.dungeonMasterKeys);
    const masterKeysAfter = runNonNegativeInteger(nextRun.dungeonMasterKeys);
    writeEvent({
        type: 'shop.offer_purchased',
        offerId: offer.id,
        itemId: offer.itemId,
        cost: runNonNegativeInteger(offer.cost),
        shopGoldBefore,
        shopGoldAfter,
        masterKeysBefore,
        masterKeysAfter
    });
    writeEvent({
        type: 'feedback.requested',
        cue: offer.itemId === 'master_key' ? 'shop.master_key.purchased' : 'shop.offer.purchased',
        message: `${offer.label} purchased for ${shopGoldBefore - shopGoldAfter} shop gold; ${shopGoldAfter} remains.`,
        tone: 'reward'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyShopRerollCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'shop.reroll' }>
): GameplayCommandResult => {
    if (!hasLiveShopInterlude(run)) {
        return rejectedResult(run, command.commandId, 'Shop reroll requires a live shop interlude.', command);
    }
    const nextRun = rerollShopOffers(run);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Shop stock cannot be rerolled.', command);
    }
    const shopGoldBefore = runNonNegativeInteger(run.shopGold);
    const shopGoldAfter = runNonNegativeInteger(nextRun.shopGold);
    const rerollsBefore = runNonNegativeInteger(run.shopRerolls);
    const rerollsAfter = runNonNegativeInteger(nextRun.shopRerolls);
    const offersBefore = runShopOffers(run.shopOffers);
    const offersAfter = runShopOffers(nextRun.shopOffers);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, SHOP_SOURCE, events);
    writeEvent({
        type: 'shop.stock_rerolled',
        floor: Math.max(1, runNonNegativeInteger(run.board?.level ?? normalizeSessionStats(run.stats).highestLevel)),
        cost: shopGoldBefore - shopGoldAfter,
        shopGoldBefore,
        shopGoldAfter,
        rerollsBefore,
        rerollsAfter,
        offerIdsBefore: offersBefore.map((offer) => offer.id),
        offerIdsAfter: offersAfter.map((offer) => offer.id),
        itemIdsBefore: offersBefore.map((offer) => offer.itemId),
        itemIdsAfter: offersAfter.map((offer) => offer.itemId)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'shop.stock.rerolled',
        message: `Shop stock rerolled for ${shopGoldBefore - shopGoldAfter} shop gold; ${shopGoldAfter} remains.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyDungeonExitActivateCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'dungeon.exit_activate' }>
): GameplayCommandResult => {
    const status = getDungeonExitStatus(run);
    const transition = createDungeonExitActivationTransition(run, command.spend);
    if (!transition || !status.exitTile) {
        return rejectedResult(run, command.commandId, 'Dungeon exit cannot be activated with the requested spend.', command);
    }
    const nextRun = transition.run;
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, DUNGEON_EXIT_SOURCE, events);
    const masterKeysBefore = runNonNegativeInteger(run.dungeonMasterKeys);
    const masterKeysAfter = runNonNegativeInteger(nextRun.dungeonMasterKeys);
    const gatewayUsesBefore = runNonNegativeInteger(run.dungeonGatewaysUsed);
    const gatewayUsesAfter = runNonNegativeInteger(nextRun.dungeonGatewaysUsed);
    const keyKind =
        command.spend === 'key' && status.lockKind !== 'none' && status.lockKind !== 'lever'
            ? status.lockKind
            : null;
    writeEvent({
        type: 'dungeon.exit_activated',
        exitTileId: status.exitTile.id,
        spend: command.spend,
        keyKind,
        masterKeysBefore,
        masterKeysAfter,
        gatewayUsesBefore,
        gatewayUsesAfter,
        routeType: status.routeType ?? null
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'dungeon.exit.activated',
        message: command.spend === 'master_key'
            ? `Master Key opened the ${status.lockKind} exit.`
            : command.spend === 'key'
              ? `${status.lockKind} key opened the exit.`
              : 'Dungeon exit activated without spending a key.',
        tone: 'information'
    });
    const resolvedRun = finalizeLevelThroughCore(nextRun, transition.board, {
        commandId: command.commandId,
        events
    });
    return { run: resolvedRun, command, events, accepted: true };
};

const applyParasiteAdvanceCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'floor.parasite_advance' }>
): GameplayCommandResult => {
    if (run.status !== 'levelComplete' || !run.board) {
        return rejectedResult(run, command.commandId, 'Score-parasite pressure advances only from a cleared floor.', command);
    }
    const pressureBefore = runNonNegativeInteger(run.parasiteFloors);
    const wardBefore = runNonNegativeInteger(run.parasiteWardRemaining);
    const livesBefore = runNonNegativeInteger(run.lives);
    const advanced = advanceScoreParasiteFloor(run);
    const nextRun: RunState = {
        ...run,
        lives: advanced.lives,
        parasiteFloors: advanced.parasiteFloors,
        parasiteWardRemaining: advanced.parasiteWardRemaining
    };
    const active = hasMutator(run, 'score_parasite');
    const thresholdTriggered = active && pressureBefore + 1 >= 4;
    const wardConsumed = advanced.parasiteWardRemaining < wardBefore;
    const lifeLost = advanced.lives < livesBefore;
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, SCORE_PARASITE_SOURCE, events);
    writeEvent({
        type: 'score_parasite.advanced',
        active,
        pressureBefore,
        pressureAfter: advanced.parasiteFloors,
        wardBefore,
        wardAfter: advanced.parasiteWardRemaining,
        livesBefore,
        livesAfter: advanced.lives,
        thresholdTriggered,
        wardConsumed,
        lifeLost
    });
    if (active && pressureBefore < 3 && advanced.parasiteFloors === 3) {
        writeEvent({
            type: 'feedback.requested',
            cue: 'hazard.score_parasite.drain_warning',
            message: 'Score Parasite: next cleared floor triggers the drain unless warded.',
            tone: 'warning'
        });
    } else if (wardConsumed) {
        writeEvent({
            type: 'feedback.requested',
            cue: 'hazard.score_parasite.ward_consumed',
            message: `Parasite Ward absorbed the life loss; ${advanced.parasiteWardRemaining} charge${advanced.parasiteWardRemaining === 1 ? '' : 's'} remain.`,
            tone: 'reward'
        });
    } else if (lifeLost) {
        writeEvent({
            type: 'feedback.requested',
            cue: 'hazard.score_parasite.life_lost',
            message: `Score Parasite consumed one life; ${advanced.lives} ${advanced.lives === 1 ? 'life remains' : 'lives remain'}.`,
            tone: 'warning'
        });
    }
    return { run: nextRun, command, events, accepted: true };
};

const applyHazardBanishCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'floor.hazard_banish' }>
): GameplayCommandResult => {
    if (run.status !== 'memorize' || !run.board) {
        return rejectedResult(run, command.commandId, 'Hazard Banish resolves only on a prepared next floor.', command);
    }
    const resolved = resolveHazardBanisherFloorStart(run);
    if (resolved.outcome === 'inactive') {
        return rejectedResult(run, command.commandId, 'Hazard Banish perk is not active.', command);
    }

    const destroyChargesBefore = runNonNegativeInteger(run.destroyPairCharges);
    const destroyChargesAfter = runNonNegativeInteger(resolved.run.destroyPairCharges);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, HAZARD_BANISH_SOURCE, events);
    if (resolved.outcome === 'destroy_charge_granted') {
        writeEvent({
            type: 'inventory.changed',
            itemId: 'destroy_charge',
            operation: 'grant',
            requested: 1,
            applied: destroyChargesAfter - destroyChargesBefore,
            before: destroyChargesBefore,
            after: destroyChargesAfter
        });
    }
    writeEvent({
        type: 'hazard_banish.resolved',
        outcome: resolved.outcome,
        floor: run.board.level,
        targetPairKey: resolved.targetPairKey,
        hazardKind: resolved.hazardKind,
        affectedTileIds: resolved.affectedTileIds,
        destroyChargesBefore,
        destroyChargesAfter
    });
    writeEvent({
        type: 'feedback.requested',
        cue: resolved.outcome === 'hazard_removed'
            ? 'perk.hazard_banish.hazard_removed'
            : resolved.outcome === 'destroy_charge_granted'
              ? 'perk.hazard_banish.destroy_granted'
              : 'perk.hazard_banish.contract_blocked',
        message: resolved.outcome === 'hazard_removed'
            ? `Hazard Banish cleared ${resolved.hazardKind ?? 'hazard'} pressure from ${resolved.affectedTileIds.length} tiles.`
            : resolved.outcome === 'destroy_charge_granted'
              ? `No hazard marker was present; Hazard Banish banked one Destroy charge (${destroyChargesAfter}).`
              : 'The active no-Destroy contract suppressed Hazard Banish this floor.',
        tone: resolved.outcome === 'contract_blocked' ? 'warning' : 'reward'
    });
    return { run: resolved.run, command, events, accepted: true };
};

const applyFloorAdvanceCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'floor.advance' }>
): GameplayCommandResult => {
    if (run.status !== 'levelComplete' || !run.board) {
        return rejectedResult(run, command.commandId, 'Floor advancement requires a cleared floor.', command);
    }
    if (runNonNegativeInteger(run.lives) <= 0) {
        return rejectedResult(run, command.commandId, 'A defeated run cannot advance to another floor.', command);
    }
    if (run.gameMode === 'puzzle') {
        return rejectedResult(run, command.commandId, 'Puzzle runs do not advance into procedural floors.', command);
    }
    if (run.sideRoom || run.relicOffer) {
        return rejectedResult(run, command.commandId, 'Resolve the current floor interlude before advancing.', command);
    }

    const fromFloor = run.board.level;
    const events: GameplayEvent[] = [];
    const parasiteResult = applyParasiteAdvanceCommand(run, {
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId: command.commandId,
        type: 'floor.parasite_advance'
    });
    if (!parasiteResult.accepted) {
        return rejectedResult(run, command.commandId, 'Floor parasite pressure could not be resolved.', command);
    }
    appendReindexedEvents(command.commandId, parasiteResult.events, events);

    let nextRun = advanceToNextLevel(run, {
        parasiteAdvance: {
            lives: parasiteResult.run.lives,
            parasiteFloors: parasiteResult.run.parasiteFloors,
            parasiteWardRemaining: parasiteResult.run.parasiteWardRemaining
        },
        resolveHazardBanish: false
    });
    let hazardBanishOutcome: 'contract_blocked' | 'hazard_removed' | 'destroy_charge_granted' | null = null;
    if (nextRun.status === 'memorize' && hasGameplayRewardPerk(nextRun, 'hazard_banish_per_floor')) {
        const hazardResult = applyHazardBanishCommand(nextRun, {
            schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
            commandId: command.commandId,
            type: 'floor.hazard_banish'
        });
        if (!hazardResult.accepted) {
            throw new Error('Hazard Banish was active on the prepared floor but its typed transition rejected.');
        }
        nextRun = hazardResult.run;
        hazardBanishOutcome = hazardResult.events.find(
            (event): event is Extract<GameplayEvent, { type: 'hazard_banish.resolved' }> =>
                event.type === 'hazard_banish.resolved'
        )?.outcome ?? null;
        appendReindexedEvents(command.commandId, hazardResult.events, events);
    }

    const nextBoard = nextRun.status === 'memorize' ? nextRun.board : null;
    const writeEvent = makeEventWriter(command.commandId, FLOOR_ADVANCE_SOURCE, events);
    writeEvent({
        type: 'floor.advanced',
        fromFloor,
        toFloor: fromFloor + 1,
        outcome: nextRun.status === 'gameOver' ? 'game_over' : 'memorize',
        nextFloorTag: nextBoard?.floorTag ?? null,
        nextFloorArchetypeId: nextBoard?.floorArchetypeId ?? null,
        nextFeaturedObjectiveId: nextBoard?.featuredObjectiveId ?? null,
        selectedDungeonNodeId: run.dungeonRun?.selectedNodeId ?? null,
        boardPairCount: nextBoard?.pairCount ?? 0,
        boardTileCount: nextBoard?.tiles.length ?? 0,
        memorizeRemainingMs: nextRun.status === 'memorize'
            ? nextRun.timerState?.memorizeRemainingMs ?? null
            : null,
        livesBefore: runNonNegativeInteger(run.lives),
        livesAfter: runNonNegativeInteger(nextRun.lives),
        parasitePressureBefore: runNonNegativeInteger(run.parasiteFloors),
        parasitePressureAfter: runNonNegativeInteger(nextRun.parasiteFloors),
        parasiteWardBefore: runNonNegativeInteger(run.parasiteWardRemaining),
        parasiteWardAfter: runNonNegativeInteger(nextRun.parasiteWardRemaining),
        hazardBanishOutcome,
        destroyChargesBefore: runNonNegativeInteger(run.destroyPairCharges),
        destroyChargesAfter: runNonNegativeInteger(nextRun.destroyPairCharges)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: nextRun.status === 'gameOver' ? 'floor.advance.defeated' : 'floor.advance.ready',
        message: nextRun.status === 'gameOver'
            ? 'Score Parasite ended the run before the next floor could be prepared.'
            : `Floor ${fromFloor + 1} is ready to memorize (${nextBoard?.pairCount ?? 0} pairs).`,
        tone: nextRun.status === 'gameOver' ? 'warning' : 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyRouteChooseCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'route.choose' }>
): GameplayCommandResult => {
    const outcome = applyRouteChoiceOutcome(run, command.choiceId);
    if (!outcome.applied || !outcome.routeType || !outcome.outcomeKind || !outcome.summaryText) {
        return rejectedResult(
            run,
            command.commandId,
            `Route choice is not available${outcome.reason ? ` (${outcome.reason})` : ''}.`,
            command
        );
    }

    const statsBefore = normalizeSessionStats(run.stats);
    const nextRun = openRouteSideRoom(outcome.run);
    const sideRoom = nextRun.sideRoom;
    if (!sideRoom) {
        return rejectedResult(run, command.commandId, 'Route choice could not open its deterministic side room.', command);
    }
    const statsAfter = normalizeSessionStats(nextRun.stats);
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, ROUTE_CHOICE_SOURCE, events);
    writeEvent({
        type: 'route.choice_selected',
        choiceId: command.choiceId,
        routeType: outcome.routeType,
        outcome: outcome.outcomeKind,
        summaryText: outcome.summaryText,
        selectedDungeonNodeId: nextRun.dungeonRun?.selectedNodeId ?? null,
        livesBefore: runNonNegativeInteger(run.lives),
        livesAfter: runNonNegativeInteger(nextRun.lives),
        shopGoldBefore: runNonNegativeInteger(run.shopGold),
        shopGoldAfter: runNonNegativeInteger(nextRun.shopGold),
        totalScoreBefore: statsBefore.totalScore,
        totalScoreAfter: statsAfter.totalScore,
        guardTokensBefore: statsBefore.guardTokens,
        guardTokensAfter: statsAfter.guardTokens,
        comboShardsBefore: statsBefore.comboShards,
        comboShardsAfter: statsAfter.comboShards,
        relicFavorBefore: runNonNegativeInteger(run.relicFavorProgress),
        relicFavorAfter: runNonNegativeInteger(nextRun.relicFavorProgress),
        memorizeBonusMsBefore: runNonNegativeInteger(run.pendingMemorizeBonusMs),
        memorizeBonusMsAfter: runNonNegativeInteger(nextRun.pendingMemorizeBonusMs)
    });
    const choices = Array.isArray(sideRoom.choices) ? sideRoom.choices : [];
    const payloadId = sideRoom.payload.kind === 'rest_heal'
        ? sideRoom.payload.serviceId
        : sideRoom.payload.kind === 'event_choice'
          ? sideRoom.payload.choiceId
          : sideRoom.payload.instanceId;
    writeEvent({
        type: 'side_room.opened',
        roomId: sideRoom.id,
        roomKind: sideRoom.kind,
        routeType: sideRoom.routeType,
        nodeKind: sideRoom.nodeKind,
        floor: sideRoom.floor,
        payloadKind: sideRoom.payload.kind,
        payloadId,
        eventKey: sideRoom.payload.kind === 'event_choice' ? sideRoom.payload.eventKey : null,
        choiceIds: choices.map((choice) => choice.id),
        primaryChoiceId:
            choices.find((choice) => choice.primary)?.id ??
            (sideRoom.payload.kind === 'event_choice' ? sideRoom.payload.choiceId : null)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: `route.choice.${outcome.routeType}`,
        message: outcome.summaryText,
        tone: outcome.routeType === 'greed' ? 'warning' : 'reward'
    });
    return { run: nextRun, command, events, accepted: true };
};

const gameplayBonusRewardIds = new Set<BonusRewardId>(GAMEPLAY_BONUS_REWARD_IDS);

const bonusRewardIdFromInstance = (run: RunState, floor: number, instanceId: string): BonusRewardId | null => {
    const prefix = `${run.runRulesVersion}:${run.runSeed}:${floor}:`;
    if (!instanceId.startsWith(prefix)) {
        return null;
    }
    const rewardId = instanceId.slice(prefix.length) as BonusRewardId;
    return gameplayBonusRewardIds.has(rewardId) ? rewardId : null;
};

const applySideRoomResolveCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'side_room.resolve' }>
): GameplayCommandResult => {
    const room = run.sideRoom;
    if (run.status !== 'levelComplete' || run.lives <= 0 || !room) {
        return rejectedResult(run, command.commandId, 'Side-room action requires a live completed-floor interlude.', command);
    }

    const statsBefore = normalizeSessionStats(run.stats);
    const events: GameplayEvent[] = [];
    let nextRun: RunState = run;
    let choiceId: string | null = command.choiceId ?? null;
    let outcome: 'rest_healed' | 'event_applied' | 'bonus_claimed' | 'skipped' = 'skipped';
    let rewardId: BonusRewardId | null = null;
    let eventEffect: RunEventChoiceEffect | null = null;
    let resultMessage = 'Side room skipped.';

    if (command.action === 'skip') {
        nextRun = { ...run, sideRoom: null };
    } else if (room.payload.kind === 'rest_heal') {
        const lives = Math.min(MAX_LIVES, runNonNegativeInteger(run.lives) + 1);
        choiceId = room.payload.serviceId;
        outcome = 'rest_healed';
        resultMessage = lives > runNonNegativeInteger(run.lives)
            ? 'The quiet rest restored one life.'
            : 'The quiet rest preserved the current life total.';
        nextRun = {
            ...run,
            sideRoom: null,
            lives,
            lastLevelResult: run.lastLevelResult
                ? { ...run.lastLevelResult, livesRemaining: lives }
                : run.lastLevelResult,
            shopGold: Math.max(0, runNonNegativeInteger(run.shopGold) - 1)
        };
    } else if (room.payload.kind === 'event_choice') {
        const event = rollRunEventRoom({
            runSeed: run.runSeed,
            rulesVersion: run.runRulesVersion,
            floor: room.floor
        });
        const selectedChoiceId = command.choiceId ?? room.payload.choiceId;
        const selectedChoice = event.options.find((option) => option.id === selectedChoiceId);
        if (event.eventKey !== room.payload.eventKey || !selectedChoice) {
            return rejectedResult(run, command.commandId, 'Side-room event choice is stale or unavailable.', command);
        }
        const applied = applyRunEventChoice({ ...run, sideRoom: null }, event, selectedChoiceId);
        if (!applied.applied) {
            return rejectedResult(run, command.commandId, 'Side-room event choice could not be applied.', command);
        }
        choiceId = selectedChoiceId;
        eventEffect = selectedChoice.effect;
        outcome = 'event_applied';
        resultMessage = selectedChoice.resultText;
        nextRun = applied.run;
    } else {
        const selectedInstanceId = command.choiceId
            ?? (Array.isArray(room.choices) ? room.choices.find((choice) => choice.primary)?.id : undefined)
            ?? room.payload.instanceId;
        const visibleChoiceIds = Array.isArray(room.choices) ? room.choices.map((choice) => choice.id) : [];
        if (visibleChoiceIds.length > 0 && !visibleChoiceIds.includes(selectedInstanceId)) {
            return rejectedResult(run, command.commandId, 'Bonus reward choice is not part of the open draft.', command);
        }
        rewardId = bonusRewardIdFromInstance(run, room.floor, selectedInstanceId);
        const rules = rewardId ? GAMEPLAY_BONUS_REWARD_RULES[rewardId] : null;
        const ledger = run.bonusRewardLedger;
        const claimedInstanceIds = runStringArray(ledger?.claimedInstanceIds);
        const claimedCount = rewardId
            ? runNonNegativeInteger(ledger?.claimedRewardIds?.[rewardId])
            : 0;
        if (
            !rewardId
            || !rules
            || room.floor < rules.minFloor
            || claimedInstanceIds.includes(selectedInstanceId)
            || claimedCount >= rules.maxClaims
            || (rules.roomKind === 'secret_room' && runNonNegativeInteger(ledger?.discoveredSecretRooms) >= 1)
        ) {
            return rejectedResult(run, command.commandId, 'Bonus reward choice is stale or ineligible.', command);
        }
        const definition = getGameplayContentDefinition(`bonus_reward.${rewardId}`);
        const effectCommand = definition
            ? createGameplayDefinitionCommand(command.commandId, definition.id)
            : null;
        if (!definition || definition.source.kind !== 'bonus_reward' || effectCommand?.type !== 'effects.apply') {
            return rejectedResult(run, command.commandId, 'Bonus reward has no matching gameplay definition.', command);
        }
        const applied = applyDefinition({ ...run, sideRoom: null }, effectCommand, definition, events);
        if (!applied.accepted) {
            return rejectedResult(run, command.commandId, 'Bonus reward definition rejected the claim.', command);
        }
        nextRun = applied.run;
        if (
            rules.roomKind === 'treasure_chest'
            && runNonNegativeInteger(ledger?.openedTreasureRooms) === 0
            && hasRunRelic(run, 'shrine_echo')
        ) {
            const shrineDefinition = getGameplayContentDefinition('relic.shrine_echo.treasure_claim');
            const shrineCommand = shrineDefinition
                ? createGameplayDefinitionCommand(command.commandId, shrineDefinition.id)
                : null;
            if (shrineDefinition && shrineCommand?.type === 'effects.apply') {
                const shrineApplied = applyDefinition(nextRun, shrineCommand, shrineDefinition, events);
                if (shrineApplied.accepted) {
                    nextRun = shrineApplied.run;
                }
            }
        }
        choiceId = selectedInstanceId;
        outcome = 'bonus_claimed';
        resultMessage = `${rewardId.replaceAll('_', ' ')} claimed.`;
        nextRun = {
            ...nextRun,
            bonusRewardLedger: {
                claimedInstanceIds: [...new Set([...claimedInstanceIds, selectedInstanceId])],
                claimedRewardIds: {
                    ...(ledger?.claimedRewardIds ?? {}),
                    [rewardId]: claimedCount + 1
                },
                discoveredSecretRooms: runNonNegativeInteger(ledger?.discoveredSecretRooms)
                    + (rules.roomKind === 'secret_room' ? 1 : 0),
                openedTreasureRooms: runNonNegativeInteger(ledger?.openedTreasureRooms)
                    + (rules.roomKind === 'treasure_chest' ? 1 : 0)
            }
        };
    }

    const statsAfter = normalizeSessionStats(nextRun.stats);
    const writeEvent = makeEventWriter(command.commandId, SIDE_ROOM_SOURCE, events);
    writeEvent({
        type: 'side_room.resolved',
        roomId: room.id,
        roomKind: room.kind,
        routeType: room.routeType,
        nodeKind: room.nodeKind,
        action: command.action,
        choiceId,
        outcome,
        rewardId,
        eventEffect,
        livesBefore: runNonNegativeInteger(run.lives),
        livesAfter: runNonNegativeInteger(nextRun.lives),
        shopGoldBefore: runNonNegativeInteger(run.shopGold),
        shopGoldAfter: runNonNegativeInteger(nextRun.shopGold),
        totalScoreBefore: statsBefore.totalScore,
        totalScoreAfter: statsAfter.totalScore,
        guardTokensBefore: statsBefore.guardTokens,
        guardTokensAfter: statsAfter.guardTokens,
        comboShardsBefore: statsBefore.comboShards,
        comboShardsAfter: statsAfter.comboShards,
        relicFavorBefore: runNonNegativeInteger(run.relicFavorProgress),
        relicFavorAfter: runNonNegativeInteger(nextRun.relicFavorProgress),
        destroyChargesBefore: getRunInventoryItemQuantity(run, 'destroy_charge'),
        destroyChargesAfter: getRunInventoryItemQuantity(nextRun, 'destroy_charge'),
        peekChargesBefore: getRunInventoryItemQuantity(run, 'peek_charge'),
        peekChargesAfter: getRunInventoryItemQuantity(nextRun, 'peek_charge'),
        regionShuffleChargesBefore: getRunInventoryItemQuantity(run, 'region_shuffle_charge'),
        regionShuffleChargesAfter: getRunInventoryItemQuantity(nextRun, 'region_shuffle_charge'),
        ironKeysBefore: getRunInventoryItemQuantity(run, 'iron_key'),
        ironKeysAfter: getRunInventoryItemQuantity(nextRun, 'iron_key'),
        rewardPerkCountBefore: normalizeGameplayRewardPerkIds(run.rewardPerkIds).length,
        rewardPerkCountAfter: normalizeGameplayRewardPerkIds(nextRun.rewardPerkIds).length
    });
    if (outcome !== 'bonus_claimed') {
        writeEvent({
            type: 'feedback.requested',
            cue: `side_room.${outcome}`,
            message: resultMessage,
            tone: command.action === 'skip' ? 'information' : 'reward'
        });
    }
    return { run: nextRun, command, events, accepted: true };
};

const applyRelicPickCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'relic.pick' }>
): GameplayCommandResult => {
    const repairedRun = repairRunProgressionSoftlocks(run);
    const offer = repairedRun.relicOffer;
    const definition = getGameplayContentDefinition(`relic.${command.relicId}`);
    if (!offer || !definition || definition.source.kind !== 'relic' || definition.source.id !== command.relicId) {
        return rejectedResult(run, command.commandId, 'Relic pick has no matching open offer or definition.', command);
    }

    const events: GameplayEvent[] = [];
    const effectCommand = createGameplayDefinitionCommand(command.commandId, definition.id);
    if (effectCommand.type !== 'effects.apply') {
        return rejectedResult(run, command.commandId, 'Relic definition did not produce an effect command.', command);
    }
    let effectAccepted = false;
    const transition = createRelicPickTransitionResult(
        repairedRun,
        command.relicId,
        (ownedRun) => {
            const effectResult = applyDefinition(ownedRun, effectCommand, definition, events);
            effectAccepted = effectResult.accepted;
            return effectResult.run;
        }
    );
    if (transition.kind === 'unchanged' || !effectAccepted) {
        return rejectedResult(run, command.commandId, 'Relic is not eligible for the current draft offer.', command);
    }

    const nextOffer = transition.run.relicOffer;
    const pickRoundBefore = runNonNegativeInteger(offer.pickRound);
    const writeEvent = makeEventWriter(command.commandId, definition.source, events);
    writeEvent({
        type: 'relic.picked',
        relicId: command.relicId,
        definitionId: definition.id,
        buildId: definition.buildId ?? null,
        offerTier: runNonNegativeInteger(offer.tier),
        pickRoundBefore,
        pickRoundAfter: nextOffer ? runNonNegativeInteger(nextOffer.pickRound) : pickRoundBefore + 1,
        picksRemainingBefore: runNonNegativeInteger(offer.picksRemaining),
        picksRemainingAfter: nextOffer ? runNonNegativeInteger(nextOffer.picksRemaining) : 0,
        outcome: transition.kind === 'offerContinues' ? 'offer_continues' : 'advance_ready',
        nextOptions: nextOffer?.options ?? [],
        relicCountBefore: Array.isArray(repairedRun.relicIds) ? repairedRun.relicIds.length : 0,
        relicCountAfter: Array.isArray(transition.run.relicIds) ? transition.run.relicIds.length : 1,
        relicTiersBefore: runNonNegativeInteger(repairedRun.relicTiersClaimed),
        relicTiersAfter: runNonNegativeInteger(transition.run.relicTiersClaimed)
    });
    return { run: transition.run, command, events, accepted: true };
};

const applyRelicOfferOpenCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'relic.offer_open' }>
): GameplayCommandResult => {
    const repairedRun = repairRunProgressionSoftlocks(run);
    if (!needsRelicPick(repairedRun) || repairedRun.sideRoom) {
        return rejectedResult(
            run,
            command.commandId,
            'Relic offer opening requires an eligible cleared milestone with no unresolved side room.',
            command
        );
    }

    const clearedFloor = repairedRun.lastLevelResult!.level;
    const tierIndex = relicMilestoneIndexForFloor(clearedFloor);
    if (tierIndex === null) {
        return rejectedResult(run, command.commandId, 'Relic offer milestone is not available.', command);
    }
    const nextRun = openRelicOffer(repairedRun);
    if (nextRun === repairedRun) {
        return rejectedResult(run, command.commandId, 'Relic offer could not be opened.', command);
    }

    const offer = nextRun.relicOffer;
    const options = offer?.options ?? [];
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, RELIC_OFFER_SOURCE, events);
    writeEvent({
        type: 'relic.offer_opened',
        outcome: offer ? 'opened' : 'milestone_skipped',
        clearedFloor,
        offerTier: offer?.tier ?? tierIndex + 1,
        options,
        picksRemaining: runNonNegativeInteger(offer?.picksRemaining),
        availableServiceIds: (offer?.services ?? [])
            .filter((service) => service.available)
            .map((service) => service.serviceId),
        contextualReasonRelicIds: options.filter(
            (relicId) => Boolean(offer?.contextualOptionReasons?.[relicId])
        ),
        bonusPicksBefore: runNonNegativeInteger(repairedRun.bonusRelicPicksNextOffer),
        bonusPicksAfter: runNonNegativeInteger(nextRun.bonusRelicPicksNextOffer),
        favorBonusPicksBefore: runNonNegativeInteger(repairedRun.favorBonusRelicPicksNextOffer),
        favorBonusPicksAfter: runNonNegativeInteger(nextRun.favorBonusRelicPicksNextOffer),
        favorBonusPicksInOffer: runNonNegativeInteger(offer?.favorBonusPicks),
        relicTiersBefore: runNonNegativeInteger(repairedRun.relicTiersClaimed),
        relicTiersAfter: runNonNegativeInteger(nextRun.relicTiersClaimed)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: offer ? 'relic.offer.opened' : 'relic.offer.milestone_skipped',
        message: offer
            ? `Relic draft tier ${offer.tier} opened with ${offer.options.length} choices and ${offer.picksRemaining} pick${offer.picksRemaining === 1 ? '' : 's'}.`
            : `Relic draft tier ${tierIndex + 1} had no eligible choices and was safely completed.`,
        tone: offer ? 'reward' : 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyRelicOfferServiceCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'relic.offer_service_use' }>
): GameplayCommandResult => {
    const offer = run.relicOffer;
    if (!offer) {
        return rejectedResult(run, command.commandId, 'Relic offer service requires an open draft.', command);
    }
    const result = applyRelicOfferService(run, command.serviceId, command.targetRelicId);
    const nextOffer = result.run.relicOffer;
    if (!result.applied || !nextOffer) {
        return rejectedResult(
            run,
            command.commandId,
            `Relic offer service is unavailable${result.reason ? ` (${result.reason})` : ''}.`,
            command
        );
    }

    const bannedBefore = Array.isArray(offer.bannedRelicIds) ? offer.bannedRelicIds : [];
    const bannedAfter = Array.isArray(nextOffer.bannedRelicIds) ? nextOffer.bannedRelicIds : [];
    const targetRelicId = command.serviceId === 'ban_option'
        ? bannedAfter.find((relicId) => !bannedBefore.includes(relicId)) ?? command.targetRelicId ?? null
        : null;
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, RELIC_OFFER_SOURCE, events);
    writeEvent({
        type: 'relic.offer_service_used',
        serviceId: command.serviceId,
        targetRelicId,
        cost: RELIC_OFFER_SERVICE_CATALOG[command.serviceId].cost,
        shopGoldBefore: runNonNegativeInteger(run.shopGold),
        shopGoldAfter: runNonNegativeInteger(result.run.shopGold),
        pickRoundBefore: runNonNegativeInteger(offer.pickRound),
        pickRoundAfter: runNonNegativeInteger(nextOffer.pickRound),
        optionsBefore: offer.options,
        optionsAfter: nextOffer.options,
        bannedRelicIdsBefore: bannedBefore,
        bannedRelicIdsAfter: bannedAfter,
        upgradedOfferBefore: offer.upgradedOffer ?? false,
        upgradedOfferAfter: nextOffer.upgradedOffer ?? false
    });
    writeEvent({
        type: 'feedback.requested',
        cue: `relic.offer_service.${command.serviceId}`,
        message: command.serviceId === 'reroll_offer'
            ? 'Relic offer rerolled with fresh build choices.'
            : command.serviceId === 'ban_option'
              ? `${targetRelicId ?? 'Relic'} was banned from this draft visit.`
              : 'Relic offer upgraded toward uncommon and rare choices.',
        tone: 'information'
    });
    return { run: result.run, command, events, accepted: true };
};

const findableDefinitionId = (findableKind: FindableKind | null): string | null =>
    findableKind === 'shard_spark'
        ? 'findable.shard_spark'
        : findableKind === 'ward_spark'
          ? 'findable.ward_spark'
          : findableKind === 'score_glint'
            ? 'findable.score_glint'
            : findableKind === 'scout_glint'
              ? 'findable.scout_glint'
              : null;

const resolveBoardTurnFindableReward = (
    run: RunState,
    findableKind: FindableKind | null,
    _legacyCommandId: string,
    execution?: BoardTurnExecutionContext
): BoardTurnFindableRewardResult => {
    const definitionId = findableDefinitionId(findableKind);
    if (!definitionId || !findableKind) {
        return {
            commands: [],
            events: [],
            comboShardGain: 0,
            safeHazardWardGain: 0,
            scoreGain: 0,
            scoutRevealGain: 0,
            migrated: false
        };
    }
    if (!execution) {
        throw new Error('Core-owned board turn requires an outer execution context.');
    }
    const definition = getGameplayContentDefinition(definitionId);
    if (!definition) {
        throw new Error(`Missing board-turn findable definition: ${definitionId}`);
    }
    const eventStart = execution.events.length;
    const facts: GameplayFacts = {
        matchedTraits: [],
        adjacentTraits: [],
        matchedFindables: [findableKind],
        bossTrophyClaimed: false,
        riskWagerOutcome: 'none',
        featuredObjectiveCompleted: false,
        scoreParasiteActive: false
    };
    const transition = applyGameplayDefinitionTransition(
        run,
        execution.commandId,
        definition,
        facts,
        execution.events
    );
    if (!transition.accepted) {
        throw new Error(`Board-turn findable definition rejected: ${definitionId}`);
    }
    const events = execution.events.slice(eventStart);
    return {
        commands: [],
        events,
        comboShardGain: events.reduce(
            (sum, event) => sum + (event.type === 'combo_shard.requested' ? event.amount : 0),
            0
        ),
        safeHazardWardGain: events.reduce(
            (sum, event) => sum + (event.type === 'safe_hazard_ward.requested' ? event.amount : 0),
            0
        ),
        scoreGain: events.reduce(
            (sum, event) => sum + (event.type === 'score.requested' ? event.amount : 0),
            0
        ),
        scoutRevealGain: events.reduce(
            (sum, event) => sum + (event.type === 'scout_reveal.requested' ? event.amount : 0),
            0
        ),
        migrated: true
    };
};

const consumeBoardTurnWildMatch = (
    run: RunState,
    wildTileId: string,
    pairedTileId: string,
    _legacyCommandId: string,
    execution?: BoardTurnExecutionContext
): BoardTurnWildMatchResult => {
    if (!execution) {
        throw new Error('Core-owned Wild match requires an outer execution context.');
    }
    const tokensBefore = getRunInventoryItemQuantity(run, 'wild_match_token');
    const consumed = consumeRunInventoryItem(run, 'wild_match_token');
    if (!consumed.applied) {
        throw new Error('Core-owned Wild match could not consume its validated token.');
    }
    const tokensAfter = getRunInventoryItemQuantity(consumed.run, 'wild_match_token');
    const eventStart = execution.events.length;
    const writeEvent = makeEventWriter(execution.commandId, WILD_JOKER_SOURCE, execution.events);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'wild_match_token',
        operation: 'consume',
        requested: 1,
        applied: tokensAfter - tokensBefore,
        before: tokensBefore,
        after: tokensAfter
    });
    writeEvent({
        type: 'wild_match.consumed',
        wildTileId,
        pairedTileId,
        tokensBefore,
        tokensAfter
    });
    const pairedTile = run.board?.tiles.find((tile) => tile.id === pairedTileId);
    writeEvent({
        type: 'feedback.requested',
        cue: 'wild_joker.match_consumed',
        message: `Wild Joker bridged ${pairedTile?.label ?? 'a pair'}; ${tokensAfter} wildcard token${tokensAfter === 1 ? '' : 's'} remain.`,
        tone: 'reward'
    });
    return {
        run: consumed.run,
        commands: [],
        events: execution.events.slice(eventStart)
    };
};

const applyBoardTurnResolveCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.turn_resolve' }>
): GameplayCommandResult => {
    if (!run.board || run.status !== 'resolving') {
        return rejectedResult(run, command.commandId, 'Board turn is not ready to resolve.', command);
    }
    const flippedTileIds = Array.isArray(run.board.flippedTileIds)
        ? run.board.flippedTileIds.filter((tileId): tileId is string => typeof tileId === 'string')
        : [];
    if (flippedTileIds.length !== 2 && flippedTileIds.length !== 3) {
        return rejectedResult(run, command.commandId, 'Board turn requires exactly two or three flipped tiles.', command);
    }

    const events: GameplayEvent[] = [];
    const resolveTurn = createResolveBoardTurnTransition({
        finalizeLevel: finalizeLevelThroughCore,
        resolveFindableMatchReward: resolveBoardTurnFindableReward,
        consumeWildMatch: consumeBoardTurnWildMatch
    });
    const execution: BoardTurnExecutionContext = { commandId: command.commandId, events };
    const nextRun = resolveTurn(run, command.encorePairKeys, execution);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Board turn produced no transition.', command);
    }

    const statsBefore = normalizeSessionStats(run.stats);
    const statsAfter = normalizeSessionStats(nextRun.stats);
    const isMatch = statsAfter.matchesFound > statsBefore.matchesFound;
    const matchedSourceTile = isMatch
        ? flippedTileIds
              .map((tileId) => nextRun.board?.tiles.find((tile) => tile.id === tileId))
              .find((tile) => tile?.state === 'matched' && tile.pairKey !== WILD_PAIR_KEY)
        : null;
    const outcome = flippedTileIds.length === 3
        ? isMatch ? 'gambit_match' : 'gambit_mismatch'
        : isMatch ? 'match' : 'mismatch';
    const writeEvent = makeEventWriter(command.commandId, BOARD_TURN_SOURCE, events);
    writeEvent({
        type: 'board.turn_resolved',
        outcome,
        boardLevel: runNonNegativeInteger(run.board.level),
        flippedTileIds,
        floaterTileIds: execution.resolutionFacts?.floaterTileIds ?? flippedTileIds,
        matchedPairKey: matchedSourceTile?.pairKey ?? null,
        matchedFindableKind: execution.resolutionFacts?.matchedFindableKind ?? null,
        findablesClaimedBefore: runNonNegativeInteger(run.findablesClaimedThisFloor),
        findablesClaimedAfter: runNonNegativeInteger(nextRun.findablesClaimedThisFloor),
        findablesTotalBefore: runNonNegativeInteger(run.findablesTotalThisFloor),
        findablesTotalAfter: runNonNegativeInteger(nextRun.findablesTotalThisFloor),
        announcement: getBoardTurnAnnouncementFacts(run, nextRun),
        matchedRouteKind: execution.resolutionFacts?.matchedRouteKind ?? null,
        traitInteractionTags: execution.resolutionFacts?.traitInteractionTags ?? [],
        boardComplete: nextRun.board ? isBoardComplete(nextRun.board) : false,
        statusBefore: run.status,
        statusAfter: nextRun.status,
        livesBefore: runNonNegativeInteger(run.lives),
        livesAfter: runNonNegativeInteger(nextRun.lives),
        totalScoreBefore: statsBefore.totalScore,
        totalScoreAfter: statsAfter.totalScore,
        triesBefore: statsBefore.tries,
        triesAfter: statsAfter.tries,
        matchesBefore: statsBefore.matchesFound,
        matchesAfter: statsAfter.matchesFound,
        mismatchesBefore: statsBefore.mismatches,
        mismatchesAfter: statsAfter.mismatches,
        currentStreakBefore: statsBefore.currentStreak,
        currentStreakAfter: statsAfter.currentStreak,
        comboShardsBefore: statsBefore.comboShards,
        comboShardsAfter: statsAfter.comboShards,
        guardTokensBefore: statsBefore.guardTokens,
        guardTokensAfter: statsAfter.guardTokens
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyWildMatchConsumeCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'wild_match.consume' }>
): GameplayCommandResult => {
    const wildTile = run.board?.tiles.find((tile) => tile.id === command.wildTileId);
    const pairedTile = run.board?.tiles.find((tile) => tile.id === command.pairedTileId);
    const tokensBefore = getRunInventoryItemQuantity(run, 'wild_match_token');
    if (
        !wildTile ||
        !pairedTile ||
        wildTile.id === pairedTile.id ||
        wildTile.pairKey !== WILD_PAIR_KEY ||
        wildTile.state !== 'flipped' ||
        pairedTile.state !== 'flipped' ||
        !tilesArePairMatch(wildTile, pairedTile) ||
        tokensBefore <= 0
    ) {
        return rejectedResult(run, command.commandId, 'Wild match token cannot be consumed for these tiles.', command);
    }
    const consumed = consumeRunInventoryItem(run, 'wild_match_token');
    if (!consumed.applied) {
        return rejectedResult(run, command.commandId, 'Wild match token was unavailable.', command);
    }
    const tokensAfter = getRunInventoryItemQuantity(consumed.run, 'wild_match_token');
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, WILD_JOKER_SOURCE, events);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'wild_match_token',
        operation: 'consume',
        requested: 1,
        applied: tokensAfter - tokensBefore,
        before: tokensBefore,
        after: tokensAfter
    });
    writeEvent({
        type: 'wild_match.consumed',
        wildTileId: wildTile.id,
        pairedTileId: pairedTile.id,
        tokensBefore,
        tokensAfter
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'wild_joker.match_consumed',
        message: `Wild Joker bridged ${pairedTile.label}; ${tokensAfter} wildcard token${tokensAfter === 1 ? '' : 's'} remain.`,
        tone: 'reward'
    });
    return { run: consumed.run, command, events, accepted: true };
};

export const reduceGameplayCommand = (run: RunState, input: unknown): GameplayCommandResult => {
    const parsed = gameplayCommandSchema.safeParse(input);
    if (!parsed.success) {
        return rejectedResult(run, 'invalid-command', 'Command failed schema validation.', null);
    }
    const command = parsed.data;
    if (command.type === 'phase.memorize_complete') {
        return applyMemorizeCompleteCommand(run, command);
    }
    if (command.type === 'run.gauntlet_expire') {
        return applyGauntletExpireCommand(run, command);
    }
    if (command.type === 'run.pause') {
        return applyPauseCommand(run, command);
    }
    if (command.type === 'run.resume') {
        return applyResumeCommand(run, command);
    }
    if (command.type === 'debug.reveal_activate') {
        return applyDebugRevealActivateCommand(run, command);
    }
    if (command.type === 'debug.reveal_deactivate') {
        return applyDebugRevealDeactivateCommand(run, command);
    }
    if (command.type === 'run.progression_repair') {
        return applyProgressionRepairCommand(run, command);
    }
    if (command.type === 'board.peek') {
        return applyPeekCommand(run, command);
    }
    if (command.type === 'board.tile_flip') {
        return applyTileFlipCommand(run, command);
    }
    if (command.type === 'enemy_hazard.contact') {
        return applyEnemyHazardContactCommand(run, command);
    }
    if (command.type === 'board.pin_toggle') {
        return applyPinToggleCommand(run, command);
    }
    if (command.type === 'board.stray_remove') {
        return applyStrayRemoveCommand(run, command);
    }
    if (command.type === 'board.destroy_pair') {
        return applyDestroyPairCommand(run, command);
    }
    if (command.type === 'risk_wager.accept') {
        return applyRiskWagerAcceptCommand(run, command);
    }
    if (command.type === 'board.gambit_commit') {
        return applyGambitCommitCommand(run, command);
    }
    if (command.type === 'board.shuffle') {
        return applyShuffleCommand(run, command);
    }
    if (command.type === 'board.region_shuffle') {
        return applyRegionShuffleCommand(run, command);
    }
    if (command.type === 'board.tile_swap') {
        return applyTileSwapCommand(run, command);
    }
    if (command.type === 'board.flash_pair') {
        return applyFlashPairCommand(run, command);
    }
    if (command.type === 'board.undo_resolve') {
        return applyUndoResolveCommand(run, command);
    }
    if (command.type === 'shop.purchase') {
        return applyShopPurchaseCommand(run, command);
    }
    if (command.type === 'shop.reroll') {
        return applyShopRerollCommand(run, command);
    }
    if (command.type === 'dungeon.exit_activate') {
        return applyDungeonExitActivateCommand(run, command);
    }
    if (command.type === 'floor.parasite_advance') {
        return applyParasiteAdvanceCommand(run, command);
    }
    if (command.type === 'floor.hazard_banish') {
        return applyHazardBanishCommand(run, command);
    }
    if (command.type === 'floor.advance') {
        return applyFloorAdvanceCommand(run, command);
    }
    if (command.type === 'route.choose') {
        return applyRouteChooseCommand(run, command);
    }
    if (command.type === 'side_room.resolve') {
        return applySideRoomResolveCommand(run, command);
    }
    if (command.type === 'relic.offer_open') {
        return applyRelicOfferOpenCommand(run, command);
    }
    if (command.type === 'relic.pick') {
        return applyRelicPickCommand(run, command);
    }
    if (command.type === 'relic.offer_service_use') {
        return applyRelicOfferServiceCommand(run, command);
    }
    if (command.type === 'board.turn_resolve') {
        return applyBoardTurnResolveCommand(run, command);
    }
    if (command.type === 'wild_match.consume') {
        return applyWildMatchConsumeCommand(run, command);
    }
    const definition = getGameplayContentDefinition(command.definitionId);
    if (!definition) {
        return rejectedResult(run, command.commandId, `Unknown gameplay definition ${command.definitionId}.`, command);
    }
    if (definition.version !== command.definitionVersion) {
        return rejectedResult(
            run,
            command.commandId,
            `Definition version mismatch for ${definition.id}: command ${command.definitionVersion}, current ${definition.version}.`,
            command
        );
    }
    return applyDefinition(run, command, definition);
};

export const replayGameplayCommands = (initialRun: RunState, inputs: readonly unknown[]): GameplayReplayResult => {
    let run = initialRun;
    const events: GameplayEvent[] = [];
    const acceptedCommandIds: string[] = [];
    const rejectedCommandIds: string[] = [];
    for (const input of inputs) {
        const result = reduceGameplayCommand(run, input);
        run = result.run;
        events.push(...result.events);
        const commandId = result.command?.commandId ?? result.events[0]?.commandId ?? 'invalid-command';
        (result.accepted ? acceptedCommandIds : rejectedCommandIds).push(commandId);
    }
    return { run, events, acceptedCommandIds, rejectedCommandIds };
};
