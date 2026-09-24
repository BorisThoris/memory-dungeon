import { describe, expect, it } from 'vitest';

import { applyBomb, bombTargetTileId } from './board-power-actions';
import type { RunState } from './contracts';
import { flipTile } from './game';
import { reduceGameplayCommand } from './gameplay-core';
import { createGameplayBombCommand } from './gameplay-core-contracts';
import { makeRun, makeTile } from './test/game-fixtures';

/*
 * The bomb (`applyBomb`, 2026-09-24): bought at the store stop, spent on the one card face up. Its
 * pair leaves the board - no score, no miss, no turn, the chain stands - and it may not take the
 * floor's last pair, because that pair is the clear.
 */
describe('the bomb', () => {
    const board = (): RunState =>
        makeRun(
            ['a', 'b', 'c'].flatMap((key) => [makeTile(`${key}-1`, key, key.toUpperCase()), makeTile(`${key}-2`, key, key.toUpperCase())]),
            { bombCharges: 1, missBank: [{ floor: 1, misses: 3 }] }
        );

    it('aims at the one card face up, and at nothing without one', () => {
        const run = board();
        expect(bombTargetTileId(run)).toBeNull();
        const flipped = flipTile(run, 'a-1');
        expect(bombTargetTileId(flipped)).toBe('a-1');
        expect(bombTargetTileId({ ...flipped, bombCharges: 0 })).toBeNull();
    });

    it('takes the pair off the board, and costs a bomb and nothing else', () => {
        const flipped: RunState = { ...flipTile(board(), 'a-1'), stats: { ...board().stats, currentStreak: 4 } };
        const after = applyBomb(flipped, 'a-1');
        expect(after.bombCharges).toBe(0);
        expect(after.board?.flippedTileIds).toEqual([]);
        expect(after.board?.tiles.filter((tile) => tile.pairKey === 'a').every((tile) => tile.state === 'removed')).toBe(true);
        expect(after.board?.matchedPairs).toBe(flipped.board!.matchedPairs + 1);
        // No miss, no turn, no score, and the chain stands.
        expect(after.stats.mismatches).toBe(flipped.stats.mismatches);
        expect(after.turnsThisFloor).toBe(flipped.turnsThisFloor);
        expect(after.stats.totalScore).toBe(flipped.stats.totalScore);
        expect(after.stats.currentStreak).toBe(4);
        expect(after.missBank).toEqual(flipped.missBank);
    });

    it('will not take the floor\'s last pair: that pair is the clear', () => {
        let run = board();
        run = {
            ...run,
            board: {
                ...run.board!,
                tiles: run.board!.tiles.map((tile) => (tile.pairKey === 'c' ? tile : { ...tile, state: 'matched' as const })),
                matchedPairs: 2
            }
        };
        const flipped = flipTile(run, 'c-1');
        expect(bombTargetTileId(flipped)).toBeNull();
        expect(applyBomb(flipped, 'c-1')).toBe(flipped);
    });

    it('is a journaled command: accepted with its events, refused with a reason', () => {
        const flipped = flipTile(board(), 'b-2');
        const accepted = reduceGameplayCommand(flipped, createGameplayBombCommand('bomb:test:1', 'b-2'));
        expect(accepted.accepted).toBe(true);
        expect(accepted.events.map((event) => event.type)).toEqual(['board.bombed', 'feedback.requested']);
        const refused = reduceGameplayCommand(board(), createGameplayBombCommand('bomb:test:2', 'b-2'));
        expect(refused.accepted).toBe(false);
    });
});
