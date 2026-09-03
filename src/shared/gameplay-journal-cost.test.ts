import { describe, expect, it } from 'vitest';
import { createNewRun } from './game';
import { createGameplayRegionShuffleCommand } from './gameplay-core-contracts';
import { appendGameplayJournal, GAMEPLAY_COMMAND_JOURNAL_LIMIT } from './gameplay-journal';

/**
 * Appending to the journal happens on every gameplay command — every tile press, every step of a
 * resolve cascade — so its cost is paid at exactly the moment a player is waiting to see something
 * happen. It used to re-run schema validation over all 320 retained entries each time, which cost
 * roughly 133us per command on a fast desktop and rather more on a Deck.
 *
 * The budget is deliberately loose. This is a shared machine under load and a tight number would
 * fail for reasons that have nothing to do with the code; what it has to catch is a return to
 * re-parsing the whole journal, which is an order of magnitude, not a few percent.
 */
const APPEND_BUDGET_US = 60;
const SAMPLE_SIZE = 2000;

describe('the cost of journalling a command', () => {
    it('does not scale with what the journal already holds', () => {
        let run = createNewRun(0);
        // Fill past the retention limit first, so every measured append works against a full journal.
        for (let index = 0; index < GAMEPLAY_COMMAND_JOURNAL_LIMIT * 2; index += 1) {
            run = appendGameplayJournal(run, [createGameplayRegionShuffleCommand(`warm:${index}`, 0)], []);
        }
        expect(run.gameplayCommandJournal).toHaveLength(GAMEPLAY_COMMAND_JOURNAL_LIMIT);

        const startedAt = performance.now();
        for (let index = 0; index < SAMPLE_SIZE; index += 1) {
            run = appendGameplayJournal(run, [createGameplayRegionShuffleCommand(`cmd:${index}`, 0)], []);
        }
        const microsecondsEach = ((performance.now() - startedAt) / SAMPLE_SIZE) * 1000;

        expect(
            microsecondsEach,
            `journal append cost rose to ${microsecondsEach.toFixed(0)}us per command (budget ${APPEND_BUDGET_US}us); ` +
                'the usual cause is validating entries that were already validated on the way in'
        ).toBeLessThan(APPEND_BUDGET_US);
    });
});
