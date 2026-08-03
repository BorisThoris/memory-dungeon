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
import { EXIT_PAIR_KEY } from './tile-identity';

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
