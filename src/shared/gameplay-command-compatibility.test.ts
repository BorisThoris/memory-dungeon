import { describe, expect, it } from 'vitest';

import type { BoardState, RunState, Tile } from './contracts';
import {
    applyDestroyPair,
    flipTile,
    resolveBoardTurnWithEvent
} from './gameplay-command-compatibility';
import { createNewRun } from './run-creation-rules';
import { finishMemorizePhase } from './memorize-phase-rules';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    state: 'hidden',
    symbol: id,
    label: id
});

const board = (): BoardState => ({
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    tiles: [tile('a1', 'a'), tile('a2', 'a'), tile('b1', 'b'), tile('b2', 'b')],
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const playingRun = (): RunState => ({
    ...finishMemorizePhase(createNewRun(0, { gameMode: 'puzzle', runSeed: 85_001 })),
    board: board(),
    status: 'playing'
});

describe('gameplay command compatibility facade', () => {
    it('journals accepted tile flips and board turns through the command core', () => {
        const initial = playingRun();
        const first = flipTile(initial, 'a1');
        const second = flipTile(first, 'a2');
        const resolved = resolveBoardTurnWithEvent(second);

        expect(resolved.run.gameplayCommandJournal?.map((command) => command.type)).toEqual([
            'board.tile_flip',
            'board.tile_flip',
            'board.turn_resolve'
        ]);
        expect(resolved.event).toMatchObject({
            type: 'board.turn_resolved',
            outcome: 'match',
            flippedTileIds: ['a1', 'a2']
        });
        expect(resolved.run.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.tile_flipped', targetTileId: 'a1' }),
            expect.objectContaining({ type: 'board.turn_resolved', outcome: 'match' })
        ]));
    });

    it('returns the original run when a compatibility command is rejected', () => {
        const initial = { ...playingRun(), status: 'paused' as const };

        expect(flipTile(initial, 'a1')).toBe(initial);
        expect(resolveBoardTurnWithEvent(initial)).toEqual({ run: initial, event: null });
        expect(initial.gameplayCommandJournal).toBeUndefined();
        expect(initial.gameplayEventJournal).toBeUndefined();
    });

    it('spends Destroy through the same accepted command transaction', () => {
        const initial = { ...playingRun(), destroyPairCharges: 1 };
        const destroyed = applyDestroyPair(initial, 'a1');

        expect(destroyed.destroyPairCharges).toBe(0);
        expect(destroyed.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'board.destroy_pair', targetTileId: 'a1' })
        ]);
        expect(destroyed.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.pair_destroyed', targetTileId: 'a1' })
        ]));
    });
});
