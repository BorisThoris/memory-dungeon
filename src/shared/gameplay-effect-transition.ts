import type { RunState } from './contracts';
import {
    GAMEPLAY_CORE_SCHEMA_VERSION,
    gameplayEventSchema,
    type GameplayCondition,
    type GameplayContentDefinition,
    type GameplayEvent,
    type GameplayFacts,
    type GameplaySource
} from './gameplay-core-contracts';
import {
    gainRunInventoryItem,
    getRunInventoryItemQuantity,
    useRunInventoryItem
} from './run-inventory';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export type GameplayEventPayload<T = GameplayEvent> = T extends GameplayEvent
    ? Omit<T, 'schemaVersion' | 'eventId' | 'commandId' | 'sequence' | 'source'>
    : never;

export interface GameplayDefinitionTransitionResult {
    run: RunState;
    events: GameplayEvent[];
    accepted: boolean;
    rejectionReason: string | null;
}

export const makeGameplayEventWriter = (
    commandId: string,
    source: GameplaySource,
    events: GameplayEvent[]
) => (event: GameplayEventPayload): void => {
    const sequence = events.length;
    events.push(
        gameplayEventSchema.parse({
            ...event,
            schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
            eventId: `${commandId}:${sequence}`,
            commandId,
            sequence,
            source
        })
    );
};

const conditionFailure = (
    run: RunState,
    condition: GameplayCondition,
    facts: GameplayFacts
): string | null => {
    switch (condition.kind) {
        case 'run.status_is':
            return run.status === condition.status ? null : `run status is ${run.status}, expected ${condition.status}`;
        case 'inventory.at_least':
            return getRunInventoryItemQuantity(run, condition.itemId) >= condition.amount
                ? null
                : `${condition.itemId} is below ${condition.amount}`;
        case 'trait.matched':
            return facts.matchedTraits.includes(condition.trait) ? null : `${condition.trait} was not matched`;
        case 'trait.adjacent':
            return facts.adjacentTraits.includes(condition.trait) ? null : `${condition.trait} was not adjacent`;
        case 'trait.any_matched':
            return facts.matchedTraits.length > 0 ? null : 'no trait was matched';
        case 'streak.at_least':
            return runNonNegativeInteger(normalizeSessionStats(run.stats).currentStreak) >= condition.amount
                ? null
                : `clean streak is below ${condition.amount}`;
        case 'findable.matched':
            return facts.matchedFindables.includes(condition.findable) ? null : `${condition.findable} was not matched`;
        case 'floor.match_resolutions_is':
            return runNonNegativeInteger(run.matchResolutionsThisFloor) === condition.amount
                ? null
                : `floor match resolutions are ${runNonNegativeInteger(run.matchResolutionsThisFloor)}, expected ${condition.amount}`;
        case 'featured_objective.completed':
            return facts.featuredObjectiveCompleted ? null : 'featured objective was not completed';
        case 'score_parasite.active':
            return facts.scoreParasiteActive ? null : 'score parasite is not active';
    }
};

/** Applies one validated content definition without creating or journaling a command. */
export const applyGameplayDefinitionTransition = (
    run: RunState,
    commandId: string,
    definition: GameplayContentDefinition,
    facts: GameplayFacts,
    events: GameplayEvent[] = []
): GameplayDefinitionTransitionResult => {
    const writeEvent = makeGameplayEventWriter(commandId, definition.source, events);
    for (const condition of definition.conditions) {
        const failure = conditionFailure(run, condition, facts);
        if (failure) {
            const rejectionReason = `Condition failed: ${failure}.`;
            writeEvent({ type: 'command.rejected', reason: rejectionReason });
            return { run, events, accepted: false, rejectionReason };
        }
    }

    let nextRun = run;
    for (const effect of definition.effects) {
        switch (effect.kind) {
            case 'inventory.grant': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                nextRun = gainRunInventoryItem(nextRun, effect.itemId, effect.amount);
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'grant',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                if (after === before) {
                    writeEvent({
                        type: 'effect.skipped',
                        effectKind: effect.kind,
                        reason: `${effect.itemId} could not accept the requested grant.`
                    });
                }
                break;
            }
            case 'inventory.consume': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                const used = useRunInventoryItem(nextRun, effect.itemId);
                nextRun = used.run;
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'consume',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                if (!used.applied) {
                    writeEvent({
                        type: 'effect.skipped',
                        effectKind: effect.kind,
                        reason: used.reason ?? `${effect.itemId} could not be consumed.`
                    });
                }
                break;
            }
            case 'inventory.grant_or_score': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                nextRun = gainRunInventoryItem(nextRun, effect.itemId, effect.amount);
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                const applied = after - before;
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'grant',
                    requested: effect.amount,
                    applied,
                    before,
                    after
                });
                if (applied === 0) {
                    const stats = normalizeSessionStats(nextRun.stats);
                    const totalBefore = runNonNegativeInteger(stats.totalScore);
                    const currentLevelBefore = runNonNegativeInteger(stats.currentLevelScore);
                    nextRun = {
                        ...nextRun,
                        stats: {
                            ...stats,
                            totalScore: totalBefore + effect.fallbackScore,
                            currentLevelScore: currentLevelBefore + effect.fallbackScore
                        }
                    };
                    writeEvent({
                        type: 'score.changed',
                        reason: 'inventory_overflow',
                        amount: effect.fallbackScore,
                        totalBefore,
                        totalAfter: totalBefore + effect.fallbackScore,
                        currentLevelBefore,
                        currentLevelAfter: currentLevelBefore + effect.fallbackScore
                    });
                }
                break;
            }
            case 'combo_shard.request':
                writeEvent({ type: 'combo_shard.requested', amount: effect.amount });
                break;
            case 'score.grant': {
                const stats = normalizeSessionStats(nextRun.stats);
                const totalBefore = runNonNegativeInteger(stats.totalScore);
                const currentLevelBefore = runNonNegativeInteger(stats.currentLevelScore);
                nextRun = {
                    ...nextRun,
                    stats: {
                        ...stats,
                        totalScore: totalBefore + effect.amount,
                        currentLevelScore: currentLevelBefore + effect.amount
                    }
                };
                writeEvent({
                    type: 'score.changed',
                    reason: effect.reason,
                    amount: effect.amount,
                    totalBefore,
                    totalAfter: totalBefore + effect.amount,
                    currentLevelBefore,
                    currentLevelAfter: currentLevelBefore + effect.amount
                });
                break;
            }
            case 'score.request':
                writeEvent({ type: 'score.requested', reason: effect.reason, amount: effect.amount });
                break;
            case 'feedback.emit':
                writeEvent({
                    type: 'feedback.requested',
                    cue: effect.cue,
                    message: effect.message,
                    tone: effect.tone
                });
                break;
        }
    }

    return { run: nextRun, events, accepted: true, rejectionReason: null };
};
