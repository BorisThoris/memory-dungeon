import { applyPeek } from './board-power-actions';
import type { RewardPerkId, RunState } from './contracts';
import {
    GAMEPLAY_CORE_SCHEMA_VERSION,
    GAMEPLAY_REWARD_PERK_IDS,
    gameplayCommandSchema,
    gameplayEventSchema,
    getGameplayContentDefinition,
    type GameplayCommand,
    type GameplayCondition,
    type GameplayContentDefinition,
    type GameplayEvent,
    type GameplayFacts,
    type GameplaySource
} from './gameplay-core-contracts';
import {
    gainRunInventoryItem,
    getRunInventoryItemQuantity,
    useRunInventoryItem
} from './run-inventory';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export interface GameplayCommandResult {
    run: RunState;
    command: GameplayCommand | null;
    events: GameplayEvent[];
    accepted: boolean;
}

export interface GameplayReplayResult {
    run: RunState;
    events: GameplayEvent[];
    acceptedCommandIds: string[];
    rejectedCommandIds: string[];
}

const SYSTEM_SOURCE: GameplaySource = { kind: 'system', id: 'gameplay-core' };
const PEEK_SOURCE: GameplaySource = { kind: 'power', id: 'peek' };
const gameplayRewardPerkIds = new Set<RewardPerkId>(GAMEPLAY_REWARD_PERK_IDS);
type GameplayEventPayload<T = GameplayEvent> = T extends GameplayEvent
    ? Omit<T, 'schemaVersion' | 'eventId' | 'commandId' | 'sequence' | 'source'>
    : never;

const normalizeGameplayRewardPerkIds = (value: unknown): RewardPerkId[] =>
    Array.isArray(value)
        ? value.filter((id): id is RewardPerkId => typeof id === 'string' && gameplayRewardPerkIds.has(id as RewardPerkId))
        : [];

const hasGameplayRewardPerk = (run: Pick<RunState, 'rewardPerkIds'>, perkId: RewardPerkId): boolean =>
    normalizeGameplayRewardPerkIds(run.rewardPerkIds).includes(perkId);

const makeEventWriter = (commandId: string, source: GameplaySource, events: GameplayEvent[]) =>
    (event: GameplayEventPayload): void => {
        const sequence = events.length;
        events.push(
            gameplayEventSchema.parse({
                ...event,
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                eventId: `${commandId}:${sequence}`,
                commandId,
                sequence,
                source
            })
        );
    };

const rejectedResult = (run: RunState, commandId: string, reason: string, command: GameplayCommand | null): GameplayCommandResult => {
    const events: GameplayEvent[] = [];
    makeEventWriter(commandId, SYSTEM_SOURCE, events)({ type: 'command.rejected', reason });
    return { run, command, events, accepted: false };
};

const conditionFailure = (run: RunState, condition: GameplayCondition, facts: GameplayFacts): string | null => {
    switch (condition.kind) {
        case 'run.status_is':
            return run.status === condition.status ? null : `run status is ${run.status}, expected ${condition.status}`;
        case 'inventory.at_least':
            return getRunInventoryItemQuantity(run, condition.itemId) >= condition.amount
                ? null
                : `${condition.itemId} is below ${condition.amount}`;
        case 'reward_perk.active':
            return hasGameplayRewardPerk(run, condition.perkId) ? null : `${condition.perkId} is not active`;
        case 'relic.active':
            return Array.isArray(run.relicIds) && run.relicIds.includes(condition.relicId)
                ? null
                : `${condition.relicId} is not active`;
        case 'trait.matched':
            return facts.matchedTraits.includes(condition.trait) ? null : `${condition.trait} was not matched`;
        case 'trait.adjacent':
            return facts.adjacentTraits.includes(condition.trait) ? null : `${condition.trait} was not adjacent`;
        case 'findable.matched':
            return facts.matchedFindables.includes(condition.findable) ? null : `${condition.findable} was not matched`;
    }
};

