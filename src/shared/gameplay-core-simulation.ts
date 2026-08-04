import type { AchievementId, RunState } from './contracts';
import { collectDestroyEligibleTileIds, tileIsStrayEligiblePreview } from './board-power-targeting';
import {
    GAMEPLAY_CONTENT_DEFINITIONS,
    createGameplayBoardTurnResolveCommand,
    createGameplayDefinitionCommand,
    createGameplayDebugRevealActivateCommand,
    createGameplayDebugRevealDeactivateCommand,
    createGameplayDestroyPairCommand,
    createGameplayDungeonExitActivateCommand,
    createGameplayEnemyHazardContactCommand,
    createGameplayFlashPairCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayGauntletExpireCommand,
    createGameplayGambitCommitCommand,
    createGameplayHazardBanishCommand,
    createGameplayInterludeTerminalResolveCommand,
    createGameplayRunFinalizeCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayPauseCommand,
    createGameplayPeekCommand,
    createGameplayPinToggleCommand,
    createGameplayProgressionRepairCommand,
    createGameplayRegionShuffleCommand,
    createGameplayRiskWagerAcceptCommand,
    createGameplayRelicOfferOpenCommand,
    createGameplayRelicPickCommand,
    createGameplayRelicOfferServiceCommand,
    createGameplayResumeCommand,
    createGameplayRouteChooseCommand,
    createGameplaySideRoomResolveCommand,
    createGameplayShuffleCommand,
    createGameplayShopPurchaseCommand,
    createGameplayShopRerollCommand,
    createGameplayStrayRemoveCommand,
    createGameplayTileFlipCommand,
    createGameplayTileSwapCommand,
    createGameplayUndoResolveCommand,
    createGameplayWildMatchConsumeCommand,
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import { RUN_INVENTORY_ITEM_IDS, getRunInventoryItemQuantity } from './run-inventory';
import { createMulberry32, pickRngIndex } from './rng';
import { tilesArePairMatch } from './scoring-rules';
import { purchaseShopOffer } from './shop-rules';
import { WILD_PAIR_KEY } from './tile-identity';
import { normalizeRunSummary } from './save-data';

export interface GameplayCoreSimulationOptions {
    seed: number;
    steps: number;
    invalidTraitChance?: number;
}

export interface GameplayCoreSimulationReport {
    seed: number;
    requestedSteps: number;
    commands: GameplayCommand[];
    events: GameplayEvent[];
    finalRun: RunState;
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    commandTypeCounts: Record<string, number>;
    acceptedCommandTypeCounts: Record<string, number>;
    rejectedCommandTypeCounts: Record<string, number>;
    eventTypeCounts: Record<string, number>;
    replayDeterministic: boolean;
    invariantViolations: string[];
}

export interface GameplayProgressionRepairSimulationReport {
    command: GameplayCommand;
    events: GameplayEvent[];
    finalRun: RunState;
    accepted: boolean;
    replayDeterministic: boolean;
    invariantViolations: string[];
}

export interface GameplayInterludeTerminalSimulationReport {
    command: GameplayCommand;
    events: GameplayEvent[];
    finalRun: RunState;
    accepted: boolean;
    replayDeterministic: boolean;
    invariantViolations: string[];
}

export interface GameplayRunFinalizationSimulationReport {
    command: GameplayCommand;
    events: GameplayEvent[];
    finalRun: RunState;
    accepted: boolean;
    replayDeterministic: boolean;
    invariantViolations: string[];
}

const boundedChance = (value: number | undefined, fallback: number): number =>
    Number.isFinite(value) ? Math.min(1, Math.max(0, value ?? fallback)) : fallback;

const positiveStepCount = (value: number): number =>
    Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const timerRemainingMs = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : null;

const incrementCount = (counts: Record<string, number>, key: string): void => {
    counts[key] = (counts[key] ?? 0) + 1;
};

const stableJson = (value: unknown): string => JSON.stringify(value);

const availablePeekTargets = (run: RunState): string[] => {
    const alreadyRevealed = new Set(Array.isArray(run.peekRevealedTileIds) ? run.peekRevealedTileIds : []);
    return (run.board?.tiles ?? [])
        .filter((tile) => tile.state === 'hidden' && !alreadyRevealed.has(tile.id))
        .map((tile) => tile.id)
        .sort((left, right) => left.localeCompare(right));
};

const availableStrayTargets = (run: RunState): string[] => {
    const board = run.board;
    return board
        ? board.tiles
              .filter((tile) => tileIsStrayEligiblePreview(board, tile.id))
              .map((tile) => tile.id)
              .sort((left, right) => left.localeCompare(right))
        : [];
};

const availableMatchingFlipTarget = (run: RunState): string | null => {
    const board = run.board;
    if (!board) {
        return null;
    }
    const flipped = board.tiles.find((tile) => tile.state === 'flipped' && tile.pairKey !== WILD_PAIR_KEY);
    return board.tiles
        .filter((tile) => tile.state === 'hidden' && tile.pairKey === flipped?.pairKey)
        .map((tile) => tile.id)
        .sort((left, right) => left.localeCompare(right))[0] ?? null;
};

const availableShopPurchaseTarget = (run: RunState): string | null => {
    const offers = Array.isArray(run.shopOffers) ? run.shopOffers : [];
    return (
        offers.find(
            (offer) =>
                offer.itemId !== 'heal_life' &&
                purchaseShopOffer(run, offer.id) !== run
        ) ?? offers.find((offer) => purchaseShopOffer(run, offer.id) !== run)
    )?.id ?? null;
};

const availableWildMatchPair = (run: RunState): { wildTileId: string; pairedTileId: string } | null => {
    if (getRunInventoryItemQuantity(run, 'wild_match_token') <= 0) {
        return null;
    }
    const flippedTiles = (run.board?.tiles ?? []).filter((tile) => tile.state === 'flipped');
    const wildTile = flippedTiles.find((tile) => tile.pairKey === WILD_PAIR_KEY);
    const pairedTile = flippedTiles.find((tile) => tile.id !== wildTile?.id && tile.pairKey !== WILD_PAIR_KEY);
    return wildTile && pairedTile && tilesArePairMatch(wildTile, pairedTile)
        ? { wildTileId: wildTile.id, pairedTileId: pairedTile.id }
        : null;
};

const availableHiddenWildTile = (run: RunState): string | null =>
    (run.board?.tiles ?? [])
        .filter((tile) => tile.state === 'hidden' && tile.pairKey === WILD_PAIR_KEY)
        .map((tile) => tile.id)
        .sort((left, right) => left.localeCompare(right))[0] ?? null;

const availableHiddenWildPartner = (run: RunState): string | null => {
    const hidden = (run.board?.tiles ?? []).filter(
        (tile) => tile.state === 'hidden' && tile.pairKey !== WILD_PAIR_KEY
    );
    const singletonTargets = hidden
        .filter((tile) => hidden.filter((candidate) => candidate.pairKey === tile.pairKey).length === 1)
        .map((tile) => tile.id)
        .sort((left, right) => left.localeCompare(right));
    return singletonTargets[0] ?? hidden.map((tile) => tile.id).sort((left, right) => left.localeCompare(right))[0] ?? null;
};

const commandForStep = (
    run: RunState,
    rng: () => number,
    seed: number,
    step: number,
    invalidTraitChance: number
): GameplayCommand => {
    const definitions = GAMEPLAY_CONTENT_DEFINITIONS.filter(
        (definition) => definition.id !== 'relic.shrine_echo.treasure_claim'
    );
    const commandId = `sim:${seed}:${String(step).padStart(4, '0')}`;
    const actionIndex = pickRngIndex(rng, definitions.length + 12);
    if (step === 0) {
        return createGameplayMemorizeCompleteCommand(commandId);
    }
    if (step === 1) {
        return createGameplayTileFlipCommand(
            commandId,
            availableHiddenWildPartner(run) ?? 'missing-wild-partner'
        );
    }
    if (step === 2) {
        return createGameplayTileFlipCommand(
            commandId,
            availableHiddenWildTile(run) ?? 'missing-wild-tile'
        );
    }
    if (step === 3) {
        return createGameplayBoardTurnResolveCommand(commandId);
    }
    const wildMatchPair = step === 4 ? availableWildMatchPair(run) : null;
    if (step === 4) {
        return createGameplayWildMatchConsumeCommand(
            commandId,
            wildMatchPair?.wildTileId ?? 'missing-wild-tile',
            wildMatchPair?.pairedTileId ?? 'missing-wild-pair'
        );
    }
    if (step === 5) {
        const target = availablePeekTargets(run)[0] ?? 'missing-flip-target';
        return createGameplayTileFlipCommand(commandId, target);
    }
    if (step === 6) {
        return createGameplayTileFlipCommand(
            commandId,
            availableMatchingFlipTarget(run) ?? 'missing-matching-flip-target'
        );
    }
    if (step === 7) {
        return createGameplayBoardTurnResolveCommand(commandId);
    }
    if (step === 8) {
        const target = availablePeekTargets(run)[0] ?? 'missing-flip-target';
        return createGameplayTileFlipCommand(commandId, target);
    }
    if (step === 9) {
        return createGameplayTileFlipCommand(
            commandId,
            availableMatchingFlipTarget(run) ?? 'missing-matching-flip-target'
        );
    }
    if (step === 10) {
        return createGameplayBoardTurnResolveCommand(commandId);
    }
    if (step === 11) {
        const choiceId = Array.isArray(run.lastLevelResult?.routeChoices)
            ? run.lastLevelResult.routeChoices[0]?.id
            : undefined;
        return createGameplayRouteChooseCommand(commandId, choiceId ?? 'missing-route-choice');
    }
    if (step === 12) {
        return createGameplaySideRoomResolveCommand(commandId, 'skip');
    }
    if (step === 13) {
        return createGameplayShopPurchaseCommand(
            commandId,
            availableShopPurchaseTarget(run) ?? 'missing-shop-offer'
        );
    }
    if (step === 14) {
        return createGameplayShopRerollCommand(commandId);
    }
    if (step === 15) {
        return createGameplayRelicOfferOpenCommand(commandId);
    }
    if (step === 16) {
        return createGameplayRelicOfferServiceCommand(commandId, 'reroll_offer');
    }
    if (step === 17) {
        const relicId = Array.isArray(run.relicOffer?.options)
            ? run.relicOffer.options[0]
            : undefined;
        return createGameplayRelicPickCommand(commandId, relicId ?? 'extra_shuffle_charge');
    }
    if (step === 18) {
        return createGameplayFloorAdvanceCommand(commandId);
    }
    if (step === 19) {
        return createGameplayEnemyHazardContactCommand(commandId, 'missing-enemy-contact', true);
    }
    if (step === 20) {
        const targets = run.board
            ? [...collectDestroyEligibleTileIds(run.board)].sort((left, right) => left.localeCompare(right))
            : [];
        const target = targets[pickRngIndex(rng, targets.length)] ?? 'missing-destroy-target';
        return createGameplayDestroyPairCommand(commandId, target);
    }
    if (step === 21) {
        return createGameplayHazardBanishCommand(commandId);
    }
    if (step === 22 && run.gameMode === 'gauntlet') {
        const deadlineMs = typeof run.gauntletDeadlineMs === 'number' && Number.isFinite(run.gauntletDeadlineMs)
            ? Math.max(0, Math.floor(run.gauntletDeadlineMs))
            : 0;
        return createGameplayGauntletExpireCommand(commandId, deadlineMs + 1);
    }
    if (step === 23) {
        return createGameplayPauseCommand(commandId, 100_023, {
            memorizeRemainingMs: timerRemainingMs(run.timerState?.memorizeRemainingMs),
            resolveRemainingMs: timerRemainingMs(run.timerState?.resolveRemainingMs),
            debugRevealRemainingMs: timerRemainingMs(run.timerState?.debugRevealRemainingMs)
        });
    }
    if (step === 24) {
        return createGameplayResumeCommand(commandId, 100_524);
    }
    if (step === 25) {
        return createGameplayMemorizeCompleteCommand(commandId);
    }
    if (step === 26) {
        return createGameplayDebugRevealActivateCommand(commandId, true);
    }
    if (step === 27) {
        return createGameplayDebugRevealDeactivateCommand(commandId, 'timer_elapsed');
    }
    if (actionIndex === definitions.length) {
        const targets = availablePeekTargets(run);
        const target = targets[pickRngIndex(rng, targets.length)];
        if (target) {
            return createGameplayPeekCommand(commandId, target);
        }
    }
    if (actionIndex === definitions.length + 1) {
        const targets = availablePeekTargets(run);
        const target = targets[pickRngIndex(rng, targets.length)];
        if (target) {
            return createGameplayPinToggleCommand(commandId, target);
        }
    }
    if (actionIndex === definitions.length + 2) {
        const targets = availableStrayTargets(run);
        const target = targets[pickRngIndex(rng, targets.length)] ?? 'missing-stray-target';
        return createGameplayStrayRemoveCommand(commandId, target);
    }
    if (actionIndex === definitions.length + 3) {
        return createGameplayRiskWagerAcceptCommand(commandId);
    }
    if (actionIndex === definitions.length + 4) {
        const targets = availablePeekTargets(run);
        const target = targets[pickRngIndex(rng, targets.length)] ?? 'missing-gambit-target';
        return createGameplayGambitCommitCommand(commandId, target);
    }
    if (actionIndex === definitions.length + 5) {
        return createGameplayShuffleCommand(commandId);
    }
    if (actionIndex === definitions.length + 6) {
        const rowCount = Math.max(1, run.board?.rows ?? 1);
        return createGameplayRegionShuffleCommand(commandId, pickRngIndex(rng, rowCount));
    }
    if (actionIndex === definitions.length + 7) {
        const targets = availablePeekTargets(run);
        const firstTileId = targets[pickRngIndex(rng, targets.length)] ?? 'missing-swap-first';
        const remaining = targets.filter((target) => target !== firstTileId);
        const secondTileId = remaining[pickRngIndex(rng, remaining.length)] ?? 'missing-swap-second';
        return createGameplayTileSwapCommand(commandId, firstTileId, secondTileId);
    }
    if (actionIndex === definitions.length + 8) {
        return createGameplayFlashPairCommand(commandId);
    }
    if (actionIndex === definitions.length + 9) {
        return createGameplayUndoResolveCommand(commandId);
    }
    if (actionIndex === definitions.length + 10) {
        const offerId = (Array.isArray(run.shopOffers) ? run.shopOffers : [])[0]?.id ?? 'missing-shop-offer';
        return createGameplayShopPurchaseCommand(commandId, offerId);
    }
    if (actionIndex === definitions.length + 11) {
        return createGameplayDungeonExitActivateCommand(commandId, 'master_key');
    }
    const definition = definitions[actionIndex % definitions.length] ?? definitions[0];
    if (definition.trigger === 'trait.match') {
        const invalid = rng() < invalidTraitChance;
        const matchedTraits = definition.conditions
            .filter((condition) => condition.kind === 'trait.matched')
            .map((condition) => condition.trait);
        if (
            matchedTraits.length === 0 &&
            definition.conditions.some((condition) => condition.kind === 'trait.any_matched')
        ) {
            matchedTraits.push('echo');
        }
        const adjacentTraits = definition.conditions
            .filter((condition) => condition.kind === 'trait.adjacent')
            .map((condition) => condition.trait);
        return createGameplayDefinitionCommand(commandId, definition.id, {
            matchedTraits,
            adjacentTraits: invalid ? [] : adjacentTraits
        });
    }
    if (definition.trigger === 'findable.match') {
        const matchedFindables = definition.conditions
            .filter((condition) => condition.kind === 'findable.matched')
            .map((condition) => condition.findable);
        return createGameplayDefinitionCommand(commandId, definition.id, { matchedFindables });
    }
    if (definition.trigger === 'floor.cleared') {
        const riskWagerOutcome = definition.conditions.find(
            (condition) => condition.kind === 'risk_wager.outcome_is'
        );
        return createGameplayDefinitionCommand(commandId, definition.id, {
            bossTrophyClaimed: definition.conditions.some((condition) => condition.kind === 'boss_trophy.claimed'),
            riskWagerOutcome: riskWagerOutcome?.kind === 'risk_wager.outcome_is' ? riskWagerOutcome.outcome : 'none',
            featuredObjectiveCompleted: definition.conditions.some(
                (condition) => condition.kind === 'featured_objective.completed'
            ),
            scoreParasiteActive: definition.conditions.some((condition) => condition.kind === 'score_parasite.active')
        });
    }
    return createGameplayDefinitionCommand(commandId, definition.id);
};

const collectStepInvariants = (
    initialRun: RunState,
    previousRun: RunState,
    run: RunState,
    command: GameplayCommand,
    events: GameplayEvent[],
    accepted: boolean,
    step: number,
    violations: string[]
): void => {
    const prefix = `step ${step}`;
    if (!gameplayCommandSchema.safeParse(command).success) {
        violations.push(`${prefix}: generated command failed its schema.`);
    }
    events.forEach((event, sequence) => {
        if (!gameplayEventSchema.safeParse(event).success) {
            violations.push(`${prefix}: event ${sequence} failed its schema.`);
        }
        if (event.commandId !== command.commandId || event.sequence !== sequence || event.eventId !== `${command.commandId}:${sequence}`) {
            violations.push(`${prefix}: event ${sequence} lost deterministic identity or ordering.`);
        }
    });
    if (accepted === events.some((event) => event.type === 'command.rejected')) {
        violations.push(`${prefix}: acceptance state disagrees with rejection events.`);
    }
    for (const itemId of RUN_INVENTORY_ITEM_IDS) {
        const quantity = getRunInventoryItemQuantity(run, itemId);
        if (!Number.isInteger(quantity) || quantity < 0) {
            violations.push(`${prefix}: ${itemId} quantity is invalid (${quantity}).`);
        }
    }
    if (run.runSeed !== initialRun.runSeed || run.runRulesVersion !== initialRun.runRulesVersion) {
        violations.push(`${prefix}: command changed deterministic run identity.`);
    }
    const feedbackDiagnostic = inspectGameplayFeedbackCompleteness({
        before: previousRun,
        after: run,
        command,
        events,
        accepted
    });
    if (feedbackDiagnostic) {
        violations.push(`${prefix}: ${feedbackDiagnostic.message}`);
    }
};

export const runGameplayCoreSimulation = (
    initialRun: RunState,
    options: GameplayCoreSimulationOptions
): GameplayCoreSimulationReport => {
    const steps = positiveStepCount(options.steps);
    const invalidTraitChance = boundedChance(options.invalidTraitChance, 0.2);
    const rng = createMulberry32(options.seed);
    let run = initialRun;
    const commands: GameplayCommand[] = [];
    const events: GameplayEvent[] = [];
    const acceptedCommandIds: string[] = [];
    const rejectedCommandIds: string[] = [];
    const commandTypeCounts: Record<string, number> = {};
    const acceptedCommandTypeCounts: Record<string, number> = {};
    const rejectedCommandTypeCounts: Record<string, number> = {};
    const eventTypeCounts: Record<string, number> = {};
    const invariantViolations: string[] = [];

    for (let step = 0; step < steps; step += 1) {
        const previousRun = run;
        const command = commandForStep(run, rng, options.seed, step, invalidTraitChance);
        const result = reduceGameplayCommand(run, command);
        commands.push(command);
        events.push(...result.events);
        const commandType = command.type === 'effects.apply' ? command.definitionId : command.type;
        incrementCount(commandTypeCounts, commandType);
        incrementCount(result.accepted ? acceptedCommandTypeCounts : rejectedCommandTypeCounts, commandType);
        result.events.forEach((event) => incrementCount(eventTypeCounts, event.type));
        (result.accepted ? acceptedCommandIds : rejectedCommandIds).push(command.commandId);
        run = result.run;
        collectStepInvariants(
            initialRun,
            previousRun,
            run,
            command,
            result.events,
            result.accepted,
            step,
            invariantViolations
        );
    }

    const replay = replayGameplayCommands(initialRun, JSON.parse(stableJson(commands)) as unknown[]);
    const replayDeterministic =
        stableJson(replay.run) === stableJson(run) &&
        stableJson(replay.events) === stableJson(events) &&
        stableJson(replay.acceptedCommandIds) === stableJson(acceptedCommandIds) &&
        stableJson(replay.rejectedCommandIds) === stableJson(rejectedCommandIds);
    if (!replayDeterministic) {
        invariantViolations.push('JSON-round-tripped replay diverged from the seeded simulation.');
    }

    return {
        seed: options.seed,
        requestedSteps: steps,
        commands,
        events,
        finalRun: run,
        acceptedCommandIds,
        rejectedCommandIds,
        commandTypeCounts,
        acceptedCommandTypeCounts,
        rejectedCommandTypeCounts,
        eventTypeCounts,
        replayDeterministic,
        invariantViolations
    };
};

export const runGameplayProgressionRepairSimulation = (
    initialRun: RunState
): GameplayProgressionRepairSimulationReport => {
    const command = createGameplayProgressionRepairCommand(
        `sim-repair:${initialRun.runSeed}:${initialRun.board?.level ?? 0}`
    );
    const result = reduceGameplayCommand(initialRun, command);
    const invariantViolations: string[] = [];
    if (!gameplayCommandSchema.safeParse(command).success) {
        invariantViolations.push('Progression repair command failed its schema.');
    }
    result.events.forEach((event, sequence) => {
        if (!gameplayEventSchema.safeParse(event).success) {
            invariantViolations.push(`Progression repair event ${sequence} failed its schema.`);
        }
        if (
            event.commandId !== command.commandId ||
            event.sequence !== sequence ||
            event.eventId !== `${command.commandId}:${sequence}`
        ) {
            invariantViolations.push(`Progression repair event ${sequence} lost deterministic identity or ordering.`);
        }
    });
    if (!result.accepted) {
        invariantViolations.push('Progression repair fixture was rejected.');
    }
    if (!result.events.some((event) => event.type === 'run.progression_repaired')) {
        invariantViolations.push('Progression repair fixture emitted no repair event.');
    }
    const replay = replayGameplayCommands(initialRun, [JSON.parse(stableJson(command))]);
    const replayDeterministic =
        stableJson(replay.run) === stableJson(result.run) &&
        stableJson(replay.events) === stableJson(result.events) &&
        stableJson(replay.acceptedCommandIds) === stableJson(result.accepted ? [command.commandId] : []) &&
        stableJson(replay.rejectedCommandIds) === stableJson(result.accepted ? [] : [command.commandId]);
    if (!replayDeterministic) {
        invariantViolations.push('Progression repair replay diverged after JSON serialization.');
    }
    return {
        command,
        events: result.events,
        finalRun: result.run,
        accepted: result.accepted,
        replayDeterministic,
        invariantViolations
    };
};

export const runGameplayInterludeTerminalSimulation = (
    initialRun: RunState
): GameplayInterludeTerminalSimulationReport => {
    const command = createGameplayInterludeTerminalResolveCommand(
        `sim-interlude-terminal:${initialRun.runSeed}:${initialRun.board?.level ?? 0}`
    );
    const result = reduceGameplayCommand(initialRun, command);
    const invariantViolations: string[] = [];
    if (!gameplayCommandSchema.safeParse(command).success) {
        invariantViolations.push('Interlude terminal command failed its schema.');
    }
    result.events.forEach((event, sequence) => {
        if (!gameplayEventSchema.safeParse(event).success) {
            invariantViolations.push(`Interlude terminal event ${sequence} failed its schema.`);
        }
        if (
            event.commandId !== command.commandId ||
            event.sequence !== sequence ||
            event.eventId !== `${command.commandId}:${sequence}`
        ) {
            invariantViolations.push(`Interlude terminal event ${sequence} lost deterministic identity or ordering.`);
        }
    });
    if (!result.accepted) {
        invariantViolations.push('Dead interlude terminal fixture was rejected.');
    }
    if (!result.events.some((event) => event.type === 'run.interlude_terminal_resolved')) {
        invariantViolations.push('Dead interlude terminal fixture emitted no terminal event.');
    }
    if (!result.events.some((event) => event.type === 'feedback.requested')) {
        invariantViolations.push('Dead interlude terminal fixture emitted no typed feedback.');
    }
    if (
        result.run.status !== 'gameOver' ||
        result.run.lives !== 0 ||
        result.run.pendingRouteCardPlan != null ||
        result.run.sideRoom != null ||
        result.run.relicOffer != null ||
        result.run.shopOffers.length > 0
    ) {
        invariantViolations.push('Dead interlude terminal fixture retained non-terminal run state.');
    }
    const feedbackDiagnostic = inspectGameplayFeedbackCompleteness({
        before: initialRun,
        after: result.run,
        command,
        events: result.events,
        accepted: result.accepted
    });
    if (feedbackDiagnostic) {
        invariantViolations.push(feedbackDiagnostic.message);
    }
    const replay = replayGameplayCommands(initialRun, [JSON.parse(stableJson(command))]);
    const replayDeterministic =
        stableJson(replay.run) === stableJson(result.run) &&
        stableJson(replay.events) === stableJson(result.events) &&
        stableJson(replay.acceptedCommandIds) === stableJson(result.accepted ? [command.commandId] : []) &&
        stableJson(replay.rejectedCommandIds) === stableJson(result.accepted ? [] : [command.commandId]);
    if (!replayDeterministic) {
        invariantViolations.push('Interlude terminal replay diverged after JSON serialization.');
    }
    return {
        command,
        events: result.events,
        finalRun: result.run,
        accepted: result.accepted,
        replayDeterministic,
        invariantViolations
    };
};

export const runGameplayRunFinalizationSimulation = (
    initialRun: RunState,
    unlockedAchievements: readonly AchievementId[] = ['ACH_FIRST_CLEAR']
): GameplayRunFinalizationSimulationReport => {
    const command = createGameplayRunFinalizeCommand(
        `sim-run-finalize:${initialRun.runSeed}:${initialRun.board?.level ?? 0}`,
        unlockedAchievements
    );
    const result = reduceGameplayCommand(initialRun, command);
    const invariantViolations: string[] = [];
    if (!gameplayCommandSchema.safeParse(command).success) {
        invariantViolations.push('Run finalization command failed its schema.');
    }
    result.events.forEach((event, sequence) => {
        if (!gameplayEventSchema.safeParse(event).success) {
            invariantViolations.push(`Run finalization event ${sequence} failed its schema.`);
        }
        if (
            event.commandId !== command.commandId ||
            event.sequence !== sequence ||
            event.eventId !== `${command.commandId}:${sequence}`
        ) {
            invariantViolations.push(`Run finalization event ${sequence} lost deterministic identity or ordering.`);
        }
    });
    if (!result.accepted) {
        invariantViolations.push('Terminal run finalization fixture was rejected.');
    }
    const finalizationEvent = result.events.find(
        (event): event is Extract<GameplayEvent, { type: 'run.finalized' }> =>
            event.type === 'run.finalized'
    );
    if (!finalizationEvent) {
        invariantViolations.push('Terminal run finalization fixture emitted no finalization event.');
    }
    const summary = result.run.lastRunSummary;
    if (
        result.run.status !== 'gameOver' ||
        result.run.lives !== 0 ||
        !summary ||
        stableJson(summary.unlockedAchievements) !== stableJson(unlockedAchievements) ||
        stableJson(normalizeRunSummary(summary)) !== stableJson(summary)
    ) {
        invariantViolations.push('Terminal run finalization fixture did not create the expected validated summary.');
    }
    if (
        finalizationEvent &&
        summary &&
        (
            finalizationEvent.totalScore !== summary.totalScore ||
            finalizationEvent.levelsCleared !== summary.levelsCleared ||
            finalizationEvent.highestLevel !== summary.highestLevel ||
            stableJson(finalizationEvent.unlockedAchievements) !== stableJson(summary.unlockedAchievements)
        )
    ) {
        invariantViolations.push('Run finalization event diverged from the validated summary.');
    }
    const replay = replayGameplayCommands(initialRun, [JSON.parse(stableJson(command))]);
    const replayDeterministic =
        stableJson(replay.run) === stableJson(result.run) &&
        stableJson(replay.events) === stableJson(result.events) &&
        stableJson(replay.acceptedCommandIds) === stableJson(result.accepted ? [command.commandId] : []) &&
        stableJson(replay.rejectedCommandIds) === stableJson(result.accepted ? [] : [command.commandId]);
    if (!replayDeterministic) {
        invariantViolations.push('Run finalization replay diverged after JSON serialization.');
    }
    return {
        command,
        events: result.events,
        finalRun: result.run,
        accepted: result.accepted,
        replayDeterministic,
        invariantViolations
    };
};
