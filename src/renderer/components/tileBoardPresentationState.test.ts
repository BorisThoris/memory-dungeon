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
        nBackAnchorPairKey: null,
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
                nBackAnchorPairKey: 'pair-a',
                nBackMutatorActive: true,
                silhouetteDuringPlay: true,
                wideRecallInPlay: true
            })
        ).toEqual({
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

    it('marks the n-back anchor only for the active matching in-play flip', () => {
        expect(
            presentationState({
                nBackAnchorPairKey: 'pair-a',
                nBackMutatorActive: true
            }).presentationNBackAnchor
        ).toBe(true);

        expect(
            presentationState({
                nBackAnchorPairKey: 'pair-b',
                nBackMutatorActive: true
            }).presentationNBackAnchor
        ).toBe(false);

        expect(
            presentationState({
                nBackAnchorPairKey: 'pair-a',
                nBackMutatorActive: false
            }).presentationNBackAnchor
        ).toBe(false);

        expect(
            presentationState({
                nBackAnchorPairKey: 'pair-a',
                nBackMutatorActive: true,
                tile: tile('matched')
            }).presentationNBackAnchor
        ).toBe(false);
    });
});
