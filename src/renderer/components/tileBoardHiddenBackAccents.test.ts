import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { DECOY_PAIR_KEY } from '../../shared/tile-identity';
import { getTileBoardHiddenBackAccents, type TileBoardHiddenBackAccentsInput } from './tileBoardHiddenBackAccents';

const tile = (overrides: Partial<Tile> = {}): Tile =>
    ({
        id: 'tile-a',
        pairKey: 'pair-a',
        label: 'A',
        state: 'hidden',
        ...overrides
    }) as Tile;

const accents = (overrides: Partial<TileBoardHiddenBackAccentsInput> = {}) =>
    getTileBoardHiddenBackAccents({
        destroyEligibleTileIds: new Set(),
        destroyPowerVisualActive: false,
        faceUp: false,
        flipLocked: false,
        interactive: true,
        peekEligibleTileIds: new Set(),
        peekPowerVisualActive: false,
        pinModeBoardHintActive: false,
        strayEligibleTileIds: new Set(),
        strayPowerVisualActive: false,
        tile: tile(),
        ...overrides
    });

describe('tileBoardHiddenBackAccents', () => {
    it('does not surface hidden-back accents for face-up or non-hidden tiles', () => {
        expect(accents({ faceUp: true, tile: tile({ tileHazardKind: 'fuse_cache' }) })).toEqual({
            destroyBlockedDecoyBack: false,
            hazardBackAccent: null,
            nonPickableBack: false,
            objectiveBackAccent: false,
            powerBackAccent: null,
            routeBackAccent: false
        });
        expect(accents({ tile: tile({ state: 'flipped', tileHazardKind: 'fuse_cache' }) })).toEqual({
            destroyBlockedDecoyBack: false,
            hazardBackAccent: null,
            nonPickableBack: false,
            objectiveBackAccent: false,
            powerBackAccent: null,
            routeBackAccent: false
        });
    });

    it('surfaces hazard, route, objective, and non-pickable accents for hidden backs', () => {
        const result = accents({
            flipLocked: true,
            tile: tile({
                dungeonCardKind: 'trap',
                routeCardKind: 'greed_cache',
                tileHazardKind: 'cascade_cache'
            })
        });

        expect(result.hazardBackAccent).toBe('cascade_cache');
        expect(result.routeBackAccent).toBe(true);
        expect(result.objectiveBackAccent).toBe(true);
        expect(result.nonPickableBack).toBe(true);
    });

    it('applies power accent precedence and blocks destroy on decoys', () => {
        expect(accents({ pinModeBoardHintActive: true }).powerBackAccent).toBe('pin');
        expect(
            accents({
                destroyEligibleTileIds: new Set(['tile-a']),
                destroyPowerVisualActive: true
            }).powerBackAccent
        ).toBe('destroy');
        expect(
            accents({
                peekEligibleTileIds: new Set(['tile-a']),
                peekPowerVisualActive: true
            }).powerBackAccent
        ).toBe('peek');
        expect(
            accents({
                strayEligibleTileIds: new Set(['tile-a']),
                strayPowerVisualActive: true
            }).powerBackAccent
        ).toBe('stray');

        const decoy = accents({
            destroyEligibleTileIds: new Set(['decoy']),
            destroyPowerVisualActive: true,
            tile: tile({ id: 'decoy', pairKey: DECOY_PAIR_KEY })
        });
        expect(decoy.destroyBlockedDecoyBack).toBe(true);
        expect(decoy.powerBackAccent).toBeNull();
    });
});
