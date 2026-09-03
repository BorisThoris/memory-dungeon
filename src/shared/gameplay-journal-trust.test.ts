import { describe, expect, it } from 'vitest';
import { createNewRun } from './game';
import { createGameplayRegionShuffleCommand } from './gameplay-core-contracts';
import {
    appendGameplayJournal,
    GAMEPLAY_COMMAND_JOURNAL_LIMIT,
    GAMEPLAY_EVENT_JOURNAL_LIMIT,
    normalizeGameplayJournalSnapshot
} from './gameplay-journal';

/**
 * The journal has one trust boundary — `normalizeGameplayJournalSnapshot`, which every save read
 * goes through — and appending inside a live run is on the trusted side of it. These tests pin both
 * halves of that split, because the argument for not re-parsing on append is only sound while the
 * boundary itself still rejects what it should.
 */
describe('the journal trust boundary', () => {
    it('drops entries a save file cannot vouch for', () => {
        const snapshot = normalizeGameplayJournalSnapshot({
            gameplayCommandJournal: [
                createGameplayRegionShuffleCommand('good', 0),
                { commandId: 'no-type' },
                'not an object',
                null,
                { rowIndex: 0, type: 'board.region_shuffle' }
            ],
            gameplayEventJournal: [{ nonsense: true }, 42]
        });

        expect(snapshot.commands.map((command) => command.commandId)).toEqual(['good']);
        expect(snapshot.events).toEqual([]);
    });

    it('survives a journal field that is not an array at all', () => {
        expect(
            normalizeGameplayJournalSnapshot({ gameplayCommandJournal: 'nope', gameplayEventJournal: { a: 1 } })
        ).toEqual({ commands: [], events: [] });
    });
});

describe('appending inside a run', () => {
    it('stays bounded however many commands a long run issues', () => {
        let run = createNewRun(0);
        for (let index = 0; index < GAMEPLAY_COMMAND_JOURNAL_LIMIT * 4; index += 1) {
            run = appendGameplayJournal(run, [createGameplayRegionShuffleCommand(`cmd:${index}`, 0)], []);
        }

        expect(run.gameplayCommandJournal).toHaveLength(GAMEPLAY_COMMAND_JOURNAL_LIMIT);
        // The newest survive: a replay reconstructs from the end of the run backwards.
        expect(run.gameplayCommandJournal?.at(-1)?.commandId).toBe(
            `cmd:${GAMEPLAY_COMMAND_JOURNAL_LIMIT * 4 - 1}`
        );
        expect(GAMEPLAY_EVENT_JOURNAL_LIMIT).toBeGreaterThan(GAMEPLAY_COMMAND_JOURNAL_LIMIT);
    });

    it('lets a re-issued command replace its earlier entry rather than duplicating it', () => {
        let run = createNewRun(0);
        run = appendGameplayJournal(run, [createGameplayRegionShuffleCommand('same', 0)], []);
        run = appendGameplayJournal(run, [createGameplayRegionShuffleCommand('other', 1)], []);
        run = appendGameplayJournal(run, [createGameplayRegionShuffleCommand('same', 2)], []);

        expect(run.gameplayCommandJournal?.map((command) => command.commandId)).toEqual(['other', 'same']);
    });

    it('returns the run untouched when there is nothing to append', () => {
        const run = createNewRun(0);
        expect(appendGameplayJournal(run, [], [])).toBe(run);
    });

    it('produces a journal the boundary accepts unchanged', () => {
        // The round trip is the actual safety property: whatever appending builds has to survive
        // being written to a save and read back, or the two halves have drifted apart.
        let run = createNewRun(0);
        for (let index = 0; index < 10; index += 1) {
            run = appendGameplayJournal(run, [createGameplayRegionShuffleCommand(`cmd:${index}`, index % 3)], []);
        }
        const reloaded = normalizeGameplayJournalSnapshot({
            gameplayCommandJournal: run.gameplayCommandJournal,
            gameplayEventJournal: run.gameplayEventJournal
        });

        expect(reloaded.commands).toEqual(run.gameplayCommandJournal);
    });
});
