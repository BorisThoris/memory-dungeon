import type {
    GameplayCommandJournalEntry,
    GameplayEventJournalEntry,
    RunState
} from './contracts';
import {
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayCommand,
    type GameplayEvent
} from './gameplay-core-contracts';

export const GAMEPLAY_COMMAND_JOURNAL_LIMIT = 64;
export const GAMEPLAY_EVENT_JOURNAL_LIMIT = 256;

export interface GameplayJournalSnapshot {
    commands: GameplayCommandJournalEntry[];
    events: GameplayEventJournalEntry[];
}

/**
 * Keeps the newest `limit` entries, with a later entry replacing an earlier one that shares an id.
 * Position follows the newer entry: a replayed command belongs where it was re-issued.
 */
const boundedUniqueBy = <T>(items: readonly T[], limit: number, keyOf: (item: T) => string): T[] => {
    const byId = new Map<string, T>();
    for (const item of items) {
        const key = keyOf(item);
        if (byId.has(key)) byId.delete(key);
        byId.set(key, item);
    }
    return [...byId.values()].slice(-limit);
};

const normalizeCommands = (value: unknown): GameplayCommand[] =>
    (Array.isArray(value) ? value : []).flatMap((entry) => {
        const parsed = gameplayCommandSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
    });

const normalizeEvents = (value: unknown): GameplayEvent[] =>
    (Array.isArray(value) ? value : []).flatMap((entry) => {
        const parsed = gameplayEventSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
    });

export const normalizeGameplayJournalSnapshot = (input: {
    gameplayCommandJournal?: unknown;
    gameplayEventJournal?: unknown;
}): GameplayJournalSnapshot => ({
    commands: boundedUniqueBy(
        normalizeCommands(input.gameplayCommandJournal),
        GAMEPLAY_COMMAND_JOURNAL_LIMIT,
        (command) => command.commandId
    ),
    events: boundedUniqueBy(
        normalizeEvents(input.gameplayEventJournal),
        GAMEPLAY_EVENT_JOURNAL_LIMIT,
        (event) => event.eventId
    )
});

export const getGameplayJournalSnapshot = (
    run: Pick<RunState, 'gameplayCommandJournal' | 'gameplayEventJournal'>
): GameplayJournalSnapshot => normalizeGameplayJournalSnapshot(run);

/**
 * Appends to a run's journal.
 *
 * Deliberately does not re-validate what the journal already holds. Schema parsing belongs at the
 * trust boundary — `normalizeGameplayJournalSnapshot`, which every save read goes through — and the
 * entries already in a live run came either from there or from a command factory. Re-parsing them
 * meant a Zod pass over all 320 retained entries on every single gameplay command, which is most of
 * a millisecond of nothing on modest hardware, repeated on every tile press and every step of a
 * resolve cascade.
 *
 * The new entries are typed `GameplayCommand` / `GameplayEvent`, so the only way to get unchecked
 * data in here is to construct one by hand and lie about its type.
 */
export const appendGameplayJournal = (
    run: RunState,
    commands: readonly GameplayCommand[],
    events: readonly GameplayEvent[]
): RunState => {
    if (commands.length === 0 && events.length === 0) return run;
    return {
        ...run,
        gameplayCommandJournal: boundedUniqueBy(
            [...(run.gameplayCommandJournal ?? []), ...commands],
            GAMEPLAY_COMMAND_JOURNAL_LIMIT,
            (command) => command.commandId
        ),
        gameplayEventJournal: boundedUniqueBy(
            [...(run.gameplayEventJournal ?? []), ...events],
            GAMEPLAY_EVENT_JOURNAL_LIMIT,
            (event) => event.eventId
        )
    };
};

export const getGameplayJournalSummaryFields = (
    run: Pick<RunState, 'gameplayCommandJournal' | 'gameplayEventJournal'>
): Pick<RunState, 'gameplayCommandJournal' | 'gameplayEventJournal'> => {
    const snapshot = getGameplayJournalSnapshot(run);
    return {
        ...(snapshot.commands.length > 0 ? { gameplayCommandJournal: snapshot.commands } : {}),
        ...(snapshot.events.length > 0 ? { gameplayEventJournal: snapshot.events } : {})
    };
};
