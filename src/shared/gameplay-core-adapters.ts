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
    safeHazardWardGain: number;
    scoreGain: number;
    scoutRevealGain: number;
    migrated: boolean;
}

export interface GameplaySlayerFloorClearInput {
    bossTrophyClaimed: boolean;
    riskWagerOutcome: 'won' | 'lost' | undefined;
    featuredObjectiveCompleted: boolean;
    scoreParasiteActive: boolean;
}

export interface GameplaySlayerFloorClearAdapterResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    bossTrophyScoreGain: number;
    riskWagerFavorGain: number;
    riskWagerStreakFloor: number;
    parasiteRelief: number;
}

const RELIC_IMMEDIATE_DEFINITION_IDS: Partial<Record<RelicId, string>> = {
    extra_shuffle_charge: 'relic.extra_shuffle_charge',
    first_shuffle_free_per_floor: 'relic.first_shuffle_free_per_floor',
    memorize_bonus_ms: 'relic.memorize_bonus_ms',
    memorize_under_short_memorize: 'relic.memorize_under_short_memorize',
    region_shuffle_free_first: 'relic.region_shuffle_free_first',
    combo_shard_plus_step: 'relic.combo_shard_plus_step',
    parasite_ward_once: 'relic.parasite_ward_once',
    destroy_bank_plus_one: 'relic.destroy_bank_plus_one',
    guard_token_plus_one: 'relic.guard_token_plus_one',
    peek_charge_plus_one: 'relic.peek_charge_plus_one',
    shrine_echo: 'relic.shrine_echo',
    chapter_compass: 'relic.chapter_compass',
    wager_surety: 'relic.wager_surety',
    parasite_ledger: 'relic.parasite_ledger',
    stray_charge_plus_one: 'relic.stray_charge_plus_one',
    pin_cap_plus_one: 'relic.pin_cap_plus_one'
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
    const definitionId =
        findableKind === 'shard_spark'
            ? 'findable.shard_spark'
            : findableKind === 'ward_spark'
              ? 'findable.ward_spark'
              : findableKind === 'score_glint'
                ? 'findable.score_glint'
              : findableKind === 'scout_glint'
                ? 'findable.scout_glint'
                : null;
    if (!definitionId || !findableKind) {
        return {
            commands: [],
            events: [],
            comboShardGain: 0,
            safeHazardWardGain: 0,
            scoreGain: 0,
            scoutRevealGain: 0,
            migrated: false
        };
    }
    const command = createGameplayDefinitionCommand(commandId, definitionId, {
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
        safeHazardWardGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'safe_hazard_ward.requested' ? event.amount : 0),
            0
        ),
        scoreGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'score.requested' ? event.amount : 0),
            0
        ),
        scoutRevealGain: result.events.reduce(
            (sum, event) => sum + (event.type === 'scout_reveal.requested' ? event.amount : 0),
            0
        ),
        migrated: true
    };
};

/**
 * Typed source boundary for Slayer floor-clear relic hooks. Established boss,
 * objective, Favor, and parasite rules consume these request amounts.
 */
export const resolveSlayerFloorClearThroughGameplayCore = (
    run: RunState,
    input: GameplaySlayerFloorClearInput,
    commandIdPrefix: string
): GameplaySlayerFloorClearAdapterResult => {
    const relicIds = new Set(Array.isArray(run.relicIds) ? run.relicIds : []);
    const definitions: Array<{ id: string; suffix: string }> = [];
    if (input.bossTrophyClaimed && relicIds.has('chapter_compass')) {
        definitions.push({ id: 'relic.chapter_compass.boss_trophy', suffix: 'boss-trophy' });
    }
    if (input.riskWagerOutcome === 'won' && relicIds.has('wager_surety')) {
        definitions.push({ id: 'relic.wager_surety.wager_won', suffix: 'wager-won' });
    }
    if (input.riskWagerOutcome === 'lost' && relicIds.has('wager_surety')) {
        definitions.push({ id: 'relic.wager_surety.wager_lost', suffix: 'wager-lost' });
    }
    if (input.featuredObjectiveCompleted && input.scoreParasiteActive && relicIds.has('parasite_ledger')) {
        definitions.push({ id: 'relic.parasite_ledger.featured_objective', suffix: 'parasite-relief' });
    }

    const commands: GameplayCommand[] = [];
    const events: GameplayEvent[] = [];
    for (const definition of definitions) {
        const command = createGameplayDefinitionCommand(`${commandIdPrefix}:${definition.suffix}`, definition.id, {
            bossTrophyClaimed: input.bossTrophyClaimed,
            riskWagerOutcome: input.riskWagerOutcome ?? 'none',
            featuredObjectiveCompleted: input.featuredObjectiveCompleted,
            scoreParasiteActive: input.scoreParasiteActive
        });
        const result = reduceGameplayCommand(run, command);
        if (!result.accepted) {
            throw new Error(`Migrated Slayer floor-clear command rejected: ${definition.id}`);
        }
        commands.push(command);
        events.push(...result.events);
    }

    return {
        commands,
        events,
        bossTrophyScoreGain: events.reduce(
            (sum, event) => sum + (event.type === 'score.requested' && event.reason === 'boss_trophy' ? event.amount : 0),
            0
        ),
        riskWagerFavorGain: events.reduce(
            (sum, event) => sum + (event.type === 'relic_favor.requested' ? event.amount : 0),
            0
        ),
        riskWagerStreakFloor: events.reduce(
            (floor, event) => event.type === 'featured_streak_floor.requested' ? Math.max(floor, event.amount) : floor,
            0
        ),
        parasiteRelief: events.reduce(
            (sum, event) => sum + (event.type === 'parasite_relief.requested' ? event.amount : 0),
            0
        )
    };
};
