import type { CardBackSvgLayerGeometry, CardFrontSvgLayerGeometry } from './cardSvgPlaneGeometry';

/**
 * Both card faces as layered meshes, traced from the authored SVGs.
 *
 * The two loads are chained rather than raced: `SVGLoader.parse` is main-thread work, and two of
 * them at once on a phone is a visible hitch at board entry. Either face may come back null (the
 * art is missing, too big to mesh, or over the vertex cap) and the other still renders — a card
 * with a live frame and a raster back is a fair result; failing both because one failed is not.
 */
export interface TileBoardSharedCardSvgAssets {
    backLayers: CardBackSvgLayerGeometry[] | null;
    frontLayers: CardFrontSvgLayerGeometry[] | null;
}

interface LoadTileBoardSharedCardSvgAssetsInput {
    backUrl: string;
    frontUrl: string;
    loadBackLayers: (url: string) => Promise<CardBackSvgLayerGeometry[] | null>;
    loadFrontLayers: (url: string) => Promise<CardFrontSvgLayerGeometry[] | null>;
}

export const disposeTileBoardSharedCardLayers = (
    layers: readonly { geometry: { dispose: () => void } }[] | null | undefined
): void => {
    for (const layer of layers ?? []) {
        layer.geometry.dispose();
    }
};

/** Kept for the back alone, where callers hold just that list. */
export const disposeTileBoardSharedCardBackLayers = disposeTileBoardSharedCardLayers;

export const disposeTileBoardSharedCardSvgAssets = (
    assets: TileBoardSharedCardSvgAssets | null | undefined
): void => {
    if (!assets) {
        return;
    }
    disposeTileBoardSharedCardLayers(assets.frontLayers);
    disposeTileBoardSharedCardLayers(assets.backLayers);
};

const loadOrNull = async <T>(load: () => Promise<T | null>): Promise<T | null> => {
    try {
        return await load();
    } catch {
        return null;
    }
};

export const loadTileBoardSharedCardSvgAssets = async ({
    backUrl,
    frontUrl,
    loadBackLayers,
    loadFrontLayers
}: LoadTileBoardSharedCardSvgAssetsInput): Promise<TileBoardSharedCardSvgAssets | null> => {
    const frontLayers = await loadOrNull(() => loadFrontLayers(frontUrl));
    const backLayers = await loadOrNull(() => loadBackLayers(backUrl));

    if (frontLayers == null && backLayers == null) {
        return null;
    }

    return { backLayers, frontLayers };
};
