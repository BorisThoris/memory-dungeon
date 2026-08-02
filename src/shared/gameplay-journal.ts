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

export const appendGameplayJournal = (
    run: RunState,
    commands: readonly GameplayCommand[],
    events: readonly GameplayEvent[]
): RunState => {
    if (commands.length === 0 && events.length === 0) return run;
    const current = getGameplayJournalSnapshot(run);
    const next = normalizeGameplayJournalSnapshot({
        gameplayCommandJournal: [...current.commands, ...commands],
        gameplayEventJournal: [...current.events, ...events]
    });
    return {
        ...run,
        gameplayCommandJournal: next.commands,
        gameplayEventJournal: next.events
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
