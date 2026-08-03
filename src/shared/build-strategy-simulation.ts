import { collectDestroyEligibleTileIds } from './board-power-targeting';
import { GAME_RULES_VERSION, MAX_LIVES, type RunState, type StartingLoadoutId } from './contracts';
import {
    createGameplayBoardTurnResolveCommand,
    createGameplayDefinitionCommand,
    createGameplayDestroyPairCommand,
    createGameplayGambitCommitCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayPeekCommand,
    createGameplayShopPurchaseCommand,
    createGameplayTileFlipCommand,
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayCommand,
    type GameplayEvent,
    type GameplayFacts
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import { createNewRun } from './run-creation-rules';
import { createRunShopOffers } from './shop-rules';

export const GAMEPLAY_BUILD_STRATEGY_AXES = [
    'information',
    'control',
    'economy',
    'risk_conversion',
    'sustain_conversion'
] as const;

export type GameplayBuildStrategyAxis = (typeof GAMEPLAY_BUILD_STRATEGY_AXES)[number];
export type GameplayBuildStrategyId =
    | 'conduit_cartographer'
    | 'guard_tank'
    | 'treasure_greed'
    | 'route_gambler'
    | 'combo_shard_engine';

export interface GameplayBuildStrategyDefinition {
    id: GameplayBuildStrategyId;
    label: string;
    buildMechanicId: `build.${GameplayBuildStrategyId}`;
    startingLoadoutId: StartingLoadoutId;
    activationDefinitionIds: readonly string[];
    consequenceCommandType: GameplayCommand['type'];
    consequenceEventType: GameplayEvent['type'];
    expectedDominantAxis: GameplayBuildStrategyAxis;
}

export interface GameplayBuildStrategySeedSample {
    seed: number;
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    commands: GameplayCommand[];
    events: GameplayEvent[];
    eventTypeCounts: Record<string, number>;
    feedbackCues: string[];
    axisScores: Record<GameplayBuildStrategyAxis, number>;
    consequenceAccepted: boolean;
    replayDeterministic: boolean;
    livesRemaining: number;
    invariantViolations: string[];
}

export interface GameplayBuildStrategyMetrics {
    id: GameplayBuildStrategyId;
    label: string;
    buildMechanicId: `build.${GameplayBuildStrategyId}`;
    startingLoadoutId: StartingLoadoutId;
    activationDefinitionIds: readonly string[];
    consequenceCommandType: GameplayCommand['type'];
    consequenceEventType: GameplayEvent['type'];
    expectedDominantAxis: GameplayBuildStrategyAxis;
    dominantAxis: GameplayBuildStrategyAxis;
    axisScores: Record<GameplayBuildStrategyAxis, number>;
    axisPresence: Record<GameplayBuildStrategyAxis, boolean>;
    acceptedCommands: number;
    rejectedCommands: number;
    feedbackEvents: number;
    consequenceAcceptedSeeds: number;
    deterministicReplaySeeds: number;
    viableSeeds: number;
    viableSeedShare: number;
    samples: GameplayBuildStrategySeedSample[];
}

export interface GameplayBuildStrategyReport {
    rulesVersion: number;
    seeds: number[];
    offlineOnly: true;
    strategies: GameplayBuildStrategyMetrics[];
    pairwiseAxisDistances: Array<{
        left: GameplayBuildStrategyId;
        right: GameplayBuildStrategyId;
        distance: number;
    }>;
    bounds: {
        requiredStrategyCount: number;
        minViableSeedShare: number;
        minFeedbackEventsPerSeed: number;
        minSignatureAxisScorePerSeed: number;
        minPairwiseAxisDistance: number;
    };
    notes: string[];
}

export interface GameplayBuildStrategySimulationInput {
    seeds?: readonly number[];
    rulesVersion?: number;
    strategies?: readonly GameplayBuildStrategyId[];
}

export const GAMEPLAY_BUILD_STRATEGIES: readonly GameplayBuildStrategyDefinition[] = [
    {
        id: 'conduit_cartographer',
        label: 'Conduit Cartographer',
        buildMechanicId: 'build.conduit_cartographer',
        startingLoadoutId: 'memory_scout',
        activationDefinitionIds: [
            'bonus_reward.echo_conduit_lens',
            'reward_perk.echo_conduit_double'
        ],
        consequenceCommandType: 'board.peek',
        consequenceEventType: 'board.peeked',
        expectedDominantAxis: 'information'
    },
    {
        id: 'guard_tank',
        label: 'The Warden',
        buildMechanicId: 'build.guard_tank',
        startingLoadoutId: 'cursebreaker',
        activationDefinitionIds: [
            'bonus_reward.hazard_ward',
            'trait.volatile_heavy_guard'
        ],
        consequenceCommandType: 'board.destroy_pair',
        consequenceEventType: 'board.pair_destroyed',
        expectedDominantAxis: 'control'
    },
    {
        id: 'treasure_greed',
        label: 'The Vaultbreaker',
        buildMechanicId: 'build.treasure_greed',
        startingLoadoutId: 'vaultbreaker',
        activationDefinitionIds: [
            'bonus_reward.chest_gold',
            'bonus_reward.cursed_opener_contract',
            'reward_perk.cursed_opener_greed'
        ],
        consequenceCommandType: 'shop.purchase',
        consequenceEventType: 'shop.offer_purchased',
        expectedDominantAxis: 'economy'
    },
    {
        id: 'route_gambler',
        label: 'The Route Gambler',
        buildMechanicId: 'build.route_gambler',
        startingLoadoutId: 'route_tactician',
        activationDefinitionIds: ['relic.wager_surety'],
        consequenceCommandType: 'board.gambit_commit',
        consequenceEventType: 'board.gambit_commit.requested',
        expectedDominantAxis: 'risk_conversion'
    },
    {
        id: 'combo_shard_engine',
        label: 'The Catalyst',
        buildMechanicId: 'build.combo_shard_engine',
        startingLoadoutId: 'vaultbreaker',
        activationDefinitionIds: [
            'bonus_reward.bonus_shards',
            'relic.combo_shard_plus_step'
        ],
        consequenceCommandType: 'board.turn_resolve',
        consequenceEventType: 'board.turn_resolved',
        expectedDominantAxis: 'sustain_conversion'
    }
] as const;

const DEFAULT_BUILD_STRATEGY_SEEDS = [42_001, 42_077, 42_123] as const;

const stableJson = (value: unknown): string => JSON.stringify(value);

const emptyAxisScores = (): Record<GameplayBuildStrategyAxis, number> => ({
    information: 0,
    control: 0,
    economy: 0,
    risk_conversion: 0,
    sustain_conversion: 0
});

const increment = (counts: Record<string, number>, key: string): void => {
    counts[key] = (counts[key] ?? 0) + 1;
};

const factsForDefinition = (definitionId: string): Partial<GameplayFacts> => {
    switch (definitionId) {
        case 'reward_perk.echo_conduit_double':
            return { matchedTraits: ['echo'], adjacentTraits: ['conduit'] };
        case 'trait.volatile_heavy_guard':
            return { matchedTraits: ['volatile'], adjacentTraits: ['heavy'] };
        case 'reward_perk.cursed_opener_greed':
            return { matchedTraits: ['cursed'] };
        default:
            return {};
    }
};

const normalizeSeeds = (seeds: readonly number[] | undefined): number[] => {
    const normalized = [...new Set((seeds ?? DEFAULT_BUILD_STRATEGY_SEEDS)
        .filter(Number.isFinite)
        .map((seed) => Math.floor(seed)))];
    return normalized.length > 0 ? normalized : [...DEFAULT_BUILD_STRATEGY_SEEDS];
};

const selectedStrategies = (
    strategyIds: readonly GameplayBuildStrategyId[] | undefined
): readonly GameplayBuildStrategyDefinition[] => {
    if (!strategyIds || strategyIds.length === 0) {
        return GAMEPLAY_BUILD_STRATEGIES;
    }
    const selected = new Set(strategyIds);
    return GAMEPLAY_BUILD_STRATEGIES.filter((strategy) => selected.has(strategy.id));
};

const createStrategyInitialRun = (
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
    if (strategy.id === 'combo_shard_engine') {
        return {
            ...base,
            lives: MAX_LIVES - 1,
            stats: { ...base.stats, currentStreak: 1 }
        };
    }
    if (strategy.id !== 'treasure_greed') {
        return base;
    }
    const interlude: RunState = { ...base, status: 'levelComplete' };
    return { ...interlude, shopOffers: createRunShopOffers(interlude) };
};

const consequenceCommand = (
    strategy: GameplayBuildStrategyDefinition,
    run: RunState,
    seed: number,
    step: number
): GameplayCommand => {
    const commandId = `build:${strategy.id}:${seed}:${step}:consequence`;
    switch (strategy.id) {
        case 'conduit_cartographer': {
            const targetTileId = (run.board?.tiles ?? [])
                .filter((tile) => tile.state === 'hidden')
                .map((tile) => tile.id)
                .sort((left, right) => left.localeCompare(right))[0] ?? 'missing-peek-target';
            return createGameplayPeekCommand(commandId, targetTileId);
        }
        case 'guard_tank': {
            const targetTileId = run.board
                ? [...collectDestroyEligibleTileIds(run.board)].sort((left, right) => left.localeCompare(right))[0]
                : undefined;
            return createGameplayDestroyPairCommand(commandId, targetTileId ?? 'missing-destroy-target');
        }
        case 'treasure_greed': {
            const offerId = (Array.isArray(run.shopOffers) ? run.shopOffers : [])
                .filter((offer) => !offer.purchased && offer.compatible && offer.cost <= run.shopGold)
                .sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id))[0]?.id;
            return createGameplayShopPurchaseCommand(commandId, offerId ?? 'missing-affordable-offer');
        }
        case 'route_gambler': {
            const targetTileId = (run.board?.tiles ?? [])
                .filter((tile) => tile.state === 'hidden' && !run.board?.flippedTileIds.includes(tile.id))
                .map((tile) => tile.id)
                .sort((left, right) => left.localeCompare(right))[0];
            return createGameplayGambitCommitCommand(commandId, targetTileId ?? 'missing-gambit-target');
        }
        case 'combo_shard_engine':
            return createGameplayBoardTurnResolveCommand(commandId);
    }
};

