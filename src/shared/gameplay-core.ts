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
import type { RewardPerkId, RunState } from './contracts';
import {
    GAMEPLAY_CORE_SCHEMA_VERSION,
    GAMEPLAY_REWARD_PERK_IDS,
    gameplayCommandSchema,
    gameplayEventSchema,
    getGameplayContentDefinition,
    type GameplayCommand,
    type GameplayCondition,
    type GameplayContentDefinition,
    type GameplayEvent,
    type GameplayFacts,
    type GameplaySource
} from './gameplay-core-contracts';
import {
    gainRunInventoryItem,
    getRunInventoryItemQuantity,
    useRunInventoryItem
} from './run-inventory';
import { runNonNegativeInteger } from './run-number-guards';
import { runStringArray } from './run-array-guards';
import { gainRelicFavor } from './relic-favor-rules';
import { acceptEndlessRiskWager } from './risk-wager-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { purchaseShopOffer } from './shop-rules';
import { createDungeonExitActivationTransition } from './dungeon-exit-rules';
import { getDungeonExitStatus } from './dungeon-board-status';
import { advanceScoreParasiteFloor } from './score-parasite-rules';
import { hasMutator } from './mutators';
import { tilesArePairMatch } from './scoring-rules';
import { WILD_PAIR_KEY } from './tile-identity';
import { isBoardComplete } from './board-inspection';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';

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
const WILD_JOKER_SOURCE: GameplaySource = { kind: 'system', id: 'wild_joker' };
const gameplayRewardPerkIds = new Set<RewardPerkId>(GAMEPLAY_REWARD_PERK_IDS);
type GameplayEventPayload<T = GameplayEvent> = T extends GameplayEvent
    ? Omit<T, 'schemaVersion' | 'eventId' | 'commandId' | 'sequence' | 'source'>
    : never;

const normalizeGameplayRewardPerkIds = (value: unknown): RewardPerkId[] =>
    Array.isArray(value)
        ? value.filter((id): id is RewardPerkId => typeof id === 'string' && gameplayRewardPerkIds.has(id as RewardPerkId))
        : [];

const hasGameplayRewardPerk = (run: Pick<RunState, 'rewardPerkIds'>, perkId: RewardPerkId): boolean =>
    normalizeGameplayRewardPerkIds(run.rewardPerkIds).includes(perkId);

const makeEventWriter = (commandId: string, source: GameplaySource, events: GameplayEvent[]) =>
    (event: GameplayEventPayload): void => {
        const sequence = events.length;
        events.push(
            gameplayEventSchema.parse({
                ...event,
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                eventId: `${commandId}:${sequence}`,
                commandId,
                sequence,
                source
            })
        );
    };

const rejectedResult = (run: RunState, commandId: string, reason: string, command: GameplayCommand | null): GameplayCommandResult => {
    const events: GameplayEvent[] = [];
    makeEventWriter(commandId, SYSTEM_SOURCE, events)({ type: 'command.rejected', reason });
    return { run, command, events, accepted: false };
};

