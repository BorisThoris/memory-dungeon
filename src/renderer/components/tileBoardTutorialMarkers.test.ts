import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from '../../shared/tile-identity';
import { getTileBoardTutorialPairOrdinal, getTutorialPairOrdinalByKey } from './tileBoardTutorialMarkers';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile =>
    ({
        id,
        pairKey,
        label: id,
        state
    }) as Tile;

const board = (tiles: Tile[]): BoardState =>
    ({
        level: 1,
        pairCount: Math.floor(tiles.length / 2),
        columns: 2,
        rows: Math.ceil(tiles.length / 2),
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        featuredObjectiveId: null,
        floorArchetypeId: null
    }) as BoardState;

describe('tileBoardTutorialMarkers', () => {
    it('builds sorted tutorial pair ordinals while skipping decoy and wild pair keys', () => {
        const result = getTutorialPairOrdinalByKey(
            board([
                tile('d', DECOY_PAIR_KEY),
                tile('w', WILD_PAIR_KEY),
                tile('b', 'beta'),
                tile('a', 'alpha')
            ]),
            true
        );

        expect([...result!.entries()]).toEqual([
            ['alpha', 1],
            ['beta', 2]
        ]);
    });

    it('does not build ordinals when tutorial markers are disabled', () => {
        expect(getTutorialPairOrdinalByKey(board([tile('a', 'alpha')]), false)).toBeNull();
    });

    it('returns the ordinal only for hidden face-down tutorial tiles', () => {
        const ordinalByKey = new Map([['alpha', 1]]);

        expect(
            getTileBoardTutorialPairOrdinal({
                faceUp: false,
                showTutorialPairMarkers: true,
                tile: tile('a', 'alpha'),
                tutorialPairOrdinalByKey: ordinalByKey
            })
        ).toBe(1);

        expect(
            getTileBoardTutorialPairOrdinal({
                faceUp: true,
                showTutorialPairMarkers: true,
                tile: tile('a', 'alpha'),
                tutorialPairOrdinalByKey: ordinalByKey
            })
        ).toBeNull();

        expect(
            getTileBoardTutorialPairOrdinal({
                faceUp: false,
                showTutorialPairMarkers: true,
                tile: tile('a', 'alpha', 'flipped'),
                tutorialPairOrdinalByKey: ordinalByKey
            })
        ).toBeNull();
    });

    it('returns null when markers are disabled or no ordinal exists', () => {
        expect(
            getTileBoardTutorialPairOrdinal({
                faceUp: false,
                showTutorialPairMarkers: false,
                tile: tile('a', 'alpha'),
                tutorialPairOrdinalByKey: new Map([['alpha', 1]])
            })
        ).toBeNull();

        expect(
            getTileBoardTutorialPairOrdinal({
                faceUp: false,
                showTutorialPairMarkers: true,
                tile: tile('a', 'missing'),
                tutorialPairOrdinalByKey: new Map([['alpha', 1]])
            })
        ).toBeNull();
    });
});
