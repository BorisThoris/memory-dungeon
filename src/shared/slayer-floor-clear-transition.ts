import type { RunState } from './contracts';
import {
    getGameplayContentDefinition,
    type GameplayEvent,
    type GameplayFacts
} from './gameplay-core-contracts';
import { applyGameplayDefinitionTransition } from './gameplay-effect-transition';
import type { FloorClearSlayerInput, FloorClearSlayerResult } from './floor-clear-transition';

export interface SlayerFloorClearDefinitionRef {
    id: string;
    suffix: string;
}

export const collectSlayerFloorClearDefinitions = (
    run: RunState,
    input: FloorClearSlayerInput
): SlayerFloorClearDefinitionRef[] => {
    const relicIds = new Set(Array.isArray(run.relicIds) ? run.relicIds : []);
    const definitions: SlayerFloorClearDefinitionRef[] = [];
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
    return definitions;
};

const extractSlayerRequests = (events: readonly GameplayEvent[]): Omit<FloorClearSlayerResult, 'commands' | 'events'> => ({
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
});

export const resolveSlayerFloorClearEffects = (
    run: RunState,
    input: FloorClearSlayerInput,
    commandId: string,
    events: GameplayEvent[] = []
): FloorClearSlayerResult => {
    const eventStart = events.length;
    const facts: GameplayFacts = {
        matchedTraits: [],
        adjacentTraits: [],
        matchedFindables: [],
        bossTrophyClaimed: input.bossTrophyClaimed,
        riskWagerOutcome: input.riskWagerOutcome ?? 'none',
        featuredObjectiveCompleted: input.featuredObjectiveCompleted,
        scoreParasiteActive: input.scoreParasiteActive
    };
    for (const definitionRef of collectSlayerFloorClearDefinitions(run, input)) {
        const definition = getGameplayContentDefinition(definitionRef.id);
        if (!definition) {
            throw new Error(`Missing Slayer floor-clear definition: ${definitionRef.id}`);
        }
        const result = applyGameplayDefinitionTransition(run, commandId, definition, facts, events);
        if (!result.accepted) {
            throw new Error(`Migrated Slayer floor-clear definition rejected: ${definitionRef.id}`);
        }
    }
    const slayerEvents = events.slice(eventStart);
    return {
        commands: [],
        events: slayerEvents,
        ...extractSlayerRequests(slayerEvents)
    };
};