const conditionFailure = (run: RunState, condition: GameplayCondition, facts: GameplayFacts): string | null => {
    switch (condition.kind) {
        case 'run.status_is':
            return run.status === condition.status ? null : `run status is ${run.status}, expected ${condition.status}`;
        case 'inventory.at_least':
            return getRunInventoryItemQuantity(run, condition.itemId) >= condition.amount
                ? null
                : `${condition.itemId} is below ${condition.amount}`;
        case 'reward_perk.active':
            return hasGameplayRewardPerk(run, condition.perkId) ? null : `${condition.perkId} is not active`;
        case 'relic.active':
            return Array.isArray(run.relicIds) && run.relicIds.includes(condition.relicId)
                ? null
                : `${condition.relicId} is not active`;
        case 'trait.matched':
            return facts.matchedTraits.includes(condition.trait) ? null : `${condition.trait} was not matched`;
        case 'trait.adjacent':
            return facts.adjacentTraits.includes(condition.trait) ? null : `${condition.trait} was not adjacent`;
        case 'trait.any_matched':
            return facts.matchedTraits.length > 0 ? null : 'no trait was matched';
        case 'streak.at_least':
            return runNonNegativeInteger(normalizeSessionStats(run.stats).currentStreak) >= condition.amount
                ? null
                : `clean streak is below ${condition.amount}`;
        case 'findable.matched':
            return facts.matchedFindables.includes(condition.findable) ? null : `${condition.findable} was not matched`;
        case 'floor.match_resolutions_is':
            return runNonNegativeInteger(run.matchResolutionsThisFloor) === condition.amount
                ? null
                : `floor match resolutions are ${runNonNegativeInteger(run.matchResolutionsThisFloor)}, expected ${condition.amount}`;
        case 'boss_trophy.claimed':
            return facts.bossTrophyClaimed ? null : 'boss trophy was not claimed';
        case 'risk_wager.outcome_is':
            return facts.riskWagerOutcome === condition.outcome
                ? null
                : `risk wager outcome is ${facts.riskWagerOutcome}, expected ${condition.outcome}`;
        case 'featured_objective.completed':
            return facts.featuredObjectiveCompleted ? null : 'featured objective was not completed';
        case 'score_parasite.active':
            return facts.scoreParasiteActive ? null : 'score parasite is not active';
    }
};

