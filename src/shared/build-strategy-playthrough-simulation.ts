import { collectDestroyEligibleTileIds } from './board-power-targeting';
import {
    GAME_RULES_VERSION,
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
    type GameplayCorePlaythroughSolverTrace
} from './gameplay-core-playthrough-solver';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import { needsRelicPick } from './relics';
import { getRouteChoiceAvailability } from './route-choice-rules';
import { applyRouteChoiceOutcome } from './route-choice-outcome-rules';
import { openRouteSideRoom } from './route-side-room-rules';
import { createNewRun } from './run-creation-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { createRunShopOffers } from './shop-rules';

export type GameplayBuildMatchup =
    | 'neutral'
    | 'memory_pressure'
    | 'hazard_pressure'
    | 'boss_pressure'
    | 'economy_opportunity';

export interface GameplayBuildPolicyDefinition {
    id: `${GameplayBuildStrategyId}_policy_v1`;
    strategyId: GameplayBuildStrategyId;
    routePriorities: readonly RouteNodeType[];
    bonusRewardPriorities: readonly BonusRewardId[];
    relicPriorities: readonly RelicId[];
    shopItemPriorities: readonly RunShopItemId[];
    signatureTiming: 'before_board' | 'after_board';
    favorableMatchup: GameplayBuildMatchup;
    counterMatchup: GameplayBuildMatchup;
}

export interface GameplayBuildPolicyDecision {
    floor: number;
    matchup: GameplayBuildMatchup;
    phase: 'signature' | 'route' | 'side_room' | 'relic';
    decision: string;
    selectedId: string | null;
    applied: boolean;
    reason: string;
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
    turns: number;
    commandCount: number;
    eventCount: number;
    livesBefore: number;
    livesAfter: number;
    scoreBefore: number;
    scoreAfter: number;
    signatureConsequenceUses: number;
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
        signatureTiming: 'after_board',
        favorableMatchup: 'economy_opportunity',
        counterMatchup: 'boss_pressure'
    }
};