const collectAxisScores = (events: readonly GameplayEvent[]): Record<GameplayBuildStrategyAxis, number> => {
    const scores = emptyAxisScores();
    for (const event of events) {
        if (event.type === 'inventory.changed' && event.applied !== 0) {
            if (event.itemId === 'peek_charge') scores.information += 1;
            if (
                (event.itemId === 'guard_token' || event.itemId === 'destroy_charge') &&
                event.source.id !== 'wager_surety' &&
                event.source.id !== 'bonus_shards'
            ) {
                scores.control += 1;
            }
            if (event.itemId === 'iron_key') scores.economy += 1;
            if (event.source.id === 'wager_surety') scores.risk_conversion += 1;
            if (event.itemId === 'combo_shard') scores.sustain_conversion += 1;
            if (event.source.id === 'bonus_shards') scores.sustain_conversion += 1;
        }
        if (event.type === 'board.peeked') scores.information += 1;
        if (event.type === 'board.pair_destroyed') scores.control += 1;
        if (event.type === 'currency.changed' && event.currency === 'shop_gold' && event.applied !== 0) {
            scores.economy += 1;
        }
        if (event.type === 'score.changed' && event.amount > 0) scores.economy += 1;
        if (event.type === 'shop.offer_purchased') scores.economy += 1;
        if (event.type === 'risk_wager.accepted' || event.type === 'board.gambit_commit.requested') {
            scores.risk_conversion += 1;
        }
        if (
            event.source.id === 'wager_surety' &&
            (event.type === 'relic_favor.requested' || event.type === 'featured_streak_floor.requested')
        ) {
            scores.risk_conversion += 1;
        }
        if (
            event.type === 'board.turn_resolved' &&
            event.livesAfter > event.livesBefore &&
            event.comboShardsAfter < event.comboShardsBefore
        ) {
            scores.sustain_conversion += 2;
        }
    }
    return scores;
};

