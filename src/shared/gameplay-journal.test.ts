import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    createGameplayPeekCommand
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import {
    appendGameplayJournal,
    GAMEPLAY_COMMAND_JOURNAL_LIMIT,
    GAMEPLAY_EVENT_JOURNAL_LIMIT,
    getGameplayJournalSnapshot,
    normalizeGameplayJournalSnapshot
} from './gameplay-journal';

const run = (overrides: Partial<RunState> = {}): RunState =>
    ({
        status: 'playing',
        peekCharges: 0,
        rewardPerkIds: [],
        stats: {},
        ...overrides
    }) as RunState;

describe('gameplay command and event journal', () => {
    it('retains complete schema-validated command payloads and events', () => {
        const initial = run();
        const command = createGameplayDefinitionCommand('journal-lens', 'bonus_reward.echo_conduit_lens');
        const result = reduceGameplayCommand(initial, command);
        const journaled = appendGameplayJournal(result.run, [command], result.events);
        const snapshot = getGameplayJournalSnapshot(journaled);

        expect(snapshot.commands).toEqual([command]);
        expect(snapshot.events).toEqual(result.events);
        expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    });

    it('drops malformed entries, deduplicates stable IDs, and keeps the newest bounded window', () => {
        const commands = Array.from({ length: GAMEPLAY_COMMAND_JOURNAL_LIMIT + 8 }, (_, index) =>
            createGameplayPeekCommand(`peek-${index}`, `tile-${index}`)
        );
        const events = Array.from({ length: GAMEPLAY_EVENT_JOURNAL_LIMIT + 8 }, (_, index) => ({
            schemaVersion: 1,
            eventId: `event-${index}`,
            commandId: `peek-${index}`,
            sequence: 0,
            source: { kind: 'system', id: 'journal-test' },
            type: 'feedback.requested',
            cue: 'journal.test',
            message: `Event ${index}`,
            tone: 'information'
        }));
        const normalized = normalizeGameplayJournalSnapshot({
            gameplayCommandJournal: [{ bad: true }, commands[0], ...commands, commands.at(-1)],
            gameplayEventJournal: [{ bad: true }, events[0], ...events, events.at(-1)]
        });

        expect(normalized.commands).toHaveLength(GAMEPLAY_COMMAND_JOURNAL_LIMIT);
        expect(normalized.commands[0]?.commandId).toBe('peek-8');
        expect(normalized.commands.at(-1)?.commandId).toBe(`peek-${GAMEPLAY_COMMAND_JOURNAL_LIMIT + 7}`);
        expect(normalized.events).toHaveLength(GAMEPLAY_EVENT_JOURNAL_LIMIT);
        expect(normalized.events[0]?.eventId).toBe('event-8');
        expect(normalized.events.at(-1)?.eventId).toBe(`event-${GAMEPLAY_EVENT_JOURNAL_LIMIT + 7}`);
    });
});
