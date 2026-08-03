interface TypedGameplayFeedback {
    eventId: string;
    message: string;
    priority: 'error' | 'info';
}

interface CommandScopedTypedGameplayFeedback extends TypedGameplayFeedback {
    commandId: string;
}

export interface GameplayEventAnnouncementPresentation {
    dedupeKey: string;
    message: string;
    priority: 'error' | 'info';
}

export interface GameplayEventBatchAnnouncementPresentation extends GameplayEventAnnouncementPresentation {
    consumedEventIds: string[];
}

/**
 * Projects schema-validated core feedback without consulting mutable renderer state.
 * The event id is the replay-stable presentation identity for the accepted command.
 */
export const buildGameplayEventAnnouncement = (
    feedback: TypedGameplayFeedback
): GameplayEventAnnouncementPresentation => ({
    dedupeKey: `gameplay-event:${feedback.eventId}`,
    message: feedback.message,
    priority: feedback.priority
});

/**
 * Projects every feedback event from one accepted command as one ordered live
 * update. The latest command owns the batch, while duplicate persisted event
 * identities are ignored without consulting mutable gameplay state.
 */
export const buildGameplayEventBatchAnnouncement = (
    feedback: readonly CommandScopedTypedGameplayFeedback[]
): GameplayEventBatchAnnouncementPresentation | null => {
    const commandId = feedback.at(-1)?.commandId;
    if (!commandId) {
        return null;
    }

    const seenEventIds = new Set<string>();
    const commandFeedback = feedback.filter((item) => {
        if (item.commandId !== commandId || seenEventIds.has(item.eventId)) {
            return false;
        }
        seenEventIds.add(item.eventId);
        return true;
    });
    if (commandFeedback.length === 0) {
        return null;
    }

    const consumedEventIds = commandFeedback.map((item) => item.eventId);
    return {
        consumedEventIds,
        dedupeKey: `gameplay-command:${commandId}:${consumedEventIds.join(',')}`,
        message: commandFeedback.map((item) => item.message).join(' '),
        priority: commandFeedback.some((item) => item.priority === 'error') ? 'error' : 'info'
    };
};