const dominantAxisFor = (scores: Record<GameplayBuildStrategyAxis, number>): GameplayBuildStrategyAxis =>
    GAMEPLAY_BUILD_STRATEGY_AXES.reduce((best, axis) => scores[axis] > scores[best] ? axis : best);

const runStrategySeed = (
    strategy: GameplayBuildStrategyDefinition,
    seed: number,
    rulesVersion: number
): GameplayBuildStrategySeedSample => {
    const initialRun = createStrategyInitialRun(strategy, seed, rulesVersion);
    let run = initialRun;
    const commands: GameplayCommand[] = [];
    const events: GameplayEvent[] = [];
    const acceptedCommandIds: string[] = [];
    const rejectedCommandIds: string[] = [];
    const invariantViolations: string[] = [];

    const execute = (command: GameplayCommand): void => {
        const before = run;
        const result = reduceGameplayCommand(run, command);
        run = result.run;
        commands.push(command);
        events.push(...result.events);
        (result.accepted ? acceptedCommandIds : rejectedCommandIds).push(command.commandId);
        if (!gameplayCommandSchema.safeParse(command).success) {
            invariantViolations.push(`${command.commandId}: command failed schema validation.`);
        }
        result.events.forEach((event, sequence) => {
            if (!gameplayEventSchema.safeParse(event).success) {
                invariantViolations.push(`${command.commandId}: event ${sequence} failed schema validation.`);
            }
            if (event.commandId !== command.commandId || event.sequence !== sequence) {
                invariantViolations.push(`${command.commandId}: event ${sequence} lost deterministic ordering.`);
            }
        });
        const feedbackDiagnostic = inspectGameplayFeedbackCompleteness({
            before,
            after: result.run,
            command,
            events: result.events,
            accepted: result.accepted
        });
        if (feedbackDiagnostic) {
            invariantViolations.push(feedbackDiagnostic.message);
        }
    };

    if (run.status === 'memorize') {
        execute(createGameplayMemorizeCompleteCommand(`build:${strategy.id}:${seed}:0:memorize`));
    }
    for (const definitionId of strategy.activationDefinitionIds) {
        execute(createGameplayDefinitionCommand(
            `build:${strategy.id}:${seed}:${commands.length}:activate`,
            definitionId,
            factsForDefinition(definitionId)
        ));
    }
    if (strategy.id === 'route_gambler') {
        const candidates = (run.board?.tiles ?? [])
            .filter((tile) => tile.state === 'hidden')
            .sort((left, right) => left.id.localeCompare(right.id));
        const first = candidates[0];
        const second = first
            ? candidates.find((tile) => tile.id !== first.id && tile.pairKey !== first.pairKey)
            : null;
        if (first && second) {
            execute(createGameplayTileFlipCommand(`build:${strategy.id}:${seed}:${commands.length}:gambit-first`, first.id));
            execute(createGameplayTileFlipCommand(`build:${strategy.id}:${seed}:${commands.length}:gambit-second`, second.id));
        }
    }
    if (strategy.id === 'combo_shard_engine') {
        const candidates = (run.board?.tiles ?? [])
            .filter((tile) => tile.state === 'hidden')
            .sort((left, right) => left.id.localeCompare(right.id));
        const first = candidates[0];
        const second = first
            ? candidates.find((tile) => tile.id !== first.id && tile.pairKey === first.pairKey)
            : null;
        if (first && second) {
            execute(createGameplayTileFlipCommand(`build:${strategy.id}:${seed}:${commands.length}:convert-first`, first.id));
            execute(createGameplayTileFlipCommand(`build:${strategy.id}:${seed}:${commands.length}:convert-second`, second.id));
        }
    }
    execute(consequenceCommand(strategy, run, seed, commands.length));

    const replay = replayGameplayCommands(initialRun, commands.map((command) => JSON.parse(JSON.stringify(command))));
    const replayDeterministic =
        stableJson(replay.run) === stableJson(run) &&
        stableJson(replay.events) === stableJson(events) &&
        stableJson(replay.acceptedCommandIds) === stableJson(acceptedCommandIds) &&
        stableJson(replay.rejectedCommandIds) === stableJson(rejectedCommandIds);
    if (!replayDeterministic) {
        invariantViolations.push(`${strategy.id}@seed:${seed}: command replay diverged.`);
    }

    const eventTypeCounts: Record<string, number> = {};
    events.forEach((event) => increment(eventTypeCounts, event.type));
    const feedbackCues = events
        .filter((event): event is Extract<GameplayEvent, { type: 'feedback.requested' }> =>
            event.type === 'feedback.requested')
        .map((event) => event.cue);
    return {
        seed,
        acceptedCommandIds,
        rejectedCommandIds,
        commands,
        events,
        eventTypeCounts,
        feedbackCues,
        axisScores: collectAxisScores(events),
        consequenceAccepted: events.some((event) => event.type === strategy.consequenceEventType),
        replayDeterministic,
        livesRemaining: run.lives,
        invariantViolations
    };
};

