import { describe, expect, it } from 'vitest';
import { applyPeek } from './board-power-actions';
import { BONUS_REWARD_CATALOG, previewBonusRewardClaim } from './bonus-rewards';
import type { BoardState, RunState, Tile } from './contracts';
import {
    CONDUIT_CARTOGRAPHER_DEFINITIONS,
    GAMEPLAY_CORE_SCHEMA_VERSION,
    createGameplayDefinitionCommand,
    createGameplayPeekCommand,
    gameplayCommandSchema,
    gameplayContentDefinitionSchema,
    gameplayEventSchema
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { applyRelicImmediateThroughGameplayCore } from './gameplay-core-adapters';
import { applyRelicImmediate } from './relic-immediate-rules';
import { resolveTileTraitEffects } from './tile-trait-rules';

const tile = (id: string, pairKey: string, tileTraitKind?: Tile['tileTraitKind']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    tileTraitKind
});

const board = (): BoardState => ({
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    tiles: [tile('echo-a', 'echo', 'echo'), tile('echo-b', 'echo', 'echo'), tile('conduit-a', 'conduit', 'conduit'), tile('plain-a', 'plain')],
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const run = (overrides: Partial<RunState> = {}): RunState =>
    ({
        status: 'playing',
        board: board(),
        runSeed: 91,
        runRulesVersion: 1,
        peekCharges: 0,
        recallFocus: 2,
        rewardPerkIds: [],
        relicIds: [],
        powersUsedThisRun: false,
        forgottenTileIdsThisFloor: [],
        peekRevealedTileIds: [],
        stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 0 },
        ...overrides
    }) as RunState;

describe('deterministic gameplay core', () => {
    it('validates commands, effects, conditions, and definitions as strict serializable contracts', () => {
        expect(CONDUIT_CARTOGRAPHER_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.echo_conduit_lens',
            'relic.peek_charge_plus_one',
            'reward_perk.echo_conduit_double'
        ]);
        expect(CONDUIT_CARTOGRAPHER_DEFINITIONS.every((definition) => gameplayContentDefinitionSchema.safeParse(definition).success)).toBe(true);
        expect(
            gameplayCommandSchema.safeParse({
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: 'bad',
                type: 'effects.apply',
                definitionId: 'relic.peek_charge_plus_one',
                definitionVersion: 1,
                facts: {},
                undocumentedMutation: true
            }).success
        ).toBe(false);
        expect(
            gameplayContentDefinitionSchema.safeParse({
                ...CONDUIT_CARTOGRAPHER_DEFINITIONS[0],
                effects: [{ kind: 'inventory.grant', itemId: 'peek_charge', amount: 0 }]
            }).success
        ).toBe(false);
    });

    it('matches the existing Echo Conduit Lens payout for perk and Peek inventory state', () => {
        const initial = run();
        const reward = {
            ...BONUS_REWARD_CATALOG.echo_conduit_lens,
            instanceId: 'reward:echo-conduit-lens:91',
            runSeed: initial.runSeed,
            rulesVersion: initial.runRulesVersion,
            floor: 3,
            offlineOnly: true as const,
            eligible: true,
            unavailableReason: null
        };
        const legacy = previewBonusRewardClaim(initial, reward).run;
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('claim-lens', 'bonus_reward.echo_conduit_lens')
        );

        expect(result.accepted).toBe(true);
        expect(result.run.peekCharges).toBe(legacy.peekCharges);
        expect(result.run.rewardPerkIds).toEqual(legacy.rewardPerkIds);
        expect(result.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'reward_perk.granted', perkId: 'echo_conduit_double', newlyGranted: true }),
                expect.objectContaining({ type: 'inventory.changed', itemId: 'peek_charge', applied: 1 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.echo_conduit_lens.claimed' })
            ])
        );
    });

    it('matches the current Peek relic immediate effect', () => {
        const initial = run({ peekCharges: 2 });
        const legacy = applyRelicImmediate(initial, 'peek_charge_plus_one');
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('pick-peek-relic', 'relic.peek_charge_plus_one')
        );

        expect(result.accepted).toBe(true);
        expect(result.run.peekCharges).toBe(legacy.peekCharges);
        expect(result.events[0]).toMatchObject({
            eventId: 'pick-peek-relic:0',
            type: 'inventory.changed',
            source: { kind: 'relic', id: 'peek_charge_plus_one' }
        });
    });

    it('routes migrated relic immediates through the core while preserving legacy fallbacks', () => {
        const initial = run({ peekCharges: 2, shuffleCharges: 1 });
        const migrated = applyRelicImmediateThroughGameplayCore(initial, 'peek_charge_plus_one', 'adapter-peek');
        const legacy = applyRelicImmediateThroughGameplayCore(initial, 'extra_shuffle_charge', 'adapter-shuffle');

        expect(migrated).toMatchObject({ migrated: true, run: { peekCharges: 3 } });
        expect(migrated.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'inventory.changed', source: { kind: 'relic', id: 'peek_charge_plus_one' } }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.peek_relic.claimed' })
            ])
        );
        expect(legacy).toMatchObject({ migrated: false, run: { shuffleCharges: 2 }, events: [] });
    });

    it('models exactly the extra Peek granted by the existing Echo-Conduit perk condition', () => {
        const active = run({ rewardPerkIds: ['echo_conduit_double'], peekCharges: 3 });
        const sourceTiles = active.board!.tiles.slice(0, 2);
        const legacyWithPerk = resolveTileTraitEffects({ run: active, board: active.board, sourceTiles, source: 'match' });
        const legacyWithoutPerk = resolveTileTraitEffects({
            run: { ...active, rewardPerkIds: [] },
            board: active.board,
            sourceTiles,
            source: 'match'
        });
        const result = reduceGameplayCommand(
            active,
            createGameplayDefinitionCommand('echo-conduit-match', 'reward_perk.echo_conduit_double', {
                matchedTraits: ['echo'],
                adjacentTraits: ['conduit']
            })
        );

        expect(legacyWithPerk.peekChargeGain - legacyWithoutPerk.peekChargeGain).toBe(1);
        expect(result.run.peekCharges - active.peekCharges).toBe(1);
        expect(result.events).toContainEqual(
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.echo_conduit_double.triggered' })
        );
    });

    it('rejects unmet trait conditions atomically with an explainable event', () => {
        const initial = run({ rewardPerkIds: ['echo_conduit_double'] });
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('bad-adjacency', 'reward_perk.echo_conduit_double', {
                matchedTraits: ['echo'],
                adjacentTraits: []
            })
        );

        expect(result.accepted).toBe(false);
        expect(result.run).toBe(initial);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', reason: expect.stringContaining('conduit was not adjacent') })
        ]);
    });

    it('preserves board Peek legality and state parity while emitting resource and feedback events', () => {
        const initial = run({ peekCharges: 2, recallFocus: 2 });
        const legacy = applyPeek(initial, 'echo-a');
        const result = reduceGameplayCommand(initial, createGameplayPeekCommand('peek-echo-a', 'echo-a'));

        expect(result.accepted).toBe(true);
        expect(result.run).toEqual(legacy);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', applied: -1, before: 2, after: 1 }),
            expect.objectContaining({ type: 'board.peeked', targetTileId: 'echo-a', recallFocusBefore: 2 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.peek.used' })
        ]);
        expect(result.events.every((event) => gameplayEventSchema.safeParse(event).success)).toBe(true);
    });

    it('replays a JSON-round-tripped build sequence deterministically', () => {
        const initial = run({ peekCharges: 0 });
        const commands = [
            createGameplayDefinitionCommand('01-lens', 'bonus_reward.echo_conduit_lens'),
            createGameplayDefinitionCommand('02-relic', 'relic.peek_charge_plus_one'),
            createGameplayDefinitionCommand('03-combo', 'reward_perk.echo_conduit_double', {
                matchedTraits: ['echo'],
                adjacentTraits: ['conduit']
            }),
            createGameplayPeekCommand('04-peek', 'echo-a')
        ];
        const serialized = JSON.stringify(commands);
        const replayA = replayGameplayCommands(initial, JSON.parse(serialized) as unknown[]);
        const replayB = replayGameplayCommands(initial, JSON.parse(serialized) as unknown[]);

        expect(replayA).toEqual(replayB);
        expect(replayA.acceptedCommandIds).toEqual(['01-lens', '02-relic', '03-combo', '04-peek']);
        expect(replayA.rejectedCommandIds).toEqual([]);
        expect(replayA.run.peekCharges).toBe(2);
        expect(replayA.run.rewardPerkIds).toContain('echo_conduit_double');
        expect(JSON.parse(JSON.stringify(replayA.events))).toEqual(replayA.events);
    });

    it('rejects malformed and version-stale commands without mutating run state', () => {
        const initial = run();
        const malformed = reduceGameplayCommand(initial, { type: 'effects.apply' });
        const staleCommand = {
            ...createGameplayDefinitionCommand('stale', 'relic.peek_charge_plus_one'),
            definitionVersion: 99
        };
        const stale = reduceGameplayCommand(initial, staleCommand);

        expect(malformed.accepted).toBe(false);
        expect(malformed.run).toBe(initial);
        expect(stale.accepted).toBe(false);
        expect(stale.run).toBe(initial);
        expect(stale.events[0]).toMatchObject({ type: 'command.rejected', reason: expect.stringContaining('version mismatch') });
    });
});
