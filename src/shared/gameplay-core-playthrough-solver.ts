import type { RunState, Tile } from './contracts';
import { chooseDungeonExitActivationSpend } from './dungeon-exit-rules';
import { getDungeonExitStatus } from './dungeon-board-status';
import {
    createGameplayBoardTurnResolveCommand,
    createGameplayDungeonExitActivateCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayProgressionRepairCommand,
    createGameplayTileFlipCommand,
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import {
    getPrimaryPlaythroughExitTile,
    getUnresolvedPlayablePairGroups,
    type PlaythroughSolverStopReason,
    type PlaythroughSolverTrace
} from './playthrough-solver-rules';
import { createRunProgressionRepairTransition } from './run-progression-repair';
import { RUN_INVENTORY_ITEM_IDS, getRunInventoryItemQuantity } from './run-inventory';
import { EXIT_PAIR_KEY } from './tile-identity';

export interface GameplayCorePlaythroughSolverTrace extends PlaythroughSolverTrace {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    replayVerified: boolean;
    replayDeterministic: boolean;
    invariantViolations: string[];
}

interface MutableSolverState {
    run: RunState;
    commands: GameplayCommand[];
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    invariantViolations: string[];
}

const stableJson = (value: unknown): string => JSON.stringify(value);

const commandIdFor = (state: MutableSolverState, label: string): string =>
    `solver:${state.run.runSeed}:floor-${state.run.board?.level ?? 0}:${String(state.commands.length).padStart(4, '0')}:${label}`;

const orderPairForCurrentBoard = (run: RunState, pair: readonly Tile[]): Tile[] => {
    const blockedIndex = run.stickyBlockIndex;
    if (blockedIndex == null || (run.board?.flippedTileIds.length ?? 0) > 0) {
        return [...pair];
    }
    return [...pair].sort((left, right) => {
        const leftBlocked = run.board?.tiles.findIndex((tile) => tile.id === left.id) === blockedIndex;
        const rightBlocked = run.board?.tiles.findIndex((tile) => tile.id === right.id) === blockedIndex;
        return Number(leftBlocked) - Number(rightBlocked);
    });
};

const executeSolverCommand = (state: MutableSolverState, command: GameplayCommand): boolean => {
    const before = state.run;
    const result = reduceGameplayCommand(before, command);
    state.run = result.run;
    state.commands.push(command);
    state.events.push(...result.events);
    (result.accepted ? state.acceptedCommandIds : state.rejectedCommandIds).push(command.commandId);

    if (!gameplayCommandSchema.safeParse(command).success) {
        state.invariantViolations.push(`${command.commandId}: command failed schema validation.`);
    }
    result.events.forEach((event, sequence) => {
        if (!gameplayEventSchema.safeParse(event).success) {
            state.invariantViolations.push(`${command.commandId}: event ${sequence} failed schema validation.`);
        }
        if (
            event.commandId !== command.commandId ||
            event.sequence !== sequence ||
            event.eventId !== `${command.commandId}:${sequence}`
        ) {
            state.invariantViolations.push(`${command.commandId}: event ${sequence} lost deterministic identity or order.`);
        }
    });
    if (result.accepted === result.events.some((event) => event.type === 'command.rejected')) {
        state.invariantViolations.push(`${command.commandId}: acceptance disagrees with rejection events.`);
    }
    for (const itemId of RUN_INVENTORY_ITEM_IDS) {
        const quantity = getRunInventoryItemQuantity(result.run, itemId);
        if (!Number.isInteger(quantity) || quantity < 0) {
            state.invariantViolations.push(`${command.commandId}: ${itemId} quantity is invalid (${quantity}).`);
        }
    }
    if (result.run.runSeed !== before.runSeed || result.run.runRulesVersion !== before.runRulesVersion) {
        state.invariantViolations.push(`${command.commandId}: command changed deterministic run identity.`);
    }
    const feedbackDiagnostic = inspectGameplayFeedbackCompleteness({
        before,
        after: result.run,
        command,
        events: result.events,
        accepted: result.accepted
    });
    if (feedbackDiagnostic) {
        state.invariantViolations.push(feedbackDiagnostic.message);
    }
    return result.accepted;
};

const finalizeTrace = (
    initialRun: RunState,
    state: MutableSolverState,
    stopReason: PlaythroughSolverStopReason,
    turns: number,
    lastPairKey: string | null,
    lastTileIds: string[],
    verifyReplay: boolean
): GameplayCorePlaythroughSolverTrace => {
    const replay = verifyReplay
        ? replayGameplayCommands(
              initialRun,
              state.commands.map((command) => JSON.parse(JSON.stringify(command)))
          )
        : null;
    const replayDeterministic =
        replay == null ||
        (stableJson(replay.run) === stableJson(state.run) &&
            stableJson(replay.events) === stableJson(state.events) &&
            stableJson(replay.acceptedCommandIds) === stableJson(state.acceptedCommandIds) &&
            stableJson(replay.rejectedCommandIds) === stableJson(state.rejectedCommandIds));
    if (!replayDeterministic) {
        state.invariantViolations.push(`solver:${initialRun.runSeed}: command replay diverged.`);
    }
    return {
        run: state.run,
        stopReason,
        turns,
        lastPairKey,
        lastTileIds,
        commands: state.commands,
        events: state.events,
        acceptedCommandIds: state.acceptedCommandIds,
        rejectedCommandIds: state.rejectedCommandIds,
        replayVerified: verifyReplay,
        replayDeterministic,
        invariantViolations: state.invariantViolations
    };
};

/**
 * Exhausts a board through the same serializable command/event boundary used by
 * live play. The retained legacy solver remains available for parity checks
 * during the strangler migration.
 */
export const solveRunThroughGameplayCoreWithTrace = (
    initialRun: RunState,
    maxTurns = 160,
    verifyReplay = true
): GameplayCorePlaythroughSolverTrace => {
    const state: MutableSolverState = {
        run: initialRun,
        commands: [],
        events: [],
        acceptedCommandIds: [],
        rejectedCommandIds: [],
        invariantViolations: []
    };

    for (let turn = 0; turn < maxTurns; turn += 1) {
        if (!state.run.board) {
            return finalizeTrace(initialRun, state, 'missing_board', turn, null, [], verifyReplay);
        }
        if (state.run.status === 'gameOver') {
            return finalizeTrace(initialRun, state, 'terminal_status', turn, null, [], verifyReplay);
        }
        if (state.run.status === 'levelComplete') {
            if (createRunProgressionRepairTransition(state.run).repaired) {
                executeSolverCommand(
                    state,
                    createGameplayProgressionRepairCommand(commandIdFor(state, 'progression_repair'))
                );
            }
            return finalizeTrace(initialRun, state, 'level_complete', turn, null, [], verifyReplay);
        }
        if (state.run.status === 'memorize') {
            executeSolverCommand(
                state,
                createGameplayMemorizeCompleteCommand(commandIdFor(state, 'memorize_complete'))
            );
            continue;
        }

        const pair = getUnresolvedPlayablePairGroups(state.run.board)[0] ?? null;
        if (!pair) {
            if (createRunProgressionRepairTransition(state.run).repaired) {
                executeSolverCommand(
                    state,
                    createGameplayProgressionRepairCommand(commandIdFor(state, 'progression_repair'))
                );
            }
            const board = state.run.board;
            if (!board) {
                return finalizeTrace(initialRun, state, 'missing_board', turn, null, [], verifyReplay);
            }
            const exit = getPrimaryPlaythroughExitTile(board);
            if (!exit) {
                return finalizeTrace(initialRun, state, 'no_exit', turn, null, [], verifyReplay);
            }
            if (exit.state === 'hidden') {
                executeSolverCommand(
                    state,
                    createGameplayTileFlipCommand(commandIdFor(state, 'reveal_exit'), exit.id)
                );
            }
            const exitStatus = getDungeonExitStatus(state.run);
            executeSolverCommand(
                state,
                createGameplayDungeonExitActivateCommand(
                    commandIdFor(state, 'activate_exit'),
                    chooseDungeonExitActivationSpend(exitStatus)
                )
            );
            return finalizeTrace(initialRun, state, 'exit_attempted', turn, EXIT_PAIR_KEY, [exit.id], verifyReplay);
        }

        const [first, second] = orderPairForCurrentBoard(state.run, pair);
        if (!first || !second) {
            return finalizeTrace(
                initialRun,
                state,
                'missing_pair_tile',
                turn,
                pair[0]?.pairKey ?? null,
                pair.map((tile) => tile.id),
                verifyReplay
            );
        }
        const before = state.run;
        if (first.state === 'hidden') {
            executeSolverCommand(
                state,
                createGameplayTileFlipCommand(commandIdFor(state, 'flip_first'), first.id)
            );
        }
        const secondNow = state.run.board?.tiles.find((tile) => tile.id === second.id);
        if (secondNow?.state === 'hidden') {
            executeSolverCommand(
                state,
                createGameplayTileFlipCommand(commandIdFor(state, 'flip_second'), second.id)
            );
        }
        if (state.run.status === 'resolving') {
            executeSolverCommand(
                state,
                createGameplayBoardTurnResolveCommand(commandIdFor(state, 'resolve_turn'))
            );
        }
        if (state.run === before || stableJson(state.run) === stableJson(before)) {
            return finalizeTrace(
                initialRun,
                state,
                'no_progress',
                turn,
                first.pairKey,
                [first.id, second.id],
                verifyReplay
            );
        }
    }

    return finalizeTrace(initialRun, state, 'turn_guard', maxTurns, null, [], verifyReplay);
};

export const solveRunThroughGameplayCore = (run: RunState, maxTurns = 160): RunState =>
    solveRunThroughGameplayCoreWithTrace(run, maxTurns).run;
