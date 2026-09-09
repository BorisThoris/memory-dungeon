import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import {
    createGameplayDefinitionCommand,
    getGameplayContentDefinition,
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
    stats: {
        totalScore: 0,
        currentLevelScore: 0,
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

describe('pure gameplay effect transition', () => {
    it('is the same accepted definition authority used by the command core', () => {
        const initial = run();
        const command = createGameplayDefinitionCommand(
            'effect-parity-accepted',
            'trait.conduit_echo_peek',
            { matchedTraits: ['conduit'], adjacentTraits: ['echo'] }
        );
        const pure = applyPure(initial, command);
        const core = reduceGameplayCommand(initial, command);

        expect(pure).toMatchObject({ accepted: true, rejectionReason: null });
        expect(pure.run.peekCharges).toBe(initial.peekCharges + 1);
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
            'trait.conduit_echo_peek',
            { matchedTraits: ['conduit'], adjacentTraits: ['heavy'] }
        );
        const pure = applyPure(initial, command);
        const core = reduceGameplayCommand(initial, command);

        expect(pure).toMatchObject({ accepted: false, run: initial });
        expect(pure.rejectionReason).toContain('echo was not adjacent');
        expect({ run: pure.run, events: pure.events, accepted: pure.accepted }).toEqual({
            run: core.run,
            events: core.events,
            accepted: core.accepted
        });
    });

    it('composes multiple definitions under one outer deterministic event sequence', () => {
        const initial = run();
        const events: GameplayEvent[] = [];
        const peek = getGameplayContentDefinition('trait.conduit_echo_peek')!;
        const glint = getGameplayContentDefinition('findable.score_glint')!;
        const factsCommand = createGameplayDefinitionCommand('outer-turn', glint.id, {
            matchedFindables: ['score_glint'],
            matchedTraits: ['conduit'],
            adjacentTraits: ['echo']
        });
        if (factsCommand.type !== 'effects.apply') throw new Error('Could not construct default gameplay facts.');
        const facts = factsCommand.facts;

        const first = applyGameplayDefinitionTransition(initial, 'outer-turn', peek, facts, events);
        const second = applyGameplayDefinitionTransition(first.run, 'outer-turn', glint, facts, events);

        expect(second).toMatchObject({ accepted: true, run: { ...initial, peekCharges: 1 } });
        expect(events.map((event) => event.type)).toEqual([
            'inventory.changed',
            'feedback.requested',
            'score.requested',
            'feedback.requested'
        ]);
        expect(events.every((event, sequence) =>
            event.commandId === 'outer-turn' &&
            event.sequence === sequence &&
            event.eventId === `outer-turn:${sequence}`
        )).toBe(true);
        expect(second.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(second.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
    });
});
