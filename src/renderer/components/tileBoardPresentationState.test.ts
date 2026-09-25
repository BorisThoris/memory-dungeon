import { describe, expect, it } from 'vitest';
import type { RunStatus, Tile } from '../../shared/contracts';
import { getTileBoardPresentationState } from './tileBoardPresentationState';

const tile = (state: Tile['state'] = 'flipped', pairKey = 'pair-a'): Tile =>
    ({
        id: 'tile-a',
        pairKey,
        label: 'A',
        state
    }) as Tile;

const presentationState = (
    overrides: Partial<Parameters<typeof getTileBoardPresentationState>[0]> = {}
) =>
    getTileBoardPresentationState({
        faceUp: true,
        nBackAnchorMarkedTileId: null,
        nBackMutatorActive: false,
        runStatus: 'playing' as RunStatus,
        silhouetteDuringPlay: false,
        tile: tile(),
        wideRecallInPlay: false,
        ...overrides
    });

describe('tileBoardPresentationState', () => {
    it('does not present hidden or non-playing flipped tiles', () => {
        expect(
            presentationState({
                faceUp: false,
                nBackAnchorMarkedTileId: 'tile-a',
                nBackMutatorActive: true,
                silhouetteDuringPlay: true,
                wideRecallInPlay: true
            })
        ).toEqual({
            // A flipped card drawn face down (mid-turn): no face-up reads, and not a hidden marked card either.
            presentationNBackAnchor: false,
            presentationSilhouette: false,
            presentationWideRecall: false
        });

        expect(
            presentationState({
                runStatus: 'resolving',
                silhouetteDuringPlay: true,
                wideRecallInPlay: true
            })
        ).toMatchObject({
            presentationSilhouette: false,
            presentationWideRecall: false
        });
    });

    it('enables wide recall and silhouette presentation for in-play face-up flipped tiles', () => {
        expect(
            presentationState({
                silhouetteDuringPlay: true,
                wideRecallInPlay: true
            })
        ).toMatchObject({
            presentationSilhouette: true,
            presentationWideRecall: true
        });
    });

    it('marks the anchor on its one face-down marked card, and nowhere else', () => {
        const hidden = tile('hidden');
        const marked = { faceUp: false, tile: hidden, nBackAnchorMarkedTileId: 'tile-a', nBackMutatorActive: true };
        expect(presentationState(marked).presentationNBackAnchor).toBe(true);
        expect(presentationState({ ...marked, nBackAnchorMarkedTileId: 'tile-b' }).presentationNBackAnchor).toBe(false);
        expect(presentationState({ ...marked, nBackMutatorActive: false }).presentationNBackAnchor).toBe(false);
        expect(presentationState({ ...marked, faceUp: true, tile: tile('flipped') }).presentationNBackAnchor).toBe(false);
        expect(presentationState({ ...marked, runStatus: 'memorize' as RunStatus }).presentationNBackAnchor).toBe(false);
    });
});
