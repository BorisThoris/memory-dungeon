import type { RunState } from '../../shared/contracts';
import {
    gameplayEventSchema,
    type GameplayEvent
} from '../../shared/gameplay-core-contracts';

export type GameplayFeedbackAudioCategory =
    | 'destroy-pair'
    | 'flash-pair'
    | 'gambit-commit'
    | 'match-resolution'
    | 'peek'
    | 'floor-advance'
    | 'parasite'
    | 'wild-match'
    | 'undo'
    | 'curio-greet';

export interface GameplayFeedbackPresentation {
    audioCategory: GameplayFeedbackAudioCategory;
    commandId: string;
    cue: string;
    eventId: string;
    message: string;
    priority: 'error' | 'info';
    source: GameplayEvent['source'];
    tone: Extract<GameplayEvent, { type: 'feedback.requested' }>['tone'];
}

const parseEvents = (value: unknown): GameplayEvent[] =>
    (Array.isArray(value) ? value : []).flatMap((entry) => {
        const parsed = gameplayEventSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
    });

const audioCategoryFor = (
    feedback: Extract<GameplayEvent, { type: 'feedback.requested' }>
): GameplayFeedbackAudioCategory => {
    if (feedback.source.kind === 'power' && feedback.cue === 'power.peek.used') {
        return 'peek';
    }
    if (feedback.source.kind === 'power' && feedback.cue === 'power.destroy_pair.used') {
        return 'destroy-pair';
    }
    if (feedback.source.kind === 'power' && feedback.cue === 'power.gambit.committed') {
        return 'gambit-commit';
    }
    if (feedback.source.kind === 'power' && feedback.cue === 'power.flash_pair.used') {
        return 'flash-pair';
    }
    if (feedback.source.kind === 'power' && feedback.cue === 'power.undo_resolve.used') {
        return 'undo';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'score_parasite') {
        return 'parasite';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'floor_advance') {
        return 'floor-advance';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'floor_curio') {
        return 'curio-greet';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'wild_joker') {
        return 'wild-match';
    }
    return 'match-resolution';
};

const messageFor = (
    feedback: Extract<GameplayEvent, { type: 'feedback.requested' }>,
    events: readonly GameplayEvent[]
): string => {
    const overflowScore = events.find(
        (event): event is Extract<GameplayEvent, { type: 'score.changed' }> =>
            event.commandId === feedback.commandId &&
            event.type === 'score.changed' &&
            event.reason === 'inventory_overflow'
    );
    return overflowScore
        ? `${feedback.message} Inventory overflow converted to +${overflowScore.amount} score.`
        : feedback.message;
};

/**
 * Converts gameplay truth into renderer concerns. Invalid persisted entries are ignored,
 * and presentation is deduplicated by the core-owned event id.
 */
/**
 * The resolved-turn event, named once here so the floor-clear feedback model and its
 * test share the shape with the store rather than each re-deriving the Extract.
 */
export type BoardTurnResolvedEvent = Extract<GameplayEvent, { type: 'board.turn_resolved' }>;

/**
 * The most recent resolved turn on a run's event journal, or null before any turn has
 * resolved. Surfaces should read the turn from here rather than diffing board state.
 */
export const getLatestBoardTurnResolvedEvent = ({
    gameplayEventJournal
}: {
    gameplayEventJournal?: unknown;
}): BoardTurnResolvedEvent | null => {
    const events = Array.isArray(gameplayEventJournal) ? gameplayEventJournal : [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index] as GameplayEvent | undefined;
        if (event && event.type === 'board.turn_resolved') {
            return event;
        }
    }
    return null;
};

export const projectGameplayFeedback = (value: unknown): GameplayFeedbackPresentation[] => {
    const events = parseEvents(value);
    const presentations = events.flatMap((event) => {
        if (event.type !== 'feedback.requested') {
            return [];
        }
        return [{
            audioCategory: audioCategoryFor(event),
            commandId: event.commandId,
            cue: event.cue,
            eventId: event.eventId,
            message: messageFor(event, events),
            priority: event.tone === 'warning' ? 'error' : 'info',
            source: event.source,
            tone: event.tone
        } satisfies GameplayFeedbackPresentation];
    });
    return [...new Map(presentations.map((presentation) => [presentation.eventId, presentation])).values()];
};

export const getLatestGameplayFeedback = (
    run: Pick<RunState, 'gameplayEventJournal'> | null | undefined
): GameplayFeedbackPresentation | null => projectGameplayFeedback(run?.gameplayEventJournal).at(-1) ?? null;

export const getNewGameplayFeedback = (
    before: Pick<RunState, 'gameplayEventJournal'> | null | undefined,
    after: Pick<RunState, 'gameplayEventJournal'> | null | undefined
): GameplayFeedbackPresentation[] => {
    const previousEventIds = new Set(projectGameplayFeedback(before?.gameplayEventJournal).map((item) => item.eventId));
    return projectGameplayFeedback(after?.gameplayEventJournal).filter((item) => !previousEventIds.has(item.eventId));
};