const stableJson = (value: unknown): string => JSON.stringify(value);
const round = (value: number): number => Number(value.toFixed(2));
const emptyAxisScores = (): Record<GameplayBuildStrategyAxis, number> => ({
    information: 0,
    control: 0,
    economy: 0
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
    const base = createNewRun(0, {
        runSeed: seed,
        runRulesVersionOverride: rulesVersion,
        startingLoadoutId: strategy.startingLoadoutId,
        onboardingSafeFirstFloor: true,
        practiceMode: true,
        echoFeedbackEnabled: false
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

const chooseRouteId = (run: RunState, priorities: readonly RouteNodeType[]): string | null => {
    const choices = Array.isArray(run.lastLevelResult?.routeChoices) ? run.lastLevelResult.routeChoices : [];
    const viable = choices.filter((choice) => {
        if (!getRouteChoiceAvailability(run, choice).available) return false;
        const outcome = applyRouteChoiceOutcome(run, choice.id);
        return outcome.applied && openRouteSideRoom(outcome.run).sideRoom != null;
    });
    for (const routeType of priorities) {
        const choiceId = viable.find((choice) => choice.routeType === routeType)?.id;
        if (choiceId) return choiceId;
    }
    return viable[0]?.id ?? null;
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

const chooseSideRoomAction = (
    run: RunState,
    policy: GameplayBuildPolicyDefinition
): { action: 'claim' | 'skip'; choiceId?: string; reason: string } => {
    const room = run.sideRoom;
    if (!room) return { action: 'skip', reason: 'No side room is open.' };
    const claimIsLegal = (choiceId?: string): boolean => reduceGameplayCommand(
        run,
        createGameplaySideRoomResolveCommand(
            `policy-preview:${run.runSeed}:${room.floor}:${choiceId ? 'choice' : 'primary'}`,
            'claim',
            choiceId
        )
    ).accepted;
    if (room.payload.kind === 'rest_heal') {
        return runNonNegativeInteger(run.lives) < MAX_LIVES && claimIsLegal()
            ? { action: 'claim', reason: 'Recovery policy spends the safe stop only when life is missing.' }
            : { action: 'skip', reason: 'Recovery policy preserves gold at full life.' };
    }
    const choices = Array.isArray(room.choices) ? room.choices : [];
    if (room.payload.kind === 'event_choice') {
        const primary = choices.find((choice) => choice.primary)?.id ?? room.payload.choiceId;
        return claimIsLegal(primary)
            ? { action: 'claim', choiceId: primary, reason: 'Event policy accepts the shipped primary legal non-skip outcome.' }
            : { action: 'skip', reason: 'Event policy declines a stale or illegal primary outcome.' };
    }
    const rewardPriority = new Map(policy.bonusRewardPriorities.map((rewardId, index) => [rewardId, index]));
    const rankedChoices = choices
        .filter((choice) => choice.rewardImpactKind !== 'risk')
        .map((choice) => ({ choice, rewardId: bonusRewardIdFromChoiceId(choice.id) }))
        .sort((left, right) =>
            (left.rewardId == null ? Number.MAX_SAFE_INTEGER : rewardPriority.get(left.rewardId) ?? Number.MAX_SAFE_INTEGER) -
                (right.rewardId == null ? Number.MAX_SAFE_INTEGER : rewardPriority.get(right.rewardId) ?? Number.MAX_SAFE_INTEGER) ||
            Number(Boolean(right.choice.primary)) - Number(Boolean(left.choice.primary)) ||
            left.choice.id.localeCompare(right.choice.id)
        )
        .map(({ choice }) => choice);
    const selected = rankedChoices.find((choice) => claimIsLegal(choice.id));
    if (!selected && choices.length > 0) {
        return { action: 'skip', reason: 'No visible bonus choice is both policy-safe and command-legal.' };
    }
    if (choices.length === 0 && !claimIsLegal()) {
        return { action: 'skip', reason: 'The deterministic single reward is no longer legal.' };
    }
    return {
        action: 'claim',
        choiceId: selected?.id,
        reason: selected
            ? 'Bonus policy selected the highest-priority eligible build reward.'
            : 'Bonus policy claims the deterministic single reward.'
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
    if (
        mutators.some((mutator) => HAZARD_PRESSURE_MUTATORS.has(mutator)) ||
        (Array.isArray(board?.enemyHazards) && board.enemyHazards.length > 0)
    ) {
        return 'hazard_pressure';
    }
    if (mutators.some((mutator) => MEMORY_PRESSURE_MUTATORS.has(mutator))) return 'memory_pressure';
    if (board?.dungeonShopTileId || runNonNegativeInteger(run.dungeonTreasuresOpenedThisFloor) > 0) {
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
          : new Set(['chest_gold', 'cursed_opener_contract', 'cursed_opener_greed']);
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

        const solver = solveRunThroughGameplayCoreWithTrace(trace.run, 240, true);
        appendSolverTrace(trace, solver);

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
            turns: solver.turns,
            commandCount: trace.commands.length - commandStart,
            eventCount: floorEvents.length,
            livesBefore,
            livesAfter: runNonNegativeInteger(trace.run.lives),
            scoreBefore,
            scoreAfter: runNonNegativeInteger(trace.run.stats?.totalScore),
            signatureConsequenceUses,
            observedTraitInteractionTags: [...new Set(observedTraitInteractionTags)],
            recurringSynergyTags: [...new Set(appliedSynergyTags)],
            replayCheckpointVerified: solver.replayVerified,
            replayCheckpointDeterministic: solver.replayDeterministic,
            invariantViolations: [...solver.invariantViolations]
        });
        if (!completed || floorIndex === requestedFloors - 1) break;

        const routeId = chooseRouteId(trace.run, policy.routePriorities);
        if (routeId) {
            const selectedRoute = trace.run.lastLevelResult?.routeChoices?.find((choice) => choice.id === routeId);
            const routeApplied = executeCommand(
                trace,
                strategy,
                createGameplayRouteChooseCommand(commandIdFor(trace, strategy, 'route_choose'), routeId)
            );
            policyDecisions.push({
                floor,
                matchup,
                phase: 'route',
                decision: selectedRoute?.routeType ?? 'fallback',
                selectedId: routeId,
                applied: routeApplied,
                reason: `${policy.id} ranked shipped route types ${policy.routePriorities.join(' > ')}.`
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
                    reason: sideRoomChoice.reason
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
            policyDecisionCount: samples.reduce((sum, sample) => sum + sample.policyDecisions.length, 0),
            counterMatchupReplayFloors: floorTraces.filter((floor) =>
                floor.matchup === policy.counterMatchup &&
                floor.completed &&
                floor.replayCheckpointVerified &&
                floor.replayCheckpointDeterministic &&
                floor.invariantViolations.length === 0
            ).length,
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
    return {
        rulesVersion,
        seeds,
        floorsPerSeed,
        offlineOnly: true,
        strategies,
        pairwiseMeanTurnRatios,
        bounds: {
            requiredStrategyCount: 3,
            minFloorsPerSeed: 12,
            minFloorCompletionShare: 1,
            minDeterministicReplayShare: 1,
            minSignatureConsequenceUsesPerSeed: 1,
            minRecurringSynergyFloors: 1,
            minPolicyDecisionsPerFloor: 1,
            minFavorableMatchupFloors: 1,
            minCounterMatchupFloors: 1,
            maxPairwiseMeanTurnRatio: 1.5
        },
        notes: [
            'Each sample retains one command/event trace from content claim through generated boards, routes, side rooms, milestone relics, and floor advancement.',
            'Every generated floor is replayed as an isolated checkpoint and the complete multi-floor command list is replayed from the stocked initial run.',
            'Exported strategy policies rank real route choices, side-room rewards, relics, shop items, and signature timing; every decision remains attached to its observed floor matchup.',
            'Matchup distributions are observed from shipped schedule mutators, hazards, bosses, and economy nodes; absent buckets are reported as unsampled rather than invented.',
            'Favorable and counter labels are explicit design hypotheses. The gate requires shipped exposure, completion, feedback, and replay evidence but does not misreport perfect-information outcomes as human difficulty or win-rate proof.',
            'The gate proves longer structural viability and balance envelopes for a deterministic policy solver, not final human win-rate balance.'
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
    for (const pair of report.pairwiseMeanTurnRatios) {
        if (pair.ratio > report.bounds.maxPairwiseMeanTurnRatio) {
            issues.push(`${pair.left}<->${pair.right}:meanTurnRatio=${pair.ratio}; max=${report.bounds.maxPairwiseMeanTurnRatio}`);
        }
    }
    return { ok: issues.length === 0, issues };
};
