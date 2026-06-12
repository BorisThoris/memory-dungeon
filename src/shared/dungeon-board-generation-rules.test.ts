import { describe, expect, it } from 'vitest';

import type { Tile } from './contracts';
import {
    applyDungeonLayoutPlan,
    assignHazardTilesToGeneratedBoard
} from './dungeon-board-generation-rules';

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    state: 'hidden',
    symbol: id,
    label: id,
    atomicVariant: 0,
    ...overrides
});

const pairTiles = (pairKey: string): Tile[] => [tile(`${pairKey}-a`, pairKey), tile(`${pairKey}-b`, pairKey)];

describe('dungeon board generation rules', () => {
    it('gates hazard assignment by game mode, rules version, and level', () => {
        const tiles = [...pairTiles('a'), ...pairTiles('b')];

        expect(assignHazardTilesToGeneratedBoard(tiles, 1, 19, 3, 'endless')).toEqual(tiles);
        expect(assignHazardTilesToGeneratedBoard(tiles, 1, 20, 1, 'endless')).toEqual(tiles);
        expect(assignHazardTilesToGeneratedBoard(tiles, 1, 20, 3)).toEqual(tiles);
    });

    it('assigns hazards only to complete eligible pairs and adds one mirror decoy', () => {
        const tiles = [
            ...pairTiles('a'),
            ...pairTiles('b'),
            tile('special-a', 'special', { dungeonCardKind: 'enemy' }),
            tile('special-b', 'special', { dungeonCardKind: 'enemy' })
        ];
        const assigned = assignHazardTilesToGeneratedBoard(tiles, 1, 20, 7, 'endless');
        const hazardPairs = new Set(
            assigned
                .filter((candidate) => candidate.tileHazardKind != null && candidate.tileHazardKind !== 'mirror_decoy')
                .map((candidate) => candidate.pairKey)
        );

        expect(hazardPairs.size).toBeGreaterThan(0);
        expect([...hazardPairs].every((pairKey) => pairKey === 'a' || pairKey === 'b')).toBe(true);
        expect(assigned).toEqual(expect.arrayContaining([expect.objectContaining({ pairKey: '__decoy__', tileHazardKind: 'mirror_decoy' })]));
    });

    it('applies deterministic dungeon layout placement only when dungeon cards exist', () => {
        const plain = [...pairTiles('a'), ...pairTiles('b')];
        expect(applyDungeonLayoutPlan(plain, 1, 20, 4, 'normal', null, 'endless')).toEqual(plain);

        const tiles = [
            tile('exit', '__exit__', { dungeonCardKind: 'exit' }),
            tile('enemy-a', 'enemy', { dungeonCardKind: 'enemy' }),
            tile('enemy-b', 'enemy', { dungeonCardKind: 'enemy' }),
            tile('treasure-a', 'treasure', { dungeonCardKind: 'treasure' }),
            tile('treasure-b', 'treasure', { dungeonCardKind: 'treasure' }),
            tile('room', '__room__', { dungeonCardKind: 'room' })
        ];
        const layout = applyDungeonLayoutPlan(tiles, 1, 20, 4, 'normal', null, 'endless', 'treasure');
        const repeat = applyDungeonLayoutPlan(tiles, 1, 20, 4, 'normal', null, 'endless', 'treasure');

        expect(layout.map((candidate) => candidate.id)).toEqual(repeat.map((candidate) => candidate.id));
        expect(new Set(layout.map((candidate) => candidate.id))).toEqual(new Set(tiles.map((candidate) => candidate.id)));
    });
});