const applyDefinition = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'effects.apply' }>,
    definition: GameplayContentDefinition
): GameplayCommandResult => {
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, definition.source, events);
    for (const condition of definition.conditions) {
        const failure = conditionFailure(run, condition, command.facts);
        if (failure) {
            writeEvent({ type: 'command.rejected', reason: `Condition failed: ${failure}.` });
            return { run, command, events, accepted: false };
        }
    }

    let nextRun = run;
    for (const effect of definition.effects) {
        switch (effect.kind) {
            case 'inventory.grant': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                nextRun = gainRunInventoryItem(nextRun, effect.itemId, effect.amount);
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'grant',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                if (after === before) {
                    writeEvent({
                        type: 'effect.skipped',
                        effectKind: effect.kind,
                        reason: `${effect.itemId} could not accept the requested grant.`
                    });
                }
                break;
            }
            case 'inventory.consume': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                const used = useRunInventoryItem(nextRun, effect.itemId);
                nextRun = used.run;
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'consume',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                if (!used.applied) {
                    writeEvent({
                        type: 'effect.skipped',
                        effectKind: effect.kind,
                        reason: used.reason ?? `${effect.itemId} could not be consumed.`
                    });
                }
                break;
            }
            case 'inventory.grant_or_score': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                nextRun = gainRunInventoryItem(nextRun, effect.itemId, effect.amount);
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                const applied = after - before;
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'grant',
                    requested: effect.amount,
                    applied,
                    before,
                    after
                });
                if (applied === 0) {
                    const stats = normalizeSessionStats(nextRun.stats);
                    const totalBefore = runNonNegativeInteger(stats.totalScore);
                    const currentLevelBefore = runNonNegativeInteger(stats.currentLevelScore);
                    nextRun = {
                        ...nextRun,
                        stats: {
                            ...stats,
                            totalScore: totalBefore + effect.fallbackScore,
                            currentLevelScore: currentLevelBefore + effect.fallbackScore
                        }
                    };
                    writeEvent({
                        type: 'score.changed',
                        reason: 'inventory_overflow',
                        amount: effect.fallbackScore,
                        totalBefore,
                        totalAfter: totalBefore + effect.fallbackScore,
                        currentLevelBefore,
                        currentLevelAfter: currentLevelBefore + effect.fallbackScore
                    });
                }
                break;
            }
            case 'reward_perk.grant': {
                const rewardPerkIds = normalizeGameplayRewardPerkIds(nextRun.rewardPerkIds);
                const newlyGranted = !rewardPerkIds.includes(effect.perkId);
                if (newlyGranted) {
                    nextRun = { ...nextRun, rewardPerkIds: [...rewardPerkIds, effect.perkId] };
                }
                writeEvent({ type: 'reward_perk.granted', perkId: effect.perkId, newlyGranted });
                break;
            }
            case 'combo_shard.request':
                writeEvent({ type: 'combo_shard.requested', amount: effect.amount });
                break;
            case 'safe_hazard_ward.request':
                writeEvent({ type: 'safe_hazard_ward.requested', amount: effect.amount });
                break;
            case 'currency.grant': {
                const before = runNonNegativeInteger(nextRun.shopGold);
                const after = before + effect.amount;
                nextRun = { ...nextRun, shopGold: after };
                writeEvent({
                    type: 'currency.changed',
                    currency: effect.currency,
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                break;
            }
            case 'score.grant': {
                const stats = normalizeSessionStats(nextRun.stats);
                const totalBefore = runNonNegativeInteger(stats.totalScore);
                const currentLevelBefore = runNonNegativeInteger(stats.currentLevelScore);
                nextRun = {
                    ...nextRun,
                    stats: {
                        ...stats,
                        totalScore: totalBefore + effect.amount,
                        currentLevelScore: currentLevelBefore + effect.amount
                    }
                };
                writeEvent({
                    type: 'score.changed',
                    reason: effect.reason,
                    amount: effect.amount,
                    totalBefore,
                    totalAfter: totalBefore + effect.amount,
                    currentLevelBefore,
                    currentLevelAfter: currentLevelBefore + effect.amount
                });
                break;
            }
            case 'score.request':
                writeEvent({ type: 'score.requested', reason: effect.reason, amount: effect.amount });
                break;
            case 'bonus_relic_pick.grant': {
                const before = runNonNegativeInteger(nextRun.bonusRelicPicksNextOffer);
                const after = before + effect.amount;
                nextRun = { ...nextRun, bonusRelicPicksNextOffer: after };
                writeEvent({
                    type: 'bonus_relic_pick.changed',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                break;
            }
            case 'relic_favor.request':
                writeEvent({ type: 'relic_favor.requested', reason: effect.reason, amount: effect.amount });
                break;
            case 'featured_streak_floor.request':
                writeEvent({ type: 'featured_streak_floor.requested', reason: effect.reason, amount: effect.amount });
                break;
            case 'parasite_relief.request':
                writeEvent({ type: 'parasite_relief.requested', reason: effect.reason, amount: effect.amount });
                break;
            case 'parasite_ward.grant': {
                const before = runNonNegativeInteger(nextRun.parasiteWardRemaining);
                const after = before + effect.amount;
                nextRun = { ...nextRun, parasiteWardRemaining: after };
                writeEvent({
                    type: 'parasite_ward.changed',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                break;
            }
            case 'relic_favor.grant': {
                const progressBefore = runNonNegativeInteger(nextRun.relicFavorProgress);
                const bonusPicksBefore = runNonNegativeInteger(nextRun.bonusRelicPicksNextOffer);
                const favorBonusPicksBefore = runNonNegativeInteger(nextRun.favorBonusRelicPicksNextOffer);
                const favor = gainRelicFavor(nextRun, effect.amount);
                nextRun = { ...nextRun, ...favor };
                writeEvent({
                    type: 'relic_favor.changed',
                    requested: effect.amount,
                    progressBefore,
                    progressAfter: favor.relicFavorProgress,
                    bonusPicksBefore,
                    bonusPicksAfter: favor.bonusRelicPicksNextOffer,
                    favorBonusPicksBefore,
                    favorBonusPicksAfter: favor.favorBonusRelicPicksNextOffer
                });
                break;
            }
            case 'pin_capacity.request':
                writeEvent({ type: 'pin_capacity.requested', amount: effect.amount });
                break;
            case 'scout_reveal.request':
                writeEvent({ type: 'scout_reveal.requested', amount: effect.amount });
                break;
            case 'free_shuffle.grant': {
                const before = nextRun.freeShuffleThisFloor === true;
                nextRun = { ...nextRun, freeShuffleThisFloor: true };
                writeEvent({ type: 'free_shuffle.changed', before, after: true });
                break;
            }
            case 'feedback.emit':
                writeEvent({
                    type: 'feedback.requested',
                    cue: effect.cue,
                    message: effect.message,
                    tone: effect.tone
                });
                break;
        }
    }
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
        recallFocusBefore: runNonNegativeInteger(run.recallFocus),
        recallFocusAfter: runNonNegativeInteger(nextRun.recallFocus)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.stray_remove.used',
        message: `Stray Remove cleared ${command.targetTileId}; ${after} charge${after === 1 ? '' : 's'} remain.`,
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
        recallFocusBefore: runNonNegativeInteger(run.recallFocus),
        recallFocusAfter: runNonNegativeInteger(nextRun.recallFocus),
        parasitePressureBefore: runNonNegativeInteger(run.parasiteFloors),
        parasitePressureAfter: runNonNegativeInteger(nextRun.parasiteFloors),
        shiftingSpotlightNonceBefore: runNonNegativeInteger(run.shiftingSpotlightNonce),
        shiftingSpotlightNonceAfter: runNonNegativeInteger(nextRun.shiftingSpotlightNonce),
        boardComplete: transition.boardComplete
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.destroy_pair.used',
        message: `${target.label} pair removed; ${destroyChargesAfter} Destroy charge${destroyChargesAfter === 1 ? '' : 's'} remain${transition.boardComplete ? ' and the floor route is clear' : ''}.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
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
        recallFocusBefore: runNonNegativeInteger(run.recallFocus),
        recallFocusAfter: runNonNegativeInteger(nextRun.recallFocus),
        routeSpecialRevealed:
            beforeTile?.routeSpecialRevealed !== true && afterTile?.routeSpecialRevealed === true
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.peek.used',
        message: `Peek revealed ${command.targetTileId}; ${after} charge${after === 1 ? '' : 's'} remain.`,
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
        usedFreeCharge
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.shuffle.used',
        message: `Full-board shuffle committed${usedFreeCharge ? ' its free use' : `; ${afterCharges} charge${afterCharges === 1 ? '' : 's'} remain`}.`,
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
        usedFreeCharge
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.region_shuffle.used',
        message: `Row ${command.rowIndex + 1} shuffled${usedFreeCharge ? ' for free' : `; ${afterCharges} row/swap charge${afterCharges === 1 ? '' : 's'} remain`}.`,
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
        usedFreeCharge
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.tile_swap.used',
        message: `${command.firstTileId} swapped with ${command.secondTileId}${usedFreeCharge ? ' for free' : `; ${afterCharges} row/swap charge${afterCharges === 1 ? '' : 's'} remain`}.`,
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
        recallFocusBefore: runNonNegativeInteger(run.recallFocus),
        recallFocusAfter: runNonNegativeInteger(nextRun.recallFocus)
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.undo_resolve.used',
        message: `Pending flip cancelled; ${afterUses} undo use${afterUses === 1 ? '' : 's'} remain this floor.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

const applyShopPurchaseCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'shop.purchase' }>
): GameplayCommandResult => {
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
        message: `${offer.label} purchased for ${shopGoldBefore - shopGoldAfter} shop gold.`,
        tone: 'reward'
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
    return { run: nextRun, command, events, accepted: true };
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
    if (wardConsumed) {
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
    const consumed = useRunInventoryItem(run, 'wild_match_token');
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
    if (command.type === 'board.peek') {
        return applyPeekCommand(run, command);
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
    if (command.type === 'dungeon.exit_activate') {
        return applyDungeonExitActivateCommand(run, command);
    }
    if (command.type === 'floor.parasite_advance') {
        return applyParasiteAdvanceCommand(run, command);
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
