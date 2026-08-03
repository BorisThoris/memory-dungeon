import type { RunState, Tile } from './contracts';
import { chooseDungeonExitActivationSpend } from './dungeon-exit-rules';
import { getDungeonExitStatus } from './dungeon-board-status';
import {
    createGameplayBoardTurnResolveCommand,
    createGameplayDungeonExitActivateCommand,
    createGameplayGambitCommitCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayProgressionRepairCommand,
    createGameplayTileFlipCommand,
    gameplayCommandSchema,
    gameplayEventSchema,
    type GameplayCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import {
    getPrimaryPlaythroughExitTile,
    getUnresolvedPlayablePairGroups,
    type PlaythroughSolverStopReason,
    type PlaythroughSolverTrace
} from './playthrough-solver-rules';
import { createRunProgressionRepairTransition } from './run-progression-repair';
import { RUN_INVENTORY_ITEM_IDS, getRunInventoryItemQuantity } from './run-inventory';
import { EXIT_PAIR_KEY } from './tile-identity';

export interface GameplayCorePlaythroughSolverTrace extends PlaythroughSolverTrace {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    replayVerified: boolean;
    replayDeterministic: boolean;
    gambitCommits: number;
    information: GameplayCorePlaythroughInformationTrace;
    invariantViolations: string[];
}

export interface GameplayCorePerfectInformationPolicy {
    kind: 'perfect_information';
}

export interface GameplayCoreBoundedMemoryPolicy {
    kind: 'bounded_memory';
    memoryTileCapacity: number;
    uncertainTurnBudget: number;
}

export type GameplayCorePlaythroughInformationPolicy =
    | GameplayCorePerfectInformationPolicy
    | GameplayCoreBoundedMemoryPolicy;

export interface GameplayCorePlaythroughSolverOptions {
    informationPolicy?: GameplayCorePlaythroughInformationPolicy;
    gambitPolicy?: GameplayCoreGambitPolicy;
}

export interface GameplayCoreGambitPolicy {
    kind: 'first_uncertain_mismatch_rescue';
}

export interface GameplayCorePlaythroughInformationTrace {
    kind: GameplayCorePlaythroughInformationPolicy['kind'];
    memoryTileCapacity: number | null;
    uncertainTurnBudget: number | null;
    uncertainTurns: number;
    initialPlayableTileCount: number;
    initialRememberedTileIds: string[];
    observedTileIds: string[];
    evictedTileIds: string[];
    maximumRememberedTiles: number;
    riskBudgetExhausted: boolean;
}

interface BoundedMemoryEntry {
    pairKey: string;
    lastObservedAt: number;
}

interface BoundedMemoryState {
    policy: GameplayCoreBoundedMemoryPolicy;
    entries: Map<string, BoundedMemoryEntry>;
    observationClock: number;
    initialPlayableTileCount: number;
    initialRememberedTileIds: string[];
    observedTileIds: string[];
    evictedTileIds: string[];
    uncertainTurns: number;
    maximumRememberedTiles: number;
    riskBudgetExhausted: boolean;
}

interface MutableSolverState {
    run: RunState;
    commands: GameplayCommand[];
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
    boundedMemory: BoundedMemoryState | null;
    invariantViolations: string[];
}

const stableJson = (value: unknown): string => JSON.stringify(value);

const commandIdFor = (state: MutableSolverState, label: string): string =>
    `solver:${state.run.runSeed}:floor-${state.run.board?.level ?? 0}:${String(state.commands.length).padStart(4, '0')}:${label}`;

const currentRunStatus = (state: MutableSolverState): RunState['status'] => state.run.status;

const orderPairForCurrentBoard = (run: RunState, pair: readonly Tile[]): Tile[] => {
    const blockedIndex = run.stickyBlockIndex;
    if (blockedIndex == null || (run.board?.flippedTileIds.length ?? 0) > 0) {
        return [...pair];
    }
    return [...pair].sort((left, right) => {
        const leftBlocked = run.board?.tiles.findIndex((tile) => tile.id === left.id) === blockedIndex;
        const rightBlocked = run.board?.tiles.findIndex((tile) => tile.id === right.id) === blockedIndex;
        return Number(leftBlocked) - Number(rightBlocked);
    });
};

const normalizeBoundedMemoryPolicy = (
    policy: GameplayCoreBoundedMemoryPolicy
): GameplayCoreBoundedMemoryPolicy => ({
    kind: 'bounded_memory',
    memoryTileCapacity: Math.max(2, Math.floor(policy.memoryTileCapacity)),
    uncertainTurnBudget: Math.max(0, Math.floor(policy.uncertainTurnBudget))
});

const createBoundedMemoryState = (
    run: RunState,
    policy: GameplayCoreBoundedMemoryPolicy
): BoundedMemoryState => {
    const normalizedPolicy = normalizeBoundedMemoryPolicy(policy);
    const groups = run.board ? getUnresolvedPlayablePairGroups(run.board) : [];
    const state: BoundedMemoryState = {
        policy: normalizedPolicy,
        entries: new Map(),
        observationClock: 0,
        initialPlayableTileCount: groups.reduce((sum, group) => sum + group.length, 0),
        initialRememberedTileIds: [],
        observedTileIds: [],
        evictedTileIds: [],
        uncertainTurns: 0,
        maximumRememberedTiles: 0,
        riskBudgetExhausted: false
    };

    // The memorize phase is the only time the policy may intentionally retain
    // hidden identities. It focuses on complete pairs until its tile budget is full.
    const orderedGroups = [...groups].sort((left, right) =>
        (left[0]?.id ?? '').localeCompare(right[0]?.id ?? '')
    );
    for (const group of orderedGroups) {
        const pair = [...group].sort((left, right) => left.id.localeCompare(right.id)).slice(0, 2);
        if (pair.length < 2 || state.entries.size + pair.length > normalizedPolicy.memoryTileCapacity) continue;
        for (const tile of pair) {
            state.observationClock += 1;
            state.entries.set(tile.id, { pairKey: tile.pairKey, lastObservedAt: state.observationClock });
        }
    }
    state.initialRememberedTileIds = [...state.entries.keys()];
    state.maximumRememberedTiles = state.entries.size;
    return state;
};

const boundedMemoryTrace = (state: MutableSolverState): GameplayCorePlaythroughInformationTrace => {
    const memory = state.boundedMemory;
    if (!memory) {
        return {
            kind: 'perfect_information',
            memoryTileCapacity: null,
            uncertainTurnBudget: null,
            uncertainTurns: 0,
            initialPlayableTileCount: 0,
            initialRememberedTileIds: [],
            observedTileIds: [],
            evictedTileIds: [],
            maximumRememberedTiles: 0,
            riskBudgetExhausted: false
        };
    }
    return {
        kind: 'bounded_memory',
        memoryTileCapacity: memory.policy.memoryTileCapacity,
        uncertainTurnBudget: memory.policy.uncertainTurnBudget,
        uncertainTurns: memory.uncertainTurns,
        initialPlayableTileCount: memory.initialPlayableTileCount,
        initialRememberedTileIds: [...memory.initialRememberedTileIds],
        observedTileIds: [...memory.observedTileIds],
        evictedTileIds: [...memory.evictedTileIds],
        maximumRememberedTiles: memory.maximumRememberedTiles,
        riskBudgetExhausted: memory.riskBudgetExhausted
    };
};

const rememberObservedTile = (
    memory: BoundedMemoryState,
    tile: Tile,
    protectedTileIds: readonly string[] = []
): void => {
    memory.observationClock += 1;
    if (!memory.observedTileIds.includes(tile.id)) memory.observedTileIds.push(tile.id);
    const existing = memory.entries.get(tile.id);
    if (existing) {
        memory.entries.set(tile.id, { pairKey: tile.pairKey, lastObservedAt: memory.observationClock });
        return;
    }
    const protectedIds = new Set(protectedTileIds);
    while (memory.entries.size >= memory.policy.memoryTileCapacity) {
        const eviction = [...memory.entries.entries()]
            .filter(([tileId]) => !protectedIds.has(tileId))
            .sort((left, right) =>
                left[1].lastObservedAt - right[1].lastObservedAt || left[0].localeCompare(right[0])
            )[0];
        if (!eviction) {
            if (!memory.evictedTileIds.includes(tile.id)) memory.evictedTileIds.push(tile.id);
            return;
        }
        memory.entries.delete(eviction[0]);
        if (!memory.evictedTileIds.includes(eviction[0])) memory.evictedTileIds.push(eviction[0]);
    }
    memory.entries.set(tile.id, { pairKey: tile.pairKey, lastObservedAt: memory.observationClock });
    memory.maximumRememberedTiles = Math.max(memory.maximumRememberedTiles, memory.entries.size);
};

const settleBoundedMemory = (memory: BoundedMemoryState, run: RunState): void => {
    const board = run.board;
    if (!board) return;
    for (const tileId of [...memory.entries.keys()]) {
        const tile = board.tiles.find((candidate) => candidate.id === tileId);
        if (!tile || tile.state === 'matched' || tile.state === 'removed' || tile.dungeonCardState === 'resolved') {
            memory.entries.delete(tileId);
        }
    }
};

const syncVisibleAssists = (memory: BoundedMemoryState, run: RunState): void => {
    const board = run.board;
    if (!board) return;
    const visibleIds = [
        ...(Array.isArray(run.peekRevealedTileIds) ? run.peekRevealedTileIds : []),
        ...(Array.isArray(run.flashPairRevealedTileIds) ? run.flashPairRevealedTileIds : [])
    ];
    for (const tileId of visibleIds) {
        const tile = board.tiles.find((candidate) => candidate.id === tileId);
        if (tile && tile.state !== 'matched' && tile.state !== 'removed') rememberObservedTile(memory, tile);
    }
};

const knownPairFromMemory = (memory: BoundedMemoryState, run: RunState): Tile[] | null => {
    const board = run.board;
    if (!board) return null;
    const groups = new Map<string, Tile[]>();
    for (const [tileId, entry] of memory.entries) {
        const tile = board.tiles.find((candidate) => candidate.id === tileId);
        if (!tile || tile.state !== 'hidden') continue;
        const group = groups.get(entry.pairKey) ?? [];
        group.push(tile);
        groups.set(entry.pairKey, group);
    }
    const pair = [...groups.values()]
        .filter((group) => group.length >= 2)
        .sort((left, right) => (left[0]?.id ?? '').localeCompare(right[0]?.id ?? ''))[0];
    return pair ? pair.slice(0, 2) : null;
};

const playablePolicyTiles = (run: RunState): Tile[] => {
    if (!run.board) return [];
    // Structural eligibility is derived by the engine. The policy receives only
    // the resulting tile IDs/states and never groups unobserved identities.
    const tiles = getUnresolvedPlayablePairGroups(run.board).flat();
    const unique = new Map(tiles.map((tile) => [tile.id, tile]));
    const blockedIndex = run.stickyBlockIndex;
    return [...unique.values()].sort((left, right) => {
        const leftIndex = run.board?.tiles.findIndex((tile) => tile.id === left.id) ?? -1;
        const rightIndex = run.board?.tiles.findIndex((tile) => tile.id === right.id) ?? -1;
        const leftBlocked = blockedIndex != null && leftIndex === blockedIndex ? 1 : 0;
        const rightBlocked = blockedIndex != null && rightIndex === blockedIndex ? 1 : 0;
        return leftBlocked - rightBlocked || left.id.localeCompare(right.id);
    });
};

const chooseUnknownTile = (
    memory: BoundedMemoryState,
    run: RunState,
    excludedTileIds: readonly string[] = []
): Tile | null => {
    const excluded = new Set(excludedTileIds);
    const candidates = playablePolicyTiles(run)
        .filter((tile) => tile.state === 'hidden' && !excluded.has(tile.id));
    return candidates.find((tile) => !memory.entries.has(tile.id)) ?? candidates[0] ?? null;
};

const chooseUnknownTileFromOppositeEdge = (
    memory: BoundedMemoryState,
    run: RunState,
    excludedTileIds: readonly string[] = []
): Tile | null => {
    const excluded = new Set(excludedTileIds);
    const candidates = playablePolicyTiles(run)
        .filter((tile) => tile.state === 'hidden' && !excluded.has(tile.id))
        .reverse();
    return candidates.find((tile) => !memory.entries.has(tile.id)) ?? candidates[0] ?? null;
};

const chooseUnknownTileFromPriorCandidates = (
    memory: BoundedMemoryState,
    run: RunState,
    candidateTileIds: readonly string[],
    excludedTileIds: readonly string[] = []
): Tile | null => {
    const board = run.board;
    if (!board) return null;
    const excluded = new Set(excludedTileIds);
    const candidates = candidateTileIds
        .filter((tileId) => !excluded.has(tileId))
        .map((tileId) => board.tiles.find((tile) => tile.id === tileId))
        .filter((tile): tile is Tile => tile?.state === 'hidden')
        .sort((left, right) => left.id.localeCompare(right.id));
    return candidates.find((tile) => !memory.entries.has(tile.id)) ?? candidates[0] ?? null;
};

const knownPartnerFor = (
    memory: BoundedMemoryState,
    run: RunState,
    observedTile: Tile
): Tile | null => {
    const board = run.board;
    if (!board) return null;
    const candidateId = [...memory.entries.entries()]
        .filter(([tileId, entry]) => tileId !== observedTile.id && entry.pairKey === observedTile.pairKey)
        .map(([tileId]) => tileId)
        .sort((left, right) => left.localeCompare(right))[0];
    const candidate = candidateId
        ? board.tiles.find((tile) => tile.id === candidateId && tile.state === 'hidden')
        : null;
    return candidate ?? null;
};

const executeSolverCommand = (state: MutableSolverState, command: GameplayCommand): boolean => {
    const before = state.run;
    const result = reduceGameplayCommand(before, command);
    state.run = result.run;
    state.commands.push(command);
    state.events.push(...result.events);
    (result.accepted ? state.acceptedCommandIds : state.rejectedCommandIds).push(command.commandId);

    if (!gameplayCommandSchema.safeParse(command).success) {
        state.invariantViolations.push(`${command.commandId}: command failed schema validation.`);
    }
    result.events.forEach((event, sequence) => {
        if (!gameplayEventSchema.safeParse(event).success) {
            state.invariantViolations.push(`${command.commandId}: event ${sequence} failed schema validation.`);
        }
        if (
            event.commandId !== command.commandId ||
            event.sequence !== sequence ||
            event.eventId !== `${command.commandId}:${sequence}`
        ) {
            state.invariantViolations.push(`${command.commandId}: event ${sequence} lost deterministic identity or order.`);
        }
    });
    if (result.accepted === result.events.some((event) => event.type === 'command.rejected')) {
        state.invariantViolations.push(`${command.commandId}: acceptance disagrees with rejection events.`);
    }
    for (const itemId of RUN_INVENTORY_ITEM_IDS) {
        const quantity = getRunInventoryItemQuantity(result.run, itemId);
        if (!Number.isInteger(quantity) || quantity < 0) {
            state.invariantViolations.push(`${command.commandId}: ${itemId} quantity is invalid (${quantity}).`);
        }
    }
    if (result.run.runSeed !== before.runSeed || result.run.runRulesVersion !== before.runRulesVersion) {
        state.invariantViolations.push(`${command.commandId}: command changed deterministic run identity.`);
    }
    const feedbackDiagnostic = inspectGameplayFeedbackCompleteness({
        before,
        after: result.run,
        command,
        events: result.events,
        accepted: result.accepted
    });
    if (feedbackDiagnostic) {
        state.invariantViolations.push(feedbackDiagnostic.message);
    }
    if (state.boundedMemory) {
        settleBoundedMemory(state.boundedMemory, result.run);
        syncVisibleAssists(state.boundedMemory, result.run);
    }
    return result.accepted;
};

const finalizeTrace = (
    initialRun: RunState,
    state: MutableSolverState,
    stopReason: PlaythroughSolverStopReason,
    turns: number,
    lastPairKey: string | null,
    lastTileIds: string[],
    verifyReplay: boolean
): GameplayCorePlaythroughSolverTrace => {
    const replay = verifyReplay
        ? replayGameplayCommands(
              initialRun,
              state.commands.map((command) => JSON.parse(JSON.stringify(command)))
          )
        : null;
    const replayDeterministic =
        replay == null ||
        (stableJson(replay.run) === stableJson(state.run) &&
            stableJson(replay.events) === stableJson(state.events) &&
            stableJson(replay.acceptedCommandIds) === stableJson(state.acceptedCommandIds) &&
            stableJson(replay.rejectedCommandIds) === stableJson(state.rejectedCommandIds));
    if (!replayDeterministic) {
        state.invariantViolations.push(`solver:${initialRun.runSeed}: command replay diverged.`);
    }
    return {
        run: state.run,
        stopReason,
        turns,
        lastPairKey,
        lastTileIds,
        commands: state.commands,
        events: state.events,
        acceptedCommandIds: state.acceptedCommandIds,
        rejectedCommandIds: state.rejectedCommandIds,
        replayVerified: verifyReplay,
        replayDeterministic,
        gambitCommits: state.events.filter((event) => event.type === 'board.gambit_commit.requested').length,
        information: boundedMemoryTrace(state),
        invariantViolations: state.invariantViolations
    };
};

/**
 * Exhausts a board through the same serializable command/event boundary used by
 * live play. The retained legacy solver remains available for parity checks
 * during the strangler migration.
 */
export const solveRunThroughGameplayCoreWithTrace = (
    initialRun: RunState,
    maxTurns = 160,
    verifyReplay = true,
    options: GameplayCorePlaythroughSolverOptions = {}
): GameplayCorePlaythroughSolverTrace => {
    const boundedPolicy = options.informationPolicy?.kind === 'bounded_memory'
        ? options.informationPolicy
        : null;
    const state: MutableSolverState = {
        run: initialRun,
        commands: [],
        events: [],
        acceptedCommandIds: [],
        rejectedCommandIds: [],
        boundedMemory: boundedPolicy ? createBoundedMemoryState(initialRun, boundedPolicy) : null,
        invariantViolations: []
    };
    if (state.boundedMemory) syncVisibleAssists(state.boundedMemory, initialRun);

    for (let turn = 0; turn < maxTurns; turn += 1) {
        if (!state.run.board) {
            return finalizeTrace(initialRun, state, 'missing_board', turn, null, [], verifyReplay);
        }
        if (state.run.status === 'gameOver') {
            return finalizeTrace(initialRun, state, 'terminal_status', turn, null, [], verifyReplay);
        }
        if (state.run.status === 'levelComplete') {
            if (createRunProgressionRepairTransition(state.run).repaired) {
                executeSolverCommand(
                    state,
                    createGameplayProgressionRepairCommand(commandIdFor(state, 'progression_repair'))
                );
            }
            return finalizeTrace(initialRun, state, 'level_complete', turn, null, [], verifyReplay);
        }
        if (state.run.status === 'memorize') {
            executeSolverCommand(
                state,
                createGameplayMemorizeCompleteCommand(commandIdFor(state, 'memorize_complete'))
            );
            continue;
        }

        if (state.run.status === 'resolving') {
            executeSolverCommand(
                state,
                createGameplayBoardTurnResolveCommand(commandIdFor(state, 'resolve_turn'))
            );
            continue;
        }

        const boundedTurnTileIds = state.boundedMemory
            ? playablePolicyTiles(state.run).map((tile) => tile.id)
            : [];
        const pair = state.boundedMemory
            ? knownPairFromMemory(state.boundedMemory, state.run)
            : getUnresolvedPlayablePairGroups(state.run.board)[0] ?? null;
        const boundedUnknownFirst = state.boundedMemory && !pair
            ? chooseUnknownTile(state.boundedMemory, state.run)
            : null;
        if (!pair && !boundedUnknownFirst) {
            if (createRunProgressionRepairTransition(state.run).repaired) {
                executeSolverCommand(
                    state,
                    createGameplayProgressionRepairCommand(commandIdFor(state, 'progression_repair'))
                );
            }
            const board = state.run.board;
            if (!board) {
                return finalizeTrace(initialRun, state, 'missing_board', turn, null, [], verifyReplay);
            }
            const exit = getPrimaryPlaythroughExitTile(board);
            if (!exit) {
                return finalizeTrace(initialRun, state, 'no_exit', turn, null, [], verifyReplay);
            }
            if (exit.state === 'hidden') {
                executeSolverCommand(
                    state,
                    createGameplayTileFlipCommand(commandIdFor(state, 'reveal_exit'), exit.id)
                );
            }
            const exitStatus = getDungeonExitStatus(state.run);
            executeSolverCommand(
                state,
                createGameplayDungeonExitActivateCommand(
                    commandIdFor(state, 'activate_exit'),
                    chooseDungeonExitActivationSpend(exitStatus)
                )
            );
            return finalizeTrace(initialRun, state, 'exit_attempted', turn, EXIT_PAIR_KEY, [exit.id], verifyReplay);
        }

        const orderedKnownPair = pair ? orderPairForCurrentBoard(state.run, pair) : [];
        const first = orderedKnownPair[0] ?? boundedUnknownFirst;
        let second: Tile | null = orderedKnownPair[1] ?? null;
        if (!first) {
            return finalizeTrace(
                initialRun,
                state,
                'missing_pair_tile',
                turn,
                pair?.[0]?.pairKey ?? null,
                pair?.map((tile) => tile.id) ?? [],
                verifyReplay
            );
        }
        const before = state.run;
        if (first.state === 'hidden') {
            executeSolverCommand(
                state,
                createGameplayTileFlipCommand(commandIdFor(state, 'flip_first'), first.id)
            );
        }
        const firstNow = state.run.board?.tiles.find((tile) => tile.id === first.id) ?? null;
        if (
            state.boundedMemory &&
            firstNow &&
            state.run.board?.flippedTileIds.includes(firstNow.id)
        ) {
            const rememberedPartner = knownPartnerFor(state.boundedMemory, state.run, firstNow);
            rememberObservedTile(
                state.boundedMemory,
                firstNow,
                rememberedPartner ? [rememberedPartner.id] : []
            );
            second = rememberedPartner ?? second;
        }
        if (currentRunStatus(state) === 'resolving') {
            executeSolverCommand(
                state,
                createGameplayBoardTurnResolveCommand(commandIdFor(state, 'resolve_turn'))
            );
            continue;
        }
        if (state.boundedMemory && !second) {
            if (state.boundedMemory.uncertainTurns >= state.boundedMemory.policy.uncertainTurnBudget) {
                state.boundedMemory.riskBudgetExhausted = true;
                return finalizeTrace(
                    initialRun,
                    state,
                    'risk_budget_exhausted',
                    turn,
                    firstNow?.pairKey ?? null,
                    [first.id],
                    verifyReplay
                );
            }
            const shouldOpenGambitRisk =
                options.gambitPolicy?.kind === 'first_uncertain_mismatch_rescue' &&
                state.run.gambitAvailableThisFloor &&
                !state.run.gambitThirdFlipUsed;
            second = (shouldOpenGambitRisk
                ? chooseUnknownTileFromOppositeEdge(state.boundedMemory, state.run, [first.id])
                : chooseUnknownTile(state.boundedMemory, state.run, [first.id])) ??
                chooseUnknownTileFromPriorCandidates(
                    state.boundedMemory,
                    state.run,
                    boundedTurnTileIds,
                    [first.id]
                );
            if (second) state.boundedMemory.uncertainTurns += 1;
        }
        if (!second && createRunProgressionRepairTransition(state.run).repaired) {
            executeSolverCommand(
                state,
                createGameplayProgressionRepairCommand(commandIdFor(state, 'progression_repair'))
            );
            continue;
        }
        if (
            !second &&
            (currentRunStatus(state) === 'levelComplete' ||
                currentRunStatus(state) === 'gameOver' ||
                ((state.run.board?.flippedTileIds.length ?? 0) === 0 && stableJson(state.run) !== stableJson(before)))
        ) {
            continue;
        }
        if (!second) {
            return finalizeTrace(
                initialRun,
                state,
                'missing_pair_tile',
                turn,
                firstNow?.pairKey ?? first.pairKey,
                [first.id],
                verifyReplay
            );
        }
        const secondNow = state.run.board?.tiles.find((tile) => tile.id === second.id);
        if (secondNow?.state === 'hidden') {
            executeSolverCommand(
                state,
                createGameplayTileFlipCommand(commandIdFor(state, 'flip_second'), second.id)
            );
        }
        const observedSecond = state.run.board?.tiles.find((tile) => tile.id === second.id) ?? null;
        if (
            state.boundedMemory &&
            observedSecond &&
            state.run.board?.flippedTileIds.includes(observedSecond.id)
        ) {
            rememberObservedTile(state.boundedMemory, observedSecond, [first.id]);
        }
        if (
            options.gambitPolicy?.kind === 'first_uncertain_mismatch_rescue' &&
            state.boundedMemory &&
            firstNow &&
            observedSecond &&
            firstNow.pairKey !== observedSecond.pairKey &&
            currentRunStatus(state) === 'resolving' &&
            state.run.gambitAvailableThisFloor &&
            !state.run.gambitThirdFlipUsed
        ) {
            const third = knownPartnerFor(state.boundedMemory, state.run, firstNow) ??
                knownPartnerFor(state.boundedMemory, state.run, observedSecond) ??
                chooseUnknownTile(state.boundedMemory, state.run, [first.id, second.id]);
            if (third) {
                const committed = executeSolverCommand(
                    state,
                    createGameplayGambitCommitCommand(commandIdFor(state, 'gambit_commit'), third.id)
                );
                if (committed) {
                    executeSolverCommand(
                        state,
                        createGameplayTileFlipCommand(commandIdFor(state, 'gambit_third'), third.id)
                    );
                }
            }
        }
        if (currentRunStatus(state) === 'resolving') {
            executeSolverCommand(
                state,
                createGameplayBoardTurnResolveCommand(commandIdFor(state, 'resolve_turn'))
            );
        }
        if (state.run === before || stableJson(state.run) === stableJson(before)) {
            return finalizeTrace(
                initialRun,
                state,
                'no_progress',
                turn,
                first.pairKey,
                [first.id, second.id],
                verifyReplay
            );
        }
    }

    return finalizeTrace(initialRun, state, 'turn_guard', maxTurns, null, [], verifyReplay);
};

export const solveRunThroughGameplayCore = (run: RunState, maxTurns = 160): RunState =>
    solveRunThroughGameplayCoreWithTrace(run, maxTurns).run;
