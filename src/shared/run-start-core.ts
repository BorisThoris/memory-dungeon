import { getBuiltinPuzzle } from './builtin-puzzles';
import type { RunState } from './contracts';
import { createDungeonShowcaseRun } from './dungeon-showcase-run-rules';
import {
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayEvent,
    type GameplaySource
} from './gameplay-core-contracts';
import { makeGameplayEventWriter } from './gameplay-effect-transition';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';
import {
    createDailyRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createWildRun,
    type CreateRunOptions
} from './run-creation-rules';
import {
    runStartCommandSchema,
    type RunStartCommand
} from './run-start-core-contracts';

export interface RunStartCommandResult {
    accepted: boolean;
    command: RunStartCommand | null;
    events: GameplayEvent[];
    run: RunState | null;
}

export interface RunSessionReplayResult {
    acceptedCommandIds: string[];
    events: GameplayEvent[];
    rejectedCommandIds: string[];
    run: RunState | null;
}

const RUN_START_SOURCE: GameplaySource = { kind: 'system', id: 'run_start' };

const rejectedRunStart = (
    commandId: string,
    reason: string,
    command: RunStartCommand | null
): RunStartCommandResult => {
    const events: GameplayEvent[] = [];
    makeGameplayEventWriter(commandId, RUN_START_SOURCE, events)({
        type: 'command.rejected',
        reason
    });
    return { accepted: false, command, events, run: null };
};

const commonRunOptions = (command: RunStartCommand): CreateRunOptions => ({
    echoFeedbackEnabled: command.settings.echoFeedbackEnabled,
    metaRelicDraftExtraPerMilestone: command.metaRelicDraftExtraPerMilestone,
    resolveDelayMultiplier: command.settings.resolveDelayMultiplier,
    runRulesVersionOverride: command.runRulesVersion,
    runSeed: command.runSeed,
    shuffleScoreTaxActive: command.settings.shuffleScoreTaxEnabled,
    startedAtMs: command.observedAtMs,
    startingLoadoutId: command.startingLoadoutId,
    weakerShuffleMode: command.settings.weakerShuffleMode
});

const createRunFromCommand = (command: RunStartCommand): RunState | null => {
    const options = commonRunOptions(command);
    switch (command.request.kind) {
        case 'daily':
            return createDailyRun(command.bestScore, options);
        case 'dungeonShowcase':
            return createDungeonShowcaseRun(command.bestScore, options);
        case 'endless':
            return createNewRun(command.bestScore, {
                ...options,
                onboardingSafeFirstFloor: !command.onboardingDismissed
            });
        case 'gauntlet':
            return createGauntletRun(command.bestScore, command.request.durationMs, options);
        case 'meditation':
            return createMeditationRun(command.bestScore, undefined, options);
        case 'meditationWithMutators':
            return createMeditationRun(command.bestScore, command.request.mutators, options);
        case 'pinVow':
            return createNewRun(command.bestScore, {
                ...options,
                activeContract: command.activeContractOverride ?? {
                    noShuffle: false,
                    noDestroy: false,
                    maxMismatches: null,
                    maxPinsTotalRun: 10
                }
            });
        case 'practice':
            return createNewRun(command.bestScore, { ...options, practiceMode: true });
        case 'puzzle': {
            const puzzle = getBuiltinPuzzle(command.request.puzzleId);
            return puzzle
                ? createPuzzleRun(command.bestScore, puzzle.id, puzzle.tiles, 1, options)
                : null;
        }
        case 'scholarContract':
            return createNewRun(command.bestScore, {
                ...options,
                activeContract: command.activeContractOverride ?? {
                    noShuffle: true,
                    noDestroy: true,
                    maxMismatches: null,
                    bonusRelicDraftPick: true
                }
            });
        case 'wild':
            return createWildRun(command.bestScore, options);
    }
};

const startFeedbackMessage = (command: RunStartCommand, run: RunState): string => {
    const restartPrefix = command.reason === 'restart' ? 'Restarted' : 'Started';
    const mode = command.request.kind === 'meditationWithMutators'
        ? 'focused meditation'
        : command.request.kind.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return `${restartPrefix} ${mode} on seed ${run.runSeed}.`;
};

export const reduceRunStartCommand = (input: unknown): RunStartCommandResult => {
    const parsed = runStartCommandSchema.safeParse(input);
    if (!parsed.success) {
        return rejectedRunStart('invalid-run-start', 'Run start command failed schema validation.', null);
    }
    const command = parsed.data;
    if (command.type === 'run.start') {
        const run = createRunFromCommand(command);
        if (!run) {
            return rejectedRunStart(
                command.commandId,
                command.request.kind === 'puzzle'
                    ? `Unknown built-in puzzle: ${command.request.puzzleId}.`
                    : 'Run start request could not create a run.',
                command
            );
        }
        const events: GameplayEvent[] = [];
        const writeEvent = makeGameplayEventWriter(command.commandId, RUN_START_SOURCE, events);
        writeEvent({
            type: 'run.started',
            reason: command.reason,
            startKind: command.request.kind,
            runSeed: run.runSeed,
            runRulesVersion: run.runRulesVersion,
            gameMode: run.gameMode,
            practiceMode: run.practiceMode,
            startingLoadoutId: run.startingLoadoutId ?? null,
            floor: run.board?.level ?? 1,
            memorizeDurationMs: run.timerState.memorizeRemainingMs ?? 0,
            gauntletDeadlineMs: run.gauntletDeadlineMs,
            dailyDateKeyUtc: run.dailyDateKeyUtc
        });
        writeEvent({
            type: 'feedback.requested',
            cue: 'run.started',
            message: startFeedbackMessage(command, run),
            tone: 'information'
        });
        for (const event of events) gameplayEventSchema.parse(event);
        return {
            accepted: true,
            command,
            events,
            run: appendGameplayJournal(run, [command], events)
        };
    }
    return rejectedRunStart(command.commandId, 'Parsed run start command has no reducer handler.', command);
};

export const replayRunStartCommand = (input: unknown): RunStartCommandResult =>
    reduceRunStartCommand(JSON.parse(JSON.stringify(input)) as unknown);

/** Replays a complete persisted command stream beginning before RunState exists. */
export const replayRunSessionCommands = (inputs: readonly unknown[]): RunSessionReplayResult => {
    const [startInput, ...activeInputs] = JSON.parse(JSON.stringify(inputs)) as unknown[];
    const start = reduceRunStartCommand(startInput);
    const acceptedCommandIds = start.accepted && start.command ? [start.command.commandId] : [];
    const rejectedCommandIds = start.accepted
        ? []
        : [start.command?.commandId ?? start.events[0]?.commandId ?? 'invalid-run-start'];
    const events = [...start.events];
    let run = start.run;
    if (!run) return { run, events, acceptedCommandIds, rejectedCommandIds };

    for (const input of activeInputs) {
        const parsed = gameplayCommandSchema.safeParse(input);
        const result = reduceGameplayCommand(run, input);
        const command = parsed.success ? parsed.data : null;
        if (result.accepted && command) {
            run = appendGameplayJournal(result.run, [command], result.events);
            acceptedCommandIds.push(command.commandId);
        } else {
            run = result.run;
            rejectedCommandIds.push(
                command?.commandId ?? result.events[0]?.commandId ?? 'invalid-command'
            );
        }
        events.push(...result.events);
    }
    return { run, events, acceptedCommandIds, rejectedCommandIds };
};
