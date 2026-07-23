import type { BufferGeometry } from 'three';
import type { CardBackSvgLayerGeometry } from './cardSvgPlaneGeometry';

interface TileBoardSharedCardSvgAssets {
    backLayers: CardBackSvgLayerGeometry[];
    frontGeometry: BufferGeometry;
}

interface LoadTileBoardSharedCardSvgAssetsInput {
    backUrl: string;
    frontUrl: string;
    loadBackLayers: (url: string) => Promise<CardBackSvgLayerGeometry[] | null>;
    loadFrontGeometry: (url: string) => Promise<BufferGeometry | null>;
}

export const disposeTileBoardSharedCardBackLayers = (
    layers: readonly CardBackSvgLayerGeometry[] | null | undefined
): void => {
    for (const layer of layers ?? []) {
        layer.geometry.dispose();
    }
};

export const disposeTileBoardSharedCardSvgAssets = (
    assets: TileBoardSharedCardSvgAssets | null | undefined
): void => {
    if (!assets) {
        return;
    }

    assets.frontGeometry.dispose();
    disposeTileBoardSharedCardBackLayers(assets.backLayers);
};

export const loadTileBoardSharedCardSvgAssets = async ({
    backUrl,
    frontUrl,
    loadBackLayers,
    loadFrontGeometry
}: LoadTileBoardSharedCardSvgAssetsInput): Promise<TileBoardSharedCardSvgAssets | null> => {
    let frontGeometry: BufferGeometry | null;
    try {
        frontGeometry = await loadFrontGeometry(frontUrl);
    } catch {
        return null;
    }

    if (frontGeometry == null) {
        return null;
    }

    let backLayers: CardBackSvgLayerGeometry[] | null;
    try {
        backLayers = await loadBackLayers(backUrl);
    } catch {
        frontGeometry.dispose();
        return null;
    }

    if (backLayers == null) {
        frontGeometry.dispose();
        return null;
    }

    return { backLayers, frontGeometry };
};
