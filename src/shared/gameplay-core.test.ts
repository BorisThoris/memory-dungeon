import { describe, expect, it } from 'vitest';
import {
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyTileSwap,
    cancelResolvingWithUndo
} from './board-power-actions';
import {
    type BoardState,
    type RunState,
    type Tile
} from './contracts';
import {
    CONDUIT_CARTOGRAPHER_DEFINITIONS,
    BOARD_TACTICIAN_DEFINITIONS,
    GAMEPLAY_CORE_SCHEMA_VERSION,
    SUPPLY_CACHE_DEFINITIONS,
    createGameplayDefinitionCommand,
    createGameplayBoardTurnResolveCommand,
    createGameplayDestroyPairCommand,
    createGameplayFlashPairCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayGambitCommitCommand,
    createGameplayParasiteAdvanceCommand,
    createGameplayPeekCommand,
    createGameplayRegionShuffleCommand,
    createGameplayRelicPickCommand,
    createGameplayRelicOfferOpenCommand,
    createGameplayRelicOfferServiceCommand,
    createGameplayShuffleCommand,
    createGameplayTileSwapCommand,
    createGameplayUndoResolveCommand,
    createGameplayWildMatchConsumeCommand,
    gameplayCommandSchema,
    gameplayContentDefinitionSchema,
    gameplayEventSchema
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { createNewRun } from './game';
import { WILD_PAIR_KEY } from './tile-identity';
import { createPlayablePathFixture } from './playable-path-fixtures';
import { advanceToNextLevel } from './next-floor-transition-rules';

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
        pinnedTileIds: [],
        peekRevealedTileIds: [],
        stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 0 },
        ...overrides
    }) as RunState;

