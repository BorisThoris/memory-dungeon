import { collectDestroyEligibleTileIds } from './board-power-targeting';
import {
    GAME_RULES_VERSION,
    MAX_COMBO_SHARDS,
    MAX_LIVES,
    type BonusRewardId,
    type RelicId,
    type RouteNodeType,
    type RunShopItemId,
    type RunState
} from './contracts';
import {
    GAMEPLAY_BUILD_STRATEGIES,
    GAMEPLAY_BUILD_STRATEGY_AXES,
    type GameplayBuildStrategyAxis,
    type GameplayBuildStrategyDefinition,
    type GameplayBuildStrategyId
} from './build-strategy-simulation';
import {
    createGameplayDefinitionCommand,
    createGameplayDestroyPairCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayPeekCommand,
    createGameplayRelicOfferOpenCommand,
    createGameplayRelicPickCommand,
    createGameplayRiskWagerAcceptCommand,
    createGameplayRouteChooseCommand,
    createGameplayShopPurchaseCommand,
    createGameplaySideRoomResolveCommand,
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import {
    solveRunThroughGameplayCoreWithTrace,
    type GameplayCoreBoundedMemoryPolicy,
    type GameplayCoreGambitPolicy,
    type GameplayCorePlaythroughInformationTrace,
    type GameplayCorePlaythroughSolverTrace
} from './gameplay-core-playthrough-solver';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import { needsRelicPick } from './relics';
import { rollRunEventRoom, type RunEventChoiceEffect } from './run-events';
import { getRouteChoiceAvailability } from './route-choice-rules';
import { applyRouteChoiceOutcome } from './route-choice-outcome-rules';
import { openRouteSideRoom } from './route-side-room-rules';
import { createNewRun } from './run-creation-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { canOfferEndlessRiskWager } from './risk-wager-rules';
import { createRunShopOffers } from './shop-rules';

export type GameplayBuildMatchup =
    | 'neutral'
    | 'memory_pressure'
    | 'hazard_pressure'
    | 'parasite_pressure'
    | 'boss_pressure'
    | 'economy_opportunity';

export interface GameplayBuildPolicyDefinition {
    id: `${GameplayBuildStrategyId}_policy_v1`;
    strategyId: GameplayBuildStrategyId;
    routePriorities: readonly RouteNodeType[];
    bonusRewardPriorities: readonly BonusRewardId[];
    relicPriorities: readonly RelicId[];
    shopItemPriorities: readonly RunShopItemId[];
    informationPolicy: GameplayCoreBoundedMemoryPolicy;
    gambitPolicy: GameplayCoreGambitPolicy | null;
    gambitSuppressedMatchups: readonly GameplayBuildMatchup[];
    interludeRiskPolicy: GameplayBuildInterludeRiskPolicy;
    signatureTiming: 'before_board' | 'after_board';
    favorableMatchup: GameplayBuildMatchup;
    counterMatchup: GameplayBuildMatchup;
}

export interface GameplayBuildInterludeRiskPolicy {
    maxRouteRiskUnits: 0 | 1 | 2;
    minimumEffectiveSurvivalAfterRoute: number;
    openingUnbufferedGreedFloors: number;
    eventEffectPriorities: readonly Exclude<RunEventChoiceEffect, 'skip'>[];
}

export interface GameplayBuildRouteRiskAssessment {
    routeId: string;
    routeType: RouteNodeType;
    legal: boolean;
    riskUnits: 0 | 1 | 2;
    maxRiskUnits: 0 | 1 | 2;
    livesBefore: number;
    livesAfter: number;
    protectionBefore: number;
    protectionAfter: number;
    effectiveSurvivalAfter: number;
    minimumEffectiveSurvivalAfter: number;
    comboShardsBefore: number;
    conversionRiskCredit: boolean;
    accepted: boolean;
    reason: string;
}

export interface GameplayBuildSideRoomResourceAssessment {
    roomKind: string;
    selectedEffect: string | null;
    recoveryNeeded: boolean;
    livesBefore: number;
    livesAfter: number;
    protectionBefore: number;
    protectionAfter: number;
    effectiveSurvivalBefore: number;
    effectiveSurvivalAfter: number;
}

export interface GameplayBuildPolicyDecision {
    floor: number;
    matchup: GameplayBuildMatchup;
    phase: 'signature' | 'route' | 'side_room' | 'relic';
    decision: string;
    selectedId: string | null;
    applied: boolean;
    reason: string;
    routeRiskAssessments?: GameplayBuildRouteRiskAssessment[];
    adaptedFromPriority?: boolean;
    sideRoomResourceAssessment?: GameplayBuildSideRoomResourceAssessment;
}

export interface GameplayBuildFloorTrace {
    floor: number;
    matchup: GameplayBuildMatchup;
    floorTag: string | null;
    floorArchetypeId: string | null;
    activeMutators: string[];
    boardTraitKinds: string[];
    completed: boolean;
    stopReason: GameplayCorePlaythroughSolverTrace['stopReason'];
    lastPairKey: string | null;
    lastTileIds: string[];
    turns: number;
    commandCount: number;
    eventCount: number;
    livesBefore: number;
    livesAfter: number;
    scoreBefore: number;
    scoreAfter: number;
    signatureConsequenceUses: number;
    gambitCommits: number;
    gambitSuppressedByMatchup: boolean;
    information: GameplayCorePlaythroughInformationTrace;
    observedTraitInteractionTags: string[];
    recurringSynergyTags: string[];
    replayCheckpointVerified: boolean;
    replayCheckpointDeterministic: boolean;
    invariantViolations: string[];
}

export interface GameplayBuildMultiFloorSeedSample {
    seed: number;
    requestedFloors: number;
    completedFloors: number;
    commands: GameplayCommand[];
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    floorTraces: GameplayBuildFloorTrace[];
    policyDecisions: GameplayBuildPolicyDecision[];
    eventTypeCounts: Record<string, number>;
    feedbackCues: string[];
    signatureAxisScores: Record<GameplayBuildStrategyAxis, number>;
    signatureConsequenceUses: number;
    fullReplayDeterministic: boolean;
    finalLives: number;
    finalScore: number;
    finalShopGold: number;
    invariantViolations: string[];
}

export interface GameplayBuildDistribution {
    min: number;
    mean: number;
    max: number;
}

export interface GameplayBuildMatchupMetrics {
    matchup: GameplayBuildMatchup;
    sampledFloors: number;
    completedFloors: number;
    completionShare: number;
    meanTurns: number;
    meanLivesLost: number;
    recurringSynergyFloors: number;
}

export interface GameplayBuildMultiFloorMetrics {
    id: GameplayBuildStrategyId;
    label: string;
    buildMechanicId: `build.${GameplayBuildStrategyId}`;
    consequenceCommandType: GameplayCommand['type'];
    consequenceEventType: GameplayEvent['type'];
    expectedDominantAxis: GameplayBuildStrategyAxis;
    policyId: GameplayBuildPolicyDefinition['id'];
    informationPolicy: GameplayCoreBoundedMemoryPolicy;
    gambitPolicy: GameplayCoreGambitPolicy | null;
    gambitSuppressedMatchups: readonly GameplayBuildMatchup[];
    interludeRiskPolicy: GameplayBuildInterludeRiskPolicy;
    favorableMatchup: GameplayBuildMatchup;
    counterMatchup: GameplayBuildMatchup;
    dominantAxis: GameplayBuildStrategyAxis;
    signatureAxisScores: Record<GameplayBuildStrategyAxis, number>;
    floorsAttempted: number;
    floorsCompleted: number;
    floorCompletionShare: number;
    deterministicReplaySeeds: number;
    signatureConsequenceUses: number;
    observedBoardTraitKinds: string[];
    observedTraitInteractionTags: string[];
    recurringSynergyTags: string[];
    turnsPerFloor: GameplayBuildDistribution;
    commandsPerFloor: GameplayBuildDistribution;
    livesRemaining: GameplayBuildDistribution;
    scoreGained: GameplayBuildDistribution;
    matchupMetrics: GameplayBuildMatchupMetrics[];
    favorableMatchupMetrics: GameplayBuildMatchupMetrics | null;
    counterMatchupMetrics: GameplayBuildMatchupMetrics | null;
    policyDecisionCount: number;
    counterMatchupReplayFloors: number;
    imperfectInformationFloors: number;
    uncertainTurns: number;
    memoryEvictions: number;
    riskBudgetExhaustions: number;
    routeRiskAssessmentCount: number;
    routeRiskRejections: number;
    adaptiveRouteSelections: number;
    sideRoomResourceAssessmentCount: number;
    gambitCommits: number;
    riskWagersAccepted: number;
    riskWagerWins: number;
    riskWagerLosses: number;
    shardLifeConversions: number;
    comboShardSourceEvents: number;
    samples: GameplayBuildMultiFloorSeedSample[];
}

export interface GameplayBuildMultiFloorReport {
    rulesVersion: number;
    seeds: number[];
    floorsPerSeed: number;
    offlineOnly: true;
    strategies: GameplayBuildMultiFloorMetrics[];
    pairwiseMeanTurnRatios: Array<{
        left: GameplayBuildStrategyId;
        right: GameplayBuildStrategyId;
        ratio: number;
    }>;
    cohesiveBuildCoverage: {
        routeGambler: {
            id: 'route_gambler';
            buildMechanicId: 'build.route_gambler';
            startingLoadoutId: 'route_tactician';
            axis: 'risk_conversion';
            favorableMatchup: 'economy_opportunity';
            counterMatchup: 'hazard_pressure';
            requiredSystems: readonly [
                'relic.wager_surety',
                'objective.risk_wager',
                'inventory.gambit_token',
                'power.gambit',
                'route.mystery'
            ];
            longHorizonSampled: true;
            evidence: {
                gambitCommits: number;
                riskWagersAccepted: number;
                riskWagerWins: number;
                riskWagerLosses: number;
                favorableMatchupFloors: number;
                counterMatchupFloors: number;
            };
        };
        comboShardEngine: {
            id: 'combo_shard_engine';
            buildMechanicId: 'build.combo_shard_engine';
            startingLoadoutId: 'vaultbreaker';
            axis: 'sustain_conversion';
            favorableMatchup: 'economy_opportunity';
            counterMatchup: 'parasite_pressure';
            requiredSystems: readonly [
                'reward.bonus_shards',
                'relic.combo_shard_plus_step',
                'findable.shard_spark',
                'inventory.combo_shard',
                'progression.shard_to_life'
            ];
            longHorizonSampled: true;
            evidence: {
                comboShardSourceEvents: number;
                shardLifeConversions: number;
                favorableMatchupFloors: number;
                counterMatchupFloors: number;
            };
        };
    };
    bounds: {
        requiredStrategyCount: number;
        minFloorsPerSeed: number;
        minFloorCompletionShare: number;
        minDeterministicReplayShare: number;
        minSignatureConsequenceUsesPerSeed: number;
        minRecurringSynergyFloors: number;
        minPolicyDecisionsPerFloor: number;
        minFavorableMatchupFloors: number;
        minCounterMatchupFloors: number;
        minImperfectInformationFloorsPerSeed: number;
        minUncertainTurnsPerSeed: number;
        maxRiskBudgetExhaustions: number;
        minRouteRiskAssessmentsPerSeed: number;
        minRouteRiskRejectionsPerStrategy: number;
        minSideRoomResourceAssessmentsPerSeed: number;
        minAdaptiveRouteSelections: number;
        minRouteGamblerGambitCommitsPerSeed: number;
        minRouteGamblerRiskWagersAccepted: number;
        minRouteGamblerRiskWagerOutcomes: number;
        minComboShardLifeConversionsPerSeed: number;
        minComboShardSourceEventsPerSeed: number;
        maxPairwiseMeanTurnRatio: number;
    };
    notes: string[];
}

export interface GameplayBuildMultiFloorSimulationInput {
    seeds?: readonly number[];
    floors?: number;
    rulesVersion?: number;
    strategies?: readonly GameplayBuildStrategyId[];
}

interface MutableBuildTrace {
    initialRun: RunState;
    run: RunState;
    commands: GameplayCommand[];
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    signatureEvents: GameplayEvent[];
    invariantViolations: string[];
}

const DEFAULT_SEEDS = [42_001, 42_077, 42_123] as const;
const DEFAULT_FLOORS = 12;
const MEMORY_PRESSURE_MUTATORS = new Set([
    'short_memorize',
    'silhouette_twist',
    'n_back_anchor',
    'distraction_channel',
    'wide_recall'
]);
const HAZARD_PRESSURE_MUTATORS = new Set(['glass_floor', 'sticky_fingers', 'shifting_spotlight']);

export const GAMEPLAY_BUILD_POLICIES: Readonly<Record<GameplayBuildStrategyId, GameplayBuildPolicyDefinition>> = {
    conduit_cartographer: {
        id: 'conduit_cartographer_policy_v1',
        strategyId: 'conduit_cartographer',
        routePriorities: ['mystery', 'safe', 'greed'],
        bonusRewardPriorities: ['echo_conduit_lens', 'trait_toolkit', 'secret_favor', 'trait_streak_lens'],
        relicPriorities: ['peek_charge_plus_one', 'shrine_echo', 'chapter_compass', 'pin_cap_plus_one'],
        shopItemPriorities: ['peek_charge', 'trait_routing_kit', 'region_shuffle_charge', 'iron_key'],
        informationPolicy: { kind: 'bounded_memory', memoryTileCapacity: 10, uncertainTurnBudget: 20 },
        gambitPolicy: null,
        gambitSuppressedMatchups: [],
        interludeRiskPolicy: {
            maxRouteRiskUnits: 1,
            minimumEffectiveSurvivalAfterRoute: 4,
            openingUnbufferedGreedFloors: 0,
            eventEffectPriorities: ['gain_relic_favor', 'heal_or_guard', 'gain_destroy_charge', 'gain_iron_key', 'gain_shop_gold', 'gain_score']
        },
        signatureTiming: 'before_board',
        favorableMatchup: 'memory_pressure',
        counterMatchup: 'boss_pressure'
    },
    guard_tank: {
        id: 'guard_tank_policy_v1',
        strategyId: 'guard_tank',
        routePriorities: ['safe', 'mystery', 'greed'],
        bonusRewardPriorities: ['hazard_ward', 'stasis_lockbox', 'hazard_banisher', 'supply_cache'],
        relicPriorities: ['guard_token_plus_one', 'destroy_bank_plus_one', 'parasite_ward_once', 'combo_shard_plus_step'],
        shopItemPriorities: ['destroy_charge', 'heal_life', 'trait_cleanse', 'iron_key'],
        informationPolicy: { kind: 'bounded_memory', memoryTileCapacity: 8, uncertainTurnBudget: 24 },
        gambitPolicy: null,
        gambitSuppressedMatchups: [],
        interludeRiskPolicy: {
            maxRouteRiskUnits: 1,
            minimumEffectiveSurvivalAfterRoute: 4,
            openingUnbufferedGreedFloors: 0,
            eventEffectPriorities: ['heal_or_guard', 'gain_destroy_charge', 'gain_iron_key', 'gain_relic_favor', 'gain_shop_gold', 'gain_score']
        },
        signatureTiming: 'before_board',
        favorableMatchup: 'hazard_pressure',
        counterMatchup: 'memory_pressure'
    },
    treasure_greed: {
        id: 'treasure_greed_policy_v1',
        strategyId: 'treasure_greed',
        routePriorities: ['greed', 'mystery', 'safe'],
        bonusRewardPriorities: ['chest_gold', 'cursed_opener_contract', 'key_insurance', 'bonus_shards'],
        relicPriorities: ['wager_surety', 'parasite_ledger', 'chapter_compass', 'extra_shuffle_charge'],
        shopItemPriorities: ['master_key', 'treasure_key', 'iron_key', 'trait_routing_kit'],
        informationPolicy: { kind: 'bounded_memory', memoryTileCapacity: 6, uncertainTurnBudget: 28 },
        gambitPolicy: null,
        gambitSuppressedMatchups: [],
        interludeRiskPolicy: {
            maxRouteRiskUnits: 2,
            minimumEffectiveSurvivalAfterRoute: 5,
            openingUnbufferedGreedFloors: 1,
            eventEffectPriorities: ['gain_shop_gold', 'gain_score', 'gain_iron_key', 'gain_relic_favor', 'gain_destroy_charge', 'heal_or_guard']
        },
        signatureTiming: 'after_board',
        favorableMatchup: 'economy_opportunity',
        counterMatchup: 'boss_pressure'
    },
    route_gambler: {
        id: 'route_gambler_policy_v1',
        strategyId: 'route_gambler',
        routePriorities: ['greed', 'mystery', 'safe'],
        bonusRewardPriorities: ['free_swap_floor', 'trait_toolkit', 'secret_favor', 'hazard_ward'],
        relicPriorities: ['wager_surety', 'region_shuffle_free_first', 'guard_token_plus_one', 'chapter_compass'],
        shopItemPriorities: ['region_shuffle_charge', 'trait_routing_kit', 'heal_life', 'iron_key'],
        informationPolicy: { kind: 'bounded_memory', memoryTileCapacity: 7, uncertainTurnBudget: 26 },
        gambitPolicy: { kind: 'first_uncertain_mismatch_rescue' },
        gambitSuppressedMatchups: ['hazard_pressure'],
        interludeRiskPolicy: {
            maxRouteRiskUnits: 2,
            minimumEffectiveSurvivalAfterRoute: 5,
            openingUnbufferedGreedFloors: 1,
            eventEffectPriorities: ['gain_relic_favor', 'gain_iron_key', 'heal_or_guard', 'gain_destroy_charge', 'gain_shop_gold', 'gain_score']
        },
        signatureTiming: 'after_board',
        favorableMatchup: 'economy_opportunity',
        counterMatchup: 'hazard_pressure'
    },
    combo_shard_engine: {
        id: 'combo_shard_engine_policy_v1',
        strategyId: 'combo_shard_engine',
        routePriorities: ['greed', 'mystery', 'safe'],
        bonusRewardPriorities: ['bonus_shards', 'supply_cache', 'hazard_ward', 'trait_toolkit'],
        relicPriorities: ['combo_shard_plus_step', 'parasite_ledger', 'parasite_ward_once', 'guard_token_plus_one'],
        shopItemPriorities: ['heal_life', 'trait_routing_kit', 'iron_key', 'destroy_charge'],
        informationPolicy: { kind: 'bounded_memory', memoryTileCapacity: 8, uncertainTurnBudget: 24 },
        gambitPolicy: null,
        gambitSuppressedMatchups: [],
        interludeRiskPolicy: {
            maxRouteRiskUnits: 1,
            minimumEffectiveSurvivalAfterRoute: 5,
            openingUnbufferedGreedFloors: 1,
            eventEffectPriorities: ['heal_or_guard', 'gain_destroy_charge', 'gain_iron_key', 'gain_relic_favor', 'gain_shop_gold', 'gain_score']
        },
        signatureTiming: 'after_board',
        favorableMatchup: 'economy_opportunity',
        counterMatchup: 'parasite_pressure'
    }
};

const stableJson = (value: unknown): string => JSON.stringify(value);
const round = (value: number): number => Number(value.toFixed(2));
const emptyAxisScores = (): Record<GameplayBuildStrategyAxis, number> => ({
    information: 0,
    control: 0,
    economy: 0,
    risk_conversion: 0,
    sustain_conversion: 0
});

const normalizeSeeds = (seeds: readonly number[] | undefined): number[] => {
    const normalized = [...new Set((seeds ?? DEFAULT_SEEDS)
        .filter(Number.isFinite)
        .map((seed) => Math.floor(seed)))];
    return normalized.length > 0 ? normalized : [...DEFAULT_SEEDS];
};

const normalizeFloors = (floors: number | undefined): number =>
    Number.isFinite(floors) ? Math.max(2, Math.min(12, Math.floor(floors!))) : DEFAULT_FLOORS;

const selectedStrategies = (
    strategyIds: readonly GameplayBuildStrategyId[] | undefined
): readonly GameplayBuildStrategyDefinition[] => {
    if (!strategyIds || strategyIds.length === 0) return GAMEPLAY_BUILD_STRATEGIES;
    const selected = new Set(strategyIds);
    return GAMEPLAY_BUILD_STRATEGIES.filter((strategy) => selected.has(strategy.id));
};

const commandIdFor = (trace: MutableBuildTrace, strategy: GameplayBuildStrategyDefinition, label: string): string =>
    `build-playthrough:${strategy.id}:${trace.run.runSeed}:${String(trace.commands.length).padStart(5, '0')}:${label}`;

const executeCommand = (
    trace: MutableBuildTrace,
    strategy: GameplayBuildStrategyDefinition,
    command: GameplayCommand,
    signature = false
): boolean => {
    const before = trace.run;
    const result = reduceGameplayCommand(before, command);
    trace.run = result.run;
    trace.commands.push(command);
    trace.events.push(...result.events);
    if (signature) trace.signatureEvents.push(...result.events);
    (result.accepted ? trace.acceptedCommandIds : trace.rejectedCommandIds).push(command.commandId);

    if (!gameplayCommandSchema.safeParse(command).success) {
        trace.invariantViolations.push(`${command.commandId}: command failed schema validation.`);
    }
    result.events.forEach((event, sequence) => {
        if (!gameplayEventSchema.safeParse(event).success) {
            trace.invariantViolations.push(`${command.commandId}: event ${sequence} failed schema validation.`);
        }
        if (
            event.commandId !== command.commandId ||
            event.sequence !== sequence ||
            event.eventId !== `${command.commandId}:${sequence}`
        ) {
            trace.invariantViolations.push(`${command.commandId}: event ${sequence} lost deterministic identity or order.`);
        }
    });
    const feedbackDiagnostic = inspectGameplayFeedbackCompleteness({
        before,
        after: result.run,
        command,
        events: result.events,
        accepted: result.accepted
    });
    if (feedbackDiagnostic) trace.invariantViolations.push(feedbackDiagnostic.message);
    return result.accepted;
};

const appendSolverTrace = (trace: MutableBuildTrace, solver: GameplayCorePlaythroughSolverTrace): void => {
    trace.run = solver.run;
    trace.commands.push(...solver.commands);
    trace.events.push(...solver.events);
    trace.acceptedCommandIds.push(...solver.acceptedCommandIds);
    trace.rejectedCommandIds.push(...solver.rejectedCommandIds);
    trace.invariantViolations.push(...solver.invariantViolations);
};

const createInitialRun = (
    strategy: GameplayBuildStrategyDefinition,
    seed: number,
    rulesVersion: number
): RunState => {
    const initialRelicIds: RelicId[] = strategy.id === 'route_gambler'
        ? ['wager_surety']
        : strategy.id === 'combo_shard_engine'
          ? ['combo_shard_plus_step']
          : [];
    const base = createNewRun(0, {
        runSeed: seed,
        runRulesVersionOverride: rulesVersion,
        startingLoadoutId: strategy.startingLoadoutId,
        onboardingSafeFirstFloor: true,
        practiceMode: true,
        echoFeedbackEnabled: false,
        initialRelicIds
    });
    return { ...base, shopOffers: createRunShopOffers(base) };
};

const signatureConsequenceCommand = (
    trace: MutableBuildTrace,
    strategy: GameplayBuildStrategyDefinition,
    policy: GameplayBuildPolicyDefinition
): GameplayCommand | null => {
    const commandId = commandIdFor(trace, strategy, 'signature_consequence');
    if (strategy.id === 'conduit_cartographer') {
        if (runNonNegativeInteger(trace.run.peekCharges) < 1) return null;
        const tileId = (trace.run.board?.tiles ?? [])
            .filter((tile) => tile.state === 'hidden')
            .map((tile) => tile.id)
            .sort((left, right) => left.localeCompare(right))[0];
        return tileId ? createGameplayPeekCommand(commandId, tileId) : null;
    }
    if (strategy.id === 'guard_tank') {
        if (runNonNegativeInteger(trace.run.destroyPairCharges) < 1 || !trace.run.board) return null;
        const protectedTraits = new Set(['mirror', 'stasis']);
        const tileId = [...collectDestroyEligibleTileIds(trace.run.board)]
            .map((candidateId) => {
                const candidate = trace.run.board?.tiles.find((tile) => tile.id === candidateId);
                const pair = candidate
                    ? trace.run.board?.tiles.filter((tile) => tile.pairKey === candidate.pairKey) ?? []
                    : [];
                return {
                    candidateId,
                    preservesWardenSynergy: pair.every((tile) =>
                        !tile.tileTraitKind || !protectedTraits.has(tile.tileTraitKind))
                };
            })
            .filter((candidate) => candidate.preservesWardenSynergy)
            .map((candidate) => candidate.candidateId)
            .sort((left, right) => left.localeCompare(right))[0];
        return tileId ? createGameplayDestroyPairCommand(commandId, tileId) : null;
    }
    if (strategy.id === 'route_gambler') {
        return canOfferEndlessRiskWager(trace.run)
            ? createGameplayRiskWagerAcceptCommand(commandId)
            : null;
    }
    if (strategy.id === 'combo_shard_engine') return null;
    if (trace.run.status !== 'levelComplete') return null;
    const itemPriority = new Map(policy.shopItemPriorities.map((itemId, index) => [itemId, index]));
    const offerId = (Array.isArray(trace.run.shopOffers) ? trace.run.shopOffers : [])
        .filter((offer) => !offer.purchased && offer.compatible && offer.cost <= trace.run.shopGold)
        .sort((left, right) =>
            (itemPriority.get(left.itemId) ?? Number.MAX_SAFE_INTEGER) -
                (itemPriority.get(right.itemId) ?? Number.MAX_SAFE_INTEGER) ||
            left.cost - right.cost ||
            left.id.localeCompare(right.id)
        )[0]?.id;
    return offerId ? createGameplayShopPurchaseCommand(commandId, offerId) : null;
};

const visibleProtectionUnits = (run: RunState): number =>
    runNonNegativeInteger(run.stats?.guardTokens) +
    runNonNegativeInteger(run.safeHazardWardChargesThisFloor) +
    runNonNegativeInteger(run.parasiteWardRemaining) +
    Math.min(1, runNonNegativeInteger(run.destroyPairCharges));

const effectiveSurvival = (run: RunState): number =>
    runNonNegativeInteger(run.lives) + Math.min(2, visibleProtectionUnits(run));

const routeRiskUnits = (routeType: RouteNodeType): 0 | 1 | 2 =>
    routeType === 'greed' ? 2 : routeType === 'mystery' ? 1 : 0;

interface GameplayBuildRouteSelection {
    routeId: string;
    routeType: RouteNodeType;
    assessments: GameplayBuildRouteRiskAssessment[];
    adaptedFromPriority: boolean;
}

const chooseRoute = (
    run: RunState,
    policy: GameplayBuildPolicyDefinition
): GameplayBuildRouteSelection | null => {
    const choices = Array.isArray(run.lastLevelResult?.routeChoices) ? run.lastLevelResult.routeChoices : [];
    const assessments = choices.map((choice): GameplayBuildRouteRiskAssessment => {
        const availability = getRouteChoiceAvailability(run, choice);
        const outcome = applyRouteChoiceOutcome(run, choice.id);
        const legal = availability.available && outcome.applied && openRouteSideRoom(outcome.run).sideRoom != null;
        const riskUnits = routeRiskUnits(choice.routeType);
        const livesAfter = legal ? runNonNegativeInteger(outcome.run.lives) : runNonNegativeInteger(run.lives);
        const protectionAfter = legal ? visibleProtectionUnits(outcome.run) : visibleProtectionUnits(run);
        const effectiveSurvivalAfter = livesAfter + Math.min(2, protectionAfter);
        const withinRiskBudget = riskUnits <= policy.interludeRiskPolicy.maxRouteRiskUnits;
        const openingRiskCredit = choice.routeType === 'greed' &&
            runNonNegativeInteger(run.board?.level) <= policy.interludeRiskPolicy.openingUnbufferedGreedFloors;
        const comboShardsBefore = runNonNegativeInteger(run.stats?.comboShards);
        const conversionRiskCredit =
            policy.strategyId === 'combo_shard_engine' &&
            choice.routeType === 'greed' &&
            comboShardsBefore >= MAX_COMBO_SHARDS;
        const preservesSurvival = openingRiskCredit || effectiveSurvivalAfter >=
            policy.interludeRiskPolicy.minimumEffectiveSurvivalAfterRoute;
        const accepted = legal &&
            (withinRiskBudget || openingRiskCredit || conversionRiskCredit) &&
            preservesSurvival;
        const reason = !legal
            ? availability.label ?? outcome.reason ?? 'Route did not produce a legal interlude.'
            : openingRiskCredit
              ? `Opening Greed credit permits one route above the sustained cap or reserve; effective survival ${effectiveSurvivalAfter}.`
              : conversionRiskCredit
                ? `A full ${comboShardsBefore}/${MAX_COMBO_SHARDS} shard bank permits Greed above the sustained cap while survival remains ${effectiveSurvivalAfter}.`
              : !withinRiskBudget
                ? `Risk ${riskUnits} exceeds policy cap ${policy.interludeRiskPolicy.maxRouteRiskUnits}.`
                : !preservesSurvival
                  ? `Effective survival ${effectiveSurvivalAfter} is below reserve ${policy.interludeRiskPolicy.minimumEffectiveSurvivalAfterRoute}.`
                  : `Risk ${riskUnits}/${policy.interludeRiskPolicy.maxRouteRiskUnits}; effective survival ${effectiveSurvivalAfter}/${policy.interludeRiskPolicy.minimumEffectiveSurvivalAfterRoute}.`;
        return {
            routeId: choice.id,
            routeType: choice.routeType,
            legal,
            riskUnits,
            maxRiskUnits: policy.interludeRiskPolicy.maxRouteRiskUnits,
            livesBefore: runNonNegativeInteger(run.lives),
            livesAfter,
            protectionBefore: visibleProtectionUnits(run),
            protectionAfter,
            effectiveSurvivalAfter,
            minimumEffectiveSurvivalAfter: policy.interludeRiskPolicy.minimumEffectiveSurvivalAfterRoute,
            comboShardsBefore,
            conversionRiskCredit,
            accepted,
            reason
        };
    });
    const legalByPriority = policy.routePriorities
        .flatMap((routeType) => assessments.filter((assessment) => assessment.routeType === routeType && assessment.legal));
    const acceptedByPriority = policy.routePriorities
        .flatMap((routeType) => assessments.filter((assessment) => assessment.routeType === routeType && assessment.accepted));
    const selected = acceptedByPriority[0] ?? assessments
        .filter((assessment) => assessment.legal)
        .sort((left, right) =>
            left.riskUnits - right.riskUnits ||
            right.effectiveSurvivalAfter - left.effectiveSurvivalAfter ||
            left.routeId.localeCompare(right.routeId)
        )[0];
    if (!selected) return null;
    return {
        routeId: selected.routeId,
        routeType: selected.routeType,
        assessments,
        adaptedFromPriority: legalByPriority[0]?.routeId !== selected.routeId
    };
};

const bonusRewardIdFromChoiceId = (choiceId: string): BonusRewardId | null => {
    for (const rewardId of [
        'chest_gold',
        'secret_favor',
        'bonus_shards',
        'supply_cache',
        'trait_toolkit',
        'key_insurance',
        'hazard_ward',
        'free_swap_floor',
        'echo_conduit_lens',
        'trait_streak_lens',
        'cursed_opener_contract',
        'stasis_lockbox',
        'hazard_banisher'
    ] as const satisfies readonly BonusRewardId[]) {
        if (choiceId.endsWith(`:${rewardId}`)) return rewardId;
    }
    return null;
};

const sideRoomResourceAssessment = (
    before: RunState,
    after: RunState,
    roomKind: string,
    selectedEffect: string | null,
    recoveryNeeded: boolean
): GameplayBuildSideRoomResourceAssessment => ({
    roomKind,
    selectedEffect,
    recoveryNeeded,
    livesBefore: runNonNegativeInteger(before.lives),
    livesAfter: runNonNegativeInteger(after.lives),
    protectionBefore: visibleProtectionUnits(before),
    protectionAfter: visibleProtectionUnits(after),
    effectiveSurvivalBefore: effectiveSurvival(before),
    effectiveSurvivalAfter: effectiveSurvival(after)
});

interface GameplayBuildSideRoomAction {
    action: 'claim' | 'skip';
    choiceId?: string;
    reason: string;
    resourceAssessment?: GameplayBuildSideRoomResourceAssessment;
}

const eventEffectPriority = (
    effect: RunEventChoiceEffect,
    policy: GameplayBuildPolicyDefinition,
    recoveryNeeded: boolean
): number => {
    if (effect === 'skip') return Number.MAX_SAFE_INTEGER;
    if (recoveryNeeded && effect === 'heal_or_guard') return -1;
    const priority = policy.interludeRiskPolicy.eventEffectPriorities.indexOf(effect);
    return priority >= 0 ? priority : Number.MAX_SAFE_INTEGER;
};

const chooseSideRoomAction = (
    run: RunState,
    policy: GameplayBuildPolicyDefinition
): GameplayBuildSideRoomAction => {
    const room = run.sideRoom;
    if (!room) return { action: 'skip', reason: 'No side room is open.' };
    const previewClaim = (choiceId?: string) => reduceGameplayCommand(
        run,
        createGameplaySideRoomResolveCommand(
            `policy-preview:${run.runSeed}:${room.floor}:${choiceId ?? 'primary'}`,
            'claim',
            choiceId
        )
    );
    const recoveryNeeded = effectiveSurvival(run) < policy.interludeRiskPolicy.minimumEffectiveSurvivalAfterRoute;
    if (room.payload.kind === 'rest_heal') {
        const preview = previewClaim();
        return runNonNegativeInteger(run.lives) < MAX_LIVES && preview.accepted
            ? {
                  action: 'claim',
                  reason: 'Recovery policy spends the safe stop only when life is missing.',
                  resourceAssessment: sideRoomResourceAssessment(
                      run,
                      preview.run,
                      room.payload.kind,
                      'heal_or_guard',
                      recoveryNeeded
                  )
              }
            : { action: 'skip', reason: 'Recovery policy preserves gold at full life.' };
    }
    const choices = Array.isArray(room.choices) ? room.choices : [];
    if (room.payload.kind === 'event_choice') {
        const event = rollRunEventRoom({
            runSeed: run.runSeed,
            rulesVersion: run.runRulesVersion,
            floor: room.floor
        });
        if (event.eventKey !== room.payload.eventKey) {
            return { action: 'skip', reason: 'Event policy rejected a stale event identity.' };
        }
        const effectByChoiceId = new Map(event.options.map((option) => [option.id, option.effect] as const));
        const ranked = choices
            .map((choice) => ({
                choice,
                effect: effectByChoiceId.get(choice.id) ?? 'skip',
                preview: previewClaim(choice.id)
            }))
            .filter((candidate) => candidate.effect !== 'skip' && candidate.preview.accepted)
            .sort((left, right) =>
                eventEffectPriority(left.effect, policy, recoveryNeeded) -
                    eventEffectPriority(right.effect, policy, recoveryNeeded) ||
                left.choice.id.localeCompare(right.choice.id)
            );
        const selected = ranked[0];
        return selected
            ? {
                  action: 'claim',
                  choiceId: selected.choice.id,
                  reason: recoveryNeeded && selected.effect === 'heal_or_guard'
                      ? 'Visible survival reserve is low, so the event policy prioritizes recovery.'
                      : `${policy.id} selected its highest-priority legal event resource (${selected.effect}).`,
                  resourceAssessment: sideRoomResourceAssessment(
                      run,
                      selected.preview.run,
                      room.payload.kind,
                      selected.effect,
                      recoveryNeeded
                  )
              }
            : { action: 'skip', reason: 'Event policy found no legal non-skip outcome.' };
    }
    const rewardPriority = new Map(policy.bonusRewardPriorities.map((rewardId, index) => [rewardId, index]));
    const rankedChoices = choices
        .filter((choice) => choice.rewardImpactKind !== 'risk')
        .map((choice) => ({ choice, rewardId: bonusRewardIdFromChoiceId(choice.id), preview: previewClaim(choice.id) }))
        .filter((candidate) => candidate.preview.accepted)
        .sort((left, right) =>
            (left.rewardId == null ? Number.MAX_SAFE_INTEGER : rewardPriority.get(left.rewardId) ?? Number.MAX_SAFE_INTEGER) -
                (right.rewardId == null ? Number.MAX_SAFE_INTEGER : rewardPriority.get(right.rewardId) ?? Number.MAX_SAFE_INTEGER) ||
            Number(Boolean(right.choice.primary)) - Number(Boolean(left.choice.primary)) ||
            left.choice.id.localeCompare(right.choice.id)
        );
    const selected = rankedChoices[0];
    if (!selected && choices.length > 0) {
        return { action: 'skip', reason: 'No visible bonus choice is both policy-safe and command-legal.' };
    }
    const singlePreview = choices.length === 0 ? previewClaim() : null;
    if (singlePreview && !singlePreview.accepted) {
        return { action: 'skip', reason: 'The deterministic single reward is no longer legal.' };
    }
    const preview = selected?.preview ?? singlePreview;
    return {
        action: 'claim',
        choiceId: selected?.choice.id,
        reason: selected
            ? 'Bonus policy selected the highest-priority eligible build reward.'
            : 'Bonus policy claims the deterministic single reward.',
        resourceAssessment: preview
            ? sideRoomResourceAssessment(run, preview.run, room.payload.kind, selected?.rewardId ?? 'bonus_reward', recoveryNeeded)
            : undefined
    };
};

const chooseRelicId = (run: RunState, policy: GameplayBuildPolicyDefinition): RelicId | null => {
    const options = run.relicOffer?.options ?? [];
    const priority = new Map(policy.relicPriorities.map((relicId, index) => [relicId, index]));
    return [...options].sort((left, right) =>
        (priority.get(left) ?? Number.MAX_SAFE_INTEGER) - (priority.get(right) ?? Number.MAX_SAFE_INTEGER) ||
        left.localeCompare(right)
    )[0] ?? null;
};

const floorMatchup = (run: RunState): GameplayBuildMatchup => {
    const board = run.board;
    const mutators = Array.isArray(run.activeMutators) ? run.activeMutators : [];
    if (board?.floorTag === 'boss' || board?.dungeonBossId) return 'boss_pressure';
    if (mutators.includes('score_parasite')) return 'parasite_pressure';
    if (
        mutators.some((mutator) => HAZARD_PRESSURE_MUTATORS.has(mutator)) ||
        (Array.isArray(board?.enemyHazards) && board.enemyHazards.length > 0)
    ) {
        return 'hazard_pressure';
    }
    if (mutators.some((mutator) => MEMORY_PRESSURE_MUTATORS.has(mutator))) return 'memory_pressure';
    if (
        mutators.includes('findables_floor') ||
        board?.dungeonShopTileId ||
        runNonNegativeInteger(run.dungeonTreasuresOpenedThisFloor) > 0
    ) {
        return 'economy_opportunity';
    }
    return 'neutral';
};

const recurringSynergyTags = (strategy: GameplayBuildStrategyDefinition): Set<string> => {
    if (strategy.id === 'conduit_cartographer') {
        return new Set(['conduit:echo-peek', 'reward-perk:echo-conduit-double']);
    }
    if (strategy.id === 'guard_tank') {
        return new Set(['mirror:stasis-guard', 'heavy:mirror-guard', 'stasis:sealed-buffer']);
    }
    if (strategy.id === 'route_gambler') {
        return new Set(['drift:row-shuffle', 'drift:volatile-full-shuffle', 'volatile:heavy-guard']);
    }
    if (strategy.id === 'combo_shard_engine') {
        return new Set(['echo:sealed-combo', 'sealed:conduit-shard-spark', 'sealed:heavy-score']);
    }
    return new Set(['cursed:volatile-greed', 'reward-perk:cursed-opener-greed', 'sealed:heavy-score']);
};

const signatureAxisScores = (
    strategy: GameplayBuildStrategyDefinition,
    events: readonly GameplayEvent[]
): Record<GameplayBuildStrategyAxis, number> => {
    const scores = emptyAxisScores();
    const sourceIds = strategy.id === 'conduit_cartographer'
        ? new Set(['echo_conduit_lens', 'echo_conduit_double'])
        : strategy.id === 'guard_tank'
          ? new Set(['hazard_ward', 'volatile_heavy_guard'])
          : strategy.id === 'treasure_greed'
            ? new Set(['chest_gold', 'cursed_opener_contract', 'cursed_opener_greed'])
            : strategy.id === 'route_gambler'
              ? new Set(['gambit', 'risk_wager', 'wager_surety'])
              : new Set(['bonus_shards', 'combo_shard_plus_step', 'shard_spark']);
    for (const event of events) {
        const fromBuildSource = sourceIds.has(event.source.id);
        if (
            strategy.id === 'conduit_cartographer' &&
            (event.type === 'board.peeked' || (fromBuildSource && event.type === 'inventory.changed'))
        ) {
            scores.information += 1;
        }
        if (
            strategy.id === 'guard_tank' &&
            (event.type === 'board.pair_destroyed' || (fromBuildSource && event.type === 'inventory.changed'))
        ) {
            scores.control += 1;
        }
        if (
            strategy.id === 'treasure_greed' &&
            (event.type === 'shop.offer_purchased' ||
                (fromBuildSource && (event.type === 'currency.changed' || event.type === 'score.changed')))
        ) {
            scores.economy += 1;
        }
        if (
            strategy.id === 'route_gambler' &&
            (event.type === 'board.gambit_commit.requested' ||
                event.type === 'risk_wager.accepted' ||
                (fromBuildSource &&
                    (event.type === 'relic_favor.requested' ||
                        event.type === 'featured_streak_floor.requested')))
        ) {
            scores.risk_conversion += 1;
        }
        if (
            strategy.id === 'combo_shard_engine' &&
            ((event.type === 'board.turn_resolved' &&
                event.livesAfter > event.livesBefore &&
                event.comboShardsAfter < event.comboShardsBefore) ||
                (fromBuildSource &&
                    (event.type === 'inventory.changed' || event.type === 'combo_shard.requested')))
        ) {
            scores.sustain_conversion += 1;
        }
    }
    return scores;
};

const runSeed = (
    strategy: GameplayBuildStrategyDefinition,
    seed: number,
    rulesVersion: number,
    requestedFloors: number
): GameplayBuildMultiFloorSeedSample => {
    const policy = GAMEPLAY_BUILD_POLICIES[strategy.id];
    const initialRun = createInitialRun(strategy, seed, rulesVersion);
    const trace: MutableBuildTrace = {
        initialRun,
        run: initialRun,
        commands: [],
        events: [],
        acceptedCommandIds: [],
        rejectedCommandIds: [],
        signatureEvents: [],
        invariantViolations: []
    };
    const floorTraces: GameplayBuildFloorTrace[] = [];
    const policyDecisions: GameplayBuildPolicyDecision[] = [];
    const applySignaturePolicy = (floor: number, matchup: GameplayBuildMatchup): number => {
        const consequence = signatureConsequenceCommand(trace, strategy, policy);
        const applied = consequence ? executeCommand(trace, strategy, consequence, true) : false;
        policyDecisions.push({
            floor,
            matchup,
            phase: 'signature',
            decision: consequence?.type ?? 'conserve_or_unavailable',
            selectedId: consequence?.commandId ?? null,
            applied,
            reason: consequence
                ? `${policy.id} spends its ${strategy.expectedDominantAxis} consequence ${policy.signatureTiming.replace('_', ' ')}.`
                : `${policy.id} found no legal stocked signature consequence and conserved state.`
        });
        return applied ? 1 : 0;
    };
    const setupDefinitions = strategy.activationDefinitionIds.filter((definitionId) =>
        definitionId.startsWith('bonus_reward.')
    );
    for (const definitionId of setupDefinitions) {
        executeCommand(
            trace,
            strategy,
            createGameplayDefinitionCommand(commandIdFor(trace, strategy, 'claim_build_source'), definitionId),
            true
        );
    }

    for (let floorIndex = 0; floorIndex < requestedFloors; floorIndex += 1) {
        if (!trace.run.board || trace.run.status === 'gameOver') break;
        const floor = trace.run.board.level;
        const matchup = floorMatchup(trace.run);
        const floorTag = trace.run.board.floorTag ?? null;
        const floorArchetypeId = trace.run.board.floorArchetypeId ?? null;
        const activeMutators = Array.isArray(trace.run.activeMutators) ? [...trace.run.activeMutators] : [];
        const boardTraitKinds = [...new Set(trace.run.board.tiles.flatMap((tile) =>
            tile.tileTraitKind ? [tile.tileTraitKind] : []
        ))];
        const livesBefore = runNonNegativeInteger(trace.run.lives);
        const scoreBefore = runNonNegativeInteger(trace.run.stats?.totalScore);
        const commandStart = trace.commands.length;
        const eventStart = trace.events.length;
        let signatureConsequenceUses = 0;

        if (trace.run.status === 'memorize') {
            executeCommand(
                trace,
                strategy,
                createGameplayMemorizeCompleteCommand(commandIdFor(trace, strategy, 'memorize_complete'))
            );
        }
        if (policy.signatureTiming === 'before_board') {
            signatureConsequenceUses += applySignaturePolicy(floor, matchup);
        }

        const solver = solveRunThroughGameplayCoreWithTrace(trace.run, 240, true, {
            informationPolicy: policy.informationPolicy,
            gambitPolicy: policy.gambitSuppressedMatchups.includes(matchup)
                ? undefined
                : policy.gambitPolicy ?? undefined
        });
        appendSolverTrace(trace, solver);
        if (strategy.id === 'route_gambler') {
            trace.signatureEvents.push(...solver.events.filter((event) =>
                event.type === 'board.gambit_commit.requested' || event.source.id === 'wager_surety'
            ));
            signatureConsequenceUses += solver.gambitCommits;
        }
        if (strategy.id === 'combo_shard_engine') {
            const isShardLifeConversion = (event: GameplayEvent): boolean =>
                event.type === 'board.turn_resolved' &&
                event.livesAfter > event.livesBefore &&
                event.comboShardsAfter < event.comboShardsBefore;
            const conversions = solver.events.filter(isShardLifeConversion);
            trace.signatureEvents.push(...solver.events.filter((event) =>
                isShardLifeConversion(event) ||
                event.source.id === 'combo_shard_plus_step' ||
                event.source.id === 'shard_spark'
            ));
            signatureConsequenceUses += conversions.length;
        }

        if (policy.signatureTiming === 'after_board') {
            signatureConsequenceUses += applySignaturePolicy(floor, matchup);
        }

        const floorEvents = trace.events.slice(eventStart);
        const expectedSynergyTags = recurringSynergyTags(strategy);
        const observedTraitInteractionTags = floorEvents.flatMap((event) =>
            event.type === 'board.turn_resolved'
                ? event.traitInteractionTags
                : []
        );
        const appliedSynergyTags = observedTraitInteractionTags.filter((tag) => expectedSynergyTags.has(tag));
        const completed = trace.run.status === 'levelComplete';
        floorTraces.push({
            floor,
            matchup,
            floorTag,
            floorArchetypeId,
            activeMutators,
            boardTraitKinds,
            completed,
            stopReason: solver.stopReason,
            lastPairKey: solver.lastPairKey,
            lastTileIds: [...solver.lastTileIds],
            turns: solver.turns,
            commandCount: trace.commands.length - commandStart,
            eventCount: floorEvents.length,
            livesBefore,
            livesAfter: runNonNegativeInteger(trace.run.lives),
            scoreBefore,
            scoreAfter: runNonNegativeInteger(trace.run.stats?.totalScore),
            signatureConsequenceUses,
            gambitCommits: solver.gambitCommits,
            gambitSuppressedByMatchup:
                policy.gambitPolicy != null && policy.gambitSuppressedMatchups.includes(matchup),
            information: solver.information,
            observedTraitInteractionTags: [...new Set(observedTraitInteractionTags)],
            recurringSynergyTags: [...new Set(appliedSynergyTags)],
            replayCheckpointVerified: solver.replayVerified,
            replayCheckpointDeterministic: solver.replayDeterministic,
            invariantViolations: [...solver.invariantViolations]
        });
        if (!completed || floorIndex === requestedFloors - 1) break;

        const routeSelection = chooseRoute(trace.run, policy);
        if (routeSelection) {
            const selectedAssessment = routeSelection.assessments.find(
                (assessment) => assessment.routeId === routeSelection.routeId
            );
            const routeApplied = executeCommand(
                trace,
                strategy,
                createGameplayRouteChooseCommand(
                    commandIdFor(trace, strategy, 'route_choose'),
                    routeSelection.routeId
                )
            );
            policyDecisions.push({
                floor,
                matchup,
                phase: 'route',
                decision: routeSelection.routeType,
                selectedId: routeSelection.routeId,
                applied: routeApplied,
                reason: `${policy.id} ranked ${policy.routePriorities.join(' > ')} after visible-resource risk checks. ${selectedAssessment?.reason ?? ''}`.trim(),
                routeRiskAssessments: routeSelection.assessments,
                adaptedFromPriority: routeSelection.adaptedFromPriority
            });
            if (trace.run.sideRoom) {
                const sideRoomChoice = chooseSideRoomAction(trace.run, policy);
                const sideRoomApplied = executeCommand(
                    trace,
                    strategy,
                    createGameplaySideRoomResolveCommand(
                        commandIdFor(trace, strategy, `side_room_${sideRoomChoice.action}`),
                        sideRoomChoice.action,
                        sideRoomChoice.choiceId
                    ),
                    sideRoomChoice.action === 'claim'
                );
                policyDecisions.push({
                    floor,
                    matchup,
                    phase: 'side_room',
                    decision: sideRoomChoice.action,
                    selectedId: sideRoomChoice.choiceId ?? null,
                    applied: sideRoomApplied,
                    reason: sideRoomChoice.reason,
                    sideRoomResourceAssessment: sideRoomChoice.resourceAssessment
                });
            }
        }
        if (needsRelicPick(trace.run)) {
            executeCommand(
                trace,
                strategy,
                createGameplayRelicOfferOpenCommand(commandIdFor(trace, strategy, 'relic_offer_open'))
            );
            for (let pick = 0; trace.run.relicOffer && pick < 4; pick += 1) {
                const relicId = chooseRelicId(trace.run, policy);
                if (!relicId) break;
                const relicApplied = executeCommand(
                    trace,
                    strategy,
                    createGameplayRelicPickCommand(commandIdFor(trace, strategy, 'relic_pick'), relicId)
                );
                policyDecisions.push({
                    floor,
                    matchup,
                    phase: 'relic',
                    decision: 'pick',
                    selectedId: relicId,
                    applied: relicApplied,
                    reason: `${policy.id} selected the highest offered relic in its explicit priority order.`
                });
            }
        }
        executeCommand(
            trace,
            strategy,
            createGameplayFloorAdvanceCommand(commandIdFor(trace, strategy, 'floor_advance'))
        );
    }

    const observedFloors = floorTraces.map((floor) => floor.floor);
    const floorsAreStrictlyIncreasing = observedFloors.every(
        (floor, index) => index === 0 || floor > observedFloors[index - 1]
    );
    if (new Set(observedFloors).size !== observedFloors.length || !floorsAreStrictlyIncreasing) {
        trace.invariantViolations.push(
            `${strategy.id}@seed:${seed}: floor identities were not unique and strictly increasing (${observedFloors.join(',')}).`
        );
    }

    const commandIds = trace.commands.map((command) => command.commandId);
    if (new Set(commandIds).size !== commandIds.length) {
        trace.invariantViolations.push(`${strategy.id}@seed:${seed}: duplicate command ids across floors.`);
    }
    const eventIds = trace.events.map((event) => event.eventId);
    if (new Set(eventIds).size !== eventIds.length) {
        trace.invariantViolations.push(`${strategy.id}@seed:${seed}: duplicate event ids across floors.`);
    }
    const replay = replayGameplayCommands(
        trace.initialRun,
        trace.commands.map((command) => JSON.parse(JSON.stringify(command)))
    );
    const fullReplayDeterministic =
        stableJson(replay.run) === stableJson(trace.run) &&
        stableJson(replay.events) === stableJson(trace.events) &&
        stableJson(replay.acceptedCommandIds) === stableJson(trace.acceptedCommandIds) &&
        stableJson(replay.rejectedCommandIds) === stableJson(trace.rejectedCommandIds);
    if (!fullReplayDeterministic) {
        trace.invariantViolations.push(`${strategy.id}@seed:${seed}: full multi-floor replay diverged.`);
    }

    const eventTypeCounts: Record<string, number> = {};
    for (const event of trace.events) eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;
    const feedbackCues = trace.events
        .filter((event): event is Extract<GameplayEvent, { type: 'feedback.requested' }> =>
            event.type === 'feedback.requested')
        .map((event) => event.cue);
    const signatureScores = signatureAxisScores(strategy, trace.signatureEvents);
    return {
        seed,
        requestedFloors,
        completedFloors: floorTraces.filter((floor) => floor.completed).length,
        commands: trace.commands,
        events: trace.events,
        acceptedCommandIds: trace.acceptedCommandIds,
        rejectedCommandIds: trace.rejectedCommandIds,
        floorTraces,
        policyDecisions,
        eventTypeCounts,
        feedbackCues,
        signatureAxisScores: signatureScores,
        signatureConsequenceUses: floorTraces.reduce((sum, floor) => sum + floor.signatureConsequenceUses, 0),
        fullReplayDeterministic,
        finalLives: runNonNegativeInteger(trace.run.lives),
        finalScore: runNonNegativeInteger(trace.run.stats?.totalScore),
        finalShopGold: runNonNegativeInteger(trace.run.shopGold),
        invariantViolations: trace.invariantViolations
    };
};

const distribution = (values: readonly number[]): GameplayBuildDistribution => {
    if (values.length === 0) return { min: 0, mean: 0, max: 0 };
    return {
        min: Math.min(...values),
        mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
        max: Math.max(...values)
    };
};

const dominantAxisFor = (scores: Record<GameplayBuildStrategyAxis, number>): GameplayBuildStrategyAxis =>
    GAMEPLAY_BUILD_STRATEGY_AXES.reduce((best, axis) => scores[axis] > scores[best] ? axis : best);

const aggregateMatchups = (samples: readonly GameplayBuildMultiFloorSeedSample[]): GameplayBuildMatchupMetrics[] => {
    const floors = samples.flatMap((sample) => sample.floorTraces);
    const order: GameplayBuildMatchup[] = [
        'neutral',
        'memory_pressure',
        'hazard_pressure',
        'parasite_pressure',
        'boss_pressure',
        'economy_opportunity'
    ];
    return order.flatMap((matchup) => {
        const matched = floors.filter((floor) => floor.matchup === matchup);
        if (matched.length === 0) return [];
        return [{
            matchup,
            sampledFloors: matched.length,
            completedFloors: matched.filter((floor) => floor.completed).length,
            completionShare: round(matched.filter((floor) => floor.completed).length / matched.length),
            meanTurns: round(matched.reduce((sum, floor) => sum + floor.turns, 0) / matched.length),
            meanLivesLost: round(matched.reduce(
                (sum, floor) => sum + Math.max(0, floor.livesBefore - floor.livesAfter),
                0
            ) / matched.length),
            recurringSynergyFloors: matched.filter((floor) => floor.recurringSynergyTags.length > 0).length
        }];
    });
};

export const runGameplayBuildMultiFloorSimulation = (
    input: GameplayBuildMultiFloorSimulationInput = {}
): GameplayBuildMultiFloorReport => {
    const rulesVersion = input.rulesVersion ?? GAME_RULES_VERSION;
    const seeds = normalizeSeeds(input.seeds);
    const floorsPerSeed = normalizeFloors(input.floors);
    const strategies = selectedStrategies(input.strategies).map((strategy): GameplayBuildMultiFloorMetrics => {
        const samples = seeds.map((seed) => runSeed(strategy, seed, rulesVersion, floorsPerSeed));
        const floorTraces = samples.flatMap((sample) => sample.floorTraces);
        const policyDecisions = samples.flatMap((sample) => sample.policyDecisions);
        const routeDecisions = policyDecisions.filter((decision) => decision.phase === 'route');
        const signatureScores = emptyAxisScores();
        for (const sample of samples) {
            for (const axis of GAMEPLAY_BUILD_STRATEGY_AXES) {
                signatureScores[axis] += sample.signatureAxisScores[axis];
            }
        }
        const floorsCompleted = floorTraces.filter((floor) => floor.completed).length;
        const firstScores = samples.map((sample) => sample.floorTraces[0]?.scoreBefore ?? 0);
        const policy = GAMEPLAY_BUILD_POLICIES[strategy.id];
        const matchupMetrics = aggregateMatchups(samples);
        return {
            id: strategy.id,
            label: strategy.label,
            buildMechanicId: strategy.buildMechanicId,
            consequenceCommandType: strategy.consequenceCommandType,
            consequenceEventType: strategy.consequenceEventType,
            expectedDominantAxis: strategy.expectedDominantAxis,
            policyId: policy.id,
            informationPolicy: policy.informationPolicy,
            gambitPolicy: policy.gambitPolicy,
            gambitSuppressedMatchups: policy.gambitSuppressedMatchups,
            interludeRiskPolicy: policy.interludeRiskPolicy,
            favorableMatchup: policy.favorableMatchup,
            counterMatchup: policy.counterMatchup,
            dominantAxis: dominantAxisFor(signatureScores),
            signatureAxisScores: signatureScores,
            floorsAttempted: floorTraces.length,
            floorsCompleted,
            floorCompletionShare: round(floorsCompleted / Math.max(1, floorTraces.length)),
            deterministicReplaySeeds: samples.filter((sample) => sample.fullReplayDeterministic).length,
            signatureConsequenceUses: samples.reduce((sum, sample) => sum + sample.signatureConsequenceUses, 0),
            observedBoardTraitKinds: [...new Set(floorTraces.flatMap((floor) => floor.boardTraitKinds))],
            observedTraitInteractionTags: [...new Set(floorTraces.flatMap((floor) => floor.observedTraitInteractionTags))],
            recurringSynergyTags: [...new Set(floorTraces.flatMap((floor) => floor.recurringSynergyTags))],
            turnsPerFloor: distribution(floorTraces.map((floor) => floor.turns)),
            commandsPerFloor: distribution(floorTraces.map((floor) => floor.commandCount)),
            livesRemaining: distribution(samples.map((sample) => sample.finalLives)),
            scoreGained: distribution(samples.map((sample, index) => sample.finalScore - (firstScores[index] ?? 0))),
            matchupMetrics,
            favorableMatchupMetrics: matchupMetrics.find((metrics) => metrics.matchup === policy.favorableMatchup) ?? null,
            counterMatchupMetrics: matchupMetrics.find((metrics) => metrics.matchup === policy.counterMatchup) ?? null,
            policyDecisionCount: policyDecisions.length,
            counterMatchupReplayFloors: floorTraces.filter((floor) =>
                floor.matchup === policy.counterMatchup &&
                floor.completed &&
                floor.replayCheckpointVerified &&
                floor.replayCheckpointDeterministic &&
                floor.invariantViolations.length === 0
            ).length,
            imperfectInformationFloors: floorTraces.filter((floor) =>
                floor.information.kind === 'bounded_memory' &&
                floor.information.initialRememberedTileIds.length < floor.information.initialPlayableTileCount
            ).length,
            uncertainTurns: floorTraces.reduce((sum, floor) => sum + floor.information.uncertainTurns, 0),
            memoryEvictions: floorTraces.reduce((sum, floor) => sum + floor.information.evictedTileIds.length, 0),
            riskBudgetExhaustions: floorTraces.filter((floor) => floor.information.riskBudgetExhausted).length,
            routeRiskAssessmentCount: routeDecisions.reduce(
                (sum, decision) => sum + (decision.routeRiskAssessments?.length ?? 0),
                0
            ),
            routeRiskRejections: routeDecisions.reduce(
                (sum, decision) => sum + (decision.routeRiskAssessments?.filter(
                    (assessment) => assessment.legal && !assessment.accepted
                ).length ?? 0),
                0
            ),
            adaptiveRouteSelections: routeDecisions.filter((decision) => decision.adaptedFromPriority).length,
            sideRoomResourceAssessmentCount: policyDecisions.filter(
                (decision) => decision.phase === 'side_room' && decision.sideRoomResourceAssessment != null
            ).length,
            gambitCommits: samples.reduce(
                (sum, sample) => sum + (sample.eventTypeCounts['board.gambit_commit.requested'] ?? 0),
                0
            ),
            riskWagersAccepted: samples.reduce(
                (sum, sample) => sum + (sample.eventTypeCounts['risk_wager.accepted'] ?? 0),
                0
            ),
            riskWagerWins: samples.reduce(
                (sum, sample) => sum + sample.events.filter((event) =>
                    event.source.id === 'wager_surety' && event.type === 'relic_favor.requested'
                ).length,
                0
            ),
            riskWagerLosses: samples.reduce(
                (sum, sample) => sum + sample.events.filter((event) =>
                    event.source.id === 'wager_surety' && event.type === 'featured_streak_floor.requested'
                ).length,
                0
            ),
            shardLifeConversions: strategy.id === 'combo_shard_engine'
                ? samples.reduce(
                    (sum, sample) => sum + sample.events.filter((event) =>
                        event.type === 'board.turn_resolved' &&
                        event.livesAfter > event.livesBefore &&
                        event.comboShardsAfter < event.comboShardsBefore
                    ).length,
                    0
                )
                : 0,
            comboShardSourceEvents: strategy.id === 'combo_shard_engine'
                ? samples.reduce(
                    (sum, sample) => sum + sample.events.filter((event) =>
                        event.type === 'combo_shard.requested' ||
                        (event.type === 'inventory.changed' &&
                            event.itemId === 'combo_shard' &&
                            event.applied > 0)
                    ).length,
                    0
                )
                : 0,
            samples
        };
    });
    const pairwiseMeanTurnRatios: GameplayBuildMultiFloorReport['pairwiseMeanTurnRatios'] = [];
    for (let leftIndex = 0; leftIndex < strategies.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < strategies.length; rightIndex += 1) {
            const left = strategies[leftIndex];
            const right = strategies[rightIndex];
            const low = Math.max(0.01, Math.min(left.turnsPerFloor.mean, right.turnsPerFloor.mean));
            const high = Math.max(left.turnsPerFloor.mean, right.turnsPerFloor.mean);
            pairwiseMeanTurnRatios.push({ left: left.id, right: right.id, ratio: round(high / low) });
        }
    }
    const routeGambler = strategies.find((strategy) => strategy.id === 'route_gambler');
    const comboShardEngine = strategies.find((strategy) => strategy.id === 'combo_shard_engine');
    return {
        rulesVersion,
        seeds,
        floorsPerSeed,
        offlineOnly: true,
        strategies,
        pairwiseMeanTurnRatios,
        cohesiveBuildCoverage: {
            routeGambler: {
                id: 'route_gambler',
                buildMechanicId: 'build.route_gambler',
                startingLoadoutId: 'route_tactician',
                axis: 'risk_conversion',
                favorableMatchup: 'economy_opportunity',
                counterMatchup: 'hazard_pressure',
                requiredSystems: [
                    'relic.wager_surety',
                    'objective.risk_wager',
                    'inventory.gambit_token',
                    'power.gambit',
                    'route.mystery'
                ],
                longHorizonSampled: true,
                evidence: {
                    gambitCommits: routeGambler?.gambitCommits ?? 0,
                    riskWagersAccepted: routeGambler?.riskWagersAccepted ?? 0,
                    riskWagerWins: routeGambler?.riskWagerWins ?? 0,
                    riskWagerLosses: routeGambler?.riskWagerLosses ?? 0,
                    favorableMatchupFloors: routeGambler?.favorableMatchupMetrics?.sampledFloors ?? 0,
                    counterMatchupFloors: routeGambler?.counterMatchupMetrics?.sampledFloors ?? 0
                }
            },
            comboShardEngine: {
                id: 'combo_shard_engine',
                buildMechanicId: 'build.combo_shard_engine',
                startingLoadoutId: 'vaultbreaker',
                axis: 'sustain_conversion',
                favorableMatchup: 'economy_opportunity',
                counterMatchup: 'parasite_pressure',
                requiredSystems: [
                    'reward.bonus_shards',
                    'relic.combo_shard_plus_step',
                    'findable.shard_spark',
                    'inventory.combo_shard',
                    'progression.shard_to_life'
                ],
                longHorizonSampled: true,
                evidence: {
                    comboShardSourceEvents: comboShardEngine?.comboShardSourceEvents ?? 0,
                    shardLifeConversions: comboShardEngine?.shardLifeConversions ?? 0,
                    favorableMatchupFloors: comboShardEngine?.favorableMatchupMetrics?.sampledFloors ?? 0,
                    counterMatchupFloors: comboShardEngine?.counterMatchupMetrics?.sampledFloors ?? 0
                }
            }
        },
        bounds: {
            requiredStrategyCount: 5,
            minFloorsPerSeed: 12,
            minFloorCompletionShare: 1,
            minDeterministicReplayShare: 1,
            minSignatureConsequenceUsesPerSeed: 1,
            minRecurringSynergyFloors: 1,
            minPolicyDecisionsPerFloor: 1,
            minFavorableMatchupFloors: 1,
            minCounterMatchupFloors: 1,
            minImperfectInformationFloorsPerSeed: 1,
            minUncertainTurnsPerSeed: 1,
            maxRiskBudgetExhaustions: 0,
            minRouteRiskAssessmentsPerSeed: 3,
            minRouteRiskRejectionsPerStrategy: 1,
            minSideRoomResourceAssessmentsPerSeed: 1,
            minAdaptiveRouteSelections: 1,
            minRouteGamblerGambitCommitsPerSeed: 1,
            minRouteGamblerRiskWagersAccepted: 1,
            minRouteGamblerRiskWagerOutcomes: 1,
            minComboShardLifeConversionsPerSeed: 1,
            minComboShardSourceEventsPerSeed: 1,
            maxPairwiseMeanTurnRatio: 1.5
        },
        notes: [
            'Each sample retains one command/event trace from content claim through generated boards, routes, side rooms, milestone relics, and floor advancement.',
            'Every generated floor is replayed as an isolated checkpoint and the complete multi-floor command list is replayed from the stocked initial run.',
            'Exported strategy policies rank real route choices, side-room rewards, relics, shop items, and signature timing; every decision remains attached to its observed floor matchup.',
            'Route choices preview actual typed outcomes and spend explicit risk units against visible life, guard, ward, parasite, and destroy protection; event rooms rank their real deterministic resource effects and prioritize recovery only below the build reserve.',
            'Board choices use capped transient observation ledgers. Unknown hidden identities are never grouped by the policy, and unsupported guesses stop at an explicit per-build uncertain-turn budget.',
            'Matchup distributions are observed from shipped schedule mutators, hazards, bosses, and economy nodes; absent buckets are reported as unsampled rather than invented.',
            'Favorable and counter labels are explicit design hypotheses. The gate requires shipped exposure, bounded-memory completion, feedback, and replay evidence but does not report simulator outcomes as human win rates.',
            'The gate proves longer structural viability and balance envelopes for a deterministic bounded-memory policy, not final human difficulty balance.',
            'Route Gambler is retained as the fourth long-horizon build: Route Tactician movement, one-floor Gambit rescue, objective wagers, Wager Surety, Favor cash-out, and Mystery routing form one distinct risk-conversion trace.',
            'Combo Shard Engine is retained as the fifth build: Greed creates a visible life deficit, Bonus Shards and the Catalyst relic stock bounded momentum, clean matches convert the next shard into life, and authored parasite floors test its sustain counter.'
        ]
    };
};

