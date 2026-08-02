import type { FindableKind, RelicId, RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    type GameplayCommand,
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

export interface GameplayMatchRewardAdapterResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    comboShardGain: number;
    migrated: boolean;
}

const RELIC_IMMEDIATE_DEFINITION_IDS: Partial<Record<RelicId, string>> = {
    combo_shard_plus_step: 'relic.combo_shard_plus_step',
    guard_token_plus_one: 'relic.guard_token_plus_one',
    peek_charge_plus_one: 'relic.peek_charge_plus_one'
};

/**
 * Strangler adapter for relic immediate effects. Unmigrated relics retain the
 * legacy pure rule; migrated relics use the authoritative command definition.
 */
export const applyRelicImmediateThroughGameplayCore = (
    run: RunState,
    relicId: RelicId,
    commandId: string
): GameplayRelicImmediateAdapterResult => {
    const definitionId = RELIC_IMMEDIATE_DEFINITION_IDS[relicId];
    if (!definitionId) {
        return { run: applyRelicImmediate(run, relicId), events: [], migrated: false };
    }
    const command = createGameplayDefinitionCommand(commandId, definitionId);
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

/**
 * Typed handoff from migrated match pickups into the legacy survival resolver.
 * The command owns source/condition semantics; its request event is the only
 * value the compatibility layer consumes.
 */
export const resolveFindableMatchRewardThroughGameplayCore = (
    run: RunState,
    findableKind: FindableKind | null,
    commandId: string
): GameplayMatchRewardAdapterResult => {
    if (findableKind !== 'shard_spark') {
        return { commands: [], events: [], comboShardGain: 0, migrated: false };
    }
    const command = createGameplayDefinitionCommand(commandId, 'findable.shard_spark', {
        matchedFindables: [findableKind]
    });
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        throw new Error(`Migrated findable command rejected: ${findableKind}`);
    }
    return {
        commands: [command],
        events: result.events,
        comboShardGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'combo_shard.requested' ? event.amount : 0),
            0
        ),
        migrated: true
    };
};
