import type { RunState } from '../../shared/contracts';
import {
    gameplayEventSchema,
    type GameplayEvent
} from '../../shared/gameplay-core-contracts';

export type GameplayFeedbackAudioCategory =
    | 'destroy-pair'
    | 'flash-pair'
    | 'gambit-commit'
    | 'hazard-banish'
    | 'match-resolution'
    | 'peek'
    | 'relic-pick'
    | 'relic-service'
    | 'reward-claim'
    | 'shop-purchase'
    | 'exit-activate'
    | 'parasite'
    | 'route-choice'
    | 'wild-match'
    | 'undo'
    | 'wager';

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
    if (feedback.source.kind === 'reward_perk' && feedback.source.id === 'hazard_banish_per_floor') {
        return 'hazard-banish';
    }
    if (feedback.source.kind === 'shop') {
        return 'shop-purchase';
    }
    if (feedback.source.kind === 'system' && feedback.cue === 'dungeon.exit.activated') {
        return 'exit-activate';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'score_parasite') {
        return 'parasite';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'route_choice') {
        return 'route-choice';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'relic_offer') {
        return 'relic-service';
    }
    if (feedback.source.kind === 'system' && feedback.source.id === 'wild_joker') {
        return 'wild-match';
    }
    if (feedback.source.kind === 'system' && feedback.cue === 'build.route_gambler.wager_accepted') {
        return 'wager';
    }
    if (feedback.source.kind === 'relic' && feedback.cue.endsWith('.claimed')) {
        return 'relic-pick';
    }
    if (feedback.source.kind === 'bonus_reward') {
        return 'reward-claim';
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
