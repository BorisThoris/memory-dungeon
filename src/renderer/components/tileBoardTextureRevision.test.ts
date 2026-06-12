import { describe, expect, it, vi } from 'vitest';

import { subscribeTileBoardTextureRevisionUpdates } from './tileBoardTextureRevision';

describe('tileBoardTextureRevision', () => {
    it('subscribes the same invalidation callback to texture images and card rank fonts', () => {
        const onRevisionInvalidated = vi.fn();
        let textureListener = (): void => {
            throw new Error('texture listener was not registered');
        };
        let fontListener = (): void => {
            throw new Error('font listener was not registered');
        };

        subscribeTileBoardTextureRevisionUpdates(
            {
                subscribeCardRankFontLoaded(listener) {
                    fontListener = listener;
                    return vi.fn();
                },
                subscribeTextureImageUpdates(listener) {
                    textureListener = listener;
                    return vi.fn();
                }
            },
            onRevisionInvalidated
        );

        textureListener();
        fontListener();

        expect(onRevisionInvalidated).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes card rank font and texture image listeners', () => {
        const events: string[] = [];
        const unsubscribe = subscribeTileBoardTextureRevisionUpdates(
            {
                subscribeCardRankFontLoaded() {
                    return () => events.push('font');
                },
                subscribeTextureImageUpdates() {
                    return () => events.push('texture');
                }
            },
            vi.fn()
        );

        unsubscribe();

        expect(events).toEqual(['font', 'texture']);
    });
});
