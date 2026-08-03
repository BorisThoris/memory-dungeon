import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    getGameplayContentDefinition,
    gameplayContentDefinitionSchema,
    gameplayFactsSchema,
    type GameplayContentDefinition,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { applyGameplayDefinitionTransition } from './gameplay-effect-transition';

const run = (overrides: Partial<RunState> = {}): RunState => ({
    status: 'playing',
    board: null,
    runSeed: 71,
    runRulesVersion: 1,
    peekCharges: 0,
    shuffleCharges: 0,
    rewardPerkIds: [],
    relicIds: [],
    stats: {
        totalScore: 0,
        currentLevelScore: 0,
        comboShards: 0,
        guardTokens: 0,
        currentStreak: 0
    },
    ...overrides
} as RunState);

const applyPure = (initial: RunState, command: ReturnType<typeof createGameplayDefinitionCommand>) => {
    if (command.type !== 'effects.apply') {
        throw new Error(`Expected an effects command, received ${command.type}.`);
    }
    const definition = getGameplayContentDefinition(command.definitionId);
    if (!definition) {
        throw new Error(`Missing definition ${command.definitionId}.`);
    }
    return applyGameplayDefinitionTransition(
        initial,
        command.commandId,
        definition,
        command.facts
    );
};

const testDefinition = (
    id: string,
    effects: GameplayContentDefinition['effects']
): GameplayContentDefinition => gameplayContentDefinitionSchema.parse({
    id,
    version: 1,
    buildId: 'protocol_event_test',
    source: { kind: 'system', id: 'protocol_event_test' },
    trigger: 'content.claimed',
    conditions: [],
    effects
});

const defaultFacts = gameplayFactsSchema.parse({});

describe('pure gameplay effect transition', () => {
    it('is the same accepted definition authority used by the command core', () => {
        const initial = run();
        const command = createGameplayDefinitionCommand(
            'effect-parity-accepted',
            'bonus_reward.echo_conduit_lens'
        );
        const pure = applyPure(initial, command);
        const core = reduceGameplayCommand(initial, command);

        expect(pure).toMatchObject({ accepted: true, rejectionReason: null });
        expect({ run: pure.run, events: pure.events, accepted: pure.accepted }).toEqual({
            run: core.run,
            events: core.events,
            accepted: core.accepted
        });
        expect(pure.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(pure.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
    });

    it('is the same atomic condition-rejection authority used by the command core', () => {
        const initial = run();
        const command = createGameplayDefinitionCommand(
            'effect-parity-rejected',
            'reward_perk.echo_conduit_double',
            { matchedTraits: ['echo'], adjacentTraits: ['conduit'] }
        );
        const pure = applyPure(initial, command);
        const core = reduceGameplayCommand(initial, command);

        expect(pure).toMatchObject({ accepted: false, run: initial });
        expect(pure.rejectionReason).toContain('echo_conduit_double is not active');
        expect({ run: pure.run, events: pure.events, accepted: pure.accepted }).toEqual({
            run: core.run,
            events: core.events,
            accepted: core.accepted
        });
    });

    it('composes multiple definitions under one outer deterministic event sequence', () => {
        const initial = run();
        const events: GameplayEvent[] = [];
        const peek = getGameplayContentDefinition('relic.peek_charge_plus_one')!;
        const shuffle = getGameplayContentDefinition('relic.extra_shuffle_charge')!;
        const factsCommand = createGameplayDefinitionCommand('outer-turn', peek.id);
        if (factsCommand.type !== 'effects.apply') throw new Error('Could not construct default gameplay facts.');
        const facts = factsCommand.facts;

        const first = applyGameplayDefinitionTransition(initial, 'outer-turn', peek, facts, events);
        const second = applyGameplayDefinitionTransition(first.run, 'outer-turn', shuffle, facts, events);

        expect(second).toMatchObject({ accepted: true, run: { peekCharges: 1, shuffleCharges: 1 } });
        expect(events.length).toBeGreaterThanOrEqual(4);
        expect(events.every((event, sequence) =>
            event.commandId === 'outer-turn' &&
            event.sequence === sequence &&
            event.eventId === `outer-turn:${sequence}`
        )).toBe(true);
        expect(second.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(second.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
    });

    it('emits the exact bonus relic-pick delta protocol event', () => {
        const result = applyGameplayDefinitionTransition(
            run({ bonusRelicPicksNextOffer: 2 }),
            'bonus-pick-event',
            testDefinition('test.bonus_pick_event', [{ kind: 'bonus_relic_pick.grant', amount: 1 }]),
            defaultFacts
        );

        expect(result).toMatchObject({ accepted: true, run: { bonusRelicPicksNextOffer: 3 } });
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'bonus_relic_pick.changed',
                requested: 1,
                applied: 1,
                before: 2,
                after: 3
            })
        ]);
    });

    it('emits an explicit skipped-effect event when inventory consumption cannot apply', () => {
        const result = applyGameplayDefinitionTransition(
            run({ peekCharges: 0 }),
            'skipped-effect-event',
            testDefinition('test.skipped_effect_event', [{ kind: 'inventory.consume', itemId: 'peek_charge', amount: 1 }]),
            defaultFacts
        );

        expect(result).toMatchObject({ accepted: true, run: { peekCharges: 0 } });
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'inventory.changed',
                itemId: 'peek_charge',
                operation: 'consume',
                requested: 1,
                applied: 0,
                before: 0,
                after: 0
            }),
            expect.objectContaining({
                type: 'effect.skipped',
                effectKind: 'inventory.consume'
            })
        ]);
    });
});