describe('deterministic gameplay core', () => {
    it('resolves a non-final match through one replayable outer turn command', () => {
        const initial = run({
            status: 'resolving',
            board: {
                ...board(),
                pairCount: 2,
                matchedPairs: 0,
                flippedTileIds: ['a1', 'a2'],
                tiles: [
                    { ...tile('a1', 'a'), state: 'flipped', findableKind: 'score_glint' },
                    { ...tile('a2', 'a'), state: 'flipped', findableKind: 'score_glint' },
                    tile('b1', 'b'),
                    tile('b2', 'b')
                ]
            },
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 1
        });
        const command = createGameplayBoardTurnResolveCommand('turn-1');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.command).toEqual(command);
        expect(result.run.board?.matchedPairs).toBe(1);
        expect(result.run.findablesClaimedThisFloor).toBe(1);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'score.requested', reason: 'findable_match', amount: 25 }),
            expect.objectContaining({
                type: 'board.turn_resolved',
                outcome: 'match',
                flippedTileIds: ['a1', 'a2'],
                matchedPairKey: 'a',
                boardComplete: false
            })
        ]));
        expect(result.events.every((event) => event.commandId === command.commandId)).toBe(true);
        expect(result.events.map((event) => event.sequence)).toEqual(
            result.events.map((_, sequence) => sequence)
        );

        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(replayed.acceptedCommandIds).toEqual(['turn-1']);
    });

    it('resolves the final pair and floor-clear effects under the same outer turn command', () => {
        const base = createNewRun(0, { runSeed: 9137 });
        const initial: RunState = {
            ...base,
            status: 'resolving',
            board: {
                ...board(),
                pairCount: 1,
                matchedPairs: 0,
                flippedTileIds: ['a1', 'a2'],
                tiles: [
                    { ...tile('a1', 'a'), state: 'flipped', findableKind: 'score_glint' },
                    { ...tile('a2', 'a'), state: 'flipped', findableKind: 'score_glint' }
                ]
            },
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 1
        };
        const command = createGameplayBoardTurnResolveCommand('final-turn');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.run.status).toBe('levelComplete');
        expect(result.run.board?.matchedPairs).toBe(1);
        expect(result.run.findablesClaimedThisFloor).toBe(1);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'score.requested', reason: 'findable_match', amount: 25 }),
            expect.objectContaining({
                type: 'board.turn_resolved',
                outcome: 'match',
                boardComplete: true,
                statusAfter: 'levelComplete'
            })
        ]));
        expect(result.events.every((event) => event.commandId === command.commandId)).toBe(true);

        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(replayed.acceptedCommandIds).toEqual(['final-turn']);
    });


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





    it('models Supply Cache as one typed emergency-tool claim across reveal, removal, and score', () => {
        expect(SUPPLY_CACHE_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.supply_cache'
        ]);
        const initial = run({ peekCharges: 0, destroyPairCharges: 0 });
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('supply-cache', 'bonus_reward.supply_cache')
        );

        expect(result).toMatchObject({
            accepted: true,
            run: {
                peekCharges: 1,
                destroyPairCharges: 1,
                stats: { totalScore: 10, currentLevelScore: 10 }
            }
        });
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'destroy_charge', applied: 1 }),
            expect.objectContaining({ type: 'inventory.changed', itemId: 'peek_charge', applied: 1 }),
            expect.objectContaining({ type: 'score.changed', reason: 'content_reward', amount: 10 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.supply_cache.claimed' })
        ]);
    });

    it('removes one legal pair through a typed command and records every consequential delta', () => {
        const initial = run({
            destroyPairCharges: 2,
            recallFocus: 2,
            parasiteFloors: 3,
            activeMutators: ['score_parasite'],
            shiftingSpotlightNonce: 0
        });
        const command = createGameplayDestroyPairCommand('destroy-echo', 'echo-a');
        const result = reduceGameplayCommand(initial, command);
        const rejected = reduceGameplayCommand(
            { ...initial, activeContract: { noDestroy: true, noShuffle: false, maxMismatches: null } },
            createGameplayDestroyPairCommand('destroy-blocked', 'echo-a')
        );

        expect(result).toMatchObject({
            accepted: true,
            run: {
                destroyPairCharges: 1,
                destroyUsedThisFloor: true,
                recallFocus: 1,
                parasiteFloors: 0,
                board: { matchedPairs: 1 },
                stats: { matchesFound: 1, pairsDestroyed: 1 }
            }
        });
        expect(result.run.board?.tiles.filter((candidate) => candidate.pairKey === 'echo'))
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ id: 'echo-a', state: 'matched' }),
                expect.objectContaining({ id: 'echo-b', state: 'matched' })
            ]));
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'inventory.changed',
                itemId: 'destroy_charge',
                operation: 'consume',
                before: 2,
                after: 1,
                applied: -1
            }),
            expect.objectContaining({
                type: 'board.pair_destroyed',
                targetTileId: 'echo-a',
                pairKey: 'echo',
                destroyedTileIds: ['echo-a', 'echo-b'],
                matchedPairsBefore: 0,
                matchedPairsAfter: 1,
                recallFocusBefore: 2,
                recallFocusAfter: 1,
                parasitePressureBefore: 3,
                parasitePressureAfter: 0,
                boardComplete: false
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.destroy_pair.used' })
        ]);
        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]).run).toEqual(result.run);
        expect(rejected).toMatchObject({ accepted: false, run: { destroyPairCharges: 2 } });

        const finalBase = createNewRun(0, { runSeed: 4412 });
        const finalRun: RunState = {
            ...finalBase,
            status: 'playing',
            destroyPairCharges: 1,
            board: {
                ...board(),
                pairCount: 1,
                matchedPairs: 0,
                tiles: [tile('final-a', 'final'), tile('final-b', 'final')]
            }
        };
        const finalCommand = createGameplayDestroyPairCommand('destroy-final', 'final-a');
        const finalResult = reduceGameplayCommand(finalRun, finalCommand);
        expect(finalResult).toMatchObject({
            accepted: true,
            run: { status: 'levelComplete', board: { matchedPairs: 1 } },
            events: expect.arrayContaining([
                expect.objectContaining({ type: 'board.pair_destroyed', boardComplete: true })
            ])
        });
        expect(finalResult.run.gameplayCommandJournal).toEqual(finalRun.gameplayCommandJournal);
        expect(replayGameplayCommands(
            finalRun,
            [JSON.parse(JSON.stringify(finalCommand))]
        )).toMatchObject({
            run: finalResult.run,
            events: finalResult.events,
            acceptedCommandIds: ['destroy-final']
        });
    });

    it('advances score-parasite pressure through a typed floor command and records ward or life outcomes', () => {
        const warded = run({
            status: 'levelComplete',
            activeMutators: ['score_parasite'],
            parasiteFloors: 3,
            parasiteWardRemaining: 1,
            lives: 2
        });
        const protectedResult = reduceGameplayCommand(
            warded,
            createGameplayParasiteAdvanceCommand('parasite-warded')
        );
        const hitResult = reduceGameplayCommand(
            { ...warded, parasiteWardRemaining: 0 },
            createGameplayParasiteAdvanceCommand('parasite-hit')
        );

        expect(protectedResult).toMatchObject({
            accepted: true,
            run: { parasiteFloors: 0, parasiteWardRemaining: 0, lives: 2 }
        });
        expect(protectedResult.events).toEqual([
            expect.objectContaining({
                type: 'score_parasite.advanced',
                thresholdTriggered: true,
                wardConsumed: true,
                lifeLost: false
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'hazard.score_parasite.ward_consumed'
            })
        ]);
        expect(hitResult).toMatchObject({
            accepted: true,
            run: { parasiteFloors: 0, parasiteWardRemaining: 0, lives: 1 }
        });
        expect(hitResult.events).toEqual([
            expect.objectContaining({
                type: 'score_parasite.advanced',
                thresholdTriggered: true,
                wardConsumed: false,
                lifeLost: true
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'hazard.score_parasite.life_lost'
            })
        ]);
    });

    it('advances a complete floor through one flat replayable command', () => {
        const fixtureRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const initial: RunState = {
            ...fixtureRun,
            activeMutators: ['score_parasite'],
            parasiteFloors: 3,
            parasiteWardRemaining: 1,
            destroyPairCharges: 0
        };
        const command = createGameplayFloorAdvanceCommand('floor-advance-flat');
        const legacy = advanceToNextLevel(initial);
        const result = reduceGameplayCommand(initial, command);

        expect(result).toMatchObject({ accepted: true, run: { status: 'memorize', parasiteFloors: 0 } });
        expect(result.run).toEqual(legacy);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'score_parasite.advanced',
                commandId: command.commandId,
                wardConsumed: true,
                lifeLost: false
            }),
            expect.objectContaining({
                type: 'floor.advanced',
                commandId: command.commandId,
                fromFloor: initial.board!.level,
                toFloor: initial.board!.level + 1,
                outcome: 'memorize',
                hazardBanishOutcome: null,
                boardPairCount: result.run.board!.pairCount,
                boardTileCount: result.run.board!.tiles.length,
                livesBefore: initial.lives,
                livesAfter: result.run.lives,
                parasitePressureBefore: 3,
                parasitePressureAfter: 0,
                parasiteWardBefore: 1,
                parasiteWardAfter: 0
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                source: { kind: 'system', id: 'floor_advance' },
                cue: 'floor.advance.ready'
            })
        ]));
        expect(result.events.every((event, sequence) =>
            event.commandId === command.commandId &&
            event.sequence === sequence &&
            event.eventId === `${command.commandId}:${sequence}`
        )).toBe(true);
        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]).run).toEqual(result.run);

        const defeated = reduceGameplayCommand(
            { ...initial, lives: 1, parasiteWardRemaining: 0 },
            createGameplayFloorAdvanceCommand('floor-advance-defeated')
        );
        expect(defeated).toMatchObject({ accepted: true, run: { status: 'gameOver', lives: 0 } });
        expect(defeated.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'floor.advanced', outcome: 'game_over', boardPairCount: 0 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'floor.advance.defeated', tone: 'warning' })
        ]));
    });

    it('consumes exactly one Wild Match token for a resolved wildcard bridge', () => {
        const wildcardRun = run({
            wildMatchesRemaining: 2,
            board: {
                ...board(),
                pairCount: 1,
                tiles: [
                    { ...tile('wild', WILD_PAIR_KEY), state: 'flipped' },
                    { ...tile('symbol', 'symbol'), state: 'flipped' },
                    tile('symbol-mate', 'symbol')
                ],
                flippedTileIds: ['wild', 'symbol']
            }
        });
        const result = reduceGameplayCommand(
            wildcardRun,
            createGameplayWildMatchConsumeCommand('wild-consume', 'wild', 'symbol')
        );
        const rejected = reduceGameplayCommand(
            wildcardRun,
            createGameplayWildMatchConsumeCommand('wild-hidden', 'wild', 'symbol-mate')
        );

        expect(result).toMatchObject({ accepted: true, run: { wildMatchesRemaining: 1 } });
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'inventory.changed',
                itemId: 'wild_match_token',
                operation: 'consume',
                before: 2,
                after: 1,
                applied: -1
            }),
            expect.objectContaining({
                type: 'wild_match.consumed',
                wildTileId: 'wild',
                pairedTileId: 'symbol',
                tokensBefore: 2,
                tokensAfter: 1
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'wild_joker.match_consumed' })
        ]);
        expect(rejected).toMatchObject({ accepted: false, run: wildcardRun });
    });







    it('rejects every relic draft command with a reason now that there is no draft', () => {
        // Gen 175: the draft is gone. An old journal that opens, picks from or services an
        // offer still replays, each of those commands recorded as rejected rather than lost.
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const commands = [
            createGameplayRelicOfferOpenCommand('relic-open-gone'),
            createGameplayRelicPickCommand('relic-pick-gone', 'extra_shuffle_charge'),
            createGameplayRelicOfferServiceCommand('relic-service-gone', 'reroll_offer')
        ];
        for (const command of commands) {
            const result = reduceGameplayCommand(run, command);
            expect(result).toMatchObject({ accepted: false, run });
            expect(result.events).toEqual([
                expect.objectContaining({ type: 'command.rejected', reason: expect.stringMatching(/relic draft/) })
            ]);
        }
        expect(run.relicOffer).toBeNull();
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


    it('validates and records a Gambit third-flip commitment without preempting board resolution', () => {
        const gambitBoard = board();
        gambitBoard.flippedTileIds = ['echo-a', 'conduit-a'];
        gambitBoard.tiles = gambitBoard.tiles.map((candidate) =>
            gambitBoard.flippedTileIds.includes(candidate.id)
                ? { ...candidate, state: 'flipped' as const }
                : candidate
        );
        const initial = run({
            status: 'resolving',
            board: gambitBoard,
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false
        });
        const result = reduceGameplayCommand(
            initial,
            createGameplayGambitCommitCommand('commit-gambit', 'echo-b')
        );

        expect(result.accepted).toBe(true);
        expect(result.run).toBe(initial);
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'board.gambit_commit.requested',
                targetTileId: 'echo-b',
                committedTileIds: ['echo-a', 'conduit-a', 'echo-b']
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.gambit.committed' })
        ]);

        const rejected = reduceGameplayCommand(
            { ...initial, gambitThirdFlipUsed: true },
            createGameplayGambitCommitCommand('spent-gambit', 'echo-b')
        );
        expect(rejected.accepted).toBe(false);
        expect(rejected.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', reason: expect.stringContaining('cannot commit') })
        ]);
    });

    it('models the complete Board Tactician reward and relic source set', () => {
        expect(BOARD_TACTICIAN_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.trait_toolkit',
            'bonus_reward.stasis_lockbox',
            'bonus_reward.free_swap_floor',
            'relic.extra_shuffle_charge',
            'relic.first_shuffle_free_per_floor',
            'relic.region_shuffle_free_first'
        ]);
        expect(BOARD_TACTICIAN_DEFINITIONS.every(
            (definition) => gameplayContentDefinitionSchema.safeParse(definition).success
        )).toBe(true);

        const toolkit = reduceGameplayCommand(
            run({ regionShuffleCharges: 0, peekCharges: 0 }),
            createGameplayDefinitionCommand('toolkit', 'bonus_reward.trait_toolkit')
        );
        expect(toolkit.run).toMatchObject({ regionShuffleCharges: 1, peekCharges: 1 });
        expect(toolkit.run.stats.totalScore).toBe(10);

        const lockbox = reduceGameplayCommand(
            run({ regionShuffleCharges: 0 }),
            createGameplayDefinitionCommand('lockbox', 'bonus_reward.stasis_lockbox')
        );
        expect(lockbox.run.regionShuffleCharges).toBe(1);
        expect(lockbox.run.stats.guardTokens).toBe(1);
        expect(lockbox.run.stats.totalScore).toBe(15);

        const discipline = reduceGameplayCommand(
            run(),
            createGameplayDefinitionCommand('discipline', 'bonus_reward.free_swap_floor')
        );
        expect(discipline.run.rewardPerkIds).toContain('free_first_swap_per_floor');
        expect(discipline.run.stats.totalScore).toBe(15);

        const shuffleRelic = reduceGameplayCommand(
            run({ shuffleCharges: 0 }),
            createGameplayDefinitionCommand('shuffle-relic', 'relic.extra_shuffle_charge')
        );
        expect(shuffleRelic.run.shuffleCharges).toBe(1);

        const freeShuffleRelic = reduceGameplayCommand(
            run({ freeShuffleThisFloor: false }),
            createGameplayDefinitionCommand('free-shuffle-relic', 'relic.first_shuffle_free_per_floor')
        );
        expect(freeShuffleRelic.run.freeShuffleThisFloor).toBe(true);
        expect(freeShuffleRelic.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'free_shuffle.changed', before: false, after: true })
        ]));

        const regionRelic = reduceGameplayCommand(
            run(),
            createGameplayDefinitionCommand('region-relic', 'relic.region_shuffle_free_first')
        );
        expect(regionRelic.run).toEqual(run());
        expect(regionRelic.events).toEqual([
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'build.region_shuffle_free_first.claimed'
            })
        ]);
    });

    it('preserves deterministic shuffle, row-shuffle, and tile-swap parity with typed consumption events', () => {
        const initial = run({
            board: {
                ...board(),
                tiles: board().tiles.map((candidate) =>
                    candidate.id === 'plain-a' ? { ...candidate, pairKey: 'conduit' } : candidate
                )
            },
            shuffleCharges: 1,
            regionShuffleCharges: 2,
            shuffleNonce: 0,
            freeShuffleThisFloor: false,
            regionShuffleFreeThisFloor: false,
            pinnedTileIds: [],
            forgottenTileIdsThisFloor: [],
            matchScoreMultiplier: 1,
            shuffleScoreTaxActive: false
        });

        const shuffled = reduceGameplayCommand(initial, createGameplayShuffleCommand('shuffle-board'));
        expect(shuffled.accepted).toBe(true);
        expect(shuffled.run).toEqual(applyShuffle(initial));
        expect(shuffled.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'shuffle_charge', applied: -1 }),
            expect.objectContaining({ type: 'board.shuffled', shuffleNonceBefore: 0, shuffleNonceAfter: 1 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.shuffle.used' })
        ]);

        const regionShuffled = reduceGameplayCommand(
            initial,
            createGameplayRegionShuffleCommand('shuffle-row', 0)
        );
        expect(regionShuffled.accepted).toBe(true);
        expect(regionShuffled.run).toEqual(applyRegionShuffle(initial, 0));
        expect(regionShuffled.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'region_shuffle_charge', applied: -1 }),
            expect.objectContaining({ type: 'board.region_shuffled', rowIndex: 0 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.region_shuffle.used' })
        ]);

        const swapped = reduceGameplayCommand(
            initial,
            createGameplayTileSwapCommand('swap-tiles', 'echo-a', 'conduit-a')
        );
        expect(swapped.accepted).toBe(true);
        expect(swapped.run).toEqual(applyTileSwap(initial, 'echo-a', 'conduit-a'));
        expect(swapped.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'region_shuffle_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.tiles_swapped',
                firstTileId: 'echo-a',
                secondTileId: 'conduit-a'
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.tile_swap.used' })
        ]);
    });


    it('preserves Flash Pair and Undo parity while journaling exact recovery deltas', () => {
        const flashRun = run({
            practiceMode: true,
            flashPairCharges: 1,
            flashPairRevealedTileIds: [],
            shuffleNonce: 0
        });
        const flashed = reduceGameplayCommand(flashRun, createGameplayFlashPairCommand('flash-pair'));
        expect(flashed.accepted).toBe(true);
        expect(flashed.run).toEqual(applyFlashPair(flashRun));
        expect(flashed.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'flash_pair_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.flash_pair_revealed',
                revealedTileIds: ['echo-a', 'echo-b'],
                shuffleNonceBefore: 0,
                shuffleNonceAfter: 1
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.flash_pair.used' })
        ]);

        const resolvingBoard = board();
        resolvingBoard.flippedTileIds = ['echo-a', 'conduit-a'];
        resolvingBoard.tiles = resolvingBoard.tiles.map((candidate) =>
            resolvingBoard.flippedTileIds.includes(candidate.id)
                ? { ...candidate, state: 'flipped' as const }
                : candidate
        );
        const undoRun = run({
            status: 'resolving',
            board: resolvingBoard,
            undoUsesThisFloor: 1,
            recallFocus: 2,
            forgottenTileIdsThisFloor: []
        });
        const undone = reduceGameplayCommand(undoRun, createGameplayUndoResolveCommand('undo-resolve'));
        expect(undone.accepted).toBe(true);
        expect(undone.run).toEqual(cancelResolvingWithUndo(undoRun));
        expect(undone.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'undo_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.resolve_undone',
                restoredTileIds: ['echo-a', 'conduit-a'],
                undoUsesBefore: 1,
                undoUsesAfter: 0,
                recallFocusBefore: 2,
                recallFocusAfter: 1
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.undo_resolve.used' })
        ]);
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