const applyDefinition = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'effects.apply' }>,
    definition: GameplayContentDefinition
): GameplayCommandResult => {
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, definition.source, events);
    for (const condition of definition.conditions) {
        const failure = conditionFailure(run, condition, command.facts);
        if (failure) {
            writeEvent({ type: 'command.rejected', reason: `Condition failed: ${failure}.` });
            return { run, command, events, accepted: false };
        }
    }

    let nextRun = run;
    for (const effect of definition.effects) {
        switch (effect.kind) {
            case 'inventory.grant': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                nextRun = gainRunInventoryItem(nextRun, effect.itemId, effect.amount);
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'grant',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                if (after === before) {
                    writeEvent({
                        type: 'effect.skipped',
                        effectKind: effect.kind,
                        reason: `${effect.itemId} could not accept the requested grant.`
                    });
                }
                break;
            }
            case 'inventory.consume': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                const used = useRunInventoryItem(nextRun, effect.itemId);
                nextRun = used.run;
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'consume',
                    requested: effect.amount,
                    applied: after - before,
                    before,
                    after
                });
                if (!used.applied) {
                    writeEvent({
                        type: 'effect.skipped',
                        effectKind: effect.kind,
                        reason: used.reason ?? `${effect.itemId} could not be consumed.`
                    });
                }
                break;
            }
            case 'inventory.grant_or_score': {
                const before = getRunInventoryItemQuantity(nextRun, effect.itemId);
                nextRun = gainRunInventoryItem(nextRun, effect.itemId, effect.amount);
                const after = getRunInventoryItemQuantity(nextRun, effect.itemId);
                const applied = after - before;
                writeEvent({
                    type: 'inventory.changed',
                    itemId: effect.itemId,
                    operation: 'grant',
                    requested: effect.amount,
                    applied,
                    before,
                    after
                });
                if (applied === 0) {
                    const stats = normalizeSessionStats(nextRun.stats);
                    const totalBefore = runNonNegativeInteger(stats.totalScore);
                    const currentLevelBefore = runNonNegativeInteger(stats.currentLevelScore);
                    nextRun = {
                        ...nextRun,
                        stats: {
                            ...stats,
                            totalScore: totalBefore + effect.fallbackScore,
                            currentLevelScore: currentLevelBefore + effect.fallbackScore
                        }
                    };
                    writeEvent({
                        type: 'score.changed',
                        reason: 'inventory_overflow',
                        amount: effect.fallbackScore,
                        totalBefore,
                        totalAfter: totalBefore + effect.fallbackScore,
                        currentLevelBefore,
                        currentLevelAfter: currentLevelBefore + effect.fallbackScore
                    });
                }
                break;
            }
            case 'reward_perk.grant': {
                const rewardPerkIds = normalizeGameplayRewardPerkIds(nextRun.rewardPerkIds);
                const newlyGranted = !rewardPerkIds.includes(effect.perkId);
                if (newlyGranted) {
                    nextRun = { ...nextRun, rewardPerkIds: [...rewardPerkIds, effect.perkId] };
                }
                writeEvent({ type: 'reward_perk.granted', perkId: effect.perkId, newlyGranted });
                break;
            }
            case 'combo_shard.request':
                writeEvent({ type: 'combo_shard.requested', amount: effect.amount });
                break;
            case 'safe_hazard_ward.request':
                writeEvent({ type: 'safe_hazard_ward.requested', amount: effect.amount });
                break;
            case 'feedback.emit':
                writeEvent({
                    type: 'feedback.requested',
                    cue: effect.cue,
                    message: effect.message,
                    tone: effect.tone
                });
                break;
        }
    }
    return { run: nextRun, command, events, accepted: true };
};

const applyPeekCommand = (
    run: RunState,
    command: Extract<GameplayCommand, { type: 'board.peek' }>
): GameplayCommandResult => {
    const nextRun = applyPeek(run, command.targetTileId);
    if (nextRun === run) {
        return rejectedResult(run, command.commandId, 'Peek is not legal for the current run and target.', command);
    }
    const events: GameplayEvent[] = [];
    const writeEvent = makeEventWriter(command.commandId, PEEK_SOURCE, events);
    const before = runNonNegativeInteger(run.peekCharges);
    const after = runNonNegativeInteger(nextRun.peekCharges);
    writeEvent({
        type: 'inventory.changed',
        itemId: 'peek_charge',
        operation: 'consume',
        requested: 1,
        applied: after - before,
        before,
        after
    });
    const beforeTile = run.board?.tiles.find((tile) => tile.id === command.targetTileId);
    const afterTile = nextRun.board?.tiles.find((tile) => tile.id === command.targetTileId);
    writeEvent({
        type: 'board.peeked',
        targetTileId: command.targetTileId,
        peekChargesBefore: before,
        peekChargesAfter: after,
        recallFocusBefore: runNonNegativeInteger(run.recallFocus),
        recallFocusAfter: runNonNegativeInteger(nextRun.recallFocus),
        routeSpecialRevealed:
            beforeTile?.routeSpecialRevealed !== true && afterTile?.routeSpecialRevealed === true
    });
    writeEvent({
        type: 'feedback.requested',
        cue: 'power.peek.used',
        message: `Peek revealed ${command.targetTileId}; ${after} charge${after === 1 ? '' : 's'} remain.`,
        tone: 'information'
    });
    return { run: nextRun, command, events, accepted: true };
};

export const reduceGameplayCommand = (run: RunState, input: unknown): GameplayCommandResult => {
    const parsed = gameplayCommandSchema.safeParse(input);
    if (!parsed.success) {
        return rejectedResult(run, 'invalid-command', 'Command failed schema validation.', null);
    }
    const command = parsed.data;
    if (command.type === 'board.peek') {
        return applyPeekCommand(run, command);
    }
    const definition = getGameplayContentDefinition(command.definitionId);
    if (!definition) {
        return rejectedResult(run, command.commandId, `Unknown gameplay definition ${command.definitionId}.`, command);
    }
    if (definition.version !== command.definitionVersion) {
        return rejectedResult(
            run,
            command.commandId,
            `Definition version mismatch for ${definition.id}: command ${command.definitionVersion}, current ${definition.version}.`,
            command
        );
    }
    return applyDefinition(run, command, definition);
};

export const replayGameplayCommands = (initialRun: RunState, inputs: readonly unknown[]): GameplayReplayResult => {
    let run = initialRun;
    const events: GameplayEvent[] = [];
    const acceptedCommandIds: string[] = [];
    const rejectedCommandIds: string[] = [];
    for (const input of inputs) {
        const result = reduceGameplayCommand(run, input);
        run = result.run;
        events.push(...result.events);
        const commandId = result.command?.commandId ?? result.events[0]?.commandId ?? 'invalid-command';
        (result.accepted ? acceptedCommandIds : rejectedCommandIds).push(commandId);
    }
    return { run, events, acceptedCommandIds, rejectedCommandIds };
};
