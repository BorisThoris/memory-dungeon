import { describe, expect, it } from 'vitest';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import { GAME_RULES_VERSION } from './contracts';
import {
    createGameplayMemorizeCompleteCommand,
    gameplayEventSchema
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';
import {
    replayRunSessionCommands,
    replayRunStartCommand,
    reduceRunStartCommand
} from './run-start-core';
import {
    canonicalRunStartSeed,
    createRestartRunSelection,
    createRunStartCommand,
    gameplaySettingsForRunStart,
    runStartCommandSchema,
    type RunStartRequest
} from './run-start-core-contracts';
import { createNewRun } from './run-creation-rules';
import { createGameOverRunSummary } from './run-summary-rules';
import { createDefaultSaveData, normalizeSaveData } from './save-data';

const OBSERVED_AT_MS = Date.UTC(2026, 7, 4, 12, 30);
const PROPOSED_RUN_SEED = 81_337;

const commandFor = (request: RunStartRequest, index = 0) => {
    const saveData = createDefaultSaveData();
    return createRunStartCommand({
        bestScore: 4321,
        commandId: `run-start-test:${index}:${request.kind}`,
        metaRelicDraftExtraPerMilestone: 1,
        observedAtMs: OBSERVED_AT_MS,
        onboardingDismissed: true,
        proposedRunSeed: PROPOSED_RUN_SEED + index,
        reason: 'new',
        request,
        settings: gameplaySettingsForRunStart({
            ...saveData.settings,
            echoFeedbackEnabled: false,
            resolveDelayMultiplier: 1.5,
            shuffleScoreTaxEnabled: true,
            weakerShuffleMode: 'rows_only'
        })
    });
};

describe('run start command core', () => {
    it('starts every live mode from one schema-validated command and journals its event feedback', () => {
        const requests: RunStartRequest[] = [
            { kind: 'daily' },
            { kind: 'dungeonShowcase' },
            { kind: 'endless' },
            { durationMs: 123_000, kind: 'gauntlet' },
            { kind: 'meditation' },
            { kind: 'meditationWithMutators', mutators: ['wide_recall', 'n_back_anchor'] },
            { kind: 'pinVow' },
            { kind: 'practice' },
            { kind: 'puzzle', puzzleId: BUILTIN_PUZZLES.starter_pairs.id },
            { kind: 'scholarContract' },
            { kind: 'wild' }
        ];

        for (const [index, request] of requests.entries()) {
            const command = commandFor(request, index);
            const result = reduceRunStartCommand(command);

            expect(result.accepted, request.kind).toBe(true);
            expect(result.run, request.kind).not.toBeNull();
            expect(result.command).toEqual(command);
            expect(result.events.map((event) => gameplayEventSchema.parse(event).type)).toEqual([
                'run.started',
                'feedback.requested'
            ]);
            expect(result.run?.gameplayCommandJournal).toEqual([command]);
            expect(result.run?.gameplayEventJournal).toEqual(result.events);
            expect(result.run).toMatchObject({
                echoFeedbackEnabled: false,
                resolveDelayMultiplier: 1.5,
                shuffleScoreTaxActive: true,
                weakerShuffleMode: 'rows_only'
            });
        }
    });

    it('captures daily identity and gauntlet deadline from the serialized observation', () => {
        const daily = reduceRunStartCommand(commandFor({ kind: 'daily' }));
        const gauntlet = reduceRunStartCommand(commandFor({ durationMs: 123_000, kind: 'gauntlet' }, 1));

        expect(daily.run).toMatchObject({
            dailyDateKeyUtc: '20260804',
            runSeed: canonicalRunStartSeed(
                { kind: 'daily' },
                OBSERVED_AT_MS,
                GAME_RULES_VERSION,
                PROPOSED_RUN_SEED
            )
        });
        expect(gauntlet.run).toMatchObject({
            gauntletDeadlineMs: OBSERVED_AT_MS + 123_000,
            gauntletSessionDurationMs: 123_000,
            runSeed: PROPOSED_RUN_SEED + 1
        });
    });

    it('replays a JSON-round-tripped start command to byte-equivalent run state and events', () => {
        const command = commandFor({ kind: 'endless' });
        const first = reduceRunStartCommand(command);
        const replay = replayRunStartCommand(command);

        expect(replay).toEqual(first);
        expect(JSON.stringify(replay.run)).toBe(JSON.stringify(first.run));
    });

    it('replays the persisted command stream from no run through the first active state transition', () => {
        const startCommand = commandFor({ kind: 'endless' });
        const started = reduceRunStartCommand(startCommand);
        const memorizeCommand = createGameplayMemorizeCompleteCommand('session-replay:memorize-complete');
        const completed = reduceGameplayCommand(started.run!, memorizeCommand);
        const expectedRun = appendGameplayJournal(completed.run, [memorizeCommand], completed.events);

        const replay = replayRunSessionCommands([startCommand, memorizeCommand]);

        expect(replay).toMatchObject({
            acceptedCommandIds: [startCommand.commandId, memorizeCommand.commandId],
            rejectedCommandIds: [],
            run: expectedRun
        });
        expect(replay.events.map((event) => event.type)).toEqual([
            'run.started',
            'feedback.requested',
            'phase.memorize_completed',
            'feedback.requested'
        ]);
    });

    it('carries bootstrap command and event evidence through the validated save summary', () => {
        const started = reduceRunStartCommand(commandFor({ kind: 'endless' }));
        const summarized = createGameOverRunSummary(started.run!, []);
        const normalized = normalizeSaveData({
            ...createDefaultSaveData(),
            lastRunSummary: summarized.lastRunSummary
        });

        expect(normalized.lastRunSummary?.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.start' })
        ]);
        expect(normalized.lastRunSummary?.gameplayEventJournal).toEqual([
            expect.objectContaining({ type: 'run.started' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'run.started' })
        ]);
    });

    it('rejects forged daily seeds and unknown puzzle content atomically', () => {
        const daily = commandFor({ kind: 'daily' });
        expect(runStartCommandSchema.safeParse({ ...daily, runSeed: daily.runSeed + 1 }).success).toBe(false);

        const missingPuzzle = commandFor({ kind: 'puzzle', puzzleId: 'missing-puzzle' });
        const rejected = reduceRunStartCommand(missingPuzzle);
        expect(rejected).toMatchObject({ accepted: false, run: null });
        expect(rejected.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', commandId: missingPuzzle.commandId })
        ]);
    });

    it('turns prior run identity into a serializable restart selection without renderer rules', () => {
        const previous = createNewRun(0, {
            activeContract: { noDestroy: false, noShuffle: false, maxMismatches: null, maxPinsTotalRun: 10 },
            runSeed: 12,
            startingLoadoutId: 'route_tactician'
        });

        expect(createRestartRunSelection(previous)).toEqual({
            activeContractOverride: previous.activeContract,
            request: { kind: 'pinVow' },
            startingLoadoutId: 'route_tactician'
        });
    });
});
