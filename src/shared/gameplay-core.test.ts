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
    GAMEPLAY_CONTENT_DEFINITIONS,
    GAMEPLAY_CORE_SCHEMA_VERSION,
    createGameplayDefinitionCommand,
    createGameplayBoardTurnResolveCommand,
    createGameplayDestroyPairCommand,
    createGameplayFlashPairCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayGambitCommitCommand,
    createGameplayPeekCommand,
    createGameplayRegionShuffleCommand,
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
        powersUsedThisRun: false,
        forgottenTileIdsThisFloor: [],
        pinnedTileIds: [],
        peekRevealedTileIds: [],
        stats: { totalScore: 0, currentLevelScore: 0, currentStreak: 0 },
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
        expect(GAMEPLAY_CONTENT_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'trait.conduit_echo_peek',
            'findable.score_glint'
        ]);
        expect(GAMEPLAY_CONTENT_DEFINITIONS.every((definition) => gameplayContentDefinitionSchema.safeParse(definition).success)).toBe(true);
        expect(
            gameplayCommandSchema.safeParse({
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: 'bad',
                type: 'effects.apply',
                definitionId: 'trait.conduit_echo_peek',
                definitionVersion: 1,
                facts: {},
                undocumentedMutation: true
            }).success
        ).toBe(false);
        expect(
            gameplayContentDefinitionSchema.safeParse({
                ...GAMEPLAY_CONTENT_DEFINITIONS[0],
                effects: [{ kind: 'inventory.grant', itemId: 'peek_charge', amount: 0 }]
            }).success
        ).toBe(false);
    });






    it('removes one legal pair through a typed command and records every consequential delta', () => {
        const initial = run({
            destroyPairCharges: 2,
            recallFocus: 2,
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

    it('advances a complete floor through one flat replayable command', () => {
        const fixtureRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const initial: RunState = {
            ...fixtureRun,
            destroyPairCharges: 0
        };
        const command = createGameplayFloorAdvanceCommand('floor-advance-flat');
        const legacy = advanceToNextLevel(initial);
        const result = reduceGameplayCommand(initial, command);

        expect(result).toMatchObject({ accepted: true, run: { status: 'memorize', runEndReason: null } });
        expect(result.run).toEqual(legacy);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'floor.advanced',
                commandId: command.commandId,
                fromFloor: initial.board!.level,
                toFloor: initial.board!.level + 1,
                outcome: 'memorize',
                boardPairCount: result.run.board!.pairCount,
                boardTileCount: result.run.board!.tiles.length
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
        expect(result.events.some((event) => event.type === 'feedback.requested' && /\blives?\b/i.test(event.message))).toBe(false);
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













    it('rejects unmet trait conditions atomically with an explainable event', () => {
        const initial = run();
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('bad-adjacency', 'trait.conduit_echo_peek', {
                matchedTraits: ['conduit'],
                adjacentTraits: []
            })
        );

        expect(result.accepted).toBe(false);
        expect(result.run).toBe(initial);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', reason: expect.stringContaining('echo was not adjacent') })
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
        const initial = run({ peekCharges: 1 });
        const commands = [
            createGameplayDefinitionCommand('01-peek', 'trait.conduit_echo_peek', {
                matchedTraits: ['conduit'],
                adjacentTraits: ['echo']
            }),
            createGameplayDefinitionCommand('02-glint', 'findable.score_glint', {
                matchedFindables: ['score_glint']
            }),
            createGameplayPeekCommand('03-peek', 'echo-a')
        ];
        const serialized = JSON.stringify(commands);
        const replayA = replayGameplayCommands(initial, JSON.parse(serialized) as unknown[]);
        const replayB = replayGameplayCommands(initial, JSON.parse(serialized) as unknown[]);

        expect(replayA).toEqual(replayB);
        expect(replayA.acceptedCommandIds).toEqual(['01-peek', '02-glint', '03-peek']);
        expect(replayA.rejectedCommandIds).toEqual([]);
        // One charge to start, one relayed by Conduit beside Echo, one spent on the peek.
        expect(replayA.run.peekCharges).toBe(1);
        expect(JSON.parse(JSON.stringify(replayA.events))).toEqual(replayA.events);
    });

    it('rejects malformed and version-stale commands without mutating run state', () => {
        const initial = run();
        const malformed = reduceGameplayCommand(initial, { type: 'effects.apply' });
        const staleCommand = {
            ...createGameplayDefinitionCommand('stale', 'trait.conduit_echo_peek'),
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
