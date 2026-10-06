import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { makeRun, makeTile } from '../../shared/test/game-fixtures';
import { collectBoardParticleCues, particleBoardChanged } from './boardParticleCues';

const board = (): BoardState => makeRun([
    makeTile('a1', 'a', 'A'), makeTile('a2', 'a', 'A'),
    makeTile('b1', 'b', 'B'), makeTile('b2', 'b', 'B')
]).board!;

describe('card transitions feed the particle system', () => {
    it('checks maximum-size boards and shuffled boards in linear identity work', () => {
        let reads = 0;
        const tiles = Array.from({ length: 8192 }, (_, index) => {
            const tile = makeTile(`card-${index}`, `pair-${Math.floor(index / 2)}`, 'A');
            Object.defineProperty(tile, 'id', { get: () => { reads += 1; return `card-${index}`; } });
            return tile;
        });
        const before = { ...board(), tiles };
        expect(particleBoardChanged(before, { ...before, tiles: [...tiles] })).toBe(false);
        expect(reads).toBeLessThanOrEqual(tiles.length * 2);
        reads = 0;
        expect(particleBoardChanged(before, { ...before, tiles: [...tiles].reverse() })).toBe(false);
        expect(reads).toBeLessThanOrEqual(tiles.length * 3);
        expect(particleBoardChanged(before, { ...before, tiles: [...tiles.slice(1), makeTile('new-card', 'new', 'A')] })).toBe(true);
    });

    it('emits both bomb sites even when React batches the opening flip and bomb together', () => {
        const before = board();
        const after: BoardState = { ...before, matchedPairs: 1, tiles: before.tiles.map((tile) =>
            tile.pairKey === 'a' ? { ...tile, state: 'removed' } : tile) };
        expect(collectBoardParticleCues(before, after)).toEqual([
            { tileId: 'a1', kind: 'bomb', delay: 0 }, { tileId: 'a2', kind: 'bomb', delay: 0 }
        ]);
        expect(collectBoardParticleCues(after, after)).toEqual([]);
        expect(collectBoardParticleCues(null, after)).toEqual([]);
    });

    it('distinguishes matches, chain pops, and ordinary flips', () => {
        const before = board();
        const after: BoardState = { ...before, tiles: before.tiles.map((tile, index) =>
            index === 0 ? { ...tile, state: 'flipped' } : index === 1 ? { ...tile, state: 'matched' } :
                index === 2 ? { ...tile, state: 'removed', brokenByChunk: true } : tile) };
        expect(collectBoardParticleCues(before, after).map((cue) => cue.kind)).toEqual(['flip', 'match', 'chain']);
        expect(collectBoardParticleCues(after, before)).toEqual([]);
    });

    it('resets on a new floor or run but not a shuffle or unchanged pause snapshot', () => {
        const before = board();
        expect(particleBoardChanged(before, { ...before, level: 2 })).toBe(true);
        expect(particleBoardChanged({ ...before, matchedPairs: 1 }, before)).toBe(true);
        expect(particleBoardChanged(before, { ...before, tiles: [...before.tiles].reverse() })).toBe(false);
        expect(collectBoardParticleCues(before, { ...before, tiles: [...before.tiles].reverse() })).toEqual([]);
        expect(collectBoardParticleCues(before, before)).toEqual([]);
    });
});
