import { describe, expect, it } from 'vitest';
import { getFinalPair, revealFinalPair } from './final-pair-rules';
import { makePair, makeRun } from './test/game-fixtures';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { createGameplayBoardTurnResolveCommand, createGameplayFinalPairRevealCommand, createGameplayTileFlipCommand, gameplayEventSchema } from './gameplay-core-contracts';

describe('automatic final pair', () => {
    it('only selects the two remaining compatible cards', () => {
        const pair = makePair('ember', 'ember');
        const cleared = makePair('bone', 'bone').map(tile => ({ ...tile, state: 'matched' as const }));
        const run = makeRun([...cleared, ...pair]);
        expect(getFinalPair(run)?.map(tile => tile.id)).toEqual(pair.map(tile => tile.id));
        expect(getFinalPair(makeRun([...pair, ...makePair('tide', 'tide')]))).toBeNull();
        expect(getFinalPair(makeRun([pair[0], makePair('tide', 'tide')[0]]))).toBeNull();
        expect(getFinalPair(makeRun([pair[0]]))).toBeNull();
        expect(getFinalPair(makeRun(cleared))).toBeNull();
    });

    it('never starts during another phase', () => {
        const run = makeRun(makePair('ember', 'ember'));
        for (const status of ['paused', 'memorize', 'resolving', 'gameOver', 'levelComplete'] as const) {
            const waiting = { ...run, status };
            expect(revealFinalPair(waiting)).toBe(waiting);
        }
    });

    it('reveals a blocked last pair and does not duplicate an already flipped card in history', () => {
        const pair = makePair('ember', 'ember');
        const run = makeRun([{ ...pair[0], state: 'flipped', frost: 2 }, { ...pair[1], vined: true }]);
        run.board!.flippedTileIds = [pair[0].id];
        run.flipHistory = [pair[0].id];
        const next = revealFinalPair(run);
        expect(next.status).toBe('resolving');
        expect(next.board!.flippedTileIds).toEqual(pair.map(tile => tile.id));
        expect(next.flipHistory).toEqual(pair.map(tile => tile.id));
        expect(next.timerState.resolveRemainingMs).toBe(300);
        expect(revealFinalPair(next)).toBe(next);
        const reveal = reduceGameplayCommand(run, createGameplayFinalPairRevealCommand('blocked-last-pair'));
        expect(reveal.events.filter(event => event.type === 'board.tile_flipped')).toMatchObject([
            { tileId: pair[1].id, flippedCountAfter: 2 }
        ]);
        expect(reduceGameplayCommand(reveal.run, createGameplayBoardTurnResolveCommand('finish')).run.status).toBe('levelComplete');
    });

    it('awards the same score, chain, rewards and clear as a manual match, and replays exactly', () => {
        const pair = makePair('ember', 'ember');
        const initial = makeRun(pair);
        const commands = [createGameplayFinalPairRevealCommand('last-pair'), createGameplayBoardTurnResolveCommand('resolve')];
        const automatic = replayGameplayCommands(initial, commands);
        const manual = replayGameplayCommands(initial, [createGameplayTileFlipCommand('first', pair[0].id),
            createGameplayTileFlipCommand('second', pair[1].id), createGameplayBoardTurnResolveCommand('resolve')]);
        expect(automatic.rejectedCommandIds).toEqual([]);
        expect(automatic.run.status).toBe('levelComplete');
        expect(automatic.run.stats).toEqual(manual.run.stats);
        expect(automatic.run.lastLevelResult).toEqual(manual.run.lastLevelResult);
        expect(automatic.events.every(event => gameplayEventSchema.safeParse(event).success)).toBe(true);
        expect(automatic.events.filter(event => event.type === 'board.turn_resolved')).toHaveLength(1);
        expect(replayGameplayCommands(initial, JSON.parse(JSON.stringify(commands)))).toEqual(automatic);
        expect(reduceGameplayCommand(automatic.run, commands[0]).accepted).toBe(false);
    });
});
