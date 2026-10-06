import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { createGameplayReflowCommand, createGameplayTileFlipCommand, createGameplayBoardTurnResolveCommand, gameplayEventSchema } from './gameplay-core-contracts';
import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase } from './game-core';
import { reflowRunBoard } from './board-layout-rules';

describe('board reflow', () => {
    it('replays layout changes and a match with the same adjacency and score', () => {
        const initial = finishMemorizePhase(createNewRun(0));
        const first = initial.board!.tiles[0]!;
        const twin = initial.board!.tiles.find(tile => tile.id !== first.id && tile.pairKey === first.pairKey)!;
        const commands = [createGameplayReflowCommand('portrait', 1), createGameplayReflowCommand('landscape', 8),
            createGameplayTileFlipCommand('a', first.id), createGameplayTileFlipCommand('b', twin.id), createGameplayBoardTurnResolveCommand('resolve')];
        let run = initial;
        const events = commands.flatMap(command => {
            const result = reduceGameplayCommand(run, command);
            expect(result.accepted).toBe(true);
            run = result.run;
            return result.events;
        });
        expect(events.filter(event => event.type === 'board.reflowed')).toHaveLength(2);
        expect(events.every(event => gameplayEventSchema.safeParse(event).success)).toBe(true);
        const replay = replayGameplayCommands(initial, JSON.parse(JSON.stringify(commands)));
        expect(replay.rejectedCommandIds).toEqual([]);
        expect(replay.run).toEqual(run);
        expect(replay.events).toEqual(events);
    });

    it('changes the canonical grid without redealing cards, selection, or ground', () => {
        const run = finishMemorizePhase(createNewRun(0));
        run.board!.elementalGround = ['ember', null];
        run.board!.flippedTileIds = [run.board!.tiles[0]!.id];
        const next = reflowRunBoard(run, 2);
        expect(next.board!.columns).toBe(2);
        expect(next.board!.rows).toBe(Math.ceil(run.board!.tiles.length / 2));
        expect(next.board!.tiles).toBe(run.board!.tiles);
        expect(next.board!.flippedTileIds).toBe(run.board!.flippedTileIds);
        expect(next.board!.elementalGround).toBe(run.board!.elementalGround);
        expect(next.stats).toBe(run.stats);
        expect(reflowRunBoard(next, 2)).toBe(next);
    });
    it('defers during resolution and ignores invalid grids', () => {
        const run = finishMemorizePhase(createNewRun(0));
        const resolving = { ...run, status: 'resolving' as const };
        expect(reflowRunBoard(resolving, 1)).toBe(resolving);
        const paused = { ...run, status: 'paused' as const, timerState: { ...run.timerState, pausedFromStatus: 'playing' as const } };
        expect(reflowRunBoard(paused, 1).board!.columns).toBe(1);
        const pausedResolving = { ...paused, timerState: { ...paused.timerState, pausedFromStatus: 'resolving' as const } };
        expect(reflowRunBoard(pausedResolving, 1)).toBe(pausedResolving);
        for (const columns of [0, -1, 1.5, Infinity, NaN, 10000]) expect(reflowRunBoard(run, columns)).toBe(run);
    });
});
