import type { RunState } from './contracts';
import type { GameplayCommand, GameplayEvent } from './gameplay-core-contracts';
import {
    getGameplayFeedbackCriticalSnapshot,
    type GameplayFeedbackCriticalSnapshot
} from './gameplay-feedback-facts';

export type GameplayFeedbackCriticalField = keyof GameplayFeedbackCriticalSnapshot;

export interface GameplayFeedbackCompletenessDiagnostic {
    commandId: string;
    commandType: string;
    changedFields: GameplayFeedbackCriticalField[];
    eventTypes: GameplayEvent['type'][];
    message: string;
}

interface GameplayFeedbackCompletenessInput {
    before: RunState;
    after: RunState;
    command: GameplayCommand;
    events: readonly GameplayEvent[];
    accepted: boolean;
}

const CRITICAL_FIELDS: readonly GameplayFeedbackCriticalField[] = [
    'lives',
    'guardTokens',
    'comboShards',
    'shopGold',
    'objective',
    'recallFocus',
    'recallMatchesThisFloor',
    'recallMistakesThisFloor',
    'recallBonusScoreThisFloor',
    'forgottenTileCountThisFloor',
    'dungeonEnemiesDefeatedThisFloor',
    'enemyHazardHitsThisFloor',
    'enemyHazardsDefeatedThisFloor'
];

const sameSnapshotValue = (left: unknown, right: unknown): boolean =>
    JSON.stringify(left) === JSON.stringify(right);

const commandTypeFor = (command: GameplayCommand): string =>
    command.type === 'effects.apply' ? command.definitionId : command.type;

/**
 * Flags accepted transitions that change an accessibility-critical gameplay
 * field without either typed feedback or the authoritative board-turn envelope.
 * Rejected and no-op transitions do not owe consequence feedback.
 */
export const inspectGameplayFeedbackCompleteness = ({
    before,
    after,
    command,
    events,
    accepted
}: GameplayFeedbackCompletenessInput): GameplayFeedbackCompletenessDiagnostic | null => {
    if (!accepted) {
        return null;
    }

    const beforeSnapshot = getGameplayFeedbackCriticalSnapshot(before);
    const afterSnapshot = getGameplayFeedbackCriticalSnapshot(after);
    const changedFields = CRITICAL_FIELDS.filter(
        (field) => !sameSnapshotValue(beforeSnapshot[field], afterSnapshot[field])
    );
    const hasAuthoritativePresentation = events.some(
        (event) => event.type === 'feedback.requested' || event.type === 'board.turn_resolved'
    );
    if (changedFields.length === 0 || hasAuthoritativePresentation) {
        return null;
    }

    const commandType = commandTypeFor(command);
    const eventTypes = events.map((event) => event.type);
    return {
        commandId: command.commandId,
        commandType,
        changedFields,
        eventTypes,
        message: `Accepted ${commandType} command ${command.commandId} changed feedback-critical fields without typed presentation: ${changedFields.join(', ')}.`
    };
};
