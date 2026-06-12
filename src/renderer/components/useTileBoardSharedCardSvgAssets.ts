import { useEffect, useState } from 'react';
import type { BufferGeometry } from 'three';

import cardBackSvgUrl from '../assets/textures/cards/authored-card-back.svg?url';
import cardFrontSvgUrl from '../assets/textures/cards/front.svg?url';
import {
    loadSharedCardBackSvgLayerGeometries,
    loadSharedCardSvgPlaneGeometry,
    type CardBackSvgLayerGeometry
} from './cardSvgPlaneGeometry';
import {
    disposeTileBoardSharedCardBackLayers,
    disposeTileBoardSharedCardSvgAssets,
    loadTileBoardSharedCardSvgAssets
} from './tileBoardSharedCardAssets';

export interface TileBoardSharedCardSvgAssetState {
    sharedCardBackLayers: readonly CardBackSvgLayerGeometry[] | null;
    sharedCardFrontGeometry: BufferGeometry | null;
}

export const useTileBoardSharedCardSvgAssets = (): TileBoardSharedCardSvgAssetState => {
    const [sharedCardFrontGeometry, setSharedCardFrontGeometry] = useState<BufferGeometry | null>(null);
    const [sharedCardBackLayers, setSharedCardBackLayers] = useState<readonly CardBackSvgLayerGeometry[] | null>(null);

    /** Chain front -> back so two huge SVGLoader.parse passes never run in parallel (main-thread + memory). */
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const assets = await loadTileBoardSharedCardSvgAssets({
                backUrl: cardBackSvgUrl,
                frontUrl: cardFrontSvgUrl,
                loadBackLayers: loadSharedCardBackSvgLayerGeometries,
                loadFrontGeometry: loadSharedCardSvgPlaneGeometry
            });
            if (assets == null) {
                return;
            }
            if (cancelled) {
                disposeTileBoardSharedCardSvgAssets(assets);
                return;
            }
            setSharedCardFrontGeometry(assets.frontGeometry);
            setSharedCardBackLayers(assets.backLayers);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return () => {
            sharedCardFrontGeometry?.dispose();
        };
    }, [sharedCardFrontGeometry]);

    useEffect(() => {
        return () => {
            disposeTileBoardSharedCardBackLayers(sharedCardBackLayers);
        };
    }, [sharedCardBackLayers]);

    return { sharedCardBackLayers, sharedCardFrontGeometry };
};
