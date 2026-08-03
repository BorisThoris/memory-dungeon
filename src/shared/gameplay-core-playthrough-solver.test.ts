import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-build-rules';
import { solveRunThroughGameplayCoreWithTrace } from './gameplay-core-playthrough-solver';
import { createNewRun, finishMemorizePhase } from './game-core';
import { solveRunByExhaustingPlayablePairsWithTrace } from './playthrough-solver';
import { createGeneratedBoardSolverRun } from './softlock-generator-contract';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    state,
    symbol: id,
    label: id
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    level: 1,
    pairCount: 1,
    columns: 2,
    rows: 2,
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null,
    ...overrides
});

const runWithBoard = (candidate: BoardState): RunState => ({
    ...finishMemorizePhase(createNewRun(0, { gameMode: 'puzzle', runSeed: 4_412 })),
    board: candidate,
    status: 'playing'
});

const gameplayStateWithoutJournals = (run: RunState): RunState => {
    const {
        gameplayCommandJournal: _gameplayCommandJournal,
        gameplayEventJournal: _gameplayEventJournal,
        ...gameplayState
    } = run;
    return gameplayState as RunState;
};

describe('gameplay-core playthrough solver', () => {
    it('solves an exit board exclusively through replayable commands and events', () => {
        const exit = { ...tile('exit', EXIT_PAIR_KEY), dungeonCardKind: 'exit' as const };
        const initial = runWithBoard(board(
            [tile('a1', 'a'), tile('a2', 'a'), exit],
            { dungeonExitTileId: exit.id, dungeonExitActivated: false }
        ));
        const trace = solveRunThroughGameplayCoreWithTrace(initial);
        const legacy = solveRunByExhaustingPlayablePairsWithTrace(initial);

        expect(trace.stopReason).toBe('exit_attempted');
        expect(gameplayStateWithoutJournals(trace.run)).toEqual(gameplayStateWithoutJournals(legacy.run));
        expect(trace.run.status).toBe('levelComplete');
        expect(trace.commands.map((command) => command.type)).toEqual([
            'board.tile_flip',
            'board.tile_flip',
            'board.turn_resolve',
            'board.tile_flip',
            'dungeon.exit_activate'
        ]);
        expect(trace.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            'board.tile_flipped',
            'board.turn_resolved',
            'dungeon.exit_activated',
            'feedback.requested'
        ]));
        expect(trace.acceptedCommandIds).toHaveLength(trace.commands.length);
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.replayVerified).toBe(true);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('spends typed keys on an affordable locked cache and alternate exit only when lock policy opts in', () => {
        const primaryExit: Tile = {
            ...tile('exit-primary', EXIT_PAIR_KEY),
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'none'
        };
        const lockedExit: Tile = {
            ...tile('exit-locked', EXIT_PAIR_KEY),
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'iron'
        };
        const lockedCache: Tile = {
            ...tile('cache', ROOM_PAIR_KEY),
            dungeonCardKind: 'room',
            dungeonCardEffectId: 'room_locked_cache',
            dungeonCardState: 'hidden',
            dungeonKeyKind: 'iron',
            dungeonRoomUsed: false
        };
        const initial: RunState = {
            ...runWithBoard(board(
                [tile('a1', 'a'), tile('a2', 'a'), lockedCache, primaryExit, lockedExit],
                {
                    columns: 3,
                    rows: 2,
                    dungeonExitTileId: primaryExit.id,
                    dungeonExitActivated: false,
                    dungeonExitLockKind: 'none'
                }
            )),
            dungeonKeys: { iron: 2 },
            dungeonMasterKeys: 1
        };
        const trace = solveRunThroughGameplayCoreWithTrace(initial, 40, true, {
            lockPolicy: { kind: 'prefer_affordable_lock_rewards' }
        });

        expect(trace.run.status).toBe('levelComplete');
        expect(trace.run.dungeonKeys.iron).toBe(0);
        expect(trace.run.dungeonMasterKeys).toBe(1);
        expect(trace.commands[0]).toMatchObject({ type: 'board.tile_flip', targetTileId: lockedCache.id });
        expect(trace.commands).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.tile_flip', targetTileId: lockedExit.id }),
            expect.objectContaining({ type: 'dungeon.exit_activate', spend: 'key' })
        ]));
        expect(trace.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'dungeon.locked_cache_opened',
                tileId: lockedCache.id,
                spend: 'key',
                keyKind: 'iron'
            }),
            expect.objectContaining({
                type: 'dungeon.exit_activated',
                exitTileId: lockedExit.id,
                spend: 'key',
                keyKind: 'iron'
            })
        ]));
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('visits a board vendor, pauses for a typed purchase, and spends Master Key on a locked exit', () => {
        const primaryExit: Tile = {
            ...tile('exit-primary', EXIT_PAIR_KEY),
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'none'
        };
        const lockedExit: Tile = {
            ...tile('exit-treasure', EXIT_PAIR_KEY),
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'treasure'
        };
        const shop: Tile = {
            ...tile('shop', SHOP_PAIR_KEY),
            dungeonCardKind: 'shop',
            dungeonCardEffectId: 'shop_vendor',
            dungeonCardState: 'hidden'
        };
        const initial: RunState = {
            ...runWithBoard(board(
                [tile('a1', 'a'), tile('a2', 'a'), shop, primaryExit, lockedExit],
                {
                    level: 10,
                    columns: 3,
                    rows: 2,
                    dungeonShopTileId: shop.id,
                    dungeonShopVisited: false,
                    dungeonExitTileId: primaryExit.id,
                    dungeonExitActivated: false,
                    dungeonExitLockKind: 'none'
                }
            )),
            shopGold: 10,
            shopOffers: [],
            shopRerolls: 0,
            dungeonKeys: {},
            dungeonMasterKeys: 0
        };
        const trace = solveRunThroughGameplayCoreWithTrace(initial, 40, true, {
            lockPolicy: { kind: 'prefer_affordable_lock_rewards' }
        });

        expect(trace.run.status).toBe('levelComplete');
        expect(trace.commands).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.tile_flip', targetTileId: shop.id }),
            expect.objectContaining({ type: 'run.pause' }),
            expect.objectContaining({ type: 'shop.purchase' }),
            expect.objectContaining({ type: 'run.resume' }),
            expect.objectContaining({ type: 'board.tile_flip', targetTileId: lockedExit.id }),
            expect.objectContaining({ type: 'dungeon.exit_activate', spend: 'master_key' })
        ]));
        expect(trace.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'shop.offer_purchased',
                itemId: 'master_key',
                masterKeysBefore: 0,
                masterKeysAfter: 1
            }),
            expect.objectContaining({
                type: 'dungeon.exit_activated',
                exitTileId: lockedExit.id,
                spend: 'master_key',
                masterKeysBefore: 1,
                masterKeysAfter: 0
            })
        ]));
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('repairs a stale boss through a typed command before activating the exit', () => {
        const exit = { ...tile('exit', EXIT_PAIR_KEY, 'flipped'), dungeonCardKind: 'exit' as const };
        const initial = runWithBoard(board(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), exit],
            {
                dungeonBossId: 'trap_warden',
                dungeonExitTileId: exit.id,
                dungeonObjectiveId: 'defeat_boss',
                enemyHazards: [{
                    bossId: 'trap_warden',
                    currentTileId: 'a1',
                    damage: 1,
                    hp: 1,
                    id: 'stale-warden',
                    kind: 'warden',
                    label: 'Stale Warden',
                    maxHp: 1,
                    nextTileId: 'a2',
                    pattern: 'guard',
                    state: 'revealed'
                }],
                matchedPairs: 1
            }
        ));
        const trace = solveRunThroughGameplayCoreWithTrace(initial);
        const legacy = solveRunByExhaustingPlayablePairsWithTrace(initial);

        expect(gameplayStateWithoutJournals(trace.run)).toEqual(gameplayStateWithoutJournals(legacy.run));
        expect(trace.commands.map((command) => command.type)).toEqual([
            'run.progression_repair',
            'dungeon.exit_activate'
        ]);
        expect(trace.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'run.progression_repaired' }),
            expect.objectContaining({ type: 'dungeon.exit_activated' })
        ]));
        expect(trace.run.board?.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('matches the legacy solver across seeded generated boards before consumer migration', () => {
        for (const seed of [42_001, 42_077]) {
            for (const floor of [1, 5, 10]) {
                const generated = buildBoard(floor, {
                    runSeed: seed,
                    runRulesVersion: GAME_RULES_VERSION,
                    gameMode: 'endless'
                });
                const initial = createGeneratedBoardSolverRun(generated, seed, GAME_RULES_VERSION);
                const core = solveRunThroughGameplayCoreWithTrace(initial);
                const legacy = solveRunByExhaustingPlayablePairsWithTrace(initial);

                expect(gameplayStateWithoutJournals(core.run), `run ${seed}/${floor}`).toEqual(
                    gameplayStateWithoutJournals(legacy.run)
                );
                expect(core.stopReason, `stop ${seed}/${floor}`).toBe(legacy.stopReason);
                expect(core.rejectedCommandIds, `rejections ${seed}/${floor}`).toEqual([]);
                expect(core.replayVerified, `replay checked ${seed}/${floor}`).toBe(true);
                expect(core.replayDeterministic, `replay ${seed}/${floor}`).toBe(true);
                expect(core.invariantViolations, `invariants ${seed}/${floor}`).toEqual([]);
            }
        }
    });

    it('can execute every command invariant while deferring replay to a sampled gate floor', () => {
        const generated = buildBoard(25, {
            runSeed: 42_001,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless'
        });
        const trace = solveRunThroughGameplayCoreWithTrace(
            createGeneratedBoardSolverRun(generated, 42_001, GAME_RULES_VERSION),
            160,
            false
        );

        expect(trace.run.status).toBe('levelComplete');
        expect(trace.replayVerified).toBe(false);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('solves from a capped observation ledger without grouping unknown hidden identities', () => {
        const initial = runWithBoard(board(
            [
                tile('1-a', 'a'),
                tile('2-b', 'b'),
                tile('3-c', 'c'),
                tile('4-a', 'a'),
                tile('5-b', 'b'),
                tile('6-c', 'c')
            ],
            { pairCount: 3, columns: 3, rows: 2 }
        ));
        const trace = solveRunThroughGameplayCoreWithTrace(initial, 40, true, {
            informationPolicy: {
                kind: 'bounded_memory',
                memoryTileCapacity: 2,
                uncertainTurnBudget: 4
            }
        });

        expect(trace.run.status).toBe('levelComplete');
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
        expect(trace.information).toMatchObject({
            kind: 'bounded_memory',
            memoryTileCapacity: 2,
            uncertainTurnBudget: 4,
            uncertainTurns: 2,
            initialPlayableTileCount: 6,
            initialRememberedTileIds: ['1-a', '4-a'],
            maximumRememberedTiles: 2,
            riskBudgetExhausted: false
        });
        expect(trace.information.observedTileIds).toEqual(expect.arrayContaining(['2-b', '3-c', '5-b', '6-c']));
        expect(trace.information.evictedTileIds).toContain('3-c');
        expect(trace.commands
            .filter((command) => command.type === 'board.tile_flip')
            .map((command) => command.targetTileId)
            .slice(2, 4)).toEqual(['2-b', '3-c']);
    });

    it('stops before an unsupported guess when the bounded risk budget is spent', () => {
        const initial = runWithBoard(board(
            [
                tile('1-a', 'a'),
                tile('2-b', 'b'),
                tile('3-c', 'c'),
                tile('4-a', 'a'),
                tile('5-b', 'b'),
                tile('6-c', 'c')
            ],
            { pairCount: 3, columns: 3, rows: 2 }
        ));
        const trace = solveRunThroughGameplayCoreWithTrace(initial, 40, true, {
            informationPolicy: {
                kind: 'bounded_memory',
                memoryTileCapacity: 2,
                uncertainTurnBudget: 1
            }
        });

        expect(trace.stopReason).toBe('risk_budget_exhausted');
        expect(trace.run.status).toBe('playing');
        expect(trace.information).toMatchObject({
            kind: 'bounded_memory',
            uncertainTurns: 1,
            riskBudgetExhausted: true
        });
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('commits one replayable Gambit on the first identity-blind uncertain mismatch', () => {
        const initial = runWithBoard(board(
            [
                tile('1-a', 'a'),
                tile('2-b', 'b'),
                tile('3-c', 'c'),
                tile('4-a', 'a'),
                tile('5-b', 'b'),
                tile('6-c', 'c')
            ],
            { pairCount: 3, columns: 3, rows: 2 }
        ));
        const trace = solveRunThroughGameplayCoreWithTrace(initial, 40, true, {
            informationPolicy: {
                kind: 'bounded_memory',
                memoryTileCapacity: 2,
                uncertainTurnBudget: 4
            },
            gambitPolicy: { kind: 'first_uncertain_mismatch_rescue' }
        });

        expect(trace.run.status).toBe('levelComplete');
        expect(trace.gambitCommits).toBe(1);
        expect(trace.commands).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.gambit_commit', targetTileId: '3-c' })
        ]));
        expect(trace.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.gambit_commit.requested', targetTileId: '3-c' }),
            expect.objectContaining({ type: 'board.turn_resolved', outcome: 'gambit_match' })
        ]));
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('spends the floor Undo only after an identity-blind uncertain mismatch', () => {
        const initial = runWithBoard(board(
            [
                tile('1-a', 'a'),
                tile('2-b', 'b'),
                tile('3-c', 'c'),
                tile('4-a', 'a'),
                tile('5-b', 'b'),
                tile('6-c', 'c')
            ],
            { pairCount: 3, columns: 3, rows: 2 }
        ));
        const trace = solveRunThroughGameplayCoreWithTrace(initial, 40, true, {
            informationPolicy: {
                kind: 'bounded_memory',
                memoryTileCapacity: 2,
                uncertainTurnBudget: 4
            },
            recoveryPolicy: { kind: 'first_uncertain_mismatch_undo' }
        });

        expect(trace.run.status).toBe('levelComplete');
        expect(trace.undoResolveUses).toBe(1);
        expect(trace.commands).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.undo_resolve' })
        ]));
        expect(trace.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'board.resolve_undone',
                restoredTileIds: ['2-b', '6-c'],
                undoUsesBefore: 1,
                undoUsesAfter: 0
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.undo_resolve.used' })
        ]));
        expect(trace.rejectedCommandIds).toEqual([]);
        expect(trace.replayDeterministic).toBe(true);
        expect(trace.invariantViolations).toEqual([]);
    });

    it('retains explainable no-exit and no-progress terminal traces', () => {
        const noExit = solveRunThroughGameplayCoreWithTrace(runWithBoard(board(
            [tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched')],
            { matchedPairs: 1 }
        )));
        const noProgress = solveRunThroughGameplayCoreWithTrace(runWithBoard(board(
            [tile('a1', 'a', 'flipped'), tile('a2', 'a', 'flipped')],
            { flippedTileIds: [] }
        )));

        expect(noExit).toMatchObject({ stopReason: 'no_exit', commands: [], rejectedCommandIds: [] });
        expect(noProgress).toMatchObject({
            stopReason: 'no_progress',
            commands: [],
            rejectedCommandIds: [],
            lastPairKey: 'a',
            lastTileIds: ['a1', 'a2']
        });
        expect(noExit.replayDeterministic).toBe(true);
        expect(noProgress.replayDeterministic).toBe(true);
    });

    it('keeps generated-board fairness consumers on the command solver boundary', () => {
        const softlockSource = readFileSync(
            join(process.cwd(), 'src/shared/softlock-generator-contract.ts'),
            'utf8'
        );
        const endlessSource = readFileSync(
            join(process.cwd(), 'scripts/sim-endless.ts'),
            'utf8'
        );

        for (const source of [softlockSource, endlessSource]) {
            expect(source).toContain('solveRunThroughGameplayCoreWithTrace');
            expect(source).toContain('replayVerified');
            expect(source).toContain('replayDeterministic');
            expect(source).toContain('rejectedCommandIds');
            expect(source).toContain('invariantViolations');
            expect(source).not.toContain('solveRunByExhaustingPlayablePairsWithTrace');
        }
    });
});