const aggregateAxisScores = (
    samples: readonly GameplayBuildStrategySeedSample[]
): Record<GameplayBuildStrategyAxis, number> => {
    const scores = emptyAxisScores();
    for (const sample of samples) {
        for (const axis of GAMEPLAY_BUILD_STRATEGY_AXES) {
            scores[axis] += sample.axisScores[axis];
        }
    }
    return scores;
};

const axisDistance = (
    left: Record<GameplayBuildStrategyAxis, boolean>,
    right: Record<GameplayBuildStrategyAxis, boolean>
): number => GAMEPLAY_BUILD_STRATEGY_AXES.reduce(
    (distance, axis) => distance + (left[axis] === right[axis] ? 0 : 1),
    0
);

export const runGameplayBuildStrategySimulation = (
    input: GameplayBuildStrategySimulationInput = {}
): GameplayBuildStrategyReport => {
    const rulesVersion = input.rulesVersion ?? GAME_RULES_VERSION;
    const seeds = normalizeSeeds(input.seeds);
    const strategies = selectedStrategies(input.strategies).map((strategy): GameplayBuildStrategyMetrics => {
        const samples = seeds.map((seed) => runStrategySeed(strategy, seed, rulesVersion));
        const axisScores = aggregateAxisScores(samples);
        const axisPresence = Object.fromEntries(GAMEPLAY_BUILD_STRATEGY_AXES.map(
            (axis) => [axis, axisScores[axis] > 0]
        )) as Record<GameplayBuildStrategyAxis, boolean>;
        const viableSeeds = samples.filter((sample) =>
            sample.rejectedCommandIds.length === 0 &&
            sample.consequenceAccepted &&
            sample.replayDeterministic &&
            sample.livesRemaining > 0 &&
            sample.invariantViolations.length === 0 &&
            sample.feedbackCues.length >= 3 &&
            sample.axisScores[strategy.expectedDominantAxis] > 0
        ).length;
        return {
            ...strategy,
            dominantAxis: dominantAxisFor(axisScores),
            axisScores,
            axisPresence,
            acceptedCommands: samples.reduce((sum, sample) => sum + sample.acceptedCommandIds.length, 0),
            rejectedCommands: samples.reduce((sum, sample) => sum + sample.rejectedCommandIds.length, 0),
            feedbackEvents: samples.reduce((sum, sample) => sum + sample.feedbackCues.length, 0),
            consequenceAcceptedSeeds: samples.filter((sample) => sample.consequenceAccepted).length,
            deterministicReplaySeeds: samples.filter((sample) => sample.replayDeterministic).length,
            viableSeeds,
            viableSeedShare: Number((viableSeeds / Math.max(1, seeds.length)).toFixed(2)),
            samples
        };
    });
    const pairwiseAxisDistances: GameplayBuildStrategyReport['pairwiseAxisDistances'] = [];
    for (let leftIndex = 0; leftIndex < strategies.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < strategies.length; rightIndex += 1) {
            const left = strategies[leftIndex];
            const right = strategies[rightIndex];
            pairwiseAxisDistances.push({
                left: left.id,
                right: right.id,
                distance: axisDistance(left.axisPresence, right.axisPresence)
            });
        }
    }
    return {
        rulesVersion,
        seeds,
        offlineOnly: true,
        strategies,
        pairwiseAxisDistances,
        bounds: {
            requiredStrategyCount: 5,
            minViableSeedShare: 1,
            minFeedbackEventsPerSeed: 3,
            minSignatureAxisScorePerSeed: 1,
            minPairwiseAxisDistance: 2
        },
        notes: [
            'Each strategy starts from a shipped loadout, activates schema-validated content, and spends its payoff through the authoritative gameplay reducer.',
            'Viability means every sampled seed accepts the complete command chain, keeps the run alive, emits typed feedback, and replays exactly.',
            'Distinctness is measured from typed event fingerprints for information, control, economy, risk conversion, and shard-to-life sustain consequences rather than build labels.',
            'This is a deterministic structural viability gate, not a claim that final balance or long-run win rates are complete.'
        ]
    };
};

