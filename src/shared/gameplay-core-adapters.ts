import type { FindableKind, RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    createGameplayBoardTurnResolveCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayWildMatchConsumeCommand,
    createGameplayTileFlipCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayPauseCommand,
    createGameplayResumeCommand,
    createGameplayGauntletExpireCommand,
    createGameplayDebugRevealActivateCommand,
    createGameplayDebugRevealDeactivateCommand,
    type GameplayCommand,
    type GameplayEvent,
    type GameplayPauseTimerSnapshot
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';

export interface GameplayMatchRewardAdapterResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    comboShardGain: number;
    scoreGain: number;
    migrated: boolean;
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
            : findableKind === 'score_glint'
              ? 'findable.score_glint'
              : null;
    if (!definitionId || !findableKind) {
        return {
            commands: [],
            events: [],
            comboShardGain: 0,
            scoreGain: 0,
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
        scoreGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'score.requested' ? event.amount : 0),
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
