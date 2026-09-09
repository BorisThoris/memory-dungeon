import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import {
    createGameOverRunSummary,
    createRunSummary,
    createValidatedGameOverRunSummary
} from './run-summary-rules';
import { normalizeSaveData } from './save-data';
import { createGameplayDefinitionCommand } from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';

describe('createRunSummary', () => {
    it('owns terminal status, the end reason, and save-valid summary construction', () => {
        const run = finishMemorizePhase(createNewRun(100, { runSeed: 0x6601 }));
        const terminal = createGameOverRunSummary(run, []);
        const validated = createValidatedGameOverRunSummary(run, []);

        // A run ended from outside the rules was quit; the summary carries the reason.
        expect(terminal).toMatchObject({ status: 'gameOver', runEndReason: 'quit' });
        expect(terminal.lastRunSummary).toMatchObject({ runEndReason: 'quit' });
        expect(validated).toMatchObject({ status: 'gameOver', runEndReason: 'quit' });
        expect(validated.lastRunSummary).toEqual(
            normalizeSaveData({ lastRunSummary: terminal.lastRunSummary }).lastRunSummary
        );
    });

    it('persists final payoff counters for archive recap surfaces', () => {
        const run = finishMemorizePhase(createNewRun(100, { runSeed: 0xbeef }));
        const summarized = createRunSummary(
            {
                ...run,
                status: 'gameOver',
                findablesClaimedThisFloor: 2,
                findablesTotalThisFloor: 2,
                stats: {
                    ...run.stats,
                    mismatches: 1
                }
            },
            []
        );

        expect(summarized.lastRunSummary).toMatchObject({
            payoffPickupClaimed: 2,
            payoffPickupTotal: 2,
            payoffPressureExtra: 1
        });
    });

    it('round-trips every valid generated summary field through save normalization', () => {
        const run = finishMemorizePhase(
            createNewRun(100, {
                activeContract: {
                    noShuffle: true,
                    noDestroy: false,
                    maxMismatches: 3,
                    maxPinsTotalRun: 10
                },
                runSeed: 0xcafe
            })
        );
        const command = createGameplayDefinitionCommand('summary-peek', 'trait.conduit_echo_peek', {
            matchedTraits: ['conduit'],
            adjacentTraits: ['echo']
        });
        const commandResult = reduceGameplayCommand(run, command);
        const journaledRun = appendGameplayJournal(commandResult.run, [command], commandResult.events);
        const summary = createRunSummary(
            {
                ...journaledRun,
                status: 'gameOver'
            },
            ['ACH_FIRST_CLEAR']
        ).lastRunSummary!;
        const serializedSummary = JSON.parse(JSON.stringify(summary));

        expect(normalizeSaveData({ lastRunSummary: serializedSummary }).lastRunSummary).toEqual(serializedSummary);
        expect(summary.gameplayCommandJournal).toEqual([command]);
        expect(summary.gameplayEventJournal).toEqual(commandResult.events);
    });

    it('normalizes malformed runtime counters before persisting a summary', () => {
        const run = finishMemorizePhase(createNewRun(100, { runSeed: 0xbeef }));
        const summarized = createRunSummary(
            {
                ...run,
                status: 'gameOver',
                findablesClaimedThisFloor: 9,
                findablesTotalThisFloor: 2,
                activeMutators: Number.NaN,
                stats: {
                    ...run.stats,
                    totalScore: Number.NaN,
                    bestScore: -10,
                    levelsCleared: 1,
                    highestLevel: Number.POSITIVE_INFINITY,
                    bestStreak: 3.9,
                    perfectClears: 5,
                    mismatches: Number.NaN
                }
            } as unknown as RunState,
            []
        );

        expect(summarized.lastRunSummary).toMatchObject({
            totalScore: 0,
            bestScore: 0,
            levelsCleared: 1,
            highestLevel: 1,
            bestStreak: 3,
            perfectClears: 1,
            payoffPickupClaimed: 2,
            payoffPickupTotal: 2,
            payoffPressureExtra: 0,
            activeMutators: []
        });
    });

    it('fails closed when persisted stats are not an object', () => {
        const run = finishMemorizePhase(createNewRun(100, { runSeed: 0xbeef }));
        const summarized = createRunSummary(
            {
                ...run,
                status: 'gameOver',
                stats: Number.NaN
            } as unknown as RunState,
            []
        );

        expect(summarized.lastRunSummary).toMatchObject({
            totalScore: 0,
            bestScore: 0,
            levelsCleared: 0,
            highestLevel: 1,
            bestStreak: 0,
            perfectClears: 0,
            payoffPressureExtra: 0
        });
    });
});
