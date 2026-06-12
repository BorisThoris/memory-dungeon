import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    RunState,
    Tile
} from './contracts';
import {
    armRegionShuffleRow,
    maxPinnedTilesForRun,
    togglePinnedTile,
    toggleStrayRemoveArmed
} from './board-power-state';

const tile = (id: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey: id,
    symbol: id,
    label: id,
    state
});

const board = (): BoardState => ({
    level: 1,
    pairCount: 0,
    columns: 2,
    rows: 2,
    tiles: [
        tile('a1'),
        tile('a2'),
        tile('b1', 'matched')
    ],
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const run = (overrides: Partial<RunState> = {}): RunState => ({
    status: 'playing',
    board: board(),
    relicIds: [],
    pinnedTileIds: [],
    pinsPlacedCountThisRun: 0,
    strayRemoveCharges: 1,
    strayRemoveArmed: false,
    ...overrides
} as RunState);

describe('board power state rules', () => {
    it('arms a region shuffle row only while playing with a board', () => {
        expect(armRegionShuffleRow(run(), 1).regionShuffleRowArmed).toBe(1);
        expect(armRegionShuffleRow(run({ status: 'memorize' }), 1).regionShuffleRowArmed).toBeUndefined();
        expect(armRegionShuffleRow(run({ board: null }), 1).regionShuffleRowArmed).toBeUndefined();
    });

    it('toggles hidden tile pins and tracks new pin placements', () => {
        const pinned = togglePinnedTile(run(), 'a1');
        expect(pinned.pinnedTileIds).toEqual(['a1']);
        expect(pinned.pinsPlacedCountThisRun).toBe(1);

        const unpinned = togglePinnedTile(pinned, 'a1');
        expect(unpinned.pinnedTileIds).toEqual([]);
        expect(unpinned.pinsPlacedCountThisRun).toBe(1);
        expect(togglePinnedTile(run(), 'b1')).toEqual(run());
    });

    it('honors pin capacity from relics and contracts', () => {
        const relicRun = run({ relicIds: ['pin_cap_plus_one'] });
        expect(maxPinnedTilesForRun(relicRun)).toBe(maxPinnedTilesForRun(run()) + 1);

        const capped = run({
            activeContract: { maxPinsTotalRun: 0 } as RunState['activeContract']
        });
        expect(togglePinnedTile(capped, 'a1')).toBe(capped);
    });

    it('toggles stray remove arming only while playing with charges', () => {
        expect(toggleStrayRemoveArmed(run()).strayRemoveArmed).toBe(true);
        expect(toggleStrayRemoveArmed(run({ strayRemoveCharges: 0 })).strayRemoveArmed).toBe(false);
        expect(toggleStrayRemoveArmed(run({ status: 'paused' })).strayRemoveArmed).toBe(false);
    });
});
