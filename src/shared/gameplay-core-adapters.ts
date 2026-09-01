import type { FindableKind, RelicId, RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    createGameplayBoardTurnResolveCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayWildMatchConsumeCommand,
    createGameplayTileFlipCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayPauseCommand,
    createGameplayResumeCommand,
    createGameplayProgressionRepairCommand,
    createGameplayGauntletExpireCommand,
    createGameplayDebugRevealActivateCommand,
    createGameplayDebugRevealDeactivateCommand,
    createGameplayEnemyHazardContactCommand,
    createGameplayRelicOfferOpenCommand,
    type GameplayCommand,
    type GameplayEvent,
    type GameplayPauseTimerSnapshot
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import type { FloorClearExecutionContext } from './floor-clear-transition';
import {
    collectSlayerFloorClearDefinitions,
    resolveSlayerFloorClearEffects
} from './slayer-floor-clear-transition';
import { appendGameplayJournal } from './gameplay-journal';
import { applyRelicImmediate } from './relic-immediate-rules';

export interface GameplayRelicImmediateAdapterResult {
    run: RunState;
    events: GameplayEvent[];
    migrated: boolean;
}

export interface GameplayMatchRewardAdapterResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    comboShardGain: number;
    safeHazardWardGain: number;
    scoreGain: number;
    scoutRevealGain: number;
    migrated: boolean;
}

export interface GameplaySlayerFloorClearInput {
    bossTrophyClaimed: boolean;
    riskWagerOutcome: 'won' | 'lost' | undefined;
    featuredObjectiveCompleted: boolean;
    scoreParasiteActive: boolean;
}

export interface GameplaySlayerFloorClearAdapterResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    bossTrophyScoreGain: number;
    riskWagerFavorGain: number;
    riskWagerStreakFloor: number;
    parasiteRelief: number;
}

export interface GameplayWildMatchAdapterResult {
    run: RunState;
    commands: GameplayCommand[];
    events: GameplayEvent[];
}

export interface GameplayBoardTurnAdapterResult {
    run: RunState;
    command: GameplayCommand;
    events: GameplayEvent[];
    migrated: boolean;
}

export interface GameplayFloorAdvanceAdapterResult {
    run: RunState;
    command: GameplayCommand;
    events: GameplayEvent[];
    accepted: boolean;
}

const RELIC_IMMEDIATE_DEFINITION_IDS: Partial<Record<RelicId, string>> = {
    extra_shuffle_charge: 'relic.extra_shuffle_charge',
    first_shuffle_free_per_floor: 'relic.first_shuffle_free_per_floor',
    memorize_bonus_ms: 'relic.memorize_bonus_ms',
    memorize_under_short_memorize: 'relic.memorize_under_short_memorize',
    region_shuffle_free_first: 'relic.region_shuffle_free_first',
    combo_shard_plus_step: 'relic.combo_shard_plus_step',
    parasite_ward_once: 'relic.parasite_ward_once',
    destroy_bank_plus_one: 'relic.destroy_bank_plus_one',
    guard_token_plus_one: 'relic.guard_token_plus_one',
    peek_charge_plus_one: 'relic.peek_charge_plus_one',
    shrine_echo: 'relic.shrine_echo',
    chapter_compass: 'relic.chapter_compass',
    wager_surety: 'relic.wager_surety',
    parasite_ledger: 'relic.parasite_ledger',
    stray_charge_plus_one: 'relic.stray_charge_plus_one',
    pin_cap_plus_one: 'relic.pin_cap_plus_one'
};

/**
 * Strangler adapter for relic immediate effects. Unmigrated relics retain the
 * legacy pure rule; migrated relics use the authoritative command definition.
 */
export const applyRelicImmediateThroughGameplayCore = (
    run: RunState,
    relicId: RelicId,
    commandId: string
): GameplayRelicImmediateAdapterResult => {
    const definitionId = RELIC_IMMEDIATE_DEFINITION_IDS[relicId];
    if (!definitionId) {
        return { run: applyRelicImmediate(run, relicId), events: [], migrated: false };
    }
    const command = createGameplayDefinitionCommand(commandId, definitionId);
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        throw new Error(`Migrated relic command rejected: ${relicId}`);
    }
    return {
        run: appendGameplayJournal(result.run, [command], result.events),
        events: result.events,
        migrated: true
    };
};

