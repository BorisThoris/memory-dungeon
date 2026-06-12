import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { getTileBoardSpotlightState } from './tileBoardSpotlightState';

const tile = (pairKey = 'pair-a', state: Tile['state'] = 'hidden'): Tile =>
    ({
        id: 'tile-a',
        pairKey,
        label: 'A',
        state
    }) as Tile;

const spotlightState = (
    overrides: Partial<Parameters<typeof getTileBoardSpotlightState>[0]> = {}
) =>
    getTileBoardSpotlightState({
        bountyPairKey: null,
        faceUp: false,
        shiftingSpotlightActive: false,
        tile: tile(),
        wardPairKey: null,
        ...overrides
    });

describe('tileBoardSpotlightState', () => {
    it('highlights face-up unmatched ward and bounty pair tiles', () => {
        expect(
            spotlightState({
                bountyPairKey: 'pair-a',
                faceUp: true,
                tile: tile('pair-a', 'flipped')
            }).spotlightBountyHighlight
        ).toBe(true);

        expect(
            spotlightState({
                faceUp: true,
                tile: tile('pair-a', 'flipped'),
                wardPairKey: 'pair-a'
            }).spotlightWardHighlight
        ).toBe(true);
    });

    it('does not highlight matched or mismatched face-up tiles', () => {
        expect(
            spotlightState({
                bountyPairKey: 'pair-a',
                faceUp: true,
                tile: tile('pair-a', 'matched')
            }).spotlightBountyHighlight
        ).toBe(false);

        expect(
            spotlightState({
                faceUp: true,
                tile: tile('pair-b', 'flipped'),
                wardPairKey: 'pair-a'
            }).spotlightWardHighlight
        ).toBe(false);
    });

    it('marks spotlight backs only while the shifting spotlight is active', () => {
        expect(
            spotlightState({
                bountyPairKey: 'pair-a',
                shiftingSpotlightActive: true
            }).spotlightBountyOnBack
        ).toBe(true);

        expect(
            spotlightState({
                shiftingSpotlightActive: true,
                wardPairKey: 'pair-a'
            }).spotlightWardOnBack
        ).toBe(true);

        expect(
            spotlightState({
                bountyPairKey: 'pair-a',
                shiftingSpotlightActive: false
            }).spotlightBountyOnBack
        ).toBe(false);
    });

    it('keeps spotlight back markers off for face-up tiles', () => {
        expect(
            spotlightState({
                faceUp: true,
                shiftingSpotlightActive: true,
                wardPairKey: 'pair-a'
            }).spotlightWardOnBack
        ).toBe(false);
    });
});
