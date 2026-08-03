import type { FindableKind, RelicId, RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    createGameplayDebugRevealActivateCommand,
    createGameplayDebugRevealDeactivateCommand,
    createGameplayBoardTurnResolveCommand,
    createGameplayDestroyPairCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayGauntletExpireCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayPauseCommand,
    createGameplayProgressionRepairCommand,
    createGameplayRelicOfferOpenCommand,
    createGameplayResumeCommand,
    createGameplayWildMatchConsumeCommand,
    type GameplayDebugRevealDeactivationReason,
    type GameplayPauseTimerSnapshot,
    type GameplayCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import type { FloorClearExecutionContext } from './floor-clear-transition';
import {
    collectSlayerFloorClearDefinitions,
    resolveSlayerFloorClearEffects
} from './slayer-floor-clear-transition';
import { appendGameplayJournal } from './gameplay-journal';
import { applyRelicImmediate } from './relic-immediate-rules';
import { createTileFlipCommandForRun } from './tile-flip-command-transition';

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

export interface GameplayRelicOfferOpenAdapterResult {
    run: RunState;
    command: GameplayCommand;
    events: GameplayEvent[];
    accepted: boolean;
}

export interface GameplayMemorizeCompleteAdapterResult {
    run: RunState;
    command: GameplayCommand;
    events: GameplayEvent[];
    accepted: boolean;
}

export interface GameplayGauntletExpireAdapterResult {
    run: RunState;
    command: GameplayCommand;
    events: GameplayEvent[];
    accepted: boolean;
}

export interface GameplayRunLifecycleAdapterResult {
    run: RunState;
    command: GameplayCommand;
    events: GameplayEvent[];
    accepted: boolean;
}

export interface GameplayBoardInputAdapterResult {
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

/** Completes the deterministic study phase while leaving wall-clock scheduling to the renderer. */
export const completeMemorizePhaseThroughGameplayCore = (
    run: RunState,
    commandId: string
): GameplayMemorizeCompleteAdapterResult => {
    const command = createGameplayMemorizeCompleteCommand(commandId);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Converts a host-clock observation into one deterministic terminal gameplay transition. */
export const expireGauntletThroughGameplayCore = (
    run: RunState,
    observedAtMs: number,
    commandId: string
): GameplayGauntletExpireAdapterResult => {
    const command = createGameplayGauntletExpireCommand(commandId, observedAtMs);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Freezes gameplay timing from one serialized host observation and timer snapshot. */
export const pauseRunThroughGameplayCore = (
    run: RunState,
    observedAtMs: number,
    timerSnapshot: GameplayPauseTimerSnapshot,
    commandId: string
): GameplayRunLifecycleAdapterResult => {
    const command = createGameplayPauseCommand(commandId, observedAtMs, timerSnapshot);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Restores a paused gameplay phase from one serialized host-clock observation. */
export const resumeRunThroughGameplayCore = (
    run: RunState,
    observedAtMs: number,
    commandId: string
): GameplayRunLifecycleAdapterResult => {
    const command = createGameplayResumeCommand(commandId, observedAtMs);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Activates or refreshes the debug board reveal through replayable gameplay truth. */
export const activateDebugRevealThroughGameplayCore = (
    run: RunState,
    disableAchievementsOnDebug: boolean,
    commandId: string
): GameplayRunLifecycleAdapterResult => {
    const command = createGameplayDebugRevealActivateCommand(commandId, disableAchievementsOnDebug);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Ends an active debug board reveal with an explicit replayable lifecycle cause. */
export const deactivateDebugRevealThroughGameplayCore = (
    run: RunState,
    reason: GameplayDebugRevealDeactivationReason,
    commandId: string
): GameplayRunLifecycleAdapterResult => {
    const command = createGameplayDebugRevealDeactivateCommand(commandId, reason);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Applies only concrete anti-softlock repairs and journals their exact board consequences. */
export const repairRunProgressionThroughGameplayCore = (
    run: RunState,
    commandId: string
): GameplayRunLifecycleAdapterResult => {
    const command = createGameplayProgressionRepairCommand(commandId);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Applies an ordinary or dungeon-card flip through the same command boundary used by replay. */
export const applyTileFlipThroughGameplayCore = (
    run: RunState,
    tileId: string
): GameplayBoardInputAdapterResult => {
    const command = createTileFlipCommandForRun(run, tileId);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
};

/** Spends Destroy through one explicit command and returns its authoritative events directly. */
export const applyDestroyPairThroughGameplayCore = (
    run: RunState,
    tileId: string
): GameplayBoardInputAdapterResult => {
    const command = createGameplayDestroyPairCommand(
        `destroy-pair:${run.runSeed}:${run.board?.level ?? 0}:${run.destroyPairCharges}:${tileId}`,
        tileId
    );
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
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

/** Routes delayed board resolution and any floor-clear effects through one outer command. */
export const resolveBoardTurnThroughGameplayCore = (
    run: RunState,
    encorePairKeys: readonly string[],
    commandId: string
): GameplayBoardTurnAdapterResult => {
    const command = createGameplayBoardTurnResolveCommand(commandId, encorePairKeys);
    const result = reduceGameplayCommand(run, command);
    return {
        run: result.run,
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

/** Opens or safely skips one deterministic milestone draft under a serializable command. */
export const openRelicOfferThroughGameplayCore = (
    run: RunState,
    commandId: string
): GameplayRelicOfferOpenAdapterResult => {
    const command = createGameplayRelicOfferOpenCommand(commandId);
    const result = reduceGameplayCommand(run, command);
    return {
        accepted: result.accepted,
        command,
        events: result.events,
        run: result.accepted ? appendGameplayJournal(result.run, [command], result.events) : run
    };
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