/**
 * Typed handoff from migrated match pickups into the legacy survival resolver.
 * The command owns source/condition semantics; its request event is the only
 * value the compatibility layer consumes.
 */
export const resolveFindableMatchRewardThroughGameplayCore = (
    run: RunState,
    findableKind: FindableKind | null,
    commandId: string
): GameplayMatchRewardAdapterResult => {
    const definitionId =
        findableKind === 'shard_spark'
            ? 'findable.shard_spark'
            : findableKind === 'ward_spark'
              ? 'findable.ward_spark'
              : findableKind === 'score_glint'
                ? 'findable.score_glint'
              : findableKind === 'scout_glint'
                ? 'findable.scout_glint'
                : null;
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
    const command = createGameplayDefinitionCommand(commandId, definitionId, {
        matchedFindables: [findableKind]
    });
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        throw new Error(`Migrated findable command rejected: ${findableKind}`);
    }
    return {
        commands: [command],
        events: result.events,
        comboShardGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'combo_shard.requested' ? event.amount : 0),
            0
        ),
        safeHazardWardGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'safe_hazard_ward.requested' ? event.amount : 0),
            0
        ),
        scoreGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'score.requested' ? event.amount : 0),
            0
        ),
        scoutRevealGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'scout_reveal.requested' ? event.amount : 0),
            0
        ),
        migrated: true
    };
};

/**
 * Routes non-final delayed board resolution through one outer command. Final
 * pairs deliberately remain on the legacy finalizer until floor-clear effects
 * can share the same event envelope without a reducer cycle.
 */
export const resolveBoardTurnThroughGameplayCore = (
    run: RunState,
    encorePairKeys: readonly string[],
    commandId = `board-turn:${run.runSeed}:${run.board?.level ?? 0}:${
        (Array.isArray(run.board?.flippedTileIds) ? run.board.flippedTileIds : []).join('+') || 'none'
    }`
): GameplayBoardTurnAdapterResult => {
    const command = createGameplayBoardTurnResolveCommand(commandId, encorePairKeys);
    const result = reduceGameplayCommand(run, command);
    return {
        // Journalled like every other accepted command. Turn resolution is the single
        // most consequential mutation in a run - score, lives, matches, findables - and
        // it was the one leaving no journal entry, so a replay skipped every turn.
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : result.run,
        command,
        events: result.accepted ? result.events : [],
        migrated: result.accepted
    };
};

/**
 * Typed source boundary for Slayer floor-clear relic hooks. Established boss,
 * objective, Favor, and parasite rules consume these request amounts.
 */
export const resolveSlayerFloorClearThroughGameplayCore = (
    run: RunState,
    input: GameplaySlayerFloorClearInput,
    commandIdPrefix: string,
    execution?: FloorClearExecutionContext
): GameplaySlayerFloorClearAdapterResult => {
    if (execution) {
        return resolveSlayerFloorClearEffects(run, input, execution.commandId, execution.events);
    }

    const commands: GameplayCommand[] = [];
    const events: GameplayEvent[] = [];
    for (const definitionRef of collectSlayerFloorClearDefinitions(run, input)) {
        const command = createGameplayDefinitionCommand(
            `${commandIdPrefix}:${definitionRef.suffix}`,
            definitionRef.id,
            {
                bossTrophyClaimed: input.bossTrophyClaimed,
                riskWagerOutcome: input.riskWagerOutcome ?? 'none',
                featuredObjectiveCompleted: input.featuredObjectiveCompleted,
                scoreParasiteActive: input.scoreParasiteActive
            }
        );
        const result = reduceGameplayCommand(run, command);
        if (!result.accepted) {
            throw new Error(`Migrated Slayer floor-clear command rejected: ${definitionRef.id}`);
        }
        commands.push(command);
        events.push(...result.events);
    }

    return {
        commands,
        events,
        bossTrophyScoreGain: events.reduce(
            (sum, event) => sum + (event.type === 'score.requested' && event.reason === 'boss_trophy' ? event.amount : 0),
            0
        ),
        riskWagerFavorGain: events.reduce(
            (sum, event) => sum + (event.type === 'relic_favor.requested' ? event.amount : 0),
            0
        ),
        riskWagerStreakFloor: events.reduce(
            (floor, event) => event.type === 'featured_streak_floor.requested' ? Math.max(floor, event.amount) : floor,
            0
        ),
        parasiteRelief: events.reduce(
            (sum, event) => sum + (event.type === 'parasite_relief.requested' ? event.amount : 0),
            0
        )
    };
};