export const assertGameplayBuildStrategiesViable = (
    report: GameplayBuildStrategyReport
): { ok: boolean; issues: string[] } => {
    const issues: string[] = [];
    if (report.strategies.length < report.bounds.requiredStrategyCount) {
        issues.push(`strategies=${report.strategies.length}; required=${report.bounds.requiredStrategyCount}`);
    }
    const dominantAxes = new Set<GameplayBuildStrategyAxis>();
    for (const strategy of report.strategies) {
        const context = `${strategy.id}@seeds:${report.seeds.join(',')}`;
        dominantAxes.add(strategy.dominantAxis);
        if (strategy.dominantAxis !== strategy.expectedDominantAxis) {
            issues.push(`${context}:dominantAxis=${strategy.dominantAxis}; expected=${strategy.expectedDominantAxis}`);
        }
        if (strategy.viableSeedShare < report.bounds.minViableSeedShare) {
            issues.push(`${context}:viableSeedShare=${strategy.viableSeedShare}; required=${report.bounds.minViableSeedShare}`);
        }
        if (strategy.rejectedCommands > 0) {
            issues.push(`${context}:rejectedCommands=${strategy.rejectedCommands}`);
        }
        for (const sample of strategy.samples) {
            const sampleContext = `${strategy.id}@seed:${sample.seed}`;
            if (!sample.consequenceAccepted) issues.push(`${sampleContext}:missing ${strategy.consequenceEventType}`);
            if (!sample.replayDeterministic) issues.push(`${sampleContext}:replay diverged`);
            if (sample.livesRemaining <= 0) issues.push(`${sampleContext}:livesRemaining=${sample.livesRemaining}`);
            if (sample.feedbackCues.length < report.bounds.minFeedbackEventsPerSeed) {
                issues.push(`${sampleContext}:feedbackEvents=${sample.feedbackCues.length}; required=${report.bounds.minFeedbackEventsPerSeed}`);
            }
            if (sample.axisScores[strategy.expectedDominantAxis] < report.bounds.minSignatureAxisScorePerSeed) {
                issues.push(`${sampleContext}:${strategy.expectedDominantAxis}Score=${sample.axisScores[strategy.expectedDominantAxis]}; required=${report.bounds.minSignatureAxisScorePerSeed}`);
            }
            issues.push(...sample.invariantViolations.map((issue) => `${sampleContext}:${issue}`));
        }
    }
    if (dominantAxes.size < Math.min(report.bounds.requiredStrategyCount, report.strategies.length)) {
        issues.push(`dominantAxes=${[...dominantAxes].join(',')}; expected distinct axes for each retained strategy`);
    }
    for (const pair of report.pairwiseAxisDistances) {
        if (pair.distance < report.bounds.minPairwiseAxisDistance) {
            issues.push(`${pair.left}<->${pair.right}:axisDistance=${pair.distance}; required=${report.bounds.minPairwiseAxisDistance}`);
        }
    }
    return { ok: issues.length === 0, issues };
};
