import type { RunState } from './contracts';
import { collectDestroyEligibleTileIds, tileIsStrayEligiblePreview } from './board-power-targeting';
import {
    GAMEPLAY_CONTENT_DEFINITIONS,
    createGameplayDefinitionCommand,
    createGameplayDestroyPairCommand,
    createGameplayDungeonExitActivateCommand,
    createGameplayFlashPairCommand,
    createGameplayGambitCommitCommand,
    createGameplayHazardBanishCommand,
    createGameplayPeekCommand,
    createGameplayPinToggleCommand,
    createGameplayRegionShuffleCommand,
    createGameplayRiskWagerAcceptCommand,
    createGameplayRouteChooseCommand,
    createGameplayShuffleCommand,
    createGameplayShopPurchaseCommand,
    createGameplayStrayRemoveCommand,
    createGameplayTileSwapCommand,
    createGameplayUndoResolveCommand,
    createGameplayWildMatchConsumeCommand,
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { RUN_INVENTORY_ITEM_IDS, getRunInventoryItemQuantity } from './run-inventory';
import { createMulberry32, pickRngIndex } from './rng';
import { tilesArePairMatch } from './scoring-rules';
import { WILD_PAIR_KEY } from './tile-identity';

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
    eventTypeCounts: Record<string, number>;
    replayDeterministic: boolean;
    invariantViolations: string[];
}

const boundedChance = (value: number | undefined, fallback: number): number =>
    Number.isFinite(value) ? Math.min(1, Math.max(0, value ?? fallback)) : fallback;

const positiveStepCount = (value: number): number =>
    Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

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

const commandForStep = (
    run: RunState,
    rng: () => number,
    seed: number,
    step: number,
    invalidTraitChance: number
): GameplayCommand => {
    const definitions = GAMEPLAY_CONTENT_DEFINITIONS;
    const commandId = `sim:${seed}:${String(step).padStart(4, '0')}`;
    const actionIndex = pickRngIndex(rng, definitions.length + 12);
    const wildMatchPair = step === 0 ? availableWildMatchPair(run) : null;
    if (wildMatchPair) {
        return createGameplayWildMatchConsumeCommand(
            commandId,
            wildMatchPair.wildTileId,
            wildMatchPair.pairedTileId
        );
    }
    if (step === 1) {
        const targets = run.board
            ? [...collectDestroyEligibleTileIds(run.board)].sort((left, right) => left.localeCompare(right))
            : [];
        const target = targets[pickRngIndex(rng, targets.length)] ?? 'missing-destroy-target';
        return createGameplayDestroyPairCommand(commandId, target);
    }
    if (step === 2) {
        return createGameplayHazardBanishCommand(commandId);
    }
    if (step === 3) {
        const choiceId = Array.isArray(run.lastLevelResult?.routeChoices)
            ? run.lastLevelResult.routeChoices[0]?.id
            : undefined;
        return createGameplayRouteChooseCommand(commandId, choiceId ?? 'missing-route-choice');
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
    const eventTypeCounts: Record<string, number> = {};
    const invariantViolations: string[] = [];

    for (let step = 0; step < steps; step += 1) {
        const command = commandForStep(run, rng, options.seed, step, invalidTraitChance);
        const result = reduceGameplayCommand(run, command);
        commands.push(command);
        events.push(...result.events);
        incrementCount(commandTypeCounts, command.type === 'effects.apply' ? command.definitionId : command.type);
        result.events.forEach((event) => incrementCount(eventTypeCounts, event.type));
        (result.accepted ? acceptedCommandIds : rejectedCommandIds).push(command.commandId);
        run = result.run;
        collectStepInvariants(initialRun, run, command, result.events, result.accepted, step, invariantViolations);
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
        eventTypeCounts,
        replayDeterministic,
        invariantViolations
    };
};
