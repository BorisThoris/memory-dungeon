import { getAllCardIllustrationUrls } from '../cardFace/cardIllustrationRegistry';
import { preloadCardIllustrationImages } from '../cardFace/cardIllustrationImages';
import { preloadTileTextureImages } from '../components/tileTextures';
import { loadRelicTextures, type RelicTextureSet } from '../components/startupIntroTextures';
import { MODE_CARD_ART, UI_ART } from './ui';

const preloadRasterUrl = (url: string): Promise<void> =>
    new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = url;
    });

/** Deduped menu / mode-poster rasters so MainMenu and Choose Your Path decode before first paint. */
export const preloadUiRasterImages = (): Promise<void> => {
    const urls = [...new Set([...Object.values(UI_ART), ...Object.values(MODE_CARD_ART), MODE_CARD_ART.fallback])];
    return Promise.all(urls.map(preloadRasterUrl)).then(() => undefined);
};

export interface PreloadStartupCriticalAssetsOptions {
    relicSvgUrl: string;
    webgl: boolean;
}

export interface PreloadStartupCriticalAssetsResult {
    relicTextureSet: RelicTextureSet | null;
}

/**
 * Tiles, card illustrations, UI backgrounds, and (when WebGL) relic SVG→texture for the startup intro.
 * Raster failures resolve so boot cannot deadlock; relic parse failure yields null (caller shows fallback).
 */
export const preloadStartupCriticalAssets = async (
    options: PreloadStartupCriticalAssetsOptions
): Promise<PreloadStartupCriticalAssetsResult> => {
    const relicPromise: Promise<RelicTextureSet | null> = options.webgl
        ? loadRelicTextures(options.relicSvgUrl).catch(() => null)
        : Promise.resolve(null);

    const [, , , relicTextureSet] = await Promise.all([
        preloadTileTextureImages(),
        preloadCardIllustrationImages(getAllCardIllustrationUrls()),
        preloadUiRasterImages(),
        relicPromise
    ]);

    return { relicTextureSet };
};
