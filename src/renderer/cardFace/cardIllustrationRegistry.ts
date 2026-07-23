import type { CardIllustrationRegistry } from './resolveCardIllustrationUrl';
import deck01 from '../assets/cards/illustrations/deck-01.svg?url';
import deck02 from '../assets/cards/illustrations/deck-02.svg?url';
import deck03 from '../assets/cards/illustrations/deck-03.svg?url';
import deck04 from '../assets/cards/illustrations/deck-04.svg?url';
import deck05 from '../assets/cards/illustrations/deck-05.svg?url';
import deck06 from '../assets/cards/illustrations/deck-06.svg?url';
import { buildWeightedFacePanelFallbackStrip } from './weightedFacePanelPool';

/** Legacy vector deck (kept on disk; included in preload for manifest + potential art swap). */
export const LEGACY_SVG_ILLUSTRATION_URLS = [deck01, deck02, deck03, deck04, deck05, deck06] as const;

const weightedFacePanelPool = buildWeightedFacePanelFallbackStrip();

/**
 * SDXL face-panel rasters (illustration mat). `resolveCardIllustrationUrl` maps digit ranks
 * and non-digit tiles into a weighted pool (common vs uncommon vs rare). See `batch_local_face_panels.py`
 * and `weightedFacePanelPool.ts`.
 */
export const CARD_ILLUSTRATION_REGISTRY: CardIllustrationRegistry = {
    bySymbol: {},
    numericFallbackPool: weightedFacePanelPool,
    nonDigitFallbackPool: weightedFacePanelPool
};

const getSortedRegistryMapUrls = (record: Record<string, string> | undefined): string[] =>
    record == null
        ? []
        : Object.keys(record)
              .sort((a, b) => a.localeCompare(b))
              .map((key) => record[key]!)
              .filter((url) => url.length > 0);

export const getCardIllustrationRegistryUrlRows = (
    registry: CardIllustrationRegistry = CARD_ILLUSTRATION_REGISTRY
): string[] => [
    ...getSortedRegistryMapUrls(registry.bySymbol),
    ...getSortedRegistryMapUrls(registry.bySymbolVariant),
    ...registry.numericFallbackPool,
    ...registry.nonDigitFallbackPool,
    ...LEGACY_SVG_ILLUSTRATION_URLS
];

/** Unique URLs for preload (deduped). */
export const getAllCardIllustrationUrls = (): string[] => {
    const set = new Set<string>();
    for (const url of getCardIllustrationRegistryUrlRows()) {
        set.add(url);
    }
    return [...set];
};
