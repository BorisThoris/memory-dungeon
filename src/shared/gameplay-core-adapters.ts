import type { RelicId, RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';
import { applyRelicImmediate } from './relic-immediate-rules';

export interface GameplayRelicImmediateAdapterResult {
    run: RunState;
    events: GameplayEvent[];
    migrated: boolean;
}

/**
 * Strangler adapter for relic immediate effects. Unmigrated relics retain the
 * legacy pure rule; migrated relics use the authoritative command definition.
 */
export const applyRelicImmediateThroughGameplayCore = (
    run: RunState,
    relicId: RelicId,
    commandId: string
): GameplayRelicImmediateAdapterResult => {
    if (relicId !== 'peek_charge_plus_one') {
        return { run: applyRelicImmediate(run, relicId), events: [], migrated: false };
    }
    const command = createGameplayDefinitionCommand(commandId, 'relic.peek_charge_plus_one');
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        throw new Error(`Migrated relic command rejected: ${relicId}`);
    }
    return {
        run: appendGameplayJournal(result.run, [command], result.events),
        events: result.events,
        migrated: true
    };
};