export const assertGameplayBuildMultiFloorViable = (
    report: GameplayBuildMultiFloorReport
): { ok: boolean; issues: string[] } => {
    const issues: string[] = [];
    if (report.strategies.length < report.bounds.requiredStrategyCount) {
        issues.push(`strategies=${report.strategies.length}; required=${report.bounds.requiredStrategyCount}`);
    }
    if (report.floorsPerSeed < report.bounds.minFloorsPerSeed) {
        issues.push(`floorsPerSeed=${report.floorsPerSeed}; required=${report.bounds.minFloorsPerSeed}`);
    }
    for (const strategy of report.strategies) {
        const context = `${strategy.id}@seeds:${report.seeds.join(',')}`;
        if (strategy.dominantAxis !== strategy.expectedDominantAxis) {
            issues.push(`${context}:dominantAxis=${strategy.dominantAxis}; expected=${strategy.expectedDominantAxis}`);
        }
        if (strategy.floorCompletionShare < report.bounds.minFloorCompletionShare) {
            issues.push(`${context}:floorCompletionShare=${strategy.floorCompletionShare}; required=${report.bounds.minFloorCompletionShare}`);
        }
        const replayShare = round(strategy.deterministicReplaySeeds / Math.max(1, report.seeds.length));
        if (replayShare < report.bounds.minDeterministicReplayShare) {
            issues.push(`${context}:deterministicReplayShare=${replayShare}; required=${report.bounds.minDeterministicReplayShare}`);
        }
        if (strategy.signatureConsequenceUses < report.bounds.minSignatureConsequenceUsesPerSeed * report.seeds.length) {
            issues.push(`${context}:signatureConsequenceUses=${strategy.signatureConsequenceUses}; required=${report.bounds.minSignatureConsequenceUsesPerSeed * report.seeds.length}`);
        }
        const recurringSynergyFloors = strategy.matchupMetrics.reduce(
            (sum, matchup) => sum + matchup.recurringSynergyFloors,
            0
        );
        if (recurringSynergyFloors < report.bounds.minRecurringSynergyFloors) {
            issues.push(`${context}:recurringSynergyFloors=${recurringSynergyFloors}; required=${report.bounds.minRecurringSynergyFloors}`);
        }
        const minimumPolicyDecisions =
            strategy.floorsAttempted * report.bounds.minPolicyDecisionsPerFloor;
        if (strategy.policyDecisionCount < minimumPolicyDecisions) {
            issues.push(`${context}:policyDecisions=${strategy.policyDecisionCount}; required=${minimumPolicyDecisions}`);
        }
        if ((strategy.favorableMatchupMetrics?.sampledFloors ?? 0) < report.bounds.minFavorableMatchupFloors) {
            issues.push(
                `${context}:favorableMatchup=${strategy.favorableMatchup}; sampled=${strategy.favorableMatchupMetrics?.sampledFloors ?? 0}; required=${report.bounds.minFavorableMatchupFloors}`
            );
        }
        if ((strategy.counterMatchupMetrics?.sampledFloors ?? 0) < report.bounds.minCounterMatchupFloors) {
            issues.push(
                `${context}:counterMatchup=${strategy.counterMatchup}; sampled=${strategy.counterMatchupMetrics?.sampledFloors ?? 0}; required=${report.bounds.minCounterMatchupFloors}`
            );
        }
        if (strategy.counterMatchupReplayFloors < report.bounds.minCounterMatchupFloors) {
            issues.push(
                `${context}:counterMatchupReplayFloors=${strategy.counterMatchupReplayFloors}; required=${report.bounds.minCounterMatchupFloors}`
            );
        }
        const minimumImperfectFloors = report.bounds.minImperfectInformationFloorsPerSeed * report.seeds.length;
        if (strategy.imperfectInformationFloors < minimumImperfectFloors) {
            issues.push(
                `${context}:imperfectInformationFloors=${strategy.imperfectInformationFloors}; required=${minimumImperfectFloors}`
            );
        }
        const minimumUncertainTurns = report.bounds.minUncertainTurnsPerSeed * report.seeds.length;
        if (strategy.uncertainTurns < minimumUncertainTurns) {
            issues.push(`${context}:uncertainTurns=${strategy.uncertainTurns}; required=${minimumUncertainTurns}`);
        }
        if (strategy.riskBudgetExhaustions > report.bounds.maxRiskBudgetExhaustions) {
            issues.push(
                `${context}:riskBudgetExhaustions=${strategy.riskBudgetExhaustions}; max=${report.bounds.maxRiskBudgetExhaustions}`
            );
        }
        const minimumRouteRiskAssessments = report.bounds.minRouteRiskAssessmentsPerSeed * report.seeds.length;
        if (strategy.routeRiskAssessmentCount < minimumRouteRiskAssessments) {
            issues.push(
                `${context}:routeRiskAssessments=${strategy.routeRiskAssessmentCount}; required=${minimumRouteRiskAssessments}`
            );
        }
        const minimumRouteRiskRejections = report.bounds.minRouteRiskRejectionsPerStrategy;
        if (strategy.routeRiskRejections < minimumRouteRiskRejections) {
            issues.push(
                `${context}:routeRiskRejections=${strategy.routeRiskRejections}; required=${minimumRouteRiskRejections}`
            );
        }
        const minimumSideRoomAssessments = report.bounds.minSideRoomResourceAssessmentsPerSeed * report.seeds.length;
        if (strategy.sideRoomResourceAssessmentCount < minimumSideRoomAssessments) {
            issues.push(
                `${context}:sideRoomResourceAssessments=${strategy.sideRoomResourceAssessmentCount}; required=${minimumSideRoomAssessments}`
            );
        }
        for (const sample of strategy.samples) {
            const sampleContext = `${strategy.id}@seed:${sample.seed}`;
            if (sample.completedFloors !== sample.requestedFloors) {
                issues.push(`${sampleContext}:completedFloors=${sample.completedFloors}; requested=${sample.requestedFloors}`);
            }
            if (sample.rejectedCommandIds.length > 0) {
                issues.push(`${sampleContext}:rejectedCommands=${sample.rejectedCommandIds.length}`);
            }
            if (sample.signatureConsequenceUses < report.bounds.minSignatureConsequenceUsesPerSeed) {
                issues.push(`${sampleContext}:signatureConsequenceUses=${sample.signatureConsequenceUses}; required=${report.bounds.minSignatureConsequenceUsesPerSeed}`);
            }
            if (!sample.fullReplayDeterministic) issues.push(`${sampleContext}:full replay diverged`);
            issues.push(...sample.invariantViolations.map((issue) => `${sampleContext}:${issue}`));
        }
    }
    const routeGambler = report.strategies.find((strategy) => strategy.id === 'route_gambler');
    if (routeGambler) {
        const minimumGambitCommits =
            report.bounds.minRouteGamblerGambitCommitsPerSeed * report.seeds.length;
        if (routeGambler.gambitCommits < minimumGambitCommits) {
            issues.push(
                `route_gambler@seeds:${report.seeds.join(',')}:gambitCommits=${routeGambler.gambitCommits}; required=${minimumGambitCommits}`
            );
        }
        if (routeGambler.riskWagersAccepted < report.bounds.minRouteGamblerRiskWagersAccepted) {
            issues.push(
                `route_gambler@seeds:${report.seeds.join(',')}:riskWagersAccepted=${routeGambler.riskWagersAccepted}; required=${report.bounds.minRouteGamblerRiskWagersAccepted}`
            );
        }
        const wagerOutcomes = routeGambler.riskWagerWins + routeGambler.riskWagerLosses;
        if (wagerOutcomes < report.bounds.minRouteGamblerRiskWagerOutcomes) {
            issues.push(
                `route_gambler@seeds:${report.seeds.join(',')}:riskWagerOutcomes=${wagerOutcomes}; required=${report.bounds.minRouteGamblerRiskWagerOutcomes}`
            );
        }
    }
    const comboShardEngine = report.strategies.find((strategy) => strategy.id === 'combo_shard_engine');
    if (comboShardEngine) {
        const minimumConversions =
            report.bounds.minComboShardLifeConversionsPerSeed * report.seeds.length;
        if (comboShardEngine.shardLifeConversions < minimumConversions) {
            issues.push(
                `combo_shard_engine@seeds:${report.seeds.join(',')}:shardLifeConversions=${comboShardEngine.shardLifeConversions}; required=${minimumConversions}`
            );
        }
        const minimumSourceEvents =
            report.bounds.minComboShardSourceEventsPerSeed * report.seeds.length;
        if (comboShardEngine.comboShardSourceEvents < minimumSourceEvents) {
            issues.push(
                `combo_shard_engine@seeds:${report.seeds.join(',')}:comboShardSourceEvents=${comboShardEngine.comboShardSourceEvents}; required=${minimumSourceEvents}`
            );
        }
    }
    const adaptiveRouteSelections = report.strategies.reduce(
        (sum, strategy) => sum + strategy.adaptiveRouteSelections,
        0
    );
    if (adaptiveRouteSelections < report.bounds.minAdaptiveRouteSelections) {
        issues.push(
            `adaptiveRouteSelections=${adaptiveRouteSelections}; required=${report.bounds.minAdaptiveRouteSelections}`
        );
    }
    for (const pair of report.pairwiseMeanTurnRatios) {
        if (pair.ratio > report.bounds.maxPairwiseMeanTurnRatio) {
            issues.push(`${pair.left}<->${pair.right}:meanTurnRatio=${pair.ratio}; max=${report.bounds.maxPairwiseMeanTurnRatio}`);
        }
    }
    return { ok: issues.length === 0, issues };
};
