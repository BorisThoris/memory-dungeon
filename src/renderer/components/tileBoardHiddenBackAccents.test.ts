import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
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
        tileSwapEligibleTileIds: new Set(),
        tileSwapFirstTileId: null,
        tileSwapPowerVisualActive: false,
        tile: tile(),
        ...overrides
    });

describe('tileBoardHiddenBackAccents', () => {

    it('surfaces the non-pickable accent for hidden backs', () => {
        expect(accents({ flipLocked: true }).nonPickableBack).toBe(true);
        expect(accents().nonPickableBack).toBe(false);
    });

    it('surfaces trait accents for hidden backs', () => {
        expect(accents({ tile: tile({ tileTraitKind: 'heavy' }) }).traitBackAccent).toBe('heavy');
    });
});

describe('the clump read accent', () => {
    it('outlines what this match takes, and yields to any armed power', () => {
        expect(accents({ clumpReadTileIds: new Set(['tile-a']) }).powerBackAccent).toBe('clump');
        expect(accents({ clumpReadTileIds: new Set(['other']) }).powerBackAccent).toBeNull();
        expect(
            accents({
                clumpReadTileIds: new Set(['tile-a']),
                peekPowerVisualActive: true,
                peekEligibleTileIds: new Set(['tile-a'])
            }).powerBackAccent
        ).toBe('peek');
    });

    it('ghosts what the next rung would add, under the solid read and under every power', () => {
        expect(accents({ clumpReadNextTileIds: new Set(['tile-a']) }).powerBackAccent).toBe('clumpNext');
        // A tile that goes now is drawn as going now: the ghost is only ever the rung's extra.
        expect(
            accents({
                clumpReadNextTileIds: new Set(['tile-a']),
                clumpReadTileIds: new Set(['tile-a'])
            }).powerBackAccent
        ).toBe('clump');
        expect(
            accents({
                clumpReadNextTileIds: new Set(['tile-a']),
                peekPowerVisualActive: true,
                peekEligibleTileIds: new Set(['tile-a'])
            }).powerBackAccent
        ).toBe('peek');
    });
});
