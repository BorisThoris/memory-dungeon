import { useEffect, useState } from 'react';

import cardBackSvgUrl from '../assets/textures/cards/authored-card-back.svg?url';
import cardFrontSvgUrl from '../assets/textures/cards/authored-card-front.svg?url';
import {
    loadSharedCardBackSvgLayerGeometries,
    loadSharedCardFrontSvgLayerGeometries,
    type CardBackSvgLayerGeometry,
    type CardFrontSvgLayerGeometry
} from './cardSvgPlaneGeometry';
import {
    disposeTileBoardSharedCardLayers,
    disposeTileBoardSharedCardSvgAssets,
    loadTileBoardSharedCardSvgAssets
} from './tileBoardSharedCardAssets';

interface TileBoardSharedCardSvgAssetState {
    sharedCardBackLayers: readonly CardBackSvgLayerGeometry[] | null;
    sharedCardFrontLayers: readonly CardFrontSvgLayerGeometry[] | null;
}

/**
 * The authored card SVGs as layered meshes, loaded once for the whole board and shared by every
 * tile. The traced *illustration* art (`front.svg`, `back.svg`) is megabytes and stays a raster —
 * these are the hand-authored frames, a few kilobytes each, that the cards animate.
 *
 * `enabled` is the device's budget, not the player's taste: fourteen layer meshes a card (six face,
 * eight back) halved a throttled phone's board, 50 fps to 25, so only a machine on the full scene
 * tier meshes them. A phone keeps the raster faces it already had, and never pays the parse either.
 */
export const useTileBoardSharedCardSvgAssets = (enabled: boolean): TileBoardSharedCardSvgAssetState => {
    const [loaded, setLoaded] = useState<{
        back: readonly CardBackSvgLayerGeometry[] | null;
        front: readonly CardFrontSvgLayerGeometry[] | null;
    }>({ back: null, front: null });
    // Disabled is not "loaded nothing": the meshes stay unbuilt rather than being built and hidden,
    // so a device that cannot afford them never pays the parse or holds the geometry.
    const sharedCardFrontLayers = enabled ? loaded.front : null;
    const sharedCardBackLayers = enabled ? loaded.back : null;

    /** Chain front -> back so two SVGLoader.parse passes never run in parallel (main-thread + memory). */
    useEffect(() => {
        if (!enabled) {
            return undefined;
        }
        let cancelled = false;
        void (async () => {
            const assets = await loadTileBoardSharedCardSvgAssets({
                backUrl: cardBackSvgUrl,
                frontUrl: cardFrontSvgUrl,
                loadBackLayers: loadSharedCardBackSvgLayerGeometries,
                loadFrontLayers: loadSharedCardFrontSvgLayerGeometries
            });
            if (assets == null) {
                return;
            }
            if (cancelled) {
                disposeTileBoardSharedCardSvgAssets(assets);
                return;
            }
            setLoaded({ back: assets.backLayers, front: assets.frontLayers });
        })().catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    useEffect(() => {
        return () => {
            disposeTileBoardSharedCardLayers(loaded.front);
            disposeTileBoardSharedCardLayers(loaded.back);
        };
    }, [loaded]);

    return { sharedCardBackLayers, sharedCardFrontLayers };
};