/** Records one wildcard bridge while delegating the surrounding match payout to the established resolver. */
export const consumeWildMatchThroughGameplayCore = (
    run: RunState,
    wildTileId: string,
    pairedTileId: string,
    commandId: string
): GameplayWildMatchAdapterResult => {
    const command = createGameplayWildMatchConsumeCommand(commandId, wildTileId, pairedTileId);
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        throw new Error('Wild match consumption command was unexpectedly rejected.');
    }
    return { run: result.run, commands: [command], events: result.events };
};

/** Owns one complete floor transition without journaling nested parasite or floor-start perk commands. */
export const advanceFloorThroughGameplayCore = (
    run: RunState,
    commandId: string
): GameplayFloorAdvanceAdapterResult => {
    const command = createGameplayFloorAdvanceCommand(commandId);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

export interface GameplayRunTransitionAdapterResult {
    run: RunState;
    accepted: boolean;
    commands: GameplayCommand[];
    events: GameplayEvent[];
}

const reduceThroughGameplayCore = (
    run: RunState,
    command: GameplayCommand
): GameplayRunTransitionAdapterResult => {
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        commands: [command],
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/**
 * Tile presses are rejected rather than thrown on: an illegal flip (already matched,
 * wrong phase, third flip without gambit) is ordinary player input, not a bug, and the
 * press surface uses `accepted` to decide whether to play the flip SFX.
 */
export const applyTileFlipThroughGameplayCore = (
    run: RunState,
    tileId: string,
    commandId = `tile-flip:${run.runSeed}:${run.board?.level ?? 0}:${tileId}`
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayTileFlipCommand(commandId, tileId));

export const completeMemorizePhaseThroughGameplayCore = (
    run: RunState,
    commandId: string
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayMemorizeCompleteCommand(commandId));

export const pauseRunThroughGameplayCore = (
    run: RunState,
    pausedAtMs: number,
    timerSnapshot: GameplayPauseTimerSnapshot,
    commandId: string
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayPauseCommand(commandId, pausedAtMs, timerSnapshot));

export const resumeRunThroughGameplayCore = (
    run: RunState,
    resumedAtMs: number,
    commandId: string
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayResumeCommand(commandId, resumedAtMs));

export const repairRunProgressionThroughGameplayCore = (
    run: RunState,
    commandId = `progression-repair:${run.runSeed}:${run.board?.level ?? 0}`
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayProgressionRepairCommand(commandId));

export const activateDebugRevealThroughGameplayCore = (
    run: RunState,
    disableAchievementsOnDebug: boolean,
    commandId: string
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayDebugRevealActivateCommand(commandId, disableAchievementsOnDebug));

export const deactivateDebugRevealThroughGameplayCore = (
    run: RunState,
    reason: 'timer_elapsed' | 'resume_expired' | 'phase_ended',
    commandId: string
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayDebugRevealDeactivateCommand(commandId, reason));

/**
 * Rejected rather than thrown on while time remains: the gauntlet watcher polls every
 * 300ms, so `accepted: false` is the normal case and only the firing tick transitions.
 */
export const expireGauntletThroughGameplayCore = (
    run: RunState,
    observedAtMs: number,
    commandId = `gauntlet-expire:${run.runSeed}:${run.gauntletDeadlineMs ?? 'none'}:${observedAtMs}`
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayGauntletExpireCommand(commandId, observedAtMs));

export const applyEnemyHazardContactThroughGameplayCore = (
    run: RunState,
    tileId: string,
    advanceHazards: boolean,
    commandId = `enemy-hazard-contact:${run.runSeed}:${run.board?.level ?? 0}:${tileId}`
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(
        run,
        createGameplayEnemyHazardContactCommand(commandId, tileId, advanceHazards)
    );

export const openRelicOfferThroughGameplayCore = (
    run: RunState,
    commandId = `relic-offer-open:${run.runSeed}:${run.board?.level ?? 0}`
): GameplayRunTransitionAdapterResult =>
    reduceThroughGameplayCore(run, createGameplayRelicOfferOpenCommand(commandId));
